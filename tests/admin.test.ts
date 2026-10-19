// The admin dashboard's round 2 (worker/adminViews.ts, timed bans in worker/admin.ts and worker/db.ts).
import { describe, expect, it, vi } from 'vitest';
import { BAN_DAYS, TIMED_BANS_ON_REAL_GAME, timedBansOn } from '../worker/admin';
import { ANALYTICS_HOST, bucketStarts, summary, traffic, trafficWindow } from '../worker/adminViews';
import { banActive, toProfile, type PlayerRow } from '../worker/db';
import type { Env } from '../worker/env';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const row = (over: Partial<PlayerRow> = {}): PlayerRow =>
  ({
    id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', name: 'Tunde', avatar: 'tortoise', piece: 'drum', print: 'line', state: 'LA',
    rating: 1000, aura: 120, wins: 3, losses: 1, draws: 0, quick_games: 2, win_streak: 1, best_win_streak: 2, day_streak: 4,
    day_wins: 0, last_played_day: '2026-10-18', sapa_at: 0, cool_until: 0, created_at: NOW - 86_400_000 * 9, updated_at: NOW,
    habits: '{}', saved: 0, device: null, banned_at: null, ban_reason: null, ban_until: null, cowries: 5000, daily_day: null,
    big_losses: 0, habit_v: 0, name_set: 1, first_result: 'win', terms_version: '2026-10-18', terms_at: NOW,
    ...over,
  }) as PlayerRow;

describe('timed bans', () => {
  it('a ban is on until its end, and for good without one', () => {
    expect(banActive(row(), NOW)).toBe(false);
    expect(banActive(row({ banned_at: NOW - 1000 }), NOW)).toBe(true);
    expect(banActive(row({ banned_at: NOW - 1000, ban_until: NOW + 60_000 }), NOW)).toBe(true);
    expect(banActive(row({ banned_at: NOW - 1000, ban_until: NOW - 1 }), NOW)).toBe(false);
  });

  it('the player and the admin list both see when a ban ends', () => {
    const until = Date.now() + 86_400_000;
    const r = row({ banned_at: NOW, ban_reason: 'Rude name.', ban_until: until });
    expect(toProfile(r).ban).toEqual({ at: NOW, reason: 'Rude name.', until });
    expect(summary(r).ban).toEqual({ at: NOW, reason: 'Rude name.', until });
    expect(toProfile(row({ banned_at: NOW, ban_reason: 'x', ban_until: Date.now() - 1 })).ban).toBeNull();
    expect(summary(row({ banned_at: NOW, ban_reason: 'x' })).ban).toEqual({ at: NOW, reason: 'x', until: null });
  });

  it('are off on the real game until the lawyer approves, and on the test copy', () => {
    expect(TIMED_BANS_ON_REAL_GAME).toBe(false);
    expect(timedBansOn({ ENVIRONMENT: 'production' } as Env)).toBe(false);
    expect(timedBansOn({ ENVIRONMENT: 'staging' } as Env)).toBe(true);
    expect([...BAN_DAYS]).toEqual([1, 7, 30]);
  });
});

