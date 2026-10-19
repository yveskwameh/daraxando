// The dashboard's sections: the same sections, rows and words as the 8 am email
// (worker/report.ts in the game, reportEmail), plus the numbers each section can chart over days.
// When the email changes, change this file the same way.
import { MODES } from '../../shared/modes.ts';
import { fmt, shortDay } from './format.ts';
import type { Kind, ModeId, Report } from './types.ts';

/** The free plan's daily limits (FREE in worker/report.ts). */
export const FREE = { requests: 100_000, doRequests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000 } as const;
/** From half of a limit the email warns, and from 80% it says so in red. */
export const WARN = 0.5;
export const ALARM = 0.8;

export const BUCKET_LABEL: Record<number, string> = { 0: 'Under 10 s', 10: '10 to 30 s', 30: '30 s to 1 min', 60: '1 to 2 min', 120: 'Over 2 min' };
export const WAIT_BUCKETS = [0, 10, 30, 60, 120];
export const KIND_LABEL: Record<Kind, string> = { bot: 'Baba Ayo', quick: 'Quick match', friend: 'Friends' };
export const MODE_IDS = Object.keys(MODES) as ModeId[];
export const modeName = (id: string) => (MODES as Record<string, { name: string }>)[id]?.name ?? id;

const pctText = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : 'none yet');
export const change = (now: number, before: number) =>
  now === before ? 'same as the day before' : `${now > before ? 'up' : 'down'} ${fmt(Math.abs(now - before))} on the day before`;
