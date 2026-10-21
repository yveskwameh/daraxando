// Game controls: switches, the announcement on Home and news (shared/controls.ts, worker/controls.ts).
import { describe, expect, it } from 'vitest';
import { BANNER_MAX, isBannerAction, isSwitchId, isTourEvent, lineProblem, NEWS_MAX, NEWS_PER_MONTH, SWITCHES, SWITCH_IDS } from '../shared/controls';
import { controlsOf, dropControls, setSwitch } from '../worker/controls';
import type { Env } from '../worker/env';

describe('announcement and news lines', () => {
  it('pass when they follow the writing rules', () => {
    expect(lineProblem('Friday is Fading night. Find a player from 8 pm.', BANNER_MAX)).toBeNull();
    expect(lineProblem('Big 5×5 is back in Pick a game.', BANNER_MAX)).toBeNull();
  });

  it('refuse emojis, links, long dashes and lowercase starts', () => {
    expect(lineProblem('Friday is Fading night 🔥 Find a player.', BANNER_MAX)).toMatch(/Emojis/);
    expect(lineProblem('Read more at daraxando.com today.', BANNER_MAX)).toMatch(/links/);
    expect(lineProblem('See https://x.test for more.', BANNER_MAX)).toMatch(/links/);
    expect(lineProblem('Friday is here — play now.', BANNER_MAX)).toMatch(/dashes/);
    expect(lineProblem('friday is Fading night.', BANNER_MAX)).toMatch(/capital/);
    expect(lineProblem('Friday is Fading night. find a player.', BANNER_MAX)).toMatch(/every sentence/);
    expect(lineProblem('Friday is Fading night', BANNER_MAX)).toMatch(/full stop/);
    expect(lineProblem('Hi.', BANNER_MAX)).toMatch(/few words/);
  });

  it('keep to their length', () => {
    expect(lineProblem(`A${'a'.repeat(BANNER_MAX)}.`, BANNER_MAX)).toMatch(/Keep it to 90/);
    expect(lineProblem(`A${'a'.repeat(NEWS_MAX - 3)}.`, NEWS_MAX)).toBeNull();
    expect(NEWS_PER_MONTH).toBe(4);
  });

  it('only take known switches, buttons and tour events', () => {
    expect(SWITCHES.map((s) => s.id)).toEqual([...SWITCH_IDS]);
    expect(isSwitchId('quick')).toBe(true);
    expect(isSwitchId('everything')).toBe(false);
    expect(isBannerAction('ranks')).toBe(true);
    expect(isBannerAction('toString')).toBe(false);
    expect(isTourEvent('skip2')).toBe(true);
    expect(isTourEvent('skip4')).toBe(false);
  });

  it('tell players what they can do instead, in plain sentences', () => {
    for (const s of SWITCHES) {
      if (s.id === 'reminders' || s.id === 'report') continue;
      expect(s.off).toMatch(/^[A-Z].*\.$/);
      expect(s.off).not.toMatch(/[—–]/);
    }
  });
});

/** A database that answers the two reads controlsOf makes, and counts them. */
function fakeDb(off: string[], banner: { id: number; text: string; action: string | null } | null) {
  const db = {
    reads: 0,
    prepare: () => ({ bind: () => ({}) }),
    batch: async () => {
      db.reads++;
      return [{ results: off.map((id) => ({ id })) }, { results: banner ? [banner] : [] }];
    },
  };
  return db;
}

describe('reading the controls', () => {
  it('lists what is off and the announcement now, and keeps it 30 seconds', async () => {
    const db = fakeDb(['quick', 'nonsense'], { id: 3, text: 'Friday is Fading night.', action: 'quick' });
    const env = { DB: db as unknown as D1Database };
    const c = await controlsOf(env, 1_000);
    expect(c.off).toEqual(['quick']);
    expect(c.banner).toEqual({ id: 3, text: 'Friday is Fading night.', action: 'quick' });
    await controlsOf(env, 20_000);
    expect(db.reads).toBe(1);
    await controlsOf(env, 32_000);
    expect(db.reads).toBe(2);
    dropControls(env);
    await controlsOf(env, 33_000);
    expect(db.reads).toBe(3);
  });

  it('keeps everything on when the database has no controls yet', async () => {
    const env = { DB: { prepare: () => ({ bind: () => ({}) }), batch: async () => { throw new Error('no such table'); } } as unknown as D1Database };
    const c = await controlsOf(env, 1);
    expect(c).toEqual({ off: [], banner: null });
  });

  it('asks why before turning a switch off', async () => {
    const env = { DB: fakeDb([], null) } as unknown as Env;
    expect(await setSwitch(env, 'quick', false, '')).toMatchObject({ status: 400 });
    expect(await setSwitch(env, 'nope', false, 'Testing it')).toMatchObject({ status: 404 });
    expect(await setSwitch(env, 'quick', 'off', 'Testing it')).toMatchObject({ status: 400 });
  });
});
