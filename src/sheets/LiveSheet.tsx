/**
 * Quick match: join a game someone is already waiting in (Yves, 15 October 2026).
 *
 * It shows the games waiting right now as cards you swipe through, best first (your
 * state, then your zone, then whoever has waited longest), with dots under them (Yves, 15
 * October 2026: pick the player you want, not just the next one). The person who started a
 * game set its stake, so you never pick one here: you see it, and Join is agreeing to it.
 *
 * "Start my own game" is the way to host your own game from Home (since 17 October 2026, Home's
 * game picture no longer starts one when tapped).
 *
 * Nobody waiting (Yves, 15 October 2026: the old 3-second countdown was too fast): nothing
 * starts by itself. The sheet keeps watching (the server pushes new games) and says so, with how long it has
 * looked and how many other people are looking right now. A game that shows up replaces the
 * screen. You choose: Start my own game (your last game and stake, shown under the button),
 * Change game or stake, or Play Baba Ayo.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MODES, seriesLabel } from '../../shared/modes';
import { stateName } from '../../shared/places';
import type { LiveGame } from '../../shared/protocol';
import { fmt, prize } from '../../shared/stakes';
import { Avatar, Cowries, Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { buzz } from '../lib/haptics';
import { usePrefs } from '../lib/prefs';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';
import { useLive, useLooking } from '../lib/useLive';
import { useLobby } from '../lib/useLobby';

interface Props {
  open: boolean;
  onClose: () => void;
  go: Go;
  /** Start your own game with your last game and stake (the search screen). */
  onStartOwn: () => void;
  /** Pick a different game or stake first (the stake picker). */
  onChange: () => void;
  /** Play Baba Ayo instead (his sheet). */
  onBaba: () => void;
}

export default function LiveSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} label="Quick match">
      {props.open && <Body {...props} />}
    </Sheet>
  );
}

