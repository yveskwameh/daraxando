/**
 * Everything the browser and the server say to each other, plus the small rules both
 * sides must agree on (names, room codes, timings). Change a message here and TypeScript
 * points at every place that has to follow.
 */
import type { BotLevel } from './bot';
import type { Habits, LeagueMove, QuestId } from './habits';
import type { ModeId } from './modes';
import type { Kind, Result } from './progression';
import type { StateCode } from './places';
import type { Cell, Hist, Mark } from './rules';
import type { StakeBack } from './stakes';

export const NAME_MIN = 2;
export const NAME_MAX = 16;

/** A quick match where the other player never connects is called off after this long. */
export const ABANDON_MS = 20_000;
/**
 * Leaving the app mid-match (switching apps, locking the phone, losing signal) pauses the
 * match. Stay away longer than this and the other player wins.
 */
export const AWAY_MS = 60_000;
/** When a paused match resumes, the player to move gets at least this long. */
export const RESUME_MIN_MS = 4_000;
/** A little extra on the first move of each game, while people find the board. */
export const FIRST_TURN_BONUS_MS = 2_000;
/**
 * A new player's first match against Baba Ayo gets a slow clock: 30 seconds a move, so
 * someone still looking around their first screen doesn't lose before they've played.
 */
export const FIRST_MATCH_TURN_MS = 30_000;
/** Time out this many moves in a row and you lose the game. */
export const MAX_TIMEOUTS = 2;
/**
 * Between games, the next one starts only when both players tap Next game. Once one has,
 * the other gets this long, or they lose the match. Baba Ayo is always ready.
 */
export const NEXT_WAIT_MS = 30_000;

/** The bot as it appears to players. */
export const BOT = {
  id: 'bot',
  name: 'Baba Ayo',
  avatar: 'baba',
  piece: 'calabash',
  print: 'line',
  state: 'NONE',
} as const;

/** Lines a player can send during a match. The server only passes on these. */
export const EMOTES = ['Gbam!', 'Haba!', 'Oya nau', 'Shine your eye', 'You too much', 'No rage bait me'] as const;

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  piece: string;
  print: string;
  state: StateCode;
  rating: number;
  aura: number;
  level: number;
  cowries: number;
  wins: number;
  losses: number;
  draws: number;
  quickGames: number;
  winStreak: number;
  bestWinStreak: number;
  dayStreak: number;
  /** Matches won today (Nigeria time), for the daily goal. */
  dayWins: number;
  lastPlayedDay: string | null;
  sapaAt: number;
  coolUntil: number;
  createdAt: number;
  /** Streak, Streak Freezes, the streak stake, quests, badges and league. See shared/habits.ts. */
  habits: Habits;
  /** Google or an email is linked, so the player can sign in on any phone (worker/accounts.ts). */
  saved: boolean;
  /** Banned: no play against people, no Ranks or leagues. Baba Ayo still works (worker/admin.ts). */
  ban: { at: number; reason: string } | null;
}

/** How a player signs in. */
export type AuthVia = 'google' | 'email';

/** What a player has linked, for Settings. The addresses are their own. */
export interface Account {
  google: string | null;
  email: string | null;
}

/**
 * What signing in with Google or an email code did (worker/accounts.ts).
 *  - saved: the player on this phone is now saved with it.
 *  - same: it already belongs to the player on this phone.
 *  - signedin: this phone had no player, so it's now signed in.
 *  - switch: it belongs to another player. The app asks before using the token.
 *  - none: nobody is saved with that Google account.
 */
export type AuthResult =
  | { status: 'saved' | 'same'; via: AuthVia; profile: Profile }
  | { status: 'signedin' | 'switch'; via: AuthVia; profile: Profile; token: string }
  | { status: 'none'; via: AuthVia }
  | { status: 'error'; message: string };

/** What a finished match did for your streak, quests, badges and league. */
export interface HabitOutcome {
  streak: number;
  /** Your first match today: the streak grew (or started again). */
  extended: boolean;
  usedFreezes: number;
  /** The streak that ended, if it ended. */
  broke: number;
  milestone: { days: number; aura: number; freeze: number } | null;
  bet: { result: 'won'; paid: number } | { result: 'lost' } | { result: 'progress'; days: number } | null;
  quests: { id: QuestId; title: string; aura: number }[];
  badges: { id: string; name: string; star: number; aura: number }[];
  /** Aura from milestones, quests and badges, on top of the match's own. */
  extraAura: number;
}

/** A friend streak, or a request for one. */
export interface FriendView {
  id: string;
  name: string;
  avatar: string;
  print: string;
  state: string;
  status: 'active' | 'incoming' | 'outgoing';
  /** Days in a row you've both played. 0 once it has ended. */
  count: number;
  youToday: boolean;
  themToday: boolean;
}

