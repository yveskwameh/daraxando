/**
 * The daily habit layer on the server: what a finished match does to your streak, quests,
 * badges and league, plus the Streak Freeze, restore and streak stake purchases, weekly
 * leagues and friend streaks. The rules themselves are in shared/habits.ts.
 *
 * Every write to a player's habits checks the version it read (`habit_v`), so two matches
 * finishing at the same moment can't overwrite each other: the second one reads again and
 * retries. Anything that moves cowries is written in the same batch, with the same check,
 * so it lands exactly once.
 */
import {
  BABA_PACE, BET_DAYS, BET_STAKE, QUESTS, FREEZE_MAX, FREEZE_PRICE, LEAGUE_SIZE, REPAIR_PRICE, babaAura, betNow,
  leagueMove, leagueZones, parseHabits, playBadges, playQuests, playStreak, restoreStreak, showBet, streakNow,
  weekEndsAt, weekKey, type Habits, type MatchEvent,
} from '../shared/habits';
import { zoneOf } from '../shared/places';
import { dayKey } from '../shared/progression';
import type { FriendView, FriendsData, HabitOutcome, LeagueData, LeagueRow } from '../shared/protocol';
import { BOT } from '../shared/protocol';

interface HabitRow {
  id: string;
  habits: string;
  habit_v: number;
  day_streak: number;
  cowries: number;
}

const read = (db: D1Database, id: string) =>
  db.prepare('SELECT id, habits, habit_v, day_streak, cowries FROM players WHERE id = ?').bind(id).first<HabitRow>();

/* ------------------------------------------------------------------ after a match */

export interface AfterMatch extends HabitOutcome {
  aura: number;
  cowries: number;
}

/**
 * Applies a finished match to the player's streak, quests, badges, bet and league.
 * `aura` is what the match itself already paid (match Aura plus the daily goal bonus), so
 * the league counts it too. `dayWinsBefore` is today's wins before this match.
 */
export async function afterMatch(
  db: D1Database,
  id: string,
  e: MatchEvent,
  opts: { aura: number; dayWinsBefore: number },
  now = Date.now(),
): Promise<AfterMatch | null> {
  const today = dayKey(now);
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await read(db, id);
    if (!row) return null;
    const h = parseHabits(row.habits);
    const step = playStreak(h, row.day_streak, today);
    const quests = playQuests(h, id, today, e, opts.dayWinsBefore);
    const badges = playBadges(h, e, e.oppState ? zoneOf(e.oppState) : null);
    const extraAura =
      (step.milestone?.aura ?? 0) + quests.filter((q) => q.paid).reduce((n, q) => n + q.aura, 0) + badges.reduce((n, b) => n + b.aura, 0);
    const betPaid = step.bet?.result === 'won' ? step.bet.paid : 0;
    const league = await joinLeague(db, id, h, today);

    const v = row.habit_v;
    const statements: D1PreparedStatement[] = [];
    if (betPaid) {
      statements.push(
        db.prepare("INSERT INTO ledger (player_id, delta, reason, created_at) SELECT id, ?, 'streak-win', ? FROM players WHERE id = ? AND habit_v = ?")
          .bind(betPaid, now, id, v),
      );
    }
    statements.push(
      db.prepare(
        `INSERT INTO league_entries (week, player_id, tier, grp, aura, updated_at)
         SELECT ?, id, ?, ?, ?, ? FROM players WHERE id = ? AND habit_v = ?
         ON CONFLICT (week, player_id) DO UPDATE SET aura = aura + excluded.aura, updated_at = excluded.updated_at`,
      ).bind(league.week, league.tier, league.group, opts.aura + extraAura, now, id, v),
      db.prepare(
        `UPDATE players SET habits = ?, habit_v = habit_v + 1, day_streak = ?, aura = aura + ?, cowries = cowries + ?, updated_at = ?
         WHERE id = ? AND habit_v = ? RETURNING aura, cowries`,
      ).bind(JSON.stringify(h), step.streak, extraAura, betPaid, now, id, v),
    );
    const results = await db.batch<{ aura: number; cowries: number }>(statements);
    const done = results.at(-1)?.results?.[0];
    if (!done) continue; // someone else wrote first: read again
    await playFriendStreaks(db, id, today);
    return {
      aura: done.aura,
      cowries: done.cowries,
      streak: step.streak,
      extended: step.extended,
      usedFreezes: step.usedFreezes,
      broke: step.broke,
      milestone: step.milestone,
      bet: step.bet,
      quests: quests.map((q) => ({ id: q.id, title: QUESTS[q.id].title, aura: q.aura })),
      badges,
      extraAura,
    };
  }
  console.error('Could not save habits after retries', id);
  return null;
}

