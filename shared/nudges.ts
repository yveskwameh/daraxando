/**
 * Baba Ayo's nudge lines. When to show them is decided on the phone, in src/lib/babaNudge.ts.
 * Duolingo-owl style: when your streak is at risk, when it has just ended, and when you come
 * back after a few days away, he lays the guilt on, dramatic and playful. Yves asked for this on 15 October 2026 to see how it feels (docs/RETENTION.md
 * explains the trade-off). Rules:
 *  - Guilt, drama and missing you are fine. Insults, shame about who the player is, or
 *    anything about money are not.
 *  - Light Pidgin (Yves, 17 October 2026, docs/COPY-PASS.md): English anyone reads at a glance,
 *    with his "o", "abeg" and "Haba". No new Yoruba, Igbo or Hausa words without the
 *    native-speaker check.
 *  - Players can turn them off in Settings ("Baba Ayo's nudges"), and they show at most
 *    once every few hours.
 */
import { nDays } from './habits';

export type NudgeKind = 'risk' | 'ended' | 'back';

const RISK = [
  "Your {n}-day streak is shaking o. You'll just leave it like that?",
  "I've waited for you since morning. {days} and you want to stop today?",
  "Ah ah. You forgot me? One match, abeg. Don't let your streak die.",
  "I'm watching you. {days} we built together. You can't leave me like this.",
];
const ENDED = [
  'Haba! {days}, gone just like that. My heart is broken.',
  'I told you to come. Now see. {days}, finished. You can still restore it.',
  "I won't lie, this one pains me. {days}. Restore it before it's too late.",
];
const BACK = [
  "Ah, you remember me? I've been waiting since {day}.",
  "Long time! I thought you'd forgotten Baba.",
  '{gone} and not even one match. I missed you o.',
];

/** Every nudge line, for the tests. */
export const BABA_LINES = { RISK, ENDED, BACK } as const;

export const pick = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)];
/** Fills {n} and the rest. {days} is {n} with "day" or "days" after it; {gone} the same for {d}. */
export const fillLine = (s: string, v: Record<string, string | number>) => {
  const all: Record<string, string | number> = { ...v };
  if (typeof v.n === 'number') all.days = nDays(v.n);
  if (typeof v.d === 'number') all.gone = nDays(v.d);
  return s.replace(/\{(\w+)\}/g, (_, k) => String(all[k] ?? ''));
};

const LEAVING = [
  "You're running from me? Okay o. I'll win.",
  'You want to leave Baba in the middle of a game? E pain me.',
];

/** One of Baba Ayo's lines for a moment, with the numbers filled in. */
export function babaLine(kind: NudgeKind | 'leaving', v: Record<string, string | number> = {}) {
  const list = { risk: RISK, ended: ENDED, back: BACK, leaving: LEAVING }[kind];
  return fillLine(pick(list), v);
}
