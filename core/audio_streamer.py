import asyncio
import collections
import logging
import threading
import time
from typing import Optional, Set
from fastapi import WebSocket, WebSocketDisconnect

try:
    import pyaudiowpatch as pyaudio
    pyaudio_available = True
except Exception:
    pyaudio_available = False

logger = logging.getLogger("AudioStreamer")


class AudioStreamer:
    """Real-time Windows WASAPI Loopback audio capture and WebSocket streaming engine."""

    def __init__(self):
        self.sample_rate: int = 48000
        self.channels: int = 2
        self.chunk_size: int = 1024  # ~21.3ms per chunk at 48kHz for low latency
        self.running: bool = False
        self.is_paused: bool = False

        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.active_sockets: Set[WebSocket] = set()
        self._capture_thread: Optional[threading.Thread] = None
        self._pyaudio_instance = None
        self._stream = None

    def start(self, loop: Optional[asyncio.AbstractEventLoop] = None):
        if not pyaudio_available or self.running:
            return
        self.loop = loop or asyncio.get_event_loop()
        self.running = True
        self.is_paused = False
        self._capture_thread = threading.Thread(
            target=self._capture_loop, daemon=True, name="AudioCaptureWorker"
        )
        self._capture_thread.start()
        logger.info("WASAPI Audio Loopback capture engine initialized.")

    def stop(self):
        self.running = False
        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=1.0)
        logger.info("WASAPI Audio Loopback capture stopped.")

    def _get_loopback_device(self, p):
        try:
            wasapi_info = p.get_host_api_info_by_type(pyaudio.paWASAPI)
            default_speakers = p.get_device_info_by_index(
                wasapi_info["defaultOutputDevice"]
            )
            for loopback in p.get_loopback_device_info_generator():
                if default_speakers["name"] in loopback["name"]:
                    return loopback
            return p.get_default_wasapi_loopback()
        except Exception:
            try:
                return p.get_default_wasapi_loopback()
            except Exception:
                return None

    def _capture_loop(self):
        while self.running:
            # If no clients listening, sleep to consume 0% CPU
            if len(self.active_sockets) == 0:
                time.sleep(0.15)
                continue

            try:
                p = pyaudio.PyAudio()
                self._pyaudio_instance = p
                loopback_dev = self._get_loopback_device(p)

                if not loopback_dev:
                    p.terminate()
                    time.sleep(1.0)
                    continue

                self.sample_rate = int(loopback_dev.get("defaultSampleRate", 48000))
                self.channels = min(2, loopback_dev.get("maxInputChannels", 2) or 2)

                stream = p.open(
                    format=pyaudio.paInt16,
                    channels=self.channels,
                    rate=self.sample_rate,
                    input=True,
                    input_device_index=loopback_dev["index"],
                    frames_per_buffer=self.chunk_size,
                )
                self._stream = stream
                logger.info(
                    f"Live Audio Loopback streaming: {loopback_dev['name']} ({self.sample_rate}Hz, {self.channels}ch)"
                )

                while self.running and len(self.active_sockets) > 0:
                    if self.is_paused:
                        time.sleep(0.05)
                        continue

                    try:
                        data = stream.read(self.chunk_size, exception_on_overflow=False)
                        if data and len(self.active_sockets) > 0:
                            self._broadcast_audio(data)
                    except Exception:
                        time.sleep(0.005)

                try:
                    stream.stop_stream()
                    stream.close()
                except Exception:
                    pass
                p.terminate()

            except Exception as e:
                logger.error(f"Audio capture worker exception: {e}")
                time.sleep(0.5)

    def _broadcast_audio(self, pcm_bytes: bytes):
        if not self.active_sockets or not self.loop:
            return

        dead_sockets = set()
        for ws in list(self.active_sockets):
            try:
                asyncio.run_coroutine_threadsafe(
                    ws.send_bytes(pcm_bytes), loop=self.loop
                )
            except Exception:
                dead_sockets.add(ws)

        if dead_sockets:
            self.active_sockets.difference_update(dead_sockets)


audio_streamer = AudioStreamer()
