/**
 * Player codes, and "Lost your code? Ask us to help" (shared/codes.ts, docs/CODES-REVIEW.md).
 *
 * A player's code is 16 characters from the room-code letters. The database keeps a keyed hash
 * of it, to find the player when it's typed, and the code itself encrypted with the server's
 * secret, so a phone already signed in as the player can show it again in Settings. Typing it on
 * a phone hands that phone a login, links the phone to the player (worker/phones.ts) and notes
 * when and on which phone, so the player's other phones can say "opened on another phone".
 *
 * Logins carry the player's sign-in version (players.login_v, worker/auth.ts). "Not me" raises
 * it and makes a new code: every other phone is signed out and the old code stops working.
 *
 * A player who lost their code asks from a phone with a short form. Yves answers in the admin
 * dashboard. Given back, it waits 24 hours while every phone the player is on shows a warning
 * with Stop; then the asking phone collects the player, with a new code, and every other phone
 * is signed out. Nothing happens on a timer: the asking phone collects when it next opens.
 */
import {
  cleanCode, CODES_ON_REAL_GAME, MONTHS, PLAYER_CODE_ALPHABET, PLAYER_CODE_LENGTH, RECOVERY_AGAIN_MS, RECOVERY_KEEP_MS,
  RECOVERY_MESSAGE_MAX, RECOVERY_NOTE_MAX, RECOVERY_WAIT_MS, showCode, WRONG_CODE,
  type CodePlayer, type RecoveryAnswers, type RecoveryState, type RecoveryStatus,
} from '../shared/codes';
import { dayKey } from '../shared/progression';
import { cleanName, type Profile } from '../shared/protocol';
import { hmac, randomToken, sameText, seal, signToken, unseal } from './auth';
import { getPlayer, toProfile, type PlayerRow } from './db';
import type { Env } from './env';
import { body, fail, json, phoneKey, secretOf } from './http';
import { nameKey } from './names';
import { linkPhone } from './phones';
import { deviceOf } from './safety';
import { bump, STAT } from './stats';

export const codesOn = (env: Pick<Env, 'ENVIRONMENT'>) => env.ENVIRONMENT !== 'production' || CODES_ON_REAL_GAME;

const SLOW = 'Too many tries. Wait a minute, then try again.';
const limited = async (limiter: RateLimit | undefined, key: string) => !!limiter && !(await limiter.limit({ key })).success;

/** A login for a player at their current sign-in version. */
export async function tokenFor(env: Env, id: string) {
  const r = await env.DB.prepare('SELECT login_v FROM players WHERE id = ?').bind(id).first<{ login_v: number }>();
  return signToken(id, secretOf(env), r?.login_v ?? 0);
}

/** 16 characters, every letter equally likely: bytes past the last whole multiple of 31 are thrown away. */
export function newCode() {
  const n = PLAYER_CODE_ALPHABET.length;
  const top = 256 - (256 % n);
  let out = '';
  while (out.length < PLAYER_CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < top && out.length < PLAYER_CODE_LENGTH) out += PLAYER_CODE_ALPHABET[b % n];
    }
  }
  return out;
}

export const codeHashOf = (env: Env, code: string) => hmac(secretOf(env), `pcode:${code}`);

/**
 * Gives a player a new code, which replaces the old one. With `signOut`, the sign-in version goes
 * up too, so every login made before stops working. Returns the code and the new version.
 */
export async function setCode(env: Env, id: string, now: number, signOut = false) {
  const secret = secretOf(env);
  for (let tries = 0; ; tries++) {
    const code = newCode();
    const [hash, box] = await Promise.all([codeHashOf(env, code), seal(secret, code)]);
    try {
      const row = await env.DB
        .prepare('UPDATE players SET code_hash = ?, code_box = ?, code_at = ?, login_v = login_v + ?, updated_at = ? WHERE id = ? RETURNING login_v')
        .bind(hash, box, now, signOut ? 1 : 0, now, id)
        .first<{ login_v: number }>();
      if (!row) return null;
      return { code, v: row.login_v };
    } catch (err) {
      // Two players can't share a code. With 79 bits this never happens, but never is a long time.
      if (tries >= 2 || !String(err).includes('UNIQUE')) throw err;
    }
  }
}

