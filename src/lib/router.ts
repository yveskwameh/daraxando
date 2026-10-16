/**
 * Five screens do not need a router library. The URL holds the screen, so a friend room
 * link (/play/K7P2Q) opens straight into the room, and the back button works.
 */
import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'ranks' }
  | { name: 'profile' }
  | { name: 'search' }
  | { name: 'play'; id: string }
  /** The link in a sign-in code email, /c/<id>/<secret> (worker/accounts.ts): a page that asks before using it. `link` is "<id>.<secret>". */
  | { name: 'code'; link: string }
  /** The privacy notice and the terms (src/legal/), readable with or without a player. */
  | { name: 'legal'; doc: 'privacy' | 'terms' };

export type Go = (r: Route, o?: { replace?: boolean }) => void;

export function parse(path: string): Route {
  const play = path.match(/^\/play\/([A-Za-z0-9]{5,24})\/?$/);
  if (play) return { name: 'play', id: play[1].length === 5 ? play[1].toUpperCase() : play[1] };
  const code = path.match(/^\/c\/([A-Za-z0-9_-]{8,24})\/([A-Za-z0-9_-]{16,64})\/?$/);
  if (code) return { name: 'code', link: `${code[1]}.${code[2]}` };
  if (/^\/privacy\/?$/.test(path)) return { name: 'legal', doc: 'privacy' };
  if (/^\/terms\/?$/.test(path)) return { name: 'legal', doc: 'terms' };
  if (path.startsWith('/ranks')) return { name: 'ranks' };
  if (path.startsWith('/search')) return { name: 'search' };
  if (path.startsWith('/you')) return { name: 'profile' };
  return { name: 'home' };
}

export function pathOf(r: Route): string {
  switch (r.name) {
    case 'play': return `/play/${r.id}`;
    case 'code': return `/c/${r.link.replace('.', '/')}`;
    case 'legal': return `/${r.doc}`;
    case 'ranks': return '/ranks';
    case 'search': return '/search';
    case 'profile': return '/you';
    default: return '/';
  }
}

/** True when the app moved to this screen itself, so Back can step back instead of leaving the app. */
export const movedInApp = () => Number((history.state as { depth?: number } | null)?.depth ?? 0) > 0;

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => {
    const r = parse(location.pathname);
    // A mistyped address shows Home, so make the address bar say so too.
    if (pathOf(r) !== location.pathname && r.name !== 'play') history.replaceState(null, '', pathOf(r) + location.search + location.hash);
    return r;
  });

  useEffect(() => {
    const onPop = () => setRoute(parse(location.pathname));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback<Go>((next, opts = {}) => {
    const path = pathOf(next);
    if (path !== location.pathname) {
      // Each screen the app moves to remembers how many steps in it is, so Back knows whether
      // there's a screen of ours behind it or the app was opened right here.
      const depth = Number((history.state as { depth?: number } | null)?.depth ?? 0);
      if (opts.replace) history.replaceState({ depth }, '', path);
      else history.pushState({ depth: depth + 1 }, '', path);
    }
    setRoute(next);
  }, []);

  return [route, go] as const;
}
