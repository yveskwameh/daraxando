/**
 * Every D1 query in the project. The schema is in migrations/.
 *
 * Cost notes, because D1 bills per row: a finished online match writes about a dozen rows
 * (two player updates and their index entries, ledger rows, one match row). Ranks reads
 * through partial indexes, so the top 50 is a 50-row read, not a table scan.
 */
import { parseHabits } from '../shared/habits';
import { levelInfo, dayKey, DAILY_GOAL, GOAL_BONUS, START_RATING, type Kind, type Result } from '../shared/progression';
import type { StateCode } from '../shared/places';
import type { LeaderRow, Profile, PublicPlayer } from '../shared/protocol';
import { COOL_LOSSES, COOL_MS, DAILY_COWRIES, HIGH_TABLE, SAPA_BELOW, SAPA_EVERY_MS, SAPA_TO, START_COWRIES } from '../shared/stakes';
import { tidyHabits } from './habits';

interface PlayerRow {
  id: string;
  name: string;
  avatar: string;
  piece: string;
  print: string;
  state: string;
  rating: number;
  aura: number;
  cowries: number;
  wins: number;
  losses: number;
  draws: number;
  quick_games: number;
  win_streak: number;
  best_win_streak: number;
  day_streak: number;
  day_wins: number;
  last_played_day: string | null;
  sapa_at: number;
  cool_until: number;
  created_at: number;
  habits: string;
}

const toProfile = (r: PlayerRow): Profile => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  piece: r.piece,
  print: r.print,
  state: r.state as StateCode,
  rating: r.rating,
  aura: r.aura,
  level: levelInfo(r.aura).level,
  cowries: r.cowries,
  wins: r.wins,
  losses: r.losses,
  draws: r.draws,
  quickGames: r.quick_games,
  winStreak: r.win_streak,
  bestWinStreak: r.best_win_streak,
  dayStreak: r.day_streak,
  // Today's wins only count if the last match was today.
  dayWins: r.last_played_day === dayKey(Date.now()) ? r.day_wins : 0,
  lastPlayedDay: r.last_played_day,
  sapaAt: r.sapa_at,
  coolUntil: r.cool_until,
  createdAt: r.created_at,
  habits: tidyHabits(parseHabits(r.habits), dayKey(Date.now())),
});

export const toPublic = (p: Profile): PublicPlayer => ({
  id: p.id,
  name: p.name,
  avatar: p.avatar,
  piece: p.piece,
  print: p.print,
  state: p.state,
  rating: p.rating,
  level: p.level,
});

export async function getPlayer(db: D1Database, id: string): Promise<Profile | null> {
  const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<PlayerRow>();
  return row ? toProfile(row) : null;
}

export async function createPlayer(db: D1Database, p: { name: string; avatar: string; state: StateCode }): Promise<Profile> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const [, created] = await db.batch<PlayerRow>([
    db.prepare("INSERT INTO ledger (player_id, delta, reason, created_at) VALUES (?, ?, 'start', ?)").bind(id, START_COWRIES, now),
    db
      .prepare(
        'INSERT INTO players (id, name, avatar, state, rating, cowries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
      )
      .bind(id, p.name, p.avatar, p.state, START_RATING, START_COWRIES, now, now),
  ]);
  const row = created.results?.[0];
  if (!row) throw new Error('Could not create player');
  return toProfile(row);
}

export interface ProfilePatch { name?: string; avatar?: string; piece?: string; print?: string; state?: string }

export async function updatePlayer(db: D1Database, id: string, patch: ProfilePatch) {
  const row = await db
    .prepare(
      `UPDATE players SET name = COALESCE(?, name), avatar = COALESCE(?, avatar), piece = COALESCE(?, piece),
         print = COALESCE(?, print), state = COALESCE(?, state), updated_at = ? WHERE id = ? RETURNING *`,
    )
    .bind(patch.name ?? null, patch.avatar ?? null, patch.piece ?? null, patch.print ?? null, patch.state ?? null, Date.now(), id)
    .first<PlayerRow>();
  return row ? toProfile(row) : null;
}

/** Sapa relief. Null when it isn't due (balance not low enough, or claimed less than 4 hours ago). */
export async function claimSapa(db: D1Database, id: string, now = Date.now()) {
  const cut = now - SAPA_EVERY_MS;
  const [, updated] = await db.batch<PlayerRow>([
    db
      .prepare(
        "INSERT INTO ledger (player_id, delta, reason, created_at) SELECT id, ? - cowries, 'sapa', ? FROM players WHERE id = ? AND cowries < ? AND sapa_at <= ?",
      )
      .bind(SAPA_TO, now, id, SAPA_BELOW, cut),
    db
      .prepare('UPDATE players SET cowries = ?, sapa_at = ?, updated_at = ? WHERE id = ? AND cowries < ? AND sapa_at <= ? RETURNING *')
      .bind(SAPA_TO, now, now, id, SAPA_BELOW, cut),
  ]);
  const row = updated.results?.[0];
  return row ? toProfile(row) : null;
}

