// Phones and players (worker/phones.ts): links, the cap on new players a phone, and the stakes rule.
import { describe, expect, it } from 'vitest';
import type { Env } from '../worker/env';
import { linkPhone, NEW_PLAYERS_PER_PHONE, PHONE_FULL, PHONE_LINKS_ON_REAL_GAME, phoneFull, phoneLinksOn } from '../worker/phones';
import { stakeBack } from '../worker/safety';

type Call = { sql: string; args: unknown[] };

/** A stand-in for D1 that records every statement and answers from `answer`. */
function fakeDb(answer: (sql: string, args: unknown[]) => Record<string, unknown>[] = () => []) {
  const calls: Call[] = [];
  const stmt = (sql: string) => ({
    sql,
    args: [] as unknown[],
    bind(...args: unknown[]) {
      this.args = args;
      return this;
    },
    async first<T>() {
      calls.push({ sql, args: this.args });
      return (answer(sql, this.args)[0] ?? null) as T;
    },
    async run() {
      calls.push({ sql, args: this.args });
      return { meta: { changes: 1 } };
    },
    async all() {
      calls.push({ sql, args: this.args });
      return { results: answer(sql, this.args) };
    },
  });
  const db = {
    prepare: (sql: string) => stmt(sql),
    async batch(list: ReturnType<typeof stmt>[]) {
      return list.map((s) => {
        calls.push({ sql: s.sql, args: s.args });
        return { results: answer(s.sql, s.args) };
      });
    },
  };
  return { db: db as unknown as D1Database, calls };
}

const NOW = Date.parse('2026-10-19T21:00:00Z');

describe('phone links', () => {
  it('are on everywhere since the lawyer approved them', () => {
    expect(PHONE_LINKS_ON_REAL_GAME).toBe(true);
    expect(phoneLinksOn({ ENVIRONMENT: 'production' } as Env)).toBe(true);
    expect(phoneLinksOn({ ENVIRONMENT: 'staging' } as Env)).toBe(true);
    expect(phoneLinksOn({ ENVIRONMENT: 'local' } as Env)).toBe(true);
  });

  it('record a phone once, and touch an old link at most once a day', async () => {
    const { db, calls } = fakeDb();
    await linkPhone({ ENVIRONMENT: 'staging', DB: db } as Env, 'p1', 'phoneA', 'signin', NOW);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('INSERT INTO player_phones');
    expect(calls[0].sql).toContain('ON CONFLICT (player_id, phone) DO UPDATE SET last_at = ?4 WHERE last_at < ?4 - 86400000');
    expect(calls[0].args).toEqual(['p1', 'phoneA', 'signin', NOW]);
  });

  it('keep nothing without a phone id', async () => {
    const { db, calls } = fakeDb();
    await linkPhone({ ENVIRONMENT: 'staging', DB: db } as Env, 'p1', null, 'seen', NOW);
    expect(calls).toHaveLength(0);
  });
});

describe('new players a phone', () => {
  const count = (n: number) => fakeDb((sql) => (sql.includes('COUNT(*)') ? [{ n }] : []));

  it('allows 2 in 30 days, then says to sign in', async () => {
    expect(NEW_PLAYERS_PER_PHONE).toBe(2);
    expect(PHONE_FULL).toBe('This phone already made 2 players this month. Sign in instead.');
    const one = count(1);
    expect(await phoneFull({ ENVIRONMENT: 'staging', DB: one.db } as Env, 'phoneA', NOW)).toBe(false);
    expect(one.calls[0].sql).toContain("how = 'made'");
    expect(one.calls[0].args).toEqual(['phoneA', NOW - 30 * 86_400_000]);
    expect(await phoneFull({ ENVIRONMENT: 'staging', DB: count(2).db } as Env, 'phoneA', NOW)).toBe(true);
  });

  it('applies on the real game too', async () => {
    expect(await phoneFull({ ENVIRONMENT: 'production', DB: count(2).db } as Env, 'phoneA', NOW)).toBe(true);
    expect(await phoneFull({ ENVIRONMENT: 'production', DB: count(2).db } as Env, null, NOW)).toBe(false);
  });
});

describe('stakes between players linked through a phone', () => {
  const settle = { winnerId: 'w', loserId: 'l', stake: 100, reason: 'line', loserMoves: 9, gamesBefore: 1 };

  it('go back to both when they were ever on the same phone', async () => {
    const { db, calls } = fakeDb((sql) => (sql.includes('player_phones') ? [{ hit: 1 }] : [{ flow: 0 }]));
    expect(await stakeBack(db, settle, NOW)).toBe('phone');
    expect(calls[0].sql).toContain('JOIN player_phones y ON y.player_id = ?2 AND y.phone = x.phone');
    expect(calls[0].args).toEqual(['w', 'l']);
  });

  it('are paid as usual otherwise, and a quick quit still comes first', async () => {
    const { db } = fakeDb((sql) => (sql.includes('player_phones') ? [] : [{ flow: 0 }]));
    expect(await stakeBack(db, settle, NOW)).toBeNull();
    expect(await stakeBack(db, { ...settle, reason: 'resign', loserMoves: 1, gamesBefore: 0 }, NOW)).toBe('quit');
  });
});
