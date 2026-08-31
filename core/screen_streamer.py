import asyncio
import io
import logging
import threading
import time
from typing import Dict, List, Optional, Set
import cv2
from fastapi import WebSocket
import mss
import numpy as np

logger = logging.getLogger("ScreenStreamer")


class ScreenStreamer:
    """High-throughput, zero-buffering screen capture and encoding pipeline."""

    def __init__(self):
        self.fps: int = 30
        self.quality: int = 65  # JPEG quality 10-100
        self.scale: float = 0.75  # 0.5, 0.75, 1.0
        self.monitor_index: int = 1
        self.is_running: bool = False

        self.latest_frame_bytes: Optional[bytes] = None
        self.latest_frame_time: float = 0
        self.frame_width: int = 1920
        self.frame_height: int = 1080
        self.original_width: int = 1920
        self.original_height: int = 1080

        # Stats
        self.real_fps: float = 0.0
        self.last_frame_size: int = 0
        self.capture_time_ms: float = 0.0
        self.encode_time_ms: float = 0.0

        # Clients
        self.active_sockets: Set[WebSocket] = set()
        self.lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None

    def get_monitors(self) -> List[Dict]:
        """Return list of available monitors."""
        with mss.mss() as sct:
            monitors = []
            for idx, m in enumerate(sct.monitors):
                if idx == 0:
                    continue  # Index 0 is virtual all-in-one monitor in mss
                monitors.append(
                    {
                        "id": idx,
                        "name": f"Display {idx} ({m['width']}x{m['height']})",
                        "width": m["width"],
                        "height": m["height"],
                        "left": m["left"],
                        "top": m["top"],
                    }
                )
            return monitors

    def update_settings(
        self,
        fps: Optional[int] = None,
        quality: Optional[int] = None,
        scale: Optional[float] = None,
        monitor_index: Optional[int] = None,
    ):
        with self.lock:
            if fps is not None:
                self.fps = max(5, min(60, fps))
            if quality is not None:
                self.quality = max(10, min(95, quality))
            if scale is not None:
                self.scale = max(0.25, min(1.0, scale))
            if monitor_index is not None:
                self.monitor_index = max(1, monitor_index)

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info("Screen capture pipeline started.")

    def stop(self):
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        logger.info("Screen capture pipeline stopped.")

    def _capture_loop(self):
        encode_params = [
            cv2.IMWRITE_JPEG_QUALITY,
            self.quality,
            cv2.IMWRITE_JPEG_OPTIMIZE,
            0,
        ]
        frame_count = 0
        fps_timer = time.time()

        with mss.mss() as sct:
            while self.is_running:
                loop_start = time.time()

                # Get current config under lock
                with self.lock:
                    target_fps = self.fps
                    target_quality = self.quality
                    target_scale = self.scale
                    mon_idx = self.monitor_index

                # Update encode params if quality changed
                if encode_params[1] != target_quality:
                    encode_params[1] = target_quality

                # Ensure monitor index exists
                if mon_idx >= len(sct.monitors):
                    mon_idx = 1
                monitor = sct.monitors[mon_idx]

                try:
                    # 1. Grab screen frame
                    t0 = time.perf_counter()
                    raw = sct.grab(monitor)
                    t1 = time.perf_counter()
                    self.capture_time_ms = (t1 - t0) * 1000.0

                    self.original_width = raw.width
                    self.original_height = raw.height

                    # 2. Convert raw BGRA to 3-channel BGR numpy array
                    img_array = np.frombuffer(raw.raw, dtype=np.uint8).reshape(
                        (raw.height, raw.width, 4)
                    )[:, :, :3]

                    # 3. Scale if needed
                    if target_scale < 0.99:
                        new_w = int(raw.width * target_scale)
                        new_h = int(raw.height * target_scale)
                        img_array = cv2.resize(
                            img_array, (new_w, new_h), interpolation=cv2.INTER_LINEAR
                        )
                        self.frame_width = new_w
                        self.frame_height = new_h
                    else:
                        self.frame_width = raw.width
                        self.frame_height = raw.height

                    # 4. Encode to JPEG
                    t2 = time.perf_counter()
                    success, enc_buf = cv2.imencode(
                        ".jpg", img_array, encode_params
                    )
                    t3 = time.perf_counter()
                    self.encode_time_ms = (t3 - t2) * 1000.0

                    if success:
                        frame_bytes = enc_buf.tobytes()
                        self.last_frame_size = len(frame_bytes)
                        self.latest_frame_bytes = frame_bytes
                        self.latest_frame_time = time.time()

                    # FPS counter
                    frame_count += 1
                    now = time.time()
                    if now - fps_timer >= 1.0:
                        self.real_fps = frame_count / (now - fps_timer)
                        frame_count = 0
                        fps_timer = now

                except Exception as e:
                    logger.error(f"Capture error: {e}")
                    time.sleep(0.1)

                # Regulate frame rate
                elapsed = time.time() - loop_start
                target_period = 1.0 / target_fps
                sleep_time = target_period - elapsed
                if sleep_time > 0.001:
                    time.sleep(sleep_time)


# Global streamer instance
streamer = ScreenStreamer()
