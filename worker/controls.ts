/**
 * Game controls (shared/controls.ts): switches, the announcement on Home, and news notifications.
 *
 * Every request that needs a switch reads it from here. Each Worker or Durable Object keeps what it
 * read for 30 seconds, so a busy minute costs one small read per isolate, and a change reaches
 * players within a minute. The dashboard sets them through the admin API (worker/admin.ts), and
 * every change goes in admin_actions.
 */
import {
  BANNER_KEEP_MS, BANNER_MAX, BANNER_MAX_MS, BANNER_MIN_MS, cleanLine, isBannerAction, isSwitchId, lineProblem,
  NEWS_MAX, NEWS_PER_MONTH, NEWS_WINDOW_MS, SWITCHES, type Banner, type BannerAction, type Controls, type SwitchId,
} from '../shared/controls';
import type { Env } from './env';

const KEEP_MS = 30_000;
const cache = new WeakMap<D1Database, { at: number; value: Controls }>();

interface BannerRow { id: number; text: string; action: string | null; starts_at: number; ends_at: number; created_at: number; stopped_at: number | null }

/** Which switches are off, and the announcement showing now. Cached 30 seconds. */
export async function controlsOf(env: Pick<Env, 'DB'>, now = Date.now()): Promise<Controls> {
  const hit = cache.get(env.DB);
  if (hit && now - hit.at < KEEP_MS) return hit.value;
  let value: Controls;
  try {
    const [off, banner] = await env.DB.batch<Record<string, unknown>>([
      env.DB.prepare('SELECT id FROM switches_off'),
      env.DB.prepare('SELECT id, text, action FROM announcements WHERE stopped_at IS NULL AND starts_at <= ?1 AND ends_at > ?1 ORDER BY starts_at DESC LIMIT 1').bind(now),
    ]);
    const b = banner.results[0] as Pick<BannerRow, 'id' | 'text' | 'action'> | undefined;
    value = {
      off: (off.results as { id: string }[]).map((r) => r.id).filter(isSwitchId),
      banner: b ? { id: b.id, text: b.text, action: isBannerAction(b.action) ? b.action : null } : null,
    };
  } catch (err) {
    // A copy whose database hasn't had this migration yet: everything stays on.
    console.error('[controls]', err);
    value = { off: [], banner: null };
  }
  cache.set(env.DB, { at: now, value });
  return value;
}

/** Forget what this isolate read, so the next read is fresh (after a change, and in tests). */
export const dropControls = (env: Pick<Env, 'DB'>) => cache.delete(env.DB);

export async function switchOn(env: Pick<Env, 'DB'>, id: SwitchId, now = Date.now()) {
  return !(await controlsOf(env, now)).off.includes(id);
}

/* ---------------- the admin side ---------------- */

const log = (env: Env, now: number, action: string, detail: unknown) =>
  env.DB.prepare('INSERT INTO admin_actions (at, action, player_id, detail) VALUES (?, ?, NULL, ?)').bind(now, action, JSON.stringify(detail));

/** Everything the dashboard's Controls page shows. */
export async function controlsView(env: Env, now = Date.now()) {
  const [off, banners, news, phones] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare('SELECT id, since, reason FROM switches_off'),
    env.DB.prepare('SELECT * FROM announcements WHERE ends_at > ? ORDER BY starts_at DESC LIMIT 30').bind(now - BANNER_KEEP_MS),
    env.DB.prepare('SELECT id, text, created_at AS at, phones, sent, done_at AS doneAt FROM news ORDER BY id DESC LIMIT 20'),
    env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE news = 1'),
  ]);
  const offRows = off.results as { id: string; since: number; reason: string | null }[];
  const sentLately = (news.results as { at: number }[]).filter((n) => n.at > now - NEWS_WINDOW_MS);
  return {
    switches: SWITCHES.map((s) => {
      const o = offRows.find((r) => r.id === s.id);
      return { ...s, on: !o, since: o?.since ?? null, reason: o?.reason ?? null };
    }),
    banners: (banners.results as unknown as BannerRow[]).map((b) => ({
      id: b.id,
      text: b.text,
      action: isBannerAction(b.action) ? b.action : null,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      stoppedAt: b.stopped_at,
      state: b.stopped_at ? 'stopped' : b.starts_at > now ? 'scheduled' : b.ends_at > now ? 'live' : 'past',
    })),
    news: {
      phones: Number((phones.results[0] as { n?: number })?.n ?? 0),
      left: Math.max(0, NEWS_PER_MONTH - sentLately.length),
      /** When the next one can go, if none are left. */
      nextAt: sentLately.length >= NEWS_PER_MONTH ? Math.min(...sentLately.map((n) => n.at)) + NEWS_WINDOW_MS : null,
      sent: news.results,
    },
  };
}

