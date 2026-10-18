/**
 * Playing Baba Ayo without internet (docs/NEXT-ROUND.md, step 8; Yves, 18 October 2026).
 *
 * While online, the phone collects one-use passes from the server. A pass sets Baba Ayo's dice
 * for one offline match, so the phone and the server work out exactly the same moves for him.
 * The phone plays the match with the same rules as the server, keeps each finished game on the
 * phone, and sends the games one by one when the connection returns. The server replays every
 * move of a game here, with the same dice, before it counts, then records the match exactly as
 * if it had been played online. One game per request, because a whole Classic match can run to
 * seven games, too much to replay inside the free plan's 10 ms.
 *
 * Offline matches have no turn clock, so a game is just its moves. Baba Ayo is always O and the
 * player X, as online.
 *
 * The lawyer approved the privacy notice lines for it on 18 October 2026 (docs/NEXT-ROUND.md,
 * step 6), so it's on everywhere (OFFLINE_ON_REAL_GAME in shared/passes.ts).
 */
import { botMove, type BotLevel } from './bot';
import { maxGames, MODES, variantOf, winsNeeded, type ModeId } from './modes';
import { emptyBoard, emptyHist, other, outcomeAfter, place, type Cell, type Hist, type Mark } from './rules';

export { OFFLINE_ON_REAL_GAME, PASS_DAYS, PASS_KEEP_DAYS, PASS_MAX, type Pass } from './passes';

/** Longest list of moves one game can have: Fading is called a draw at 30, 7×7 fills at 49. */
const MAX_MOVES = 49;

/** Who opens each game: the series' opener in odd games, the other side in even ones (as online). */
export const openerOf = (seriesStarter: Mark, game: number): Mark => (game % 2 === 1 ? seriesStarter : other(seriesStarter));

/** Baba Ayo's dice for one move: the same numbers on any phone and on the server (mulberry32). */
export function diceFor(seed: number, game: number, ply: number) {
  let a = (seed ^ Math.imul(game, 0x9e3779b1) ^ Math.imul(ply + 1, 0x85ebca77)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GameInput {
  mode: ModeId;
  level: BotLevel;
  seed: number;
  /** Who opened game 1 of the match. */
  starter: Mark;
  /** 1 for the first game of the match. */
  game: number;
  moves: number[];
}

export interface GamePlayed {
  /** Every move was legal and every one of Baba Ayo's was his. */
  ok: boolean;
  board: Cell[];
  hist: Hist;
  /** Whose move it is, or null once the game is over. */
  turn: Mark | null;
  removed: number | null;
  lastMove: number | null;
  /** How the game ended, if it has. */
  end: { winner: Mark | null; line: number[] | null } | null;
}

/**
 * Plays one game's moves from an empty board, checking each one. Stops at the first bad move.
 * The phone passes `trust` for its own moves, which skips working out Baba Ayo's moves again.
 */
export function playGame(g: GameInput, trust = false): GamePlayed {
  const v = variantOf(g.mode);
  let board = emptyBoard(v.n);
  let hist = emptyHist();
  let turn: Mark | null = openerOf(g.starter, g.game);
  let removed: number | null = null;
  let lastMove: number | null = null;
  let end: GamePlayed['end'] = null;
  const bad = (): GamePlayed => ({ ok: false, board, hist, turn, removed, lastMove, end });
  if (!Array.isArray(g.moves) || g.moves.length > MAX_MOVES) return bad();
  for (let k = 0; k < g.moves.length; k++) {
    const i = g.moves[k];
    if (end || !turn) return bad();
    if (!Number.isInteger(i) || i < 0 || i >= board.length || board[i] !== null) return bad();
    if (!trust && turn === 'O' && i !== botMove(board, hist, 'O', v, g.level, diceFor(g.seed, g.game, k))) return bad();
    const next = place(board, hist, i, turn, v);
    board = next.board;
    hist = v.fade ? next.hist : emptyHist();
    removed = next.removed;
    lastMove = i;
    const o = outcomeAfter(board, i, turn, v, k + 1);
    if (o?.kind === 'win') end = { winner: o.mark, line: o.line };
    else if (o?.kind === 'draw') end = { winner: null, line: null };
    turn = end ? null : other(turn);
  }
  return { ok: true, board, hist, turn, removed, lastMove, end };
}

/** Baba Ayo's next move in a game in progress, with the match's dice. */
export function babaMove(g: GameInput, played: GamePlayed) {
  return botMove(played.board, played.hist, 'O', variantOf(g.mode), g.level, diceFor(g.seed, g.game, g.moves.length));
}

/** A finished game as the server keeps it until the match is counted: X won, O won, D a draw, R the player left. */
export type GameMark = 'X' | 'O' | 'D' | 'R';

export interface MatchSoFar {
  score: [number, number];
  draws: number;
  /** The match is over. */
  decided: boolean;
  /** Who took the match once it's over: 0 the player, 1 Baba Ayo, null a draw. */
  winner: 0 | 1 | null;
  resigned: boolean;
}

/** Where a match stands after these games, by the same rules as online (best of N, draws don't count). */
export function matchSoFar(mode: ModeId, games: GameMark[]): MatchSoFar {
  const bo = MODES[mode].bo;
  const score: [number, number] = [0, 0];
  let draws = 0;
  let resigned = false;
  for (const g of games) {
    if (g === 'X') score[0]++;
    else if (g === 'O') score[1]++;
    else if (g === 'D') draws++;
    else resigned = true;
  }
  const decided = resigned || score[0] >= winsNeeded(bo) || score[1] >= winsNeeded(bo) || score[0] + score[1] + draws >= maxGames(bo);
  const winner = resigned ? 1 : score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : null;
  return { score, draws, decided, winner: decided ? winner : null, resigned };
}

/** The mark for a game that ended. */
export const markOf = (end: NonNullable<GamePlayed['end']>): GameMark => end.winner ?? 'D';
