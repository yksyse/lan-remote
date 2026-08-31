import ctypes
import ctypes.wintypes
import time
from typing import List, Union

# Ctypes structures for SendInput
PUL = ctypes.POINTER(ctypes.c_ulong)


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", ctypes.c_long),
        ("dy", ctypes.c_long),
        ("mouseData", ctypes.c_ulong),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", PUL),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", ctypes.c_ushort),
        ("wScan", ctypes.c_ushort),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", PUL),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", ctypes.c_ulong),
        ("wParamL", ctypes.c_short),
        ("wParamH", ctypes.c_ushort),
    ]


class _INPUTunion(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT), ("hi", HARDWAREINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong), ("union", _INPUTunion)]


# Input types
INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
INPUT_HARDWARE = 2

# Mouse flags
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_HWHEEL = 0x1000
MOUSEEVENTF_ABSOLUTE = 0x8000
MOUSEEVENTF_VIRTUALDESK = 0x4000

# Keyboard flags
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
KEYEVENTF_SCANCODE = 0x0008

# Virtual Key Codes Map
VK_CODES = {
    # Modifiers
    "ctrl": 0x11,
    "control": 0x11,
    "lctrl": 0xA2,
    "rctrl": 0xA3,
    "shift": 0x10,
    "lshift": 0xA0,
    "rshift": 0xA1,
    "alt": 0x12,
    "lalt": 0xA4,
    "ralt": 0xA5,
    "win": 0x5B,
    "lwin": 0x5B,
    "rwin": 0x5C,
    "super": 0x5B,
    # Navigation & control
    "backspace": 0x08,
    "tab": 0x09,
    "enter": 0x0D,
    "return": 0x0D,
    "pause": 0x13,
    "capslock": 0x14,
    "esc": 0x1B,
    "escape": 0x1B,
    "space": 0x20,
    "pageup": 0x21,
    "pagedown": 0x22,
    "end": 0x23,
    "home": 0x24,
    "left": 0x25,
    "up": 0x26,
    "right": 0x27,
    "down": 0x28,
    "insert": 0x2D,
    "delete": 0x2E,
    # Function keys
    "f1": 0x70,
    "f2": 0x71,
    "f3": 0x72,
    "f4": 0x73,
    "f5": 0x74,
    "f6": 0x75,
    "f7": 0x76,
    "f8": 0x77,
    "f9": 0x78,
    "f10": 0x79,
    "f11": 0x7A,
    "f12": 0x7B,
    # Volume & Media
    "volumemute": 0xAD,
    "volumedown": 0xAE,
    "volumeup": 0xAF,
    "medianext": 0xB0,
    "mediaprev": 0xB1,
    "mediastop": 0xB2,
    "mediaplaypause": 0xB3,
    # Common characters
    "a": 0x41,
    "b": 0x42,
    "c": 0x43,
    "d": 0x44,
    "e": 0x45,
    "f": 0x46,
    "g": 0x47,
    "h": 0x48,
    "i": 0x49,
    "j": 0x4A,
    "k": 0x4B,
    "l": 0x4C,
    "m": 0x4D,
    "n": 0x4E,
    "o": 0x4F,
    "p": 0x50,
    "q": 0x51,
    "r": 0x52,
    "s": 0x53,
    "t": 0x54,
    "u": 0x55,
    "v": 0x56,
    "w": 0x57,
    "x": 0x58,
    "y": 0x59,
    "z": 0x5A,
    "0": 0x30,
    "1": 0x31,
    "2": 0x32,
    "3": 0x33,
    "4": 0x34,
    "5": 0x35,
    "6": 0x36,
    "7": 0x37,
    "8": 0x38,
    "9": 0x39,
}

user32 = ctypes.windll.user32


