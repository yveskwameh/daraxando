# Dara X&O

Tic tac toe for Nigerian players, the Naija way. Play people in your state, your zone or all of Nigeria, play a friend with a 5-letter code, or warm up against **Baba Ayo**, the game's bot. Four modes, 20 Nigerian titles from JJC to Idan, folktale avatars, Ankara prints, Dara Seeds to stake on matches, day streaks, weekly leagues and Ranks by state. It installs on a phone like an app, plays upright, and is built for cheap Android phones on mobile data.

A project by Yves Kwameh. Web addresses and handles spell the name out: `daraxando`.

- **Test copy:** https://daraxando-staging.yves-workers.workers.dev (updates on every push)
- **The real game:** https://daraxando.yveskwameh.com (set up at launch, `docs/LAUNCH.md`)

**Status, 16 October 2026:** the game and its server are built. The test copy is live. The lawyer and the native speaker have approved everything they were asked to check, including the privacy notice and terms. Next is the launch (`docs/LAUNCH.md`).

---

## 1. How we work

1. **Claude builds** in its own workspace, checks the change, and writes the changed files straight into your project folder. You never copy files by hand.
2. **You push** from VS Code (**Terminal → New Terminal**):
   ```sh
   git add -A
   git commit -m "A short note of what changed"
   git push
   ```
3. **Cloudflare rebuilds the test copy** by itself, in about 2 minutes. **Workers & Pages → daraxando-staging → Deployments** shows each build. A failed build changes nothing.
4. **You check it on your phone.** An installed app picks up the new version by itself the next time you leave it and come back (or tap **Reload** if it shows on Home).
5. **After launch, you publish** to players by merging `main` into the `production` branch on GitHub (`docs/LAUNCH.md`, "Publishing an update"). Nothing reaches players until you do.

