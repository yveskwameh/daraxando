/**
 * A cap on messages inside one live connection, for the Match and Matchmaker objects. The rate
 * limits in worker/index.ts only see a connection open; after that, every message wakes the
 * object and counts against the free plan. The app sends at most about one a second (Quick
 * match's tick), so 30 in 10 seconds is plenty for real play.
 *
 * Kept in memory only: it starts over when the object sleeps, which is fine, because a flood
 * keeps it awake. Pings never reach it (they're answered without waking the object).
 */
export const FLOOD_WINDOW_MS = 10_000;
/** Messages a connection may send in one window. Past this they're dropped. */
export const FLOOD_MAX = 30;
/** Past this many in one window, the connection is closed. The app reconnects on its own. */
export const FLOOD_CLOSE = 90;
/** Close code for a flooding connection. Under 4000, so the app tries again (src/lib/useMatch.ts). */
export const FLOOD_CODE = 1008;

export type FloodVerdict = 'ok' | 'drop' | 'close';

export class Flood {
  private seen = new WeakMap<WebSocket, { start: number; n: number }>();

  check(ws: WebSocket, now = Date.now()): FloodVerdict {
    let w = this.seen.get(ws);
    if (!w || now - w.start >= FLOOD_WINDOW_MS) {
      w = { start: now, n: 0 };
      this.seen.set(ws, w);
    }
    w.n++;
    return w.n > FLOOD_CLOSE ? 'close' : w.n > FLOOD_MAX ? 'drop' : 'ok';
  }

  /** True when the message should be handled. Closes the connection once it's clearly a flood. */
  allow(ws: WebSocket, now = Date.now()) {
    const v = this.check(ws, now);
    if (v === 'close') {
      try { ws.close(FLOOD_CODE, 'too-fast'); } catch { /* already closed */ }
    }
    return v === 'ok';
  }
}
