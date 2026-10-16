/**
 * Notifications (docs/BACKEND.md, milestone 5; Yves, 16 October 2026). Two kinds, both off until
 * a player turns them on:
 *  - The streak reminder: at 7 pm Lagos time, only on days the player hasn't played yet and
 *    their streak ends at midnight (no Streak Freeze left to cover it). At most one a day.
 *  - A friend joined your room: straight away, only when the host isn't in the app.
 *
 * The lines are Baba Ayo's, in Pidgin like other game moments: what's at stake, then the one
 * quick thing that fixes it. Insults, shame and anything about money stay out. Any new Yoruba,
 * Igbo or Hausa word goes to the native speaker first.
 */

/** 7 pm in Lagos is 18:00 UTC (Lagos doesn't change its clocks). The cron in wrangler.jsonc matches. */
export const REMINDER_HOUR_LAGOS = 19;

/** The streak reminder. {n} is the streak in days. */
export const BABA_PUSH = [
  'Your {n}-day streak go end for midnight o. One quick match go save am.',
  '{n} days no be small thing. Play one match before midnight make e no cut.',
  'Oya, your {n}-day streak dey wait you. One match before midnight, e still dey.',
  'No let {n} days waste o. Just one match tonight and your streak still dey.',
] as const;

/** A friend joined the room you made. {name} is the friend. */
export const FRIEND_PUSH = [
  '{name} don enter your room. Oya, come play!',
  '{name} dey wait you for your room. Oya, come!',
] as const;

/**
 * Asking players to turn them on (Yves, 16 October 2026): at the right moment, never on the
 * first visit. If they close the ask, it comes back at the next right moment after these
 * many days, then every 30 days. Settings always has the switches.
 */
export const ASK_AGAIN_DAYS = [3, 7, 14, 30] as const;
