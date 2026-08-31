// Touch Deck & Macro Grid Controller
const DeckManager = {
  cards: [],
  gridColumns: 4,
  availableIcons: [],
  editingCardId: null,

  init() {
    this.setupModal();
    this.loadIcons();
  },

  async loadIcons() {
    try {
      const res = await fetch('/api/icons');
      this.availableIcons = await res.json();
    } catch (e) {
      console.error('Error fetching icons:', e);
    }
  },

  renderDeck() {
    const grid = document.getElementById('deckGrid');
    if (!grid) return;

    this.cards = App.config?.deck?.cards || [];
    this.gridColumns = App.config?.deck?.grid_columns || 4;

    grid.innerHTML = '';

    this.cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'deck-card';
      el.dataset.id = card.id;

      // Color accent glow
      const color = card.color || '#3b82f6';
      el.style.borderColor = `${color}40`;

      el.innerHTML = `
        <div class="deck-card-icon" style="background-color: ${color}20; color: ${color};">
          <img src="/icons/${card.icon}.svg" alt="${card.title}" onerror="this.src='/icons/desktop.svg'" />
        </div>
        <div class="deck-card-title">${card.title}</div>
        <div class="deck-card-type">${card.type}</div>
        <button class="deck-card-edit-btn" title="Edit Card" onclick="event.stopPropagation(); DeckManager.openEditModal('${card.id}')">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
      `;

      el.addEventListener('click', () => this.triggerCard(card.id));
      grid.appendChild(el);
    });
  },

  async triggerCard(cardId) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(20); } catch(e) {}
    }

    try {
      const res = await fetch(`/api/deck/trigger/${cardId}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        const card = this.cards.find(c => c.id === cardId);
        App.showToast(`Executed: ${card ? card.title : cardId}`, 'success');
      } else {
        App.showToast(`Error: ${data.message || 'Failed to trigger'}`, 'error');
      }
    } catch (e) {
      App.showToast(`Network error triggering card`, 'error');
    }
  },

  setupModal() {
    const addBtn = document.getElementById('addDeckCardBtn');
    const modal = document.getElementById('deckCardModal');
    const closeBtn = document.getElementById('closeDeckModalBtn');
    const saveBtn = document.getElementById('saveDeckCardBtn');
    const deleteBtn = document.getElementById('deleteDeckCardBtn');

    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddModal());
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteCurrentCard());
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveCurrentCard());
    }

    // Type change listener to adapt payload fields
    const typeSelect = document.getElementById('modalCardType');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => this.updatePayloadFields());
    }
  },

  openAddModal() {
    this.editingCardId = null;
    document.getElementById('modalCardTitle').value = '';
    document.getElementById('modalCardType').value = 'shortcut';
    document.getElementById('modalCardColor').value = '#3b82f6';
    document.getElementById('modalCardPayload').value = 'win+d';
    document.getElementById('deleteDeckCardBtn').style.display = 'none';
    this.renderIconPicker('desktop');
    this.updatePayloadFields();

    document.getElementById('deckCardModal').classList.add('active');
  },

  openEditModal(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    this.editingCardId = cardId;
    document.getElementById('modalCardTitle').value = card.title;
    document.getElementById('modalCardType').value = card.type;
    document.getElementById('modalCardColor').value = card.color || '#3b82f6';
    document.getElementById('deleteDeckCardBtn').style.display = 'block';

    let payloadStr = '';
    if (card.type === 'shortcut') payloadStr = (card.payload?.keys || []).join('+');
    else if (card.type === 'command') payloadStr = card.payload?.command || '';
    else payloadStr = card.payload?.action || '';

    document.getElementById('modalCardPayload').value = payloadStr;
    this.renderIconPicker(card.icon || 'desktop');
    this.updatePayloadFields();

    document.getElementById('deckCardModal').classList.add('active');
  },

  renderIconPicker(selectedIcon) {
    const picker = document.getElementById('modalIconPicker');
    if (!picker) return;

    picker.innerHTML = '';
    this.availableIcons.forEach(ic => {
      const item = document.createElement('div');
      item.className = `svg-icon-preview ${ic.name === selectedIcon ? 'selected' : ''}`;
      item.dataset.icon = ic.name;
      item.innerHTML = `<img src="${ic.url}" alt="${ic.name}" /><span style="font-size:0.6rem;margin-top:2px;">${ic.name}</span>`;

      item.addEventListener('click', () => {
        picker.querySelectorAll('.svg-icon-preview').forEach(p => p.classList.remove('selected'));
        item.classList.add('selected');
      });

      grid = picker.appendChild(item);
    });
  },

  updatePayloadFields() {
    const type = document.getElementById('modalCardType').value;
    const label = document.getElementById('modalPayloadLabel');
    const input = document.getElementById('modalCardPayload');

    if (type === 'shortcut') {
      label.textContent = 'Shortcut Keys (e.g. ctrl+shift+esc, win+d, alt+tab):';
      if (!input.value) input.value = 'ctrl+c';
    } else if (type === 'command') {
      label.textContent = 'Shell Command (e.g. notepad.exe, wt.exe):';
      if (!input.value) input.value = 'notepad.exe';
    } else if (type === 'media') {
      label.textContent = 'Media Action (play_pause, vol_up, vol_down, next, prev):';
      if (!input.value) input.value = 'play_pause';
    } else if (type === 'power') {
      label.textContent = 'Power Action (lock, sleep, screen_off, restart, shutdown):';
      if (!input.value) input.value = 'lock';
    } else if (type === 'system') {
      label.textContent = 'System Action (toggle_mute):';
      if (!input.value) input.value = 'toggle_mute';
    }
  },

  async saveCurrentCard() {
    const title = document.getElementById('modalCardTitle').value.trim();
    const type = document.getElementById('modalCardType').value;
    const color = document.getElementById('modalCardColor').value;
    const rawPayload = document.getElementById('modalCardPayload').value.trim();

    const selectedIconEl = document.querySelector('#modalIconPicker .svg-icon-preview.selected');
    const icon = selectedIconEl ? selectedIconEl.dataset.icon : 'desktop';

    if (!title) {
      App.showToast('Please enter a title', 'error');
      return;
    }

    let payload = {};
    if (type === 'shortcut') {
      payload = { keys: rawPayload.split('+').map(k => k.trim().toLowerCase()) };
    } else if (type === 'command') {
      payload = { command: rawPayload };
    } else {
      payload = { action: rawPayload };
    }

    const cardData = {
      id: this.editingCardId || '',
      title,
      type,
      color,
      icon,
      payload
    };

    try {
      const res = await fetch('/api/deck/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData)
      });
      const data = await res.json();
      if (data.status === 'ok') {
        document.getElementById('deckCardModal').classList.remove('active');
        await App.loadConfig();
        this.renderDeck();
        App.showToast('Card saved', 'success');
      }
    } catch (e) {
      App.showToast('Error saving card', 'error');
    }
  },

  async deleteCurrentCard() {
    if (!this.editingCardId) return;

    try {
      const res = await fetch(`/api/deck/card/${this.editingCardId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'ok') {
        document.getElementById('deckCardModal').classList.remove('active');
        await App.loadConfig();
        this.renderDeck();
        App.showToast('Card deleted', 'info');
      }
    } catch (e) {
      App.showToast('Error deleting card', 'error');
    }
  }
};

window.DeckManager = DeckManager;
document.addEventListener('DOMContentLoaded', () => {
  DeckManager.init();
});
