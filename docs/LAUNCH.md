# Launch checklist

Written 16 October 2026. Everything needed to put Dara X&O in front of players at **https://daraxando.yveskwameh.com**, in order. Yves does every step on Cloudflare, Google and GitHub; nothing is deployed for him. Claude runs the checks and fixes anything they find.

## Before launch day

- [x] **Approvals.** The native speaker (15 and 16 October 2026) and the lawyer (Dara Seeds, safety, and the privacy notice and terms, 15 and 16 October 2026).
- [ ] **Load test the test copy** from your Mac: `node scripts/loadtest.mjs` in the VS Code terminal (about 1 minute, 30 players), then send Claude the output. It passed on Claude's local copy (results at the end of this file).
- [ ] **Two or three 8 am emails from the test copy** look right: the free plan part reads, and errors are low.
- [ ] **Ask the lawyer about registering** with the Nigeria Data Protection Commission and a Data Protection Officer (`docs/LEGAL-REVIEW.md`, questions 3 and 4). Not needed on day one, but before the game passes 200 players in six months.
- [ ] **Decide** whether the test copy keeps sending its own 8 am email (it says "Test copy"). To stop it, delete its `REPORT_EMAIL` secret.

## 1. Set up the real copy (about 30 minutes)

All in the Cloudflare dashboard (dash.cloudflare.com), except steps 2 and 3 in the VS Code terminal (**Terminal → New Terminal**) and step 3 on GitHub.

1. **Make the database.** In the sidebar, open **Storage & databases → D1 SQL database**. Click **Create Database**. Name: `daraxando`. Location: **Western Europe**. Click **Create**, then copy the **Database ID** from its page.
2. **Put the id in the settings.** In VS Code, **Cmd+P**, type `wrangler.jsonc`, **Enter**. **Cmd+Option+F** opens Find and Replace. Find `PRODUCTION_DATABASE_ID`, replace with the Database ID, **Replace All**, then **Cmd+S**. Then push:
   ```sh
   git add -A
   git commit -m "Production database"
   git push
   ```
3. **Make the `production` branch.** On github.com, open the `daraxando` repository. Click the branch menu (it says **main**), type `production`, and click **Create branch production from main**.
4. **Connect the real Worker.** In Cloudflare, **Workers & Pages → Create application → Get started** next to **Import a repository**. Pick the `daraxando` repository. Fill in exactly:
   - Project name: `daraxando` (it must match `wrangler.jsonc`)
   - Build command: `npm run build`
   - Deploy command: `npm run release`
   - **Advanced settings → Build variables:** `CLOUDFLARE_ENV` with the value `production`
   - Click **Deploy**.
   The first build creates `daraxando.yveskwameh.com` and its HTTPS certificate by itself. If it says the domain has a conflicting record, open **yveskwameh.com → DNS**, delete the old `daraxando` record, and retry the build.
