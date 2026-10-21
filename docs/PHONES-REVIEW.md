# Phones and players: the lines for the lawyer

Written 19 October 2026, for Yves to send to the lawyer.

**Status:** waiting for the lawyer. Until they approve, this works on the test copy only. On the real game, `PHONE_LINKS_ON_REAL_GAME` in `worker/phones.ts` is `false`: the game keeps only what it kept before (the phone each player was made on), has no limit on new players a phone, and the same-phone stakes rule works exactly as before.

## Why

On 19 October 2026 Yves asked for a stronger guard against one person making several players to farm Dara Seeds. Today the game knows only the phone a player was made on. A player who signs in on a second phone isn't linked to it, and a phone can make any number of players (5 a minute at most).

## What changes

1. **Every phone a player uses is linked to them,** not just the one they were made on: phones that sign in to the player with Google or an email code, and phones that open the game as the player. The game keeps the same scrambled copy of the app's random phone id that it keeps today, how the phone came to the player (made on it, signed in on it, or played on it), when that first happened, and when the phone last opened the game as that player (updated at most once a day).
2. **Stakes:** when two players who have ever been on the same phone play a staked match, both stakes go back, as they do today for players made on the same phone. The win still counts for everything else. This is the approved same-phone rule (`docs/SAFETY-REVIEW.md`), applied to every phone a player uses instead of only the first. It is a change to how seeds work, so it needs the lawyer's approval.
3. **A phone can make 2 new players in 30 days.** A third gets "This phone already made 2 players this month. Sign in instead." and a Sign in button. Players already on the phone are untouched. A phone id changes when the browser's data is cleared, so this slows abuse down rather than stopping a determined person.
4. **Yves sees links in the admin dashboard:** on a player's page, the players linked to them and how; a list of phones with several players; and an alert when a phone gets its third player in a day. A link is a sign, not proof (brothers and sisters share phones), so nothing is banned automatically. Yves decides, and the ban sheet can also ban the linked players.
5. **How long:** a link goes when the player is deleted. Links other than the phone a player was made on also go 400 days after that phone last opened the game as the player (the 8 am run), the same as play days.

Nothing new is read from the phone. No phone number, IMEI, model, contacts, network address or fingerprint is kept. The phone id is the random number the app already makes.

## 1. Privacy notice, "Keeping the game fair and safe"

Now:

> - **A phone id.** When the app first opens, it makes a random number and keeps it on your phone. We keep only a scrambled copy next to each player made on that phone, to stop one person farming Dara Seeds with several players. We never read anything from the phone itself: no phone number, IMEI, model or contacts.

Proposed:

> - **A phone id.** When the app first opens, it makes a random number and keeps it on your phone. We keep only a scrambled copy, next to each player made on that phone, signed in on it or played on it, with when that happened, to stop one person farming Dara Seeds with several players. Players who have been on the same phone can't win seeds from each other, and a phone can make 2 new players in 30 days. We never read anything from the phone itself: no phone number, IMEI, model or contacts.

## 2. Privacy notice, "How long we keep it"

Add:

> - **Which phones your player was played on:** the phone it was made on, until you delete your player; other phones, 400 days after they last opened the game as your player.

## 3. Terms, "Playing fair" (optional)

The terms already let the game send stakes back when the rules on farming apply. If the lawyer wants the limit on new players said outright:

> - A phone can make 2 new players in 30 days. Players who have been on the same phone can't win seeds from each other.

Changing the terms means every existing player accepts them again once ("We updated our terms"). If the privacy lines are enough, the terms stay as they are.

## Questions for the lawyer

1. Is keeping which phones a player was played on, for stopping seed farming, covered by the legitimate interest the notice already gives for keeping the game fair, under the Nigeria Data Protection Act 2023 and the GAID 2025?
2. Many players are under 18. Does linking players through a shared phone, and showing those links to Yves (never to other players), need anything more for them?
3. Is the 400-day limit for links other than the first phone reasonable, or should it be shorter?
4. Does the limit of 2 new players a phone in 30 days need a line in the terms?

## After the approval

1. Put the approved lines into `src/legal/privacy.md` (and `src/legal/terms.md`, with a new `TERMS_VERSION` and a line in `TERMS_CHANGES`, if the terms change).
2. Set `PHONE_LINKS_ON_REAL_GAME` to `true` in `worker/phones.ts`.
3. Push, then merge `main` into `production`. Links start from that moment; the phone each player was made on is linked already.
