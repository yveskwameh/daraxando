# Backend and launch plan

Status: planned 15 October 2026, the day Yves signed off the frontend. Launch address: **daraxando.yveskwameh.com**. Test copy: **https://daraxando-staging.yves-workers.workers.dev**, built from GitHub since 15 October 2026 (first build green, database tables made).

## What already exists

The game server is built and runs today with `npm run dev`:

- **Cloudflare Workers** answer the app's requests (`worker/index.ts`).
- **Durable Objects** run each match and friend room (`worker/match.ts`) and pair players for Quick match (`worker/matchmaker.ts`). The server decides every move.
- **D1** (Cloudflare's database) keeps players, ratings, Dara Seeds and the seeds ledger, streaks, quests, leagues and friend streaks (`migrations/`).
- **Guest players.** A new player gets a signed token (no password, no email). It lives on the phone, so a player who clears their browser or changes phone loses their progress. Fixing that is the biggest job below.
- **Safeguards already in.** Rate limits on new players, a daily limit on high-stakes matches between the same two players, seeds settled once per match, server-checked moves. Milestone 4 added the name filter, the farming rules, bans and the admin API.

So the backend phase is about making it ready for real players: keeping progress across phones, safety, notifications, knowing how the game is doing, and going live.

## Decisions (Yves, 15 October 2026)

1. **Saving progress:** players keep playing straight away as guests, and "Save your progress" links **Google or a 6-digit email code**. The email is designed in the game's look and shown to Yves before it's built.
2. **Cost: $0.** No paid plans or subscriptions, ever. Everything below runs on free plans.
3. **Notifications at launch:** yes, two kinds: "your streak ends tonight" and "your friend joined your room".
4. **Staging:** yes, a test copy with its own database, on a free workers.dev address under the account name Yves picks.

## Why Cloudflare's free plan

Researched 15 October 2026 for a $0 real-time game:

| Option | Why not, or why |
| --- | --- |
| **Cloudflare Workers Free (chosen)** | Live matches over WebSockets that sleep between moves, a database (D1, 5 GB), unlimited static files, a free custom domain on a domain already on Cloudflare, scheduled jobs and game analytics, all free. The game already runs on it. |
| Supabase Free | Good database and sign-in, but projects pause after a week without visits and there's nowhere to run the match rules. A rewrite for less. |
| Firebase Spark | Free sign-in and database, but no server code on the free plan, so the server couldn't decide moves. |
| Vercel, Netlify | No lasting WebSocket connections, so no live matches. |
| Render Free | The server sleeps after 15 idle minutes and takes up to a minute to wake: a player would stare at a loading screen. |
| Fly.io, Railway | No free plan any more. |

The free plan's limits, and what the game does about them:

- **10 ms of processing per request.** Baba Ayo's hardest search took 40 ms from an empty board. He now uses an opening book and remembers solved positions: worst move under 7 ms, average under 0.5 ms. Every new piece of server work is measured against 10 ms.
- **100,000 requests a day** (resets at 01:00 Lagos time). Static files don't count. The biggest cost was the Quick match sheet asking the server every 2 seconds; it now uses one live connection that the server pushes updates down, which costs almost nothing.
- **Over the limit,** Cloudflare refuses requests until the reset. The app shows a friendly "Dara X&O is resting" screen instead of breaking, and the game numbers warn well before that point.
- **Measured after the change:** a player on Home costs about 2 requests a visit, and an open Quick match sheet costs none (it was about 30 a minute). Live matches cost one request to connect; their moves travel over the connection.
- **Watch later:** counting a player's rank on Ranks reads many database rows once there are thousands of players (the free plan reads 5 million rows a day). The top lists are already cached; the rank count gets cached too when the numbers say so.
- If the game ever outgrows the free plan, the only fix is Cloudflare's paid plan. That's Yves's call when it happens, never automatic.

Free services used: Google sign-in (free), Resend for email codes (free plan: 3,000 emails a month, 100 a day, own domain), browser push (free), Cloudflare Web Analytics and Workers Analytics Engine (free).

## The work, in order

| # | Milestone | Claude does | Yves does |
| --- | --- | --- | --- |
| 1 | **Done 15 October 2026.** Production foundation, built for the free plan | Baba Ayo under 10 ms, Quick match on a live connection instead of polling, the "resting" screen, live and staging settings, security headers, rate limits on every action, error logs, a health check, the database indexes checked, deploy commands | Nothing |
| 2 | Staging online, built from GitHub | The release script and click-by-click steps (README, "Going live") | Makes the staging database, connects the GitHub repository to Cloudflare, adds the secret, opens the staging link on his phone |
| 3 | Save your progress. **Built 16 October 2026**, waiting for Yves's review on the test copy | Designs the sign-in email for approval, then builds sign in with Google and email code, sign in on a new phone, sign out, delete my account | Approves the email design (done), creates the Google sign-in client and the Resend domain and key (done), saves the keys as secrets, downloads Google's button assets (done 16 October 2026, in `public/google/`) |
| 4 | Safety. **Built 16 October 2026.** The lawyer and the native speaker approved it the same day | Name filter, reserved names, three rules against farming seeds, bans, and the admin API behind a secret key (look up, rename, ban, correct seeds) for the dashboard Yves builds after launch | Sends `docs/NAMES-REVIEW.md` to the native speaker and `docs/SAFETY-REVIEW.md` to the lawyer, adds the `ADMIN_TOKEN` secret when he wants the admin API on |
| 5 | Notifications. **Done 16 October 2026**: Yves got both on his phone from the test copy the same day | Web Push sent straight from the Worker, the asks at the right moment, the two notifications in Baba Ayo's Pidgin, the Settings switches | Makes the notification keys on his Mac and saves them as secrets on each copy, checks the Pidgin lines |
| 6 | Knowing how it's doing. **Built 16 October 2026**, waiting for Yves's first email | Game numbers recorded as players play, a report email at 8 am Lagos with yesterday's numbers and the free plan's use, the same numbers in the admin API | Adds the report secrets (who gets it, and a read-only Cloudflare token for the free plan part); turns on Cloudflare Web Analytics for the real address at launch |
| 7 | Legal pages. **Done 16 October 2026**: the lawyer approved them as drafted the same day | The privacy notice and terms in plain words (Nigeria Data Protection Act 2023), in the game at `/privacy` and `/terms` and linked from the first screen, Settings and the save sheet, plus `docs/LEGAL-REVIEW.md` with 15 questions | Sends `docs/LEGAL-REVIEW.md` to the lawyer, then registers with the Nigeria Data Protection Commission if the lawyer says it applies |
| 8 | Launch | README rewrite, final checks on staging, a load test | Connects the production Worker to GitHub the same way, then publishes by merging `main` into `production` |

### The sign-in email

`worker/email.ts` builds it: subject, HTML and a plain-text copy, in two versions ("Save your progress" for a guest adding an email, "Welcome back" for signing in on another phone). Every version links to the game and credits Yves with a link to yveskwameh.com (15 and 16 October 2026). The design (16 October 2026) mixes three of five options Yves saw: Baba Ayo's chat header and greeting bubble, the code on the game board, and editorial type with PLAY and CREATED BY links above a giant Dara X&O cut off by the bottom of the email. Approved by Yves on 16 October 2026.

Rules for any email: tables and inline styles, no scripts, SVG, animation, positioning or transforms; pictures are PNGs from the game's own address (`public/email/`, which the service worker skips), each with alt text; every print has a solid colour behind it for Outlook; the layout works without the `<style>` block, which Gmail drops for some accounts; under 102 KB so Gmail doesn't clip it. Gmail doesn't load web fonts, so headings fall back to Arial there.

The code stays plain text, so Gmail's "Copy code" button (Android and iOS, in the inbox list) and iPhone's code autofill can find it. No mail app copies text on a tap, so the code is also a link that opens the game with the code filled in. Building that link needs care: mail scanners open links on their own, so the link opens a page with a confirm button, and only that button uses the code.

Claude never deploys and never handles secret values. Yves runs every deploy and types every secret into his own terminal.

### Save your progress (built 16 October 2026)

Server: `worker/accounts.ts`, tables in `migrations/0004_accounts.sql`. Screens: `src/sheets/SaveSheet.tsx` (save, sign in, the code boxes, switching players), `src/screens/Account.tsx` (the email link's page, and the trip back from Google), Settings and You in `src/screens/Profile.tsx`, **Sign in** on the first screen.

- **Nothing changes for guests.** A player is still one id with a token. Saving links Google or an email to that id; signing in on a new phone hands that phone a token for the same id. A Google account or an email belongs to one player, and a player has at most one of each.
- **The Google button** is full width, built to Google's rules for a custom "Sign in with Google" button (their dark colours, Google Sans Medium, their G taken unchanged from their downloaded assets in `public/google/`), so it meets Google's branding rules for app verification.
- **Google:** a full-page trip to Google and back (no Google script in the app, so no change to the Content Security Policy). The server swaps Google's one-time code for the account using the client secret and PKCE, checks who the answer is for, who made it and when it ends, and keeps only Google's id for the account and its address (scope `openid email`: no name, no photo). The outcome waits up to 5 minutes for the app to collect it, once, and only the phone that started it can.
- **Email:** a 6-digit code, 10 minutes, 5 wrong tries. Only keyed hashes of the code and of the link's secret are stored, and code rows go after two days. The link in the email opens a page that asks before doing anything, because mail scanners open links on their own. Opened on another phone, it signs that phone in; the phone that asked finds out when it comes back on screen (no polling).
- **Same address, same player, either way in** (Yves, 18 October 2026: players must never be stuck with the way they first saved). Saved with an email code: Continue with Google with that same address signs in to that player, and Google joins it, so Settings lists both. Saved with Google: an email code to the Google account's address signs in to that player too (`playerByEmail` looks at both kinds). Typing an address that already has a player sends a sign-in code, even from the save sheet, so a second player is never made for one address; the player's name only shows once the code is right. Only a Google address Google has verified counts. Tested both ways in `api-auth` on 18 October 2026.
- **Switching** to another player always asks first, and says plainly when the player on the phone isn't saved and will be left behind.
- **Limits** (Resend's free plan sends 100 emails a day): 3 codes a minute per phone and per address, 5 an hour per address, 90 a day in all. 20 code checks, links and Google sign-ins a minute per phone.
- **Delete my account** removes the player, how they sign in, their codes, ledger, league rows, friend streaks, ban reviews, notification addresses and play days. Finished match rows stay in the opponents' history, holding only a random id that now leads nowhere, and so does the admin log, so a banned person can't simply start again (`docs/LEGAL-REVIEW.md`, question 6).
- **Sign out** is only offered to saved players, who can sign back in.
- Tested on 16 October 2026: 42 server checks (`api-auth`) and a browser run (`e2e-auth`) of every path, Google through a stand-in for Google's servers. The stand-in only works on a Mac copy (`GOOGLE_AUTH_URL` and `GOOGLE_TOKEN_URL`, ignored unless `ENVIRONMENT` is `local`).

### Safety (built 16 October 2026)

Yves's decisions on 16 October 2026: the same-phone rule; a one-way daily cap instead of a cap on how often two players can stake (friends who like staking with each other shouldn't be stopped); quick quits pay nothing; a ban stops online play only; the admin API now, the dashboard after launch. Seeds changes go to the lawyer first (`docs/SAFETY-REVIEW.md`), and the Nigerian-language words to the native speaker (`docs/NAMES-REVIEW.md`).

- **Names** (`worker/names.ts`): insults, slurs and sexual words in English, Pidgin, Yoruba, Igbo and Hausa, and names that pass for the game (Baba Ayo, Dara X&O, Admin, Support), checked whenever a name is set, by the player or the admin API. Look-alike spellings are caught (F U C K, fuuuck, b1tch, Ọlọ́ṣọ̀). Short words only count as whole words, so Bassey, Dickson, Shittu and Nazir pass.
- **Unique names** (17 October 2026, `migrations/0010_names.sql`): `players.name_key` (lower case, accents off, single spaces; `nameKey` in `worker/names.ts`) has a unique index, so two players can never hold the same name, even at the same moment (the insert or update fails and the player gets "That name is taken" with three free ideas from `freeNames`). `players.name_set` says whether the player chose their name: 0 the first screen's pick (asked after the first match), 1 chosen, 2 the game added a number because someone had it first (asked on Home). `/api/names?check=` answers the name field as you type, `/api/names` gives four free ideas; both are reads, rate-limited per player. The migration numbered players who already shared a name (the first to take it kept it). Title names (Chief, Idan 2) are reserved.
- **Farming** (`worker/safety.ts`, `shared/stakes.ts`): when a staked match is won, both stakes go back instead if the two players were made on the same phone, if the winner would end up more than 5,000 seeds ahead of that opponent in 24 hours (three stakes at tables above 1,000), or if the loser resigned, left or timed out in the first game before making 3 moves of their own. The win still counts for Aura, rating and the streak; the result sheet says why; the match row has `paid = 0`, and only paid matches count toward the cap. The phone is a keyed hash of the app's own random id, stored on the player when they're made.
- **Bans:** no Quick match, friend rooms, friend streaks or live games list (the server refuses each), and not in Ranks or leagues. Baba Ayo still works. The app shows the reason once each time it opens and whenever the player taps a way to play someone (`src/sheets/BanSheet.tsx`).
- **Watching from outside** (Yves, 16 October 2026: "they can see it through the window, but they can't participate", so they reflect on what they did). A banned player sees Ranks and their league as everyone else does, without themselves in them, plus a dashed row with a lock for where they'd be: their rank by rating among players who aren't banned, and their place in the league by the Aura they earned this week before the ban. They can't climb either, so the row slides as others play. Their own league group if they had one this week, otherwise the fullest group at their level (`leagueFor` in `worker/habits.ts`, `outside` in the answer).
- **Ban reviews** (`migrations/0006_appeals.sql`, `appealOf` and `askReview` in `worker/safety.ts`): from the ban sheet, or the "Watching from outside" card on Ranks, the player writes 10 to 500 characters and sends it. One request waits at a time. Yves answers through the admin API: lifting the ban, or keeping it with a note the player reads in the ban sheet. After a ban is kept they can ask again a week later. A new ban starts fresh. The privacy notice (milestone 7) should say these messages are kept.
- **Admin API** (`worker/admin.ts`, `docs/ADMIN-API.md`): off until the copy has an `ADMIN_TOKEN` secret of 32 characters or more. Every change goes to the `admin_actions` table.
- **Bans and rematches:** a match under way when a ban lands finishes, but no rematch starts (the room checks bans first and tells both players).
- **Fixed on the way (it was there before milestone 4):** a rematch asked for twice at the same moment could take both stakes twice. The room now clears the asks before it waits on the database.
- **Known limits, accepted for now:**
  - A player who expects to lose can quit in the first game before their 3rd move and keep their stake. The winner still gets the win.
  - Two matches between the same pair that end at the same moment can both pass the daily cap, so it can overshoot by a stake or two.
  - The phone id comes from the app, so someone who clears the app's data, or uses another browser, gets a new one. A banned player can also start a new guest account. The admin API lists every player made on the same phone, so Yves can spot both.
- Tested on 16 October 2026: 79 server checks against real friend-room matches (`api-safety`), unit tests for every rule and every suggested name (`tests/safety.test.ts`), and the ban sheet, Ranks and the result sheet at 390, 360 and 320 px wide.

### Notifications (built 16 October 2026)

Yves's decisions on 16 October 2026: ask at the right moment, not on the first visit; if the player closes the ask, come back at a later right moment, spaced out, and keep the switches in Settings for good; the streak reminder at 7 pm Lagos time; Baba Ayo's voice, in Pidgin, saying what's at stake and the one quick thing that fixes it.

- **The two notifications** (`shared/notify.ts`). Both are off until the player turns them on.
  - **Streak reminder:** at 7 pm Lagos time, only to players who haven't played today and whose streak would really end at midnight (a Streak Freeze left would cover tonight, so they get nothing). At most one a day. Four lines, picked at random, for example "Your 6-day streak go end for midnight o. One quick match go save am." Tapping it opens Home.
  - **Friend joined your room:** the moment a friend takes the seat in the host's room, only when the host isn't in the app and nobody is watching the room. "Tunde don enter your room. Oya, come play!" Tapping it opens the room. Push services drop it after 10 minutes, because a stale one isn't worth showing.
  - Turning them on sends one plain-English message straight away ("Notifications are on. You can change them in You, then Settings."), so the player sees it works.
- **Asking** (`shared/asks.ts`, `src/lib/asks.ts`, `src/components/PushAsk.tsx`; when and why in `docs/RETENTION.md`, section 7). Our own ask first; the phone's permission box only after **Turn on**, because a "Block" there can't be asked again. The streak reminder ask shows on Home after a match that wasn't a loss, once the player has a streak of 2 days or more, taking turns with the save and install asks, one per visit. "Tell me when they join" is a small button in the invite sheet once the link is shared, and a pop-up on the room screen. After an ask shows, it waits 3 days, then 7, 14, and every 30 days after. You, then Settings, always has **Streak reminder** and **Friend joined your room**. The 8 am email counts who turned them on, and where (`push:on:streak-ask`, `push:on:friends-ask`, `push:on:settings`).
- **iPhone:** Safari only shows web notifications in the installed app (Add to Home Screen, iOS 16.4 and later). In a Safari tab the asks stay away and Settings says to install the app first.
- **Sending, for free** (`worker/push.ts`). Web Push straight from the Worker with WebCrypto, no outside service: each message is encrypted for one phone with the keys that phone gave (RFC 8291), and signed with our VAPID key (RFC 8292), which tells the push services (Google, Apple, Mozilla, Microsoft) it's us. The server only calls addresses at those services. A phone that turned notifications off or removed the app is forgotten the first time a push service says so.
- **7 pm on the free plan** (`worker/notifier.ts`). A cron trigger (`0 18 * * *` in `wrangler.jsonc`, which is 7 pm in Lagos all year) starts the `Notifier` Durable Object. Encrypting one message takes about 1 ms and the free plan gives 10 ms per request, so it sends 5 at a time, one alarm after another, a quarter of a second apart. Each phone is marked as reminded before its message goes, so a retried alarm never sends twice. It stops at 10 pm Lagos time. A few thousand players with reminders on take a few minutes, well inside the free plan (100,000 requests a day; each alarm counts as one).
- **Stored** (`migrations/0007_push.sql`, table `push_subs`): the address the phone's push service gave, the phone's two keys, the player, which of the two kinds are on, and the day of the last reminder. Up to 5 phones per player. Delete my account removes them. **The privacy notice (milestone 7) must say this is kept, and why.**
- **Keys:** `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, one pair per copy, made once on Yves's Mac (README, "Secrets"). Never change a pair once players have turned notifications on: every phone subscribed with the old one stops getting messages until the player turns them on again. Without the keys, the asks and switches still show, and turning on says notifications aren't set up on that copy yet.
- **Admin API:** a test message to one player's phones, and starting today's reminders by hand (`docs/ADMIN-API.md`).
- Tested on 16 October 2026: unit tests for the encryption (decrypted with Node's own crypto, written separately, and checked against the `http_ece` reference library), the address rules and the copy (`tests/push.test.ts`); 25 server checks against a stand-in push service (`api-push`): the welcome message, the friend message when the host is away and not when they're watching, the switches, the 7 pm run (nothing for players who played today or have a Streak Freeze left) with no double sends, forgotten phones, and Delete my account; the asks and Settings at 390, 360 and 320 px wide. On 16 October 2026 Yves got the welcome message and "friend joined your room" on his phone from the test copy. His first try failed with "unauthorized": the app asked for the public key without a login, which the server refused, and the server checks had always sent one. The key needs no login now, and a browser check (`e2e-push`) turns notifications on and off through the real switches and the Home ask, with only the phone's permission box and subscription stood in.

### Game numbers (built 16 October 2026)

Yves's decisions on 16 October 2026: a morning email with yesterday's numbers (plus the admin API for the dashboard he builds after launch), covering players and returns, the first game, matches, and the free plan's health.

- **The email** (`worker/report.ts`) goes to `REPORT_EMAIL` at 8 am Lagos time (a second cron, `0 7 * * *`). It leads with one line (who played, how many were new, how many finished their first match), then:
  - **Players:** played yesterday and in the last 7 days, new players and how many saved their progress, and Duolingo's buckets (`docs/RETENTION.md`, section 2): current (also played in the 6 days before), first day, back after 7 to 29 days, back after 30 or more, and at risk (played in the 6 days before, not yesterday). Then **regulars who came back**, Duolingo's current user retention rate (CURR): of the day before's current players, the share who played again.
  - **The first game:** of yesterday's new players, how many finished their first match and how many won it; of players who played on their first day, how many came back the next day and on day 7.
  - **Matches:** finished matches by kind (Baba Ayo, Quick match, friends) and mode, the share against people that was staked and at which tables, and friend rooms made.
  - **Quick match:** joins from the list (and joins that missed), players who started a game and met a person (how long they waited, in buckets), and players who left before anyone came.
  - **Also:** phones with notifications on, streak reminders sent at 7 pm, and ban reviews waiting.
  - **The free plan:** yesterday's requests, Durable Object requests and database rows read and written, against the daily limits for the whole account (both copies share them). From half a limit the email warns at the top and in the subject, in red from 80%. These come from Cloudflare's GraphQL Analytics API with a read-only token (`CF_ACCOUNT_ID`, `CF_ANALYTICS_TOKEN`); without them the email leaves this part out and says how to turn it on.
  - The test copy's email says "Test copy" in the subject and header. Each copy only sends if it has `REPORT_EMAIL`.
- **What's recorded** (`migrations/0008_stats.sql`), with no extra request from any phone:
  - `player_days`: one row per player per Lagos day they finished a match, written with the match result (once a day per player). Kept 400 days, removed with the account. Players who had played before it existed got their last day played.
  - `players.first_result`: how their very first finished match went.
  - `stat_days`: daily counters with no player ids (`worker/stats.ts`): finished matches by kind, mode and stake (one counter per match), Quick match outcomes and waits (counted in the matchmaker), friend rooms made. A finished match adds one counter write, plus one row per player the first time they play each day, well inside the free plan.
- **"Played"** means finished a match, the way Duolingo counts a finished lesson. Opening the app without playing doesn't count.
- **Sent once:** the 8 am run marks the day as sent before sending, and clears the mark if Resend refuses, so a retried run never sends twice. The admin API can send it again on purpose.
- **Admin API:** `GET /api/admin/stats?day=`, the email as a page (`GET /api/admin/report`), and sending it now (`POST /api/admin/report`). See `docs/ADMIN-API.md`.
- **Cloudflare Web Analytics** (page views, countries, devices, page speed; no cookies) counts the real game only. Yves added the site on 16 October 2026; Cloudflare can't switch it on by itself for a Worker's address, so `src/lib/analytics.ts` adds Cloudflare's script (its token is public) when the page is on `daraxando.yveskwameh.com`, never on the test copy or locally, and never on a visit that opens with a sign-in link, whose address carries a secret. The Content Security Policy in `public/_headers` allows it, and the privacy notice covers it.
- **Privacy:** the days each player played are personal data tied to their player id. The privacy notice (milestone 7) should say the game keeps which days a player played, for up to 400 days, to count how the game is doing.
- Tested on 16 October 2026: 26 server checks with real Quick match pairings, joins, a walk-away, a Baba Ayo game and friend rooms (`api-stats`); unit tests for the email's rules and the free plan numbers against Cloudflare's answer shapes, failures included (`tests/report.test.ts`); the email at 600 and 375 px wide. The free plan part is checked against a stand-in for Cloudflare's API, so Yves's first email is its first real run.

### Playing Baba Ayo without internet (built 18 October 2026)

Yves asked for it on 17 October (`docs/NEXT-ROUND.md`, step 8). The lawyer approved its privacy notice lines on 18 October 2026 (step 6), so they're in `src/legal/privacy.md` and it's on everywhere. `OFFLINE_ON_REAL_GAME` in `shared/passes.ts` stays as a quick way to turn it off on the real game.

- **Passes.** `POST /api/offline/passes` keeps a player at 10 unused one-use passes, at most 10 new ones a day (Lagos time). A pass is a row in `offline_passes` (`migrations/0011_offline.sql`) with Baba Ayo's dice (a random seed). It starts a counted match for 7 days (`PASS_DAYS`), the server takes games for it for 10 (`PASS_KEEP_DAYS`), then deletes it. The phone keeps its passes in localStorage with the ids it has used, so a pass the server hasn't heard back about is never used twice.
- **The match on the phone.** `src/lib/localMatch.ts` plays the series with the server's own rules, Baba Ayo and his lines (`shared/rules.ts`, `shared/bot.ts`, `shared/baba.ts`), his dice from `diceFor(seed, game, move)` (`shared/offline.ts`), and gives the match screen the same view a server match does. No turn clock. Baba Ayo is O, the player X; the player opens game 1 and rematches swap, as online. Matches without a pass (none left, or never online yet) are just for fun and don't count.
- **Sending.** Each finished game, and the player leaving, goes into an IndexedDB outbox (`src/lib/offlineSync.ts`) and is sent with `POST /api/offline/game`, one game per request, in order: on opening the app, on coming back to it and when the connection returns. Background Sync isn't used (it needs a hand-written service worker); those three moments cover it.
- **Checking.** The server replays every move with the pass's dice (`playGame`). Measured on 18 October: under 0.5 ms a game for most, about 2 ms at worst (Fading against Agba), which is why it's one game per request: a whole Classic match can be seven games. Until the match is decided the server only notes how each game ended (`results`, X, O, D or R); the deciding game claims the pass in the same write that checks nobody else did, then records the match exactly like `Match.report` does for an online Baba Ayo match (`count` in `worker/offline.ts`, keep the two in step). The streak counts the day the match reaches the server, as agreed. A game that fails the replay uses the pass up. Answers: `saved`, `counted` (with the reward and profile), `duplicate`, `gone`, `refused`. Counted and refused matches are counted in `stat_days` (`offline:match`, `offline:refused`).
- **On the phone, for the privacy notice:** a copy of the player (`dara:me`) and of Ranks (`dara:ranks`) as last seen, the passes, and the games until they're sent. Signing out removes the copies.
- Tested: `tests/offline.test.ts` (dice, replay in every mode and level, changed moves, reused squares, extra moves, wrong dice, match scoring), 20 server checks against the dev server, a browser run that loses the connection, plays a whole match, reconnects and sees it count, opens the production build with no connection at all from the service worker's copy, and leaves a match part way.

### Privacy notice and terms (approved by the lawyer, 16 October 2026)

Dara X&O is Yves Kwameh's project, not a company (Yves, 16 October 2026). The drafts call it "we" ("the Dara X&O project") and name Yves as the person responsible, as the data law needs; the lawyer is asked about his personal exposure (`docs/LEGAL-REVIEW.md`, question 14). Contact hello@yveskwameh.com.

- **The words** are in `src/legal/privacy.md` and `src/legal/terms.md`, the one copy the lawyer reviews and players read. A small reader in `src/legal/Legal.tsx` shows them (headings, paragraphs, lists, bold, links; nothing else, so no HTML gets in). Both are dated ("Last updated 16 October 2026"); the "Draft" lines came off when the lawyer approved them, as drafted, the same day.
- **Accepting them** (Yves, 16 October 2026): tapping Play now (or Join the game) accepts the Terms of play, with the line under the button saying so and linking both texts. The app sends the version it showed (`TERMS_VERSION` in `shared/legal.ts`); the server refuses an old one and keeps the version and the time on the player (`migrations/0009_terms.sql`), visible in the admin API. Yves chose this over a tick box to keep the first screen one tap.
- **New terms** (built 18 October 2026, the first change: offline play and typed messages, approved by the lawyer the same day, with a new line under "Playing fair"). Both texts say "Last updated 18 October 2026", and `TERMS_VERSION` is `2026-10-18`, with what changed in plain words in `TERMS_CHANGES`. The profile carries `termsDue` (the player's accepted version isn't the current one). The app then shows "We updated our terms" (`src/screens/TermsUpdate.tsx`, loaded only when needed) instead of every screen, with what changed and both texts a tap away, until the player taps Accept and play. That posts the version to `POST /api/terms`, which refuses any version but the current one and records it and the time, as Play now does. The legal pages, sign-in links and the trip back from Google still open over it. A player without internet who hasn't accepted yet still sees it (their copy of the player says so), and Accept and play answers "You look offline. Check your connection and try again." Once accepted, the copy is updated, so offline play isn't blocked again.
- **Protecting Yves** (he asked for the strongest protection the law allows): no promises about the game, a list of things we aren't responsible for, a ₦5,000 cap on what we could owe, those limits covering the project, Yves and anyone who helps, players covering the costs of claims their breach causes, write first then mediation then the Nigerian courts, and passing the game on to a company later. All of it is question 15 for the lawyer. As a project, its legal duties stay with Yves, and the terms can't take away players' rights under Nigerian law.
- **Where players find them:** a page at `/privacy` and `/terms` that opens with or without a player (for outside links, Google's sign-in review and the lawyer); and a sheet over the screen from the first screen ("Read the Terms of play and the Privacy notice", under the age line, which itself is unchanged), Settings (Privacy notice and Terms of play rows) and the save sheet (under the email field). Reading them never loses your place. Loaded only when opened (6 KB).
- **What the notice covers,** from a full list of what the code keeps (16 October 2026): who's responsible, each kind of data with its reason and legal basis, what's on the phone (no cookies), what other players see, the services that handle data (Cloudflare, Google, Resend, push services), transfers outside Nigeria, how long each thing is kept, players' rights and how to use them, children, decisions made automatically, security and breaches (72 hours to the Commission).
- **Changed in the code so the notice is true:**
  - Cloudflare's invocation logs are off (`wrangler.jsonc`, `observability.logs.invocation_logs`). They recorded request addresses, and match sockets carry the login token in theirs. The game's own error lines still go to the logs, for 3 days.
  - Phones' error reports mask sign-in links in the address, as they already masked room codes (`src/main.tsx`).
  - The 8 am run deletes sign-in codes older than 2 days and finished Google sign-in steps every day (`worker/report.ts`), instead of only when someone asks for a code.
- **Settled by the approval** (`docs/LEGAL-REVIEW.md`): 13+ with a parent's or guardian's permission for under-18s, tapping Play now accepts the terms, the legal bases, data outside Nigeria, the admin log kept after deletion, taking back seeds won by cheating, the laws and courts of Nigeria, and the ₦5,000 cap. **Still for Yves:** whether he must register with the Nigeria Data Protection Commission and appoint a DPO, to confirm with the lawyer before the game passes 200 players in six months (`docs/LAUNCH.md`).
- **Known, accepted for now:** login tokens don't expire and signing out only clears the phone; the email sign-in step says when an address has no player; player ids are public and anyone can send a friend request to one. None is a privacy-notice problem, and each is a small change if the lawyer or Yves wants it.

## Accounts and keys

Everything here is free.

| What | Where it comes from | Cost | Where it lives |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Any long random string | Free | Already in `.dev.vars`; live, a secret on each Worker in the Cloudflare dashboard |
| Google sign-in client id | Google Cloud, project Dara X&O, client "Dara X&O web" | Free | A plain setting in `wrangler.jsonc` (it isn't secret) |
| `GOOGLE_CLIENT_SECRET` | The same Google client | Free | Secret, on each Worker. The app stays in Google's "Testing" mode (only listed test users) until the legal pages are approved and live: Google's review needs their addresses, `/privacy` and `/terms` (milestone 7) |
| `RESEND_API_KEY` | resend.com, sends the email codes. Domain `noreply.daraxando.yveskwameh.com`, verified 16 October 2026 | Free (3,000 a month, 100 a day) | Secret. Key `daraxando-staging` for the test copy, a separate key at launch |
| `EMAIL_FROM` | Who the sign-in codes and the 8 am email come from: `"Dara X&O" <admin@noreply.daraxando.yveskwameh.com>` (Yves, 17 October 2026; it was `code@`) | Free | A plain setting in `wrangler.jsonc`, one per copy. Change it there, not only in the dashboard, or the next build puts the old one back |
| `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` | Made once per copy with one command on Yves's Mac (README, "Secrets"). Never changed after players turn notifications on | Free | Both secrets, on each Worker (the public one isn't secret, but keeping the pair together is simpler) |
| `ADMIN_TOKEN` | `openssl rand -base64 32`, a different one per copy. Turns on the admin API (`docs/ADMIN-API.md`) | Free | Secret. Optional: without it the admin API is off |
| `REPORT_EMAIL` | Yves's email address, for the 8 am report. Up to 3, separated by commas | Free (1 of Resend's 100 emails a day per copy) | Secret, so the address stays off GitHub. Without it that copy sends no report |
| `CF_ACCOUNT_ID` and `CF_ANALYTICS_TOKEN` | The account id (in the dashboard's address), and an Account API token with only "Account Analytics: Read" | Free | Secrets. Optional: without them the report leaves out the free plan part |
| Workers Builds token | Made by Cloudflare when GitHub is connected; Yves adds "Account, D1, Edit" once so builds can update the database | Free (3,000 build minutes a month) | Cloudflare, Manage account, Account API Tokens |

Every new secret also gets a line in `.dev.vars.example`, a field in `worker/env.ts` and a row in the README's Secrets table.

## The domain

yveskwameh.com was bought on Hostinger and its nameservers point to Cloudflare, so Cloudflare runs its DNS. That's what a Worker's custom domain needs. Hostinger stays the registrar, so renewals happen there. Adding `daraxando` creates its own DNS record and touches nothing else on the domain. Check that Cloudflare shows the domain as **Active** (Cloudflare dashboard, Websites list), and that there is no existing record named `daraxando`.

Email codes send from `noreply.daraxando.yveskwameh.com` (Resend, Ireland). Its three DNS records (one TXT for DKIM, two CNAMEs for SPF, both DNS only) were added in Cloudflare and verified on 16 October 2026. They don't affect any email already on the domain. Open and click tracking are off in Resend, so the code link in the email stays as it is.

## Rules for this phase

- No emojis anywhere in the product: screens, notifications, emails, player names.
- Everything a player can do on a guest account keeps working with no sign-in. Signing in is never a wall in front of a game.
- Store the least: a chosen state, never a location; an email only if the player gives it; no phone numbers at launch.
