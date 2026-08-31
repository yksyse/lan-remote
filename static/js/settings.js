// Modular Settings & Fuzzy Search Controller
const SettingsManager = {
  allSettingItems: [],

  init() {
    this.allSettingItems = Array.from(document.querySelectorAll('.setting-item'));
    this.setupListeners();
    this.setupSvgUploader();
    this.loadMonitors();
  },

  setupListeners() {
    // Search filter input
    const searchInput = document.getElementById('settingsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSettings(e.target.value);
      });
    }

    // Auto-save on change for any setting input
    document.querySelectorAll('.setting-control select, .setting-control input').forEach(el => {
      el.addEventListener('change', () => this.saveSettingsFromUI());
    });
  },

  filterSettings(query) {
    const q = (query || '').toLowerCase().trim();
    const sections = document.querySelectorAll('.settings-section');

    sections.forEach(sec => {
      let visibleCount = 0;
      const items = sec.querySelectorAll('.setting-item');

      items.forEach(item => {
        const title = (item.querySelector('.setting-title')?.textContent || '').toLowerCase();
        const desc = (item.querySelector('.setting-desc')?.textContent || '').toLowerCase();
        const tags = (item.dataset.tags || '').toLowerCase();

        const match = !q || title.includes(q) || desc.includes(q) || tags.includes(q);
        item.classList.toggle('hidden', !match);
        if (match) visibleCount++;
      });

      // Hide section if no children match
      sec.style.display = visibleCount > 0 ? 'flex' : 'none';
    });
  },

  async loadMonitors() {
    try {
      const res = await fetch('/api/monitors');
      const monitors = await res.json();
      const select = document.getElementById('settingStreamMonitor');
      if (select && monitors && monitors.length > 0) {
        select.innerHTML = '';
        monitors.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          select.appendChild(opt);
        });
      }
    } catch (e) {}
  },

  applyConfigToUI(cfg) {
    if (!cfg) return;

    // Stream
    if (cfg.stream) {
      this.setVal('settingStreamFps', cfg.stream.fps);
      this.setVal('settingStreamQuality', cfg.stream.quality);
      this.setVal('settingStreamScale', cfg.stream.scale);
      this.setVal('settingStreamMonitor', cfg.stream.monitor_index);
    }

    // Input
    if (cfg.input) {
      this.setVal('settingInputMode', cfg.input.mode);
      this.setVal('settingInputSensitivity', cfg.input.sensitivity);
      this.setCheck('settingInputInvertScroll', cfg.input.invert_scroll);
      this.setVal('settingInputLongPress', cfg.input.long_press_ms);
      this.setCheck('settingInputHaptic', cfg.input.haptic_feedback);

      // Sync to StreamManager
      if (window.StreamManager) {
        window.StreamManager.inputMode = cfg.input.mode || 'trackpad';
        window.StreamManager.sensitivity = cfg.input.sensitivity || 1.3;
        window.StreamManager.invertScroll = !!cfg.input.invert_scroll;
        window.StreamManager.hapticFeedback = cfg.input.haptic_feedback !== false;
      }
    }

    // Deck
    if (cfg.deck) {
      this.setVal('settingDeckColumns', cfg.deck.grid_columns || 4);
    }

    // Server / Security
    if (cfg.server) {
      this.setVal('settingServerPort', cfg.server.port || 8080);
      this.setVal('settingServerPin', cfg.server.pin_code || '');
    }

    this.renderSvgLibrary();
    this.renderNetworkInfo();
  },

  setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  },

  setCheck(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.checked = !!val;
  },

  async saveSettingsFromUI() {
    const payload = {
      stream: {
        fps: parseInt(document.getElementById('settingStreamFps')?.value || 30, 10),
        quality: parseInt(document.getElementById('settingStreamQuality')?.value || 65, 10),
        scale: parseFloat(document.getElementById('settingStreamScale')?.value || 0.75),
        monitor_index: parseInt(document.getElementById('settingStreamMonitor')?.value || 1, 10),
      },
      input: {
        mode: document.getElementById('settingInputMode')?.value || 'trackpad',
        sensitivity: parseFloat(document.getElementById('settingInputSensitivity')?.value || 1.3),
        invert_scroll: !!document.getElementById('settingInputInvertScroll')?.checked,
        long_press_ms: parseInt(document.getElementById('settingInputLongPress')?.value || 450, 10),
        haptic_feedback: !!document.getElementById('settingInputHaptic')?.checked,
      },
      deck: {
        grid_columns: parseInt(document.getElementById('settingDeckColumns')?.value || 4, 10),
      },
      server: {
        port: parseInt(document.getElementById('settingServerPort')?.value || 8080, 10),
        pin_code: document.getElementById('settingServerPin')?.value || '',
      }
    };

    try {
      for (const [section, values] of Object.entries(payload)) {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, values })
        });
      }
      await App.loadConfig();
      App.showToast('Settings saved', 'success');
    } catch (e) {
      App.showToast('Error saving settings', 'error');
    }
  },

  async renderSvgLibrary() {
    const grid = document.getElementById('settingsSvgGrid');
    if (!grid) return;

    try {
      const res = await fetch('/api/icons');
      const icons = await res.json();
      grid.innerHTML = '';
      icons.forEach(ic => {
        const item = document.createElement('div');
        item.className = 'svg-icon-preview';
        item.innerHTML = `<img src="${ic.url}" alt="${ic.name}" /><span style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;">${ic.name}</span>`;
        grid.appendChild(item);
      });
    } catch (e) {}
  },

  setupSvgUploader() {
    const input = document.getElementById('svgUploadInput');
    const uploadBtn = document.getElementById('svgUploadBtn');

    if (!input || !uploadBtn) return;

    uploadBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.svg')) {
        App.showToast('Only .svg files allowed', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/icons/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.status === 'ok') {
          App.showToast(`Icon "${data.name}" uploaded!`, 'success');
          this.renderSvgLibrary();
          if (window.DeckManager) window.DeckManager.loadIcons();
        }
      } catch (e) {
        App.showToast('Upload error', 'error');
      }
    });
  },

  renderNetworkInfo() {
    const container = document.getElementById('settingsNetworkIps');
    if (!container || !App.status?.local_ips) return;

    const port = App.config?.server?.port || 8080;
    container.innerHTML = '';

    App.status.local_ips.forEach(ip => {
      const url = `http://${ip}:${port}`;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.background = 'var(--bg-secondary)';
      row.style.padding = '8px 12px';
      row.style.borderRadius = 'var(--radius-md)';
      row.style.marginBottom = '6px';
      row.style.fontFamily = 'var(--font-mono)';
      row.style.fontSize = '0.82rem';

      row.innerHTML = `
        <span>${url}</span>
        <button class="btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="navigator.clipboard.writeText('${url}'); App.showToast('Copied URL!', 'success');">Copy</button>
      `;
      container.appendChild(row);
    });
  }
};

window.SettingsManager = SettingsManager;
document.addEventListener('DOMContentLoaded', () => {
  SettingsManager.init();
});
