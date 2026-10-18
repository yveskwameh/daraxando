/**
 * A Baba Ayo match played on the phone, without internet (shared/offline.ts; Yves, 18 October
 * 2026). It gives the match screen the same view and takes the same messages as a match on the
 * server (src/lib/useMatch.ts), so the screen doesn't need to know the difference. The rules,
 * Baba Ayo and his lines are the server's own (shared/), and his dice come from a one-use pass,
 * so the server can replay every game exactly once the phone is back online.
 *
 * The match is kept in localStorage as it goes, so closing the app doesn't lose it. Each
 * finished game goes into the outbox straight away (src/lib/offlineSync.ts). No turn clock.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LINES, line } from '../../shared/baba';
import type { BotLevel } from '../../shared/bot';
import { MODES, variantOf, type ModeId } from '../../shared/modes';
import { babaMove, markOf, matchSoFar, playGame, type GameInput, type GameMark, type Pass } from '../../shared/offline';
import { auraFor } from '../../shared/progression';
import { BOT, type ClientMsg, type MatchView, type Profile, type SeatView } from '../../shared/protocol';
import { fadingNext, findWin, other, type Mark } from '../../shared/rules';
import { keepSafe, queue, takePass } from './offlineSync';
import { usePlayer } from './session';
import { KEYS, store } from './storage';
import type { Said } from './useMatch';

interface Local {
  id: string;
  who: string;
  pass: Pass | null;
  mode: ModeId;
  level: BotLevel;
  /** Who opens game 1. Rematches swap it, as online. */
  starter: Mark;
  /** Each game's squares so far. The last one is the game in progress (or just finished). */
  games: number[][];
  resigned: boolean;
}

/** Baba Ayo's rating and shown level, as on the server (worker/match.ts). */
const BOT_RATING: Record<BotLevel, number> = { jeje: 900, sharp: 1200, agba: 1600 };
const BOT_SHOWN_LEVEL: Record<BotLevel, number> = { jeje: 3, sharp: 12, agba: 30 };

const load = (id: string): Local | null => {
  const l = store.json<Local | null>(KEYS.localMatch, null);
  return l && l.id === id ? l : null;
};
const keep = (l: Local) => store.set(KEYS.localMatch, JSON.stringify(l));

/** Starts an offline match and gives back its id. Uses a pass if there is one. */
export function startLocal(who: string, mode: ModeId, level: BotLevel) {
  const id = `off${crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 14)}`;
  const l: Local = { id, who, pass: takePass(who), mode, level, starter: 'X', games: [[]], resigned: false };
  keep(l);
  return { id, counts: !!l.pass };
}

/** Where the match stands, worked out from the moves. */
function standing(l: Local) {
  const marks: GameMark[] = [];
  const at = (g: number): GameInput => ({ mode: l.mode, level: l.level, seed: l.pass?.seed ?? 0, starter: l.starter, game: g, moves: l.games[g - 1] });
  for (let g = 1; g < l.games.length; g++) {
    const p = playGame(at(g), true);
    if (p.end) marks.push(markOf(p.end));
  }
  const n = l.games.length;
  const cur = playGame(at(n), true);
  if (cur.end) marks.push(markOf(cur.end));
  const so = matchSoFar(l.mode, l.resigned ? [...marks, 'R'] : marks);
  const phase: MatchView['phase'] = so.decided ? 'over' : cur.end ? 'between' : 'playing';
  return { so, cur, input: at(n), game: n, phase };
}

