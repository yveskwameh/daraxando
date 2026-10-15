# Dara X&O

Tic tac toe for Nigerian players, the Naija way. Play people in your state, your zone or all of Nigeria, play a friend with a 5-letter code, or warm up against **Baba Ayo**, the game's bot. Four modes (Fading, the default, then Classic, Big and Pro), Aura and 20 Nigerian titles (JJC to Idan) that unlock folktale avatars, prints and pieces, **Dara Seeds** to stake on matches, day streaks, and Ranks by state.

It installs on a phone like an app, plays upright, and is built to run smoothly on cheap Android phones on mobile data.

**Status:** the frontend is complete and runs locally with a real game server. The language check and the legal opinion on Dara Seeds are approved. Nothing is deployed yet.

Web addresses and handles spell the name out: `daraxando`.

---

## 1. Run it on your Mac

You need **Node 22 or newer**. Check with `node -v`. If it's missing or older, install it from [nodejs.org](https://nodejs.org) (the LTS button).

1. Open **Terminal** and go to the project folder:
   ```sh
   cd ~/Documents/Porjects/tic_tac_toe-game
   ```
2. Install the packages. Do this once, and again whenever `package.json` changes:
   ```sh
   npm install
   ```
3. Start the game:
   ```sh
   npm run dev
   ```
4. Open **http://localhost:5173** in your browser.

That one command runs everything: the app with live reload, the game server, and the database, inside Cloudflare's real runtime. No Cloudflare account is needed. To stop it, click the Terminal window and press **Ctrl + C**.

## 2. Test it

### Two players on one computer

Open http://localhost:5173 in a normal window and in a private window. Each window is a different player. On the first screen, tap **Change** and pick the same state in both, then tap **Play now** (your first game is against Baba Ayo). Back on Home, in the first window tap a card on the Deck, pick a stake and wait. In the second window tap **Quick match**: it shows the first window's game, and **Join** starts the match.

### On your phone

1. Make sure your phone is on the same Wi-Fi as your Mac.
2. When `npm run dev` starts, it prints a **Network** address, such as `http://192.168.1.2:5173`. Open that on your phone.
3. The first time, macOS may ask whether Node can accept incoming connections. Click **Allow**.

If the phone can't load the page, open **System Settings → Network → Firewall** on the Mac and allow Node.

### Installing the app on your phone

Chrome only installs web apps from secure (https) addresses, and only the built version has the install files. Until the game is live on https, use this:

1. On the Mac, stop the dev server and run `npm run preview`. It builds the app and prints a Network address ending in `:4173`.
2. On your phone, open Chrome and go to `chrome://flags`.
3. Search for **Insecure origins treated as secure**, type the address from step 1 into its box, and set it to **Enabled**.
4. Tap **Relaunch**.
5. Open the address in Chrome, then tap **⋮ → Install app**.
6. When you're done testing, set the flag back to **Default**.

Once the game is live on its own https address, installing works normally with no flag.

## 3. Put it on GitHub

Everything goes to GitHub except files that are rebuilt on every machine or private: `node_modules`, `dist`, `.wrangler` (your local test database), your secret `.dev.vars`, `.DS_Store` and `_to_delete`. The `.gitignore` file takes care of that.

**The first time**, in the VS Code terminal (**Terminal → New Terminal**):

1. On github.com, click **+** then **New repository**. Name it `daraxando`, choose **Private**, leave README, .gitignore and license off, and click **Create repository**. Copy the **HTTPS** address.
2. In the terminal, check you're in the project (`pwd` ends in `/Porjects/tic_tac_toe-game`), then:
   ```sh
   git init -b main
   git add .
   git status
   git commit -m "Dara X&O: the game"
   git remote add origin https://github.com/YOUR-NAME/daraxando.git
   git push -u origin main
   ```
3. If VS Code asks to sign in with GitHub, click **Allow**, then **Authorize** in the browser.
4. Open the repository's **Actions** tab. A check runs on every push (types, tests, build) and should turn green in about 3 minutes.

**After that**, whenever the folder has new changes:

```sh
git add .
git commit -m "A short note of what changed"
git push
```

Make changes in your folder, never by editing files on github.com. A change made on the website isn't on your Mac, so your next push would be refused.

## Secrets

Secrets are passwords for the game's server, like the key that signs each player's login. They never go on GitHub.

