// Stadium PA announcer using SamJs (mobile-friendly, zero-model PCM TTS)
// routed directly through WebAudio pitch-shift, compression, stadium crunch,
// and stadium reverb, with dynamic envelope shapes modulating the PA effects.
import SamJs from 'sam-js';
import type { AnnouncerEvent } from './types';

export type EnvelopeShape = 'punchy' | 'swell' | 'staccato' | 'epic';

export interface AnnouncerProfile {
  shape: EnvelopeShape;
  /** SamJs pitch parameter (higher = deeper male voice; default 64). */
  samPitch: number;
  /** SamJs speed parameter (lower = faster). */
  samSpeed: number;
  /** SamJs throat/mouth formants for a chesty male announcer timbre. */
  samThroat: number;
  samMouth: number;
  /** WebAudio playbackRate (< 1.0 pitch-shifts down further). */
  playbackRate: number;
  crunchDrive: number;
  reverbMix: number;
  hornBoostDb: number;
  duckGain: number;
}

export interface EnvelopeSample {
  amp: number;
  crunch: number;
  reverb: number;
  filterNorm: number;
}

const SAM_SAMPLE_RATE = 22050;

/** Converts an AnnouncerEvent into crisp phonetic-friendly arcade announcer text. */
export function formatAnnouncerSpeech(ev: AnnouncerEvent): string {
  const clean = (s: string): string =>
    s
      .replace(/!+/g, '!')
      .replace(/\+(\d+)/g, 'plus $1')
      .replace(/(\d+)\s*-\s*(\d+)/g, '$1 to $2')
      .replace(/[^a-zA-Z0-9\s.,!?'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const main = clean(ev.text);
  const sub = ev.subtext ? clean(ev.subtext) : '';
  if (!sub) return main;
  return `${main}. ${sub}`;
}

/** Classifies an AnnouncerEvent into a dynamic PA envelope & male-voice pitch profile. */
export function classifyAnnouncerProfile(ev: AnnouncerEvent): AnnouncerProfile {
  const upper = `${ev.text} ${ev.subtext ?? ''}`.toUpperCase();

  if (
    upper.includes('ON FIRE') ||
    upper.includes('BUZZER BEATER') ||
    upper.includes('OVERTIME') ||
    upper.includes('METEOR')
  ) {
    return {
      shape: 'epic',
      samPitch: 88,
      samSpeed: 68,
      samThroat: 110,
      samMouth: 106,
      playbackRate: 0.86,
      crunchDrive: 0.9,
      reverbMix: 0.82,
      hornBoostDb: 6.5,
      duckGain: 0.36,
    };
  }

  if (
    ev.big ||
    upper.includes('REJECTED') ||
    upper.includes('SHOVE') ||
    upper.includes('ALLEY-OOP') ||
    upper.includes('TOMAHAWK') ||
    upper.includes('WINDMILL') ||
    upper.includes('HELICOPTER') ||
    upper.includes('FLIP')
  ) {
    return {
      shape: 'punchy',
      samPitch: 84,
      samSpeed: 64,
      samThroat: 112,
      samMouth: 108,
      playbackRate: 0.89,
      crunchDrive: 0.78,
      reverbMix: 0.62,
      hornBoostDb: 5.5,
      duckGain: 0.44,
    };
  }

  if (
    upper.includes('PICKPOCKET') ||
    upper.includes('SWATTED') ||
    upper.includes('VIOLATION') ||
    upper.includes('DOWNTOWN') ||
    upper.includes('NOTHING BUT NET')
  ) {
    return {
      shape: 'staccato',
      samPitch: 78,
      samSpeed: 60,
      samThroat: 114,
      samMouth: 110,
      playbackRate: 0.93,
      crunchDrive: 0.62,
      reverbMix: 0.46,
      hornBoostDb: 4.5,
      duckGain: 0.52,
    };
  }

  return {
    shape: 'swell',
    samPitch: 82,
    samSpeed: 68,
    samThroat: 112,
    samMouth: 108,
    playbackRate: 0.9,
    crunchDrive: 0.54,
    reverbMix: 0.66,
    hornBoostDb: 4.0,
    duckGain: 0.48,
  };
}

/** Evaluates subtle envelope shapes over normalized time t in [0, 1]. */
export function evaluateEnvelope(shape: EnvelopeShape, tNorm: number): EnvelopeSample {
  const t = Math.max(0, Math.min(1, tNorm));

  switch (shape) {
    case 'punchy': {
      const attack = t < 0.06 ? t / 0.06 : 1;
      const decay = t < 0.06 ? 1 : Math.pow(1 - (t - 0.06) / 0.94, 1.45);
      const amp = 0.55 + 0.45 * attack * decay;
      return {
        amp,
        crunch: 0.35 + 0.65 * Math.pow(attack * decay, 0.8),
        reverb: 0.35 + 0.55 * (1 - t * 0.45),
        filterNorm: 0.3 + 0.7 * (attack * decay),
      };
    }
    case 'swell': {
      const rise = t < 0.35 ? Math.sin((t / 0.35) * Math.PI * 0.5) : 1;
      const fall = t > 0.7 ? Math.cos(((t - 0.7) / 0.3) * Math.PI * 0.5) : 1;
      const shapeVal = Math.max(0, rise * fall);
      return {
        amp: 0.65 + 0.35 * shapeVal,
        crunch: 0.25 + 0.55 * shapeVal,
        reverb: 0.45 + 0.45 * Math.sin(t * Math.PI),
        filterNorm: 0.25 + 0.6 * shapeVal,
      };
    }
    case 'staccato': {
      const pulse1 = Math.exp(-Math.pow((t - 0.16) / 0.14, 2));
      const pulse2 = 0.88 * Math.exp(-Math.pow((t - 0.56) / 0.16, 2));
      const shapeVal = Math.min(1, pulse1 + pulse2);
      return {
        amp: 0.6 + 0.4 * shapeVal,
        crunch: 0.4 + 0.55 * shapeVal,
        reverb: 0.25 + 0.38 * shapeVal,
        filterNorm: 0.4 + 0.6 * shapeVal,
      };
    }
    case 'epic': {
      const attack = t < 0.07 ? t / 0.07 : 1;
      const sustain = t < 0.6 ? 0.88 + 0.12 * Math.sin((t / 0.6) * Math.PI) : 1;
      const tail = t >= 0.6 ? Math.pow(1 - (t - 0.6) / 0.4, 1.2) : 1;
      const shapeVal = attack * sustain * tail;
      return {
        amp: 0.7 + 0.3 * shapeVal,
        crunch: 0.5 + 0.5 * shapeVal,
        reverb: 0.6 + 0.4 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.85),
        filterNorm: 0.35 + 0.65 * shapeVal,
      };
    }
  }
}

/** Synthesizes raw mono Float32Array PCM speech at 22050 Hz using SamJs. */
export function synthesizeSpeechPcm(text: string, profile: AnnouncerProfile): Float32Array | null {
  if (!text.trim()) return null;
  try {
    const sam = new SamJs({
      pitch: profile.samPitch,
      speed: profile.samSpeed,
      throat: profile.samThroat,
      mouth: profile.samMouth,
    });
    const out = sam.buf32(text);
    if (out instanceof Float32Array && out.length > 0) {
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

/** Asymmetric stadium PA horn saturation curve for crunch. */
export function createStadiumCrunchCurve(driveAmount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = 4 + driveAmount * 24;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    const bias = x > 0 ? 1.07 : 0.93;
    curve[i] = ((1 + k) * x * bias) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** Synthesizes a 2.0s stereo stadium impulse response with arena slapback echoes. */
export function createStadiumReverbBuffer(ctx: BaseAudioContext): AudioBuffer {
  const dur = 2.0;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const tapTimesSec = [0.036, 0.079, 0.132, 0.192];

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const tSec = i / ctx.sampleRate;
      const tNorm = i / len;
      const attack = Math.min(1, tSec / 0.02);
      const decay = Math.pow(1 - tNorm, 2.15);
      const white = Math.random() * 2 - 1;
      lp = lp * 0.58 + white * 0.42;
      data[i] = lp * attack * decay * 0.58;
    }
    for (let k = 0; k < tapTimesSec.length; k++) {
      const idx = Math.floor((tapTimesSec[k] + ch * 0.009) * ctx.sampleRate);
      if (idx < len) {
        data[idx] += (0.45 - k * 0.08) * (ch === 0 ? 1 : -0.92);
      }
    }
  }
  return buf;
}

export class StadiumAnnouncer {
  private readonly getSfxGain: () => number;
  private readonly onDuckMusic?: (mult: number) => void;

  private lastSpeakMs = 0;
  private activeSource: AudioBufferSourceNode | null = null;

  // Stadium PA WebAudio graph
  private ctx: AudioContext | null = null;
  private paInput: GainNode | null = null;
  private hornPresence: BiquadFilterNode | null = null;
  private hornLp: BiquadFilterNode | null = null;
  private crunchDrive: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private paMaster: GainNode | null = null;

  constructor(getSfxGain: () => number, onDuckMusic?: (mult: number) => void) {
    this.getSfxGain = getSfxGain;
    this.onDuckMusic = onDuckMusic;
  }

  /** Kept for lifecycle symmetry with JamAudio.unlock(). */
  async init(): Promise<boolean> {
    return true;
  }

  private ensureGraph(ctx: AudioContext): void {
    if (this.paInput && this.ctx === ctx) return;
    this.ctx = ctx;

    this.paInput = ctx.createGain();
    this.paInput.gain.value = 1.0;

    // PA Horn EQ: tight low cut, arena horn presence, rolled-off top
    const hornHp = ctx.createBiquadFilter();
    hornHp.type = 'highpass';
    hornHp.frequency.value = 165;

    this.hornPresence = ctx.createBiquadFilter();
    this.hornPresence.type = 'peaking';
    this.hornPresence.frequency.value = 1750;
    this.hornPresence.Q.value = 1.35;
    this.hornPresence.gain.value = 4.5;

    this.hornLp = ctx.createBiquadFilter();
    this.hornLp.type = 'lowpass';
    this.hornLp.frequency.value = 3900;

    // Broadcast/PA compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 6;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.14;

    // Stadium crunch stage
    this.crunchDrive = ctx.createGain();
    this.crunchDrive.gain.value = 1.6;

    const crunchShaper = ctx.createWaveShaper();
    crunchShaper.curve = createStadiumCrunchCurve(0.7);
    crunchShaper.oversample = '2x';

    const crunchMakeup = ctx.createGain();
    crunchMakeup.gain.value = 0.72;

    // Dry + Stadium Reverb parallel buses
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.78;

    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.6;

    const convolver = ctx.createConvolver();
    convolver.buffer = createStadiumReverbBuffer(ctx);

    const revHp = ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 200;

    const revLp = ctx.createBiquadFilter();
    revLp.type = 'lowpass';
    revLp.frequency.value = 3000;

    const revReturn = ctx.createGain();
    revReturn.gain.value = 0.58;

    this.paMaster = ctx.createGain();
    this.paMaster.gain.value = Math.max(0, Math.min(1, this.getSfxGain()));

    this.paInput.connect(hornHp);
    hornHp.connect(this.hornPresence);
    this.hornPresence.connect(this.hornLp);
    this.hornLp.connect(compressor);
    compressor.connect(this.crunchDrive);
    this.crunchDrive.connect(crunchShaper);
    crunchShaper.connect(crunchMakeup);

    crunchMakeup.connect(dryGain);
    dryGain.connect(this.paMaster);

    crunchMakeup.connect(this.reverbSend);
    this.reverbSend.connect(convolver);
    convolver.connect(revHp);
    revHp.connect(revLp);
    revLp.connect(revReturn);
    revReturn.connect(this.paMaster);

    this.paMaster.connect(ctx.destination);
  }

  private applyDynamicEnvelope(ctx: AudioContext, profile: AnnouncerProfile, durSec: number, vol: number): void {
    if (!this.paInput || !this.crunchDrive || !this.reverbSend || !this.hornPresence || !this.hornLp || !this.paMaster) {
      return;
    }

    const now = ctx.currentTime;
    this.paMaster.gain.setTargetAtTime(vol * 1.15, now, 0.01);

    const steps = 14;
    this.paInput.gain.cancelScheduledValues(now);
    this.crunchDrive.gain.cancelScheduledValues(now);
    this.reverbSend.gain.cancelScheduledValues(now);
    this.hornPresence.gain.cancelScheduledValues(now);
    this.hornLp.frequency.cancelScheduledValues(now);

    for (let i = 0; i <= steps; i++) {
      const tNorm = i / steps;
      const t = now + tNorm * durSec;
      const env = evaluateEnvelope(profile.shape, tNorm);
      const inVal = 0.75 + env.amp * 0.45;
      const driveVal = 1.0 + env.crunch * profile.crunchDrive * 2.1;
      const revVal = 0.2 + env.reverb * profile.reverbMix * 0.95;
      const hornDb = 1.5 + env.filterNorm * profile.hornBoostDb;
      const lpHz = 2200 + env.filterNorm * 2400;

      if (i === 0) {
        this.paInput.gain.setValueAtTime(inVal, t);
        this.crunchDrive.gain.setValueAtTime(driveVal, t);
        this.reverbSend.gain.setValueAtTime(revVal, t);
        this.hornPresence.gain.setValueAtTime(hornDb, t);
        this.hornLp.frequency.setValueAtTime(lpHz, t);
      } else {
        this.paInput.gain.linearRampToValueAtTime(inVal, t);
        this.crunchDrive.gain.linearRampToValueAtTime(driveVal, t);
        this.reverbSend.gain.linearRampToValueAtTime(revVal, t);
        this.hornPresence.gain.linearRampToValueAtTime(hornDb, t);
        this.hornLp.frequency.linearRampToValueAtTime(lpHz, t);
      }
    }
  }

  /** Synthesizes and plays an announcer event through the stadium PA WebAudio graph. */
  announce(ctx: AudioContext | null, ev: AnnouncerEvent): void {
    const sfx = this.getSfxGain();
    if (!ctx || sfx <= 0.001) return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!ev.big && nowMs - this.lastSpeakMs < 420) return;
    this.lastSpeakMs = nowMs;

    const profile = classifyAnnouncerProfile(ev);
    const text = formatAnnouncerSpeech(ev);
    const pcm = synthesizeSpeechPcm(text, profile);
    if (!pcm) return;

    if (ev.big && this.activeSource) {
      try {
        this.activeSource.stop();
      } catch {
        // ignore already stopped
      }
      this.activeSource = null;
    }

    this.ensureGraph(ctx);
    if (!this.paInput) return;

    const audioBuf = ctx.createBuffer(1, pcm.length, SAM_SAMPLE_RATE);
    audioBuf.getChannelData(0).set(pcm);

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.playbackRate.value = profile.playbackRate;

    const durSec = audioBuf.duration / profile.playbackRate;
    this.applyDynamicEnvelope(ctx, profile, durSec, sfx);

    this.onDuckMusic?.(profile.duckGain);
    this.activeSource = src;
    src.onended = () => {
      if (this.activeSource === src) {
        this.activeSource = null;
        this.onDuckMusic?.(1.0);
      }
    };

    src.connect(this.paInput);
    src.start(ctx.currentTime);
  }

  stop(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch {
        // ignore
      }
      this.activeSource = null;
    }
    this.onDuckMusic?.(1.0);
  }
}