/* ------------------------------------------------------------------ Streak Freeze, restore, bet */

type Purchase = { ok: true } | { ok: false; error: string };

/**
 * Spends cowries on something for the streak. `change` edits the habits and returns an
 * error message or null; `streak` is the new streak length.
 */
async function spend(
  db: D1Database,
  id: string,
  price: number,
  reason: 'freeze' | 'repair' | 'streak-stake',
  change: (h: Habits, streak: number, today: string) => { error: string } | { streak: number },
  now = Date.now(),
): Promise<Purchase> {
  const today = dayKey(now);
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await read(db, id);
    if (!row) return { ok: false, error: 'Player not found.' };
    if (row.cowries < price) return { ok: false, error: `You need ${price.toLocaleString('en-US')} Dara Seeds for that.` };
    const h = parseHabits(row.habits);
    const out = change(h, row.day_streak, today);
    if ('error' in out) return { ok: false, error: out.error };
    const v = row.habit_v;
    const [, updated] = await db.batch<{ id: string }>([
      db.prepare('INSERT INTO ledger (player_id, delta, reason, created_at) SELECT id, ?, ?, ? FROM players WHERE id = ? AND habit_v = ? AND cowries >= ?')
        .bind(-price, reason, now, id, v, price),
      db.prepare(
        'UPDATE players SET habits = ?, habit_v = habit_v + 1, day_streak = ?, cowries = cowries - ?, updated_at = ? WHERE id = ? AND habit_v = ? AND cowries >= ? RETURNING id',
      ).bind(JSON.stringify(h), out.streak, price, now, id, v, price),
    ]);
    if (updated.results?.length) return { ok: true };
  }
  return { ok: false, error: 'Something changed at the same time. Try again.' };
}

export const buyFreeze = (db: D1Database, id: string, now = Date.now()) =>
  spend(db, id, FREEZE_PRICE, 'freeze', (h, streak, today) => {
    // Freezes already covering a missed day don't count toward the limit.
    if (streakNow(h, streak, today).freezes >= FREEZE_MAX) return { error: `You can hold ${FREEZE_MAX} Streak Freezes at a time.` };
    h.freezes++;
    return { streak };
  }, now);

export const restore = (db: D1Database, id: string, now = Date.now()) =>
  spend(db, id, REPAIR_PRICE, 'repair', (h, streak, today) => {
    const r = restoreStreak(h, streak, today);
    return r.ok ? { streak: r.streak } : { error: 'There is no streak to restore right now.' };
  }, now);

export const placeBet = (db: D1Database, id: string, now = Date.now()) =>
  spend(db, id, BET_STAKE, 'streak-stake', (h, streak, today) => {
    if (betNow(h, streak, today)?.status === 'on') return { error: 'You already have a streak stake going.' };
    const now = streakNow(h, streak, today);
    if (now.streak < 1) return { error: 'Play a match first to start a streak, then place your stake.' };
    const playedToday = now.playedToday;
    h.bet = { stake: BET_STAKE, days: playedToday ? 1 : 0, placed: today, status: 'on', ended: null };
    return { streak };
  }, now);

/** Bets that ended a while ago are tidied away when the profile is read. */
export const tidyHabits = (h: Habits, today: string) => (h.bet && !showBet(h.bet, today) ? { ...h, bet: null } : h);

/* ------------------------------------------------------------------ weekly leagues */

/**
 * Puts the player in this week's league if they aren't yet: works out where last week left
 * them (up, down or the same league), then finds a group with room. Changes `h`.
 */
