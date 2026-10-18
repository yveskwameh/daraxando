/**
 * Keeps an eye on the friend room you're hosting while you're anywhere else in the app.
 * When your friend joins, a pop-up slides down with Play, over whatever screen you're on.
 * If the invite sheet is still open, it shows your friend and Start the game itself.
 *
 * It holds a small socket to the room only while the app is on screen, so the friend's
 * screen can honestly say you've been told.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MODES } from '../../shared/modes';
import type { RoomStatus } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { api, socketUrl } from '../lib/api';
import { buzz } from '../lib/haptics';
import { hosted, useHosted, useInviteOpen } from '../lib/room';
import type { Go, Route } from '../lib/router';
import { usePlayer } from '../lib/session';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';
import { Avatar, Icon } from './art';
import { TopPop } from './TopPop';

const onVisibility = (f: () => void) => {
  document.addEventListener('visibilitychange', f);
  return () => document.removeEventListener('visibilitychange', f);
};
const useVisible = () => useSyncExternalStore(onVisibility, () => !document.hidden);

export function RoomWatch({ route, go }: { route: Route; go: Go }) {
  const { token } = usePlayer();
  const room = useHosted();
  const sheetShowing = useInviteOpen();
  const visible = useVisible();
  const code = room?.code ?? null;
  const inRoom = route.name === 'play' && route.id === code;
  const watching = !!code && !inRoom && visible;

  useEffect(() => {
    if (!watching || !code) return;
    let sock: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    let stopped = false;
    const open = () => {
      sock = new WebSocket(socketUrl(`/api/rooms/${code}/watch`, token));
      sock.onmessage = (e) => {
        if (e.data === 'pong') return;
        let m: RoomStatus;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (m.t !== 'room') return;
        tries = 0;
        if (m.open) hosted.update(code, m.guest, m.stake);
        else hosted.clear(code);
      };
      sock.onclose = (e) => {
        if (stopped) return;
        // 4000 and up: the room is gone or isn't yours. Nothing to watch.
        if (e.code >= 4000) return hosted.clear(code);
        retry = setTimeout(open, Math.min(8000, 500 * 2 ** tries++));
      };
    };
    open();
    const ping = setInterval(() => sock?.readyState === WebSocket.OPEN && sock.send('ping'), 25_000);
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(ping);
      sock?.close();
    };
  }, [watching, code, token]);

  // Your friend just joined: make some noise, once.
  const guest = room?.guest ?? null;
  const told = useRef<string | null>(null);
  useEffect(() => {
    if (!guest) told.current = null;
    if (!guest || !code || inRoom) return;
    const key = `${code}:${guest.name}`;
    if (told.current === key) return;
    told.current = key;
    sfx.found();
    buzz('win');
  }, [guest, code, inRoom]);

  // Swiped away: hidden until another friend joins. The room stays open, and Play a friend
  // still shows it.
  const [hidden, setHidden] = useState<string | null>(null);

  // Not while you're in the room already, or in the middle of another match, or while the
  // invite sheet is showing your friend and its own Start the game button.
  if (!room || !guest || route.name === 'play' || sheetShowing || hidden === `${room.code}:${guest.name}`) return null;

  const close = async () => {
    hosted.clear(room.code);
    try {
      await api.cancelRoom(token, room.code);
      toast(room.stake ? `Room closed. ${guest.name} gets their stake back.` : 'Room closed.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <TopPop className="room-pop" role="alertdialog" label={`${guest.name} joined your room`} onHide={() => setHidden(`${room.code}:${guest.name}`)}>
      <Avatar avatar={guest.avatar} print={guest.print} size={40} />
      <div>
        <b>{guest.name} joined your room</b>
        <span>{MODES[room.mode].name} · {room.stake ? `Stake ${fmt(room.stake)}` : 'No stake'}</span>
      </div>
      <button type="button" className="mini-btn" onClick={() => go({ name: 'play', id: room.code })}>Play</button>
      <button type="button" className="x-btn" aria-label="Close the room" onClick={() => void close()}>
        <Icon id="i-close" className="" />
      </button>
    </TopPop>
  );
}
