# Dara X&O: safety changes for legal review

16 October 2026. Prepared for the lawyer who approved Dara Seeds (then called Dara Cowries) on 15 October 2026 (`docs/COWRIES-REVIEW.md`), so they can confirm their opinion still holds. Nothing here is live: the game is not published yet.

**Approved by the lawyer on 16 October 2026.** Added afterwards, with no change to how seeds work: a banned player can watch Ranks and their league from outside (they see where they'd be, but aren't in them), and can ask for a ban review from inside the app, which Yves answers there (question 3).

## What you approved

- **Dara Seeds are points.** Players stake them on matches against other players, and the winner takes the pot.
- **They can't buy, sell, send or cash out seeds.** Seeds can never be bought with money, sold, sent to another player, or exchanged for money, airtime or prizes.
- **Free top-ups instead of payments.** Everyone starts with 5,000, gets 500 a day, and a free top-up when they run low. Nothing is ever paid in.
- **Players are 13 or older.**

None of that has changed. The changes below make it harder to get around the rule that seeds can't be sent to another player.

## 1. Rules against moving seeds between accounts

**The problem.** Seeds can't be sent to another player, but a staked match could be used to do it anyway: one person makes several accounts and lets the main one win, or a friend loses on purpose again and again. That would also let someone collect seeds to sell an account, which the terms will forbid.

**What happens when a rule applies.** Both players get their own stake back, exactly as in a draw. Nobody gains or loses seeds. The match still counts in every other way: the win, the loss, the rating, Aura (progress points) and the day streak. The result screen tells both players why, for example: "Dayo left before making 3 moves, so both stakes went back. The win still counts."

| Rule | When it applies | Why |
| --- | --- | --- |
| **Same phone** | Both players' accounts were made on the same phone | One person playing themselves on two accounts |
| **Daily cap between two players** | In any 24 hours, a player would end up more than 5,000 seeds ahead of the same opponent. At tables above 1,000 the cap is three stakes instead (15,000 at the 5,000 table, 300,000 at the 100,000 table) | A friend losing on purpose, again and again |
| **Quick quits** | The loser resigned, left or ran out of time in the first game of the match, before making 3 moves of their own | Handing over a match without playing it. Only the first game counts, so a player who loses game 1 can't quit game 2 early to keep their stake |

The cap only counts seeds moving one way. If the other player wins some back, the gap shrinks, so two friends who win and lose against each other can keep staking all day. Only matches where seeds really moved count toward it.

These sit alongside the rules already in place: new accounts can only use tables of 1,000 and below for their first week, the same two players can meet at most 3 times a day at tables of 10,000 and up, and 3 high-table losses in a row bring a 10-minute break.

**How "same phone" works.** When the app first opens, it makes a random number and keeps it in the app's own storage on that phone. The server keeps only a scrambled copy of it (a keyed hash), next to each account made on that phone. Nothing is read from the phone itself: no phone number, IMEI, model or contacts. Clearing the app's data makes a new random number.

## 2. Bans

The game can ban an account that breaks the rules (for example rude names, abuse or farming seeds). A banned player:

- **can't play other people:** no Quick match, friend rooms or friend streaks;
- **doesn't appear on Ranks or in the weekly leagues;**
- **can still play the computer opponent (Baba Ayo)** and keeps their title, Aura and Dara Seeds. Nothing is deleted or taken.

The player sees a screen with the reason, written to them, and the date, plus a way to say it's a mistake (through yveskwameh.com for now; the legal pages will give a proper contact). Only Yves can ban or lift a ban, and every ban, with its reason and who it was, is kept in a log.

## 3. Correcting seeds by hand

Yves can add seeds to an account or take them away, for example to give back a stake lost to a server fault. Each correction:

- needs a written reason;
- can't take a balance below 0, or move more than 1,000,000 seeds at once;
- is recorded in the seeds ledger (reason `admin`) and in the admin log, with the balance before.

It is only for fixing mistakes. It is never used as a prize, never given for a payment, and never given in exchange for anything.

## 4. Player names

Names are checked when a player picks or changes one. The game refuses insults, slurs and sexual words in English, Pidgin, Yoruba, Igbo and Hausa, and names that pretend to be the game or its staff (Baba Ayo, Dara X&O, Admin, Support). The Nigerian-language list is with a native speaker for checking (`docs/NAMES-REVIEW.md`).

## Questions

1. When a rule applies, both stakes go back, as in a draw. Does that raise any concern, given the win still counts for everything except seeds?
2. Is it acceptable for the game to correct a player's seeds by hand to fix mistakes, as long as each correction has a reason, is logged, and is never linked to money, payments or prizes?
3. Bans: what should the terms say about what gets an account banned and how to ask for a review? Is showing the reason to the player enough, or does the player need to be told more?
4. The same-phone rule keeps a scrambled copy of a random number the app makes. Does the privacy notice need to mention it, and is preventing abuse a sound basis for it under the Nigeria Data Protection Act 2023?

Questions or screenshots: Yves Kwameh.
