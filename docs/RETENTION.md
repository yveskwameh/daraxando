# Getting players in fast, and bringing them back

Research for Yves, 15 October 2026, modelled on **Duolingo**: what it does to get people started and to bring them back every day, what it has measured, where it crosses into manipulation, and how each idea fits Dara X&O.

**Status:** Part 1 (the first game) is built. On 15 October Yves picked the rest, and section 6 lists what was built. The lawyer approved the seed items (Streak Freeze, restore, streak stake) the same day.

## The short version

- **Duolingo lets people use the app before signing up.** Moving its sign-up screen back a few steps raised daily active users by about 20%. Dara X&O now does the same: one tap on the first screen, and you're playing Baba Ayo about a second later.
- **Duolingo's growth comes from bringing back people who already play,** not from new sign-ups. Its daily users grew 4.5 times in four years, mostly by raising the share of regular users who come back the next day. The streak, leagues and reminders are the tools that did it.
- **The measured wins:**
  - A visible streak: +3% daily users.
  - Protecting the streak over a break: 5% fewer lost streaks.
  - Leagues: +17% time spent, and three times as many highly engaged learners.
  - Friend streaks: 22% more likely to do the daily lesson.
  - More badges with tiers: +2% daily users.
- **Duolingo's dark side:**
  - An owl that acts sad, angry or "scared" to guilt you back.
  - Lives that run out and push you to pay or watch ads.
  - A free trial that hides the real price.
  - Emotional pressure when a streak breaks.
  - Researchers flag these as manipulative, especially for children.
- **For Dara X&O:** copy the mechanics (streaks, rest days, milestones, daily quests, friend streaks, leagues, badges) and drop the guilt, the lives and anything that touches stakes. Dara Seeds are stakes, players can be 13, and the lawyer approved the design as it is.

## 1. The first game (built)

### What Duolingo does, and what the research says

