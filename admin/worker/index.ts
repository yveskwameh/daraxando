// The admin dashboard's server: its own Worker, daraxando-admin, at admin.daraxando.yveskwameh.com.
// It changes nothing in the game. It serves the dashboard's screens (built into dist/), signs you
// in (worker/session.ts), and passes the dashboard's requests on to the game's own admin API
// (worker/admin.ts in the game), for the live game or the test game, with that game's admin key.
// Only the admin API's own routes pass (ROUTES below). Every change still goes through the
// game's rules and its admin log.
//
// It reaches the two games through service bindings (LIVE and TEST in wrangler.jsonc): direct,
// private calls between Workers on the same account, never over the public internet.
import { cleanKey, cookieFrom, SESSION_DAYS, sessionCookie, signSession, validSession, sameText } from './session.ts';

export interface Env {
  /** The live game (Worker daraxando) and the test game (daraxando-staging). */
  LIVE?: Fetcher;
  TEST?: Fetcher;
  /** Secrets: each game's ADMIN_TOKEN, saved again here. The live key is also the sign-in key. */
  ADMIN_KEY_LIVE?: string;
  ADMIN_KEY_TEST?: string;
  /** Five sign-in tries a minute per network address. */
  SIGNIN_LIMITER?: RateLimit;
  /** Only on your own machine: reach a game running locally instead of the bindings. */
  GAME_DEV_ORIGIN?: string;
}

type Copy = 'live' | 'test';

/** The admin API routes the dashboard may use: [method, path after /api/admin/]. */
const ROUTES: [string, RegExp][] = [
  ['GET', /^info$/],
  ['GET', /^players\/(list|counts)$/],
  ['GET', /^now$/],
  ['GET', /^(traffic|retention|first-days)$/],
  ['GET', /^stats$/],
  ['GET', /^report$/],
  ['POST', /^report$/],
  ['GET', /^players$/],
  ['GET', /^players\/[0-9a-f-]{36}$/],
  ['POST', /^players\/[0-9a-f-]{36}\/(rename|ban|unban|seeds|push)$/],
  ['GET', /^appeals$/],
  ['POST', /^appeals\/\d+\/(lift|keep)$/],
  ['GET', /^actions$/],
  ['GET', /^push\/streak$/],
  ['POST', /^push\/streak$/],
];

const MIN_KEY = 32;
const MAX_DAYS = 31;
const DAY_MS = 86_400_000;
/** Lagos day, as the game counts days. */
const lagosDay = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...headers } });
const fail = (status: number, error: string) => json({ error }, status);

const keyFor = (env: Env, copy: Copy) => {
  const key = cleanKey(copy === 'live' ? env.ADMIN_KEY_LIVE : env.ADMIN_KEY_TEST);
  return key.length >= MIN_KEY ? key : null;
};

/** One call to a game's admin API. */
function callGame(env: Env, copy: Copy, rest: string, init: { method: string; search?: string; body?: string }) {
  const key = keyFor(env, copy)!;
  const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const path = `/api/admin/${rest}${init.search ?? ''}`;
  const req = { method: init.method, headers, body: init.method === 'POST' ? (init.body ?? '{}') : undefined };
  if (env.GAME_DEV_ORIGIN) return fetch(`${env.GAME_DEV_ORIGIN}${path}`, req);
  const game = copy === 'live' ? env.LIVE : env.TEST;
  if (!game) return Promise.resolve(fail(503, `The ${copy} game isn't connected to the dashboard.`));
  return game.fetch(`https://game${path}`, req);
}

/**
 * How long a day's numbers are kept in Cloudflare's cache, in seconds. Today changes all the time,
 * so it's never kept. Yesterday can still move a little (a first match finished after midnight,
 * the free plan's UTC day still running), so it's kept 10 minutes. Older days don't change, so
 * they're kept 30 days, unless the free plan's numbers couldn't be read that time.
 */
export function keepFor(day: string, today: string, report: { usage?: { problems?: string[] } | null }) {
  if (day >= today) return 0;
  const yesterday = lagosDay(Date.parse(`${today}T12:00:00Z`) - 3_600_000 - DAY_MS);
  if (day >= yesterday || !report.usage || report.usage.problems?.length) return 600;
  return 30 * 86_400;
}

/**
 * Views that change slowly are kept in Cloudflare's cache for a few minutes (seconds here), so
 * opening the dashboard again doesn't read every player again. Live now is never kept.
 */
const KEEP: Record<string, number> = { 'players/counts': 60, retention: 600, 'first-days': 600 };
/**
 * How long a traffic view is kept: a minute for the last hours or since a time, so a link just
 * shared shows up quickly, and 10 minutes for whole days.
 */
export const keepTraffic = (search: string) => (new URLSearchParams(search).has('days') ? 600 : 60);

