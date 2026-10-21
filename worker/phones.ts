/**
 * Phones and players (docs/PHONES-REVIEW.md). One person shouldn't farm Dara Seeds with several
 * players, so the game links every player to the phones they use, as the keyed hash of the app's
 * random phone id (worker/safety.ts, `deviceOf`): the phone a player was made on, phones that
 * signed in to it, and phones that opened the game as it. Players linked through a phone get both
 * stakes back when one beats the other (worker/safety.ts, `stakeBack`), and the admin dashboard
 * shows them together. A phone can make 2 new players in 30 days.
 *
 * A link is a sign, not proof: brothers and sisters share phones. Nothing here bans anyone.
 *
 * The lawyer approved it on 21 October 2026 (docs/PHONES-REVIEW.md), with the privacy lines in
 * src/legal/privacy.md. PHONE_LINKS_ON_REAL_GAME stays as a quick off switch: off, the real game
 * keeps only the phone each player was made on and has no cap.
 */
import type { Env } from './env';

const DAY_MS = 86_400_000;

// Approved by the lawyer on 21 October 2026 (docs/PHONES-REVIEW.md).
export const PHONE_LINKS_ON_REAL_GAME = true;
export const phoneLinksOn = (env: Pick<Env, 'ENVIRONMENT'>) => env.ENVIRONMENT !== 'production' || PHONE_LINKS_ON_REAL_GAME;

/** New players a phone can make in 30 days. */
export const NEW_PLAYERS_PER_PHONE = 2;
export const NEW_PLAYERS_WINDOW_MS = 30 * DAY_MS;
/** Links other than the phone a player was made on go after this long unused. */
export const KEEP_LINKS_MS = 400 * DAY_MS;
export const PHONE_FULL = 'This phone already made 2 players this month. Sign in instead.';

export type PhoneHow = 'made' | 'signin' | 'seen';

/**
 * Records a player on a phone. A new link keeps how it started; an old one only gets a new
 * last_at, at most once a day, so opening the game doesn't write every time.
 */
export const linkStatement = (db: D1Database, playerId: string, phone: string, how: PhoneHow, now: number) =>
  db
    .prepare(
      `INSERT INTO player_phones (player_id, phone, how, first_at, last_at) VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT (player_id, phone) DO UPDATE SET last_at = ?4 WHERE last_at < ?4 - ${DAY_MS}`,
    )
    .bind(playerId, phone, how, now);

/** Links a player to the phone that just signed in to it or opened the game as it. Never stops the request. */
export async function linkPhone(env: Env, playerId: string, phone: string | null, how: Exclude<PhoneHow, 'made'>, now = Date.now()) {
  if (!phone || !phoneLinksOn(env)) return;
  try {
    await linkStatement(env.DB, playerId, phone, how, now).run();
  } catch (err) {
    console.error('[phones] link', err);
  }
}

/** Whether this phone has made as many new players as it may in the last 30 days. */
export async function phoneFull(env: Env, phone: string | null, now: number) {
  if (!phone || !phoneLinksOn(env)) return false;
  const row = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM player_phones WHERE phone = ? AND how = 'made' AND first_at >= ?")
    .bind(phone, now - NEW_PLAYERS_WINDOW_MS)
    .first<{ n: number }>();
  return Number(row?.n ?? 0) >= NEW_PLAYERS_PER_PHONE;
}

/** Whether two players have ever been on the same phone. */
export const sharedPhoneStatement = (db: D1Database, a: string, b: string) =>
  db.prepare('SELECT 1 AS hit FROM player_phones x JOIN player_phones y ON y.player_id = ?2 AND y.phone = x.phone WHERE x.player_id = ?1 LIMIT 1').bind(a, b);
