import type { BotLevel } from '../../shared/bot';
import type { ModeId } from '../../shared/modes';
import type { StateCode } from '../../shared/places';
import type { FriendsData, LeaderRow, LeagueData, LiveGame, Profile } from '../../shared/protocol';
import type { Alerts } from '../../shared/codes';
import type { Controls, TourEvent } from '../../shared/controls';
import { deviceId } from './device';

export class ApiError extends Error {
  /** Free names, when the server says a name is taken. */
  ideas?: string[];
  constructor(public status: number, message: string, ideas?: string[]) {
    super(message);
    this.ideas = ideas;
  }
}

export async function call<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'You look offline. Check your connection and try again.');
  }
  const text = await res.text().catch(() => '');
  let data = {} as T & { error?: string; ideas?: string[] };
  let json = true;
  try {
    data = JSON.parse(text);
  } catch {
    json = false;
  }
  if (!res.ok) {
    // Cloudflare's own page, not ours: the free plan's daily limit (error 1027). See docs/BACKEND.md.
    if (!json && (res.status === 429 || text.includes('1027'))) throw new ApiError(RESTING, restingMessage());
    throw new ApiError(res.status, data.error ?? 'The server did not answer. Try again.', Array.isArray(data.ideas) ? data.ideas : undefined);
  }
  return data;
}

/** The status an ApiError carries when the game is resting for the day. */
export const RESTING = 1027;

/** When the free plan's day starts again: midnight UTC, in the player's own time (1:00 am in Lagos). */
export function backAt(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

export const restingMessage = () => `Dara X&O is resting until ${backAt()}. Your progress is safe.`;

export const post = (body: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(body) });

export interface ProfilePatch { name?: string; avatar?: string; piece?: string; print?: string; state?: StateCode }

export interface RoomPeek {
  code: string;
  mode: ModeId;
  stake: number;
  host: { name: string; avatar: string; print: string; state: string } | null;
  open: boolean;
}

export const api = {
  createPlayer: (p: { name: string; avatar: string; state: StateCode; age: boolean; terms: string; auto?: boolean }) =>
    call<{ token: string; profile: Profile }>('/api/session', null, { ...post(p), headers: { 'x-device': deviceId() } }),

  where: () => call<{ state: StateCode | null }>('/api/where', null),

  /** Quick match games waiting for an opponent that you can join, best first. */
  /** Games to join, as one request. The app watches instead (src/lib/useLive.ts); this is for checks. */
  live: (token: string) => call<{ games: LiveGame[]; n: number; looking: number }>('/api/live', token),

  /** The phone's id goes along, so the server can link the player to the phones they use (worker/phones.ts). */
  me: (token: string) => call<{ profile: Profile; alerts?: Alerts; controls?: Controls }>('/api/me', token, { headers: { 'x-device': deviceId() } }),
  /** The new-player walkthrough, counted for the 8 am email (docs/WALKTHROUGH.md). Nothing is kept per player. */
  tour: (token: string, e: TourEvent) => call<null>('/api/tour', token, { method: 'POST', body: JSON.stringify({ e }) }),

  /** Accept the current Terms of play and Privacy notice (shared/legal.ts). */
  acceptTerms: (token: string, version: string) => call<{ profile: Profile }>('/api/terms', token, post({ version })),

  updateMe: (token: string, patch: ProfilePatch) => call<{ profile: Profile }>('/api/me', token, post(patch, 'PATCH')),
  /** Is this name free? With ideas when it isn't. */
  checkName: (token: string, name: string) =>
    call<{ ok: boolean; message?: string; ideas?: string[] }>(`/api/names?check=${encodeURIComponent(name)}`, token),
  /** A few names nobody has. */
  nameIdeas: (token: string) => call<{ ideas: string[] }>('/api/names', token),

  sapa: (token: string) => call<{ profile: Profile }>('/api/wallet/sapa', token, post({})),

  leaderboard: (token: string | null, state: string | null) =>
    call<{ top: LeaderRow[]; me: { rank: number; outside?: true } | null }>(`/api/leaderboard${state ? `?state=${state}` : ''}`, token),

  createRoom: (token: string, mode: ModeId, stake: number) =>
    call<{ matchId: string }>('/api/rooms', token, post({ mode, stake })),

  setRoomStake: (token: string, code: string, stake: number) =>
    call<{ stake: number }>(`/api/rooms/${code}`, token, post({ stake }, 'PATCH')),

  peekRoom: (code: string) => call<RoomPeek>(`/api/rooms/${code}`, null),

  cancelRoom: (token: string, code: string) => call<{ closed: true }>(`/api/rooms/${code}`, token, { method: 'DELETE' }),

  /** Spend Dara Seeds on the streak: a Streak Freeze, restoring an ended streak, or a streak stake. */
  streak: (token: string, action: 'freeze' | 'restore' | 'bet') =>
    call<{ profile: Profile }>(`/api/streak/${action}`, token, post({})),

  league: (token: string) => call<LeagueData>('/api/league', token),

  friends: (token: string) => call<FriendsData>('/api/friends', token),
  /** Ask for a friend streak, or accept one. */
  addFriend: (token: string, id: string) => call<FriendsData>(`/api/friends/${id}`, token, post({})),
  /** Decline, cancel or end a friend streak. */
  dropFriend: (token: string, id: string) => call<FriendsData>(`/api/friends/${id}`, token, { method: 'DELETE' }),

  playBot: (token: string, mode: ModeId, level: BotLevel, first = false) =>
    call<{ matchId: string }>('/api/bot', token, post({ mode, level, first })),
};

/** ws:// locally, wss:// live. Same host as the page, so no CORS and no config. */
export const socketUrl = (path: string, token: string, params: Record<string, string | number> = {}) => {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const q = new URLSearchParams({ token, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  return `${proto}//${location.host}${path}?${q}`;
};
