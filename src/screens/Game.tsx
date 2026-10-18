/**
 * A match. Opponent on top, the board in the middle, you at the bottom: the layout every
 * board game app has taught people to read. The server decides everything; this screen
 * shows it, plays the sounds, and puts your piece down the instant you tap.
 */
import { AnimatePresence, LazyMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { BOT_LEVEL_INFO } from '../../shared/bot';
import { cleanMessage, hasContact, MSG_CONTACT, MSG_MAX } from '../../shared/chat';
import { pieceById } from '../../shared/collections';
import { DEFAULT_MODE, MODES, seriesLabel, variantOf, winsNeeded } from '../../shared/modes';
import { dayKey } from '../../shared/progression';
import { stateName } from '../../shared/places';
import { ABANDON_MS, AWAY_MS, EMOTES, FIRST_MATCH_TURN_MS, FIRST_TURN_BONUS_MS, NEXT_WAIT_MS, type MatchView, type SeatView } from '../../shared/protocol';
import { findWin, squareName, type Cell } from '../../shared/rules';
import { fmt, FRIEND_TABLES, prize, short, tableLock } from '../../shared/stakes';
import { printBg } from '../art/prints';
import { Avatar, Icon, Piece } from '../components/art';
import { MusicToggle } from '../components/MusicToggle';
import { Sheet } from '../components/Sheet';
import { Celebrate, stepsFor } from '../components/Celebrate';
import { VsSplash } from '../components/VsSplash';
import { api } from '../lib/api';
import { isLite, reducedMotion } from '../lib/device';
import { buzz } from '../lib/haptics';
import { babaLine } from '../lib/babaNudge';
import { prefs } from '../lib/prefs';
import { markAsked, mayAskFriends, noteMatchEnd } from '../lib/asks';
import { PushAsk } from '../components/PushAsk';
import { hosted } from '../lib/room';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';
import { useCountdown } from '../lib/useCountdown';
import { useLocalMatch } from '../lib/localMatch';
import { isLocalMatch } from '../lib/offline';
import { useMatch } from '../lib/useMatch';
import { ResultSheet } from '../sheets/ResultSheet';
import { CodeButton, shareInvite } from '../sheets/FriendSheet';

type Conn = ReturnType<typeof useMatch> & { offline: { counts: boolean; aura: number } | null };

const motionFeatures = () => import('../lib/motionFeatures').then((x) => x.default);

const STAMP_MS = 380;
const LOW_MS = 3000;
/** After a game, the board and its stamp stay in view this long before the Next game sheet. */
const NEXT_SHEET_MS = 1500;

export function Game({ id, go }: { id: string; go: Go }) {
  return (
    <LazyMotion features={motionFeatures} strict>
      <Match id={id} go={go} />
    </LazyMotion>
  );
}

function Match({ id, go }: { id: string; go: Go }) {
  const { token, profile, refresh, reset } = usePlayer();
  // A match played on the phone without internet (src/lib/localMatch.ts) or one on the server.
  // The screen is keyed by the match id, so one screen always uses the same kind, and the
  // order of hooks never changes.
  const m: Conn = isLocalMatch(id) ? useLocalMatch(id) : { ...useMatch(id, token), offline: null };
  const v = m.view;
  const send = m.send;

  const you = v?.you ?? null;
  const me = you !== null && v ? v.seats[you] : null;
  const opp = you !== null && v ? v.seats[you === 0 ? 1 : 0] : null;
  const mode = MODES[v?.mode ?? DEFAULT_MODE];
  const variant = useMemo(() => variantOf(v?.mode ?? DEFAULT_MODE), [v?.mode]);
  const playing = v?.phase === 'playing';
  // Someone left the app: the clock is frozen and nobody can move.
  const paused = !!v?.paused;
  const myTurn = !!(playing && !paused && me && v?.turn === me.mark);

  const [pending, setPending] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'leave' | 'emote' | null>(null);
  const [vs, setVs] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [leaveLine] = useState(() => babaLine('leaving'));
  // After a match: streak, quests and badge moments come first, then the result sheet.
  const [celebrated, setCelebrated] = useState(false);
  const [rewardLate, setRewardLate] = useState(false);
  const [bubble, setBubble] = useState<{ side: 'me' | 'op'; text: string; id: number } | null>(null);
  const [lineCool, setLineCool] = useState(false);
  // What you're typing in Say something, and whether you've muted the other player for this match.
  const [draft, setDraft] = useState('');
  const [muted, setMuted] = useState(false);
  const [focusCell, setFocusCell] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const tapped = useRef<number | null>(null);

  const left = useCountdown(playing ? (v?.turnEndsAt ?? null) : null, m.serverNow);
  const awayEnds = (playing || v?.phase === 'between') && opp && !opp.bot && !opp.connected && opp.leftAt ? opp.leftAt + AWAY_MS : null;
  const awayLeft = useCountdown(awayEnds, m.serverNow);
  const low = left !== null && left <= LOW_MS;

  /* The board as the server sees it, plus your own tap while it is on its way. */
  const board = useMemo<Cell[]>(() => {
    if (!v) return [];
    if (pending === null || v.board[pending] || !me) return v.board;
    const b = v.board.slice();
    b[pending] = me.mark;
    // In Fading your oldest piece goes the moment you place, so show that too.
    if (v.fading !== null && v.turn === me.mark) b[v.fading] = null;
    return b;
  }, [v, pending, me]);

  const threat = useMemo(() => {
    if (!v || !myTurn || !opp) return false;
    return findWin(v.board, v.hist, opp.mark, variant) >= 0;
  }, [v, myTurn, opp, variant]);

  const showFlash = useCallback((text: string) => {
    setFlash(text);
    setTimeout(() => setFlash((f) => (f === text ? null : f)), 2200);
  }, []);

  /* ---------- reacting to the server ---------- */

  // Timers for sounds and overlays. They outlive later updates (a move or a reward can arrive
  // in the middle of a stamp) and are only cleared when the screen closes.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const prev = useRef<MatchView | null>(null);
  useEffect(() => {
    if (!v || !me || !opp) {
      prev.current = v;
      return;
    }
    const before = prev.current;
    prev.current = v;
    setPending(null);

    const moved = before && v.lastMove !== null && (v.lastMove !== before.lastMove || v.game !== before.game);
    if (moved && v.phase !== 'waiting') {
      const i = v.lastMove!;
      const who = v.board[i] ?? before.turn;
      if (who === opp.mark) {
        sfx.op();
        // They just took the square you needed.
        if (before.phase === 'playing' && findWin(before.board, before.hist, me.mark, variant) === i) showFlash('Haba! They blocked you.');
      } else if (who === me.mark && tapped.current !== i && before.turn === me.mark) {
        sfx.me();
        showFlash('Otilo! Time up.');
      }
      tapped.current = null;
    }

    // A new series with two players: show who you're up against.
    const freshSeries = v.phase === 'playing' && v.game === 1 && v.board.every((c) => !c) && (!before || before.phase === 'waiting' || before.phase === 'over');
    if (freshSeries && v.kind !== 'bot') {
      setVs(true);
      sfx.stamp();
      buzz('stamp');
      later(() => setVs(false), reducedMotion() ? 700 : 1700);
    }
    if (v.phase !== 'over') {
      setShowResult(false);
      setCelebrated(false);
      setRewardLate(false);
    }
    if (v.phase !== 'between') setShowNext(false);
    else if (before?.phase === 'playing') later(() => setShowNext(true), NEXT_SHEET_MS);
    else if (!before || before.phase !== 'between') setShowNext(true);

    // A game just ended.
    const ended = before?.phase === 'playing' && (v.phase === 'between' || v.phase === 'over');
    if (ended && v.result && v.result.reason !== 'aborted') {
      const w = v.result.winner;
      const stamped = v.result.reason === 'line' || v.result.reason === 'draw' || v.result.reason === 'timeout';
      if (stamped) {
        later(() => { sfx.stamp(); buzz('stamp'); }, STAMP_MS);
        later(() => {
          if (w === me.mark) { sfx.win(); buzz('win'); } else if (w) { sfx.lose(); buzz('lose'); } else { sfx.draw(); buzz('draw'); }
        }, STAMP_MS + 140);
      }
    }

    // The series is decided: let the stamp land, then show the result.
    if (v.phase === 'over' && before?.phase !== 'over') {
      const delay = v.series?.reason === 'aborted' ? 200 : ended ? 1700 : 600;
      later(() => setShowResult(true), delay);
      if (v.series?.winner === v.you && !reducedMotion() && !isLite) {
        later(() => {
          void import('canvas-confetti').then(({ default: confetti }) =>
            confetti({ particleCount: 90, spread: 75, origin: { y: 0.5 }, colors: ['#ffc921', '#ff4fb8', '#9b8fff', '#fff4e0'], disableForReducedMotion: true }),
          );
        }, delay + 200);
      }
    } else if (v.phase === 'over' && !before) {
      setShowResult(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  // Your own friend room: while it waits, the app watches it for you from any screen.
  // Once the match starts (or ends), there is nothing left to watch.
  const roomPhase = v?.kind === 'friend' ? v.phase : null;
  useEffect(() => {
    if (!v || roomPhase === null) return;
    if (roomPhase !== 'waiting') hosted.clear(v.id);
    else if (you === 0 && hosted.get()?.code !== v.id) hosted.set(v.id, v.mode, v.stake);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomPhase, you, v?.id]);

  // The result sheet waits a moment for the reward, so the streak can show first.
  const waitingReward = v?.phase === 'over' && showResult && !m.reward;
  useEffect(() => {
    if (!waitingReward) return;
    const t = setTimeout(() => setRewardLate(true), 2500);
    return () => clearTimeout(t);
  }, [waitingReward]);

  // Matches end with a reward. Pull the fresh profile so Home shows it, and note the match for
  // the asks on Home (src/lib/asks.ts).
  useEffect(() => {
    if (!m.reward) return;
    noteMatchEnd(m.reward, m.reward.result);
    void refresh();
  }, [m.reward, refresh]);

  useEffect(() => {
    if (m.error?.code === 'unauthorized') reset();
  }, [m.error, reset]);

  // Lines said in the match pop up next to whoever said them, longer ones for longer. A muted
  // player's lines don't show; Baba Ayo can't be muted.
  useEffect(() => {
    if (!m.said || you === null) return;
    if (muted && m.said.seat !== you && m.said.seat !== 'bot') return;
    const side = m.said.seat === you ? 'me' : 'op';
    setBubble({ side, text: m.said.text, id: m.said.id });
    const t = setTimeout(() => setBubble((b) => (b?.id === m.said!.id ? null : b)), Math.min(4500, 2000 + m.said.text.length * 60));
    return () => clearTimeout(t);
  }, [m.said, you, muted]);

  /* ---------- clocks: the browser asks, the server checks ---------- */

  const claimedFor = useRef<number | null>(null);
  useEffect(() => {
    if (left === 0 && v?.turnEndsAt && claimedFor.current !== v.turnEndsAt) {
      claimedFor.current = v.turnEndsAt;
      send({ t: 'claim' });
    }
  }, [left, v?.turnEndsAt, send]);

  useEffect(() => {
    if (awayLeft !== 0) return;
    send({ t: 'claim' });
    const t = setInterval(() => send({ t: 'claim' }), 2500);
    return () => clearInterval(t);
  }, [awayLeft, send]);

  // A quick match where the other player never connects: ask the server to call it off.
  const waitingQuick = v?.phase === 'waiting' && v.kind === 'quick';
  useEffect(() => {
    if (!waitingQuick) return;
    let repeat: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      send({ t: 'claim' });
      repeat = setInterval(() => send({ t: 'claim' }), 3000);
    }, ABANDON_MS + 1000);
    return () => { clearTimeout(start); clearInterval(repeat); };
  }, [waitingQuick, send]);

  // Between games, the next one starts when both players tap Next game. Once one has, the
  // other has NEXT_WAIT_MS to do the same, or the one who is ready can claim the match.
  const iReady = v?.phase === 'between' && you !== null && v.ready[you];
  const theyReady = v?.phase === 'between' && you !== null && v.ready[1 - you];
  const readyEnds = v?.phase === 'between' && v.readyAt && opp && !opp.bot && iReady !== theyReady ? v.readyAt + NEXT_WAIT_MS : null;
  const readyLeft = useCountdown(readyEnds, m.serverNow);
  useEffect(() => {
    if (readyLeft !== 0 || !iReady) return;
    send({ t: 'claim' });
    const t = setInterval(() => send({ t: 'claim' }), 2500);
    return () => clearInterval(t);
  }, [readyLeft, iReady, send]);

  // A soft tick for the last seconds of your own turn.
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (!myTurn || left === null || left > LOW_MS || left === 0) return;
    const sec = Math.ceil(left / 1000);
    if (lastTick.current !== sec) {
      lastTick.current = sec;
      sfx.tick();
    }
  }, [left, myTurn]);

  /* ---------- actions ---------- */

  const myMark = me?.mark;
  const pick = useCallback((i: number) => {
    if (!myTurn || !myMark || board[i] || pending !== null) {
      buzz('invalid');
      return;
    }
    setPending(i);
    tapped.current = i;
    sfx.me();
    buzz('place');
    send({ t: 'move', i });
  }, [myTurn, myMark, board, pending, send]);

  const sayLine = (e: string) => {
    if (you === null || lineCool) return;
    setSheet(null);
    m.emote(you, e);
    buzz('tap');
    setLineCool(true);
    setTimeout(() => setLineCool(false), 900);
  };

  // Your own message (shared/chat.ts): checked here for contact details so you see why at once,
  // then again on the server, which also checks for rude words.
  const typed = draft.trim();
  const typedProblem = typed && hasContact(typed) ? MSG_CONTACT : null;
  const sayTyped = () => {
    if (you === null || lineCool || !typed) return;
    if (typedProblem) {
      buzz('invalid');
      return;
    }
    setSheet(null);
    m.say(typed);
    setDraft('');
    buzz('tap');
    setLineCool(true);
    setTimeout(() => setLineCool(false), 1500);
  };

  // The phone's Back button (or swipe) mid-match asks first, like X does, instead of walking
  // out of a match you could lose by leaving (found in testing, 15 October 2026). An extra
  // history entry with the same address catches it.
  const guard = !!v && (v.phase === 'playing' || v.phase === 'between') && !!opp;
  useEffect(() => {
    if (!guard) return;
    history.pushState({ dara: 'guard' }, '');
    const onPop = () => {
      history.pushState({ dara: 'guard' }, '');
      setSheet('leave');
    };
    addEventListener('popstate', onPop);
    return () => {
      removeEventListener('popstate', onPop);
      if (history.state?.dara === 'guard') history.replaceState(null, '');
    };
  }, [guard]);

  const leave = () => {
    if (v && (v.phase === 'playing' || v.phase === 'between') && opp) return setSheet('leave');
    if (v?.phase === 'waiting' && v.kind === 'friend') {
      if (you === 1) leaveRoom();
      else toast("Your room stays open. We'll tell you when your friend joins.");
    }
    go({ name: 'home' });
  };

  /** A friend room before it starts: the friend leaves it, or the host closes it. Stakes go back. */
  const leaveRoom = () => {
    if (!v) return;
    send({ t: 'resign' });
    const back = v.stake ? ` Your ${fmt(v.stake)} Dara Seeds are back.` : '';
    toast(you === 0 ? `Room closed.${back}` : `You left the room.${back}`);
  };

  const newOpponent = () => {
    if (!v) return;
    const stake = v.kind === 'bot' ? prefs.get().stake : v.stake;
    prefs.set({ mode: v.mode, stake: tableLock(stake, profile, Date.now()) ? 0 : stake });
    go({ name: 'search' }, { replace: true });
  };

  /* Keyboard play: arrow keys move around the board, Enter or Space places. */
  const n = mode.n;
  const onBoardKey = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n };
    const d = moves[e.key];
    if (d === undefined) return;
    e.preventDefault();
    const r = Math.floor(focusCell / n);
    let next = focusCell + d;
    if ((d === -1 && focusCell % n === 0) || (d === 1 && focusCell % n === n - 1)) next = focusCell;
    if (next < 0 || next >= n * n || (Math.abs(d) === 1 && Math.floor(next / n) !== r)) next = focusCell;
    setFocusCell(next);
    (boardRef.current?.children[next] as HTMLElement | undefined)?.focus();
  };

  /* ---------- timer bars, restarted each turn from the server's clock ---------- */

  const turnEndsAt = v?.turnEndsAt ?? null;
  const pausedLeft = v?.pausedLeft ?? null;
  const timerStyle = useMemo(() => {
    if (!v) return undefined;
    const first = v.board.every((c) => !c);
    const total = (v.first ? FIRST_MATCH_TURN_MS : mode.turnMs) + (first ? FIRST_TURN_BONUS_MS : 0);
    // Paused: the bar stands still where the clock stopped.
    if (pausedLeft !== null) return { '--from': Math.min(1, pausedLeft / total) } as CSSProperties;
    if (!turnEndsAt) return undefined;
    const remaining = Math.max(0, turnEndsAt - m.serverNow());
    return { '--left': `${remaining}ms`, '--from': Math.min(1, remaining / total) } as CSSProperties;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnEndsAt, pausedLeft]);

  /* ---------- states before the board ---------- */

  if (m.error && m.error.code !== 'unauthorized') {
    const copy: Record<string, [string, string]> = {
      'not-found': ['This match has ended', 'The room closed or the link is wrong. Start a new one from Home.'],
      'room-full': ['This room is full', 'Two players are already in it. Ask your friend for a new code.'],
      replaced: ['Open in another tab', 'You opened this match somewhere else, so this tab stepped aside.'],
      'stake-short': ['Not enough Dara Seeds', m.error.message],
      banned: ["You can't play other people right now", 'Baba Ayo still works. Find him on Home.'],
    };
    const [head, text] = copy[m.error.code] ?? ['Something is off with this match', m.error.message];
    return (
      <main className="screen center">
        <div className="empty">
          <Icon id={m.error.code === 'stake-short' ? 'i-seed' : m.error.code === 'banned' ? 'i-lock' : 'i-wifi-off'} className="big" />
          <h2>{head}</h2>
          <p>{text}</p>
          <button type="button" className="btn cream" onClick={() => go({ name: 'home' }, { replace: true })}>Back to home</button>
        </div>
      </main>
    );
  }

  if (!v || !me) {
    return (
      <main className="screen center" aria-busy="true">
        <div className="loader" aria-hidden="true"><span /><span /><span /></div>
        <p className="muted">{m.status === 'reconnecting' ? 'Reconnecting' : 'Joining the match'}</p>
      </main>
    );
  }

  const myPiece = me.piece;
  const over = v.phase === 'over';
  const between = v.phase === 'between';
  const waitingFriend = v.kind === 'friend' && !opp;
  // Both in the room, but one of them isn't looking yet. The game starts when they are.
  const waitingRoom = v.phase === 'waiting' && v.kind === 'friend' && !!opp;
  const need = winsNeeded(v.bo);
  const stamp = (between || over) && v.result && ['line', 'draw', 'timeout'].includes(v.result.reason) ? v.result : null;

  let status = '';
  if (flash) status = flash;
  else if (v.phase === 'waiting') status = waitingFriend || waitingRoom ? '' : 'Jeje, e dey come';
  else if ((between || over) && v.result) {
    const w = v.result.winner;
    if (v.result.reason === 'timeout') status = w === me.mark ? `${opp?.name} ran out of time.` : 'Otilo! You ran out of time.';
    else if (v.result.reason === 'abandon' || v.result.reason === 'resign') status = w === me.mark ? `${opp?.name} left the match.` : 'You left the match.';
    else if (v.result.reason === 'aborted') status = 'Match called off.';
    else status = w === me.mark ? 'Yawwa! You win this one.' : w ? 'We move. Next one.' : 'Draw. Nobody wins this one.';
  } else if (playing) {
    if (paused) status = `Paused. Waiting for ${opp?.name}`;
    else if (myTurn) {
      const piece = pieceById(myPiece).short;
      // Fading: say the rule before your first piece, and which piece goes once you have three.
      const fresh = mode.fade > 0 && !v.board.some((c) => c === me.mark);
      status = low ? 'Sharp sharp!'
        : threat ? 'Shine your eye. They have a line.'
        : fresh ? `Fading: ${mode.fade} pieces each. Your oldest one goes.`
        : mode.fade > 0 && v.fading !== null ? `Place one. Your faded ${piece} goes.`
        : `Oya, place your ${piece}`;
    }
    else status = opp?.bot ? 'Baba Ayo is thinking' : 'Jeje, e dey come';
  }

  const label = `${seriesLabel(v.bo)}${v.stake ? ` · Pot ${short(v.stake * 2)}` : ''}`;

  return (
    <main className={`screen${over ? ' is-over' : ''}`} aria-label="Match">
      <div className="g-top">
        <button type="button" className="icon-btn" aria-label="Leave the match" onClick={leave}><Icon id="i-close" /></button>
        <div className="series" aria-label={`${label}. You ${me.score}, ${opp?.name ?? 'them'} ${opp?.score ?? 0}.`}>
          <span className="lbl">{label}</span>
          <div className="rows" aria-hidden="true">
            <span className="p me-p">{Array.from({ length: need }, (_, i) => <i key={i} className={i < me.score ? 'on' : ''} />)}</span>
            <span className="p op-p">{Array.from({ length: need }, (_, i) => <i key={i} className={i < (opp?.score ?? 0) ? 'on' : ''} />)}</span>
          </div>
        </div>
        <MusicToggle />
      </div>

      {m.status === 'reconnecting' && (
        <p className="banner" role="status"><Icon id="i-wifi-off" className="" />Connection lost. Reconnecting.</p>
      )}

      {opp ? (
        <Plate
          seat={opp}
          side="op"
          sub={opp.bot ? `Bot · ${BOT_LEVEL_INFO[v.level ?? 'sharp'].name}` : `${v.kind === 'friend' ? 'Friend · ' : ''}${stateName(opp.state)}`}
          away={awayLeft !== null && awayEnds ? Math.ceil(awayLeft / 1000) : null}
          turn={playing && v.turn === opp.mark}
          low={low && v.turn === opp.mark}
          paused={paused}
          timerStyle={timerStyle}
          timerKey={turnEndsAt}
          bubble={bubble?.side === 'op' ? bubble : null}
        />
      ) : (
        <div className="plate op" aria-hidden="true">
          <span className="slot" style={{ '--s': '46px', padding: 5 } as CSSProperties}><i /></span>
          <div><b>Your friend</b><span className="sub">Not here yet</span></div>
          <span />
        </div>
      )}

      {waitingFriend ? (
        <FriendWaiting
          code={v.id}
          stake={v.stake}
          modeName={mode.name}
          bo={mode.bo}
          isHost={v.seats[0]?.id === profile.id}
          onClose={() => { leaveRoom(); go({ name: 'home' }); }}
        />
      ) : waitingRoom && opp ? (
        <RoomWaiting view={v} opp={opp} host={you === 0} onLeave={() => { leaveRoom(); go({ name: 'home' }); }} />
      ) : (
        <div className="board-wrap">
          <div
            ref={boardRef}
            className="board"
            style={{ '--n': n } as CSSProperties}
            role="grid"
            aria-label={`${n} by ${n} board`}
            onKeyDown={onBoardKey}
          >
            {board.map((c, i) => {
              const mine = c === me.mark;
              const win = !!stamp?.line?.includes(i);
              const fading = playing && v.fading === i && c;
              const cls = `cell${c ? (mine ? ' me-c' : ' op-c') : ''}${win ? ' win' : ''}${fading ? ' fade' : ''}${playing && v.lastMove === i && c && !mine ? ' last' : ''}`;
              return (
                <button
                  key={`${v.game}-${i}`}
                  type="button"
                  role="gridcell"
                  className={cls}
                  tabIndex={i === focusCell ? 0 : -1}
                  aria-disabled={!!c || !myTurn || pending !== null}
                  aria-label={`${squareName(i, n)}, ${c ? (mine ? 'yours' : 'theirs') : 'empty'}${fading ? ', disappears next' : ''}`}
                  onFocus={() => setFocusCell(i)}
                  onClick={() => pick(i)}
                >
                  {c && <Piece key={`${c}-${i}`} id={mine ? myPiece : opp?.piece ?? 'calabash'} />}
                </button>
              );
            })}
          </div>
          {paused && opp && !opp.connected && (
            <div className="pause-card" role="status">
              <b>Paused</b>
              <span>
                {opp.name} left the app.
                {awayLeft !== null ? ` If they're not back in ${Math.ceil(awayLeft / 1000)}s, you win.` : ''}
              </span>
            </div>
          )}
          {stamp && (
            <div
              key={`stamp-${v.game}`}
              className="stamp"
              style={{ color: stamp.winner === me.mark ? 'var(--danfo)' : stamp.winner ? 'var(--fuchsia-glow)' : 'var(--cream)' }}
              aria-hidden="true"
            >
              {stamp.winner === me.mark ? 'GBAM!' : stamp.winner ? 'CHAI!' : 'NOTIN SPOIL'}
            </div>
          )}
        </div>
      )}

      <p className="g-status" aria-live="polite">{status}</p>

      <Plate
        seat={me}
        side="me"
        sub={stateName(me.state)}
        turn={playing && v.turn === me.mark}
        low={low && myTurn}
        paused={paused}
        timerStyle={timerStyle}
        timerKey={turnEndsAt}
        bubble={bubble?.side === 'me' ? bubble : null}
        onLine={opp && !over ? () => setSheet('emote') : undefined}
      />

      <AnimatePresence>
        {vs && opp && <VsSplash key="vs" me={me} opp={opp} stake={v.stake} friend={v.kind === 'friend'} />}
      </AnimatePresence>

      {opp && between && v.result && (
        <Sheet open={showNext && sheet === null} onClose={() => {}} label="Next game" locked>
          <div className="result-head">
            <span className="kicker">Game {v.game} · First to {need} wins</span>
            <p className="big">{gameLine(v.result, me, opp)}</p>
          </div>
          <div className="tally" aria-label={`You ${me.score}, ${opp.name} ${opp.score}`}>
            <span className="who me-p"><Avatar avatar={me.avatar} print={me.print} size={40} /><b>{me.score}</b><small>You</small></span>
            <span className="dash" aria-hidden="true">:</span>
            <span className="who op-p"><Avatar avatar={opp.avatar} print={opp.print} size={40} /><b>{opp.score}</b><small>{opp.name}</small></span>
          </div>
          <p className="fine" role="status">
            {opp.bot
              ? 'Baba Ayo is ready when you are.'
              : !opp.connected && awayLeft !== null
                ? `${opp.name} left the app. If they're not back in ${Math.ceil(awayLeft / 1000)}s, you win the match.`
                : iReady
                  ? `If ${opp.name} isn't ready in ${Math.ceil((readyLeft ?? NEXT_WAIT_MS) / 1000)}s, you win the match.`
                  : theyReady
                    ? `${opp.name} is ready. Tap Next game within ${Math.ceil((readyLeft ?? NEXT_WAIT_MS) / 1000)}s.`
                    : 'The next game starts when you both tap Next game.'}
          </p>
          <button
            type="button"
            className="btn primary block lg"
            disabled={iReady}
            onClick={() => { buzz('tap'); send({ t: 'next' }); }}
          >
            {iReady ? `Waiting for ${opp.name}` : 'Next game'}
          </button>
          <button type="button" className="btn ghost block" onClick={() => setSheet('leave')}>Leave match</button>
        </Sheet>
      )}

      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} label="Leave the match" closeButton={false}>
        <h2>Leave this match?</h2>
        {v.kind === 'bot' && prefs.get().nudges && (
          <div className="baba-say">
            <span className="baba-face"><Avatar avatar="baba" size={40} /></span>
            <p>{leaveLine}</p>
          </div>
        )}
        <p className="muted">
          {v.kind === 'bot'
            ? 'Baba Ayo takes the win if you leave now.'
            : v.stake ? `If you leave now, the match and the ${fmt(prize(v.stake))} pot go to ${opp?.name}.` : `If you leave now, the match goes to ${opp?.name}.`}
        </p>
        <div className="actions">
          <button type="button" className="btn cream block" onClick={() => setSheet(null)}>Stay and play</button>
          <button type="button" className="btn ghost block" onClick={() => { send({ t: 'resign' }); go({ name: 'home' }); }}>Leave</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'emote'} onClose={() => setSheet(null)} label="Say something">
        <h2>Say something</h2>
        <div className="tray">
          {EMOTES.map((e) => (
            <button key={e} type="button" disabled={lineCool} onClick={() => sayLine(e)}>{e}</button>
          ))}
        </div>
        {v.typing && (
          <form
            className="say-form"
            onSubmit={(e) => {
              e.preventDefault();
              sayTyped();
            }}
          >
            <div className="say-row">
              <label className="sr" htmlFor="say-in">Your message</label>
              <input
                id="say-in"
                className="text-in"
                value={draft}
                maxLength={MSG_MAX}
                placeholder="Type a message"
                autoComplete="off"
                enterKeyHint="send"
                aria-describedby="say-note"
                aria-invalid={!!typedProblem}
                onChange={(e) => setDraft(cleanMessage(e.target.value))}
              />
              <button type="submit" className="mini-btn" disabled={!typed || !!typedProblem || lineCool}>Send</button>
            </div>
            <p id="say-note" className={`fine${typedProblem ? ' say-no' : ''}`} role="status" aria-live="polite">
              {typedProblem ?? `Up to ${MSG_MAX} letters. No phone numbers, links or rude words.`}
            </p>
          </form>
        )}
        {opp && !opp.bot && (
          <div className="toggle-row">
            <div><b>Mute {opp.name}</b><span>Hide their messages for this match.</span></div>
            <button type="button" className="sw-toggle" role="switch" aria-checked={muted} aria-label={`Mute ${opp.name}`} onClick={() => setMuted((x) => !x)} />
          </div>
        )}
      </Sheet>

      {over && showResult && m.reward?.habits && !celebrated && stepsFor(m.reward.habits).length > 0 && (
        <Celebrate
          outcome={m.reward.habits}
          habits={{ ...profile.habits, played: [...new Set([...profile.habits.played, dayKey(Date.now())])] }}
          onDone={() => setCelebrated(true)}
        />
      )}

      {opp && (
        <ResultSheet
          open={over && showResult && (!!m.reward || rewardLate || !!m.offline) && (celebrated || stepsFor(m.reward?.habits).length === 0)}
          view={v}
          me={me}
          opp={opp}
          reward={m.reward}
          notice={m.notice?.message ?? null}
          onRematch={(ask) => send({ t: 'rematch', ...ask })}
          onNew={newOpponent}
          onHome={() => go({ name: 'home' })}
          offline={m.offline}
        />
      )}
    </main>
  );
}

