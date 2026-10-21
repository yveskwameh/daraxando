/**
 * The live Quick match games, pushed by the server. Home's button ("3 live") and the Quick
 * match sheet share one watching socket, open only while someone on screen uses it and the
 * app is in front. The server sends the list whenever it changes, so nothing asks over and
 * over: on Cloudflare's free plan, polling every 2 seconds was most of a day's requests.
 */
import { useEffect, useSyncExternalStore } from 'react';
import type { LiveGame, LobbyServerMsg } from '../../shared/protocol';
import { socketUrl } from './api';

export interface LiveSnap {
  /** Null until the first list arrives. */
  games: LiveGame[] | null;
  /** How many other people have the Quick match sheet open right now. */
  looking: number;
}

let snap: LiveSnap = { games: null, looking: 0 };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

// A plain WebSocket with a small retry, not partysocket: Home loads this, and every kilobyte
// on Home counts against the 100 KB first download.
let sock: WebSocket | null = null;
let sockToken = '';
let users = 0;
let looking = 0;
let ping: ReturnType<typeof setInterval> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let tries = 0;
let wanted = false;

function send(m: { t: 'looking'; on: boolean }) {
  if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify(m));
}

function open(token: string) {
  wanted = true;
  if (sock && sockToken === token && sock.readyState <= WebSocket.OPEN) return;
  sock?.close();
  clearTimeout(retry);
  sockToken = token;
  const ws = new WebSocket(socketUrl('/api/live/watch', token));
  sock = ws;
  ws.onopen = () => {
    tries = 0;
    // Back after a drop: say again whether the sheet is open.
    if (looking > 0) send({ t: 'looking', on: true });
  };
  ws.onmessage = (e) => {
    if (e.data === 'pong') return;
    let m: LobbyServerMsg;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m.t !== 'live') return;
    snap = { games: m.games, looking: m.looking };
    emit();
  };
  ws.onclose = (e) => {
    if (sock !== ws) return;
    sock = null;
    // 4000 and up: our server said no. Otherwise try again, slower each time.
    if (!wanted || e.code >= 4000) return;
    retry = setTimeout(() => wanted && open(token), Math.min(15_000, 1000 * 2 ** tries++));
  };
  // Keepalive through proxies. The server answers without waking up.
  clearInterval(ping);
  ping = setInterval(() => sock?.readyState === WebSocket.OPEN && sock.send('ping'), 30_000);
}

function close() {
  wanted = false;
  clearInterval(ping);
  clearTimeout(retry);
  const ws = sock;
  sock = null;
  sockToken = '';
  ws?.close();
}

/** Open while the app is in front and something on screen is watching; closed otherwise. */
function sync(token: string) {
  if (users > 0 && !document.hidden) open(token);
  else close();
}

/** The live games and how many others are looking. Mount it wherever they show. */
export function useLive(token: string, on = true): LiveSnap {
  useEffect(() => {
    // Quick match turned off in Controls (src/lib/controls.ts): nothing to watch.
    if (!on) return;
    users++;
    sync(token);
    const onVis = () => sync(token);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      users--;
      document.removeEventListener('visibilitychange', onVis);
      // Leaving Home for a match closes it; the next screen opens it again if it needs it.
      setTimeout(() => sync(token), 0);
    };
  }, [token, on]);
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => snap,
  );
}

/** The Quick match sheet is open: other people's sheets can say someone else is looking. */
export function useLooking(active: boolean) {
  useEffect(() => {
    if (!active) return;
    looking++;
    if (looking === 1) send({ t: 'looking', on: true });
    return () => {
      looking--;
      if (looking === 0) send({ t: 'looking', on: false });
    };
  }, [active]);
}
