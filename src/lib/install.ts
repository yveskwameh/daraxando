/**
 * Installing the game to the home screen (it is a PWA).
 *
 * Chrome, Edge, Opera and Samsung Internet fire `beforeinstallprompt`, which we hold on to
 * so our own Install button can show the browser's one-tap prompt. Safari has no such event,
 * so iPhones get step-by-step directions instead.
 *
 * The pop-up that suggests installing is one of the asks (src/lib/asks.ts, shared/asks.ts): on
 * Home after a match, from the second day a player plays, only in a browser tab, and on Android
 * only once the browser has offered its install box. Settings always has "Install the app".
 */
import { useSyncExternalStore } from 'react';
import { protectStorage } from './device';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
let popOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function initInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    popOpen = false;
    emit();
    protectStorage();
  });
}

export const canPrompt = () => !!deferred;

/** Shows the browser's own install prompt. False if there isn't one (Safari, or already installed). */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  try {
    await e.userChoice;
  } catch { /* closed */ }
  return true;
}

/** Shows the pop-up. src/lib/asks.ts decides when. */
export function showInstallPop() {
  popOpen = true;
  emit();
}

export function closeInstallPop() {
  if (!popOpen) return;
  popOpen = false;
  emit();
}

export const useInstallPop = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => popOpen,
  );
