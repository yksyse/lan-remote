// Windows 11 Style Task Manager Controller with GPU Dedicated Engine View
const TaskManager = {
  currentTab: 'procs', // 'procs' or 'gpu'
  processes: [],
  gpuData: null,
  sortBy: 'cpu',
  searchQuery: '',
  selectedPid: null,

  init() {
    this.setupListeners();
    this.setupSubTabs();
  },

  setupSubTabs() {
    document.querySelectorAll('.taskmgr-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        document.querySelectorAll('.taskmgr-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tasktab || 'procs';

        document.getElementById('taskMgrProcsView').style.display = this.currentTab === 'procs' ? 'block' : 'none';
        document.getElementById('taskMgrGpuView').style.display = this.currentTab === 'gpu' ? 'block' : 'none';

        if (this.currentTab === 'gpu') {
          this.fetchGpu();
        } else {
          this.fetchProcesses();
        }
      });
    });
  },

  setupListeners() {
    const searchInput = document.getElementById('taskMgrSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderTable();
      });
    }

    const sortSelect = document.getElementById('taskMgrSort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.fetchProcesses();
      });
    }

    const refreshBtn = document.getElementById('taskMgrRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (window.SoundEffects) window.SoundEffects.playClick();
        if (this.currentTab === 'gpu') this.fetchGpu();
        else this.fetchProcesses();
      });
    }

    const runTaskBtn = document.getElementById('taskMgrRunBtn');
    if (runTaskBtn) {
      runTaskBtn.addEventListener('click', () => this.promptRunTask());
    }
  },

  async fetchProcesses() {
    try {
      const res = await fetch(`/api/system/processes?sort=${this.sortBy}&search=${encodeURIComponent(this.searchQuery)}&limit=60`);
      this.processes = await res.json();
      this.renderTable();
    } catch (e) {}
  },

  async fetchGpu() {
    try {
      const res = await fetch('/api/system/gpu');
      this.gpuData = await res.json();
      this.renderGpuView();
    } catch (e) {}
  },

  renderGpuView() {
    const d = this.gpuData;
    if (!d) return;

    const nameEl = document.getElementById('gpuNameLabel');
    const tempEl = document.getElementById('gpuTempLabel');
    const usage3dEl = document.getElementById('gpu3dVal');
    const decodeEl = document.getElementById('gpuDecodeVal');
    const encodeEl = document.getElementById('gpuEncodeVal');
    const vramEl = document.getElementById('gpuVramVal');
    const vramSub = document.getElementById('gpuVramSub');

    if (nameEl) nameEl.textContent = d.name || 'GPU';
    if (tempEl) tempEl.textContent = `${d.temp || 0}°C`;
    if (usage3dEl) usage3dEl.textContent = `${d.usage_3d || 0}%`;
    if (decodeEl) decodeEl.textContent = `${d.usage_decode || 0}%`;
    if (encodeEl) encodeEl.textContent = `${d.usage_encode || 0}%`;
    if (vramEl) vramEl.textContent = `${d.mem_percent || 0}%`;
    if (vramSub) vramSub.textContent = `${d.mem_used_mb || 0} MB / ${d.mem_total_mb || 0} MB`;

    // Draw 3D Engine Sparkline
    if (d.history && window.SystemManager) {
      window.SystemManager.drawSparkline('gpuSparkline', d.history, '#8b5cf6');
    }
  },

  renderTable() {
    const tbody = document.getElementById('taskMgrTableBody');
    const countEl = document.getElementById('taskMgrCount');
    if (!tbody) return;

    if (countEl) countEl.textContent = `${this.processes.length} ${I18n.t('tasks_running') || 'tasks'}`;

    tbody.innerHTML = '';
    if (this.processes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-dim);">${I18n.t('no_processes_found') || 'No processes found'}</td></tr>`;
      return;
    }

    this.processes.forEach(proc => {
      const tr = document.createElement('tr');
      tr.className = 'taskmgr-row';
      if (proc.pid === this.selectedPid) tr.classList.add('selected');

      const cpuColor = proc.cpu_percent > 20 ? 'var(--accent-red)' : (proc.cpu_percent > 5 ? 'var(--accent-yellow)' : 'var(--text-main)');
      const memColor = proc.mem_mb > 1000 ? 'var(--accent-yellow)' : 'var(--text-main)';

      tr.innerHTML = `
        <td style="font-weight:600;display:flex;align-items:center;gap:6px;">
          <img src="/icons/activity.svg" style="width:14px;height:14px;opacity:0.7;" alt="">
          <span>${proc.name}</span>
        </td>
        <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);">${proc.pid}</td>
        <td style="font-family:var(--font-mono);font-weight:600;color:${cpuColor};">${proc.cpu_percent}%</td>
        <td style="font-family:var(--font-mono);color:${memColor};">${proc.mem_mb} MB</td>
        <td style="font-size:0.75rem;color:var(--text-muted);">${proc.username || 'System'}</td>
        <td style="text-align:right;">
          <button class="btn-action-kill" title="${I18n.t('end_task_btn') || 'End Task'}" onclick="TaskManager.killProcess(${proc.pid}, '${proc.name}')">
            ${I18n.t('end_task_btn') || 'End Task'}
          </button>
          <select class="priority-mini-select" onchange="TaskManager.setPriority(${proc.pid}, this.value)" title="${I18n.t('priority_label') || 'Priority'}">
            <option value="normal" selected>Normal</option>
            <option value="high">High</option>
            <option value="idle">Low</option>
            <option value="realtime">Realtime</option>
          </select>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
        this.selectedPid = proc.pid;
        document.querySelectorAll('.taskmgr-row').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });

      tbody.appendChild(tr);
    });
  },

  async killProcess(pid, name) {
    if (window.SoundEffects) window.SoundEffects.playClick();
    try {
      const res = await fetch('/api/system/processes/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: pid, tree: false })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        App.showToast(`${I18n.t('task_terminated') || 'Terminated'}: ${name} (${pid})`, 'info');
        if (window.SoundEffects) window.SoundEffects.playSuccess();
        this.fetchProcesses();
      } else {
        App.showToast(`Error: ${data.detail || 'Access denied'}`, 'error');
      }
    } catch (e) {
      App.showToast('Failed to kill process', 'error');
    }
  },

  async setPriority(pid, priority) {
    try {
      const res = await fetch('/api/system/processes/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: pid, priority: priority })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        App.showToast(`Priority -> ${priority.toUpperCase()}`, 'info');
        if (window.SoundEffects) window.SoundEffects.playSuccess();
      } else {
        App.showToast(`Error: ${data.detail}`, 'error');
      }
    } catch (e) {
      App.showToast('Error setting priority', 'error');
    }
  },

  async promptRunTask() {
    const cmd = prompt(I18n.t('run_task_prompt') || 'Enter executable name or shell command (e.g. notepad.exe, cmd.exe, calc):');
    if (!cmd) return;

    try {
      const res = await fetch('/api/system/processes/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      App.showToast(`Launched: ${cmd}`, 'success');
      if (window.SoundEffects) window.SoundEffects.playSuccess();
      setTimeout(() => this.fetchProcesses(), 1000);
    } catch (e) {
      App.showToast('Error launching task', 'error');
    }
  }
};

window.TaskManager = TaskManager;
document.addEventListener('DOMContentLoaded', () => TaskManager.init());
