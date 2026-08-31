// Touch Deck with Profiles (Media, Server, Gaming, All) & Sound Feedback
const DeckManager = {
  icons: [],
  selectedCardId: null,
  selectedIconName: 'play',
  activeProfile: 'all',

  init() {
    this.loadIcons();
    this.setupListeners();
    this.setupProfileFilter();
  },

  async loadIcons() {
    try {
      const res = await fetch('/api/icons');
      this.icons = await res.json();
      this.renderIconPicker();
    } catch (e) {}
  },

  setupProfileFilter() {
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeProfile = btn.dataset.profile || 'all';
        this.renderDeck();
      });
    });
  },

  renderIconPicker() {
    const picker = document.getElementById('modalIconPicker');
    if (!picker) return;

    picker.innerHTML = '';
    this.icons.forEach(ic => {
      const item = document.createElement('div');
      item.className = `svg-icon-preview ${ic.name === this.selectedIconName ? 'selected' : ''}`;
      item.innerHTML = `<img src="${ic.url}" alt="${ic.name}" />`;
      item.addEventListener('click', () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        picker.querySelectorAll('.svg-icon-preview').forEach(p => p.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedIconName = ic.name;
      });
      picker.appendChild(item);
    });
  },

  renderDeck() {
    const grid = document.getElementById('deckGrid');
    if (!grid || !App.config?.deck) return;

    let cards = App.config.deck.cards || [];
    
    // Filter by Active Profile
    if (this.activeProfile !== 'all') {
      cards = cards.filter(c => {
        const cardProf = (c.profile || 'all').toLowerCase();
        if (cardProf === this.activeProfile) return true;
        // Automatic category fallback if profile is not set
        if (!c.profile || c.profile === 'all') {
          if (this.activeProfile === 'media' && (c.type === 'media' || c.icon.includes('volume') || c.icon.includes('play'))) return true;
          if (this.activeProfile === 'server' && (c.type === 'power' || c.type === 'command' || c.icon.includes('activity') || c.icon.includes('terminal'))) return true;
          if (this.activeProfile === 'gaming' && (c.icon.includes('mic') || c.icon.includes('video'))) return true;
        }
        return false;
      });
    }

    grid.innerHTML = '';
    if (cards.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:30px; color:var(--text-dim);">${I18n.t('no_cards_in_profile') || 'No action buttons in this profile'}</div>`;
      return;
    }

    cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'deck-card';
      cardEl.style.borderColor = `${card.color}40`;

      cardEl.innerHTML = `
        <div class="deck-card-icon" style="background-color:${card.color}20;color:${card.color};">
          <img src="/icons/${card.icon}.svg" onerror="this.src='/icons/play.svg'" alt="${card.title}" />
        </div>
        <div class="deck-card-title">${card.title}</div>
        <div class="deck-card-type">${I18n.t(`card_type_${card.type}`) || card.type}</div>
        <button class="deck-card-edit-btn" title="${I18n.t('edit_card_btn')}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
      `;

      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.deck-card-edit-btn')) {
          e.stopPropagation();
          this.openEditModal(card);
        } else {
          this.triggerCard(card);
        }
      });

      grid.appendChild(cardEl);
    });
  },

  async triggerCard(card) {
    try {
      if (window.SoundEffects) window.SoundEffects.playClick();
      if (window.StreamManager) window.StreamManager.vibrate(25);

      const res = await fetch(`/api/deck/trigger/${card.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        App.showToast(`Action: ${card.title}`, 'info');
      }
    } catch (e) {
      App.showToast(`Error running: ${card.title}`, 'error');
    }
  },

  setupListeners() {
    const addBtn = document.getElementById('addDeckCardBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddModal());
    }

    const closeBtn = document.getElementById('closeDeckModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    const saveBtn = document.getElementById('saveDeckCardBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveCardFromModal());
    }

    const delBtn = document.getElementById('deleteDeckCardBtn');
    if (delBtn) {
      delBtn.addEventListener('click', () => this.deleteCard());
    }

    const typeSelect = document.getElementById('modalCardType');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => this.updatePayloadLabel());
    }
  },

  updatePayloadLabel() {
    const type = document.getElementById('modalCardType')?.value;
    const label = document.getElementById('modalPayloadLabel');
    const input = document.getElementById('modalCardPayload');
    if (!label || !input) return;

    if (type === 'shortcut') {
      label.textContent = 'Shortcut Combo (e.g. win+d, ctrl+shift+esc)';
      input.placeholder = 'ctrl+c';
    } else if (type === 'command') {
      label.textContent = 'Shell Command or App Path';
      input.placeholder = 'calc.exe';
    } else if (type === 'media') {
      label.textContent = 'Media Action (play_pause, next, prev, vol_up, vol_down)';
      input.placeholder = 'play_pause';
    } else if (type === 'power') {
      label.textContent = 'Power Action (lock, screen_off, sleep, restart, shutdown)';
      input.placeholder = 'lock';
    } else {
      label.textContent = 'System Action';
      input.placeholder = 'toggle_mute';
    }
  },

  openAddModal() {
    this.selectedCardId = null;
    this.selectedIconName = 'play';
    document.getElementById('modalCardTitle').value = '';
    document.getElementById('modalCardType').value = 'shortcut';
    document.getElementById('modalCardPayload').value = '';
    document.getElementById('modalCardColor').value = '#3b82f6';
    document.getElementById('modalCardProfile').value = this.activeProfile !== 'all' ? this.activeProfile : 'all';
    document.getElementById('deleteDeckCardBtn').style.display = 'none';

    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = I18n.t('modal_add_title');

    this.updatePayloadLabel();
    this.renderIconPicker();
    document.getElementById('deckCardModal').classList.add('active');
  },

  openEditModal(card) {
    this.selectedCardId = card.id;
    this.selectedIconName = card.icon || 'play';
    document.getElementById('modalCardTitle').value = card.title;
    document.getElementById('modalCardType').value = card.type;
    document.getElementById('modalCardColor').value = card.color || '#3b82f6';
    document.getElementById('modalCardProfile').value = card.profile || 'all';
    document.getElementById('deleteDeckCardBtn').style.display = 'block';

    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = I18n.t('modal_edit_title');

    const input = document.getElementById('modalCardPayload');
    if (card.type === 'shortcut') {
      input.value = (card.payload?.keys || []).join('+');
    } else if (card.type === 'command') {
      input.value = card.payload?.command || '';
    } else if (card.type === 'media' || card.type === 'power' || card.type === 'system') {
      input.value = card.payload?.action || '';
    }

    this.updatePayloadLabel();
    this.renderIconPicker();
    document.getElementById('deckCardModal').classList.add('active');
  },

  closeModal() {
    document.getElementById('deckCardModal').classList.remove('active');
  },

  async saveCardFromModal() {
    const title = document.getElementById('modalCardTitle').value.trim();
    const type = document.getElementById('modalCardType').value;
    const color = document.getElementById('modalCardColor').value;
    const profile = document.getElementById('modalCardProfile').value || 'all';
    const rawPayload = document.getElementById('modalCardPayload').value.trim();

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
      id: this.selectedCardId,
      title: title,
      icon: this.selectedIconName,
      color: color,
      profile: profile,
      type: type,
      payload: payload
    };

    try {
      await fetch('/api/deck/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData)
      });
      this.closeModal();
      await App.loadConfig();
      App.showToast(I18n.t('card_saved_toast'), 'success');
      if (window.SoundEffects) window.SoundEffects.playSuccess();
    } catch (e) {
      App.showToast('Error saving card', 'error');
    }
  },

  async deleteCard() {
    if (!this.selectedCardId) return;

    try {
      await fetch(`/api/deck/card/${this.selectedCardId}`, { method: 'DELETE' });
      this.closeModal();
      await App.loadConfig();
      App.showToast(I18n.t('card_deleted_toast'), 'info');
      if (window.SoundEffects) window.SoundEffects.playSuccess();
    } catch (e) {
      App.showToast('Error deleting card', 'error');
    }
  }
};

window.DeckManager = DeckManager;
document.addEventListener('DOMContentLoaded', () => DeckManager.init());
