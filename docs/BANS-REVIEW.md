# Timed bans: the lines for the lawyer

Written 19 October 2026, for Yves to send to the lawyer.

**Status:** waiting for the lawyer. Until they approve, timed bans work on the test copy only. On the real game every ban still lasts until Yves lifts it (`TIMED_BANS_ON_REAL_GAME` in `worker/admin.ts` is `false`), and nothing new is kept.

## What changes

Today a ban lasts until Yves lifts it. On 19 October 2026 Yves asked for bans that end by themselves, like the timeouts in Discord or Reddit, so a first problem can get a short ban instead of an open-ended one.

How it works:

- When Yves bans a player from the admin dashboard, he picks how long: 24 hours, 7 days, 30 days, or until he lifts it.
- The game keeps the date and time the ban ends, next to the reason and the date it started, which it keeps already.
- When that time passes, the ban lifts by itself: the next time the player opens the game, or at the latest at the next 8 am run. The admin log notes that it ended, and a review the player asked for is answered as lifted.
- The player's ban screen says when online play comes back ("It comes back on 26 October at 18:42"). They can still ask for a review.
- Nothing about seeds changes. The age line doesn't change.

## 1. Privacy notice, "What we keep"

Now:

> - **Bans:** if a player is banned, the reason, the date and any request for a review, with our answer.

Proposed:

> - **Bans:** if a player is banned, the reason, the date, when the ban ends if it ends by itself, and any request for a review, with our answer.

## 2. Terms, "Playing fair" (optional)

The terms already say "We may change a name that breaks the rules, take back seeds won by breaking them, or ban a player", and later "We may suspend or delete a player". A ban for a set time seems covered by both. If the lawyer would rather say it outright:

Now:

> - A banned player can't play other people, and doesn't appear on Ranks or in leagues. They can still play Baba Ayo and keep their progress.

Proposed:

> - A ban can last a set time or until we lift it. A banned player can't play other people, and doesn't appear on Ranks or in leagues. They can still play Baba Ayo and keep their progress.

Changing the terms means every existing player accepts them again once ("We updated our terms"). If the lawyer says the privacy line alone is enough, the terms stay as they are.

## After the approval

1. Put the approved line (or lines) into `src/legal/privacy.md` (and `src/legal/terms.md`, with a new `TERMS_VERSION` and a line in `TERMS_CHANGES`, if the terms change).
2. Set `TIMED_BANS_ON_REAL_GAME` to `true` in `worker/admin.ts`.
3. Push, then merge `main` into `production`. The dashboard shows the ban lengths on the live game by itself.
