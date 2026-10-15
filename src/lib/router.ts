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
  | { name: 'play'; id: string };

export type Go = (r: Route, o?: { replace?: boolean }) => void;

export function parse(path: string): Route {
  const play = path.match(/^\/play\/([A-Za-z0-9]{5,24})\/?$/);
  if (play) return { name: 'play', id: play[1].length === 5 ? play[1].toUpperCase() : play[1] };
  if (path.startsWith('/ranks')) return { name: 'ranks' };
  if (path.startsWith('/search')) return { name: 'search' };
  if (path.startsWith('/you')) return { name: 'profile' };
  return { name: 'home' };
}

export function pathOf(r: Route): string {
  switch (r.name) {
    case 'play': return `/play/${r.id}`;
    case 'ranks': return '/ranks';
    case 'search': return '/search';
    case 'profile': return '/you';
    default: return '/';
  }
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => {
    const r = parse(location.pathname);
    // A mistyped address shows Home, so make the address bar say so too.
    if (pathOf(r) !== location.pathname && r.name !== 'play') history.replaceState(null, '', pathOf(r) + location.search);
    return r;
  });

  useEffect(() => {
    const onPop = () => setRoute(parse(location.pathname));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback<Go>((next, opts = {}) => {
    const path = pathOf(next);
    if (path !== location.pathname) history[opts.replace ? 'replaceState' : 'pushState'](null, '', path);
    setRoute(next);
  }, []);

  return [route, go] as const;
}
