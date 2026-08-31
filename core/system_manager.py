import asyncio
import collections
import ctypes
import os
import platform
import subprocess
import time
from typing import Any, Dict, List, Optional
import psutil

# Windows COM & Audio dependencies
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
    """Manages host performance, Windows 11 Task Manager processes, clipboard, and power."""

    def __init__(self):
        self._volume_endpoint = None
        self.history_len = 30
        self.cpu_history = collections.deque(
            [0.0] * self.history_len, maxlen=self.history_len
        )
        self.ram_history = collections.deque(
            [0.0] * self.history_len, maxlen=self.history_len
        )
        self._init_audio()
        # Prime psutil CPU monitoring
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
        """Get the title and executable name of the current foreground window."""
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

    def get_metrics(self) -> Dict[str, Any]:
        cpu_p = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()

        self.cpu_history.append(round(cpu_p, 1))
        self.ram_history.append(round(mem.percent, 1))

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
            "disks": disks,
            "volume": vol,
            "muted": muted,
            "uptime": uptime_str,
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "local_ips": self.get_local_ips(),
            "active_window": self.get_active_window(),
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
    # Windows Clipboard Sync
    # ----------------------------------------------------
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
            return {"status": "ok"}
        except Exception as e:
            try:
                win32clipboard.CloseClipboard()
            except Exception:
                pass
            return {"status": "error", "detail": str(e)}

    def get_local_ips(self) -> List[str]:
        ips = []
        for iface, snics in psutil.net_if_addrs().items():
            for snic in snics:
                if (
                    snic.family.name == "AF_INET"
                    and not snic.address.startswith("127.")
                ):
                    ips.append(snic.address)
        return ips or ["127.0.0.1"]

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

    async def execute_command(self, command: str) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            return {
                "status": "ok",
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "exit_code": proc.returncode,
            }
        except Exception as e:
            return {"status": "error", "stderr": str(e), "exit_code": -1}


system_mgr = SystemManager()
