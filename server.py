import asyncio
import io
import json
import logging
import os
import shutil
import time
from typing import Any, Dict, List, Optional
from fastapi import (
    FastAPI,
    File,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

from core.config_manager import cfg_mgr
from core.input_driver import driver
from core.screen_streamer import streamer
from core.system_manager import system_mgr

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("LAN-Remote")

app = FastAPI(title="LAN Remote Control", version="1.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
ICONS_DIR = os.path.join(STATIC_DIR, "icons")

virtual_cursor = {"x": 0.5, "y": 0.5, "visible": True}
is_mouse_down = False


@app.on_event("startup")
async def startup_event():
    st_cfg = cfg_mgr.config.get("stream", {})
    streamer.update_settings(
        fps=st_cfg.get("fps", 60),
        quality=st_cfg.get("quality", 60),
        scale=st_cfg.get("scale", 1.0),
        max_resolution=st_cfg.get("max_resolution", "1080p"),
        monitor_index=st_cfg.get("monitor_index", 1),
    )
    streamer.start()

    ips = system_mgr.get_local_ips()
    port = cfg_mgr.config.get("server", {}).get("port", 8080)
    logger.info("=" * 60)
    logger.info("  LAN Remote Control Server Ready!")
    logger.info(f"  Local URL:   http://localhost:{port}")
    for ip in ips:
        logger.info(f"  Network URL: http://{ip}:{port}")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    streamer.stop()


# ----------------------------------------------------
# WebSocket: Real-time Screen Streaming
# ----------------------------------------------------
@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    streamer.active_sockets.add(websocket)
    last_sent_time = 0.0

    if streamer.latest_frame_bytes:
        try:
            await websocket.send_bytes(streamer.latest_frame_bytes)
            last_sent_time = streamer.latest_frame_time
        except Exception:
            pass

    async def receive_controls():
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    msg = json.loads(data)
                    mtype = msg.get("type")
                    if mtype == "ping":
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "type": "pong",
                                    "client_ts": msg.get("ts"),
                                    "server_ts": time.time() * 1000,
                                }
                            )
                        )
                    elif mtype == "set_stream":
                        streamer.update_settings(
                            fps=msg.get("fps"),
                            quality=msg.get("quality"),
                            scale=msg.get("scale"),
                            monitor_index=msg.get("monitor_index"),
                        )
                    elif mtype == "set_monitor":
                        mon_idx = int(msg.get("monitor_index", 1))
                        streamer.update_settings(monitor_index=mon_idx)
                        cfg_mgr.update_section(
                            "stream", {"monitor_index": mon_idx}
                        )
                except Exception:
                    pass
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception:
            pass

    recv_task = asyncio.create_task(receive_controls())

    try:
        while True:
            if not streamer.is_paused:
                frame_bytes = streamer.latest_frame_bytes
                frame_time = streamer.latest_frame_time

                if frame_bytes and frame_time > last_sent_time:
                    last_sent_time = frame_time
                    await websocket.send_bytes(frame_bytes)

            fps = max(10, streamer.fps)
            await asyncio.sleep(1.0 / (fps * 1.5))
    except (WebSocketDisconnect, asyncio.CancelledError, RuntimeError):
        pass
    except Exception:
        pass
    finally:
        recv_task.cancel()
        streamer.active_sockets.discard(websocket)


