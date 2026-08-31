// Hi-Fi Tactile Radial Rotary Volume Knob
const VolumeKnob = {
  container: null,
  value: 50,
  isDragging: false,
  startAngle: 0,
  startVal: 50,
  lastTickVal: 50,

  init() {
    this.container = document.getElementById('radialVolumeKnob');
    if (!this.container) return;
    this.render();
    this.setupEvents();
  },

  render() {
    if (!this.container) return;
    const val = Math.max(0, Math.min(100, this.value));
    // 270 degree sweep (-135deg to +135deg)
    const angle = -135 + (val / 100) * 270;
    const radians = (angle - 90) * (Math.PI / 180);
    const radius = 38;
    const cx = 55, cy = 55;
    const dotX = cx + radius * Math.cos(radians);
    const dotY = cy + radius * Math.sin(radians);

    // Calculate circular arc path
    const arcRadius = 42;
    const startArcAngle = -225 * (Math.PI / 180);
    const endArcAngle = (-225 + (val / 100) * 270) * (Math.PI / 180);

    const x1 = cx + arcRadius * Math.cos(startArcAngle);
    const y1 = cy + arcRadius * Math.sin(startArcAngle);
    const x2 = cx + arcRadius * Math.cos(endArcAngle);
    const y2 = cy + arcRadius * Math.sin(endArcAngle);
    const largeArc = (val / 100) * 270 > 180 ? 1 : 0;

    const pathData = val > 0 
      ? `M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${x2} ${y2}`
      : '';

    this.container.innerHTML = `
      <svg viewBox="0 0 110 110" class="knob-svg">
        <!-- Track Background Arc -->
        <path d="M 25.3 84.7 A 42 42 0 1 1 84.7 84.7" fill="none" stroke="var(--bg-tertiary)" stroke-width="6" stroke-linecap="round" />
        
        <!-- Active Volume Arc -->
        ${pathData ? `<path d="${pathData}" fill="none" stroke="var(--accent-blue)" stroke-width="6" stroke-linecap="round" />` : ''}
        
        <!-- Knob Body -->
        <circle cx="${cx}" cy="${cy}" r="34" fill="var(--bg-card)" stroke="var(--border)" stroke-width="2" />
        <circle cx="${cx}" cy="${cy}" r="28" fill="var(--bg-secondary)" />
        
        <!-- Pointer Dot -->
        <circle cx="${dotX}" cy="${dotY}" r="4" fill="var(--accent-blue)" filter="drop-shadow(0 0 4px #3b82f6)" />
        
        <!-- Value Label -->
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="var(--font-mono)" font-size="14" font-weight="700" fill="var(--text-main)">${val}%</text>
      </svg>
    `;
  },

  setupEvents() {
    if (!this.container) return;

    const getAngle = (clientX, clientY) => {
      const rect = this.container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const deg = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
      // Map atan2 to [0, 360] starting from 135deg (bottom-left)
      let adjusted = (deg + 225) % 360;
      if (adjusted > 270) adjusted = adjusted > 315 ? 0 : 270;
      return Math.max(0, Math.min(270, adjusted));
    };

    const updateValFromAngle = (clientX, clientY, commit = false) => {
      const arc = getAngle(clientX, clientY);
      const newVal = Math.round((arc / 270) * 100);
      
      if (Math.abs(newVal - this.lastTickVal) >= 4) {
        if (window.SoundEffects) window.SoundEffects.playTick();
        this.lastTickVal = newVal;
      }

      this.value = newVal;
      this.render();

      // Sync slider and labels
      const slider = document.getElementById('sysVolumeSlider');
      const label = document.getElementById('sysVolumeLabel');
      if (slider) slider.value = newVal;
      if (label) label.textContent = `${newVal}%`;

      if (commit) {
        this.commitVolume();
      }
    };

    // Mouse Events
    this.container.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      if (window.SystemManager) window.SystemManager.isUpdatingVolume = true;
      updateValFromAngle(e.clientX, e.clientY);

      const onMove = (me) => {
        if (this.isDragging) updateValFromAngle(me.clientX, me.clientY);
      };

      const onUp = (ue) => {
        if (this.isDragging) {
          this.isDragging = false;
          if (window.SystemManager) window.SystemManager.isUpdatingVolume = false;
          updateValFromAngle(ue.clientX, ue.clientY, true);
        }
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    // Touch Events
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        if (window.SystemManager) window.SystemManager.isUpdatingVolume = true;
        updateValFromAngle(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        updateValFromAngle(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.container.addEventListener('touchend', () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (window.SystemManager) window.SystemManager.isUpdatingVolume = false;
        this.commitVolume();
      }
    });
  },

  setValue(val) {
    if (!this.isDragging && val !== undefined) {
      this.value = val;
      this.render();
    }
  },

  async commitVolume() {
    try {
      await fetch('/api/system/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: this.value })
      });
    } catch (e) {}
  }
};

window.VolumeKnob = VolumeKnob;
document.addEventListener('DOMContentLoaded', () => VolumeKnob.init());