describe('traffic for any window', () => {
  const HOUR = 3_600_000;
  const now = Date.parse('2026-10-19T20:42:30Z');
  const sp = (q: string) => new URLSearchParams(q);

  it('reads the last hours, a time a link was shared, or whole days', () => {
    expect(trafficWindow(sp('hours=5'), now)).toMatchObject({ key: '5h', from: now - 5 * HOUR, to: now, bucket: 'quarter', before: now - 10 * HOUR });
    expect(trafficWindow(sp('hours=24'), now)).toMatchObject({ key: '24h', bucket: 'hour' });
    expect(trafficWindow(sp('hours=72'), now)).toMatchObject({ key: '72h', bucket: 'hour' });
    // A time a link was shared, to the minute; never more than 30 days back or closer than 5 minutes.
    const shared = Date.parse('2026-10-19T19:30:20Z');
    expect(trafficWindow(sp(`since=${shared}`), now)).toMatchObject({ key: 'since', from: Date.parse('2026-10-19T19:30:00Z'), bucket: 'quarter' });
    expect(trafficWindow(sp(`since=${now - 90 * 86_400_000}`), now).from).toBe(now - 30 * 86_400_000);
    expect(trafficWindow(sp(`since=${now}`), now).from).toBe(now - 5 * 60_000);
    expect(trafficWindow(sp('days=30'), now)).toMatchObject({ key: '30d', from: Date.parse('2026-09-20T00:00:00Z'), bucket: 'day' });
    // Anything else is the last 7 days.
    expect(trafficWindow(sp('hours=3'), now)).toMatchObject({ key: '7d', from: Date.parse('2026-10-13T00:00:00Z') });
  });

  it('has a bucket for every quarter hour, hour or day, quiet ones included', () => {
    const q = bucketStarts(now - HOUR, now, 'quarter');
    expect(q.map((t) => new Date(t).toISOString().slice(11, 16))).toEqual(['19:30', '19:45', '20:00', '20:15', '20:30']);
    expect(bucketStarts(now - 24 * HOUR, now, 'hour')).toHaveLength(25);
  });

  const db = (rows: { b: number; joined: number; finished: number; saved: number }[], before = 3, saves = 2) =>
    ({
      prepare: () => ({ bind: () => ({}) }),
      batch: async () => [{ results: rows }, { results: [{ n: before }] }, { results: [{ n: saves }] }],
    }) as unknown as D1Database;

  it('counts new players by bucket from the database, and works on the test copy without Web Analytics', async () => {
    vi.useFakeTimers({ now });
    const at = Math.floor((now - 30 * 60_000) / 900_000);
    const out = await traffic({ ENVIRONMENT: 'staging', DB: db([{ b: at, joined: 4, finished: 3, saved: 1 }]) } as unknown as Env, new URL('https://game/api/admin/traffic?hours=1'));
    vi.useRealTimers();
    expect(out.players).toEqual({ joined: 4, finished: 3, saved: 1, before: 3, savedAny: 2 });
    expect(out.buckets.find((b) => b.joined)?.at).toBe(at * 900_000);
    expect(out.buckets.every((b) => b.visits === null)).toBe(true);
    expect(out.web).toEqual({ off: 'Visits come from Web Analytics, which only runs on the live game.' });
  });

  const env = { ENVIRONMENT: 'production', CF_ACCOUNT_ID: '0123456789abcdef0123456789abcdef', CF_ANALYTICS_TOKEN: 'token', DB: db([]) } as unknown as Env;

  it('asks Web Analytics for the live site in that window, with the window before it, and drops visits between its own pages', async () => {
    vi.useFakeTimers({ now });
    let sent = '';
    vi.stubGlobal('fetch', async (_: string, init: { body: string }) => {
      sent = JSON.parse(init.body).query;
      return Response.json({
        data: {
          viewer: {
            accounts: [
              {
                total: [{ count: 900, sum: { visits: 400 } }],
                before: [{ count: 300, sum: { visits: 100 } }],
                buckets: [{ count: 100, sum: { visits: 50 }, dimensions: { datetimeHour: '2026-10-19T19:00:00Z' } }],
                referers: [
                  { count: 300, sum: { visits: 200 }, dimensions: { refererHost: '' } },
                  { count: 200, sum: { visits: 120 }, dimensions: { refererHost: 'l.instagram.com' } },
                  { count: 400, sum: { visits: 80 }, dimensions: { refererHost: ANALYTICS_HOST } },
                ],
                countries: [{ count: 800, sum: { visits: 380 }, dimensions: { countryName: 'NG' } }],
                devices: [{ count: 850, sum: { visits: 390 }, dimensions: { deviceType: 'mobile' } }],
              },
            ],
          },
        },
        errors: null,
      });
    });
    const out = await traffic(env, new URL('https://game/api/admin/traffic?hours=12'));
    vi.unstubAllGlobals();
    vi.useRealTimers();
    expect(sent).toContain(`requestHost: "${ANALYTICS_HOST}"`);
    expect(sent).toContain('accountTag: "0123456789abcdef0123456789abcdef"');
    expect(sent).toContain('datetime_geq: "2026-10-19T08:42:30Z"');
    expect(sent).toContain('orderBy: [datetimeHour_ASC]');
    expect(out.web).toMatchObject({ visits: 400, views: 900, before: { visits: 100, views: 300 } });
    expect('referers' in out.web ? out.web.referers?.map((r) => r.host) : null).toEqual(['', 'l.instagram.com']);
    expect(out.buckets.find((b) => b.at === Date.parse('2026-10-19T19:00:00Z'))).toMatchObject({ visits: 50, views: 100 });
    expect(out.buckets.filter((b) => b.visits === 0).length).toBe(out.buckets.length - 1);
  });

  it('says why when Cloudflare refuses, and still counts new players', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ data: null, errors: [{ message: 'not authorized for that account' }] }));
    const out = await traffic(env, new URL('https://game/api/admin/traffic?days=7'));
    vi.unstubAllGlobals();
    expect(out.web).toEqual({ problem: "Couldn't read Web Analytics: not authorized for that account" });
    expect(out.players.before).toBe(3);
  });
});
