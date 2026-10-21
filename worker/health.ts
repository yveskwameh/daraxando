/**
 * System health for the admin dashboard (docs/HEALTH.md, Yves, 21 October 2026): the live state of
 * everything the game depends on, checked when the dashboard asks, never on a timer.
 *
 * Every check reads. Nothing about players is kept or shown, and no test email is sent. Each check
 * has its own time limit, so one slow service can't hold up the rest, and one that fails says why
 * in a plain line. Waiting on other services doesn't count toward the free plan's 10 ms.
 */
import { dayKey } from '../shared/progression';
import type { Env } from './env';
import { pushReady } from './push';
import { FREE, freePlanUse, GRAPHQL, reportDay, reportTo, usageReady } from './report';
import { STAT } from './stats';

/** Working, needs a look, down, not set up on this copy, or couldn't tell. */
export type HealthState = 'ok' | 'warn' | 'down' | 'off' | 'unknown';

export interface Check {
  id: string;
  label: string;
  state: HealthState;
  detail: string;
  /** How long the check took, where timing tells you something. */
  ms?: number;
  /** Where to look for more. */
  link?: string;
}

export interface Health {
  copy: string;
  at: number;
  /** When this version of the game went live, if Cloudflare says. */
  deployedAt: number | null;
  checks: Check[];
}

/** Answers slower than this are working but slow. */
const SLOW_MS = 800;
/** Each outside check gives up after this long. */
const TIMEOUT_MS = 5000;
const HOUR_MS = 3_600_000;
const EMAILS_PER_DAY = 90;

const WARN_SHARE = 0.5;
const ALARM_SHARE = 0.8;

/** The worse of two states, for a check made of parts. */
const ORDER: HealthState[] = ['ok', 'off', 'unknown', 'warn', 'down'];
export const worst = (states: HealthState[]): HealthState => states.reduce((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a), 'ok');

const fmt = (n: number) => n.toLocaleString('en-US');
/** A message without its closing full stop, to sit inside a sentence. */
const bare = (s: string) => s.replace(/[.\s]+$/, '');
/** "2026-10-18" as "18 Oct". */
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const pct = (share: number) => `${Math.round(share * 100)}%`;

async function timed<T>(fn: () => Promise<T>, limit = TIMEOUT_MS): Promise<{ ok: true; value: T; ms: number } | { ok: false; error: string; ms: number }> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`No answer in ${limit / 1000} seconds`)), limit); }),
    ]);
    return { ok: true, value, ms: Date.now() - start };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 140), ms: Date.now() - start };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

const ago = (ms: number, now: number) => {
  const m = Math.round((now - ms) / 60_000);
  if (m < 2) return 'just now';
  if (m < 90) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hours ago`;
  const d = Math.round(h / 24);
  return `${d} days ago`;
};

/** The hour in Lagos, 0 to 23. Lagos is UTC+1 all year. */
const lagosHour = (now: number) => (new Date(now).getUTCHours() + 1) % 24;

/** The Worker's own name on Cloudflare, for its error counts. */
const scriptOf = (env: Env) => (env.ENVIRONMENT === 'staging' ? 'daraxando-staging' : 'daraxando');

export async function health(env: Env, now = Date.now()): Promise<Health> {
  const db = env.DB;
  const checks = await Promise.all([
    database(db),
    matches(env),
    email(env, now),
    google(env, now),
    notifications(env),
    reminders(env, now),
    morningEmail(env, now),
    ...(await analytics(env, now)),
    cloudflare(env),
  ]);
  const meta = env.CF_VERSION_METADATA;
  const deployedAt = meta?.timestamp ? Date.parse(meta.timestamp) || null : null;
  return { copy: env.ENVIRONMENT ?? 'local', at: now, deployedAt, checks };
}

/* ---------- inside the game ---------- */

async function database(db: D1Database): Promise<Check> {
  const r = await timed(() => db.prepare('SELECT 1 AS one').first<{ one: number }>());
  const base = { id: 'database', label: 'Database' };
  if (!r.ok) return { ...base, state: 'down', detail: `The database didn't answer: ${bare(r.error)}.`, ms: r.ms };
  return { ...base, state: r.ms > SLOW_MS ? 'warn' : 'ok', detail: r.ms > SLOW_MS ? `Slow: answered in ${fmt(r.ms)} ms` : `Answered in ${fmt(r.ms)} ms`, ms: r.ms };
}

