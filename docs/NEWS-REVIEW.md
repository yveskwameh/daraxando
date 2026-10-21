# News notifications: the lines for the lawyer

Written 21 October 2026, for Yves to send to the lawyer.

**Status:** approved on 21 October 2026, as written. The line is in `src/legal/privacy.md`. Built the same day: the switch in Settings, the sender in the dashboard (Controls, then News), `worker/controls.ts` and the `news` run in `worker/notifier.ts`.

## Why

Yves wants to tell players about new games and events, for example "Friday is Fading night. Find a player from 8 pm.", with a notification to everyone who wants them. Today players can only turn on two kinds of notification: the 7 pm streak reminder and "friend joined your room".

## What changes

1. **A third switch in Settings, "News from Dara X&O", off until the player turns it on.** Players who already have notifications on don't get news unless they turn this on too.
2. **What news can be:** new games, events and fixes to things that broke. Never about staking more Dara Seeds, never about buying anything (there's nothing to buy), and never more than 4 a month.
3. **How it's sent:** Yves writes it in the admin dashboard, sees how many phones it will reach, and sends it. It goes from our own server in small batches, like the 7 pm reminder. Nothing new is kept: we use the same notification details we already keep, with one more on or off setting.
4. **Separately, an in-app banner** (no notification, nothing kept): a short line at the top of Home for everyone, shown once per phone. We don't think it needs a privacy line, because it keeps nothing about players.

## 1. Privacy notice, "Notifications"

Add:

> - **News from Dara X&O:** only if you turn it on in Settings, a few notifications a month about new games and events.

## Questions for the lawyer

1. Is the player turning on "News from Dara X&O" enough consent for these notifications, under the Nigeria Data Protection Act 2023 and the GAID 2025?
2. Many players are under 18. Is a news switch, off by default and limited to 4 a month, fine for them, or should news be adults only?
3. Does "never about staking more Dara Seeds" need to be written into the terms, or is it enough as our own rule?
4. Does the in-app banner need anything in the privacy notice or terms, given it keeps nothing?

## After the approval

1. Put the approved line into `src/legal/privacy.md`.
2. Build the switch in Settings and the sender in the dashboard.
3. Push with the next batch.
