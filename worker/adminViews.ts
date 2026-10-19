/**
 * The admin dashboard's views of the whole game (Yves, 19 October 2026; admin/README.md): every
 * player as a list with counts, who is on right now, where players come from, and how new players
 * get on in their first days. All read-only, and all behind the admin key (worker/admin.ts).
 *
 * Nothing here is recorded for it: the list and the counts read the players table, Live now asks
 * the matchmaker, "where players come from" reads Cloudflare Web Analytics (already on the live
 * site, src/lib/analytics.ts), and the first days read play days the game already keeps.
 */
import { addDays } from '../shared/habits';
import { dayKey } from '../shared/progression';
import { cleanEmail } from './accounts';
import { banActive, type PlayerRow } from './db';
import type { Env } from './env';
import { GRAPHQL, usageReady } from './report';

const DAY_MS = 86_400_000;
/** Players per page of the list. */
/** Players a page in the dashboard's list: 25, 50 (the default) or 100. */
export const PAGE_SIZES = [25, 50, 100] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Where Cloudflare Web Analytics runs (src/lib/analytics.ts). */
export const ANALYTICS_HOST = 'daraxando.yveskwameh.com';

/** Midnight in Lagos at the start of a day, in ms. */
const lagosStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - 3_600_000;
const num = (v: unknown) => Number(v ?? 0) || 0;

/** One player as the admin API lists them. */
export const summary = (r: PlayerRow) => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  state: r.state,
  cowries: r.cowries,
  aura: r.aura,
  rating: r.rating,
  saved: r.saved === 1,
  ban: banActive(r) ? { at: r.banned_at!, reason: r.ban_reason ?? '', until: r.ban_until ?? null } : null,
  /** Which terms they accepted, and when (shared/legal.ts). */
  terms: r.terms_version ? { version: r.terms_version, at: r.terms_at ?? null } : null,
  createdAt: r.created_at,
  lastPlayedDay: r.last_played_day,
  dayStreak: r.day_streak,
});

/* ---------- every player ---------- */

export const TABS = ['all', 'today', 'new', 'banned', 'saved'] as const;
export type Tab = (typeof TABS)[number];
export const SORTS = {
  new: 'p.created_at DESC',
  active: 'p.last_played_day IS NULL, p.last_played_day DESC, p.updated_at DESC',
  seeds: 'p.cowries DESC, p.created_at DESC',
  aura: 'p.aura DESC, p.created_at DESC',
  rating: 'p.rating DESC, p.created_at DESC',
  name: 'p.name COLLATE NOCASE ASC',
} as const;
export type Sort = keyof typeof SORTS;

/**
 * Players, a page at a time: a tab (everyone, played today, joined in the last 7 days, banned,
 * saved), optional filters (state, saved or guest, a search) and an order. Also how many match.
 */