async function matches(env: Env): Promise<Check> {
  const r = await timed(() => env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global')).now());
  const base = { id: 'matches', label: 'Matches and Quick match' };
  if (!r.ok) return { ...base, state: 'down', detail: `The matchmaker didn't answer: ${bare(r.error)}.`, ms: r.ms };
  const home = r.value?.home ?? 0;
  const busy = `${fmt(home)} on Home, ${fmt(r.value?.waiting ?? 0)} waiting for a game`;
  return { ...base, state: r.ms > SLOW_MS ? 'warn' : 'ok', detail: r.ms > SLOW_MS ? `Slow (${fmt(r.ms)} ms). ${busy}` : busy, ms: r.ms };
}

/**
 * Email: is the key set, does Resend answer, is our sending address verified, and how close are
 * we to the 90 sign-in codes a day we allow ourselves. Never sends anything.
 */
async function email(env: Env, now: number): Promise<Check> {
  const base = { id: 'email', label: 'Email (Resend)', link: 'https://resend-status.com' };
  if (!env.RESEND_API_KEY) return { ...base, state: 'off', detail: 'No RESEND_API_KEY on this copy, so email sign-in codes and the 8 am email are off.' };
  const [today, api] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM email_codes WHERE created_at > ?').bind(now - 24 * HOUR_MS).first<{ n: number }>().catch(() => null),
    timed(async () => {
      const res = await fetch('https://api.resend.com/domains', { headers: { authorization: `Bearer ${env.RESEND_API_KEY!.trim()}` } });
      const body = (await res.json().catch(() => ({}))) as { name?: string; message?: string; data?: { name?: string; status?: string }[] };
      return { status: res.status, body };
    }),
  ]);
  const sent = Number(today?.n ?? 0);
  const quota = `${fmt(sent)} of ${EMAILS_PER_DAY} sign-in codes in the last 24 hours`;
  const quotaState: HealthState = sent >= EMAILS_PER_DAY ? 'down' : sent >= EMAILS_PER_DAY * ALARM_SHARE ? 'warn' : 'ok';
  if (!api.ok) return { ...base, state: 'down', detail: `Resend didn't answer: ${bare(api.error)}. ${quota}.`, ms: api.ms };
  const { status, body } = api.value;
  // A key that can only send can't list domains. That's the safer kind of key, so it's fine.
  if (status === 401 && body.name === 'restricted_api_key') {
    return { ...base, state: quotaState, detail: `Resend answers, and the key can only send (the safest kind). ${quota}.`, ms: api.ms };
  }
  if (status === 401 || status === 403) return { ...base, state: 'down', detail: `Resend refused the key: ${body.message ?? status}. ${quota}.`, ms: api.ms };
  if (status === 429) return { ...base, state: 'warn', detail: `Resend says slow down for a moment. ${quota}.`, ms: api.ms };
  if (status >= 500) return { ...base, state: 'down', detail: `Resend is having trouble (${status}). ${quota}.`, ms: api.ms };
  const domains = body.data ?? [];
  const bad = domains.filter((d) => d.status !== 'verified');
  if (domains.length && bad.length === domains.length) {
    return { ...base, state: 'down', detail: `Resend answers, but ${bad.map((d) => d.name).join(', ')} isn't verified, so emails can't go. ${quota}.`, ms: api.ms };
  }
  return { ...base, state: quotaState, detail: `Resend answers and the sending domain is verified. ${quota}.`, ms: api.ms };
}

