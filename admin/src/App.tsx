// The dashboard: sign in once with the live admin key, then five areas. Today (Live now and the
// 8 am email for any day, with charts), Players (every player, and one player to act on), Growth
// (where players come from, first days, retention), Reviews (ban reviews) and Log (every change
// made through the admin API). The Live and Test switch at the top picks the game.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, whenSignedOut } from './api.ts';
import { addDays, lagosDay } from './format.ts';
import { Growth } from './screens/Growth.tsx';
import { Log } from './screens/Log.tsx';
import { Phones } from './screens/Phones.tsx';
import { Player } from './screens/Player.tsx';
import { Players } from './screens/Players.tsx';
import { Reviews } from './screens/Reviews.tsx';
import { Section } from './screens/Section.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { Today } from './screens/Today.tsx';
import type { Copy } from './types.ts';
import { Palette } from './Palette.tsx';
import { go, Icon, Loading, Problem, Toasts, useLoad, usePath } from './ui.tsx';

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

  const tab = path.startsWith('/players') ? 'players' : path.startsWith('/growth') ? 'growth' : path.startsWith('/reviews') ? 'reviews' : path.startsWith('/log') ? 'log' : 'today';
  const section = path.match(/^\/section\/([a-z]+)$/)?.[1];
  const playerId = path.match(/^\/players\/([0-9a-f-]{36})$/)?.[1];

  return (
    <AppCtx.Provider value={ctx}>
      <Shell tab={tab} onCopy={setCopy}>
        {!ctx.copies[copy] ? (
          <Problem text={`The ${copy} game's admin key isn't saved on the dashboard yet. Add ADMIN_KEY_${copy.toUpperCase()} in Cloudflare (admin/README.md).`} />
        ) : section ? (
          <Section id={section} />
        ) : path === '/players/phones' ? (
          <Phones />
        ) : playerId ? (
          <Player id={playerId} />
        ) : tab === 'players' ? (
          <Players />
        ) : tab === 'growth' ? (
          <Growth />
        ) : tab === 'reviews' ? (
          <Reviews />
        ) : tab === 'log' ? (
          <Log />
        ) : (
          <Today />
        )}
      </Shell>
    </AppCtx.Provider>
  );
}

const NAV = [
  ['today', '/', 'Today'],
  ['players', '/players', 'Players'],
  ['growth', '/growth', 'Growth'],
  ['reviews', '/reviews', 'Reviews'],
  ['log', '/log', 'Log'],
] as const;

/**
 * The frame. On a computer: a sidebar with the navigation, search and the Live and Test switch.
 * On a phone or tablet: a slim bar at the top and a floating pill of tabs at the bottom.
 */
function Shell({ tab, onCopy, children }: { tab: string; onCopy: (c: Copy) => void; children: ReactNode }) {
  const { copy, copies, signOut } = useApp();
  const [palette, setPalette] = useState(false);
  const waiting = useLoad(copies[copy] ? `${copy}:appeals-open:nav` : null, () => api.appeals(copy, 'open'));
  const open = waiting.data?.appeals.length ?? 0;

  // Search from anywhere: Cmd+K or Ctrl+K, or / when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setPalette(true);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const nav = (cls: string) => (
    <nav className={cls} aria-label="Dashboard">
      {NAV.map(([id, href, name]) => (
        <a key={id} href={href} aria-current={tab === id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(href); }}>
          <Icon name={id} />
          <span>{name}</span>
          {id === 'reviews' && open > 0 && <b className="badge" aria-label={`${open} waiting`}>{open}</b>}
        </a>
      ))}
    </nav>
  );
  const copySwitch = (
    <div className="seg" role="radiogroup" aria-label="Which game">
      {(['live', 'test'] as Copy[]).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={copy === c} onClick={() => onCopy(c)}>
          {c === 'live' ? 'Live' : 'Test'}
        </button>
      ))}
    </div>
  );
  const brand = (
    <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go('/'); }} aria-label="Dara X&O admin, Today">
      <span className="wordmark">Dara<span className="tag">X&amp;O</span></span>
      <span className="brand-sub">Admin</span>
    </a>
  );

  return (
    <div className={`shell copy-${copy}`}>
      <aside className="side">
        {brand}
        <button type="button" className="search-btn" onClick={() => setPalette(true)}>
          <Icon name="search" size={18} />
          <span>Search players</span>
          <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        {nav('side-nav')}
        <div className="side-foot">
          <span className="side-label">Game</span>
          {copySwitch}
          <button type="button" className="side-link" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <header className="top">
        <div className="top-in">
          {brand}
          <div className="top-actions">
            <button type="button" className="icon-btn" aria-label="Search players" onClick={() => setPalette(true)}>
              <Icon name="search" size={20} />
            </button>
            {copySwitch}
          </div>
        </div>
      </header>

      <div className="main-col">
        {copy === 'test' && <p className="test-band">Test copy. Nothing here is the real game.</p>}
        <main className="page" key={copy}>{children}</main>
      </div>

      {nav('tabbar')}
      <Palette open={palette} onClose={() => setPalette(false)} onCopy={onCopy} />
      <Toasts />
    </div>
  );
}
