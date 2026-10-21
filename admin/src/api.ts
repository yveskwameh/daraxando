// Every call the dashboard makes, to its own Worker (admin/worker/index.ts), which passes it on
// to the live or test game's admin API.
import type { AdminAction, Appeal, Copy, Counts, FirstDays, Info, Now, PageSize, PlayerDetail, PlayerPage, PlayerSummary, RangeResult, Retention, SharedPhones, Sort, Tab, Traffic } from './types.ts';

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
  info: (copy: Copy) => call<Info>(`/api/${copy}/info`),
  counts: (copy: Copy) => call<Counts>(`/api/${copy}/players/counts`),
  list: (copy: Copy, f: { tab: Tab; sort: Sort; q?: string; state?: string; account?: string; size?: PageSize }, page: number) => {
    const p = new URLSearchParams({ tab: f.tab, sort: f.sort, page: String(page), size: String(f.size ?? 50) });
    if (f.q) p.set('q', f.q);
    if (f.state) p.set('state', f.state);
    if (f.account) p.set('account', f.account);
    return call<PlayerPage>(`/api/${copy}/players/list?${p}`);
  },
  now: (copy: Copy) => call<Now>(`/api/${copy}/now`),
  /** `q` is `hours=5`, `days=7` or `since=<ms>`. */
  traffic: (copy: Copy, q: string) => call<Traffic>(`/api/${copy}/traffic?${q}`),
  retention: (copy: Copy, weeks = 8) => call<Retention>(`/api/${copy}/retention?weeks=${weeks}`),
  firstDays: (copy: Copy, days: 7 | 30 | 90) => call<FirstDays>(`/api/${copy}/first-days?days=${days}`),
  player: (copy: Copy, id: string) => call<PlayerDetail>(`/api/${copy}/players/${id}`),
  act: (copy: Copy, id: string, act: 'rename' | 'ban' | 'unban' | 'seeds' | 'push', body: Record<string, unknown> = {}) =>
    call<{ player?: PlayerSummary; phones?: number; sent?: number }>(`/api/${copy}/players/${id}/${act}`, { method: 'POST', body }),

  /** Phones with `min` (2, 3 or 5) players or more. */
  phones: (copy: Copy, min: 2 | 3 | 5) => call<SharedPhones>(`/api/${copy}/phones?min=${min}`),
  appeals: (copy: Copy, status: 'open' | 'all') => call<{ appeals: Appeal[] }>(`/api/${copy}/appeals?status=${status}`),
  answer: (copy: Copy, id: number, verdict: 'lift' | 'keep', note: string) =>
    call<{ player: PlayerSummary | null }>(`/api/${copy}/appeals/${id}/${verdict}`, { method: 'POST', body: { note } }),

  actions: (copy: Copy, before?: number) => call<{ actions: AdminAction[] }>(`/api/${copy}/actions?limit=50${before ? `&before=${before}` : ''}`),
  streak: (copy: Copy) => call<{ day?: string; sent?: number }>(`/api/${copy}/push/streak`),
};
