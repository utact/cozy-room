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
      this.ctx?.resume();
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
}

export const sfx = new Sfx();
