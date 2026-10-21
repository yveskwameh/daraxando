/**
 * Player codes on the phone (shared/codes.ts, server: worker/codes.ts).
 *
 * This file is small and ships in the first download, because the session uses it: whether codes
 * are on here, a code that arrived in a link, the players this phone remembers, and the calls.
 * The screens that show codes are lazy: src/sheets/CodeSheet.tsx, FindSheet.tsx, PlayersSheet.tsx
 * and src/components/AccountPops.tsx.
 */
import { borrowEnded, CODE_LINK_RE, cleanCode, codesOnHost, type Alerts, type CodePlayer, type RecoveryAnswers, type RecoveryStatus } from '../../shared/codes';
import type { Profile } from '../../shared/protocol';
import { call, post } from './api';
import { deviceId } from './device';
import { store } from './storage';

/** On everywhere since the lawyer approved on 21 October 2026; CODES_ON_REAL_GAME stays as a quick off switch. */
export const codesOn = () => codesOnHost(location.hostname);

/**
 * A code from Share to myself or a QR code (/#code=KM7Q-…), read once as the app loads and taken
 * out of the address straight away, so it never reaches Web Analytics or the browser's history.
 */
export const LINKED_CODE = (() => {
  const m = location.hash.match(CODE_LINK_RE);
  if (!m) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  return codesOn() ? cleanCode(m[1]) : null;
})();

let linkedTaken = false;
/** The linked code, handed to the first screen that asks for it, once. */
export function takeLinkedCode() {
  if (linkedTaken) return null;
  linkedTaken = true;
  return LINKED_CODE;
}

/* ---------- the players this phone remembers ---------- */

/**
 * A player this phone has had. Switching players keeps them here instead of forgetting them, so
 * nobody comes back as a new player by accident. `borrowed`: someone else's phone, for a while
 * (`back` is the phone's own player to return to).
 */
export interface PhonePlayer {
  id: string;
  token: string;
  name: string;
  avatar: string;
  print: string;
  /** When this phone last played as them. */
  at: number;
  /** When this phone got the player: a code used on another phone before this only matters if it's newer. */
  since: number;
  borrowed?: { since: number; back: string | null };
}

const PLAYERS = 'dara:players';
/** When the app last went into the background, for ending a borrow after an hour away. */
const AWAY = 'dara:away';
/** The newest "opened on another phone" each player has seen, so it shows once. */
const SEEN = 'dara:code-seen';
/** This phone's request for help with a lost code. */
const RECOVERY = 'dara:recovery';

export const phonePlayers = {
  list(): PhonePlayer[] {
    const v = store.json<{ list: PhonePlayer[] }>(PLAYERS, { list: [] }).list;
    return Array.isArray(v) ? v.filter((p) => p && typeof p.id === 'string' && typeof p.token === 'string') : [];
  },
  get(id: string) {
    return this.list().find((p) => p.id === id) ?? null;
  },
  save(list: PhonePlayer[]) {
    store.set(PLAYERS, JSON.stringify({ list: list.slice(0, 8) }));
  },
  /** Adds or refreshes a player, newest first. */
  put(token: string, p: Profile, extra: Partial<Pick<PhonePlayer, 'borrowed'>> = {}) {
    const list = this.list();
    const was = list.find((x) => x.id === p.id);
    const now = Date.now();
    const next: PhonePlayer = {
      id: p.id, token, name: p.name, avatar: p.avatar, print: p.print, at: now,
      since: was?.since ?? now,
      ...(was?.borrowed ? { borrowed: was.borrowed } : {}),
      ...extra,
    };
    this.save([next, ...list.filter((x) => x.id !== p.id)]);
  },
  remove(id: string) {
    this.save(this.list().filter((x) => x.id !== id));
  },
  /** The phone's own players: everyone who isn't borrowing it. */
  own() {
    return this.list().filter((p) => !p.borrowed);
  },
};

export const noteAway = () => store.set(AWAY, String(Date.now()));
export const awaySince = () => Number(store.get(AWAY) ?? 0) || 0;

/** A borrow ends after an hour away from the game, or the next day at the latest (shared/codes.ts). */
export const borrowOver = (p: PhonePlayer, now = Date.now(), away = awaySince()) => !!p.borrowed && borrowEnded(p.borrowed.since, now, away);

export const codeSeen = {
  get: (id: string) => store.json<Record<string, number>>(SEEN, {})[id] ?? 0,
  set(id: string, at: number) {
    store.set(SEEN, JSON.stringify({ ...store.json<Record<string, number>>(SEEN, {}), [id]: at }));
  },
};

/* ---------- lost your code ---------- */

export interface MyRecovery {
  id: string;
  secret: string;
  name: string;
  at: number;
  /** The last state this phone showed, so each change shows once. */
  seen?: RecoveryStatus['state'];
}
export const myRecovery = {
  get: () => {
    const r = store.json<Partial<MyRecovery>>(RECOVERY, {});
    return r.id && r.secret ? (r as MyRecovery) : null;
  },
  set: (r: MyRecovery) => store.set(RECOVERY, JSON.stringify(r)),
  clear: () => store.remove(RECOVERY),
};

/* ---------- the calls ---------- */

const withDevice = (init: RequestInit): RequestInit => ({ ...init, headers: { 'x-device': deviceId() } });

export type CodeUse = { status: 'same'; profile: Profile } | { status: 'signedin'; profile: Profile; token: string };

export const codeApi = {
  /** Your code, made the first time it's asked for. */
  mine: (token: string) => call<{ code: string }>('/api/code', token, post({})),
  /** You kept it somewhere: your progress counts as saved. */
  kept: (token: string, from?: 'ask') => call<{ profile: Profile }>('/api/code/kept', token, post({ from })),
  /** A new code. The old one stops working. */
  renew: (token: string) => call<{ code: string }>('/api/code/new', token, post({})),
  /** Not me: a new code, and every other phone signed out. */
  lock: (token: string) => call<{ code: string; token: string; profile: Profile }>('/api/code/lock', token, post({})),
  find: (token: string | null, code: string) => call<{ player: CodePlayer; same: boolean }>('/api/code/find', token, withDevice(post({ code }))),
  use: (token: string | null, code: string) => call<CodeUse>('/api/code/use', token, withDevice(post({ code }))),

  ask: (token: string | null, answers: RecoveryAnswers) => call<{ id: string; secret: string; name: string }>('/api/recovery', token, withDevice(post(answers))),
  check: (r: Pick<MyRecovery, 'id' | 'secret'>) =>
    call<{ status: RecoveryStatus; code?: string; token?: string; profile?: Profile }>(
      `/api/recovery?id=${encodeURIComponent(r.id)}&secret=${encodeURIComponent(r.secret)}`, null, withDevice({}),
    ),
  stop: (token: string, id: string) => call<{ stopped: true }>('/api/recovery/stop', token, post({ id })),
};

export type { Alerts };

/** "New player" from Players on this phone: the first screen skips "Welcome back" once. */
export const firstScreen = { fresh: false };
