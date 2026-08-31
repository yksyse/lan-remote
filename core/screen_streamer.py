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
    """High-performance Windows screen capture engine with pause/standby zero-resource mode."""

    def __init__(self):
        self.fps: int = 30
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

    def start(self):
        if self.running:
            return
        self.running = True
        self.is_paused = False
        self.capture_thread = threading.Thread(
            target=self._capture_loop, daemon=True, name="ScreenCaptureWorker"
        )
        self.capture_thread.start()
        logger.info("Screen capture pipeline started.")

    def stop(self):
        self.running = False
        if self.capture_thread and self.capture_thread.is_alive():
            self.capture_thread.join(timeout=1.0)
        logger.info("Screen capture pipeline stopped.")

    def pause(self):
        self.is_paused = True
        logger.info("Screen stream paused (zero resource mode active).")

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
            self.fps = max(5, min(60, fps))
        if quality is not None:
            self.quality = max(20, min(95, quality))
        if scale is not None:
            self.scale = max(0.25, min(1.0, scale))
        if monitor_index is not None:
            self.monitor_index = max(1, monitor_index)

    def get_monitors(self) -> List[Dict[str, Any]]:
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
        return monitors_info or [{"id": 1, "name": "Display 1 (1920x1080)", "width": 1920, "height": 1080, "is_primary": True}]

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
        frame_times = collections.deque(maxlen=30)
        encode_params = [
            cv2.IMWRITE_JPEG_QUALITY,
            self.quality,
            cv2.IMWRITE_JPEG_OPTIMIZE,
            0,
        ]

        with mss.mss() as sct:
            self._sct = sct
            while self.running:
                # Standby / Zero resource mode: sleep when paused or no viewers
                if self.is_paused or len(self.active_sockets) == 0:
                    time.sleep(0.15)
                    continue

                t0 = time.perf_counter()

                try:
                    num_monitors = len(sct.monitors) - 1
                    target_mon_idx = min(self.monitor_index, num_monitors) if num_monitors > 0 else 1
                    monitor = sct.monitors[target_mon_idx]

                    self.original_width = monitor["width"]
                    self.original_height = monitor["height"]

                    sct_img = sct.grab(monitor)
                    img_np = np.frombuffer(sct_img.bgra, dtype=np.uint8).reshape(
                        (sct_img.height, sct_img.width, 4)
                    )
                    frame_bgr = cv2.cvtColor(img_np, cv2.COLOR_BGRA2BGR)
                    t_cap = time.perf_counter()
                    self.capture_time_ms = (t_cap - t0) * 1000.0

                    # Render host mouse cursor
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
                            cv2.fillPoly(frame_bgr, [arrow_pts], (255, 255, 255))
                            cv2.polylines(frame_bgr, [arrow_pts], isClosed=True, color=(0, 0, 0), thickness=2)

                    # Downscale resolution if requested
                    if self.scale < 1.0:
                        new_w = int(monitor["width"] * self.scale)
                        new_h = int(monitor["height"] * self.scale)
                        frame_bgr = cv2.resize(frame_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)

                    self.frame_width = frame_bgr.shape[1]
                    self.frame_height = frame_bgr.shape[0]

                    encode_params[1] = self.quality
                    success, buffer = cv2.imencode(".jpg", frame_bgr, encode_params)
                    t_enc = time.perf_counter()
                    self.encode_time_ms = (t_enc - t_cap) * 1000.0

                    if success:
                        self.latest_frame_bytes = buffer.tobytes()
                        self.latest_frame_time = time.time()
                        self.last_frame_size = len(self.latest_frame_bytes)

                    frame_times.append(time.perf_counter())
                    if len(frame_times) >= 2:
                        dt = frame_times[-1] - frame_times[0]
                        if dt > 0:
                            self.real_fps = (len(frame_times) - 1) / dt

                except Exception as e:
                    logger.error(f"Frame capture error: {e}")
                    time.sleep(0.05)

                target_dt = 1.0 / self.fps
                elapsed = time.perf_counter() - t0
                sleep_time = max(0.001, target_dt - elapsed)
                time.sleep(sleep_time)

import collections
streamer = ScreenStreamer()
