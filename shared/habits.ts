/**
 * The daily habit layer, modelled on Duolingo (docs/RETENTION.md): the day streak and what
 * protects it, streak milestones, the streak stake, daily quests, badges and weekly leagues.
 *
 * Everything here is pure, so the server and the browser agree on what a streak is worth
 * and both can be unit tested. The server is still the one that decides and saves.
 *
 * Days are Nigeria calendar days ("2026-10-15"), from dayKey() in progression.ts.
 */
import type { ModeId } from './modes';
import type { Kind, Result } from './progression';
import type { BotLevel } from './bot';

/* ------------------------------------------------------------------ days */

const DAY_MS = 86_400_000;
/** Whole days from a to b. "2026-10-14" to "2026-10-15" is 1. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
export const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
/** Keep the last two weeks of a day list, oldest first. */
const recent = (days: string[], today: string) => [...new Set(days)].filter((d) => daysBetween(d, today) < 14).sort();

/* ------------------------------------------------------------------ prices (Dara Seeds) */

/** A Streak Freeze covers one missed day. You can hold this many. */
export const FREEZE_MAX = 2;
export const FREEZE_PRICE = 200;
/** A streak that ended can be restored for this much, up to REPAIR_DAYS days after the last day played. */
export const REPAIR_PRICE = 500;
export const REPAIR_DAYS = 3;
/**
 * The streak stake (Duolingo's Streak Wager): put in BET_STAKE Dara Seeds, keep your
 * streak for BET_DAYS days, get BET_WIN back. The UI says "stake", never "bet" (docs/STAKES.md).
 */
export const BET_STAKE = 200;
export const BET_WIN = 400;
export const BET_DAYS = 7;

/* ------------------------------------------------------------------ what we keep per player */

export interface StreakBet {
  stake: number;
  /** Days played since placing it, including the day it was placed if you'd already played. */
  days: number;
  placed: string;
  status: 'on' | 'won' | 'lost';
  /** The day it was won or lost. */
  ended: string | null;
}

export interface QuestState {
  day: string;
  ids: QuestId[];
  /** Progress on each quest. The first one (win 3) is counted from today's wins instead. */
  p: number[];
}

export interface Counts {
  wins: number;
  fading: number;
  big: number;
  pro: number;
  agba: number;
  friends: number;
  quests: number;
}

export interface Habits {
  /** The last day the streak grew. */
  streakDay: string | null;
  freezes: number;
  /** Days a Streak Freeze or a restore covered, last two weeks. */
  frozen: string[];
  /** Days played, last two weeks. */
  played: string[];
  best: number;
  /** The biggest milestone already rewarded. */
  milestone: number;
  /** A streak that ended, while it can still be restored. */
  lost: { n: number; day: string } | null;
  bet: StreakBet | null;
  quests: QuestState | null;
  counts: Counts;
  /** Zones of players you have beaten. */
  zones: string[];
  /** Stars already rewarded, per badge. */
  badges: Record<string, number>;
  league: { week: string; tier: number; group: string } | null;
  lastLeague: { week: string; rank: number; tier: number; moved: LeagueMove } | null;
}

export const emptyHabits = (): Habits => ({
  streakDay: null,
  freezes: 0,
  frozen: [],
  played: [],
  best: 0,
  milestone: 0,
  lost: null,
  bet: null,
  quests: null,
  counts: { wins: 0, fading: 0, big: 0, pro: 0, agba: 0, friends: 0, quests: 0 },
  zones: [],
  badges: {},
  league: null,
  lastLeague: null,
});

/** Reads whatever is stored, filling in anything missing. */
export function parseHabits(raw: string | null | undefined): Habits {
  const base = emptyHabits();
  if (!raw) return base;
  try {
    const h = JSON.parse(raw) as Partial<Habits>;
    return { ...base, ...h, counts: { ...base.counts, ...(h.counts ?? {}) }, badges: { ...(h.badges ?? {}) } };
  } catch {
    return base;
  }
}

/* ------------------------------------------------------------------ the streak */

