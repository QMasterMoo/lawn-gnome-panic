// Stadium PA announcer powered by EasySpeech (male voice, pitched down)
// + WebAudio stadium sound system (compression, stadium crunch, stadium reverb)
// with dynamic envelope shapes modulating the PA effects per callout.
import EasySpeech from 'easy-speech';
import type { AnnouncerEvent } from './types';

export type EnvelopeShape = 'punchy' | 'swell' | 'staccato' | 'epic';

export interface AnnouncerProfile {
  shape: EnvelopeShape;
  pitch: number;
  rate: number;
  crunchDrive: number;
  reverbMix: number;
  hornBoostDb: number;
  duckGain: number;
  durationSec: number;
}

export interface EnvelopeSample {
  amp: number;
  crunch: number;
  reverb: number;
  filterNorm: number;
}

const MALE_VOICE_HINTS = [
  'david', 'mark', 'george', 'daniel', 'alex', 'fred', 'guy', 'james',
  'paul', 'richard', 'sean', 'thomas', 'ryan', 'andrew', 'christopher',
  'eric', 'roger', 'steffan', 'aaron', 'arthur', 'oliver', 'brian',
  'matthew', 'william', 'male', 'baritone', 'bass', 'man',
];

const FEMALE_VOICE_HINTS = [
  'zira', 'samantha', 'victoria', 'karen', 'susan', 'hazel', 'libby',
  'sonia', 'aria', 'jenny', 'claire', 'fiona', 'moira', 'tessa',
  'veena', 'kate', 'serena', 'female', 'woman', 'girl',
];

/** Scores and selects the best available male English voice for the stadium PA. */
export function pickMaleVoice<T extends { name: string; lang: string; localService?: boolean }>(
  voices: readonly T[],
): T | undefined {
  if (!voices.length) return undefined;

  let best: T | undefined;
  let bestScore = -Infinity;

  for (const v of voices) {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    let score = 0;

    if (lang.startsWith('en-us')) score += 20;
    else if (lang.startsWith('en')) score += 14;
    else score -= 15;

    if (v.localService) score += 4;

    for (const hint of MALE_VOICE_HINTS) {
      if (name.includes(hint)) {
        score += 35;
        break;
      }
    }
    for (const hint of FEMALE_VOICE_HINTS) {
      if (name.includes(hint)) {
        score -= 40;
        break;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  return best;
}

/** Converts an AnnouncerEvent into natural spoken arcade announcer copy. */
export function formatAnnouncerSpeech(ev: AnnouncerEvent): string {
  const clean = (s: string): string =>
    s
      .replace(/!+/g, '!')
      .replace(/\+(\d+)/g, 'plus $1')
      .replace(/(\d+)\s*-\s*(\d+)/g, '$1 to $2')
      .trim();

  const main = clean(ev.text);
  const sub = ev.subtext ? clean(ev.subtext) : '';
  if (!sub) return main;
  return `${main} ${sub}`;
}

/** Classifies an AnnouncerEvent into a dynamic PA envelope & pitch profile. */
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
      pitch: 0.72,
      rate: 1.02,
      crunchDrive: 0.88,
      reverbMix: 0.78,
      hornBoostDb: 6.5,
      duckGain: 0.38,
      durationSec: 1.9,
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
      pitch: 0.76,
      rate: 1.07,
      crunchDrive: 0.74,
      reverbMix: 0.58,
      hornBoostDb: 5.5,
      duckGain: 0.46,
      durationSec: 1.4,
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
      pitch: 0.82,
      rate: 1.12,
      crunchDrive: 0.56,
      reverbMix: 0.42,
      hornBoostDb: 4.0,
      duckGain: 0.55,
      durationSec: 1.1,
    };
  }

  return {
    shape: 'swell',
    pitch: 0.78,
    rate: 1.0,
    crunchDrive: 0.48,
    reverbMix: 0.62,
    hornBoostDb: 3.5,
    duckGain: 0.52,
    durationSec: 1.6,
  };
}

