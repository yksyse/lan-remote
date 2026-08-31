import asyncio
import collections
import ctypes
import os
import platform
import subprocess
import time
from typing import Any, Dict, List, Optional
import psutil

try:
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

    pycaw_available = True
except Exception:
    pycaw_available = False

try:
    import win32clipboard
    import win32gui
    import win32process

    win32_available = True
except Exception:
    win32_available = False

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32


class SystemManager:
    """Manages host performance, GPU metrics, Task Manager, File Explorer, and clipboard history."""

    def __init__(self):
        self._volume_endpoint = None
        self.history_len = 30
        self.cpu_history = collections.deque(
            [0.0] * self.history_len, maxlen=self.history_len
        )
        self.ram_history = collections.deque(
            [0.0] * self.history_len, maxlen=self.history_len
        )
        self.gpu_history = collections.deque(
            [0.0] * self.history_len, maxlen=self.history_len
        )

        # Clipboard history (Last 5 unique items)
        self.clipboard_history: List[Dict[str, Any]] = []
        self._last_clipboard_text = ""

        self._init_audio()
        psutil.cpu_percent(interval=None)

    def _init_audio(self):
        if not pycaw_available:
            return
        try:
            devices = AudioUtilities.GetSpeakers()
            if hasattr(devices, "EndpointVolume"):
                self._volume_endpoint = devices.EndpointVolume
            else:
                interface = devices.Activate(
                    IAudioEndpointVolume._iid_, CLSCTX_ALL, None
                )
                self._volume_endpoint = ctypes.cast(
                    interface, ctypes.POINTER(IAudioEndpointVolume)
                )
        except Exception:
            self._volume_endpoint = None

    def get_volume(self) -> tuple[int, bool]:
        if not self._volume_endpoint:
            return 50, False
        try:
            vol = round(self._volume_endpoint.GetMasterVolumeLevelScalar() * 100)
            muted = bool(self._volume_endpoint.GetMute())
            return vol, muted
        except Exception:
            return 50, False

    def set_volume(self, level: int):
        if not self._volume_endpoint:
            self._init_audio()
        if self._volume_endpoint:
            try:
                clamped = max(0, min(100, level)) / 100.0
                self._volume_endpoint.SetMasterVolumeLevelScalar(clamped, None)
            except Exception:
                pass

    def toggle_mute(self) -> bool:
        if not self._volume_endpoint:
            self._init_audio()
        if self._volume_endpoint:
            try:
                cur = bool(self._volume_endpoint.GetMute())
                self._volume_endpoint.SetMute(not cur, None)
                return not cur
            except Exception:
                pass
        return False

    def get_active_window(self) -> Dict[str, str]:
        if not win32_available:
            return {"title": "Desktop", "process": "explorer.exe"}
        try:
            hwnd = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(hwnd)
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            try:
                proc = psutil.Process(pid)
                pname = proc.name()
            except Exception:
                pname = "System"
            return {"title": title or "Desktop", "process": pname}
        except Exception:
            return {"title": "Desktop", "process": "explorer.exe"}

    # ----------------------------------------------------
    # Dedicated GPU Metrics & Engine Utilization
    # ----------------------------------------------------
    def get_gpu_metrics(self) -> Dict[str, Any]:
        gpu_data = {
            "available": True,
            "name": "GPU",
            "usage_3d": 0,
            "usage_encode": 0,
            "usage_decode": 0,
            "usage_copy": 0,
            "mem_used_mb": 0,
            "mem_total_mb": 0,
            "mem_percent": 0,
            "temp": 0,
            "history": list(self.gpu_history),
        }
        try:
            out = subprocess.check_output(
                [
                    "nvidia-smi",
                    (
                        "--query-gpu=name,utilization.gpu,utilization.memory,memory.total,memory.used,temperature.gpu,utilization.encoder,utilization.decoder"
                    ),
                    "--format=csv,noheader,nounits",
                ],
                encoding="utf-8",
                timeout=1.0,
            )
            parts = [p.strip() for p in out.strip().split(",")]
            if len(parts) >= 8:
                gpu_data["name"] = parts[0]
                gpu_data["usage_3d"] = int(parts[1])
                gpu_data["mem_percent"] = (
                    round(int(parts[4]) / int(parts[3]) * 100, 1)
                    if int(parts[3]) > 0
                    else 0
                )
                gpu_data["mem_total_mb"] = int(parts[3])
                gpu_data["mem_used_mb"] = int(parts[4])
                gpu_data["temp"] = int(parts[5])
                gpu_data["usage_encode"] = int(parts[6])
                gpu_data["usage_decode"] = int(parts[7])
                self.gpu_history.append(float(gpu_data["usage_3d"]))
                gpu_data["history"] = list(self.gpu_history)
                return gpu_data
        except Exception:
            pass

        gpu_data["available"] = False
        return gpu_data

    def get_metrics(self) -> Dict[str, Any]:
        cpu_p = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()

        self.cpu_history.append(round(cpu_p, 1))
        self.ram_history.append(round(mem.percent, 1))

        self._check_clipboard_update()

        disks = []
        for part in psutil.disk_partitions(all=False):
            if "cdrom" in part.opts or part.fstype == "":
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
                disks.append(
                    {
                        "mount": part.mountpoint,
                        "total_gb": round(usage.total / (1024**3), 1),
                        "used_gb": round(usage.used / (1024**3), 1),
                        "free_gb": round(usage.free / (1024**3), 1),
                        "percent": round(usage.percent, 1),
                    }
                )
            except Exception:
                continue

        vol, muted = self.get_volume()
        uptime_sec = time.time() - psutil.boot_time()
        hours, rem = divmod(int(uptime_sec), 3600)
        mins, secs = divmod(rem, 60)
        uptime_str = f"{hours}h {mins}m"

        return {
            "cpu_percent": round(cpu_p, 1),
            "cpu_history": list(self.cpu_history),
            "memory": {
                "percent": round(mem.percent, 1),
                "used_gb": round(mem.used / (1024**3), 2),
                "total_gb": round(mem.total / (1024**3), 2),
                "history": list(self.ram_history),
            },
            "gpu": self.get_gpu_metrics(),
            "disks": disks,
            "volume": vol,
            "muted": muted,
            "uptime": uptime_str,
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "local_ips": self.get_local_ips(),
            "network_interfaces": self.get_detailed_interfaces(),
            "active_window": self.get_active_window(),
            "clipboard_history": self.clipboard_history,
        }

    # ----------------------------------------------------
    # Windows 11 Task Manager Process Engine
    # ----------------------------------------------------
    def get_processes(
        self,
        sort_by: str = "cpu",
        search: str = "",
        limit: int = 60,
    ) -> List[Dict[str, Any]]:
        procs = []
        search_q = search.lower().strip()

        for p in psutil.process_iter(
            [
                "pid",
                "name",
                "cpu_percent",
                "memory_percent",
                "memory_info",
                "status",
                "username",
            ]
        ):
            try:
                info = p.info
                name = info.get("name") or ""
                if search_q and (
                    search_q not in name.lower()
                    and search_q not in str(info.get("pid"))
                ):
                    continue

                mem_info = info.get("memory_info")
                mem_mb = (
                    round(mem_info.rss / (1024 * 1024), 1) if mem_info else 0.0
                )

                procs.append(
                    {
                        "pid": info.get("pid"),
                        "name": name,
                        "cpu_percent": round(info.get("cpu_percent") or 0.0, 1),
                        "mem_percent": round(
                            info.get("memory_percent") or 0.0, 1
                        ),
                        "mem_mb": mem_mb,
                        "status": info.get("status") or "running",
                        "username": (info.get("username") or "").split("\\")[-1]
                        or "System",
                    }
                )
            except (
                psutil.NoSuchProcess,
                psutil.AccessDenied,
                psutil.ZombieProcess,
            ):
                continue

        if sort_by == "mem":
            procs.sort(key=lambda x: x["mem_mb"], reverse=True)
        elif sort_by == "name":
            procs.sort(key=lambda x: x["name"].lower())
        elif sort_by == "pid":
            procs.sort(key=lambda x: x["pid"])
        else:  # cpu
            procs.sort(key=lambda x: x["cpu_percent"], reverse=True)

        return procs[:limit]

    def kill_process(self, pid: int, tree: bool = False) -> Dict[str, Any]:
        try:
            parent = psutil.Process(pid)
            if tree:
                children = parent.children(recursive=True)
                for child in children:
                    try:
                        child.kill()
                    except Exception:
                        pass
            parent.kill()
            return {"status": "ok", "pid": pid, "action": "killed"}
        except psutil.NoSuchProcess:
            return {
                "status": "error",
                "detail": f"Process {pid} no longer exists",
            }
        except psutil.AccessDenied:
            return {
                "status": "error",
                "detail": f"Access denied for process {pid}",
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    def set_process_priority(
        self, pid: int, priority: str
    ) -> Dict[str, Any]:
        prio_map = {
            "idle": psutil.IDLE_PRIORITY_CLASS,
            "below_normal": psutil.BELOW_NORMAL_PRIORITY_CLASS,
            "normal": psutil.NORMAL_PRIORITY_CLASS,
            "above_normal": psutil.ABOVE_NORMAL_PRIORITY_CLASS,
            "high": psutil.HIGH_PRIORITY_CLASS,
            "realtime": psutil.REALTIME_PRIORITY_CLASS,
        }
        target_prio = prio_map.get(priority.lower())
        if target_prio is None:
            return {"status": "error", "detail": "Invalid priority class"}

        try:
            p = psutil.Process(pid)
            p.nice(target_prio)
            return {"status": "ok", "pid": pid, "priority": priority}
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    # ----------------------------------------------------
    # Windows Clipboard & 5-item History Management
    # ----------------------------------------------------
    def _check_clipboard_update(self):
        try:
            clip = self.get_clipboard()
            text = clip.get("text", "").strip()
            if text and text != self._last_clipboard_text:
                self._last_clipboard_text = text
                self.clipboard_history = [
                    item
                    for item in self.clipboard_history
                    if item["text"] != text
                ]
                now_str = time.strftime("%H:%M:%S")
                self.clipboard_history.insert(
                    0,
                    {
                        "id": int(time.time() * 1000),
                        "text": text,
                        "time": now_str,
                        "preview": (
                            text[:90] + "..." if len(text) > 90 else text
                        ),
                    },
                )
                if len(self.clipboard_history) > 5:
                    self.clipboard_history.pop()
        except Exception:
            pass

    def get_clipboard(self) -> Dict[str, str]:
        if not win32_available:
            return {"status": "error", "text": ""}
        try:
            win32clipboard.OpenClipboard()
            text = ""
            if win32clipboard.IsClipboardFormatAvailable(
                win32clipboard.CF_UNICODETEXT
            ):
                text = win32clipboard.GetClipboardData(
                    win32clipboard.CF_UNICODETEXT
                )
            elif win32clipboard.IsClipboardFormatAvailable(
                win32clipboard.CF_TEXT
            ):
                text = win32clipboard.GetClipboardData(
                    win32clipboard.CF_TEXT
                ).decode("utf-8", errors="ignore")
            win32clipboard.CloseClipboard()
            return {"status": "ok", "text": text or ""}
        except Exception as e:
            try:
                win32clipboard.CloseClipboard()
            except Exception:
                pass
            return {"status": "error", "text": "", "detail": str(e)}

    def set_clipboard(self, text: str) -> Dict[str, Any]:
        if not win32_available:
            return {"status": "error", "detail": "Win32 unavailable"}
        try:
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(
                win32clipboard.CF_UNICODETEXT, str(text)
            )
            win32clipboard.CloseClipboard()
            self._check_clipboard_update()
            return {"status": "ok"}
        except Exception as e:
            try:
                win32clipboard.CloseClipboard()
            except Exception:
                pass
            return {"status": "error", "detail": str(e)}

    # ----------------------------------------------------
    # LAN File Explorer & Drives Management
    # ----------------------------------------------------
    def get_drives(self) -> List[Dict[str, str]]:
        drives = []
        for part in psutil.disk_partitions(all=False):
            if "cdrom" in part.opts or part.fstype == "":
                continue
            drives.append({
                "path": part.mountpoint,
                "label": f"Local Disk ({part.mountpoint.rstrip(chr(92))})"
            })
        # Add User shortcuts
        user_profile = os.environ.get("USERPROFILE", "")
        if user_profile:
            drives.insert(0, {"path": os.path.join(user_profile, "Desktop"), "label": "Desktop"})
            drives.insert(1, {"path": os.path.join(user_profile, "Downloads"), "label": "Downloads"})
            drives.insert(2, {"path": os.path.join(user_profile, "Documents"), "label": "Documents"})
        return drives

    def list_directory(self, target_path: Optional[str] = None) -> Dict[str, Any]:
        if not target_path or not os.path.exists(target_path):
            target_path = os.environ.get("USERPROFILE") or "C:\\"

        try:
            items = []
            with os.scandir(target_path) as entries:
                for entry in entries:
                    try:
                        stat = entry.stat()
                        is_dir = entry.is_dir()
                        size_str = ""
                        if not is_dir:
                            size_bytes = stat.st_size
                            if size_bytes > 1024 * 1024:
                                size_str = f"{round(size_bytes / (1024*1024), 1)} MB"
                            elif size_bytes > 1024:
                                size_str = f"{round(size_bytes / 1024, 1)} KB"
                            else:
                                size_str = f"{size_bytes} B"

                        items.append({
                            "name": entry.name,
                            "path": entry.path,
                            "is_dir": is_dir,
                            "size": size_str,
                            "mtime": time.strftime("%d.%m.%Y %H:%M", time.localtime(stat.st_mtime))
                        })
                    except Exception:
                        continue

            items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
            parent = os.path.dirname(target_path) if target_path != os.path.dirname(target_path) else None

            return {
                "status": "ok",
                "current_path": target_path,
                "parent_path": parent,
                "items": items[:150],
                "drives": self.get_drives()
            }
        except Exception as e:
            return {"status": "error", "detail": str(e), "current_path": target_path, "items": []}

    # ----------------------------------------------------
    # Smart Network Interface Ranking (Real LAN vs Virtual VPNs)
    # ----------------------------------------------------
    def get_detailed_interfaces(self) -> List[Dict[str, Any]]:
        interfaces = []
        for iface, snics in psutil.net_if_addrs().items():
            for snic in snics:
                if snic.family.name != "AF_INET":
                    continue
                ip = snic.address
                if ip.startswith("127.") or ip.startswith("169.254."):
                    continue

                prio = 50
                iface_lower = iface.lower()

                if ip.startswith("192.168."):
                    prio = 100
                elif ip.startswith("10."):
                    prio = 80
                elif "radmin" in iface_lower or ip.startswith("26."):
                    prio = 20
                elif "tun" in iface_lower or "tap" in iface_lower:
                    prio = 10
                elif "veth" in iface_lower or "wsl" in iface_lower:
                    prio = 15

                interfaces.append(
                    {"name": iface, "ip": ip, "priority": prio}
                )

        interfaces.sort(key=lambda x: x["priority"], reverse=True)
        return interfaces

    def get_local_ips(self) -> List[str]:
        detailed = self.get_detailed_interfaces()
        return [item["ip"] for item in detailed] or ["127.0.0.1"]

    def media_control(self, action: str):
        VK_MEDIA_NEXT_TRACK = 0xB0
        VK_MEDIA_PREV_TRACK = 0xB1
        VK_MEDIA_PLAY_PAUSE = 0xB3
        VK_VOLUME_MUTE = 0xAD
        VK_VOLUME_DOWN = 0xAE
        VK_VOLUME_UP = 0xAF

        act_map = {
            "next": VK_MEDIA_NEXT_TRACK,
            "prev": VK_MEDIA_PREV_TRACK,
            "play_pause": VK_MEDIA_PLAY_PAUSE,
            "mute": VK_VOLUME_MUTE,
            "vol_down": VK_VOLUME_DOWN,
            "vol_up": VK_VOLUME_UP,
        }
        vk = act_map.get(action)
        if vk:
            user32.keybd_event(vk, 0, 0, 0)
            time.sleep(0.02)
            user32.keybd_event(vk, 0, 2, 0)

    def power_action(self, action: str) -> Dict[str, Any]:
        if action == "lock":
            user32.LockWorkStation()
            return {"status": "ok", "message": "Workstation locked"}
        elif action == "screen_off":
            user32.SendMessageW(0xFFFF, 0x0112, 0xF170, 2)
            return {"status": "ok", "message": "Screen turned off"}
        elif action == "sleep":
            ctypes.windll.PowrProf.SetSuspendState(0, 1, 0)
            return {"status": "ok", "message": "System entering sleep mode"}
        elif action == "restart":
            subprocess.Popen(["shutdown", "/r", "/t", "0"])
            return {"status": "ok", "message": "System restarting"}
        elif action == "shutdown":
            subprocess.Popen(["shutdown", "/s", "/t", "0"])
            return {"status": "ok", "message": "System shutting down"}
        return {"status": "error", "message": "Unknown power action"}

    # ----------------------------------------------------
    # Robust Shell Command Runner (Fixed Russian Encoding / No ?????)
    # ----------------------------------------------------
    async def execute_command(self, command: str) -> Dict[str, Any]:
        try:
            # Force UTF-8 and execute command
            wrapped_cmd = f"chcp 65001 >nul && {command}"
            proc = await asyncio.create_subprocess_shell(
                wrapped_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            def smart_decode(raw_bytes: bytes) -> str:
                if not raw_bytes:
                    return ""
                # Try UTF-8 first, then cp866, then cp1251
                for enc in ("utf-8", "cp866", "cp1251", "latin1"):
                    try:
                        return raw_bytes.decode(enc)
                    except Exception:
                        continue
                return raw_bytes.decode("utf-8", errors="replace")

            return {
                "status": "ok",
                "stdout": smart_decode(stdout),
                "stderr": smart_decode(stderr),
                "exit_code": proc.returncode,
            }
        except Exception as e:
            return {"status": "error", "stderr": str(e), "exit_code": -1}


system_mgr = SystemManager()