# ----------------------------------------------------
# WebSocket: Ultra-low latency Input Stream
# ----------------------------------------------------
@app.websocket("/ws/input")
async def websocket_input(websocket: WebSocket):
    global is_mouse_down
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                event = json.loads(data)
                etype = event.get("type")
                cursor_mode = (
                    event.get("cursor_mode")
                    or cfg_mgr.config.get("input", {}).get("cursor_mode")
                    or "physical"
                )

                if etype == "move_abs":
                    nx = float(event["x"])
                    ny = float(event["y"])
                    virtual_cursor["x"] = nx
                    virtual_cursor["y"] = ny
                    if cursor_mode == "physical" or is_mouse_down:
                        driver.move_absolute(nx, ny)

                elif etype == "move_rel":
                    dx = int(event.get("dx", 0))
                    dy = int(event.get("dy", 0))
                    w = streamer.original_width or 1920
                    h = streamer.original_height or 1080
                    virtual_cursor["x"] = max(
                        0.0, min(1.0, virtual_cursor["x"] + dx / w)
                    )
                    virtual_cursor["y"] = max(
                        0.0, min(1.0, virtual_cursor["y"] + dy / h)
                    )
                    if cursor_mode == "physical" or is_mouse_down:
                        driver.move_relative(dx, dy)

                elif etype == "down":
                    btn = event.get("button", "left")
                    if cursor_mode == "virtual":
                        driver.move_absolute(
                            virtual_cursor["x"], virtual_cursor["y"]
                        )
                        time.sleep(0.01)
                    driver.mouse_down(btn)
                    is_mouse_down = True

                elif etype == "up":
                    btn = event.get("button", "left")
                    driver.mouse_up(btn)
                    is_mouse_down = False

                elif etype == "click":
                    btn = event.get("button", "left")
                    if cursor_mode == "virtual":
                        driver.move_absolute(
                            virtual_cursor["x"], virtual_cursor["y"]
                        )
                        time.sleep(0.01)
                    driver.mouse_click(btn)

                elif etype == "dblclick":
                    btn = event.get("button", "left")
                    if cursor_mode == "virtual":
                        driver.move_absolute(
                            virtual_cursor["x"], virtual_cursor["y"]
                        )
                        time.sleep(0.01)
                    driver.mouse_double_click(btn)

                elif etype == "wheel":
                    dy = int(event.get("dy", 0))
                    dx = int(event.get("dx", 0))
                    if cursor_mode == "virtual":
                        driver.move_absolute(
                            virtual_cursor["x"], virtual_cursor["y"]
                        )
                    driver.mouse_wheel(dy, dx)

                elif etype == "key_down":
                    driver.key_down(event.get("key", ""))
                elif etype == "key_up":
                    driver.key_up(event.get("key", ""))
                elif etype == "key_press":
                    driver.key_press(event.get("key", ""))
                elif etype == "hotkey":
                    keys = event.get("keys", [])
                    if isinstance(keys, list):
                        driver.hotkey(keys)
                elif etype == "type_text":
                    text = event.get("text", "")
                    if text:
                        driver.type_text(text)
            except Exception as e:
                logger.error(f"Input processing error: {e}")
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass


# ----------------------------------------------------
# REST API: Status & Configuration
# ----------------------------------------------------
@app.get("/api/status")
async def get_status():
    metrics = system_mgr.get_metrics()
    metrics["stream"] = {
        "is_paused": streamer.is_paused,
        "real_fps": round(streamer.real_fps, 1),
        "target_fps": streamer.fps,
        "quality": streamer.quality,
        "scale": streamer.scale,
        "monitor_index": streamer.monitor_index,
        "width": streamer.frame_width,
        "height": streamer.frame_height,
        "last_frame_kb": round(streamer.last_frame_size / 1024, 1),
        "capture_ms": round(streamer.capture_time_ms, 1),
        "encode_ms": round(streamer.encode_time_ms, 1),
        "active_viewers": len(streamer.active_sockets),
    }
    metrics["monitors"] = streamer.get_monitors()
    metrics["virtual_cursor"] = virtual_cursor
    return metrics


@app.post("/api/stream/toggle")
async def toggle_stream_pause():
    paused = streamer.toggle_pause()
    return {"status": "ok", "is_paused": paused}


@app.post("/api/stream/pause")
async def pause_stream():
    streamer.pause()
    return {"status": "ok", "is_paused": True}


@app.post("/api/stream/resume")
async def resume_stream():
    streamer.resume()
    return {"status": "ok", "is_paused": False}


@app.get("/api/system/gpu")
async def get_gpu():
    return system_mgr.get_gpu_metrics()


@app.get("/api/monitors")
async def get_monitors():
    return streamer.get_monitors()


@app.post("/api/monitors/switch/{mon_id}")
async def switch_monitor(mon_id: int):
    streamer.update_settings(monitor_index=mon_id)
    cfg_mgr.update_section("stream", {"monitor_index": mon_id})
    return {"status": "ok", "current_monitor": mon_id}


