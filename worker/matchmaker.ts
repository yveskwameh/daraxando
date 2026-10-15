/**
 * Quick match. Everyone searching holds a socket open to this one Durable Object, and
 * being connected is what being in the queue means, so the queue survives hibernation
 * without a storage write per search.
 *
 * Each mode and stake is its own queue. Within a queue, the search widens every 4 seconds,
 * judged by whoever has waited longest: same state, same zone, all of Nigeria, anyone
 * (shared/matching.ts). Among the players allowed, the closest rating wins. The browser
 * offers Baba Ayo early, as soon as nobody else is searching, but the search keeps going
 * and he never starts on his own. Players also hear about busier tables they could switch to.
 *
 * Every waiting player is also a live game others can join from Quick match on Home: `live()`
 * lists them, and a join is a search that targets one player (`target`). It pairs with them
 * at once or gets told they're gone. People looking at Quick match with nobody to join are
 * counted too (in memory, for a few seconds), so the sheet can say others are looking.
 *
 * One object comfortably handles hundreds of new searches a second. Past that, split it
 * by mode (idFromName('lobby:classic'), ...) and nothing else has to change.
 */
import { DurableObject } from 'cloudflare:workers';
import type { ModeId } from '../shared/modes';
import { canPair, searchStage } from '../shared/matching';
import { zoneOf } from '../shared/places';
import { dayKey } from '../shared/progression';
import { CLOSE, type LiveGame, type LobbyServerMsg, type Nearby, type PublicPlayer } from '../shared/protocol';
import { HIGH_TABLE, PAIR_DAILY_MAX } from '../shared/stakes';
import type { Env } from './env';
import type { InitResult } from './match';

/** Quick match checks every couple of seconds; anyone not seen for this long has stopped looking. */
const LOOKING_MS = 7_000;

interface Ticket extends PublicPlayer {
  mode: ModeId;
  stake: number;
  since: number;
  /** Switched to this table to meet someone already waiting: pair with anyone, near or far. */
  wide?: boolean;
  /** Joining one waiting player's game from Quick match: pair with them only. */
  target?: string;
  matched?: string;
}

const OPEN = 1;

export const randomId = (n = 12) => {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
};

const realState = (s: string) => s !== 'OUT' && s !== 'NONE';

export class Matchmaker extends DurableObject<Env> {
  /** Players being handed to a match right now, so a second search cannot grab them mid-handoff. */
  private pairing = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a websocket', { status: 426 });
    let ticket: Ticket;
    try {
      const player = JSON.parse(req.headers.get('x-player') ?? '') as PublicPlayer;
      const q = JSON.parse(req.headers.get('x-queue') ?? '') as { mode: ModeId; stake: number; wide?: boolean; target?: string };
      ticket = { ...player, mode: q.mode, stake: q.stake, wide: !!q.wide || !!q.target, target: q.target || undefined, since: Date.now() };
    } catch {
      return new Response('Missing player', { status: 400 });
    }

    // Searching in two tabs at once would match you against yourself. Last tab wins.
    for (const ws of this.ctx.getWebSockets()) {
      if (this.ticket(ws)?.id === ticket.id) {
        try { ws.close(CLOSE.replaced, 'replaced'); } catch { /* gone */ }
      }
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(ticket);
    this.ctx.waitUntil(this.pair());
    return new Response(null, { status: 101, webSocket: client });
  }

  /** The browser sends a tick every few seconds while searching, which re-runs pairing a little wider. */
  async webSocketMessage() {
    await this.pair();
  }

  async webSocketClose(ws: WebSocket) {
    try { ws.close(); } catch { /* already closed */ }
  }

  /**
   * Games waiting for an opponent, for Quick match on Home. Joiners aren't games, and you can't
   * join yourself. `looking` marks the viewer as looking at Quick match right now; the count is
   * everyone else seen doing that in the last few seconds. It's only memory: if this object
   * sleeps, the count starts again from zero, which is fine for a hint.
   */
  async live(viewer: string, looking = false): Promise<{ games: LiveGame[]; looking: number }> {
    const now = Date.now();
    if (looking) this.lookers.set(viewer, now);
    let others = 0;
    for (const [id, at] of this.lookers) {
      if (now - at > LOOKING_MS) this.lookers.delete(id);
      else if (id !== viewer) others++;
    }
    const games = this.waiting()
      .filter(({ t }) => !t.target && t.id !== viewer)
      .map(({ t }) => ({ id: t.id, name: t.name, avatar: t.avatar, print: t.print, state: t.state, rating: t.rating, mode: t.mode, stake: t.stake, since: t.since }));
    return { games, looking: others };
  }

  /** Who is looking at Quick match right now, by player id, with when they last checked. */
  private lookers = new Map<string, number>();

  private ticket(ws: WebSocket): Ticket | null {
    try {
      return (ws.deserializeAttachment() as Ticket | null) ?? null;
    } catch {
      return null;
    }
  }

