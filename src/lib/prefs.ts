/**
 * Choices that live on this phone only: the game picked on Home, the last stake, and the
 * music, sound and vibration switches. A tiny store any component can read with usePrefs().
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_MODE, type ModeId } from '../../shared/modes';
import { KEYS, store } from './storage';

export interface Prefs {
  mode: ModeId;
  stake: number;
  friendStake: number;
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  /** Baba Ayo's guilt-trip nudges about your streak. */
  nudges: boolean;
}

const DEFAULTS: Prefs = { mode: DEFAULT_MODE, stake: 0, friendStake: 0, music: true, sfx: true, haptics: true, nudges: true };

let current: Prefs = store.json(KEYS.prefs, DEFAULTS);
const listeners = new Set<() => void>();

export const prefs = {
  get: () => current,
  set(patch: Partial<Prefs>) {
    current = { ...current, ...patch };
    store.set(KEYS.prefs, JSON.stringify(current));
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const usePrefs = () => useSyncExternalStore(prefs.subscribe, prefs.get);
