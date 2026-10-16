/**
 * Asking at the right moment, on the phone's side. The rules are in shared/asks.ts and the
 * reasons in docs/RETENTION.md, section 7. This file keeps track of visits, the match that just
 * ended, when each ask was last shown, and how many matches this phone has finished.
 */
import { streakNow } from '../../shared/habits';
import { dayKey, type Result } from '../../shared/progression';
import type { Profile } from '../../shared/protocol';
import { due, pickAsk, type AskKind, type Asked } from '../../shared/asks';
import { isStandalone } from './device';
import { canPrompt } from './install';
import { iphoneTab, pushPrefs, pushState } from './push';
import { KEYS, store } from './storage';

/** Away this long and coming back starts a new visit. */
const VISIT_GAP_MS = 30 * 60_000;
/** A match counts as "just ended" for this long, so an ask never turns up long after it. */
const MOMENT_MS = 10 * 60_000;

let visitUsed = false;
let hiddenAt = 0;
let moment: { result: Result; at: number } | null = null;
const counted = new WeakSet<object>();

export function initAsks() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt >= VISIT_GAP_MS) visitUsed = false;
  });
}

/** Free for one pop-up this visit (an ask, or Baba Ayo's nudge)? */
export const visitFree = () => !visitUsed;
/** Something took this visit's pop-up. */
export const takeVisit = () => {
  visitUsed = true;
};

export const finishedMatches = () => Number(store.get(KEYS.matches) ?? 0) || 0;

/** A match ended (its reward arrived). Counted once per reward, however often the screen redraws. */
export function noteMatchEnd(reward: object, result: Result, now = Date.now()) {
  if (counted.has(reward)) return;
  counted.add(reward);
  store.set(KEYS.matches, String(finishedMatches() + 1));
  moment = { result, at: now };
}

// Browser checks on the dev server can end a match without playing one. Not in the real build.
if (import.meta.env.DEV) (window as unknown as { __asks: unknown }).__asks = { noteMatchEnd: (result: Result) => noteMatchEnd({}, result) };

/** Home opened: the match that just ended, if there is one and it's still fresh. Taken once. */
export function takeMoment(now = Date.now()) {
  const m = moment;
  moment = null;
  return m && now - m.at < MOMENT_MS ? m : null;
}

/** When each ask was last shown. Older phones kept the notification asks under their own key. */
export const askedSoFar = (): Asked => ({ ...store.json<Asked>(KEYS.pushAsk, {}), ...store.json<Asked>(KEYS.asks, {}) });

/** An ask is on screen: count it, so it waits before coming back. */
export function markAsked(kind: AskKind, now = Date.now()) {
  const all = askedSoFar();
  all[kind] = { at: now, n: (all[kind]?.n ?? 0) + 1 };
  store.set(KEYS.asks, JSON.stringify(all));
}

/** The ask for the moment after a match, if any (shared/asks.ts). */
export function askAfterMatch(profile: Profile, now = Date.now()): AskKind | null {
  const today = dayKey(now);
  return pickAsk({
    now,
    asked: askedSoFar(),
    ban: !!profile.ban,
    matches: Math.max(finishedMatches(), profile.wins + profile.losses + profile.draws),
    saved: profile.saved,
    dayStreak: profile.dayStreak,
    playedToday: streakNow(profile.habits, profile.dayStreak, today).playedToday,
    returning: dayKey(profile.createdAt) < today,
    iphoneTab: iphoneTab(),
    pushReady: pushState() === 'ready',
    streakOn: pushPrefs().streak,
    inTab: !isStandalone(),
    canInstall: canPrompt(),
  });
}

/**
 * "Know when your friend joins", where it's useful: the invite sheet once the link is shared, and
 * the room screen. It's part of what the player is doing there, so it doesn't use up the visit,
 * but it keeps the same gaps.
 */
export const mayAskFriends = (now = Date.now()) =>
  pushState() === 'ready' && !iphoneTab() && !pushPrefs().friends && due('friends', askedSoFar(), now);