async function cached(env: Env, copy: Copy, rest: string, search: string, seconds: number) {
  const cache = typeof caches === 'undefined' ? null : caches.default;
  const key = new Request(`https://daraxando-admin.cache/${copy}/${rest}${search}`);
  const hit = cache ? await cache.match(key) : undefined;
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
  if (hit) return new Response(hit.body, { status: 200, headers });
  const res = await callGame(env, copy, rest, { method: 'GET', search });
  const text = await res.text();
  if (res.ok && cache) await cache.put(key, new Response(text, { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${seconds}` } }));
  return new Response(text, { status: res.status, headers });
}

/** The days from `end` back, oldest first. */
export const daysTo = (end: string, days: number) =>
  Array.from({ length: days }, (_, i) => lagosDay(Date.parse(`${end}T12:00:00Z`) - 3_600_000 - (days - 1 - i) * DAY_MS));

/**
 * The email's numbers for a run of days ending on `end`. Days that can't change any more are kept
 * in Cloudflare's cache after the first look (keepFor), so the dashboard stays light on the
 * game's database.
 */
async function range(env: Env, copy: Copy, url: URL) {
  const today = lagosDay(Date.now());
  const end = url.searchParams.get('end') ?? today;
  const days = Math.min(MAX_DAYS, Math.max(1, Number(url.searchParams.get('days') ?? 14) || 14));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || Number.isNaN(Date.parse(end)) || end > today) return fail(400, 'end is a date like 2026-10-19, today or earlier.');
  const cache = typeof caches === 'undefined' ? null : caches.default;
  const results = await Promise.all(
    daysTo(end, days).map(async (day) => {
      const cacheKey = new Request(`https://daraxando-admin.cache/${copy}/${day}?v=1`);
      if (day < today && cache) {
        const hit = await cache.match(cacheKey);
        if (hit) return { day, report: await hit.json() };
      }
      const res = await callGame(env, copy, 'stats', { method: 'GET', search: `?day=${day}` });
      const text = await res.text();
      if (!res.ok) {
        let error = `The game answered ${res.status}.`;
        try { error = (JSON.parse(text) as { error?: string }).error ?? error; } catch { /* keep the plain message */ }
        return { day, error, status: res.status };
      }
      const report = JSON.parse(text) as { usage?: { problems?: string[] } | null };
      const keep = keepFor(day, today, report);
      if (keep && cache) {
        await cache.put(cacheKey, new Response(text, { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${keep}` } }));
      }
      return { day, report };
    }),
  );
  // A wrong key or a locked game answers the same for every day: say it once.
  const firstError = results.find((r) => 'status' in r && (r.status === 401 || r.status === 404 || r.status === 429));
  if (firstError && 'error' in firstError) return fail(firstError.status ?? 502, `${copy === 'live' ? 'Live' : 'Test'} game: ${firstError.error}`);
  return json({ copy, today, days: results });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const liveKey = keyFor(env, 'live');

    // Every change needs this header. A browser only sends it from the dashboard's own page, so
    // another site can't make your browser change anything.
    const fromDashboard = req.headers.get('x-dara-admin') === '1';

    if (path === '/auth/me' && req.method === 'GET') {
      const signedIn = !!liveKey && (await validSession(liveKey, cookieFrom(req)));
      return json({ signedIn, copies: { live: !!liveKey, test: !!keyFor(env, 'test') } });
    }

    if (path === '/auth/signin' && req.method === 'POST') {
      if (!fromDashboard) return fail(403, 'Sign in from the dashboard.');
      if (!liveKey) return fail(503, 'The dashboard has no live admin key yet. Add ADMIN_KEY_LIVE in Cloudflare (admin/README.md).');
      const ip = req.headers.get('cf-connecting-ip') ?? 'local';
      if (env.SIGNIN_LIMITER && !(await env.SIGNIN_LIMITER.limit({ key: `signin:${ip}` })).success) return fail(429, 'Too many tries. Wait a minute.');
      let given = '';
      try { given = cleanKey(((await req.json()) as { key?: unknown }).key); } catch { /* no body */ }
      if (!given || !sameText(given, liveKey)) return fail(401, "That isn't the live admin key.");
      const exp = Date.now() + SESSION_DAYS * DAY_MS;
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie(await signSession(liveKey, exp), SESSION_DAYS * 86_400) });
    }

    if (path === '/auth/signout' && req.method === 'POST') {
      if (!fromDashboard) return fail(403, 'Sign out from the dashboard.');
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
    }

    const api = path.match(/^\/api\/(live|test)\/(.+)$/);
    if (api) {
      if (!liveKey || !(await validSession(liveKey, cookieFrom(req)))) return fail(401, 'Sign in again.');
      if (req.method === 'POST' && !fromDashboard) return fail(403, 'Changes only come from the dashboard.');
      const copy = api[1] as Copy;
      const rest = api[2];
      if (!keyFor(env, copy)) return fail(409, `The ${copy} game's admin key isn't saved on the dashboard yet (admin/README.md).`);
      if (rest === 'range' && req.method === 'GET') return range(env, copy, url);
      if (!ROUTES.some(([m, re]) => m === req.method && re.test(rest))) return fail(404, 'not found');
      const keep = req.method !== 'GET' ? undefined : rest === 'traffic' ? keepTraffic(url.search) : KEEP[rest];
      if (keep) return cached(env, copy, rest, url.search, keep);
      const res = await callGame(env, copy, rest, { method: req.method, search: url.search, body: req.method === 'POST' ? await req.text() : undefined });
      const type = res.headers.get('content-type') ?? 'application/json';
      const headers: Record<string, string> = { 'content-type': type, 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
      // The email opened in its own tab: its inline styles may run, nothing else.
      if (type.startsWith('text/html')) headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
      return new Response(res.body, { status: res.status, headers });
    }

    return fail(404, 'not found');
  },
} satisfies ExportedHandler<Env>;
