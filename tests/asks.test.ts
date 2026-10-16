import { describe, expect, it } from 'vitest';
import { due, eligible, pickAsk, SAVE_AFTER_MATCHES, type AskState } from '../shared/asks';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 20, 12);

/** A guest on Android in Chrome, back on a second day, with a 2-day streak and nothing asked yet. */
const base = (over: Partial<AskState> = {}): AskState => ({
  now: NOW,
  asked: {},
  ban: false,
  matches: 5,
  saved: false,
  dayStreak: 2,
  playedToday: true,
  returning: true,
  iphoneTab: false,
  pushReady: true,
  streakOn: false,
  inTab: true,
  canInstall: true,
  ...over,
});

describe('which asks fit', () => {
  it('waits for the 3rd finished match before asking to save', () => {
    expect(eligible(base({ matches: SAVE_AFTER_MATCHES - 1 }))).not.toContain('save');
    expect(eligible(base({ matches: SAVE_AFTER_MATCHES }))).toContain('save');
  });

  it('never asks a new player after their first game', () => {
    expect(pickAsk(base({ matches: 1, dayStreak: 1, returning: false }))).toBeNull();
  });

  it('never asks a saved player to save, or a banned player anything', () => {
    expect(eligible(base({ saved: true }))).not.toContain('save');
    expect(eligible(base({ ban: true }))).toEqual([]);
  });

  it('asks about the streak reminder from a 2-day streak, once played today, where it can work', () => {
    expect(eligible(base({ dayStreak: 1 }))).not.toContain('streak');
    expect(eligible(base({ playedToday: false }))).not.toContain('streak');
    expect(eligible(base({ streakOn: true }))).not.toContain('streak');
    expect(eligible(base({ pushReady: false }))).not.toContain('streak');
    expect(eligible(base({ iphoneTab: true }))).not.toContain('streak');
    expect(eligible(base())).toContain('streak');
  });

  it('asks to install from the second day, in a tab, when Chrome offers it or on an iPhone', () => {
    expect(eligible(base({ returning: false }))).not.toContain('install');
    expect(eligible(base({ inTab: false }))).not.toContain('install');
    expect(eligible(base({ canInstall: false }))).not.toContain('install');
    expect(eligible(base({ canInstall: false, iphoneTab: true }))).toContain('install');
  });
});

describe('taking turns', () => {
  it('goes save, then streak, then install when none were shown before', () => {
    expect(pickAsk(base())).toBe('save');
    expect(pickAsk(base({ saved: true }))).toBe('streak');
    expect(pickAsk(base({ saved: true, streakOn: true }))).toBe('install');
  });

  it('shows the one shown longest ago when more than one is due', () => {
    const asked = { save: { at: NOW - 20 * DAY, n: 1 }, streak: { at: NOW - 40 * DAY, n: 1 }, install: { at: NOW - 60 * DAY, n: 1 } };
    expect(pickAsk(base({ asked }))).toBe('install');
  });

  it('puts install first on an iPhone in Safari', () => {
    expect(pickAsk(base({ iphoneTab: true, canInstall: false }))).toBe('install');
  });

  it('asks a saved iPhone player in Safari only to install', () => {
    expect(pickAsk(base({ iphoneTab: true, canInstall: false, saved: true }))).toBe('install');
  });
});

describe('waiting after an ask', () => {
  it('waits 3, 7, 14, then every 30 days to ask about saving again', () => {
    const at = (n: number, daysAgo: number) => ({ save: { at: NOW - daysAgo * DAY, n } });
    expect(due('save', at(1, 2.9), NOW)).toBe(false);
    expect(due('save', at(1, 3), NOW)).toBe(true);
    expect(due('save', at(2, 6.9), NOW)).toBe(false);
    expect(due('save', at(2, 7), NOW)).toBe(true);
    expect(due('save', at(3, 14), NOW)).toBe(true);
    expect(due('save', at(4, 29), NOW)).toBe(false);
    expect(due('save', at(9, 30), NOW)).toBe(true);
  });

  it('waits 14, then 30 days to suggest installing again', () => {
    expect(due('install', { install: { at: NOW - 13 * DAY, n: 1 } }, NOW)).toBe(false);
    expect(due('install', { install: { at: NOW - 14 * DAY, n: 1 } }, NOW)).toBe(true);
    expect(due('install', { install: { at: NOW - 29 * DAY, n: 2 } }, NOW)).toBe(false);
    expect(due('install', { install: { at: NOW - 30 * DAY, n: 5 } }, NOW)).toBe(true);
  });

  it("doesn't pick an ask that's waiting, and picks the next one instead", () => {
    const asked = { save: { at: NOW - DAY, n: 1 } };
    expect(pickAsk(base({ asked }))).toBe('streak');
    expect(pickAsk(base({ asked, streakOn: true, canInstall: false }))).toBeNull();
  });
});
