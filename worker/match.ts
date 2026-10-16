/**
 * One match, one Durable Object. A match is a series of games (best of 5 in Classic, best
 * of 3 in Fading and Big, one game in Pro). It holds the board, judges every move, runs
 * the clocks, holds the stakes, and writes the result to D1 when the series ends.
 *
 * How it stays cheap:
 * - WebSocket Hibernation. Between moves the object is evicted from memory and costs
 *   nothing. It wakes on the next message.
 * - The state rides along on each socket's attachment, which survives hibernation for
 *   free, so a series writes to storage only at the start, the end, and when everyone
 *   has left, never on each move.
 * - No timer runs on the server during a turn. The browser counts down and sends `claim`
 *   when time is up, or `next` when the pause between games is over, and the server checks
 *   its own clock before acting. If nobody is left to ask, nobody is left to care.
 *   The one exception is Baba Ayo's thinking time, under a second.
 */
import { DurableObject } from 'cloudflare:workers';
import { botMove, isBotLevel, type BotLevel } from '../shared/bot';
import { pairOf } from '../shared/collections';
import { isModeId, MODES, maxGames, winsNeeded, type ModeId } from '../shared/modes';
import { auraFor, eloDelta, levelInfo, MIN_RATING, type Kind, type Result } from '../shared/progression';
import {
  ABANDON_MS, AWAY_MS, BOT, CLOSE, EMOTES, FIRST_MATCH_TURN_MS, FIRST_TURN_BONUS_MS, MAX_TIMEOUTS, NEXT_WAIT_MS, RESUME_MIN_MS,
  type ClientMsg, type EndReason, type ErrorCode, type GameResult, type MatchView, type Phase, type PublicPlayer,
  type Rematch, type RoomStatus, type SeriesResult, type ServerMsg,
} from '../shared/protocol';
import {
  emptyBoard, emptyHist, fadingNext, findWin, isIndex, legalMoves, other, outcomeAfter, place,
  type Cell, type Hist, type Mark, type Variant,
} from '../shared/rules';
import { fmt, isFriendTable, prize, QUICK_QUIT_MOVES, type StakeBack } from '../shared/stakes';
import { LINES, line } from './baba';
import { recordSeries, refund, takeStakes, type SeriesInput } from './db';
import type { Env } from './env';
import { afterMatch } from './habits';
import { BANNED_MESSAGE, bannedAmong, stakeBack } from './safety';

interface Seat extends PublicPlayer {
  score: number;
  timeouts: number;
  connected: boolean;
  /** Switched away from the app (the socket may still be open). */
  hidden: boolean;
  /** When they stopped being here, whether by leaving the app or losing the connection. */
  leftAt: number | null;
  /** Moves they made themselves this series, for the quick-quit rule. Missing in rooms saved before it. */
  played?: number;
}

interface State {
  /** Goes up on every change, so the newest copy wins when the object wakes up. */
  v: number;
  id: string;
  kind: Kind;
  mode: ModeId;
  level?: BotLevel;
  /**
   * A new player's first match against Baba Ayo: one game, not a series. Lose or draw and
   * the rematch is one game again; win and it's done. Any other rematch ends it.
   */
  first?: boolean;
  stake: number;
  /** True while both stakes are held. Cleared the moment they are paid out or refunded. */
  escrow: boolean;
  phase: Phase;
  game: number;
  /** Seat 0 plays X, seat 1 plays O. */
  seats: [Seat | null, Seat | null];
  /** Who opens the current game. Alternates every game. */
  starter: Mark;
  /** Who opened the first game of this series, so a rematch can swap it. */
  seriesStarter: Mark;
  board: Cell[];
  hist: Hist;
  /** Moves in the current game. */
  moves: number[];
  /** Every game's moves, for the match record: games split by |, squares by commas. */
  record: string;
  turn: Mark | null;
  turnEndsAt: number | null;
  /** Set while the match is paused: what was left on the turn clock. */
  pausedLeft: number | null;
  /** Between games: who has tapped Next game, and when the first one did. */
  ready: [boolean, boolean];
  readyAt: number | null;
  removed: number | null;
  result: GameResult | null;
  series: SeriesResult | null;
  rematch: [Rematch | null, Rematch | null];
  draws: number;
  createdAt: number;
}

interface Attachment { pid: string; seat: 0 | 1; s: State }

export interface InitOptions {
  id: string;
  kind: Kind;
  mode: ModeId;
  level?: BotLevel;
  /** A new player's first match: one game until they win. Baba Ayo only. */
  first?: boolean;
  stake: number;
  players: PublicPlayer[];
}

export type InitResult = { ok: true } | { ok: false; reason: 'taken' } | { ok: false; reason: 'stake-short'; short: string[] };

export interface RoomPeek {
  mode: ModeId;
  stake: number;
  host: { name: string; avatar: string; print: string; state: string } | null;
  open: boolean;
}

/** Delete a room this long after the last person left it. */
const IDLE_CLEANUP_MS = 10 * 60_000;
/** Delete a room nobody ever finished with, however it ended up. */
const ROOM_TTL_MS = 45 * 60_000;
/** One line per person per this long. */
const EMOTE_GAP_MS = 700;

