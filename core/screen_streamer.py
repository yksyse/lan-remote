import asyncio
import collections
import ctypes
from ctypes import wintypes
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional
import cv2
import mss
import numpy as np

try:
    import simplejpeg
    simplejpeg_available = True
except ImportError:
    simplejpeg_available = False

try:
    from windows_capture import WindowsCapture, Frame, InternalCaptureControl
    windows_capture_available = True
except Exception:
    windows_capture_available = False

logger = logging.getLogger("ScreenStreamer")
user32 = ctypes.windll.user32
try:
    winmm = ctypes.windll.winmm
    winmm.timeBeginPeriod(1)
except Exception:
    pass


class CURSORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("hCursor", wintypes.HANDLE),
        ("ptScreenPos", wintypes.POINT),
    ]


class ScreenStreamer:
    """Hardware-accelerated 60 FPS screen capture engine supporting Direct3D 11 & SIMD JPEG."""

    def __init__(self):
        self.fps: int = 60
        self.quality: int = 58
        self.scale: float = 1.0
        self.max_resolution: str = "1080p"  # "1080p", "720p", "native"
        self.monitor_index: int = 1

        self.running: bool = False
        self.is_paused: bool = False
        self.capture_thread: Optional[threading.Thread] = None
        self._capture_control = None

        self.latest_frame_bytes: Optional[bytes] = None
        self.latest_frame_time: float = 0.0
        self.frame_num: int = 0
        self.frame_width: int = 1920
        self.frame_height: int = 1080
        self.original_width: int = 1920
        self.original_height: int = 1080

        self.last_frame_size: int = 0
        self.real_fps: float = 0.0
        self.capture_time_ms: float = 0.0
        self.encode_time_ms: float = 0.0

        self.active_sockets = set()
        self.frame_times = collections.deque(maxlen=60)
        self._sct = None

    def _attach_input_desktop(self):
        try:
            hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)
                user32.CloseDesktop(hdesk)
        except Exception:
            pass

    def start(self):
        if self.running:
            return
        self.running = True
        self.is_paused = False
        self.capture_thread = threading.Thread(
            target=self._run_capture_worker, daemon=True, name="ScreenCaptureWorker"
        )
        self.capture_thread.start()
        logger.info("High-speed 60 FPS screen capture pipeline started.")

    def stop(self):
        self.running = False
        if self._capture_control:
            try:
                self._capture_control.stop()
            except Exception:
                pass
        if self.capture_thread and self.capture_thread.is_alive():
            self.capture_thread.join(timeout=1.0)
        logger.info("Screen capture pipeline stopped.")

    def pause(self):
        self.is_paused = True
        logger.info("Screen stream paused (0% CPU/GPU standby active).")

    def resume(self):
        self.is_paused = False
        logger.info("Screen stream resumed.")

    def toggle_pause(self) -> bool:
        self.is_paused = not self.is_paused
        return self.is_paused

    def update_settings(
        self,
        fps: Optional[int] = None,
        quality: Optional[int] = None,
        scale: Optional[float] = None,
        max_resolution: Optional[str] = None,
        monitor_index: Optional[int] = None,
    ):
        restart_needed = False
        if fps is not None:
            self.fps = max(10, min(120, fps))
        if quality is not None:
            self.quality = max(20, min(95, quality))
        if scale is not None:
            self.scale = max(0.25, min(1.0, scale))
        if max_resolution is not None:
            self.max_resolution = max_resolution
        if monitor_index is not None and monitor_index != self.monitor_index:
            self.monitor_index = max(1, monitor_index)
            restart_needed = True

        if restart_needed and self.running and self._capture_control:
            try:
                self._capture_control.stop()
            except Exception:
                pass

    def get_monitors(self) -> List[Dict[str, Any]]:
        self._attach_input_desktop()
        monitors_info = []
        try:
            with mss.mss() as sct:
                for idx, m in enumerate(sct.monitors[1:], start=1):
                    monitors_info.append({
                        "id": idx,
                        "name": f"Display {idx} ({m['width']}x{m['height']})",
                        "width": m["width"],
                        "height": m["height"],
                        "top": m["top"],
                        "left": m["left"],
                        "is_primary": idx == 1,
                    })
        except Exception as e:
            logger.error(f"Error fetching monitors: {e}")
        return monitors_info or [{
            "id": 1,
            "name": "Display 1 (1920x1080)",
            "width": 1920,
            "height": 1080,
            "is_primary": True,
        }]

    async def wait_for_frame(self, last_time: float) -> bool:
        """High-precision non-blocking frame arrival awaiter."""
        t_expire = time.perf_counter() + 0.05
        while self.latest_frame_time <= last_time and time.perf_counter() < t_expire:
            await asyncio.sleep(0.001)
        return self.latest_frame_time > last_time

    def _process_and_publish_frame(self, raw_bgra: np.ndarray, orig_w: int, orig_h: int):
        if self.is_paused:
            return

        t_start = time.perf_counter()

        self.original_width = orig_w
        self.original_height = orig_h

        # Resolution Lock
        if self.max_resolution == "720p":
            max_w, max_h = 1280, 720
        elif self.max_resolution == "native":
            max_w, max_h = 3840, 2160
        else:  # default 1080p lock
            max_w, max_h = 1920, 1080

        base_scale = min(1.0, max_w / orig_w, max_h / orig_h)
        effective_scale = base_scale * self.scale

        if effective_scale < 1.0:
            new_w = int(orig_w * effective_scale)
            new_h = int(orig_h * effective_scale)
            target_frame = cv2.resize(raw_bgra, (new_w, new_h), interpolation=cv2.INTER_NEAREST)
        else:
            target_frame = raw_bgra

        self.frame_width = target_frame.shape[1]
        self.frame_height = target_frame.shape[0]

        # Fast SIMD JPEG
        t_enc = time.perf_counter()
        success = False
        encoded_bytes = None

        if simplejpeg_available:
            try:
                encoded_bytes = simplejpeg.encode_jpeg(
                    np.ascontiguousarray(target_frame),
                    quality=self.quality,
                    colorspace="BGRA",
                    fastdct=True,
                )
                success = True
            except Exception:
                pass

        if not success:
            bgr = cv2.cvtColor(target_frame, cv2.COLOR_BGRA2BGR)
            success, buffer = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, self.quality])
            encoded_bytes = buffer.tobytes() if success else None

        self.encode_time_ms = (time.perf_counter() - t_enc) * 1000.0

        if success and encoded_bytes:
            self.latest_frame_bytes = encoded_bytes
            self.latest_frame_time = time.time()
            self.frame_num += 1
            self.last_frame_size = len(encoded_bytes)

        self.frame_times.append(time.perf_counter())
        if len(self.frame_times) >= 2:
            dt = self.frame_times[-1] - self.frame_times[0]
            if dt > 0:
                self.real_fps = (len(self.frame_times) - 1) / dt

    def _run_capture_worker(self):
        while self.running:
            if windows_capture_available:
                try:
                    logger.info(f"Starting Direct3D 11 WindowsCapture on display {self.monitor_index}...")
                    cap = WindowsCapture(
                        cursor_capture=True,
                        draw_border=False,
                        monitor_index=self.monitor_index,
                    )
                    
                    def on_frame(frame: Frame, control: InternalCaptureControl):
                        self._capture_control = control
                        arr = frame.frame_buffer
                        if arr is not None and arr.size > 0:
                            h, w = arr.shape[:2]
                            self._process_and_publish_frame(arr, w, h)

                    def on_closed():
                        self._capture_control = None

                    cap.frame_handler = on_frame
                    cap.closed_handler = on_closed
                    cap.start()
                except Exception as e:
                    logger.warning(f"WindowsCapture fallback to MSS: {e}")
                    self._run_mss_loop()
            else:
                self._run_mss_loop()

            time.sleep(0.1)

    def _run_mss_loop(self):
        self._attach_input_desktop()
        with mss.mss() as sct:
            self._sct = sct
            while self.running and not windows_capture_available:
                if self.is_paused:
                    time.sleep(0.1)
                    continue

                t0 = time.perf_counter()
                try:
                    num_monitors = len(sct.monitors) - 1
                    target_mon_idx = min(self.monitor_index, num_monitors) if num_monitors > 0 else 1
                    monitor = sct.monitors[target_mon_idx]

                    sct_img = sct.grab(monitor)
                    img_np = np.frombuffer(sct_img.bgra, dtype=np.uint8).reshape((monitor["height"], monitor["width"], 4))
                    self._process_and_publish_frame(img_np, monitor["width"], monitor["height"])
                except Exception as e:
                    logger.error(f"MSS grab error: {e}")
                    self._attach_input_desktop()
                    time.sleep(0.01)

                target_dt = 1.0 / self.fps
                elapsed = time.perf_counter() - t0
                time.sleep(max(0.001, target_dt - elapsed))


streamer = ScreenStreamer()
