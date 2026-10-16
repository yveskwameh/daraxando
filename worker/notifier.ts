/**
 * Sends the 7 pm streak reminders (shared/notify.ts). The daily cron in wrangler.jsonc starts a
 * run; this object then works through the phones a few at a time, one alarm after another,
 * because the free plan gives each request 10 ms of processing and about 50 outside calls, and
 * encrypting a message takes about 1 ms. Each phone is marked as reminded for the day before
 * it's sent to, so a retried alarm never sends twice.
 */
import { DurableObject } from 'cloudflare:workers';
import { parseHabits, streakNow } from '../shared/habits';
import { dayKey } from '../shared/progression';
import type { Env } from './env';
import { dropSubs, pushReady, sendPush, streakNote, type PushSub } from './push';

/** Phones per alarm: about 5 ms of encryption, well inside the 10 ms limit. */
const BATCH = 5;
/** Stop by 10 pm Lagos time: a reminder later than that is more annoying than useful. */
const LAST_HOUR_UTC = 21;

interface Row extends PushSub { player_id: string; day_streak: number; habits: string | null }

export class Notifier extends DurableObject<Env> {
  /**
   * Starts today's reminders. Starting twice on the same day does nothing more, unless `again`
   * (the admin API, for testing): then phones already reminded today get it once more.
   */
  async start(day = dayKey(Date.now()), again = false) {
    if (!pushReady(this.env)) return { started: false, reason: 'no keys' };
    if (again) await this.env.DB.prepare('UPDATE push_subs SET reminded_day = NULL WHERE reminded_day = ?').bind(day).run();
    else if ((await this.ctx.storage.get<string>('day')) === day) return { started: false, reason: 'already running or done today' };
    await this.ctx.storage.put({ day, sent: 0 });
    await this.ctx.storage.setAlarm(Date.now());
    return { started: true };
  }

  async alarm() {
    const day = await this.ctx.storage.get<string>('day');
    const now = Date.now();
    if (!day || day !== dayKey(now) || new Date(now).getUTCHours() >= LAST_HOUR_UTC) return;
    const db = this.env.DB;
    // Players whose streak could end tonight: they played in the last few days (a Streak Freeze
    // can cover up to two missed days), but not today. streakNow below has the final say.
    const since = dayKey(now - 4 * 86_400_000);
    const { results } = await db
      .prepare(
        `SELECT s.endpoint, s.p256dh, s.auth, s.player_id, p.day_streak, p.habits
         FROM push_subs s JOIN players p ON p.id = s.player_id
         WHERE s.streak = 1 AND (s.reminded_day IS NULL OR s.reminded_day != ?1)
           AND p.day_streak > 0 AND p.last_played_day >= ?2 AND p.last_played_day < ?1
         LIMIT ?3`,
      )
      .bind(day, since, BATCH)
      .all<Row>();
    if (!results.length) return;

    // Marked first, so a retry can't send twice.
    await db.batch(results.map((r) => db.prepare('UPDATE push_subs SET reminded_day = ? WHERE endpoint = ?').bind(day, r.endpoint)));
    const sent = await Promise.all(
      results.map(async (r) => {
        const s = streakNow(parseHabits(r.habits), r.day_streak, day);
        // Only when the streak really ends at midnight: a Streak Freeze left would cover tonight,
        // and Baba Ayo's lines say it ends.
        if (s.playedToday || s.streak < 1 || s.freezes > 0) return [r.endpoint, 'skip'] as const;
        // Until midnight Lagos time, when the streak would end.
        const ttl = Math.max(60, Math.floor((Date.parse(`${day}T23:00:00Z`) - now) / 1000));
        return [r.endpoint, await sendPush(this.env, r, streakNote(s.streak), ttl, now)] as const;
      }),
    );
    await dropSubs(db, sent.filter(([, r]) => r === 'gone').map(([e]) => e));
    await this.ctx.storage.put('sent', ((await this.ctx.storage.get<number>('sent')) ?? 0) + sent.filter(([, r]) => r === 'ok').length);
    if (results.length === BATCH) await this.ctx.storage.setAlarm(Date.now() + 250);
  }

  /** How today's run went, for the admin API. */
  async status() {
    return { day: (await this.ctx.storage.get<string>('day')) ?? null, sent: (await this.ctx.storage.get<number>('sent')) ?? 0 };
  }
}
