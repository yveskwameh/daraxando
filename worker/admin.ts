/**
 * The admin API (docs/ADMIN-API.md): find a player, see their history, rename them, ban and
 * unban them, and add or take Dara Seeds. It's the back end for Yves's admin dashboard, which
 * comes after launch. There is no admin screen in the game.
 *
 * Every call needs the ADMIN_TOKEN secret as a bearer token. While that secret isn't set, the
 * whole API is switched off and answers 404, so a copy of the game without it has no admin at
 * all. Every change is written to admin_actions with what changed and why.
 */
import { cleanName } from '../shared/protocol';
import { cleanEmail } from './accounts';
import { sameText } from './auth';
import { toProfile, type PlayerRow } from './db';
import type { Env } from './env';
import { body } from './http';
import { NAME_PROBLEM_MESSAGE, nameProblem } from './names';
import { dropSubs, sendPush, type PushSub } from './push';
import { buildReport, reportDay, reportEmail, reportTo, sendReport } from './report';
import { dayKey } from '../shared/progression';

/** Shorter than this and the key is too easy to guess, so the API stays off. */
const MIN_TOKEN = 32;
/** The most seeds one adjustment can add or take. */
export const MAX_ADJUST = 1_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Cross-origin headers for the dashboard, only for the addresses listed in ADMIN_ORIGIN. */
function corsFor(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !env.ADMIN_ORIGIN) return {};
  const allowed = env.ADMIN_ORIGIN.split(',').map((s) => s.trim());
  return allowed.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
}

/** Text between `min` and `max` characters, trimmed, or null. */
function text(raw: unknown, min: number, max: number) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().replace(/\s+/g, ' ');
  return t.length >= min && t.length <= max ? t : null;
}

const summary = (r: PlayerRow) => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  state: r.state,
  cowries: r.cowries,
  aura: r.aura,
  rating: r.rating,
  saved: r.saved === 1,
  ban: r.banned_at ? { at: r.banned_at, reason: r.ban_reason ?? '' } : null,
  createdAt: r.created_at,
});