async function google(env: Env, now: number): Promise<Check> {
  const base = { id: 'google', label: 'Google sign-in' };
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return { ...base, state: 'off', detail: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing on this copy.' };
  const last = await env.DB.prepare("SELECT MAX(created_at) AS at FROM identities WHERE provider = 'google'").first<{ at: number | null }>().catch(() => null);
  return { ...base, state: 'ok', detail: `Keys set. ${last?.at ? `Last player saved with Google ${ago(last.at, now)}.` : 'Nobody has saved with Google yet.'}`, link: 'https://www.google.com/appsstatus/dashboard/' };
}

async function notifications(env: Env): Promise<Check> {
  const base = { id: 'push', label: 'Notifications' };
  if (!pushReady(env)) return { ...base, state: 'off', detail: 'The VAPID keys are missing on this copy, so notifications are off.' };
  const subs = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first<{ n: number }>().catch(() => null);
  return { ...base, state: 'ok', detail: `Keys set. ${fmt(Number(subs?.n ?? 0))} phones have notifications on.` };
}

/** The 7 pm streak reminders: did tonight's run happen? */
async function reminders(env: Env, now: number): Promise<Check> {
  const base = { id: 'reminders', label: '7 pm streak reminders' };
  if (!pushReady(env)) return { ...base, state: 'off', detail: 'Off with notifications.' };
  const r = await timed(() => env.NOTIFIER.get(env.NOTIFIER.idFromName('streak')).status());
  if (!r.ok) return { ...base, state: 'down', detail: `The reminder job didn't answer: ${bare(r.error)}.`, ms: r.ms };
  const today = dayKey(now);
  const ran = r.value.day;
  // 7 pm Lagos plus a few minutes for the run to start.
  const due = lagosHour(now) >= 19 && new Date(now).getUTCMinutes() + (lagosHour(now) - 19) * 60 >= 15;
  if (ran === today) return { ...base, state: 'ok', detail: `Ran tonight: ${fmt(r.value.sent)} reminders sent.` };
  if (due) return { ...base, state: 'down', detail: `Tonight's run hasn't happened yet. Last run: ${ran ? shortDay(ran) : 'never'}.` };
  return { ...base, state: 'ok', detail: `Runs at 7 pm. Last run: ${ran ? `${shortDay(ran)}, ${fmt(r.value.sent)} sent` : 'never'}.` };
}

/** The 8 am email: did this morning's go? */
async function morningEmail(env: Env, now: number): Promise<Check> {
  const base = { id: 'report', label: '8 am email' };
  if (!reportTo(env).length) return { ...base, state: 'off', detail: 'No REPORT_EMAIL on this copy.' };
  if (!env.RESEND_API_KEY) return { ...base, state: 'off', detail: 'Off without RESEND_API_KEY.' };
  const sent = await env.DB.prepare('SELECT 1 AS hit FROM stat_days WHERE day = ? AND name = ?').bind(reportDay(now), STAT.reportSent).first().catch(() => null);
  if (sent) return { ...base, state: 'ok', detail: "This morning's email went out." };
  // 8 am Lagos plus half an hour for Cloudflare's cron and Resend.
  if (lagosHour(now) * 60 + new Date(now).getUTCMinutes() >= 8 * 60 + 30) return { ...base, state: 'down', detail: "This morning's email didn't go. Send it again from Today." };
  return { ...base, state: 'ok', detail: 'Goes at 8 am.' };
}

/* ---------- Cloudflare's numbers: the free plan, errors, and the analytics key ---------- */

async function analytics(env: Env, now: number): Promise<Check[]> {
  const plan = { id: 'plan', label: 'Free plan today', link: 'https://dash.cloudflare.com' };
  const errors = { id: 'errors', label: 'Errors in the last hour' };
  const key = { id: 'analytics', label: 'Cloudflare analytics key' };
  if (!usageReady(env)) {
    const off = 'Needs CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN on this copy.';
    return [{ ...plan, state: 'off', detail: off }, { ...errors, state: 'off', detail: off }, { ...key, state: 'off', detail: off }];
  }
  const day = new Date(now).toISOString().slice(0, 10);
  const [use, hour] = await Promise.all([timed(() => freePlanUse(env, day), 8000), timed(() => lastHour(env, now), 8000)]);

  const out: Check[] = [];
  // The free plan: the most used of the four daily limits.
  if (!use.ok || !use.value) {
    out.push({ ...plan, state: 'unknown', detail: `Couldn't read today's use${use.ok ? '' : `: ${bare(use.error)}`}.` });
  } else {
    const u = use.value;
    const parts = [
      { label: 'Requests', used: u.requests?.total ?? null, max: FREE.requests },
      { label: 'Match and Quick match requests', used: u.doRequests, max: FREE.doRequests },
      { label: 'Database rows read', used: u.rowsRead, max: FREE.rowsRead },
      { label: 'Database rows written', used: u.rowsWritten, max: FREE.rowsWritten },
    ].filter((p) => p.used !== null).map((p) => ({ ...p, share: p.used! / p.max }));
    const top = parts.sort((a, b) => b.share - a.share)[0];
    if (!top) out.push({ ...plan, state: 'unknown', detail: u.problems[0] ? `Couldn't read today's use: ${bare(u.problems[0])}.` : "Couldn't read today's use." });
    else {
      const state: HealthState = top.share >= ALARM_SHARE ? 'down' : top.share >= WARN_SHARE ? 'warn' : 'ok';
      out.push({ ...plan, state, detail: `Highest: ${top.label.toLowerCase()} at ${pct(top.share)} (${fmt(top.used!)} of ${fmt(top.max)}). Resets at 1 am Lagos.` });
    }
  }

  // Errors: requests that failed in the last hour, on this copy only.
  if (!hour.ok || 'refused' in hour.value) {
    out.push({ ...errors, state: 'unknown', detail: `Couldn't read the last hour: ${bare(hour.ok ? (hour.value as { refused: string }).refused : hour.error)}.` });
  } else {
    const { requests, errors: failed } = hour.value;
    const share = requests ? failed / requests : 0;
    const state: HealthState = requests < 20 ? (failed >= 5 ? 'warn' : 'ok') : share >= 0.05 ? 'down' : share >= 0.01 ? 'warn' : 'ok';
    out.push({ ...errors, state, detail: requests ? `${fmt(failed)} of ${fmt(requests)} requests failed (${share < 0.001 && failed ? 'under 0.1%' : pct(share)}).` : 'No requests in the last hour.' });
  }

  // The key itself: it works if either read came back. Cloudflare saying no is a problem with the
  // key; not reaching Cloudflare at all isn't, so that's unknown.
  const keyWorks = (use.ok && use.value && use.value.problems.length < 3) || (hour.ok && !('refused' in hour.value));
  if (keyWorks) out.push({ ...key, state: 'ok', detail: 'Cloudflare answers, so Growth and the free plan numbers work.' });
  else if (hour.ok && 'refused' in hour.value) out.push({ ...key, state: 'down', detail: `Cloudflare refused it: ${hour.value.refused}. Growth's visits and the free plan stop.` });
  else out.push({ ...key, state: 'unknown', detail: `Couldn't reach Cloudflare's analytics: ${bare(hour.ok ? '' : hour.error)}.` });
  return out;
}

/** Requests and failed requests on this copy's Worker in the last hour, or null if Cloudflare didn't answer. */
async function lastHour(env: Env, now: number): Promise<{ requests: number; errors: number } | { refused: string }> {
  const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
  const query = `{ viewer { accounts(filter: { accountTag: ${JSON.stringify(env.CF_ACCOUNT_ID!.trim())} }) {
    workersInvocationsAdaptive(limit: 10, filter: { scriptName: ${JSON.stringify(scriptOf(env))}, datetime_geq: ${JSON.stringify(iso(now - HOUR_MS))}, datetime_leq: ${JSON.stringify(iso(now))} }) { sum { requests errors } }
  } } }`;
  const at = env.ENVIRONMENT === 'local' && env.CF_GRAPHQL_URL ? env.CF_GRAPHQL_URL : GRAPHQL;
  const res = await fetch(at, { method: 'POST', headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN!.trim()}`, 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
  const body = (await res.json().catch(() => ({}))) as { data?: { viewer?: { accounts?: { workersInvocationsAdaptive?: { sum?: { requests?: number; errors?: number } }[] }[] } }; errors?: unknown[] | null };
  const rows = body.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive;
  if (!res.ok || body.errors?.length || !rows) return { refused: bare(String((body.errors?.[0] as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`)).slice(0, 120) };
  return rows.reduce((a, r) => ({ requests: a.requests + (r.sum?.requests ?? 0), errors: a.errors + (r.sum?.errors ?? 0) }), { requests: 0, errors: 0 });
}