export interface StreakNow {
  /** The streak as it stands today. 0 once it has ended. */
  streak: number;
  playedToday: boolean;
  /** Missed days a Streak Freeze is covering (used when you next play). */
  freezing: number;
  /** Freezes left after those. */
  freezes: number;
  /** A streak that ended and can still be restored, with how long is left to do it. */
  restorable: { n: number; until: string } | null;
}

/** The streak today, without playing. */
export function streakNow(h: Habits, streak: number, today: string): StreakNow {
  const canRestore = (n: number, last: string) =>
    n >= 2 && daysBetween(last, today) <= REPAIR_DAYS ? { n, until: addDays(last, REPAIR_DAYS) } : null;
  // A streak that ended earlier, while you've already started a new one.
  const earlier = h.lost ? canRestore(h.lost.n, h.lost.day) : null;
  if (!h.streakDay || streak <= 0) return { streak: 0, playedToday: false, freezing: 0, freezes: h.freezes, restorable: earlier };
  const gap = daysBetween(h.streakDay, today);
  if (gap <= 0) return { streak, playedToday: true, freezing: 0, freezes: h.freezes, restorable: earlier };
  const missed = gap - 1;
  if (missed <= h.freezes) return { streak, playedToday: false, freezing: missed, freezes: h.freezes - missed, restorable: earlier };
  return { streak: 0, playedToday: false, freezing: 0, freezes: h.freezes, restorable: canRestore(streak, h.streakDay) };
}

export const MILESTONES: { days: number; aura: number; freeze: number }[] = [
  { days: 3, aura: 20, freeze: 0 },
  { days: 7, aura: 50, freeze: 1 },
  { days: 14, aura: 100, freeze: 0 },
  { days: 30, aura: 200, freeze: 1 },
  { days: 50, aura: 300, freeze: 0 },
  { days: 100, aura: 500, freeze: 1 },
];

/** The milestone for a streak length, if it is one. Every 100 days after 100 is one too. */
export function milestoneAt(days: number) {
  const m = MILESTONES.find((x) => x.days === days);
  if (m) return m;
  return days > 100 && days % 100 === 0 ? { days, aura: 500, freeze: 1 } : null;
}

/** The next milestone above a streak. */
export function nextMilestone(days: number) {
  return MILESTONES.find((x) => x.days > days) ?? { days: (Math.floor(days / 100) + 1) * 100, aura: 500, freeze: 1 };
}

export interface StreakStep {
  streak: number;
  /** First match today: the streak grew (or started). */
  extended: boolean;
  usedFreezes: number;
  /** The streak that ended on this play, or 0. */
  broke: number;
  milestone: { days: number; aura: number; freeze: number } | null;
  bet: { result: 'won'; paid: number } | { result: 'lost' } | { result: 'progress'; days: number } | null;
}

/** Plays a match today. Changes `h` and returns what happened. */
export function playStreak(h: Habits, streak: number, today: string): StreakStep {
  h.played = recent([...h.played, today], today);
  if (h.streakDay === today) return { streak, extended: false, usedFreezes: 0, broke: 0, milestone: null, bet: null };

  let next = 1;
  let usedFreezes = 0;
  let broke = 0;
  if (h.streakDay && streak > 0) {
    const missed = daysBetween(h.streakDay, today) - 1;
    if (missed <= 0) next = streak + 1;
    else if (missed <= h.freezes) {
      next = streak + 1;
      usedFreezes = missed;
      h.freezes -= missed;
      for (let i = 1; i <= missed; i++) h.frozen.push(addDays(h.streakDay, i));
    } else {
      broke = streak;
      h.lost = { n: streak, day: h.streakDay };
    }
  }
  h.frozen = recent(h.frozen, today);
  h.streakDay = today;
  h.best = Math.max(h.best, next);

  // A new streak can earn the early milestones again.
  if (next === 1) h.milestone = 0;
  let milestone: StreakStep['milestone'] = null;
  const m = milestoneAt(next);
  if (m && m.days > h.milestone) {
    milestone = m;
    h.milestone = m.days;
    h.freezes = Math.min(FREEZE_MAX, h.freezes + m.freeze);
  }

  let bet: StreakStep['bet'] = null;
  if (h.bet?.status === 'on') {
    if (broke) {
      h.bet = { ...h.bet, status: 'lost', ended: today };
      bet = { result: 'lost' };
    } else {
      const days = h.bet.days + 1;
      if (days >= BET_DAYS) {
        h.bet = { ...h.bet, days, status: 'won', ended: today };
        bet = { result: 'won', paid: BET_WIN };
      } else {
        h.bet = { ...h.bet, days };
        bet = { result: 'progress', days };
      }
    }
  }
  return { streak: next, extended: true, usedFreezes, broke, milestone, bet };
}

