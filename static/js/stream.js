// Ultra-Low Latency Canvas Streamer, High-Precision Pointer & Mobile Touch Control
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
    this.setupMonitorBar();
    this.setupOrientationControls();
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

      // Binary Blob -> ImageBitmap for GPU texture upload
      try {
        const bmp = await createImageBitmap(event.data);
        if (this.canvas.width !== bmp.width || this.canvas.height !== bmp.height) {
          this.canvas.width = bmp.width;
          this.canvas.height = bmp.height;
        }
        this.ctx.drawImage(bmp, 0, 0);
        bmp.close();

        // Draw High-Visibility Virtual Pointer HUD
        this.drawPointerHUD();
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
      data.cursor_mode = this.cursorMode;
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

  drawPointerHUD() {
    const ctx = this.ctx;
    const cx = this.virtualX * this.canvas.width;
    const cy = this.virtualY * this.canvas.height;

    // Draw active pointer if virtual or drag is active
    if (this.cursorMode === 'virtual' || this.isDragLockActive || this.inputMode === 'trackpad') {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = this.isDragLockActive ? '#f59e0b' : '#3b82f6';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      // Pointer cursor
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 14, cy + 11);
      ctx.lineTo(cx + 6, cy + 12);
      ctx.lineTo(cx + 10, cy + 20);
      ctx.lineTo(cx + 7, cy + 21);
      ctx.lineTo(cx + 3, cy + 13);
      ctx.lineTo(cx - 3, cy + 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Precision crosshair center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }

    // Click Ripple Animation
    if (this.clickRipple) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.clickRipple.x, this.clickRipple.y, this.clickRipple.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${this.clickRipple.opacity})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      this.clickRipple.radius += 2.5;
      this.clickRipple.opacity -= 0.08;
      if (this.clickRipple.opacity <= 0) {
        this.clickRipple = null;
      }
      ctx.restore();
    }
  },

  triggerRipple(normX, normY) {
    this.clickRipple = {
      x: normX * this.canvas.width,
      y: normY * this.canvas.height,
      radius: 4,
      opacity: 1.0
    };
  },

  showTrackpadHint() {
    const hint = document.getElementById('trackpadHint');
    if (!hint) return;
    hint.classList.add('show');
    clearTimeout(this.hintTimeout);
    this.hintTimeout = setTimeout(() => hint.classList.remove('show'), 2500);
  },

  hideTrackpadHint() {
    const hint = document.getElementById('trackpadHint');
    if (hint) hint.classList.remove('show');
  },

  // ----------------------------------------------------
  // Quick Monitor Switcher
  // ----------------------------------------------------
  async fetchMonitors() {
    try {
      const res = await fetch('/api/monitors');
      this.availableMonitors = await res.json();
      this.renderMonitorPills();
    } catch (e) {}
  },

  setupMonitorBar() {
    this.fetchMonitors();
  },

  renderMonitorPills() {
    const bar = document.getElementById('quickMonitorSelector');
    if (!bar) return;

    bar.innerHTML = `<span style="font-size:0.7rem;color:var(--text-dim);margin:0 4px;font-weight:600;">${I18n.t('monitors_label')}:</span>`;

    this.availableMonitors.forEach(mon => {
      const btn = document.createElement('button');
      btn.className = `mon-btn ${mon.id === this.currentMonitor ? 'active' : ''}`;
      btn.textContent = `D${mon.id}`;
      btn.title = mon.name;
      btn.addEventListener('click', () => this.switchMonitor(mon.id));
      bar.appendChild(btn);
    });
  },

  async switchMonitor(monId) {
    this.currentMonitor = monId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'set_monitor', monitor_index: monId }));
    }
    this.renderMonitorPills();
    App.showToast(`${I18n.t('monitors_label')} ${monId}`, 'info');
    App.logAction('desktop', `Monitor D${monId}`);
  },

  // ----------------------------------------------------
  // Mobile Orientation (Landscape 90° rotate / normal)
  // ----------------------------------------------------
  setupOrientationControls() {
    const orientBtn = document.getElementById('toggleOrientationBtn');
    if (!orientBtn) return;

    orientBtn.addEventListener('click', () => {
      this.orientationMode = this.orientationMode === 'normal' ? 'rotated_90' : 'normal';
      const container = document.querySelector('.stream-container');
      
      if (this.orientationMode === 'rotated_90') {
        container.classList.add('rotated-90');
        orientBtn.classList.add('active');
        App.showToast(I18n.t('orient_landscape'), 'info');
      } else {
        container.classList.remove('rotated-90');
        orientBtn.classList.remove('active');
        App.showToast(I18n.t('orient_normal'), 'info');
      }
    });
  },

  // ----------------------------------------------------
  // Drag Lock Toggle (Easy Window Dragging)
  // ----------------------------------------------------
  toggleDragLock() {
    this.isDragLockActive = !this.isDragLockActive;
    const btn = document.getElementById('mobileDragBtn');
    const toolBtn = document.getElementById('toggleDragBtn');

    if (this.isDragLockActive) {
      this.vibrate(30);
      this.sendInput({ type: 'down', button: 'left' });
      if (btn) {
        btn.classList.add('active');
        btn.textContent = I18n.t('btn_drag_active');
      }
      if (toolBtn) toolBtn.classList.add('drag-active');
      App.showToast(I18n.t('drag_on_toast'), 'info');
      App.logAction('mouse', 'Drag Lock ON');
    } else {
      this.vibrate(15);
      this.sendInput({ type: 'up', button: 'left' });
      if (btn) {
        btn.classList.remove('active');
        btn.textContent = I18n.t('btn_drag');
      }
      if (toolBtn) toolBtn.classList.remove('drag-active');
      App.showToast(I18n.t('drag_off_toast'), 'info');
      App.logAction('mouse', 'Drag Lock OFF');
    }
  },

  // ----------------------------------------------------
  // Virtual Cursor Mode Toggle
  // ----------------------------------------------------
  toggleCursorMode() {
    this.cursorMode = this.cursorMode === 'physical' ? 'virtual' : 'physical';
    localStorage.setItem('lan_remote_cursor_mode', this.cursorMode);
    this.updateCursorModeUI();
    const modeName = this.cursorMode === 'physical' ? I18n.t('cursor_physical') : I18n.t('cursor_virtual');
    App.showToast(`${I18n.t('cursor_mode_toast')}${modeName}`, 'info');
  },

  updateCursorModeUI() {
    const btn = document.getElementById('toggleCursorModeBtn');
    if (btn) {
      btn.classList.toggle('virtual-active', this.cursorMode === 'virtual');
      btn.title = `${I18n.t('cursor_mode_btn')}: ${this.cursorMode === 'physical' ? I18n.t('cursor_physical') : I18n.t('cursor_virtual')}`;
    }
    const select = document.getElementById('settingCursorMode');
    if (select) select.value = this.cursorMode;
  },

  // ----------------------------------------------------
  // Coordinate and Touch Mapping
  // ----------------------------------------------------
  getTouchCoordinates(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    let normX = 0, normY = 0;

    if (this.orientationMode === 'rotated_90') {
      normX = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      normY = Math.max(0, Math.min(1, 1.0 - ((clientX - rect.left) / rect.width)));
    } else {
      normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    }
    return { normX, normY };
  },

  setupMobileMouseBar() {
    const lmb = document.getElementById('mobileLmbBtn');
    const rmb = document.getElementById('mobileRmbBtn');
    const drag = document.getElementById('mobileDragBtn');
    const toolDrag = document.getElementById('toggleDragBtn');

    if (lmb) {
      lmb.addEventListener('click', () => {
        this.vibrate(15);
        this.triggerRipple(this.virtualX, this.virtualY);
        this.sendInput({ type: 'click', button: 'left' });
        App.logAction('mouse', 'LMB Click');
      });
    }

    if (rmb) {
      rmb.addEventListener('click', () => {
        this.vibrate(25);
        this.triggerRipple(this.virtualX, this.virtualY);
        this.sendInput({ type: 'click', button: 'right' });
        App.logAction('mouse', 'RMB Click');
      });
    }

    if (drag) drag.addEventListener('click', () => this.toggleDragLock());
    if (toolDrag) toolDrag.addEventListener('click', () => this.toggleDragLock());
  },

  setupEvents() {
    const canvas = this.canvas;
    const trackpadOverlay = document.getElementById('trackpadOverlay');

    // 1. Mouse Events (Desktop)
    canvas.addEventListener('mousemove', (e) => {
      const { normX, normY } = this.getTouchCoordinates(e.clientX, e.clientY);
      this.virtualX = normX;
      this.virtualY = normY;

      if (this.inputMode === 'direct') {
        this.sendInput({ type: 'move_abs', x: normX, y: normY });
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const btn = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');
      this.triggerRipple(this.virtualX, this.virtualY);
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

    // 2. Touch Gestures with Non-Linear Acceleration (Phone / Tablet)
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

        const { normX, normY } = this.getTouchCoordinates(touch.clientX, touch.clientY);
        this.virtualX = normX;
        this.virtualY = normY;

        // Long press -> Right click
        clearTimeout(this.longPressTimeout);
        this.longPressTimeout = setTimeout(() => {
          if (!this.isDragging && !this.isDragLockActive) {
            this.vibrate(35);
            this.triggerRipple(this.virtualX, this.virtualY);
            this.sendInput({ type: 'click', button: 'right' });
            App.showToast(I18n.t('right_click_toast'), 'info');
            App.logAction('mouse', 'RMB Long Press');
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
        let rawDx = touch.clientX - this.lastTouchX;
        let rawDy = touch.clientY - this.lastTouchY;

        if (this.orientationMode === 'rotated_90') {
          const tempDx = rawDx;
          rawDx = rawDy;
          rawDy = -tempDx;
        }

        const dist = Math.hypot(rawDx, rawDy);
        if (dist > 2) {
          this.isDragging = true;
          clearTimeout(this.longPressTimeout);
        }

        // Non-linear acceleration: smooth for precision, fast for sweeps
        const speedMultiplier = 1.0 + Math.min(dist / 25.0, 1.8);
        const dx = rawDx * this.sensitivity * speedMultiplier;
        const dy = rawDy * this.sensitivity * speedMultiplier;

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
      clearTimeout(this.longPressTimeout);
      const elapsed = Date.now() - this.touchStartTime;

      if (!this.isDragging && elapsed < 300 && !this.isDragLockActive) {
        this.vibrate(15);
        this.triggerRipple(this.virtualX, this.virtualY);
        this.sendInput({ type: 'click', button: 'left' });
        App.logAction('mouse', 'LMB Tap');
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
