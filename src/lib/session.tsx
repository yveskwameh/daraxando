/**
 * Who is playing. A guest token in localStorage plus the profile it belongs to. Every
 * screen reads the profile from here, and matches update it when they end.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StateCode } from '../../shared/places';
import type { Profile } from '../../shared/protocol';
import { ApiError, api, RESTING, type ProfilePatch } from './api';
import { offlineOn, syncOffline } from './offline';
import { hosted } from './room';
import { KEYS, store } from './storage';
import { toast } from './toast';
import { TERMS_VERSION } from '../../shared/legal';

type Status = 'loading' | 'guest' | 'ready' | 'offline' | 'resting';

interface SessionValue {
  status: Status;
  /**
   * The game's server answered last time we asked. False without internet: with offline play on
   * (src/lib/offline.ts), Home opens from the copy of your player and Baba Ayo plays on the phone.
   */
  online: boolean;
  token: string | null;
  profile: Profile | null;
  /**
   * Makes a new player. `first` runs with their token before the app switches over, so the
   * first screen they see can already be their first game.
   */
  start: (p: { name: string; avatar: string; state: StateCode; auto?: boolean }, first?: (token: string) => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => void;
  /** Changes your profile straight away, then saves it. Puts it back if saving fails. */
  update: (patch: ProfilePatch) => Promise<boolean>;
  /** The token stopped working (for example the local database was reset). Start over as a new player. */
  reset: () => void;
  retry: () => void;
  /** Becomes another player: signed in with Google or an email code, or switched to. */
  signIn: (token: string, profile: Profile) => void;
  /** Leaves this phone with no player. Only offered to saved players, who can sign back in. */
  signOut: () => void;
  /**
   * Back from Google's sign-in page: the id of the outcome waiting on the server, from the
   * address (#signin=…). src/screens/Account.tsx collects it, then calls `returned`.
   */
  returning: string | null;
  returned: () => void;
}

/** Read once as the app loads, and removed from the address so a reload doesn't try it again. */
const RETURNING = (() => {
  const m = location.hash.match(/^#signin=([A-Za-z0-9_-]{16,64})$/);
  if (!m) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  return m[1];
})();

const Ctx = createContext<SessionValue | null>(null);

/** The copy of your player kept for playing without internet, if it belongs to this login. */
function saved(token: string): Profile | null {
  const s = store.json<{ t: string | null; p: Profile | null }>(KEYS.me, { t: null, p: null });
  return s.t === token ? s.p : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => store.get(KEYS.token));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [returning, setReturning] = useState(RETURNING);
  // A phone with no player waits on the way back from Google: it may be about to sign in.
  const [status, setStatus] = useState<Status>(token || returning ? 'loading' : 'guest');
  const [attempt, setAttempt] = useState(0);
  // A player made a moment ago: their profile is already here, no need to fetch it.
  const fresh = useRef<string | null>(null);
  // A profile fetched a moment ago is fresh enough: Home asks on every visit, and on the free
  // plan every request counts (docs/BACKEND.md).
  const fetchedAt = useRef(0);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!token || fresh.current === token) return;
    let live = true;
    setStatus('loading');
    fetchedAt.current = Date.now();
    api.me(token).then(
      ({ profile }) => {
        if (live) {
          setProfile(profile);
          setOnline(true);
          setStatus('ready');
        }
      },
      (err: ApiError) => {
        if (!live) return;
        if (err.status === 401) {
          store.remove(KEYS.token);
          setToken(null);
          setStatus('guest');
        } else if (err.status === 0 && offlineOn() && saved(token)) {
          // No internet: open from the copy of your player, so Baba Ayo can still be played.
          setProfile(saved(token));
          setOnline(false);
          setStatus('ready');
        } else {
          setStatus(err.status === RESTING ? 'resting' : 'offline');
        }
      },
    );
    return () => {
      live = false;
    };
  }, [token, attempt]);

  const start = useCallback(async (p: { name: string; avatar: string; state: StateCode; auto?: boolean }, first?: (token: string) => Promise<void>) => {
    const res = await api.createPlayer({ ...p, age: true, terms: TERMS_VERSION });
    store.set(KEYS.token, res.token);
    // If the first game can't be set up, they still land on Home, signed in.
    if (first) await first(res.token).catch(() => {});
    fresh.current = res.token;
    setProfile(res.profile);
    setToken(res.token);
    setStatus('ready');
  }, []);

  const refresh = useCallback(async () => {
    if (!token || Date.now() - fetchedAt.current < 4_000) return;
    fetchedAt.current = Date.now();
    try {
      setProfile((await api.me(token)).profile);
      setOnline(true);
    } catch (err) {
      // Keep what we have.
      if ((err as ApiError).status === 0) setOnline(false);
    }
  }, [token]);

  // The connection comes and goes: check again when it's back.
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    const up = () => {
      fetchedAt.current = 0;
      void latest.current();
    };
    const down = () => setOnline(false);
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  }, []);

  // With offline play on: keep a copy of your player, and send matches played without
  // internet once the server answers again, also each time the app comes back on screen.
  const pid = profile?.id;
  useEffect(() => {
    if (!profile || !token || !online || !offlineOn()) return;
    store.set(KEYS.me, JSON.stringify({ t: token, p: profile }));
  }, [profile, token, online]);
  useEffect(() => {
    if (status !== 'ready' || !online || !token || !pid) return;
    const go = () => !document.hidden && syncOffline(token, pid, setProfile);
    go();
    document.addEventListener('visibilitychange', go);
    return () => document.removeEventListener('visibilitychange', go);
  }, [status, online, token, pid]);

  const update = useCallback(
    async (patch: ProfilePatch) => {
      if (!token || !profile) return false;
      const before = profile;
      setProfile({ ...profile, ...patch });
      try {
        const res = await api.updateMe(token, patch);
        setProfile(res.profile);
        return true;
      } catch (err) {
        setProfile(before);
        toast.error((err as Error).message);
        return false;
      }
    },
    [token, profile],
  );

  const reset = useCallback(() => {
    store.remove(KEYS.token);
    // The copies kept for playing without internet belong to the player leaving.
    store.remove(KEYS.me);
    store.remove(KEYS.ranks);
    setToken(null);
    setProfile(null);
    setStatus('guest');
  }, []);

  const signIn = useCallback((next: string, p: Profile) => {
    // A friend room belongs to the player who made it.
    hosted.clear();
    store.set(KEYS.token, next);
    fresh.current = next;
    fetchedAt.current = Date.now();
    setProfile(p);
    setToken(next);
    setStatus('ready');
  }, []);

  const signOut = useCallback(() => {
    hosted.clear();
    reset();
  }, [reset]);

  const returned = useCallback(() => {
    setReturning(null);
    setStatus((s) => (s === 'loading' && !store.get(KEYS.token) ? 'guest' : s));
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status, online, token, profile, start, refresh, setProfile, update, reset, signIn, signOut, returning, returned,
      retry: () => { fresh.current = null; setAttempt((n) => n + 1); },
    }),
    [status, online, token, profile, start, refresh, update, reset, signIn, signOut, returning, returned],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** For screens that only render once someone is signed in. */
export function usePlayer() {
  const s = useSession();
  if (!s.token || !s.profile) throw new Error('usePlayer before the session is ready');
  return { ...s, token: s.token, profile: s.profile };
}
