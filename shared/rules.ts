/**
 * The rules of every mode, used by the server to judge moves and by the browser to show
 * them early. Boards are flat arrays, row by row: square i is row floor(i / n), column i % n.
 * X always belongs to the first seat and O to the second. Who starts alternates each game,
 * so the turn is tracked by the match, not worked out from the board.
 */
import { FADE_DRAW_MOVES } from './modes';

export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Board = Cell[];

export interface Variant {
  n: number;
  k: number;
  /** Pieces each player keeps. 0 means no limit. */
  fade: number;
}

/** Each player's squares, oldest first. Fading needs to know which piece goes next. */
export interface Hist { X: number[]; O: number[] }

export const other = (m: Mark): Mark => (m === 'X' ? 'O' : 'X');
export const emptyBoard = (n: number): Board => Array<Cell>(n * n).fill(null);
export const emptyHist = (): Hist => ({ X: [], O: [] });

export const isIndex = (i: unknown, n: number): i is number =>
  typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < n * n;

export const legalMoves = (board: Board) => board.flatMap((c, i) => (c ? [] : [i]));

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

/** The full run of `mark` through square i if it is k or longer, in board order. Otherwise null. */
export function lineThrough(board: Board, i: number, mark: Mark, n: number, k: number): number[] | null {
  if (board[i] !== mark) return null;
  const r = Math.floor(i / n);
  const c = i % n;
  for (const [dr, dc] of DIRS) {
    const run = [i];
    for (const s of [1, -1]) {
      let rr = r + dr * s;
      let cc = c + dc * s;
      while (rr >= 0 && rr < n && cc >= 0 && cc < n && board[rr * n + cc] === mark) {
        run.push(rr * n + cc);
        rr += dr * s;
        cc += dc * s;
      }
    }
    if (run.length >= k) return run.sort((a, b) => a - b);
  }
  return null;
}

/** The piece that disappears if `mark` moves next in Fading, or null. */
export function fadingNext(hist: Hist, mark: Mark, v: Variant): number | null {
  return v.fade && hist[mark].length >= v.fade ? hist[mark][0] : null;
}

/** Puts a piece down without changing the inputs. In Fading your oldest piece goes first. */
export function place(board: Board, hist: Hist, i: number, mark: Mark, v: Variant) {
  const b = board.slice();
  const h: Hist = { X: hist.X.slice(), O: hist.O.slice() };
  let removed: number | null = null;
  if (v.fade && h[mark].length >= v.fade) {
    removed = h[mark].shift()!;
    b[removed] = null;
  }
  b[i] = mark;
  h[mark].push(i);
  return { board: b, hist: h, removed };
}

export type Outcome = { kind: 'win'; mark: Mark; line: number[] } | { kind: 'draw' } | null;

/**
 * What a move just did. A win needs a line through the square just played. A normal board
 * that is full is a draw, and so is a Fading game that has gone on too long.
 */
export function outcomeAfter(board: Board, i: number, mark: Mark, v: Variant, moveCount: number): Outcome {
  const line = lineThrough(board, i, mark, v.n, v.k);
  if (line) return { kind: 'win', mark, line };
  if (v.fade ? moveCount >= FADE_DRAW_MOVES : board.every(Boolean)) return { kind: 'draw' };
  return null;
}

/** Every square where `mark` would complete a line right now. */
export function winningMoves(board: Board, hist: Hist, mark: Mark, v: Variant): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i]) continue;
    const next = place(board, hist, i, mark, v);
    if (lineThrough(next.board, i, mark, v.n, v.k)) out.push(i);
  }
  return out;
}

export const findWin = (board: Board, hist: Hist, mark: Mark, v: Variant) => winningMoves(board, hist, mark, v)[0] ?? -1;

/** "Row 2, column 3" for screen readers. */
export const squareName = (i: number, n: number) => `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;
