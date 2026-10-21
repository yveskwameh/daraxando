/**
 * Game controls on the phone (shared/controls.ts): which parts of the game Yves turned off in the
 * dashboard, and the announcement for Home. They arrive with the profile (/api/me), which Home asks
 * for on every visit, so a change shows up within a minute or so. The server enforces every switch
 * anyway; this only lets screens say so before the player taps.
 */
import { useSyncExternalStore } from 'react';
import { NO_CONTROLS, offLine, type Controls, type SwitchId } from '../../shared/controls';
import { KEYS, store } from './storage';

let now: Controls = NO_CONTROLS;
const subs = new Set<() => void>();

export function setControls(c: Controls | undefined | null) {
  const next = c && Array.isArray(c.off) ? c : NO_CONTROLS;
  if (JSON.stringify(next) === JSON.stringify(now)) return;
  now = next;
  subs.forEach((f) => f());
}

export const controlsNow = () => now;
export const isOff = (id: SwitchId) => now.off.includes(id);
/** What to tell a player who tapped something that's turned off. */
export const restingLine = (id: SwitchId) => offLine(id);

export function useControls() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => now,
  );
}

/** Stakes turned off: every new match is free, whatever was picked last. */
export const stakeNow = (stake: number) => (isOff('stakes') ? 0 : stake);

/** The announcement this phone already closed or saw, so it never shows twice. */
function seenList(): number[] {
  try {
    const v = JSON.parse(store.get(KEYS.banners) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
export const bannerSeen = (id: number) => seenList().includes(id);
export function markBannerSeen(id: number) {
  const seen = seenList().filter((x) => x !== id);
  store.set(KEYS.banners, JSON.stringify([...seen, id].slice(-20)));
}
