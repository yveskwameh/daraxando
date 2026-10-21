/**
 * Game controls (Yves, 21 October 2026, from the approved prototype docs/controls-prototype.html):
 * switches that turn parts of the game off and on without a push, one announcement at a time on
 * Home, and news notifications for players who turn them on. Set in the admin dashboard
 * (Controls), kept by the game in D1 (migrations/0015_controls.sql, worker/controls.ts), and read
 * by phones from /api/me. Changes reach players within a minute.
 */

export interface SwitchInfo {
  id: SwitchId;
  group: string;
  name: string;
  /** What it covers, in the dashboard. */
  line: string;
  /** What players see while it's off. One short sentence or two, plain English. */
  off: string;
}

export const SWITCH_IDS = ['quick', 'friends', 'stakes', 'newPlayers', 'emailCodes', 'codes', 'typed', 'offline', 'reminders'] as const;
export type SwitchId = (typeof SWITCH_IDS)[number];
export const isSwitchId = (x: unknown): x is SwitchId => typeof x === 'string' && (SWITCH_IDS as readonly string[]).includes(x);

/** In the order and groups the dashboard shows them. */
export const SWITCHES: readonly SwitchInfo[] = [
  { id: 'quick', group: 'Playing people', name: 'Quick match', line: 'Finding a player, and games waiting to be joined.', off: 'Quick match is resting for a bit. Play a friend or Baba Ayo.' },
  { id: 'friends', group: 'Playing people', name: 'Friend rooms', line: 'Play a friend with a code or a link.', off: 'Friend rooms are resting for a bit. Try Quick match or Baba Ayo.' },
  { id: 'stakes', group: 'Playing people', name: 'Stakes', line: 'Staking Dara Seeds on a match. Off: every new match is free.', off: 'Stakes are resting for a bit. Every match is free for now.' },
  { id: 'newPlayers', group: 'New players and sign-in', name: 'New players', line: 'Play now on the first screen.', off: "We're full right now. Try again soon." },
  { id: 'emailCodes', group: 'New players and sign-in', name: 'Email sign-in codes', line: 'Uses the 90 free emails a day. Google and player codes still work.', off: 'Email codes are resting for a bit. Use Google or your player code.' },
  { id: 'codes', group: 'New players and sign-in', name: 'Player codes', line: 'Saving, typing and recovering player codes.', off: 'Player codes are resting for a bit. Try again soon.' },
  { id: 'typed', group: 'In a match and on the phone', name: 'Typed messages', line: 'The quick messages always stay.', off: 'Typed messages are resting for a bit. The quick messages still work.' },
  { id: 'offline', group: 'In a match and on the phone', name: 'Baba Ayo without internet', line: 'Offline games that count. Games already played still count when they arrive.', off: 'Games without internet are just for fun for now.' },
  { id: 'reminders', group: 'In a match and on the phone', name: '7 pm streak reminders', line: "Tonight's run, and every run until it's back on.", off: '' },
];

export const switchInfo = (id: SwitchId) => SWITCHES.find((s) => s.id === id)!;
export const offLine = (id: SwitchId) => switchInfo(id).off;

/** Where an announcement's button goes on Home. */
export const BANNER_ACTIONS = { quick: 'Quick match', friend: 'Play a friend', baba: 'Play Baba Ayo', mode: 'Pick a game', ranks: 'Ranks' } as const;
export type BannerAction = keyof typeof BANNER_ACTIONS;
export const isBannerAction = (x: unknown): x is BannerAction => typeof x === 'string' && Object.prototype.hasOwnProperty.call(BANNER_ACTIONS, x);

/** The announcement a phone shows on Home, once. */
export interface Banner {
  id: number;
  text: string;
  action: BannerAction | null;
}

/** What /api/me tells the phone: which switches are off, and the announcement showing now. */
export interface Controls {
  off: SwitchId[];
  banner: Banner | null;
}
export const NO_CONTROLS: Controls = { off: [], banner: null };

export const BANNER_MAX = 90;
/** Shows for at least 10 minutes, at most 14 days. */
export const BANNER_MIN_MS = 10 * 60_000;
export const BANNER_MAX_MS = 14 * 86_400_000;
/** Past announcements stay listed in the dashboard this long. */
export const BANNER_KEEP_MS = 30 * 86_400_000;

export const NEWS_MAX = 120;
/** At most this many news notifications in 30 days (docs/NEWS-REVIEW.md, approved). */
export const NEWS_PER_MONTH = 4;
export const NEWS_WINDOW_MS = 30 * 86_400_000;

// Emoji and other pictures, which never appear in the game.
const PICTURE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{FE0F}\u{20E3}]/u;
const LINK = /https?:|www\.|\b[a-z0-9-]+\.(com|ng|net|org|io|app|co|me|ly|gg)\b/i;

/**
 * Checks an announcement or news line against the game's writing rules (CLAUDE.md, "Writing rules"):
 * short, starts with a capital, no emojis, no links, no em dashes. Null when it's fine.
 */
export function lineProblem(raw: string, max: number): string | null {
  const t = raw.trim();
  if (t.length < 8) return 'Write at least a few words.';
  if (t.length > max) return `Keep it to ${max} characters. It's ${t.length} now.`;
  if (PICTURE.test(t)) return "Emojis aren't allowed in the game. Take it out to go on.";
  if (LINK.test(t)) return 'No links. Players can only tap the button.';
  if (/[—–]/.test(t)) return 'No long dashes. Use a comma or a new sentence.';
  if (!/^[A-Z0-9]/.test(t)) return 'Start with a capital letter.';
  if (/[.!?]\s+[a-z]/.test(t)) return 'Start every sentence with a capital letter.';
  if (!/[.!?]$/.test(t)) return 'End with a full stop.';
  return null;
}

/** The same text the phone and the server both keep: trimmed, single spaces. */
export const cleanLine = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '');

/** The new-player walkthrough's events, counted for the 8 am email (docs/WALKTHROUGH.md). */
export const TOUR_EVENTS = ['shown', 'done', 'skip1', 'skip2', 'skip3', 'find', 'replay'] as const;
export type TourEvent = (typeof TOUR_EVENTS)[number];
export const isTourEvent = (x: unknown): x is TourEvent => typeof x === 'string' && (TOUR_EVENTS as readonly string[]).includes(x);
