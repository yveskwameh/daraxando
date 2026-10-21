# Admin API

Built 16 October 2026 (milestone 4). The server side of the admin dashboard Yves builds after launch: find a player, see their history, rename them, ban and unban them, answer ban reviews, correct their Dara Seeds, test notifications, and read the game numbers. There is no admin screen in the game itself. Code: `worker/admin.ts`.

## Turning it on

The API is off until the copy has an `ADMIN_TOKEN` secret. While it's off, every `/api/admin` address answers 404, as if it didn't exist.

1. Make a key: in VS Code, **Terminal → New Terminal**, run `openssl rand -base64 32`, and copy the line it prints. It's at least 32 characters, which the API requires.
2. In the Cloudflare dashboard, open **Workers & Pages → daraxando-staging → Settings → Variables and Secrets**, click **Add**, type **Secret**, name `ADMIN_TOKEN`, paste the value, then **Deploy**.
3. Keep the key in your password manager. Use a different one for the real game at launch.

On your Mac, add `ADMIN_TOKEN=` and a value to `.dev.vars` and restart `npm run dev`. Leaving it out is fine: the API just stays off.

**Keep the key out of web pages.** Anyone with it can ban players and change seeds. A dashboard should ask for it when you sign in and keep it only for that session, never in its code or on GitHub. For more protection, put the dashboard behind Cloudflare Access (free for up to 50 people), so only your Google account can open it. If the key ever leaks, replace the secret in Cloudflare and the old one stops working at once.

## Calling it

Every request sends the key as a bearer token:

```
Authorization: Bearer <ADMIN_TOKEN>
```

Try it from the terminal, typing your own key where it says `KEY`:

```
curl -H "Authorization: Bearer KEY" "https://daraxando-staging.yves-workers.workers.dev/api/admin/players?q=Tunde"
```

A dashboard on another web address also needs that address in the `ADMIN_ORIGIN` setting (a plain variable, not a secret; several addresses separated by commas, for example `https://admin.yveskwameh.com`). Browsers on any other address are refused.

Answers are JSON. Errors look like `{ "error": "No player with that id." }`, with these status codes: 400 (something in the request is wrong), 401 (missing or wrong key), 404 (no such player or address, or the API is off), 409 (the change can't be made, for example unbanning someone who isn't banned), 429 (more than 120 requests a minute from one network address).

## Reading

### Find players

`GET /api/admin/players?q=...`

`q` is a player id, an email address (finds players saved with that email or Google account), or the start of a name (up to 20 matches, most recently active first).

```json
{
  "players": [
    {
      "id": "6c1f…",
      "name": "Tunde",
      "avatar": "tortoise",
      "state": "LA",
      "cowries": 5500,
      "aura": 340,
      "rating": 1032,
      "saved": true,
      "ban": null,
      "createdAt": 1760600000000
    }
  ]
}
```

`ban` is `null`, or `{ "at": <time>, "reason": "...", "until": <time or null> }` (`until` is when a timed ban ends, or `null` for one that lasts until it's lifted). Players also carry `lastPlayedDay` and `dayStreak`. Times are milliseconds since 1 January 1970 (JavaScript's `Date.now()`).

### Every player, and the dashboard's views

Added 19 October 2026 for the admin dashboard (`worker/adminViews.ts`, `admin/README.md`). Reading only.