export async function playerList(env: Env, url: URL) {
  const sp = url.searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as Tab) : 'all';
  const sort: Sort = Object.hasOwn(SORTS, sp.get('sort') ?? '') ? (sp.get('sort') as Sort) : 'new';
  const size = (PAGE_SIZES as readonly number[]).includes(Number(sp.get('size'))) ? Number(sp.get('size')) : 50;
  const page = Math.min(Math.floor(20_000 / size), Math.max(0, Math.floor(Number(sp.get('page') ?? 0)) || 0));
  const state = /^[A-Z]{2,4}$/.test(sp.get('state') ?? '') ? sp.get('state')! : null;
  const account = sp.get('account') === 'saved' || sp.get('account') === 'guest' ? sp.get('account') : null;
  const q = (sp.get('q') ?? '').trim();
  const now = Date.now();

  let join = '';
  const joinArgs: unknown[] = [];
  const where: string[] = [];
  const args: unknown[] = [];
  if (tab === 'today') {
    join = 'JOIN player_days d ON d.player_id = p.id AND d.day = ?';
    joinArgs.push(dayKey(now));
  }
  if (tab === 'new') { where.push('p.created_at >= ?'); args.push(now - 7 * DAY_MS); }
  if (tab === 'banned') where.push('p.banned_at IS NOT NULL');
  if (tab === 'saved') where.push('p.saved = 1');
  if (state) { where.push('p.state = ?'); args.push(state); }
  if (account) where.push(account === 'saved' ? 'p.saved = 1' : 'p.saved = 0');
  if (q) {
    if (UUID.test(q.toLowerCase())) { where.push('p.id = ?'); args.push(q.toLowerCase()); }
    else if (q.includes('@')) {
      const email = cleanEmail(q);
      if (!email) return { error: "That email address doesn't look right." };
      where.push('p.id IN (SELECT player_id FROM identities WHERE email = ?)');
      args.push(email);
    } else {
      where.push("p.name LIKE ? ESCAPE '\\'");
      args.push(`${q.slice(0, 16).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    }
  }
  const tail = `FROM players p ${join} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const [rows, total] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(`SELECT p.* ${tail} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`).bind(...joinArgs, ...args, size + 1, page * size),
    env.DB.prepare(`SELECT COUNT(*) AS n ${tail}`).bind(...joinArgs, ...args),
  ]);
  const list = (rows.results ?? []) as unknown as PlayerRow[];
  return {
    players: list.slice(0, size).map(summary),
    page,
    size,
    more: list.length > size,
    total: num((total.results?.[0] as { n?: number } | undefined)?.n),
  };
}

/** How many players each tab has. */
export async function playerCounts(env: Env) {
  const now = Date.now();
  const [all, today] = await env.DB.batch<Record<string, unknown>>([
    env.DB
      .prepare(
        `SELECT COUNT(*) AS everyone, COALESCE(SUM(banned_at IS NOT NULL), 0) AS banned, COALESCE(SUM(saved = 1), 0) AS saved,
                COALESCE(SUM(created_at >= ?), 0) AS fresh FROM players`,
      )
      .bind(now - 7 * DAY_MS),
    env.DB.prepare('SELECT COUNT(*) AS n FROM player_days WHERE day = ?').bind(dayKey(now)),
  ]);
  const a = (all.results?.[0] ?? {}) as Record<string, unknown>;
  return {
    all: num(a.everyone),
    today: num((today.results?.[0] as { n?: number } | undefined)?.n),
    new: num(a.fresh),
    banned: num(a.banned),
    saved: num(a.saved),
  };
}

/* ---------- right now ---------- */

/**
 * Live now: players with Home open, looking at Quick match, or waiting in a game of their own,
 * from the matchmaker. Players in the middle of a match aren't on Home, so they show up again
 * when they're back. Plus how many have finished a match today.
 */
export async function liveNow(env: Env) {
  const now = Date.now();
  const [mm, today] = await Promise.all([
    env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global'))
      .now()
      .catch((err: unknown) => {
        console.error('[admin] now', err);
        return null;
      }),
    env.DB.prepare('SELECT COUNT(*) AS n FROM player_days WHERE day = ?').bind(dayKey(now)).first<{ n: number }>(),
  ]);
  return { at: now, home: mm?.home ?? null, looking: mm?.looking ?? null, waiting: mm?.waiting ?? null, playedToday: num(today?.n) };
}

/* ---------- traffic: visits and new players for any window ---------- */

const HOUR_MS = 3_600_000;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** A time as Cloudflare's API takes it: whole seconds, UTC. */
const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
type Group<D> = { count?: number; sum?: { visits?: number }; dimensions?: D };

/** The windows the dashboard offers: the last 1 to 72 hours, or the last 7 or 30 days. */
export const WINDOW_HOURS = [1, 5, 12, 24, 48, 72] as const;
export const WINDOW_DAYS = [7, 30] as const;
export type Bucket = 'quarter' | 'hour' | 'day';
export const BUCKET_MS: Record<Bucket, number> = { quarter: 900_000, hour: HOUR_MS, day: DAY_MS };
/** The Web Analytics field that groups by each bucket. Its hours are UTC, which line up with Lagos hours because Lagos is a whole hour ahead. */
const BUCKET_FIELD: Record<Bucket, string> = { quarter: 'datetimeFifteenMinutes', hour: 'datetimeHour', day: 'date' };

