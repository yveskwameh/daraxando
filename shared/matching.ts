/**
 * How quick match widens its search. Shared so the server's pairing and the search screen
 * always tell the same story.
 *
 *   0 to 4 s   same state
 *   4 to 8 s   same zone
 *   8 to 12 s  anywhere in Nigeria
 *   12 s on    anyone at all
 *
 * The steps are short on purpose: nobody should wait long to find out that nobody is there.
 */
import { zoneOf } from './places';

export const SEARCH_STEP_MS = 4_000;

/** The Baba Ayo card shows by now at the latest... */
export const BABA_OFFER_MS = 8_000;
/** ...or this early, when the server says nobody else is searching for this table at all. */
export const EMPTY_OFFER_MS = 2_500;

/** 0: same state, 1: same zone, 2: all Nigeria, 3: anyone. */
export const searchStage = (waitedMs: number) => Math.max(0, Math.min(3, Math.floor(waitedMs / SEARCH_STEP_MS)));

const realState = (s: string) => s !== 'OUT' && s !== 'NONE';

/** Can these two be paired, given how far the search has widened? */
export function canPair(a: { state: string }, b: { state: string }, stage: number) {
  if (realState(a.state) && a.state === b.state) return true;
  const za = zoneOf(a.state);
  if (stage >= 1 && za && za === zoneOf(b.state)) return true;
  if (stage >= 2 && a.state !== 'OUT' && b.state !== 'OUT') return true;
  return stage >= 3;
}