export async function adminRoute(req: Request, env: Env, url: URL): Promise<Response> {
  const cors = corsFor(req, env);
  const send = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors } });
  const fail = (status: number, error: string) => send({ error }, status);

  const key = env.ADMIN_TOKEN ?? '';
  if (key.length < MIN_TOKEN) return fail(404, 'not found');

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600' },
    });
  }

  const ip = req.headers.get('cf-connecting-ip') ?? 'local';
  if (env.PEEK_LIMITER && !(await env.PEEK_LIMITER.limit({ key: `adm:${ip}` })).success) return fail(429, 'Too many requests. Wait a minute.');
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!given || !sameText(given, key)) return fail(401, 'Wrong or missing admin key.');

  const db = env.DB;
  const path = url.pathname;
  const method = req.method;
  const now = Date.now();

  /* --- find players: by id, by email, or by the start of their name --- */
  if (path === '/api/admin/players' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').trim();
    if (!q) return fail(400, 'Add ?q= with a player id, an email address or the start of a name.');
    let rows: PlayerRow[];
    if (UUID.test(q.toLowerCase())) {
      rows = (await db.prepare('SELECT * FROM players WHERE id = ?').bind(q.toLowerCase()).all<PlayerRow>()).results;
    } else if (q.includes('@')) {
      const email = cleanEmail(q);
      if (!email) return fail(400, "That email address doesn't look right.");
      rows = (
        await db
          .prepare('SELECT p.* FROM players p WHERE p.id IN (SELECT player_id FROM identities WHERE email = ?) LIMIT 20')
          .bind(email)
          .all<PlayerRow>()
      ).results;
    } else {
      const start = q.slice(0, 16).replace(/[\\%_]/g, (c) => `\\${c}`);
      rows = (
        await db
          .prepare("SELECT * FROM players WHERE name LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 20")
          .bind(`${start}%`)
          .all<PlayerRow>()
      ).results;
    }
    return send({ players: rows.map(summary) });
  }

  /* --- every change made through this API, newest first --- */
  if (path === '/api/admin/actions' && method === 'GET') {
    const before = Number(url.searchParams.get('before') ?? 0) || Number.MAX_SAFE_INTEGER;
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
    const { results } = await db
      .prepare('SELECT id, at, action, player_id AS playerId, detail FROM admin_actions WHERE id < ? ORDER BY id DESC LIMIT ?')
      .bind(before, limit)
      .all<{ id: number; at: number; action: string; playerId: string | null; detail: string | null }>();
    return send({ actions: results.map((a) => ({ ...a, detail: a.detail ? JSON.parse(a.detail) : null })) });
  }

  /* --- notifications: today's 7 pm streak reminders, started now (for testing), and how the last run went --- */
  if (path === '/api/admin/push/streak') {
    const notifier = env.NOTIFIER.get(env.NOTIFIER.idFromName('streak'));
    if (method === 'GET') return send(await notifier.status());
    if (method === 'POST') return send(await notifier.start(undefined, url.searchParams.get('again') === '1'));
  }

  /* --- game numbers (worker/report.ts): one day's numbers, the morning email, or sending it now --- */
  if (path === '/api/admin/stats' || path === '/api/admin/report') {
    const day = url.searchParams.get('day') ?? reportDay();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || day > dayKey(Date.now())) return fail(400, 'day is a date like 2026-10-16, today or earlier (Lagos time).');
    if (path === '/api/admin/stats' && method === 'GET') return send(await buildReport(env, day));
    if (method === 'GET') {
      const mail = reportEmail(await buildReport(env, day));
      const text = url.searchParams.get('format') === 'text';
      return new Response(text ? `${mail.subject}\n\n${mail.text}` : mail.html, {
        headers: { 'content-type': text ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8', 'cache-control': 'no-store', ...cors },
      });
    }
    if (method === 'POST') {
      if (!reportTo(env).length) return fail(409, 'This copy has no REPORT_EMAIL secret, so there is nobody to send it to.');
      const r = await sendReport(env, { day, force: true });
      return r.sent === 'sent' || r.sent === 'logged' ? send({ sent: true, day: r.day, to: reportTo(env).length }) : fail(502, `The email didn't go (${r.sent}). Check RESEND_API_KEY.`);
    }
  }

  /* --- ban reviews: banned players asking for their ban to be looked at again --- */
  if (path === '/api/admin/appeals' && method === 'GET') {
    const status = url.searchParams.get('status') ?? 'open';
    if (!['open', 'lifted', 'kept', 'all'].includes(status)) return fail(400, 'status is open, lifted, kept or all.');
    const { results } = await db
      .prepare(
        `SELECT a.id, a.player_id AS playerId, a.message, a.created_at AS at, a.status, a.note, a.decided_at AS decidedAt,
                p.name, p.avatar, p.banned_at AS bannedAt, p.ban_reason AS banReason
         FROM appeals a LEFT JOIN players p ON p.id = a.player_id
         WHERE ?1 = 'all' OR a.status = ?1 ORDER BY a.id ${status === 'open' ? 'ASC' : 'DESC'} LIMIT 100`,
      )
      .bind(status)
      .all();
    return send({ appeals: results });
  }

  const review = path.match(/^\/api\/admin\/appeals\/(\d+)\/(lift|keep)$/);
  if (review && method === 'POST') {
    const appeal = await db
      .prepare('SELECT a.id, a.player_id AS playerId, a.status, p.banned_at AS bannedAt, p.ban_reason AS banReason FROM appeals a JOIN players p ON p.id = a.player_id WHERE a.id = ?')
      .bind(Number(review[1]))
      .first<{ id: number; playerId: string; status: string; bannedAt: number | null; banReason: string | null }>();
    if (!appeal) return fail(404, 'No review request with that id.');
    if (appeal.status !== 'open') return fail(409, 'That request already has an answer.');
    const b = await body<{ note: string }>(req);
    const log = (action: string, detail: unknown) =>
      db.prepare('INSERT INTO admin_actions (at, action, player_id, detail) VALUES (?, ?, ?, ?)').bind(now, action, appeal.playerId, JSON.stringify(detail));
    if (review[2] === 'keep') {
      // The player reads this, so write it to them.
      const note = text(b.note, 3, 300);
      if (!note) return fail(400, 'Add a note of 3 to 300 characters. The player sees it, so write it to them.');
      await db.batch([
        db.prepare("UPDATE appeals SET status = 'kept', note = ?, decided_at = ? WHERE id = ?").bind(note, now, appeal.id),
        log('appeal-keep', { appeal: appeal.id, note }),
      ]);
    } else {
      const note = text(b.note, 0, 300) || null;
      await db.batch([
        db.prepare("UPDATE appeals SET status = 'lifted', note = ?, decided_at = ? WHERE id = ?").bind(note, now, appeal.id),
        db.prepare('UPDATE players SET banned_at = NULL, ban_reason = NULL, updated_at = ? WHERE id = ?').bind(now, appeal.playerId),
        log('appeal-lift', { appeal: appeal.id, note, was: appeal.bannedAt ? { at: appeal.bannedAt, reason: appeal.banReason } : null }),
      ]);
    }
    const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(appeal.playerId).first<PlayerRow>();
    return send({ player: row ? summary(row) : null });
  }

  const one = path.match(/^\/api\/admin\/players\/([0-9a-f-]{36})(?:\/(rename|ban|unban|seeds|push))?$/);
  if (!one) return fail(404, 'not found');
  const id = one[1];
  const act = one[2];
  const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<PlayerRow>();
  if (!row) return fail(404, 'No player with that id.');

  /* --- one player: profile, sign-in methods, seeds history, matches, same phone, admin changes --- */
  if (!act && method === 'GET') {
    const [identities, ledger, matches, samePhone, actions, appeals] = await db.batch<Record<string, unknown>>([
      db.prepare('SELECT provider, email, created_at AS createdAt FROM identities WHERE player_id = ? ORDER BY created_at').bind(id),
      db.prepare('SELECT delta, reason, match_id AS matchId, created_at AS at FROM ledger WHERE player_id = ? ORDER BY id DESC LIMIT 50').bind(id),
      db
        .prepare(
          `SELECT m.id, m.mode, m.kind, m.stake, m.winner, m.reason, m.score, m.paid, m.created_at AS at, m.x_id AS xId, m.o_id AS oId,
                  px.name AS xName, po.name AS oName
           FROM matches m LEFT JOIN players px ON px.id = m.x_id LEFT JOIN players po ON po.id = m.o_id
           WHERE m.x_id = ?1 OR m.o_id = ?1 ORDER BY m.created_at DESC LIMIT 20`,
        )
        .bind(id),
      row.device
        ? db.prepare('SELECT id, name FROM players WHERE device = ? AND id != ? LIMIT 20').bind(row.device, id)
        : db.prepare('SELECT id, name FROM players WHERE 0'),
      db.prepare('SELECT id, at, action, detail FROM admin_actions WHERE player_id = ? ORDER BY id DESC LIMIT 50').bind(id),
      db.prepare('SELECT id, message, created_at AS at, status, note, decided_at AS decidedAt FROM appeals WHERE player_id = ? ORDER BY id DESC LIMIT 20').bind(id),
    ]);
    type M = { id: string; mode: string; kind: string; stake: number; winner: string | null; reason: string; score: string; paid: number; at: number; xId: string; oId: string; xName: string | null; oName: string | null };
    return send({
      profile: toProfile(row),
      identities: identities.results,
      ledger: ledger.results,
      matches: (matches.results as M[]).map((m) => {
        const mark = m.xId === id ? 'X' : 'O';
        return {
          id: m.id,
          mode: m.mode,
          kind: m.kind,
          stake: m.stake,
          paid: m.paid === 1,
          reason: m.reason,
          score: m.score,
          at: m.at,
          result: m.winner === null ? 'draw' : m.winner === mark ? 'win' : 'loss',
          opponent: mark === 'X' ? { id: m.oId, name: m.oName } : { id: m.xId, name: m.xName },
        };
      }),
      samePhone: samePhone.results,
      appeals: appeals.results,
      actions: (actions.results as { detail: string | null }[]).map((a) => ({ ...a, detail: a.detail ? JSON.parse(a.detail) : null })),
    });
  }

  if (method !== 'POST' || !act) return fail(404, 'not found');
  const b = await body<{ name: string; reason: string; amount: number }>(req);
  const log = (action: string, detail: unknown) =>
    db.prepare('INSERT INTO admin_actions (at, action, player_id, detail) VALUES (?, ?, ?, ?)').bind(now, action, id, JSON.stringify(detail));
  const fresh = () => db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<PlayerRow>();

  /* --- rename: the same rules as the game, so a new name can't be rude either --- */
  if (act === 'rename') {
    const name = cleanName(b.name);
    if (!name) return fail(400, 'Names are 2 to 16 letters or numbers.');
    const problem = nameProblem(name);
    if (problem) return fail(400, NAME_PROBLEM_MESSAGE[problem]);
    await db.batch([
      db.prepare('UPDATE players SET name = ?, updated_at = ? WHERE id = ?').bind(name, now, id),
      log('rename', { from: row.name, to: name }),
    ]);
    return send({ player: summary((await fresh())!) });
  }

  /* --- ban: no play against people, no Ranks or leagues. The reason is shown to the player. --- */
  if (act === 'ban') {
    const reason = text(b.reason, 3, 200);
    if (!reason) return fail(400, 'Add a reason of 3 to 200 characters. The player sees it, so write it to them.');
    await db.batch([
      db.prepare('UPDATE players SET banned_at = ?, ban_reason = ?, updated_at = ? WHERE id = ?').bind(now, reason, now, id),
      log('ban', { reason, before: row.banned_at ? { at: row.banned_at, reason: row.ban_reason } : null }),
    ]);
    return send({ player: summary((await fresh())!) });
  }

  if (act === 'unban') {
    if (!row.banned_at) return fail(409, "That player isn't banned.");
    await db.batch([
      db.prepare('UPDATE players SET banned_at = NULL, ban_reason = NULL, updated_at = ? WHERE id = ?').bind(now, id),
      // An open review request is answered by the ban being lifted.
      db.prepare("UPDATE appeals SET status = 'lifted', decided_at = ? WHERE player_id = ? AND status = 'open'").bind(now, id),
      log('unban', { was: { at: row.banned_at, reason: row.ban_reason } }),
    ]);
    return send({ player: summary((await fresh())!) });
  }

  /* --- a test notification to every phone where this player turned notifications on --- */
  if (act === 'push') {
    const text = (b as { body?: unknown }).body;
    const note = { title: 'Dara X&O', body: typeof text === 'string' && text.trim() ? text.trim().slice(0, 140) : 'A test notification from Dara X&O.', url: '/', tag: 'test' };
    const { results } = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE player_id = ?').bind(id).all<PushSub>();
    const sent = await Promise.all(results.map(async (s) => [s.endpoint, await sendPush(env, s, note, 3600)] as const));
    await dropSubs(db, sent.filter(([, r]) => r === 'gone').map(([e]) => e));
    return send({ phones: results.length, sent: sent.filter(([, r]) => r === 'ok').length, gone: sent.filter(([, r]) => r === 'gone').length });
  }

  /* --- add or take seeds, for fixing mistakes. Never below 0, and always with a reason. --- */
  if (act === 'seeds') {
    const amount = b.amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_ADJUST) {
      return fail(400, `The amount is a whole number from -${MAX_ADJUST.toLocaleString('en-US')} to ${MAX_ADJUST.toLocaleString('en-US')}, and not 0.`);
    }
    const reason = text(b.reason, 3, 200);
    if (!reason) return fail(400, 'Add a reason of 3 to 200 characters.');
    // The ledger line and the log go first, on the same check, so all three happen or none do.
    const results = await db.batch<Record<string, unknown>>([
      db
        .prepare("INSERT INTO ledger (player_id, delta, reason, match_id, created_at) SELECT id, ?1, 'admin', NULL, ?2 FROM players WHERE id = ?3 AND cowries + ?1 >= 0")
        .bind(amount, now, id),
      db
        .prepare(
          "INSERT INTO admin_actions (at, action, player_id, detail) SELECT ?1, 'seeds', id, json_object('amount', ?2, 'reason', ?3, 'before', cowries) FROM players WHERE id = ?4 AND cowries + ?2 >= 0",
        )
        .bind(now, amount, reason, id),
      db.prepare('UPDATE players SET cowries = cowries + ?1, updated_at = ?2 WHERE id = ?3 AND cowries + ?1 >= 0 RETURNING id').bind(amount, now, id),
    ]);
    if (!results[2].results?.length) return fail(409, `That would take them below 0. They have ${row.cowries.toLocaleString('en-US')}.`);
    return send({ player: summary((await fresh())!) });
  }

  return fail(404, 'not found');
}
