// The shapes the game's admin API sends back. Kept in step with the game's worker/report.ts
// (Report) and worker/admin.ts (players, ban reviews, the admin log).

export type Copy = 'live' | 'test';
export type Kind = 'bot' | 'quick' | 'friend';
export type ModeId = 'fading' | 'classic' | 'big' | 'pro';
export type PushFrom = 'streak-ask' | 'friends-ask' | 'settings';

export interface Usage {
  /** The UTC day the free plan's limits count. */
  day: string;
  requests: { total: number; copies: { name: string; n: number }[] } | null;
  errors: number | null;
  doRequests: number | null;
  rowsRead: number | null;
  rowsWritten: number | null;
  problems: string[];
}

export interface Report {
  day: string;
  copy: string;
  players: {
    played: number;
    playedDayBefore: number;
    week: number;
    joined: number;
    saved: number;
    buckets: { new: number; current: number; reactivated: number; resurrected: number };
    atRisk: number;
    curr: { of: number; back: number };
  };
  first: {
    joined: number;
    finished: number;
    known: number;
    won: number;
    nextDay: { day: string; of: number; back: number };
    week: { day: string; of: number; back: number };
  };
  matches: {
    total: number;
    kinds: Record<Kind, number>;
    modes: Record<ModeId, number>;
    stakes: { stake: number; n: number }[];
    roomsMade: number;
  };
  quick: {
    joined: number;
    joinMissed: number;
    paired: number;
    pairedWaits: Record<number, number>;
    pairedAvgS: number | null;
    left: number;
    leftWaits: Record<number, number>;
    leftAvgS: number | null;
  };
  extra: {
    notifyPhones: number;
    reminders: number | null;
    appealsOpen: number;
    savedFromAsk: number;
    pushOn: Record<PushFrom, number>;
  };
  usage: Usage | null;
}

export type DayResult = { day: string; report?: Report; error?: string };
export interface RangeResult { copy: Copy; today: string; days: DayResult[] }

export interface PlayerSummary {
  id: string;
  name: string;
  avatar: string;
  state: string;
  cowries: number;
  aura: number;
  rating: number;
  saved: boolean;
  ban: { at: number; reason: string } | null;
  terms: { version: string; at: number | null } | null;
  createdAt: number;
}

export interface Profile {
  id: string;
  name: string;
  state: string;
  rating: number;
  aura: number;
  level: number;
  cowries: number;
  wins: number;
  losses: number;
  draws: number;
  quickGames: number;
  dayStreak: number;
  bestWinStreak: number;
  lastPlayedDay: string | null;
  createdAt: number;
  saved: boolean;
  ban: { at: number; reason: string } | null;
}

export interface PlayerDetail {
  profile: Profile;
  identities: { provider: string; email: string | null; createdAt: number }[];
  ledger: { delta: number; reason: string; matchId: string | null; at: number }[];
  matches: {
    id: string;
    mode: string;
    kind: string;
    stake: number;
    paid: boolean;
    reason: string;
    score: string;
    at: number;
    result: 'win' | 'loss' | 'draw';
    opponent: { id: string; name: string | null };
  }[];
  samePhone: { id: string; name: string }[];
  appeals: { id: number; message: string; at: number; status: string; note: string | null; decidedAt: number | null }[];
  actions: { id: number; at: number; action: string; detail: Record<string, unknown> | null }[];
}

export interface Appeal {
  id: number;
  playerId: string;
  message: string;
  at: number;
  status: 'open' | 'lifted' | 'kept';
  note: string | null;
  decidedAt: number | null;
  name: string | null;
  bannedAt: number | null;
  banReason: string | null;
}

export interface AdminAction {
  id: number;
  at: number;
  action: string;
  playerId: string | null;
  detail: Record<string, unknown> | null;
}
