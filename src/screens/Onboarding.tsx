/**
 * First visit: one screen, one tap. The app picks a name, an animal and a best guess at your
 * state, shows them, and Play now starts your first game against Baba Ayo straight away.
 * Change opens a sheet to pick your own. Someone who arrived through a friend's room link
 * joins the room instead.
 *
 * Tapping Play now is also how you confirm you're 13 or older and accept the Terms of play
 * (shared/legal.ts records which version), so it costs no extra step but is still something you
 * do, not something we assume.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { AVATARS } from '../../shared/collections';
import { DEFAULT_MODE } from '../../shared/modes';
import { stateName, type StateCode } from '../../shared/places';
import { cleanName, nameChars } from '../../shared/protocol';
import { Avatar, Icon, Wordmark } from '../components/art';
import { DemoBoard } from '../components/DemoBoard';
import { Sheet } from '../components/Sheet';
import { StatePicker } from '../components/StatePicker';
import { api, ApiError, type RoomPeek } from '../lib/api';
import { buzz } from '../lib/haptics';
import { NAME_POOL, suggestNames } from '../lib/names';
import type { Go, Route } from '../lib/router';
import { useSession } from '../lib/session';
import { LegalLink } from '../components/LegalLink';
import { codesOn, firstScreen, phonePlayers, takeLinkedCode } from '../lib/codes';

const SaveSheet = lazy(() => import('../sheets/SaveSheet'));
// Player codes (src/lib/codes.ts): type a code, and "Welcome back" on a phone that remembers players.
const FindSheet = lazy(() => import('../sheets/FindSheet'));
const WelcomeBack = lazy(() => import('../components/AccountPops').then((x) => ({ default: x.WelcomeBack })));

const OPEN = AVATARS.filter((a) => a.lvl === 1);
/** The first game: the default game (Fading) against Baba Ayo at his easiest. Instant, and winnable. */
const FIRST_MODE = DEFAULT_MODE;
const FIRST_LEVEL = 'jeje';

