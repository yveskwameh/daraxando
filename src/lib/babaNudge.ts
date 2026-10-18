/**
 * When Baba Ayo nudges you on Home: your streak is at risk, it has just ended, or you're back
 * after a few days away. At most once every 4 hours on a phone. The lines and their rules are
 * in shared/nudges.ts.
 */
import { daysBetween, streakNow, type Habits } from '../../shared/habits';
import { BABA_LINES, fillLine, pick, type NudgeKind } from '../../shared/nudges';
import { KEYS, store } from './storage';

export { babaLine, type NudgeKind } from '../../shared/nudges';

export interface Nudge {
  kind: NudgeKind;
  line: string;
  /** The button: what to do about it. */
  action: string;
}

/** How long between nudges on the same phone. */
const GAP_MS = 4 * 3_600_000;

/** What Baba Ayo has to say right now, if anything. */
export function babaNudge(h: Habits, streak: number, today: string, lastPlayedDay: string | null): Nudge | null {
  const now = streakNow(h, streak, today);
  if (now.playedToday) return null;
  if (now.streak === 0 && now.restorable) {
    return { kind: 'ended', line: fillLine(pick(BABA_LINES.ENDED), { n: now.restorable.n }), action: 'See my streak' };
  }
  if (now.streak > 0) return { kind: 'risk', line: fillLine(pick(BABA_LINES.RISK), { n: now.streak }), action: 'Play Baba Ayo' };
  if (lastPlayedDay && daysBetween(lastPlayedDay, today) >= 3) {
    const day = new Date(`${lastPlayedDay}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    return { kind: 'back', line: fillLine(pick(BABA_LINES.BACK), { day, d: daysBetween(lastPlayedDay, today) }), action: 'Play Baba Ayo' };
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
