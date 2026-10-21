# System health in the admin dashboard: the plan

Researched 21 October 2026 for Yves, who asked for a card showing the live status of everything the game depends on. **Built the same day:** the checks are `worker/health.ts` (`GET /api/admin/health`), the card is on Today under Live now, and the full list is at `/health` in the dashboard (`admin/src/screens/Health.tsx`). States: Working, Needs a look, Down, Not set up, Unknown (couldn't be checked).

## What the game depends on

| Service | What breaks without it | How the card checks it |
|---|---|---|
| The game's server (the `daraxando` Worker) | Everything | Calls it and times the answer (`/api/admin/health`, new) |
| The database (D1) | Players, matches, Ranks, sign-in | A tiny read, timed, from the game's server |
| Matches and Quick match (Durable Objects) | Playing anyone | Asks the matchmaker how many are on Home (it already answers Live now) |
| The 7 pm streak reminders (Durable Object and cron) | Streak reminders | The last run: when, how many sent, how many failed (it already keeps this) |
| The 8 am report (cron) | Your morning email | When it last ran, from the database |
| Email (Resend) | Email sign-in codes, the 8 am email | Key set, codes sent today against the 90 a day cap, and Resend's own status page. It never sends a test email |
| Google sign-in | Continue with Google | Keys set, and when someone last signed in with Google |
| Notifications (Web Push) | Reminders and "friend joined" | Keys set, and the last 7 pm run's failures |
| Web Analytics | Growth's visits | Whether the read-only key answers |
| Cloudflare itself | Everything | Cloudflare's public status page, only the parts we use: Workers, D1, Durable Objects, Web Analytics |
| The free plan | The game "resting" at 1027 | Today's requests and database rows against the daily limits (the report already reads these) |
| Errors | Players seeing "Something broke" | Failed requests in the last hour, from Cloudflare's analytics |

## How it would look

Modelled on OpenAI Platform's "Service health" and Customer.io's "All services" list (Mobbin):

- **On Today:** one line at the top, "All systems working", or "1 problem: Email", with a coloured dot, an icon and the words, never colour alone. Tapping it opens the full list.
- **A Health page:** one row per service with its state (**Working**, **Slow**, **Down**, **Not set up**, **Unknown**), one plain line of detail ("Answered in 38 ms", "Last run 19:00: 214 sent, 0 failed"), and when it was checked. Then a Refresh button, Live and Test like everywhere else, and links to Cloudflare's and Resend's status pages.
- **Problems on Needs you:** anything Down shows there too.
- It refreshes every minute while the page is open and on screen, never in the background. The dashboard keeps each answer for 30 seconds, so several tabs don't multiply the checks.

## Free, and private

- Every check reads; nothing about players is kept, and nothing is shown about them, so the privacy notice doesn't change and the lawyer isn't needed.
- Calls to Cloudflare's and Resend's status pages are outside the game, cost nothing, and wait on the network, not the server's processing time.
- The checks run only when you open the dashboard. That's the limit of a card: it can't tell you about a problem at 3 am.

## Later, if you want alerts

A dashboard only helps while you're looking at it. To hear about problems without looking:

1. **A free outside monitor** (UptimeRobot or Better Stack's free plan) checks `/api/health` every few minutes and emails you when it fails. This is a setup step for you, no code.
2. **Or a 5-minute check inside the game** (a third cron job, the free plan allows 5) that emails you only when something changes from working to down. It uses a few emails, so it's off until you want it.

## Where it goes in the order

1. Health card (this plan): admin only, no lawyer. Built on 21 October 2026, before the push, so it goes out with player codes in one push.
2. Push everything.
3. Feature switches, the announcement banner, and notifying all players (that one needs the lawyer and the privacy notice first).
4. Baba Ayo's voice, then the voice files for Moonlight tale and Send the link.