@app.get("/api/config")
async def get_config():
    return cfg_mgr.get_all()


class SectionUpdate(BaseModel):
    section: str
    values: Dict[str, Any]


@app.post("/api/config")
async def update_config(update: SectionUpdate):
    cfg_mgr.update_section(update.section, update.values)
    if update.section == "stream":
        streamer.update_settings(
            fps=update.values.get("fps"),
            quality=update.values.get("quality"),
            scale=update.values.get("scale"),
            max_resolution=update.values.get("max_resolution"),
            monitor_index=update.values.get("monitor_index"),
        )
    return {"status": "ok", "config": cfg_mgr.get_all()}


# ----------------------------------------------------
# REST API: LAN File Explorer
# ----------------------------------------------------
@app.get("/api/fs/list")
async def list_files(path: Optional[str] = Query(None)):
    return system_mgr.list_directory(path)


@app.get("/api/fs/download")
async def download_file(path: str = Query(...)):
    if not os.path.exists(path) or os.path.isdir(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=os.path.basename(path))


@app.post("/api/fs/upload")
async def upload_file(
    target_dir: str = Query(...), file: UploadFile = File(...)
):
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)
    dest = os.path.join(target_dir, file.filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"status": "ok", "filename": file.filename, "path": dest}


# ----------------------------------------------------
# REST API: Windows 11 Task Manager Process Endpoints
# ----------------------------------------------------
@app.get("/api/system/processes")
async def get_processes(
    sort: str = Query("cpu"),
    search: str = Query(""),
    limit: int = Query(60),
):
    return system_mgr.get_processes(sort_by=sort, search=search, limit=limit)


class KillProcessRequest(BaseModel):
    pid: int
    tree: bool = False


@app.post("/api/system/processes/kill")
async def kill_process(req: KillProcessRequest):
    return system_mgr.kill_process(req.pid, req.tree)


class SetPriorityRequest(BaseModel):
    pid: int
    priority: str


@app.post("/api/system/processes/priority")
async def set_process_priority(req: SetPriorityRequest):
    return system_mgr.set_process_priority(req.pid, req.priority)


class RunTaskRequest(BaseModel):
    command: str


@app.post("/api/system/processes/run")
async def run_new_task(req: RunTaskRequest):
    res = await system_mgr.execute_command(req.command)
    return res


# ----------------------------------------------------
# REST API: Clipboard & History
# ----------------------------------------------------
@app.get("/api/system/clipboard")
async def get_clipboard():
    return system_mgr.get_clipboard()


@app.get("/api/system/clipboard/history")
async def get_clipboard_history():
    return system_mgr.clipboard_history


class ClipboardSetRequest(BaseModel):
    text: str


@app.post("/api/system/clipboard")
async def set_clipboard(req: ClipboardSetRequest):
    return system_mgr.set_clipboard(req.text)


# ----------------------------------------------------
# REST API: Touch Deck Management & Actions
# ----------------------------------------------------
@app.get("/api/deck")
async def get_deck():
    return cfg_mgr.get_deck()


class DeckCardModel(BaseModel):
    id: Optional[str] = None
    title: str
    icon: str
    color: str = "#3b82f6"
    profile: Optional[str] = "all"
    type: str
    payload: Dict[str, Any]


@app.post("/api/deck/card")
async def save_deck_card(card: DeckCardModel):
    card_dict = card.dict()
    if card_dict.get("id"):
        updated = cfg_mgr.update_deck_card(card_dict["id"], card_dict)
        if updated:
            return {"status": "ok", "card": updated}
    added = cfg_mgr.add_deck_card(card_dict)
    return {"status": "ok", "card": added}


@app.delete("/api/deck/card/{card_id}")
async def delete_deck_card(card_id: str):
    success = cfg_mgr.delete_deck_card(card_id)
    if success:
        return {"status": "ok", "deleted_id": card_id}
    raise HTTPException(status_code=404, detail="Card not found")