/**
 * The window a request asks for: `hours` (1, 5, 12, 24, 48 or 72), `since` (a time in ms, at
 * most 30 days back, for tracking a link from the moment it was shared), or `days` (7 or 30,
 * whole UTC days, as before). Short windows count in quarter hours, up to 4 days in hours, and
 * longer ones in days.
 */
export function trafficWindow(sp: URLSearchParams, now: number) {
  const hours = Number(sp.get('hours'));
  const since = Number(sp.get('since'));
  let key: string;
  let from: number;
  if ((WINDOW_HOURS as readonly number[]).includes(hours)) {
    key = `${hours}h`;
    from = now - hours * HOUR_MS;
  } else if (Number.isFinite(since) && since > 0) {
    key = 'since';
    from = Math.min(now - 5 * 60_000, Math.max(now - 30 * DAY_MS, Math.floor(since / 60_000) * 60_000));
  } else {
    const days = Number(sp.get('days')) === 30 ? 30 : 7;
    key = `${days}d`;
    from = Date.parse(`${utcDay(now - (days - 1) * DAY_MS)}T00:00:00Z`);
  }
  const length = now - from;
  const bucket: Bucket = length <= 6 * HOUR_MS ? 'quarter' : length <= 4 * DAY_MS ? 'hour' : 'day';
  return { key, from, to: now, bucket, before: from - length };
}

/** The start of every bucket from `from` to `to`, so quiet hours show as zero rather than vanish. */
export function bucketStarts(from: number, to: number, bucket: Bucket) {
  const ms = BUCKET_MS[bucket];
  const out: number[] = [];
  for (let t = Math.floor(from / ms) * ms; t <= to; t += ms) out.push(t);
  return out;
}

/**
 * Traffic for a window: new players from the game's own database (who joined, how many of them
 * finished their first match and saved, and how many players saved their progress), and, on the
 * live game, visits from Cloudflare Web Analytics by bucket, by the site that sent them, by
 * country and by device. Each total also comes for the same length of time just before, so a
 * link shared an hour ago can be read against the hour before it. It reads what the game and Web
 * Analytics already keep; nothing new is recorded.
 */
