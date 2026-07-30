/*
 * 生成式音频，无任何外部音频资源：
 *  - 古筝：Karplus-Strong 拨弦合成，五声音阶随机行吟，偶作刮奏
 *  - 环境：滤波噪声作风，正弦扫频作鸟鸣（夜则息）
 *  - 简易卷积混响（噪声衰减脉冲）
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    // 宫调五声：C D E G A（两个八度）
    this.scale = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0];
    this.buffers = new Map();
    this.melodyIdx = 4;
    this.nightFactor = 0;
  }

  // 需在用户手势后调用
  start() {
    if (this.started) return;
    this.started = true;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // 混响
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4, 2.5);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.32;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);

    this.startWind();
    this.scheduleLoop();
  }

  makeImpulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const len = rate * duration;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // Karplus-Strong 拨弦
  pluckBuffer(freq) {
    if (this.buffers.has(freq)) return this.buffers.get(freq);
    const rate = this.ctx.sampleRate;
    const N = Math.round(rate / freq);
    const len = Math.floor(rate * 2.8);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    const line = new Float32Array(N);
    for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1;
    let idx = 0;
    let prev = 0;
    const damp = 0.996;
    for (let n = 0; n < len; n++) {
      const cur = line[idx];
      const next = damp * 0.5 * (cur + prev);
      data[n] = cur * Math.min(1, n / 8);
      prev = cur;
      line[idx] = next;
      idx = (idx + 1) % N;
    }
    this.buffers.set(freq, buf);
    return buf;
  }

  pluck(freq, when = 0, vol = 0.5) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.pluckBuffer(freq);
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(this.master);
    gain.connect(this.reverb);
    src.start(this.ctx.currentTime + when);
  }

  scheduleLoop() {
    const next = () => {
      if (!this.ctx) return;
      if (this.enabled) this.playPhrase();
      this.timer = setTimeout(next, 380 + Math.random() * 900);
    };
    next();
  }

  playPhrase() {
    // 旋律：音阶随机漫步
    const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
    this.melodyIdx = Math.max(0, Math.min(this.scale.length - 1, this.melodyIdx + step));
    this.pluck(this.scale[this.melodyIdx], 0, 0.42 + Math.random() * 0.2);
    // 偶尔叠加五度和声
    if (Math.random() > 0.72 && this.melodyIdx > 3) {
      this.pluck(this.scale[this.melodyIdx - 3], 0.02, 0.24);
    }
    // 偶尔刮奏（上行琶音，古筝标志性手法）
    if (Math.random() > 0.86) {
      const start = Math.max(0, this.melodyIdx - 5);
      const run = this.scale.slice(start, this.melodyIdx + 1);
      run.forEach((f, i) => this.pluck(f, i * 0.07, 0.2));
    }
    // 日间鸟鸣
    if (this.nightFactor < 0.5 && Math.random() > 0.6) this.birdChirp();
  }

  birdChirp() {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 2200 + Math.random() * 1400;
    const slides = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i <= slides; i++) {
      const t = t0 + i * 0.09;
      osc.frequency.setValueAtTime(base * (1 + Math.random() * 0.3), t);
      osc.frequency.exponentialRampToValueAtTime(base * (0.75 + Math.random() * 0.2), t + 0.07);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.045, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + slides * 0.09 + 0.1);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + slides * 0.09 + 0.15);
  }

  startWind() {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = rate * 4;
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v = v * 0.98 + (Math.random() * 2 - 1) * 0.02; // 布朗噪声
      data[i] = v * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.06;
    src.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.master);
    src.start();
    // 风的起伏
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.028;
    lfo.connect(lfoGain);
    lfoGain.connect(this.windGain.gain);
    lfo.start();
  }

  setNight(f) {
    this.nightFactor = f;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.55 : 0, this.ctx.currentTime, 0.2);
    }
    return this.enabled;
  }
}