/** The player's code, made now if they don't have one yet. */
async function codeOf(env: Env, id: string, now: number) {
  const row = await env.DB.prepare('SELECT code_box FROM players WHERE id = ?').bind(id).first<{ code_box: string | null }>();
  const code = await unseal(secretOf(env), row?.code_box);
  if (code) return code;
  return (await setCode(env, id, now))?.code ?? null;
}

const codePlayer = (p: Profile): CodePlayer => ({
  id: p.id, name: p.name, avatar: p.avatar, print: p.print, aura: p.aura, cowries: p.cowries, dayStreak: p.dayStreak, state: p.state,
});

/** A countable save from the ask on Home, for the 8 am email. Never stops the save itself. */
const countAskSave = (db: D1Database, now: number) =>
  bump(db, dayKey(now), STAT.savedFromAsk).run().then(() => undefined, (err) => console.error('[stats]', err));

/**
 * What /api/me adds for the player's phones: their code opened them on another phone, or a
 * recovery is waiting to move them. Null when there's nothing to say.
 */
export async function alertsFor(env: Env, me: Profile, phone: string | null) {
  if (!codesOn(env)) return null;
  const r = await env.DB
    .prepare(
      `SELECT p.code_used_at AS usedAt, p.code_used_phone AS usedPhone, r.id AS rid, r.due_at AS due
       FROM players p LEFT JOIN recoveries r ON r.player_id = p.id AND r.state = 'waiting'
       WHERE p.id = ? LIMIT 1`,
    )
    .bind(me.id)
    .first<{ usedAt: number | null; usedPhone: string | null; rid: string | null; due: number | null }>();
  if (!r) return null;
  const out: { codeUse?: number; takeover?: { id: string; due: number } } = {};
  if (r.usedAt && r.usedPhone !== phone) out.codeUse = r.usedAt;
  if (r.rid && r.due) out.takeover = { id: r.rid, due: r.due };
  return out.codeUse || out.takeover ? out : null;
}

/* ---------- the routes: /api/code/* and /api/recovery* ---------- */

