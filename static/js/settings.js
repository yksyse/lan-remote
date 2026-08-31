// Modular Settings, Themes & Network QR Controller
const SettingsManager = {
  allSettingItems: [],
  selectedQrIp: null,

  init() {
    this.allSettingItems = Array.from(document.querySelectorAll('.setting-item'));
    this.setupListeners();
    this.setupSvgUploader();
    this.loadMonitors();
    this.setupLanguageSelectors();
    this.setupThemeSelector();
    this.setupSoundToggle();
  },

  setupThemeSelector() {
    const savedTheme = localStorage.getItem('lan_remote_theme') || 'oled';
    this.applyTheme(savedTheme);

    const themeSelect = document.getElementById('settingThemeSelect');
    if (themeSelect) {
      themeSelect.value = savedTheme;
      themeSelect.addEventListener('change', (e) => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        this.applyTheme(e.target.value);
      });
    }
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lan_remote_theme', theme);
  },

  setupSoundToggle() {
    const soundToggle = document.getElementById('settingSoundToggle');
    const isEnabled = localStorage.getItem('lan_remote_sound') !== 'false';
    if (soundToggle) {
      soundToggle.checked = isEnabled;
      soundToggle.addEventListener('change', (e) => {
        const checked = e.target.checked;
        localStorage.setItem('lan_remote_sound', checked);
        if (window.SoundEffects) {
          window.SoundEffects.enabled = checked;
          if (checked) window.SoundEffects.playClick();
        }
      });
    }
  },

  setupLanguageSelectors() {
    document.querySelectorAll('.lang-selector-select').forEach(sel => {
      sel.value = I18n.currentLang;
      sel.addEventListener('change', (e) => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        I18n.setLanguage(e.target.value);
        if (window.DeckManager) window.DeckManager.renderDeck();
        if (window.StreamManager) window.StreamManager.renderMonitorPills();
        if (window.TaskManager) window.TaskManager.renderTable();
        this.renderNetworkInfo();
        App.showToast(I18n.t('settings_saved_toast'), 'success');
      });
    });
  },

  setupListeners() {
    const searchInput = document.getElementById('settingsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSettings(e.target.value);
      });
    }

    document.querySelectorAll('.setting-control select, .setting-control input').forEach(el => {
      if (el.classList.contains('lang-selector-select') || el.id === 'settingThemeSelect' || el.id === 'settingSoundToggle') return;
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

    if (cfg.stream) {
      this.setVal('settingStreamFps', cfg.stream.fps);
      this.setVal('settingStreamQuality', cfg.stream.quality);
      this.setVal('settingStreamScale', cfg.stream.scale);
      this.setVal('settingStreamMonitor', cfg.stream.monitor_index);
    }

    if (cfg.input) {
      this.setVal('settingInputMode', cfg.input.mode);
      this.setVal('settingCursorMode', cfg.input.cursor_mode || 'physical');
      this.setVal('settingInputSensitivity', cfg.input.sensitivity);
      this.setCheck('settingInputInvertScroll', cfg.input.invert_scroll);
      this.setVal('settingInputLongPress', cfg.input.long_press_ms);
      this.setCheck('settingInputHaptic', cfg.input.haptic_feedback);

      if (window.StreamManager) {
        window.StreamManager.inputMode = cfg.input.mode || 'trackpad';
        window.StreamManager.cursorMode = cfg.input.cursor_mode || 'physical';
        window.StreamManager.sensitivity = cfg.input.sensitivity || 1.3;
        window.StreamManager.invertScroll = !!cfg.input.invert_scroll;
        window.StreamManager.hapticFeedback = cfg.input.haptic_feedback !== false;
        window.StreamManager.updateCursorModeUI();
      }
    }

    if (cfg.deck) {
      this.setVal('settingDeckColumns', cfg.deck.grid_columns || 4);
    }

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
    const cursorModeVal = document.getElementById('settingCursorMode')?.value || 'physical';
    
    if (window.StreamManager) {
      window.StreamManager.cursorMode = cursorModeVal;
      localStorage.setItem('lan_remote_cursor_mode', cursorModeVal);
      window.StreamManager.updateCursorModeUI();
    }

    const payload = {
      stream: {
        fps: parseInt(document.getElementById('settingStreamFps')?.value || 30, 10),
        quality: parseInt(document.getElementById('settingStreamQuality')?.value || 65, 10),
        scale: parseFloat(document.getElementById('settingStreamScale')?.value || 0.75),
        monitor_index: parseInt(document.getElementById('settingStreamMonitor')?.value || 1, 10),
      },
      input: {
        mode: document.getElementById('settingInputMode')?.value || 'trackpad',
        cursor_mode: cursorModeVal,
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
      App.showToast(I18n.t('settings_saved_toast'), 'success');
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

    const interfaces = App.status.network_interfaces || App.status.local_ips.map(ip => ({ name: 'LAN', ip: ip }));
    const currentIp = this.selectedQrIp || (interfaces[0] ? interfaces[0].ip : '127.0.0.1');
    const primaryUrl = `http://${currentIp}:${port}`;

    if (typeof window.renderQRCodeSVG === 'function') {
      const qrCard = document.createElement('div');
      qrCard.className = 'qr-connection-card';
      qrCard.innerHTML = `
        <div class="qr-code-wrapper">
          ${window.renderQRCodeSVG(primaryUrl, 140)}
        </div>
        <div class="qr-info-content">
          <div style="font-size:0.88rem;font-weight:700;color:var(--text-main);">${I18n.t('qr_scan_hint')}</div>
          <div style="font-family:var(--font-mono);font-size:0.95rem;font-weight:700;color:var(--accent-blue);word-break:break-all;">${primaryUrl}</div>
          <div>
            <button class="btn-primary" style="padding:6px 14px;font-size:0.8rem;" onclick="navigator.clipboard.writeText('${primaryUrl}'); App.showToast(I18n.t('copied_toast'), 'success');">
              <img src="/icons/copy.svg" style="width:14px;height:14px;" alt=""> ${I18n.t('copy_btn')} URL
            </button>
          </div>
        </div>
      `;
      container.appendChild(qrCard);
    }

    const ipListTitle = document.createElement('div');
    ipListTitle.style.marginTop = '14px';
    ipListTitle.style.marginBottom = '6px';
    ipListTitle.style.fontSize = '0.82rem';
    ipListTitle.style.fontWeight = '600';
    ipListTitle.style.color = 'var(--text-muted)';
    ipListTitle.textContent = 'Active Network Interfaces (Click to generate QR code):';
    container.appendChild(ipListTitle);

    interfaces.forEach(iface => {
      const url = `http://${iface.ip}:${port}`;
      const isSelected = iface.ip === currentIp;

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.background = isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)';
      row.style.border = isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border)';
      row.style.padding = '8px 12px';
      row.style.borderRadius = 'var(--radius-md)';
      row.style.marginBottom = '6px';
      row.style.cursor = 'pointer';
      row.style.transition = 'all 0.15s ease';

      row.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:2px;">
          <span style="font-weight:700;font-size:0.8rem;color:${isSelected ? 'var(--accent-blue)' : 'var(--text-main)'};">${iface.name || 'LAN'}</span>
          <span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--text-muted);">${url}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="event.stopPropagation(); navigator.clipboard.writeText('${url}'); App.showToast(I18n.t('copied_toast'), 'success');">
            ${I18n.t('copy_btn')}
          </button>
        </div>
      `;

      row.addEventListener('click', () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        this.selectedQrIp = iface.ip;
        this.renderNetworkInfo();
      });

      container.appendChild(row);
    });
  }
};

window.SettingsManager = SettingsManager;
document.addEventListener('DOMContentLoaded', () => SettingsManager.init());
