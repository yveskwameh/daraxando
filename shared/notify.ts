/**
 * Notifications (docs/BACKEND.md, milestone 5; Yves, 16 October 2026). Two kinds, both off until
 * a player turns them on:
 *  - The streak reminder: at 7 pm Lagos time, only on days the player hasn't played yet and
 *    their streak ends at midnight (no Streak Freeze left to cover it). At most one a day.
 *  - A friend joined your room: straight away, only when the host isn't in the app.
 *
 * The streak reminder is Baba Ayo's, in his light Pidgin (Yves, 17 October 2026,
 * docs/COPY-PASS.md): what's at stake, then the one quick thing that fixes it. "Friend joined"
 * comes from Dara X&O, so it's plain. Insults, shame and anything about money stay out. Any new Yoruba,
 * Igbo or Hausa word goes to the native speaker first.
 */

/** 7 pm in Lagos is 18:00 UTC (Lagos doesn't change its clocks). The cron in wrangler.jsonc matches. */
export const REMINDER_HOUR_LAGOS = 19;

/** The streak reminder. {n} is the streak in days; {days} is the same with "day" or "days" after it. */
export const BABA_PUSH = [
  'Your {n}-day streak ends at midnight o. One quick match saves it.',
  "{days} is no small thing. Play one match before midnight so it doesn't break.",
  'Oya, your {n}-day streak is waiting. One match before midnight keeps it.',
  "Don't let {days} go to waste o. One match tonight keeps your streak.",
] as const;

/** A friend joined the room you made. {name} is the friend. */
export const FRIEND_PUSH = [
  '{name} joined your room. Come and play.',
  '{name} is waiting in your room.',
] as const;

/**
 * Asking players to turn them on (Yves, 16 October 2026): at the right moment, never on the
 * first visit. If they close the ask, it comes back at the next right moment after these
 * many days, then every 30 days. Settings always has the switches. The save ask uses the same
 * gaps; all the rules for asking are in shared/asks.ts.
 */
export const ASK_AGAIN_DAYS = [3, 7, 14, 30] as const;