| Where | What | How to change it |
| --- | --- | --- |
| `.dev.vars` (project folder) | Secrets for the game on your Mac (`npm run dev`). Today just `SESSION_SECRET`. | Open it in VS Code, one `NAME=value` per line. |
| `.dev.vars.example` (on GitHub) | The same names with fake values, so you know what `.dev.vars` needs. No real values, ever. | Add a line whenever a new secret is added. |
| Cloudflare (live game) | The real secrets for the live game, stored encrypted by Cloudflare, not in any file. Each copy has its own. | Cloudflare dashboard → **Workers & Pages** → **daraxando-staging** or **daraxando** → **Settings** → **Variables and Secrets** → **Add**, type **Secret**. Values can't be read back, only replaced. |

`wrangler.jsonc` and `worker/env.ts` list every setting the server uses, but hold no secret values. The database id in `wrangler.jsonc` isn't secret.

## 4. Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the whole game locally with live reload |
| `npm run preview` | Builds the real version and serves it on port 4173 (for install and offline tests) |
| `npm test` | Checks the rules of every mode, Baba Ayo, Aura, rating, stakes and matchmaking |
| `npm run typecheck` | Checks the TypeScript across the app and the server |
| `npm run build` | Makes the production build in `dist/` and shows the download size |
| `node scripts/icons.cjs` | Redraws the app icons from the Sticker logo |
| `npm run release` | Cloudflare runs this after each build from GitHub: database changes, then the upload. Not for your Mac (section 8). |

**Before calling any change done:** `npm run typecheck && npm test && npm run build`, then look at it at 390 and 360 px wide and in landscape.

**Start over with no players:** stop the dev server and delete the `.wrangler` folder. The next `npm run dev` creates a fresh database.

## 5. How the game works

**Players.** A first visit is one screen: the app picks a legend name, an animal and a best guess at your state, and **Play now** starts a game against Baba Ayo straight away. Tapping it also confirms you're 13 or older. Players are guest accounts kept in the browser; signing in to keep progress across phones comes in the backend phase.

**Your own game and Quick match.** Tapping a card on the Deck starts your own game: you pick a stake and the **Matchmaker** looks for someone at the same table, your state first, widening every 4 seconds to your zone, all of Nigeria, then anyone, picking the closest rating. If nobody is around, it offers Baba Ayo, or a busier table with players waiting. **Quick match** does the opposite: it shows games other players are waiting in, one at a time, and **Join** takes you straight into one at the stake its starter picked. With nobody waiting, it keeps looking and shows how many other people are looking right now; you start your own game when you're ready, change the game or stake, or play Baba Ayo.

**The first match** is one game against Baba Ayo, not a series. Lose or draw and you play one more; win and you're through to Home.

**A match.** Each match runs in its own small server (a **Match** Durable Object). It checks every move, runs the turn clock and the series (best of 5 in Classic), and decides the winner. The browser only shows what the server says. Leaving the app pauses the match; away for more than 60 seconds and the other player wins. Between games, the next one starts when both players tap **Next game**.

**Friend rooms.** A 5-letter code (tap it to copy) and a share link. The person who made the room hosts one room at a time, and the app tells them the moment their friend joins, wherever they are in it. On the invite sheet, the friend's card shows up with **Start the game**.

**Stakes.** Dara Seeds are points, never money: they can't be bought, sold, sent or cashed out. Stakes are taken when a match starts and paid to the winner when it ends; a draw or a called-off match gives them back. Every change is written to the `ledger` table.

**Rewards.** When a match ends, Aura, rating, wins, the daily goal, the daily seeds and the pot are saved to the **D1** database in one go, and each player gets their reward back.

**Daily habits** (modelled on Duolingo, see `docs/RETENTION.md`):
- The day streak, with Streak Freezes, restores and the streak stake.
- Daily quests, badges, and friend streaks.
- A weekly league with promotion and demotion.

The rules are in `shared/habits.ts` and the server side in `worker/habits.ts`. After each match it updates everything at once and retries if two matches finish together.

## 6. Where things are

