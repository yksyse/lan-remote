import asyncio
import ctypes
import os
import platform
import socket
import subprocess
import time
from typing import Any, Dict, List, Optional
import psutil

user32 = ctypes.windll.user32


class SystemManager:
    """Manages system metrics, media, power, and command execution."""

    def __init__(self):
        self.hostname = socket.gethostname()
        self.os_info = f"{platform.system()} {platform.release()}"
        self.boot_time = psutil.boot_time()

    def get_local_ips(self) -> List[str]:
        """Return list of non-loopback IPv4 addresses."""
        ips = []
        try:
            for iface, addrs in psutil.net_if_addrs().items():
                for addr in addrs:
                    if addr.family == socket.AF_INET:
                        ip = addr.address
                        if (
                            not ip.startswith("127.")
                            and not ip.startswith("169.254.")
                        ):
                            ips.append(ip)
        except Exception:
            pass

        if not ips:
            # Fallback
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                ips.append(s.getsockname()[0])
                s.close()
            except Exception:
                ips.append("127.0.0.1")

        return list(set(ips))

    def get_metrics(self) -> Dict[str, Any]:
        """Get live system stats."""
        mem = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True)

        disks = []
        for part in psutil.disk_partitions(all=False):
            if "cdrom" in part.opts or part.fstype == "":
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
                disks.append(
                    {
                        "mount": part.mountpoint,
                        "device": part.device,
                        "total_gb": round(usage.total / (1024**3), 1),
                        "used_gb": round(usage.used / (1024**3), 1),
                        "free_gb": round(usage.free / (1024**3), 1),
                        "percent": usage.percent,
                    }
                )
            except (PermissionError, FileNotFoundError):
                continue

        uptime_sec = int(time.time() - self.boot_time)
        hours, rem = divmod(uptime_sec, 3600)
        minutes, seconds = divmod(rem, 60)
        uptime_str = f"{hours}h {minutes}m {seconds}s"

        vol, muted = self.get_volume()

        return {
            "hostname": self.hostname,
            "os": self.os_info,
            "uptime": uptime_str,
            "uptime_seconds": uptime_sec,
            "cpu_percent": cpu_percent,
            "cpu_count": cpu_count,
            "memory": {
                "total_gb": round(mem.total / (1024**3), 1),
                "used_gb": round(mem.used / (1024**3), 1),
                "free_gb": round(mem.available / (1024**3), 1),
                "percent": mem.percent,
            },
            "disks": disks,
            "volume": vol,
            "muted": muted,
            "local_ips": self.get_local_ips(),
        }

    def get_volume(self) -> (int, bool):
        """Get Windows master volume level (0-100) and mute status."""
        try:
            from pycaw.pycaw import AudioUtilities

            spk = AudioUtilities.GetSpeakers()
            if spk and hasattr(spk, "EndpointVolume"):
                vol = spk.EndpointVolume
                level = int(round(vol.GetMasterVolumeLevelScalar() * 100))
                muted = bool(vol.GetMute())
                return level, muted
        except Exception:
            pass
        return 50, False

    def set_volume(self, level: int) -> bool:
        """Set Windows master volume level (0-100)."""
        level = max(0, min(100, level))
        try:
            from pycaw.pycaw import AudioUtilities

            spk = AudioUtilities.GetSpeakers()
            if spk and hasattr(spk, "EndpointVolume"):
                vol = spk.EndpointVolume
                vol.SetMasterVolumeLevelScalar(level / 100.0, None)
                return True
        except Exception:
            pass
        return False

    def toggle_mute(self) -> bool:
        """Toggle audio mute state."""
        try:
            from pycaw.pycaw import AudioUtilities

            spk = AudioUtilities.GetSpeakers()
            if spk and hasattr(spk, "EndpointVolume"):
                vol = spk.EndpointVolume
                current = vol.GetMute()
                vol.SetMute(not current, None)
                return not current
        except Exception:
            pass
        return False

    def media_control(self, action: str):
        """Execute media key action."""
        VK_MAP = {
            "play_pause": 0xB3,
            "next": 0xB0,
            "prev": 0xB1,
            "stop": 0xB2,
            "vol_up": 0xAF,
            "vol_down": 0xAE,
            "mute": 0xAD,
        }
        vk = VK_MAP.get(action.lower())
        if vk:
            # Emulate key press via user32.keybd_event
            user32.keybd_event(vk, 0, 0, 0)
            time.sleep(0.01)
            user32.keybd_event(vk, 0, 2, 0)  # KEYEVENTF_KEYUP = 2

    def power_action(self, action: str) -> Dict[str, Any]:
        """Perform power operations."""
        act = action.lower()
        if act == "lock":
            user32.LockWorkStation()
            return {"status": "ok", "message": "Workstation locked"}
        elif act == "screen_off":
            # WM_SYSCOMMAND = 0x0112, SC_MONITORPOWER = 0xF170, 2 = Off
            user32.SendMessageW(0xFFFF, 0x0112, 0xF170, 2)
            return {"status": "ok", "message": "Display powered off"}
        elif act == "sleep":
            # Suspend without hibernation
            ctypes.windll.PowrProf.SetSuspendState(0, 1, 0)
            return {"status": "ok", "message": "System entering sleep mode"}
        elif act == "hibernate":
            ctypes.windll.PowrProf.SetSuspendState(1, 1, 0)
            return {"status": "ok", "message": "System hibernating"}
        elif act == "restart":
            subprocess.Popen(["shutdown", "/r", "/t", "0"])
            return {"status": "ok", "message": "System restarting"}
        elif act == "shutdown":
            subprocess.Popen(["shutdown", "/s", "/t", "0"])
            return {"status": "ok", "message": "System shutting down"}
        else:
            return {"status": "error", "message": f"Unknown action: {action}"}

    async def execute_command(
        self, command: str, timeout: int = 15
    ) -> Dict[str, Any]:
        """Run custom shell command asynchronously."""
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=timeout
            )
            return {
                "exit_code": process.returncode,
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
            }
        except asyncio.TimeoutError:
            return {
                "exit_code": -1,
                "stdout": "",
                "stderr": "Command timed out.",
            }
        except Exception as e:
            return {"exit_code": -1, "stdout": "", "stderr": str(e)}


# Global system manager instance
system_mgr = SystemManager()
