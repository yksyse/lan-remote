// LAN Remote High-Speed File Explorer Controller
const FileManager = {
  currentPath: '',
  items: [],
  drives: [],

  init() {
    this.setupListeners();
  },

  async loadPath(path = null) {
    try {
      const url = path ? `/api/fs/list?path=${encodeURIComponent(path)}` : '/api/fs/list';
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'ok') {
        this.currentPath = data.current_path;
        this.items = data.items || [];
        this.drives = data.drives || [];
        this.render();
      }
    } catch (e) {}
  },

  render() {
    const drivesContainer = document.getElementById('fsDrivesRow');
    const pathLabel = document.getElementById('fsCurrentPathLabel');
    const listContainer = document.getElementById('fsItemsList');

    if (pathLabel) pathLabel.textContent = this.currentPath || 'Root';

    if (drivesContainer && this.drives) {
      drivesContainer.innerHTML = '';
      this.drives.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'fs-drive-btn';
        btn.innerHTML = `<span>${d.label}</span>`;
        btn.onclick = () => this.loadPath(d.path);
        drivesContainer.appendChild(btn);
      });
    }

    if (listContainer) {
      listContainer.innerHTML = '';
      if (this.items.length === 0) {
        listContainer.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:0.8rem;">Empty folder</div>`;
        return;
      }

      this.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'fs-item-row';
        const iconSrc = item.is_dir ? '/icons/folder.svg' : '/icons/desktop.svg';

        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;flex:1;overflow:hidden;">
            <img src="${iconSrc}" style="width:16px;height:16px;opacity:0.8;" alt="">
            <span style="font-weight:${item.is_dir ? '700' : '400'};text-overflow:ellipsis;white-space:nowrap;overflow:hidden;">${item.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim);">${item.size || ''}</span>
            ${!item.is_dir ? `<a href="/api/fs/download?path=${encodeURIComponent(item.path)}" target="_blank" class="btn-secondary" style="padding:2px 8px;font-size:0.72rem;text-decoration:none;">⬇</a>` : ''}
          </div>
        `;

        row.onclick = (e) => {
          if (e.target.tagName === 'A' || e.target.closest('a')) return;
          if (item.is_dir) {
            if (window.SoundEffects) window.SoundEffects.playClick();
            this.loadPath(item.path);
          }
        };

        listContainer.appendChild(row);
      });
    }
  },

  setupListeners() {
    const refreshBtn = document.getElementById('fsRefreshBtn');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.loadPath(this.currentPath);
    }

    const upBtn = document.getElementById('fsUpBtn');
    if (upBtn) {
      upBtn.onclick = () => {
        if (!this.currentPath) return;
        const parent = this.currentPath.split('\\').slice(0, -1).join('\\');
        this.loadPath(parent || 'C:\\');
      };
    }

    const uploadInput = document.getElementById('fsUploadInput');
    const uploadBtn = document.getElementById('fsUploadBtn');

    if (uploadBtn && uploadInput) {
      uploadBtn.onclick = () => uploadInput.click();
      uploadInput.onchange = async () => {
        const file = uploadInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
          App.showToast(`Uploading ${file.name}...`, 'info');
          const res = await fetch(`/api/fs/upload?target_dir=${encodeURIComponent(this.currentPath)}`, {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.status === 'ok') {
            App.showToast(`Uploaded: ${file.name}`, 'success');
            if (window.SoundEffects) window.SoundEffects.playSuccess();
            this.loadPath(this.currentPath);
          }
        } catch (e) {
          App.showToast('Upload error', 'error');
        }
      };
    }
  }
};

window.FileManager = FileManager;
document.addEventListener('DOMContentLoaded', () => FileManager.init());
