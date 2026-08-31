// Global App Controller with Smart Toaster & i18n
const App = {
  activeTab: 'stream',
  config: {},
  status: {},
  lastToast: { message: '', element: null, count: 1, timer: null },

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

    const isMobile = window.innerWidth <= 768;
    const maxToasts = isMobile ? 3 : 5;

    // 1. If repeating the exact same action rapidly, group it (e.g. Volume Down x4)
    if (this.lastToast.message === message && this.lastToast.element && document.body.contains(this.lastToast.element)) {
      this.lastToast.count++;
      clearTimeout(this.lastToast.timer);
      this.lastToast.element.textContent = `${message} (x${this.lastToast.count})`;
      this.lastToast.element.style.animation = 'none';
      void this.lastToast.element.offsetWidth; // trigger reflow
      this.lastToast.element.style.animation = 'toastPulse 0.15s ease';

      this.lastToast.timer = setTimeout(() => {
        this.dismissToast(this.lastToast.element);
      }, 2000);
      return;
    }

    // 2. Limit maximum visible toasts (max 5 on PC, max 3 on mobile)
    while (container.children.length >= maxToasts) {
      this.dismissToast(container.firstElementChild, true);
    }

    // 3. Create fresh toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    const timer = setTimeout(() => {
      this.dismissToast(toast);
    }, 2500);

    this.lastToast = {
      message: message,
      element: toast,
      count: 1,
      timer: timer
    };
  },

  dismissToast(toastEl, immediate = false) {
    if (!toastEl || !toastEl.parentNode) return;
    if (immediate) {
      toastEl.remove();
      return;
    }
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(20px)';
    toastEl.style.transition = 'all 0.2s ease';
    setTimeout(() => {
      if (toastEl.parentNode) toastEl.remove();
    }, 200);
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
