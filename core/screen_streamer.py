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

logger = logging.getLogger("ScreenStreamer")
user32 = ctypes.windll.user32


class CURSORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("hCursor", wintypes.HANDLE),
        ("ptScreenPos", wintypes.POINT),
    ]


class ScreenStreamer:
    """High-performance 60 FPS Windows screen capture engine with dynamic desktop attachment."""

    def __init__(self):
        self.fps: int = 60
        self.quality: int = 65
        self.scale: float = 0.75
        self.monitor_index: int = 1

        self.running: bool = False
        self.is_paused: bool = False
        self.capture_thread: Optional[threading.Thread] = None

        self.latest_frame_bytes: Optional[bytes] = None
        self.latest_frame_time: float = 0.0
        self.frame_width: int = 1920
        self.frame_height: int = 1080
        self.original_width: int = 1920
        self.original_height: int = 1080

        self.last_frame_size: int = 0
        self.real_fps: float = 0.0
        self.capture_time_ms: float = 0.0
        self.encode_time_ms: float = 0.0

        self.active_sockets = set()
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
            target=self._capture_loop, daemon=True, name="ScreenCaptureWorker"
        )
        self.capture_thread.start()
        logger.info("High-speed 60 FPS screen capture pipeline started.")

    def stop(self):
        self.running = False
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
        monitor_index: Optional[int] = None,
    ):
        if fps is not None:
            self.fps = max(10, min(120, fps))
        if quality is not None:
            self.quality = max(20, min(95, quality))
        if scale is not None:
            self.scale = max(0.25, min(1.0, scale))
        if monitor_index is not None:
            self.monitor_index = max(1, monitor_index)

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

    def _get_cursor_pos(self) -> tuple[int, int, bool]:
        try:
            ci = CURSORINFO()
            ci.cbSize = ctypes.sizeof(CURSORINFO)
            if user32.GetCursorInfo(ctypes.byref(ci)):
                if ci.flags == 1:  # CURSOR_SHOWING
                    return ci.ptScreenPos.x, ci.ptScreenPos.y, True
        except Exception:
            pass
        return 0, 0, False

    def _capture_loop(self):
        self._attach_input_desktop()
        frame_times = collections.deque(maxlen=60)
        cv_encode_params = [
            cv2.IMWRITE_JPEG_QUALITY,
            self.quality,
            cv2.IMWRITE_JPEG_OPTIMIZE,
            0,
        ]

        with mss.mss() as sct:
            self._sct = sct
            desktop_attach_counter = 0

            while self.running:
                if self.is_paused:
                    time.sleep(0.15)
                    continue

                # Periodically re-sync thread with active input desktop
                desktop_attach_counter += 1
                if desktop_attach_counter >= 120:
                    self._attach_input_desktop()
                    desktop_attach_counter = 0

                t0 = time.perf_counter()

                try:
                    num_monitors = len(sct.monitors) - 1
                    target_mon_idx = (
                        min(self.monitor_index, num_monitors)
                        if num_monitors > 0
                        else 1
                    )
                    monitor = sct.monitors[target_mon_idx]

                    self.original_width = monitor["width"]
                    self.original_height = monitor["height"]

                    sct_img = sct.grab(monitor)
                    img_np = np.array(sct_img, dtype=np.uint8)

                    t_cap = time.perf_counter()
                    self.capture_time_ms = (t_cap - t0) * 1000.0

                    # Draw hardware mouse pointer directly on buffer
                    cx, cy, cursor_visible = self._get_cursor_pos()
                    if cursor_visible:
                        rel_x = cx - monitor["left"]
                        rel_y = cy - monitor["top"]
                        if 0 <= rel_x < monitor["width"] and 0 <= rel_y < monitor["height"]:
                            arrow_pts = np.array([
                                [rel_x, rel_y],
                                [rel_x, min(monitor["height"] - 1, rel_y + 16)],
                                [min(monitor["width"] - 1, rel_x + 4), min(monitor["height"] - 1, rel_y + 12)],
                                [min(monitor["width"] - 1, rel_x + 8), min(monitor["height"] - 1, rel_y + 18)],
                                [min(monitor["width"] - 1, rel_x + 11), min(monitor["height"] - 1, rel_y + 17)],
                                [min(monitor["width"] - 1, rel_x + 7), min(monitor["height"] - 1, rel_y + 11)],
                                [min(monitor["width"] - 1, rel_x + 12), min(monitor["height"] - 1, rel_y + 11)],
                            ], dtype=np.int32)
                            cv2.fillPoly(img_np, [arrow_pts], (255, 255, 255, 255))
                            cv2.polylines(img_np, [arrow_pts], isClosed=True, color=(0, 0, 0, 255), thickness=2)

                    # Resolution scaling
                    if self.scale < 1.0:
                        new_w = int(monitor["width"] * self.scale)
                        new_h = int(monitor["height"] * self.scale)
                        target_frame = cv2.resize(
                            img_np, (new_w, new_h), interpolation=cv2.INTER_AREA
                        )
                    else:
                        target_frame = img_np

                    self.frame_width = target_frame.shape[1]
                    self.frame_height = target_frame.shape[0]

                    # Ultra-fast SIMD direct BGRA encoding with cv2 fallback
                    t_enc_start = time.perf_counter()
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
                        cv_encode_params[1] = self.quality
                        success, buffer = cv2.imencode(".jpg", bgr, cv_encode_params)
                        encoded_bytes = buffer.tobytes() if success else None

                    self.encode_time_ms = (time.perf_counter() - t_enc_start) * 1000.0

                    if success and encoded_bytes:
                        self.latest_frame_bytes = encoded_bytes
                        self.latest_frame_time = time.time()
                        self.last_frame_size = len(encoded_bytes)

                    frame_times.append(time.perf_counter())
                    if len(frame_times) >= 2:
                        dt = frame_times[-1] - frame_times[0]
                        if dt > 0:
                            self.real_fps = (len(frame_times) - 1) / dt

                except Exception as e:
                    logger.error(f"Frame capture error: {e}")
                    self._attach_input_desktop()
                    time.sleep(0.01)

                target_dt = 1.0 / self.fps
                elapsed = time.perf_counter() - t0
                sleep_time = max(0.0005, target_dt - elapsed)
                time.sleep(sleep_time)


streamer = ScreenStreamer()