class WindowsInputDriver:
    """Ultra-low latency Windows SendInput driver."""

    def __init__(self):
        self.screen_width = user32.GetSystemMetrics(0)
        self.screen_height = user32.GetSystemMetrics(1)

    def refresh_screen_metrics(self):
        self.screen_width = user32.GetSystemMetrics(0)
        self.screen_height = user32.GetSystemMetrics(1)

    def _send_input(self, inp: INPUT):
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(inp))

    def move_absolute(self, norm_x: float, norm_y: float):
        """Move cursor to normalized coordinates [0.0, 1.0]."""
        abs_x = int(norm_x * 65535)
        abs_y = int(norm_y * 65535)

        extra = ctypes.c_ulong(0)
        ii_ = _INPUTunion()
        ii_.mi = MOUSEINPUT(
            abs_x,
            abs_y,
            0,
            MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
            0,
            ctypes.pointer(extra),
        )
        inp = INPUT(ctypes.c_ulong(INPUT_MOUSE), ii_)
        self._send_input(inp)

    def move_relative(self, dx: int, dy: int):
        """Move cursor relatively by pixel delta."""
        extra = ctypes.c_ulong(0)
        ii_ = _INPUTunion()
        ii_.mi = MOUSEINPUT(
            int(dx), int(dy), 0, MOUSEEVENTF_MOVE, 0, ctypes.pointer(extra)
        )
        inp = INPUT(ctypes.c_ulong(INPUT_MOUSE), ii_)
        self._send_input(inp)

    def mouse_down(self, button: str = "left"):
        flag = MOUSEEVENTF_LEFTDOWN
        if button == "right":
            flag = MOUSEEVENTF_RIGHTDOWN
        elif button == "middle":
            flag = MOUSEEVENTF_MIDDLEDOWN

        extra = ctypes.c_ulong(0)
        ii_ = _INPUTunion()
        ii_.mi = MOUSEINPUT(0, 0, 0, flag, 0, ctypes.pointer(extra))
        inp = INPUT(ctypes.c_ulong(INPUT_MOUSE), ii_)
        self._send_input(inp)

    def mouse_up(self, button: str = "left"):
        flag = MOUSEEVENTF_LEFTUP
        if button == "right":
            flag = MOUSEEVENTF_RIGHTUP
        elif button == "middle":
            flag = MOUSEEVENTF_MIDDLEUP

        extra = ctypes.c_ulong(0)
        ii_ = _INPUTunion()
        ii_.mi = MOUSEINPUT(0, 0, 0, flag, 0, ctypes.pointer(extra))
        inp = INPUT(ctypes.c_ulong(INPUT_MOUSE), ii_)
        self._send_input(inp)

    def mouse_click(self, button: str = "left"):
        self.mouse_down(button)
        self.mouse_up(button)

    def mouse_double_click(self, button: str = "left"):
        self.mouse_click(button)
        time.sleep(0.05)
        self.mouse_click(button)

    def mouse_wheel(self, delta_y: int, delta_x: int = 0):
        extra = ctypes.c_ulong(0)
        if delta_y != 0:
            ii_ = _INPUTunion()
            ii_.mi = MOUSEINPUT(
                0, 0, int(delta_y), MOUSEEVENTF_WHEEL, 0, ctypes.pointer(extra)
            )
            inp = INPUT(ctypes.c_ulong(INPUT_MOUSE), ii_)
            self._send_input(inp)

        if delta_x != 0:
            ii_ = _INPUTunion()
            ii_.mi = MOUSEINPUT(
                0,
                0,
                int(delta_x),
                MOUSEEVENTF_HWHEEL,
                0,
                ctypes.pointer(extra),
            )
            inp = INPUT(ctypes.c_ulong(INPUT_MOUSE), ii_)
            self._send_input(inp)

    def _get_vk(self, key: str) -> int:
        clean = key.lower().strip()
        if clean in VK_CODES:
            return VK_CODES[clean]
        if len(clean) == 1:
            return ord(clean.upper())
        return 0

    def key_down(self, key: str):
        vk = self._get_vk(key)
        if vk == 0:
            return
        extra = ctypes.c_ulong(0)
        ii_ = _INPUTunion()
        ii_.ki = KEYBDINPUT(vk, 0, 0, 0, ctypes.pointer(extra))
        inp = INPUT(ctypes.c_ulong(INPUT_KEYBOARD), ii_)
        self._send_input(inp)

    def key_up(self, key: str):
        vk = self._get_vk(key)
        if vk == 0:
            return
        extra = ctypes.c_ulong(0)
        ii_ = _INPUTunion()
        ii_.ki = KEYBDINPUT(vk, 0, KEYEVENTF_KEYUP, 0, ctypes.pointer(extra))
        inp = INPUT(ctypes.c_ulong(INPUT_KEYBOARD), ii_)
        self._send_input(inp)

    def key_press(self, key: str):
        self.key_down(key)
        time.sleep(0.01)
        self.key_up(key)

    def hotkey(self, keys: List[str]):
        vks = [self._get_vk(k) for k in keys if self._get_vk(k) != 0]
        extra = ctypes.c_ulong(0)

        for vk in vks:
            ii_ = _INPUTunion()
            ii_.ki = KEYBDINPUT(vk, 0, 0, 0, ctypes.pointer(extra))
            inp = INPUT(ctypes.c_ulong(INPUT_KEYBOARD), ii_)
            self._send_input(inp)

        time.sleep(0.02)

        for vk in reversed(vks):
            ii_ = _INPUTunion()
            ii_.ki = KEYBDINPUT(
                vk, 0, KEYEVENTF_KEYUP, 0, ctypes.pointer(extra)
            )
            inp = INPUT(ctypes.c_ulong(INPUT_KEYBOARD), ii_)
            self._send_input(inp)

    def type_text(self, text: str):
        extra = ctypes.c_ulong(0)
        for char in text:
            code = ord(char)
            ii_down = _INPUTunion()
            ii_down.ki = KEYBDINPUT(
                0, code, KEYEVENTF_UNICODE, 0, ctypes.pointer(extra)
            )
            inp_down = INPUT(ctypes.c_ulong(INPUT_KEYBOARD), ii_down)
            self._send_input(inp_down)

            ii_up = _INPUTunion()
            ii_up.ki = KEYBDINPUT(
                0,
                code,
                KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                0,
                ctypes.pointer(extra),
            )
            inp_up = INPUT(ctypes.c_ulong(INPUT_KEYBOARD), ii_up)
            self._send_input(inp_up)


# Global driver instance
driver = WindowsInputDriver()
