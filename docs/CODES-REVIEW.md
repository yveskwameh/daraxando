# Player codes: the lines for the lawyer

Written 21 October 2026, for Yves to send to the lawyer.

**Status:** approved by the lawyer on 21 October 2026, as written below: the privacy lines are in `src/legal/privacy.md`, with no change to the terms, and the borrowed-phone stakes rule stays as it is. On everywhere (`CODES_ON_REAL_GAME` in `shared/codes.ts` stays as a quick off switch).

## Why

Most players never save their progress, so a new phone or a cleared browser starts them from zero, and a player who signed out came back as a new player. Yves approved the prototype (`docs/accounts-prototype.html`) on 21 October 2026.

## What changes

1. **Every player gets a player code:** 16 letters and numbers, shown with a QR code. Typed or scanned on any phone, it plays as that player. Save image, Copy and Share to myself keep it; all three happen on the phone, and nothing is sent to us. Google and email stay as an extra backup.
2. **The other phones find out.** When a code opens a player on a phone, the player's other phones say so once, with "That was me" and "Not me". Not me makes a new code and signs out every other phone.
3. **A phone remembers its players.** Sign out becomes Switch player. This list stays on the phone.
4. **Borrowing a friend's phone.** A player can play on someone else's phone for a while. It goes back to the phone's own player after an hour away, or the next day.
5. **Lost your code? Ask us to help.** A short form: the player's name, about how many Dara Seeds they had, the month they started, and someone they played recently. Yves checks the answers against the player in the admin dashboard. If he gives the player back, every phone the player is on shows a warning with Stop for 24 hours. Then the player moves to the asking phone with a new code, and every other phone is signed out. Nothing about seeds changes: the player keeps what they had.

## 1. Privacy notice, "If you save your progress"

Add:

> - **With a player code:** a scrambled copy of your code, to find your player when it's typed, and the code locked with a key only our server has, so we can show it to you again.
> - **When your code is used:** the time, and the phone's scrambled id, so your other phones can tell you.

## 2. Privacy notice, "Keeping the game fair and safe"

Add:

> - **If you ask us to help with a lost code:** your answers, the asking phone's scrambled id, and our reply, so we can check it's really you.

## 3. Privacy notice, "On your phone"

Add to the list of what the browser keeps: "the players that have played on this phone, until you remove them".

## 4. Privacy notice, "How long we keep it"

Add:

> - **Requests for help with a lost code:** 30 days after we answer.

## Questions for the lawyer

1. Is keeping the answers to the lost-code form, and checking them against the player, covered by the legitimate interest the notice already gives for keeping players' accounts safe?
2. A phone that signs in with a code is linked to the player, like a Google or email sign-in today. So a friend who borrows your phone counts as "on the same phone" under the approved rule, and staked wins between the two of you send both stakes back. Is that fine as it is?
3. Many players are under 18. Does "Lost your code? Ask us to help", where Yves decides and the player can stop it, need anything more for them?
4. Do the terms need a line saying we may move a player to another phone after checking a request, or is the privacy notice enough?

## After the approval

1. Put the approved lines into `src/legal/privacy.md`, and change its "last updated" date.
2. Set `CODES_ON_REAL_GAME` to `true` in `shared/codes.ts`.
3. Push, then merge `main` into `production`. Every player can make their code from then on.
