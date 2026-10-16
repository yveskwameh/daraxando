/**
 * Save your progress (docs/BACKEND.md, milestone 3). A guest links Google or an email to their
 * player, and can then sign in to that player on any phone. Either way the phone ends up with a
 * token for the same player id, exactly like a guest's (worker/auth.ts).
 *
 * Google: the app asks for a Google address (start), the player picks an account on Google's
 * page, and Google sends them back to the callback with a one-time code. The server swaps that
 * code for the account's id directly with Google, using the client secret and PKCE, so only this
 * server can. The outcome waits a few minutes in auth_handoffs for the app to collect (finish).
 *
 * Email: a 6-digit code (10 minutes, 5 tries) plus a link that does the same on whichever phone
 * opens it. Only keyed hashes of the code and the link are stored. Limits keep within Resend's
 * free plan of 100 emails a day.
 *
 * A Google account or an email belongs to one player, and a player has at most one of each.
 * Using one that already has a player signs in to that player; the app asks first if the phone
 * already has a different player on it.
 */
import type { Account, AuthResult, AuthVia, Profile } from '../shared/protocol';
import { fromB64url, hmac, randomToken, sameText, sha256, signToken, sixDigits } from './auth';
import { getPlayer } from './db';
import { codeEmail, type Email } from './email';
import type { Env } from './env';
import { body, fail, json, phoneKey, secretOf } from './http';

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;
/** Codes one address can ask for in an hour. */
const CODES_PER_HOUR = 5;
/** Resend's free plan sends 100 emails a day. Stop a little short, so a test never hits the wall. */
const EMAILS_PER_DAY = 90;
/** Time to pick an account on Google's page. */
const GOOGLE_MS = 10 * 60_000;
/** Time for the app to collect the outcome once Google sends the player back. */
const RESULT_MS = 5 * 60_000;
const KEEP_CODES_MS = 2 * 86_400_000;

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** The link in the email is /c/<code id>/<secret>; the app sends it here as <code id>.<secret>. */
export const LINK_RE = /^([A-Za-z0-9_-]{8,24})\.([A-Za-z0-9_-]{16,64})$/;

const SLOW = 'Too many tries. Wait a minute, then try again.';

type Intent = 'save' | 'signin';
const isIntent = (x: unknown): x is Intent => x === 'save' || x === 'signin';
const isLocal = (env: Env) => (env.ENVIRONMENT ?? 'local') === 'local';

interface CodeRow {
  id: string;
  email: string;
  kind: Intent;
  player_id: string | null;
  code_hash: string;
  link_hash: string;
  attempts: number;
  expires_at: number;
  used_at: number | null;
  result: string | null;
  created_at: number;
}

/** What waits in auth_handoffs for the app after Google: who asked, and what happened. */
type Stored =
  | { k: 'player'; t: string; saved: boolean }
  | { k: 'none' }
  | { k: 'error'; m: string };

/** Lower case, trimmed, and shaped like an address. Null if it isn't one. */
export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(e) ? e : null;
}

export interface IdClaims {
  sub: string;
  email: string | null;
  verified: boolean;
}

/**
 * What we need from Google's id_token. It came straight from Google over HTTPS in answer to our
 * own request, so its signature needn't be checked (Google's OpenID guide says the same), but who
 * it's for, who made it and when it runs out still are.
 */
export function readIdToken(idToken: unknown, clientId: string, now = Date.now()): IdClaims | null {
  if (typeof idToken !== 'string') return null;
  const raw = fromB64url(idToken.split('.')[1] ?? '');
  if (!raw) return null;
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (c.aud !== clientId || !GOOGLE_ISSUERS.includes(c.iss as string)) return null;
  if (typeof c.exp !== 'number' || c.exp * 1000 < now) return null;
  if (typeof c.sub !== 'string' || !c.sub) return null;
  return {
    sub: c.sub,
    email: typeof c.email === 'string' ? c.email.toLowerCase() : null,
    verified: c.email_verified === true || c.email_verified === 'true',
  };
}

const limited = async (limiter: RateLimit | undefined, key: string) => !!limiter && !(await limiter.limit({ key })).success;

