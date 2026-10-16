/**
 * Dara Seeds: points you stake on matches. Winner takes the pot. They are earned in the
 * game only and can never be bought, sold, sent to another player or cashed out. That is
 * what keeps staking a game and not gambling. The full design is in docs/STAKES.md.
 */
import { titleFor } from './progression';

export const TABLES = [0, 100, 500, 1000, 5000, 10000, 50000, 100000] as const;
/** Friend rooms are capped low, so losing on purpose to a friend can't move much. */
export const FRIEND_TABLES = [0, 100, 500, 1000] as const;

export const HIGH_TABLE = 10_000;
export const BIG_TABLE = 50_000;
/** The big tables open at the 10th title, Dike. */
export const BIG_LEVEL = 10;

export const START_COWRIES = 5_000;
export const DAILY_COWRIES = 500;
/** "Sapa relief": below this, a free top-up... */
export const SAPA_BELOW = 500;
/** ...back to this much... */
export const SAPA_TO = 1_000;
/** ...at most this often. */
export const SAPA_EVERY_MS = 4 * 3_600_000;

/** New players stay at small tables for their first week. */
export const NEW_ACCOUNT_MS = 7 * 86_400_000;
export const NEW_ACCOUNT_MAX = 1_000;
/** The same two players can meet at high tables at most this many times a day. */
export const PAIR_DAILY_MAX = 3;
/**
 * Farming rules (Yves, 16 October 2026; docs/SAFETY-REVIEW.md). They only catch seeds moving one
 * way between the same two players, so friends who trade wins can stake with each other all day.
 * When one applies, both stakes go back instead of to the winner. The win itself still counts.
 *  - Same phone: players made on the same phone never win seeds from each other.
 *  - One-way cap: in any 24 hours, nobody can end up more than 5,000 seeds ahead of the same
 *    opponent (three stakes' worth on tables above 1,000, so high tables aren't squeezed).
 *  - Quick quits: a match the loser resigned, left or timed out of in its first game, before making
 *    3 moves of their own, pays nothing. Only the first game, so a player who lost game 1 can't
 *    quit game 2 early to keep their stake.
 */
export const PAIR_FLOW_MAX = 5_000;
export const PAIR_FLOW_STAKES = 3;
export const QUICK_QUIT_MOVES = 3;
export type StakeBack = 'phone' | 'cap' | 'quit';

/** True when this win would take the winner past the one-way cap. `flow` is what they're already up on this opponent in the last 24 hours. */
export const overPairCap = (flow: number, stake: number) => flow + stake > Math.max(PAIR_FLOW_MAX, PAIR_FLOW_STAKES * stake);

/**
 * True when the loser walked away before playing: resigned, left or timed out in the first game,
 * with fewer than 3 moves of their own. `gamesBefore` is how many games finished before the end.
 */
export const quickQuit = (reason: string, loserMoves: number, gamesBefore: number) =>
  (reason === 'resign' || reason === 'abandon' || reason === 'timeout' || reason === 'idle') &&
  loserMoves < QUICK_QUIT_MOVES &&
  gamesBefore === 0;

/** Three high-table losses in a row starts a short break from high tables. */
export const COOL_LOSSES = 3;
export const COOL_MS = 10 * 60_000;

export const isTable = (x: unknown): x is number => (TABLES as readonly unknown[]).includes(x);
export const isFriendTable = (x: unknown): x is number => (FRIEND_TABLES as readonly unknown[]).includes(x);

/** High tables keep 5%, which takes cowries out of the game so handouts don't inflate them. */
export const fee = (entry: number) => (entry >= HIGH_TABLE ? 0.05 : 0);
export const prize = (entry: number) => Math.round(entry * 2 * (1 - fee(entry)));

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** 12.5k, 100k, 1.2m. Only for tight spaces like the header chip. */
export function short(n: number) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}m`;
  if (n >= 1e4) return `${+(n / 1e3).toFixed(1)}k`;
  return fmt(n);
}

export interface StakeCheck {
  level: number;
  cowries: number;
  createdAt: number;
  coolUntil: number;
}

/** Why a player can't sit at a table, in words for the screen. Empty when they can. */
export function tableLock(entry: number, p: StakeCheck, now: number): string {
  if (!entry) return '';
  if (entry >= BIG_TABLE && p.level < BIG_LEVEL) return `Opens at ${titleFor(BIG_LEVEL)}`;
  if (entry > NEW_ACCOUNT_MAX && now - p.createdAt < NEW_ACCOUNT_MS) return 'Opens after your first week';
  if (entry >= HIGH_TABLE && p.coolUntil > now) return `Take a break. Opens in ${Math.ceil((p.coolUntil - now) / 60_000)} min`;
  if (entry > p.cowries) return `You need ${fmt(entry)}`;
  return '';
}

export const sapaReady = (cowries: number, sapaAt: number, now: number) =>
  cowries < SAPA_BELOW && now - sapaAt >= SAPA_EVERY_MS;