- **No account before the first lesson.** New users pick a goal and a level, then start learning without an account. Sign-up is offered later, "at logical moments", as people want to save their progress. ([Appcues GoodUX](https://goodux.appcues.com/blog/duolingo-user-onboarding))
- **The test behind it.** "Simply moving the sign-up screen back a few steps" gave about a 20% increase in daily active users. ([Taplytics](https://taplytics.com/blog/duolingo-ab-test-onboarding))
- **Get to the game fast.** Mobile game guidance is to reach core gameplay within a minute, with sign-up and settings after the first game. ([Playio](https://blog.playio.co/mobile-game-onboarding-retention))
- **Forced sign-up costs people.** In Baymard's 2025 survey, 18% of online shoppers had abandoned an order because they didn't want to create an account. ([Baymard](https://baymard.com/blog/current-state-of-checkout-ux))

### What changed in Dara X&O

| | Before | Now |
| --- | --- | --- |
| Screens before playing | 2 setup screens, then Home, the stake picker and a search | 1 screen |
| Taps to your first move | About 8, plus waiting for a match | 1 |
| Time from tap to your turn | Depended on the search | About 0.9 seconds (measured locally) |
| Name and animal | You type or pick them | Picked for you from the legend names, shown on a card. Change any time. |
| State | Pick from 37 chips | Best guess from the network, shown on the card. Tapping Play now accepts it. Change fixes it. |
| Age | A checkbox, "I'm 13 or older" | The button itself: "By tapping Play now, you confirm you're 13 or older." |
| First opponent | Whoever the search found | Baba Ayo at Jeje, his easiest level. Instant, and a likely win. |

Someone who opens a friend's invite link sees "{friend} invited you to a game" and **Join the game**, and lands in the room with one tap.

**Later, like Duolingo:** when sign-in arrives in the backend phase, ask at a natural moment ("Save your progress so you don't lose your 5-day streak"), never before playing.

**Update, 15 October 2026:** the first match is now one game, not best of 5. Lose or draw and the player gets one more game (they still open); win and Continue goes Home. A long series against the bot was too much for a first visit.

### Two things to confirm

1. **The age line.** The lawyer approved the checkbox version. The new screen keeps an action the player takes (the tap) next to a clear sentence, but it is a change. Nigeria's Data Protection Act treats under-18s as children and expects a parent's or guardian's consent and age checks. ([CookieYes](https://www.cookieyes.com/blog/nigeria-data-protection-act-ndpa/), [Mondaq](https://www.mondaq.com/nigeria/data-protection/1366934/the-nigerias-data-protection-act-2023-a-look-at-key-provisions)) Ask the lawyer to confirm the one-tap version.
2. **The state guess.** The card shows the guess before they play, so tapping Play now is a choice they make. If you'd rather never keep a guess, the alternative is "Prefer not to say" until their first Quick match.

## 2. How Duolingo brings people back

### The model behind it

Duolingo puts every user into one bucket each day:

- **New:** first day.
- **Current:** active today and at least once in the last 6 days.
- **Reactivated:** back after 7 to 29 days away.
- **Resurrected:** back after 30 or more days away.
- **At risk:** active recently, but not today.

The number that moved daily users most was the **current user retention rate** (CURR): the chance that a regular comes back. Its effect on daily users was 5 times bigger than the next best number. Raising it by 21% over four years cut daily churn among their best users by more than 40%, and daily users grew 4.5 times. The share of daily users on a 7-day-plus streak almost tripled, to more than half. ([Lenny's Newsletter, Jorge Mazal, former Duolingo growth lead](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth))

**For us:** the same five buckets are what we should measure once analytics exist (backend phase). Everything below is aimed at CURR.

### The mechanics, with their numbers

| Duolingo mechanic | What it does | Measured result |
| --- | --- | --- |
| **Streak always on screen** | The day count sits at the top of the app | +3% daily users, +1% day-14 retention ([Econsultancy](https://econsultancy.com/six-a-b-tests-used-by-duolingo-to-tap-into-habit-forming-behaviour/)) |
| **Streak celebrated after each lesson** | A "ring of fire" moment when it ticks up | +1% daily users, +3% day-14 retention (same source) |
| **Streak milestones** | An animation when you pass a milestone | +1.7% of new learners still active 7 days later ([Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit)) |
| **Weekend Amulet, then Streak Freeze** | Skip a day without losing the streak | 4% more likely to come back a week later, 5% less likely to lose the streak ([Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/)). Holding up to two freezes: +0.38% daily learners ([Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit)) |
| **Streak Wager** | Bet in-app currency that you'll keep a 7-day streak, win double | +14% day-7 retention ([Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/)), and a 600% rise in in-app purchases ([Econsultancy](https://econsultancy.com/six-a-b-tests-used-by-duolingo-to-tap-into-habit-forming-behaviour/)) |
| **Streak-saver reminder** | A late-evening alert when today's streak is about to break | Their "first big win" on streaks ([Lenny's Newsletter](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth)) |
| **Reminder timing** | Send the reminder 23.5 hours after your last lesson | Best of the times tested ([Econsultancy](https://econsultancy.com/six-a-b-tests-used-by-duolingo-to-tap-into-habit-forming-behaviour/)) |
| **Rotating reminders** | A system picks the message, rests ones you've seen | New messages work better and wear out. "Protect the channel": no more reminders without strong reason ([Duolingo](https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/), [Lenny's Newsletter](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth)) |
| **Leagues** | Weekly tables of players at a similar activity level; the top move up | +17% learning time, and three times as many highly engaged learners ([Lenny's Newsletter](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth)) |
| **Friend Streaks** | Keep a shared streak with up to 5 friends | 22% more likely to do the daily lesson. The hard part is getting the first invite sent ([Duolingo](https://blog.duolingo.com/product-lessons-friend-streak/)) |
| **Badges with tiers** | Many ways to win, each with levels | +2% daily users and +2% day-14 retention, then +1% and +1% more from tiers ([Econsultancy](https://econsultancy.com/six-a-b-tests-used-by-duolingo-to-tap-into-habit-forming-behaviour/)) |
| **Hearts (lives)** | Each mistake costs a life; at zero you stop, pay, or watch an ad | No public numbers; researchers class it as a penalty system tied to upsells ([Teaching or Manipulating?, 2025](https://sol.sbc.org.br/index.php/ihc/article/download/37677/37459)) |

Two of Duolingo's experiments did nothing: a moves counter (no change to retention) and a congratulations badge on sign-up (0% across metrics). Referral rewards added only 3% new users. ([Lenny's Newsletter](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth), [Econsultancy](https://econsultancy.com/six-a-b-tests-used-by-duolingo-to-tap-into-habit-forming-behaviour/))

### Why it works

- **Habits.** Habits form by repeating something in the same context, and the streak rewards exactly that. Early days feel big (2 to 3 days is a 50% jump), and for long streaks the fear of losing them takes over. ([Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit))
- **A head start helps people finish.** In a car wash study, cards with 2 of 10 stamps already filled were completed by 34% of customers, against 19% for blank 8-stamp cards. ([Coglode](https://www.coglode.com/nuggets/endowed-progress-effect))
- **Other people matter.** Adding Discord's social features to PC games raised retention by 31%. ([PocketGamer.biz](https://www.pocketgamer.biz/discord-brings-social-layer-to-mobile-after-seeing-31-retention-increase-on-pc/))
- **One daily thing to share.** Wordle's result grid, shared on WhatsApp and Facebook, brought the New York Times "tens of millions" of new users. ([TechCrunch](https://techcrunch.com/2022/05/04/wordle-new-york-times-user-growth))

## 3. Duolingo's dark side

A 2025 study of Duolingo's design found these manipulative patterns ([Teaching or Manipulating?, 2025](https://sol.sbc.org.br/index.php/ihc/article/download/37677/37459)):

- **"Playing with emotion."** Duo's face goes from normal to bored to angry the longer you wait. Notifications like "you are scaring me..." plead with you to do a lesson now.
- **Guilt when a streak breaks.** Duo appears sad with lines like "Don't give up on me now!" The fix, a Streak Freeze, can be bought with gems or real money.
- **Lives and ads.** Five lives, one lost per mistake, then stop, pay, or watch an ad to keep going. Ads sit between screens.
- **A hidden price.** Ads say "TRY 1 WEEK FREE" at 0.00, and finding the real subscription price takes about six steps.
- **Children.** The authors argue children are especially open to the owl's sad and angry faces.

Users describe the reminders the same way, as in "Duolingo Needs to Chill" ([Debugger](https://debugger.medium.com/duolingo-needs-to-chill-8f1832745ca0)): "We haven't seen you in a while.", "Keep Duo happy!", and finally "These reminders don't seem to be working. We'll stop sending them for now."

The same study credits Duolingo with good patterns too: clear buttons, notifications that are easy to turn off, and deleting an account or cancelling in a few plain steps.

### Why the line matters more for us

- **Gambling-style games and teenagers.** In an Australian study, teens who played simulated gambling games at 16 to 17 had a 40 percentage point higher chance of gambling for real money at 18 to 19. ([AIFS](https://aifs.gov.au/node/35036)) Dara Seeds are stakes, and our players can be 13.
- **Dark patterns cost game companies real money.** In the US, Epic Games paid $245 million over Fortnite purchase design (one-press buying, buttons placed for misclicks, a hidden refund option), and another $275 million over children's privacy. ([FTC](https://www.ftc.gov/node/80137), [Loeb](https://www.loeb.com/en/insights/publications/2023/01/fortnite-video-game-maker-settles-ftc-privacy-deception-claims-for-record-$520-million))
- **The lawyer's sign-off.** It covers seeds as they are today. A streak wager paid in seeds, or anything that nudges people to stake more, changes what they approved.

## 4. Duolingo's ideas, sorted for Dara X&O

### Copy (the honest version)

| Duolingo | Dara X&O version | Effort |
| --- | --- | --- |
| Streak on screen | Already on Home ("N-day streak"). | Done |
| Streak celebrated after each lesson | After your first match of the day, the streak ticks up on the result sheet with a short fire moment and sound. | Small |
| Streak milestones | Days 3, 7, 14, 30, 50 and 100: a celebration, some Aura, and a print or piece to unlock. | Small |
| Streak Freeze (Weekend Amulet) | **Streak Freeze.** 200 Dara Seeds, or free at the 7, 30 and 100-day milestones. Hold up to two. A missed day uses one instead of breaking the streak. (Yves chose the seed version.) | Small |
| Daily goal | **Daily quests.** Keep "win 3 today" and add two that change daily ("Win a game of Fading", "Play a friend", "Beat Baba Ayo on Sharp-sharp"), each with Aura. Variety gives more ways to win. | Small to medium |
| Badges with tiers | **Achievements** with bronze, silver and gold tiers: "Win 10, 50, 200 games of Big", "Beat Agba", "Play someone from every zone". Shown in You. | Medium |
| Friend Streaks | **Friend streaks** with up to 5 friends: both of you play any game each day. Invites go through the WhatsApp share link we already have, because sending the first invite is the hard part. | Medium |
| Leagues | **Weekly leagues** of about 30 real players at a similar activity level. Wins earn league points, the top players move up and the bottom move down every Monday. Leagues named after Nigerian landmarks (Olumo, Zuma, Idanre, Obudu...). Until there are enough players each week, run a **state league** instead: "Rivers is 3rd this week." | Medium to large |
| Streak-saver reminder and timing | **Push reminders** (backend phase): one in the evening if today's streak is at risk, or about 23.5 hours after your last game. Rotating Pidgin lines, never more than one a day, an easy off switch, and they stop by themselves if ignored. | Medium |
| Play before sign-up | Built. Ask for sign-in later, when there's progress worth saving. | Done |

### Adapt with care

| Duolingo | Why not as-is | Safe version |
| --- | --- | --- |
| Streak Wager (bet currency on your streak) | Staking seeds on your own habit changes what the lawyer approved. | Yves chose the seed version, the **streak stake**: 200 in, 400 back after 7 days, fixed, one at a time. Built, and approved by the lawyer on 15 October 2026. |
| Duo's emotional reminders | The owl's sad, angry and "scared" faces are exactly what researchers flag. | Baba Ayo can be cheeky and warm ("Oya, your streak dey wait you"), never sad, hurt or disappointed in you. |
| "We'll stop sending them for now" | Stopping is good; the guilt in the wording isn't. | Stop quietly after a few ignored reminders, and say so plainly in Settings. |

### Leave out

- **Lives or energy** that stop you playing. It breaks the "no session or play limits" decision, and we have nothing to sell.
- **Ads between screens, free trials, hidden prices.** We sell nothing.
- **Fake players in leagues** or invented "1,203 playing now" counts. A small honest league beats a big fake one.
- **Shaming at the exit:** "Are you sure? You'll lose everything."
- **Anything that pushes stakes up** or invites players to "win back" a loss.

## 5. What we already have

- Day streak on Home.
- Daily goal: win 3 today, +50 Aura.
- +500 Dara Seeds for the first match each day, and the free top-up (once "Sapa relief").
- Aura and levels, with 32 unlocks (avatars, prints, pieces) and the next unlock shown after each match.
- Ranks by state and for all of Nigeria.
- Rematch first, the Next game sheet, and friend rooms with share links.

## 6. What Yves picked, and what was built (15 October 2026)

Yves kept everything except lives (they clash with "no play limits") and fake players. He chose the seed versions of the streak save and the streak bet, and the lawyer approved them.

| Built | Where players find it | How it works |
| --- | --- | --- |
| **Streak with a grey or lit flame** | Home, left button | Grey until your first match of the day, then lit, like Duolingo. Tap it for the streak sheet |
| **Streak celebration** | After your first match of the day, before the result | Full screen: the count goes up, this week's days, Continue |
| **Milestones** | Same screen | 3, 7, 14, 30, 50, 100 days (then every 100): Aura, and a free Streak Freeze at 7, 30 and 100 |
| **Streak Freeze** | Streak sheet | 200 Dara Seeds, hold up to 2, used automatically on a missed day. Shown as ice on the week strip |
| **Restore** | Streak sheet, and a warning on Home | 500 Dara Seeds, up to 3 days after a streak of 2 or more ends. A 1-day streak that ends is just day 1 again: no restore line after the match and no Baba Ayo sulk (fixed 18 October 2026, `canRepair`) |
| **Streak stake** (Duolingo's Streak Wager) | Streak sheet | Stake 200, keep your streak 7 more days, get 400. One at a time. Lost if the streak ends |
| **Daily quests** | Home, right button | Win 3 matches every day, plus two that change daily, each with Aura |
| **Quest and badge moments** | After a match | Full screen when a quest finishes or a badge gets a star |
| **Badges** | You, Badges tab | 9 badges with 3 stars each, Aura per star |
| **Friend streaks** | Streak sheet, Friend streaks tab | Up to 5. Add someone you played lately; they get a pop-up on Home to accept. It grows each day you both play |
| **Weekly leagues** | Ranks, League tab (opens first) | Up to 30 real players. Aura earned this week counts. Top move up, bottom move down each Monday, like a football table. Baba Ayo, tagged as a bot, sets the pace; in leagues of fewer than 5 you must beat him to move up |

Familiar patterns were used on purpose, so nobody has to learn anything new:
- A flame for the streak, ice for a freeze, a Monday to Sunday week strip.
- Progress bars with "1/3", stars for badges.
- A league table with promotion and demotion zones.
- A friend request pop-up with Accept and X.
- Settings behind a gear icon at the top right of You.
- Bottom sheets for actions, and full-screen moments with Continue after a match.

### Added later the same day

- **Titles instead of level numbers.** Twenty Nigerian titles of respect from JJC to Idan, like the rank names players know from mobile games. See `docs/CULTURE.md`, "Titles".
- **Baba Ayo's guilt nudges.** Yves asked to try the Duolingo owl's guilt after all, to see how it feels. Baba Ayo sulks in Pidgin when your streak is at risk, when it ends, when you come back after days away, and when you leave a match against him. Section 3's concerns still apply, so the lines never insult, never shame the player for who they are and never mention seeds, he speaks at most once every 4 hours, and Settings has "Baba Ayo's nudges" to turn him off. If testers find it too much, the switch can default to off.

### Still to come (backend phase)

1. **Push reminders:** streak saver in the evening, timed about 23.5 hours after your last game, at most one a day, with an off switch. Built 16 October 2026 (7 pm Lagos, only when the streak would end that night).
2. **"Save your progress" sign-in** at a natural moment. Sign-in built 16 October 2026; when to ask is section 7.
3. **Analytics** with Duolingo's five buckets, watching the current user retention rate. Built 16 October 2026 (the 8 am email).

Optional, any time: **Dara Daily**, one puzzle a day for all of Nigeria, with a shareable result.

## 7. When to ask: saving progress, notifications and installing (built 16 October 2026)

Yves asked for the asks to come back at intervals, at moments when the player has something going on, without being disturbing. He approved this plan and it was built the same day: the rules are in `shared/asks.ts` (tested in `tests/asks.test.ts`), the phone's side in `src/lib/asks.ts`.

### What the research says

- **Never on arrival, never before the player sees why.** Chrome found that sites asking for notifications on arrival get very low acceptance, and it moves sites with very low acceptance to a quieter prompt that's easy to miss. Nielsen Norman Group: never show a pop-up before people get value, and wait until it's relevant to what they're doing.
- **Ask right after something meaningful is finished.** Duolingo lets people learn without an account and gives "periodic prompts to create an account" after lessons; signing up becomes more compelling as there's more progress to keep. Apple's example for reminders: ask after the person schedules their first task, so they can see what the notifications are for. NN/g: ask after someone completes a top task.
- **Our own ask first, the phone's box only after "Turn on".** Safari and Firefox only show the box after a tap. Chrome hides its box for 7 days after three dismissals, and a "Block" stays until the player changes their settings, so the phone's box should only appear for people who already said yes. Adding a soft ask raised the NHL app's opt-ins by 36% (Airship).
- **One at a time, and sparingly** (NN/g).
- **After a no, wait, then come back.** OneSignal's soft ask waits 3 days, then 7, then 30. Airship's example: once a week, at most three times. Keep a quiet, permanent place for people who said no (OneSignal uses a small bell; we have Settings and the You row).
- **Guests can lose everything.** EA warns guest players that if something happens to the phone or the app, their progress may be gone. On iPhone, Safari deletes a site's stored data once Safari has been used on 7 days without the site being opened; a game added to the Home Screen doesn't count up those days.
- **Installing, the same rules.** Google's guide to promoting a web app install: don't show it on first load, wait for "strong interest signals" such as repeat visits, show it after a natural moment, respect a no, and on Android only offer it once Chrome says the app can be installed. On iPhone, installing is also what makes notifications possible, and since iOS 26 anything added to the Home Screen opens as a web app by default. On Android, Chrome is more likely to protect an installed game's data from being cleared when the phone runs out of space (persistent storage, which it grants silently to installed sites and sites with notifications on).

### What the game did before

- **Saving:** never asked. A row at the top of You and the Settings rows.
- **Streak reminders:** asked on Home after a match, from a 2-day streak, coming back 3, 7, 14, then 30 days after a close. Not in an iPhone Safari tab, where notifications can't work.
- **Friend joined:** asked only on the room screen, which most hosts never see because they wait on the invite sheet.
- **Install:** a pop-up on Home 2.5 seconds after it opens, in a browser tab only, at most once every 3 days, 2 weeks after a close, gone by itself after 12 seconds. A new player sees it the first time they reach Home, straight after their first game, which is the first ask they get. On Android it also shows when Chrome hasn't offered an install, and then gives the iPhone-style steps. Settings always has "Install the app".
- "One ask per visit" only resets when the page reloads, so in the installed app a visit can last days.

### The plan

1. **One moment for asks:** back on Home after a finished match. Never in the first game, in a match, in a room, with a sheet open or another pop-up showing, and not straight after a loss (a judgment call: a fresh loss is a bad moment to ask for anything, and a win or draw usually follows soon).
2. **One ask per visit,** counting the save ask, the notification asks, the install ask and Baba Ayo's nudge together. A visit starts when the game opens, or when the player comes back after 30 minutes away.
3. **Save your progress:** first after the player's 3rd finished match. After a close it waits 3 days, then 7, then 14, then 30, and keeps coming back every 30 days at the next good moment until they save. The line names what's at stake with their real numbers ("Keep your title, 1,250 Dara Seeds and 3-day streak if you change phones."). On an iPhone in Safari it adds that Safari can clear games that aren't opened for a week. **Save** opens the save sheet; X closes it.
4. **Streak reminders:** as now.
5. **Install:** moves to the same moment, after a match, from the second day a player plays (a repeat visit), in a browser tab only. On Android only when Chrome offers its install box; on iPhone it gives the steps. After a close it waits 14 days, then 30. On an iPhone in Safari it comes before the save ask, because installing protects the game and makes notifications possible there.
6. **Taking turns:** when more than one ask is due, the one shown longest ago goes first (never shown before goes first, in the order save, streak reminders, install), so a player never gets two in one visit.
7. **Silent protection on Android:** once the game is installed or has notifications on, it asks Chrome to keep its data when the phone runs low on space. Chrome decides without showing anything; it's skipped on browsers that would show a box.
8. **Friend joined:** a small button under the waiting line in the invite sheet once the host taps Share ("Tell me when they join", with a bell), the moment they're about to leave for WhatsApp, as well as the pop-up on the room screen. Same back-off. A full row didn't fit a 320 × 568 phone, so it's a button.
9. **Quiet places stay:** the You row and the Settings switches, including "Install the app". Once saved or turned on, never asked again. If notifications are blocked in the phone's settings, the game doesn't ask; Settings explains how to allow them.
10. **Count what works:** the 8 am email adds players who saved and who turned on notifications each day, and whether it came from an ask or from You and Settings. Counted with the request that saves or turns them on: no extra requests, no player ids.

**Example, a new player on Android, in Chrome:** day 1, nothing during the first game; after her 3rd match, a win, the save ask, which she closes. Day 2, after her first match, the streak reminder ask for her 2-day streak; when she comes back later that day, the install ask. Day 4, after a match, the save ask again. If she keeps closing it: day 11, day 25, then about once a month, always after a match.

**On an iPhone in Safari:** day 1, the save ask after the 3rd match. Day 2, the install ask with the steps. Once she plays from the Home Screen, the streak reminder ask.

## Sources

- [Lenny's Newsletter: How Duolingo reignited user growth (Jorge Mazal)](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- [Econsultancy: six A/B tests used by Duolingo](https://econsultancy.com/six-a-b-tests-used-by-duolingo-to-tap-into-habit-forming-behaviour/)
- [Duolingo: how the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- [Duolingo: how streaks keep learners committed (Wager and Weekend Amulet)](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/)
- [Duolingo: product lessons from Friend Streak](https://blog.duolingo.com/product-lessons-friend-streak/)
- [Duolingo: the AI behind the reminders](https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/)
- [Taplytics: Duolingo's delayed sign-up test](https://taplytics.com/blog/duolingo-ab-test-onboarding)
- [Appcues GoodUX: Duolingo onboarding](https://goodux.appcues.com/blog/duolingo-user-onboarding)
- [Teaching or Manipulating? Bright and deceptive patterns in Duolingo (2025)](https://sol.sbc.org.br/index.php/ihc/article/download/37677/37459)
- [Debugger: Duolingo Needs to Chill](https://debugger.medium.com/duolingo-needs-to-chill-8f1832745ca0)
- [Playio: mobile game onboarding and retention](https://blog.playio.co/mobile-game-onboarding-retention)
- [Baymard: current state of checkout UX (2025)](https://baymard.com/blog/current-state-of-checkout-ux)
- [Coglode: endowed progress effect](https://www.coglode.com/nuggets/endowed-progress-effect)
- [PocketGamer.biz: Discord social layer and retention](https://www.pocketgamer.biz/discord-brings-social-layer-to-mobile-after-seeing-31-retention-increase-on-pc/)
- [Chromium Blog: quieter permission UI for notifications](https://blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html)
- [Nielsen Norman Group: popups](https://nngroup.com/articles/popups/)
- [Apple: asking permission to use notifications](https://developer.apple.com/tutorials/data/documentation/usernotifications/asking-permission-to-use-notifications.md)
- [OneSignal: permission requests and back-off](https://documentation.onesignal.com/docs/permission-requests)
- [Airship: push opt-in and soft asks](https://www.airship.com/?p=15140)
- [Pushpad: browsers that need a tap before the notification box](https://pushpad.xyz/blog/the-notification-prompt-can-only-be-triggered-by-a-user-gesture-on-some-browsers)
- [EA Help: progress when playing as a guest](https://help.ea.com/en-us/help/mobile/can-my-lost-progress-be-restored-for-a-mobile-app-if-i-play-anonymously)
- [Search Engine Land: Safari's 7-day cap on stored data and Home Screen apps](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519)
- [web.dev: patterns for promoting PWA installation](https://web.dev/articles/promote-install)
- [web.dev: persistent storage](https://web.dev/articles/persistent-storage)
- [heise: iOS 26 opens Home Screen sites as web apps](https://heise.de/-10749652)
- [TechCrunch: Wordle and New York Times growth](https://techcrunch.com/2022/05/04/wordle-new-york-times-user-growth)
- [FTC: Epic Games settlement](https://www.ftc.gov/node/80137)
- [Loeb & Loeb: Epic's $520 million settlements](https://www.loeb.com/en/insights/publications/2023/01/fortnite-video-game-maker-settles-ftc-privacy-deception-claims-for-record-$520-million)
- [AIFS: video gaming, simulated gambling and young people](https://aifs.gov.au/node/35036)
- [CookieYes: Nigeria Data Protection Act summary](https://www.cookieyes.com/blog/nigeria-data-protection-act-ndpa/)
- [Mondaq: NDPA 2023 key provisions](https://www.mondaq.com/nigeria/data-protection/1366934/the-nigerias-data-protection-act-2023-a-look-at-key-provisions)
