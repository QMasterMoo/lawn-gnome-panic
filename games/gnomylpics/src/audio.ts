import type { SfxName } from './config';

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
  const c = getContext();
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, now);
  osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + dur);
}

/** Code-generated sound effects. Never throws. */
export function playSfx(name: SfxName): void {
  try {
    switch (name) {
      case 'tap': tone(500, 420, 0.03, 'square', 0.025); break;
      case 'stumble': tone(260, 90, 0.25, 'sawtooth', 0.1); break;
      case 'beep': tone(600, 600, 0.12, 'square', 0.07); break;
      case 'go': tone(900, 900, 0.3, 'square', 0.08); break;
      case 'jump': tone(300, 700, 0.15, 'triangle', 0.1); break;
      case 'land': tone(180, 120, 0.1, 'triangle', 0.12); break;
      case 'flop': tone(200, 60, 0.35, 'sawtooth', 0.1); break;
      case 'whoosh': tone(1200, 200, 0.4, 'sawtooth', 0.04); break;
      case 'thud': tone(120, 40, 0.3, 'square', 0.14); break;
      case 'cheer':
        [523, 659, 784, 1047].forEach((f, k) => tone(f, f, 0.18, 'square', 0.06, k * 0.12));
        break;
    }
  } catch {
    // Audio must never break the game.
  }
}
