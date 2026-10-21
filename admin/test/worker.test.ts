// The admin Worker: signing in, the cookie, which game calls pass, and the run of days.
// Run with `npm test` (Node's own test runner, no extra packages).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { daysTo, keepFor, keepTraffic, type Env } from '../worker/index.ts';
import { cleanKey, sameText, signSession, validSession } from '../worker/session.ts';

const LIVE_KEY = 'a'.repeat(24) + '0123456789abcdef';
const TEST_KEY = 'b'.repeat(24) + 'fedcba9876543210';
const ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

type Call = { url: string; method: string; auth: string; body?: string };
function fakeGame(calls: Call[], answer: (url: URL, method: string) => Response = () => Response.json({ ok: true })) {
  return {
    fetch: async (input: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
      calls.push({ url: input, method: init.method, auth: init.headers.authorization, body: init.body });
      return answer(new URL(input), init.method);
    },
  } as unknown as Fetcher;
}

function env(over: Partial<Env> = {}, calls: Call[] = [], answer?: (url: URL, method: string) => Response): Env {
  return { ADMIN_KEY_LIVE: LIVE_KEY, ADMIN_KEY_TEST: TEST_KEY, LIVE: fakeGame(calls, answer), TEST: fakeGame(calls, answer), ...over };
}

const call = (path: string, e: Env, init: RequestInit = {}) => worker.fetch(new Request(`https://admin.example${path}`, init), e);

async function signedIn(e: Env) {
  const res = await call('/auth/signin', e, { method: 'POST', headers: { 'x-dara-admin': '1', 'content-type': 'application/json' }, body: JSON.stringify({ key: LIVE_KEY }) });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie') ?? '';
  return cookie.split(';')[0];
}

test('cleanKey drops the hidden characters a paste can add', () => {
  assert.equal(cleanKey(` ${LIVE_KEY}\n​`), LIVE_KEY);
  assert.equal(cleanKey(undefined), '');
  assert.ok(sameText('abc', 'abc'));
  assert.ok(!sameText('abc', 'abd'));
  assert.ok(!sameText('abc', 'abcd'));
});

test('a session cookie only works with the key that signed it, until it ends', async () => {
  const now = Date.now();
  const v = await signSession(LIVE_KEY, now + 60_000);
  assert.ok(await validSession(LIVE_KEY, v, now));
  assert.ok(!(await validSession(LIVE_KEY, v, now + 61_000)), 'ended');
  assert.ok(!(await validSession(TEST_KEY, v, now)), 'another key');
  assert.ok(!(await validSession(LIVE_KEY, v.replace(/.$/, (c) => (c === '0' ? '1' : '0')), now)), 'changed');
  assert.ok(!(await validSession(LIVE_KEY, `${now + 999_999_999}.${v.split('.')[1]}`, now)), 'longer life, same signature');
  assert.ok(!(await validSession(LIVE_KEY, null, now)));
});

test('signing in needs the dashboard header and the live key', async () => {
  const e = env();
  const me = await (await call('/auth/me', e)).json();
  assert.deepEqual(me, { signedIn: false, copies: { live: true, test: true } });

  assert.equal((await call('/auth/signin', e, { method: 'POST', body: JSON.stringify({ key: LIVE_KEY }) })).status, 403);
  const wrong = await call('/auth/signin', e, { method: 'POST', headers: { 'x-dara-admin': '1' }, body: JSON.stringify({ key: TEST_KEY }) });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);

  const ok = await call('/auth/signin', e, { method: 'POST', headers: { 'x-dara-admin': '1' }, body: JSON.stringify({ key: `\n${LIVE_KEY} ` }) });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^dara_admin=\d{13}\.[0-9a-f]{64}; Path=\/; Max-Age=1209600; HttpOnly; Secure; SameSite=Strict$/);
  const me2 = await (await call('/auth/me', e, { headers: { cookie: cookie.split(';')[0] } })).json();
  assert.equal((me2 as { signedIn: boolean }).signedIn, true);
});

