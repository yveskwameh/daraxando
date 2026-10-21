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
  /** `until`: when a timed ban ends, or null for one that lasts until it's lifted. */
  ban: { at: number; reason: string; until?: number | null } | null;
  terms: { version: string; at: number | null } | null;
  createdAt: number;
  lastPlayedDay?: string | null;
  dayStreak?: number;
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
  ban: { at: number; reason: string; until?: number | null } | null;
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
  /** Everyone who has been on one of this player's phones, and how (since 19 October 2026). */
  linked?: Linked[];
  /** This player's phones, by the first 8 characters of their keyed hash. */
  phones?: { phone: string; how: PhoneHow; firstAt: number; lastAt: number }[];
  appeals: { id: number; message: string; at: number; status: string; note: string | null; decidedAt: number | null }[];
  actions: { id: number; at: number; action: string; detail: Record<string, unknown> | null }[];
  /** The days they finished a match in the last 12 weeks, and on how many days in all. */
  days?: { recent: string[]; total: number };
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

/* ---------- the dashboard's views of the whole game (the game's worker/adminViews.ts) ---------- */

/** `phoneLinks`: every phone a player uses is linked, and a phone makes 2 new players in 30 days (the game's worker/phones.ts). */
export interface Info { copy: string; timedBans: boolean; banDays: number[]; phoneLinks?: boolean }

export type PhoneHow = 'made' | 'signin' | 'seen';
/** A player linked to another through a phone. */
export interface Linked { id: string; name: string; createdAt: number; saved: boolean; cowries: number; banned: boolean; how: PhoneHow; phones: number; lastAt: number }
/** Phones with 2 or more players (the game's worker/adminViews.ts, sharedPhones). */
export interface SharedPhones {
  min: number;
  total: number;
  /** Phones with 3 or more players that gained one in the last day. */
  busy: number;
  phones: {
    id: string;
    players: number;
    newest: number;
    lastAt: number;
    made30: number;
    list: { id: string; name: string; how: PhoneHow; firstAt: number; lastAt: number; createdAt: number; cowries: number; saved: boolean; banned: boolean }[];
  }[];
}

export type Tab = 'all' | 'today' | 'new' | 'banned' | 'saved';
export type Sort = 'new' | 'active' | 'seeds' | 'aura' | 'rating' | 'name';
export type Counts = Record<Tab, number>;
export interface PlayerPage { players: PlayerSummary[]; page: number; size?: number; more: boolean; total: number }
export type PageSize = 25 | 50 | 100;

export interface Now { at: number; home: number | null; looking: number | null; waiting: number | null; playedToday: number }

export type Bucket = 'quarter' | 'hour' | 'day';
type Visits = { visits: number; views: number };
/** Traffic for a window (the game's worker/adminViews.ts traffic). */
export interface Traffic {
  window: { key: string; from: number; to: number; bucket: Bucket; before: number };
  players: { joined: number; finished: number; saved: number; before: number; savedAny: number };
  buckets: { at: number; joined: number; visits: number | null; views: number | null }[];
  /** Web Analytics, on the live game: the visits, or why there are none. */
  web: { off?: string; problem?: string; visits?: number; views?: number; before?: Visits; referers?: ({ host: string } & Visits)[]; countries?: ({ name: string } & Visits)[]; devices?: ({ name: string } & Visits)[] };
}

export interface Retention { today: string; weeks: { start: string; joined: number; played: number[] }[] }

export interface FirstDays { days: number; from: string; to: string; joined: number; finished: number; won: number; returned: number; threeDays: number; saved: number }
