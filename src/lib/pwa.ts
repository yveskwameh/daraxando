/**
 * The service worker: caches the app so it opens instantly and survives a bad connection.
 * Loaded after the first screen is up, so it costs nothing on the first download.
 *
 * How a new version reaches a phone (Yves, 16 October 2026: an installed app kept the old
 * version until he pulled down to refresh, because coming back to an app from the background
 * doesn't reload it, so the browser never looked for a new version):
 *  1. Looking: when the app opens, every time it comes back to the front (at most once a
 *     minute), and every 30 minutes while it's open. A look only fetches the small sw.js file,
 *     a static file that costs nothing on Cloudflare's free plan.
 *  2. Downloading: the new version downloads in the background while the old one keeps running.
 *  3. Switching: never in the middle of something. Home shows a Reload button. If the player
 *     doesn't tap it, the app switches by itself the moment they leave it (switch apps, lock the
 *     phone), unless they're in a match or a room, on a sign-in link, or have a sheet open. The
 *     next time they come back, it's the new version. Opened fresh with a new version already
 *     waiting, it switches straight away, before anything is on screen for long.
 */
import { useSyncExternalStore } from 'react';

const LOOK_EVERY_MS = 30 * 60_000;
const LOOK_GAP_MS = 60_000;
/** A new version found this soon after the app opened switches at once: nothing has happened yet. */
const FRESH_MS = 3_000;

let apply: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

/** True when reloading now would lose nothing: not in a match or room, no sheet open, not mid sign-in. */
function safeToSwitch() {
  const path = location.pathname;
  if (path.startsWith('/play/') || path.startsWith('/c/')) return false;
  if (location.hash.includes('signin=')) return false;
  if (document.querySelector('dialog[open]')) return false;
  return true;
}

function switchNow() {
  if (!apply || !safeToSwitch()) return false;
  void apply(true);
  return true;
}

export async function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  let reg: ServiceWorkerRegistration | undefined;
  let lastLook = Date.now();

  const look = () => {
    if (!reg || reg.installing || !navigator.onLine) return;
    if (Date.now() - lastLook < LOOK_GAP_MS) return;
    lastLook = Date.now();
    reg.update().catch(() => { /* offline or the server is busy: the next look will do */ });
  };

  const update = registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      reg = r;
      setInterval(look, LOOK_EVERY_MS);
    },
    onNeedRefresh() {
      apply = update;
      // Just opened: switch before the player starts anything.
      if (performance.now() < FRESH_MS && switchNow()) return;
      listeners.forEach((l) => l());
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') look();
    // Leaving the app with a new version waiting: switch now, out of sight.
    else switchNow();
  });
}

export const useUpdateReady = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => apply !== null,
  );

export const applyUpdate = () => apply?.(true);
