/**
 * The 8 am report (docs/BACKEND.md, milestone 6; Yves, 16 October 2026): yesterday's game numbers
 * in one short email to REPORT_EMAIL, and the same numbers as JSON for the admin API.
 *
 *  - Players and returns: who played, Duolingo's buckets (docs/RETENTION.md, section 2) and the
 *    current user retention rate (CURR), the number that moved Duolingo's daily users most.
 *  - The first game: new players, how many finished and won their first match, and how many came
 *    back the next day and a week later.
 *  - Matches: by kind, mode and stake, friend rooms, and Quick match waits.
 *  - The free plan: yesterday's requests and database rows against the daily limits, with a
 *    warning from half the limit. Needs CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN (read-only).
 *
 * "Played" means finished a match, Lagos days. A cron at 07:00 UTC (8 am Lagos) sends it.
 */
import { addDays } from '../shared/habits';
import { MODES, type ModeId } from '../shared/modes';
import { dayKey } from '../shared/progression';
import { sendEmail, type Sent } from './accounts';
import type { Email } from './email';
import type { Env } from './env';
import { STAT, WAIT_BUCKETS } from './stats';

const DAY_MS = 86_400_000;
/** 8 am Lagos, all year (Lagos doesn't change its clocks). The same line is in wrangler.jsonc. */
export const REPORT_CRON = '0 7 * * *';
/** Cloudflare's free plan, per account per UTC day (researched 16 October 2026). */
export const FREE = { requests: 100_000, doRequests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000 } as const;
/** From this share of a limit the email warns, and from the second it says so in red. */
const WARN = 0.5;
const ALARM = 0.8;
/** Play days older than this are removed by the morning run. */
const KEEP_DAYS = 400;

type Kind = 'bot' | 'quick' | 'friend';
type Buckets = Record<number, number>;

export interface Usage {
  /** The UTC day the limits count. */
  day: string;
  requests: { total: number; copies: { name: string; n: number }[] } | null;
  errors: number | null;
  doRequests: number | null;
  rowsRead: number | null;
  rowsWritten: number | null;
  /** What couldn't be read, in plain words. */
  problems: string[];
}

export interface Report {
  day: string;
  copy: string;
  players: {
    played: number;
    playedDayBefore: number;
    week: number;
    joined: number;
    saved: number;
    buckets: { new: number; current: number; reactivated: number; resurrected: number };
    atRisk: number;
    curr: { of: number; back: number };
  };
  first: {
    joined: number;
    finished: number;
    /** Finished, with a known result: players who had played before the numbers started have none. */
    known: number;
    won: number;
    nextDay: { day: string; of: number; back: number };
    week: { day: string; of: number; back: number };
  };
  matches: {
    total: number;
    kinds: Record<Kind, number>;
    modes: Record<ModeId, number>;
    /** Matches against people, by stake. */
    stakes: { stake: number; n: number }[];
    roomsMade: number;
  };
  quick: {
    joined: number;
    joinMissed: number;
    paired: number;
    pairedWaits: Buckets;
    pairedAvgS: number | null;
    left: number;
    leftWaits: Buckets;
    leftAvgS: number | null;
  };
  extra: { notifyPhones: number; reminders: number | null; appealsOpen: number };
  usage: Usage | null;
}

const lagosStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - 3_600_000;
const num = (v: unknown) => Number(v ?? 0) || 0;

/** Yesterday in Lagos. */
export const reportDay = (now = Date.now()) => dayKey(now - DAY_MS);

