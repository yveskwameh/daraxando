/**
 * Player codes (docs/CODES-REVIEW.md, approved as a prototype by Yves on 21 October 2026).
 *
 * Every player can have a 16-character code, shown as four groups of four (KM7Q-3XRP-9DWT-H2FN).
 * Typed on any phone, it plays as that player. Save image, Copy and Share to myself keep it;
 * Google and email stay as an extra backup. A phone remembers the players it has had, a friend
 * can borrow a phone for a while, and a player who lost their code can ask for help, which Yves
 * answers in the admin dashboard.
 *
 * Shared by the phone and the server: the code's letters, how a typed code is cleaned up, the
 * recovery form's limits, and the switch for the real game.
 */
import { CODE_ALPHABET } from './protocol';
import { REAL_GAME_HOST } from './passes';

/**
 * The lawyer approved the privacy lines on 21 October 2026 (docs/CODES-REVIEW.md), so codes are
 * on everywhere. This stays as a quick off switch for the real game; the phone and the server
 * read the same one.
 */
export const CODES_ON_REAL_GAME = true;

/** The same letters as room codes: no I, L, O, 0 or 1, so nothing is misread. 31 symbols, 16 of them: about 79 bits. */
export const PLAYER_CODE_ALPHABET = CODE_ALPHABET;
export const PLAYER_CODE_LENGTH = 16;

/**
 * The 16 characters of a typed code, or null. Capitals or not, spaces and dashes don't matter.
 * I, L, O, 0 and 1 are never in a code, so the boxes drop them as you type (`codeChars`).
 */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.toUpperCase().replace(/[\s\-_.]/g, '');
  if (s.length !== PLAYER_CODE_LENGTH) return null;
  for (const ch of s) if (!PLAYER_CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/** "KM7Q3XRP9DWTH2FN" as "KM7Q-3XRP-9DWT-H2FN". */
export const showCode = (code: string) => (code.replace(/[^A-Za-z0-9]/g, '').match(/.{1,4}/g) ?? []).join('-');

/** Keeps only the letters a code can have, for the boxes as you type. */
export const codeChars = (raw: string) =>
  [...raw.toUpperCase()].filter((ch) => PLAYER_CODE_ALPHABET.includes(ch)).join('');

/** The link a QR code and Share to myself carry. After #, so phones never send the code to the server. */
export const codeLink = (origin: string, code: string) => `${origin}/#code=${showCode(code)}`;
export const CODE_LINK_RE = /^#code=([A-Za-z0-9-]{16,24})$/;

/** What "Play as Tunde?" shows: enough to know it's you, nothing private. */
export interface CodePlayer {
  id: string;
  name: string;
  avatar: string;
  print: string;
  aura: number;
  cowries: number;
  dayStreak: number;
  state: string;
}

/** What the server adds to /api/me for the player's phones (worker/codes.ts, `alertsFor`). */
export interface Alerts {
  /** When the player's code last opened them on another phone. */
  codeUse?: number;
  /** A recovery Yves approved: the player moves to the asking phone at `due` unless someone taps Stop. */
  takeover?: { id: string; due: number };
}

/** The plain answer to every wrong code, so a guess learns nothing. */
export const WRONG_CODE = "That code doesn't match a player. Check it and try again.";

/* ---------- lost your code? ---------- */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const RECOVERY_NOTE_MAX = 200;
export const RECOVERY_MESSAGE_MAX = 300;
/** Approved requests wait this long, so the real player can stop them. */
export const RECOVERY_WAIT_MS = 24 * 3_600_000;
/** A refused request can be asked again after a week. */
export const RECOVERY_AGAIN_MS = 7 * 86_400_000;
/** Requests and their answers go 30 days after they're settled (the 8 am run). */
export const RECOVERY_KEEP_MS = 30 * 86_400_000;

export interface RecoveryAnswers {
  name: string;
  /** About how many Dara Seeds they had. */
  seeds: number;
  /** The month they started, 1 to 12. */
  month: number;
  /** Someone they played recently. */
  opponent: string;
  message: string;
}

export type RecoveryState = 'open' | 'waiting' | 'refused' | 'stopped' | 'done';

/** What the asking phone sees when it checks its request. */
export interface RecoveryStatus {
  state: RecoveryState;
  name: string;
  /** Yves's note, after he gives it back or refuses. */
  note: string | null;
  /** When an approved request moves the player to this phone. */
  due: number | null;
  /** When a refused request can be asked again. */
  again: number | null;
}

/* ---------- a borrowed phone ---------- */

/** A borrowed phone goes back to its own player after an hour away from the game, or the next day at the latest. */
export const BORROW_AWAY_MS = 3_600_000;

/** Whether a borrow that started at `since` is over: a new day, or more than an hour away since the app last went to the background (`away`). */
export function borrowEnded(since: number, now: number, away: number) {
  const day = (t: number) => new Date(t).toDateString();
  if (day(since) !== day(now)) return true;
  return away > since && now - away > BORROW_AWAY_MS;
}

/** Whether this copy of the app has player codes: everywhere but the real game, until it's switched on. */
export const codesOnHost = (host: string) => host !== REAL_GAME_HOST || CODES_ON_REAL_GAME;