export function Onboarding({ route, go }: { route: Route; go: Go }) {
  const { start } = useSession();
  // Fixed at the start. Play now changes the route to the first game before this screen goes.
  const [room] = useState(() => (route.name === 'play' ? route.id : null));
  const [host, setHost] = useState<RoomPeek['host']>(null);
  const [ideas] = useState(() => suggestNames(6));
  const [name, setName] = useState(() => ideas[0]);
  const [avatar, setAvatar] = useState(() => OPEN[Math.floor(Math.random() * OPEN.length)].id);
  const [state, setState] = useState<StateCode | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // This phone has made as many new players as it may this month (worker/phones.ts): sign in instead.
  const [full, setFull] = useState(false);
  // Someone who saved their progress on another phone. Stays mounted after the first open, so it can slide away.
  const [signin, setSignin] = useState(false);
  const [signinUsed, setSigninUsed] = useState(false);
  // With player codes: the code sheet first, Google or email from there. A code from a shared link opens it filled in.
  const codes = codesOn();
  const [linked] = useState(() => (codes ? takeLinkedCode() : null));
  const [find, setFind] = useState(!!linked);
  const [findUsed, setFindUsed] = useState(!!linked);
  // A phone that remembers players opens on "Welcome back" instead of making a new one.
  const [welcome, setWelcome] = useState(() => {
    const fresh = firstScreen.fresh;
    firstScreen.fresh = false;
    return codes && !fresh && !linked && !room && phonePlayers.own().length > 0;
  });

  // A best guess from the network, only to fill in the card. The player sees it and can change it.
  useEffect(() => {
    api.where().then((r) => setState((s) => s ?? r.state), () => {});
  }, []);

  // Arrived through a friend's link: say who invited them.
  useEffect(() => {
    if (room) api.peekRoom(room).then((r) => setHost(r.host), () => {});
  }, [room]);

  const clean = cleanName(name);

  const play = async () => {
    if (!clean || busy) return;
    setBusy(true);
    setError('');
    buzz('tap');
    try {
      // A name from the ideas is the game's pick: the server adds a number if it's taken, and Home
      // asks for the player's own name after this first match.
      await start({ name: clean, avatar, state: state ?? 'NONE', auto: NAME_POOL.includes(clean) }, async (token) => {
        if (room) return;
        // One game, not a series: win it and you're through to Home (worker/match.ts, `first`).
        const { matchId } = await api.playBot(token, FIRST_MODE, FIRST_LEVEL, true);
        go({ name: 'play', id: matchId }, { replace: true });
      });
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError && err.status === 403) setFull(true);
      setBusy(false);
    }
  };
  const openSignin = () => {
    if (codes) {
      setFindUsed(true);
      setFind(true);
      return;
    }
    setSigninUsed(true);
    setSignin(true);
  };
  const openOther = () => {
    setFind(false);
    setSigninUsed(true);
    setSignin(true);
  };

  if (welcome) return <Suspense fallback={null}><WelcomeBack onNew={() => setWelcome(false)} /></Suspense>;

  return (
    <main className="screen onb welcome" aria-label="Welcome">
      <div className="onb-head">
        <div className="onb-top">
          <Wordmark />
          <button type="button" className="mini-btn ghost" onClick={openSignin}>Sign in</button>
        </div>
        <p>
          {room
            ? `${host?.name ?? 'Your friend'} invited you to a game. They're waiting for you.`
            : 'Three in a row. Warm up against Baba Ayo, then play people across Nigeria.'}
        </p>
      </div>

      <div className="mb-wrap welcome-board" aria-hidden="true">
        <DemoBoard mode="classic" piece="calabash" playing />
      </div>

      <div className="me-card">
        <Avatar avatar={avatar} print="line" size={48} />
        <div>
          <span className="kicker">You play as</span>
          <b>{clean || 'Pick a name'}</b>
          <span><Icon id="i-pin" className="" />{stateName(state)}</span>
        </div>
        <button type="button" className="mini-btn" onClick={() => setEditing(true)}>Change</button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {full ? (
        <button type="button" className="btn primary block lg" onClick={openSignin}>Sign in to your player</button>
      ) : (
        <button type="button" className="btn primary block lg" disabled={!clean || busy} onClick={play}>
          {busy ? 'Setting up the board' : room ? 'Join the game' : 'Play now'}
        </button>
      )}
      {full ? (
        <p className="fine age">{codes ? 'Made a player before? Use your player code, Google or email to play as that player.' : 'Saved your progress before? Sign in with Google or your email to play as that player.'}</p>
      ) : (
        <p className="fine age">
          By tapping {room ? 'Join the game' : 'Play now'}, you agree to the <LegalLink doc="terms">Terms of play</LegalLink>, confirm
          you're 13 or older, and have read the <LegalLink doc="privacy">Privacy notice</LegalLink>.
        </p>
      )}

      <Suspense fallback={null}>
        {signinUsed && <SaveSheet open={signin} onClose={() => setSignin(false)} intent="signin" back={room ? `/play/${room}` : '/'} />}
        {findUsed && <FindSheet open={find} onClose={() => setFind(false)} initial={linked} onOther={openOther} />}
      </Suspense>

      <Sheet open={editing} onClose={() => setEditing(false)} label="Make it yours" closeButton={false}>
        <h2>Make it yours</h2>
        <div className="edit">
          <label className="kicker" htmlFor="onb-name">Your name</label>
          <div className="name-row">
            <input
              id="onb-name"
              className="text-in"
              value={name}
              maxLength={16}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setName(nameChars(e.target.value))}
            />
            <button type="button" className="icon-btn" aria-label="Another name idea" onClick={() => { setName(suggestNames(1, name)[0]); buzz('tap'); }}>
              <Icon id="i-shuffle" />
            </button>
          </div>
          <div className="chips-row ideas">
            {ideas.slice(0, 3).map((n) => (
              <button key={n} type="button" aria-pressed={n === name} onClick={() => setName(n)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="onb-avs" role="group" aria-label="Your animal">
          {OPEN.map((a) => (
            <button key={a.id} type="button" className="tile" aria-pressed={avatar === a.id} onClick={() => { setAvatar(a.id); buzz('tap'); }}>
              <Avatar avatar={a.id} print="line" size={48} />
              <b>{a.name}</b>
            </button>
          ))}
        </div>
        <span className="kicker">Your state</span>
        <div className="scroll onb-states">
          <StatePicker value={state} onPick={(s) => { setState(s); buzz('tap'); }} />
        </div>
        <p className="fine">Quick match looks for players in your state first. We only keep the state you pick.</p>
        <button type="button" className="btn cream block" disabled={!clean} onClick={() => setEditing(false)}>Done</button>
      </Sheet>
    </main>
  );
}