export const secsText = (s: number | null) => (s === null ? 'none' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
/** Notes under a number start with a capital letter, like every sentence in the game. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** How the email names a day: "today", "yesterday" or "on Mon 13 Oct". */
export function whenFor(day: string, today: string, yesterday: string) {
  if (day === today) return 'today';
  if (day === yesterday) return 'yesterday';
  return `on ${shortDay(day)}`;
}

export interface Row { label: string; value: string; note?: string }
export type Unit = 'count' | 'share' | 'secs';
/** One number a section can chart over days. A share is 0 to 1, or null when there's nothing to divide. */
export interface Metric { id: string; label: string; unit: Unit; get: (r: Report) => number | null; of?: (r: Report) => string }
export interface Section { id: string; title: string; metrics: Metric[]; rows: (r: Report, when: string) => Row[] }

const share = (part: number, whole: number) => (whole ? part / whole : null);
const pushOnTotal = (r: Report) => r.extra.pushOn['streak-ask'] + r.extra.pushOn['friends-ask'] + r.extra.pushOn.settings;
const peopleMatches = (r: Report) => r.matches.kinds.quick + r.matches.kinds.friend;
const staked = (r: Report) => r.matches.stakes.filter((s) => s.stake > 0).reduce((a, s) => a + s.n, 0);

export const LIMITS = [
  { id: 'requests', label: 'Requests to the game', used: (r: Report) => r.usage?.requests?.total ?? null, max: FREE.requests },
  { id: 'doRequests', label: 'Durable Object requests', used: (r: Report) => r.usage?.doRequests ?? null, max: FREE.doRequests },
  { id: 'rowsRead', label: 'Database rows read', used: (r: Report) => r.usage?.rowsRead ?? null, max: FREE.rowsRead },
  { id: 'rowsWritten', label: 'Database rows written', used: (r: Report) => r.usage?.rowsWritten ?? null, max: FREE.rowsWritten },
] as const;

export function limitsOf(r: Report) {
  return LIMITS.map((l) => {
    const used = r.usage ? l.used(r) : null;
    return { id: l.id, label: l.label, used, max: l.max, share: used === null ? null : used / l.max };
  });
}

export const SECTIONS: Section[] = [
  {
    id: 'players',
    title: 'Players',
    metrics: [
      { id: 'played', label: 'Played', unit: 'count', get: (r) => r.players.played },
      { id: 'joined', label: 'New players', unit: 'count', get: (r) => r.players.joined },
      { id: 'week', label: 'Last 7 days', unit: 'count', get: (r) => r.players.week },
      { id: 'atRisk', label: 'At risk', unit: 'count', get: (r) => r.players.atRisk },
      { id: 'curr', label: 'Regulars back', unit: 'share', get: (r) => share(r.players.curr.back, r.players.curr.of), of: (r) => `${fmt(r.players.curr.back)} of ${fmt(r.players.curr.of)}` },
    ],
    rows: (r, when) => {
      const p = r.players;
      return [
        { label: `Played ${when}`, value: fmt(p.played), note: change(p.played, p.playedDayBefore) },
        { label: 'Played in the last 7 days', value: fmt(p.week) },
        { label: 'New players', value: fmt(p.joined), note: `${fmt(p.saved)} saved their progress` },
        { label: 'Current', value: fmt(p.buckets.current), note: 'Also played in the 6 days before' },
        { label: 'First day', value: fmt(p.buckets.new), note: 'Their first day playing' },
        { label: 'Back after 7 to 29 days', value: fmt(p.buckets.reactivated) },
        { label: 'Back after 30 days or more', value: fmt(p.buckets.resurrected) },
        { label: 'At risk', value: fmt(p.atRisk), note: `Played in the 6 days before, but not ${when}` },
        {
          label: 'Regulars who came back',
          value: p.curr.of ? pctText(p.curr.back, p.curr.of) : 'none yet',
          note: p.curr.of ? `${fmt(p.curr.back)} of ${fmt(p.curr.of)} current players from the day before. Duolingo calls this CURR.` : undefined,
        },
      ];
    },
  },
  {
    id: 'first',
    title: 'The first game',
    metrics: [
      { id: 'finished', label: 'Finished it', unit: 'share', get: (r) => share(r.first.finished, r.first.joined), of: (r) => `${fmt(r.first.finished)} of ${fmt(r.first.joined)}` },
      { id: 'won', label: 'Won it', unit: 'share', get: (r) => share(r.first.won, r.first.known), of: (r) => `${fmt(r.first.won)} of ${fmt(r.first.known)}` },
      { id: 'nextDay', label: 'Next day', unit: 'share', get: (r) => share(r.first.nextDay.back, r.first.nextDay.of), of: (r) => `${fmt(r.first.nextDay.back)} of ${fmt(r.first.nextDay.of)}` },
      { id: 'day7', label: 'Day 7', unit: 'share', get: (r) => share(r.first.week.back, r.first.week.of), of: (r) => `${fmt(r.first.week.back)} of ${fmt(r.first.week.of)}` },
    ],
    rows: (r) => {
      const f = r.first;
      return [
        { label: 'Finished their first match', value: f.joined ? pctText(f.finished, f.joined) : 'none yet', note: `${fmt(f.finished)} of ${fmt(f.joined)} new players` },
        { label: 'Won it', value: f.known ? pctText(f.won, f.known) : 'none yet', note: `${fmt(f.won)} of ${fmt(f.known)}` },
        { label: 'Came back the next day', value: f.nextDay.of ? pctText(f.nextDay.back, f.nextDay.of) : 'none yet', note: `${fmt(f.nextDay.back)} of ${fmt(f.nextDay.of)} who played on their first day, ${shortDay(f.nextDay.day)}` },
        { label: 'Came back on day 7', value: f.week.of ? pctText(f.week.back, f.week.of) : 'none yet', note: `${fmt(f.week.back)} of ${fmt(f.week.of)} who played on their first day, ${shortDay(f.week.day)}` },
      ];
    },
  },
  {
    id: 'matches',
    title: 'Matches',
    metrics: [
      { id: 'total', label: 'Matches', unit: 'count', get: (r) => r.matches.total },
      { id: 'bot', label: 'Baba Ayo', unit: 'count', get: (r) => r.matches.kinds.bot },
      { id: 'quick', label: 'Quick match', unit: 'count', get: (r) => r.matches.kinds.quick },
      { id: 'friend', label: 'Friends', unit: 'count', get: (r) => r.matches.kinds.friend },
      { id: 'staked', label: 'Staked', unit: 'share', get: (r) => share(staked(r), peopleMatches(r)), of: (r) => `${fmt(staked(r))} of ${fmt(peopleMatches(r))}` },
      { id: 'rooms', label: 'Rooms made', unit: 'count', get: (r) => r.matches.roomsMade },
    ],
    rows: (r) => {
      const m = r.matches;
      const people = peopleMatches(r);
      return [
        { label: 'Matches finished', value: fmt(m.total), note: MODE_IDS.map((id) => `${modeName(id)} ${fmt(m.modes[id] ?? 0)}`).join(', ') },
        ...(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ label: KIND_LABEL[k], value: fmt(m.kinds[k]) })),
        {
          label: 'Staked, against people',
          value: people ? pctText(staked(r), people) : 'none yet',
          note: m.stakes.length ? m.stakes.map((s) => `${s.stake ? `${fmt(s.stake)} seeds` : 'free'} ${fmt(s.n)}`).join(', ') : undefined,
        },
        { label: 'Friend rooms made', value: fmt(m.roomsMade), note: `${fmt(m.kinds.friend)} friend matches finished` },
      ];
    },
  },
  {
    id: 'quick',
    title: 'Quick match',
    metrics: [
      { id: 'paired', label: 'Met a person', unit: 'count', get: (r) => r.quick.paired },
      { id: 'joined', label: 'Joined a game', unit: 'count', get: (r) => r.quick.joined },
      { id: 'left', label: 'Left waiting', unit: 'count', get: (r) => r.quick.left },
      { id: 'wait', label: 'Average wait', unit: 'secs', get: (r) => r.quick.pairedAvgS },
    ],
    rows: (r) => {
      const q = r.quick;
      return [
        { label: 'Joined a waiting game', value: fmt(q.joined), note: q.joinMissed ? `${fmt(q.joinMissed)} more tried, but someone got there first` : undefined },
        { label: 'Started a game and met a person', value: fmt(q.paired), note: q.paired ? `Waited ${secsText(q.pairedAvgS)} on average. ${waitNote(q.pairedWaits)}` : undefined },
        { label: 'Started a game and left before anyone came', value: fmt(q.left), note: q.left ? `After ${secsText(q.leftAvgS)} on average. Some played Baba Ayo instead.` : undefined },
      ];
    },
  },
  {
    id: 'saving',
    title: 'Saving and notifications',
    metrics: [
      { id: 'saved', label: 'Saved progress', unit: 'count', get: (r) => r.players.saved },
      { id: 'pushOn', label: 'Turned on', unit: 'count', get: (r) => pushOnTotal(r) },
      { id: 'phones', label: 'Phones on', unit: 'count', get: (r) => r.extra.notifyPhones },
    ],
    rows: (r) => {
      const on = r.extra.pushOn;
      const turnedOn = pushOnTotal(r);
      return [
        { label: 'Saved their progress', value: fmt(r.players.saved), note: `${fmt(r.extra.savedFromAsk)} from the ask on Home` },
        {
          label: 'Turned on notifications',
          value: fmt(turnedOn),
          note: turnedOn ? `${fmt(on['streak-ask'])} from the streak ask, ${fmt(on['friends-ask'])} from the friend ask, ${fmt(on.settings)} in Settings` : undefined,
        },
        { label: 'Phones with notifications on', value: fmt(r.extra.notifyPhones) },
      ];
    },
  },
  {
    id: 'also',
    title: 'Also',
    metrics: [
      { id: 'reminders', label: '7 pm reminders', unit: 'count', get: (r) => r.extra.reminders },
      { id: 'appeals', label: 'Ban reviews', unit: 'count', get: (r) => r.extra.appealsOpen },
    ],
    // The email leaves out a row with nothing to say. The dashboard always shows both.
    rows: (r) => [
      { label: 'Streak reminders sent at 7 pm', value: r.extra.reminders === null ? 'off' : fmt(r.extra.reminders), note: r.extra.reminders === null ? 'This copy has no notification keys' : undefined },
      { label: 'Ban reviews waiting for you', value: fmt(r.extra.appealsOpen), note: r.extra.appealsOpen ? 'Answer them in Reviews' : undefined },
    ],
  },
  {
    id: 'plan',
    title: 'Free plan',
    metrics: LIMITS.map((l) => ({
      id: l.id,
      label: l.label.replace('Requests to the game', 'Requests').replace('Durable Object requests', 'Durable Objects').replace('Database rows ', 'Rows '),
      unit: 'share' as const,
      get: (r: Report) => {
        const used = r.usage ? l.used(r) : null;
        return used === null ? null : used / l.max;
      },
      of: (r: Report) => {
        const used = r.usage ? l.used(r) : null;
        return used === null ? 'not available' : `${fmt(used)} of ${fmt(l.max)}`;
      },
    })),
    rows: (r) =>
      limitsOf(r).map((l) => ({
        label: l.label,
        value: l.used === null ? 'not available' : `${fmt(l.used)} of ${fmt(l.max)}`,
        note: l.share === null ? undefined : `${Math.round(l.share * 100)}% of the daily limit`,
      })),
  },
];

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);

export function waitNote(w: Record<number, number>) {
  return WAIT_BUCKETS.filter((b) => w[b]).map((b) => `${BUCKET_LABEL[b]}: ${fmt(w[b])}`).join(', ') + '.';
}

/** The email's opening line. */
export function headline(r: Report, when: string) {
  const p = r.players;
  const f = r.first;
  return `${fmt(p.played)} played ${when}, ${change(p.played, p.playedDayBefore)}. ${fmt(p.joined)} new players, and ${f.joined ? pctText(f.finished, f.joined) : 'none'} of them finished their first match.`;
}

export { cap };
