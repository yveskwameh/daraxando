/**
 * The server side of playing Baba Ayo without internet (shared/offline.ts has the rules both
 * sides share; Yves, 18 October 2026).
 *
 * POST /api/offline/passes  Up to 10 unused one-use passes for this player, topping up to 10,
 *                           at most 10 new ones a day (Lagos time).
 * POST /api/offline/game    One finished game of an offline match. The server replays every
 *                           move with the pass's dice. Until the match is decided it only notes
 *                           how the game ended; the game that decides it records the match
 *                           exactly like an online Baba Ayo match (Aura, streak, quests, badges,
 *                           league, the daily seeds) and answers with the reward.
 *
 * A pass counts once: the decided match marks it used in the same write that checks it wasn't.
 * A game that fails the replay uses the pass up, so a phone can't keep trying versions. Off on
 * the real game until the lawyer approves the privacy notice lines (OFFLINE_ON_REAL_GAME).
 */
import { isBotLevel, type BotLevel } from '../shared/bot';
import { isModeId, type ModeId } from '../shared/modes';
import {
  markOf, matchSoFar, OFFLINE_ON_REAL_GAME, PASS_DAYS, PASS_KEEP_DAYS, PASS_MAX, playGame, type GameMark, type Pass,
} from '../shared/offline';
import { auraFor, dayKey, levelInfo, type Result } from '../shared/progression';
import type { Profile, Reward } from '../shared/protocol';
import type { Mark } from '../shared/rules';
import { randomToken } from './auth';
import { getPlayer, recordSeries, type SeriesInput } from './db';
import type { Env } from './env';
import { afterMatch } from './habits';
import { body, fail, json } from './http';
import { bump } from './stats';

const DAY = 86_400_000;

/** Offline play is on here: the test copy and the Mac now, the real game once the lawyer approves. */
export const offlineOn = (env: Env) => env.ENVIRONMENT !== 'production' || OFFLINE_ON_REAL_GAME;

interface PassRow {
  id: string;
  player_id: string;
  seed: number;
  issued_at: number;
  mode: string | null;
  level: string | null;
  starter: string | null;
  results: string;
  used_at: number | null;
}

/** Midnight in Lagos (UTC+1) at the start of the day `now` falls in, as server time. */
const lagosDayStart = (now: number) => Date.parse(`${dayKey(now)}T00:00:00Z`) - 3_600_000;

export type OfflineAnswer =
  | { status: 'saved' }
  | { status: 'counted'; reward: Reward; profile: Profile }
  /** Already counted (a retry), or a game the server already has. The phone can forget it. */
  | { status: 'duplicate' }
  /** The pass is unknown, someone else's, or too old. The phone forgets the game. */
  | { status: 'gone' }
  /** A move didn't check out. The pass is used up and the game doesn't count. */
  | { status: 'refused' };

export async function offlineRoute(req: Request, env: Env, path: string, me: Profile, now = Date.now()): Promise<Response> {
  if (!offlineOn(env)) return fail(404, 'not found');
  const db = env.DB;

  if (path === '/api/offline/passes') {
    // Tidy up while we're here: passes past the time the server checks games for.
    const old = now - PASS_KEEP_DAYS * DAY;
    await db.prepare('DELETE FROM offline_passes WHERE issued_at < ?').bind(old).run();
    const fresh = now - PASS_DAYS * DAY;
    const [unused, today] = await db.batch<{ n: number }>([
      db.prepare("SELECT COUNT(*) AS n FROM offline_passes WHERE player_id = ? AND used_at IS NULL AND results = '' AND issued_at > ?").bind(me.id, fresh),
      db.prepare('SELECT COUNT(*) AS n FROM offline_passes WHERE player_id = ? AND issued_at >= ?').bind(me.id, lagosDayStart(now)),
    ]);
    const add = Math.max(0, Math.min(PASS_MAX - (unused.results[0]?.n ?? 0), PASS_MAX - (today.results[0]?.n ?? 0)));
    if (add) {
      const seeds = crypto.getRandomValues(new Uint32Array(add));
      await db.batch(
        Array.from(seeds, (seed) =>
          db.prepare('INSERT INTO offline_passes (id, player_id, seed, issued_at) VALUES (?, ?, ?, ?)').bind(randomToken(12), me.id, seed, now),
        ),
      );
    }
    const { results } = await db
      .prepare("SELECT id, seed, issued_at FROM offline_passes WHERE player_id = ? AND used_at IS NULL AND results = '' AND issued_at > ? ORDER BY issued_at LIMIT ?")
      .bind(me.id, fresh, PASS_MAX)
      .all<{ id: string; seed: number; issued_at: number }>();
    return json({ passes: results.map((r): Pass => ({ id: r.id, seed: r.seed, at: r.issued_at })), now });
  }

  if (path === '/api/offline/game') {
    const b = await body<{ pass: string; mode: ModeId; level: BotLevel; starter: Mark; game: number; moves: number[]; resign?: boolean }>(req);
    const { pass, mode, level, starter, game, moves, resign } = b;
    if (typeof pass !== 'string' || !isModeId(mode) || !isBotLevel(level) || (starter !== 'X' && starter !== 'O') || typeof game !== 'number' || !Number.isInteger(game) || game < 1 || !Array.isArray(moves)) {
      return fail(400, 'That game is not readable.');
    }
    return json(await takeGame(env, me, { pass, mode, level, starter, game, moves, resign: resign === true }, now));
  }

  return fail(404, 'not found');
}

