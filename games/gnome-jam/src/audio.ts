// Procedural WebAudio arcade basketball sound effects + optional arena synth music.
import { createVolumeStore, type VolumeStore } from '@arcade/volume';

export class JamAudio {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  readonly volume: VolumeStore;

  constructor() {
    this.volume = createVolumeStore();
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private sfxGain(): number {
    return this.volume.effective('sounds');
  }

  private musicGain(): number {
    return this.volume.effective('music');
  }

  unlock(): void {
    this.ensure();
  }

  playBounce(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.085);
    gain.gain.setValueAtTime(0.18 * g, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playSwish(isThree = false): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Filtered noise swish
    const len = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isThree ? 2600 : 2100, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.2);
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32 * g, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);

    // Celebratory chime for 3-pointer
    if (isThree) {
      this.tone(523.25, 0.08, 0.14 * g, 'triangle', 0);
      this.tone(659.25, 0.08, 0.14 * g, 'triangle', 0.06);
      this.tone(783.99, 0.14, 0.16 * g, 'triangle', 0.12);
    }
  }

  playRimClang(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(310, 0.12, 0.22 * g, 'square', 0);
    this.tone(195, 0.14, 0.18 * g, 'sawtooth', 0.02);
  }

  playDunk(onFire = false): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Heavy sub-bass rim slam
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(onFire ? 170 : 140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.32);
    gain.gain.setValueAtTime(0.55 * g, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);

    // Metallic rim rattle
    this.tone(420, 0.12, 0.2 * g, 'square', 0.02);
    this.tone(280, 0.16, 0.18 * g, 'sawtooth', 0.05);
    this.playCrowdCheer(onFire ? 1.0 : 0.75);
  }

  playCrowdCheer(intensity = 0.7): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 0.55 + intensity * 0.45;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * Math.pow(1 - t, 0.75);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750 + intensity * 350, now);
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24 * intensity * g, now);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
  }

  playPass(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(480, 0.06, 0.12 * g, 'sine', 0, 760);
  }

  playShove(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(130, 0.1, 0.28 * g, 'sawtooth', 0, 55);
  }

  playBlock(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(240, 0.09, 0.3 * g, 'square', 0, 110);
    this.playCrowdCheer(0.45);
  }

  playFire(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(330, 0.1, 0.2 * g, 'sawtooth', 0, 660);
    this.tone(440, 0.12, 0.2 * g, 'sawtooth', 0.08, 880);
    this.tone(660, 0.22, 0.24 * g, 'triangle', 0.16, 990);
    this.playCrowdCheer(1.0);
  }

  playWhistle(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(2650, 0.14, 0.14 * g, 'sine', 0, 2720);
    this.tone(2650, 0.12, 0.12 * g, 'sine', 0.17, 2580);
  }

  playBuzzer(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(115, 0.65, 0.3 * g, 'sawtooth', 0);
    this.tone(146, 0.65, 0.22 * g, 'square', 0);
  }

  playClick(): void {
    const g = this.sfxGain();
    if (g <= 0.001) return;
    this.tone(620, 0.04, 0.1 * g, 'triangle', 0, 820);
  }

  /** Upbeat retro arcade bass/organ groove while in a match. */
  startMusic(): void {
    if (this.musicTimer !== null) return;
    const bassLine = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    const organChords = [440, 0, 523.25, 0, 587.33, 523.25, 493.88, 0];
    this.musicTimer = window.setInterval(() => {
      const g = this.musicGain();
      if (g <= 0.001) return;
      const idx = this.musicStep % bassLine.length;
      this.musicStep++;
      this.tone(bassLine[idx], 0.13, 0.085 * g, 'triangle', 0);
      const lead = organChords[idx];
      if (lead > 0) {
        this.tone(lead, 0.11, 0.05 * g, 'square', 0.01);
      }
    }, 210);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private tone(
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType,
    delay = 0,
    endFreq?: number,
  ): void {
    const ctx = this.ensure();
    if (!ctx || vol <= 0.001) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }
}
