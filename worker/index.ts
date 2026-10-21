/**
 * The Worker. Static files (the React app) are served by Cloudflare before this runs, so
 * only /api/* reaches it. Everything here is small: check who you are, then hand you to
 * the right Durable Object or answer from D1.
 */
import { isBotLevel, type BotLevel } from '../shared/bot';
import { AVATARS, isOpen, PIECES, PRINTS } from '../shared/collections';
import { DEFAULT_MODE, isModeId, type ModeId } from '../shared/modes';
import { isStateCode, zoneOf } from '../shared/places';
import { dayKey } from '../shared/progression';
import { TERMS_VERSION } from '../shared/legal';
import {
  CLOSE, CODE_ALPHABET, CODE_LENGTH, cleanName, isMatchId, NAME_RULE, isRoomCode, type LiveGame, type Profile, type PublicPlayer,
} from '../shared/protocol';
import { fmt, isFriendTable, isTable, sapaReady, tableLock } from '../shared/stakes';
import { accountOf, authRoute, deleteAccount } from './accounts';
import { fromB64url, signToken, tokenFrom, verifyToken } from './auth';
import { claimSapa, createPlayer, getPlayer, leaderboard, rankOf, toPublic, updatePlayer, type ProfilePatch } from './db';
import type { Env } from './env';
import { body, fail, json, secretOf } from './http';
import { askFriend, buyFreeze, dropFriend, friendsOf, leagueFor, placeBet, restore } from './habits';
import { randomId } from './matchmaker';
import { adminRoute } from './admin';
import { offlineRoute } from './offline';
import { pushEndpointOk, pushReady, sendPush } from './push';
import { freeNames, isNameClash, NAME_PROBLEM_MESSAGE, NAME_TAKEN_MESSAGE, nameKey, nameProblem, takenNames } from './names';
import { appealOf, askReview, BANNED_MESSAGE, deviceOf, isBanned } from './safety';
import { bump, isPushFrom, STAT } from './stats';
import { REPORT_CRON, sendReport } from './report';
import { linkPhone, phoneFull, PHONE_FULL } from './phones';
import { alertsFor, codeRoute } from './codes';
import { controlsOf, switchOn } from './controls';
import { isTourEvent, offLine } from '../shared/controls';

export { Match } from './match';
export { Matchmaker } from './matchmaker';
export { Notifier } from './notifier';

const roomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
};

async function playerFrom(req: Request, url: URL, env: Env) {
  const login = await verifyToken(tokenFrom(req, url), secretOf(env));
  return login ? getPlayer(env.DB, login.id, login.v) : null;
}

/** A websocket that says why it is closing, then closes. Plain HTTP errors look like a dropped line to a browser. */
function socketError(code: number, error: string, message = error) {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.send(JSON.stringify({ t: 'error', code: error, message }));
  server.close(code, error);
  return new Response(null, { status: 101, webSocket: client });
}

/** Passes the websocket to a Durable Object with the player attached by us, never by the browser. */
function forward(req: Request, stub: { fetch(r: Request): Promise<Response> }, player: PublicPlayer, extra: Record<string, string> = {}) {
  const headers = new Headers(req.headers);
  // Only we set these, never whoever is calling.
  for (const k of ['x-player', 'x-queue', 'x-watch']) headers.delete(k);
  headers.set('x-player', JSON.stringify(player));
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return stub.fetch(new Request(req.url, { method: 'GET', headers }));
}

/** "That name is taken", with three names nobody has. */
async function taken(db: D1Database, name: string, exceptId?: string) {
  return json({ error: NAME_TAKEN_MESSAGE, ideas: await freeNames(db, 3, { wanted: name, exceptId }) }, 409);
}

/** Checks a profile change against the player's level. Returns an error message, or the clean patch. */
function checkPatch(me: Profile | null, b: Partial<Record<keyof ProfilePatch, unknown>>): string | ProfilePatch {
  const level = me?.level ?? 1;
  const patch: ProfilePatch = {};
  if (b.name !== undefined) {
    const name = cleanName(b.name);
    if (!name) return NAME_RULE;
    const problem = nameProblem(name);
    if (problem) return NAME_PROBLEM_MESSAGE[problem];
    patch.name = name;
  }
  if (b.avatar !== undefined) {
    if (!isOpen(AVATARS, b.avatar, level)) return 'That avatar is still locked.';
    patch.avatar = b.avatar as string;
  }
  if (b.piece !== undefined) {
    if (!isOpen(PIECES, b.piece, level)) return 'That piece is still locked.';
    patch.piece = b.piece as string;
  }
  if (b.print !== undefined) {
    if (!isOpen(PRINTS, b.print, level)) return 'That print is still locked.';
    patch.print = b.print as string;
  }
  if (b.state !== undefined) {
    if (!isStateCode(b.state)) return 'Pick a state from the list.';
    patch.state = b.state;
  }
  return patch;
}