/** Evaluates subtle envelope shapes over normalized time t in [0, 1]. */
export function evaluateEnvelope(shape: EnvelopeShape, tNorm: number): EnvelopeSample {
  const t = Math.max(0, Math.min(1, tNorm));

  switch (shape) {
    case 'punchy': {
      const attack = t < 0.07 ? t / 0.07 : 1;
      const decay = t < 0.07 ? 1 : Math.pow(1 - (t - 0.07) / 0.93, 1.85);
      const amp = attack * decay;
      return {
        amp,
        crunch: 0.35 + 0.65 * Math.pow(amp, 0.8),
        reverb: 0.35 + 0.5 * (1 - t * 0.5),
        filterNorm: 0.3 + 0.7 * amp,
      };
    }
    case 'swell': {
      const rise = t < 0.35 ? Math.sin((t / 0.35) * Math.PI * 0.5) : 1;
      const fall = t > 0.65 ? Math.cos(((t - 0.65) / 0.35) * Math.PI * 0.5) : 1;
      const amp = Math.max(0, rise * fall);
      return {
        amp,
        crunch: 0.25 + 0.5 * amp,
        reverb: 0.45 + 0.45 * Math.sin(t * Math.PI),
        filterNorm: 0.25 + 0.6 * amp,
      };
    }
    case 'staccato': {
      // Two crisp percussive syllables/pulses followed by tight gate
      const pulse1 = Math.exp(-Math.pow((t - 0.14) / 0.11, 2));
      const pulse2 = 0.82 * Math.exp(-Math.pow((t - 0.48) / 0.13, 2));
      const amp = Math.min(1, pulse1 + pulse2);
      return {
        amp,
        crunch: 0.4 + 0.55 * amp,
        reverb: 0.25 + 0.35 * amp,
        filterNorm: 0.4 + 0.6 * amp,
      };
    }
    case 'epic': {
      const attack = t < 0.08 ? t / 0.08 : 1;
      const sustain = t < 0.55 ? 0.85 + 0.15 * Math.sin((t / 0.55) * Math.PI) : 1;
      const tail = t >= 0.55 ? Math.pow(1 - (t - 0.55) / 0.45, 1.3) : 1;
      const amp = attack * sustain * tail;
      return {
        amp,
        crunch: 0.5 + 0.5 * amp,
        reverb: 0.6 + 0.4 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.85),
        filterNorm: 0.35 + 0.65 * amp,
      };
    }
  }
}

/** Asymmetric stadium PA horn saturation curve for crunch. */
export function createStadiumCrunchCurve(driveAmount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = 4 + driveAmount * 22;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // Slight asymmetry models driven PA horn driver compression/crunch
    const bias = x > 0 ? 1.06 : 0.94;
    curve[i] = ((1 + k) * x * bias) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** Synthesizes a 2.0s stereo stadium impulse response with arena slapback echoes. */
export function createStadiumReverbBuffer(ctx: BaseAudioContext): AudioBuffer {
  const dur = 2.0;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const tapTimesSec = [0.038, 0.082, 0.135, 0.195];

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const tSec = i / ctx.sampleRate;
      const tNorm = i / len;
      const attack = Math.min(1, tSec / 0.025);
      const decay = Math.pow(1 - tNorm, 2.2);
      const white = Math.random() * 2 - 1;
      lp = lp * 0.58 + white * 0.42;
      data[i] = lp * attack * decay * 0.55;
    }
    // Distinct arena bowl early reflections
    for (let k = 0; k < tapTimesSec.length; k++) {
      const idx = Math.floor((tapTimesSec[k] + ch * 0.009) * ctx.sampleRate);
      if (idx < len) {
        data[idx] += (0.42 - k * 0.08) * (ch === 0 ? 1 : -0.92);
      }
    }
  }
  return buf;
}