  private waiting() {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === OPEN)
      .map((ws) => ({ ws, t: this.ticket(ws)! }))
      .filter((x) => x.t && !x.t.matched && !this.pairing.has(x.t.id));
  }

  private async pair() {
    const now = Date.now();
    const pool = this.waiting().sort((a, b) => a.t.since - b.t.since); // longest wait gets first pick
    const used = new Set<string>();
    const pairs: [(typeof pool)[number], (typeof pool)[number]][] = [];
    const today = dayKey(now);
    const counts = pool.some((x) => x.t.stake >= HIGH_TABLE)
      ? ((await this.ctx.storage.get<Record<string, number>>(`pairs:${today}`)) ?? {})
      : {};

    for (const a of pool) {
      if (used.has(a.t.id)) continue;
      let best: typeof a | null = null;
      let gap = Infinity;
      for (const b of pool) {
        if (b.t.id === a.t.id || used.has(b.t.id)) continue;
        if (b.t.mode !== a.t.mode || b.t.stake !== a.t.stake) continue;
        // A join pairs only with the player whose game it is.
        if ((a.t.target && a.t.target !== b.t.id) || (b.t.target && b.t.target !== a.t.id)) continue;
        const stage = a.t.wide || b.t.wide ? 3 : searchStage(now - Math.min(a.t.since, b.t.since));
        if (!canPair(a.t, b.t, stage)) continue;
        if (a.t.stake >= HIGH_TABLE && (counts[pairKey(a.t.id, b.t.id)] ?? 0) >= PAIR_DAILY_MAX) continue;
        const d = Math.abs(a.t.rating - b.t.rating);
        if (d < gap) { gap = d; best = b; }
      }
      if (best) {
        used.add(a.t.id);
        used.add(best.t.id);
        pairs.push([a, best]);
      }
    }

    const high = pairs.filter(([a]) => a.t.stake >= HIGH_TABLE);
    if (high.length) {
      for (const [a, b] of high) counts[pairKey(a.t.id, b.t.id)] = (counts[pairKey(a.t.id, b.t.id)] ?? 0) + 1;
      await this.ctx.storage.put(`pairs:${today}`, counts);
      await this.ctx.storage.delete(`pairs:${dayKey(now - 86_400_000)}`);
    }

    for (const [a, b] of pairs) { this.pairing.add(a.t.id); this.pairing.add(b.t.id); }
    await Promise.all(pairs.map(([a, b]) => this.start(a, b)));

    // A join that didn't pair just now won't: the game was taken, closed, or can't be played today.
    for (const { ws, t } of this.waiting()) {
      if (!t.target) continue;
      try { ws.send(JSON.stringify({ t: 'gone' } satisfies LobbyServerMsg)); ws.close(CLOSE.gone, 'gone'); } catch { /* left */ }
    }

    // Tell everyone still waiting how busy their search is, so the screen can say so honestly,
    // and point them at the busiest other table in case theirs is empty.
    const left = this.waiting().filter((x) => !x.t.target);
    const queues = new Map<string, { mode: ModeId; stake: number; n: number }>();
    for (const { t } of left) {
      const key = `${t.mode}|${t.stake}`;
      const q = queues.get(key) ?? { mode: t.mode, stake: t.stake, n: 0 };
      q.n++;
      queues.set(key, q);
    }
    for (const { ws, t } of left) {
      const same = left.filter((x) => x.t.id !== t.id && x.t.mode === t.mode && x.t.stake === t.stake);
      const zone = zoneOf(t.state);
      let elsewhere: Nearby['elsewhere'] = null;
      for (const q of queues.values()) {
        if (q.mode === t.mode && q.stake === t.stake) continue;
        if (!elsewhere || q.n > elsewhere.n) elsewhere = q;
      }
      const near: Nearby = {
        state: realState(t.state) ? same.filter((x) => x.t.state === t.state).length : 0,
        zone: zone ? same.filter((x) => zoneOf(x.t.state) === zone).length : 0,
        all: same.length,
        elsewhere,
      };
      try { ws.send(JSON.stringify({ t: 'queued', near } satisfies LobbyServerMsg)); } catch { /* closing */ }
    }
  }

  private async start(a: { ws: WebSocket; t: Ticket }, b: { ws: WebSocket; t: Ticket }) {
    const strip = ({ id, name, avatar, piece, print, state, rating, level }: Ticket): PublicPlayer =>
      ({ id, name, avatar, piece, print, state, rating, level });
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const matchId = randomId();
        const stub = this.env.MATCH.get(this.env.MATCH.idFromName(matchId));
        const res: InitResult = await stub.init({ id: matchId, kind: 'quick', mode: a.t.mode, stake: a.t.stake, players: [strip(a.t), strip(b.t)] });
        if (res.ok) {
          for (const x of [a, b]) {
            x.ws.serializeAttachment({ ...x.t, matched: matchId } satisfies Ticket);
            try { x.ws.send(JSON.stringify({ t: 'matched', matchId } satisfies LobbyServerMsg)); } catch { /* left */ }
          }
          return;
        }
        if (res.reason === 'stake-short') {
          // Someone spent their cowries elsewhere since joining. They leave the queue; the other keeps searching.
          for (const x of [a, b]) {
            if (!res.short.includes(x.t.id)) continue;
            const msg: LobbyServerMsg = { t: 'error', code: 'stake-short', message: `You don't have ${x.t.stake.toLocaleString('en-US')} Dara Seeds any more.` };
            try { x.ws.send(JSON.stringify(msg)); x.ws.close(CLOSE.stake, 'stake-short'); } catch { /* left */ }
          }
          return;
        }
      }
    } catch (err) {
      console.error('Could not start match', err);
    } finally {
      this.pairing.delete(a.t.id);
      this.pairing.delete(b.t.id);
    }
  }
}

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
