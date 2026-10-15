/**
 * The live connection to one match. Reconnects on its own after a dropped line (phones
 * switching networks, a screen waking up) and stops for good when the server says the
 * match is gone, full, short of stake, or opened in another tab.
 */
import ReconnectingWebSocket from 'partysocket/ws';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ErrorCode, MatchView, Reward, ServerMsg } from '../../shared/protocol';
import { socketUrl } from './api';

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
    const onMessage = (e: MessageEvent) => {
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
        case 'error':
          if (m.code === 'bad-move') break;
          // Once you are in a match, a stake problem is about a rematch: a note, not the end.
          if (m.code === 'stake-short' && lastPhase.current) setNotice({ id: nextId++, message: m.message });
          else setError({ code: m.code, message: m.message });
          break;
      }
    };

    sock.addEventListener('open', onOpen);
    sock.addEventListener('close', onClose as EventListener);
    sock.addEventListener('message', onMessage as EventListener);
    document.addEventListener('visibilitychange', presence);
    // Keepalive. The server answers 'ping' without waking up, so this costs nothing there.
    const ping = setInterval(() => sock.readyState === sock.OPEN && sock.send('ping'), 25_000);

    return () => {
      document.removeEventListener('visibilitychange', presence);
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

  const clearReward = useCallback(() => setReward(null), []);
  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return { view, status, error, notice, reward, said, send, emote, serverNow, clearReward };
}