async function joinLeague(db: D1Database, id: string, h: Habits, today: string) {
  const week = weekKey(today);
  if (h.league?.week === week) return { week, tier: h.league.tier, group: h.league.group };

  let tier = 0;
  if (h.league) {
    const prev = h.league;
    tier = prev.tier;
    const { results } = await db.prepare('SELECT player_id, aura FROM league_entries WHERE grp = ? AND aura > 0 ORDER BY aura DESC, updated_at ASC')
      .bind(prev.group).all<{ player_id: string; aura: number }>();
    const position = results.findIndex((r) => r.player_id === id) + 1;
    if (position > 0) {
      const moved = leagueMove(position, results.length, prev.tier, results[position - 1].aura, BABA_PACE[prev.tier]);
      tier = Math.max(0, Math.min(BABA_PACE.length - 1, prev.tier + (moved === 'up' ? 1 : moved === 'down' ? -1 : 0)));
      h.lastLeague = { week: prev.week, rank: position, tier: prev.tier, moved };
    }
  }

  const open = await db.prepare(
    'SELECT grp, COUNT(*) AS n FROM league_entries WHERE week = ? AND tier = ? GROUP BY grp HAVING n < ? ORDER BY n DESC LIMIT 1',
  ).bind(week, tier, LEAGUE_SIZE).first<{ grp: string; n: number }>();
  const group = open?.grp ?? `${week}|${tier}|${crypto.randomUUID().slice(0, 8)}`;
  h.league = { week, tier, group };
  return { week, tier, group };
}

/** This week's league table for a player, with Baba Ayo setting the pace. */
export async function leagueFor(db: D1Database, id: string, now = Date.now()): Promise<LeagueData> {
  const today = dayKey(now);
  const week = weekKey(today);
  const row = await read(db, id);
  const h = parseHabits(row?.habits);
  const mine = h.league?.week === week ? h.league : null;
  const tier = mine?.tier ?? (h.league ? h.league.tier : 0);
  let rows: LeagueRow[] | null = null;
  let players = 0;
  if (mine) {
    const { results } = await db.prepare(
      `SELECT p.id, p.name, p.avatar, p.print, p.state, l.aura FROM league_entries l JOIN players p ON p.id = l.player_id
       WHERE l.grp = ? ORDER BY l.aura DESC, l.updated_at ASC LIMIT ?`,
    ).bind(mine.group, LEAGUE_SIZE).all<LeagueRow>();
    players = results.filter((r) => r.aura > 0).length;
    rows = [...results];
    const baba: LeagueRow = { id: BOT.id, name: BOT.name, avatar: BOT.avatar, print: BOT.print, state: BOT.state, aura: babaAura(tier, week, now), bot: true };
    const at = rows.findIndex((r) => r.aura < baba.aura);
    rows.splice(at === -1 ? rows.length : at, 0, baba);
  }
  const { up, down, beatBaba } = leagueZones(players, tier);
  return { week, endsAt: weekEndsAt(week), tier, rows, up, down, beatBaba, last: h.lastLeague };
}

/* ------------------------------------------------------------------ friend streaks */

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]);
export const FRIEND_MAX = 5;

/** Counts today for every friend streak the player is in. Both playing on a day keeps it going. */
async function playFriendStreaks(db: D1Database, id: string, today: string) {
  const yesterday = dayKey(Date.parse(`${today}T12:00:00Z`) - 86_400_000);
  await db.prepare(
    `UPDATE friend_streaks SET
       count = CASE
         WHEN last_day = ?2 THEN count
         WHEN (CASE WHEN a = ?1 THEN b_day ELSE a_day END) = ?2 THEN (CASE WHEN last_day = ?3 THEN count + 1 ELSE 1 END)
         ELSE count END,
       last_day = CASE
         WHEN last_day = ?2 THEN last_day
         WHEN (CASE WHEN a = ?1 THEN b_day ELSE a_day END) = ?2 THEN ?2
         ELSE last_day END,
       a_day = CASE WHEN a = ?1 THEN ?2 ELSE a_day END,
       b_day = CASE WHEN b = ?1 THEN ?2 ELSE b_day END
     WHERE status = 'active' AND (a = ?1 OR b = ?1)`,
  ).bind(id, today, yesterday).run();
}

interface FriendRow {
  a: string; b: string; from_id: string; status: string; count: number; last_day: string | null; a_day: string | null; b_day: string | null;
  id: string; name: string; avatar: string; print: string; state: string;
}