/**
 * Restores an ended streak (after paying). The missed days count as covered, like a
 * Streak Freeze. If you've already started a new streak since, the two join up.
 */
export function restoreStreak(h: Habits, streak: number, today: string): { ok: boolean; streak: number } {
  const now = streakNow(h, streak, today);
  if (!now.restorable) return { ok: false, streak };
  const cover = (from: string, to: string) => {
    for (let d = addDays(from, 1); daysBetween(d, to) > 0; d = addDays(d, 1)) h.frozen.push(d);
  };
  let restored: number;
  if (now.streak === 0 && h.streakDay) {
    // Ended, and nothing played since: cover up to yesterday, so playing today adds a day.
    cover(h.streakDay, today);
    h.streakDay = addDays(today, -1);
    restored = streak;
  } else {
    // Ended earlier, and a new streak has started: join the two.
    const lost = h.lost!;
    const kept = new Set([...h.played, ...h.frozen]);
    let start = h.streakDay!;
    while (kept.has(addDays(start, -1)) && daysBetween(lost.day, addDays(start, -1)) > 0) start = addDays(start, -1);
    cover(lost.day, start);
    restored = lost.n + now.streak;
  }
  h.frozen = recent(h.frozen, today);
  h.lost = null;
  h.best = Math.max(h.best, restored);
  if (h.bet?.status === 'on') h.bet = { ...h.bet, status: 'lost', ended: today };
  return { ok: true, streak: restored };
}

/** The bet as it stands today: a streak that ended takes the bet with it. */
export function betNow(h: Habits, streak: number, today: string): StreakBet | null {
  if (!h.bet) return null;
  if (h.bet.status === 'on' && streakNow(h, streak, today).streak === 0) return { ...h.bet, status: 'lost', ended: today };
  return h.bet;
}

/** Old bets stop showing a few days after they end. */
export const showBet = (b: StreakBet | null, today: string) =>
  !!b && (b.status === 'on' || (b.ended !== null && daysBetween(b.ended, today) <= 2));

/* ------------------------------------------------------------------ daily quests */

export interface MatchEvent {
  kind: Kind;
  mode: ModeId;
  result: Result;
  level?: BotLevel;
  /** The other player's state, for a human opponent. */
  oppState?: string;
}

export type QuestId = 'win3' | 'play2' | 'winFading' | 'winBig' | 'friend' | 'beatSharp' | 'winQuick' | 'classic2' | 'playPro';

export const QUESTS: Record<QuestId, { title: string; target: number; aura: number; count: (e: MatchEvent) => number }> = {
  win3: { title: 'Win 3 matches', target: 3, aura: 50, count: (e) => (e.result === 'win' ? 1 : 0) },
  play2: { title: 'Play 2 matches', target: 2, aura: 20, count: () => 1 },
  winFading: { title: 'Win a Fading match', target: 1, aura: 30, count: (e) => (e.mode === 'fading' && e.result === 'win' ? 1 : 0) },
  winBig: { title: 'Win a Big match', target: 1, aura: 30, count: (e) => (e.mode === 'big' && e.result === 'win' ? 1 : 0) },
  friend: { title: 'Play a match with a friend', target: 1, aura: 30, count: (e) => (e.kind === 'friend' ? 1 : 0) },
  beatSharp: {
    title: 'Beat Baba Ayo on Sharp-sharp or Agba',
    target: 1,
    aura: 30,
    count: (e) => (e.kind === 'bot' && e.result === 'win' && (e.level === 'sharp' || e.level === 'agba') ? 1 : 0),
  },
  winQuick: { title: 'Win a quick match', target: 1, aura: 30, count: (e) => (e.kind === 'quick' && e.result === 'win' ? 1 : 0) },
  classic2: { title: 'Play 2 Classic matches', target: 2, aura: 20, count: (e) => (e.mode === 'classic' ? 1 : 0) },
  playPro: { title: 'Play a Pro match', target: 1, aura: 30, count: (e) => (e.mode === 'pro' ? 1 : 0) },
};

