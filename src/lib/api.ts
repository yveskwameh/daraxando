import type { BotLevel } from '../../shared/bot';
import type { ModeId } from '../../shared/modes';
import type { StateCode } from '../../shared/places';
import type { FriendsData, LeaderRow, LeagueData, LiveGame, Profile } from '../../shared/protocol';
import { deviceId } from './device';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
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
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'The server did not answer. Try again.');
  return data;
}

const post = (body: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(body) });

export interface ProfilePatch { name?: string; avatar?: string; piece?: string; print?: string; state?: StateCode }

export interface RoomPeek {
  code: string;
  mode: ModeId;
  stake: number;
  host: { name: string; avatar: string; print: string; state: string } | null;
  open: boolean;
}

export const api = {
  createPlayer: (p: { name: string; avatar: string; state: StateCode; age: boolean }) =>
    call<{ token: string; profile: Profile }>('/api/session', null, { ...post(p), headers: { 'x-device': deviceId() } }),

  where: () => call<{ state: StateCode | null }>('/api/where', null),

  /** Quick match games waiting for an opponent that you can join, best first. */
  live: (token: string) => call<{ games: LiveGame[]; n: number }>('/api/live', token),

  me: (token: string) => call<{ profile: Profile }>('/api/me', token),

  updateMe: (token: string, patch: ProfilePatch) => call<{ profile: Profile }>('/api/me', token, post(patch, 'PATCH')),

  sapa: (token: string) => call<{ profile: Profile }>('/api/wallet/sapa', token, post({})),

  leaderboard: (token: string | null, state: string | null) =>
    call<{ top: LeaderRow[]; me: { rank: number } | null }>(`/api/leaderboard${state ? `?state=${state}` : ''}`, token),

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