export async function friendsOf(db: D1Database, id: string, now = Date.now()): Promise<FriendsData> {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const { results } = await db.prepare(
    `SELECT f.*, p.id, p.name, p.avatar, p.print, p.state FROM friend_streaks f
     JOIN players p ON p.id = CASE WHEN f.a = ?1 THEN f.b ELSE f.a END
     WHERE f.a = ?1 OR f.b = ?1 ORDER BY f.count DESC, f.created_at ASC`,
  ).bind(id).all<FriendRow>();
  const friends: FriendView[] = results.map((r) => {
    const mineA = r.a === id;
    const alive = r.last_day === today || r.last_day === yesterday;
    return {
      id: r.id, name: r.name, avatar: r.avatar, print: r.print, state: r.state,
      status: r.status === 'active' ? 'active' : r.from_id === id ? 'outgoing' : 'incoming',
      count: alive ? r.count : 0,
      youToday: (mineA ? r.a_day : r.b_day) === today,
      themToday: (mineA ? r.b_day : r.a_day) === today,
    };
  });
  const known = new Set([id, ...friends.map((f) => f.id)]);
  const { results: opp } = await db.prepare(
    `SELECT p.id, p.name, p.avatar, p.print, p.state, MAX(m.created_at) AS at FROM matches m
     JOIN players p ON p.id = CASE WHEN m.x_id = ?1 THEN m.o_id ELSE m.x_id END
     WHERE (m.x_id = ?1 OR m.o_id = ?1) AND m.kind != 'bot' GROUP BY p.id ORDER BY at DESC LIMIT 12`,
  ).bind(id).all<FriendsData['recent'][number] & { at: number }>();
  const recent = opp.filter((r) => !known.has(r.id)).slice(0, 6).map(({ id: oid, name, avatar, print, state }) => ({ id: oid, name, avatar, print, state }));
  return { friends, recent };
}

/** Ask someone for a friend streak, or accept theirs. */
export async function askFriend(db: D1Database, me: string, other: string, now = Date.now()): Promise<Purchase> {
  if (me === other) return { ok: false, error: "That's you." };
  const exists = await db.prepare('SELECT id FROM players WHERE id = ?').bind(other).first();
  if (!exists) return { ok: false, error: 'Player not found.' };
  const [a, b] = pair(me, other);
  const row = await db.prepare('SELECT from_id, status FROM friend_streaks WHERE a = ? AND b = ?').bind(a, b).first<{ from_id: string; status: string }>();
  if (row?.status === 'active') return { ok: true };
  if (row && row.from_id !== me) {
    // They asked first: this accepts. If you've both already played today, today counts.
    const today = dayKey(now);
    await db.prepare(
      `UPDATE friend_streaks SET status = 'active',
         a_day = (SELECT last_played_day FROM players WHERE id = ?1),
         b_day = (SELECT last_played_day FROM players WHERE id = ?2),
         count = CASE WHEN (SELECT last_played_day FROM players WHERE id = ?1) = ?3 AND (SELECT last_played_day FROM players WHERE id = ?2) = ?3 THEN 1 ELSE 0 END,
         last_day = CASE WHEN (SELECT last_played_day FROM players WHERE id = ?1) = ?3 AND (SELECT last_played_day FROM players WHERE id = ?2) = ?3 THEN ?3 ELSE NULL END
       WHERE a = ?1 AND b = ?2`,
    ).bind(a, b, today).run();
    return { ok: true };
  }
  if (row) return { ok: true };
  const mine = await db.prepare("SELECT COUNT(*) AS n FROM friend_streaks WHERE (a = ?1 OR b = ?1) AND (status = 'active' OR from_id = ?1)").bind(me).first<{ n: number }>();
  if ((mine?.n ?? 0) >= FRIEND_MAX) return { ok: false, error: `You can have ${FRIEND_MAX} friend streaks at a time.` };
  await db.prepare("INSERT OR IGNORE INTO friend_streaks (a, b, from_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)").bind(a, b, me, now).run();
  return { ok: true };
}

/** Decline a request, cancel yours, or end a friend streak. */
export async function dropFriend(db: D1Database, me: string, other: string) {
  const [a, b] = pair(me, other);
  await db.prepare('DELETE FROM friend_streaks WHERE a = ? AND b = ?').bind(a, b).run();
}

export { BET_DAYS };