/** `me` is the player on the phone that's asking, or null for a phone with no player. */
export async function codeRoute(req: Request, env: Env, url: URL, me: Profile | null): Promise<Response> {
  if (!codesOn(env)) return fail(404, 'not found');
  const path = url.pathname;
  const method = req.method;
  const now = Date.now();
  const db = env.DB;
  const who = me ? `p:${me.id}` : phoneKey(req);

  /* --- your code: shown in the save sheet and Settings, made the first time it's asked for --- */
  if (path === '/api/code' && method === 'POST') {
    if (!me) return fail(401, 'unauthorized');
    const code = await codeOf(env, me.id, now);
    return code ? json({ code: showCode(code) }) : fail(404, 'That player has been deleted.');
  }

  /* --- the player kept their code (Save image, Copy, Share to myself, or I saved it): their progress counts as saved --- */
  if (path === '/api/code/kept' && method === 'POST') {
    if (!me) return fail(401, 'unauthorized');
    const b = await body<{ from: string }>(req);
    const r = await db.prepare('UPDATE players SET saved = 1, updated_at = ? WHERE id = ? AND saved = 0').bind(now, me.id).run();
    if (r.meta.changes && b.from === 'ask') await countAskSave(db, now);
    return json({ profile: (await getPlayer(db, me.id)) ?? me });
  }

  /* --- Get a new code: the old one stops working; other phones stay signed in --- */
  if (path === '/api/code/new' && method === 'POST') {
    if (!me) return fail(401, 'unauthorized');
    const made = await setCode(env, me.id, now);
    return made ? json({ code: showCode(made.code) }) : fail(404, 'That player has been deleted.');
  }

  /* --- Not me: a new code, and every other phone signed out. This phone gets a new login. --- */
  if (path === '/api/code/lock' && method === 'POST') {
    if (!me) return fail(401, 'unauthorized');
    const made = await setCode(env, me.id, now, true);
    if (!made) return fail(404, 'That player has been deleted.');
    // The code was used somewhere else: that's been dealt with, so the notice can go.
    await db.prepare('UPDATE players SET code_used_at = NULL, code_used_phone = NULL WHERE id = ?').bind(me.id).run();
    return json({ code: showCode(made.code), token: await signToken(me.id, secretOf(env), made.v), profile: (await getPlayer(db, me.id)) ?? me });
  }

  /* --- a typed code: whose player is it? Then, after "Play as Tunde?", use it --- */
  if ((path === '/api/code/find' || path === '/api/code/use') && method === 'POST') {
    if (await limited(env.AUTH_LIMITER, `pc:${who}`)) return fail(429, SLOW);
    const b = await body<{ code: string }>(req);
    const code = cleanCode(b.code);
    const row = code ? await db.prepare('SELECT * FROM players WHERE code_hash = ?').bind(await codeHashOf(env, code)).first<PlayerRow>() : null;
    if (!row) return fail(404, WRONG_CODE);
    const profile = toProfile(row);
    if (path === '/api/code/find') return json({ player: codePlayer(profile), same: me?.id === row.id });
    if (me?.id === row.id) return json({ status: 'same', profile });
    const phone = await deviceOf(req, env);
    await db.prepare('UPDATE players SET code_used_at = ?, code_used_phone = ? WHERE id = ?').bind(now, phone, row.id).run();
    await linkPhone(env, row.id, phone, 'signin', now);
    return json({ status: 'signedin', profile, token: await signToken(row.id, secretOf(env), row.login_v ?? 0) });
  }

  /* --- Lost your code? Ask us to help --- */
  if (path === '/api/recovery' && method === 'POST') {
    if (await limited(env.AUTH_LIMITER, `rc:${who}`)) return fail(429, SLOW);
    const phone = await deviceOf(req, env);
    if (!phone) return fail(400, 'Open Dara X&O again, then try again.');
    const answers = readAnswers(await body<RecoveryAnswers>(req));
    if (typeof answers === 'string') return fail(400, answers);
    const target = await db.prepare('SELECT id, name FROM players WHERE name_key = ?').bind(nameKey(answers.name)).first<{ id: string; name: string }>();
    if (!target) return fail(404, 'No player has that name. Check the spelling.');
    if (me?.id === target.id) return fail(409, `You're already playing as ${target.name} on this phone.`);
    const [mine, theirs, refused] = await db.batch<{ n: number; at: number | null }>([
      db.prepare("SELECT COUNT(*) AS n, NULL AS at FROM recoveries WHERE phone = ? AND state IN ('open', 'waiting')").bind(phone),
      db.prepare("SELECT COUNT(*) AS n, NULL AS at FROM recoveries WHERE player_id = ? AND state IN ('open', 'waiting')").bind(target.id),
      db.prepare("SELECT COUNT(*) AS n, MAX(decided_at) AS at FROM recoveries WHERE phone = ? AND player_id = ? AND state = 'refused' AND decided_at > ?")
        .bind(phone, target.id, now - RECOVERY_AGAIN_MS),
    ]);
    if (mine.results[0]?.n) return fail(409, 'This phone already asked. We answer here, so keep this phone.');
    if (theirs.results[0]?.n) return fail(409, `Someone already asked for ${target.name}. We'll look at it soon.`);
    const last = refused.results[0]?.at;
    if (last) return fail(409, `We answered this a few days ago. You can ask again from ${new Date(last + RECOVERY_AGAIN_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })}.`);
    const id = randomToken(9);
    const secret = randomToken();
    await db
      .prepare('INSERT INTO recoveries (id, player_id, phone, secret_hash, answers, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, target.id, phone, await hmac(secretOf(env), `rec:${id}:${secret}`), JSON.stringify(answers), now)
      .run();
    return json({ id, secret, name: target.name });
  }

  /* --- the asking phone checks its request; once the 24 hours are up, it collects the player --- */
  if (path === '/api/recovery' && method === 'GET') {
    if (await limited(env.AUTH_LIMITER, `rs:${who}`)) return fail(429, SLOW);
    const id = url.searchParams.get('id') ?? '';
    const secret = url.searchParams.get('secret') ?? '';
    const row = /^[A-Za-z0-9_-]{8,24}$/.test(id) ? await db.prepare('SELECT * FROM recoveries WHERE id = ?').bind(id).first<RecoveryRow>() : null;
    if (!row || !sameText(row.secret_hash, await hmac(secretOf(env), `rec:${id}:${secret}`))) return fail(404, 'We have no request from this phone any more.');
    const name = (await db.prepare('SELECT name FROM players WHERE id = ?').bind(row.player_id).first<{ name: string }>())?.name ?? '';
    if (row.state === 'waiting' && row.due_at && row.due_at <= now) {
      // One phone collects, once, even if it asks twice at the same moment.
      const claimed = await db.prepare("UPDATE recoveries SET state = 'done' WHERE id = ? AND state = 'waiting' RETURNING id").bind(id).first();
      if (claimed) {
        const made = await setCode(env, row.player_id, now, true);
        if (!made) return json({ status: statusOf({ ...row, state: 'refused', note: 'That player has been deleted.' }, '') });
        await db.prepare('UPDATE players SET code_used_at = NULL, code_used_phone = NULL WHERE id = ?').bind(row.player_id).run();
        await linkPhone(env, row.player_id, row.phone, 'signin', now);
        const profile = await getPlayer(db, row.player_id);
        return json({
          status: statusOf({ ...row, state: 'done' }, profile?.name ?? name),
          code: showCode(made.code),
          token: await signToken(row.player_id, secretOf(env), made.v),
          profile,
        });
      }
    }
    return json({ status: statusOf(row, name) });
  }

  /* --- the real player tapped Stop on the warning --- */
  if (path === '/api/recovery/stop' && method === 'POST') {
    if (!me) return fail(401, 'unauthorized');
    const b = await body<{ id: string }>(req);
    const r = await db
      .prepare("UPDATE recoveries SET state = 'stopped', decided_at = ? WHERE id = ? AND player_id = ? AND state IN ('open', 'waiting')")
      .bind(now, String(b.id ?? ''), me.id)
      .run();
    if (r.meta.changes) {
      await db.prepare("INSERT INTO admin_actions (at, action, player_id, detail) VALUES (?, 'recovery-stopped', ?, ?)").bind(now, me.id, JSON.stringify({ recovery: b.id })).run();
    }
    return json({ stopped: true });
  }

  return fail(404, 'not found');
}

interface RecoveryRow {
  id: string;
  player_id: string;
  phone: string;
  secret_hash: string;
  answers: string;
  state: RecoveryState;
  note: string | null;
  created_at: number;
  decided_at: number | null;
  due_at: number | null;
}

function statusOf(row: Pick<RecoveryRow, 'state' | 'note' | 'due_at' | 'decided_at'>, name: string): RecoveryStatus {
  return {
    state: row.state,
    name,
    note: row.note,
    due: row.state === 'waiting' ? row.due_at : null,
    again: row.state === 'refused' && row.decided_at ? row.decided_at + RECOVERY_AGAIN_MS : null,
  };
}

/** The form, checked. A message for the player if something's missing. */
export function readAnswers(b: Partial<Record<keyof RecoveryAnswers, unknown>>): RecoveryAnswers | string {
  const name = cleanName(b.name);
  if (!name) return "Type your player's name.";
  const seeds = typeof b.seeds === 'number' ? b.seeds : Number(String(b.seeds ?? '').replace(/[,\s]/g, ''));
  if (!Number.isInteger(seeds) || seeds < 0 || seeds > 10_000_000) return 'Type about how many Dara Seeds you had, as a number.';
  const month = Number(b.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'Pick the month you started.';
  const opponent = cleanName(b.opponent);
  if (!opponent) return 'Type the name of someone you played recently.';
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, RECOVERY_MESSAGE_MAX) : '';
  return { name, seeds, month, opponent, message };
}

/* ---------- the admin dashboard's Recovery tab (worker/admin.ts) ---------- */

/** About right: within a quarter, or 500, of what they have. */
export const seedsMatch = (said: number, has: number) => Math.abs(said - has) <= Math.max(500, has * 0.25);
/** The month a player started, 1 to 12, in Lagos time. */
export const monthOf = (ms: number) => Number(new Date(ms).toLocaleString('en-GB', { month: 'numeric', timeZone: 'Africa/Lagos' }));

export async function recoveryList(env: Env, url: URL) {
  const db = env.DB;
  const status = url.searchParams.get('status') ?? 'open';
  const states = status === 'open' ? ['open', 'waiting'] : status === 'all' ? ['open', 'waiting', 'refused', 'stopped', 'done'] : [status];
  const { results } = await db
    .prepare(
      `SELECT r.*, p.name, p.avatar, p.print, p.cowries, p.created_at AS joined, p.banned_at AS bannedAt
       FROM recoveries r LEFT JOIN players p ON p.id = r.player_id
       WHERE r.state IN (${states.map(() => '?').join(',')}) ORDER BY r.created_at ${status === 'open' ? 'ASC' : 'DESC'} LIMIT 100`,
    )
    .bind(...states)
    .all<RecoveryRow & { name: string | null; avatar: string | null; print: string | null; cowries: number | null; joined: number | null; bannedAt: number | null }>();
  const out = [];
  for (const r of results) {
    const a = JSON.parse(r.answers) as RecoveryAnswers;
    const [phone, played] = await db.batch<{ how: string; lastAt: number } & { at: number }>([
      db.prepare('SELECT how, last_at AS lastAt FROM player_phones WHERE player_id = ? AND phone = ?').bind(r.player_id, r.phone),
      db
        .prepare(
          `SELECT m.created_at AS at FROM matches m JOIN players o ON o.id = CASE WHEN m.x_id = ?1 THEN m.o_id ELSE m.x_id END
           WHERE (m.x_id = ?1 OR m.o_id = ?1) AND o.name_key = ?2 ORDER BY m.created_at DESC LIMIT 1`,
        )
        .bind(r.player_id, nameKey(a.opponent)),
    ]);
    const link = phone.results[0] ?? null;
    const lastPlayed = played.results[0]?.at ?? null;
    const checks = {
      phone: link ? { ok: true, how: link.how, lastAt: link.lastAt } : { ok: false },
      seeds: { ok: r.cowries !== null && seedsMatch(a.seeds, r.cowries), said: a.seeds, has: r.cowries },
      month: { ok: r.joined !== null && monthOf(r.joined) === a.month, said: MONTHS[a.month - 1], joined: r.joined },
      opponent: { ok: lastPlayed !== null, said: a.opponent, lastAt: lastPlayed },
    };
    const answersOk = [checks.seeds.ok, checks.month.ok, checks.opponent.ok].filter(Boolean).length;
    out.push({
      id: r.id,
      state: r.state,
      at: r.created_at,
      decidedAt: r.decided_at,
      due: r.due_at,
      note: r.note,
      message: a.message,
      player: r.name ? { id: r.player_id, name: r.name, avatar: r.avatar, print: r.print, banned: !!r.bannedAt } : null,
      checks,
      answersOk,
      // Yves's rule (21 October 2026, to test): the asking phone is linked to the player, or all 3 answers match.
      suggest: checks.phone.ok || answersOk === 3 ? 'give' : 'refuse',
    });
  }
  return { status, recoveries: out };
}

/** Give it back (starts the 24 hours) or refuse, with a note the asking phone shows. */
export async function decideRecovery(env: Env, id: string, action: string, rawNote: unknown, now: number): Promise<{ error: string; status: number } | { ok: true }> {
  const db = env.DB;
  const row = await db.prepare('SELECT * FROM recoveries WHERE id = ?').bind(id).first<RecoveryRow>();
  if (!row) return { error: 'No request with that id.', status: 404 };
  if (row.state !== 'open') return { error: 'That request already has an answer.', status: 409 };
  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, RECOVERY_NOTE_MAX) : '';
  if (action === 'refuse' && note.length < 3) return { error: 'Add a note of 3 to 200 characters. They read it, so write it to them.', status: 400 };
  const give = action === 'give';
  await db.batch([
    db
      .prepare('UPDATE recoveries SET state = ?, note = ?, decided_at = ?, due_at = ? WHERE id = ? AND state = ?')
      .bind(give ? 'waiting' : 'refused', note || null, now, give ? now + RECOVERY_WAIT_MS : null, id, 'open'),
    db
      .prepare('INSERT INTO admin_actions (at, action, player_id, detail) VALUES (?, ?, ?, ?)')
      .bind(now, give ? 'recovery-give' : 'recovery-refuse', row.player_id, JSON.stringify({ recovery: id, note: note || null })),
  ]);
  return { ok: true };
}

/** For the 8 am tidy-up (worker/report.ts): requests 30 days after they're settled, and unanswered ones after 30 days. */
export const tidyRecoveries = (db: D1Database, now: number) =>
  db
    .prepare("DELETE FROM recoveries WHERE (state IN ('refused', 'stopped', 'done') AND decided_at < ?1) OR (state = 'open' AND created_at < ?1)")
    .bind(now - RECOVERY_KEEP_MS);