const BOT_RATING: Record<BotLevel, number> = { jeje: 900, sharp: 1200, agba: 1600 };
const BOT_SHOWN_LEVEL: Record<BotLevel, number> = { jeje: 3, sharp: 12, agba: 30 };

const seatFor = (p: PublicPlayer): Seat => ({ ...p, score: 0, timeouts: 0, connected: false, hidden: false, leftAt: null });

/** In the app right now. Baba Ayo is always here. */
const here = (p: Seat | null) => !p || !!p.bot || (p.connected && !p.hidden);

const OPEN = 1;

export class Match extends DurableObject<Env> {
  /** undefined: not loaded yet. null: there is no match here. */
  private state: State | null | undefined;
  private lastEmote = new Map<string, number>();
  private joining = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keepalive pings are answered by the runtime itself and never wake the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /* ------------------------------------------------------------------ setup (RPC) */

  /** Called by the Worker or the matchmaker before anyone connects. */
  async init(opts: InitOptions): Promise<InitResult> {
    await this.load();
    if (this.state) return { ok: false, reason: 'taken' };
    const now = Date.now();

    // A quick match takes both stakes up front. If either player is short, there is no match.
    let escrow = false;
    if (opts.kind === 'quick' && opts.stake > 0) {
      const short = await takeStakes(this.env.DB, opts.id, opts.players.map((p) => p.id), opts.stake, now);
      if (short.length) return { ok: false, reason: 'stake-short', short };
      escrow = true;
    }

    const human = opts.players.map(seatFor);
    const level = opts.kind === 'bot' ? (opts.level ?? 'sharp') : undefined;
    const seats: [Seat | null, Seat | null] = [human[0], human[1] ?? (level ? this.botSeat(level) : null)];
    // Quick match: a coin toss. Friend rooms: the host opens. Baba Ayo: you open.
    const starter: Mark = opts.kind === 'quick' && Math.random() < 0.5 ? 'O' : 'X';
    const n = MODES[opts.mode].n;
    this.state = {
      v: 1,
      id: opts.id,
      kind: opts.kind,
      mode: opts.mode,
      level,
      first: opts.kind === 'bot' && opts.first ? true : undefined,
      stake: opts.kind === 'bot' ? 0 : opts.stake,
      escrow,
      phase: 'waiting',
      game: 0,
      seats,
      starter,
      seriesStarter: starter,
      board: emptyBoard(n),
      hist: emptyHist(),
      moves: [],
      record: '',
      turn: null,
      turnEndsAt: null,
      pausedLeft: null,
      ready: [false, false],
      readyAt: null,
      removed: null,
      result: null,
      series: null,
      rematch: [null, null],
      draws: 0,
      createdAt: now,
    };
    await this.ctx.storage.put('state', this.state);
    await this.ctx.storage.setAlarm(now + ROOM_TTL_MS);
    return { ok: true };
  }

  /** Friend rooms: the host can change the stake until their friend arrives. */
  async setStake(hostId: string, stake: number): Promise<boolean> {
    await this.load();
    const s = this.state;
    if (!s || s.kind !== 'friend' || s.phase !== 'waiting' || s.seats[1] || s.seats[0]?.id !== hostId) return false;
    s.stake = stake;
    await this.ctx.storage.put('state', s);
    this.sync();
    return true;
  }

  /** What someone with the code sees before they join: who is hosting and the stake. */
  async peek(): Promise<RoomPeek | null> {
    await this.load();
    const s = this.state;
    if (!s || s.kind !== 'friend') return null;
    const h = s.seats[0];
    return {
      mode: s.mode,
      stake: s.stake,
      host: h ? { name: h.name, avatar: h.avatar, print: h.print, state: h.state } : null,
      open: s.phase === 'waiting' && !s.seats[1],
    };
  }

  /** Friend rooms: the host closes the room before the match starts. Any stakes go back. */
  async cancel(hostId: string): Promise<boolean> {
    await this.load();
    const s = this.state;
    if (!s || s.kind !== 'friend' || s.phase !== 'waiting' || s.seats[0]?.id !== hostId) return false;
    this.abort(Date.now());
    return true;
  }

  private botSeat(level: BotLevel): Seat {
    return {
      ...seatFor({ ...BOT, rating: BOT_RATING[level], level: BOT_SHOWN_LEVEL[level], bot: true }),
      connected: true,
    };
  }

