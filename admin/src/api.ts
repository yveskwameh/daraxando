// Every call the dashboard makes, to its own Worker (admin/worker/index.ts), which passes it on
// to the live or test game's admin API.
import type { AdminAction, Appeal, Copy, PlayerDetail, PlayerSummary, RangeResult } from './types.ts';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Called when the session has ended, so the app can show the sign-in screen. */
let onSignedOut = () => {};
export const whenSignedOut = (fn: () => void) => { onSignedOut = fn; };

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: { 'x-dara-admin': '1', ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : init.method === 'POST' ? '{}' : undefined,
    });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (res.status === 401 && path.startsWith('/api/')) onSignedOut();
  if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? `Something went wrong (${res.status}).`, res.status);
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  me: () => call<{ signedIn: boolean; copies: Record<Copy, boolean> }>('/auth/me'),
  signIn: (key: string) => call<{ ok: true }>('/auth/signin', { method: 'POST', body: { key } }),
  signOut: () => call<{ ok: true }>('/auth/signout', { method: 'POST' }),

  range: (copy: Copy, end: string, days = 14) => call<RangeResult>(`/api/${copy}/range?end=${end}&days=${days}`),
  reportUrl: (copy: Copy, day: string) => `/api/${copy}/report?day=${day}`,
  sendReport: (copy: Copy, day: string) => call<{ sent: boolean; to: number }>(`/api/${copy}/report?day=${day}`, { method: 'POST' }),

  players: (copy: Copy, q: string) => call<{ players: PlayerSummary[] }>(`/api/${copy}/players?q=${enc(q)}`),
  player: (copy: Copy, id: string) => call<PlayerDetail>(`/api/${copy}/players/${id}`),
  act: (copy: Copy, id: string, act: 'rename' | 'ban' | 'unban' | 'seeds' | 'push', body: Record<string, unknown> = {}) =>
    call<{ player?: PlayerSummary; phones?: number; sent?: number }>(`/api/${copy}/players/${id}/${act}`, { method: 'POST', body }),

  appeals: (copy: Copy, status: 'open' | 'all') => call<{ appeals: Appeal[] }>(`/api/${copy}/appeals?status=${status}`),
  answer: (copy: Copy, id: number, verdict: 'lift' | 'keep', note: string) =>
    call<{ player: PlayerSummary | null }>(`/api/${copy}/appeals/${id}/${verdict}`, { method: 'POST', body: { note } }),

  actions: (copy: Copy, before?: number) => call<{ actions: AdminAction[] }>(`/api/${copy}/actions?limit=50${before ? `&before=${before}` : ''}`),
  streak: (copy: Copy) => call<{ day?: string; sent?: number }>(`/api/${copy}/push/streak`),
};
