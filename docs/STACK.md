# Stack and hosting: research and recommendation

October 2026. Written for Yves before the build started.

## The short answer

Build it on **Cloudflare**: Workers for the API, one **Durable Object per match** for the live game, **D1** for player profiles and the leaderboard, and **React + Vite** for the frontend, served as static files.

- It is the same setup behind the live cursors on yveskwameh.com, so nothing here is new.
- It scales by itself. Every match is its own tiny server, so 10 matches and 100,000 matches look the same to the code.
- It is cheap at scale, because with WebSocket Hibernation you pay for the milliseconds spent handling a move, not for the time players sit thinking.
- There is no server to patch, restart or watch, and Cloudflare has a data centre in Lagos.

## What it costs

Estimates for online games (quick match or friend room). Each one uses about 6 Worker requests, 6 Durable Object requests, a handful of storage writes and about 7 D1 row writes. Practice games against the bot cost less.

| Games per month | Roughly per day | Plan | Monthly bill |
|---|---|---|---|
| Up to ~300,000 | ~10,000 | Workers Free | $0 |
| 1,000,000 | ~33,000 | Workers Paid | about $6 |
| 10,000,000 | ~330,000 | Workers Paid | about $50 |

Where the $50 goes at 10 million games: about $15 Worker requests, $9 Durable Object requests, $20 D1 writes, $2 CPU, and the $5 base. Page loads cost nothing at any size, because static files are free and unlimited on Cloudflare. A domain is extra, around $10 a year.

These are estimates from the published prices below. Check the Cloudflare dashboard once real players arrive, and set a billing alert.

### Prices used (October 2026)

- **Workers Paid**: $5 a month minimum. 10 million requests included, then $0.30 per million. 30 million CPU milliseconds included, then $0.02 per million. Static asset requests are free.
- **Durable Objects (Paid)**: 1 million requests included, then $0.15 per million. 400,000 GB-seconds included, then $12.50 per million. **20 incoming WebSocket messages count as 1 request.** Outgoing messages are free. Objects that can hibernate are not billed for idle time.
- **Durable Objects (Free)**: 100,000 requests and 13,000 GB-seconds a day. SQLite-backed objects only, which is what this project uses.
- **D1 (Paid)**: 25 billion rows read and 50 million rows written included each month, then $0.001 per million reads and $1 per million writes. 5 GB storage included.
- **D1 (Free)**: 5 million rows read and 100,000 rows written a day, 5 GB total.

## How the build keeps the bill low

These decisions are already in the code:

1. **Hibernation everywhere.** Match and matchmaking objects use the Hibernation API, so an idle room is evicted from memory and costs nothing.
2. **Game state rides on the sockets.** The board is saved onto each player's socket attachment, which survives hibernation for free. Storage is only written at the start and end of a round, not on every move.
3. **No server timers during a turn.** The browser counts down and asks the server to check the clock when time is up. Timers on the server would keep the object awake and billed.
4. **Keepalive pings never wake anything.** The runtime answers them directly.
5. **The leaderboard is cheap to read.** A partial index means the top 50 is a 50-row read, and the result is cached at the edge for 20 seconds.
6. **Pages are static.** No server rendering, so a page view is free.

## How it scales

- **Matches**: each match is its own Durable Object. There is no shared bottleneck, so more players just means more small objects. Before launch, quick matches should get a location hint from the players' region so the object sits close to them (a backend-phase task).
- **Matchmaking**: one object handles hundreds of new searches a second. Past that, split it by region (Africa, Europe, and so on) with a one-line change.
- **Database**: D1 handles the writes at the end of each game. One database holds up to 10 GB, which is tens of millions of players. If it ever gets close, players can be split across databases, or moved to Postgres.

## What else was considered

| Option | Why not, for this game |
|---|---|
| **VPS (Hetzner, DigitalOcean) with Node, Socket.IO or Colyseus** | Cheap per box, but you run the server yourself: updates, security, restarts, backups. One box is one region and one point of failure. Going past one box needs Redis and sticky sessions. Hetzner also raised cloud prices in 2026 and has limited stock. A good fallback if you ever want full control. |
| **Colyseus** | A strong framework for fast real-time games (shooters, racing). Tic tac toe is turn based, so its main strengths are not needed, and it still needs a server to run on. |
| **Firebase** | Billed per read and per download, so cost grows with every move. Game rules would sit in the browser, which makes cheating easy unless you add Cloud Functions. |
| **Ably or Pusher** | Billed per connection and per message, and you still need your own server for the rules. Good for chat and notifications, expensive as a game server. |
| **Vercel** | WebSockets are still in public beta, connections close after 5 minutes, and two players can land on different servers. Fine for a marketing site, not the game server. |
| **Next.js** | Its strengths are server rendering and SEO. Every game screen is personal and live, so those do not apply. On Cloudflare it needs an adapter that turns free page loads into billed requests. |
| **Supabase** | Ruled out by Yves. |

Other databases if D1 is ever outgrown: **Turso** (SQLite, so the schema moves over almost as is) or **Neon** (serverless Postgres).

## Frontend choices

- **React 19 + Vite 8 + TypeScript.** One dev server runs the app, the Worker, the Durable Objects and D1 together in Cloudflare's real runtime.
- **Motion** for animation, loaded in its lightweight form (`LazyMotion`, `m` components) after first paint.
- **Plain CSS with design tokens** in `src/styles/tokens.css`, the same approach as the portfolio.
- **partysocket** for WebSockets that reconnect on their own.
- **Lucide** for interface icons, plus three custom icons for streak, XP and rank.
- Fonts are self-hosted (Lilita One for display, Nunito for text), so there are no requests to Google.

First download is about 89 KB of gzipped JavaScript. The game screen, sounds and confetti load after the first screen is up.

## Sources

- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- [Workers and D1 pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Object lifecycle and hibernation](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/changelog/2025-04-08-vite-plugin/)
- [OpenNext on Cloudflare](https://f75b423c.previews.developers.cloudflare.com/workers/framework-guides/web-apps/opennext/index.md)
- [Vercel WebSocket public beta, tested](https://dev.classmethod.jp/en/articles/vercel-functions-websocket-public-beta-verification/)
- [Hetzner 2026 price changes](https://findstack.com/resources/hetzner-price-increase-2026)