export function useLocalMatch(id: string) {
  const { profile } = usePlayer();
  const [l, setL] = useState<Local | null>(() => load(id));
  const [said, setSaid] = useState<Said | null>(null);
  const saidId = useRef(1_000_000);
  const talk = useCallback((text: string) => setSaid({ id: saidId.current++, seat: 'bot', text }), []);

  const update = useCallback((next: Local) => {
    keep(next);
    setL(next);
  }, []);

  const st = useMemo(() => (l ? standing(l) : null), [l]);

  // A finished game goes into the outbox at once; the player leaving goes in as their last game.
  const send = useCallback((game: number, moves: number[], resign: boolean, m: Local) => {
    if (!m.pass) return;
    void queue({ who: m.who, pass: m.pass.id, mode: m.mode, level: m.level, starter: m.starter, game, moves, resign }).catch(() => {});
    keepSafe();
  }, []);

  /** A move on the board, by either side. Baba Ayo comments now and then, as online. */
  const play = useCallback(
    (m: Local, i: number, by: Mark) => {
      const s = standing(m);
      const threat = by === 'O' ? findWin(s.cur.board, s.cur.hist, 'X', variantOf(m.mode)) : -1;
      const games = m.games.map((g, k) => (k === m.games.length - 1 ? [...g, i] : g));
      const next = { ...m, games };
      update(next);
      const after = standing(next);
      if (after.cur.end) {
        send(after.game, games[after.game - 1], false, next);
        const botWon = after.cur.end.winner === 'O';
        if (after.phase === 'over') talk(line(after.so.winner === null ? LINES.seriesDraw : after.so.winner === 1 ? LINES.seriesWin : LINES.seriesLose));
        else talk(line(after.cur.end.winner === null ? LINES.draw : botWon ? LINES.win : LINES.lose));
      } else if (by === 'O') {
        if (threat === i) talk(line(LINES.block));
        else if (Math.random() < 0.15) talk(line(LINES.move));
      }
    },
    [update, send, talk],
  );

  // Baba Ayo's turn: a short think, then his move with the pass's dice.
  const pending = useRef('');
  useEffect(() => {
    if (!l || !st || st.phase !== 'playing' || st.cur.turn !== 'O') return;
    const key = `${l.id}:${st.game}:${st.input.moves.length}:${l.games.length}`;
    if (pending.current === key) return;
    pending.current = key;
    const think = 550 + Math.random() * 600 + (MODES[l.mode].n > 3 ? 300 : 0);
    const t = setTimeout(() => {
      pending.current = '';
      play(l, babaMove(st.input, st.cur), 'O');
    }, think);
    return () => {
      clearTimeout(t);
      pending.current = '';
    };
  }, [l, st, play]);

  // He says hello as each match starts.
  const greeted = useRef('');
  useEffect(() => {
    if (!l || l.games.length !== 1 || l.games[0].length || greeted.current === `${l.id}:${l.starter}`) return;
    greeted.current = `${l.id}:${l.starter}`;
    talk(line(l.starter === 'O' ? LINES.openerMe : LINES.openerYou));
  }, [l, talk]);

  const sendMsg = useCallback(
    (msg: ClientMsg) => {
      if (!l || !st) return;
      switch (msg.t) {
        case 'move':
          if (st.phase === 'playing' && st.cur.turn === 'X' && Number.isInteger(msg.i) && st.cur.board[msg.i] === null) play(l, msg.i, 'X');
          return;
        case 'next':
          if (st.phase === 'between') update({ ...l, games: [...l.games, []] });
          return;
        case 'resign':
          if (st.phase === 'over') return;
          // Left mid-game: that game's moves so far. Left between games: the next game, empty.
          send(st.phase === 'playing' ? st.game : st.game + 1, st.phase === 'playing' ? st.input.moves : [], true, l);
          update({ ...l, resigned: true });
          return;
        case 'rematch': {
          if (st.phase !== 'over') return;
          const mode = msg.mode && MODES[msg.mode] ? msg.mode : l.mode;
          const level = msg.level ?? l.level;
          update({ ...l, pass: takePass(l.who), mode, level, starter: other(l.starter), games: [[]], resigned: false });
          greeted.current = '';
          return;
        }
        case 'emote':
          if (Math.random() < 0.6) setTimeout(() => talk(line(LINES.emote)), 700 + Math.random() * 600);
          return;
        default:
          // No clock and nobody to wait for: 'claim', 'away' and 'back' mean nothing here.
          return;
      }
    },
    [l, st, play, update, send, talk],
  );

  const emote = useCallback(
    (seat: 0 | 1, e: string) => {
      setSaid({ id: saidId.current++, seat, text: e });
      sendMsg({ t: 'emote', e });
    },
    [sendMsg],
  );

  const view = useMemo((): MatchView | null => (l && st ? viewOf(l, st, profile) : null), [l, st, profile]);
  const over = st?.phase === 'over';
  const result = over && st ? (st.so.winner === null ? 'draw' : st.so.winner === 0 ? 'win' : 'loss') : null;

  return {
    view,
    status: 'open' as const,
    error: l ? null : { code: 'not-found' as const, message: 'That match is gone.' },
    notice: null as { id: number; message: string } | null,
    reward: null,
    said,
    send: sendMsg,
    emote,
    say: (_text: string) => {},
    serverNow: Date.now,
    clearReward: () => {},
    /** Once the match is over: whether it counts when sent, and the Aura it's worth. */
    offline: result && l ? { counts: !!l.pass, aura: auraFor('bot', result, l.level) } : null,
  };
}

function viewOf(l: Local, st: ReturnType<typeof standing>, me: Profile): MatchView {
  const v = variantOf(l.mode);
  const end = st.cur.end;
  const seat = (p: Omit<SeatView, 'mark' | 'connected' | 'leftAt' | 'score'>, mark: Mark, score: number): SeatView => ({ ...p, mark, connected: true, leftAt: null, score });
  const series = st.phase === 'over' ? { winner: st.so.winner, reason: l.resigned ? ('resign' as const) : end?.winner === null ? ('draw' as const) : ('line' as const) } : null;
  return {
    id: l.id,
    kind: 'bot',
    mode: l.mode,
    level: l.level,
    bo: MODES[l.mode].bo,
    first: false,
    typing: false,
    stake: 0,
    phase: st.phase,
    game: st.game,
    board: st.cur.board,
    hist: st.cur.hist,
    turn: st.phase === 'playing' ? st.cur.turn : null,
    fading: st.phase === 'playing' && st.cur.turn ? fadingNext(st.cur.hist, st.cur.turn, v) : null,
    seats: [
      seat({ id: me.id, name: me.name, avatar: me.avatar, piece: me.piece, print: me.print, state: me.state, rating: me.rating, level: me.level }, 'X', st.so.score[0]),
      seat({ ...BOT, rating: BOT_RATING[l.level], level: BOT_SHOWN_LEVEL[l.level], bot: true }, 'O', st.so.score[1]),
    ],
    you: 0,
    turnEndsAt: null,
    paused: false,
    pausedLeft: null,
    ready: [false, true],
    readyAt: null,
    lastMove: st.cur.lastMove,
    removed: st.cur.removed,
    result: l.resigned ? { winner: 'O', line: null, reason: 'resign' } : end ? { winner: end.winner, line: end.line, reason: end.winner === null ? 'draw' : 'line' } : null,
    series,
    rematch: [null, null],
    draws: st.so.draws,
    waitingOn: null,
    now: Date.now(),
  };
}
