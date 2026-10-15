# Game modes and session length

Status: built. The four modes and series are in `shared/modes.ts` and `shared/rules.ts`, judged by `worker/match.ts`. Baba Ayo plays all four (`shared/bot.ts`): perfect play on Classic at Agba, a look-ahead search in Fading, and a line-scoring player on Big and Pro. Turn clocks: 10 seconds on 3×3, 15 on Big, 20 on Pro, plus 2 seconds on the first move of each game.

## The problem

A classic 3×3 game is over in about 30 seconds. Yves wants players to choose bigger boards and wants one sitting to last up to about 5 minutes. Industry benchmarks agree: the median mobile game session is 5 to 6 minutes (GameAnalytics), and Epic recommends short loops of 1 to 5 minutes inside matches of 3 to 7.

## What decides if a board is fair

Every "n in a row" board has been studied. With perfect play, some boards are always a draw and some let the first player force a win.

| Board | Win with | Perfect play | Verdict |
| --- | --- | --- | --- |
| 3×3 (9 spots) | 3 in a row | Draw | Keep, it is the classic |
| 4×3 (12 spots) | 3 in a row | First player wins | Skip, it feels unfair fast |
| 4×4 | 3 in a row | First player wins | Skip |
| 4×4 | 4 in a row | Draw | Skip, too easy to block, so it gets stale |
| 5×5 | 4 in a row | Draw | Use as "Big" |
| 6×6 | 5 in a row | Draw | Fine, but 7×7 plays better |
| 7×7 | 5 in a row | Draw | Use as "Pro" |
| 15×15 (gomoku) | 5 in a row | First player wins | Too big for a phone |

So a 12-spot board with three in a row is not on the list: whoever moves first can always win. Casual players do not play perfectly, so the "draw" boards still end with a winner almost every time, and the starting player alternates every game to keep it fair.

## Launch modes

| Mode | Board | Rule | One game | Played as | One session |
| --- | --- | --- | --- | --- | --- |
| Classic | 3×3 | 3 in a row | About 30 s | Best of 5 | 2 to 4 min |
| Fading | 3×3 | 3 pieces each, your oldest disappears when you place a fourth | 1 to 2 min | Best of 3 | 3 to 5 min |
| Big | 5×5 | 4 in a row | 1 to 3 min | Best of 3 | 3 to 6 min |
| Pro | 7×7 | 5 in a row | 3 to 5 min | One game | 3 to 5 min |

**Fading** is the "infinite tic tac toe" that went around TikTok in 2024 and is now sold as a toy. The board never fills, so it never ends in a full-board draw. The piece that will vanish next wobbles, so players can plan around it. With perfect play it could go on forever, so a game is a draw after 30 moves.

**Series rules.** "Best of 5" means first to 3 wins. Draws do not count as a win for anyone. To stop draws dragging a series out, a series ends after 7 games (5 for best of 3) and whoever leads wins it. Level scores mean the series is a draw. Expected length with evenly matched players: best of 3 averages 2.5 games, best of 5 averages 4.1.

**Turn clock.** 10 seconds a turn on 3×3, 15 seconds on 5×5, 20 seconds on 7×7. Two timeouts in a row lose the game, as today.

## Other ways to make a sitting last longer

These come from Duolingo's UX (not its look), and most are small:

1. **Rematch first.** The result screen's main button is "Rematch" with the same opponent, shown while both are still there. Under it, "Change game or stake" (against Baba Ayo, "Change game or level") picks a different mode or stake for the rematch: one player asks, the other sees the offer and taps "Accept rematch". A rematch can keep the stake just played or switch to a friend-room stake (up to 1,000). "New opponent" and Home come last.
2. **Series rewards.** Winning a whole series gives a bonus on top of each game's XP, so players want to finish it.
3. **Daily goal.** "Win 3 today" next to the streak. Hitting it gives a reward and keeps the streak alive.
4. **Next match in one tap.** After a series, "Play again" goes straight back into the search with the same mode, without visiting Home.
5. **Short loops inside the session.** Every game ends with the stamp on the board, then a short "Next game" sheet with the series score. Nothing starts on its own: the next game begins when both players tap Next game (Baba Ayo is always ready). Once one player has tapped it, the other has 30 seconds (`NEXT_WAIT_MS`), or the ready player takes the match. Coming back to the app restarts that 30 seconds. Yves decided this on 14 October 2026, because a game that restarts by itself feels like it skipped a choice.

## Later

| Mode | What it is | One game | Build effort | Why later |
| --- | --- | --- | --- | --- |
| Dara (Naija special) | The three-in-a-row game of the Dakarkari people of Kebbi State, also known in Hausa as "doki". 5×6 board, 12 pieces each: drop them all, then slide pieces to make threes and capture | 10 to 20 min traditionally, so a shortened "first to 5 captures" version | High: two phases, captures, the "no four in a row" rule | The strongest local story, but the most work |
| Ultimate | Nine 3×3 boards in one big grid, where your move decides which small board your opponent plays next | 5 to 10 min | Medium | Harder to learn, so it needs a tutorial |
| Drop Four | A 7×6 board where pieces fall to the bottom, four in a row wins | 2 to 5 min | Low to medium | Close to Connect Four, which players already know |

## What changes in the code

| Area | Change |
| --- | --- |
| `shared/rules.ts` | The board size and win length become settings (n and k). Fading keeps a list of each player's pieces in order, removes the oldest before checking for a win, and stops at 30 moves |
| `shared/protocol.ts` | A `variant` field: `classic`, `fading`, `big` or `pro`, and the series length |
| `worker/match.ts` | Boards of any size, the series score and length, the starter alternating each game, and the turn clock per variant. Still one storage write per game, never per move |
| `shared/bot.ts` | The current bot searches every move, which is fine on 3×3 but too slow on 5×5 and 7×7. Bigger boards need a scoring bot that looks at threats (open threes and fours) a few moves deep. Baba Ayo's levels set how deep it looks and how often it slips: Jeje often, Sharp-sharp sometimes, Agba never |
| `src/components/Board.tsx` | Any size of board. On a 360 px phone a 7×7 cell is about 44 px, which is the smallest a tap target should be, so the 7×7 board uses the full width and the screen must still fit without scrolling |
| Mode picker | On Home, before Quick match, remembered between visits. Each mode has its own matchmaking queue so Classic players only meet Classic players |
| `tests/` | Win checks on every board size, Fading removal order, the 30-move draw, series end rules |

## Sources

- m,n,k games: https://en.wikipedia.org/wiki/M,n,k-game
- Gomoku: https://en.wikipedia.org/wiki/Gomoku
- Ultimate tic tac toe: https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe
- Fading tic tac toe as a toy: https://www.giiker.com/products/tic-tac-toe-bolt
- Fading tic tac toe on Kottke: https://kottke.org/24/08/0045170-ephemeral-tic-tac-toe-eac
- Dara: https://en.wikipedia.org/wiki/Dara_(game)
- Dakarkari people: https://en.wikipedia.org/wiki/Dakarkari_people
- Dara rulebook: https://c.tabletopia.com/games/ludos-africa/rules/dara-rulebook/en
- Connect Four: https://en.wikipedia.org/wiki/Connect_Four
- Mobile session benchmarks: https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks
- Epic on mobile game loops: https://dev.epicgames.com/documentation/fortnite/designing-for-mobile-in-fortnite
- Chess.com abandonment rules: https://support.chess.com/en/articles/8593801-how-does-game-abandonment-work
