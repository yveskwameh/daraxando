# Next round: plan

Written 17 October 2026, from Yves's messages of 17 October (offline play, the 8 am emails, the sender address, and the Home, culture, names and nudge notes). Nothing here is built yet except where it says so. Each step says who does it, what it needs first, and how we check it. Yves approves the decisions in "Decisions for Yves" before the design steps start.

## Where things stand

- The real game at daraxando.yveskwameh.com runs the code of 16 October (Yves merged `main` into `production` at 6:05 pm and 8:26 pm). On 16 October, 6 players played 42 matches. The link hasn't been shared publicly yet.
- The full regression run planned for before launch hasn't run yet.
- Waiting in Yves's folder, not pushed: the `admin@` sender address (`wrangler.jsonc`, `worker/accounts.ts`, `docs/BACKEND.md`). Yves wants the UI changes done before the next push.
- The 8 am email can't read the free plan numbers. Cause found: the "Dara X&O report" token's Account Analytics Read sits in a policy limited to the Worker `daraxando`, so it never reaches the account. Fix in step 0.

## What Yves asked for

1. **Offline play.** Everything works without data except playing other people. Progress is kept on the phone and sent when the connection returns, and the server still decides. He agreed with the Duolingo streak rule (offline games keep the streak if they reach the server before midnight that day).
2. **A calmer Home.** It feels cramped and in your face. Start a game fast, keep the energy, don't overwhelm.
3. **Less Nigerian flavour, not none.** Keep the illustrations and their names, the pieces (talking drum, calabash and the rest), the prints, the titles and the music.
4. **Players set their own name,** and **no two players share a name** (a bug today: the name ideas are a pool of 36, so names repeat).
5. **Baba Ayo's nudge:** fix "1 days", let players swipe it up to hide it, and have it come as a push notification too.
6. **Ideas to make the game work better.**
7. **One plan, in the right order,** and the build strategy.

## What the research says

