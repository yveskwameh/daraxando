/**
 * Baba Ayo, the game's bot. Three levels:
 * - Jeje plays loosely and often misses a block.
 * - Sharp-sharp takes wins, blocks most lines and builds its own.
 * - Agba never misses. On a plain 3×3 board it plays perfectly and cannot lose. In Fading
 *   it searches a few moves ahead, and on big boards it weighs every line on the board.
 */
import {
  findWin, legalMoves, lineThrough, other, place, type Board, type Hist, type Mark, type Variant,
} from './rules';

export type BotLevel = 'jeje' | 'sharp' | 'agba';
export const BOT_LEVELS = ['jeje', 'sharp', 'agba'] as const;
export const isBotLevel = (x: unknown): x is BotLevel => x === 'jeje' || x === 'sharp' || x === 'agba';

export const BOT_LEVEL_INFO: Record<BotLevel, { name: string; note: string }> = {
  jeje: { name: 'Jeje', note: 'Easy. He takes it slow.' },
  sharp: { name: 'Sharp-sharp', note: 'Medium. He blocks most of your lines.' },
  agba: { name: 'Agba', note: 'Hard. On a 3×3 board he never loses.' },
};

/** How often a level makes a careless move instead of the right one. */
const SLOPPY: Record<BotLevel, number> = { jeje: 0.5, sharp: 0.18, agba: 0 };

const pick = <T>(list: T[], rng: () => number) => list[Math.floor(rng() * list.length)];

export function botMove(board: Board, hist: Hist, me: Mark, v: Variant, level: BotLevel, rng: () => number = Math.random): number {
  const free = legalMoves(board);
  if (free.length === 0) return -1;
  const sloppy = SLOPPY[level];
  const them = other(me);

  const win = findWin(board, hist, me, v);
  if (win >= 0 && rng() >= sloppy / 3) return win;

  const block = findWin(board, hist, them, v);
  if (block >= 0 && rng() >= sloppy) return block;

  if (sloppy && rng() < sloppy) return pick(free, rng);

  if (level === 'agba' && v.n === 3) {
    const best = v.fade ? searchFading(board, hist, me, v, 5) : perfect(board, me, v);
    if (best.length) return pick(best, rng);
  }
  return heuristic(board, me, v, rng);
}

/** Every best move on a plain 3×3 board, found by full minimax with alpha-beta pruning. */
export function perfect(board: Board, me: Mark, v: Variant): number[] {
  const free = legalMoves(board);
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of free) {
    const b = board.slice();
    b[i] = me;
    const score = lineThrough(b, i, me, v.n, v.k) ? 10 : -negamax(b, other(me), v, 1, -Infinity, Infinity);
    if (score > best) { best = score; moves = [i]; } else if (score === best) moves.push(i);
  }
  return moves;
}

function negamax(board: Board, toMove: Mark, v: Variant, depth: number, alpha: number, beta: number): number {
  const free = legalMoves(board);
  if (free.length === 0) return 0;
  let best = -Infinity;
  for (const i of free) {
    board[i] = toMove;
    const score = lineThrough(board, i, toMove, v.n, v.k)
      ? 10 - depth
      : -negamax(board, other(toMove), v, depth + 1, -beta, -alpha);
    board[i] = null;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Fading never ends on a full board, so look a fixed number of moves ahead instead. */
function searchFading(board: Board, hist: Hist, me: Mark, v: Variant, depth: number): number[] {
  const free = legalMoves(board);
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of free) {
    const next = place(board, hist, i, me, v);
    const score = lineThrough(next.board, i, me, v.n, v.k)
      ? 100
      : -fadeNegamax(next.board, next.hist, other(me), v, depth - 1, 1, -Infinity, Infinity);
    if (score > best) { best = score; moves = [i]; } else if (score === best) moves.push(i);
  }
  return moves;
}

function fadeNegamax(board: Board, hist: Hist, toMove: Mark, v: Variant, depth: number, ply: number, alpha: number, beta: number): number {
  if (depth === 0) return 0;
  let best = -Infinity;
  for (const i of legalMoves(board)) {
    const next = place(board, hist, i, toMove, v);
    const score = lineThrough(next.board, i, toMove, v.n, v.k)
      ? 100 - ply
      : -fadeNegamax(next.board, next.hist, other(toMove), v, depth - 1, ply + 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

/**
 * For bigger boards: score each square by the lines it would extend for us and cut for the
 * other side, favouring open lines (room to grow at both ends) and the centre.
 */
function heuristic(board: Board, me: Mark, v: Variant, rng: () => number): number {
  const { n, k } = v;
  const mid = (n - 1) / 2;
  const them = other(me);
  let bestScore = -Infinity;
  let best: number[] = [];

  for (const i of legalMoves(board)) {
    const r = Math.floor(i / n);
    const c = i % n;
    let score = -(Math.abs(r - mid) + Math.abs(c - mid)) * 0.4;

    for (const [dr, dc] of DIRS) {
      for (const who of [me, them]) {
        let run = 0;
        let open = 0;
        for (const s of [1, -1]) {
          let rr = r + dr * s;
          let cc = c + dc * s;
          while (rr >= 0 && rr < n && cc >= 0 && cc < n && board[rr * n + cc] === who) {
            run++;
            rr += dr * s;
            cc += dc * s;
          }
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && board[rr * n + cc] === null) open++;
        }
        if (run === 0) continue;
        // A run that cannot reach k because both ends are blocked is worth little.
        const weight = open === 0 && run + 1 < k ? 0.3 : open === 2 ? 1.6 : 1;
        score += (who === me ? 3 : 2.6) * run * run * weight;
        // Stop the other side getting an open run of k - 1, which can't be blocked twice.
        if (who === them && open === 2 && run >= k - 2) score += 12;
      }
    }

    score += rng() * 0.3;
    if (score > bestScore + 1e-9) { bestScore = score; best = [i]; } else if (Math.abs(score - bestScore) < 1e-9) best.push(i);
  }
  return pick(best, rng);
}
