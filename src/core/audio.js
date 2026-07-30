/*
 * 生成式音频，无任何外部音频资源：
 *  - 古筝：Karplus-Strong 拨弦合成，谱曲式五声旋律（起承转合），
 *    带摇指/滑音/泛音/刮奏等古筝技法，双弦微失谐加厚音色
 *  - 环境：滤波噪声作风，正弦扫频作鸟鸣（夜则息）
 *  - 简易卷积混响（噪声衰减脉冲）
 */

// 宫调五声：C D E G A（两个八度）—— 曲谱以此为音阶索引
const SCALE = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0];
const BEAT = 0.78; // 慢板，一拍时长（秒）

// 《游园引》：起承转合四段。[音阶索引, 拍数, 技法?]
// 技法: tremolo 摇指 | slide 滑音 | gliss 收尾刮奏
const PHRASES = [
  // 起 · 平稳陈述
  [
    [1, 1], [2, 1], [3, 1.5], [2, 0.5], [1, 2, 'tremolo'],
    [3, 1], [4, 1], [3, 0.5], [2, 0.5], [1, 2, 'slide'],
  ],
  // 承 · 顺势上行
  [
    [2, 0.75], [3, 0.75], [4, 1], [5, 1, 'harmonic'], [4, 0.5], [3, 1.5],
    [4, 1], [3, 0.5], [2, 0.5], [1, 2, 'tremolo'],
  ],
  // 转 · 高音展开
  [
    [8, 1, 'harmonic'], [7, 1], [6, 1.5], [5, 0.5], [6, 1], [7, 2, 'tremolo'],
    [5, 1], [4, 0.5], [5, 0.5], [4, 1], [3, 2, 'slide'],
  ],
  // 合 · 回落收尾，刮奏收束
  [
    [4, 1], [3, 0.75], [2, 0.75], [1, 1], [2, 1], [3, 1.5],
    [2, 0.5], [1, 2.5, 'tremolo', 'gliss'],
  ],
];
const PHRASE_GAP = 1.6;  // 乐句间呼吸
const SONG_GAP = 5;      // 曲终再起

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.buffers = new Map();
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

    // 乐曲总线（夜间自动弱音）
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 1;
    this.musicGain.connect(this.master);

    // 混响
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4, 2.5);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.32;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);

    this.startWind();
    this.scheduleSong();
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

  // Karplus-Strong 拨弦：噪声混入基频正弦，音头更聚拢
  pluckBuffer(freq) {
    if (this.buffers.has(freq)) return this.buffers.get(freq);
    const rate = this.ctx.sampleRate;
    const N = Math.round(rate / freq);
    const len = Math.floor(rate * 2.8);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    const line = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      line[i] = (Math.random() * 2 - 1) * 0.7 + Math.sin((2 * Math.PI * i) / N) * 0.45;
    }
    let idx = 0;
    let prev = 0;
    const damp = 0.9965;
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

  // 拨弦发音：双弦微失谐（古筝同度双弦的厚度）；slide 为滑音弯音
  pluck(freq, when = 0, vol = 0.5, { slide = false } = {}) {
    const t0 = this.ctx.currentTime + when;
    for (const [rate, v] of [[1, vol], [1.0032, vol * 0.38]]) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.pluckBuffer(freq);
      if (slide) {
        src.playbackRate.setValueAtTime(0.92 * rate, t0);
        src.playbackRate.exponentialRampToValueAtTime(rate, t0 + 0.22);
      } else {
        src.playbackRate.value = rate;
      }
      const gain = this.ctx.createGain();
      gain.gain.value = v;
      src.connect(gain);
      gain.connect(this.musicGain);
      gain.connect(this.reverb);
      src.start(t0);
    }
  }

  scheduleSong() {
    const loop = () => {
      if (!this.ctx) return;
      const dur = this.playSong();
      this.timer = setTimeout(loop, (dur + SONG_GAP) * 1000);
    };
    loop();
  }

  // 谱曲演奏：整曲一次排程，返回曲长（秒）
  playSong() {
    let t = 0.3;
    for (let p = 0; p < PHRASES.length; p++) {
      const phrase = PHRASES[p];
      for (let n = 0; n < phrase.length; n++) {
        const [idx, beats, ...arts] = phrase[n];
        const freq = SCALE[idx];
        const dur = beats * BEAT;
        const vol = 0.4 + (idx >= 6 ? 0.06 : 0); // 高音稍亮

        if (arts.includes('tremolo')) {
          // 摇指：长音轮拨，密而渐弱
          const hits = Math.floor(dur / 0.065);
          for (let k = 0; k < hits; k++) {
            const decay = 1 - k / hits;
            this.pluck(freq, t + k * 0.065, vol * (0.24 + 0.3 * decay));
          }
        } else {
          this.pluck(freq, t, vol * 0.62, { slide: arts.includes('slide') });
        }
        // 泛音：轻触高八度
        if (arts.includes('harmonic')) this.pluck(freq * 2, t + 0.015, vol * 0.2);
        // 刮奏：先上行音流后落本音（曲终标志）
        if (arts.includes('gliss')) {
          const from = Math.max(0, idx - 6);
          const run = SCALE.slice(from, idx + 1);
          run.forEach((f, i) => this.pluck(f, t + i * 0.06, 0.16 + i * 0.015));
        }
        t += dur;
      }
      t += PHRASE_GAP;
      // 句间偶闻鸟鸣（日间）
      if (this.nightFactor < 0.5 && Math.random() > 0.45) {
        setTimeout(() => this.birdChirp(), (t - PHRASE_GAP * 0.6) * 1000);
      }
    }
    return t;
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
    // 夜间乐声轻敛，风声稍起
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(1 - f * 0.4, this.ctx.currentTime, 1.2);
    }
    if (this.ctx && this.windGain) {
      this.windGain.gain.setTargetAtTime(0.06 + f * 0.03, this.ctx.currentTime, 1.5);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.55 : 0, this.ctx.currentTime, 0.2);
    }
    return this.enabled;
  }
}