### Home
- Fewer choices make faster starts (Hick's law), and only one action should be the loudest on a screen (Material). Today's Home has about 10 tap targets, a 4-card swipeable Deck and three printed buttons of nearly equal weight, so nothing leads.
- Carousels get little use: about 1% of visitors clicked one homepage carousel, and 84% of those clicks went to the first slide. Swiping is the least-used control on mobile.
- The games that do this well have one Play button with the mode as a setting next to it: Clash Royale's Battle button with its mode switcher, Brawl Stars' Play with the Events picker, Chess.com's Play using your last settings, Royal Match's single Play. Duolingo Chess, the closest match to us, shows one picture, three small stats and two buttons: "Play a person" and "Play Oscar".
- Streak, currency and quests usually sit as small counters at the top, and stats and settings live in the profile. Supercell cleaned up Clash of Clans for the same reason ("getting more crowded for years"): Settings moved into Profile, and some buttons only show when they're relevant.
- Movement at the edge of your eye pulls attention, so one looping animation is plenty.

### Nigerian flavour
- Local flavour works best in the art, music and rewards, and plain language works best for instructions (localisation research; Kuda's plain line "Less bank, more life" over Nigerian illustration; Maliyo's Whot King, which puts ease of use first).
- Pidgin reaches people but still carries a "broken English" stigma in formal settings, and humour is risky: NN/g found an irreverent tone lowers trust. Mailchimp: "it's always more important to be clear than entertaining."
- A good rule: high flavour in art, avatars, pieces, prints, music and titles; a little in celebrations (one line, rotating); none in buttons, instructions, errors and status.

### Names
- The common pattern is one unique name, checked without caring about capitals, with a reserved list (Discord, Supercell, Lichess). Tags like #1234 avoid "name taken" but people forget them, and two "Tobi" rows on Ranks would still look the same.
- Let people play first, then ask (Duolingo's pattern).

### Offline play
- The queue lives in IndexedDB; localStorage is small and slow. Browsers may clear a site's data when the phone runs out of space, unless it has persistent storage, which Chrome grants silently to installed games or ones with notifications on. On iPhone, Safari clears data after 7 days of not opening the site in a browser tab, but not for a game added to the Home Screen.
- Background Sync works on Chrome and Samsung Internet, not on iPhone or Firefox, so we also sync on opening the app, on coming back to it, and after each game.
- Never trust a score the phone sends: replay the moves on the server with the same bot and the same seed, and use server time. Server-signed tickets set the seed and cap how many offline games count.
- Measured on 17 October: replaying Baba Ayo's moves for a whole game takes under 2 ms typically and about 8 ms at worst (Fading, Agba), so the server checks one game per request, inside the free plan's 10 ms.
- Offline screens: say what still works in plain words ("No internet. You can still play Baba Ayo."), grey out only what needs the internet, say "Saved on this phone", and show a short message when games are sent.

## Decisions for Yves

Recommendations first. **Answered on 17 October 2026:** 1 (a), Home layout A, picked from mockups of all three; 2 (a), names after the first game; 4 (a), light Pidgin in Baba Ayo's lines only; 5 (a), plain with one fun line on wins. Not answered yet, so the recommendations stand until Yves says otherwise: 3 (name ideas), 6 (league names), 7 (tagline) and 8 (hold pushes until the UI is done). Also decided: "New" on a game shows only until that game's own end date, and Fading has none.

1. **Home layout.** (a) **One Play button** (recommended): small counters at the top (streak, seeds, quests), one picture of the chosen mode with a mode chip ("Fading ▾") that opens a sheet with the four modes and remembers your last one, one loud Quick match button, then quieter "Play a friend" and "Play Baba Ayo". The swipeable Deck, the tagline and the second row of habit buttons go. (b) **The same plus a bottom tab bar** (Play, Ranks, You). (c) **A calmer Deck**: one card, no peeking neighbours, everything else as in (a). I'd mock up (a) and (c) as real screens at 390 and 320 px so you can compare.
2. **When players pick their name.** (a) **Right after the first game** (recommended): the first visit stays one tap with a temporary name, then "What should we call you?" with a suggestion filled in, three more ideas and a live "available" check. It has to be confirmed before Home. (b) On the first screen, before the first game: slower, but the name is theirs from the start. Either way names are unique, 3 to 16 letters, numbers and single spaces, and the same name in other capitals counts as taken.
3. **Name ideas.** Your animal plus a plain word, for example "Swift Tortoise", "Brave Hen", "Calm Elephant". The legend and place names go.
4. **Baba Ayo's voice.** (a) **He keeps a light Pidgin voice in his own lines only** (recommended): nudges, his chat in Baba Ayo games, the 7 pm reminder. You liked the nudge, so it stays his. (b) Plain English with the odd Pidgin word.
5. **Game moments.** The stamps "GBAM!", "CHAI!", "NOTIN SPOIL" and lines like "Oya, place your drum" become plain ("You win", "They win", "Draw", "Your move"). (a) **Plain everywhere except one short rotating line on a win** (recommended). (b) Plain everywhere.
6. **League names.** (a) **Keep the landmark names and add the tier in plain words** ("Ikogosi, league 1 of 6") (recommended). (b) Plain names (Bronze, Silver, Gold).
7. **The tagline** "Three in a row, the Naija way" goes from Home with the layout change. On the first screen it becomes plain, for example "Three in a row. Play people across Nigeria, or Baba Ayo."
8. **Pushing.** You asked to hold every push until the UI is done. I'd keep that: the fixes are built now and wait in your folder, and everything goes out together in release 1.

## The plan, step by step

### Step 0. Today, Yves (5 minutes)
- In Cloudflare, open the "Dara X&O report" token, change the policy's scope from **Specified Workers** to your account, keep **Account Analytics Read**, save. Nothing changes on the Workers.
- Optional: connect the Cloudflare Developer Platform connector, so Claude can look at the Workers, database and settings directly. Claude only reads; publishing stays with Yves.
- Check: the next 8 am emails show the free plan numbers.

### Step 1. Decisions (this message)
- Yves answers the eight decisions above. Claude records them in `CLAUDE.md` and `DESIGN.md`, replacing the old Deck, header and Pidgin rules they change.

### Step 2. Fixes, built now (needs nothing else). **Built 17 October 2026, not pushed.**
- "1 day", not "1 days", in every line that counts days: Baba Ayo's nudges and the 7 pm reminder (`src/lib/babaNudge.ts`, `shared/notify.ts`).
- Swipe up to hide every pop-up at the top (Baba Ayo, the asks, install, friend streak requests, friend joined), with the X kept for people who don't swipe.
- Unique names on the server: a `name_key` column (lower case, single spaces) with a unique index, a reserved list (Baba Ayo, Dara, admin, support, every title name), and "That name is taken" with three free ideas. Players who already share a name: the first to take it keeps it; the others get a number added and are asked to pick a new name next time they open the game.
- Check: unit tests for the plurals and the name rules, the name script against the server, the pop-ups at 320, 360 and 390 px.
- As built: `nDays` in `shared/habits.ts` and Baba Ayo's lines moved to `shared/nudges.ts` (`tests/plurals.test.ts`); `TopPop` for every top pop-up; `migrations/0010_names.sql`, `nameKey`, `freeNames` and `/api/names` (`tests/names.test.ts`). The name step after the first match from step 5 came with it, because the server already knew who still had the game's pick: `NameForm` on You and in `NameSheet` on Home. Name ideas are still the legend pool, with a number when taken, until decision 3 is answered.

### Step 3. Home direction (needs step 1). **Done 17 October 2026: Yves picked A, built the same day.**
- Claude mocks up the chosen layouts as real screens from the game's own code, at 390 and 320 px, with a pop-up showing and without. Yves picks or adjusts.
- Check: no page scroll at 320 × 568, one loud button, every tap target 44 px.

### Step 4. Copy pass (needs step 1). **Approved and built 17 October 2026 (`docs/COPY-PASS.md`, 47 rows), not pushed.**
- Claude lists every Pidgin and Nigerian line in the game (around 30 Baba Ayo, nudge and reminder lines, the stamps, the status lines, the tagline, onboarding and Search lines) with the proposed new wording, in one table. Yves approves.
- Nothing new in Yoruba, Igbo or Hausa is added, so the native speaker isn't needed. Anything new would go to them.

### Step 5. Build the new Home, the copy and the name step (needs steps 2 to 4)
- Home as approved, the copy table, the name step after the first game (or on the first screen), the new name ideas, and the league and tagline changes.
- `CLAUDE.md`, `DESIGN.md` and `docs/CULTURE.md` updated to match.
- Check: typecheck, tests, build under 100 KB, every changed screen at 320, 360 and 390 px, the first-visit script, the asks script.

### Step 6. Lawyer packet (send during step 5, so step 8 isn't held up)
- Changes to the privacy notice's "On your phone" section only: a copy of your player and the games you played without internet, until they're sent; and the count of matches finished on this phone (kept since 16 October, not yet listed). Nothing about seeds changes. Bump `TERMS_VERSION` only if the lawyer says the change matters.
- Claude writes the exact lines; Yves sends them.
- **Written 18 October 2026** as one doc for the lawyer, together with the typed-messages line (`docs/CHAT-REVIEW.md`): "Dara X&O: privacy notice changes for review", https://claude.ai/code/artifact/72dd7e05-b2a3-479d-8aa5-382a30029f07. Proposed for "On your phone": the existing list plus "how many matches you've finished on this phone, so pop-ups come at the right moment", then "So you can play Baba Ayo without internet, it also keeps: a copy of your player and of Ranks as you last saw them; up to 10 one-use passes from us, which let games played offline count; the games you play without internet (the mode, the level, your moves and the time), until they're sent to us. When you're back online, the game sends those games to us and removes them from your phone. We check every move before a game counts." Proposed for "How long we keep it": "On your phone, for playing without internet: games until they're sent to us, and passes until they're used or 7 days have passed." and "Passes for playing without internet, on our side: which passes we gave your player, how the games played with each one ended (won, lost or drawn), and when it was used, for 10 days, so each offline game counts only once." Also asked: whether a one-time "We updated the privacy notice" note in the app meets the notice's promise to "show it in the app, and say what changed". Waiting for the lawyer.

### Step 7. Release 1: fixes, new Home, copy, names (needs steps 2 and 5)
- The full regression run, once (17 browser and server scripts plus the newer ones), and any fixes.
- Yves pushes, checks on his phone on the test copy, then merges `main` into `production`. The `admin@` sender goes out here too.
- Recommended: share the public link after this release, so first impressions are the calmer Home and unique names.

### Step 8. Offline play (needs step 6 approved and release 1 out)

**Built 18 October 2026, switched off on the real game** until the lawyer approves step 6 (`docs/BACKEND.md`, "Playing Baba Ayo without internet"). What changed from the plan below: passes are rows on the server rather than signed tickets (so they count once and are capped per day), games go one per request because a whole match can be too much to replay in 10 ms, offline matches have no turn clock, and a counted offline match gets the daily seeds like an online Baba Ayo match, because it is recorded the moment it reaches the server. You and the streak sheet need no change: their buttons that need the server already say "You look offline".
- **What works without data:** Home, You and Ranks as last seen (marked with when), and Baba Ayo on all four modes and all three levels. Quick match, friend rooms, buying a Streak Freeze or restoring a streak, and changing your name wait for the internet, each saying so.
- **Tickets:** while online the phone keeps 10 tickets signed by the server, each good for 7 days (the expiry promised in the step 6 lines). Each sets Baba Ayo's dice for one offline game and lets it count. With no tickets left, games are still playable but "just for fun" and don't count (the word "practice" stays out of the game).
- **Saving:** each finished game (ticket, mode, level, moves, the phone's time) goes into an outbox in IndexedDB. The phone works out the result and shows Aura and quests as "waiting to be sent".
- **Sending:** on opening the app, coming back to it, after each game, and with Background Sync on Chrome, one game per request. The server checks the ticket, replays every move with the same rules and the same Baba Ayo, and only then records the match exactly as if it had been played online. A ticket counts once, so a retry is never counted twice. The server's numbers then replace the phone's.
- **Streak:** an offline game keeps the streak only if it reaches the server before midnight Lagos time that day. Aura, quests and badges count whenever it arrives.
- **Seeds:** unchanged. Baba Ayo games have no stake, and the daily seeds wait for the next online match.
- **Protecting the outbox:** ask Chrome for persistent storage after the first offline game, and on iPhone the install ask explains that the Home Screen app keeps games safe.
- **Screens:** "No internet. You can still play Baba Ayo." on Home; greyed-out buttons that say why; "Saved on this phone. It counts when you're back online." after a game; "3 games sent" when they go.
- **Privacy notice:** the approved lines go into `src/legal/privacy.md` with a new "Last updated" date, and the app shows a one-time "We updated the privacy notice" note with a link, as the notice promises (if the lawyer agrees that's enough).
- Check: unit tests for tickets and replay (including tampered games, reused tickets, wrong seeds), a browser script that turns the network off and on, all screens at 320, 360 and 390 px, first download still under 100 KB, and the full regression run before release 2.

### Step 9. Release 2: offline play and typed messages
- Once the lawyer approves the doc from step 6: Claude puts the approved lines into `src/legal/privacy.md` (new "Last updated" date), adds the one-time "We updated the privacy notice" note if the lawyer agrees it's enough, and sets `OFFLINE_ON_REAL_GAME` (`shared/passes.ts`) and `TYPED_ON_REAL_GAME` (`shared/chat.ts`) to true.
- Yves pushes, tests on his phone with data off and on, merges into `production`.

### Step 10. Later
- **"We miss you" push notifications** after days away, in Baba Ayo's voice. The terms list the notifications the game sends, so a new kind changes the terms: it needs the lawyer, a `TERMS_VERSION` bump and the sheet that asks players to accept the new terms (which the terms promise). Until then, the nudge Yves liked arrives as a push through the existing 7 pm streak reminder, which uses the same voice.
- A name-change limit (for example once every 14 days) would also change the terms ("You can change its name at any time"), so it waits for the same terms update.
- Measure time to first match and next-day return before and after the new Home.

## Why this order

| Step | Needs first | Why |
| --- | --- | --- |
| 0 Token | Nothing | Five minutes, and every later email depends on it |
| 2 Fixes | Nothing | Small, safe, and the name rules shape the name step |
| 3 Home direction | 1 | The layout is a design decision; mocking up before building avoids a rebuild |
| 4 Copy | 1 | The new lines go into the new screens |
| 5 Build | 2, 3, 4 | One pass over Home, onboarding and the game screen instead of three |
| 6 Lawyer | Nothing technical | Sent early, so offline play isn't waiting on it |
| 7 Release 1 | 2, 5 | The full regression run hasn't happened yet; it runs before the first big push |
| 8 Offline | 6, 7 | Offline Home is built on the new Home, and the privacy notice must be approved before phones keep games |
| 10 Later | Terms update | New notification kinds and name limits change the terms |

## Ideas to make the game work better

1. **Quick match with few players online.** The 16 October numbers show it: 10 people started a game and left before anyone came, against 4 who met someone. Show how many people are playing right now on the Quick match button (we already count them), and when nobody is waiting, make "Play Baba Ayo while you wait" the clear second choice, with the game still listed so a person can join after. Never fake players.
2. **Progress after the match, not on Home.** Quest and streak progress show as "+1 quest" moments after a match (the celebrations exist already), which is what lets the streak and quest buttons leave Home.
3. **One reason to come back each day for everyone.** Dara Daily: one puzzle a day, the same for all of Nigeria, with a shareable result (from `docs/RETENTION.md`). It works offline too.

## Risks

- **Offline cheating.** Replays prove a game was legal, not that a person played it; the 10 tickets a day are what protect the leagues.
- **Lost outboxes.** A browser tab on iPhone that isn't opened for 7 days, or a full Android phone, can lose games not yet sent. Persistent storage and installing reduce this; the screen never promises more than "saved on this phone".
- **Baba Ayo changes.** A game played with an older Baba Ayo must replay with that version, so the server keeps the previous version for as long as tickets last (7 days).
- **Free plan.** Each sent game is one request and a few database writes, well inside the limits; the 8 am email will show it once the token is fixed.

## Sources

- Home: [Laws of UX, Hick's law](https://lawsofux.com/hicks-law/), [Android layout guidance](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns?hl=en), [NN/g progressive disclosure](https://nngroup.com/articles/progressive-disclosure/), [NN/g animation](https://www.nngroup.com/articles/animation-usability/), [Carousel click data](https://erikrunyon.com/2013/01/carousel-stats/), [Clash Royale mode switcher](https://supercell.com/en/games/clashroyale/blog/release-notes/june-update-2025/), [Clash of Clans UI revamp](https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/), [Chess.com starting a game](https://support.chess.com/en/articles/8609779-how-do-i-start-a-game-on-chess-com), [Duolingo Chess on Mobbin](https://mobbin.com/screens/b4ef9516-8b0c-4c0e-b067-89f0dc563d5e), [Duolingo home path](https://blog.duolingo.com/new-duolingo-home-screen-design)
- Flavour: [Kate Edwards on culturalization](https://www.thegamer.com/interview-kate-edwards-culturalization-gaming/), [Whot King](https://businessday.ng/sports/article/maliyo-games-introduces-whot-king-card-game-for-android-and-iphones/), [Kuda's design](https://www.itsnicethat.com/articles/barkas-kuda-graphic-design-project-131026), [Pidgin in marketing](https://www.rws.com/blog/can-pidgin-languages-be-used-for-marketing-and-advertising), [NN/g tone of voice](https://www.nngroup.com/articles/tone-voice-users/), [Mailchimp voice and tone](https://styleguide.mailchimp.com/voice-and-tone/)
- Names: [Discord usernames](https://discord.com/blog/usernames), [Roblox display names](https://devforum.roblox.com/t/say-hello-to-display-names/1036435), [Supercell Player ID](https://support.clashroyale.com/hc/en-us/articles/49484889626907-Player-ID), [Lichess FAQ](https://lichess.org/faq), [Gradual engagement](https://www.appcues.com/blog/gradual-engagement-mobile-app-first-screen)
- Offline: [web.dev storage](https://web.dev/storage-for-the-web), [MDN quotas and eviction](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [WebKit storage policy](https://webkit.org/?p=14403), [web.dev persistent storage](https://web.dev/articles/persistent-storage), [Can I use Background Sync](https://caniuse.com/background-sync), [Workbox background sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync), [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits), [Cloudflare signing example](https://developers.cloudflare.com/workers/examples/signing-requests/), [web.dev offline UX](https://web.dev/articles/offline-ux-design-guidelines), [Duolingo offline (fan guide)](https://duolingoguides.com/duolingo-offline-mode/)