const POOL: QuestId[] = ['play2', 'winFading', 'winBig', 'friend', 'beatSharp', 'winQuick', 'classic2', 'playPro'];

/** A small, stable hash, so a player gets the same quests all day on any phone. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Today's three quests: win 3 matches, plus two that change every day. */
export function questsFor(playerId: string, day: string): QuestId[] {
  const h = hash(`${playerId}:${day}`);
  const a = POOL[h % POOL.length];
  const rest = POOL.filter((q) => q !== a);
  const b = rest[Math.floor(h / POOL.length) % rest.length];
  return ['win3', a, b];
}

/** Today's quests and progress. `dayWins` is the server's count of today's wins. */
export function questsToday(h: Habits, playerId: string, today: string, dayWins: number) {
  const ids = h.quests?.day === today ? h.quests.ids : questsFor(playerId, today);
  const p = h.quests?.day === today ? h.quests.p : ids.map(() => 0);
  return ids.map((id, i) => {
    const q = QUESTS[id];
    const progress = Math.min(q.target, id === 'win3' ? dayWins : (p[i] ?? 0));
    return { id, title: q.title, target: q.target, aura: q.aura, progress, done: progress >= q.target };
  });
}

/**
 * Counts a match toward today's quests. Returns the quests it finished. The first quest
 * (win 3) is paid by the daily goal bonus on the server, so it is not paid twice here.
 */
export function playQuests(h: Habits, playerId: string, today: string, e: MatchEvent, dayWinsBefore: number) {
  if (h.quests?.day !== today) h.quests = { day: today, ids: questsFor(playerId, today), p: [0, 0, 0] };
  const done: { id: QuestId; aura: number; paid: boolean }[] = [];
  h.quests.ids.forEach((id, i) => {
    const q = QUESTS[id];
    const before = id === 'win3' ? dayWinsBefore : h.quests!.p[i];
    const after = Math.min(q.target, before + q.count(e));
    if (id !== 'win3') h.quests!.p[i] = after;
    if (before < q.target && after >= q.target) done.push({ id, aura: q.aura, paid: id !== 'win3' });
  });
  h.counts.quests += done.length;
  return done;
}

/* ------------------------------------------------------------------ badges */

export interface Badge { id: string; name: string; what: string; stars: [number, number, number] }

export const BADGES: Badge[] = [
  { id: 'streak', name: 'On fire', what: 'Reach a day streak of', stars: [7, 30, 100] },
  { id: 'wins', name: 'Winner', what: 'Win matches', stars: [10, 50, 200] },
  { id: 'quests', name: 'Quest hero', what: 'Finish daily quests', stars: [10, 50, 200] },
  { id: 'friends', name: 'Squad', what: 'Play matches with friends', stars: [1, 10, 50] },
  { id: 'zones', name: 'Across Nigeria', what: 'Beat players from different zones', stars: [2, 4, 6] },
  { id: 'fading', name: 'Fading master', what: 'Win Fading matches', stars: [5, 25, 100] },
  { id: 'big', name: 'Big board', what: 'Win Big matches', stars: [5, 25, 100] },
  { id: 'pro', name: 'Pro', what: 'Win Pro matches', stars: [1, 10, 50] },
  { id: 'agba', name: 'Beat the master', what: 'Beat Baba Ayo on Agba', stars: [1, 5, 20] },
];

