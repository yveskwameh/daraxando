# Operations

How Dara X&O is worked on, deployed and kept running. This used to be the top of the README; it moved here when the repo went public.

## 1. How we work

Claude builds in its own workspace, checks the change, and writes the changed files straight into the project folder. Nobody copies files by hand.

Push from VS Code (Terminal → New Terminal):

```sh
git add -A
git commit -m "A short note of what changed"
git push
```

Cloudflare rebuilds the test copy by itself, in about 2 minutes. Workers & Pages → daraxando-staging → Deployments shows each build. A failed build changes nothing.

Check it on a phone. An installed app picks up the new version by itself the next time you leave it and come back (or tap Reload if it shows on Home).

To publish to players, merge `main` into the `production` branch on GitHub (docs/LAUNCH.md, "Publishing an update"). Nothing reaches players until you do.

Two rules: change files in your folder, never on github.com (a change made there isn't on your Mac, so your next push is refused), and never put a secret in a file (section 3).

## 2. Running it on your Mac

You need Node 22 or newer (`node -v`). If it's missing, install the LTS version from nodejs.org.

1. Open the project folder in VS Code, then Terminal → New Terminal.
2. Install the packages, once and whenever package.json changes: `npm install`
3. Start the game: `npm run dev`
4. Open http://localhost:5173.

That one command runs everything: the app with live reload, the game server and its database, inside Cloudflare's own runtime. To stop it, click the terminal and press Ctrl + C. To start again with no players, stop it and delete the `.wrangler` folder.

- Two players on one computer: a normal window and a private window are two different players.
- On your phone: same Wi-Fi as the Mac, then open the Network address `npm run dev` prints (like http://192.168.1.2:5173). If macOS asks whether Node can accept connections, click Allow.
- On your Mac, sign-in codes print in the terminal (`[sign-in code]`) instead of being emailed, and Google sign-in only works at localhost:5173.
- Notifications and installing the app need the real https copy: test them on the test copy.

## 3. Secrets

Secrets are the game's passwords. They never go in a file that goes to GitHub.

- On your Mac: `.dev.vars` in the project folder, one `NAME=value` per line. `.dev.vars.example` shows the names with empty or fake values.
- On Cloudflare: each copy keeps its own, encrypted. Workers & Pages → the Worker → Settings → Variables and Secrets → Add, type Secret, then Deploy. Values can't be read back, only replaced. Keep a copy of each in your password manager.
- `/api/health` on a copy says which ones it has (signIn, push), never their values.

| Secret | What it's for | Where the value comes from |
| --- | --- | --- |
| `SESSION_SECRET` | Signs every player's login | `openssl rand -base64 32` in the terminal. A different one per copy. |
| `GOOGLE_CLIENT_SECRET` | Sign in with Google | Google Cloud, project Dara X&O → Google Auth Platform → Clients → Dara X&O web. The same for both copies. |
| `RESEND_API_KEY` | Sign-in code emails and the 8 am report | resend.com → API Keys. One per copy (daraxando-staging, daraxando-production), with Sending access to noreply.daraxando.yveskwameh.com. |
| `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` | Notifications | `node scripts/vapid-keys.mjs` prints both. A different pair per copy, made once. Never change a pair after players turn notifications on. |
| `REPORT_EMAIL` | Who gets the 8 am email | Your email address (up to 3, separated by commas). Without it, that copy sends none. |
| `CF_ACCOUNT_ID` and `CF_ANALYTICS_TOKEN` | Optional. The free plan part of the 8 am email | The 32 characters after dash.cloudflare.com/ in the address bar, and an Account API token with only Account Analytics: Read (docs/LAUNCH.md, step 7). |
| `ADMIN_TOKEN` | Optional. Turns on the admin API | `openssl rand -base64 32`, at least 32 characters. A different one per copy. |

Settings that aren't secret (the database ids, the Google client id, the email sender) are in `wrangler.jsonc`, and `worker/env.ts` lists everything the server reads.

## 4. More commands

| Command | What it does |
| --- | --- |
| `node scripts/vapid-keys.mjs` | Prints a new pair of notification keys. Saves nothing. |
| `node scripts/icons.cjs` | Redraws the app icons from the Sticker logo |
| `node scripts/loadtest.mjs` | A small load test of the test copy: 30 players playing at once (docs/LAUNCH.md). Never against the real game. |
| `npm run release` | Cloudflare runs this after each build: database changes, then the upload. Not for your Mac. |

Before any change is called done: `npm run typecheck && npm test && npm run build`, a look at the changed screens at 320, 360 and 390 px wide, and, for changes to seeds, stakes or sign-in, the server checks for that area.

## 5. The two copies on Cloudflare

Everything runs on Cloudflare's free plan, at $0 (docs/STACK.md, docs/BACKEND.md). Cloudflare takes the code from GitHub, never from your Mac: it builds (`npm run build`), then `npm run release` adds any new tables from `migrations/` to that copy's database and uploads the game. If the database step fails, nothing is uploaded.

| | Test copy | The real game |
| --- | --- | --- |
| Worker | daraxando-staging | daraxando |
| Address | daraxando-staging.yves-workers.workers.dev | daraxando.yveskwameh.com |
| Database | daraxando-staging (Western Europe) | daraxando (Western Europe) |
| Builds from | every push to `main` | the `production` branch |
| Its 8 am email says | "Test copy" | nothing extra |

Free plan limits (per account, both copies together, reset at 1 am Lagos time): 100,000 requests a day, 10 ms of processing per request, 5 million database rows read and 100,000 written a day, 5 schedules (each copy uses 2). Over a limit, players see "Dara X&O is resting" until the reset. The 8 am email warns from half a limit. Every request has a limit inside the Worker (`wrangler.jsonc`, "ratelimits", and `worker/flood.ts` for messages in a live connection), but only Cloudflare's rate limiting rule in front of the Worker keeps a flood from using up the day's requests (docs/LAUNCH.md, step 11).

Setting up a copy from scratch, step by step, is in docs/LAUNCH.md.

## 6. Approvals

- 15 October 2026: the native speaker approved every Yoruba, Igbo and Hausa word and the 20 titles. The lawyer approved Dara Seeds, the streak items and the one-tap age confirmation (docs/COWRIES-REVIEW.md).
- 16 October 2026: the lawyer approved the safety rules (docs/SAFETY-REVIEW.md) and the privacy notice and terms (docs/LEGAL-REVIEW.md). The native speaker approved the name filter's words (docs/NAMES-REVIEW.md).
- 18 October 2026: the lawyer approved the privacy notice lines for offline play and typed messages, and a new terms line on messages (docs/CHAT-REVIEW.md, docs/NEXT-ROUND.md step 6).

Any change to how seeds work, to the age line or to the legal texts goes back to the lawyer first. Any new Yoruba, Igbo or Hausa word goes to the native speaker.

## 7. If something goes wrong

| Problem | Fix |
| --- | --- |
| The phone can't open the Network address | Same Wi-Fi on both? Allow Node in the Mac's firewall: System Settings → Network → Firewall. |
| "Port 5173 is in use" | Another `npm run dev` is still running. Close that terminal, or press Ctrl + C in it. |
| The page loads forever after updating packages | Stop the dev server, delete `node_modules/.vite`, and run `npm run dev` again. |
| "no such column" after new code | Stop `npm run dev` and start it again. It adds new database changes as it starts. |
| A push is refused | Someone changed GitHub directly. Run `git pull`, then push again. |
| A build fails on Cloudflare | Open the build in Deployments and send Claude the red lines. The copy players see doesn't change. |
| Google says "redirect_uri_mismatch" | Google only knows the test copy, the real game and http://localhost:5173. On your Mac, use localhost:5173. |
| "Google sign-in isn't set up on this copy yet" | That copy has no `GOOGLE_CLIENT_SECRET` (section 3). |
| "Google sign-in isn't working right now. Use your email." | Google refused that copy's `GOOGLE_CLIENT_SECRET`: it's wrong or has a space at either end. Workers & Pages → that Worker → Logs shows `[google] 401 invalid_client`. Paste the secret again (section 3); both copies use the same one. |
| No sign-in email arrives | On your Mac, the code is in the terminal. Otherwise check Spam, then Resend's Emails page. |
| Notifications don't arrive | `/api/health` shows `"push":false` if the copy has no notification keys. iPhone needs the installed app. On Android, allow notifications for Chrome or the installed app in the phone's settings. |
| "Notifications are blocked" in Settings | The phone's box was answered Block. In Chrome, tap the icon left of the address, Permissions → Notifications → Allow. |
| No 8 am email | The copy needs `REPORT_EMAIL` and `RESEND_API_KEY`. Check Spam. To send one now: `POST /api/admin/report` (docs/ADMIN-API.md). |
| The email says "Couldn't read" under Free plan | The analytics token is wrong or missing its permission, or `CF_ACCOUNT_ID` isn't the 32-character id. Replace them (docs/LAUNCH.md, step 7). |
| "The terms have changed. Close the app…" on the first screen | That phone has an older version of the app. Closing and opening it again loads the new one. |
| A name you expect to work is refused | The filter is `worker/names.ts`. Add the name to `tests/safety.test.ts` and ask Claude to adjust the list. |
| The admin API answers 404 | That copy has no `ADMIN_TOKEN`, or it's shorter than 32 characters. |
| Players see "Dara X&O is resting" | The free plan's daily requests ran out. It comes back at 1 am Lagos time. Tell Claude if it happens: the 8 am emails show the trend. |
