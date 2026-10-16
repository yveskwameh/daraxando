/**
 * Home. Your title and Aura at the top, the Deck of modes in the middle (swipe, or tap the
 * dots), your streak and daily quests, and the three ways to play at the bottom. Tapping a
 * card starts your own game of that mode (pick a stake, then wait for a player). Quick match
 * joins a game someone is already waiting in; its button says how many are live, as the server
 * pushes them (no polling).
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { questsToday, streakNow } from '../../shared/habits';
import { MODE_IDS, MODES, seriesLabel, type ModeId } from '../../shared/modes';
import { auraForLevel, dayKey, levelInfo } from '../../shared/progression';
import type { FriendView, Profile } from '../../shared/protocol';
import { fmt, short } from '../../shared/stakes';
import { printBg } from '../art/prints';
import { Avatar, Cowries, Icon, Wordmark } from '../components/art';
import { DemoBoard } from '../components/DemoBoard';
import { MusicToggle } from '../components/MusicToggle';
import { api } from '../lib/api';
import { babaNudge, takeNudgeSlot, type Nudge } from '../lib/babaNudge';
import { reducedMotion } from '../lib/device';
import { buzz } from '../lib/haptics';
import { closeInstallPop, maybeShowInstallPop } from '../lib/install';
import { prefs, usePrefs } from '../lib/prefs';
import { applyUpdate, useUpdateReady } from '../lib/pwa';
import { useLive } from '../lib/useLive';
import type { Go } from '../lib/router';
import { sfx } from '../lib/sound';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';
import { BabaSheet } from '../sheets/BabaSheet';
import { FriendSheet } from '../sheets/FriendSheet';
import { StakeSheet } from '../sheets/StakeSheet';
import { WalletSheet } from '../sheets/WalletSheet';

// Loaded the first time they open, so Home's first download stays small.
const StreakSheet = lazy(() => import('../sheets/StreakSheet'));
const QuestsSheet = lazy(() => import('../sheets/QuestsSheet'));
const LiveSheet = lazy(() => import('../sheets/LiveSheet'));
// Only banned players ever load this one.
const BanSheet = lazy(() => import('../sheets/BanSheet'));

type SheetName = 'stake' | 'wallet' | 'friend' | 'baba' | 'streak' | 'friends' | 'quests' | 'live' | 'ban' | null;

/** A banned player sees why once each time the app opens, then whenever they tap a way to play someone. */
let banShown = false;


