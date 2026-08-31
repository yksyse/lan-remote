import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ConfigManager")

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

DEFAULT_CONFIG: Dict[str, Any] = {
    "server": {
        "port": 8080,
        "pin_code": "",
        "allow_remote_input": True
    },
    "stream": {
        "fps": 60,
        "quality": 60,
        "scale": 1.0,
        "max_resolution": "1080p",
        "monitor_index": 1
    },
    "input": {
        "mode": "trackpad",
        "cursor_mode": "physical",
        "sensitivity": 1.3,
        "invert_scroll": False,
        "long_press_ms": 450,
        "haptic_feedback": True
    },
    "deck": {
        "grid_columns": 4,
        "cards": [
            {
                "id": "card_vol_down",
                "title": "Vol Down",
                "icon": "volume_down",
                "color": "#3b82f6",
                "profile": "media",
                "type": "media",
                "payload": {"action": "vol_down"}
            },
            {
                "id": "card_vol_up",
                "title": "Vol Up",
                "icon": "volume_up",
                "color": "#3b82f6",
                "profile": "media",
                "type": "media",
                "payload": {"action": "vol_up"}
            },
            {
                "id": "card_play_pause",
                "title": "Play / Pause",
                "icon": "play",
                "color": "#10b981",
                "profile": "media",
                "type": "media",
                "payload": {"action": "play_pause"}
            },
            {
                "id": "card_prev_track",
                "title": "Prev Track",
                "icon": "chevron_left",
                "color": "#3b82f6",
                "profile": "media",
                "type": "media",
                "payload": {"action": "prev"}
            },
            {
                "id": "card_next_track",
                "title": "Next Track",
                "icon": "chevron_right",
                "color": "#3b82f6",
                "profile": "media",
                "type": "media",
                "payload": {"action": "next"}
            },
            {
                "id": "card_task_mgr",
                "title": "Task Manager",
                "icon": "activity",
                "color": "#8b5cf6",
                "profile": "server",
                "type": "shortcut",
                "payload": {"keys": ["ctrl", "shift", "esc"]}
            },
            {
                "id": "card_lock_pc",
                "title": "Lock PC",
                "icon": "lock",
                "color": "#f59e0b",
                "profile": "server",
                "type": "power",
                "payload": {"action": "lock"}
            },
            {
                "id": "card_discord_mute",
                "title": "Mute Mic",
                "icon": "mic_off",
                "color": "#ef4444",
                "profile": "gaming",
                "type": "shortcut",
                "payload": {"keys": ["ctrl", "shift", "m"]}
            },
            {
                "id": "card_shadowplay",
                "title": "Save Clip",
                "icon": "video",
                "color": "#10b981",
                "profile": "gaming",
                "type": "shortcut",
                "payload": {"keys": ["alt", "f10"]}
            }
        ]
    }
}

class ConfigManager:
    def __init__(self, path: str = CONFIG_PATH):
        self.path = path
        self.config: Dict[str, Any] = {}
        self.load()

    def load(self):
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.config = {**DEFAULT_CONFIG, **data}
                    for k, v in DEFAULT_CONFIG.items():
                        if k not in self.config:
                            self.config[k] = v
                return
            except Exception as e:
                logger.error(f"Error reading {self.path}, recreating: {e}")
        
        self.config = DEFAULT_CONFIG.copy()
        self.save()

    def save(self):
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving config: {e}")

    def get_all(self) -> Dict[str, Any]:
        return self.config

    def update_section(self, section: str, values: Dict[str, Any]):
        if section in self.config:
            self.config[section].update(values)
        else:
            self.config[section] = values
        self.save()

    def get_deck(self) -> Dict[str, Any]:
        return self.config.get("deck", DEFAULT_CONFIG["deck"])

    def add_deck_card(self, card: Dict[str, Any]) -> Dict[str, Any]:
        cards = self.config.setdefault("deck", {}).setdefault("cards", [])
        if "id" not in card or not card["id"]:
            card["id"] = f"card_{int(os.times().elapsed * 1000)}"
        cards.append(card)
        self.save()
        return card

    def update_deck_card(self, card_id: str, new_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        cards = self.config.setdefault("deck", {}).setdefault("cards", [])
        for idx, c in enumerate(cards):
            if c["id"] == card_id:
                cards[idx] = {**c, **new_data, "id": card_id}
                self.save()
                return cards[idx]
        return None

    def delete_deck_card(self, card_id: str) -> bool:
        cards = self.config.setdefault("deck", {}).setdefault("cards", [])
        initial_len = len(cards)
        self.config["deck"]["cards"] = [c for c in cards if c["id"] != card_id]
        if len(self.config["deck"]["cards"]) != initial_len:
            self.save()
            return True
        return False

cfg_mgr = ConfigManager()