| Request | What you get |
| --- | --- |
| `GET /api/admin/info` | `{ "copy": "production", "timedBans": false, "banDays": [1, 7, 30] }`: which copy this is and whether bans can end by themselves here |
| `GET /api/admin/players/counts` | How many players each tab has: `all`, `today` (finished a match today), `new` (joined in the last 7 days), `banned`, `saved` |
| `GET /api/admin/players/list?tab=all&sort=new&page=0&size=50` | 25, 50 (the default) or 100 players a page (`size`), as in Find players, with `total` (how many match), `page`, `size` and `more`. `tab` is `all`, `today`, `new`, `banned` or `saved`. `sort` is `new` (joined), `active` (last played), `seeds`, `aura`, `rating` or `name`. Optional filters: `state` (a state code like `LA`), `account` (`saved` or `guest`) and `q` (as in Find players) |
| `GET /api/admin/now` | Right now, from the matchmaker: `home` (players with Home open), `looking` (with the Quick match sheet open), `waiting` (waiting in a game of their own), plus `playedToday`. Players in the middle of a match aren't on Home, so they aren't counted until they're back |
| `GET /api/admin/traffic?hours=5` | Traffic for a window: `hours` (1, 5, 12, 24, 48 or 72), `since` (a time in ms, up to 30 days back, for tracking a link from when it was shared) or `days` (7 or 30 UTC days, the default 7). `window` says which (`from`, `to`, `bucket`: quarter hours up to 6 hours, hours up to 4 days, then days, and `before`, the start of the same length of time just before). `players`: new players in the window (`joined`, how many of them `finished` their first match and `saved`), `before` (new players in the window before) and `savedAny` (players who saved their progress in the window). `buckets`: `at`, `joined`, and on the live game `visits` and `views`. `web`: on the live game `visits`, `views`, `before`, `referers` (the site that sent them, `host` empty for none), `countries` and `devices` from Cloudflare Web Analytics; otherwise `off` or `problem` says why. Needs `CF_ACCOUNT_ID` and `CF_ANALYTICS_TOKEN` for visits |
| `GET /api/admin/phones?min=2` | Phones with `min` (2, 3 or 5) players or more (`worker/phones.ts`), newest link first, up to 60: `id` (the first 8 characters of the phone's keyed hash), `players`, `newest`, `lastAt`, `made30` (players made on it in 30 days) and `list` (each player with `how`: `made`, `signin` or `seen`). Also `total` and `busy` (phones with 3 or more players that gained one in the last day) |
| `GET /api/admin/retention?weeks=8` | For each of the last 4 to 12 weeks (Monday to Sunday, Lagos days): `start`, `joined`, and `played`, how many of them finished a match in that week and in each week after |
| `GET /api/admin/first-days?days=30` | Players who joined in the last 7, 30 or 90 days: `joined`, `finished` (their first match), `won` (it), `returned` (played on another day), `threeDays` (played on 3 days or more), `saved` |

One player (below) also has `days`: `recent`, the days they finished a match in the last 12 weeks, and `total`, on how many days in all.

### One player

`GET /api/admin/players/<id>`

| Field | What's in it |
| --- | --- |
| `profile` | Everything the game knows about the player: name, title progress, seeds, rating, streaks, ban |
| `identities` | How they sign in: `provider` (`google` or `email`), `email`, `createdAt` |
| `ledger` | The last 50 changes to their seeds: `delta`, `reason`, `matchId`, `at` |
| `matches` | The last 20 matches against people: `mode`, `kind` (`quick` or `friend`), `stake`, `result` (`win`, `loss`, `draw`), `reason`, `score`, `paid`, `opponent` (`id`, `name`), `at` |
| `samePhone` | Other players made on the same phone: `id`, `name` |
| `appeals` | Their ban review requests, newest first: `id`, `message`, `at`, `status`, `note`, `decidedAt` |
| `actions` | Admin changes made to this player, newest first |
| `days` | `recent`: the days they finished a match in the last 12 weeks; `total`: on how many days in all |

`paid` is `false` when a farming rule sent both stakes back (`docs/SAFETY-REVIEW.md`). Ledger reasons: `start`, `daily`, `sapa`, `stake`, `pot`, `refund`, `freeze`, `repair`, `streak-stake`, `streak-win`, `admin`.

### Ban reviews

`GET /api/admin/appeals?status=open`

Banned players' requests for a review, the oldest open one first (`status` is `open`, `lifted`, `kept` or `all`; the others list newest first, up to 100). Each has `id`, `playerId`, `message` (what they wrote), `at`, `status`, `note`, `decidedAt`, and the player's `name`, `avatar`, `bannedAt` and `banReason`, so a dashboard can show the request next to the ban.

### System health

`GET /api/admin/health`

Everything the game depends on, checked now (`worker/health.ts`, `docs/HEALTH.md`): `copy`, `at`, `deployedAt` (when this version went live, from the `version_metadata` binding) and `checks`, each with `id`, `label`, `state` (`ok`, `warn`, `down`, `off` for not set up on this copy, `unknown` for couldn't be checked), a plain `detail` line, `ms` where timing matters, and a `link` to a status page. Checks: database, matches and Quick match, email (asks Resend's API about our key and domain, never sends), Google sign-in, notifications, the 7 pm reminders, the 8 am email, the free plan today, errors in the last hour, the analytics key, and Cloudflare's open incidents on Workers, D1, Durable Objects, Web Analytics and the Lagos data centre. Reads only, keeps nothing. The dashboard keeps each answer for 30 seconds.

### Lost player codes

`GET /api/admin/recoveries?status=open` (or `all`)

"Lost your code? Ask us to help" requests (`worker/codes.ts`), oldest first while waiting. `open` lists requests waiting for an answer and ones given back that are still in their 24 hours. Each has `id`, `state` (`open`, `waiting`, `refused`, `stopped`, `done`), `at`, `decidedAt`, `due`, `note`, `message`, `player` (id, name, avatar, print, banned) and `checks`: whether the asking phone is linked to the player (`phone`, with how and when), and whether the seeds, the month they started and the player they played match (`seeds`, `month`, `opponent`). `answersOk` counts the answers that match, and `suggest` is `give` when the phone is linked or all 3 match (Yves's rule, 21 October 2026). Empty on a copy with player codes off.

### The admin log

`GET /api/admin/actions?limit=50&before=<id>`

Every change made through this API, newest first: `id`, `at`, `action` (`rename`, `ban`, `unban`, `seeds`, `appeal-lift`, `appeal-keep`, `recovery-give`, `recovery-refuse`, `recovery-stopped` (the player tapped Stop), and `ban-ended` when a timed ban ends by itself), `playerId`, `detail`. For older pages, pass the last `id` you got as `before`. `limit` is 1 to 100.

## Changing

Each of these answers with the player's summary after the change (`{ "player": { ... } }`) and writes a line to the admin log.

| Request | Body | What it does |
| --- | --- | --- |
| `POST /api/admin/players/<id>/rename` | `{ "name": "Player 4021" }` | Renames them. The same rules as in the game: 3 to 16 letters or numbers, no rude or reserved names, and not a name another player has (409 "Another player has that name"). The player isn't asked to pick again afterwards. |
| `POST /api/admin/players/<id>/ban` | `{ "reason": "Rude names, reported three times.", "days": 7 }` | Bans them: no play against people, off Ranks and leagues, Baba Ayo still works. The player sees the reason, so write it to them (3 to 200 characters). `days` (1, 7 or 30) makes the ban end by itself; leave it out for a ban that lasts until it's lifted. Timed bans are off on the live game until the lawyer approves the privacy line (`docs/BANS-REVIEW.md`), so there `days` gets a 409. Banning again replaces the reason and the end |
| `POST /api/admin/players/<id>/unban` | none | Lifts the ban, and answers any open review request as lifted. 409 if they aren't banned |
| `POST /api/admin/players/<id>/seeds` | `{ "amount": 1000, "reason": "Stake lost to a server fault" }` | Adds seeds, or takes them with a negative amount. A whole number up to 1,000,000 either way, never 0, with a reason. 409 if it would take them below 0. Written to the ledger as `admin` |

Answering a ban review (each request is answered once; 409 after that):

| Request | Body | What it does |
| --- | --- | --- |
| `POST /api/admin/appeals/<id>/lift` | `{ "note": "You were right, sorry." }` (optional) | Lifts the ban. The player is back to normal on their next request |
| `POST /api/admin/recoveries/<id>/give` | `{ "note": "Welcome back." }` (optional) | Starts the 24 hours. Every phone the player is on shows "Someone asked us for …" with Stop. After that, the asking phone collects the player when it next opens: a new code, and every other phone signed out |
| `POST /api/admin/recoveries/<id>/refuse` | `{ "note": "Your answers didn't match this player." }` | The asking phone shows the note (3 to 200 characters). They can ask again a week later |
| `POST /api/admin/appeals/<id>/keep` | `{ "note": "The messages came from your account on three days." }` | Keeps the ban. The player reads the note in the ban sheet, so write it to them (3 to 300 characters). They can ask again a week later |

Seed corrections are only for fixing mistakes, never prizes or anything linked to money (`docs/SAFETY-REVIEW.md`). Any new kind of change that touches seeds goes to the lawyer first.

A ban takes effect on the player's next request. A match already under way finishes normally, but no rematch starts.

## Game numbers

Added 16 October 2026 (milestone 6, `docs/BACKEND.md`, "Game numbers"). Reading only, so nothing goes in the admin log. `day` is a Lagos date like `2026-10-16`, today or earlier; without it, yesterday.

| Request | What you get |
| --- | --- |
| `GET /api/admin/stats?day=2026-10-16` | One day's numbers as JSON: `players` (played, Duolingo's buckets, at risk, `curr`), `first` (the first-game funnel), `matches` (by kind, mode and stake), `quick` (Quick match joins and waits), `extra` (phones with notifications on, reminders sent, open ban reviews, `savedFromAsk` and `pushOn` by where), and `usage` (the free plan, or `null` without the analytics secrets). Today's numbers grow as the day goes on |
| `GET /api/admin/report?day=2026-10-16` | The 8 am email for that day, as a web page. Add `&format=text` for the plain-text version |
| `POST /api/admin/report?day=2026-10-16` | Sends that day's email now to `REPORT_EMAIL`, even if it already went. 409 if the copy has no `REPORT_EMAIL` |

To see yesterday's email in your browser without waiting for 8 am, save the page and open it:

```
curl -H "Authorization: Bearer KEY" "https://daraxando-staging.yves-workers.workers.dev/api/admin/report" -o report.html && open report.html
```

## Notifications

Added 16 October 2026 (milestone 5, `docs/BACKEND.md`). These don't change anything about a player, so they aren't written to the admin log. Both need the copy's notification keys (`/api/health` shows `"push":true`).

| Request | Body | What it does |
| --- | --- | --- |
| `POST /api/admin/players/<id>/push` | `{ "body": "Testing, one two." }` (optional, up to 140 characters) | Sends a test message titled Dara X&O to every phone where this player turned notifications on. Answers `{ "phones": 2, "sent": 2, "gone": 0 }`; a phone counted as `gone` had removed the app or turned them off, and is forgotten |
| `GET /api/admin/push/streak` | none | How today's 7 pm streak reminders went: `{ "day": "2026-10-16", "sent": 41 }` |
| `POST /api/admin/push/streak` | none | Starts today's streak reminders now instead of at 7 pm, for testing. Does nothing if they already ran today, unless you add `?again=1`, which sends them once more to players already reminded today. Only players whose streak ends at midnight get one, and nothing goes out after 10 pm Lagos time |

To test on your own phone: turn notifications on in the game (You, then Settings), find your player id with `GET /api/admin/players?q=` and your name, then send yourself a test message:

```
curl -X POST -H "Authorization: Bearer KEY" -H "Content-Type: application/json" -d '{"body":"Testing"}' "https://daraxando-staging.yves-workers.workers.dev/api/admin/players/PLAYER_ID/push"
```

## Adding to it

New admin actions go in `worker/admin.ts`, log themselves with `log(action, detail)`, and get a row here. Anything that changes how seeds work goes to the lawyer before it's built.

## Game controls (worker/controls.ts)

Switches, the announcement on Home and news notifications (`shared/controls.ts`). Every change goes in `admin_actions`.

| Call | Body | What it does |
|---|---|---|
| `GET /api/admin/controls` | | The nine switches (on, since, reason), announcements from the last 30 days, and news: phones with news on, how many can still go in 30 days, and what was sent |
| `POST /api/admin/controls/switch` | `{ "id": "quick", "on": false, "reason": "Matchmaker errors" }` | Turns a switch off (a reason of 3 to 200 characters) or back on (`"on": true`). Reaches players within a minute |
| `POST /api/admin/controls/banner` | `{ "text": "...", "action": "quick", "startsAt": 0, "endsAt": 0 }` | Schedules an announcement (up to 90 characters, the game's writing rules, 10 minutes to 14 days, never two at once). Add `"id"` to change one, or `{ "id": 3, "stop": true }` to stop it |
| `POST /api/admin/controls/news` | `{ "text": "..." }` | Sends News from Dara X&O (up to 120 characters) to every phone with news on, a few at a time. At most 4 in 30 days |

Buttons for an announcement: `quick`, `friend`, `baba`, `mode`, `ranks`, or `null`.
