import { CAMERA_VIEWS, DEFAULT_FLAGS, FLAGS_KEY, type CameraView, type FeatureFlags, type VisualMode } from './config';

const MODES: readonly VisualMode[] = ['off', 'rtx', 'crt', 'lite'];

/** Rough guess at an older phone: little memory, or a touch screen with few cores. */
function looksLowEnd(): boolean {
  try {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (mem !== undefined && mem <= 2) return true;
    const coarse = matchMedia('(pointer: coarse)').matches;
    return coarse && (navigator.hardwareConcurrency ?? 8) <= 4;
  } catch {
    return false;
  }
}

/** Feature flags live apart from the save so wiping progress keeps your settings. */
export function loadFlags(): FeatureFlags {
  const flags: FeatureFlags = { ...DEFAULT_FLAGS };
  let saved = false;
  try {
    const raw = JSON.parse(localStorage.getItem(FLAGS_KEY) ?? 'null') as Partial<FeatureFlags> | null;
    if (raw && MODES.includes(raw.visualMode as VisualMode)) {
      flags.visualMode = raw.visualMode as VisualMode;
      saved = true;
    }
    if (raw && CAMERA_VIEWS.includes(raw.view as CameraView)) flags.view = raw.view as CameraView;
  } catch {
    // keep defaults
  }
  // No saved choice yet: start older phones in LITE.
  if (!saved && looksLowEnd()) flags.visualMode = 'lite';
  // URL override for sharing and testing, e.g. ?visual=rtx
  try {
    const v = new URLSearchParams(location.search).get('visual');
    if (v && MODES.includes(v as VisualMode)) flags.visualMode = v as VisualMode;
  } catch {
    // no location (tests)
  }
  return flags;
}

export function saveFlags(flags: FeatureFlags): void {
  try {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  } catch {
    // storage unavailable; flags last for this session only
  }
}
