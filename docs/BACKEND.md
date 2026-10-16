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
| 5 | Notifications | Web Push, the opt-in moment, the two notifications, a Settings switch | Saves the notification keys as secrets |
| 6 | Knowing how it's doing | Game numbers (matches played, first match finished, Quick match wait times) | Turns on Cloudflare Web Analytics (one click) |
| 7 | Legal pages | Drafts the privacy notice and terms in plain words (Nigeria Data Protection Act 2023) | Gets the lawyer's approval |
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
- **Same address, same player.** A verified Google address that matches a player saved by email signs in to that player, and Google joins it. Typing an address that already has a player sends a sign-in code; the player's name only shows once the code is right.
- **Switching** to another player always asks first, and says plainly when the player on the phone isn't saved and will be left behind.
- **Limits** (Resend's free plan sends 100 emails a day): 3 codes a minute per phone and per address, 5 an hour per address, 90 a day in all. 20 code checks, links and Google sign-ins a minute per phone.
- **Delete my account** removes the player, how they sign in, their codes, ledger, league rows and friend streaks. Finished match rows stay, holding only a random id that now leads nowhere.
- **Sign out** is only offered to saved players, who can sign back in.
- Tested on 16 October 2026: 42 server checks (`api-auth`) and a browser run (`e2e-auth`) of every path, Google through a stand-in for Google's servers. The stand-in only works on a Mac copy (`GOOGLE_AUTH_URL` and `GOOGLE_TOKEN_URL`, ignored unless `ENVIRONMENT` is `local`).

### Safety (built 16 October 2026)

Yves's decisions on 16 October 2026: the same-phone rule; a one-way daily cap instead of a cap on how often two players can stake (friends who like staking with each other shouldn't be stopped); quick quits pay nothing; a ban stops online play only; the admin API now, the dashboard after launch. Seeds changes go to the lawyer first (`docs/SAFETY-REVIEW.md`), and the Nigerian-language words to the native speaker (`docs/NAMES-REVIEW.md`).

- **Names** (`worker/names.ts`): insults, slurs and sexual words in English, Pidgin, Yoruba, Igbo and Hausa, and names that pass for the game (Baba Ayo, Dara X&O, Admin, Support), checked whenever a name is set, by the player or the admin API. Look-alike spellings are caught (F U C K, fuuuck, b1tch, Ọlọ́ṣọ̀). Short words only count as whole words, so Bassey, Dickson, Shittu and Nazir pass.
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

## Accounts and keys

Everything here is free.

| What | Where it comes from | Cost | Where it lives |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Any long random string | Free | Already in `.dev.vars`; live, a secret on each Worker in the Cloudflare dashboard |
| Google sign-in client id | Google Cloud, project Dara X&O, client "Dara X&O web" | Free | A plain setting in `wrangler.jsonc` (it isn't secret) |
| `GOOGLE_CLIENT_SECRET` | The same Google client | Free | Secret, on each Worker. The app stays in Google's "Testing" mode (only listed test users) until the legal pages exist (milestone 7) |
| `RESEND_API_KEY` | resend.com, sends the email codes. Domain `noreply.daraxando.yveskwameh.com`, verified 16 October 2026 | Free (3,000 a month, 100 a day) | Secret. Key `daraxando-staging` for the test copy, a separate key at launch |
| `EMAIL_FROM` | Who the codes come from: `"Dara X&O" <code@noreply.daraxando.yveskwameh.com>` | Free | A plain setting in `wrangler.jsonc` |
| `VAPID_PRIVATE_KEY` and the public key | Generated with one command | Free | Private: secret. Public: plain setting |
| `ADMIN_TOKEN` | `openssl rand -base64 32`, a different one per copy. Turns on the admin API (`docs/ADMIN-API.md`) | Free | Secret. Optional: without it the admin API is off |
| Workers Builds token | Made by Cloudflare when GitHub is connected; Yves adds "Account, D1, Edit" once so builds can update the database | Free (3,000 build minutes a month) | Cloudflare, Manage account, Account API Tokens |

Every new secret also gets a line in `.dev.vars.example`, a field in `worker/env.ts` and a row in the README's Secrets table.

## The domain

yveskwameh.com was bought on Hostinger and its nameservers point to Cloudflare, so Cloudflare runs its DNS. That's what a Worker's custom domain needs. Hostinger stays the registrar, so renewals happen there. Adding `daraxando` creates its own DNS record and touches nothing else on the domain. Check that Cloudflare shows the domain as **Active** (Cloudflare dashboard, Websites list), and that there is no existing record named `daraxando`.

Email codes send from `noreply.daraxando.yveskwameh.com` (Resend, Ireland). Its three DNS records (one TXT for DKIM, two CNAMEs for SPF, both DNS only) were added in Cloudflare and verified on 16 October 2026. They don't affect any email already on the domain. Open and click tracking are off in Resend, so the code link in the email stays as it is.

## Rules for this phase

- No emojis anywhere in the product: screens, notifications, emails, player names.
- Everything a player can do on a guest account keeps working with no sign-in. Signing in is never a wall in front of a game.
- Store the least: a chosen state, never a location; an email only if the player gives it; no phone numbers at launch.
