/**
 * The new-player walkthrough (docs/WALKTHROUGH.md, approved by Yves on 21 October 2026): three
 * steps on Home after the first game and the name sheet, once per phone, for new players only.
 * Settings can ask for it again. Counted for the 8 am email, never kept per player.
 */
import type { TourEvent } from '../../shared/controls';
import type { Profile } from '../../shared/protocol';
import { api } from './api';
import { KEYS, store } from './storage';

/** Players made from this day on are "new" for the tour; everyone before it already knows Home. */
const TOUR_FROM = Date.parse('2026-10-22T00:00:00+01:00');
/** Past this many finished matches, a player has found their way around without it. */
const TOUR_MAX_MATCHES = 5;

let requested = false;

/** Settings: "Show the tour again". Home picks it up when it opens. */
export const requestTour = () => {
  requested = true;
};

/** Should Home show the tour now? */
export function tourDue(p: Profile) {
  if (requested) return true;
  if (store.get(KEYS.tour)) return false;
  const played = p.wins + p.losses + p.draws;
  return p.createdAt >= TOUR_FROM && played >= 1 && played <= TOUR_MAX_MATCHES;
}

/** The tour is on screen. Returns whether it was asked for from Settings. */
export function startTour() {
  const again = requested;
  requested = false;
  store.set(KEYS.tour, '1');
  return again;
}

/** Counted on the server for the 8 am email. Never gets in the way if it fails. */
export const countTour = (token: string, e: TourEvent) => void api.tour(token, e).catch(() => {});