```
src/                 The app players see
  screens/           One file per screen: Onboarding, Home, Search, Game, Ranks, Profile
  sheets/            Bottom sheets: stake, wallet, play a friend, Baba Ayo, result, install
  components/        Art, Sheet, DemoBoard, VsSplash, StatePicker, InstallPop, RoomWatch
  art/               sprite.svg (every icon, piece and avatar) and prints.ts (Ankara prints)
  lib/               Session, routing, match and lobby sockets, hosted room, sound, haptics
  styles/            tokens.css (every colour, size and timing) and app.css
shared/              Used by both sides: rules for every mode, Baba Ayo, Aura and rating,
                     stakes, matching, habits (streak, quests, badges, leagues), states and
                     zones, collections, message types
worker/              The server: API routes, Match and Matchmaker, database queries, habits,
                     Baba Ayo's lines
migrations/          Database tables
tests/               Unit tests
public/              App icons and Cloudflare headers
scripts/             icons.cjs draws the app icons
.github/workflows/   The GitHub check that runs on every push
```

### The docs

| File | What's in it |
| --- | --- |
| `CLAUDE.md` | Every decision so far, and the rules for working on the project. Claude Code reads it first. |
| `DESIGN.md` | Colours, type, buttons, components and how screens are laid out |
| `docs/STACK.md` | Why this stack, what it costs as players grow, what else was considered |
| `docs/MATCHMAKING.md` | Matching by state and zone, and Ranks |
| `docs/GAME-MODES.md` | The four modes, series, rematches and session length |
| `docs/CULTURE.md` | Prints, pieces, avatars, the game's voice, the name |
| `docs/PHONE-FEATURES.md` | Installing, portrait only, sound, haptics, phone limits |
| `docs/STAKES.md` | Dara Seeds, the pot, and the rules that keep it a game and not gambling |
| `docs/COWRIES-REVIEW.md` | The streak and age changes the lawyer approved (written before Dara Cowries became Dara Seeds) |
| `docs/BACKEND.md` | The backend and launch plan: decisions, milestones, who does what, keys and the domain |
| `docs/RETENTION.md` | Research modelled on Duolingo: getting players into a game fast, what brings them back, and what was built |
| `docs/prototype.html` | The approved redesign as a clickable prototype (open it in a browser) |
| `docs/logos.html` | Logo options. Option 3, the Sticker, was chosen |

## 7. Roadmap

1. **Frontend: done.** Every screen, state and animation, tested locally with real matches. Signed off 15 October 2026.
2. **Backend: now.** Sign-in to keep progress across phones, name filtering, stronger checks at high stakes, privacy-friendly analytics, and push notifications (streak reminders, "your friend joined your room"). The plan is `docs/BACKEND.md`.
3. **Launch.** Cloudflare account, live database, secrets, domain, and deploys from GitHub.

Approved on 15 October 2026: the native-speaker check of every Yoruba, Igbo and Hausa word and the 20 titles, and the lawyer's opinion on Dara Seeds, including the streak items and the one-tap age confirmation (`docs/COWRIES-REVIEW.md`). Any change to how seeds work, or to the age confirmation on the first screen, goes back to the lawyer first.

## 8. Going live

Yves publishes; nothing is deployed for him. It all runs on free plans (`docs/BACKEND.md`). There are two copies of the game on Cloudflare, each a **Worker** with its own database:

- **daraxando-staging**, the test copy, on a free `workers.dev` address. It updates by itself every time you push to the `main` branch on GitHub.
- **daraxando**, the real game at **daraxando.yveskwameh.com**. It updates only when you merge `main` into the `production` branch on GitHub, so nothing reaches players until you say so. This one is set up at launch.

Cloudflare takes the code from GitHub, never from your Mac. On every push it builds the game (`npm run build`), then runs `npm run release`, which adds any new tables from `migrations/` to that copy's database and then uploads the game. If the database step fails, nothing is uploaded. Free plan: 3,000 build minutes a month, and one build takes about 2.

**Set up the test copy, once.** Everything happens in the Cloudflare dashboard (dash.cloudflare.com) except two short steps in the VS Code terminal (**Terminal → New Terminal**, in the project folder).

