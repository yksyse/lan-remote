import json
import logging
import os
import shutil
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ConfigManager")

DEFAULT_DECK_CARDS = [
    {
        "id": "play_pause",
        "title": "Play / Pause",
        "icon": "play",
        "color": "#10b981",
        "type": "media",
        "payload": {"action": "play_pause"},
    },
    {
        "id": "vol_up",
        "title": "Volume Up",
        "icon": "volume_up",
        "color": "#3b82f6",
        "type": "media",
        "payload": {"action": "vol_up"},
    },
    {
        "id": "vol_down",
        "title": "Volume Down",
        "icon": "volume_down",
        "color": "#3b82f6",
        "type": "media",
        "payload": {"action": "vol_down"},
    },
    {
        "id": "mute",
        "title": "Mute Sound",
        "icon": "volume_mute",
        "color": "#6b7280",
        "type": "system",
        "payload": {"action": "toggle_mute"},
    },
    {
        "id": "show_desktop",
        "title": "Desktop",
        "icon": "desktop",
        "color": "#8b5cf6",
        "type": "shortcut",
        "payload": {"keys": ["win", "d"]},
    },
    {
        "id": "task_mgr",
        "title": "Task Manager",
        "icon": "activity",
        "color": "#f59e0b",
        "type": "shortcut",
        "payload": {"keys": ["ctrl", "shift", "esc"]},
    },
    {
        "id": "file_explorer",
        "title": "Explorer",
        "icon": "folder",
        "color": "#3b82f6",
        "type": "shortcut",
        "payload": {"keys": ["win", "e"]},
    },
    {
        "id": "terminal",
        "title": "Terminal",
        "icon": "terminal",
        "color": "#111827",
        "type": "command",
        "payload": {"command": "wt.exe || powershell.exe"},
    },
    {
        "id": "screen_off",
        "title": "Screen Off",
        "icon": "monitor_off",
        "color": "#4b5563",
        "type": "power",
        "payload": {"action": "screen_off"},
    },
    {
        "id": "lock_pc",
        "title": "Lock PC",
        "icon": "lock",
        "color": "#f97316",
        "type": "power",
        "payload": {"action": "lock"},
    },
    {
        "id": "sleep_pc",
        "title": "Sleep",
        "icon": "moon",
        "color": "#6366f1",
        "type": "power",
        "payload": {"action": "sleep"},
    },
    {
        "id": "copy",
        "title": "Copy",
        "icon": "copy",
        "color": "#14b8a6",
        "type": "shortcut",
        "payload": {"keys": ["ctrl", "c"]},
    },
    {
        "id": "paste",
        "title": "Paste",
        "icon": "clipboard",
        "color": "#06b6d4",
        "type": "shortcut",
        "payload": {"keys": ["ctrl", "v"]},
    },
    {
        "id": "alt_tab",
        "title": "Alt + Tab",
        "icon": "layers",
        "color": "#8b5cf6",
        "type": "shortcut",
        "payload": {"keys": ["alt", "tab"]},
    },
]

DEFAULT_CONFIG = {
    "server": {
        "port": 8080,
        "pin_code": "",
        "allowed_subnets": ["*"],
    },
    "stream": {
        "fps": 30,
        "quality": 65,
        "scale": 0.75,
        "monitor_index": 1,
    },
    "input": {
        "mode": "trackpad",  # "trackpad" or "direct"
        "sensitivity": 1.3,
        "scroll_speed": 1.0,
        "invert_scroll": False,
        "long_press_ms": 450,
        "haptic_feedback": True,
    },
    "deck": {
        "grid_columns": 4,
        "cards": DEFAULT_DECK_CARDS,
    },
}


class ConfigManager:

    def __init__(self, config_path: str = "config.json"):
        self.config_path = os.path.abspath(config_path)
        self.config: Dict[str, Any] = {}
        self.load()

    def load(self):
        """Load configuration from JSON file or create default."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    self.config = json.load(f)
                # Merge missing default keys
                self._merge_defaults(self.config, DEFAULT_CONFIG)
                logger.info(f"Loaded config from {self.config_path}")
                return
            except Exception as e:
                logger.error(f"Error loading config: {e}. Falling back to default.")

        self.config = json.loads(json.dumps(DEFAULT_CONFIG))
        self.save()

    def _merge_defaults(self, target: dict, default: dict):
        for k, v in default.items():
            if k not in target:
                target[k] = v
            elif isinstance(v, dict) and isinstance(target[k], dict):
                self._merge_defaults(target[k], v)

    def save(self):
        """Save current config to file."""
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            logger.info("Saved configuration successfully.")
        except Exception as e:
            logger.error(f"Error saving config: {e}")

    def get_all(self) -> Dict[str, Any]:
        return self.config

    def update_section(self, section: str, values: Dict[str, Any]):
        if section in self.config and isinstance(self.config[section], dict):
            self.config[section].update(values)
            self.save()

    # Deck management
    def get_deck(self) -> Dict[str, Any]:
        return self.config.get("deck", DEFAULT_CONFIG["deck"])

    def add_deck_card(self, card: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in card or not card["id"]:
            card["id"] = str(uuid.uuid4())[:8]
        if "deck" not in self.config:
            self.config["deck"] = {"grid_columns": 4, "cards": []}
        self.config["deck"]["cards"].append(card)
        self.save()
        return card

    def update_deck_card(
        self, card_id: str, new_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        cards = self.config.get("deck", {}).get("cards", [])
        for card in cards:
            if card["id"] == card_id:
                card.update(new_data)
                self.save()
                return card
        return None

    def delete_deck_card(self, card_id: str) -> bool:
        cards = self.config.get("deck", {}).get("cards", [])
        initial_len = len(cards)
        self.config["deck"]["cards"] = [c for c in cards if c["id"] != card_id]
        if len(self.config["deck"]["cards"]) != initial_len:
            self.save()
            return True
        return False


# Global config manager instance
cfg_mgr = ConfigManager(
    os.path.join(os.path.dirname(__file__), "..", "config.json")
)
