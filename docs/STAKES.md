# Stakes: Dara Seeds, Aura and winner takes the pot

Status: approved by Yves and built. The names are **Aura** (progress) and **Dara Seeds** (stake points). Staking is with points, never real money.

## Two currencies, on purpose

| | Aura (experience points) | Dara Seeds (stake points) |
| --- | --- | --- |
| What it is | Progress | Something to stake |
| How you get it | Every game you play | 5,000 to start, 500 a day, winning stakes |
| Can you lose it? | Never | Yes, when you lose a staked match |
| What it does | Levels you up, which unlocks avatars, prints and pieces | Lets you enter staked tables |

Why not stake XP itself: losing a match would take away levels and unlocked items, which feels like punishment and makes people quit. Keeping progress safe and putting a separate currency at risk is how Ludo King, 8 Ball Pool and PlayWhot all do it.

Names: the stake points were first called Dara Cowries. On 15 October 2026 Yves renamed them **Dara Seeds**, because another Nigerian games app already uses cowries. Ayo (Okwe in Igbo) is played by capturing seeds, so winning seeds is winning the pot, and seeds read as game pieces, not money. Only the name and the icon changed; the rules and the lawyer's opinion stand. Inside the code and the database they are still called `cowries`. Aura is what you build by playing: "+60 Aura". In tight spaces (chips, stake buttons) the app says "seeds" next to the seed icon (three grey Ayo seeds); in sentences it says "Dara Seeds".

Aura per match (a whole series): quick match 60 for a win, 30 for a draw, 15 for a loss; friend rooms 40, 20 and 10; Baba Ayo 10, 20 or 30 for a win depending on his level. Winning 3 matches in a day (the daily goal) adds 50. The second title needs 100 Aura, the third 300, the tenth (Dike) 4,500, each step 100 more than the last. Players see titles, not level numbers (`docs/CULTURE.md`, "Titles").

## How a staked match works

1. Tap Quick match, pick a table: Free, 100, 500, 1,000, 5,000, 10,000, 50,000 or 100,000 Dara Seeds.
2. Both players put in the same stake. The matchmaker only pairs players at the same table.
3. The winner of the series takes the pot. A drawn series gives both stakes back.
4. Leaving loses the stake, the same as losing the match. Leaving the app only pauses the match: the stake is lost if you stay away for more than 60 seconds.
5. Tables of 10,000 and up keep a 5% table fee (10,000 pays out 19,000). The fee removes seeds from the game so the daily handouts don't inflate everything, and it makes losing on purpose to a friend cost something.
6. Tables of 50,000 and 100,000 open at level 10.
7. Baba Ayo games are never staked. Friend rooms can be staked up to 1,000. Both stakes are taken when the friend joins. If the friend leaves the room, or the host closes it, before the match starts, both stakes go back.
8. A rematch can keep the stake just played or switch to a friend-room stake (free, 100, 500 or 1,000), and both players must agree to it. Both stakes are taken again when the rematch starts; if one player can't cover it, nothing is taken and both see why. Higher stakes go back through Quick match, so the table locks and daily pair limit still apply.

## Spending seeds on your streak (built and approved by the lawyer, 15 October 2026)

Yves chose these from the Duolingo research (`docs/RETENTION.md`). They are the only things seeds can be spent on besides match stakes. Nothing here can be bought with money, and nothing leaves the game.

| Item | Price | What it does | Limits |
| --- | --- | --- | --- |
| Streak Freeze | 200 | Covers one missed day automatically, so the day streak stays | Hold at most 2. A free one comes with the 7, 30 and 100-day milestones |
| Restore | 500 | Brings back a day streak of 2 or more that ended | Only up to 3 days after the last day played. The missed days count as covered |
| Streak stake | 200 in, 400 back | Keep your day streak for 7 more days and get 400 back. If the streak ends, the 200 is lost | One at a time. Fixed amount, no bigger versions. Needs a streak already going. Never offered after a loss |

The streak stake is Duolingo's Streak Wager. It differs from match stakes in one way the lawyer should look at: the game pays it out, not another player. The UI calls it a "stake", never a "bet", in line with the rule below.

Ledger reasons for these: `freeze`, `repair`, `streak-stake`, `streak-win`.

## Never broke for long

- 5,000 Dara Seeds to start.
- +500 with the first match of each day.
- "Sapa relief": below 500, a free top-up to 1,000 every 4 hours.
- No paid refills, ever.

## The rules that keep it legal

