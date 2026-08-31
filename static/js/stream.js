// Ultra-Low Latency Canvas Streamer & Enhanced Touch/Gesture Engine
const StreamManager = {
  ws: null,
  inputWs: null,
  canvas: null,
  ctx: null,

  // Stream state
  isConnected: false,
  rttMs: 0,
  lastPingTime: 0,
  pingInterval: null,

  // Input configuration
  inputMode: 'trackpad', // 'trackpad' or 'direct'
  sensitivity: 1.3,
  invertScroll: false,
  hapticFeedback: true,

  // Touch & Gesture tracking
  lastTouchX: 0,
  lastTouchY: 0,
  touchStartTime: 0,
  isDragging: false,
  longPressTimeout: null,
  hintTimeout: null,
  twoFingerStartY: 0,
  lastTapTime: 0,
  isTapAndHold: false,

  init() {
    this.canvas = document.getElementById('streamCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.connectStreamWS();
    this.connectInputWS();
    this.setupEvents();
    this.setupKeyboardDrawer();
  },

  onTabVisible() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectStreamWS();
    }
    if (!this.inputWs || this.inputWs.readyState !== WebSocket.OPEN) {
      this.connectInputWS();
    }
  },

  connectStreamWS() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/stream`;

    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
    }

    this.ws = new WebSocket(url);
    this.ws.binaryType = 'blob';

    this.ws.onopen = () => {
      this.isConnected = true;
      this.startPing();
    };

    this.ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') {
            this.rttMs = Math.round(performance.now() - msg.client_ts);
            this.updateStatsUI();
          }
        } catch (e) {}
        return;
      }

      // Binary Blob -> ImageBitmap for direct GPU texture upload
      try {
        const bmp = await createImageBitmap(event.data);
        if (this.canvas.width !== bmp.width || this.canvas.height !== bmp.height) {
          this.canvas.width = bmp.width;
          this.canvas.height = bmp.height;
        }
        this.ctx.drawImage(bmp, 0, 0);
        bmp.close();
      } catch (err) {}
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      clearInterval(this.pingInterval);
      setTimeout(() => {
        if (App.activeTab === 'stream') this.connectStreamWS();
      }, 2000);
    };
  },

  connectInputWS() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/input`;

    if (this.inputWs) {
      try { this.inputWs.close(); } catch(e) {}
    }

    this.inputWs = new WebSocket(url);

    this.inputWs.onclose = () => {
      setTimeout(() => {
        if (App.activeTab === 'stream') this.connectInputWS();
      }, 2000);
    };
  },

  sendInput(data) {
    if (this.inputWs && this.inputWs.readyState === WebSocket.OPEN) {
      this.inputWs.send(JSON.stringify(data));
    }
  },

  vibrate(ms = 15) {
    if (this.hapticFeedback && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  },

  startPing() {
    clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: performance.now() }));
      }
    }, 1500);
  },

  updateStatsUI() {
    const statEl = document.getElementById('streamPingStat');
    if (statEl) {
      statEl.textContent = `${this.rttMs}ms`;
    }
  },

  showTrackpadHint() {
    const hint = document.getElementById('trackpadHint');
    if (!hint) return;

    hint.classList.add('show');
    clearTimeout(this.hintTimeout);
    this.hintTimeout = setTimeout(() => {
      hint.classList.remove('show');
    }, 2500);
  },

  hideTrackpadHint() {
    const hint = document.getElementById('trackpadHint');
    if (hint) hint.classList.remove('show');
  },

  setupEvents() {
    const canvas = this.canvas;
    const trackpadOverlay = document.getElementById('trackpadOverlay');

    // 1. Mouse Events on Canvas (Desktop client)
    canvas.addEventListener('mousemove', (e) => {
      if (this.inputMode === 'direct') {
        const rect = canvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        this.sendInput({ type: 'move_abs', x: normX, y: normY });
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const btn = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
      this.sendInput({ type: 'down', button: btn });
    });

    canvas.addEventListener('mouseup', (e) => {
      e.preventDefault();
      const btn = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
      this.sendInput({ type: 'up', button: btn });
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dy = e.deltaY < 0 ? 120 : -120;
      this.sendInput({ type: 'wheel', dy: dy, dx: 0 });
    }, { passive: false });

    // 2. Touch Gestures (Mobile / Tablet)
    const targetElement = trackpadOverlay || canvas;

    targetElement.addEventListener('touchstart', (e) => {
      this.hideTrackpadHint();
      const touches = e.touches;
      const now = Date.now();

      if (touches.length === 1) {
        const touch = touches[0];
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
        this.touchStartTime = now;
        this.isDragging = false;

        // Double-tap & hold detection for click-and-drag
        if (now - this.lastTapTime < 280) {
          this.isTapAndHold = true;
          this.vibrate(20);
          this.sendInput({ type: 'down', button: 'left' });
        } else {
          this.isTapAndHold = false;
        }
        this.lastTapTime = now;

        // Long press -> Right click
        clearTimeout(this.longPressTimeout);
        this.longPressTimeout = setTimeout(() => {
          if (!this.isDragging && !this.isTapAndHold) {
            this.vibrate(30);
            this.sendInput({ type: 'click', button: 'right' });
            App.showToast(I18n.t('right_click_toast'), 'info');
          }
        }, 450);

      } else if (touches.length === 2) {
        clearTimeout(this.longPressTimeout);
        this.twoFingerStartY = (touches[0].clientY + touches[1].clientY) / 2;
      }
    }, { passive: true });

    targetElement.addEventListener('touchmove', (e) => {
      const touches = e.touches;

      if (touches.length === 1) {
        const touch = touches[0];
        const dx = (touch.clientX - this.lastTouchX) * this.sensitivity;
        const dy = (touch.clientY - this.lastTouchY) * this.sensitivity;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          this.isDragging = true;
          clearTimeout(this.longPressTimeout);
        }

        if (this.inputMode === 'trackpad') {
          this.sendInput({ type: 'move_rel', dx: Math.round(dx), dy: Math.round(dy) });
        } else {
          const rect = canvas.getBoundingClientRect();
          const normX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
          const normY = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
          this.sendInput({ type: 'move_abs', x: normX, y: normY });
        }

        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;

      } else if (touches.length === 2) {
        // Two-finger scroll
        const currentY = (touches[0].clientY + touches[1].clientY) / 2;
        const delta = currentY - this.twoFingerStartY;

        if (Math.abs(delta) > 10) {
          const mult = this.invertScroll ? -1 : 1;
          const scrollDy = delta > 0 ? (120 * mult) : (-120 * mult);
          this.sendInput({ type: 'wheel', dy: scrollDy, dx: 0 });
          this.twoFingerStartY = currentY;
        }
      }
    }, { passive: true });

    targetElement.addEventListener('touchend', (e) => {
      clearTimeout(this.longPressTimeout);
      const elapsed = Date.now() - this.touchStartTime;

      if (this.isTapAndHold) {
        this.isTapAndHold = false;
        this.sendInput({ type: 'up', button: 'left' });
      } else if (!this.isDragging && elapsed < 300) {
        // Short tap -> Left click
        this.vibrate(15);
        this.sendInput({ type: 'click', button: 'left' });
      }
    });

    // 3. Floating Toolbar Buttons
    const modeBtn = document.getElementById('toggleInputModeBtn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        this.inputMode = this.inputMode === 'trackpad' ? 'direct' : 'trackpad';
        modeBtn.classList.toggle('active', this.inputMode === 'trackpad');
        const overlay = document.getElementById('trackpadOverlay');
        if (overlay) overlay.classList.toggle('active', this.inputMode === 'trackpad');
        
        if (this.inputMode === 'trackpad') {
          this.showTrackpadHint();
        } else {
          this.hideTrackpadHint();
        }

        const modeName = this.inputMode === 'trackpad' ? I18n.t('mode_trackpad') : I18n.t('mode_direct');
        App.showToast(`${I18n.t('input_mode_toast')}${modeName}`, 'info');
      });
    }

    const fsBtn = document.getElementById('toggleFullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        const el = document.querySelector('.stream-container');
        if (!document.fullscreenElement) {
          el.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  },

  setupKeyboardDrawer() {
    const kbdToggleBtn = document.getElementById('toggleKeyboardBtn');
    const drawer = document.getElementById('keyboardDrawer');
    if (!kbdToggleBtn || !drawer) return;

    kbdToggleBtn.addEventListener('click', () => {
      drawer.classList.toggle('active');
      kbdToggleBtn.classList.toggle('active');
    });

    // Keys inside drawer
    drawer.querySelectorAll('.kbd-key').forEach(keyBtn => {
      keyBtn.addEventListener('click', () => {
        const key = keyBtn.dataset.key;
        this.vibrate(15);
        this.sendInput({ type: 'key_press', key: key });
      });
    });

    // Text Input for mobile keyboard string entry
    const textInput = document.getElementById('kbdTextInput');
    const sendTextBtn = document.getElementById('kbdSendTextBtn');

    if (textInput && sendTextBtn) {
      const sendText = () => {
        const val = textInput.value;
        if (val) {
          this.sendInput({ type: 'type_text', text: val });
          textInput.value = '';
          App.showToast(I18n.t('text_sent_toast'), 'success');
        }
      };

      sendTextBtn.addEventListener('click', sendText);
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          sendText();
        }
      });
    }
  }
};

window.StreamManager = StreamManager;
document.addEventListener('DOMContentLoaded', () => {
  StreamManager.init();
});