/** One line about the game that just ended, for the Next game sheet. */
function gameLine(r: NonNullable<MatchView['result']>, me: SeatView, opp: SeatView) {
  if (r.reason === 'timeout') return r.winner === me.mark ? `${opp.name} ran out of time. You take this one.` : 'Otilo! You ran out of time.';
  if (r.winner === me.mark) return 'Yawwa! You win this one.';
  if (r.winner) return `${opp.name} takes this one. We move.`;
  return 'Draw. Nobody wins this one.';
}

interface PlateProps {
  seat: SeatView;
  side: 'me' | 'op';
  sub: string;
  turn: boolean;
  low: boolean;
  away?: number | null;
  paused?: boolean;
  timerStyle?: CSSProperties;
  timerKey: number | null;
  bubble: { text: string; id: number } | null;
  onLine?: () => void;
}

/** A player's nameplate. On their turn it tilts slightly, shows their print, and drains a timer. */
function Plate({ seat, side, sub, turn, low, away, paused, timerStyle, timerKey, bubble, onLine }: PlateProps) {
  return (
    <div style={{ position: 'relative', zIndex: 2 }}>
      <div
        className={`plate ${side}${turn ? ' turn' : ''}${low ? ' low' : ''}${paused ? ' paused' : ''}`}
        style={{ '--plate-print': printBg(seat.print) } as CSSProperties}
        aria-label={`${side === 'me' ? 'You' : seat.name}${turn ? ', to move' : ''}`}
      >
        <Avatar avatar={seat.avatar} print={seat.print} size={46} />
        <div style={{ minWidth: 0 }}>
          <b>{seat.name}</b>
          {away ? (
            <span className="sub away">Left the app · {away}s</span>
          ) : (
            <span className="sub">
              <Icon id="i-pin" className="" style={{ color: side === 'me' ? 'var(--indigo-glow)' : 'var(--fuchsia-glow)' }} />
              {sub}
            </span>
          )}
        </div>
        <div className="me-side">
          <span className={`piece ${side === 'me' ? 'me-c' : 'op-c'}`}><Piece id={seat.piece} /></span>
          {onLine && (
            <button type="button" className="emote-btn" aria-label="Say something" onClick={onLine}><Icon id="i-chat" /></button>
          )}
        </div>
        <span className="timer" aria-hidden="true"><i key={turn ? (paused ? 'paused' : timerKey ?? 0) : 'idle'} style={turn ? timerStyle : undefined} /></span>
      </div>
      {bubble && <div key={bubble.id} className={`bubble ${side}`} role="status">{bubble.text}</div>}
    </div>
  );
}

