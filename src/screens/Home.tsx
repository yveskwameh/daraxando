/**
 * Home, layout A (Yves, 17 October 2026: calmer, one obvious button, docs/NEXT-ROUND.md).
 * At the top: you (the ring fills toward your next title), today's counters (streak, quests,
 * Dara Seeds) and Ranks. In the middle: the game you play next, its rule and a demo of it on a
 * loop, with a chip to pick another game. At the bottom: Quick match, the one big button, then
 * Play a friend and Play Baba Ayo, smaller. Quick match joins a game someone is already waiting
 * in; its button says how many are live, as the server pushes them (no polling).
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { questsToday, streakNow } from '../../shared/habits';
import { isNewMode, MODES, seriesLabel } from '../../shared/modes';
import { auraForLevel, dayKey, levelInfo } from '../../shared/progression';
import type { FriendView, Profile } from '../../shared/protocol';
import { fmt, short } from '../../shared/stakes';
import { printBg } from '../art/prints';
import { Avatar, Cowries, Icon } from '../components/art';
import { DemoBoard } from '../components/DemoBoard';
import { api } from '../lib/api';
import { babaNudge, takeNudgeSlot, type Nudge } from '../lib/babaNudge';
import { reducedMotion } from '../lib/device';
import { buzz } from '../lib/haptics';
import { askAfterMatch, markAsked, takeMoment, takeVisit, visitFree } from '../lib/asks';
import { closeInstallPop, showInstallPop } from '../lib/install';
import { prefs, usePrefs } from '../lib/prefs';
import { PushAsk } from '../components/PushAsk';
import { SaveAsk } from '../components/SaveAsk';
import { TopPop } from '../components/TopPop';
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
// Only when a guest taps Save on the save ask.
const SaveSheet = lazy(() => import('../sheets/SaveSheet'));
const ModeSheet = lazy(() => import('../sheets/ModeSheet'));
// Only for players who still need to pick their name.
const NameSheet = lazy(() => import('../sheets/NameSheet'));

type SheetName = 'stake' | 'wallet' | 'friend' | 'baba' | 'streak' | 'friends' | 'quests' | 'live' | 'ban' | 'save' | 'mode' | 'name' | null;

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
  // The ask after a match (src/lib/asks.ts): save your progress or the streak reminder. Install
  // has its own pop-up (src/components/InstallPop.tsx).
  const [prompt, setPrompt] = useState<'save' | 'streak' | null>(null);
  const open = (s: SheetName) => {
    setOpened((o) => new Set(o).add(s));
    setSheet(s);
  };
  const close = () => setSheet(null);
  const ban = profile.ban;
  // Playing other people: a banned player gets the reason instead.
  const online = (s: 'stake' | 'friend' | 'live') => (ban ? open('ban') : s === 'live' ? open('live') : setSheet(s));
  // The live games come down one socket the server pushes to (src/lib/useLive.ts).
  const live = useLive(token).games?.length ?? 0;
  // Nobody to join: your own game, with your last game and stake.
  const startOwn = useCallback(() => {
    setSheet(null);
    go({ name: 'search' });
  }, [go]);
  const updateReady = useUpdateReady();
  const [updateHidden, setUpdateHidden] = useState(false);
  // Picking a game from the stake picker goes back to the stake picker.
  const [modeBack, setModeBack] = useState(false);

  useEffect(() => {
    if (!ban || banShown) return;
    banShown = true;
    open('ban');
    // Once per app open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ban]);

  // Pick your name: after the first match, or when the game had to add a number to it. It comes
  // before any other pop-up, and stays until a name is saved.
  useEffect(() => {
    if (!profile.nameAsk) return;
    if (visitFree()) takeVisit();
    open('name');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.nameAsk]);

  // Someone asked you for a friend streak: say so, like a friend request.
  useEffect(() => {
    if (ban) return;
    api.friends(token).then((d) => {
      const first = d.friends.find((f) => f.status === 'incoming') ?? null;
      asking.current = !!first;
      setAsk(first);
    }, () => {});
  }, [token, ban]);

  // One pop-up per visit, 1.2 seconds after Home opens (src/lib/asks.ts). Back from a match that
  // wasn't a loss: one of the asks, if one is due. Otherwise Baba Ayo, Duolingo-owl style: a nudge
  // when your streak is at risk, has just ended, or you've been away (at most every few hours).
  // Never with a friend streak request or the new-version pop-up showing.
  const latest = useRef({ profile, nudges: p.nudges, updateReady });
  latest.current = { profile, nudges: p.nudges, updateReady };
  useEffect(() => {
    const t = setTimeout(() => {
      const { profile: pr, nudges, updateReady: busy } = latest.current;
      const moment = takeMoment();
      if (asking.current || busy || pr.ban || pr.nameAsk || !visitFree()) return;
      const kind = moment && moment.result !== 'loss' ? askAfterMatch(pr) : null;
      if (kind === 'save' || kind === 'streak' || kind === 'install') {
        takeVisit();
        markAsked(kind);
        if (kind === 'install') showInstallPop();
        else setPrompt(kind);
        return;
      }
      if (!nudges) return;
      const n = babaNudge(pr.habits, pr.dayStreak, dayKey(Date.now()), pr.lastPlayedDay);
      if (n && takeNudgeSlot()) {
        takeVisit();
        setNudge(n);
      }
    }, 1200);
    return () => clearTimeout(t);
    // Once each time Home opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
    // The install pop-up belongs to Home. Leaving Home puts it away.
    return () => closeInstallPop();
  }, [refresh]);

  const m = MODES[p.mode];
  const isNew = isNewMode(m, dayKey(Date.now()));

  return (
    <main className="screen home" aria-label="Home">
      <HomeTop
        profile={profile}
        onYou={() => go({ name: 'profile' })}
        onStreak={() => open('streak')}
        onQuests={() => open('quests')}
        onSeeds={() => setSheet('wallet')}
        onRanks={() => go({ name: 'ranks' })}
      />

      <section className="game-pic" style={{ '--band': printBg(m.band) } as CSSProperties} aria-label={`Your game: ${m.name}. ${m.rule} ${seriesLabel(m.bo)}.`}>
        <div className="gp-head">
          <button type="button" className="gp-pick" aria-label={`Game: ${m.name}. Pick another game.`} onClick={() => open('mode')}>
            {m.name}
            <span className="chev" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
          <span className="spacer" />
          {isNew && <span className="pill hot">New</span>}
          <span className="pill">{seriesLabel(m.bo)}</span>
        </div>
        <p className="rule">{m.rule}</p>
        <div className="mb-wrap">
          <DemoBoard key={p.mode} mode={p.mode} piece={profile.piece} playing={!reducedMotion()} />
        </div>
      </section>

      <div className="actions">
        <button
          type="button"
          className="btn primary block lg"
          aria-label={live ? `Quick match. ${live} ${live === 1 ? 'game is' : 'games are'} waiting for a player.` : `Quick match. Nobody is waiting yet. You can start your own ${m.name} game${p.stake ? ` at ${fmt(p.stake)}` : ', free'}.`}
          onClick={() => online('live')}
        >
          Quick match{' '}
          <span className="stake-pill">
            {live ? (
              <><i className="live-dot" aria-hidden="true" />{live} live</>
            ) : p.stake ? <Cowries n={p.stake} /> : 'Free'}
          </span>
        </button>
        <div className="more">
          <button type="button" className="btn alt sm" onClick={() => online('friend')}>Play a friend</button>
          <button type="button" className="btn baba sm" onClick={() => setSheet('baba')}>Play Baba Ayo</button>
        </div>
      </div>

      {prompt === 'streak' && !ask && (
        <PushAsk
          kind="streak"
          title={`Keep your ${profile.dayStreak}-day streak`}
          line="One reminder at 7 pm, only on days you haven't played."
          token={token}
          onDone={() => setPrompt(null)}
        />
      )}
      {prompt === 'save' && !ask && !profile.saved && (
        <SaveAsk
          profile={profile}
          onSave={() => {
            setPrompt(null);
            open('save');
          }}
          onClose={() => setPrompt(null)}
        />
      )}

      {nudge && !ask && (
        <TopPop className="baba-pop" role="alertdialog" label="Baba Ayo" onHide={() => setNudge(null)}>
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
        </TopPop>
      )}

      {ask && (
        // Swiping up only hides the request. It's still there next time Home opens; X declines it.
        <TopPop className="room-pop" role="alertdialog" label={`${ask.name} wants a friend streak`} onHide={() => setAsk(null)}>
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
        </TopPop>
      )}

      {updateReady && !updateHidden && (
        // Hidden, the new version still arrives by itself the next time the player leaves the app.
        <TopPop role="status" onHide={() => setUpdateHidden(true)}>
          <img className="app-ic" src="/icons/icon-192.png" alt="" width={40} height={40} />
          <div><b>A new version is ready</b><span>Reload to get the latest Dara X&amp;O.</span></div>
          <button type="button" className="mini-btn" onClick={() => void applyUpdate()}>Reload</button>
          <span />
        </TopPop>
      )}

      <StakeSheet
        open={sheet === 'stake'}
        onClose={close}
        profile={profile}
        stake={p.stake}
        game={{
          name: m.name,
          series: seriesLabel(m.bo),
          onChange: () => {
            setModeBack(true);
            open('mode');
          },
        }}
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
        {opened.has('save') && <SaveSheet open={sheet === 'save'} onClose={close} intent="save" back="/" from="ask" />}
        {opened.has('mode') && (
          <ModeSheet
            open={sheet === 'mode'}
            onClose={() => {
              setModeBack(false);
              close();
            }}
            mode={p.mode}
            onPick={(mode) => {
              prefs.set({ mode });
              sfx.tap();
              setSheet(modeBack ? 'stake' : null);
              setModeBack(false);
            }}
          />
        )}
        {opened.has('name') && <NameSheet open={sheet === 'name'} kind={profile.nameAsk ?? 'new'} onDone={close} />}
      </Suspense>
    </main>
  );
}

/**
 * The top of Home: you, today's counters and Ranks. Your animal sits in a ring that fills as
 * you earn Aura toward your next title (the title itself is on You). The flame is grey until
 * your first match of the day, then lit. A streak that has just ended, and can still be
 * restored, gets a fuchsia dot.
 */