/** The top players, everywhere or in one state. Only people who have played a quick match. */
export async function leaderboard(db: D1Database, state: string | null, limit = 50): Promise<LeaderRow[]> {
  const where = state ? 'quick_games > 0 AND state = ?' : 'quick_games > 0';
  const stmt = db.prepare(`SELECT id, name, avatar, print, state, rating, aura FROM players WHERE ${where} ORDER BY rating DESC LIMIT ?`);
  const { results } = await (state ? stmt.bind(state, limit) : stmt.bind(limit))
    .all<Pick<PlayerRow, 'id' | 'name' | 'avatar' | 'print' | 'state' | 'rating' | 'aura'>>();
  // Standard competition ranking: equal ratings share a rank (1, 1, 3), which matches rankOf().
  let rank = 0;
  return results.map((r, i) => ({
    rank: i > 0 && r.rating === results[i - 1].rating ? rank : (rank = i + 1),
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    print: r.print,
    state: r.state,
    rating: r.rating,
    level: levelInfo(r.aura).level,
  }));
}

/** 1 for the best player. Ties share the better rank. */
export async function rankOf(db: D1Database, rating: number, state: string | null) {
  const where = state ? 'quick_games > 0 AND state = ? AND rating > ?' : 'quick_games > 0 AND rating > ?';
  const stmt = db.prepare(`SELECT COUNT(*) + 1 AS rank FROM players WHERE ${where}`);
  const row = await (state ? stmt.bind(state, rating) : stmt.bind(rating)).first<{ rank: number }>();
  return row?.rank ?? null;
}

/**
 * Holds each player's stake for the length of a match. All or nothing: if anyone is short,
 * whatever was taken goes straight back. Returns the ids that could not pay.
 */
export async function takeStakes(db: D1Database, matchId: string, ids: string[], stake: number, now = Date.now()) {
  if (!stake) return [];
  const statements = ids.flatMap((id) => [
    db
      .prepare("INSERT INTO ledger (player_id, delta, reason, match_id, created_at) SELECT id, ?, 'stake', ?, ? FROM players WHERE id = ? AND cowries >= ?")
      .bind(-stake, matchId, now, id, stake),
    db.prepare('UPDATE players SET cowries = cowries - ?, updated_at = ? WHERE id = ? AND cowries >= ? RETURNING id').bind(stake, now, id, stake),
  ]);
  const results = await db.batch<{ id: string }>(statements);
  const paid = ids.filter((_, k) => (results[k * 2 + 1].results?.length ?? 0) > 0);
  const short = ids.filter((id) => !paid.includes(id));
  if (short.length && paid.length) await refund(db, matchId, paid.map((id) => ({ id, amount: stake })), now);
  return short;
}

/** Gives held stakes back, for a match that was cancelled or never finished. */
export async function refund(db: D1Database, matchId: string, entries: { id: string; amount: number }[], now = Date.now()) {
  const list = entries.filter((e) => e.amount > 0);
  if (!list.length) return;
  await db.batch(
    list.flatMap(({ id, amount }) => [
      db.prepare("INSERT INTO ledger (player_id, delta, reason, match_id, created_at) VALUES (?, ?, 'refund', ?, ?)").bind(id, amount, matchId, now),
      db.prepare('UPDATE players SET cowries = cowries + ?, updated_at = ? WHERE id = ?').bind(amount, now, id),
    ]),
  );
}

export interface SeriesInput {
  id: string;
  result: Result;
  aura: number;
  /** The new rating after a quick match. Null leaves the rating alone. */
  rating: number | null;
  /** Cowries paid back at the end: the pot, a refunded stake, or 0. */
  payout: number;
  /** Friend and quick matches count toward wins, losses and win streaks. Baba Ayo games only give Aura. */
  online: boolean;
  quick: boolean;
  stake: number;
}

export interface SeriesOutput {
  aura: number;
  goalBonus: number;
  rating: number;
  cowries: number;
  daily: number;
  dayStreak: number;
  dayWins: number;
  winStreak: number;
}

export interface MatchRecord {
  id: string;
  mode: string;
  kind: Kind;
  stake: number;
  xId: string;
  oId: string;
  winner: 'X' | 'O' | null;
  reason: string;
  score: string;
  moves: string;
}

/**
 * Applies one finished match to every human player in it, plus the match row and the
 * ledger, in one batch so it all lands or none of it does. Streaks, the daily goal and
 * the daily cowries are worked out in SQL from the row as it is, so a player who finishes
 * two matches at the same moment can't be paid twice.
 */
