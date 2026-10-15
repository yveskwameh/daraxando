/**
 * Baba Ayo's nudges, Duolingo-owl style: when your streak is at risk, when it has just
 * ended, and when you come back after a few days away, he lays the guilt on, dramatic and
 * playful. Yves asked for this on 15 October 2026 to see how it feels (docs/RETENTION.md
 * explains the trade-off). Rules:
 *  - Guilt, drama and missing you are fine. Insults, shame about who the player is, or
 *    anything about money are not.
 *  - Pidgin, like other game moments. No new Yoruba, Igbo or Hausa words without the
 *    native-speaker check.
 *  - Players can turn them off in Settings ("Baba Ayo's nudges"), and they show at most
 *    once every few hours.
 */
import { daysBetween, streakNow, type Habits } from '../../shared/habits';
import { KEYS, store } from './storage';

export type NudgeKind = 'risk' | 'ended' | 'back';

export interface Nudge {
  kind: NudgeKind;
  line: string;
  /** The button: what to do about it. */
  action: string;
}

const RISK = [
  'Your {n}-day streak dey shake o. You go just leave am like that?',
  'I don wait you since morning. {n} days and you wan stop today?',
  'Ah ah. Na so you go forget me? One match, abeg. Make your streak no die.',
  'I dey look you. {n} days we build together. You no fit leave me like this.',
];
const ENDED = [
  'Haba! {n} days, gone just like that. My heart don break.',
  'I tell you make you come. Now see. {n} days, finish. You fit still restore am.',
  "I no go lie, this one pain me. {n} days. Come restore am before e too late.",
];
const BACK = [
  'Ah, you remember me? I don dey wait since {day}.',
  'Long time! I been think say you don forget Baba.',
  '{d} days and not even one match. I don miss you o.',
];

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

const LEAVING = [
  'You dey run from me? Okay o. I go win.',
  'Ah, you wan leave Baba for middle of game? E pain me.',
];

/** One of Baba Ayo's lines for a moment, with the numbers filled in. */
export function babaLine(kind: NudgeKind | 'leaving', v: Record<string, string | number> = {}) {
  const list = { risk: RISK, ended: ENDED, back: BACK, leaving: LEAVING }[kind];
  return fill(pick(list), v);
}

/** How long between nudges on the same phone. */
const GAP_MS = 4 * 3_600_000;

/** What Baba Ayo has to say right now, if anything. */
export function babaNudge(h: Habits, streak: number, today: string, lastPlayedDay: string | null): Nudge | null {
  const now = streakNow(h, streak, today);
  if (now.playedToday) return null;
  if (now.streak === 0 && now.restorable) {
    return { kind: 'ended', line: fill(pick(ENDED), { n: now.restorable.n }), action: 'See my streak' };
  }
  if (now.streak > 0) return { kind: 'risk', line: fill(pick(RISK), { n: now.streak }), action: 'Play Baba Ayo' };
  if (lastPlayedDay && daysBetween(lastPlayedDay, today) >= 3) {
    const day = new Date(`${lastPlayedDay}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    return { kind: 'back', line: fill(pick(BACK), { day, d: daysBetween(lastPlayedDay, today) }), action: 'Play Baba Ayo' };
  }
  return null;
}

/** True if it's been long enough since the last nudge. Marks this one as shown. */
export function takeNudgeSlot(now = Date.now()) {
  const last = Number(store.get(KEYS.nudge) ?? 0);
  if (now - last < GAP_MS) return false;
  store.set(KEYS.nudge, String(now));
  return true;
}
