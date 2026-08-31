// Ultra-Low Latency Canvas Streamer, High-Precision Pointer & Mobile Touch Control
const StreamManager = {
  ws: null,
  inputWs: null,
  canvas: null,
  ctx: null,

  // Stream state
  isConnected: false,
  isPaused: false,
  isGamepadActive: false,
  rttMs: 0,
  lastPingTime: 0,
  pingInterval: null,
  currentMonitor: 1,
  availableMonitors: [],

  // Input & Cursor configuration
  inputMode: 'trackpad', // 'trackpad' or 'direct'
  cursorMode: 'physical', // 'physical' or 'virtual'
  orientationMode: 'normal', // 'normal' or 'rotated_90'
  sensitivity: 1.3,
  invertScroll: false,
  hapticFeedback: true,
  isDragLockActive: false,

  // Virtual cursor state on canvas
  virtualX: 0.5,
  virtualY: 0.5,
  clickRipple: null,

  // Touch & Gesture tracking
  lastTouchX: 0,
  lastTouchY: 0,
  touchStartTime: 0,
  isDragging: false,
  longPressTimeout: null,
  hintTimeout: null,
  twoFingerStartY: 0,
  lastTapTime: 0,

  init() {
    this.canvas = document.getElementById('streamCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.cursorMode = localStorage.getItem('lan_remote_cursor_mode') || 'physical';

    this.connectStreamWS();
    this.connectInputWS();
    this.setupEvents();
    this.setupMobileMouseBar();
    this.setupKeyboardDrawer();
    this.setupGamepadOverlay();
    this.setupMonitorBar();
    this.setupOrientationControls();
    this.setupShortcutsBar();
    this.setupStandbyControls();
    this.updateCursorModeUI();
  },

  onTabVisible() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectStreamWS();
    }
    if (!this.inputWs || this.inputWs.readyState !== WebSocket.OPEN) {
      this.connectInputWS();
    }
    this.fetchMonitors();
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

      // Binary Blob -> ImageBitmap with Image fallback for universal device support
      try {
        const blob = event.data instanceof Blob ? event.data : new Blob([event.data], { type: 'image/jpeg' });
        if (window.createImageBitmap) {
          const bmp = await createImageBitmap(blob);
          if (this.canvas.width !== bmp.width || this.canvas.height !== bmp.height) {
            this.canvas.width = bmp.width;
            this.canvas.height = bmp.height;
          }
          this.ctx.drawImage(bmp, 0, 0);
          if (this.cursorMode === 'virtual') {
            this.drawVirtualCursor();
          }
          bmp.close();
        } else {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            if (this.canvas.width !== img.width || this.canvas.height !== img.height) {
              this.canvas.width = img.width;
              this.canvas.height = img.height;
            }
            this.ctx.drawImage(img, 0, 0);
            if (this.cursorMode === 'virtual') {
              this.drawVirtualCursor();
            }
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
      } catch (err) {}
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      clearInterval(this.pingInterval);
      setTimeout(() => {
        if (document.visibilityState === 'visible') this.connectStreamWS();
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
        if (document.visibilityState === 'visible') this.connectInputWS();
      }, 2000);
    };
  },

  startPing() {
    clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = performance.now();
        this.ws.send(JSON.stringify({ type: 'ping', ts: this.lastPingTime }));
      }
    }, 2000);
  },

  updateStatsUI() {
    const pingEl = document.getElementById('streamPingStat');
    if (pingEl) {
      pingEl.textContent = `${this.rttMs} ms`;
      pingEl.style.color = this.rttMs < 30 ? 'var(--accent-green)' : (this.rttMs < 75 ? 'var(--accent-yellow)' : 'var(--accent-red)');
    }
  },

  // ----------------------------------------------------
  // Virtual Gamepad Controller (D-Pad, A/B/X/Y, Triggers)
  // ----------------------------------------------------
  setupGamepadOverlay() {
    const toggleBtn = document.getElementById('toggleGamepadBtn');
    const overlay = document.getElementById('gamepadOverlay');
    if (!toggleBtn || !overlay) return;

    toggleBtn.addEventListener('click', () => {
      this.isGamepadActive = !this.isGamepadActive;
      overlay.classList.toggle('active', this.isGamepadActive);
      toggleBtn.classList.toggle('gamepad-active', this.isGamepadActive);
      if (window.SoundEffects) window.SoundEffects.playClick();
      App.showToast(this.isGamepadActive ? '🎮 Gamepad Mode Active' : 'Gamepad Disabled', 'info');
    });

    const bindKeyButton = (el, key) => {
      if (!el || !key) return;

      const handleDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('pressed');
        this.vibrate(20);
        this.sendInput({ type: 'key_down', key: key });
      };

      const handleUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('pressed');
        this.sendInput({ type: 'key_up', key: key });
      };

      el.addEventListener('touchstart', handleDown, { passive: false });
      el.addEventListener('touchend', handleUp, { passive: false });
      el.addEventListener('touchcancel', handleUp, { passive: false });
      el.addEventListener('mousedown', handleDown);
      el.addEventListener('mouseup', handleUp);
      el.addEventListener('mouseleave', handleUp);
    };

    overlay.querySelectorAll('[data-gkey]').forEach(btn => {
      bindKeyButton(btn, btn.dataset.gkey);
    });
  },

  // ----------------------------------------------------
  // Stream Pause / Resume (Zero Resource Standby Mode)
  // ----------------------------------------------------
  async toggleStreamPause() {
    if (window.SoundEffects) window.SoundEffects.playClick();
    try {
      const res = await fetch('/api/stream/toggle', { method: 'POST' });
      const data = await res.json();
      this.isPaused = !!data.is_paused;
      this.updateStandbyUI();
    } catch (e) {}
  },

  setupStandbyControls() {
    const toggleBtn = document.getElementById('toggleStreamPauseBtn');
    const standbyOverlay = document.getElementById('streamStandbyOverlay');
    const resumeBtn = document.getElementById('standbyResumeBtn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleStreamPause());
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.toggleStreamPause());
    }
  },

  updateStandbyUI() {
    const overlay = document.getElementById('streamStandbyOverlay');
    const toggleBtn = document.getElementById('toggleStreamPauseBtn');
    if (overlay) overlay.classList.toggle('active', this.isPaused);
    if (toggleBtn) {
      toggleBtn.classList.toggle('paused-active', this.isPaused);
      toggleBtn.title = this.isPaused ? 'Resume Stream' : 'Pause Stream (0% CPU/GPU)';
    }
    App.showToast(this.isPaused ? 'Stream Paused (CPU/GPU 0%)' : 'Stream Resumed', 'info');
  },

  // ----------------------------------------------------
  // Quick Windows Shortcuts Bar
  // ----------------------------------------------------
  setupShortcutsBar() {
    document.querySelectorAll('.shortcut-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const combo = btn.dataset.combo;
        if (!combo) return;
        if (window.SoundEffects) window.SoundEffects.playClick();
        this.vibrate(20);

        const keys = combo.split('+').map(k => k.trim().toLowerCase());
        this.sendInput({ type: 'hotkey', keys: keys });
        App.showToast(`Key Combo: ${combo.toUpperCase()}`, 'info');
      });
    });
  },

  drawVirtualCursor() {
    const x = this.virtualX * this.canvas.width;
    const y = this.virtualY * this.canvas.height;

    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    this.ctx.shadowBlur = 8;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + 14, y + 14);
    this.ctx.lineTo(x + 5, y + 15);
    this.ctx.lineTo(x + 9, y + 23);
    this.ctx.lineTo(x + 5, y + 25);
    this.ctx.lineTo(x + 1, y + 17);
    this.ctx.lineTo(x - 4, y + 21);
    this.ctx.closePath();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  },

  toggleDragLock() {
    this.isDragLockActive = !this.isDragLockActive;
    if (window.SoundEffects) window.SoundEffects.playClick();
    this.vibrate(30);

    const dragBtn = document.getElementById('toggleDragBtn');
    const mobileDragBtn = document.getElementById('mobileDragBtn');
    if (dragBtn) dragBtn.classList.toggle('drag-active', this.isDragLockActive);
    if (mobileDragBtn) {
      mobileDragBtn.classList.toggle('active', this.isDragLockActive);
      mobileDragBtn.querySelector('span').textContent = this.isDragLockActive ? I18n.t('btn_drag_active') : I18n.t('btn_drag');
    }

    if (this.isDragLockActive) {
      this.sendInput({ type: 'down', button: 'left' });
      App.showToast(I18n.t('drag_on_toast'), 'info');
    } else {
      this.sendInput({ type: 'up', button: 'left' });
      App.showToast(I18n.t('drag_off_toast'), 'info');
    }
  },

  setupOrientationControls() {
    const orientBtn = document.getElementById('toggleOrientationBtn');
    const container = document.querySelector('.stream-container');
    if (!orientBtn || !container) return;

    orientBtn.addEventListener('click', () => {
      this.orientationMode = this.orientationMode === 'normal' ? 'rotated_90' : 'normal';
      container.classList.toggle('rotated-90', this.orientationMode === 'rotated_90');
      orientBtn.classList.toggle('active', this.orientationMode === 'rotated_90');
      App.showToast(`${I18n.t('orientation_toast')}${this.orientationMode === 'normal' ? I18n.t('orient_normal') : I18n.t('orient_landscape')}`, 'info');
    });
  },

  setupMonitorBar() {
    this.fetchMonitors();
  },

  async fetchMonitors() {
    try {
      const res = await fetch('/api/monitors');
      this.availableMonitors = await res.json();
      this.renderMonitorPills();
    } catch (e) {}
  },

  renderMonitorPills() {
    const container = document.getElementById('quickMonitorSelector');
    if (!container || !this.availableMonitors || this.availableMonitors.length === 0) return;

    container.innerHTML = `<span style="font-size:0.68rem;color:var(--text-dim);font-weight:700;margin-right:2px;">${I18n.t('monitors_label')}:</span>`;

    this.availableMonitors.forEach((m) => {
      const btn = document.createElement('button');
      btn.className = `mon-btn ${m.id === this.currentMonitor ? 'active' : ''}`;
      btn.textContent = `D${m.id}`;
      btn.title = m.name;
      btn.addEventListener('click', () => this.switchMonitor(m.id));
      container.appendChild(btn);
    });
  },

  async switchMonitor(monId) {
    this.currentMonitor = monId;
    this.renderMonitorPills();
    if (window.SoundEffects) window.SoundEffects.playClick();
    try {
      await fetch(`/api/monitors/switch/${monId}`, { method: 'POST' });
      App.showToast(`Switched to Display ${monId}`, 'info');
    } catch (e) {}
  },

  toggleCursorMode() {
    this.cursorMode = this.cursorMode === 'physical' ? 'virtual' : 'physical';
    localStorage.setItem('lan_remote_cursor_mode', this.cursorMode);
    if (window.SoundEffects) window.SoundEffects.playClick();
    this.updateCursorModeUI();
    const modeText = this.cursorMode === 'physical' ? I18n.t('cursor_physical') : I18n.t('cursor_virtual');
    App.showToast(`${I18n.t('cursor_mode_toast')}${modeText}`, 'info');
  },

  updateCursorModeUI() {
    const btn = document.getElementById('toggleCursorModeBtn');
    const select = document.getElementById('settingCursorMode');
    if (btn) {
      btn.classList.toggle('virtual-active', this.cursorMode === 'virtual');
      btn.title = `Cursor: ${this.cursorMode.toUpperCase()}`;
    }
    if (select) select.value = this.cursorMode;
  },

  sendInput(data) {
    if (this.inputWs && this.inputWs.readyState === WebSocket.OPEN) {
      data.cursor_mode = this.cursorMode;
      this.inputWs.send(JSON.stringify(data));
    }
  },

  vibrate(ms = 20) {
    if (this.hapticFeedback && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch(e) {}
    }
  },

  getTouchCoordinates(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { normX, normY };
  },

  setupMobileMouseBar() {
    const lmb = document.getElementById('mobileLmbBtn');
    const rmb = document.getElementById('mobileRmbBtn');
    const drag = document.getElementById('mobileDragBtn');

    if (lmb) {
      lmb.addEventListener('click', () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        this.vibrate(20);
        this.sendInput({ type: 'click', button: 'left' });
        App.logAction('mouse', 'LMB');
      });
    }

    if (rmb) {
      rmb.addEventListener('click', () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        this.vibrate(35);
        this.sendInput({ type: 'click', button: 'right' });
        App.logAction('mouse', 'RMB');
      });
    }

    if (drag) {
      drag.addEventListener('click', () => this.toggleDragLock());
    }

    const dragToolBtn = document.getElementById('toggleDragBtn');
    if (dragToolBtn) {
      dragToolBtn.addEventListener('click', () => this.toggleDragLock());
    }
  },

  showTrackpadHint() {
    const hint = document.getElementById('trackpadHint');
    if (!hint) return;
    hint.classList.add('show');
    clearTimeout(this.hintTimeout);
    this.hintTimeout = setTimeout(() => {
      hint.classList.remove('show');
    }, 3500);
  },

  hideTrackpadHint() {
    const hint = document.getElementById('trackpadHint');
    if (hint) hint.classList.remove('show');
  },

  setupEvents() {
    const targetElement = document.getElementById('trackpadOverlay') || this.canvas;

    // Mouse Events
    targetElement.addEventListener('mousemove', (e) => {
      if (this.isGamepadActive) return;
      const { normX, normY } = this.getTouchCoordinates(e.clientX, e.clientY);
      this.virtualX = normX;
      this.virtualY = normY;
      this.sendInput({ type: 'move_abs', x: normX, y: normY });
    });

    targetElement.addEventListener('mousedown', (e) => {
      if (this.isGamepadActive) return;
      e.preventDefault();
      const btn = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
      this.sendInput({ type: 'down', button: btn });
    });

    targetElement.addEventListener('mouseup', (e) => {
      if (this.isGamepadActive) return;
      const btn = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
      this.sendInput({ type: 'up', button: btn });
    });

    targetElement.addEventListener('contextmenu', (e) => e.preventDefault());

    targetElement.addEventListener('wheel', (e) => {
      if (this.isGamepadActive) return;
      e.preventDefault();
      const dy = e.deltaY > 0 ? -120 : 120;
      this.sendInput({ type: 'wheel', dy: dy, dx: 0 });
    }, { passive: false });

    // Touch Events
    targetElement.addEventListener('touchstart', (e) => {
      if (this.isGamepadActive) return;
      const touches = e.touches;
      if (touches.length === 1) {
        const touch = touches[0];
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
        this.touchStartTime = Date.now();
        this.isDragging = false;

        this.longPressTimeout = setTimeout(() => {
          this.vibrate(40);
          this.sendInput({ type: 'click', button: 'right' });
          App.showToast(I18n.t('right_click_toast'), 'info');
          App.logAction('mouse', 'RMB Long-press');
        }, 450);

      } else if (touches.length === 2) {
        clearTimeout(this.longPressTimeout);
        this.twoFingerStartY = (touches[0].clientY + touches[1].clientY) / 2;
      }
    }, { passive: true });

    targetElement.addEventListener('touchmove', (e) => {
      if (this.isGamepadActive) return;
      const touches = e.touches;
      if (touches.length === 1) {
        const touch = touches[0];
        let rawDx = touch.clientX - this.lastTouchX;
        let rawDy = touch.clientY - this.lastTouchY;

        if (Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3) {
          clearTimeout(this.longPressTimeout);
          this.isDragging = true;
        }

        const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
        const accel = Math.min(2.2, 1.0 + (dist / 12) * 0.4);
        const dx = rawDx * this.sensitivity * accel;
        const dy = rawDy * this.sensitivity * accel;

        if (this.inputMode === 'trackpad') {
          this.virtualX = Math.max(0, Math.min(1, this.virtualX + (dx / this.canvas.width)));
          this.virtualY = Math.max(0, Math.min(1, this.virtualY + (dy / this.canvas.height)));
          this.sendInput({ type: 'move_rel', dx: Math.round(dx), dy: Math.round(dy) });
        } else {
          const { normX, normY } = this.getTouchCoordinates(touch.clientX, touch.clientY);
          this.virtualX = normX;
          this.virtualY = normY;
          this.sendInput({ type: 'move_abs', x: normX, y: normY });
        }

        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;

      } else if (touches.length === 2) {
        const currentY = (touches[0].clientY + touches[1].clientY) / 2;
        const delta = currentY - this.twoFingerStartY;

        if (Math.abs(delta) > 8) {
          const mult = this.invertScroll ? -1 : 1;
          const scrollDy = delta > 0 ? (120 * mult) : (-120 * mult);
          this.sendInput({ type: 'wheel', dy: scrollDy, dx: 0 });
          this.twoFingerStartY = currentY;
        }
      }
    }, { passive: true });

    targetElement.addEventListener('touchend', (e) => {
      if (this.isGamepadActive) return;
      clearTimeout(this.longPressTimeout);
      const elapsed = Date.now() - this.touchStartTime;

      if (!this.isDragging && elapsed < 300 && !this.isDragLockActive) {
        this.vibrate(15);
        this.sendInput({ type: 'click', button: 'left' });
        App.logAction('mouse', 'LMB Tap');
      }
    });

    // Toolbar Controls
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

    const cursorBtn = document.getElementById('toggleCursorModeBtn');
    if (cursorBtn) {
      cursorBtn.addEventListener('click', () => this.toggleCursorMode());
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

    drawer.querySelectorAll('.kbd-key').forEach(keyBtn => {
      keyBtn.addEventListener('click', () => {
        const key = keyBtn.dataset.key;
        this.vibrate(15);
        this.sendInput({ type: 'key_press', key: key });
        App.logAction('keyboard', `Key: ${key.toUpperCase()}`);
      });
    });

    const textInput = document.getElementById('kbdTextInput');
    const sendTextBtn = document.getElementById('kbdSendTextBtn');

    if (textInput && sendTextBtn) {
      const sendText = () => {
        const val = textInput.value;
        if (val) {
          this.sendInput({ type: 'type_text', text: val });
          textInput.value = '';
          App.showToast(I18n.t('text_sent_toast'), 'success');
          App.logAction('keyboard', `Typed text`);
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
