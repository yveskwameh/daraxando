/**
 * Quick match: join a game someone is already waiting in (Yves, 15 October 2026).
 *
 * Tapping a card on the Deck starts your own game and waits for someone. Quick match does the
 * opposite: it shows the games waiting right now, one at a time, best first (your state, then
 * your zone, then whoever has waited longest). The person who started a game set its stake,
 * so you never pick one here: you see it, and tapping Join is agreeing to it. "Show another"
 * moves to the next game.
 *
 * Nobody waiting: a 3-second countdown, then your own game starts with your last game and
 * stake, so two people tapping Quick match at once still find each other. "Start now" skips
 * the wait, "Change game or stake" opens the stake picker, and X or a swipe cancels.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODES, seriesLabel } from '../../shared/modes';
import { stateName } from '../../shared/places';
import type { LiveGame } from '../../shared/protocol';
import { fmt, prize } from '../../shared/stakes';
import { Avatar, Cowries, Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { buzz } from '../lib/haptics';
import { usePrefs } from '../lib/prefs';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';
import { useLobby } from '../lib/useLobby';

/** Long enough to change your mind, short enough to feel instant. */
export const START_OWN_SECONDS = 3;

interface Props {
  open: boolean;
  onClose: () => void;
  go: Go;
  /** Start your own game with your last game and stake (the search screen). */
  onStartOwn: () => void;
  /** Pick a different game or stake first (the stake picker). */
  onChange: () => void;
  /** Tells Home how many games are live, so its button stays honest. */
  onCount?: (n: number) => void;
}

export default function LiveSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} label="Quick match">
      {props.open && <Body {...props} />}
    </Sheet>
  );
}

function Body({ go, onStartOwn, onChange, onCount }: Props) {
  const { token } = usePlayer();
  const { mode, stake } = usePrefs();
  const [games, setGames] = useState<LiveGame[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [joining, setJoining] = useState<LiveGame | null>(null);
  const [count, setCount] = useState(START_OWN_SECONDS);
  const [now, setNow] = useState(() => Date.now());
  const counted = useRef(onCount);
  counted.current = onCount;

  const load = useCallback(async () => {
    try {
      const r = await api.live(token);
      setGames(r.games);
      counted.current?.(r.n);
    } catch {
      setGames((g) => g ?? []);
    }
  }, [token]);

  // Fresh list on open, then every few seconds (faster while counting down), so a game that
  // was taken disappears and a new one shows up. Not while joining.
  const none = games !== null && games.length === 0;
  useEffect(() => {
    if (joining) return;
    void load();
    const t = setInterval(() => void load(), none ? 1_500 : 4_000);
    return () => clearInterval(t);
  }, [load, joining, none]);

  // One tick a second: the waiting times and the countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  // The countdown runs only while nobody is waiting. A game appearing stops it.
  useEffect(() => {
    if (!none || joining) {
      setCount(START_OWN_SECONDS);
      return;
    }
    if (count <= 0) {
      onStartOwn();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1_000);
    return () => clearTimeout(t);
  }, [none, joining, count, onStartOwn]);

  const game = useMemo(() => (games ? games.find((g) => g.id === current) ?? games[0] ?? null : null), [games, current]);

  const showAnother = () => {
    if (!games || games.length < 2 || !game) return;
    buzz('tap');
    const i = games.findIndex((g) => g.id === game.id);
    setCurrent(games[(i + 1) % games.length].id);
  };

  // Joining: a search aimed at that one player. Matched goes straight into the game.
  const onMatched = useCallback((id: string) => {
    sfx.found();
    go({ name: 'play', id });
  }, [go]);
  const onGone = useCallback(() => {
    const was = joining;
    setJoining(null);
    if (was) {
      toast(`${was.name}'s game was taken. Here's the next one.`);
      setGames((g) => (g ? g.filter((x) => x.id !== was.id) : g));
      setCurrent(null);
    }
  }, [joining]);
  const queue = useMemo(
    () => (joining ? { mode: joining.mode, stake: joining.stake, wide: true, target: joining.id } : { mode, stake }),
    [joining, mode, stake],
  );
  const { error } = useLobby(token, queue, onMatched, !!joining, onGone);
  useEffect(() => {
    if (error && joining) {
      toast(error);
      setJoining(null);
    }
  }, [error, joining]);

  if (games === null) {
    return (
      <>
        <div>
          <h2>Quick match</h2>
          <p className="fine">Looking for games waiting for a player.</p>
        </div>
        <div className="live-card loading" aria-hidden="true" />
      </>
    );
  }

  if (!game) {
    const m = MODES[mode];
    return (
      <>
        <div>
          <h2>Nobody is waiting</h2>
          <p className="fine">Starting your own game, so the next player who taps Quick match joins you.</p>
        </div>
        <div className="live-own" role="status" aria-live="polite">
          <span className="live-count" aria-label={`Starting in ${count}`}><b key={count}>{Math.max(count, 0)}</b></span>
          <div>
            <b>{m.name}</b>
            <span>{m.rule} {seriesLabel(m.bo)}</span>
            <span className="live-stake">{stake ? <>Stake <Cowries n={stake} /> each</> : 'Free, no stake'}</span>
          </div>
        </div>
        <button type="button" className="btn primary block lg" onClick={() => { buzz('tap'); onStartOwn(); }}>Start now</button>
        <div className="more">
          <button type="button" className="link-btn" onClick={onChange}>Change game or stake</button>
        </div>
      </>
    );
  }

  const m = MODES[game.mode];
  const waited = Math.max(0, Math.round((now - game.since) / 1000));
  const others = games.length - 1;
  return (
    <>
      <div>
        <h2>Live now</h2>
        <p className="fine">{games.length === 1 ? '1 game is' : `${games.length} games are`} waiting for a player.</p>
      </div>
      <div className="live-card" key={game.id}>
        <div className="live-who">
          <Avatar avatar={game.avatar} print={game.print} size={52} />
          <div>
            <b>{game.name}</b>
            <span><Icon id="i-pin" className="pin" />{stateName(game.state)}</span>
          </div>
          <span className="live-wait"><i aria-hidden="true" />Waiting {waited < 60 ? `${waited}s` : `${Math.floor(waited / 60)}m`}</span>
        </div>
        <div className="live-game">
          <b>{m.name}</b>
          <span>{m.rule} {seriesLabel(m.bo)}.</span>
        </div>
        <div className="live-pot">
          {game.stake ? (
            <>
              <span>Stake <Cowries n={game.stake} /> each</span>
              <span>Winner takes <b>{fmt(prize(game.stake))}</b></span>
            </>
          ) : (
            <span>Free, no stake. Play for Aura.</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="btn primary block lg"
        disabled={!!joining}
        onClick={() => { buzz('tap'); setJoining(game); }}
      >
        {joining ? 'Joining…' : `Join ${game.name}`}
      </button>
      <div className="more">
        {others > 0 && <button type="button" className="link-btn" disabled={!!joining} onClick={showAnother}>Show another ({others})</button>}
        <button type="button" className="link-btn" disabled={!!joining} onClick={onStartOwn}>Start my own game</button>
      </div>
      {game.stake > 0 && <p className="fine center">Joining puts in your stake. You can't buy, sell, send or cash out Dara Seeds.</p>}
    </>
  );
}
