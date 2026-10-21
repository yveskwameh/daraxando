// "Needs you": the few things on the dashboard worth acting on, worked out from the numbers.
// Kept separate from the screens so the rules can be tested (test/needs.test.ts).
import { fmt, pct } from './format.ts';
import { ALARM, limitsOf, WARN } from './sections.ts';
import type { DayResult, Report } from './types.ts';

export interface Need {
  id: string;
  /** alarm: act today. warn: keep an eye on it. note: worth knowing. */
  level: 'alarm' | 'warn' | 'note';
  title: string;
  body: string;
  /** Where the button goes. */
  go?: 'reviews' | 'phones' | 'section:plan' | 'section:players' | 'section:first';
  action?: string;
}

/** Played is down this much on the 7-day average, with at least MIN_AVG a day to compare with. */
const DROP = 0.3;
const MIN_AVG = 5;

export function needsFor(days: DayResult[], selected: string, today: string, appealsOpen: number | null): Need[] {
  const out: Need[] = [];
  const i = days.findIndex((d) => d.day === selected);
  const r = i >= 0 ? days[i].report : undefined;

  if (appealsOpen) {
    out.push({
      id: 'appeals',
      level: 'warn',
      title: appealsOpen === 1 ? '1 ban review is waiting' : `${fmt(appealsOpen)} ban reviews are waiting`,
      body: 'A banned player asked you to look at their ban again.',
      go: 'reviews',
      action: 'Answer',
    });
  }

  if (r?.usage) {
    const hot = limitsOf(r).filter((l) => l.share !== null && l.share >= WARN).sort((a, b) => b.share! - a.share!);
    if (hot.length) {
      const top = hot[0];
      out.push({
        id: 'plan',
        level: top.share! >= ALARM ? 'alarm' : 'warn',
        title: `${top.label} at ${pct(top.share!)} of the free plan`,
        body: `${hot.length > 1 ? `${hot.length} limits are past half. ` : ''}The limits reset at 1 am Lagos time, and going over any of them stops the game until then.`,
        go: 'section:plan',
        action: 'See the free plan',
      });
    }
    const req = r.usage.requests?.total ?? 0;
    if (r.usage.errors && r.usage.errors >= 10 && req && r.usage.errors / req >= 0.01) {
      out.push({
        id: 'errors',
        level: 'warn',
        title: `${fmt(r.usage.errors)} requests ended in an error`,
        body: `That's ${pct(r.usage.errors / req)} of requests. Cloudflare's logs for the Worker show which.`,
        go: 'section:plan',
        action: 'See the free plan',
      });
    }
    if (r.usage.problems.length) {
      out.push({ id: 'usage', level: 'note', title: "Couldn't read the free plan numbers", body: r.usage.problems.join(' '), go: 'section:plan', action: 'See the free plan' });
    }
  }

  // A sharp drop only means something on a finished day.
  if (r && selected < today) {
    const drop = dropOf(days, i, (x) => x.players.played);
    if (drop) {
      out.push({
        id: 'played',
        level: drop.share >= 0.5 ? 'alarm' : 'warn',
        title: `Played is down ${pct(drop.share)} on the week before`,
        body: `${fmt(r.players.played)} played, against ${fmt(Math.round(drop.avg))} a day on average over the 7 days before.`,
        go: 'section:players',
        action: 'See players',
      });
    }
    const first = dropOf(days, i, (x) => x.players.joined);
    if (first) {
      out.push({
        id: 'joined',
        level: 'warn',
        title: `New players are down ${pct(first.share)} on the week before`,
        body: `${fmt(r.players.joined)} new, against ${fmt(Math.round(first.avg))} a day on average over the 7 days before.`,
        go: 'section:first',
        action: 'See the first game',
      });
    }
  }
  return out;
}

/** How far a day's number fell below the average of the 7 days before it, if it fell sharply. */
export function dropOf(days: DayResult[], i: number, get: (r: Report) => number) {
  const now = days[i]?.report;
  if (!now) return null;
  const before = days.slice(Math.max(0, i - 7), i).flatMap((d) => (d.report ? [get(d.report)] : []));
  if (before.length < 3) return null;
  const avg = before.reduce((a, n) => a + n, 0) / before.length;
  if (avg < MIN_AVG) return null;
  const share = (avg - get(now)) / avg;
  return share >= DROP ? { share, avg } : null;
}
