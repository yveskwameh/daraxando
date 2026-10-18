/**
 * Playing Baba Ayo without internet: the part in the first download (Yves, 18 October 2026;
 * shared/offline.ts). Whether it's on here, and a nudge to send saved matches and top up passes
 * once the connection is back. The rest loads when it's needed: sending and passes in
 * src/lib/offlineSync.ts, the match itself in src/lib/localMatch.ts.
 */
import { OFFLINE_ON_REAL_GAME, REAL_GAME_HOST } from '../../shared/passes';
import type { Profile } from '../../shared/protocol';

/** On for the test copy and the Mac now, on the real game once the lawyer approves. */
export const offlineOn = () => location.hostname !== REAL_GAME_HOST || OFFLINE_ON_REAL_GAME;

/** Matches played on this phone without internet have ids that start like this. */
export const isLocalMatch = (id: string) => id.startsWith('off');

/** Sends any saved offline matches and tops up passes, quietly. Hands back the newest profile if a match counted. */
export function syncOffline(token: string, who: string, then: (p: Profile) => void) {
  if (!offlineOn() || !navigator.onLine) return;
  void import('./offlineSync').then((m) => m.sync(token, who)).then((p) => p && then(p), () => {});
}
