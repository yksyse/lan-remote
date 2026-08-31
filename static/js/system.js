// Host System Monitor, Sparklines & Media Controls
const SystemManager = {
  isUpdatingVolume: false,

  init() {
    this.setupVolumeSlider();
    this.setupMediaControls();
    this.setupPowerControls();
    this.setupCommandRunner();
    this.setupClipboardSync();
  },

  update() {
    App.fetchStatus();
    if (window.TaskManager) window.TaskManager.fetchProcesses();
  },

  drawSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    // Draw Smooth Area & Line
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

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill Gradient
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

    // Active Foreground Window Badge
    const actWinEl = document.getElementById('activeWindowBadge');
    if (actWinEl && data.active_window) {
      actWinEl.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <img src="/icons/desktop.svg" style="width:14px;height:14px;opacity:0.8;" alt="">
          <strong style="color:var(--accent-blue);">${data.active_window.process}:</strong>
          <span style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${data.active_window.title}</span>
        </span>
      `;
    }

    // Disks
    const diskContainer = document.getElementById('disksContainer');
    if (diskContainer && data.disks) {
      diskContainer.innerHTML = '';
      data.disks.forEach(d => {
        const item = document.createElement('div');
        item.style.marginBottom = '8px';
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px;">
            <span><strong>${d.mount}</strong> (${d.free_gb} GB ${I18n.t('free_space')})</span>
            <span style="font-family:var(--font-mono);">${d.percent}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width:${d.percent}%;background-color:${d.percent > 90 ? 'var(--accent-red)' : 'var(--accent-purple)'}"></div>
          </div>
        `;
        diskContainer.appendChild(item);
      });
    }

    // System Info
    const hostEl = document.getElementById('sysHostInfo');
    if (hostEl) {
      hostEl.textContent = `${data.hostname || ''} | ${data.os || ''} | Uptime: ${data.uptime || ''}`;
    }

    // Volume Knob & Slider Sync
    if (!this.isUpdatingVolume) {
      const volSlider = document.getElementById('sysVolumeSlider');
      const volLabel = document.getElementById('sysVolumeLabel');
      const muteBtn = document.getElementById('sysMuteBtn');

      if (volSlider && data.volume !== undefined) volSlider.value = data.volume;
      if (volLabel && data.volume !== undefined) volLabel.textContent = `${data.volume}%`;
      if (window.VolumeKnob && data.volume !== undefined) window.VolumeKnob.setValue(data.volume);
      if (muteBtn && data.muted !== undefined) muteBtn.classList.toggle('active', data.muted);
    }
  },

  setupVolumeSlider() {
    const slider = document.getElementById('sysVolumeSlider');
    const label = document.getElementById('sysVolumeLabel');
    const muteBtn = document.getElementById('sysMuteBtn');

    if (slider) {
      slider.addEventListener('mousedown', () => this.isUpdatingVolume = true);
      slider.addEventListener('touchstart', () => this.isUpdatingVolume = true);

      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (label) label.textContent = `${val}%`;
        if (window.VolumeKnob) window.VolumeKnob.setValue(val);
      });

      const commitVolume = async () => {
        this.isUpdatingVolume = false;
        const val = parseInt(slider.value, 10);
        try {
          await fetch('/api/system/volume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: val })
          });
        } catch (e) {}
      };

      slider.addEventListener('mouseup', commitVolume);
      slider.addEventListener('touchend', commitVolume);
      slider.addEventListener('change', commitVolume);
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
          const d = await res.json();
          muteBtn.classList.toggle('active', d.muted);
          App.showToast(d.muted ? 'Muted' : 'Unmuted', 'info');
        } catch (e) {}
      });
    }
  },

  setupMediaControls() {
    document.querySelectorAll('[data-media]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        const action = btn.dataset.media;
        try {
          await fetch('/api/system/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action })
          });
          App.showToast(`Media: ${action}`, 'info');
        } catch (e) {}
      });
    });
  },

  setupPowerControls() {
    document.querySelectorAll('[data-power]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        const action = btn.dataset.power;
        if (action === 'restart' || action === 'shutdown') {
          if (!confirm(I18n.t('confirm_power'))) return;
        }
        try {
          const res = await fetch('/api/system/power', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action })
          });
          const d = await res.json();
          App.showToast(d.message || `Power: ${action}`, 'info');
        } catch (e) {}
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
          if (window.SoundEffects) window.SoundEffects.playSuccess();
          App.showToast(I18n.t('clipboard_sent_toast') || 'Text sent to host clipboard', 'success');
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
