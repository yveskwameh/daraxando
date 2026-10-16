# Admin API

Built 16 October 2026 (milestone 4). The server side of the admin dashboard Yves builds after launch: find a player, see their history, rename them, ban and unban them, and correct their Dara Seeds. There is no admin screen in the game itself. Code: `worker/admin.ts`.

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

`ban` is `null`, or `{ "at": <time>, "reason": "..." }`. Times are milliseconds since 1 January 1970 (JavaScript's `Date.now()`).

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

`paid` is `false` when a farming rule sent both stakes back (`docs/SAFETY-REVIEW.md`). Ledger reasons: `start`, `daily`, `sapa`, `stake`, `pot`, `refund`, `freeze`, `repair`, `streak-stake`, `streak-win`, `admin`.

### Ban reviews

`GET /api/admin/appeals?status=open`

Banned players' requests for a review, the oldest open one first (`status` is `open`, `lifted`, `kept` or `all`; the others list newest first, up to 100). Each has `id`, `playerId`, `message` (what they wrote), `at`, `status`, `note`, `decidedAt`, and the player's `name`, `avatar`, `bannedAt` and `banReason`, so a dashboard can show the request next to the ban.

### The admin log

`GET /api/admin/actions?limit=50&before=<id>`

Every change made through this API, newest first: `id`, `at`, `action` (`rename`, `ban`, `unban`, `seeds`, `appeal-lift`, `appeal-keep`), `playerId`, `detail`. For older pages, pass the last `id` you got as `before`. `limit` is 1 to 100.

## Changing

Each of these answers with the player's summary after the change (`{ "player": { ... } }`) and writes a line to the admin log.

| Request | Body | What it does |
| --- | --- | --- |
| `POST /api/admin/players/<id>/rename` | `{ "name": "Player 4021" }` | Renames them. The same rules as in the game: 2 to 16 letters or numbers, no rude or reserved names |
| `POST /api/admin/players/<id>/ban` | `{ "reason": "Rude names, reported three times." }` | Bans them: no play against people, off Ranks and leagues, Baba Ayo still works. The player sees the reason, so write it to them (3 to 200 characters). Banning again replaces the reason |
| `POST /api/admin/players/<id>/unban` | none | Lifts the ban, and answers any open review request as lifted. 409 if they aren't banned |
| `POST /api/admin/players/<id>/seeds` | `{ "amount": 1000, "reason": "Stake lost to a server fault" }` | Adds seeds, or takes them with a negative amount. A whole number up to 1,000,000 either way, never 0, with a reason. 409 if it would take them below 0. Written to the ledger as `admin` |

Answering a ban review (each request is answered once; 409 after that):

| Request | Body | What it does |
| --- | --- | --- |
| `POST /api/admin/appeals/<id>/lift` | `{ "note": "You were right, sorry." }` (optional) | Lifts the ban. The player is back to normal on their next request |
| `POST /api/admin/appeals/<id>/keep` | `{ "note": "The messages came from your account on three days." }` | Keeps the ban. The player reads the note in the ban sheet, so write it to them (3 to 300 characters). They can ask again a week later |

Seed corrections are only for fixing mistakes, never prizes or anything linked to money (`docs/SAFETY-REVIEW.md`). Any new kind of change that touches seeds goes to the lawyer first.

A ban takes effect on the player's next request. A match already under way finishes normally, but no rematch starts.

## Adding to it

New admin actions go in `worker/admin.ts`, log themselves with `log(action, detail)`, and get a row here. Anything that changes how seeds work goes to the lawyer before it's built.