Two rules: change files in your folder, never on github.com (a change made there isn't on your Mac, so your next push is refused), and never put a secret in a file (section 4).

## 2. Run it on your Mac

You need **Node 22 or newer** (`node -v`). If it's missing, install the LTS version from [nodejs.org](https://nodejs.org).

1. Open the project folder in VS Code, then **Terminal → New Terminal**.
2. Install the packages, once and whenever `package.json` changes: `npm install`
3. Start the game: `npm run dev`
4. Open **http://localhost:5173**.

That one command runs everything: the app with live reload, the game server and its database, inside Cloudflare's own runtime. To stop it, click the terminal and press **Ctrl + C**. To start again with no players, stop it and delete the `.wrangler` folder.

- **Two players on one computer:** a normal window and a private window are two different players.
- **On your phone:** same Wi-Fi as the Mac, then open the **Network** address `npm run dev` prints (like `http://192.168.1.2:5173`). If macOS asks whether Node can accept connections, click **Allow**.
- **On your Mac, sign-in codes** print in the terminal (`[sign-in code]`) instead of being emailed, and Google sign-in only works at `localhost:5173`.
- **Notifications and installing the app** need the real https copy: test them on the test copy.

## 3. The game

| Part | What it does | Where it lives |
| --- | --- | --- |
| **First visit** | One screen, one tap. The app picks a legend name, an animal and a best guess at your state; **Play now** starts a game against Baba Ayo straight away. The tap also accepts the Terms of play and confirms you're 13 or older; the server keeps which version of the terms each player accepted, and when. | `src/screens/Onboarding.tsx`, `shared/legal.ts` |
| **Modes** | Fading (the default), Classic, Big and Pro, from 3×3 to 7×7 | `shared/modes.ts`, `shared/rules.ts` |
| **Matches** | Each match runs on its own small server (a Match Durable Object) that checks every move, runs the clock and decides the winner. Leaving the app pauses the match; away for 60 seconds and the other player wins. | `worker/match.ts` |
| **Quick match and your own game** | Quick match shows games people are waiting in, and Join takes you straight in. Tapping a mode card starts your own game, searching your state, then your zone, then all of Nigeria, with Baba Ayo offered if nobody comes. | `worker/matchmaker.ts`, `src/sheets/LiveSheet.tsx` |
| **Friend rooms** | A 5-letter code and a share link. The host is told the moment their friend joins. | `src/sheets/FriendSheet.tsx`, `src/components/RoomWatch.tsx` |
| **Baba Ayo** | The bot, at three levels: Jeje, Sharp-sharp and Agba | `shared/bot.ts`, `worker/baba.ts` |
| **Aura, titles, collections** | Aura is progress; it sets your title (JJC to Idan), which unlocks avatars, prints and pieces | `shared/progression.ts`, `shared/collections.ts` |
| **Dara Seeds** | Points you stake on matches; the winner takes the pot. They can't be bought, sold, sent or cashed out. Rules against farming send both stakes back when they apply. | `docs/STAKES.md`, `shared/stakes.ts`, `worker/safety.ts` |
| **Daily habits** | Day streaks with Streak Freezes, daily quests, badges, friend streaks and weekly leagues, modelled on Duolingo | `shared/habits.ts`, `worker/habits.ts`, `docs/RETENTION.md` |
| **Save your progress** | Links Google or an email to a player, so you can sign in on any phone. Guests never have to. | `worker/accounts.ts`, `src/sheets/SaveSheet.tsx` |
| **Safety** | A name filter in five languages, bans (banned players watch Ranks from outside and can ask for a review), and the admin API | `worker/names.ts`, `worker/safety.ts`, `docs/ADMIN-API.md` |
| **Notifications** | Only if turned on: the 7 pm streak reminder and "friend joined your room", in Baba Ayo's Pidgin | `worker/push.ts`, `worker/notifier.ts` |
| **Game numbers** | An email to you at 8 am with yesterday's players, returns, first games, matches, Quick match waits and the free plan's use | `worker/report.ts`, `worker/stats.ts` |
| **Privacy notice and terms** | At `/privacy` and `/terms`, and in a sheet from the first screen, Settings and the save sheet | `src/legal/` |
| **Updates** | The installed app looks for a new version when opened and switches when the player leaves it, never mid-match | `src/lib/pwa.ts` |

The full reasoning behind each part is in `docs/BACKEND.md` and the docs listed in section 7.

## 4. Secrets

Secrets are the game's passwords. They never go in a file that goes to GitHub.

- **On your Mac:** `.dev.vars` in the project folder, one `NAME=value` per line. `.dev.vars.example` shows the names with empty or fake values.
- **On Cloudflare:** each copy keeps its own, encrypted. **Workers & Pages →** the Worker **→ Settings → Variables and Secrets → Add**, type **Secret**, then **Deploy**. Values can't be read back, only replaced. Keep a copy of each in your password manager.
- `/api/health` on a copy says which ones it has (`signIn`, `push`), never their values.

| Secret | What it's for | Where the value comes from |
| --- | --- | --- |
| `SESSION_SECRET` | Signs every player's login | `openssl rand -base64 32` in the terminal. A different one per copy. |
| `GOOGLE_CLIENT_SECRET` | Sign in with Google | Google Cloud, project **Dara X&O → Google Auth Platform → Clients → Dara X&O web**. The same for both copies. |
| `RESEND_API_KEY` | Sign-in code emails and the 8 am report | resend.com → **API Keys**. One per copy (`daraxando-staging`, `daraxando-production`), with **Sending access** to `noreply.daraxando.yveskwameh.com`. |
| `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` | Notifications | `node scripts/vapid-keys.mjs` prints both. A different pair per copy, made once. **Never change a pair after players turn notifications on.** |
| `REPORT_EMAIL` | Who gets the 8 am email | Your email address (up to 3, separated by commas). Without it, that copy sends none. |
| `CF_ACCOUNT_ID` and `CF_ANALYTICS_TOKEN` | Optional. The free plan part of the 8 am email | The 32 characters after `dash.cloudflare.com/` in the address bar, and an Account API token with only **Account Analytics: Read** (`docs/LAUNCH.md`, step 7). |
| `ADMIN_TOKEN` | Optional. Turns on the admin API | `openssl rand -base64 32`, at least 32 characters. A different one per copy. |

Settings that aren't secret (the database ids, the Google client id, the email sender) are in `wrangler.jsonc`, and `worker/env.ts` lists everything the server reads.

## 5. Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the whole game on your Mac with live reload |
| `npm run typecheck` | Checks the TypeScript across the app and the server |
| `npm test` | Checks the rules of every mode, Baba Ayo, stakes, safety, notifications and the 8 am report |
| `npm run build` | Makes the production build and shows the download size |
| `npm run preview` | Serves the production build on port 4173 |
| `node scripts/vapid-keys.mjs` | Prints a new pair of notification keys. Saves nothing. |
| `node scripts/icons.cjs` | Redraws the app icons from the Sticker logo |
| `node scripts/loadtest.mjs` | A small load test of the test copy: 30 players playing at once (`docs/LAUNCH.md`). Never against the real game. |
| `npm run release` | Cloudflare runs this after each build: database changes, then the upload. Not for your Mac. |

**Before any change is called done:** `npm run typecheck && npm test && npm run build`, a look at the changed screens at 320, 360 and 390 px wide, and, for changes to seeds, stakes or sign-in, the server checks for that area. The full regression run (about 20 browser and server scripts) happens once, before the launch (Yves, 16 October 2026).

## 6. The two copies on Cloudflare

Everything runs on Cloudflare's free plan, at $0 (`docs/STACK.md`, `docs/BACKEND.md`). Cloudflare takes the code from GitHub, never from your Mac: it builds (`npm run build`), then `npm run release` adds any new tables from `migrations/` to that copy's database and uploads the game. If the database step fails, nothing is uploaded.

| | Test copy | The real game |
| --- | --- | --- |
| Worker | `daraxando-staging` | `daraxando` |
| Address | daraxando-staging.yves-workers.workers.dev | daraxando.yveskwameh.com |
| Database | `daraxando-staging` (Western Europe) | `daraxando` (Western Europe) |
| Builds from | every push to `main` | the `production` branch |
| Its 8 am email says | "Test copy" | nothing extra |

**Free plan limits** (per account, both copies together, reset at 1 am Lagos time): 100,000 requests a day, 10 ms of processing per request, 5 million database rows read and 100,000 written a day, 5 schedules (each copy uses 2). Over a limit, players see "Dara X&O is resting" until the reset. The 8 am email warns from half a limit.

Setting up a copy from scratch, step by step, is in `docs/LAUNCH.md`.

## 7. Where things are

```
src/                 The app players see
  screens/           One file per screen: Onboarding, Home, Search, Game, Ranks, Profile, Account
  sheets/            Bottom sheets: stake, wallet, play a friend, Baba Ayo, result, save, ban
  components/        Sheet, art, the asks and pop-ups, links to the legal pages
  legal/             privacy.md and terms.md (the approved texts) and their reader
  art/               sprite.svg (every icon, piece and avatar) and prints.ts (Ankara prints)
  lib/               Session, routing, sockets, storage, sound, haptics, notifications, updates
  styles/            tokens.css (every colour, size and timing) and app.css
shared/              Used by both sides: rules, modes, Baba Ayo, progression, stakes, habits,
                     places, notifications copy, the terms version, message types
worker/              The server: routes, Match, Matchmaker, Notifier, accounts, safety, admin,
                     push, report and stats, database queries
migrations/          Database tables, one file per change
tests/               Unit tests
public/              Icons, the notification service worker code, email pictures, headers
scripts/             Icons, notification keys, the release step
```

| Doc | What's in it |
| --- | --- |
| `CLAUDE.md` | Every decision so far, and the rules for working on the project. Claude reads it first. |
| `DESIGN.md` | Colours, type, spacing, buttons and every component |
| `docs/LAUNCH.md` | The launch checklist: setting up the real copy, launch day, the first week |
| `docs/BACKEND.md` | The backend plan and how each part was built: milestones, decisions, keys |
| `docs/ADMIN-API.md` | The admin API: every request, game numbers, notifications, keeping the key safe |
| `docs/STACK.md` | Why this stack and what it costs as players grow |
| `docs/STAKES.md` | Dara Seeds and the rules that keep it a game, not gambling |
| `docs/RETENTION.md` | Research modelled on Duolingo: the first game and bringing players back |
| `docs/MATCHMAKING.md`, `docs/GAME-MODES.md` | Matching by state and zone, and the four modes |
| `docs/CULTURE.md` | Prints, pieces, avatars, titles, the game's voice and vetted words |
| `docs/PHONE-FEATURES.md` | Installing, updates, notifications, portrait only, sound, haptics |
| `docs/COWRIES-REVIEW.md`, `docs/SAFETY-REVIEW.md`, `docs/LEGAL-REVIEW.md` | What the lawyer approved: seeds and streaks, safety, the privacy notice and terms |
| `docs/NAMES-REVIEW.md` | The words the name filter blocks, approved by the native speaker |
| `docs/prototype.html`, `docs/logos.html` | The approved redesign and the logo options (open in a browser) |

## 8. Approvals

- **15 October 2026:** the native speaker approved every Yoruba, Igbo and Hausa word and the 20 titles. The lawyer approved Dara Seeds, the streak items and the one-tap age confirmation (`docs/COWRIES-REVIEW.md`).
- **16 October 2026:** the lawyer approved the safety rules (`docs/SAFETY-REVIEW.md`) and the privacy notice and terms (`docs/LEGAL-REVIEW.md`). The native speaker approved the name filter's words (`docs/NAMES-REVIEW.md`).

Any change to how seeds work, to the age line or to the legal texts goes back to the lawyer first. Any new Yoruba, Igbo or Hausa word goes to the native speaker.

## 9. If something goes wrong

| Problem | Fix |
| --- | --- |
| The phone can't open the Network address | Same Wi-Fi on both? Allow Node in the Mac's firewall: **System Settings → Network → Firewall**. |
| "Port 5173 is in use" | Another `npm run dev` is still running. Close that terminal, or press Ctrl + C in it. |
| The page loads forever after updating packages | Stop the dev server, delete `node_modules/.vite`, and run `npm run dev` again. |
| "no such column" after new code | Stop `npm run dev` and start it again. It adds new database changes as it starts. |
| A push is refused | Someone changed GitHub directly. Run `git pull`, then push again. |
| A build fails on Cloudflare | Open the build in **Deployments** and send Claude the red lines. The copy players see doesn't change. |
| Google says "redirect_uri_mismatch" | Google only knows the test copy, the real game and `http://localhost:5173`. On your Mac, use `localhost:5173`. |
| "Google sign-in isn't set up on this copy yet" | That copy has no `GOOGLE_CLIENT_SECRET` (section 4). |
| No sign-in email arrives | On your Mac, the code is in the terminal. Otherwise check Spam, then Resend's **Emails** page. |
| Notifications don't arrive | `/api/health` shows `"push":false` if the copy has no notification keys. iPhone needs the installed app. On Android, allow notifications for Chrome or the installed app in the phone's settings. |
| "Notifications are blocked" in Settings | The phone's box was answered Block. In Chrome, tap the icon left of the address, **Permissions → Notifications → Allow**. |
| No 8 am email | The copy needs `REPORT_EMAIL` and `RESEND_API_KEY`. Check Spam. To send one now: `POST /api/admin/report` (`docs/ADMIN-API.md`). |
| The email says "Couldn't read" under Free plan | The analytics token is wrong or missing its permission, or `CF_ACCOUNT_ID` isn't the 32-character id. Replace them (`docs/LAUNCH.md`, step 7). |
| "The terms have changed. Close the app…" on the first screen | That phone has an older version of the app. Closing and opening it again loads the new one. |
| A name you expect to work is refused | The filter is `worker/names.ts`. Add the name to `tests/safety.test.ts` and ask Claude to adjust the list. |
| The admin API answers 404 | That copy has no `ADMIN_TOKEN`, or it's shorter than 32 characters. |
| Players see "Dara X&O is resting" | The free plan's daily requests ran out. It comes back at 1 am Lagos time. Tell Claude if it happens: the 8 am emails show the trend. |