/* ---------- Cloudflare itself ---------- */

/** The parts of Cloudflare the game uses, as its status page names them, and the Lagos data centre. */
export const OURS = /^(workers|durable objects|d1|web analytics|cloudflare web analytics|workers builds)\b|lagos/i;

interface Incident { name?: string; status?: string; impact?: string; components?: { name?: string; status?: string }[] }

/**
 * Cloudflare's public status page, read from its short list of open incidents (the full page lists
 * every data centre and is too big to read inside the free plan's time). Only incidents touching
 * the parts we use count.
 */
export async function cloudflare(env: Env): Promise<Check> {
  const base = { id: 'cloudflare', label: 'Cloudflare', link: 'https://www.cloudflarestatus.com' };
  const at = env.ENVIRONMENT === 'local' && env.CF_STATUS_URL ? env.CF_STATUS_URL : 'https://www.cloudflarestatus.com/api/v2/incidents/unresolved.json';
  const r = await timed(async () => {
    const res = await fetch(at, { headers: { accept: 'application/json' }, cf: { cacheTtl: 60, cacheEverything: true } } as RequestInit);
    if (!res.ok) throw new Error(`Status page answered ${res.status}`);
    return ((await res.json()) as { incidents?: Incident[] }).incidents ?? [];
  });
  if (!r.ok) return { ...base, state: 'unknown', detail: `Couldn't read Cloudflare's status page: ${bare(r.error)}.` };
  return cloudflareCheck(r.value);
}

export function cloudflareCheck(incidents: Incident[]): Check {
  const base = { id: 'cloudflare', label: 'Cloudflare', link: 'https://www.cloudflarestatus.com' };
  const hits = incidents
    .map((i) => ({ i, parts: (i.components ?? []).filter((c) => OURS.test(c.name ?? '')) }))
    .filter((x) => x.parts.length);
  if (!hits.length) {
    return { ...base, state: 'ok', detail: incidents.length ? `Workers, D1 and Durable Objects working. ${incidents.length} incident${incidents.length === 1 ? '' : 's'} elsewhere on Cloudflare.` : 'Workers, D1 and Durable Objects working.' };
  }
  const major = hits.some((x) => x.i.impact === 'major' || x.i.impact === 'critical' || x.parts.some((c) => c.status === 'major_outage'));
  const names = [...new Set(hits.flatMap((x) => x.parts.map((c) => c.name)))].slice(0, 3).join(', ');
  return { ...base, state: major ? 'down' : 'warn', detail: `${hits[0].i.name ?? 'An incident'} (${names}).` };
}
