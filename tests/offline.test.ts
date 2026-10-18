import { describe, expect, it } from 'vitest';
import { botMove } from '../shared/bot';
import { variantOf } from '../shared/modes';
import { babaMove, diceFor, matchSoFar, openerOf, playGame, type GameInput } from '../shared/offline';
import { legalMoves } from '../shared/rules';

/** Plays a whole game the way the phone does: the player picks with `pick`, Baba Ayo with his dice. */
function playOut(g: GameInput, pick: (free: number[], k: number) => number) {
  for (let k = 0; k < 200; k++) {
    const p = playGame(g);
    if (!p.turn) return p;
    if (p.turn === 'O') g.moves.push(babaMove(g, p));
    else {
      const free = legalMoves(p.board);
      g.moves.push(pick(free, k));
    }
  }
  throw new Error('game never ended');
}

describe('playing Baba Ayo offline (Yves, 18 October 2026)', () => {
  it('rolls the same dice for the same pass, game and move, and different ones otherwise', () => {
    const a = diceFor(123456, 2, 5);
    const b = diceFor(123456, 2, 5);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    for (const x of first) expect(x >= 0 && x < 1).toBe(true);
    expect(diceFor(123456, 2, 6)()).not.toBe(first[0]);
    expect(diceFor(123457, 2, 5)()).not.toBe(first[0]);
  });

  it('opens with the match opener in odd games and the other side in even ones', () => {
    expect([1, 2, 3, 4].map((g) => openerOf('X', g))).toEqual(['X', 'O', 'X', 'O']);
    expect([1, 2].map((g) => openerOf('O', g))).toEqual(['O', 'X']);
  });

  it('a game played on the phone checks out on the server, in every mode and level', () => {
    for (const mode of ['fading', 'classic', 'big', 'pro'] as const) {
      for (const level of ['jeje', 'sharp', 'agba'] as const) {
        for (const game of [1, 2]) {
          const g: GameInput = { mode, level, seed: 987654321 + game, starter: 'X', game, moves: [] };
          const end = playOut(g, (free, k) => free[(k * 7) % free.length]);
          expect(end.end, `${mode} ${level}`).not.toBeNull();
          const check = playGame({ ...g, moves: [...g.moves] });
          expect(check.ok, `${mode} ${level}`).toBe(true);
          expect(check.end).toEqual(end.end);
        }
      }
    }
  });

  it('turns away a game where a move was changed, a square reused, or a move added after the end', () => {
    const g: GameInput = { mode: 'big', level: 'sharp', seed: 42, starter: 'X', game: 1, moves: [] };
    playOut(g, (free) => free[0]);
    // One of Baba Ayo's moves (O moves second when X opens) changed to another free square.
    const changed = [...g.moves];
    const at = 1;
    const before = playGame({ ...g, moves: changed.slice(0, at) });
    const other = legalMoves(before.board).find((i) => i !== changed[at])!;
    changed[at] = other;
    expect(playGame({ ...g, moves: changed }).ok).toBe(false);
    // A square used twice.
    expect(playGame({ ...g, moves: [g.moves[0], g.moves[0]] }).ok).toBe(false);
    // A square off the board, and not a whole number.
    expect(playGame({ ...g, moves: [99] }).ok).toBe(false);
    expect(playGame({ ...g, moves: [1.5] }).ok).toBe(false);
    // A move after the game ended.
    const free = legalMoves(playGame(g).board);
    if (free.length) expect(playGame({ ...g, moves: [...g.moves, free[0]] }).ok).toBe(false);
  });

  it('turns away a game played with other dice than the pass gave', () => {
    // Jeje rolls dice on most moves, so a different seed changes his moves.
    let caught = 0;
    for (let s = 1; s <= 10; s++) {
      const g: GameInput = { mode: 'fading', level: 'jeje', seed: s, starter: 'X', game: 1, moves: [] };
      playOut(g, (f, k) => f[(k * 3) % f.length]);
      if (!playGame({ ...g, seed: s + 1000 }).ok) caught++;
    }
    expect(caught).toBeGreaterThanOrEqual(8);
  });

  it('plays Baba Ayo exactly as he plays online, given the same dice', () => {
    const g: GameInput = { mode: 'classic', level: 'agba', seed: 7, starter: 'O', game: 1, moves: [] };
    const p = playGame(g);
    expect(babaMove(g, p)).toBe(botMove(p.board, p.hist, 'O', variantOf('classic'), 'agba', diceFor(7, 1, 0)));
  });

  it('scores a match like online: best of N, draws not counted, leaving loses', () => {
    expect(matchSoFar('classic', ['X', 'X'])).toMatchObject({ decided: false, score: [2, 0] });
    expect(matchSoFar('classic', ['X', 'O', 'X', 'X'])).toMatchObject({ decided: true, winner: 0 });
    expect(matchSoFar('fading', ['O', 'O'])).toMatchObject({ decided: true, winner: 1 });
    expect(matchSoFar('fading', ['D', 'D', 'D', 'D', 'D'])).toMatchObject({ decided: true, winner: null, draws: 5 });
    expect(matchSoFar('pro', ['D'])).toMatchObject({ decided: true, winner: null });
    expect(matchSoFar('big', ['X', 'R'])).toMatchObject({ decided: true, winner: 1, resigned: true });
  });
});