@app.post("/api/deck/trigger/{card_id}")
async def trigger_deck_card(card_id: str):
    cards = cfg_mgr.get_deck().get("cards", [])
    target = next((c for c in cards if c["id"] == card_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Card not found")

    ctype = target.get("type")
    payload = target.get("payload", {})

    if ctype == "shortcut":
        keys = payload.get("keys", [])
        driver.hotkey(keys)
        return {"status": "ok", "action": "shortcut", "keys": keys}

    elif ctype == "command":
        cmd = payload.get("command", "")
        if cmd:
            res = await system_mgr.execute_command(cmd)
            return {"status": "ok", "action": "command", "result": res}

    elif ctype == "media":
        act = payload.get("action", "")
        system_mgr.media_control(act)
        return {"status": "ok", "action": "media", "media_action": act}

    elif ctype == "power":
        act = payload.get("action", "")
        res = system_mgr.power_action(act)
        return {"status": "ok", "action": "power", "result": res}

    elif ctype == "system":
        act = payload.get("action", "")
        if act == "toggle_mute":
            muted = system_mgr.toggle_mute()
            return {"status": "ok", "muted": muted}

    return {"status": "ok"}


# ----------------------------------------------------
# REST API: System Controls
# ----------------------------------------------------
class VolumeRequest(BaseModel):
    level: Optional[int] = None
    mute_toggle: Optional[bool] = False


@app.post("/api/system/volume")
async def set_system_volume(req: VolumeRequest):
    if req.mute_toggle:
        muted = system_mgr.toggle_mute()
        vol, _ = system_mgr.get_volume()
        return {"status": "ok", "volume": vol, "muted": muted}
    if req.level is not None:
        system_mgr.set_volume(req.level)
        vol, muted = system_mgr.get_volume()
        return {"status": "ok", "volume": vol, "muted": muted}
    return {"status": "error"}


class MediaRequest(BaseModel):
    action: str


@app.post("/api/system/media")
async def trigger_media(req: MediaRequest):
    system_mgr.media_control(req.action)
    return {"status": "ok"}


class PowerRequest(BaseModel):
    action: str


@app.post("/api/system/power")
async def trigger_power(req: PowerRequest):
    res = system_mgr.power_action(req.action)
    return res


class NotifyRequest(BaseModel):
    title: str = "LAN Remote"
    message: str


@app.post("/api/system/notify")
async def send_notification(req: NotifyRequest):
    return system_mgr.send_host_notification(req.title, req.message)


class ExecRequest(BaseModel):
    command: str


@app.post("/api/system/exec")
async def execute_cmd(req: ExecRequest):
    res = await system_mgr.execute_command(req.command)
    return res


# ----------------------------------------------------
# REST API: SVG Icons
# ----------------------------------------------------
@app.get("/api/icons")
async def list_icons():
    icons = []
    if os.path.exists(ICONS_DIR):
        for f in os.listdir(ICONS_DIR):
            if f.endswith(".svg"):
                name = os.path.splitext(f)[0]
                icons.append({"name": name, "url": f"/icons/{f}"})
    return sorted(icons, key=lambda x: x["name"])


@app.post("/api/icons/upload")
async def upload_icon(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".svg"):
        raise HTTPException(
            status_code=400, detail="Only SVG files are supported"
        )

    clean_name = os.path.splitext(file.filename)[0].lower().replace(" ", "_")
    target_path = os.path.join(ICONS_DIR, f"{clean_name}.svg")

    with open(target_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "status": "ok",
        "name": clean_name,
        "url": f"/icons/{clean_name}.svg",
    }


# ----------------------------------------------------
# Static files and PWA entry
# ----------------------------------------------------
app.mount("/icons", StaticFiles(directory=ICONS_DIR), name="icons")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/manifest.json")
async def manifest():
    return FileResponse(os.path.join(STATIC_DIR, "manifest.json"))


@app.get("/sw.js")
async def service_worker():
    return FileResponse(
        os.path.join(STATIC_DIR, "sw.js"), media_type="application/javascript"
    )


if __name__ == "__main__":
    port = cfg_mgr.config.get("server", {}).get("port", 8080)
    uvicorn.run("server:app", host="0.0.0.0", port=port, log_level="info")