export async function traffic(env: Env, url: URL) {
  const now = Date.now();
  const w = trafficWindow(url.searchParams, now);
  const starts = bucketStarts(w.from, w.to, w.bucket);
  const ms = BUCKET_MS[w.bucket];

  const [byBucket, before, saves] = await env.DB.batch<Record<string, unknown>>([
    env.DB
      .prepare(
        `SELECT CAST(created_at / ?1 AS INTEGER) AS b, COUNT(*) AS joined,
                COALESCE(SUM(first_result IS NOT NULL AND first_result != 'before'), 0) AS finished,
                COALESCE(SUM(saved = 1), 0) AS saved
         FROM players WHERE created_at >= ?2 AND created_at <= ?3 GROUP BY b`,
      )
      .bind(ms, w.from, w.to),
    env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE created_at >= ? AND created_at < ?').bind(w.before, w.from),
    env.DB.prepare('SELECT COUNT(DISTINCT player_id) AS n FROM identities WHERE created_at >= ? AND created_at <= ?').bind(w.from, w.to),
  ]);
  const joinedAt = new Map<number, number>();
  const players = { joined: 0, finished: 0, saved: 0, before: num((before.results?.[0] as { n?: number } | undefined)?.n), savedAny: num((saves.results?.[0] as { n?: number } | undefined)?.n) };
  for (const r of (byBucket.results ?? []) as { b: number; joined: number; finished: number; saved: number }[]) {
    joinedAt.set(num(r.b) * ms, num(r.joined));
    players.joined += num(r.joined);
    players.finished += num(r.finished);
    players.saved += num(r.saved);
  }
  const base = { window: w, players, buckets: starts.map((at) => ({ at, joined: joinedAt.get(at) ?? 0, visits: null as number | null, views: null as number | null })) };

  if (env.ENVIRONMENT === 'staging') return { ...base, web: { off: 'Visits come from Web Analytics, which only runs on the live game.' } };
  if (!usageReady(env)) return { ...base, web: { off: 'Add the CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN secrets to the game to see visits and where players come from.' } };

  const account = env.CF_ACCOUNT_ID!.trim();
  const f = (a: number, b: number) => `filter: { datetime_geq: ${JSON.stringify(iso(a))}, datetime_leq: ${JSON.stringify(iso(b))}, requestHost: ${JSON.stringify(ANALYTICS_HOST)} }`;
  const g = (alias: string, more: string, dims: string, window = f(w.from, w.to)) =>
    `${alias}: rumPageloadEventsAdaptiveGroups(${more} ${window}) { count sum { visits } ${dims ? `dimensions { ${dims} }` : ''} }`;
  const field = BUCKET_FIELD[w.bucket];
  const query = `{ viewer { accounts(filter: { accountTag: ${JSON.stringify(account)} }) {
    ${g('total', 'limit: 1,', '')}
    ${g('before', 'limit: 1,', '', f(w.before, w.from - 1000))}
    ${g('buckets', `limit: 200, orderBy: [${field}_ASC],`, field)}
    ${g('referers', 'limit: 15, orderBy: [sum_visits_DESC],', 'refererHost')}
    ${g('countries', 'limit: 10, orderBy: [sum_visits_DESC],', 'countryName')}
    ${g('devices', 'limit: 5, orderBy: [sum_visits_DESC],', 'deviceType')}
  } } }`;
  try {
    // Tests only, on a Mac or in the container: a stand-in for Cloudflare's API.
    const at = env.ENVIRONMENT === 'local' && env.CF_GRAPHQL_URL ? env.CF_GRAPHQL_URL : GRAPHQL;
    const res = await fetch(at, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN!.trim()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { viewer?: { accounts?: Record<string, unknown>[] } }; errors?: { message?: string }[] | null };
    const acc = body.data?.viewer?.accounts?.[0];
    if (!res.ok || body.errors?.length || !acc) {
      const why = body.errors?.[0]?.message ?? `HTTP ${res.status}`;
      console.error('[admin] web analytics', why);
      return { ...base, web: { problem: `Couldn't read Web Analytics: ${why.slice(0, 160)}` } };
    }
    const list = <D>(k: string) => (acc[k] ?? []) as Group<D>[];
    const row = <D>(x: Group<D>) => ({ visits: num(x.sum?.visits), views: num(x.count) });
    const total = list('total')[0];
    const prior = list('before')[0];
    const visitsAt = new Map<number, { visits: number; views: number }>();
    for (const x of list<Record<string, string>>('buckets')) {
      const v = x.dimensions?.[field] ?? '';
      const t = Date.parse(w.bucket === 'day' ? `${v}T00:00:00Z` : v);
      if (Number.isFinite(t)) visitsAt.set(t, row(x));
    }
    return {
      ...base,
      buckets: base.buckets.map((b) => ({ ...b, visits: visitsAt.get(b.at)?.visits ?? 0, views: visitsAt.get(b.at)?.views ?? 0 })),
      web: {
        visits: total ? row(total).visits : 0,
        views: total ? row(total).views : 0,
        before: prior ? row(prior) : { visits: 0, views: 0 },
        // Visits from one page of the game to another aren't a source.
        referers: list<{ refererHost?: string }>('referers')
          .filter((x) => (x.dimensions?.refererHost ?? '') !== ANALYTICS_HOST)
          .map((x) => ({ host: x.dimensions?.refererHost ?? '', ...row(x) })),
        countries: list<{ countryName?: string }>('countries').map((x) => ({ name: x.dimensions?.countryName ?? '', ...row(x) })),
        devices: list<{ deviceType?: string }>('devices').map((x) => ({ name: x.dimensions?.deviceType ?? '', ...row(x) })),
      },
    };
  } catch (err) {
    return { ...base, web: { problem: `Couldn't read Web Analytics: ${(err as Error).message.slice(0, 160)}` } };
  }
}

