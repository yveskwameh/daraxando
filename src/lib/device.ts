/**
 * What kind of phone this is.
 *
 * Low-end phones (2GB of memory or less, or four cores or fewer) get the same game with the
 * ambient extras turned off: no looping demo boards off-screen, no confetti, fewer sparks.
 * Browsers that do not report these values are treated as capable.
 */
import { KEYS, store } from './storage';

const nav = navigator as Navigator & { deviceMemory?: number; standalone?: boolean };

export const isLite = (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 4;

export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isOperaMini = /Opera Mini/i.test(navigator.userAgent);

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Opened from the home screen, without the browser's address bar. */
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || nav.standalone === true;

export function markDevice() {
  const root = document.documentElement;
  if (isLite) root.dataset.lite = '';
  // Hide the "turn your phone" card while the keyboard is up, because a keyboard can make
  // a portrait phone look landscape.
  document.addEventListener('focusin', (e) => {
    if ((e.target as Element).matches?.('input, textarea')) root.classList.add('typing');
  });
  document.addEventListener('focusout', (e) => {
    if ((e.target as Element).matches?.('input, textarea')) root.classList.remove('typing');
  });
}

/**
 * A random id for this phone, kept in local storage. Only used to rate-limit new players
 * per phone instead of per IP address, because most Nigerian mobile networks share IPs.
 */
export function deviceId() {
  let id = store.get(KEYS.device);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    store.set(KEYS.device, id);
  }
  return id;
}