/** Everything in the report except the free plan, from the database. About a dozen reads. */
export async function gameNumbers(env: Env, day: string): Promise<Omit<Report, 'usage' | 'copy'>> {
  const db = env.DB;
  const s = lagosStart(day);
  const e = s + DAY_MS;
  const d = (n: number) => addDays(day, n);
  const rows = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT COUNT(*) AS n FROM player_days WHERE day = ?').bind(day),
    db.prepare('SELECT COUNT(*) AS n FROM player_days WHERE day = ?').bind(d(-1)),
    db.prepare('SELECT COUNT(DISTINCT player_id) AS n FROM player_days WHERE day BETWEEN ? AND ?').bind(d(-6), day),
    // Duolingo's buckets: by the last day each of yesterday's players played before it.
    db
      .prepare(
        `SELECT CASE WHEN prev IS NULL THEN 'new' WHEN prev >= ?2 THEN 'current' WHEN prev >= ?3 THEN 'reactivated' ELSE 'resurrected' END AS b, COUNT(*) AS n
         FROM (SELECT a.player_id, (SELECT MAX(p.day) FROM player_days p WHERE p.player_id = a.player_id AND p.day < ?1) AS prev
               FROM player_days a WHERE a.day = ?1)
         GROUP BY b`,
      )
      .bind(day, d(-6), d(-29)),
    // At risk: played in the 6 days before, but not yesterday.
    db
      .prepare('SELECT COUNT(DISTINCT player_id) AS n FROM player_days WHERE day BETWEEN ?1 AND ?2 AND player_id NOT IN (SELECT player_id FROM player_days WHERE day = ?3)')
      .bind(d(-6), d(-1), day),
    // CURR: of the day before's current players, how many played yesterday too.
    db
      .prepare(
        `SELECT COUNT(*) AS of, COALESCE(SUM(EXISTS (SELECT 1 FROM player_days t WHERE t.day = ?1 AND t.player_id = y.player_id)), 0) AS back
         FROM player_days y
         WHERE y.day = ?2 AND EXISTS (SELECT 1 FROM player_days w WHERE w.player_id = y.player_id AND w.day BETWEEN ?3 AND ?4)`,
      )
      .bind(day, d(-1), d(-7), d(-2)),
    // New players and their first match.
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(first_result IS NOT NULL), 0) AS finished,
                COALESCE(SUM(first_result IN ('win', 'loss', 'draw')), 0) AS known, COALESCE(SUM(first_result = 'win'), 0) AS won
         FROM players WHERE created_at >= ? AND created_at < ?`,
      )
      .bind(s, e),
    // Played on their first day, then again the next day, and on day 7.
    cohort(db, d(-1), day),
    cohort(db, d(-7), day),
    db.prepare('SELECT COUNT(DISTINCT player_id) AS n FROM identities WHERE created_at >= ? AND created_at < ?').bind(s, e),
    db.prepare('SELECT name, n FROM stat_days WHERE day = ?').bind(day),
    db.prepare('SELECT COUNT(*) AS n FROM push_subs'),
    db.prepare("SELECT COUNT(*) AS n FROM appeals WHERE status = 'open'"),
  ]);
  const one = (i: number) => (rows[i].results?.[0] ?? {}) as Record<string, unknown>;

  const buckets = { new: 0, current: 0, reactivated: 0, resurrected: 0 };
  for (const r of (rows[3].results ?? []) as { b: keyof typeof buckets; n: number }[]) buckets[r.b] = num(r.n);

  const stats = new Map<string, number>();
  for (const r of (rows[10].results ?? []) as { name: string; n: number }[]) stats.set(r.name, num(r.n));

  const kinds: Record<Kind, number> = { bot: 0, quick: 0, friend: 0 };
  const modes = Object.fromEntries(Object.keys(MODES).map((m) => [m, 0])) as Record<ModeId, number>;
  const stakes = new Map<number, number>();
  for (const [name, n] of stats) {
    const m = /^m:(bot|quick|friend):(\w+):(\d+)$/.exec(name);
    if (!m) continue;
    kinds[m[1] as Kind] += n;
    if (m[2] in modes) modes[m[2] as ModeId] += n;
    if (m[1] !== 'bot') stakes.set(Number(m[3]), (stakes.get(Number(m[3])) ?? 0) + n);
  }
  const waits = (pick: (b: number) => string) => Object.fromEntries(WAIT_BUCKETS.map((b) => [b, stats.get(pick(b)) ?? 0])) as Buckets;
  const pairedWaits = waits(STAT.paired);
  const leftWaits = waits(STAT.left);
  const total = (b: Buckets) => Object.values(b).reduce((a, n) => a + n, 0);
  const paired = total(pairedWaits);
  const left = total(leftWaits);
  const avg = (ms: number, n: number) => (n ? Math.round(ms / n / 1000) : null);

  let reminders: number | null = null;
  try {
    const st = await env.NOTIFIER.get(env.NOTIFIER.idFromName('streak')).status();
    if (st.day === day) reminders = st.sent;
  } catch {
    /* the report goes out without it */
  }

  return {
    day,
    players: {
      played: num(one(0).n),
      playedDayBefore: num(one(1).n),
      week: num(one(2).n),
      joined: num(one(6).n),
      saved: num(one(9).n),
      buckets,
      atRisk: num(one(4).n),
      curr: { of: num(one(5).of), back: num(one(5).back) },
    },
    first: {
      joined: num(one(6).n),
      finished: num(one(6).finished),
      known: num(one(6).known),
      won: num(one(6).won),
      nextDay: { day: d(-1), of: num(one(7).of), back: num(one(7).back) },
      week: { day: d(-7), of: num(one(8).of), back: num(one(8).back) },
    },
    matches: {
      total: kinds.bot + kinds.quick + kinds.friend,
      kinds,
      modes,
      stakes: [...stakes].sort((a, b) => a[0] - b[0]).map(([stake, n]) => ({ stake, n })),
      roomsMade: stats.get(STAT.roomMade) ?? 0,
    },
    quick: {
      joined: stats.get(STAT.joined) ?? 0,
      joinMissed: stats.get(STAT.joinMissed) ?? 0,
      paired,
      pairedWaits,
      pairedAvgS: avg(stats.get(STAT.pairedMs) ?? 0, paired),
      left,
      leftWaits,
      leftAvgS: avg(stats.get(STAT.leftMs) ?? 0, left),
    },
    extra: { notifyPhones: num(one(11).n), reminders, appealsOpen: num(one(12).n) },
  };
}

/** Players who joined on `joined` and played that day: how many, and how many played on `later` too. */
function cohort(db: D1Database, joined: string, later: string) {
  const s = lagosStart(joined);
  return db
    .prepare(
      `SELECT COUNT(*) AS of, COALESCE(SUM(EXISTS (SELECT 1 FROM player_days b WHERE b.player_id = p.id AND b.day = ?4)), 0) AS back
       FROM players p
       WHERE p.created_at >= ?1 AND p.created_at < ?2 AND EXISTS (SELECT 1 FROM player_days a WHERE a.player_id = p.id AND a.day = ?3)`,
    )
    .bind(s, s + DAY_MS, joined, later);
}

/* ---------- the free plan, from Cloudflare's GraphQL Analytics API ---------- */

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

export const usageReady = (env: Env) => !!(env.CF_ACCOUNT_ID && env.CF_ANALYTICS_TOKEN);

/**
 * Yesterday's use of the account's free plan, all Workers together, since the limits are per
 * account. Three small queries, so one that fails doesn't hide the others.
 */
export async function freePlanUse(env: Env, day: string): Promise<Usage | null> {
  if (!usageReady(env)) return null;
  const account = env.CF_ACCOUNT_ID!.trim();
  const out: Usage = { day, requests: null, errors: null, doRequests: null, rowsRead: null, rowsWritten: null, problems: [] };
  if (!/^[0-9a-f]{32}$/.test(account)) {
    out.problems.push("CF_ACCOUNT_ID doesn't look like an account id (32 letters and numbers).");
    return out;
  }
  const q = (inner: string) => `{ viewer { accounts(filter: { accountTag: ${JSON.stringify(account)} }) { ${inner} } } }`;
  const date = JSON.stringify(day);
  const ask = async <T>(what: string, inner: string, pick: (acc: Record<string, unknown>) => T): Promise<T | null> => {
    try {
      // Tests only, on a Mac or in the container: a stand-in for Cloudflare's API.
      const at = env.ENVIRONMENT === 'local' && env.CF_GRAPHQL_URL ? env.CF_GRAPHQL_URL : GRAPHQL;
      const res = await fetch(at, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN!.trim()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query: q(inner) }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { viewer?: { accounts?: Record<string, unknown>[] } }; errors?: { message?: string }[] | null };
      const acc = body.data?.viewer?.accounts?.[0];
      if (!res.ok || body.errors?.length || !acc) {
        const why = body.errors?.[0]?.message ?? `HTTP ${res.status}`;
        console.error('[report] graphql', what, why);
        out.problems.push(`${what}: ${why.slice(0, 120)}`);
        return null;
      }
      return pick(acc);
    } catch (err) {
      out.problems.push(`${what}: ${(err as Error).message.slice(0, 120)}`);
      return null;
    }
  };
  type Row<S> = { sum?: S; dimensions?: { scriptName?: string } };
  await Promise.all([
    ask(
      'Worker requests',
      `workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: ${JSON.stringify(`${day}T00:00:00Z`)}, datetime_leq: ${JSON.stringify(`${day}T23:59:59Z`)} }) { sum { requests errors } dimensions { scriptName } }`,
      (acc) => acc.workersInvocationsAdaptive as Row<{ requests?: number; errors?: number }>[],
    ).then((list) => {
      if (!list) return;
      const copies = new Map<string, number>();
      let errors = 0;
      for (const r of list) {
        const name = r.dimensions?.scriptName ?? 'other';
        copies.set(name, (copies.get(name) ?? 0) + num(r.sum?.requests));
        errors += num(r.sum?.errors);
      }
      out.requests = { total: [...copies.values()].reduce((a, n) => a + n, 0), copies: [...copies].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n) };
      out.errors = errors;
    }),
    ask(
      'Durable Object requests',
      `durableObjectsInvocationsAdaptiveGroups(limit: 100, filter: { date_geq: ${date}, date_leq: ${date} }) { sum { requests } }`,
      (acc) => acc.durableObjectsInvocationsAdaptiveGroups as Row<{ requests?: number }>[],
    ).then((list) => {
      if (list) out.doRequests = list.reduce((a, r) => a + num(r.sum?.requests), 0);
    }),
    ask(
      'Database rows',
      `d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: ${date}, date_leq: ${date} }) { sum { rowsRead rowsWritten } }`,
      (acc) => acc.d1AnalyticsAdaptiveGroups as Row<{ rowsRead?: number; rowsWritten?: number }>[],
    ).then((list) => {
      if (!list) return;
      out.rowsRead = list.reduce((a, r) => a + num(r.sum?.rowsRead), 0);
      out.rowsWritten = list.reduce((a, r) => a + num(r.sum?.rowsWritten), 0);
    }),
  ]);
  return out;
}

/** The free plan rows, with how close each is to its limit. */
export function limits(u: Usage) {
  return [
    { label: 'Requests to the game', used: u.requests?.total ?? null, max: FREE.requests },
    { label: 'Durable Object requests', used: u.doRequests, max: FREE.doRequests },
    { label: 'Database rows read', used: u.rowsRead, max: FREE.rowsRead },
    { label: 'Database rows written', used: u.rowsWritten, max: FREE.rowsWritten },
  ].map((l) => ({ ...l, share: l.used === null ? null : l.used / l.max }));
}

/* ---------- the email ---------- */

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : 'none yet');
const change = (now: number, before: number) => (now === before ? 'same as the day before' : `${now > before ? 'up' : 'down'} ${fmt(Math.abs(now - before))} on the day before`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = (s: number | null) => (s === null ? 'none' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);
const longDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const BUCKET_LABEL: Record<number, string> = { 0: 'Under 10 s', 10: '10 to 30 s', 30: '30 s to 1 min', 60: '1 to 2 min', 120: 'Over 2 min' };
const KIND_LABEL: Record<Kind, string> = { bot: 'Baba Ayo', quick: 'Quick match', friend: 'Friends' };

const C = {
  page: '#efedf8',
  card: '#ffffff',
  night: '#0b0a2a',
  ink: '#17164a',
  muted: '#6b6894',
  line: '#e3e0f2',
  indigo: '#3d27db',
  teal: '#14a693',
  danfo: '#ffc921',
  fuchsia: '#dc0fa1',
  amberBg: '#fff4d6',
  redBg: '#ffe3f2',
};

/** Builds the email: subject, HTML (tables and inline styles, like worker/email.ts) and plain text. */
export function reportEmail(r: Report): Email {
  const p = r.players;
  const f = r.first;
  const m = r.matches;
  const q = r.quick;
  const test = r.copy !== 'production';
  const lim = r.usage ? limits(r.usage) : [];
  const hot = lim.filter((l) => l.share !== null && l.share >= WARN).sort((a, b) => b.share! - a.share!);
  // The email is always about yesterday; the admin API can ask for any day.
  const yday = r.day === reportDay();
  const when = yday ? 'yesterday' : `on ${shortDay(r.day)}`;

  const subject = `${test ? 'Test copy: ' : ''}Dara X&O, ${shortDay(r.day)}: ${fmt(p.played)} played, ${fmt(p.joined)} new${hot.length ? `, ${Math.round(hot[0].share! * 100)}% of a free limit` : ''}`;

  // Each section is a title and rows of [label, value, note?].
  type Rowx = [string, string, string?];
  const sections: { title: string; rows: Rowx[]; html?: string }[] = [];

  sections.push({
    title: 'Players',
    rows: [
      [`Played ${when}`, fmt(p.played), change(p.played, p.playedDayBefore)],
      ['Played in the last 7 days', fmt(p.week)],
      ['New players', fmt(p.joined), `${fmt(p.saved)} saved their progress`],
      ['Current', fmt(p.buckets.current), 'Also played in the 6 days before'],
      ['First day', fmt(p.buckets.new), 'Their first day playing'],
      ['Back after 7 to 29 days', fmt(p.buckets.reactivated)],
      ['Back after 30 days or more', fmt(p.buckets.resurrected)],
      ['At risk', fmt(p.atRisk), `Played in the 6 days before, but not ${when}`],
      ['Regulars who came back', p.curr.of ? `${pct(p.curr.back, p.curr.of)}` : 'none yet', p.curr.of ? `${fmt(p.curr.back)} of ${fmt(p.curr.of)} current players from the day before. Duolingo calls this CURR.` : undefined],
    ],
    html: bucketBar(p.buckets),
  });

  sections.push({
    title: 'The first game',
    rows: [
      ['Finished their first match', f.joined ? pct(f.finished, f.joined) : 'none yet', `${fmt(f.finished)} of ${fmt(f.joined)} new players`],
      ['Won it', f.known ? pct(f.won, f.known) : 'none yet', `${fmt(f.won)} of ${fmt(f.known)}`],
      ['Came back the next day', f.nextDay.of ? pct(f.nextDay.back, f.nextDay.of) : 'none yet', `${fmt(f.nextDay.back)} of ${fmt(f.nextDay.of)} who played on their first day, ${shortDay(f.nextDay.day)}`],
      ['Came back on day 7', f.week.of ? pct(f.week.back, f.week.of) : 'none yet', `${fmt(f.week.back)} of ${fmt(f.week.of)} who played on their first day, ${shortDay(f.week.day)}`],
    ],
  });

  const modeNote = (Object.keys(MODES) as ModeId[]).map((id) => `${MODES[id].name} ${fmt(m.modes[id])}`).join(', ');
  const people = m.kinds.quick + m.kinds.friend;
  const staked = m.stakes.filter((s) => s.stake > 0).reduce((a, s) => a + s.n, 0);
  sections.push({
    title: 'Matches',
    rows: [
      ['Matches finished', fmt(m.total), modeNote],
      ...(Object.keys(KIND_LABEL) as Kind[]).map((k): Rowx => [KIND_LABEL[k], fmt(m.kinds[k])]),
      ['Staked, against people', people ? pct(staked, people) : 'none yet', m.stakes.length ? m.stakes.map((s) => `${s.stake ? `${fmt(s.stake)} seeds` : 'free'} ${fmt(s.n)}`).join(', ') : undefined],
      ['Friend rooms made', fmt(m.roomsMade), `${fmt(m.kinds.friend)} friend matches finished`],
    ],
  });

  sections.push({
    title: 'Quick match',
    rows: [
      ['Joined a waiting game', fmt(q.joined), q.joinMissed ? `${fmt(q.joinMissed)} more tried, but someone got there first` : undefined],
      ['Started a game and met a person', fmt(q.paired), q.paired ? `Waited ${secs(q.pairedAvgS)} on average. ${waitNote(q.pairedWaits)}` : undefined],
      ['Started a game and left before anyone came', fmt(q.left), q.left ? `After ${secs(q.leftAvgS)} on average. Some played Baba Ayo instead.` : undefined],
    ],
  });

  const extraRows: Rowx[] = [['Phones with notifications on', fmt(r.extra.notifyPhones)]];
  if (r.extra.reminders !== null) extraRows.push(['Streak reminders sent at 7 pm', fmt(r.extra.reminders)]);
  if (r.extra.appealsOpen) extraRows.push(['Ban reviews waiting for you', fmt(r.extra.appealsOpen), 'Answer them through the admin API']);
  sections.push({ title: 'Also', rows: extraRows });

  // The free plan.
  let planHtml = '';
  const planText: string[] = [];
  if (!r.usage) {
    planHtml = para('Free plan numbers are off on this copy. Add the CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN secrets to turn them on (README, "Secrets").');
    planText.push('Free plan numbers are off on this copy. Add the CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN secrets to turn them on (README, "Secrets").');
  } else {
    for (const l of lim) {
      const value = l.used === null ? 'not available' : `${fmt(l.used)} of ${fmt(l.max)}`;
      planHtml += meterRow(l.label, value, l.share);
      planText.push(`${l.label}: ${value}${l.share === null ? '' : ` (${Math.round(l.share * 100)}%)`}`);
    }
    if (r.usage.requests && r.usage.requests.copies.length > 1) {
      const split = r.usage.requests.copies.map((c) => `${c.name} ${fmt(c.n)}`).join(', ');
      planHtml += para(`Requests by copy: ${esc(split)}.`);
      planText.push(`Requests by copy: ${split}.`);
    }
    if (r.usage.errors) {
      planHtml += para(`${fmt(r.usage.errors)} requests ended in an error. Cloudflare's logs for the Worker show which.`);
      planText.push(`${fmt(r.usage.errors)} requests ended in an error.`);
    }
    for (const pr of r.usage.problems) {
      planHtml += para(`Couldn't read ${esc(pr)}`);
      planText.push(`Couldn't read ${pr}`);
    }
  }

  const warning = hot.length
    ? `Near the free plan's daily limits ${when}: ${hot.map((l) => `${l.label.toLowerCase()} at ${Math.round(l.share! * 100)}%`).join(', ')}. The limits reset at 1 am Lagos time, and going over any of them stops the game until then.`
    : '';
  const red = hot.some((l) => l.share! >= ALARM);

  const headline = `${fmt(p.played)} played ${when}, ${change(p.played, p.playedDayBefore)}. ${fmt(p.joined)} new players, and ${f.joined ? pct(f.finished, f.joined) : 'none'} of them finished their first match.`;

  /* --- HTML --- */
  const big = (label: string, value: string) =>
    `<td width="33%" style="padding:16px 8px;text-align:center;border-right:1px solid ${C.line};"><div style="font:800 26px/1.1 Arial,Helvetica,sans-serif;color:${C.ink};">${esc(value)}</div><div style="font:600 12px/1.4 Arial,Helvetica,sans-serif;color:${C.muted};padding-top:4px;">${esc(label)}</div></td>`;
  const sectionHtml = sections
    .map(
      (s) => `
<tr><td style="padding:24px 24px 4px;font:800 12px/1.2 Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${C.indigo};">${esc(s.title)}</td></tr>
${s.html ? `<tr><td style="padding:8px 24px 4px;">${s.html}</td></tr>` : ''}
<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${s.rows.map(([l, v, n]) => row(l, v, n)).join('')}</table></td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${C.card};border-radius:16px;overflow:hidden;">
<tr><td style="background:${C.night};padding:24px;">
  <div style="font:800 22px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;">Dara X&amp;O${test ? ` <span style="font:800 12px/1 Arial,Helvetica,sans-serif;color:${C.night};background:${C.danfo};border-radius:999px;padding:4px 10px;vertical-align:middle;">Test copy</span>` : ''}</div>
  <div style="font:600 14px/1.5 Arial,Helvetica,sans-serif;color:#b8b4e8;padding-top:4px;">${yday ? "Yesterday's numbers," : 'Numbers for'} ${esc(longDay(r.day))}</div>
</td></tr>
<tr><td style="padding:20px 24px 0;font:400 15px/1.5 Arial,Helvetica,sans-serif;color:${C.ink};">${esc(headline)}</td></tr>
${warning ? `<tr><td style="padding:16px 24px 0;"><div style="background:${red ? C.redBg : C.amberBg};border-radius:12px;padding:12px 16px;font:700 14px/1.5 Arial,Helvetica,sans-serif;color:${C.ink};">${esc(warning)}</div></td></tr>` : ''}
<tr><td style="padding:20px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:12px;"><tr>${big('Played', fmt(p.played))}${big('New players', fmt(p.joined))}${big('Matches', fmt(m.total)).replace(`border-right:1px solid ${C.line};`, '')}</tr></table></td></tr>
${sectionHtml}
<tr><td style="padding:24px 24px 4px;font:800 12px/1.2 Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${C.indigo};">Free plan, ${esc(shortDay(r.usage?.day ?? r.day))} (UTC)</td></tr>
<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${planHtml}</table></td></tr>
<tr><td style="padding:24px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${C.muted};">"Played" means finished a match, on Lagos days. A best-of series counts as one match. Sent at 8 am Lagos by the ${esc(r.copy)} copy of the game. The same numbers are in the admin API at /api/admin/stats.</td></tr>
</table>
</td></tr></table>
</body></html>`;

  /* --- plain text --- */
  const text = [
    `Dara X&O${test ? ' (test copy)' : ''}: ${yday ? "yesterday's numbers," : 'numbers for'} ${longDay(r.day)}`,
    '',
    headline,
    ...(warning ? ['', `Warning: ${warning}`] : []),
    ...sections.flatMap((s) => ['', s.title.toUpperCase(), ...s.rows.map(([l, v, n]) => `${l}: ${v}${n ? ` (${cap(n)})` : ''}`)]),
    '',
    'FREE PLAN (UTC DAY)',
    ...planText,
    '',
    '"Played" means finished a match, on Lagos days. A best-of series counts as one match.',
  ].join('\n');

  return { subject, html, text };
}