/* ---------- how new players get on ---------- */

/** Monday of the week a Lagos day is in. */
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
/** A player's join day, Lagos time, in SQL. */
const JOIN_DAY = "date((p.created_at + 3600000) / 1000, 'unixepoch')";

/**
 * Weekly retention: for each of the last 4 to 12 weeks (Monday to Sunday, Lagos days), how many
 * players joined, and how many of them played in that week and in each week after it.
 */
export async function retention(env: Env, url: URL) {
  const weeks = Math.min(12, Math.max(4, Math.floor(Number(url.searchParams.get('weeks') ?? 8)) || 8));
  const today = dayKey(Date.now());
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  const start = lagosStart(first);
  const week = (col: string) => `CAST((julianday(${col}) - julianday(?2)) / 7 AS INTEGER)`;
  const [sizes, back] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(`SELECT ${week(JOIN_DAY)} AS cw, COUNT(*) AS n FROM players p WHERE p.created_at >= ?1 GROUP BY cw`).bind(start, first),
    env.DB
      .prepare(
        `SELECT ${week(JOIN_DAY)} AS cw, ${week('d.day')} AS pw, COUNT(DISTINCT p.id) AS n
         FROM players p JOIN player_days d ON d.player_id = p.id AND d.day >= ?2
         WHERE p.created_at >= ?1 GROUP BY cw, pw`,
      )
      .bind(start, first),
  ]);
  const out = Array.from({ length: weeks }, (_, i) => ({ start: addDays(first, 7 * i), joined: 0, played: Array<number>(weeks - i).fill(0) }));
  for (const r of (sizes.results ?? []) as { cw: number; n: number }[]) if (out[r.cw]) out[r.cw].joined = num(r.n);
  for (const r of (back.results ?? []) as { cw: number; pw: number; n: number }[]) {
    const c = out[r.cw];
    const k = r.pw - r.cw;
    if (c && k >= 0 && k < c.played.length) c.played[k] = num(r.n);
  }
  return { weeks: out, today };
}

/**
 * The first days of players who joined in the last 7, 30 or 90 days: how many finished their
 * first match, came back on another day, played on 3 days or more, and saved their progress.
 */
export async function firstDays(env: Env, url: URL) {
  const n = Number(url.searchParams.get('days'));
  const days = n === 7 || n === 90 ? n : 30;
  const today = dayKey(Date.now());
  const from = addDays(today, -(days - 1));
  const r = await env.DB
    .prepare(
      `SELECT COUNT(*) AS joined,
              COALESCE(SUM(p.first_result IS NOT NULL AND p.first_result != 'before'), 0) AS finished,
              COALESCE(SUM(p.first_result = 'win'), 0) AS won,
              COALESCE(SUM(EXISTS (SELECT 1 FROM player_days d WHERE d.player_id = p.id AND d.day > ${JOIN_DAY})), 0) AS returned,
              COALESCE(SUM((SELECT COUNT(*) FROM player_days d WHERE d.player_id = p.id) >= 3), 0) AS threeDays,
              COALESCE(SUM(p.saved = 1), 0) AS saved
       FROM players p WHERE p.created_at >= ?`,
    )
    .bind(lagosStart(from))
    .first<Record<string, number>>();
  return {
    days,
    from,
    to: today,
    joined: num(r?.joined),
    finished: num(r?.finished),
    won: num(r?.won),
    returned: num(r?.returned),
    threeDays: num(r?.threeDays),
    saved: num(r?.saved),
  };
}

/** The days one player played in the last 12 weeks, and on how many days in all. */
export function playDays(db: D1Database, id: string) {
  const since = addDays(dayKey(Date.now()), -83);
  return [
    db.prepare('SELECT day FROM player_days WHERE player_id = ? AND day >= ? ORDER BY day').bind(id, since),
    db.prepare('SELECT COUNT(*) AS n FROM player_days WHERE player_id = ?').bind(id),
  ];
}
