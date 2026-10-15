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
  install: 'dara:install',
  room: 'dara:room',
  nudge: 'dara:nudge',
} as const;