function Body({ go, onStartOwn, onChange, onBaba }: Props) {
  const { token } = usePlayer();
  const { mode, stake } = usePrefs();
  // The server pushes the games down one socket as they change (src/lib/useLive.ts), and
  // knows this sheet is open so other people's sheets can say someone else is looking.
  const live = useLive(token);
  useLooking(true);
  // A game taken while you tried to join it goes at once, before the server's next update.
  const [taken, setTaken] = useState<ReadonlySet<string>>(() => new Set());
  const games = useMemo(() => (live.games ? live.games.filter((g) => !taken.has(g.id)) : null), [live.games, taken]);
  const looking = live.looking;
  const [current, setCurrent] = useState<string | null>(null);
  const [joining, setJoining] = useState<LiveGame | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [opened] = useState(() => Date.now());

  // One tick a second: the waiting times and how long we've been looking.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const game = useMemo(() => (games ? games.find((g) => g.id === current) ?? games[0] ?? null : null), [games, current]);
  const index = games && game ? games.indexOf(game) : 0;

  // The cards scroll sideways and snap. Whichever card is in the middle is the one Join joins.
  const track = useRef<HTMLDivElement>(null);
  const step = () => {
    const t = track.current;
    const first = t?.firstElementChild as HTMLElement | null;
    return t && first ? first.offsetWidth + parseFloat(getComputedStyle(t).columnGap || '0') : 1;
  };
  const onScroll = () => {
    const t = track.current;
    if (!t || !games?.length) return;
    const i = Math.max(0, Math.min(games.length - 1, Math.round(t.scrollLeft / step())));
    if (games[i].id !== current) setCurrent(games[i].id);
  };
  const scrollTo = (i: number, smooth = true) => {
    const t = track.current;
    if (!t) return;
    t.scrollTo({ left: i * step(), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
  };
  // The list refreshes every few seconds. Keep the card you're looking at in view.
  useLayoutEffect(() => {
    const t = track.current;
    if (!t || !games?.length) return;
    if (Math.round(t.scrollLeft / step()) !== index) scrollTo(index, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, index]);

  // Joining: a search aimed at that one player. Matched goes straight into the game.
  const onMatched = useCallback((id: string) => {
    sfx.found();
    go({ name: 'play', id });
  }, [go]);
  const onGone = useCallback(() => {
    const was = joining;
    setJoining(null);
    if (was) {
      const more = (games ?? []).some((x) => x.id !== was.id);
      toast(more ? `${was.name}'s game was taken. Here's the next one.` : `${was.name}'s game was taken. We'll keep looking.`);
      setTaken((t) => new Set(t).add(was.id));
      setCurrent(null);
    }
  }, [joining, games]);
  const queue = useMemo(
    () => (joining ? { mode: joining.mode, stake: joining.stake, wide: true, target: joining.id } : { mode, stake }),
    [joining, mode, stake],
  );
  const { error } = useLobby(token, queue, onMatched, !!joining, onGone);
  useEffect(() => {
    if (error && joining) {
      toast.error(error);
      setJoining(null);
    }
  }, [error, joining]);

  if (games === null) {
    return (
      <>
        <div className="titled">
          <h2>Quick match</h2>
          <p className="fine">Looking for games waiting for a player.</p>
        </div>
        <div className="live-card loading" aria-hidden="true" />
      </>
    );
  }

  if (!game) {
    const m = MODES[mode];
    const secs = Math.max(0, Math.round((now - opened) / 1000));
    return (
      <>
        <div className="titled">
          <h2>Nobody is waiting yet</h2>
          <p className="fine">We'll keep looking while this is open. A game shows up here the moment someone starts one.</p>
        </div>
        <div className="live-look" role="status" aria-live="polite">
          <span className="live-radar" aria-hidden="true"><i /><i /><b /></span>
          <div>
            <b>{looking ? `${looking} other ${looking === 1 ? 'player is' : 'players are'} looking` : 'Looking for players'}</b>
            <span>{looking ? 'Start your own game and they can join you.' : `Looking for ${secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`}`}</span>
          </div>
        </div>
        <div className="live-start">
          <button type="button" className="btn primary block lg" onClick={() => { buzz('tap'); onStartOwn(); }}>Start my own game</button>
          <p className="fine center">
            {m.name} · {seriesLabel(m.bo)} · {stake ? <>Stake <Cowries n={stake} /> each</> : 'No stake'}
          </p>
        </div>
        <div className="more">
          <button type="button" className="btn ghost sm" onClick={onChange}>{'Change\u00a0game or stake'}</button>
          <button type="button" className="btn baba sm" onClick={onBaba}>Play Baba Ayo</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="titled">
        <h2>Live now</h2>
        <p className="fine">
          {games.length === 1 ? '1 game is waiting for a player.' : `${games.length} games are waiting for a player. Swipe to see them all.`}
        </p>
      </div>
      <div
        ref={track}
        className={`live-track${games.length > 1 ? ' many' : ''}`}
        onScroll={onScroll}
        aria-roledescription="carousel"
        aria-label="Games waiting for a player"
      >
        {games.map((g, i) => (
          <LiveCard key={g.id} game={g} now={now} active={i === index} onPick={() => { buzz('tap'); scrollTo(i); setCurrent(g.id); }} label={`${i + 1} of ${games.length}`} />
        ))}
      </div>
      {games.length > 1 && (
        <div className="dots live-dots">
          {games.map((g, i) => (
            <button key={g.id} type="button" aria-label={`${g.name}, ${i + 1} of ${games.length}`} aria-current={i === index} onClick={() => { scrollTo(i); setCurrent(g.id); }} />
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn primary block lg"
        disabled={!!joining}
        onClick={() => { buzz('tap'); setJoining(game); }}
      >
        {joining ? 'Joining…' : `Join ${game.name}`}
      </button>
      <div className="more">
        <button type="button" className="btn ghost sm" disabled={!!joining} onClick={onStartOwn}>Start my own game</button>
      </div>
      {game.stake > 0 && <p className="fine center live-note">Joining puts in your stake. You can't buy, sell, send or cash out Dara Seeds.</p>}
    </>
  );
}

/** One waiting game: who, where, how long, the game and the stake. Tap it to bring it to the middle. */
function LiveCard({ game, now, active, onPick, label }: { game: LiveGame; now: number; active: boolean; onPick: () => void; label: string }) {
  const m = MODES[game.mode];
  const waited = Math.max(0, Math.round((now - game.since) / 1000));
  const wait = waited < 60 ? `${waited}s` : `${Math.floor(waited / 60)}m`;
  return (
    <div
      className={`live-card${active ? ' on' : ''}`}
      role="group"
      aria-roledescription="slide"
      aria-label={`${label}: ${game.name}`}
      aria-current={active || undefined}
      onClick={active ? undefined : onPick}
    >
      <div className="live-who">
        <Avatar avatar={game.avatar} print={game.print} size={52} />
        <div>
          <b>{game.name}</b>
          <span><Icon id="i-pin" className="pin" />{stateName(game.state)}<em className="live-wait-short"> · {wait}</em></span>
        </div>
        <span className="live-wait"><i aria-hidden="true" />Waiting {wait}</span>
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
  );
}
