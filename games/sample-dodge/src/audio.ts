import type { SfxName } from './config';

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** One oscillator through a gain envelope, sweeping frequency and fading out. */
function tone(
  freqStart: number,
  freqEnd: number,
  durationS: number,
  type: OscillatorType,
  volume: number,
): void {
  const c = getContext();
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, now + durationS);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationS);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + durationS);
}

export function playSfx(name: SfxName): void {
  try {
    switch (name) {
      case 'start':
        tone(330, 660, 0.15, 'square', 0.08);
        break;
      case 'coin':
        tone(880, 1320, 0.08, 'square', 0.07);
        setTimeout(() => {
          try {
            tone(1320, 1760, 0.08, 'square', 0.05);
          } catch {
            // Audio must never break the game.
          }
        }, 60);
        break;
      case 'hit':
        tone(220, 40, 0.4, 'sawtooth', 0.15);
        break;
    }
  } catch {
    // Audio must never break the game.
  }
}
