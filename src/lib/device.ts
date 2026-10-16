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

/**
 * Asks Chrome to keep the game's saved data (the player, on a guest's phone) when the phone runs
 * low on space. Chrome decides by itself, without showing anything, and says yes more readily for
 * an installed game or one with notifications on, so it's asked then. Only in Chrome and the
 * browsers built on it: Firefox would show a box for it.
 */
export function protectStorage() {
  if (!('userAgentData' in navigator) || !navigator.storage?.persist) return;
  if (!isStandalone() && !('Notification' in window && Notification.permission === 'granted')) return;
  void navigator.storage.persisted().then((done) => (done ? true : navigator.storage.persist())).catch(() => {});
}

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
  // How wide a list's scrollbar is here: 6px on a computer, 0 on most phones, where it floats
  // over the list. Lists reach to the right edge of the screen so the bar sits in the margin,
  // and use this to keep their content lined up with everything above and below them.
  const probe = document.createElement('div');
  probe.className = 'sb-probe';
  document.body.appendChild(probe);
  root.style.setProperty('--sbw', `${probe.offsetWidth - probe.clientWidth}px`);
  probe.remove();
}

/**
 * A random id for this phone, kept in local storage. Used to rate-limit new players per phone
 * instead of per IP address, because most Nigerian mobile networks share IPs, and (stored only
 * as a keyed hash) so players made on the same phone can't win seeds from each other
 * (worker/safety.ts). Nothing is read from the phone itself.
 */
export function deviceId() {
  let id = store.get(KEYS.device);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    store.set(KEYS.device, id);
  }
  return id;
}
