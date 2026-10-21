# The walkthrough for new players: research and plan

Researched 21 October 2026 for Yves, who asked for a walkthrough after a new player's first game, to get them started on the most important thing. Shown in `docs/controls-prototype.html` ("Walkthrough for new players"). **Approved by Yves and built on 21 October 2026:** `src/components/Tour.tsx`, `src/lib/tour.ts`, the Settings row "Show the tour again", `/api/tour` and the "Walkthrough for new players" section of the 8 am email. New players are those made from 22 October 2026 with 1 to 5 finished matches.

## What the research says

- **Short tours get finished.** Across 464 products, tours of 1 to 2 steps are finished about 73% of the time, and tours of 9 or more about 8%. The median for all tours is 29%.
- **Tours people open themselves do better.** Tours that start by themselves are finished about 23% of the time; ones the user opens, about 69%. Chameleon's 15 million interactions show the same: user-opened tours were finished 123% more often.
- **Showing progress helps.** A step count ("2 of 3") raised finishing by 12% and cut dismissals by 20%.
- **Duolingo doesn't tour its home screen.** It teaches by doing: the first lesson first, then one feature at a time when it matters, with short tips, slide-up cards and full-screen moments (the streak explained after the first lesson's streak).
- **Mobile guidance:** one short line per step (under 140 characters), always a visible Skip, and no long tutorials before people play. On Mobbin, MD Vinyl and monday.com use a card with "2 of 3" and Next, Mesh and Swiggy a dimmed screen with one part lit up, and Queue ends on "Let me try".

## The plan

1. **When:** on Home, right after the first game and the "What should we call you?" sheet. Never during a match. It takes that visit's one pop-up, so nothing else shows with it.
2. **Three steps, each lighting up one part of Home, with "1 of 3", Skip and Baba Ayo's face, in plain English:**
   1. **Quick match.** "Play people across Nigeria. Quick match finds you a player, or starts your own game for others to join."
   2. **The counters.** "Come back every day. Play once a day to grow your streak. Finish quests to earn Dara Seeds."
   3. **Your animal.** "This is you. Your title grows as you play. Tap here for your player code, so you never lose your progress."
3. **It ends on doing:** the last button is Find a player, which opens Quick match. Later or Skip just closes it, and a toast says the tour is in Settings.
4. **Then one tip at a time, when it matters,** like Duolingo. For example, after the third match, the game chip says there are 4 games. At most one tip a visit, and it takes that visit's pop-up.
5. **Settings: "Show the tour again".**
6. **Who sees it:** new players only, once. Existing players don't, but can open it from Settings.
7. **Counted, never kept per player:** tour shown, finished, skipped at which step, and whether they then joined Quick match, as counters in the 8 am email (`stat_days`). Whether this phone has seen it is kept on the phone only. Nothing new about players, so no privacy line.
8. **Light on phones:** the lit-up part is a cut-out in a dark layer; only opacity and transform move, and nothing moves with reduced motion. Works at 320 px wide, with the keyboard (Escape skips) and with a screen reader (each step is a dialog with its title).

## Sources

- Indie Hackers, "Onboarding benchmarks from real data across 464 SaaS products": https://www.indiehackers.com/post/onboarding-benchmarks-from-real-data-across-464-saas-products-median-tour-completion-is-29-6288651c93
- Chameleon, "What we learned analyzing 15 million product tour interactions": https://www.chameleon.io/blog/product-tour-benchmarks-highlights
- UserGuiding, "Duolingo onboarding UX": https://userguiding.com/blog/duolingo-onboarding-ux
- Appcues, "The essential guide to mobile user onboarding": https://www.appcues.com/blog/simple-mobile-onboarding
