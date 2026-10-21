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
import { borrowOver, codesOn, noteAway, phonePlayers, type Alerts } from './codes';
import { setControls } from './controls';

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
  signIn: (token: string, profile: Profile, opts?: { borrow?: boolean }) => void;
  /** Leaves this phone with no player. Only offered to saved players, who can sign back in. */
  signOut: () => void;
  /**
   * Back from Google's sign-in page: the id of the outcome waiting on the server, from the
   * address (#signin=…). src/screens/Account.tsx collects it, then calls `returned`.
   */
  returning: string | null;
  returned: () => void;
  /** What the server said about this player for its phones: their code was used elsewhere, or a recovery is waiting (src/lib/codes.ts). */
  alerts: Alerts | null;
  setAlerts: (a: Alerts | null) => void;
  /** Plays as another player this phone remembers. */
  switchTo: (id: string) => void;
  /** Takes a player off this phone. Nothing is deleted: their code still brings them back. */
  forget: (id: string) => void;
  /** Gives a borrowed phone back to its own player. */
  endBorrow: () => void;
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
  const [alerts, setAlerts] = useState<Alerts | null>(null);

  useEffect(() => {
    if (!token || fresh.current === token) return;
    let live = true;
    setStatus('loading');
    fetchedAt.current = Date.now();
    api.me(token).then(
      ({ profile, alerts: a, controls }) => {
        if (live) {
          setProfile(profile);
          setAlerts(a ?? null);
          setControls(controls);
          setOnline(true);
          setStatus('ready');
        }
      },
      (err: ApiError) => {
        if (!live) return;
        if (err.status === 401) {
          store.remove(KEYS.token);
          // Signed out from another phone ("Not me", or a recovery): the phone forgets that login.
          const gone = phonePlayers.list().find((p) => p.token === token);
          if (gone) {
            phonePlayers.remove(gone.id);
            toast(`${gone.name} was signed out on this phone. Use the player code to come back.`, 5000);
          }
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
      const r = await api.me(token);
      setProfile(r.profile);
      setAlerts(r.alerts ?? null);
      setControls(r.controls);
      setOnline(true);
    } catch (err) {
      // Keep what we have.
      if ((err as ApiError).status === 0) setOnline(false);
    }
  }, [token]);

  // The phone says the connection dropped: believe it at once.
  useEffect(() => {
    const down = () => setOnline(false);
    addEventListener('offline', down);
    return () => removeEventListener('offline', down);
  }, []);

  // Without internet (or with "Can't reach the game" on screen), keep checking quietly until the
  // server answers (Yves, 18 October 2026: Home stayed on Offline after his data came back).
  // A phone says it's back online a moment before the connection works, so one check at that
  // moment isn't enough: check then, and again after 1, 2, 4 and 8 seconds, then every 15
  // while the app is on screen. Wi-Fi with no internet never says it's offline, which the
  // every-15 covers. A check that can't get out never reaches Cloudflare, so it costs nothing on
  // the free plan. Nothing runs while the phone says it's offline or the app is in the background.
  const cut = status === 'offline' || (status === 'ready' && !online);
  useEffect(() => {
    if (!cut || !token) return;
    let stop = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(check, Math.min(15_000, 1000 * 2 ** tries++));
    };
    function check() {
      clearTimeout(timer);
      if (stop || busy || document.hidden || !navigator.onLine) return;
      busy = true;
      api.me(token!).then(
        ({ profile, controls }) => {
          busy = false;
          if (stop) return;
          setControls(controls);
          fetchedAt.current = Date.now();
          setProfile(profile);
          setOnline(true);
          setStatus('ready');
        },
        (err: ApiError) => {
          busy = false;
          if (stop) return;
          if (err.status === 0) return later();
          // The server answered, so the connection is back. Whatever it said is for the
          // screen that asks next; "Can't reach the game" keeps its Try again.
          if (status === 'ready') setOnline(true);
        },
      );
    }
    const now = () => {
      tries = 0;
      check();
    };
    addEventListener('online', now);
    document.addEventListener('visibilitychange', now);
    later();
    return () => {
      stop = true;
      clearTimeout(timer);
      removeEventListener('online', now);
      document.removeEventListener('visibilitychange', now);
    };
  }, [cut, token, status]);

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

  // The players this phone remembers (src/lib/codes.ts): whoever is playing, kept fresh.
  const remember = profile && token && status === 'ready' && online && codesOn() ? `${profile.id}|${profile.name}|${profile.avatar}|${profile.print}` : '';
  useEffect(() => {
    if (remember && profile && token) phonePlayers.put(token, profile);
    // Only when who it is or how they look changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember]);

  const reset = useCallback(() => {
    store.remove(KEYS.token);
    // The copies kept for playing without internet belong to the player leaving.
    store.remove(KEYS.me);
    store.remove(KEYS.ranks);
    setToken(null);
    setProfile(null);
    setAlerts(null);
    setStatus('guest');
  }, []);

  const signIn = useCallback((next: string, p: Profile, opts: { borrow?: boolean } = {}) => {
    // A friend room belongs to the player who made it.
    hosted.clear();
    if (codesOn()) {
      const cur = store.get(KEYS.token);
      const back = phonePlayers.list().find((x) => x.token === cur && !x.borrowed)?.id ?? null;
      phonePlayers.put(next, p, opts.borrow ? { borrowed: { since: Date.now(), back } } : { borrowed: undefined });
    }
    setAlerts(null);
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

  const switchTo = useCallback((id: string) => {
    const p = phonePlayers.get(id);
    if (!p) return;
    hosted.clear();
    store.remove(KEYS.me);
    store.remove(KEYS.ranks);
    store.set(KEYS.token, p.token);
    fresh.current = null;
    setProfile(null);
    setAlerts(null);
    setToken(p.token);
    setStatus('loading');
  }, []);

  const forget = useCallback((id: string) => {
    const p = phonePlayers.get(id);
    phonePlayers.remove(id);
    if (p && p.token === store.get(KEYS.token)) reset();
  }, [reset]);

  const endBorrow = useCallback(() => {
    const cur = phonePlayers.list().find((x) => x.token === store.get(KEYS.token));
    if (!cur?.borrowed) return;
    phonePlayers.remove(cur.id);
    const back = cur.borrowed.back && phonePlayers.get(cur.borrowed.back);
    if (back) switchTo(back.id);
    else reset();
  }, [switchTo, reset]);

  // A borrowed phone goes back to its own player after an hour away, or the next day (src/lib/codes.ts).
  useEffect(() => {
    if (!codesOn()) return;
    const look = () => {
      if (document.hidden) return noteAway();
      const cur = phonePlayers.list().find((x) => x.token === store.get(KEYS.token));
      if (cur && borrowOver(cur)) {
        const back = cur.borrowed?.back ? phonePlayers.get(cur.borrowed.back) : null;
        toast(back ? `This phone is back to ${back.name}.` : `${cur.name} left this phone.`, 4000);
        endBorrow();
      }
    };
    look();
    document.addEventListener('visibilitychange', look);
    return () => document.removeEventListener('visibilitychange', look);
  }, [endBorrow]);

  const returned = useCallback(() => {
    setReturning(null);
    setStatus((s) => (s === 'loading' && !store.get(KEYS.token) ? 'guest' : s));
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status, online, token, profile, start, refresh, setProfile, update, reset, signIn, signOut, returning, returned,
      alerts, setAlerts, switchTo, forget, endBorrow,
      retry: () => { fresh.current = null; setAttempt((n) => n + 1); },
    }),
    [status, online, token, profile, start, refresh, update, reset, signIn, signOut, returning, returned, alerts, switchTo, forget, endBorrow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/**
 * Goes up by one each time the game reaches the server again after being cut off. A screen
 * showing a copy from without internet (Ranks) lists it in its effect, so it fetches afresh.
 */
export function useBackOnline() {
  const { online } = useSession();
  const [n, setN] = useState(0);
  const was = useRef(online);
  useEffect(() => {
    if (online && !was.current) setN((x) => x + 1);
    was.current = online;
  }, [online]);
  return n;
}

/** For screens that only render once someone is signed in. */
export function usePlayer() {
  const s = useSession();
  if (!s.token || !s.profile) throw new Error('usePlayer before the session is ready');
  return { ...s, token: s.token, profile: s.profile };
}
