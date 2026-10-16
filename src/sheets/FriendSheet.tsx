/**
 * Play a friend. Two tabs: invite someone with a code and link, or type the code a friend
 * sent you. Friend rooms can stake up to 1,000 Dara Seeds.
 *
 * Inviting (Yves, 15 October 2026): tap the code to copy it, or share the link. Sharing keeps
 * you here, so when you come back from WhatsApp you see the room waiting. When your friend
 * joins, their card shows up with Start the game; nothing starts until you tap it.
 */
import { useEffect, useRef, useState } from 'react';
import { MODES, seriesLabel, type ModeId } from '../../shared/modes';
import { stateName } from '../../shared/places';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/protocol';
import { FRIEND_TABLES, fmt, prize } from '../../shared/stakes';
import { Avatar, Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { api, type RoomPeek } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { buzz } from '../lib/haptics';
import { prefs } from '../lib/prefs';
import { holdAutoEnter, hosted, useHosted } from '../lib/room';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';

type Tab = 'invite' | 'join';

export function inviteText(code: string, stake: number) {
  const url = `${location.origin}/play/${code}`;
  return {
    url,
    text: `Oya, play me on Dara X&O. Code ${code}${stake ? `, stake ${fmt(stake)} Dara Seeds` : ''}.`,
  };
}

/** Copy just the code, for a tap on the big code. */
export async function copyCode(code: string) {
  if (await copyText(code)) {
    buzz('tap');
    toast.ok(`Code ${code} copied.`);
    return true;
  }
  toast(`Copy did not work here. The code is ${code}.`);
  return false;
}

/** The room code, big. Tap it to copy. */
export function CodeButton({ code, className = 'big-code' }: { code: string | null; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className={`code-btn ${className}`}
      disabled={!code}
      aria-label={code ? `Room code ${code.split('').join(' ')}. Tap to copy.` : 'Making a room'}
      onClick={async () => { if (code && (await copyCode(code))) setCopied(true); }}
    >
      <span className="code-txt">{code ?? '·····'}</span>
      <span className="code-hint"><Icon id={copied ? 'i-check' : 'i-copy'} className="" />{copied ? 'Copied' : 'Tap to copy'}</span>
    </button>
  );
}

/** Share on a phone (WhatsApp is one tap away), copy everywhere else. True if it worked. */
export async function shareInvite(code: string, stake: number) {
  const { url, text } = inviteText(code, stake);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Dara X&O', text, url });
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false;
    }
  }
  if (await copyText(`${text} ${url}`)) {
    toast.ok('Link copied. Send it on WhatsApp.');
    return true;
  }
  toast(`Copy did not work here. The code is ${code}.`);
  return false;
}

export function FriendSheet({ open, onClose, mode, go }: { open: boolean; onClose: () => void; mode: ModeId; go: Go }) {
  const [tab, setTab] = useState<Tab>('invite');
  return (
    <Sheet open={open} onClose={onClose} label="Play a friend">
      <h2>Play a friend</h2>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'invite'} onClick={() => setTab('invite')}>Invite a friend</button>
        <button type="button" role="tab" aria-selected={tab === 'join'} onClick={() => setTab('join')}>I have a code</button>
      </div>
      {tab === 'invite' ? <Invite mode={mode} go={go} onClose={onClose} /> : <Join go={go} onClose={onClose} />}
    </Sheet>
  );
}