  /** Wakes up with whichever copy of the state is newest: a socket attachment or storage. */
  private async load() {
    if (this.state !== undefined) return;
    let best: State | null = null;
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.att(ws);
      if (a?.s && (!best || a.s.v > best.v)) best = a.s;
    }
    const stored = (await this.ctx.storage.get<State>('state')) ?? null;
    if (stored && (!best || stored.v > best.v)) best = stored;
    // Matches saved before Next game and rematch requests existed.
    if (best && !best.ready) Object.assign(best, { ready: [false, false], readyAt: null, rematch: [null, null] });
    // A second event may have loaded it while we were waiting on storage.
    if (this.state === undefined) this.state = best;
  }

  private att(ws: WebSocket): Attachment | null {
    try {
      return (ws.deserializeAttachment() as Attachment | null) ?? null;
    } catch {
      return null;
    }
  }

  /** Open sockets that belong to a seated player. */
  private live(except?: WebSocket) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === OPEN && this.att(ws));
  }

  private variant(): Variant {
    const m = MODES[this.state!.mode];
    return { n: m.n, k: m.k, fade: m.fade };
  }

  /* ------------------------------------------------------------------ sockets */

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a websocket', { status: 426 });
    let player: PublicPlayer;
    try {
      player = JSON.parse(req.headers.get('x-player') ?? '');
    } catch {
      return new Response('Missing player', { status: 400 });
    }

    await this.load();
    const { 0: client, 1: server } = new WebSocketPair();
    const done = () => new Response(null, { status: 101, webSocket: client });
    const s = this.state;

    // The host watching their friend room from elsewhere in the app. Watch sockets carry no
    // attachment, so everything that deals with seated players skips them.
    if (req.headers.get('x-watch')) {
      this.ctx.acceptWebSocket(server, ['watch']);
      if (!s || s.kind !== 'friend' || s.seats[0]?.id !== player.id) {
        return this.reject(server, CLOSE.notFound, 'not-found', 'That room has closed.'), done();
      }
      try { server.send(JSON.stringify(this.roomStatus())); } catch { /* gone */ }
      this.sync(); // the friend's screen says the host has been told
      return done();
    }

    this.ctx.acceptWebSocket(server);
    if (!s) return this.reject(server, CLOSE.notFound, 'not-found', 'That match has ended or never existed.'), done();

    let seat = s.seats.findIndex((p) => p?.id === player.id) as -1 | 0 | 1;
    if (seat === -1) {
      if (s.kind !== 'friend' || s.seats[1] || s.phase !== 'waiting' || this.joining) {
        return this.reject(server, CLOSE.roomFull, 'room-full', 'This room already has two players.'), done();
      }
      // Hold the seat while the stakes are taken, so a second guest can't slip in.
      this.joining = true;
      try {
        if (s.stake > 0) {
          const host = s.seats[0]!;
          const short = await takeStakes(this.env.DB, s.id, [host.id, player.id], s.stake);
          if (short.length) {
            const msg = short.includes(player.id)
              ? `You need ${fmt(s.stake)} Dara Seeds to join this room.`
              : `${host.name} no longer has ${fmt(s.stake)} Dara Seeds for this room.`;
            return this.reject(server, CLOSE.stake, 'stake-short', msg), done();
          }
          s.escrow = true;
        }
        s.seats[1] = seatFor(player);
        seat = 1;
        this.ctx.waitUntil(this.ctx.storage.put('state', s));
      } finally {
        this.joining = false;
      }
    }

    // Same player in a second tab: the new tab wins.
    for (const ws of this.live(server)) {
      if (this.att(ws)?.pid === player.id) this.reject(ws, CLOSE.replaced, 'replaced', 'You opened this match somewhere else.');
    }

    const me = s.seats[seat]!;
    // Keep their look up to date (a new avatar or name between games), but never their rating.
    // A phone that opens the match in the background says so, so it doesn't count as here.
    const now = Date.now();
    const hidden = new URL(req.url).searchParams.get('hidden') === '1';
    Object.assign(me, { name: player.name, avatar: player.avatar, print: player.print, connected: true, hidden, leftAt: hidden ? now : null });
    if (s.phase === 'waiting') me.piece = player.piece;
    server.serializeAttachment({ pid: player.id, seat, s } satisfies Attachment);

    if (s.phase === 'waiting') this.startIfBothHere(now);
    else {
      this.updatePause(now);
      this.returned(seat, now);
    }
    this.sync();
    return done();
  }

  private reject(ws: WebSocket, code: number, err: ErrorCode, message: string) {
    try {
      ws.send(JSON.stringify({ t: 'error', code: err, message } satisfies ServerMsg));
      ws.close(code, err);
    } catch { /* already gone */ }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 200) return;
    await this.load();
    const s = this.state;
    const a = this.att(ws);
    if (!s || !a) return;

    let m: ClientMsg;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const now = Date.now();
    const mine = this.markOf(a.seat);

    switch (m.t) {
      case 'move': {
        if (s.phase !== 'playing' || s.pausedLeft !== null || s.turn !== mine || !isIndex(m.i, MODES[s.mode].n) || s.board[m.i] !== null) return this.bad(ws);
        const seat = s.seats[a.seat]!;
        seat.timeouts = 0;
        seat.played = (seat.played ?? 0) + 1;
        return this.place(a.seat, m.i, now);
      }

      case 'emote': {
        if (!(EMOTES as readonly string[]).includes(m.e)) return;
        if (now - (this.lastEmote.get(a.pid) ?? 0) < EMOTE_GAP_MS) return;
        this.lastEmote.set(a.pid, now);
        this.send({ t: 'emote', seat: a.seat, e: m.e }, ws);
        if (s.kind === 'bot' && Math.random() < 0.6) {
          setTimeout(() => this.say(line(LINES.emote)), 700 + Math.random() * 600);
        }
        return;
      }

      case 'away':
      case 'back': {
        const p = s.seats[a.seat]!;
        p.hidden = m.t === 'away';
        if (p.hidden) p.leftAt = p.leftAt ?? now;
        else if (p.connected) p.leftAt = null;
        this.updatePause(now);
        if (!p.hidden) {
          this.returned(a.seat, now);
          if (s.phase === 'waiting') this.startIfBothHere(now);
        }
        return this.sync();
      }

      case 'next': {
        // The next game starts only when both players say so.
        if (s.phase !== 'between') return;
        s.ready[a.seat] = true;
        s.readyAt = s.readyAt ?? now;
        if (s.ready[0] && s.ready[1] && this.allHere()) this.nextGame(now);
        return this.sync();
      }

      case 'rematch':
        return this.rematch(a.seat, m, now);

      case 'resign': {
        if (s.phase === 'waiting' && s.kind === 'friend') return this.leaveRoom(a.seat, now);
        if (s.phase !== 'playing' && s.phase !== 'between') return;
        // Leaving gives the whole match, and the pot, to the other side.
        s.result = { winner: other(mine), line: null, reason: 'resign' };
        return this.endSeries((1 - a.seat) as 0 | 1, 'resign', now);
      }

      case 'claim':
        return this.claim(a.seat, now);
    }
  }

  async webSocketClose(ws: WebSocket) {
    try { ws.close(); } catch { /* already closed */ }
    await this.load();
    // A host stopped watching: the friend's screen stops saying they've been told.
    if (this.ctx.getTags(ws).includes('watch')) return this.sync();
    this.left(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.load();
    this.left(ws);
  }

  private left(ws: WebSocket) {
    const s = this.state;
    const a = this.att(ws);
    if (!s || !a) return;
    const others = this.live(ws);
    // Only mark them gone if this was their last open tab.
    if (!others.some((w) => this.att(w)?.pid === a.pid)) {
      const seat = s.seats[a.seat];
      if (seat && !seat.bot) {
        seat.connected = false;
        seat.leftAt = seat.leftAt ?? Date.now();
      }
    }
    this.updatePause(Date.now());
    if (others.length === 0) {
      // Nobody left to carry the state on their socket, so write it down for a reconnect.
      this.ctx.waitUntil(this.ctx.storage.put('state', s).then(() => this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS)));
    }
    this.sync(ws);
  }

  async alarm() {
    await this.load();
    if (this.live().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
      return;
    }
    // Everyone walked away before the end. Nobody won, so the stakes go back.
    if (this.state?.escrow) await this.refundAll();
    await this.ctx.storage.deleteAll();
    this.state = null;
    this.tellWatchers({ t: 'room', open: false, guest: null, stake: 0 });
  }

  /* ------------------------------------------------------------------ game flow */

  private markOf(seat: 0 | 1): Mark {
    return seat === 0 ? 'X' : 'O';
  }

  private seatOf(mark: Mark): 0 | 1 {
    return mark === 'X' ? 0 : 1;
  }

  private startSeries(now: number) {
    const s = this.state!;
    s.game = 0;
    s.draws = 0;
    s.record = '';
    s.series = null;
    s.rematch = [null, null];
    for (const p of s.seats) {
      if (!p) continue;
      p.score = 0;
      p.played = 0;
    }
    s.starter = s.seriesStarter;
    this.nextGame(now, true);
    if (s.kind === 'bot') {
      this.say(line(this.seatOf(s.starter) === this.botIndex() ? LINES.openerMe : LINES.openerYou));
    }
  }

  private nextGame(now: number, first = false) {
    const s = this.state!;
    if (!first) s.starter = other(s.starter);
    s.game++;
    s.phase = 'playing';
    s.board = emptyBoard(MODES[s.mode].n);
    s.hist = emptyHist();
    s.moves = [];
    s.removed = null;
    s.result = null;
    s.ready = [false, false];
    s.readyAt = null;
    s.turn = s.starter;
    for (const p of s.seats) if (p) p.timeouts = 0;
    s.pausedLeft = null;
    s.turnEndsAt = now + this.turnMs() + FIRST_TURN_BONUS_MS;
    this.updatePause(now);
    if (s.pausedLeft === null && this.seatOf(s.turn) === this.botIndex()) this.scheduleBot();
  }

  private allHere() {
    return this.state!.seats.every(here);
  }

  /**
   * A series starts only when both players are seated and in the app. Starting while one of
   * them was in WhatsApp would put the match straight into a pause they never saw coming.
   */
  private startIfBothHere(now: number) {
    const s = this.state!;
    if (s.phase === 'waiting' && s.seats[0] && s.seats[1] && this.allHere()) this.startSeries(now);
  }

  /**
   * Leaving a friend room before the match starts. The friend who joined gets their seat
   * back and both stakes are returned, so the host can invite someone else. The host
   * leaving closes the room.
   */
  private async leaveRoom(seat: 0 | 1, now: number) {
    const s = this.state!;
    if (seat === 0 || !s.seats[1]) return this.abort(now);
    if (s.escrow) await this.refundAll(now);
    s.seats[1] = null;
    s.escrow = false;
    this.ctx.waitUntil(this.ctx.storage.put('state', s));
    this.sync();
  }

  /** What the host's watch sockets are told about the room. */
  private roomStatus(): RoomStatus {
    const s = this.state;
    const g = s?.seats[1];
    return { t: 'room', open: !!s && s.phase === 'waiting', guest: g ? { name: g.name, avatar: g.avatar, print: g.print, state: g.state } : null, stake: s?.stake ?? 0 };
  }

  private watchers() {
    return this.ctx.getWebSockets('watch').filter((ws) => ws.readyState === OPEN);
  }

  private tellWatchers(msg: RoomStatus) {
    const text = JSON.stringify(msg);
    for (const ws of this.watchers()) {
      try { ws.send(text); } catch { /* closing */ }
    }
  }

  /**
   * Someone came back to the app between games. If they hadn't tapped Next game yet, their
   * waiting time starts again, so they don't lose the match the moment they return. If both
   * had already tapped it, the next game starts now.
   */
  private returned(seat: 0 | 1, now: number) {
    const s = this.state!;
    if (s.phase !== 'between') return;
    if (!s.ready[seat] && s.readyAt) s.readyAt = now;
    if (s.ready[0] && s.ready[1] && this.allHere()) this.nextGame(now);
  }

  /**
   * Leaving the app pauses the match: the turn clock freezes with whatever was left on it,
   * and nobody can move. When everyone is back it restarts, with a few seconds at least.
   */
  private updatePause(now: number) {
    const s = this.state!;
    if (s.phase !== 'playing') return;
    if (!this.allHere()) {
      if (s.pausedLeft === null && s.turnEndsAt) {
        s.pausedLeft = Math.max(0, s.turnEndsAt - now);
        s.turnEndsAt = null;
      }
    } else if (s.pausedLeft !== null) {
      s.turnEndsAt = now + Math.max(s.pausedLeft, RESUME_MIN_MS);
      s.pausedLeft = null;
      if (s.turn && this.seatOf(s.turn) === this.botIndex()) this.scheduleBot();
    }
  }

  private botIndex(): 0 | 1 | -1 {
    return this.state!.seats.findIndex((p) => p?.bot) as 0 | 1 | -1;
  }

  private place(seat: 0 | 1, i: number, now: number) {
    const s = this.state!;
    const v = this.variant();
    const mark = this.markOf(seat);
    const threat = s.kind === 'bot' && seat === this.botIndex() ? findWin(s.board, s.hist, other(mark), v) : -1;

    const next = place(s.board, s.hist, i, mark, v);
    s.board = next.board;
    s.hist = v.fade ? next.hist : emptyHist();
    s.removed = next.removed;
    s.moves.push(i);

    const o = outcomeAfter(s.board, i, mark, v, s.moves.length);
    if (o?.kind === 'win') return this.endGame(o.mark, 'line', o.line, now);
    if (o?.kind === 'draw') return this.endGame(null, 'draw', null, now);

    s.turn = other(mark);
    s.turnEndsAt = now + this.turnMs();
    this.sync();

    if (s.kind === 'bot') {
      if (seat === this.botIndex()) {
        // Talk after his own move: a block gets a comment, anything else now and then.
        if (threat === i) this.say(line(LINES.block));
        else if (Math.random() < 0.15) this.say(line(LINES.move));
      } else {
        this.scheduleBot();
      }
    }
  }

  private scheduleBot() {
    const s = this.state!;
    const game = s.game;
    const count = s.moves.length;
    // A short think so it feels like a player. The pending timer keeps the object awake for
    // about a second, which costs almost nothing.
    const think = 550 + Math.random() * 600 + (MODES[s.mode].n > 3 ? 300 : 0);
    setTimeout(() => this.botTurn(game, count), think);
  }

  private botTurn(game: number, count: number) {
    const s = this.state;
    if (!s || s.phase !== 'playing' || s.pausedLeft !== null || s.game !== game || s.moves.length !== count) return;
    const seat = this.botIndex();
    if (seat === -1) return;
    const mark = this.markOf(seat);
    if (s.turn !== mark) return;
    const i = botMove(s.board, s.hist, mark, this.variant(), s.level ?? 'sharp');
    if (i >= 0) this.place(seat, i, Date.now());
  }

  /** Enforces the clocks. Only acts if the server's own clock agrees time is up. */
  private claim(by: 0 | 1, now: number) {
    const s = this.state!;
    const opp = s.seats[1 - by];

    if (s.phase === 'waiting') {
      // A quick match where the other player never arrived. Nobody is rated, stakes go back.
      if (s.kind === 'quick' && now - s.createdAt >= ABANDON_MS) this.abort(now);
      return;
    }
    if (s.phase !== 'playing' && s.phase !== 'between') return;

    // Away too long: the player still here wins.
    if (opp && !here(opp) && opp.leftAt && now - opp.leftAt >= AWAY_MS - 500) {
      // Gone before anything happened: call it off rather than hand out a free win.
      if (s.game === 1 && s.moves.length < 2) return this.abort(now);
      s.result = { winner: this.markOf(by), line: null, reason: 'abandon' };
      return this.endSeries(by, 'abandon', now);
    }

    if (s.phase === 'between') {
      // You said Next game, they didn't, and they are still here: after a while you win.
      if (s.ready[by] && !s.ready[1 - by] && opp && here(opp) && s.readyAt && now - s.readyAt >= NEXT_WAIT_MS - 300) {
        return this.endSeries(by, 'idle', now);
      }
      return;
    }

    if (s.turnEndsAt && s.turn && now >= s.turnEndsAt - 300) {
      const late = s.turn;
      const seat = this.seatOf(late);
      const p = s.seats[seat]!;
      p.timeouts++;
      if (p.timeouts >= MAX_TIMEOUTS) return this.endGame(other(late), 'timeout', null, now);
      const free = legalMoves(s.board);
      this.place(seat, free[Math.floor(Math.random() * free.length)], now);
    }
  }

  private endGame(winner: Mark | null, reason: EndReason, line_: number[] | null, now: number) {
    const s = this.state!;
    s.result = { winner, line: line_, reason };
    s.turn = null;
    s.turnEndsAt = null;
    s.pausedLeft = null;
    s.record += (s.record ? '|' : '') + s.moves.join(',');
    if (winner) s.seats[this.seatOf(winner)]!.score++;
    else s.draws++;

    const bo = this.bestOf();
    const [a, b] = [s.seats[0]!.score, s.seats[1]!.score];
    const decided = a >= winsNeeded(bo) || b >= winsNeeded(bo) || s.game >= maxGames(bo);

    if (s.kind === 'bot' && !decided) {
      const botWon = winner !== null && this.seatOf(winner) === this.botIndex();
      this.say(line(winner === null ? LINES.draw : botWon ? LINES.win : LINES.lose));
    }

    if (decided) return this.endSeries(a > b ? 0 : b > a ? 1 : null, reason, now);

    s.phase = 'between';
    s.ready = [!!s.seats[0]?.bot, !!s.seats[1]?.bot];
    s.readyAt = null;
    this.sync();
  }

  /** Time for one move: the mode's clock, or a slow one in a new player's first match. */
  private turnMs() {
    const s = this.state!;
    return s.first ? FIRST_MATCH_TURN_MS : MODES[s.mode].turnMs;
  }

  /** Games in this series: the mode's series, or one for a new player's first match. */
  private bestOf() {
    const s = this.state!;
    return s.first ? 1 : MODES[s.mode].bo;
  }

  private endSeries(winner: 0 | 1 | null, reason: EndReason, now: number) {
    const s = this.state!;
    s.phase = 'over';
    s.turn = null;
    s.turnEndsAt = null;
    s.pausedLeft = null;
    s.ready = [false, false];
    s.readyAt = null;
    s.series = { winner, reason };
    s.rematch = [null, null];
    if (s.moves.length && !s.record.endsWith(s.moves.join(','))) s.record += (s.record ? '|' : '') + s.moves.join(',');
    this.sync();
    this.ctx.waitUntil(this.ctx.storage.put('state', s));

    if (s.kind === 'bot') {
      const bot = this.botIndex();
      this.say(line(winner === null ? LINES.seriesDraw : winner === bot ? LINES.seriesWin : LINES.seriesLose));
    }
    this.ctx.waitUntil(this.report(now));
  }

  /** Called off before it really started. Nobody wins, nobody is rated, stakes go back. */
  private abort(now: number) {
    const s = this.state!;
    s.phase = 'over';
    s.turn = null;
    s.turnEndsAt = null;
    s.pausedLeft = null;
    s.result = { winner: null, line: null, reason: 'aborted' };
    s.series = { winner: null, reason: 'aborted' };
    this.sync();
    this.ctx.waitUntil(this.ctx.storage.put('state', s));
    if (s.escrow) this.ctx.waitUntil(this.refundAll(now));
  }

  private async refundAll(now = Date.now()) {
    const s = this.state!;
    if (!s.escrow) return;
    s.escrow = false;
    const ids = s.seats.filter((p): p is Seat => !!p && !p.bot).map((p) => ({ id: p.id, amount: s.stake }));
    try {
      await refund(this.env.DB, s.id, ids, now);
    } catch (err) {
      console.error('Could not refund stakes', s.id, err);
    }
  }

  /**
   * A rematch, the same game or a different one. Against Baba Ayo it starts straight away,
   * and can change his level. Between two players, each one asks for a mode and stake, and
   * it starts when both ask for the same thing. A rematch can keep the stake or switch to a
   * friend-room stake (up to 1,000), so high tables still go through the matchmaker's checks.
   */
  private async rematch(seat: 0 | 1, m: { mode?: ModeId; stake?: number; level?: BotLevel }, now: number) {
    const s = this.state!;
    if (s.phase !== 'over' || s.series?.reason === 'aborted') return;
    const mode = isModeId(m.mode) ? m.mode : s.mode;

    if (s.kind === 'bot') {
      const bot = this.botIndex();
      // The first match ends once the player wins, or picks a different game or level.
      if (s.first) {
        const humanWon = s.series?.winner !== null && s.series?.winner !== undefined && s.series.winner !== bot;
        if (humanWon || isModeId(m.mode) || isBotLevel(m.level)) s.first = undefined;
      }
      if (isBotLevel(m.level) && bot !== -1) {
        s.level = m.level;
        Object.assign(s.seats[bot]!, { rating: BOT_RATING[m.level], level: BOT_SHOWN_LEVEL[m.level] });
      }
      s.mode = mode;
    } else {
      const opp = s.seats[1 - seat];
      if (!opp || !here(opp)) return;
      const stake = typeof m.stake === 'number' && (m.stake === s.stake || isFriendTable(m.stake)) ? m.stake : s.stake;
      s.rematch[seat] = { mode, stake };
      const theirs = s.rematch[1 - seat];
      if (!theirs || theirs.mode !== mode || theirs.stake !== stake) return this.sync();

      // Both asked for the same thing. Clear the asks before waiting on the database, so a
      // repeated message can't start the rematch, and take the stakes, a second time.
      s.rematch = [null, null];
      const ids = s.seats.map((p) => p!.id);
      // Someone banned since this match started can't play another series against a person.
      const banned = await bannedAmong(this.env.DB, ids);
      if (banned.length) {
        for (const p of s.seats) {
          if (!p) continue;
          this.sendTo(p.id, banned.includes(p.id)
            ? { t: 'error', code: 'banned', message: BANNED_MESSAGE }
            : { t: 'error', code: 'rematch-off', message: `${s.seats.find((q) => q && banned.includes(q.id))!.name} can't play a rematch right now.` });
        }
        return this.sync();
      }
      if (stake > 0) {
        const short = await takeStakes(this.env.DB, s.id, ids, stake, now);
        if (short.length) {
          const names = s.seats.filter((p) => p && short.includes(p.id)).map((p) => p!.name);
          this.send({ t: 'error', code: 'stake-short', message: `${names.join(' and ')} can't cover ${fmt(stake)} Dara Seeds for a rematch.` });
          return this.sync();
        }
        s.escrow = true;
      }
      s.mode = mode;
      s.stake = stake;
    }
    // Players swap who opens. In the first match the new player always opens.
    if (!s.first) s.seriesStarter = other(s.seriesStarter);
    this.startSeries(now);
    this.sync();
  }

  /** Writes the series to D1, settles the pot and tells each player what they earned. */
  private async report(now: number) {
    const s = this.state!;
    if (s.series?.reason === 'aborted') return;
    // A rematch can start while this waits on the database, so everything about this series is
    // read now, before the first wait.
    const { kind, mode, level } = s;
    const humans = ([0, 1] as const).filter((i) => s.seats[i] && !s.seats[i]!.bot);
    const winner = s.series?.winner ?? null;
    const resultFor = (seat: 0 | 1): Result => (winner === null ? 'draw' : winner === seat ? 'win' : 'loss');

    // The stakes are settled exactly once, here.
    const held = s.escrow ? s.stake : 0;
    s.escrow = false;
    const payoutFor = (r: Result) => (!held ? 0 : r === 'win' ? prize(held) : r === 'draw' ? held : 0);

    const before = new Map(humans.map((i) => [i, { rating: s.seats[i]!.rating, level: s.seats[i]!.level }]));
    const inputs: SeriesInput[] = humans.map((i) => {
      const me = s.seats[i]!;
      const opp = s.seats[1 - i]!;
      const result = resultFor(i);
      return {
        id: me.id,
        result,
        aura: auraFor(s.kind, result, s.level),
        rating: s.kind === 'quick' ? Math.max(MIN_RATING, me.rating + eloDelta(me.rating, opp.rating, result)) : null,
        payout: payoutFor(result),
        back: false,
        online: s.kind !== 'bot',
        quick: s.kind === 'quick',
        stake: held,
      };
    });

    const record = s.kind === 'bot' ? null : {
      id: s.id,
      mode: s.mode,
      kind: s.kind,
      stake: held,
      xId: s.seats[0]!.id,
      oId: s.seats[1]!.id,
      winner: winner === null ? null : this.markOf(winner),
      reason: s.series?.reason ?? 'line',
      score: `${s.seats[0]!.score}-${s.seats[1]!.score}`,
      moves: s.record,
      paid: true,
    };

    // The farming rules (worker/safety.ts). If one applies, both stakes go back and the win still counts.
    let back: StakeBack | null = null;
    if (held && winner !== null && record) {
      const loser = s.seats[1 - winner]!;
      // Games finished before the one that ended the series. A line, a draw or a timeout counts
      // the last game in the score; a resign, a walk-off or an idle ending doesn't.
      const lastCounted = record.reason === 'line' || record.reason === 'draw' || record.reason === 'timeout';
      const settle = {
        winnerId: s.seats[winner]!.id,
        loserId: loser.id,
        stake: held,
        reason: record.reason,
        // Rooms saved before the rule have no count, so the rule doesn't apply to them.
        loserMoves: loser.played ?? QUICK_QUIT_MOVES,
        gamesBefore: s.seats[0]!.score + s.seats[1]!.score + s.draws - (lastCounted ? 1 : 0),
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          back = await stakeBack(this.env.DB, settle, now);
          break;
        } catch (err) {
          // Twice failing means the database is down, and the result below won't save either.
          console.error('Could not check the farming rules', s.id, attempt, err);
        }
      }
      if (back) {
        for (const input of inputs) Object.assign(input, { payout: held, back: true });
        record.paid = false;
      }
    }

    let out: Awaited<ReturnType<typeof recordSeries>> | null = null;
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      try {
        out = await recordSeries(this.env.DB, inputs, record, now);
      } catch (err) {
        // The match still ended for both players. Only the stats are missing, and the log says why.
        console.error('Could not record result', s.id, attempt, err);
      }
    }
    if (!out) return;

    for (const [k, i] of humans.entries()) {
      const seat = s.seats[i]!;
      const row = out.get(seat.id);
      if (!row) continue;
      const input = inputs[k];
      const prev = before.get(i)!;
      const opp = s.seats[1 - i]!;
      // Streak, quests, badges, the streak stake and the weekly league. If this fails, the
      // match result above still stands.
      const habits = await afterMatch(
        this.env.DB,
        seat.id,
        { kind, mode, result: input.result, level, oppState: opp.bot ? undefined : opp.state },
        { aura: input.aura + row.goalBonus, dayWinsBefore: row.dayWins - (input.result === 'win' ? 1 : 0) },
        now,
      ).catch((err) => {
        console.error('Could not save habits', s.id, err);
        return null;
      });
      const auraTotal = habits?.aura ?? row.aura;
      const levelAfter = levelInfo(auraTotal).level;
      seat.rating = row.rating;
      seat.level = levelAfter;
      this.sendTo(seat.id, {
        t: 'reward',
        r: {
          result: input.result,
          aura: input.aura,
          goalBonus: row.goalBonus,
          auraTotal,
          levelBefore: levelInfo(row.aura - input.aura - row.goalBonus).level,
          levelAfter,
          ratingBefore: prev.rating,
          ratingAfter: row.rating,
          cowries: input.payout - held,
          back: back ?? undefined,
          daily: row.daily,
          cowriesTotal: habits?.cowries ?? row.cowries,
          dayStreak: habits?.streak ?? row.dayStreak,
          dayWins: row.dayWins,
          winStreak: row.winStreak,
          habits: habits
            ? (({ aura: _a, cowries: _c, ...rest }) => rest)(habits)
            : undefined,
        },
      });
    }
    this.sync();
  }

  /* ------------------------------------------------------------------ sending */

  private view(you: 0 | 1 | null): MatchView {
    const s = this.state!;
    const v = this.variant();
    const first = s.seats[0];
    return {
      id: s.id,
      kind: s.kind,
      mode: s.mode,
      level: s.level,
      bo: this.bestOf(),
      first: !!s.first,
      stake: s.stake,
      phase: s.phase,
      game: s.game,
      board: s.board,
      hist: s.hist,
      turn: s.turn,
      fading: s.phase === 'playing' && s.turn ? fadingNext(s.hist, s.turn, v) : null,
      seats: s.seats.map((p, i) => {
        if (!p) return null;
        // Both picked the same piece: the second seat shows its pair, so the board stays readable.
        const piece = i === 1 && first && p.piece === first.piece ? pairOf(p.piece) : p.piece;
        return {
          id: p.id, name: p.name, avatar: p.avatar, piece, print: p.print, state: p.state, rating: p.rating,
          level: p.level, bot: p.bot, mark: this.markOf(i as 0 | 1), connected: here(p), leftAt: p.leftAt, score: p.score,
        };
      }) as MatchView['seats'],
      you,
      turnEndsAt: s.turnEndsAt,
      paused: s.pausedLeft !== null || (s.phase === 'between' && !this.allHere()),
      pausedLeft: s.pausedLeft,
      ready: s.ready,
      readyAt: s.readyAt,
      lastMove: s.moves.at(-1) ?? null,
      removed: s.removed,
      result: s.result,
      series: s.series,
      rematch: s.rematch,
      draws: s.draws,
      waitingOn: this.waitingOn(you),
      now: Date.now(),
    };
  }

  /** In a friend room that hasn't started: where the other player is. */
  private waitingOn(you: 0 | 1 | null): MatchView['waitingOn'] {
    const s = this.state!;
    const opp = you === null ? null : s.seats[1 - you];
    if (s.phase !== 'waiting' || s.kind !== 'friend' || !opp || here(opp)) return null;
    if (opp.connected) return 'away';
    return 1 - you! === 0 && this.watchers().length ? 'told' : 'closed';
  }

  /** Saves the state onto every socket and sends each player their own view of it. */
  private sync(except?: WebSocket) {
    const s = this.state;
    if (!s) return;
    s.v++;
    for (const ws of this.live(except)) {
      const a = this.att(ws)!;
      try {
        ws.serializeAttachment({ pid: a.pid, seat: a.seat, s } satisfies Attachment);
      } catch {
        // Attachments have a size cap. A long Pro game can get near it, so storage is the fallback.
        this.ctx.waitUntil(this.ctx.storage.put('state', s));
      }
      try { ws.send(JSON.stringify({ t: 'state', s: this.view(a.seat) } satisfies ServerMsg)); } catch { /* closing */ }
    }
    if (s.kind === 'friend') this.tellWatchers(this.roomStatus());
  }

  private send(msg: ServerMsg, except?: WebSocket) {
    const text = JSON.stringify(msg);
    for (const ws of this.live(except)) {
      try { ws.send(text); } catch { /* closing */ }
    }
  }

  private sendTo(pid: string, msg: ServerMsg) {
    const text = JSON.stringify(msg);
    for (const ws of this.live()) {
      if (this.att(ws)?.pid === pid) try { ws.send(text); } catch { /* closing */ }
    }
  }

  private say(text: string) {
    this.send({ t: 'say', text });
  }

  private bad(ws: WebSocket) {
    try { ws.send(JSON.stringify({ t: 'error', code: 'bad-move', message: 'That move is not allowed.' } satisfies ServerMsg)); } catch { /* closing */ }
    // Send the real state so a browser that got ahead of itself snaps back.
    const a = this.att(ws);
    if (a) try { ws.send(JSON.stringify({ t: 'state', s: this.view(a.seat) } satisfies ServerMsg)); } catch { /* closing */ }
  }
}
