/**
 * The live connection to one match. Reconnects on its own after a dropped line (phones
 * switching networks, a screen waking up) and stops for good when the server says the
 * match is gone, full, short of stake, or opened in another tab.
 */
import ReconnectingWebSocket from 'partysocket/ws';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ErrorCode, MatchView, Reward, ServerMsg } from '../../shared/protocol';
import { socketUrl } from './api';
import { toast } from './toast';

/** How often a match socket checks it can still hear the server. */
const PING_MS = 10_000;

export type LinkStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** A line someone said: an emote from either player, or Baba Ayo talking. */
export interface Said { id: number; seat: 0 | 1 | 'bot'; text: string }

let nextId = 1;

export function useMatch(matchId: string, token: string) {
  const ws = useRef<ReconnectingWebSocket | null>(null);
  const offset = useRef(0);
  const lastPhase = useRef<MatchView['phase'] | null>(null);
  const [view, setView] = useState<MatchView | null>(null);
  const [status, setStatus] = useState<LinkStatus>('connecting');
  const [error, setError] = useState<{ code: ErrorCode; message: string } | null>(null);
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [said, setSaid] = useState<Said | null>(null);

  useEffect(() => {
    // A phone opening the match in the background says so, so it doesn't count as in the app.
    const sock = new ReconnectingWebSocket(() => socketUrl(`/api/match/${matchId}`, token, document.hidden ? { hidden: 1 } : {}), [], {
      minReconnectionDelay: 400,
      maxReconnectionDelay: 4000,
      maxRetries: 60,
      // 4000 and up are deliberate closes from our server. Reconnecting would not help.
      shouldReconnectOnClose: (e) => e.code < 4000,
    } as ConstructorParameters<typeof ReconnectingWebSocket>[2]);
    ws.current = sock;

    // Tell the server whether you're in the app, so leaving pauses the match.
    const presence = () => {
      if (sock.readyState === sock.OPEN) sock.send(JSON.stringify({ t: document.hidden ? 'away' : 'back' } satisfies ClientMsg));
    };
    const onOpen = () => {
      setStatus('open');
      if (document.hidden) presence();
    };
    const onClose = (e: CloseEvent) => setStatus(e.code >= 4000 ? 'closed' : 'reconnecting');
    // Losing signal can leave a socket looking open for a long time, so the board would sit
    // there while your moves go nowhere. Say so the moment the phone knows it's offline, and
    // treat a socket that stops answering as gone (found in testing, 15 October 2026).
    let heard = Date.now();
    const onOffline = () => setStatus('reconnecting');
    const onOnline = () => sock.reconnect();
    // Coming back to the app starts the count again, so a phone back from the background
    // doesn't reconnect a line that's fine.
    const onShow = () => {
      if (!document.hidden) heard = Date.now();
    };
    const onMessage = (e: MessageEvent) => {
      heard = Date.now();
      if (e.data === 'pong') return;
      let m: ServerMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (m.t) {
        case 'state':
          offset.current = m.s.now - Date.now();
          // A rematch started: last series' reward no longer applies.
          if (lastPhase.current === 'over' && m.s.phase !== 'over') setReward(null);
          lastPhase.current = m.s.phase;
          setView(m.s);
          break;
        case 'reward':
          setReward(m.r);
          break;
        case 'emote':
          setSaid({ id: nextId++, seat: m.seat, text: m.e });
          break;
        case 'say':
          setSaid({ id: nextId++, seat: 'bot', text: m.text });
          break;
        case 'unsent':
          toast.error(m.message);
          break;
        case 'error':
          if (m.code === 'bad-move') break;
          // Once you are in a match, a stake problem is about a rematch: a note, not the end.
          if ((m.code === 'stake-short' || m.code === 'rematch-off') && lastPhase.current) setNotice({ id: nextId++, message: m.message });
          else setError({ code: m.code, message: m.message });
          break;
      }
    };

    sock.addEventListener('open', onOpen);
    sock.addEventListener('close', onClose as EventListener);
    sock.addEventListener('message', onMessage as EventListener);
    document.addEventListener('visibilitychange', presence);
    document.addEventListener('visibilitychange', onShow);
    addEventListener('offline', onOffline);
    addEventListener('online', onOnline);
    // Keepalive. The server answers 'ping' without waking up, so this costs nothing there.
    // Two pings in a row with no answer: reconnect.
    const ping = setInterval(() => {
      if (sock.readyState !== sock.OPEN || document.hidden) return;
      if (Date.now() - heard > PING_MS * 2 + 2_000) {
        setStatus('reconnecting');
        heard = Date.now();
        sock.reconnect();
        return;
      }
      sock.send('ping');
    }, PING_MS);

    return () => {
      document.removeEventListener('visibilitychange', presence);
      document.removeEventListener('visibilitychange', onShow);
      removeEventListener('offline', onOffline);
      removeEventListener('online', onOnline);
      clearInterval(ping);
      sock.close();
      ws.current = null;
    };
  }, [matchId, token]);

  const send = useCallback((m: ClientMsg) => {
    ws.current?.send(JSON.stringify(m));
  }, []);

  /** Shows your own line straight away instead of waiting for the round trip. */
  const emote = useCallback(
    (seat: 0 | 1, e: string) => {
      setSaid({ id: nextId++, seat, text: e });
      send({ t: 'emote', e });
    },
    [send],
  );

  /** A message you typed. It shows once the server passes it on, so you never see one the other player didn't get. */
  const say = useCallback((text: string) => send({ t: 'emote', e: text }), [send]);

  const clearReward = useCallback(() => setReward(null), []);
  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return { view, status, error, notice, reward, said, send, emote, say, serverNow, clearReward };
}
