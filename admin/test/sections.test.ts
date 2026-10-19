// The dashboard's sections say what the email says, and "Needs you" flags the right things.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsFor } from '../src/needs.ts';
import { headline, limitsOf, SECTIONS, sectionById, waitNote, whenFor } from '../src/sections.ts';
import type { DayResult, Report } from '../src/types.ts';

export function sample(day: string, over: { played?: number; joined?: number; usage?: Report['usage'] } = {}): Report {
  return {
    day,
    copy: 'production',
    players: { played: over.played ?? 120, playedDayBefore: 100, week: 640, joined: over.joined ?? 40, saved: 6, buckets: { new: 40, current: 70, reactivated: 8, resurrected: 2 }, atRisk: 31, curr: { of: 60, back: 45 } },
    first: { joined: 40, finished: 34, known: 34, won: 20, nextDay: { day: '2026-10-17', of: 30, back: 9 }, week: { day: '2026-10-11', of: 22, back: 3 } },
    matches: { total: 310, kinds: { bot: 200, quick: 80, friend: 30 }, modes: { fading: 150, classic: 100, big: 40, pro: 20 }, stakes: [{ stake: 0, n: 70 }, { stake: 100, n: 40 }], roomsMade: 18 },
    quick: { joined: 50, joinMissed: 3, paired: 48, pairedWaits: { 0: 20, 10: 18, 30: 10 }, pairedAvgS: 19, left: 12, leftWaits: { 30: 5, 60: 7 }, leftAvgS: 71 },
    extra: { notifyPhones: 55, reminders: 14, appealsOpen: 2, savedFromAsk: 4, pushOn: { 'streak-ask': 3, 'friends-ask': 1, settings: 2 } },
    usage: over.usage === undefined ? { day, requests: { total: 30_000, copies: [{ name: 'daraxando', n: 30_000 }] }, errors: 4, doRequests: 20_000, rowsRead: 600_000, rowsWritten: 9_000, problems: [] } : over.usage,
  };
}

test('rows read like the email', () => {
  const r = sample('2026-10-18');
  const players = sectionById('players')!.rows(r, 'yesterday');
  assert.deepEqual(players[0], { label: 'Played yesterday', value: '120', note: 'up 20 on the day before' });
  assert.equal(players.at(-1)!.value, '75%');
  assert.equal(players.at(-1)!.note, '45 of 60 current players from the day before. Duolingo calls this CURR.');
  const first = sectionById('first')!.rows(r, 'yesterday');
  assert.equal(first[0].value, '85%');
  assert.equal(first[2].note, '9 of 30 who played on their first day, Sat 17 Oct');
  const matches = sectionById('matches')!.rows(r, 'yesterday');
  assert.equal(matches[0].note, 'Fading 150, Classic 100, Big 40, Pro 20');
  assert.equal(matches.find((x) => x.label === 'Staked, against people')!.value, '36%');
  assert.equal(waitNote(r.quick.pairedWaits), 'Under 10 s: 20, 10 to 30 s: 18, 30 s to 1 min: 10.');
  assert.equal(headline(r, 'yesterday'), '120 played yesterday, up 20 on the day before. 40 new players, and 85% of them finished their first match.');
  assert.equal(whenFor('2026-10-12', '2026-10-19', '2026-10-18'), 'on Mon 12 Oct');
});

test('every section has a number to chart, and no row has an em dash', () => {
  const r = sample('2026-10-18');
  for (const s of SECTIONS) {
    assert.ok(s.metrics.length > 0, s.id);
    for (const row of s.rows(r, 'yesterday')) {
      assert.ok(!/—/.test(`${row.label}${row.value}${row.note ?? ''}`), row.label);
    }
  }
  assert.deepEqual(limitsOf(r).map((l) => Math.round((l.share ?? 0) * 100)), [30, 20, 12, 9]);
  assert.deepEqual(limitsOf(sample('2026-10-18', { usage: null })).map((l) => l.share), [null, null, null, null]);
});

const run = (list: [string, Report][]): DayResult[] => list.map(([day, report]) => ({ day, report }));

test('Needs you: ban reviews, the free plan and sharp drops', () => {
  const week = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];
  const calm = run(week.map((d) => [d, sample(d)]));
  assert.deepEqual(needsFor(calm, '2026-10-17', '2026-10-19', 0), []);

  const reviews = needsFor(calm, '2026-10-17', '2026-10-19', 2);
  assert.equal(reviews[0].title, '2 ban reviews are waiting');

  const hot = run([...week.slice(0, 7).map((d): [string, Report] => [d, sample(d)]), ['2026-10-17', sample('2026-10-17', { usage: { ...sample('x').usage!, rowsRead: 4_200_000 } })]]);
  const plan = needsFor(hot, '2026-10-17', '2026-10-19', 0);
  assert.equal(plan[0].level, 'alarm');
  assert.equal(plan[0].title, 'Database rows read at 84% of the free plan');

  const drop = run([...week.slice(0, 7).map((d): [string, Report] => [d, sample(d)]), ['2026-10-17', sample('2026-10-17', { played: 50, joined: 10 })]]);
  const ids = needsFor(drop, '2026-10-17', '2026-10-19', 0).map((n) => `${n.id}:${n.level}`);
  assert.deepEqual(ids, ['played:alarm', 'joined:warn']);

  // Today isn't over, so a low number today isn't a drop.
  const today = run([...week.slice(0, 7).map((d): [string, Report] => [d, sample(d)]), ['2026-10-17', sample('2026-10-17', { played: 5 })]]);
  assert.deepEqual(needsFor(today, '2026-10-17', '2026-10-17', 0), []);
});
