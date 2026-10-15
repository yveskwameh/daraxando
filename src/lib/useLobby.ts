/**
 * Quick match search. Open while searching, closed the moment a match is found or you stop.
 * With `target`, it's a join: pair with that one waiting player now, or hear they're gone.
 */
import ReconnectingWebSocket from 'partysocket/ws';
import { useEffect, useRef, useState } from 'react';
import type { ModeId } from '../../shared/modes';
import type { LobbyServerMsg, Nearby } from '../../shared/protocol';
import { socketUrl } from './api';

export function useLobby(
  token: string,
  queue: { mode: ModeId; stake: number; wide?: boolean; target?: string },
  onMatched: (matchId: string) => void,
  active = true,
  onGone?: () => void,
) {
  const [near, setNear] = useState<Nearby | null>(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matched = useRef(onMatched);
  matched.current = onMatched;
  const gone = useRef(onGone);
  gone.current = onGone;
  const { mode, stake, wide, target } = queue;

  useEffect(() => {
    if (!active) return;
    const sock = new ReconnectingWebSocket(() => socketUrl('/api/lobby', token, { mode, stake, ...(wide ? { wide: 1 } : {}), ...(target ? { target } : {}) }), [], {
      minReconnectionDelay: 500,
      maxReconnectionDelay: 4000,
      shouldReconnectOnClose: (e: CloseEvent) => e.code < 4000,
    } as ConstructorParameters<typeof ReconnectingWebSocket>[2]);

    sock.addEventListener('open', () => setOnline(true));
    sock.addEventListener('close', () => setOnline(false));
    sock.addEventListener('message', ((e: MessageEvent) => {
      if (e.data === 'pong') return;
      let m: LobbyServerMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === 'queued') setNear(m.near);
      if (m.t === 'error') setError(m.message);
      if (m.t === 'gone') {
        sock.close();
        gone.current?.();
      }
      if (m.t === 'matched') {
        sock.close();
        matched.current(m.matchId);
      }
    }) as EventListener);

    // Each tick re-runs pairing on the server, which widens the search as time passes.
    // Once a second, so a widened search finds someone the moment it can.
    const tick = setInterval(() => sock.readyState === sock.OPEN && sock.send(JSON.stringify({ t: 'tick' })), 1_000);
    return () => {
      clearInterval(tick);
      sock.close();
    };
  }, [token, mode, stake, wide, target, active]);

  return { near, online, error };
}
