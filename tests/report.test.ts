import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../worker/env';
import { freePlanUse, limits, reportEmail, reportTo, type Report } from '../worker/report';
import { matchStat, waitBucket } from '../worker/stats';

const base: Report = {
  day: '2026-10-10',
  copy: 'production',
  players: {
    played: 185, playedDayBefore: 130, week: 244, joined: 52, saved: 6,
    buckets: { new: 35, current: 121, reactivated: 19, resurrected: 10 },
    atRisk: 59, curr: { of: 100, back: 68 },
  },
  first: { joined: 52, finished: 35, known: 35, won: 20, nextDay: { day: '2026-10-09', of: 30, back: 13 }, week: { day: '2026-10-03', of: 26, back: 4 } },
  matches: {
    total: 537, kinds: { bot: 331, quick: 179, friend: 27 }, modes: { fading: 350, classic: 152, big: 29, pro: 6 },
    stakes: [{ stake: 0, n: 159 }, { stake: 100, n: 30 }], roomsMade: 34,
  },
  quick: { joined: 61, joinMissed: 7, paired: 104, pairedWaits: { 0: 70, 10: 22, 30: 9, 60: 3, 120: 0 }, pairedAvgS: 13, left: 42, leftWaits: { 0: 8, 10: 14, 30: 12, 60: 6, 120: 2 }, leftAvgS: 40 },
  extra: { notifyPhones: 80, reminders: 12, appealsOpen: 0, savedFromAsk: 2, pushOn: { 'streak-ask': 3, 'friends-ask': 1, settings: 2 }, tour: { shown: 4, done: 2, skipped: 1, find: 2, replay: 0 } },
  usage: { day: '2026-10-10', requests: { total: 30_000, copies: [{ name: 'daraxando', n: 30_000 }] }, errors: 0, doRequests: 20_000, rowsRead: 1_000_000, rowsWritten: 20_000, problems: [] },
};

describe('game number counters', () => {
  it('puts Quick match waits in the right bucket', () => {
    expect(waitBucket(0)).toBe(0);
    expect(waitBucket(9_999)).toBe(0);
    expect(waitBucket(10_000)).toBe(10);
    expect(waitBucket(59_000)).toBe(30);
    expect(waitBucket(61_000)).toBe(60);
    expect(waitBucket(600_000)).toBe(120);
  });
  it('names one counter per kind, mode and stake', () => {
    expect(matchStat('quick', 'fading', 100)).toBe('m:quick:fading:100');
  });
});

describe('the 8 am email', () => {
  it('follows the writing rules', () => {
    const { subject, html, text } = reportEmail(base);
    for (const s of [subject, html, text]) {
      expect(s).not.toMatch(/—/);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s).not.toMatch(/\bbet\b|cowries|\bXP\b/i);
    }
    // Every note in brackets starts with a capital letter or a number.
    for (const m of text.matchAll(/: [^\n(]+ \(([^)])/g)) expect(m[1]).toMatch(/[A-Z0-9]/);
  });

  it('leads with the numbers that matter', () => {
    const { subject, text } = reportEmail(base);
    expect(subject).toBe('Dara X&O, Sat 10 Oct: 185 played, 52 new');
    expect(text).toContain('185 played on Sat 10 Oct, up 55 on the day before. 52 new players, and 67% of them finished their first match.');
    expect(text).toContain('Regulars who came back: 68%');
    expect(text).toContain('Came back the next day: 43%');
  });

  it('says how many said yes to the asks, and where', () => {
    const { text } = reportEmail(base);
    expect(text).toMatch(/Saved their progress: \d+ \(2 from the ask on Home\)/);
    expect(text).toContain('Turned on notifications: 6 (3 from the streak ask, 1 from the friend ask, 2 in Settings)');
  });

  it('marks the test copy', () => {
    expect(reportEmail({ ...base, copy: 'staging' }).subject).toMatch(/^Test copy: /);
    expect(reportEmail(base).html).not.toContain('Test copy');
  });

  it('warns from half a free limit, in the subject too', () => {
    expect(reportEmail(base).text).not.toContain('Warning');
    const busy = { ...base, usage: { ...base.usage!, rowsWritten: 86_000, requests: { total: 65_000, copies: [] } } };
    const mail = reportEmail(busy);
    expect(mail.subject).toContain('86% of a free limit');
    expect(mail.text).toContain('database rows written at 86%, requests to the game at 65%');
    expect(mail.html).toContain('#ffe3f2'); // red from 80%
    const amber = reportEmail({ ...base, usage: { ...base.usage!, requests: { total: 55_000, copies: [] } } });
    expect(amber.html).toContain('#fff4d6');
  });

  it('says how to turn the free plan part on when it is off', () => {
    expect(reportEmail({ ...base, usage: null }).text).toContain('Add the CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN secrets');
  });

  it('keeps names safe in the HTML', () => {
    const odd = { ...base, usage: { ...base.usage!, requests: { total: 10, copies: [{ name: '<b>x</b>', n: 5 }, { name: 'y', n: 5 }] } } };
    expect(reportEmail(odd).html).not.toContain('<b>x</b>');
  });

  it('works on a quiet first day with nothing played', () => {
    const quiet: Report = {
      ...base,
      players: { ...base.players, played: 0, playedDayBefore: 0, week: 0, joined: 0, saved: 0, buckets: { new: 0, current: 0, reactivated: 0, resurrected: 0 }, atRisk: 0, curr: { of: 0, back: 0 } },
      first: { joined: 0, finished: 0, known: 0, won: 0, nextDay: { day: '2026-10-09', of: 0, back: 0 }, week: { day: '2026-10-03', of: 0, back: 0 } },
      matches: { total: 0, kinds: { bot: 0, quick: 0, friend: 0 }, modes: { fading: 0, classic: 0, big: 0, pro: 0 }, stakes: [], roomsMade: 0 },
      quick: { joined: 0, joinMissed: 0, paired: 0, pairedWaits: {}, pairedAvgS: null, left: 0, leftWaits: {}, leftAvgS: null },
    };
    const { text } = reportEmail(quiet);
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
    expect(text).toContain('Finished their first match: none yet');
  });
});