export class StadiumAnnouncer {
  private readonly getSfxGain: () => number;
  private readonly onDuckMusic?: (mult: number) => void;

  private initialized = false;
  private initPromise: Promise<boolean> | null = null;
  private voice: SpeechSynthesisVoice | undefined;

  private lastSpeakMs = 0;
  private duckReleaseTimer: number | null = null;
  private activeProfile: AnnouncerProfile | null = null;
  private activeStartTime = 0;

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

  /** Initializes EasySpeech and selects the male announcer voice. */
  async init(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
      return false;
    }

    this.initPromise = EasySpeech.init({ maxTimeout: 3000, interval: 100, quiet: true })
      .then((ok) => {
        if (ok) {
          this.initialized = true;
          this.voice = pickMaleVoice(EasySpeech.voices());
        }
        return ok;
      })
      .catch(() => false);

    return this.initPromise;
  }

  private ensureGraph(ctx: AudioContext): void {
    if (this.paInput && this.ctx === ctx) return;
    this.ctx = ctx;

    this.paInput = ctx.createGain();
    this.paInput.gain.value = 1.0;

    // PA Horn EQ: tight low cut, nasal arena presence, rolled-off top
    const hornHp = ctx.createBiquadFilter();
    hornHp.type = 'highpass';
    hornHp.frequency.value = 175;

    this.hornPresence = ctx.createBiquadFilter();
    this.hornPresence.type = 'peaking';
    this.hornPresence.frequency.value = 1850;
    this.hornPresence.Q.value = 1.4;
    this.hornPresence.gain.value = 4.0;

    this.hornLp = ctx.createBiquadFilter();
    this.hornLp.type = 'lowpass';
    this.hornLp.frequency.value = 3800;

    // Broadcast/PA compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 6;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.14;

    // Stadium crunch stage
    this.crunchDrive = ctx.createGain();
    this.crunchDrive.gain.value = 1.4;

    const crunchShaper = ctx.createWaveShaper();
    crunchShaper.curve = createStadiumCrunchCurve(0.65);
    crunchShaper.oversample = '2x';

    const crunchMakeup = ctx.createGain();
    crunchMakeup.gain.value = 0.65;

    // Dry + Stadium Reverb parallel buses
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.72;

    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.55;

    const convolver = ctx.createConvolver();
    convolver.buffer = createStadiumReverbBuffer(ctx);

    const revHp = ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 210;

    const revLp = ctx.createBiquadFilter();
    revLp.type = 'lowpass';
    revLp.frequency.value = 2900;

    const revReturn = ctx.createGain();
    revReturn.gain.value = 0.52;

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

  /** Applies dynamic envelope automation to the stadium PA chain and fires mic-open transient. */
  private triggerStadiumEnvelope(ctx: AudioContext, profile: AnnouncerProfile, vol: number): void {
    this.ensureGraph(ctx);
    if (!this.paInput || !this.crunchDrive || !this.reverbSend || !this.hornPresence || !this.hornLp || !this.paMaster) {
      return;
    }

    const now = ctx.currentTime;
    const dur = profile.durationSec;
    this.activeProfile = profile;
    this.activeStartTime = now;

    this.paMaster.gain.setTargetAtTime(vol, now, 0.01);

    // Sample the envelope shape into WebAudio automation steps
    const steps = 12;
    this.crunchDrive.gain.cancelScheduledValues(now);
    this.reverbSend.gain.cancelScheduledValues(now);
    this.hornPresence.gain.cancelScheduledValues(now);
    this.hornLp.frequency.cancelScheduledValues(now);

    for (let i = 0; i <= steps; i++) {
      const tNorm = i / steps;
      const t = now + tNorm * dur;
      const env = evaluateEnvelope(profile.shape, tNorm);
      const driveVal = 0.9 + env.crunch * profile.crunchDrive * 1.9;
      const revVal = 0.18 + env.reverb * profile.reverbMix * 0.9;
      const hornDb = 1.5 + env.filterNorm * profile.hornBoostDb;
      const lpHz = 2300 + env.filterNorm * 2300;

      if (i === 0) {
        this.crunchDrive.gain.setValueAtTime(driveVal, t);
        this.reverbSend.gain.setValueAtTime(revVal, t);
        this.hornPresence.gain.setValueAtTime(hornDb, t);
        this.hornLp.frequency.setValueAtTime(lpHz, t);
      } else {
        this.crunchDrive.gain.linearRampToValueAtTime(driveVal, t);
        this.reverbSend.gain.linearRampToValueAtTime(revVal, t);
        this.hornPresence.gain.linearRampToValueAtTime(hornDb, t);
        this.hornLp.frequency.linearRampToValueAtTime(lpHz, t);
      }
    }

    // Subtle PA mic-open thump + stadium air carrier fed through compressor/crunch/reverb
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(115, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(48, now + 0.08);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.linearRampToValueAtTime(0.16, now + 0.004);
    thumpGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.09);
    thumpOsc.connect(thumpGain).connect(this.paInput);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.1);
  }

  /** Pulses a subtle PA horn-body resonance on word boundaries so stadium reverb breathes with speech. */
  private pulseBoundary(ctx: AudioContext): void {
    if (!this.paInput || !this.activeProfile) return;
    const now = ctx.currentTime;
    const tNorm = Math.min(1, Math.max(0, (now - this.activeStartTime) / this.activeProfile.durationSec));
    const env = evaluateEnvelope(this.activeProfile.shape, tNorm);
    if (env.amp <= 0.03) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const baseHz = 130 * this.activeProfile.pitch;
    osc.frequency.setValueAtTime(baseHz, now);
    osc.frequency.exponentialRampToValueAtTime(baseHz * 0.85, now + 0.075);

    const peak = 0.055 * env.amp;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + 0.085);

    osc.connect(gain).connect(this.paInput);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  private setDuck(mult: number, releaseMs?: number): void {
    if (this.duckReleaseTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.duckReleaseTimer);
      this.duckReleaseTimer = null;
    }
    this.onDuckMusic?.(mult);
    if (releaseMs !== undefined && typeof window !== 'undefined') {
      this.duckReleaseTimer = window.setTimeout(() => {
        this.duckReleaseTimer = null;
        this.onDuckMusic?.(1.0);
      }, releaseMs);
    }
  }

  /** Voices an announcer event through EasySpeech + the stadium PA sound system. */
  announce(ctx: AudioContext | null, ev: AnnouncerEvent): void {
    const sfx = this.getSfxGain();
    if (sfx <= 0.001) return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!ev.big && nowMs - this.lastSpeakMs < 420) return;
    this.lastSpeakMs = nowMs;

    const profile = classifyAnnouncerProfile(ev);
    const text = formatAnnouncerSpeech(ev);
    if (!text) return;

    if (ctx) {
      this.triggerStadiumEnvelope(ctx, profile, sfx);
    }

    this.setDuck(profile.duckGain, Math.round(profile.durationSec * 1000) + 500);

    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
      return;
    }

    void this.init().then((ok) => {
      if (!ok) return;
      if (!this.voice) {
        this.voice = pickMaleVoice(EasySpeech.voices());
      }
      if (ev.big) {
        EasySpeech.cancel();
      }
      void EasySpeech.speak({
        text,
        voice: this.voice,
        pitch: profile.pitch,
        rate: profile.rate,
        volume: Math.min(1, sfx),
        boundary: () => {
          if (this.ctx) this.pulseBoundary(this.ctx);
        },
        end: () => {
          this.setDuck(1.0);
        },
        error: () => {
          this.setDuck(1.0);
        },
      }).catch(() => {
        this.setDuck(1.0);
      });
    });
  }

  stop(): void {
    if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
      try {
        EasySpeech.cancel();
      } catch {
        // ignore if not initialized
      }
    }
    this.setDuck(1.0);
  }
}
