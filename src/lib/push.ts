/**
 * Notifications on this phone (shared/notify.ts, worker/push.ts; Yves, 16 October 2026).
 *
 * Turning them on: our own question first (the asks on Home and on a friend room, or the
 * switches in Settings), and only when the player says yes, the phone's own permission box.
 * A "Block" on the phone's box can't be asked again, so it's never shown cold.
 *
 * iPhones only show web notifications for the installed app (Add to Home Screen), not in a
 * Safari tab, so there the asks stay away and Settings says to install the app.
 */
import { call, post } from './api';
import { protectStorage } from './device';
import { KEYS, store } from './storage';

/** The 7 pm streak reminder, a friend joining your room, and News from Dara X&O (docs/NEWS-REVIEW.md). */
export type PushKind = 'streak' | 'friends' | 'news';
export type PushPrefs = Record<PushKind, boolean>;
export type PushState = 'unsupported' | 'blocked' | 'ready';
/** Where a player turned notifications on, for the 8 am email's count (worker/stats.ts). */
export type PushFrom = 'streak-ask' | 'friends-ask' | 'settings';

const OFF: PushPrefs = { streak: false, friends: false, news: false };

// Phones from before news have only the first two: news is off for them until they turn it on.
export const pushPrefs = (): PushPrefs => ({ ...OFF, ...store.json<Partial<PushPrefs>>(KEYS.push, {}) });

/** Whether this phone can show notifications, and whether the player blocked them. */
export function pushState(): PushState {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ready';
}

const b64ToBytes = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function subscription(create: boolean, token: string) {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null; // no service worker: the dev server, or it hasn't installed yet
  const had = await reg.pushManager.getSubscription();
  if (had || !create) return had;
  const { key } = await call<{ key: string | null }>('/api/push', token);
  if (!key) throw new Error("Notifications aren't set up here yet.");
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
}

/**
 * Changes what this phone gets. Turning anything on asks the phone's permission first, so call
 * it straight from a tap. Returns the prefs now in force, or why it didn't work.
 */
export async function setPush(token: string, want: PushPrefs, from?: PushFrom): Promise<{ ok: true; prefs: PushPrefs } | { ok: false; why: 'blocked' | 'unsupported' | 'error'; message?: string }> {
  if (pushState() === 'unsupported') return { ok: false, why: 'unsupported' };
  const anyOn = want.streak || want.friends || want.news;
  try {
    if (anyOn && Notification.permission !== 'granted') {
      const answer = await Notification.requestPermission();
      if (answer !== 'granted') return { ok: false, why: answer === 'denied' ? 'blocked' : 'error' };
    }
    const sub = await subscription(anyOn, token);
    if (!sub) {
      if (anyOn) return { ok: false, why: 'unsupported' };
    } else if (!anyOn) {
      await call('/api/push', token, post({ endpoint: sub.endpoint }, 'DELETE')).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    } else {
      // `from` only when this turns something on, so the count is of players saying yes.
      const now = pushPrefs();
      const turnsOn = (want.streak && !now.streak) || (want.friends && !now.friends) || (want.news && !now.news);
      await call('/api/push', token, post({ ...sub.toJSON(), ...want, ...(from && turnsOn ? { from } : {}) }));
    }
    store.set(KEYS.push, JSON.stringify(want));
    if (anyOn) protectStorage();
    return { ok: true, prefs: want };
  } catch (err) {
    return { ok: false, why: 'error', message: (err as Error).message };
  }
}

/** An iPhone or iPad in a Safari tab: notifications only work in the installed app there. */
export const iphoneTab = () => /iphone|ipad/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches && !(navigator as { standalone?: boolean }).standalone;

// When to ask is in src/lib/asks.ts and shared/asks.ts.