5. **Build only the `production` branch.** Open **daraxando → Settings → Build → Branch control**. Set the production branch to `production` and turn off builds for other branches. Save.
6. **Add the game's secrets.** **daraxando → Settings → Variables and Secrets → Add**, type **Secret**, one at a time, then **Deploy**. Save each new value in your password manager first.
   - `SESSION_SECRET`: a new one from `openssl rand -base64 32` (not the test copy's).
   - `GOOGLE_CLIENT_SECRET`: the same one as the test copy (Google Cloud, **Google Auth Platform → Clients → Dara X&O web**).
   - `RESEND_API_KEY`: on resend.com, **API Keys → Create API Key**, name `daraxando-production`, **Sending access**, domain `noreply.daraxando.yveskwameh.com`.
   - `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: a new pair from `node scripts/vapid-keys.mjs` (the part before `=` is the name, the part after is the value), then `clear` in the terminal. Never change this pair once players turn notifications on.
   - `ADMIN_TOKEN` (optional): a new one from `openssl rand -base64 32`.
7. **Add the 8 am email's secrets.** Same place, then **Deploy**:
   - `REPORT_EMAIL`: your email address.
   - `CF_ACCOUNT_ID`: the 32 letters and numbers right after `dash.cloudflare.com/` in the address bar.
   - `CF_ANALYTICS_TOKEN`: the same token as the test copy. If you need a new one: **Manage account → Account API Tokens → Create Token → Get started** next to **Custom token**. Name it `Dara X&O report`. Under **Permissions**, pick **Account**, then **Account Analytics**, then **Read**. **Continue to summary → Create Token**, and copy it (it's shown once).
8. **Check it.** Open https://daraxando.yveskwameh.com/api/health. It should show `"env":"production"`, `"signIn":{"google":true,"email":true}` and `"push":true`. The game is now reachable, but nobody knows the address yet.
9. **Google sign-in for everyone.** Until now, only the test users you listed can sign in with Google.
   1. **Prove you own the domain.** Open search.google.com/search-console, **Add property → Domain**, type `yveskwameh.com`, **Continue**. Google shows a TXT record. In Cloudflare, **yveskwameh.com → DNS → Records → Add record**, type **TXT**, name `@`, paste the value, **Save**. Back in Search Console, click **Verify** (it can take a few minutes).
   2. **Fill in the app's details.** In Google Cloud, project **Dara X&O → Google Auth Platform → Branding**:
      - App name `Dara X&O`, your support email, and the logo `docs/google-logo-120.png` (the app icon at the 120 × 120 px Google asks for)
      - Application home page `https://daraxando.yveskwameh.com`
      - Privacy policy `https://daraxando.yveskwameh.com/privacy`
      - Terms of service `https://daraxando.yveskwameh.com/terms`
      - Authorized domains: `yveskwameh.com`
      Then **Save**.
   3. **Publish.** **Audience → Publish app → Confirm.** The game only asks Google for an id and an email address, which Google treats as basic, so no security review is needed.
   4. **Show the name and logo.** On **Branding**, click **Verify branding** if it's offered. Until Google checks it (a few days), the sign-in screen shows `yveskwameh.com` instead of Dara X&O. Sign-in works either way.
   5. If Google won't publish because of the test copy's address, remove the test copy's return address from **Clients → Dara X&O web → Authorized redirect URIs**. Google sign-in then stops on the test copy only; email codes still work there.
10. **Turn on Web Analytics.** In Cloudflare, **Web Analytics → Add a site**, pick `daraxando.yveskwameh.com`, **Done**. It counts visits, countries, devices and page speed without cookies. The game's security headers already allow it. If it still shows no visits a day after launch, open **Manage site**, choose **Enable with JS Snippet installation**, and send Claude the snippet.

## 2. Launch day

1. **Claude runs the full regression suite**, once (about 20 minutes, 17 browser and server scripts plus the notification and game-number checks), and fixes anything it finds.
2. **Push** whatever changed, then **publish**: on GitHub, **Pull requests → New pull request**, base `production`, compare `main`, **Create pull request**, then **Merge pull request**. Wait for the build (**Workers & Pages → daraxando → Deployments**, about 2 minutes).
3. **Check on your phone** at https://daraxando.yveskwameh.com:
   - The first screen, **Play now**, and the first game against Baba Ayo.
   - **Quick match** between two phones, and a friend room by code.
   - **Save your progress** with Google and with email, then sign in on another phone.
   - Notifications on in Settings: the "Notifications are on" message arrives.
   - **Install the app** (Android: Chrome's install; iPhone: Share, Add to Home Screen).
   - The Privacy notice and Terms of play open from the first screen and Settings.
4. **Share the link.**

## 3. Publishing an update after launch

1. Claude writes the change into your folder. You push to `main`, and the test copy rebuilds.
2. Check it on the test copy.
3. On GitHub: **Pull requests → New pull request**, base `production`, compare `main`, **Create pull request**, **Merge**. Cloudflare rebuilds the real game, adding any new database tables first.
4. Installed apps switch to the new version the next time players leave them.

**If an update breaks something:** **Workers & Pages → daraxando → Deployments**, find the last good version, **⋯ → Rollback**. A rollback doesn't undo database changes, so tell Claude what happened.

## 4. The first weeks

- **Read the 8 am email** each day: who played, how many new players finished their first game, Quick match waits, and the free plan bars. Tell Claude if any bar passes half.
- **Answer ban reviews** through the admin API (`docs/ADMIN-API.md`). The email says how many are waiting.
- **Before 200 players in six months:** register with the Nigeria Data Protection Commission and appoint a Data Protection Officer, if the lawyer confirms it applies.
- **Before the first change to the terms:** Claude builds the sheet that asks existing players to accept the new version (the terms promise it), and bumps `TERMS_VERSION` in `shared/legal.ts`.
- **When you say so:** remove the ngrok allowance from `vite.config.ts` (kept until then for testers, per `CLAUDE.md`).
- **Later:** the admin dashboard, built on the admin API.

## Load test results

`scripts/loadtest.mjs` makes players (5 every 6 seconds, under the per-network limit), has them read Home and Ranks, then a third play Baba Ayo at Agba on the 7×7 board (his hardest thinking) while the rest pair up in Quick match, and every match is played to the end. It refuses to run against the real game.

- **16 October 2026, Claude's local copy, 50 players:** every Baba Ayo game and every Quick match finished, no errors. A move was answered in about 20 ms (95% within 100 ms), Quick match paired in under half a second. About 1,000 requests in all. Local runs don't enforce Cloudflare's 10 ms limit, which is why the test copy run matters.
- **The test copy:** to run from Yves's Mac (Claude's workspace can't reach it). Expect about 30 requests per player, so 30 players use well under 1% of a day's free requests. The load players stay on the test copy's Ranks; that's fine there.