export interface FriendsData {
  friends: FriendView[];
  /** People you've played lately who aren't friends yet. */
  recent: { id: string; name: string; avatar: string; print: string; state: string }[];
}

export interface LeagueRow {
  id: string;
  name: string;
  avatar: string;
  print: string;
  state: string;
  aura: number;
  bot?: boolean;
}

export interface LeagueData {
  week: string;
  endsAt: number;
  tier: number;
  /** Null until you play a match this week. */
  rows: LeagueRow[] | null;
  up: number;
  down: number;
  /** In leagues of fewer than 5 players, you also have to finish above Baba Ayo to move up. */
  beatBaba: boolean;
  last: { week: string; rank: number; tier: number; moved: LeagueMove } | null;
  /**
   * A banned player looking in from outside: `rows` is the table they'd be in, without them,
   * and this is their Aura for the week, to show where they'd be. They can't climb it.
   */
  outside?: { aura: number };
}

/** A banned player's latest request for a ban review, and whether they can send another. */
export interface AppealView {
  appeal: { at: number; status: 'open' | 'lifted' | 'kept'; note: string | null; decidedAt: number | null } | null;
  /** When they can ask again: now (0), or not before this time. Null while one is open. */
  askFrom: number | null;
}

/** What other players can see about you. */
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  piece: string;
  print: string;
  state: string;
  rating: number;
  level: number;
  bot?: boolean;
}

export interface LeaderRow {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  print: string;
  state: string;
  rating: number;
  level: number;
}

/**
 * waiting: not everyone is here yet. playing: a game is on. between: a game just ended and
 * the next starts when both players are ready. over: the series is decided.
 */
export type Phase = 'waiting' | 'playing' | 'between' | 'over';
/** idle: one player tapped Next game and the other didn't, in time. */
export type EndReason = 'line' | 'draw' | 'timeout' | 'resign' | 'abandon' | 'idle' | 'aborted';

export interface SeatView extends PublicPlayer {
  mark: Mark;
  /** In the app right now: connected and not switched away. */
  connected: boolean;
  leftAt: number | null;
  /** Games won in this series. */
  score: number;
}

export interface GameResult { winner: Mark | null; line: number[] | null; reason: EndReason }
/** What a player asks for in a rematch: the same game, or a different mode or stake. */
export interface Rematch { mode: ModeId; stake: number }
export interface SeriesResult { winner: 0 | 1 | null; reason: EndReason }

export interface MatchView {
  id: string;
  kind: Kind;
  mode: ModeId;
  level?: BotLevel;
  /** Games in this series (usually the mode's; 1 for a new player's first match). */
  bo: number;
  /** A new player's first match against Baba Ayo: one game until they win. */
  first: boolean;
  /** Each player's stake. The pot is twice this. */
  stake: number;
  phase: Phase;
  /** 1 for the first game of the series. */
  game: number;
  board: Cell[];
  /** Each side's squares, oldest first. Fading needs it to know what vanishes next. */
  hist: Hist;
  turn: Mark | null;
  /** In Fading: the square that disappears when the player to move plays. */
  fading: number | null;
  seats: [SeatView | null, SeatView | null];
  /** Your seat, or null for a spectator. */
  you: 0 | 1 | null;
  turnEndsAt: number | null;
  /** True while someone has left the app. The turn clock is frozen. */
  paused: boolean;
  /** Time left on the frozen turn clock. */
  pausedLeft: number | null;
  /** Between games: who has tapped Next game, and when the first one did. */
  ready: [boolean, boolean];
  readyAt: number | null;
  lastMove: number | null;
  /** The square that faded on the last move, if any. */
  removed: number | null;
  /** How the last game ended. */
  result: GameResult | null;
  /** How the series ended, once it has. */
  series: SeriesResult | null;
  /** Each player's rematch request, if they made one. Equal requests start the rematch. */
  rematch: [Rematch | null, Rematch | null];
  draws: number;
  /**
   * A friend room waiting for the other player to show up, and where they are:
   * away: in another app (the game starts when they're back). told: the host has the app
   * open on another screen and has been told you joined. closed: not in the app at all.
   */
  waitingOn: 'away' | 'told' | 'closed' | null;
  /** Server time, so the browser can line up its clock. */
  now: number;
}

/** The friend who joined your room, as the host sees them before opening the match. */
export interface RoomGuest { name: string; avatar: string; print: string; state: string }

/**
 * What a host hears about their friend room while they're elsewhere in the app. `open` is
 * false once the match has started, ended or the room has closed.
 */
export interface RoomStatus { t: 'room'; open: boolean; guest: RoomGuest | null; stake: number }

