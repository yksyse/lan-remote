// Host System Monitor & Quick Controls with i18n
const SystemManager = {
  isUpdatingVolume: false,

  init() {
    this.setupVolumeSlider();
    this.setupMediaControls();
    this.setupPowerControls();
    this.setupCommandRunner();
  },

  update() {
    App.fetchStatus();
  },

  updateMetrics(data) {
    if (!data) return;

    // CPU
    const cpuVal = document.getElementById('cpuPercentVal');
    const cpuBar = document.getElementById('cpuPercentBar');
    if (cpuVal && cpuBar) {
      cpuVal.textContent = `${data.cpu_percent || 0}%`;
      cpuBar.style.width = `${data.cpu_percent || 0}%`;
      cpuBar.style.backgroundColor = data.cpu_percent > 85 ? 'var(--accent-red)' : (data.cpu_percent > 60 ? 'var(--accent-yellow)' : 'var(--accent-green)');
    }

    // Memory
    const memVal = document.getElementById('memPercentVal');
    const memBar = document.getElementById('memPercentBar');
    const memSub = document.getElementById('memSubtext');
    if (memVal && memBar && data.memory) {
      memVal.textContent = `${data.memory.percent}%`;
      memBar.style.width = `${data.memory.percent}%`;
      memBar.style.backgroundColor = data.memory.percent > 85 ? 'var(--accent-red)' : 'var(--accent-blue)';
      if (memSub) memSub.textContent = `${data.memory.used_gb} GB / ${data.memory.total_gb} GB`;
    }

    // Disks
    const diskContainer = document.getElementById('disksContainer');
    if (diskContainer && data.disks) {
      diskContainer.innerHTML = '';
      data.disks.forEach(d => {
        const item = document.createElement('div');
        item.style.marginBottom = '8px';
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px;">
            <span><strong>${d.mount}</strong> (${d.free_gb} GB ${I18n.t('free_space')})</span>
            <span>${d.percent}%</span>
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

    // Volume Slider Sync
    if (!this.isUpdatingVolume) {
      const volSlider = document.getElementById('sysVolumeSlider');
      const volLabel = document.getElementById('sysVolumeLabel');
      const muteBtn = document.getElementById('sysMuteBtn');

      if (volSlider && data.volume !== undefined) {
        volSlider.value = data.volume;
      }
      if (volLabel && data.volume !== undefined) {
        volLabel.textContent = `${data.volume}%`;
      }
      if (muteBtn && data.muted !== undefined) {
        muteBtn.classList.toggle('active', data.muted);
      }
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
        if (label) label.textContent = `${e.target.value}%`;
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
        const action = btn.dataset.power;
        if (action === 'restart' || action === 'shutdown') {
          if (!confirm(I18n.t('confirm_power'))) {
            return;
          }
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

  setupCommandRunner() {
    const input = document.getElementById('cmdRunnerInput');
    const runBtn = document.getElementById('cmdRunnerBtn');
    const output = document.getElementById('cmdRunnerOutput');

    if (!input || !runBtn || !output) return;

    const runCmd = async () => {
      const cmd = input.value.trim();
      if (!cmd) return;

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
document.addEventListener('DOMContentLoaded', () => {
  SystemManager.init();
});
