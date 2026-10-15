/**
 * Little buzzes on taps, moves, wins and losses.
 *
 * Android has the Vibration API. iPhones don't, but since iOS 18 tapping a hidden
 * <input type="checkbox" switch> gives a light system tap, so iPhones get that instead.
 * The hidden switch lives in App.tsx.
 */
import { isIOS } from './device';
import { prefs } from './prefs';

const PATTERNS = {
  tap: 10,
  place: 15,
  invalid: [20, 40, 20],
  win: [30, 60, 40, 60, 80],
  lose: [60],
  draw: [20, 80, 20],
  stamp: 25,
} as const;

export type Buzz = keyof typeof PATTERNS;

export function buzz(kind: Buzz, force = false) {
  if (!force && !prefs.get().haptics) return;
  try {
    if (navigator.vibrate?.(PATTERNS[kind] as number | number[])) return;
  } catch { /* not supported */ }
  if (isIOS) document.getElementById('hap')?.click();
}