/** What a finished match did for you. Sent to each player once the result is saved. */
export interface Reward {
  result: Result;
  aura: number;
  /** Extra Aura for reaching the daily goal with this win. */
  goalBonus: number;
  auraTotal: number;
  levelBefore: number;
  levelAfter: number;
  ratingBefore: number;
  ratingAfter: number;
  /** Change in Dara Seeds from this match (payout minus stake), not counting the daily handout. */
  cowries: number;
  /** The daily handout, if this was your first match today. */
  daily: number;
  cowriesTotal: number;
  dayStreak: number;
  dayWins: number;
  winStreak: number;
  /** Streak, quests, badges and the streak stake. Missing if they couldn't be saved. */
  habits?: HabitOutcome;
  /** The stakes went back instead of to the winner, and why (shared/stakes.ts, farming rules). */
  back?: StakeBack;
}

export type ClientMsg =
  | { t: 'move'; i: number }
  | { t: 'emote'; e: string }
  /** Ask for a rematch. Leave out mode and stake for the same game again. Baba Ayo games can change level. */
  | { t: 'rematch'; mode?: ModeId; stake?: number; level?: BotLevel }
  /** Leave the match. In a friend room before it starts: leave the room (the guest) or close it (the host). */
  | { t: 'resign' }
  /** "The clock says time is up." The server checks its own clock before acting. */
  | { t: 'claim' }
  /** "I'm ready for the next game." It starts when both players have said so. */
  | { t: 'next' }
  /** "I switched away from the app" and "I'm back". Leaving pauses the match. */
  | { t: 'away' }
  | { t: 'back' };

export type ErrorCode =
  | 'unauthorized'
  | 'not-found'
  | 'room-full'
  | 'replaced'
  | 'bad-move'
  | 'stake-short'
  | 'table-locked'
  | 'banned'
  /** A rematch can't start because the other player was banned. Shown as a note, not the end. */
  | 'rematch-off';

export type ServerMsg =
  | { t: 'state'; s: MatchView }
  | { t: 'emote'; seat: 0 | 1; e: string }
  | { t: 'say'; text: string }
  | { t: 'reward'; r: Reward }
  | { t: 'error'; code: ErrorCode; message: string };

export type LobbyClientMsg = { t: 'tick' };

/**
 * How many people are searching the same mode and stake: in your state, your zone, everywhere.
 * `elsewhere` is the busiest other table, so an empty search can suggest one with people.
 */
export interface Nearby {
  state: number;
  zone: number;
  all: number;
  elsewhere: { mode: ModeId; stake: number; n: number } | null;
}

/**
 * A quick match game waiting for an opponent: the player who started it and their table.
 * Quick match on Home shows these one at a time so you can join one.
 */
export interface LiveGame {
  /** The waiting player's id. Joining targets them. */
  id: string;
  name: string;
  avatar: string;
  print: string;
  state: string;
  rating: number;
  mode: ModeId;
  stake: number;
  /** When they started waiting. */
  since: number;
}

export type LobbyServerMsg =
  | { t: 'queued'; near: Nearby }
  | { t: 'matched'; matchId: string }
  /** You tried to join someone's game, but they were matched or left first. */
  | { t: 'gone' }
  /** To someone watching from Home: the games waiting right now, and how many others have Quick match open. */
  | { t: 'live'; games: LiveGame[]; looking: number }
  | { t: 'error'; code: ErrorCode; message: string };

/** Close codes from 4000 up are ours. The browser stops reconnecting on any of them. */
export const CLOSE = {
  replaced: 4001,
  stake: 4002,
  roomFull: 4003,
  notFound: 4004,
  /** The game you tried to join was taken or closed. */
  gone: 4005,
  /** Banned players can't play other people. */
  banned: 4006,
  unauthorized: 4401,
} as const;

/**
 * Tidies a name: letters (including accents, so Ọlá stays Ọlá), numbers, spaces and a few
 * marks. Null if what is left is too short or too long.
 */
/** Drops what a name can't hold (symbols, emoji) as it's typed, so what you see is what you get. */
export const nameChars = (raw: string) => raw.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} .'_-]/gu, '');

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = nameChars(raw).replace(/\s+/g, ' ').trim();
  const length = [...name.normalize('NFC')].length;
  if (length < NAME_MIN || length > NAME_MAX) return null;
  return name;
}

/**
 * Room codes skip I, L, O, 0 and 1. In Onest, the body font, capital I and lowercase l look
 * almost the same, and O and 0 are easy to mix up when read out over the phone.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
export const isRoomCode = (s: string) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(s);
export const isMatchId = (s: string) => /^[A-Za-z0-9]{5,24}$/.test(s);
