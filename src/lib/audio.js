// Procedural trading-floor audio — no external files.
// Continuous market-room ambience (murmur, keyboard clicks, floor activity)
// + squawk jingle on breaking news, RFQ ping, fill confirmation and risk alerts.

class MarketAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambience = null;
    this.noiseBuffer = null;
    this.enabled = false;
    this.muted = false;
    this.volume = 0.55;
    this.started = false;
    this.timers = [];
    this.clicks = null;
  }

  get supported() {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
  }

  ensure() {
    if (!this.supported) return null;
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume * 0.85;
    this.master.connect(this.ctx.destination);
    this.buildNoise();
    return this.ctx;
  }

  buildNoise() {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2 * 0.6 + white * 0.18;
    }
    this.noiseBuffer = buf;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0));
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.85, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.85, this.ctx.currentTime, 0.04);
    }
  }

  async enable() {
    const ctx = this.ensure();
    if (!ctx) return false;
    try { if (ctx.state === 'suspended') await ctx.resume(); } catch { /* ignore */ }
    this.enabled = true;
    this.setMuted(this.muted);
    if (!this.started) {
      this.started = true;
      this.startAmbience();
    }
    return true;
  }

  disable() {
    this.enabled = false;
    this.stopAmbience();
  }

  startAmbience() {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || this.ambience) return;

    const group = ctx.createGain();
    group.gain.value = 1;
    group.connect(this.master);
    this.ambience = group;

    // 1. Deep room rumble
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noiseBuffer;
    rumble.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 150;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.055;
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(group);
    rumble.start();

    // 2. Filtered office murmur
    const murmur = ctx.createBufferSource();
    murmur.buffer = this.noiseBuffer;
    murmur.loop = true;
    murmur.playbackRate.value = 0.85;
    const mFilter = ctx.createBiquadFilter();
    mFilter.type = 'bandpass';
    mFilter.frequency.value = 520;
    mFilter.Q.value = 0.8;
    const mGain = ctx.createGain();
    mGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(mGain.gain);
    murmur.connect(mFilter).connect(mGain).connect(group);
    lfo.start();
    murmur.start();

    // 3. Air / HF hiss
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer;
    air.loop = true;
    air.playbackRate.value = 1.6;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'highpass';
    airFilter.frequency.value = 2400;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.008;
    air.connect(airFilter).connect(airGain).connect(group);
    air.start();

    this.ambienceNodes = { rumble, murmur, air, lfo };

    // 4. Sparse keyboard clicks / mouse / paper
    const clickLoop = () => {
      if (!this.started) return;
      this.keyboardClick();
      this.clicks = setTimeout(clickLoop, 140 + Math.random() * 380);
    };
    this.clicks = setTimeout(clickLoop, 300);

    // 5. Distant floor chatter bursts
    const chatterLoop = () => {
      if (!this.started) return;
      this.floorChatter();
      this.ambienceChatter = setTimeout(chatterLoop, 2600 + Math.random() * 5200);
    };
    this.ambienceChatter = setTimeout(chatterLoop, 1400);
  }

  stopAmbience() {
    clearTimeout(this.clicks);
    clearTimeout(this.ambienceChatter);
    this.clicks = null;
    if (this.ambienceNodes) {
      try {
        this.ambienceNodes.rumble.stop();
        this.ambienceNodes.murmur.stop();
        this.ambienceNodes.air.stop();
        this.ambienceNodes.lfo.stop();
      } catch { /* ignore */ }
      this.ambienceNodes = null;
    }
    if (this.ambience) {
      try { this.ambience.disconnect(); } catch { /* ignore */ }
      this.ambience = null;
    }
    this.started = false;
  }

  keyboardClick() {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || this.muted) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 2 + Math.random();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800 + Math.random() * 1600;
    const gain = ctx.createGain();
    const amp = 0.005 + Math.random() * 0.018;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    src.connect(hp).connect(gain).connect(this.ambience || this.master);
    src.start(now, Math.random() * 2, 0.035);
  }

  floorChatter() {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || this.muted) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.7 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380 + Math.random() * 420;
    bp.Q.value = 2.2 + Math.random() * 2;
    const gain = ctx.createGain();
    const dur = 0.25 + Math.random() * 0.6;
    const amp = 0.008 + Math.random() * 0.022;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.08);
    gain.gain.linearRampToValueAtTime(amp * 0.5, now + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(gain).connect(this.ambience || this.master);
    src.start(now, Math.random() * 2, dur + 0.05);
  }

  tone(freq, start, dur, { type = 'sine', gain = 0.05, dest = null, slide = 0 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(dest || this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  noiseBurst(start, dur, { freq = 1800, gain = 0.05, type = 'bandpass', q = 1.2 } = {}) {
    const ctx = this.ctx;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(start, Math.random() * 2, dur + 0.02);
  }

  effect(name) {
    if (!this.enabled || this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch { /* ignore */ } }
    const now = ctx.currentTime + 0.01;

    switch (name) {
      case 'news': {
        // Squawk jingle: attention motif + tape rizz
        this.noiseBurst(now, 0.16, { freq: 2400, gain: 0.06, q: 0.9 });
        [0, 0.11, 0.23].forEach((d, i) => {
          this.tone([784, 1046, 1318][i], now + d, 0.16, { type: 'triangle', gain: 0.055 });
          this.tone([392, 523, 659][i], now + d, 0.18, { type: 'sine', gain: 0.025 });
        });
        this.noiseBurst(now + 0.3, 0.24, { freq: 1500, gain: 0.03, type: 'highpass' });
        break;
      }
      case 'ping': {
        this.tone(1180, now, 0.07, { type: 'sine', gain: 0.06 });
        this.tone(1620, now + 0.075, 0.09, { type: 'sine', gain: 0.045 });
        break;
      }
      case 'fill': {
        this.tone(620, now, 0.08, { type: 'triangle', gain: 0.06 });
        this.tone(930, now + 0.085, 0.13, { type: 'triangle', gain: 0.05 });
        this.noiseBurst(now, 0.06, { freq: 3200, gain: 0.025, type: 'highpass' });
        break;
      }
      case 'alert': {
        for (let i = 0; i < 2; i++) {
          this.tone(176, now + i * 0.2, 0.13, { type: 'sawtooth', gain: 0.045 });
          this.tone(132, now + i * 0.2, 0.15, { type: 'square', gain: 0.02 });
        }
        break;
      }
      case 'open': {
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, now + i * 0.09, 0.22, { type: 'sine', gain: 0.04 }));
        break;
      }
      case 'ui': {
        this.tone(1400, now, 0.035, { type: 'sine', gain: 0.018 });
        break;
      }
      case 'error': {
        this.tone(220, now, 0.12, { type: 'square', gain: 0.025 });
        this.tone(180, now + 0.13, 0.14, { type: 'square', gain: 0.02 });
        break;
      }
      default:
        break;
    }
  }
}

export const marketAudio = new MarketAudio();
export default marketAudio;