/* ---------- who owns what ---------- */

async function playerByGoogle(db: D1Database, sub: string) {
  const row = await db.prepare("SELECT player_id FROM identities WHERE provider = 'google' AND subject = ?").bind(sub).first<{ player_id: string }>();
  return row?.player_id ?? null;
}

/** The player saved with this address: by email first, then by a Google account with that address. */
async function playerByEmail(db: D1Database, email: string) {
  const row = await db
    .prepare("SELECT player_id FROM identities WHERE email = ? ORDER BY provider = 'email' DESC LIMIT 1")
    .bind(email)
    .first<{ player_id: string }>();
  return row?.player_id ?? null;
}

/** What a player has linked. A Google account without a verified address shows as ''. */
export async function accountOf(db: D1Database, playerId: string): Promise<Account> {
  const { results } = await db.prepare('SELECT provider, email FROM identities WHERE player_id = ?').bind(playerId).all<{ provider: AuthVia; email: string | null }>();
  const of = (p: AuthVia) => {
    const r = results.find((x) => x.provider === p);
    return r ? (r.email ?? '') : null;
  };
  return { google: of('google'), email: of('email') };
}

/**
 * Links a Google account or an email to a player who doesn't have one of that kind yet, and marks
 * the player saved. False if the player already has one, the sign-in belongs to someone else, or
 * the player is gone. Done in SQL, so two phones racing can't both win.
 */