test('no live key means nobody can sign in', async () => {
  const e = env({ ADMIN_KEY_LIVE: 'short' });
  const res = await call('/auth/signin', e, { method: 'POST', headers: { 'x-dara-admin': '1' }, body: JSON.stringify({ key: 'short' }) });
  assert.equal(res.status, 503);
});

test('too many tries waits a minute', async () => {
  const e = env({ SIGNIN_LIMITER: { limit: async () => ({ success: false }) } as unknown as RateLimit });
  const res = await call('/auth/signin', e, { method: 'POST', headers: { 'x-dara-admin': '1' }, body: JSON.stringify({ key: LIVE_KEY }) });
  assert.equal(res.status, 429);
});

test('game calls need a session, and go to the right game with its own key', async () => {
  const calls: Call[] = [];
  const e = env({}, calls);
  assert.equal((await call('/api/live/players?q=Ada', e)).status, 401);
  assert.equal(calls.length, 0);

  const cookie = await signedIn(e);
  const res = await call('/api/live/players?q=Ada', e, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls.at(-1), { url: 'https://game/api/admin/players?q=Ada', method: 'GET', auth: `Bearer ${LIVE_KEY}`, body: undefined });

  await call(`/api/test/players/${ID}`, e, { headers: { cookie } });
  assert.equal(calls.at(-1)!.auth, `Bearer ${TEST_KEY}`);
});

test('changes need the dashboard header, and only the admin API routes pass', async () => {
  const calls: Call[] = [];
  const e = env({}, calls);
  const cookie = await signedIn(e);
  const post = (path: string, headers: Record<string, string> = { 'x-dara-admin': '1' }) =>
    call(path, e, { method: 'POST', headers: { cookie, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ reason: 'Rude name' }) });

  assert.equal((await post(`/api/live/players/${ID}/ban`, {})).status, 403);
  assert.equal(calls.length, 0);

  assert.equal((await post(`/api/live/players/${ID}/ban`)).status, 200);
  assert.deepEqual(calls.at(-1), { url: `https://game/api/admin/players/${ID}/ban`, method: 'POST', auth: `Bearer ${LIVE_KEY}`, body: '{"reason":"Rude name"}' });

  // Recovery requests: give it back or refuse, and nothing else.
  assert.equal((await post('/api/live/recoveries/2_zesd35rZhf/give')).status, 200);
  assert.equal(calls.at(-1)!.url, 'https://game/api/admin/recoveries/2_zesd35rZhf/give');
  assert.equal((await call('/api/live/recoveries?status=open', e, { headers: { cookie } })).status, 200);

  for (const path of [`/api/live/players/${ID}/delete`, '/api/live/stats', '/api/live/players%2F..%2Freport', '/api/live/players/not-an-id/ban', '/api/live/appeals/1/forget', '/api/live/recoveries/2_zesd35rZhf/stop', '/api/live/recoveries/x/give']) {
    const before = calls.length;
    assert.equal((await post(path)).status, 404, path);
    assert.equal(calls.length, before, path);
  }
  assert.equal((await call('/api/live/report?day=2026-10-18', e, { method: 'DELETE', headers: { cookie } })).status, 404);
  assert.equal((await call('/api/prod/stats', e, { headers: { cookie } })).status, 404);
});

test('a game without its key saved says so', async () => {
  const e = env({ ADMIN_KEY_TEST: undefined });
  const cookie = await signedIn(e);
  const res = await call('/api/test/stats?day=2026-10-18', e, { headers: { cookie } });
  assert.equal(res.status, 409);
  assert.deepEqual((await (await call('/auth/me', e)).json() as { copies: unknown }).copies, { live: true, test: false });
});

