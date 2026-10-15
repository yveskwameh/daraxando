# Dara X&O · multiplayer tic tac toe

Read `README.md` for the project map and `DESIGN.md` before any design or UI work. `docs/STACK.md` explains the stack and costs. The researched plans are `docs/MATCHMAKING.md`, `docs/GAME-MODES.md`, `docs/CULTURE.md` (look, pieces, avatars, voice, name) and `docs/PHONE-FEATURES.md` (install, portrait, sound, haptics, limits). `docs/prototype.html` is the approved redesign as a clickable prototype (the app now implements it) and `docs/logos.html` the logo options with the chosen Sticker. `docs/STAKES.md` is the design for staking Dara Seeds. `docs/RETENTION.md` is the research on the first game and on bringing players back, modelled on Duolingo (section 6 lists what Yves picked and what was built). `docs/style-lab.html` is the earlier, superseded round.

## Owner

Yves Kwameh, Design Engineer, Port Harcourt, Nigeria. Strong in Figma, Webflow and Framer, newer to backend work: explain new tools or patterns briefly when introducing them. When you need something from him, check your own tools first, then give numbered step-by-step directions.

## Audience

Nigerian players, mostly on cheap Android phones on mobile data. The game should feel rooted in Nigeria: its places, legends, culture and everyday language. Treat that as a design input, not decoration.

## Working on Yves's Mac copy

Yves edits files on his Mac too, and his edits win. His folder is the one real copy of the project (with Git and GitHub behind it); the copy in Claude's cloud workspace is only for building and testing, and goes away with the session. Before copying anything to his folder, find out what he changed: compare checksums of his files with what was last sent (and, once he has committed, `git --no-optional-locks status` on his Mac, which takes no lock files). Bring any file he changed into the container first, then merge. Send only the changed files, each written straight to its place in his folder: no archives, no extra copies, nothing left behind in his folder.

- **ngrok stays.** `vite.config.ts` lets ngrok addresses reach the dev and preview servers (`allowedHosts`), because Yves shares ngrok links with testers. Never remove it until the game is live, pushed to GitHub and on its real database, and Yves says to.

## Current phase: frontend first

Yves wants every screen, state and animation working and polished locally before any backend work. A local game server exists so screens can be tested with real matches. Do not start backend phase work (accounts, deploys, production hardening) until he says the frontend is signed off.

## Redesign status

Yves approved the prototype on 14 October 2026 and the redesign is built into the app: every screen, the server (series, modes, stakes, state matchmaking, Ranks by state) and the PWA. For new design changes, keep the habit: propose first (research, a prototype or screenshots), build after he says yes.

Decided by Yves:

