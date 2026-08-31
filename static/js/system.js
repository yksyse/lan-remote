// Host System Monitor, Sparklines, Clipboard History, Battery & Remote Toast Notifications
const SystemManager = {
  isUpdatingVolume: false,

  init() {
    this.setupVolumeSlider();
    this.setupMediaControls();
    this.setupPowerControls();
    this.setupCommandRunner();
    this.setupClipboardSync();
    this.setupNotificationSender();
  },

  update() {
    App.fetchStatus();
    if (window.TaskManager) {
      if (window.TaskManager.currentTab === 'gpu') window.TaskManager.fetchGpu();
      else window.TaskManager.fetchProcesses();
    }
  },

  drawSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Grid center line
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    // Smooth Bezier line & fill
    ctx.beginPath();
    const step = w / (data.length - 1);

    data.forEach((val, i) => {
      const y = h - (val / 100) * (h - 6) - 3;
      if (i === 0) {
        ctx.moveTo(0, y);
      } else {
        const prevX = (i - 1) * step;
        const prevY = h - (data[i - 1] / 100) * (h - 6) - 3;
        const cx = (prevX + i * step) / 2;
        ctx.bezierCurveTo(cx, prevY, cx, y, i * step, y);
      }
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `${color}40`);
    grad.addColorStop(1, `${color}00`);
    ctx.fillStyle = grad;
    ctx.fill();
  },

  updateMetrics(data) {
    if (!data) return;

    // CPU & Sparkline
    const cpuVal = document.getElementById('cpuPercentVal');
    const cpuBar = document.getElementById('cpuPercentBar');
    if (cpuVal && cpuBar) {
      cpuVal.textContent = `${data.cpu_percent || 0}%`;
      cpuBar.style.width = `${data.cpu_percent || 0}%`;
      cpuBar.style.backgroundColor = data.cpu_percent > 85 ? 'var(--accent-red)' : (data.cpu_percent > 60 ? 'var(--accent-yellow)' : 'var(--accent-green)');
    }
    if (data.cpu_history) {
      this.drawSparkline('cpuSparkline', data.cpu_history, '#10b981');
    }

    // Memory & Sparkline
    const memVal = document.getElementById('memPercentVal');
    const memBar = document.getElementById('memPercentBar');
    const memSub = document.getElementById('memSubtext');
    if (memVal && memBar && data.memory) {
      memVal.textContent = `${data.memory.percent}%`;
      memBar.style.width = `${data.memory.percent}%`;
      memBar.style.backgroundColor = data.memory.percent > 85 ? 'var(--accent-red)' : 'var(--accent-blue)';
      if (memSub) memSub.textContent = `${data.memory.used_gb} GB / ${data.memory.total_gb} GB`;
      if (data.memory.history) {
        this.drawSparkline('memSparkline', data.memory.history, '#3b82f6');
      }
    }

    // Battery Monitor
    const batBadge = document.getElementById('sysBatteryBadge');
    if (batBadge && data.battery) {
      if (data.battery.has_battery) {
        batBadge.style.display = 'inline-flex';
        const plugIcon = data.battery.power_plugged ? '⚡' : '';
        batBadge.innerHTML = `<img src="/icons/battery.svg" alt=""><span>${data.battery.percent}% ${plugIcon}</span>`;
      } else {
        batBadge.style.display = 'none';
      }
    }

    // Active Window
    const actWinEl = document.getElementById('activeWindowBadge');
    if (actWinEl && data.active_window) {
      actWinEl.textContent = `${data.active_window.title} (${data.active_window.process})`;
    }

    // Host Info
    const hostInfo = document.getElementById('sysHostInfo');
    if (hostInfo) {
      hostInfo.textContent = `${data.hostname} • ${data.os} • Up: ${data.uptime || '--'}`;
    }

    // Storage
    const diskCont = document.getElementById('disksContainer');
    if (diskCont && data.disks) {
      diskCont.innerHTML = '';
      data.disks.forEach(d => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '2px';
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);">
            <span>${d.mount}</span>
            <span>${d.used_gb} GB / ${d.total_gb} GB (${d.percent}%)</span>
          </div>
          <div class="progress-bar-bg" style="height:4px;">
            <div class="progress-bar-fill" style="width:${d.percent}%;background:${d.percent > 90 ? 'var(--accent-red)' : 'var(--accent-blue)'};"></div>
          </div>
        `;
        diskCont.appendChild(row);
      });
    }

    // Volume & Knob
    if (!this.isUpdatingVolume) {
      const slider = document.getElementById('sysVolumeSlider');
      const label = document.getElementById('sysVolumeLabel');
      const muteBtn = document.getElementById('sysMuteBtn');

      if (slider && data.volume !== undefined) slider.value = data.volume;
      if (label && data.volume !== undefined) label.textContent = `${data.volume}%`;
      if (muteBtn && data.muted !== undefined) {
        muteBtn.textContent = data.muted ? 'Unmute' : 'Mute';
        muteBtn.classList.toggle('active', !!data.muted);
      }
      if (window.KnobManager && data.volume !== undefined) {
        window.KnobManager.setValue(data.volume);
      }
    }

    // Clipboard History List
    if (data.clipboard_history) {
      this.renderClipboardHistory(data.clipboard_history);
    }
  },

  renderClipboardHistory(history) {
    const list = document.getElementById('clipboardHistoryList');
    if (!list) return;

    list.innerHTML = '';
    if (!history || history.length === 0) {
      list.innerHTML = `<div style="font-size:0.78rem;color:var(--text-dim);padding:4px 0;">No snippets recorded yet</div>`;
      return;
    }

    history.slice(0, 5).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'clipboard-history-item';
      row.innerHTML = `
        <span style="font-weight:700;color:var(--accent-blue);font-family:var(--font-mono);font-size:0.75rem;">#${index + 1}</span>
        <span class="clipboard-item-text" title="${item.text}">${item.preview}</span>
        <span style="font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono);">${item.time}</span>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="btn-secondary" style="padding:2px 8px;font-size:0.72rem;" title="Copy to local clipboard" onclick="navigator.clipboard.writeText('${item.text.replace(/'/g, "\\'")}'); App.showToast(I18n.t('copied_toast'), 'success');">
            <img src="/icons/copy.svg" style="width:12px;height:12px;" alt="">
          </button>
          <button class="btn-primary" style="padding:2px 8px;font-size:0.72rem;" title="Send to host clipboard" onclick="fetch('/api/system/clipboard', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:'${item.text.replace(/'/g, "\\'")}'})}); App.showToast('Copied to Host', 'success');">
            ⬆
          </button>
        </div>
      `;
      list.appendChild(row);
    });
  },

  setupNotificationSender() {
    const titleInput = document.getElementById('notifyTitleInput');
    const msgInput = document.getElementById('notifyMsgInput');
    const sendBtn = document.getElementById('notifySendBtn');

    if (!sendBtn || !msgInput) return;

    sendBtn.addEventListener('click', async () => {
      const title = titleInput?.value.trim() || 'LAN Remote';
      const msg = msgInput.value.trim();
      if (!msg) return;

      if (window.SoundEffects) window.SoundEffects.playClick();
      try {
        const res = await fetch('/api/system/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, message: msg })
        });
        const data = await res.json();
        if (data.status === 'ok') {
          msgInput.value = '';
          if (window.SoundEffects) window.SoundEffects.playSuccess();
          App.showToast('Уведомление отправлено на ПК!', 'success');
        }
      } catch (e) {
        App.showToast('Error sending notification', 'error');
      }
    });
  },

  setupVolumeSlider() {
    const slider = document.getElementById('sysVolumeSlider');
    const label = document.getElementById('sysVolumeLabel');
    const muteBtn = document.getElementById('sysMuteBtn');

    if (slider) {
      slider.addEventListener('input', (e) => {
        this.isUpdatingVolume = true;
        const val = parseInt(e.target.value, 10);
        if (label) label.textContent = `${val}%`;
        if (window.KnobManager) window.KnobManager.setValue(val);
      });

      slider.addEventListener('change', async (e) => {
        const val = parseInt(e.target.value, 10);
        try {
          await fetch('/api/system/volume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: val })
          });
        } catch (err) {}
        this.isUpdatingVolume = false;
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', async () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        try {
          const res = await fetch('/api/system/volume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mute_toggle: true })
          });
          const data = await res.json();
          muteBtn.textContent = data.muted ? 'Unmute' : 'Mute';
          muteBtn.classList.toggle('active', !!data.muted);
        } catch (err) {}
      });
    }
  },

  setupMediaControls() {
    document.querySelectorAll('[data-media]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.media;
        if (window.SoundEffects) window.SoundEffects.playClick();
        try {
          await fetch('/api/system/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: act })
          });
          App.logAction('media', `Media: ${act}`);
        } catch (err) {}
      });
    });
  },

  setupPowerControls() {
    document.querySelectorAll('[data-power]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.power;
        if (act === 'shutdown' || act === 'restart') {
          if (!confirm(`Are you sure you want to ${act.toUpperCase()} the host PC?`)) return;
        }
        if (window.SoundEffects) window.SoundEffects.playClick();
        try {
          const res = await fetch('/api/system/power', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: act })
          });
          const d = await res.json();
          App.showToast(d.message || `Power action: ${act}`, 'info');
          App.logAction('power', `Power: ${act}`);
        } catch (err) {}
      });
    });
  },

  setupClipboardSync() {
    const sendBtn = document.getElementById('clipboardSendBtn');
    const getBtn = document.getElementById('clipboardGetBtn');
    const input = document.getElementById('clipboardInput');

    if (sendBtn && input) {
      sendBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) return;
        try {
          await fetch('/api/system/clipboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
          });
          input.value = '';
          if (window.SoundEffects) window.SoundEffects.playSuccess();
          App.showToast(I18n.t('clipboard_sent_toast') || 'Text sent to host clipboard', 'success');
          App.fetchStatus();
        } catch (e) {
          App.showToast('Error sending clipboard', 'error');
        }
      });
    }

    if (getBtn && input) {
      getBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/system/clipboard');
          const data = await res.json();
          if (data.text) {
            input.value = data.text;
            if (window.SoundEffects) window.SoundEffects.playSuccess();
            App.showToast(I18n.t('clipboard_got_toast') || 'Fetched from host clipboard', 'info');
          } else {
            App.showToast('Host clipboard is empty', 'info');
          }
        } catch (e) {
          App.showToast('Error getting clipboard', 'error');
        }
      });
    }
  },

  setupCommandRunner() {
    const input = document.getElementById('cmdRunnerInput');
    const runBtn = document.getElementById('cmdRunnerBtn');
    const output = document.getElementById('cmdRunnerOutput');

    if (!input || !runBtn || !output) return;

    const runCmd = async () => {
      const cmd = input.value.trim();
      if (!cmd) return;

      if (window.SoundEffects) window.SoundEffects.playClick();
      output.textContent = `$ ${cmd}\nRunning...`;
      try {
        const res = await fetch('/api/system/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const d = await res.json();
        const text = d.stdout || d.stderr || `Exit code: ${d.exit_code}`;
        output.textContent = `$ ${cmd}\n${text}`;
      } catch (e) {
        output.textContent = `Error executing command: ${e}`;
      }
    };

    runBtn.addEventListener('click', runCmd);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runCmd();
    });
  }
};

window.SystemManager = SystemManager;
document.addEventListener('DOMContentLoaded', () => SystemManager.init());
