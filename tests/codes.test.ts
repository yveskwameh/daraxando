// Player codes and "Lost your code?" (shared/codes.ts, worker/codes.ts).
import { describe, expect, it } from 'vitest';
import {
  borrowEnded, cleanCode, codeChars, codeLink, CODE_LINK_RE, CODES_ON_REAL_GAME, codesOnHost, PLAYER_CODE_ALPHABET, showCode,
} from '../shared/codes';
import { seal, unseal } from '../worker/auth';
import { alertsFor, codesOn, monthOf, newCode, readAnswers, seedsMatch } from '../worker/codes';
import type { Env } from '../worker/env';
import type { Profile } from '../shared/protocol';

describe('a player code', () => {
  it('is 16 of the room-code letters, never I, L, O, 0 or 1', () => {
    for (let i = 0; i < 200; i++) {
      const c = newCode();
      expect(c).toHaveLength(16);
      for (const ch of c) expect(PLAYER_CODE_ALPHABET).toContain(ch);
      expect(c).not.toMatch(/[ILO01]/);
    }
  });

  it('reads the way people type it, and shows in four groups', () => {
    expect(cleanCode('km7q-3xrp-9dwt-h2fn')).toBe('KM7Q3XRP9DWTH2FN');
    expect(cleanCode(' KM7Q 3XRP 9DWT H2FN ')).toBe('KM7Q3XRP9DWTH2FN');
    expect(cleanCode('KM7Q-3XRP-9DWT-H2F')).toBeNull();
    expect(cleanCode('KM7Q-3XRP-9DWT-H2F0')).toBeNull();
    expect(cleanCode(42)).toBeNull();
    expect(showCode('KM7Q3XRP9DWTH2FN')).toBe('KM7Q-3XRP-9DWT-H2FN');
    expect(showCode('KM7Q-3XRP-9DWT-H2FN')).toBe('KM7Q-3XRP-9DWT-H2FN');
    expect(codeChars('km7q-3x1rp!')).toBe('KM7Q3XRP');
  });

  it('travels in a link after #, so phones never send it to the server', () => {
    const link = codeLink('https://daraxando.yveskwameh.com', 'KM7Q3XRP9DWTH2FN');
    expect(link).toBe('https://daraxando.yveskwameh.com/#code=KM7Q-3XRP-9DWT-H2FN');
    expect(codeLink('https://x.test', 'KM7Q-3XRP-9DWT-H2FN')).toBe('https://x.test/#code=KM7Q-3XRP-9DWT-H2FN');
    expect(new URL(link).hash.match(CODE_LINK_RE)?.[1]).toBe('KM7Q-3XRP-9DWT-H2FN');
  });

  it('is kept encrypted, so only the server can show it again', async () => {
    const box = await seal('secret-1', 'KM7Q3XRP9DWTH2FN');
    expect(box).not.toContain('KM7Q');
    expect(await unseal('secret-1', box)).toBe('KM7Q3XRP9DWTH2FN');
    expect(await unseal('secret-2', box)).toBeNull();
    expect(await unseal('secret-1', null)).toBeNull();
    // Two seals of the same code look different.
    expect(await seal('secret-1', 'KM7Q3XRP9DWTH2FN')).not.toBe(box);
  });

  it('is on everywhere since the lawyer approved it', () => {
    expect(CODES_ON_REAL_GAME).toBe(true);
    expect(codesOn({ ENVIRONMENT: 'production' })).toBe(true);
    expect(codesOn({ ENVIRONMENT: 'staging' })).toBe(true);
    expect(codesOn({ ENVIRONMENT: 'local' })).toBe(true);
    expect(codesOnHost('daraxando.yveskwameh.com')).toBe(true);
    expect(codesOnHost('daraxando-staging.yves-workers.workers.dev')).toBe(true);
  });
});

describe('the alerts on a player\'s phones', () => {
  const me = { id: 'p1' } as Profile;
  const db = (row: Record<string, unknown> | null) =>
    ({ prepare: () => ({ bind: () => ({ first: async () => row }) }) }) as unknown as D1Database;
  const env = (row: Record<string, unknown> | null) => ({ ENVIRONMENT: 'staging', DB: db(row) }) as unknown as Env;

  it('say the code opened the player on another phone, but not on the phone that used it', async () => {
    const row = { usedAt: 1000, usedPhone: 'phoneB', rid: null, due: null };
    expect(await alertsFor(env(row), me, 'phoneA')).toEqual({ codeUse: 1000 });
    expect(await alertsFor(env(row), me, 'phoneB')).toBeNull();
  });

  it('say when a recovery is waiting to move the player', async () => {
    expect(await alertsFor(env({ usedAt: null, usedPhone: null, rid: 'r1', due: 5000 }), me, 'phoneA')).toEqual({ takeover: { id: 'r1', due: 5000 } });
  });

});

describe('lost your code', () => {
  it('needs the name, seeds, month and someone they played', () => {
    expect(readAnswers({ name: 'Tunde', seeds: '6,000', month: 10, opponent: 'Kemi', message: ' Lost it. ' })).toEqual({
      name: 'Tunde', seeds: 6000, month: 10, opponent: 'Kemi', message: 'Lost it.',
    });
    expect(readAnswers({ seeds: 1, month: 1, opponent: 'Kemi' })).toBe("Type your player's name.");
    expect(readAnswers({ name: 'Tunde', seeds: 'lots', month: 1, opponent: 'Kemi' })).toMatch(/as a number/);
    expect(readAnswers({ name: 'Tunde', seeds: 1, month: 13, opponent: 'Kemi' })).toBe('Pick the month you started.');
    expect(readAnswers({ name: 'Tunde', seeds: 1, month: 2 })).toMatch(/someone you played/);
  });

  it('checks answers loosely enough for memory, strictly enough for guesses', () => {
    expect(seedsMatch(6000, 6120)).toBe(true);
    expect(seedsMatch(5000, 6120)).toBe(true);
    expect(seedsMatch(20000, 1480)).toBe(false);
    expect(seedsMatch(1000, 1400)).toBe(true);
    expect(seedsMatch(1000, 1600)).toBe(false);
    // Lagos time: 23:30 UTC on 30 September is already October in Lagos.
    expect(monthOf(Date.parse('2026-09-30T23:30:00Z'))).toBe(10);
    expect(monthOf(Date.parse('2026-09-14T12:00:00Z'))).toBe(9);
  });
});

describe('a borrowed phone', () => {
  const since = new Date(2026, 9, 21, 15, 0).getTime();
  it('stays borrowed while it is in use', () => {
    expect(borrowEnded(since, since + 3 * 3_600_000, since + 3 * 3_600_000 - 60_000)).toBe(false);
    expect(borrowEnded(since, since + 30 * 60_000, 0)).toBe(false);
  });
  it('goes back after an hour away, or the next day', () => {
    expect(borrowEnded(since, since + 2 * 3_600_000, since + 30 * 60_000)).toBe(true);
    expect(borrowEnded(since, new Date(2026, 9, 22, 9, 0).getTime(), 0)).toBe(true);
  });
});