- Name: **Dara X&O**, always with the & symbol wherever players see it (logo, app name, titles, copy). Web addresses and handles can't contain &, so they spell it out: `daraxando` (Yves checked: the spelled-out name is available). The Worker and database are named `daraxando` too.
- Logo: **option 3, the Sticker**: "Dara" with a fuchsia "X&O" pill sticker, cream border, pressed right up against the word. App icons come from `scripts/icons.cjs`.
- Colour: "Owambe Night", indigo and fuchsia on midnight, Danfo yellow for rewards only. One dark theme. Tokens are in `src/styles/tokens.css` and explained in `DESIGN.md`.
- Flat colour only. No purple-to-pink gradients, no soft glow everywhere, and no thick Duolingo-style bottom-edge shadow. Learn from Duolingo's UX, not its look.
- Fonts: **Gabarito** for headings and numbers, **Onest** for body text. Onest draws capital I and lowercase l almost the same, so room codes skip I, L, O, 0 and 1, and numbers use Gabarito.
- Buttons: the **Ankara sticker**. Cream border, filled with an original Ankara-style print, a different print per button. **No button is ever tilted**, anywhere in the app. Press squeezes, slides the print and throws sparks. Prints are tone-on-tone on buttons so text keeps AA contrast. Every "Play Baba Ayo" button is teal on the tortoise-shell print, so it stands out. The player's nameplate in a match tilts half a degree on their turn (it is not a button).
- No page scrolling on any screen. Only lists (Ranks, pickers) scroll inside their own area. Check 320, 360 and 390 px wide.
- Home layout: the **Deck** of swipeable mode cards, with the active card centred and the neighbours peeking on both sides. The card in the middle plays a short demo game of its mode on a loop. No duration tags on the cards. Tapping a card starts your own game of that mode: the stake picker, then the search screen, where you wait for someone to join (and where Baba Ayo is offered). Pagination dots are plain, tappable dots; the active dot changes colour, not size or shape.
- Home header: your title and Aura progress (not the rating), a clearly drawn seeds chip for Dara Seeds (three grey Ayo seeds), Ranks and music. The fire icon is the day streak and always says "N-day streak".
- Portrait only on phones: a "Turn your phone upright" card in landscape. Computers and tablets get a centred phone-width column.
- Installable web app (PWA). The install prompt is a pop-up that slides down from the top, over the screen, only in a browser tab and only now and then. It is never part of a layout. "Install the app" lives permanently in Settings. See `docs/PHONE-FEATURES.md`.
- Background music (live-synthesised talking drum loop, approved) plus sound effects plus haptics, each with its own switch. The music stays soft, in the background, never the main thing you hear.
- First visit is one screen and one tap (Yves, 15 October 2026: "let users play the game as fast as possible"). The app picks a legend name, a starter animal and a best guess at the state, shown on a "You play as" card with Change. **Play now** starts Classic against Baba Ayo at Jeje straight away. That first match is **one game, not a series** (Yves, 15 October 2026): lose or draw and the result offers Play again, one more game where you still open; win and Continue goes Home. The X at the top left leaves any time. It's `first` in `worker/match.ts`, allowed only for players with no finished matches, and it ends once they win or change the game. The tap is also the age confirmation: "By tapping Play now, you confirm you're 13 or older." A friend's invite link shows "{friend} invited you to a game" and **Join the game**. No sign-up before the first game.
- Players can change their name any time (You, pencil). No session or play limits, so no lives or energy.
- The daily habit layer, modelled on Duolingo (Yves, 15 October 2026; `docs/RETENTION.md` section 6, rules in `shared/habits.ts`, server in `worker/habits.ts`):
  - **Home:** two buttons under the Deck, the streak (grey flame until your first match of the day, then lit) and Quests.
  - **Streak sheet:** a Monday to Sunday week strip, Streak Freeze (200 Dara Seeds, hold 2, free at 7, 30 and 100 days), restore (500, up to 3 days after it ends), the streak stake (200 in, 400 back after 7 days) and milestones. A Friend streaks tab holds up to 5 friend streaks.
  - **After a match:** full-screen moments come first (streak on the first match of the day, streak stake won, quests done, badge stars), then the result sheet.
  - **Ranks:** opens on League, a weekly league of up to 30 real players by Aura this week, six leagues named after landmarks (Ikogosi, Olumo, Idanre, Obudu, Yankari, Zuma). Baba Ayo, tagged BOT, sets the pace. Never fake players.
  - **You:** opens on Badges (9 badges, 3 stars each). Settings sit behind a gear at the top right.
  - The UI says "stake", never "bet".
  - Use patterns players already know from other apps; don't invent new controls.
