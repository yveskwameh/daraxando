/**
 * Installing the game to the home screen (it is a PWA).
 *
 * Chrome, Edge, Opera and Samsung Internet fire `beforeinstallprompt`, which we hold on to
 * so our own Install button can show the browser's one-tap prompt. Safari has no such event,
 * so iPhones get step-by-step directions instead.
 *
 * The pop-up that suggests installing appears only in a browser tab, only on Home, at most
 * once every three days, and never again for two weeks after someone closes it. Settings
 * always has "Install the app".
 */
import { useSyncExternalStore } from 'react';
import { isStandalone } from './device';
import { KEYS, store } from './storage';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
let popOpen = false;
let shownThisVisit = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const GAP_MS = 3 * 86_400_000;
const SNOOZE_MS = 14 * 86_400_000;

export function initInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    popOpen = false;
    emit();
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

/** Asks for the pop-up. It only appears if the rules above allow it. */
export function maybeShowInstallPop() {
  if (shownThisVisit || isStandalone()) return;
  const saved = store.json(KEYS.install, { lastShown: 0, snoozeUntil: 0 });
  const now = Date.now();
  if (now < saved.snoozeUntil || now - saved.lastShown < GAP_MS) return;
  shownThisVisit = true;
  store.set(KEYS.install, JSON.stringify({ ...saved, lastShown: now }));
  popOpen = true;
  emit();
}

export function closeInstallPop(snooze: boolean) {
  popOpen = false;
  if (snooze) {
    const saved = store.json(KEYS.install, { lastShown: 0, snoozeUntil: 0 });
    store.set(KEYS.install, JSON.stringify({ ...saved, snoozeUntil: Date.now() + SNOOZE_MS }));
  }
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