export function Home({ go }: { go: Go }) {
  const { profile, refresh, token } = usePlayer();
  const p = usePrefs();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [opened, setOpened] = useState<Set<SheetName>>(() => new Set());
  const [ask, setAsk] = useState<FriendView | null>(null);
  const asking = useRef(false);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const open = (s: SheetName) => {
    setOpened((o) => new Set(o).add(s));
    setSheet(s);
  };
  const close = () => setSheet(null);
  const ban = profile.ban;
  // Playing other people: a banned player gets the reason instead.
  const online = (s: 'stake' | 'friend' | 'live') => (ban ? open('ban') : s === 'live' ? open('live') : setSheet(s));
  const lv = levelInfo(profile.aura);
  // The live games come down one socket the server pushes to (src/lib/useLive.ts).
  const live = useLive(token).games?.length ?? 0;
  // Nobody to join: your own game, with your last game and stake.
  const startOwn = useCallback(() => {
    setSheet(null);
    go({ name: 'search' });
  }, [go]);
  const updateReady = useUpdateReady();

  useEffect(() => {
    if (!ban || banShown) return;
    banShown = true;
    open('ban');
    // Once per app open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ban]);

  // Someone asked you for a friend streak: say so, like a friend request.
  useEffect(() => {
    if (ban) return;
    api.friends(token).then((d) => {
      const first = d.friends.find((f) => f.status === 'incoming') ?? null;
      asking.current = !!first;
      setAsk(first);
    }, () => {});
  }, [token, ban]);

  // Baba Ayo, Duolingo-owl style: a nudge when your streak is at risk, has just ended, or
  // you've been away. At most every few hours, and never with another pop-up showing.
  useEffect(() => {
    if (!p.nudges) return;
    const t = setTimeout(() => {
      if (asking.current || profile.ban) return;
      const n = babaNudge(profile.habits, profile.dayStreak, dayKey(Date.now()), profile.lastPlayedDay);
      if (n && takeNudgeSlot()) setNudge(n);
    }, 1200);
    return () => clearTimeout(t);
    // Once per visit to Home.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
    const t = setTimeout(() => { if (!asking.current && !nudge) maybeShowInstallPop(); }, 2500);
    // The install pop-up belongs to Home. Leaving Home puts it away.
    return () => {
      clearTimeout(t);
      closeInstallPop(false);
    };
  }, [refresh]);

  const aria = `You. Your title: ${lv.title}. ${fmt(profile.aura)} of ${fmt(auraForLevel(lv.level + 1))} Aura to become ${lv.nextTitle}.`;

  return (
    <main className="screen" aria-label="Home">
      <header className="top">
        <button type="button" className="me-chip" aria-label={aria} onClick={() => go({ name: 'profile' })}>
          <Avatar avatar={profile.avatar} print={profile.print} size={40} />
          <span className="lv">
            <b>{lv.title}</b>
            <span className="aura-bar"><i style={{ width: `${Math.max(4, (lv.into / lv.span) * 100)}%` }} /></span>
          </span>
        </button>
        <span className="spacer" />
        <button type="button" className="chip" aria-label={`Your Dara Seeds: ${fmt(profile.cowries)}`} onClick={() => setSheet('wallet')}>
          <Icon id="i-seed" className="" />
          {short(profile.cowries)}
        </button>
        <button type="button" className="icon-btn" aria-label="Ranks" onClick={() => go({ name: 'ranks' })}>
          <Icon id="i-ranks" />
        </button>
        <MusicToggle />
      </header>

      <div className="brand">
        <Wordmark />
        <p className="tagline">Three in a row, the Naija way.</p>
      </div>

      <Deck
        mode={p.mode}
        piece={profile.piece}
        onMode={(mode) => prefs.set({ mode })}
        onPlay={(mode) => {
          prefs.set({ mode });
          online('stake');
        }}
      />
      <HabitBar profile={profile} onStreak={() => open('streak')} onQuests={() => open('quests')} />

      <div className="actions">
        <button
          type="button"
          className="btn primary block lg"
          aria-label={live ? `Quick match. ${live} ${live === 1 ? 'game is' : 'games are'} waiting for a player.` : `Quick match. Nobody is waiting yet. You can start your own ${MODES[p.mode].name} game${p.stake ? ` at ${fmt(p.stake)}` : ', free'}.`}
          onClick={() => online('live')}
        >
          Quick match{' '}
          <span className="stake-pill">
            {live ? (
              <><i className="live-dot" aria-hidden="true" />{live} live</>
            ) : (
              <>{MODES[p.mode].name} · {p.stake ? <Cowries n={p.stake} /> : 'Free'}</>
            )}
          </span>
        </button>
        <div className="row2">
          <button type="button" className="btn alt" onClick={() => online('friend')}>Play a friend</button>
          <button type="button" className="btn baba" onClick={() => setSheet('baba')}>Play Baba Ayo</button>
        </div>
      </div>

      {nudge && !ask && (
        <div className="install-pop baba-pop" role="alertdialog" aria-label="Baba Ayo">
          <span className={`baba-face ${nudge.kind}`}><Avatar avatar="baba" size={44} /></span>
          <div>
            <b>Baba Ayo</b>
            <span>{nudge.line}</span>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                setNudge(null);
                open(nudge.kind === 'ended' ? 'streak' : 'baba');
              }}
            >
              {nudge.action}
            </button>
          </div>
          <button type="button" className="x-btn" aria-label="Not now" onClick={() => setNudge(null)}><Icon id="i-close" className="" /></button>
        </div>
      )}

      {ask && (
        <div className="install-pop room-pop" role="alertdialog" aria-label={`${ask.name} wants a friend streak`}>
          <Avatar avatar={ask.avatar} print={ask.print} size={40} />
          <div><b>{ask.name} wants a friend streak</b><span>Keep a streak going together.</span></div>
          <button
            type="button"
            className="mini-btn"
            onClick={() => {
              const who = ask;
              setAsk(null);
              api.addFriend(token, who.id).then(() => { buzz('win'); toast.ok(`Friend streak with ${who.name} started.`); }, (err: Error) => toast.error(err.message));
            }}
          >
            Accept
          </button>
          <button
            type="button"
            className="x-btn"
            aria-label={`Decline ${ask.name}`}
            onClick={() => {
              const who = ask;
              setAsk(null);
              void api.dropFriend(token, who.id).catch(() => {});
            }}
          >
            <Icon id="i-close" className="" />
          </button>
        </div>
      )}

      {updateReady && (
        <div className="install-pop" role="status">
          <img className="app-ic" src="/icons/icon-192.png" alt="" width={40} height={40} />
          <div><b>A new version is ready</b><span>Reload to get the latest Dara X&amp;O.</span></div>
          <button type="button" className="mini-btn" onClick={() => void applyUpdate()}>Reload</button>
          <span />
        </div>
      )}

      <StakeSheet
        open={sheet === 'stake'}
        onClose={close}
        profile={profile}
        stake={p.stake}
        onGo={(stake) => {
          prefs.set({ stake });
          close();
          go({ name: 'search' });
        }}
      />
      <WalletSheet open={sheet === 'wallet'} onClose={close} />
      <FriendSheet open={sheet === 'friend'} onClose={close} mode={p.mode} go={go} />
      <BabaSheet open={sheet === 'baba'} onClose={close} mode={p.mode} go={go} />
      <Suspense fallback={null}>
        {(opened.has('streak') || opened.has('friends')) && (
          <StreakSheet open={sheet === 'streak' || sheet === 'friends'} onClose={close} tab={sheet === 'friends' ? 'friends' : 'mine'} />
        )}
        {opened.has('quests') && <QuestsSheet open={sheet === 'quests'} onClose={close} />}
        {opened.has('live') && (
          <LiveSheet open={sheet === 'live'} onClose={close} go={go} onStartOwn={startOwn} onChange={() => setSheet('stake')} onBaba={() => setSheet('baba')} />
        )}
        {ban && opened.has('ban') && <BanSheet open={sheet === 'ban'} ban={ban} onClose={close} onBaba={() => setSheet('baba')} />}
      </Suspense>
    </main>
  );
}

