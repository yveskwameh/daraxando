# Copy pass: less Nigerian flavour, not none

Step 4 in `docs/NEXT-ROUND.md`, written 17 October 2026 for Yves to approve. Decisions behind it (Yves, 17 October 2026):
Baba Ayo keeps a light Pidgin voice in his own lines only; match text goes plain, with one fun line on wins.
Titles, animals, pieces, prints, Baba Ayo, places and music stay. Nothing new in Yoruba, Igbo or Hausa is added, so the native speaker isn't needed.

**Status: approved by Yves and built, 17 October 2026.** On 18 October 2026 Yves undid the match-screen part: everything under "During a match" (and Baba Ayo's chat in games against him, and the quick messages) is back to the "Now" column, word for word. The rest stands.

## During a match

Plain, so nobody has to translate in the middle of a game. The fun stays in one place: the stamp when you win a game.

| # | Where | Now | Proposed | Code |
| --- | --- | --- | --- | --- |
| 1 | Status line, your turn | Oya, place your drum | Your move. Place your drum. | `src/screens/Game.tsx` |
| 2 | Status line, their turn | Jeje, e dey come | Their move | `src/screens/Game.tsx` |
| 3 | Status line, before the game starts | Jeje, e dey come | Getting the game ready | `src/screens/Game.tsx` |
| 4 | Status line, your time is almost up | Sharp sharp! | Quick, your time is almost up. | `src/screens/Game.tsx` |
| 5 | Status line, they can win next move | Shine your eye. They have a line. | Watch out. They can win next move. | `src/screens/Game.tsx` |
| 6 | Flash, they blocked your winning square | Haba! They blocked you. | They blocked you. | `src/screens/Game.tsx` |
| 7 | Flash, your time runs out | Otilo! Time up. | Time's up. | `src/screens/Game.tsx` |
| 8 | Status line, you ran out of time | Otilo! You ran out of time. | You ran out of time. <br>*Also the result title for the same moment.* | `src/screens/Game.tsx` |
| 9 | Status line, you win a game | Yawwa! You win this one. | You win this one. | `src/screens/Game.tsx` |
| 10 | Status line, they win a game | We move. Next one. | Tobi wins this one. <br>*With their name.* | `src/screens/Game.tsx` |
| 11 | Stamp on the board, you win a game | GBAM! | GBAM!<br>ODOGWU!<br>E CHOKE! <br>*The one fun line on wins. One of the three, at random. All three are already in the game and approved.* | `src/screens/Game.tsx` |
| 12 | Stamp on the board, they win a game | CHAI! | THEY WIN | `src/screens/Game.tsx` |
| 13 | Stamp on the board, a draw | NOTIN SPOIL | DRAW | `src/screens/Game.tsx` |
| 14 | Screen as a match starts, between the two players | Gbas gbos! | VS | `src/components/VsSplash.tsx` |
| 15 | Quick messages players send each other | Gbam!<br>Haba!<br>Oya nau<br>Shine your eye<br>You too much<br>No rage bait me | Good game<br>Nice one<br>Your move<br>Gbam!<br>Haba!<br>No rage bait me <br>*These are what players say, so a little flavour fits. Half plain, half the best-known three.* | `shared/protocol.ts (EMOTES)` |

## After a match

The result sheet says what happened in plain words. The win stamp already carried the fun.

| # | Where | Now | Proposed | Code |
| --- | --- | --- | --- | --- |
| 16 | Small label above the result | Odogwu (win)<br>Shikena (loss)<br>Gbas gbos (draw) | Fading · Best of 3 <br>*The game and series you just played, the same on every result.* | `src/sheets/ResultSheet.tsx` |
| 17 | Result, you win a one-game match | Gbam! You win. | You win. | `src/sheets/ResultSheet.tsx` |
| 18 | Result, you win a series | E choke! You take it 2 to 1. | You win the match, 2 to 1. | `src/sheets/ResultSheet.tsx` |
| 19 | Result, you lose a one-game match | Chai. They got this one.<br>Chai. Baba Ayo got this one. | Tobi wins this one.<br>Baba Ayo wins this one. <br>*With their name.* | `src/sheets/ResultSheet.tsx` |
| 20 | Result, you lose a series | Chai. They take it 2 to 1. | Tobi wins the match, 2 to 1. | `src/sheets/ResultSheet.tsx` |
| 21 | Result, a draw | Draw. Notin spoil.<br>Level, 1 to 1. Notin spoil. | Draw.<br>Level, 1 to 1. Nobody wins. | `src/sheets/ResultSheet.tsx` |
| 22 | Result, they left the match | Your opponent don japa. You win. | Tobi left. You win. | `src/sheets/ResultSheet.tsx` |
| 23 | Line under the result, after you beat a player | Tobi says: no rage bait me. Rematch? | Rematch? <br>*After a loss it says "Run it back?" today; this makes both "Rematch?".* | `src/sheets/ResultSheet.tsx` |
| 24 | Streak milestone celebration | Gbam! 7-day streak. +50 Aura. | 7-day streak. +50 Aura. <br>*The big flame and the number already celebrate it.* | `src/components/Celebrate.tsx` |

## Baba Ayo's chat, in games against him

He keeps his voice here. Only the words most players would have to look up go: Jeje (it's also his easy level, which is confusing), Jisi ike, Ndo and Gbas gbos.

| # | Where | Now | Proposed | Code |
| --- | --- | --- | --- | --- |
| 25 | When you start | Oya, you start. Baba is watching.<br>Go first, my child. Take your time.<br>Your move. No rush. | No change | `worker/baba.ts` |
| 26 | When he starts | Baba goes first. Shine your eye.<br>I start this one. Watch and learn.<br>My turn first. Jeje. | Baba goes first. Shine your eye.<br>I start this one. Watch and learn.<br>My turn first. Slow and steady. | `worker/baba.ts` |
| 27 | While playing | Hmm.<br>Your move.<br>I see you.<br>Jeje o.<br>Patience, my child. | Hmm.<br>Your move.<br>I see you.<br>Easy o.<br>Patience, my child. | `worker/baba.ts` |
| 28 | When he blocks you | Not today.<br>Haba! I saw that one.<br>Patience, my child.<br>You thought. | No change | `worker/baba.ts` |
| 29 | When he wins a game | Gbam!<br>Shikena.<br>Baba still has it. | No change | `worker/baba.ts` |
| 30 | When you win a game | Yawwa! You got me.<br>Jisi ike. Well played.<br>You too much. | Yawwa! You got me.<br>Well played, my child.<br>You too much. | `worker/baba.ts` |
| 31 | A drawn game | Notin spoil.<br>Gbas gbos! Nobody wins.<br>Level. Again? | Notin spoil.<br>Nobody wins this one.<br>Level. Again? | `worker/baba.ts` |
| 32 | He wins the match | Shikena. Baba takes it. Again?<br>Ndo, my child. Run it back? | Shikena. Baba takes it. Again?<br>Sorry o, my child. Run it back? | `worker/baba.ts` |
| 33 | You win the match | Odogwu! You take it.<br>Yawwa. You beat Baba fair and square. | No change | `worker/baba.ts` |
| 34 | A drawn match | Notin spoil. We go again? | No change | `worker/baba.ts` |
| 35 | His reactions | Hmm.<br>Jeje o.<br>Patience, my child.<br>Haba!<br>No rage bait me. | Hmm.<br>Easy o.<br>Patience, my child.<br>Haba!<br>No rage bait me. | `worker/baba.ts` |

## Baba Ayo's nudges

Same guilt trips, lighter Pidgin: English a non-Pidgin speaker reads at a glance, with his "o", "abeg" and "Haba" kept. These show on Home, in the streak sheet, on the streak celebration and when you leave a game against him.

| # | Where | Now | Proposed | Code |
| --- | --- | --- | --- | --- |
| 36 | Your streak is at risk | Your 4-day streak dey shake o. You go just leave am like that?<br>I don wait you since morning. 4 days and you wan stop today?<br>Ah ah. Na so you go forget me? One match, abeg. Make your streak no die.<br>I dey look you. 4 days we build together. You no fit leave me like this. | Your 4-day streak is shaking o. You'll just leave it like that?<br>I've waited for you since morning. 4 days and you want to stop today?<br>Ah ah. You forgot me? One match, abeg. Don't let your streak die.<br>I'm watching you. 4 days we built together. You can't leave me like this. <br>*Days count as "1 day", "2 days" (fixed today).* | `shared/nudges.ts` |
| 37 | Your streak just ended | Haba! 4 days, gone just like that. My heart don break.<br>I tell you make you come. Now see. 4 days, finish. You fit still restore am.<br>I no go lie, this one pain me. 4 days. Come restore am before e too late. | Haba! 4 days, gone just like that. My heart is broken.<br>I told you to come. Now see. 4 days, finished. You can still restore it.<br>I won't lie, this one pains me. 4 days. Restore it before it's too late. | `shared/nudges.ts` |
| 38 | You're back after days away | Ah, you remember me? I don dey wait since Monday.<br>Long time! I been think say you don forget Baba.<br>5 days and not even one match. I don miss you o. | Ah, you remember me? I've been waiting since Monday.<br>Long time! I thought you'd forgotten Baba.<br>5 days and not even one match. I missed you o. | `shared/nudges.ts` |
| 39 | You leave a game against him | You dey run from me? Okay o. I go win.<br>Ah, you wan leave Baba for middle of game? E pain me. | You're running from me? Okay o. I'll win.<br>You want to leave Baba in the middle of a game? E pain me. | `shared/nudges.ts` |

## Notifications

The 7 pm reminder is from Baba Ayo, so it keeps his lighter voice. "Friend joined your room" comes from Dara X&O, so it's plain.

| # | Where | Now | Proposed | Code |
| --- | --- | --- | --- | --- |
| 40 | 7 pm streak reminder, from Baba Ayo | Your 4-day streak go end for midnight o. One quick match go save am.<br>4 days no be small thing. Play one match before midnight make e no cut.<br>Oya, your 4-day streak dey wait you. One match before midnight, e still dey.<br>No let 4 days waste o. Just one match tonight and your streak still dey. | Your 4-day streak ends at midnight o. One quick match saves it.<br>4 days is no small thing. Play one match before midnight so it doesn't break.<br>Oya, your 4-day streak is waiting. One match before midnight keeps it.<br>Don't let 4 days go to waste o. One match tonight keeps your streak. | `shared/notify.ts` |
| 41 | Your friend joined your room, from Dara X&O | Tobi don enter your room. Oya, come play!<br>Tobi dey wait you for your room. Oya, come! | Tobi joined your room. Come and play.<br>Tobi is waiting in your room. | `shared/notify.ts` |

## Everywhere else

Labels and instructions go plain, as the writing rules already say.

| # | Where | Now | Proposed | Code |
| --- | --- | --- | --- | --- |
| 42 | First screen, under the logo | Three in a row, the Naija way. Warm up against Baba Ayo, then take on players across Nigeria. | Three in a row. Warm up against Baba Ayo, then play people across Nigeria. <br>*Decision 7 in the plan.* | `src/screens/Onboarding.tsx` |
| 43 | The message a player shares to invite a friend | Oya, play me on Dara X&O. Code KM4TX, stake 500 Dara Seeds. | Play me on Dara X&O. Code KM4TX, stake 500 Dara Seeds. <br>*It goes out as the player's own WhatsApp message, so this one is your call. Keeping "Oya" is fine too.* | `src/sheets/FriendSheet.tsx` |
| 44 | Wallet, free seeds when you're low | Sapa relief | Free top-up <br>*The row's line already explains it: "You're low. Get topped up to 1,000 for free."* | `src/sheets/WalletSheet.tsx` |
| 45 | Message after claiming it | Sapa relief: you have 1,000 Dara Seeds again. | Topped up. You have 1,000 Dara Seeds again. | `src/sheets/WalletSheet.tsx` |
| 46 | Server message when it isn't ready | Sapa relief is for balances under 500, once every 4 hours. | Free top-ups are for balances under 500, once every 4 hours. | `worker/index.ts` |
| 47 | League name on Ranks | Ikogosi League | Ikogosi League<br>League 1 of 6 <br>*The landmark names stay, with the tier in plain words under them. Decision 6 in the plan.* | `src/screens/Ranks.tsx` |

## Stays as it is

- **The 20 titles:** JJC to Idan, with what each means on the ladder.
- **Baba Ayo's levels:** Jeje, Sharp-sharp and Agba, with Easy, Medium and Hard under them.
- **Animals, pieces and prints:** The folktale animals, the X & O pieces (talking drum, calabash and the rest) and every print, Gbam Line included, with their names.
- **Baba Ayo himself:** The tortoise in a fila, his name, and his light Pidgin in his own lines.
- **Places:** States, zones, All Nigeria, the league landmarks and matchmaking by state.
- **Music and sound:** The talking drum and shekere loop.
- **Names of things:** Dara Seeds, Aura and the legend name ideas (until you decide on name ideas).
