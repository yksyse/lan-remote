# LAN Remote

> Ultra-low latency web-based remote control, screen streamer, and customizable Touch Deck for local networks.

LAN Remote lets you control your secondary PC or server from any phone, tablet, or laptop in your local network via a web browser (PWA) with zero client installations.

---

## Why it's fast

Most remote desktop clients (like RustDesk or TeamViewer) add overhead through cloud signaling relays, multi-layer protocol framing, and complex client render pipelines.

LAN Remote bypasses all external relays:
1. **Direct Screen Grab:** Uses `MSS` / direct Windows frame buffers.
2. **Fast Encoder:** Hardware/OpenCV JPEG compression with adjustable quality and downscaling.
3. **Zero-Buffering WebSockets:** Frames stream directly over local WebSockets; slow clients drop stale frames instead of buffering.
4. **Hardware-Accelerated Canvas:** Browser decodes frames directly into GPU textures via `createImageBitmap` on an HTML5 `<canvas>`.
5. **Instant Input Injection:** Inputs trigger Windows `user32.SendInput` directly on the host with sub-millisecond dispatch time.

Typical local Wi-Fi / Ethernet round-trip latency: **10–25 ms**.

---

## Features

### 🖥️ 1. Real-Time Remote Screen
* **Adaptive Stream:** 15 / 30 / 60 FPS, downscaling (0.5x, 0.75x, 1.0x), and adjustable compression quality (30–95%).
* **Virtual Trackpad Mode:** 
  * 1-finger move: smooth relative cursor movement.
  * 1-finger tap: left-click.
  * 2-finger drag: vertical scroll wheel.
  * Long-press: right-click with haptic vibration feedback.
* **Direct Touch Mode:** Direct coordinate-to-screen mapping.
* **On-Screen Keyboard Overlay:** Quick access to `Win`, `Ctrl`, `Alt`, `Shift`, `Esc`, `Tab`, `F1–F12`, plus a dedicated text input box for mobile dictation.

### 🎛️ 2. Touch Deck (Macro & Action Grid)
* Turn your phone into an Elgato Stream Deck equivalent over LAN.
* Grid of customizable action cards:
  * **Shortcuts:** `Win+D`, `Ctrl+Shift+Esc`, `Alt+Tab`, `Ctrl+C`, `Ctrl+V`, etc.
  * **Commands:** Launch terminal, open apps (`notepad.exe`, `wt.exe`), run scripts.
  * **Media & System:** Volume up/down, mute toggle, play/pause.
  * **Power Actions:** Lock PC, Sleep, Turn screen off.
* Built-in library of 30+ SVG icons + support for uploading custom `.svg` files.
* Add, edit, recolor, and delete buttons directly from the web interface.

### 📊 3. Host System Dashboard
* Real-time metrics: CPU usage, RAM utilization, and disk partition stats.
* Master Volume slider with live sync and mute button.
* Media transport controls (Previous, Play/Pause, Next).
* Power management buttons (Lock, Screen Off, Sleep, Restart, Shutdown).
* Mini Command Runner (execute shell commands with live stdout/stderr capture).

### ⚙️ 4. Modular Settings with Live Search
* **Fuzzy Search:** Instant real-time filtering across all settings (FPS, sensitivity, ports, icons).
* Categorized sections for Stream, Input, Deck layout, and Network.
* Displays all active LAN IP addresses with a 1-click URL copy button.

---

## Quick Start

### Requirements
* Python 3.9+ (Windows host)
* Any modern browser on client devices (Safari iOS, Chrome Android, Firefox, Edge, etc.)

### Installation & Launch

```powershell
# 1. Clone repository
git clone https://github.com/your-username/lan-remote.git
cd lan-remote

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start server
python server.py
```

Or simply double-click `start.bat`.

The server will display its local addresses:
```text
============================================================
  LAN Remote Control Server Ready!
  Local URL:   http://localhost:8080
  Network URL: http://192.168.1.150:8080
============================================================
```

Open the `Network URL` on your phone or secondary device.

> **Tip (PWA on iOS / Android):** In Safari on iPhone, tap **Share → Add to Home Screen**. In Chrome on Android, tap the menu and select **Install App** or **Add to Home screen** for a full-screen app experience.

---

## Project Structure

```text
lan-remote/
├── core/
│   ├── config_manager.py    # Config persistence & deck macros
│   ├── input_driver.py      # user32.SendInput low-latency driver
│   ├── screen_streamer.py   # MSS + OpenCV JPEG streaming pipeline
│   ├── system_manager.py    # Metrics, audio volume, power actions
│   └── gen_icons.py         # SVG icons generator
├── static/
│   ├── css/
│   │   └── style.css        # Responsive dark UI & PWA styling
│   ├── js/
│   │   ├── app.js           # App controller & status polling
│   │   ├── deck.js          # Touch Deck action cards & modal editor
│   │   ├── settings.js      # Searchable modular settings & SVG manager
│   │   ├── stream.js        # Canvas WebSockets, trackpad & input handler
│   │   └── system.js        # Hardware gauges, volume & power controls
│   ├── icons/               # 30+ clean SVG icons
│   ├── index.html           # Single-page web client
│   ├── manifest.json        # PWA manifest
│   └── sw.js                # Service Worker
├── config.json              # Auto-generated user configuration
├── requirements.txt         # Python dependencies
├── start.bat                # Windows 1-click launcher
├── run.ps1                  # PowerShell launcher
├── LICENSE                  # MIT License
└── README.md
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
