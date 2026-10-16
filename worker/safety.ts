/**
 * Safety (docs/BACKEND.md, milestone 4): the phone a player was made on, the seed farming
 * rules at the end of a staked match, and what a ban stops. The rules themselves, in words
 * a lawyer can check, are in docs/SAFETY-REVIEW.md.
 */
import type { AppealView, Profile } from '../shared/protocol';
import { overPairCap, quickQuit, type StakeBack } from '../shared/stakes';
import { hmac } from './auth';
import type { Env } from './env';
import { secretOf } from './http';

const DAY_MS = 86_400_000;

/**
 * The phone asking, as a keyed hash of the app's own random id (src/lib/device.ts). The raw id
 * is never stored, and nothing is read from the phone itself. Null when the app sent no id.
 */
export async function deviceOf(req: Request, env: Env): Promise<string | null> {
  const raw = req.headers.get('x-device') ?? '';
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(raw)) return null;
  return (await hmac(secretOf(env), `device:${raw}`)).slice(0, 32);
}

export interface Settle {
  winnerId: string;
  loserId: string;
  stake: number;
  reason: string;
  /** Moves the loser made themselves in the whole series. Moves the clock made for them don't count. */
  loserMoves: number;
  /** Games that finished before the one that ended the series. */
  gamesBefore: number;
}

/**
 * Why a staked win pays nothing, or null when the winner takes the pot as usual. When it isn't
 * null, both stakes go back and the win still counts for Aura, rating and the streak.
 */
export async function stakeBack(db: D1Database, m: Settle, now: number): Promise<StakeBack | null> {
  if (quickQuit(m.reason, m.loserMoves, m.gamesBefore)) return 'quit';
  const [devices, flow] = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT device FROM players WHERE id IN (?, ?) AND device IS NOT NULL').bind(m.winnerId, m.loserId),
    // What the winner is already up on this opponent today: stakes won from them, minus stakes lost to them.
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN (winner = 'X' AND x_id = ?1) OR (winner = 'O' AND o_id = ?1) THEN stake ELSE -stake END), 0) AS flow
         FROM matches
         WHERE ((x_id = ?1 AND o_id = ?2) OR (x_id = ?2 AND o_id = ?1))
           AND created_at > ?3 AND paid = 1 AND stake > 0 AND winner IS NOT NULL`,
      )
      .bind(m.winnerId, m.loserId, now - DAY_MS),
  ]);
  const phones = (devices.results ?? []) as { device: string }[];
  if (phones.length === 2 && phones[0].device === phones[1].device) return 'phone';
  if (overPairCap(Number((flow.results?.[0] as { flow?: number } | undefined)?.flow ?? 0), m.stake)) return 'cap';
  return null;
}

/** Which of these players are banned. Checked before a rematch, since a ban can land mid-match. */
export async function bannedAmong(db: D1Database, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  try {
    const { results } = await db
      .prepare(`SELECT id FROM players WHERE id IN (${ids.map(() => '?').join(', ')}) AND banned_at IS NOT NULL`)
      .bind(...ids)
      .all<{ id: string }>();
    return results.map((r) => r.id);
  } catch (err) {
    // A rematch shouldn't fail because this check did.
    console.error('Could not check bans', err);
    return [];
  }
}

/* ------------------------------------------------------------------ ban reviews */

/** After a review keeps the ban, the player can ask again this long after the answer. */
export const APPEAL_AGAIN_MS = 7 * DAY_MS;
export const APPEAL_MIN = 10;
export const APPEAL_MAX = 500;

interface AppealRow { at: number; status: 'open' | 'lifted' | 'kept'; note: string | null; decidedAt: number | null }

/** A banned player's latest review request and when they can send another. */
export async function appealOf(db: D1Database, id: string, bannedAt: number): Promise<AppealView> {
  const row = await db
    .prepare('SELECT created_at AS at, status, note, decided_at AS decidedAt FROM appeals WHERE player_id = ? ORDER BY id DESC LIMIT 1')
    .bind(id)
    .first<AppealRow>();
  // A request from before this ban (the last one was lifted, then they were banned again) doesn't count.
  const appeal = row && row.at >= bannedAt ? row : null;
  let askFrom: number | null = 0;
  if (appeal?.status === 'open') askFrom = null;
  else if (appeal?.status === 'kept') askFrom = (appeal.decidedAt ?? appeal.at) + APPEAL_AGAIN_MS;
  return { appeal, askFrom };
}

/** Sends a review request. Returns an error for the player, or the new state. */
export async function askReview(db: D1Database, p: Profile, raw: unknown, now: number): Promise<string | AppealView> {
  if (!p.ban) return "Your account isn't banned.";
  const message = typeof raw === 'string' ? raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim() : '';
  if (message.length < APPEAL_MIN || message.length > APPEAL_MAX) return `Write ${APPEAL_MIN} to ${APPEAL_MAX} characters.`;
  const now0 = await appealOf(db, p.id, p.ban.at);
  if (now0.askFrom === null) return 'Your request is still waiting for an answer.';
  if (now0.askFrom > now) {
    return `You can ask again from ${new Date(now0.askFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })}.`;
  }
  await db.prepare('INSERT INTO appeals (player_id, message, created_at) VALUES (?, ?, ?)').bind(p.id, message, now).run();
  return appealOf(db, p.id, p.ban.at);
}

/** What a banned player sees when they try to play someone. */
export const BANNED_MESSAGE = "You can't play other people right now. Baba Ayo still works.";

export const isBanned = (p: Pick<Profile, 'ban'>) => !!p.ban;
