import { Suspense, lazy, useEffect } from 'react';
import { Avatar, Icon } from './components/art';
import { InstallPop } from './components/InstallPop';
import { RoomWatch } from './components/RoomWatch';
import { Toast } from './components/Toast';
import { backAt } from './lib/api';
import { useRoute } from './lib/router';
import { SessionProvider, useSession } from './lib/session';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';

/* Home and onboarding ship in the first download. Everything else is its own small file,
   fetched quietly once the first screen is up, so it is ready before anyone taps. */
const load = {
  game: () => import('./screens/Game'),
  search: () => import('./screens/Search'),
  ranks: () => import('./screens/Ranks'),
  profile: () => import('./screens/Profile'),
};
const Game = lazy(() => load.game().then((x) => ({ default: x.Game })));
const Search = lazy(() => load.search().then((x) => ({ default: x.Search })));
const Ranks = lazy(() => load.ranks().then((x) => ({ default: x.Ranks })));
const Profile = lazy(() => load.profile().then((x) => ({ default: x.Profile })));
// Signing in: only fetched when an email link or Google's trip back needs it.
const CodeLink = lazy(() => import('./screens/Account').then((x) => ({ default: x.CodeLink })));
const AccountReturn = lazy(() => import('./screens/Account').then((x) => ({ default: x.AccountReturn })));

function Loading() {
  return (
    <main className="screen center" aria-busy="true">
      <div className="loader" aria-hidden="true"><span /><span /><span /></div>
      <p className="sr">Loading</p>
    </main>
  );
}

export function App() {
  return (
    <SessionProvider>
      <div className="stage">
        <div className="app" id="app">
          <Shell />
          <InstallPop />
        </div>
      </div>
      <Toast />
    </SessionProvider>
  );
}

function Shell() {
  const session = useSession();
  const [route, go] = useRoute();

  useEffect(() => {
    const prefetch = () => Object.values(load).forEach((f) => void f());
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
    idle(prefetch);
  }, []);

  // Back from Google: collect what happened, over whatever screen is showing.
  const back = session.returning && <Suspense fallback={null}><AccountReturn /></Suspense>;

  // The link in a sign-in code email works with or without a player on this phone.
  if (route.name === 'code') return <Suspense fallback={<Loading />}><CodeLink link={route.link} go={go} /></Suspense>;

  if (session.status === 'loading') return <><Loading />{back}</>;

  // The free plan's requests for the day are used up (docs/BACKEND.md). The app itself still
  // loads, because its files don't count; only the game server is resting until midnight UTC.
  if (session.status === 'resting') {
    return (
      <main className="screen center">
        <div className="empty resting">
          <Avatar avatar="baba" size={88} />
          <h2>Dara X&O is resting</h2>
          <p>So many people played today that the game is taking a short rest. It's back at {backAt()}. Your progress is safe.</p>
          <button type="button" className="btn ghost lg" onClick={session.retry}>Try again</button>
        </div>
      </main>
    );
  }

  if (session.status === 'offline') {
    return (
      <main className="screen center">
        <div className="empty">
          <Icon id="i-wifi-off" className="big" />
          <h2>Can't reach the game</h2>
          <p>Your progress is saved. Check your connection, then try again.</p>
          <button type="button" className="btn primary lg" onClick={session.retry}>Try again</button>
        </div>
      </main>
    );
  }

  if (session.status === 'guest' || !session.profile) {
    // The route is kept, so someone who opened a friend's room link lands in that room right after.
    return <><Onboarding route={route} go={go} />{back}</>;
  }

  let screen;
  switch (route.name) {
    case 'search': screen = <Search go={go} />; break;
    case 'play': screen = <Game key={route.id} id={route.id} go={go} />; break;
    case 'ranks': screen = <Ranks go={go} />; break;
    case 'profile': screen = <Profile go={go} />; break;
    default: screen = <Home go={go} />;
  }

  return (
    <>
      <Suspense fallback={<Loading />}>{screen}</Suspense>
      <RoomWatch route={route} go={go} />
      {back}
    </>
  );
}
