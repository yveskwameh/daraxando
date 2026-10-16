/**
 * The Worker. Static files (the React app) are served by Cloudflare before this runs, so
 * only /api/* reaches it. Everything here is small: check who you are, then hand you to
 * the right Durable Object or answer from D1.
 */
import { isBotLevel, type BotLevel } from '../shared/bot';
import { AVATARS, isOpen, PIECES, PRINTS } from '../shared/collections';
import { DEFAULT_MODE, isModeId, type ModeId } from '../shared/modes';
import { isStateCode, zoneOf } from '../shared/places';
import {
  CLOSE, CODE_ALPHABET, CODE_LENGTH, cleanName, isMatchId, isRoomCode, type LiveGame, type Profile, type PublicPlayer,
} from '../shared/protocol';
import { fmt, isFriendTable, isTable, sapaReady, tableLock } from '../shared/stakes';
import { accountOf, authRoute, deleteAccount } from './accounts';
import { signToken, tokenFrom, verifyToken } from './auth';
import { claimSapa, createPlayer, getPlayer, leaderboard, rankOf, toPublic, updatePlayer, type ProfilePatch } from './db';
import type { Env } from './env';
import { body, fail, json, secretOf } from './http';
import { askFriend, buyFreeze, dropFriend, friendsOf, leagueFor, placeBet, restore } from './habits';
import { randomId } from './matchmaker';
import { adminRoute } from './admin';
import { NAME_PROBLEM_MESSAGE, nameProblem } from './names';
import { appealOf, askReview, BANNED_MESSAGE, deviceOf, isBanned } from './safety';

export { Match } from './match';
export { Matchmaker } from './matchmaker';

const roomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
};

