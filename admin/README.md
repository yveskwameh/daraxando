# Dara X&O admin

The admin dashboard at **https://admin.daraxando.yveskwameh.com**. It is the 8 am email as pages you can act on, for any day, plus the admin API's tools on screen.

It fits the screen it's on. On a computer: a sidebar with the five areas, search and the Live and Test switch, Players and the Log as tables (click a column title to change the order), and pages laid out in columns. On a phone or tablet: a slim bar at the top and a floating bar of tabs at the bottom. Search from anywhere with Ctrl K (Cmd K on a Mac), the / key, or the search button: type a name, an email or a player id, or the name of a page.

- **Today**: Live now (players with the game open on Home, looking at Quick match, waiting in a game of their own, and how many finished a match today), then what needs you (ban reviews waiting, the free plan past half, sharp drops in players), then the email's headline and every section with the last 14 days. View the email or send it to yourself for any day.
- **Section pages**: pick a number, see it day by day over 14 or 30 days, tap a bar to open that day, and read every row the email has.
- **Players**: every player, newest first, with counts and tabs (all, played today, new this week, banned, saved), search as you type by name, email or id, filters (state, saved or guest) and an order (newest, last played, most seeds, most Aura, rating, name). 25, 50 or 100 a page with numbered pages; the page and its size are in the address, so Back from a player returns to them.
- **A player**: their status, stats, the days they played over 12 weeks, and a timeline of their matches against people, seeds, sign-ins, ban reviews and your changes. One Actions menu: rename, add or take seeds, send a test notification, and ban (for 24 hours, 7 days, 30 days or until you lift it) or lift a ban.
- **Growth**: traffic and new players for the last 1, 5, 12, 24 or 48 hours, 3, 7 or 30 days, or since a time you pick (the time you shared a link, say; the address keeps it, so you can bookmark it). Visits and new players by quarter hour, hour or day, each against the same length of time just before, the sites that sent them, countries and devices (visits from Cloudflare Web Analytics on the live game), how many new players finished their first match, and how many players saved their progress. It updates every minute while it's on screen. Below it: new players' first days (finished the first match, came back, played on 3 days, saved) and weekly retention. Live now on Today links to the last hour.
- **Reviews**: answer ban reviews. **Log**: every change made through the admin API.

Bans that end by themselves work on the test game now. On the live game they wait for the lawyer to approve one line in the privacy notice (`docs/BANS-REVIEW.md` in the game); until then a ban there lasts until you lift it.
- **Live and Test** at the top switches between the live game and the test game.

It is its own Worker (`daraxando-admin`) that calls the game's admin API (`worker/admin.ts` and `worker/adminViews.ts`, `docs/ADMIN-API.md`), so every change still follows the game's rules and lands in the game's admin log. It keeps no data of its own. To remove it, delete the `daraxando-admin` Worker; the game doesn't notice.

## Setting it up (once)

You need the live game's admin key from Passwords. The test game's key is only needed if you want the Test switch to work.

1. **Push and publish.** Commit the `admin` folder, push to `main` from the VS Code terminal, then merge `main` into `production` as usual.
2. **Create the Worker.** In the Cloudflare dashboard, open the account that has the `daraxando` Worker.
   1. Go to **Workers & Pages**, click **Create**, then **Import a repository**.
   2. Pick the `daraxando` repository.
   3. **Project name**: `daraxando-admin` (it must match `name` in `admin/wrangler.jsonc`).
   4. Open **Advanced settings**. **Root directory**: `admin`.
   5. **Build command**: leave it empty. **Deploy command**: `npm run deploy`.
   6. Click **Create and deploy**. The first build takes a minute or two.
   7. When it's done, open the Worker's **Settings**, then **Build**, then **Branch control**, and set the branch to `production`, so the dashboard goes live when the game does.
3. **Add the keys.** In `daraxando-admin`, open **Settings**, then **Variables and Secrets**, and click **Add**.
   1. **Type**: Secret. **Variable name**: `ADMIN_KEY_LIVE`. **Value**: paste the live admin key from Passwords. Click **Deploy**.
   2. Optional, for the Test switch: the same again with `ADMIN_KEY_TEST` and the test game's admin key.
4. **Sign in.** Open https://admin.daraxando.yveskwameh.com (the address can take a few minutes to start working the first time) and paste the live admin key. You stay signed in on that device for 14 days.

Optional, so a change to the dashboard doesn't rebuild the game: in the `daraxando` Worker, open **Settings**, then **Build**, then **Build watch paths**, and add `admin/*` under **Exclude paths**. Do the same on `daraxando-staging`.

## How it keeps the game safe

- Signing in needs the live admin key. Five tries a minute per network, then it waits.
- After that, a signed cookie only the dashboard can read (HttpOnly, Secure, SameSite Strict) keeps you in for 14 days. The key itself is never stored in the browser. Changing the live admin key in Cloudflare signs every device out.
- Changes only go through from the dashboard's own page (an `x-dara-admin` header another site can't send), and only to the admin API's own routes.
- It reaches the games through service bindings: direct, private calls between Workers on the same account.
- Strict security headers, no outside scripts, and search engines are told not to list it.

## Cost

$0, on the free plan. A finished day's numbers are kept in Cloudflare's cache for 30 days (yesterday for 10 minutes), so opening the dashboard usually asks the game for one or two days, not fourteen. Player counts are kept for a minute, traffic for the last hours for a minute (whole days for 10 minutes), and the other Growth views for 10 minutes. Live now asks the game every 30 seconds, and only while the dashboard is on screen.

## For whoever works on it

- `worker/index.ts`: sign-in, the pass-through to the game's admin API (`ROUTES`), and `/api/{live|test}/range`, which collects the email's numbers for up to 31 days. `worker/session.ts`: the cookie.
- `src/`: React screens. `src/sections.ts` mirrors the email's sections and rows in the game's `worker/report.ts`; when the email changes, change it the same way. `src/types.ts` mirrors the admin API's answers. Names of games, titles and states come from the game's `shared/` folder.
- Same colours, fonts and spacing as the game (`src/styles.css` repeats the game's tokens). Charts follow the dataviz rules: one series in indigo glow, today drawn as an outline, every number also readable as text.
- Checks: `npm ci`, then `npm run typecheck && npm test && npm run build`. Tests use Node's own test runner.
- On your machine: run the game with `npm run dev` in the game folder, put `ADMIN_KEY_LIVE`, `ADMIN_KEY_TEST` (the local game's `ADMIN_TOKEN`) and `GAME_DEV_ORIGIN=http://localhost:5173` in `admin/.dev.vars` (never committed), then `npm run build && npm run dev:worker` here and open http://localhost:8787. Always pass `-c wrangler.jsonc` to wrangler in this folder.
