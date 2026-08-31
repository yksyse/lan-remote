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

app = FastAPI(title="LAN Remote Control", version="1.0.0")

# CORS middleware
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


# Startup event
@app.on_event("startup")
async def startup_event():
    # Apply initial stream settings from config
    st_cfg = cfg_mgr.config.get("stream", {})
    streamer.update_settings(
        fps=st_cfg.get("fps", 30),
        quality=st_cfg.get("quality", 65),
        scale=st_cfg.get("scale", 0.75),
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
                except Exception as e:
                    logger.error(f"Error handling stream control packet: {e}")
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass

    recv_task = asyncio.create_task(receive_controls())

    try:
        while True:
            # Send latest frame if new
            frame_bytes = streamer.latest_frame_bytes
            frame_time = streamer.latest_frame_time

            if frame_bytes and frame_time > last_sent_time:
                last_sent_time = frame_time
                await websocket.send_bytes(frame_bytes)

            # Sleep slightly to avoid pegging event loop
            fps = streamer.fps
            await asyncio.sleep(1.0 / (fps * 1.5))
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception as e:
        logger.error(f"Stream error: {e}")
    finally:
        recv_task.cancel()
        streamer.active_sockets.discard(websocket)


# ----------------------------------------------------
# WebSocket: Ultra-low latency Input Stream
# ----------------------------------------------------
@app.websocket("/ws/input")
async def websocket_input(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                event = json.loads(data)
                etype = event.get("type")

                if etype == "move_abs":
                    driver.move_absolute(
                        float(event["x"]), float(event["y"])
                    )
                elif etype == "move_rel":
                    driver.move_relative(
                        int(event.get("dx", 0)), int(event.get("dy", 0))
                    )
                elif etype == "down":
                    driver.mouse_down(event.get("button", "left"))
                elif etype == "up":
                    driver.mouse_up(event.get("button", "left"))
                elif etype == "click":
                    driver.mouse_click(event.get("button", "left"))
                elif etype == "dblclick":
                    driver.mouse_double_click(event.get("button", "left"))
                elif etype == "wheel":
                    driver.mouse_wheel(
                        int(event.get("dy", 0)), int(event.get("dx", 0))
                    )
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
        "real_fps": round(streamer.real_fps, 1),
        "target_fps": streamer.fps,
        "quality": streamer.quality,
        "scale": streamer.scale,
        "width": streamer.frame_width,
        "height": streamer.frame_height,
        "last_frame_kb": round(streamer.last_frame_size / 1024, 1),
        "capture_ms": round(streamer.capture_time_ms, 1),
        "encode_ms": round(streamer.encode_time_ms, 1),
        "active_viewers": len(streamer.active_sockets),
    }
    return metrics


@app.get("/api/monitors")
async def get_monitors():
    return streamer.get_monitors()


@app.get("/api/config")
async def get_config():
    return cfg_mgr.get_all()


class SectionUpdate(BaseModel):
    section: str
    values: Dict[str, Any]


@app.post("/api/config")
async def update_config(update: SectionUpdate):
    cfg_mgr.update_section(update.section, update.values)
    # If stream settings updated, propagate immediately
    if update.section == "stream":
        streamer.update_settings(
            fps=update.values.get("fps"),
            quality=update.values.get("quality"),
            scale=update.values.get("scale"),
            monitor_index=update.values.get("monitor_index"),
        )
    return {"status": "ok", "config": cfg_mgr.get_all()}


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
    type: str  # shortcut, command, system, media, power
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