async function playerFrom(req: Request, url: URL, env: Env) {
  const id = await verifyToken(tokenFrom(req, url), secretOf(env));
  return id ? getPlayer(env.DB, id) : null;
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

/** Checks a profile change against the player's level. Returns an error message, or the clean patch. */
function checkPatch(me: Profile | null, b: Partial<Record<keyof ProfilePatch, unknown>>): string | ProfilePatch {
  const level = me?.level ?? 1;
  const patch: ProfilePatch = {};
  if (b.name !== undefined) {
    const name = cleanName(b.name);
    if (!name) return 'Names are 2 to 16 letters or numbers.';
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
    if (env.DEVICE_LIMITER && !(await env.DEVICE_LIMITER.limit({ key: `d:${device}` })).success) {
      return fail(429, 'Too many new players from this phone. Try again in a minute.');
    }
    if (env.IP_LIMITER && !(await env.IP_LIMITER.limit({ key: `ip:${ip}` })).success) {
      return fail(429, 'Lots of new players on your network right now. Try again in a minute.');
    }
    const b = await body<{ name: string; avatar: string; state: string; age: boolean }>(req);
    if (b.age !== true) return fail(400, 'Dara X&O is for players aged 13 and up.');
    const checked = checkPatch(null, { name: b.name, avatar: b.avatar, state: b.state });
    if (typeof checked === 'string') return fail(400, checked);
    if (!checked.name || !checked.avatar || !checked.state) return fail(400, 'Pick a name, an avatar and your state.');
    const profile = await createPlayer(env.DB, {
      name: checked.name, avatar: checked.avatar, state: checked.state as Profile['state'], device: await deviceOf(req, env),
    });
    return json({ token: await signToken(profile.id, secretOf(env)), profile });
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
    return json({ ok: true, env: env.ENVIRONMENT ?? 'local', signIn: { google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), email: !!env.RESEND_API_KEY } });
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
    const room = await env.MATCH.get(env.MATCH.idFromName(code)).peek();
    if (!room) return fail(404, 'No room with that code. Check it with your friend.');
    return json({ code, ...room });
  }

  /* --- the admin API (worker/admin.ts, docs/ADMIN-API.md). Its own key, never a player token. --- */
  if (path.startsWith('/api/admin/') || path === '/api/admin') return adminRoute(req, env, url);

  /* --- save your progress and sign in (worker/accounts.ts). The phone may not have a player yet. --- */
  if (path.startsWith('/api/auth/')) return authRoute(req, env, url, tokenFrom(req, url) ? await playerFrom(req, url, env) : null);

  const isSocket = req.headers.get('Upgrade') === 'websocket';
  const me = await playerFrom(req, url, env);
  if (!me) return isSocket ? socketError(CLOSE.unauthorized, 'unauthorized') : fail(401, 'unauthorized');
  const now = Date.now();
  if (method !== 'GET' && !isSocket && env.ACTION_LIMITER && !(await env.ACTION_LIMITER.limit({ key: `a:${me.id}` })).success) {
    return fail(429, 'Slow down a little. Try again in a minute.');
  }

  /* --- your profile --- */
  if (path === '/api/me' && method === 'GET') return json({ profile: me });

  /* --- how you're saved (Settings), and deleting your account --- */
  if (path === '/api/account' && method === 'GET') return json(await accountOf(env.DB, me.id));
  if (path === '/api/me' && method === 'DELETE') {
    await deleteAccount(env.DB, me.id);
    return json({ deleted: true });
  }

  if (path === '/api/me' && method === 'PATCH') {
    const checked = checkPatch(me, await body<ProfilePatch>(req));
    if (typeof checked === 'string') return fail(400, checked);
    return json({ profile: await updatePlayer(env.DB, me.id, checked) });
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

  /* --- Sapa relief: a free top-up when you're nearly out --- */
  if (path === '/api/wallet/sapa' && method === 'POST') {
    if (!sapaReady(me.cowries, me.sapaAt, now)) return fail(409, 'Sapa relief is for balances under 500, once every 4 hours.');
    const profile = await claimSapa(env.DB, me.id, now);
    return profile ? json({ profile }) : fail(409, 'Sapa relief is for balances under 500, once every 4 hours.');
  }

  /* --- play a friend: make a room with a short code --- */
  if (path === '/api/rooms' && method === 'POST') {
    if (isBanned(me)) return fail(403, BANNED_MESSAGE);
    const b = await body<{ mode: ModeId; stake: number }>(req);
    const mode = isModeId(b.mode) ? b.mode : DEFAULT_MODE;
    const stake = isFriendTable(b.stake) ? b.stake : 0;
    if (stake > me.cowries) return fail(400, `You need ${fmt(stake)} Dara Seeds for that stake.`);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = roomCode();
      const stub = env.MATCH.get(env.MATCH.idFromName(code));
      if ((await stub.init({ id: code, kind: 'friend', mode, stake, players: [toPublic(me)] })).ok) return json({ matchId: code });
    }
    return fail(503, 'Could not make a room. Try again.');
  }

  /* --- change the stake while waiting for your friend --- */
  if (peekMatch && method === 'PATCH') {
    const code = peekMatch[1].toUpperCase();
    const b = await body<{ stake: number }>(req);
    if (!isRoomCode(code) || !isFriendTable(b.stake)) return fail(400, 'Friend rooms stake up to 1,000.');
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
    const check = { level: me.level, cowries: me.cowries, createdAt: me.createdAt, coolUntil: me.coolUntil };
    return forward(req, env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global')), toPublic(me), { 'x-watch': JSON.stringify({ check }) });
  }

  /* --- live games for Quick match, as one request: the ones you can join, nearest and longest waiting first --- */
  if (path === '/api/live' && method === 'GET') {
    if (isBanned(me)) return json({ games: [], n: 0, looking: 0 });
    const { games: all, looking } = await env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global')).live(me.id);
    const zone = zoneOf(me.state);
    const near = (g: LiveGame) => (g.state === me.state && me.state !== 'OUT' && me.state !== 'NONE' ? 0 : zone && zoneOf(g.state) === zone ? 1 : 2);
    const games = all
      .filter((g) => !tableLock(g.stake, me, now))
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