/** Notes under a number start with a capital letter, like every sentence in the game. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function row(label: string, value: string, note?: string) {
  if (note) note = cap(note);
  return `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};font:600 14px/1.4 Arial,Helvetica,sans-serif;color:${C.ink};">${esc(label)}${note ? `<div style="font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${C.muted};padding-top:2px;">${esc(note)}</div>` : ''}</td><td align="right" valign="top" style="padding:10px 0 10px 12px;border-bottom:1px solid ${C.line};font:800 16px/1.4 Arial,Helvetica,sans-serif;color:${C.ink};white-space:nowrap;">${esc(value)}</td></tr>`;
}

function para(text: string) {
  return `<tr><td colspan="2" style="padding:10px 0;font:400 13px/1.5 Arial,Helvetica,sans-serif;color:${C.muted};">${text}</td></tr>`;
}

function meterRow(label: string, value: string, share: number | null) {
  const w = share === null ? 0 : Math.max(1, Math.min(100, Math.round(share * 100)));
  const colour = share !== null && share >= ALARM ? C.fuchsia : share !== null && share >= WARN ? C.danfo : C.teal;
  const bar = share === null
    ? ''
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr><td width="${w}%" height="6" style="background:${colour};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>${w < 100 ? `<td width="${100 - w}%" height="6" style="background:${C.line};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>` : ''}</tr></table>`;
  return `<tr><td colspan="2" style="padding:10px 0;border-bottom:1px solid ${C.line};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font:600 14px/1.4 Arial,Helvetica,sans-serif;color:${C.ink};">${esc(label)}</td><td align="right" style="font:800 14px/1.4 Arial,Helvetica,sans-serif;color:${C.ink};white-space:nowrap;">${esc(value)}${share === null ? '' : ` <span style="color:${C.muted};font-weight:600;">${Math.round(share * 100)}%</span>`}</td></tr></table>${bar}</td></tr>`;
}

/** Yesterday's players as one bar split by bucket, with a key under it. */
function bucketBar(b: Report['players']['buckets']) {
  const parts = [
    { n: b.current, c: C.teal, l: 'Current' },
    { n: b.new, c: C.indigo, l: 'First day' },
    { n: b.reactivated, c: C.danfo, l: 'Back after 7 to 29 days' },
    { n: b.resurrected, c: C.fuchsia, l: 'Back after 30+ days' },
  ];
  const sum = parts.reduce((a, p) => a + p.n, 0);
  if (!sum) return '';
  const cells = parts
    .filter((p) => p.n)
    .map((p) => `<td width="${Math.max(1, Math.round((p.n / sum) * 100))}%" height="10" style="background:${p.c};font-size:0;line-height:0;">&nbsp;</td>`)
    .join('');
  const key = parts
    .filter((p) => p.n)
    .map((p) => `<span style="white-space:nowrap;"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${p.c};"></span> ${esc(p.l)} ${pct(p.n, sum)}</span>`)
    .join(' &nbsp; ');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:5px;overflow:hidden;"><tr>${cells}</tr></table><div style="font:600 12px/1.8 Arial,Helvetica,sans-serif;color:${C.muted};padding-top:6px;">${key}</div>`;
}

