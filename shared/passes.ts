/**
 * The small, import-free part of offline play (shared/offline.ts has the rules), so the first
 * download can check the switch and the pass limits without pulling in Baba Ayo or the rules.
 */

/** Offline play on the real game: on since the lawyer approved the privacy notice lines (18 October 2026). */
export const OFFLINE_ON_REAL_GAME = true;

/** The real game's address. Everywhere else (the test copy, the Mac) has offline play now. */
export const REAL_GAME_HOST = 'daraxando.yveskwameh.com';

/** Passes a phone holds at once, and the most the server gives one player in a day (Lagos time). */
export const PASS_MAX = 10;
/** A pass starts a match that counts for this long after the server gave it. */
export const PASS_DAYS = 7;
/** The server still takes games for a pass this long after giving it, then forgets the pass. */
export const PASS_KEEP_DAYS = 10;

export interface Pass {
  id: string;
  /** Baba Ayo's dice for the match played with this pass. */
  seed: number;
  /** When the server gave it, server time. */
  at: number;
}