/** Swipeable mode cards. The card in the middle plays a short demo of its mode. */
function Deck({ mode, piece, onMode, onPlay }: { mode: ModeId; piece: string; onMode: (m: ModeId) => void; onPlay: (m: ModeId) => void }) {
  const deck = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => Math.max(0, MODE_IDS.indexOf(mode)));
  const activeRef = useRef(active);
  const still = reducedMotion();

  const centerOf = (el: HTMLElement, d: HTMLElement) => el.offsetLeft - (d.clientWidth - el.offsetWidth) / 2;

  // Start with the last mode played in the middle.
  useEffect(() => {
    const d = deck.current;
    const card = d?.children[active] as HTMLElement | undefined;
    if (d && card) d.scrollLeft = centerOf(card, d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a swipe settles, the card closest to the middle becomes the mode.
  useEffect(() => {
    const d = deck.current;
    if (!d) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const mid = d.scrollLeft + d.clientWidth / 2;
        let best = 0;
        let dist = Infinity;
        Array.from(d.children).forEach((c, i) => {
          const el = c as HTMLElement;
          const dd = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (dd < dist) { dist = dd; best = i; }
        });
        if (activeRef.current !== best) {
          activeRef.current = best;
          setActive(best);
          sfx.tap();
          onMode(MODE_IDS[best]);
        }
      }, 90);
    };
    d.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      d.removeEventListener('scroll', onScroll);
      clearTimeout(t);
    };
  }, [onMode]);

  const goTo = (i: number) => {
    const d = deck.current;
    const card = d?.children[i] as HTMLElement | undefined;
    if (d && card) d.scrollTo({ left: centerOf(card, d), behavior: still ? 'auto' : 'smooth' });
  };

  return (
    <div className="deck-wrap">
      <div className="deck" ref={deck} role="group" aria-label="Game modes. Swipe to change.">
        {MODE_IDS.map((id, i) => {
          const m = MODES[id];
          return (
            <article
              key={id}
              className="mode-card"
              role="button"
              tabIndex={0}
              aria-label={`Play ${m.name}. ${m.rule} ${seriesLabel(m.bo)}.`}
              aria-current={i === active}
              style={{ '--band': printBg(m.band) } as CSSProperties}
              onClick={() => {
                if (i !== active) goTo(i);
                onPlay(id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPlay(id);
                }
              }}
            >
              <div className="meta">
                {'hot' in m && <span className="pill hot">{m.hot}</span>}
                <span className="pill">{seriesLabel(m.bo)}</span>
                <span className="pill play" aria-hidden="true">Tap to play</span>
              </div>
              <h2>{m.name}</h2>
              <p className="rule">{m.rule}</p>
              <div className="mb-wrap">
                <DemoBoard key={i === active ? 'on' : 'off'} mode={id} piece={piece} playing={i === active && !still} />
              </div>
            </article>
          );
        })}
      </div>
      <div className="dots" role="group" aria-label="Pick a mode">
        {MODE_IDS.map((id, i) => (
          <button key={id} type="button" aria-label={MODES[id].name} aria-current={i === active} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Your streak and today's quests, as two buttons. A grey flame means you haven't played
 * today yet; it lights up after your first match, the way every streak app does it.
 */
function HabitBar({ profile, onStreak, onQuests }: { profile: Profile; onStreak: () => void; onQuests: () => void }) {
  const today = dayKey(Date.now());
  const now = streakNow(profile.habits, profile.dayStreak, today);
  const quests = questsToday(profile.habits, profile.id, today, profile.dayWins);
  const done = quests.filter((q) => q.done).length;
  let sub = 'Play a match today';
  if (now.restorable && now.streak === 0) sub = `Your ${now.restorable.n}-day streak ended`;
  else if (now.playedToday) sub = 'Done for today';
  else if (now.streak > 0) sub = 'Play today to keep it';
  return (
    <div className="habits">
      <button
        type="button"
        className={`hb${now.playedToday ? ' lit' : ''}${now.restorable && now.streak === 0 ? ' warn' : ''}`}
        aria-label={`${now.streak}-day streak. ${sub}.${now.freezes ? ` ${now.freezes} Streak Freeze${now.freezes > 1 ? 's' : ''}.` : ''} Open your streak.`}
        onClick={onStreak}
      >
        <Icon id={now.playedToday ? 'i-flame' : 'i-flame-off'} className="hb-ic" />
        <span className="t">
          <b>{now.streak > 0 ? `${now.streak}-day streak` : 'Start a streak'}</b>
          <small>{sub}</small>
        </span>
        {now.freezes > 0 && <span className="ice-n" aria-hidden="true"><Icon id="i-freeze" className="" />{now.freezes}</span>}
      </button>
      <button type="button" className="hb" aria-label={`Daily quests. ${done} of ${quests.length} done. Open quests.`} onClick={onQuests}>
        <Icon id="i-quest" className="hb-ic q" />
        <span className="t">
          <b>Quests</b>
          <small>{done === quests.length ? 'All done today' : `${done} of ${quests.length} done`}</small>
        </span>
        <span className="pips" aria-hidden="true">{quests.map((q) => <i key={q.id} className={q.done ? 'on' : ''} />)}</span>
      </button>
    </div>
  );
}
