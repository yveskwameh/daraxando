// The dashboard: sign in once with the live admin key, then four tabs. Today (the 8 am email,
// for any day, with charts), Players (find one and act), Reviews (ban reviews) and Log (every
// change made through the admin API). The Live and Test switch at the top picks the game.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, whenSignedOut } from './api.ts';
import { addDays, lagosDay } from './format.ts';
import { Log } from './screens/Log.tsx';
import { Player } from './screens/Player.tsx';
import { Players } from './screens/Players.tsx';
import { Reviews } from './screens/Reviews.tsx';
import { Section } from './screens/Section.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { Today } from './screens/Today.tsx';
import type { Copy } from './types.ts';
import { go, Icon, Loading, Problem, Toasts, usePath } from './ui.tsx';

interface Ctx {
  copy: Copy;
  /** The Lagos day the Today tab and section pages show. */
  day: string;
  setDay: (day: string) => void;
  today: string;
  /** Which games have their admin key saved on the dashboard. */
  copies: Record<Copy, boolean>;
  signOut: () => void;
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

const COPY_KEY = 'dara-admin-copy';
const readCopy = (): Copy => {
  try { return localStorage.getItem(COPY_KEY) === 'test' ? 'test' : 'live'; } catch { return 'live'; }
};

export function App() {
  const [me, setMe] = useState<{ signedIn: boolean; copies: Record<Copy, boolean> } | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [copy, setCopyState] = useState<Copy>(readCopy);
  const [today, setToday] = useState(lagosDay);
  const [day, setDay] = useState(() => addDays(lagosDay(), -1));
  const path = usePath();

  const check = () => {
    setMeError(null);
    api.me().then(setMe, (e: Error) => setMeError(e.message));
  };
  useEffect(check, []);
  useEffect(() => whenSignedOut(() => setMe((m) => (m ? { ...m, signedIn: false } : m))), []);

  // A new Lagos day while the dashboard is open moves "today" along.
  useEffect(() => {
    const t = setInterval(() => {
      const now = lagosDay();
      setToday((old) => {
        if (old !== now) setDay((d) => (d === old ? now : d));
        return now;
      });
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const setCopy = (c: Copy) => {
    setCopyState(c);
    try { localStorage.setItem(COPY_KEY, c); } catch { /* fine without it */ }
  };

  const ctx = useMemo<Ctx>(
    () => ({
      copy,
      day,
      setDay,
      today,
      copies: me?.copies ?? { live: false, test: false },
      signOut: () => api.signOut().finally(() => setMe((m) => (m ? { ...m, signedIn: false } : m))),
    }),
    [copy, day, today, me],
  );

  if (meError) return <main className="page narrow"><Problem text={meError} onRetry={check} /></main>;
  if (!me) return <main className="page narrow"><Loading /></main>;
  if (!me.signedIn) return <SignIn ready={me.copies.live} onDone={check} />;

  const tab = path.startsWith('/players') ? 'players' : path.startsWith('/reviews') ? 'reviews' : path.startsWith('/log') ? 'log' : 'today';
  const section = path.match(/^\/section\/([a-z]+)$/)?.[1];
  const playerId = path.match(/^\/players\/([0-9a-f-]{36})$/)?.[1];

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`shell copy-${copy}`}>
        <header className="top">
          <div className="top-in">
            <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go('/'); }} aria-label="Dara X&O admin, Today">
              <span className="wordmark">Dara<span className="tag">X&amp;O</span></span>
              <span className="brand-sub">Admin</span>
            </a>
            <div className="seg" role="radiogroup" aria-label="Which game">
              {(['live', 'test'] as Copy[]).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={copy === c} onClick={() => setCopy(c)}>
                  {c === 'live' ? 'Live' : 'Test'}
                </button>
              ))}
            </div>
          </div>
          {copy === 'test' && <p className="test-band">Test copy. Nothing here is the real game.</p>}
        </header>

        <main className="page" key={copy}>
          {!ctx.copies[copy] ? (
            <Problem text={`The ${copy} game's admin key isn't saved on the dashboard yet. Add ADMIN_KEY_${copy.toUpperCase()} in Cloudflare (admin/README.md).`} />
          ) : section ? (
            <Section id={section} />
          ) : playerId ? (
            <Player id={playerId} />
          ) : tab === 'players' ? (
            <Players />
          ) : tab === 'reviews' ? (
            <Reviews />
          ) : tab === 'log' ? (
            <Log />
          ) : (
            <Today />
          )}
        </main>

        <nav className="tabbar" aria-label="Dashboard">
          <div className="tabbar-in">
            {(
              [
                ['today', '/', 'Today'],
                ['players', '/players', 'Players'],
                ['reviews', '/reviews', 'Reviews'],
                ['log', '/log', 'Log'],
              ] as const
            ).map(([id, href, name]) => (
              <a
                key={id}
                href={href}
                aria-current={tab === id ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); go(href); }}
              >
                <Icon name={id} />
                <span>{name}</span>
              </a>
            ))}
          </div>
        </nav>
        <Toasts />
      </div>
    </AppCtx.Provider>
  );
}
