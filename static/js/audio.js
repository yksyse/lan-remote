// Real-Time Web Audio PCM Stream Receiver & Low-Latency Host Sound Output
const HostAudioPlayer = {
  ws: null,
  audioCtx: null,
  gainNode: null,
  isPlaying: false,
  isMuted: false,
  sampleRate: 48000,
  channels: 2,
  nextPlayTime: 0,
  volume: 1.0,

  init() {
    this.setupUI();
  },

  setupUI() {
    const btn = document.getElementById('toggleAudioStreamBtn');
    if (!btn) return;

    btn.addEventListener('click', () => this.toggleAudio());
  },

  async toggleAudio() {
    if (this.isPlaying) {
      this.stop();
      App.showToast('Звук с ПК отключён', 'info');
    } else {
      await this.start();
      App.showToast('Звук с ПК включён (Live WASAPI)', 'success');
    }
  },

  async start() {
    if (this.isPlaying) return;

    // Initialize Web Audio Context on user interaction (required by mobile browsers)
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass({ latencyHint: 'interactive' });
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
      this.gainNode.connect(this.audioCtx.destination);
      this.nextPlayTime = this.audioCtx.currentTime + 0.04; // 40ms initial buffer

      this.connectWS();
      this.isPlaying = true;
      this.updateButtonUI();
    } catch (e) {
      console.error('Audio initialization error:', e);
      App.showToast('Ошибка инициализации аудио', 'error');
    }
  },

  stop() {
    this.isPlaying = false;
    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
      this.ws = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.suspend(); } catch(e) {}
    }
    this.updateButtonUI();
  },

  connectWS() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/audio`;

    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
    }

    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'audio_config') {
            this.sampleRate = msg.sample_rate || 48000;
            this.channels = msg.channels || 2;
          }
        } catch (e) {}
        return;
      }

      // Handle raw PCM16 binary data
      if (event.data instanceof ArrayBuffer && this.isPlaying && this.audioCtx) {
        this.playPCMChunk(event.data);
      }
    };

    this.ws.onclose = () => {
      if (this.isPlaying) {
        setTimeout(() => {
          if (this.isPlaying) this.connectWS();
        }, 2000);
      }
    };
  },

  playPCMChunk(arrayBuffer) {
    if (!this.audioCtx || this.audioCtx.state === 'closed') return;

    try {
      const int16 = new Int16Array(arrayBuffer);
      const numFrames = int16.length / this.channels;
      if (numFrames <= 0) return;

      const audioBuffer = this.audioCtx.createBuffer(this.channels, numFrames, this.sampleRate);

      if (this.channels === 2) {
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        for (let i = 0; i < numFrames; i++) {
          leftChannel[i] = int16[i * 2] / 32768.0;
          rightChannel[i] = int16[i * 2 + 1] / 32768.0;
        }
      } else {
        const monoChannel = audioBuffer.getChannelData(0);
        for (let i = 0; i < numFrames; i++) {
          monoChannel[i] = int16[i] / 32768.0;
        }
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      // Low-latency drift & jitter compensation
      const curTime = this.audioCtx.currentTime;
      if (this.nextPlayTime < curTime || this.nextPlayTime > curTime + 0.3) {
        this.nextPlayTime = curTime + 0.035; // Resync
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;

    } catch (e) {
      console.error('Audio chunk playback error:', e);
    }
  },

  updateButtonUI() {
    const btn = document.getElementById('toggleAudioStreamBtn');
    if (!btn) return;

    btn.classList.toggle('active', this.isPlaying);
    btn.classList.toggle('audio-active', this.isPlaying);
    const img = btn.querySelector('img');
    if (img) {
      img.src = this.isPlaying ? '/icons/volume_up.svg' : '/icons/volume_x.svg';
    }
    btn.title = this.isPlaying ? 'Отключить звук ПК' : 'Включить звук с ПК на телефон';
  }
};

window.HostAudioPlayer = HostAudioPlayer;
document.addEventListener('DOMContentLoaded', () => {
  HostAudioPlayer.init();
});