describe('who gets it', () => {
  it('takes up to 3 addresses and skips anything that is not one', () => {
    expect(reportTo({ REPORT_EMAIL: ' a@b.co, nope, c@d.ng ,e@f.com, g@h.io' } as Env)).toEqual(['a@b.co', 'c@d.ng', 'e@f.com']);
    expect(reportTo({} as Env)).toEqual([]);
  });
});

describe('the free plan numbers', () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = { CF_ACCOUNT_ID: '0123456789abcdef0123456789abcdef', CF_ANALYTICS_TOKEN: 'token', ENVIRONMENT: 'production' } as Env;
  const answer = (acc: Record<string, unknown>) => new Response(JSON.stringify({ data: { viewer: { accounts: [acc] } }, errors: null }));

  it('adds up every Worker, Durable Object and database in the account', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const q = JSON.parse(String(init.body)).query as string;
      asked.push(q);
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer token');
      if (q.includes('workersInvocationsAdaptive')) return answer({ workersInvocationsAdaptive: [
        { sum: { requests: 400, errors: 1 }, dimensions: { scriptName: 'daraxando' } },
        { sum: { requests: 100, errors: 0 }, dimensions: { scriptName: 'daraxando-staging' } },
        { sum: { requests: 50, errors: 2 }, dimensions: { scriptName: 'daraxando' } },
      ] });
      if (q.includes('durableObjects')) return answer({ durableObjectsInvocationsAdaptiveGroups: [{ sum: { requests: 70 } }] });
      return answer({ d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 900, rowsWritten: 30 } }, { sum: { rowsRead: 100, rowsWritten: 5 } }] });
    }));
    const u = (await freePlanUse(env, '2026-10-10'))!;
    expect(u.requests).toEqual({ total: 550, copies: [{ name: 'daraxando', n: 450 }, { name: 'daraxando-staging', n: 100 }] });
    expect(u.errors).toBe(3);
    expect(u.doRequests).toBe(70);
    expect(u.rowsRead).toBe(1000);
    expect(u.rowsWritten).toBe(35);
    expect(u.problems).toEqual([]);
    expect(asked.every((q) => q.includes('accountTag: "0123456789abcdef0123456789abcdef"'))).toBe(true);
    expect(limits(u)[0].share).toBeCloseTo(0.0055);
  });

  it('reports what failed and keeps the rest', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const q = JSON.parse(String(init.body)).query as string;
      if (q.includes('d1Analytics')) return new Response(JSON.stringify({ data: null, errors: [{ message: 'not authorized' }] }));
      if (q.includes('durableObjects')) throw new Error('network down');
      return answer({ workersInvocationsAdaptive: [] });
    }));
    const u = (await freePlanUse(env, '2026-10-10'))!;
    expect(u.requests?.total).toBe(0);
    expect(u.rowsRead).toBeNull();
    expect(u.problems.join(' ')).toMatch(/Database rows: not authorized/);
    expect(u.problems.join(' ')).toMatch(/Durable Object requests: network down/);
  });

  it('is off without both secrets, and says so when the account id is wrong', async () => {
    expect(await freePlanUse({} as Env, '2026-10-10')).toBeNull();
    const u = await freePlanUse({ ...env, CF_ACCOUNT_ID: 'my-account' }, '2026-10-10');
    expect(u?.problems[0]).toMatch(/doesn't look like an account id/);
  });
});
