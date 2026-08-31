// Global App Controller with i18n
const App = {
  activeTab: 'stream',
  config: {},
  status: {},

  init() {
    if (window.I18n) {
      window.I18n.applyTranslations();
    }

    this.setupTabs();
    this.setupGlobalSearch();
    this.registerServiceWorker();
    this.loadConfig();

    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.fetchStatus();
      }
    }, 2000);
    this.fetchStatus();
  },

  setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    if (tabId === 'stream' && window.StreamManager) {
      window.StreamManager.onTabVisible();
    } else if (tabId === 'deck' && window.DeckManager) {
      window.DeckManager.renderDeck();
    } else if (tabId === 'system' && window.SystemManager) {
      window.SystemManager.update();
    } else if (tabId === 'settings' && window.SettingsManager) {
      window.SettingsManager.renderNetworkInfo();
    }
  },

  setupGlobalSearch() {
    const searchInputs = [
      document.getElementById('headerSearchInput'),
      document.getElementById('settingsSearchInput')
    ];

    searchInputs.forEach(input => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        const query = e.target.value;
        if (this.activeTab !== 'settings') {
          this.switchTab('settings');
          const setInput = document.getElementById('settingsSearchInput');
          if (setInput) {
            setInput.value = query;
            setInput.focus();
          }
        }
        if (window.SettingsManager) {
          window.SettingsManager.filterSettings(query);
        }
      });
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        this.switchTab('settings');
        const setInput = document.getElementById('settingsSearchInput');
        if (setInput) {
          setInput.focus();
          setInput.select();
        }
      }
    });
  },

  async loadConfig() {
    try {
      const res = await fetch('/api/config');
      this.config = await res.json();
      if (window.SettingsManager) window.SettingsManager.applyConfigToUI(this.config);
      if (window.DeckManager) window.DeckManager.renderDeck();
    } catch (e) {
      console.error('Error loading config:', e);
    }
  },

  async fetchStatus() {
    try {
      const res = await fetch('/api/status');
      this.status = await res.json();

      const badge = document.getElementById('statusBadge');
      if (badge && this.status.stream) {
        badge.innerHTML = `<span class="status-dot"></span>${this.status.stream.real_fps} FPS | ${this.status.stream.last_frame_kb} KB`;
      }

      if (window.SystemManager) window.SystemManager.updateMetrics(this.status);
    } catch (e) {
      const badge = document.getElementById('statusBadge');
      if (badge) {
        const disconnectedText = window.I18n ? window.I18n.t('disconnected') : 'Disconnected';
        badge.innerHTML = `<span class="status-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444"></span>${disconnectedText}`;
      }
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