- The bot is **Baba Ayo** (the tortoise in a fila, with a BOT tag), with levels **Jeje**, **Sharp-sharp** and **Agba**. Every button says "Play Baba Ayo". Never use the word "practice" anywhere in the UI. Never write "Play Yves".
- **Quick match joins a game that's already waiting** (Yves, 15 October 2026). The button shows how many games are live ("3 live" with a teal dot) or, when none are, the game and stake it would start ("Classic · Free"). Home asks every 15 seconds while it's on screen. Tapping it opens a sheet with one waiting game at a time, nearest first, then longest waiting: who and where, the mode and its rule, and the stake. Whoever started a game set its stake, so the joiner never picks one and there's nothing to merge: **Join {name}** agrees to it, "Show another" moves on, "Start my own game" starts yours. If someone else got there first, it says so and shows the next. Nobody waiting: a 3-second countdown, then your own game with your last game and stake, so two people tapping at once still meet ("Start now", "Change game or stake", or X to cancel). Code: `live()` and targeted joins in `worker/matchmaker.ts`, `/api/live` in `worker/index.ts`, `src/sheets/LiveSheet.tsx`.
- Your own game (the search screen): the search route runs left to right (state, zone, all Nigeria, Baba Ayo) and widens every 4 seconds. The "Play Baba Ayo" card appears as soon as nobody else is searching at that table (after about 2.5 seconds), or at 8 seconds at the latest, while the search keeps going. If another table has players waiting, the search offers "Join them", which pairs instantly. Baba Ayo never starts on his own.
- Leaving the app mid-match (switching apps, locking the phone, losing signal) pauses the match: the turn clock freezes and nobody can move. The other player sees a Paused card with a countdown. Away for more than 60 seconds (`AWAY_MS`) and the other player wins. Baba Ayo games just wait.
- Between games of a series, nothing restarts on its own. A "Next game" sheet shows the score, and the next game starts when both players tap Next game. Once one has, the other gets 30 seconds (`NEXT_WAIT_MS`) or loses the match. The result sheet offers "Rematch" (same game), "Change game or stake" (mode and stake, the other player accepts) or, against Baba Ayo, "Change game or level".
- Play a friend has two tabs: "Invite a friend" (code and invite link) and "I have a code" (a field to type a friend's code).
- The host always finds out when their friend joins. A player hosts one room at a time, and the app watches it from any screen (`src/components/RoomWatch.tsx`). With the invite sheet open, the host goes straight into the match. Anywhere else, a pop-up slides down: "{friend} joined your room" with Play, or X to close the room. A match only starts when both players are in it and have the app on screen. Until then the friend sees where the host is (told, in another app, or not in the app) and can leave the room, which returns both stakes.
- Collections, all unlocked by title, 4 of each open for new players: 16 folktale avatars, 16 prints, 12 pieces. The pieces collection is labelled **"X & O"** so players know it is what they place on the board. Full lists in `docs/CULTURE.md`.
- Nigerian words and current viral phrases in game moments are approved ("Oya", "Gbam", "No rage bait me"). Use the vetted list in `docs/CULTURE.md`. Instructions and settings stay in plain standard English.
- Player names fuse a legend with their home and what it is known for (Amina of Zazzau gives "Durbar Queen"). Modern legends are famous moments, never living people.
- Modes: Classic 3×3 (3 in a row, best of 5), Fading 3×3 (best of 3), Big 5×5 (4 in a row, best of 3), Pro 7×7 (5 in a row, one game). See `docs/GAME-MODES.md`. No 12-spot board.
- Matchmaking by state and zone, Ranks with a state tab and an All Nigeria tab. See `docs/MATCHMAKING.md`.
- Staking: players stake points (never real money) before a match and the winner takes the pot. Design in `docs/STAKES.md`.
- Names: **Aura** is the experience points (it sets your title). **Dara Seeds** are the stake points (renamed from Dara Cowries on 15 October 2026, because another Nigerian games app uses cowries; Ayo is played with seeds). Never "XP", "Respect", "cowries" or plain "points" in the UI. Inside the code and the database they are still `cowries` (columns, fields, `DAILY_COWRIES`, the `Cowries` component), so no migration was needed. The Cowrie print in the collection keeps its name: it is a fabric pattern.
- **Titles, not level numbers** (Yves, 15 October 2026). Players never see "Level 3". Each level has a Nigerian title of respect, 20 in all from **JJC** (newcomer) to **Idan** (the one who does the impossible), five each from Pidgin, Yoruba, Igbo and Hausa, rotating so no language sits above another. Past Idan the top title counts up (Idan 2, Idan 3). No royal titles (that would rank one people's king above another's), nothing political, religious or tied to one artist. The list is `TITLES` in `shared/progression.ts`; the code still says "level" inside. The title pill on You opens the ladder (`src/sheets/TitlesSheet.tsx`). The word "level" in the UI now only means how hard Baba Ayo plays. The native speaker approved all 20 on 15 October 2026 (`docs/CULTURE.md`, "Titles").
- **Baba Ayo's nudges** (Yves, 15 October 2026, to see how it feels): Duolingo-owl guilt in Pidgin when your streak is at risk, when it has just ended, when you come back after days away, and when you leave a match against him. A pop-up on Home (at most once every 4 hours), a line in the streak sheet, the streak celebration and the leave sheet. Lines and rules are in `src/lib/babaNudge.ts`: guilt, drama and missing you are fine; insults, shame about who the player is, or anything about seeds are not. Players turn them off in Settings ("Baba Ayo's nudges").
- **Result sheet:** an X at the top right goes Home, then one primary button (Rematch, Play again or Accept rematch), then quiet text buttons ("Change game or stake/level", "Find a player" or "New opponent"). One clear next step, nothing competing with it.
- **Change the game sheet:** every choice is labelled. Mode tiles say the board and the goal ("3×3, three in a row") and the series; Baba Ayo's levels say Easy, Medium and Hard under Jeje, Sharp-sharp and Agba.
- **Sheets** (Yves, 15 October 2026): drag one down to close it (from anywhere except a scrolling list or a text field), tap the dim space above it, or press Escape. It slides down as it closes, the way it slid up. An X sits at the top right on the title's line, only where there's room and no button already closes the sheet (not on the streak sheet, which starts with tabs, nor the wallet, install, leave or "Make it yours" sheets). Locked sheets (the result, the next game) can't be dragged; the result's X goes Home. All of it lives in `src/components/Sheet.tsx`.
- Lists that scroll have a thin, rounded scrollbar in the game's colours (`--scroll-thumb`).
- You: the pencil turns into an X while you edit your name, with Cancel beside Save. Settings opens with your record: win rate, a bar split into wins (teal), draws (indigo) and losses (grey, never red), and your best run of wins.
- **No one-sided lines on rounded shapes** (Yves called them "vibe-coded"): no light line along the top of sheets, no coloured bar down one side of a card or row. The league table marks promotion and demotion with a labelled divider row ("Promotion zone", "Demotion zone") between rows instead.

Approved on 15 October 2026:

- A native speaker checked every Yoruba, Igbo and Hausa word and animal name, and then the 20 titles. New words in the game need the same check.
- A Nigerian gaming lawyer's written opinion on Dara Seeds (see `docs/STAKES.md`). The lawyer then approved `docs/COWRIES-REVIEW.md` too: the Streak Freeze, restore and streak stake, and the one-tap age confirmation on the first screen. Any further change to how seeds work, or to the age confirmation, goes back to the lawyer first.
- Retention ideas must never push players to stake more or chase losses. See `docs/RETENTION.md`, sections 3 and 4.

## Stack (decided, ask before changing)

- React 19, Vite 8, TypeScript. No Next.js: the game is a client app over WebSockets, and static files are free on Cloudflare.
- Cloudflare Workers + Durable Objects (one per match, one matchmaker) + D1, via `@cloudflare/vite-plugin`. `npm run dev` runs all of it locally and on the local network for phone testing. Not Supabase.
- Motion through `LazyMotion` and `m` components only (strict mode is on). Do not import `motion` components directly. It is only used inside the lazy match screen; everything else animates in CSS.
- Plain CSS. Every colour, size and timing is a token in `src/styles/tokens.css`.
- `partysocket` for reconnecting sockets. Every icon, piece and avatar is a symbol in `src/art/sprite.svg`, inlined into `index.html` by a small Vite plugin. Prints are drawn in code in `src/art/prints.ts`.
- `vite-plugin-pwa` for the manifest and service worker. Fonts from `@fontsource-variable/gabarito` and `@fontsource-variable/onest`.
- Node 22+, npm. GitHub for version control (private repo `daraxando`, pushed by Yves from the VS Code terminal). First push: 15 October 2026, commit `b91ba47`, CI green. Standard practice (Yves, 15 October 2026): everything is on GitHub, docs included, except what's rebuilt or private (`node_modules`, `dist`, `.wrangler`, `.dev.vars`, `.DS_Store`, `_to_delete`). The README gets a full rewrite once the backend is built, describing the settled workflow and features.
- **Secrets** never go in the code or on GitHub. Local: `.dev.vars` (today only `SESSION_SECRET`), with the names and fake values in `.dev.vars.example`. Live: `npx wrangler secret put NAME`, kept encrypted by Cloudflare. GitHub Actions secrets (a Cloudflare token for automatic deploys) go in the repository's Settings → Secrets and variables → Actions. Every new secret gets a line in `.dev.vars.example`, a field in `worker/env.ts`, and a row in the README's Secrets table.
- CI lives in `.github/workflows/ci.yml`. If that file is missing, create it before the first push: on every push to `main` and every pull request, check out, set up Node from `.nvmrc` with the npm cache, then `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. CI never deploys.

## Non-negotiables

1. **Light on low-end phones.**
   - Animate only `transform` and `opacity`. No animated `box-shadow`, `filter`, blur or layout.
   - Nothing re-renders faster than once a second. Smooth things (the turn ring) run as CSS animations.
   - First download stays under 100 KB of gzipped JavaScript. Check with `npm run build`.
   - New screens are lazy loaded in `src/App.tsx`. Heavy extras (confetti) load on first use.
   - `[data-lite]` on `<html>` marks low-memory devices. Ambient effects turn off there.
   - Respect `prefers-reduced-motion`. The turn clock is the one animation that keeps running, because it is information.
2. **The server decides.** Every rule lives in `shared/rules.ts` and is enforced in `worker/match.ts`. The browser may show a move early, never decide one.
3. **Cost.** Keep Durable Objects hibernatable: no `setTimeout` during a turn, no storage write per move. Read `docs/STACK.md` before changing anything in `worker/`.
4. **Accessibility.** Keyboard play on the board, visible focus, 44px touch targets, WCAG AA contrast, colour never the only signal.
5. **Every state designed.** Loading, empty, error, reconnecting, opponent left, room full.
6. **Privacy.** Store a player's chosen state only. Never coordinates, never raw IP addresses.

## Writing rules for any copy in the game

- Instructions, labels and settings: plain standard English, so nobody is confused about what a button does.
- Game moments (your move, win, loss, draw, waiting, rematch, timeouts): Pidgin and Nigerian words from the vetted list in `docs/CULTURE.md`, rotating across Yoruba, Igbo and Hausa. Never insults aimed at the player, vulgar, political, religious or ethnic terms.
- No em dashes. Use commas, "so", "because", "but", or a new sentence.
- Plain and matter-of-fact. Short. Every sentence starts with a capital letter.
- Baba Ayo's lines live in `worker/baba.ts` and follow the same rules.
- A native speaker checks every new Yoruba, Igbo and Hausa word before it ships (the words in the game on 15 October 2026 are approved).

## Before saying a task is done

```sh
npm run typecheck && npm test && npm run build
```

Then look at the change in a browser at 390px and 360px wide and in landscape, and check that no screen scrolls except lists. Never deploy or publish; Yves does that himself after review.