async function link(db: D1Database, playerId: string, via: AuthVia, subject: string, email: string | null, now: number) {
  const [added] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO identities (provider, subject, player_id, email, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5
         WHERE EXISTS (SELECT 1 FROM players WHERE id = ?3)
           AND NOT EXISTS (SELECT 1 FROM identities WHERE player_id = ?3 AND provider = ?1)`,
      )
      .bind(via, subject, playerId, email, now),
    db
      .prepare('UPDATE players SET saved = 1, updated_at = ?2 WHERE id = ?1 AND saved = 0 AND EXISTS (SELECT 1 FROM identities WHERE player_id = ?1)')
      .bind(playerId, now),
  ]);
  return (added.meta.changes ?? 0) > 0;
}

/** What a sign-in means for the phone that asked: the same player, a new one for this phone, or a switch. */
async function outcome(env: Env, via: AuthVia, target: string, requester: string | null, saved: boolean): Promise<AuthResult> {
  const profile = await getPlayer(env.DB, target);
  if (!profile) return { status: 'error', message: 'That player has been deleted.' };
  if (requester === target) return { status: saved ? 'saved' : 'same', via, profile };
  return { status: requester ? 'switch' : 'signedin', via, profile, token: await signToken(target, secretOf(env)) };
}

/** Deletes a player and everything kept about them. Finished match rows stay, holding only a random id that now leads nowhere. */
export async function deleteAccount(db: D1Database, id: string) {
  await db.batch([
    db.prepare('DELETE FROM email_codes WHERE player_id = ?1 OR email IN (SELECT email FROM identities WHERE player_id = ?1)').bind(id),
    db.prepare('DELETE FROM identities WHERE player_id = ?').bind(id),
    db.prepare('DELETE FROM league_entries WHERE player_id = ?').bind(id),
    db.prepare('DELETE FROM friend_streaks WHERE a = ?1 OR b = ?1').bind(id),
    db.prepare('DELETE FROM ledger WHERE player_id = ?').bind(id),
    db.prepare('DELETE FROM appeals WHERE player_id = ?').bind(id),
    db.prepare('DELETE FROM players WHERE id = ?').bind(id),
  ]);
}

/* ---------- the routes: everything under /api/auth/ ---------- */

/** `me` is the player on the phone that's asking, or null for a phone with no player yet. */
export async function authRoute(req: Request, env: Env, url: URL, me: Profile | null): Promise<Response> {
  const path = url.pathname;
  const method = req.method;
  const now = Date.now();
  const db = env.DB;
  const phone = me ? `p:${me.id}` : phoneKey(req);

  /* --- Google, step 1: where to send the player --- */
  if (path === '/api/auth/google/start' && method === 'POST') {
    if (await limited(env.AUTH_LIMITER, `g:${phone}`)) return fail(429, SLOW);
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail(503, "Google sign-in isn't set up on this copy yet. Use your email instead.");
    const b = await body<{ intent: Intent; back: string }>(req);
    const intent = isIntent(b.intent) ? b.intent : 'save';
    // Back to the screen they left: You, Home, or a friend's room they were invited to.
    const back = typeof b.back === 'string' && /^\/(you|play\/[A-Za-z0-9]{5,24})?$/.test(b.back) ? b.back : '/';
    const state = randomToken();
    const verifier = randomToken(32);
    await db
      .prepare("INSERT INTO auth_handoffs (id, kind, data, expires_at) VALUES (?, 'google', ?, ?)")
      .bind(state, JSON.stringify({ v: verifier, p: me?.id ?? null, i: intent, b: back }), now + GOOGLE_MS)
      .run();
    const auth = new URL((isLocal(env) && env.GOOGLE_AUTH_URL) || GOOGLE_AUTH);
    auth.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      response_type: 'code',
      // Only the account's id and its address. No name, no photo.
      scope: 'openid email',
      state,
      code_challenge: await sha256(verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return json({ url: auth.toString() });
  }

  /* --- Google, step 2: Google sends the player back here. Always answers with a trip back into the app. --- */
  if (path === '/api/auth/google/callback' && method === 'GET') {
    const state = url.searchParams.get('state') ?? '';
    const row = /^[A-Za-z0-9_-]{16,64}$/.test(state)
      ? await db.prepare("DELETE FROM auth_handoffs WHERE id = ? AND kind = 'google' RETURNING data, expires_at").bind(state).first<{ data: string; expires_at: number }>()
      : null;
    const asked = row && row.expires_at > now ? (JSON.parse(row.data) as { v: string; p: string | null; i: Intent; b: string }) : null;
    let result: Stored;
    if (!asked) result = { k: 'error', m: 'Google sign-in took too long. Try again.' };
    else if (url.searchParams.get('error')) result = { k: 'error', m: 'Google sign-in was cancelled.' };
    else result = await fromGoogle(env, url, asked, now);
    const id = randomToken();
    await db
      .prepare("INSERT INTO auth_handoffs (id, kind, data, expires_at) VALUES (?, 'result', ?, ?)")
      .bind(id, JSON.stringify({ r: asked?.p ?? null, ...result }), now + RESULT_MS)
      .run();
    return Response.redirect(`${url.origin}${asked?.b ?? '/'}#signin=${id}`, 302);
  }

  /* --- Google, step 3: the app collects what happened --- */
  if (path === '/api/auth/finish' && method === 'POST') {
    if (await limited(env.AUTH_LIMITER, `f:${phone}`)) return fail(429, SLOW);
    const b = await body<{ id: string }>(req);
    const row = typeof b.id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(b.id)
      ? await db.prepare("DELETE FROM auth_handoffs WHERE id = ? AND kind = 'result' RETURNING data, expires_at").bind(b.id).first<{ data: string; expires_at: number }>()
      : null;
    if (!row || row.expires_at < now) return json({ status: 'error', message: 'That sign-in took too long. Try again.' } satisfies AuthResult);
    const d = JSON.parse(row.data) as Stored & { r: string | null };
    if (d.k === 'error') return json({ status: 'error', message: d.m } satisfies AuthResult);
    if (d.k === 'none') return json({ status: 'none', via: 'google' } satisfies AuthResult);
    // Only the phone that started it can collect a player. An iPhone may finish Google in Safari
    // instead of the installed app: the save still happened, so say where to go.
    if (d.r !== (me?.id ?? null)) {
      const message = d.saved ? 'Saved with Google. Go back to the Dara X&O app to keep playing.' : 'Google sign-in started on another screen. Try again here.';
      return json({ status: 'error', message } satisfies AuthResult);
    }
    return json(await outcome(env, 'google', d.t, me?.id ?? null, d.saved));
  }

  /* --- email, step 1: send a code --- */
  if (path === '/api/auth/email/start' && method === 'POST') {
    const b = await body<{ email: string; intent: Intent }>(req);
    const email = cleanEmail(b.email);
    if (!email) return fail(400, 'Check your email address. It should look like name@example.com.');
    const intent = isIntent(b.intent) ? b.intent : 'save';
    if (await limited(env.EMAIL_LIMITER, `s:${phone}`)) return fail(429, 'Wait a minute before asking for another code.');
    const [recent, today] = await db.batch<{ n: number }>([
      db.prepare('SELECT COUNT(*) AS n FROM email_codes WHERE email = ? AND created_at > ?').bind(email, now - 3_600_000),
      db.prepare('SELECT COUNT(*) AS n FROM email_codes WHERE created_at > ?').bind(now - 86_400_000),
    ]);
    if ((recent.results[0]?.n ?? 0) >= CODES_PER_HOUR) return fail(429, 'We sent a few codes to this address already. Use the newest one, or try again in an hour.');
    if ((today.results[0]?.n ?? 0) >= EMAILS_PER_DAY) return fail(503, 'Email codes are resting for today. Use Google, or try again tomorrow.');

    // Who the code is for. Nothing here says whose player an address belongs to: that only shows once the code is typed.
    const owner = await playerByEmail(db, email);
    let kind: Intent;
    let playerId: string | null = null;
    let name: string;
    if (owner) {
      // Its own address, by email or through Google: codes to it already sign in to this player.
      if (owner === me?.id) return fail(409, 'This email already signs in to this player. Use it with a code on any phone.');
      const p = await getPlayer(db, owner);
      if (!p) return fail(404, 'No player is saved with this email.');
      kind = 'signin';
      name = p.name;
    } else if (me && intent === 'save') {
      const mine = await accountOf(db, me.id);
      if (mine.email) return fail(409, `This player is already saved with ${mine.email}.`);
      kind = 'save';
      playerId = me.id;
      name = me.name;
    } else {
      return fail(404, 'No player is saved with this email. Check the spelling, or use Google if you saved with Google.');
    }

    // Per address too, counted only when an email would really go out.
    if (await limited(env.EMAIL_LIMITER, `e:${email}`)) return fail(429, 'Wait a minute before asking for another code.');
    const id = randomToken(9);
    const code = sixDigits();
    const secret = randomToken();
    const key = secretOf(env);
    const [codeHash, linkHash] = await Promise.all([hmac(key, `code:${id}:${code}`), hmac(key, `link:${id}:${secret}`)]);
    await db.batch([
      // Tidy up while we're here: old codes and stale Google hand-offs.
      db.prepare('DELETE FROM email_codes WHERE created_at < ?').bind(now - KEEP_CODES_MS),
      db.prepare('DELETE FROM auth_handoffs WHERE expires_at < ?').bind(now),
      db
        .prepare('INSERT INTO email_codes (id, email, kind, player_id, code_hash, link_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, email, kind, playerId, codeHash, linkHash, now + CODE_MINUTES * 60_000, now),
    ]);
    // Two path parts, no dot, so nothing mistakes the link for a file.
    const codeUrl = `${url.origin}/c/${id}/${secret}`;
    const sent = await sendEmail(env, email, codeEmail({ code, kind, name, origin: url.origin, minutes: CODE_MINUTES, codeUrl }), id);
    if (sent === 'logged') console.log(`[sign-in code] ${email}: ${code}  link: ${codeUrl}`);
    else if (sent !== 'sent') {
      await db.prepare('DELETE FROM email_codes WHERE id = ?').bind(id).run();
      const why = {
        unset: "Email codes aren't set up on this copy yet. Use Google instead.",
        busy: 'Email codes are busy. Try again in a minute, or use Google.',
        quota: 'Email codes are resting for today. Use Google, or try again tomorrow.',
        failed: "We couldn't send the email. Check the address, then try again.",
      }[sent];
      return fail(503, why);
    }
    return json({ id, kind });
  }

  /* --- email, step 2: the code, or the link from the email --- */
  if (path === '/api/auth/email/verify' && method === 'POST') {
    if (await limited(env.AUTH_LIMITER, `v:${phone}`)) return fail(429, SLOW);
    const b = await body<{ id: string; code: string; link: string }>(req);
    const key = secretOf(env);
    let row: CodeRow | null;
    if (typeof b.link === 'string') {
      const m = b.link.match(LINK_RE);
      row = m ? await db.prepare('SELECT * FROM email_codes WHERE id = ?').bind(m[1]).first<CodeRow>() : null;
      if (!m || !row || !sameText(row.link_hash, await hmac(key, `link:${m[1]}:${m[2]}`))) return fail(404, "This link doesn't work. Ask for a new code in Dara X&O.");
      const why = unusable(row, now, true);
      if (why) return fail(410, why);
    } else {
      const code = typeof b.code === 'string' ? b.code.replace(/\D/g, '') : '';
      if (typeof b.id !== 'string' || code.length !== 6) return fail(400, 'Type the 6 numbers from the email.');
      // Count the try first, so guessing can't outrun the limit.
      row = await db
        .prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ? AND used_at IS NULL AND expires_at > ? AND attempts < ? RETURNING *')
        .bind(b.id, now, CODE_TRIES)
        .first<CodeRow>();
      if (!row) {
        const was = await db.prepare('SELECT * FROM email_codes WHERE id = ?').bind(b.id).first<CodeRow>();
        return fail(410, (was && unusable(was, now, false)) || 'Ask for a new code.');
      }
      if (!sameText(row.code_hash, await hmac(key, `code:${row.id}:${code}`))) {
        const left = CODE_TRIES - row.attempts;
        return fail(400, left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : "That code isn't right, and that was the last try. Ask for a new code.");
      }
    }
    // One use only, even if the code and the link arrive at the same moment.
    const claimed = await db.prepare('UPDATE email_codes SET used_at = ? WHERE id = ? AND used_at IS NULL RETURNING id').bind(now, row.id).first();
    if (!claimed) return fail(410, 'That code was already used.');
    const result = await useCode(env, row, me, now);
    if (result.status !== 'error') await db.prepare('UPDATE email_codes SET result = ? WHERE id = ?').bind(result.status, row.id).run();
    return json(result);
  }

  /* --- email: the phone that asked checks whether the link was used somewhere else. Called when the app comes back on screen, never on a timer. --- */
  if (path === '/api/auth/email/status' && method === 'GET') {
    const id = url.searchParams.get('id') ?? '';
    const row = /^[A-Za-z0-9_-]{8,24}$/.test(id)
      ? await db.prepare('SELECT kind, player_id, used_at, expires_at FROM email_codes WHERE id = ?').bind(id).first<Pick<CodeRow, 'kind' | 'player_id' | 'used_at' | 'expires_at'>>()
      : null;
    if (!row) return json({ state: 'expired' });
    if (row.used_at) return json({ state: 'used', saved: row.kind === 'save' && !!me && row.player_id === me.id });
    return json({ state: row.expires_at > now ? 'waiting' : 'expired' });
  }

  /* --- the page the email's link opens: whose player it is, before anything happens --- */
  const peek = path.match(/^\/api\/auth\/link\/([^/]+)$/);
  if (peek && method === 'GET') {
    if (await limited(env.AUTH_LIMITER, `l:${phone}`)) return fail(429, SLOW);
    const m = peek[1].match(LINK_RE);
    const row = m ? await db.prepare('SELECT * FROM email_codes WHERE id = ?').bind(m[1]).first<CodeRow>() : null;
    if (!m || !row || !sameText(row.link_hash, await hmac(secretOf(env), `link:${m[1]}:${m[2]}`))) return fail(404, "This link doesn't work. Ask for a new code in Dara X&O.");
    const target = row.kind === 'save' ? row.player_id : await playerByEmail(db, row.email);
    const p = target ? await getPlayer(db, target) : null;
    return json({
      kind: row.kind,
      email: row.email,
      state: row.used_at ? 'used' : row.expires_at <= now ? 'expired' : 'ready',
      player: p ? { id: p.id, name: p.name, avatar: p.avatar, print: p.print } : null,
    });
  }

  return fail(404, 'not found');
}

/** Why a code can't be used any more, or null if it can. The link isn't limited by wrong code tries. */
function unusable(row: CodeRow, now: number, byLink: boolean) {
  if (row.used_at) return 'That code was already used. Ask for a new one if you need it.';
  if (row.expires_at <= now) return 'That code has run out. Ask for a new one.';
  if (!byLink && row.attempts >= CODE_TRIES) return 'Too many wrong tries. Ask for a new code.';
  return null;
}

/** A right code (or link): link the email to the guest who asked, or sign in to the player it belongs to. */
async function useCode(env: Env, row: CodeRow, me: Profile | null, now: number): Promise<AuthResult> {
  let target = await playerByEmail(env.DB, row.email);
  let saved = false;
  if (!target && row.kind === 'save' && row.player_id) {
    if (!(await link(env.DB, row.player_id, 'email', row.email, row.email, now))) {
      return { status: 'error', message: 'This player is already saved with another email.' };
    }
    target = row.player_id;
    saved = true;
  }
  if (!target) return { status: 'error', message: 'That player has been deleted.' };
  return outcome(env, 'email', target, me?.id ?? null, saved);
}

/** Swaps Google's one-time code for the account, then finds or saves the player. */
async function fromGoogle(env: Env, url: URL, asked: { v: string; p: string | null; i: Intent }, now: number): Promise<Stored> {
  const code = url.searchParams.get('code');
  if (!code) return { k: 'error', m: "Google sign-in didn't finish. Try again." };
  let data: { id_token?: string; error?: string };
  try {
    const res = await fetch((isLocal(env) && env.GOOGLE_TOKEN_URL) || GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${url.origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
        code_verifier: asked.v,
      }),
    });
    data = (await res.json()) as typeof data;
    if (!res.ok) {
      console.error('[google]', res.status, data.error);
      return { k: 'error', m: "Google sign-in didn't finish. Try again." };
    }
  } catch (err) {
    console.error('[google]', err);
    return { k: 'error', m: "Couldn't reach Google. Check your connection, then try again." };
  }
  const claims = readIdToken(data.id_token, env.GOOGLE_CLIENT_ID!, now);
  if (!claims) return { k: 'error', m: "Google sign-in didn't finish. Try again." };
  const email = claims.verified ? claims.email : null;

  let target = await playerByGoogle(env.DB, claims.sub);
  let linked = false;
  if (!target && email) {
    // A player saved with this same address by email: it's theirs, so Google joins it.
    target = await playerByEmail(env.DB, email);
    if (target) linked = await link(env.DB, target, 'google', claims.sub, email, now);
  }
  if (target) return { k: 'player', t: target, saved: linked };
  if (asked.p && asked.i === 'save') {
    if (await link(env.DB, asked.p, 'google', claims.sub, email, now)) return { k: 'player', t: asked.p, saved: true };
    return { k: 'error', m: 'This player is already saved with another Google account.' };
  }
  return { k: 'none' };
}

type Sent = 'sent' | 'logged' | 'unset' | 'busy' | 'quota' | 'failed';

/** Sends through Resend. On your Mac without a key, the code is printed in the terminal instead. */
async function sendEmail(env: Env, to: string, mail: Email, id: string): Promise<Sent> {
  if (!env.RESEND_API_KEY) return isLocal(env) ? 'logged' : 'unset';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': `code-${id}` },
      body: JSON.stringify({
        from: env.EMAIL_FROM ?? '"Dara X&O" <code@noreply.daraxando.yveskwameh.com>',
        to: [to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (res.ok) return 'sent';
    const err = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
    console.error('[resend]', res.status, err.name, err.message);
    if (err.name === 'daily_quota_exceeded' || err.name === 'monthly_quota_exceeded') return 'quota';
    return res.status === 429 ? 'busy' : 'failed';
  } catch (err) {
    console.error('[resend]', err);
    return 'busy';
  }
}
