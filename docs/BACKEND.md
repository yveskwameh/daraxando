# Backend and launch plan

Status: planned 15 October 2026, the day Yves signed off the frontend. Launch address: **daraxando.yveskwameh.com**. Test copy: **https://daraxando-staging.yves-workers.workers.dev**, built from GitHub since 15 October 2026 (first build green, database tables made).

## What already exists

The game server is built and runs today with `npm run dev`:

- **Cloudflare Workers** answer the app's requests (`worker/index.ts`).
- **Durable Objects** run each match and friend room (`worker/match.ts`) and pair players for Quick match (`worker/matchmaker.ts`). The server decides every move.
- **D1** (Cloudflare's database) keeps players, ratings, Dara Seeds and the seeds ledger, streaks, quests, leagues and friend streaks (`migrations/`).
- **Guest players.** A new player gets a signed token (no password, no email). It lives on the phone, so a player who clears their browser or changes phone loses their progress. Fixing that is the biggest job below.
- **Safeguards already in.** Rate limits on new players, a daily limit on high-stakes matches between the same two players, seeds settled once per match, server-checked moves.

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
| 3 | Save your progress | Designs the sign-in email for approval, then builds sign in with Google and email code, sign in on a new phone, sign out, delete my account | Approves the email design, creates the Google sign-in client and the Resend key (steps given), saves the keys as secrets |
| 4 | Safety | Name filter, reserved names, limits on farming free seeds with many accounts, a simple admin tool (look up, rename, ban, refund) | Sends the bad-word list to the native speaker for checking |
| 5 | Notifications | Web Push, the opt-in moment, the two notifications, a Settings switch | Saves the notification keys as secrets |
| 6 | Knowing how it's doing | Game numbers (matches played, first match finished, Quick match wait times) | Turns on Cloudflare Web Analytics (one click) |
| 7 | Legal pages | Drafts the privacy notice and terms in plain words (Nigeria Data Protection Act 2023) | Gets the lawyer's approval |
| 8 | Launch | README rewrite, final checks on staging, a load test | Connects the production Worker to GitHub the same way, then publishes by merging `main` into `production` |

### The sign-in email

`worker/email.ts` builds it: subject, the HTML and a plain-text copy. Two versions share one design: "Save your progress" (a guest adds an email) and "Welcome back" (signing in on another phone). It's dark in every mail app, uses tables and inline styles because mail apps aren't browsers, and shows the code as one of the game's Ankara stickers so it can be long-pressed and copied in one piece. Its pictures are in `public/email/` (the logo, Baba Ayo, the two print tiles and the heading font) and load from the game's own address, never from a third party. Gmail doesn't load fonts from emails, so there the headings fall back to Arial; the layout and colours stay the same. The service worker leaves `public/email/` out, so players never download it. Waiting for Yves's approval (15 October 2026).

Claude never deploys and never handles secret values. Yves runs every deploy and types every secret into his own terminal.

## Accounts and keys

Everything here is free.

| What | Where it comes from | Cost | Where it lives |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Any long random string | Free | Already in `.dev.vars`; live, a secret on each Worker in the Cloudflare dashboard |
| Google sign-in client id | Google Cloud console | Free | A plain setting in `wrangler.jsonc` (it isn't secret) |
| `RESEND_API_KEY` | resend.com, sends the email codes | Free (3,000 a month, 100 a day) | Secret |
| `VAPID_PRIVATE_KEY` and the public key | Generated with one command | Free | Private: secret. Public: plain setting |
| `ADMIN_TOKEN` | Any long random string | Free | Secret |
| Workers Builds token | Made by Cloudflare when GitHub is connected; Yves adds "Account, D1, Edit" once so builds can update the database | Free (3,000 build minutes a month) | Cloudflare, Manage account, Account API Tokens |

Every new secret also gets a line in `.dev.vars.example`, a field in `worker/env.ts` and a row in the README's Secrets table.

## The domain

yveskwameh.com was bought on Hostinger and its nameservers point to Cloudflare, so Cloudflare runs its DNS. That's what a Worker's custom domain needs. Hostinger stays the registrar, so renewals happen there. Adding `daraxando` creates its own DNS record and touches nothing else on the domain. Check that Cloudflare shows the domain as **Active** (Cloudflare dashboard, Websites list), and that there is no existing record named `daraxando`.

Email codes will send from a subdomain such as `send.yveskwameh.com`. Resend gives the DNS records to add in Cloudflare, and they don't affect any email already on the domain.

## Rules for this phase

- No emojis anywhere in the product: screens, notifications, emails, player names.
- Everything a player can do on a guest account keeps working with no sign-in. Signing in is never a wall in front of a game.
- Store the least: a chosen state, never a location; an email only if the player gives it; no phone numbers at launch.
