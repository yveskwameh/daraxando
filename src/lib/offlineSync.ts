/**
 * Offline matches waiting to be sent, and the passes that let them count (shared/offline.ts,
 * worker/offline.ts; Yves, 18 October 2026). Loaded only when needed.
 *
 * Finished games wait in IndexedDB, which phones keep better than localStorage, until the
 * server has taken them: on opening the app, on coming back to it, when the connection
 * returns, and after each offline match. One game per request, in the order they were played.
 * The passes (small) live in localStorage with the ids this phone has used, so a pass the server
 * hasn't heard about yet is never used twice.
 */
import type { BotLevel } from '../../shared/bot';
import type { ModeId } from '../../shared/modes';
import { PASS_DAYS, PASS_MAX, type Pass } from '../../shared/passes';
import type { Profile } from '../../shared/protocol';
import type { Mark } from '../../shared/rules';
import { call, post } from './api';
import { KEYS, store } from './storage';
import { toast } from './toast';

/** One finished game (or the player leaving), waiting to be sent. */
export interface Waiting {
  key: number;
  /** The player who played it, so another player signed in on this phone doesn't send it. */
  who: string;
  pass: string;
  mode: ModeId;
  level: BotLevel;
  starter: Mark;
  game: number;
  moves: number[];
  resign: boolean;
}

/* ------------------------------------------------------------------ IndexedDB, the small part we need */

const STORE = 'outbox';
let opening: Promise<IDBDatabase> | null = null;

function db() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('dara', 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return opening;
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const r = run(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let order = 0;
/** Keeps a finished game until the server has it. */
export function queue(w: Omit<Waiting, 'key'>) {
  return tx('readwrite', (s) => s.put({ ...w, key: Date.now() * 100 + (order++ % 100) }));
}

/** Games waiting to be sent by this player. */
export async function waiting(who: string): Promise<Waiting[]> {
  const all = await tx<Waiting[]>('readonly', (s) => s.getAll() as IDBRequest<Waiting[]>).catch(() => [] as Waiting[]);
  return all.filter((w) => w.who === who).sort((a, b) => a.key - b.key);
}

const drop = (key: number) => tx('readwrite', (s) => s.delete(key));

/* ------------------------------------------------------------------ passes */

interface PassBox {
  who: string | null;
  list: Pass[];
  /** Pass ids this phone has started a match with. */
  used: string[];
  /** When we last asked the server for more (phone time). */
  at: number;
}

const box = (who: string): PassBox => {
  const b = store.json<PassBox>(KEYS.passes, { who: null, list: [], used: [], at: 0 });
  return b.who === who ? b : { who, list: [], used: [], at: 0 };
};
const save = (b: PassBox) => store.set(KEYS.passes, JSON.stringify(b));
const fresh = (p: Pass, now: number) => now - p.at < PASS_DAYS * 86_400_000;

/** A pass for a new offline match, or null: no passes left, so this one is just for fun. */
export function takePass(who: string): Pass | null {
  const b = box(who);
  const now = Date.now();
  const p = b.list.find((x) => !b.used.includes(x.id) && fresh(x, now)) ?? null;
  if (p) {
    b.used = [...b.used, p.id].slice(-40);
    save(b);
  }
  return p;
}

/** Asks the browser to keep the saved games even when the phone is short of space. */
export function keepSafe() {
  void navigator.storage?.persist?.().catch(() => {});
}

/* ------------------------------------------------------------------ sending */

type Answer = { status: 'saved' | 'duplicate' | 'gone' | 'refused' } | { status: 'counted'; profile: Profile };

let running = false;

/** Sends what's waiting, then tops up passes. Hands back the newest profile if a match counted. */
export async function sync(token: string, who: string): Promise<Profile | null> {
  if (running) return null;
  running = true;
  let counted = 0;
  let refused = 0;
  let profile: Profile | null = null;
  try {
    for (const w of await waiting(who)) {
      let a: Answer;
      try {
        a = await call<Answer>('/api/offline/game', token, post({ pass: w.pass, mode: w.mode, level: w.level, starter: w.starter, game: w.game, moves: w.moves, resign: w.resign }));
      } catch {
        // Offline again, busy or limited: try again next time, in the same order.
        break;
      }
      if (a.status === 'counted') {
        counted++;
        profile = a.profile;
      } else if (a.status === 'refused') refused++;
      await drop(w.key);
    }
    if (counted) toast.ok(counted === 1 ? 'Your offline match counted.' : `${counted} offline matches counted.`);
    if (refused) toast.error(refused === 1 ? "An offline match couldn't be checked, so it didn't count." : `${refused} offline matches couldn't be checked, so they didn't count.`);

    // Top up passes, at most every 10 minutes, or at once when there are none left.
    const b = box(who);
    const now = Date.now();
    const left = b.list.filter((p) => !b.used.includes(p.id) && fresh(p, now)).length;
    if (left < PASS_MAX && (left === 0 || now - b.at > 10 * 60_000)) {
      const r = await call<{ passes: Pass[] }>('/api/offline/passes', token, post({})).catch(() => null);
      if (r) save({ ...b, list: r.passes.filter((p) => !b.used.includes(p.id)), at: now });
    }
  } finally {
    running = false;
  }
  return profile;
}
