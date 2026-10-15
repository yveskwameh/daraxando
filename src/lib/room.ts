/**
 * The friend room you're hosting. The app keeps an eye on it wherever you are, so you
 * hear the moment your friend joins, and keeps it through a reload.
 */
import { useSyncExternalStore } from 'react';
import type { ModeId } from '../../shared/modes';
import type { RoomGuest } from '../../shared/protocol';
import { KEYS, store } from './storage';

export interface HostedRoom {
  code: string;
  mode: ModeId;
  at: number;
  /** Your friend, once they've joined. */
  guest: RoomGuest | null;
  stake: number;
}

/** The server deletes a friend room 45 minutes after it was made. */
const ROOM_TTL_MS = 45 * 60_000;

function read(): HostedRoom | null {
  try {
    const r = JSON.parse(store.get(KEYS.room) ?? 'null') as HostedRoom | null;
    return r && Date.now() - r.at < ROOM_TTL_MS ? { ...r, guest: null } : null;
  } catch {
    return null;
  }
}

let room: HostedRoom | null = read();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const hosted = {
  get: () => room,
  set(code: string, mode: ModeId, stake: number) {
    room = { code, mode, stake, at: Date.now(), guest: null };
    store.set(KEYS.room, JSON.stringify(room));
    emit();
  },
  /** What the server says about the room right now. */
  update(code: string, guest: RoomGuest | null, stake: number) {
    if (room?.code !== code || (room.guest?.name === guest?.name && room.stake === stake)) return;
    room = { ...room, guest, stake };
    emit();
  },
  clear(code?: string) {
    if (!room || (code && room.code !== code)) return;
    room = null;
    store.remove(KEYS.room);
    emit();
  },
};

export function useHosted() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => room,
  );
}

/**
 * While the invite sheet is on screen you're plainly waiting, so your friend joining takes
 * you straight into the match. Anywhere else, a pop-up asks first.
 */
let inviteOpen = 0;
export const holdAutoEnter = () => {
  inviteOpen++;
  return () => { inviteOpen--; };
};
export const autoEnter = () => inviteOpen > 0;