test('a new live key signs every device out', async () => {
  const e = env();
  const cookie = await signedIn(e);
  const e2 = env({ ADMIN_KEY_LIVE: 'c'.repeat(40) });
  assert.equal((await call('/api/live/players?q=Ada', e2, { headers: { cookie } })).status, 401);
});

test('the email in its own tab only runs its own styles', async () => {
  const e = env({}, [], () => new Response('<html>report</html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }));
  const cookie = await signedIn(e);
  const res = await call('/api/live/report?day=2026-10-18', e, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/);
});

test('a run of days asks the game for each day, oldest first', async () => {
  const calls: Call[] = [];
  const e = env({}, calls, (url) => Response.json({ day: url.searchParams.get('day'), usage: null }));
  const cookie = await signedIn(e);
  const res = await call('/api/live/range?end=2026-10-18&days=5', e, { headers: { cookie } });
  const body = (await res.json()) as { days: { day: string; report: { day: string } }[] };
  assert.deepEqual(body.days.map((d) => d.day), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.deepEqual(body.days.map((d) => d.report.day), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.ok(calls.every((c) => c.url.startsWith('https://game/api/admin/stats?day=') && c.method === 'GET'));

  assert.equal((await call('/api/live/range?end=2099-01-01', e, { headers: { cookie } })).status, 400);
  assert.equal((await call('/api/live/range?end=yesterday', e, { headers: { cookie } })).status, 400);
  const many = (await (await call('/api/live/range?end=2026-10-18&days=400', e, { headers: { cookie } })).json()) as { days: unknown[] };
  assert.equal(many.days.length, 31);
});

test('a wrong game key is said once, not once a day', async () => {
  const e = env({}, [], () => Response.json({ error: 'Wrong or missing admin key.' }, { status: 401 }));
  const cookie = await signedIn(e);
  const res = await call('/api/live/range?end=2026-10-18&days=3', e, { headers: { cookie } });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Live game: Wrong or missing admin key.' });
});

test('days that can still change are kept a short time, or not at all', () => {
  const today = '2026-10-19';
  assert.equal(keepFor(today, today, { usage: { problems: [] } }), 0);
  assert.equal(keepFor('2026-10-18', today, { usage: { problems: [] } }), 600);
  assert.equal(keepFor('2026-10-10', today, { usage: { problems: [] } }), 30 * 86_400);
  assert.equal(keepFor('2026-10-10', today, { usage: { problems: ['the database numbers.'] } }), 600);
  assert.equal(keepFor('2026-10-10', today, { usage: null }), 600);
  assert.deepEqual(daysTo('2026-03-02', 3), ['2026-02-28', '2026-03-01', '2026-03-02']);
  // Traffic: a minute for the last hours or since a time, 10 minutes for whole days.
  assert.equal(keepTraffic('?hours=1'), 60);
  assert.equal(keepTraffic('?since=1792440000000'), 60);
  assert.equal(keepTraffic('?days=30'), 600);
});

test('the dashboard views pass through, read-only', async () => {
  const calls: Call[] = [];
  const e = env({}, calls);
  const cookie = await signedIn(e);
  for (const path of ['info', 'players/list?tab=today&sort=active&page=1', 'players/counts', 'now', 'traffic?days=30', 'traffic?hours=5', 'phones?min=3', 'retention?weeks=8', 'first-days?days=90']) {
    const res = await call(`/api/live/${path}`, e, { headers: { cookie } });
    assert.equal(res.status, 200, path);
    assert.equal(calls.at(-1)!.url, `https://game/api/admin/${path}`);
    assert.equal(calls.at(-1)!.method, 'GET');
  }
  for (const path of ['players/everyone', 'now/1', 'traffic/raw', 'sources']) {
    assert.equal((await call(`/api/live/${path}`, e, { headers: { cookie } })).status, 404, path);
  }
  const post = await call('/api/live/players/list', e, { method: 'POST', headers: { cookie, 'x-dara-admin': '1' }, body: '{}' });
  assert.equal(post.status, 404);
});
