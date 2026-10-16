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
import { ASK_AGAIN_DAYS } from '../../shared/notify';
import { call, post } from './api';
import { KEYS, store } from './storage';

export type PushKind = 'streak' | 'friends';
export type PushPrefs = Record<PushKind, boolean>;
export type PushState = 'unsupported' | 'blocked' | 'ready';

const OFF: PushPrefs = { streak: false, friends: false };
const DAY_MS = 86_400_000;

export const pushPrefs = (): PushPrefs => store.json<PushPrefs>(KEYS.push, OFF);

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
export async function setPush(token: string, want: PushPrefs): Promise<{ ok: true; prefs: PushPrefs } | { ok: false; why: 'blocked' | 'unsupported' | 'error'; message?: string }> {
  if (pushState() === 'unsupported') return { ok: false, why: 'unsupported' };
  const anyOn = want.streak || want.friends;
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
      await call('/api/push', token, post({ ...sub.toJSON(), ...want }));
    }
    store.set(KEYS.push, JSON.stringify(want));
    return { ok: true, prefs: want };
  } catch (err) {
    return { ok: false, why: 'error', message: (err as Error).message };
  }
}

/** An iPhone or iPad in a Safari tab: notifications only work in the installed app there. */
export const iphoneTab = () => /iphone|ipad/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches && !(navigator as { standalone?: boolean }).standalone;

/* ---------- asking at the right moment ---------- */

type Asked = Partial<Record<PushKind, { at: number; n: number }>>;
let askedThisVisit = false;

/** True if now is a fine time to ask about `kind`: never twice in one visit, and after a "Not now", wait. */
export function mayAsk(kind: PushKind, now = Date.now()) {
  if (askedThisVisit || pushState() !== 'ready' || pushPrefs()[kind]) return false;
  if (iphoneTab()) return false;
  const last = store.json<Asked>(KEYS.pushAsk, {})[kind];
  if (!last) return true;
  const gap = ASK_AGAIN_DAYS[Math.min(last.n - 1, ASK_AGAIN_DAYS.length - 1)];
  return now - last.at >= gap * DAY_MS;
}

/** The ask is on screen: count it, so a closed ask waits before coming back. */
export function markAsked(kind: PushKind, now = Date.now()) {
  askedThisVisit = true;
  const all = store.json<Asked>(KEYS.pushAsk, {});
  all[kind] = { at: now, n: (all[kind]?.n ?? 0) + 1 };
  store.set(KEYS.pushAsk, JSON.stringify(all));
}
