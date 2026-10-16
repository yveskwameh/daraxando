/**
 * When the game asks for something (docs/RETENTION.md, section 7; Yves, 16 October 2026): saving
 * progress, the 7 pm streak reminder, the "friend joined" notification and installing the app.
 * The rules live here, with no phone code, so tests can check them; src/lib/asks.ts applies them.
 *
 * - One moment: back on Home after a finished match that wasn't a loss.
 * - One ask per visit, counting Baba Ayo's nudge (a visit starts when the game opens, or when the
 *   player comes back after 30 minutes away).
 * - Once an ask has been shown, it waits before it can come back: the gaps below, in days, the
 *   last one repeating. Saved, turned on or installed, it never comes back.
 * - When more than one is due, they take turns.
 */
import { ASK_AGAIN_DAYS } from './notify';

export type AskKind = 'save' | 'streak' | 'friends' | 'install';
/** When each ask was last shown on this phone, and how many times. */
export type Asked = Partial<Record<AskKind, { at: number; n: number }>>;

const DAY_MS = 86_400_000;

export const ASK_GAPS: Record<AskKind, readonly number[]> = {
  save: ASK_AGAIN_DAYS,
  streak: ASK_AGAIN_DAYS,
  friends: ASK_AGAIN_DAYS,
  // Google's advice for install prompts: respect a no, so these wait longer.
  install: [14, 30],
};

/** The save ask waits for this many finished matches, so there's something worth keeping. */
export const SAVE_AFTER_MATCHES = 3;

/** True once enough days have passed since this ask was last shown. */
export function due(kind: AskKind, asked: Asked, now: number) {
  const last = asked[kind];
  if (!last) return true;
  const gaps = ASK_GAPS[kind];
  return now - last.at >= gaps[Math.min(Math.max(last.n, 1) - 1, gaps.length - 1)] * DAY_MS;
}

/** Everything the choice depends on, read from the player and the phone. */
export interface AskState {
  now: number;
  asked: Asked;
  ban: boolean;
  /** Finished matches on this phone (or the player's record, if that's more). */
  matches: number;
  saved: boolean;
  dayStreak: number;
  playedToday: boolean;
  /** The player was made on an earlier day, so this is a repeat visit. */
  returning: boolean;
  /** An iPhone or iPad in a browser tab: no notifications there, and Safari can clear the game. */
  iphoneTab: boolean;
  /** The phone can show notifications and the player hasn't blocked them. */
  pushReady: boolean;
  streakOn: boolean;
  /** Not already playing from the installed app. */
  inTab: boolean;
  /** The browser offered its own install box (Chrome, Edge, Samsung Internet). */
  canInstall: boolean;
}

/** The order for asks never shown before. */
const ORDER: AskKind[] = ['save', 'streak', 'install'];

/** The asks that fit this player and phone right now, and aren't waiting out a gap. */
export function eligible(s: AskState): AskKind[] {
  if (s.ban) return [];
  const out: AskKind[] = [];
  if (!s.saved && s.matches >= SAVE_AFTER_MATCHES) out.push('save');
  if (s.pushReady && !s.iphoneTab && !s.streakOn && s.dayStreak >= 2 && s.playedToday) out.push('streak');
  // Android and computers only when the browser offers its install box; iPhones get the steps.
  if (s.inTab && s.returning && (s.canInstall || s.iphoneTab)) out.push('install');
  return out.filter((k) => due(k, s.asked, s.now));
}

/** Which ask to show after a match, if any. */
export function pickAsk(s: AskState): AskKind | null {
  const list = eligible(s);
  if (!list.length) return null;
  // On an iPhone in Safari, installing comes first: it keeps Safari from clearing the game and
  // is the only way to get notifications there.
  if (s.iphoneTab && list.includes('install')) return 'install';
  // Otherwise they take turns: any never shown first, in ORDER, then the one shown longest ago.
  return [...list].sort((a, b) => (s.asked[a]?.at ?? -1) - (s.asked[b]?.at ?? -1) || ORDER.indexOf(a) - ORDER.indexOf(b))[0];
}