export async function recordSeries(db: D1Database, inputs: SeriesInput[], match: MatchRecord | null, now = Date.now()) {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const matchId = match ? `${match.id}-${now}` : null;

  const perPlayer = inputs.map((p) => {
    const win = p.result === 'win' ? 1 : 0;
    const onlineWin = p.online && win ? 1 : 0;
    const onlineLoss = p.online && p.result === 'loss' ? 1 : 0;
    const onlineDraw = p.online && p.result === 'draw' ? 1 : 0;
    const high = p.stake >= HIGH_TABLE ? 1 : 0;
    const list = [
      // Read the row as it was, to report the daily cowries and goal bonus.
      db.prepare('SELECT id, daily_day, last_played_day, day_wins FROM players WHERE id = ?').bind(p.id),
      db
        .prepare("INSERT INTO ledger (player_id, delta, reason, match_id, created_at) SELECT id, ?, 'daily', ?, ? FROM players WHERE id = ? AND daily_day IS NOT ?")
        .bind(DAILY_COWRIES, matchId, now, p.id, today),
      db
        .prepare(
          `UPDATE players SET
             aura = aura + ?1 + CASE WHEN ?2 = 1 AND (CASE WHEN last_played_day = ?3 THEN day_wins ELSE 0 END) = ?4 - 1 THEN ?5 ELSE 0 END,
             rating = COALESCE(?6, rating),
             wins = wins + ?7,
             losses = losses + ?8,
             draws = draws + ?9,
             quick_games = quick_games + ?10,
             win_streak = CASE WHEN ?11 = 0 THEN win_streak WHEN ?7 = 1 THEN win_streak + 1 WHEN ?9 = 1 THEN win_streak ELSE 0 END,
             best_win_streak = MAX(best_win_streak, CASE WHEN ?11 = 1 AND ?7 = 1 THEN win_streak + 1 ELSE 0 END),
             day_wins = (CASE WHEN last_played_day = ?3 THEN day_wins ELSE 0 END) + ?2,
             last_played_day = ?3,
             cowries = cowries + ?13 + CASE WHEN daily_day IS ?3 THEN 0 ELSE ?14 END,
             daily_day = ?3,
             big_losses = CASE WHEN ?15 = 0 THEN big_losses WHEN ?8 = 1 THEN (CASE WHEN big_losses + 1 >= ?16 THEN 0 ELSE big_losses + 1 END) ELSE 0 END,
             cool_until = CASE WHEN ?15 = 1 AND ?8 = 1 AND big_losses + 1 >= ?16 THEN ?17 + ?18 ELSE cool_until END,
             updated_at = ?17
           WHERE id = ?19
           RETURNING id, aura, rating, cowries, day_streak, day_wins, win_streak`,
        )
        .bind(
          p.aura, win, today, DAILY_GOAL, GOAL_BONUS, p.rating, onlineWin, onlineLoss, onlineDraw, p.quick ? 1 : 0,
          p.online ? 1 : 0, yesterday, p.payout, DAILY_COWRIES, high, COOL_LOSSES, now, COOL_MS, p.id,
        ),
    ];
    if (p.payout > 0) {
      list.push(
        db
          .prepare('INSERT INTO ledger (player_id, delta, reason, match_id, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(p.id, p.payout, p.result === 'win' ? 'pot' : 'refund', matchId, now),
      );
    }
    return list;
  });

  const statements = perPlayer.flat();
  if (match) {
    statements.push(
      db
        .prepare(
          'INSERT INTO matches (id, mode, kind, stake, x_id, o_id, winner, reason, score, moves, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(matchId, match.mode, match.kind, match.stake, match.xId, match.oId, match.winner, match.reason, match.score, match.moves, now),
    );
  }

  const results = await db.batch<Record<string, unknown>>(statements);
  const out = new Map<string, SeriesOutput>();
  let at = 0;
  inputs.forEach((p, k) => {
    const before = results[at].results?.[0] as { daily_day: string | null; last_played_day: string | null; day_wins: number } | undefined;
    const row = results[at + 2].results?.[0] as
      | { aura: number; rating: number; cowries: number; day_streak: number; day_wins: number; win_streak: number }
      | undefined;
    at += perPlayer[k].length;
    if (!row || !before) return;
    const winsBefore = before.last_played_day === today ? before.day_wins : 0;
    out.set(p.id, {
      aura: row.aura,
      goalBonus: p.result === 'win' && winsBefore === DAILY_GOAL - 1 ? GOAL_BONUS : 0,
      rating: row.rating,
      cowries: row.cowries,
      daily: before.daily_day === today ? 0 : DAILY_COWRIES,
      dayStreak: row.day_streak,
      dayWins: row.day_wins,
      winStreak: row.win_streak,
    });
  });
  return out;
}