function HomeTop({ profile, onYou, onStreak, onQuests, onSeeds, onRanks }: {
  profile: Profile;
  onYou: () => void;
  onStreak: () => void;
  onQuests: () => void;
  onSeeds: () => void;
  onRanks: () => void;
}) {
  const lv = levelInfo(profile.aura);
  const today = dayKey(Date.now());
  const now = streakNow(profile.habits, profile.dayStreak, today);
  const quests = questsToday(profile.habits, profile.id, today, profile.dayWins);
  const done = quests.filter((q) => q.done).length;
  const ended = !!now.restorable && now.streak === 0;
  const pct = Math.max(4, (lv.into / lv.span) * 100);
  let streakSay = `${now.streak}-day streak. ${now.playedToday ? 'Done for today' : now.streak > 0 ? 'Play today to keep it' : 'Play a match today to start one'}.`;
  if (ended) streakSay = `Your ${now.restorable!.n}-day streak ended. You can still restore it.`;
  if (now.freezes) streakSay += ` ${now.freezes} Streak Freeze${now.freezes > 1 ? 's' : ''}.`;
  return (
    <header className="top home-top">
      <button
        type="button"
        className="me-ring"
        style={{ '--pct': `${pct}%` } as CSSProperties}
        aria-label={`You. Your title: ${lv.title}. ${fmt(profile.aura)} of ${fmt(auraForLevel(lv.level + 1))} Aura to become ${lv.nextTitle}.`}
        onClick={onYou}
      >
        <Avatar avatar={profile.avatar} print={profile.print} size={40} />
      </button>
      <div className="counters" role="group" aria-label="Today">
        <button type="button" className={`ct${now.playedToday ? ' lit' : ''}${ended ? ' warn' : ''}`} aria-label={`${streakSay} Open your streak.`} onClick={onStreak}>
          <Icon id={now.playedToday ? 'i-flame' : 'i-flame-off'} className="" />
          {now.streak}
        </button>
        <button type="button" className="ct q" aria-label={`Daily quests. ${done} of ${quests.length} done. Open quests.`} onClick={onQuests}>
          <Icon id="i-quest" className="" />
          {done}/{quests.length}
        </button>
        <button type="button" className="ct" aria-label={`Your Dara Seeds: ${fmt(profile.cowries)}`} onClick={onSeeds}>
          <Icon id="i-seed" className="" />
          {short(profile.cowries)}
        </button>
      </div>
      <button type="button" className="icon-btn" aria-label="Ranks" onClick={onRanks}>
        <Icon id="i-ranks" />
      </button>
    </header>
  );
}
