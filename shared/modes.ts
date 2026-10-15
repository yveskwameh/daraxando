/**
 * The four ways to play. Each is an m,n,k game: an n by n board where k in a row wins.
 * Fading keeps only your last three pieces, so the board never fills up.
 * Fading comes first and is the default game (Yves, 15 October 2026: it's the one that makes
 * you think, every move counts). The order here is the order on the Deck and in every picker.
 * The research behind these choices is in docs/GAME-MODES.md.
 */

export interface Mode {
  id: ModeId;
  name: string;
  /** Board size. */
  n: number;
  /** How many in a row wins. */
  k: number;
  /** How many pieces each player keeps on the board. 0 means no limit. */
  fade: number;
  /** Best of this many games. 1 is a single game. */
  bo: number;
  /** Time for one move. */
  turnMs: number;
  rule: string;
  /** The print on the card's top band. */
  band: string;
  hot?: string;
}

export const MODES = {
  fading: { id: 'fading', name: 'Fading', n: 3, k: 3, fade: 3, bo: 3, turnMs: 10_000, rule: '3×3. Three pieces each. Your oldest one disappears.', band: 'swift', hot: 'New' },
  classic: { id: 'classic', name: 'Classic', n: 3, k: 3, fade: 0, bo: 5, turnMs: 10_000, rule: '3×3. Three in a row wins.', band: 'ripple' },
  big: { id: 'big', name: 'Big', n: 5, k: 4, fade: 0, bo: 3, turnMs: 15_000, rule: '5×5. Four in a row wins.', band: 'shards' },
  pro: { id: 'pro', name: 'Pro', n: 7, k: 5, fade: 0, bo: 1, turnMs: 20_000, rule: '7×7. Five in a row wins.', band: 'spiral' },
} as const satisfies Record<string, Omit<Mode, 'id'> & { id: string }>;

export type ModeId = keyof typeof MODES;
export const MODE_IDS = Object.keys(MODES) as ModeId[];

export const isModeId = (x: unknown): x is ModeId => typeof x === 'string' && Object.hasOwn(MODES, x);
/** The game new players start on, and the fallback for anything unknown. */
export const DEFAULT_MODE: ModeId = 'fading';
export const modeOf = (id: string): Mode => (isModeId(id) ? MODES[id] : MODES[DEFAULT_MODE]);

/** The board rules of a mode: size, line length and fading. */
export const variantOf = (id: string) => {
  const m = modeOf(id);
  return { n: m.n, k: m.k, fade: m.fade };
};

export const seriesLabel = (bo: number) => (bo === 1 ? 'One game' : `Best of ${bo}`);
/** Games you must win to take the series. */
export const winsNeeded = (bo: number) => Math.ceil(bo / 2);
/** Draws don't count, so a series allows two extra games before it is called on the score. */
export const maxGames = (bo: number) => (bo === 1 ? 1 : bo + 2);
/** In Fading the board never fills, so a game this long is a draw. */
export const FADE_DRAW_MOVES = 30;