function waitNote(w: Buckets) {
  return WAIT_BUCKETS.filter((b) => w[b]).map((b) => `${BUCKET_LABEL[b]}: ${fmt(w[b])}`).join(', ') + '.';
}

/* ---------- putting it together ---------- */

export async function buildReport(env: Env, day: string): Promise<Report> {
  const [numbers, usage] = await Promise.all([gameNumbers(env, day), freePlanUse(env, day)]);
  return { ...numbers, copy: env.ENVIRONMENT ?? 'local', usage };
}

/** Who gets the report: REPORT_EMAIL, up to 3 addresses separated by commas. */
export const reportTo = (env: Env) =>
  (env.REPORT_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    .slice(0, 3);

/**
 * The 8 am run: tidies old play days, then sends yesterday's report once. `force` (the admin
 * API) sends it again even if it already went.
 */
export async function sendReport(env: Env, opts: { day?: string; force?: boolean; now?: number } = {}): Promise<{ sent: Sent | 'off' | 'already'; day: string }> {
  const now = opts.now ?? Date.now();
  const day = opts.day ?? reportDay(now);
  const to = reportTo(env);
  if (!opts.force) await env.DB.prepare('DELETE FROM player_days WHERE day < ?').bind(addDays(dayKey(now), -KEEP_DAYS)).run().catch(() => {});
  if (!to.length) return { sent: 'off', day };
  if (!opts.force) {
    const first = await env.DB.prepare('INSERT INTO stat_days (day, name, n) VALUES (?, ?, 1) ON CONFLICT (day, name) DO NOTHING').bind(day, STAT.reportSent).run();
    if (!first.meta.changes) return { sent: 'already', day };
  }
  const mail = reportEmail(await buildReport(env, day));
  const sent = await sendEmail(env, to, mail, opts.force ? `report-${day}-${now}` : `report-${env.ENVIRONMENT ?? 'local'}-${day}`);
  // A report that didn't go can be tried again by the next run or the admin API.
  if (sent !== 'sent' && sent !== 'logged' && !opts.force) await env.DB.prepare('DELETE FROM stat_days WHERE day = ? AND name = ?').bind(day, STAT.reportSent).run().catch(() => {});
  if (sent === 'logged') console.log(`[report] ${mail.subject}\n${mail.text}`);
  return { sent, day };
}
