/**
 * The service worker: caches the app so it opens instantly and survives a bad connection.
 * Loaded after the first screen is up, so it costs nothing on the first download.
 *
 * When a new version is deployed, the new worker waits instead of taking over mid-match.
 * Home offers a Reload button, and the update also applies the next time the app opens.
 */
import { useSyncExternalStore } from 'react';

let apply: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export async function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      apply = update;
      listeners.forEach((l) => l());
    },
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