/** Aura for reaching each star. */
export const STAR_AURA = [25, 75, 150] as const;

export function badgeValue(h: Habits, id: string) {
  switch (id) {
    case 'streak': return h.best;
    case 'zones': return h.zones.length;
    default: return h.counts[id as keyof Counts] ?? 0;
  }
}

export function badgeStars(b: Badge, value: number) {
  return b.stars.filter((t) => value >= t).length;
}

/** Counts a match toward badges. Returns the stars it newly earned. */
export function playBadges(h: Habits, e: MatchEvent, oppZone: string | null) {
  if (e.result === 'win') {
    h.counts.wins++;
    if (e.mode === 'fading') h.counts.fading++;
    if (e.mode === 'big') h.counts.big++;
    if (e.mode === 'pro') h.counts.pro++;
    if (e.kind === 'bot' && e.level === 'agba') h.counts.agba++;
    if (e.kind !== 'bot' && oppZone && !h.zones.includes(oppZone)) h.zones.push(oppZone);
  }
  if (e.kind === 'friend') h.counts.friends++;
  return claimBadges(h);
}

/** Pays out any stars reached but not yet rewarded. */
export function claimBadges(h: Habits) {
  const earned: { id: string; name: string; star: number; aura: number }[] = [];
  for (const b of BADGES) {
    const stars = badgeStars(b, badgeValue(h, b.id));
    for (let s = (h.badges[b.id] ?? 0) + 1; s <= stars; s++) earned.push({ id: b.id, name: b.name, star: s, aura: STAR_AURA[s - 1] });
    if (stars > (h.badges[b.id] ?? 0)) h.badges[b.id] = stars;
  }
  return earned;
}

/* ------------------------------------------------------------------ weekly leagues */

/** Lowest to highest. Named after Nigerian landmarks. */
export const LEAGUES = ['Ikogosi', 'Olumo', 'Idanre', 'Obudu', 'Yankari', 'Zuma'] as const;
export const LEAGUE_SIZE = 30;
/** Baba Ayo's Aura by the end of the week, per league. He sets the pace when a league is small. */
export const BABA_PACE = [150, 300, 500, 800, 1200, 1800] as const;

export type LeagueMove = 'up' | 'down' | 'stay';

/** The Monday a week starts on, Nigeria time. Weeks run Monday to Sunday. */
export function weekKey(day: string) {
  const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday 0
  return addDays(day, -dow);
}

/** When a week ends, in milliseconds: Monday 00:00 Nigeria time (23:00 UTC on Sunday). */
export const weekEndsAt = (week: string) => Date.parse(`${addDays(week, 7)}T00:00:00Z`) - 3_600_000;

/** Baba Ayo's Aura at a moment in the week: a steady climb, a little each hour. */
export function babaAura(tier: number, week: string, now: number) {
  const start = weekEndsAt(week) - 7 * DAY_MS;
  const f = Math.min(1, Math.max(0, (now - start) / (7 * DAY_MS)));
  return Math.round(BABA_PACE[tier] * f);
}

/**
 * How many of a league move up and down at the end of the week. `players` counts real
 * players with Aura this week. Baba Ayo is in the table but never moves. Small leagues
 * promote at least one; nobody drops out of a league of fewer than 10. In a league of
 * fewer than 5, you also have to finish above Baba Ayo to move up.
 */
export function leagueZones(players: number, tier: number) {
  const up = tier >= LEAGUES.length - 1 || players === 0 ? 0 : Math.min(7, Math.max(1, Math.round(players * 0.25)));
  const down = tier === 0 || players < 10 ? 0 : Math.min(5, Math.max(1, Math.round(players * 0.2)));
  return { up, down, beatBaba: players < 5 };
}

/** Where a finishing position moves you. Positions count real players only, from 1. */
export function leagueMove(position: number, players: number, tier: number, aura = Infinity, baba = 0): LeagueMove {
  const { up, down, beatBaba } = leagueZones(players, tier);
  if (position <= up && (!beatBaba || aura > baba)) return 'up';
  if (down && position > players - down) return 'down';
  return 'stay';
}