/** Turns a switch off (with a reason) or back on. */
export async function setSwitch(env: Env, id: unknown, on: unknown, reason: unknown, now = Date.now()) {
  if (!isSwitchId(id)) return { status: 404, error: 'No switch with that name.' };
  if (typeof on !== 'boolean') return { status: 400, error: 'Say on: true or on: false.' };
  const why = cleanLine(reason).slice(0, 200) || null;
  if (on) {
    const r = await env.DB.prepare('DELETE FROM switches_off WHERE id = ? RETURNING since').bind(id).first<{ since: number }>();
    if (r) await log(env, now, 'switch-on', { id, offSince: r.since }).run();
  } else {
    if (!why || why.length < 3) return { status: 400, error: 'Say why in a few words. Only you see it.' };
    const r = await env.DB.prepare('INSERT INTO switches_off (id, since, reason) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING RETURNING id').bind(id, now, why).first();
    if (r) await log(env, now, 'switch-off', { id, reason: why }).run();
  }
  dropControls(env);
  return null;
}

/** Schedules an announcement, or changes one that hasn't ended. Never two showing at the same time. */
export async function saveBanner(env: Env, b: { id?: unknown; text?: unknown; action?: unknown; startsAt?: unknown; endsAt?: unknown }, now = Date.now()) {
  const text = cleanLine(b.text);
  const problem = lineProblem(text, BANNER_MAX);
  if (problem) return { status: 400, error: problem };
  const action: BannerAction | null = b.action === null || b.action === undefined || b.action === '' ? null : isBannerAction(b.action) ? b.action : null;
  if (b.action && !action) return { status: 400, error: 'That button goes nowhere in the game.' };
  const startsAt = typeof b.startsAt === 'number' && Number.isFinite(b.startsAt) ? Math.max(now, Math.floor(b.startsAt)) : now;
  const endsAt = typeof b.endsAt === 'number' && Number.isFinite(b.endsAt) ? Math.floor(b.endsAt) : 0;
  if (endsAt - startsAt < BANNER_MIN_MS) return { status: 400, error: 'Show it for at least 10 minutes.' };
  if (endsAt - startsAt > BANNER_MAX_MS) return { status: 400, error: 'Show it for 14 days at most.' };
  const id = typeof b.id === 'number' && Number.isInteger(b.id) ? b.id : null;
  const clash = await env.DB
    .prepare('SELECT id FROM announcements WHERE stopped_at IS NULL AND starts_at < ?2 AND ends_at > ?1 AND id != ?3 LIMIT 1')
    .bind(startsAt, endsAt, id ?? -1)
    .first();
  if (clash) return { status: 409, error: 'Another announcement shows at that time. Stop it or pick another time.' };
  if (id !== null) {
    const r = await env.DB
      .prepare('UPDATE announcements SET text = ?, action = ?, starts_at = ?, ends_at = ? WHERE id = ? AND stopped_at IS NULL AND ends_at > ? RETURNING id')
      .bind(text, action, startsAt, endsAt, id, now)
      .first();
    if (!r) return { status: 409, error: 'That announcement has already ended or been stopped.' };
    // Phones that already closed it don't see it again, even with new wording.
    await log(env, now, 'banner-change', { id, text, action, startsAt, endsAt }).run();
  } else {
    const r = await env.DB
      .prepare('INSERT INTO announcements (text, action, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
      .bind(text, action, startsAt, endsAt, now)
      .first<{ id: number }>();
    await log(env, now, 'banner-new', { id: r?.id, text, action, startsAt, endsAt }).run();
  }
  dropControls(env);
  return null;
}

export async function stopBanner(env: Env, id: number, now = Date.now()) {
  const r = await env.DB.prepare('UPDATE announcements SET stopped_at = ? WHERE id = ? AND stopped_at IS NULL AND ends_at > ? RETURNING text').bind(now, id, now).first<{ text: string }>();
  if (!r) return { status: 409, error: 'That announcement has already ended.' };
  await log(env, now, 'banner-stop', { id, text: r.text }).run();
  dropControls(env);
  return null;
}

/** Sends a news notification to every phone that turned news on, a few at a time (worker/notifier.ts). */
export async function sendNews(env: Env, raw: unknown, now = Date.now()) {
  const text = cleanLine(raw);
  const problem = lineProblem(text, NEWS_MAX);
  if (problem) return { status: 400, error: problem };
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM news WHERE created_at > ?').bind(now - NEWS_WINDOW_MS).first<{ n: number }>();
  if ((recent?.n ?? 0) >= NEWS_PER_MONTH) return { status: 409, error: `That's ${NEWS_PER_MONTH} in 30 days already, the most players were promised.` };
  const busy = await env.DB.prepare('SELECT id FROM news WHERE done_at IS NULL LIMIT 1').first();
  if (busy) return { status: 409, error: 'The last news is still being sent. Try again in a minute.' };
  const phones = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE news = 1').first<{ n: number }>();
  if (!phones?.n) return { status: 409, error: 'No phones have news turned on yet, so there is nobody to send it to.' };
  const row = await env.DB
    .prepare('INSERT INTO news (text, created_at, phones) VALUES (?, ?, ?) RETURNING id')
    .bind(text, now, phones?.n ?? 0)
    .first<{ id: number }>();
  await log(env, now, 'news-send', { id: row!.id, text, phones: phones?.n ?? 0 }).run();
  await env.NOTIFIER.get(env.NOTIFIER.idFromName('news')).news(row!.id);
  return null;
}

/** The 8 am run: announcements past their 30 days go. */
export const tidyBanners = (db: D1Database, now = Date.now()) => db.prepare('DELETE FROM announcements WHERE ends_at < ?').bind(now - BANNER_KEEP_MS);

export type { Banner };