- Dara Seeds can never be bought with naira, sold, sent to another player, or cashed out for money, airtime or prizes. This is the line. A Nigerian free skill game where nothing is paid in and nothing of value comes out is very unlikely to count as gambling or need a licence.
- If any of those ever changes (selling Dara Seeds, prizes, airtime), it becomes gambling under state law and needs a licence, and Google Play bans it outright.
- Get a short written opinion from a Nigerian gaming lawyer before launch, because no Nigerian source deals directly with free social games.
- Use "stake", "table" and "pot" in the UI, never "bet" or casino styling. Show "Dara Seeds are for fun. You can't buy, sell, send or cash them out." on the stake and wallet screens (done).
- Ask for a 13+ age confirmation at sign-up (done: the server refuses sign-ups without it) (Nigeria's data law treats under-18s as children and needs parental consent for their data). Never enrol in Google's Designed for Families programme. Answer store rating questions honestly; staked matches on every game may be rated as simulated gambling.
- Money, if ever, comes only from cosmetics or removing ads, never from Dara Seeds.

## Fair play and anti-abuse

- Balances live on the server. No transfers between players.
- The same two players can play at most 3 high-stake games (10,000 and up) a day. Counted by the matchmaker.
- New accounts are held to tables of 1,000 and below for 7 days.
- New players are rate-limited per device (5 a minute) with a loose per-IP backstop, because Nigerian mobile networks share IPs. Phone or Google sign-in before high tables comes with the backend phase.
- After 3 straight losses at 10,000 and up, a 10-minute cool-down and a nudge to drop a table. No double-or-nothing button. The streak stake is a fixed 200 on your own daily play, never offered after a loss and never raised.
- Tic tac toe on 3×3 is solved, so the server can check every move against perfect play and flag players who keep missing obvious blocks at high stakes (a sign of losing on purpose).
- The Terms ban selling Dara Seeds or accounts.

## Where it lives in the code

| Area | What it does |
| --- | --- |
| `shared/stakes.ts` | Tables, the 5% fee, prizes, level and first-week locks, the cool-down, Sapa relief rules |
| `migrations/0002_dara.sql` | `cowries`, `aura`, `daily_day`, `sapa_at`, `big_losses`, `cool_until` on players, and the `ledger` table |
| `worker/db.ts` | `takeStakes` (all or nothing, refunds if anyone is short), `refund`, `recordSeries` (pot, daily seeds, goal bonus, streaks, cool-down, in one batch), `claimSapa` |
| `worker/matchmaker.ts` | One queue per mode and stake, state then zone then Nigeria, the daily pair limit for high tables |
| `worker/match.ts` | Holds both stakes for the match, pays the pot or refunds a draw once, forfeits on leaving, refunds a match nobody finished |
| `worker/index.ts` | Checks the table lock before joining a queue, the friend room cap of 1,000, Sapa relief, the streak routes |
| `shared/habits.ts`, `worker/habits.ts` | Streak Freeze, restore and streak stake prices and rules; each purchase and payout is one batch with its ledger row |
| Screens | Seeds chip and wallet on Home, stake picker before Quick match, stake chips when inviting a friend, the pot on the VS screen and in the match header, seeds in the result |

Every change to a balance writes a `ledger` row (start, daily, sapa, stake, pot, refund, freeze, repair, streak-stake, streak-win), so a balance can always be explained. The local test matches all balanced to the ledger.

## Sources

- Supreme Court ruling and state regulation: https://www.adeolaoyinlade.com/en/?p=5815
- Central Gaming Bill not signed: https://allafrica.com/stories/202512220091.html
- States reshaping gambling rules: https://igamingbusiness.com/legal-compliance/regulation/nigeria-states-race-to-reshape-gambling-regulation/
- Lagos promotional competition rules: https://lslga.org/wp-content/uploads/2021/12/GUIDELINES-FOR-PROMOTIONAL-COMPETITION.pdf
- Google Play real-money gambling policy: https://support.google.com/googleplay/android-developer/answer/9877032
- Google Play Families policy: https://support.google.com/googleplay/android-developer/answer/9893335
- Apple age ratings: https://developer.apple.com/help/app-store-connect/reference/age-ratings
- Apple review guidelines: https://developer.apple.com/app-store/review/guidelines/
- 8 Ball Pool listing: https://apps.apple.com/us/app/8-ball-pool/id543186831
- Ludo King FAQ: https://ludoking.com/faq/
- PlayWhot currencies: https://playwhot.com/blog/whot-currency.html
- Simulated gambling and teens: https://pmc.ncbi.nlm.nih.gov/articles/PMC9517771
- Minors' data under the NDPA: https://uubo.org/document/personal-data-of-a-minor-what-you-must-know
