/**
 * localStorage that never throws. Private windows and blocked storage just behave as if
 * nothing was saved, and the game still works for that session.
 */
export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch { /* storage unavailable */ }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch { /* storage unavailable */ }
  },
  json<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (!raw) return fallback;
    try {
      return { ...fallback, ...(JSON.parse(raw) as T) };
    } catch {
      return fallback;
    }
  },
};

export const KEYS = {
  token: 'dara:token',
  prefs: 'dara:prefs',
  device: 'dara:device',
  room: 'dara:room',
  nudge: 'dara:nudge',
  /** Which notifications this phone turned on (src/lib/push.ts). */
  push: 'dara:push',
  /** When we last asked about notifications, and how many times, per kind. Read only now: see `asks`. */
  pushAsk: 'dara:push-ask',
  /** When each ask (save, notifications, install) was last shown, and how many times (src/lib/asks.ts). */
  asks: 'dara:asks',
  /** Matches finished on this phone, for the save ask. */
  matches: 'dara:matches',
} as const;
