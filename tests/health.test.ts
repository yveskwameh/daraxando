// System health (worker/health.ts): each check, with the outside services stood in for.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloudflareCheck, health, worst } from '../worker/health';
import type { Env } from '../worker/env';

/** A database that answers each statement from `answer`. */
const db = (answer: (sql: string) => Record<string, unknown> | null = () => null) =>
  ({
    prepare: (sql: string) => {
      const st = { bind: () => st, first: async () => answer(sql) };
      return st;
    },
  }) as unknown as D1Database;

const ns = (stub: Record<string, () => Promise<unknown>>) => ({ get: () => stub, idFromName: () => 'id' });

function env(over: Partial<Env> = {}, answer?: (sql: string) => Record<string, unknown> | null) {
  return {
    ENVIRONMENT: 'production',
    DB: db(answer ?? ((sql) => (sql.includes('SELECT 1') ? { one: 1 } : { n: 3, at: null }))),
    MATCHMAKER: ns({ now: async () => ({ home: 12, looking: 2, waiting: 1 }) }),
    NOTIFIER: ns({ status: async () => ({ day: '2026-10-20', sent: 40 }) }),
    ...over,
  } as unknown as Env;
}

const byId = (h: Awaited<ReturnType<typeof health>>, id: string) => h.checks.find((c) => c.id === id)!;
// 10:00 in Lagos, 21 October 2026.
const MORNING = Date.parse('2026-10-21T09:00:00Z');
// 20:00 in Lagos.
const EVENING = Date.parse('2026-10-21T19:00:00Z');

afterEach(() => vi.unstubAllGlobals());

describe('system health', () => {
  it('says what isn\'t set up on a copy, instead of calling it broken', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ incidents: [] }));
    const h = await health(env(), MORNING);
    expect(byId(h, 'database')).toMatchObject({ state: 'ok' });
    expect(byId(h, 'matches')).toMatchObject({ state: 'ok', detail: '12 on Home, 1 waiting for a game' });
    for (const id of ['email', 'google', 'push', 'reminders', 'report', 'plan', 'errors', 'analytics']) expect(byId(h, id).state).toBe('off');
    expect(byId(h, 'cloudflare')).toMatchObject({ state: 'ok' });
  });

  it('calls a database that fails down', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ incidents: [] }));
    const broken = env({ DB: { prepare: () => ({ bind() { return this; }, first: async () => { throw new Error('D1_ERROR: no such table'); } }) } as unknown as D1Database });
    expect(byId(await health(broken, MORNING), 'database')).toMatchObject({ state: 'down' });
  });

  it('checks email without sending any, and accepts a send-only key', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      if (url.includes('resend')) return Response.json({ name: 'restricted_api_key', message: 'This API key is restricted to only send emails' }, { status: 401 });
      return Response.json({ incidents: [] });
    });
    const h = await health(env({ RESEND_API_KEY: 're_test' }), MORNING);
    expect(byId(h, 'email')).toMatchObject({ state: 'ok' });
    expect(byId(h, 'email').detail).toMatch(/can only send/);
    expect(calls.filter((u) => u.includes('resend'))).toEqual(['https://api.resend.com/domains']);
  });

  it('says when the sending domain isn\'t verified, or the key is refused', async () => {
    vi.stubGlobal('fetch', async (url: string) => (url.includes('resend') ? Response.json({ data: [{ name: 'noreply.daraxando.yveskwameh.com', status: 'pending' }] }) : Response.json({ incidents: [] })));
    expect(byId(await health(env({ RESEND_API_KEY: 're_test' }), MORNING), 'email').state).toBe('down');
    vi.stubGlobal('fetch', async (url: string) => (url.includes('resend') ? Response.json({ name: 'validation_error', message: 'API key is invalid' }, { status: 401 }) : Response.json({ incidents: [] })));
    expect(byId(await health(env({ RESEND_API_KEY: 're_test' }), MORNING), 'email').detail).toMatch(/refused the key/);
  });

  it('notices a 7 pm run or an 8 am email that didn\'t happen', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ incidents: [] }));
    const set = { VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'k', RESEND_API_KEY: '', REPORT_EMAIL: 'yves@example.com' } as Partial<Env>;
    // Before 7 pm, yesterday's run is fine; after 7:15 pm it isn't.
    expect(byId(await health(env(set), MORNING), 'reminders').state).toBe('ok');
    expect(byId(await health(env(set), EVENING), 'reminders').state).toBe('down');
    const ranToday = env({ ...set, NOTIFIER: ns({ status: async () => ({ day: "2026-10-21", sent: 51 }) }) } as unknown as Partial<Env>);
    expect(byId(await health(ranToday, EVENING), 'reminders')).toMatchObject({ state: 'ok', detail: 'Ran tonight: 51 reminders sent.' });
  });

  it('reads the free plan and the last hour\'s errors from Cloudflare', async () => {
    vi.stubGlobal('fetch', async (url: string, init?: { body?: string }) => {
      if (!url.includes('graphql')) return Response.json({ incidents: [] });
      const q = String(init?.body ?? '');
      const acc = q.includes('scriptName: \\"daraxando\\"')
        ? { workersInvocationsAdaptive: [{ sum: { requests: 1000, errors: 30 } }] }
        : {
            workersInvocationsAdaptive: [{ sum: { requests: 62_000, errors: 3 }, dimensions: { scriptName: 'daraxando' } }],
            durableObjectsInvocationsAdaptiveGroups: [{ sum: { requests: 10_000 } }],
            d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 100_000, rowsWritten: 5_000 } }],
          };
      return Response.json({ data: { viewer: { accounts: [acc] } }, errors: null });
    });
    const h = await health(env({ CF_ACCOUNT_ID: '0123456789abcdef0123456789abcdef', CF_ANALYTICS_TOKEN: 't' }), MORNING);
    expect(byId(h, 'plan')).toMatchObject({ state: 'warn' });
    expect(byId(h, 'plan').detail).toMatch(/requests at 62%/);
    expect(byId(h, 'errors')).toMatchObject({ state: 'warn', detail: '30 of 1,000 requests failed (3%).' });
    expect(byId(h, 'analytics').state).toBe('ok');
  });

  it('counts Cloudflare incidents only when they touch the parts we use', () => {
    expect(cloudflareCheck([]).state).toBe('ok');
    expect(cloudflareCheck([{ name: 'Slow DNS in Sydney', impact: 'minor', components: [{ name: 'Sydney, Australia - (SYD)', status: 'degraded_performance' }] }])).toMatchObject({ state: 'ok', detail: expect.stringMatching(/1 incident elsewhere/) });
    expect(cloudflareCheck([{ name: 'Workers errors', impact: 'minor', components: [{ name: 'Workers', status: 'degraded_performance' }] }]).state).toBe('warn');
    expect(cloudflareCheck([{ name: 'D1 outage', impact: 'major', components: [{ name: 'D1', status: 'major_outage' }] }]).state).toBe('down');
    expect(cloudflareCheck([{ name: 'Lagos maintenance', impact: 'minor', components: [{ name: 'Lagos, Nigeria - (LOS)', status: 'partial_outage' }] }]).state).toBe('warn');
  });

  it('picks the worse state', () => {
    expect(worst(['ok', 'warn'])).toBe('warn');
    expect(worst(['warn', 'down', 'ok'])).toBe('down');
    expect(worst(['ok', 'off'])).toBe('off');
  });
});