/** One game of an offline match: check it, note it, and count the match once it's decided. */
export async function takeGame(
  env: Env,
  me: Profile,
  b: { pass: string; mode: ModeId; level: BotLevel; starter: Mark; game: number; moves: number[]; resign?: boolean },
  now = Date.now(),
): Promise<OfflineAnswer> {
  const db = env.DB;
  const row = await db.prepare('SELECT * FROM offline_passes WHERE id = ? AND player_id = ?').bind(b.pass, me.id).first<PassRow>();
  if (!row || row.issued_at < now - PASS_KEEP_DAYS * DAY) return { status: 'gone' };
  if (row.used_at) return { status: 'duplicate' };
  const done = row.results.length;
  if (b.game <= done) return { status: 'duplicate' };
  // The same match all the way through: the first game fixes the game, the level and who opened.
  const sameMatch = row.mode === null || (row.mode === b.mode && row.level === b.level && row.starter === b.starter);
  const refuse = async (): Promise<OfflineAnswer> => {
    await db.batch([
      db.prepare('UPDATE offline_passes SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(now, row.id),
      bump(db, dayKey(now), 'offline:refused'),
    ]);
    return { status: 'refused' };
  };
  if (!sameMatch || b.game !== done + 1) return refuse();

  const played = playGame({ mode: b.mode, level: b.level, seed: row.seed, starter: b.starter, game: b.game, moves: b.moves });
  // A finished game, or one the player left part way through. Anything else doesn't check out.
  if (!played.ok || (b.resign ? !!played.end : !played.end)) return refuse();
  const results = row.results + (b.resign ? 'R' : markOf(played.end!));
  const so = matchSoFar(b.mode, [...results] as GameMark[]);

  if (!so.decided) {
    const r = await db
      .prepare('UPDATE offline_passes SET mode = ?, level = ?, starter = ?, results = ? WHERE id = ? AND results = ? AND used_at IS NULL')
      .bind(b.mode, b.level, b.starter, results, row.id, row.results)
      .run();
    return (r.meta.changes ?? 0) > 0 ? { status: 'saved' } : { status: 'duplicate' };
  }

  // The match is decided. Claim the pass first, in the same write that checks nobody else did.
  const [claim] = await db.batch([
    db.prepare('UPDATE offline_passes SET mode = ?, level = ?, starter = ?, results = ?, used_at = ? WHERE id = ? AND results = ? AND used_at IS NULL RETURNING id')
      .bind(b.mode, b.level, b.starter, results, now, row.id, row.results),
    bump(db, dayKey(now), 'offline:match'),
  ]);
  if (!claim.results.length) return { status: 'duplicate' };
  try {
    const reward = await count(env, me, b.mode, b.level, so.winner === null ? 'draw' : so.winner === 0 ? 'win' : 'loss', now);
    const profile = (await getPlayer(db, me.id)) ?? me;
    return { status: 'counted', reward, profile };
  } catch (err) {
    // Couldn't record it: put the pass back as it was, so the phone's retry counts it.
    console.error('Could not count an offline match', row.id, err);
    await db.prepare('UPDATE offline_passes SET results = ?, used_at = NULL WHERE id = ?').bind(row.results, row.id).run();
    throw err;
  }
}

/**
 * Records an offline Baba Ayo match exactly as Match.report does for one played online
 * (worker/match.ts): the series row for the player, then streak, quests, badges and league.
 * Keep the two in step.
 */
async function count(env: Env, me: Profile, mode: ModeId, level: BotLevel, result: Result, now: number): Promise<Reward> {
  const input: SeriesInput = {
    id: me.id,
    result,
    aura: auraFor('bot', result, level),
    rating: null,
    payout: 0,
    back: false,
    online: false,
    quick: false,
    stake: 0,
  };
  const out = await recordSeries(env.DB, [input], null, now, { kind: 'bot', mode, stake: 0 });
  const row = out.get(me.id);
  if (!row) throw new Error('no series row');
  const habits = await afterMatch(
    env.DB,
    me.id,
    { kind: 'bot', mode, result, level },
    { aura: input.aura + row.goalBonus, dayWinsBefore: row.dayWins - (result === 'win' ? 1 : 0) },
    now,
  ).catch((err) => {
    console.error('Could not save habits for an offline match', me.id, err);
    return null;
  });
  const auraTotal = habits?.aura ?? row.aura;
  return {
    result,
    aura: input.aura,
    goalBonus: row.goalBonus,
    auraTotal,
    levelBefore: levelInfo(row.aura - input.aura - row.goalBonus).level,
    levelAfter: levelInfo(auraTotal).level,
    ratingBefore: me.rating,
    ratingAfter: row.rating,
    cowries: 0,
    daily: row.daily,
    cowriesTotal: habits?.cowries ?? row.cowries,
    dayStreak: habits?.streak ?? row.dayStreak,
    dayWins: row.dayWins,
    winStreak: row.winStreak,
    habits: habits ? (({ aura: _a, cowries: _c, ...rest }) => rest)(habits) : undefined,
  };
}
