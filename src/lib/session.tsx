/**
 * Who is playing. A guest token in localStorage plus the profile it belongs to. Every
 * screen reads the profile from here, and matches update it when they end.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StateCode } from '../../shared/places';
import type { Profile } from '../../shared/protocol';
import { ApiError, api, RESTING, type ProfilePatch } from './api';
import { hosted } from './room';
import { KEYS, store } from './storage';
import { toast } from './toast';
import { TERMS_VERSION } from '../../shared/legal';

type Status = 'loading' | 'guest' | 'ready' | 'offline' | 'resting';

interface SessionValue {
  status: Status;
  token: string | null;
  profile: Profile | null;
  /**
   * Makes a new player. `first` runs with their token before the app switches over, so the
   * first screen they see can already be their first game.
   */
  start: (p: { name: string; avatar: string; state: StateCode }, first?: (token: string) => Promise<void>) => Promise<void>;
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

  useEffect(() => {
    if (!token || fresh.current === token) return;
    let live = true;
    setStatus('loading');
    fetchedAt.current = Date.now();
    api.me(token).then(
      ({ profile }) => {
        if (live) {
          setProfile(profile);
          setStatus('ready');
        }
      },
      (err: ApiError) => {
        if (!live) return;
        if (err.status === 401) {
          store.remove(KEYS.token);
          setToken(null);
          setStatus('guest');
        } else {
          setStatus(err.status === RESTING ? 'resting' : 'offline');
        }
      },
    );
    return () => {
      live = false;
    };
  }, [token, attempt]);

  const start = useCallback(async (p: { name: string; avatar: string; state: StateCode }, first?: (token: string) => Promise<void>) => {
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
    } catch { /* keep what we have */ }
  }, [token]);

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
      status, token, profile, start, refresh, setProfile, update, reset, signIn, signOut, returning, returned,
      retry: () => { fresh.current = null; setAttempt((n) => n + 1); },
    }),
    [status, token, profile, start, refresh, update, reset, signIn, signOut, returning, returned],
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