function Invite({ mode, go, onClose }: { mode: ModeId; go: Go; onClose: () => void }) {
  const [shared, setShared] = useState(false);
  const [roomMode, setRoomMode] = useState<ModeId>(mode);
  const { token, profile } = usePlayer();
  const [code, setCode] = useState<string | null>(null);
  const [stake, setStake] = useState(() => {
    const last = prefs.get().friendStake;
    return last <= profile.cowries ? last : 0;
  });
  const [error, setError] = useState('');
  const made = useRef(false);
  const room = useHosted();
  const guest = room && room.code === code ? room.guest : null;

  // While this is on screen it shows your friend joining itself, so the pop-up stays away.
  useEffect(() => holdAutoEnter(), []);

  // The room closed or ran out while this was open: make a fresh one.
  useEffect(() => {
    if (!code || room) return;
    made.current = false;
    setShared(false);
    setCode(null);
  }, [room, code]);

  // The room exists from the moment this tab opens, so the code on screen is real. You host
  // one room at a time: an open one for this mode is reused, any other one is closed.
  useEffect(() => {
    if (made.current) return;
    made.current = true;
    const old = hosted.get();
    // Your friend is already in your room, waiting for you: show that room, whatever its game,
    // never a new one (found in testing, 15 October 2026: a new room left the friend stranded).
    if (old?.guest) {
      setCode(old.code);
      setRoomMode(old.mode);
      setStake(old.stake);
      return;
    }
    setRoomMode(mode);
    if (old && old.mode === mode) {
      setCode(old.code);
      api.peekRoom(old.code).then(
        (r) => {
          if (r.open) return setStake(r.stake);
          hosted.clear(old.code);
          made.current = false;
          setCode(null);
        },
        () => {
          hosted.clear(old.code);
          made.current = false;
          setCode(null);
        },
      );
      return;
    }
    if (old) void api.cancelRoom(token, old.code).catch(() => {});
    api.createRoom(token, mode, stake).then(
      (r) => {
        setCode(r.matchId);
        hosted.set(r.matchId, mode, stake);
      },
      (err: Error) => setError(err.message),
    );
  }, [token, mode, stake, code]);

  const pickStake = async (n: number) => {
    if (n > profile.cowries) {
      buzz('invalid');
      toast.error(`You need ${fmt(n)} Dara Seeds for that stake.`);
      return;
    }
    const before = stake;
    setStake(n);
    prefs.set({ friendStake: n });
    buzz('tap');
    if (!code) return;
    try {
      await api.setRoomStake(token, code, n);
    } catch (err) {
      setStake(before);
      toast.error((err as Error).message);
    }
  };

  const m = MODES[roomMode];
  return (
    <>
      <p className="muted invite-lead">Send your friend the invite link, or this code.</p>
      <CodeButton code={code} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {guest ? (
        // Your friend is in: the stake is set, so it's a line instead of choices.
        <p className="fine">{m.name} · {seriesLabel(m.bo)} · {stake ? `Stake ${fmt(stake)} each, winner takes ${fmt(prize(stake))}` : 'No stake'}</p>
      ) : (
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="kicker">Stake for this game</span>
        <div className="chips-row" role="group" aria-label="Stake">
          {FRIEND_TABLES.map((n) => (
            <button key={n} type="button" aria-pressed={n === stake} onClick={() => pickStake(n)}>
              {n ? `${fmt(n)} seeds` : 'No stake'}
            </button>
          ))}
        </div>
        <p className="fine invite-mode">{m.name} · {seriesLabel(m.bo)}{stake ? ` · Winner takes ${fmt(prize(stake))}` : ''}</p>
      </div>
      )}
      {guest && code ? (
        <>
          <div className="joined" role="status">
            <Avatar avatar={guest.avatar} print={guest.print} size={40} />
            <div>
              <b>{guest.name} joined your room</b>
              <span>Start when you're ready.</span>
            </div>
          </div>
          <button
            type="button"
            className="btn primary block lg"
            onClick={() => { buzz('tap'); onClose(); go({ name: 'play', id: code }); }}
          >
            Start the game
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn primary block"
            disabled={!code}
            onClick={async () => {
              if (code && (await shareInvite(code, stake))) setShared(true);
            }}
          >
            {'share' in navigator ? (shared ? 'Share again' : 'Share invite link') : shared ? 'Copy again' : 'Copy invite link'}
          </button>
          <p className="near" role="status" style={{ justifyContent: 'center' }}>
            <i />
            {shared ? `${'share' in navigator ? 'Sent' : 'Copied'}. Waiting for your friend to join.` : 'You can close this. We\'ll tell you when they join.'}
          </p>
        </>
      )}
    </>
  );
}

function Join({ go, onClose }: { go: Go; onClose: () => void }) {
  const { profile } = usePlayer();
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<RoomPeek | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setRoom(null);
    setError('');
    if (code.length !== CODE_LENGTH) return;
    let live = true;
    api.peekRoom(code).then(
      (r) => live && setRoom(r),
      (err: Error) => live && setError(err.message),
    );
    return () => { live = false; };
  }, [code]);

  const short = room && room.stake > profile.cowries;
  // Your own code, typed back in: there's nobody to join (found in testing, 15 October 2026).
  const own = !!room && hosted.get()?.code === room.code;
  const blocked = !room || !room.open || !!short || own;
  let note = 'Your friend sets the stake. You see it before you join.';
  if (error) note = error;
  else if (own) note = "That's your own room. Send this code to a friend so they can join you.";
  else if (room && !room.open) note = 'This room is full or the match has started. Ask your friend for a new code.';
  else if (short) note = `You need ${fmt(room!.stake)} Dara Seeds for this room.`;

  return (
    <>
      <label className="muted" htmlFor="join-code">Type the 5-letter code your friend sent you.</label>
      <input
        id="join-code"
        className="field"
        data-autofocus
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={CODE_LENGTH}
        placeholder="K7P2Q"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().split('').filter((c) => CODE_ALPHABET.includes(c)).join('').slice(0, CODE_LENGTH))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !blocked) { onClose(); go({ name: 'play', id: code }); }
        }}
      />
      {room?.host && (
        <div className="host-card">
          <Avatar avatar={room.host.avatar} print={room.host.print} size={44} />
          <div>
            <b>{room.host.name}</b>
            <span className="fine">{stateName(room.host.state)} · {MODES[room.mode].name} · {room.stake ? `Stake ${fmt(room.stake)}, winner takes ${fmt(prize(room.stake))}` : 'No stake'}</span>
          </div>
        </div>
      )}
      <p className={error || short || (room && !room.open) ? 'form-error' : 'fine'}>{note}</p>
      <button
        type="button"
        className="btn primary block"
        disabled={blocked}
        onClick={() => { onClose(); go({ name: 'play', id: code }); }}
      >
        {room?.stake ? `Join game · Stake ${fmt(room.stake)}` : 'Join game'}
      </button>
    </>
  );
}