/**
 * A friend room with both players in it, while one of them isn't looking yet: the host is
 * on another screen or in another app, or the friend stepped away. Says where they are, so
 * nobody stares at an empty board wondering what's happening.
 */
function RoomWaiting({ view: v, opp, host, onLeave }: { view: MatchView; opp: SeatView; host: boolean; onLeave: () => void }) {
  const m = MODES[v.mode];
  let title: string;
  let copy: string;
  if (host) {
    title = `${opp.name} joined`;
    copy = v.waitingOn === 'away'
      ? 'They switched to another app. The game starts as soon as they come back.'
      : 'They lost connection for a moment. The game starts as soon as they come back.';
  } else {
    title = `Waiting for ${opp.name}`;
    copy = v.waitingOn === 'away'
      ? `${opp.name} switched to another app. The game starts as soon as they come back.`
      : v.waitingOn === 'told'
        ? `${opp.name} has been told you're here. The game starts as soon as they come in.`
        : `${opp.name} isn't in Dara X&O right now. They'll see that you joined when they open it.`;
  }
  return (
    <section className="invite room-wait" aria-live="polite">
      <span className="kicker">Room {v.id}</span>
      <h2>{title}</h2>
      <p className="muted">{copy}</p>
      <p className="fine">
        {m.name} · {seriesLabel(m.bo)}
        {v.stake ? ` · Stake ${fmt(v.stake)} each, winner takes ${fmt(prize(v.stake))}. Leave before it starts and your stake comes back.` : ' · No stake'}
      </p>
      <div className="actions-col">
        <button type="button" className="btn ghost block" onClick={onLeave}>{host ? 'Close the room' : 'Leave the room'}</button>
      </div>
    </section>
  );
}

