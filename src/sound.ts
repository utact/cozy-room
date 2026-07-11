/**
 * 효과음 — WebAudio로 전부 합성 (외부 오디오 에셋 0개 = 라이선스 걱정 0).
 * 브라우저 정책상 첫 사용자 입력 후 AudioContext가 열린다.
 */

class Sfx {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;

  constructor() {
    const unlock = () => {
      this.ensure();
      this.ctx?.resume().then(() => this.startBgm());
    };
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('pointerdown', unlock, { once: false });
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  /** 단순 톤 — freq 시작→끝, 지정 파형/길이/볼륨 */
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0) {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq: number, when = 0) {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running' || !this.noiseBuf) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  grab() { this.tone('sine', 320, 640, 0.09, 0.25); }
  jump() { this.tone('sine', 240, 520, 0.14, 0.18); }
  throw() { this.noise(0.22, 0.3, 2400); }
  bonk() { this.tone('triangle', 190, 70, 0.16, 0.4); this.noise(0.08, 0.2, 900); }
  tick() { this.tone('square', 880, 880, 0.06, 0.12); }
  buzzer() { this.tone('sawtooth', 240, 200, 0.55, 0.3); this.tone('sawtooth', 302, 250, 0.55, 0.2); }
  gust() { this.noise(0.5, 0.22, 1200); }
  reveal(score: number) {
    // 점수 높을수록 밝은 딩동
    const base = 420 + score * 4.4;
    this.tone('sine', base, base, 0.14, 0.22);
    this.tone('sine', base * 1.5, base * 1.5, 0.2, 0.18, 0.09);
  }
  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone('triangle', f, f, 0.32, 0.25, i * 0.14));
    this.noise(0.6, 0.12, 3000, 0.5);
  }
  rip() {
    this.noise(0.28, 0.4, 1600);
    this.tone('sawtooth', 300, 90, 0.35, 0.28, 0.04);
  }

  // ── BGM: 제너러티브 로파이 루프 (코지룸 무드) ──────────
  // Cmaj7 → Am7 → Fmaj7 → G7, 88bpm 8분음표 그리드를 룩어헤드 스케줄링.
  private bgmInterval: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private bgmStep = 0;

  private static CHORDS = [
    { bass: 130.81, arp: [261.63, 329.63, 392.0, 493.88] },  // Cmaj7
    { bass: 110.0,  arp: [220.0, 261.63, 329.63, 392.0] },   // Am7
    { bass: 87.31,  arp: [174.61, 220.0, 261.63, 329.63] },  // Fmaj7
    { bass: 98.0,   arp: [196.0, 246.94, 293.66, 349.23] },  // G7
  ];

  startBgm() {
    const ctx = this.ensure();
    if (!ctx || this.bgmInterval) return;
    const stepDur = 60 / 88 / 2; // 8분음표
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.bgmInterval = setInterval(() => {
      if (ctx.state !== 'running') return;
      while (this.nextNoteTime < ctx.currentTime + 0.35) {
        this.scheduleBgmStep(this.bgmStep, this.nextNoteTime - ctx.currentTime, stepDur);
        this.bgmStep = (this.bgmStep + 1) % 32; // 4코드 × 8스텝
        this.nextNoteTime += stepDur;
      }
    }, 120);
  }

  private scheduleBgmStep(step: number, when: number, stepDur: number) {
    const chord = Sfx.CHORDS[Math.floor(step / 8) % 4];
    const inBar = step % 8;
    if (inBar === 0 || inBar === 5) {
      this.tone('sine', chord.bass, chord.bass, stepDur * 3.4, 0.085, when);
    }
    if (inBar % 2 === 0) {
      const note = chord.arp[(step / 2 + Math.floor(step / 8)) % 4];
      this.tone('triangle', note, note, stepDur * 1.6, 0.038, when);
    }
    if (inBar === 4) {
      this.noise(0.05, 0.022, 5200, when); // 옅은 햇
    }
  }
}

export const sfx = new Sfx();