1. **Make the database.** In the left sidebar, open **Storage & databases → D1 SQL database** (or type `D1` in the search box at the top). Click **Create Database**. Name it `daraxando-staging`. If it asks for a location, pick **Western Europe**, the closest to Nigeria. Click **Create**. On the database's page, copy the **Database ID**.
2. **Put the id in the settings.** In VS Code, press **Cmd+P**, type `wrangler.jsonc`, press **Enter**. Press **Cmd+Option+F** to open Find and Replace. Type `STAGING_DATABASE_ID` in the first box, paste the Database ID in the second, click **Replace All**, then **Cmd+S**. The id isn't secret.
3. **Push it.** In the terminal: `git add -A`, then `git commit -m "Staging database"`, then `git push`.
4. **Connect GitHub.** Back in Cloudflare, open **Workers & Pages** (sidebar, or search). Click **Create application**, then **Get started** next to **Import a repository**. Choose GitHub. If GitHub opens, pick **Only select repositories**, choose `daraxando`, and click **Install & Authorize**. Back in Cloudflare, select the `daraxando` repository.
5. **Fill in the build settings** exactly:
   - Project name: `daraxando-staging` (it must match `wrangler.jsonc`, or the build fails)
   - Build command: `npm run build`
   - Deploy command: `npm run release`
   - Under **Advanced settings**, **Build variables**, add `CLOUDFLARE_ENV` with the value `staging`
   - Leave everything else as it is, and click **Deploy**.
6. **Let the build reach the database.** The first build stops at the database step with an "Authentication error", because the key Cloudflare made for builds can't touch databases yet. In the sidebar, open **Manage account → Account API Tokens**. Find the token named **Workers Builds** followed by today's date, open its menu (**...**) and click **Edit**. Under **Permissions**, click **Add more** and set the new row to **Account**, **D1**, **Edit**. Click **Continue to summary**, then **Update token**.
7. **Build again.** Open **Workers & Pages → daraxando-staging → Deployments**, open the failed build and click **Retry build**. If there's no such button, run `git commit --allow-empty -m "Build staging again"` and `git push` in the terminal. Wait for the build to turn green (about 2 minutes).
8. **Add the secret.** In the terminal, run `openssl rand -base64 32` and copy the line it prints. In Cloudflare, open **daraxando-staging → Settings → Variables and Secrets** and click **Add**. Type: **Secret**. Variable name: `SESSION_SECRET`. Value: paste. Click **Deploy**. Keep this value to yourself; it's different from the one in `.dev.vars`.
9. **Only build `main`.** Still in **Settings**, find **Build → Branch control**. Check the production branch is `main`, and turn off builds for other branches (it saves build minutes). Save.
10. **Play it.** The Worker's **Overview** shows its address, like `daraxando-staging.<your-name>.workers.dev`. Open it on your phone and play Baba Ayo, then a friend room between your phone and laptop. Adding `/api/health` to the address should show `"env":"staging"`.

**Every update after that:** commit and push from VS Code (section 3). Cloudflare rebuilds the test copy by itself; **Workers & Pages → daraxando-staging → Deployments** shows each build. A failed build changes nothing on the live copy.

**The real game, at launch:** the same steps with `daraxando` everywhere `daraxando-staging` appears, `PRODUCTION_DATABASE_ID` in step 2, `CLOUDFLARE_ENV` set to `production`, a different `SESSION_SECRET`, and **Branch control** set to a `production` branch (on GitHub: **Branches → New branch**, named `production`, from `main`). Step 6 is only needed once, because both Workers share the build token. The first build creates `daraxando.yveskwameh.com` and its HTTPS certificate by itself, since the domain's nameservers already point to Cloudflare. If it says the domain has a conflicting record, delete the old `daraxando` record (**yveskwameh.com → DNS**) and retry. From then on, to publish: on GitHub, **Pull requests → New pull request**, base `production`, compare `main`, **Create pull request**, then **Merge**.

If the free plan's 100,000 requests a day ever run out, players see "Dara X&O is resting" until 1:00 am Lagos time, when the count starts again.

## 9. If something goes wrong

| Problem | Fix |
| --- | --- |
| The phone can't open the Network address | Same Wi-Fi on both? Allow Node in the Mac's firewall (System Settings → Network → Firewall). |
| "This app cannot be installed" | Use `npm run preview` and the Chrome flag in section 2. |
| The page loads forever after updating packages | Stop the dev server, delete `node_modules/.vite`, and run `npm run dev` again. |
| "Port 5173 is in use" | Another dev server is still running. Close that Terminal window, or press Ctrl + C in it. |
| Players or seeds look wrong after a change | Delete the `.wrangler` folder to start from zero players. |
| "no such column: habits" after pulling new code | Stop the dev server and run `npm run dev` again. It applies new database changes as it starts. |