/**
 * A friend room before the friend arrives: the code (tap it to copy), the stake, a way to send
 * the link, and a way to close the room. The game starts by itself when your friend comes in.
 */
function FriendWaiting({ code, stake, modeName, bo, isHost, onClose }: { code: string; stake: number; modeName: string; bo: number; isHost: boolean; onClose: () => void }) {
  const { token, profile } = usePlayer();
  // The host is about to send the link and wait, often outside the app: the moment to offer a
  // notification when the friend joins (src/lib/push.ts).
  const [pushAsk, setPushAsk] = useState(false);
  useEffect(() => {
    if (!isHost) return;
    const t = setTimeout(() => {
      if (!mayAskFriends()) return;
      markAsked('friends');
      setPushAsk(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [isHost]);
  const change = async (n: number) => {
    if (n > profile.cowries) {
      buzz('invalid');
      toast.error(`You need ${fmt(n)} Dara Seeds for that stake.`);
      return;
    }
    try {
      await api.setRoomStake(token, code, n);
      prefs.set({ friendStake: n });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <section className="invite" aria-label="Invite a friend">
      <span className="kicker">Room code</span>
      <CodeButton code={code} className="code" />
      <p className="muted">Send your friend the invite link, or give them the code. They tap Play a friend, then I have a code.</p>
      {isHost && (
        <div className="chips-row" role="group" aria-label="Stake" style={{ justifyContent: 'center' }}>
          {FRIEND_TABLES.map((n) => (
            <button key={n} type="button" aria-pressed={n === stake} onClick={() => void change(n)}>{n ? `${fmt(n)} seeds` : 'No stake'}</button>
          ))}
        </div>
      )}
      <p className="fine">{modeName} · {seriesLabel(bo)}{stake ? ` · Winner takes ${fmt(prize(stake))}` : ''}</p>
      <p className="near" role="status" style={{ justifyContent: 'center' }}><i />Waiting for your friend to join</p>
      <div className={`actions-col${isHost ? ' two' : ''}`}>
        <button type="button" className="btn primary block" onClick={() => void shareInvite(code, stake)}>
          {'share' in navigator ? 'Share invite link' : 'Copy invite link'}
        </button>
        {isHost && <button type="button" className="btn ghost block" onClick={onClose}>Close the room</button>}
      </div>
      {pushAsk && (
        <PushAsk
          kind="friends"
          title="Know when your friend joins"
          line="We'll tell you, even if you leave the app."
          token={token}
          onDone={() => setPushAsk(false)}
        />
      )}
    </section>
  );
}