async function route(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = req.method;

  /* --- new guest player --- */
  if (path === '/api/session' && method === 'POST') {
    // Per device first: most players share an IP with their whole mobile network.
    const device = (req.headers.get('x-device') ?? '').slice(0, 64) || 'none';
    const ip = req.headers.get('cf-connecting-ip') ?? 'local';
    const phone = await deviceOf(req, env);
    if (env.DEVICE_LIMITER && !(await env.DEVICE_LIMITER.limit({ key: `d:${device}` })).success) {
      return fail(429, 'Too many new players from this phone. Wait a minute.');
    }
    if (env.IP_LIMITER && !(await env.IP_LIMITER.limit({ key: `ip:${ip}` })).success) {
      return fail(429, 'Lots of new players on your network. Wait a minute.');
    }
    const b = await body<{ name: string; avatar: string; state: string; age: boolean; terms: string; auto: boolean }>(req);
    if (b.age !== true) return fail(400, 'Dara X&O is for players aged 13 and up.');
    // New players turned off in the dashboard's Controls (worker/controls.ts).
    if (!(await switchOn(env, 'newPlayers'))) return fail(503, offLine('newPlayers'));
    // Two new players a phone in 30 days (worker/phones.ts). The first screen offers Sign in instead.
    if (await phoneFull(env, phone, Date.now())) return fail(403, PHONE_FULL);
    // Tapping Play now accepts the terms on screen, and that version is kept as the record.
    if (b.terms !== TERMS_VERSION) return fail(409, 'The terms have changed. Close the app, open it again, then tap Play now.');
    const checked = checkPatch(null, { name: b.name, avatar: b.avatar, state: b.state });
    if (typeof checked === 'string') return fail(400, checked);
    if (!checked.name || !checked.avatar || !checked.state) return fail(400, 'Pick a name, an avatar and your state.');
    // Names are unique, and the first screen stays one tap: a taken name gets a number ("Durbar
    // Queen 7") instead of an error. The game's own pick (`auto`) is asked about after the first
    // match; a name they typed is theirs, unless it had to get a number, and then Home asks too.
    let name = checked.name;
    let nameSet: 0 | 1 | 2 = b.auto === true ? 0 : 1;
    for (let tries = 0; ; tries++) {
      if ((await takenNames(env.DB, [name])).size) {
        name = (await freeNames(env.DB, 1, { wanted: checked.name }))[0] ?? name;
        if (nameSet === 1) nameSet = 2;
      }
      try {
        const profile = await createPlayer(env.DB, { name, nameSet, avatar: checked.avatar, state: checked.state as Profile['state'], device: phone, terms: TERMS_VERSION });
        return json({ token: await signToken(profile.id, secretOf(env)), profile });
      } catch (err) {
        // Someone took it in the same moment.
        if (!isNameClash(err) || tries >= 2) throw err;
      }
    }
  }

  /* --- Ranks (cached at the edge for 20 seconds, then personalised) --- */
  if (path === '/api/leaderboard' && method === 'GET') {
    const scope = url.searchParams.get('state');
    const state = scope && isStateCode(scope) && scope !== 'OUT' && scope !== 'NONE' ? scope : null;
    const top = await cachedTop(env, url, state);
    const me = await playerFrom(req, url, env);
    // A banned player isn't on the list, but sees where they'd be ("outside").
    const mine = me && me.quickGames > 0 && (!state || me.state === state)
      ? { rank: await rankOf(env.DB, me.rating, state), ...(isBanned(me) ? { outside: true as const } : {}) }
      : null;
    return json({ top, me: mine });
  }

  /* --- a guess at the player's state, to pre-select it at sign-up. Nothing is stored. --- */
  if (path === '/api/where' && method === 'GET') {
    const cf = req.cf as { country?: string; regionCode?: string } | undefined;
    const guess = cf?.country === 'NG' ? (isStateCode(cf.regionCode) ? cf.regionCode : null) : cf?.country ? 'OUT' : null;
    return json({ state: guess });
  }

  /* --- is it up? For checks after a deploy. No player needed. --- */
  // `signIn` says whether each sign-in secret is set on this copy (never the values), so a missing one is easy to spot.
  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true, env: env.ENVIRONMENT ?? 'local', signIn: { google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), email: !!env.RESEND_API_KEY }, push: pushReady(env) });
  }

  /* --- an error on a player's phone, so bugs on real phones show up in the logs --- */
  if (path === '/api/log' && method === 'POST') {
    const ip = req.headers.get('cf-connecting-ip') ?? 'local';
    if (env.PEEK_LIMITER && !(await env.PEEK_LIMITER.limit({ key: `log:${ip}` })).success) return new Response(null, { status: 204 });
    const text = (await req.text().catch(() => '')).slice(0, 2000);
    console.error('[phone]', env.ENVIRONMENT ?? 'local', text);
    return new Response(null, { status: 204 });
  }

  /* --- peek at a friend room before joining: who is hosting, and the stake --- */
  const peekMatch = path.match(/^\/api\/rooms\/([A-Za-z0-9]+)$/);
  if (peekMatch && method === 'GET') {
    const ip = req.headers.get('cf-connecting-ip') ?? 'local';
    if (env.PEEK_LIMITER && !(await env.PEEK_LIMITER.limit({ key: `peek:${ip}` })).success) {
      return fail(429, 'Too many codes tried. Wait a minute, then try again.');
    }
    const code = peekMatch[1].toUpperCase();
    if (!isRoomCode(code)) return fail(404, 'That code is not right. Check it with your friend.');
    if (!(await switchOn(env, 'friends'))) return fail(503, offLine('friends'));
    const room = await env.MATCH.get(env.MATCH.idFromName(code)).peek();
    if (!room) return fail(404, 'No room with that code. Check it with your friend.');
    return json({ code, ...room });
  }

  /* --- the admin API (worker/admin.ts, docs/ADMIN-API.md). Its own key, never a player token. --- */
  if (path.startsWith('/api/admin/') || path === '/api/admin') return adminRoute(req, env, url);

  /* --- save your progress and sign in (worker/accounts.ts). The phone may not have a player yet. --- */
  if (path.startsWith('/api/auth/')) return authRoute(req, env, url, tokenFrom(req, url) ? await playerFrom(req, url, env) : null);

  /* --- player codes and "Lost your code?" (worker/codes.ts). The phone may not have a player yet. --- */
  if (path === '/api/code' || path.startsWith('/api/code/') || path === '/api/recovery' || path.startsWith('/api/recovery/')) {
    if (!(await switchOn(env, 'codes'))) return fail(503, offLine('codes'));
    return codeRoute(req, env, url, tokenFrom(req, url) ? await playerFrom(req, url, env) : null);
  }

  /* --- the public notification key: not secret, so no login needed (phones ask for it before subscribing) --- */
  if (path === '/api/push' && method === 'GET') return json({ key: pushReady(env) ? env.VAPID_PUBLIC_KEY : null });

  const isSocket = req.headers.get('Upgrade') === 'websocket';
  const me = await playerFrom(req, url, env);
  if (!me) return isSocket ? socketError(CLOSE.unauthorized, 'unauthorized') : fail(401, 'unauthorized');
  const now = Date.now();
  if (method !== 'GET' && !isSocket && env.ACTION_LIMITER && !(await env.ACTION_LIMITER.limit({ key: `a:${me.id}` })).success) {
    return fail(429, 'Slow down a little. Try again in a minute.');
  }

  /* --- your profile --- */
  if (path === '/api/me' && method === 'GET') {
    // The app asks for this when it opens: link the player to this phone (worker/phones.ts).
    const phone = await deviceOf(req, env);
    await linkPhone(env, me.id, phone, 'seen', now);
    // Their code opened them on another phone, or a recovery is waiting (worker/codes.ts).
    const alerts = await alertsFor(env, me, phone);
    // Switches that are off and the announcement on Home (worker/controls.ts), cached 30 seconds.
    const controls = await controlsOf(env, now);
    return json({ profile: me, controls, ...(alerts ? { alerts } : {}) });
  }

  /* --- the new-player walkthrough: counted for the 8 am email, never kept per player (docs/WALKTHROUGH.md) --- */
  if (path === '/api/tour' && method === 'POST') {
    const e = (await body<{ e: string }>(req)).e;
    if (!isTourEvent(e)) return fail(400, 'Unknown tour event.');
    await bump(env.DB, dayKey(now), STAT.tour(e)).run();
    return new Response(null, { status: 204 });
  }

  /* --- accepting new terms (shared/legal.ts): the version on screen, and when, as the record --- */
  if (path === '/api/terms' && method === 'POST') {
    const b = await body<{ version: string }>(req);
    if (b.version !== TERMS_VERSION) return fail(409, 'The terms have changed again. Close the app, open it again, then accept.');
    await env.DB.prepare('UPDATE players SET terms_version = ?, terms_at = ?, updated_at = ? WHERE id = ?').bind(TERMS_VERSION, now, now, me.id).run();
    return json({ profile: (await getPlayer(env.DB, me.id)) ?? me });
  }

  /* --- playing Baba Ayo without internet: passes, and the games played with them (worker/offline.ts) --- */
  if (path.startsWith('/api/offline/') && method === 'POST') return offlineRoute(req, env, path, me, now);

  /* --- how you're saved (Settings), and deleting your account --- */
  if (path === '/api/account' && method === 'GET') return json(await accountOf(env.DB, me.id));
  if (path === '/api/me' && method === 'DELETE') {
    await deleteAccount(env.DB, me.id);
    return json({ deleted: true });
  }

  if (path === '/api/me' && method === 'PATCH') {
    const checked = checkPatch(me, await body<ProfilePatch>(req));
    if (typeof checked === 'string') return fail(400, checked);
    if (checked.name && (await takenNames(env.DB, [checked.name], me.id)).size) return taken(env.DB, checked.name, me.id);
    try {
      return json({ profile: await updatePlayer(env.DB, me.id, checked) });
    } catch (err) {
      if (checked.name && isNameClash(err)) return taken(env.DB, checked.name, me.id);
      throw err;
    }
  }

  /* --- names: is this one free, and some free ideas (the name editor checks as you type) --- */
  if (path === '/api/names' && method === 'GET') {
    if (env.PEEK_LIMITER && !(await env.PEEK_LIMITER.limit({ key: `name:${me.id}` })).success) return fail(429, 'Slow down a little, then try again.');
    const raw = url.searchParams.get('check');
    if (raw === null) return json({ ideas: await freeNames(env.DB, 4, { exceptId: me.id }) });
    const name = cleanName(raw);
    if (!name) return json({ ok: false, message: NAME_RULE });
    const problem = nameProblem(name);
    if (problem) return json({ ok: false, message: NAME_PROBLEM_MESSAGE[problem] });
    if (nameKey(name) !== nameKey(me.name) && (await takenNames(env.DB, [name], me.id)).size) {
      return json({ ok: false, message: NAME_TAKEN_MESSAGE, ideas: await freeNames(env.DB, 3, { wanted: name, exceptId: me.id }) });
    }
    return json({ ok: true });
  }

  /* --- a banned player asking for a ban review, and seeing the answer --- */
  if (path === '/api/appeal' && method === 'GET') {
    if (!me.ban) return fail(409, "Your account isn't banned.");
    return json(await appealOf(env.DB, me.id, me.ban.at));
  }
  if (path === '/api/appeal' && method === 'POST') {
    const r = await askReview(env.DB, me, (await body<{ message: string }>(req)).message, now);
    return typeof r === 'string' ? fail(409, r) : json(r);
  }

  /* --- notifications on this phone (worker/push.ts, shared/notify.ts) --- */
  if (path === '/api/push' && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
    if (!pushReady(env)) return fail(503, "Notifications aren't set up here yet.");
    const b = await body<{ endpoint: string; keys: { p256dh: string; auth: string }; streak: boolean; friends: boolean; news?: boolean; from?: string }>(req);
    if (!pushEndpointOk(b.endpoint, env)) return fail(400, "This phone's notification address isn't one we know.");
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ? AND player_id = ?').bind(b.endpoint, me.id).run();
      return json({ on: false });
    }
    const streak = b.streak === true ? 1 : 0;
    const friends = b.friends === true ? 1 : 0;
    // News from Dara X&O (docs/NEWS-REVIEW.md): off unless the player turns it on.
    const news = b.news === true ? 1 : 0;
    if (method === 'PATCH') {
      const r = await env.DB.prepare('UPDATE push_subs SET streak = ?, friends = ?, news = ? WHERE endpoint = ? AND player_id = ?').bind(streak, friends, news, b.endpoint, me.id).run();
      if (!r.meta.changes) return fail(404, 'Turn notifications on again.');
      return json({ on: true });
    }
    const p256dh = fromB64url(b.keys?.p256dh ?? '');
    const auth = fromB64url(b.keys?.auth ?? '');
    if (!p256dh || p256dh.length !== 65 || !auth || auth.length !== 16) return fail(400, "This phone's notification keys don't look right.");
    // One row per phone. A phone that switched players moves to the new one.
    const fresh = !(await env.DB.prepare('SELECT 1 FROM push_subs WHERE endpoint = ? AND player_id = ?').bind(b.endpoint, me.id).first());
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO push_subs (endpoint, player_id, p256dh, auth, streak, friends, news, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?8, ?7)
         ON CONFLICT (endpoint) DO UPDATE SET player_id = ?2, p256dh = ?3, auth = ?4, streak = ?5, friends = ?6, news = ?8`,
      ).bind(b.endpoint, me.id, b.keys!.p256dh, b.keys!.auth, streak, friends, now, news),
      // At most 5 phones per player: the oldest goes.
      env.DB.prepare(
        'DELETE FROM push_subs WHERE player_id = ?1 AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE player_id = ?1 ORDER BY created_at DESC LIMIT 5)',
      ).bind(me.id),
      // Where they said yes, for the 8 am email: the phone only sends it when this turns something on.
      ...(isPushFrom(b.from) && (streak || friends || news) ? [bump(env.DB, dayKey(now), STAT.pushOn(b.from))] : []),
    ]);
    // A first message straight away, so the player sees that it works.
    if (fresh) {
      await sendPush(env, { endpoint: b.endpoint, p256dh: b.keys!.p256dh, auth: b.keys!.auth }, {
        title: 'Dara X&O', body: "Notifications are on. You can change them in You, then Settings.", url: '/you', tag: 'welcome',
      }, 3600);
    }
    return json({ on: true });
  }

  /* --- Sapa relief: a free top-up when you're nearly out --- */
  if (path === '/api/wallet/sapa' && method === 'POST') {
    if (!sapaReady(me.cowries, me.sapaAt, now)) return fail(409, 'Free top-ups are for balances under 500, once every 4 hours.');
    const profile = await claimSapa(env.DB, me.id, now);
    return profile ? json({ profile }) : fail(409, 'Free top-ups are for balances under 500, once every 4 hours.');
  }

  /* --- play a friend: make a room with a short code --- */
  if (path === '/api/rooms' && method === 'POST') {
    if (isBanned(me)) return fail(403, BANNED_MESSAGE);
    if (!(await switchOn(env, 'friends', now))) return fail(503, offLine('friends'));
    const b = await body<{ mode: ModeId; stake: number }>(req);
    const mode = isModeId(b.mode) ? b.mode : DEFAULT_MODE;
    // Stakes turned off in Controls: every new room is free.
    const stake = isFriendTable(b.stake) && (await switchOn(env, 'stakes', now)) ? b.stake : 0;
    if (stake > me.cowries) return fail(400, `You need ${fmt(stake)} Dara Seeds for that stake.`);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = roomCode();
      const stub = env.MATCH.get(env.MATCH.idFromName(code));
      if ((await stub.init({ id: code, kind: 'friend', mode, stake, players: [toPublic(me)] })).ok) {
        await bump(env.DB, dayKey(now), STAT.roomMade).run().catch((err) => console.error('[stats]', err));
        return json({ matchId: code });
      }
    }
    return fail(503, 'Could not make a room. Try again.');
  }

  /* --- change the stake while waiting for your friend --- */
  if (peekMatch && method === 'PATCH') {
    const code = peekMatch[1].toUpperCase();
    const b = await body<{ stake: number }>(req);
    if (!isRoomCode(code) || !isFriendTable(b.stake)) return fail(400, 'Friend rooms stake up to 1,000.');
    if (b.stake > 0 && !(await switchOn(env, 'stakes', now))) return fail(503, offLine('stakes'));
    if (b.stake > me.cowries) return fail(400, `You need ${fmt(b.stake)} Dara Seeds for that stake.`);
    const ok = await env.MATCH.get(env.MATCH.idFromName(code)).setStake(me.id, b.stake);
    return ok ? json({ stake: b.stake }) : fail(409, 'Your friend already joined, so the stake is set.');
  }

  /* --- close your friend room before it starts --- */
  if (peekMatch && method === 'DELETE') {
    const code = peekMatch[1].toUpperCase();
    if (!isRoomCode(code)) return fail(404, 'No room with that code.');
    const ok = await env.MATCH.get(env.MATCH.idFromName(code)).cancel(me.id);
    return ok ? json({ closed: true }) : fail(409, 'That room has already started or closed.');
  }

  /* --- the host watching their friend room from elsewhere in the app --- */
  const watch = path.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/watch$/);
  if (watch && isSocket) {
    const code = watch[1].toUpperCase();
    if (!isRoomCode(code)) return socketError(CLOSE.notFound, 'not-found');
    return forward(req, env.MATCH.get(env.MATCH.idFromName(code)), toPublic(me), { 'x-watch': '1' });
  }

  /* --- the streak: Streak Freeze, restore, streak stake --- */
  if (method === 'POST' && (path === '/api/streak/freeze' || path === '/api/streak/restore' || path === '/api/streak/bet')) {
    const act = path.endsWith('freeze') ? buyFreeze : path.endsWith('restore') ? restore : placeBet;
    const r = await act(env.DB, me.id, now);
    if (!r.ok) return fail(409, r.error);
    return json({ profile: await getPlayer(env.DB, me.id) });
  }

  /* --- weekly league --- */
  if (path === '/api/league' && method === 'GET') return json(await leagueFor(env.DB, me.id, now, isBanned(me)));

  /* --- friend streaks --- */
  if (path === '/api/friends' && method === 'GET') return json(await friendsOf(env.DB, me.id, now));
  const friend = path.match(/^\/api\/friends\/([0-9a-f-]{36})$/);
  if (friend && method === 'POST') {
    if (isBanned(me)) return fail(403, BANNED_MESSAGE);
    const r = await askFriend(env.DB, me.id, friend[1], now);
    return r.ok ? json(await friendsOf(env.DB, me.id, now)) : fail(409, r.error);
  }
  if (friend && method === 'DELETE') {
    await dropFriend(env.DB, me.id, friend[1]);
    return json(await friendsOf(env.DB, me.id, now));
  }

  /* --- play Baba Ayo --- */
  if (path === '/api/bot' && method === 'POST') {
    const b = await body<{ mode: ModeId; level: BotLevel; first?: boolean }>(req);
    const level: BotLevel = isBotLevel(b.level) ? b.level : 'sharp';
    const mode = isModeId(b.mode) ? b.mode : DEFAULT_MODE;
    // The one-game first match is only for players who haven't finished a match yet.
    const first = !!b.first && me.wins + me.losses + me.draws === 0;
    const matchId = randomId();
    const stub = env.MATCH.get(env.MATCH.idFromName(matchId));
    await stub.init({ id: matchId, kind: 'bot', mode, level, first, stake: 0, players: [toPublic(me)] });
    return json({ matchId });
  }

  /* --- quick match queue --- */
  if (path === '/api/lobby' && isSocket) {
    if (isBanned(me)) return socketError(CLOSE.banned, 'banned', BANNED_MESSAGE);
    const mode = url.searchParams.get('mode');
    const stake = Number(url.searchParams.get('stake') ?? 0);
    if (!isModeId(mode) || !isTable(stake)) return socketError(CLOSE.notFound, 'not-found', 'Pick a mode and a stake.');
    const controls = await controlsOf(env, now);
    if (controls.off.includes('quick')) return socketError(CLOSE.notFound, 'resting', offLine('quick'));
    if (stake > 0 && controls.off.includes('stakes')) return socketError(CLOSE.stake, 'resting', offLine('stakes'));
    const locked = tableLock(stake, me, now);
    if (locked) return socketError(CLOSE.stake, 'table-locked', `${locked}.`);
    // wide: they joined this table because someone was already waiting, so distance doesn't matter.
    const wide = url.searchParams.get('wide') === '1';
    // target: joining one waiting player's game from Quick match.
    const target = url.searchParams.get('target') ?? '';
    if (target && !/^[A-Za-z0-9_-]{4,64}$/.test(target)) return socketError(CLOSE.notFound, 'not-found', 'That game is gone.');
    return forward(req, env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global')), toPublic(me), {
      'x-queue': JSON.stringify({ mode, stake, wide, target: target || undefined }),
    });
  }

  /* --- watching the live games from Home: one socket, the server pushes changes --- */
  if (path === '/api/live/watch' && isSocket) {
    // 4000 and up tells the app not to try again (src/lib/useLive.ts).
    if (isBanned(me)) return socketError(CLOSE.banned, 'banned', BANNED_MESSAGE);
    // Quick match turned off in Controls: the phone stops watching (4000 and up) until it's back on Home.
    if (!(await switchOn(env, 'quick', now))) return socketError(CLOSE.notFound, 'resting', offLine('quick'));
    const check = { level: me.level, cowries: me.cowries, createdAt: me.createdAt, coolUntil: me.coolUntil };
    return forward(req, env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global')), toPublic(me), { 'x-watch': JSON.stringify({ check }) });
  }

  /* --- live games for Quick match, as one request: the ones you can join, nearest and longest waiting first --- */
  if (path === '/api/live' && method === 'GET') {
    if (isBanned(me)) return json({ games: [], n: 0, looking: 0 });
    const controls = await controlsOf(env, now);
    if (controls.off.includes('quick')) return json({ games: [], n: 0, looking: 0, resting: offLine('quick') });
    const { games: all, looking } = await env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global')).live(me.id);
    const zone = zoneOf(me.state);
    const near = (g: LiveGame) => (g.state === me.state && me.state !== 'OUT' && me.state !== 'NONE' ? 0 : zone && zoneOf(g.state) === zone ? 1 : 2);
    const games = all
      .filter((g) => !tableLock(g.stake, me, now) && !(g.stake > 0 && controls.off.includes('stakes')))
      .sort((a, b) => near(a) - near(b) || a.since - b.since)
      .slice(0, 20);
    return json({ games, n: games.length, looking });
  }

  /* --- a match --- */
  const m = path.match(/^\/api\/match\/([^/]+)$/);
  if (m && isSocket) {
    const id = m[1];
    if (!isMatchId(id)) return socketError(CLOSE.notFound, 'not-found');
    // A friend room. A quick match can't start for a banned player, and Baba Ayo is still open.
    if (isBanned(me) && isRoomCode(id.toUpperCase())) return socketError(CLOSE.banned, 'banned', BANNED_MESSAGE);
    return forward(req, env.MATCH.get(env.MATCH.idFromName(id)), toPublic(me));
  }

  return fail(404, 'not found');
}

async function cachedTop(env: Env, url: URL, state: string | null) {
  const cache = typeof caches === 'undefined' ? undefined : caches.default;
  const key = new Request(`${url.origin}/api/leaderboard/top/${state ?? 'ng'}`);
  try {
    const hit = await cache?.match(key);
    if (hit) return (await hit.json()) as Awaited<ReturnType<typeof leaderboard>>;
  } catch { /* cache is best effort */ }
  const top = await leaderboard(env.DB, state);
  try {
    await cache?.put(key, json(top, 200, { 'cache-control': 'public, max-age=20' }));
  } catch { /* cache is best effort */ }
  return top;
}

export default {
  /** 7 pm Lagos time (wrangler.jsonc): the streak reminders (worker/notifier.ts). */
  /** The two daily jobs in wrangler.jsonc: the 8 am report (07:00 UTC) and the 7 pm streak reminders (18:00 UTC). */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === REPORT_CRON) ctx.waitUntil(sendReport(env).then((r) => console.log('[report]', r.day, r.sent), (err) => console.error('[report]', err)));
    else ctx.waitUntil(env.NOTIFIER.get(env.NOTIFIER.idFromName('streak')).start());
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await route(req, env, url);
    } catch (err) {
      console.error(err);
      return fail(500, 'Something broke on our side. Try again.');
    }
  },
} satisfies ExportedHandler<Env>;
