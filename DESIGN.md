# DESIGN.md: Dara X&O

Context file for anyone (designer, developer or AI tool) working on this project. Read it before touching the design or UI code, and update it when decisions change. The approved prototype is `docs/prototype.html`; the app now implements it.

## Product

- **What it is:** tic tac toe for Nigerian players, rooted in Nigeria. Quick matches matched by state and zone, friend rooms with a code, Baba Ayo (the game's bot), four modes, Aura and titles (JJC to Idan), Dara Seeds to stake, Ranks by state.
- **Who uses it:** mostly cheap Android phones on mobile data. One job each visit: get into a match fast, and feel rewarded after it.
- **Platforms:** phone web first, installable as an app (PWA). Portrait only on phones. Computers and tablets get a centred phone-width column on a faint print.
- **Style direction:** "Owambe Night". Indigo and fuchsia on midnight, Danfo yellow for rewards only, Ankara sticker buttons, folktale animals, Nigerian words in game moments. Flat colour, no gradients, no soft glow, no thick bottom-edge shadows. Learn from Duolingo's UX, not its look.

## Tokens

All in `src/styles/tokens.css`. One dark theme on purpose.

| Token | Value | Job | Do not use for |
| --- | --- | --- | --- |
| `--night` | #0b0a2a | Page and board background | Text |
| `--deep` | #17164a | Cards, sheets, nameplates | |
| `--raise` | #24226a | Chips, cells, tiles | |
| `--line` | #34318a | Borders, empty dots, locked bars | Text |
| `--indigo` / `--indigo-glow` | #3d27db / #9b8fff | You: your pieces, your score pips, "Play a friend" | The opponent |
| `--fuchsia` / `--fuchsia-glow` | #dc0fa1 / #ff4fb8 | The opponent's pieces, the main button, the logo sticker | Your pieces |
| `--danfo` | #ffc921 | Rewards only: Aura, wins, the timer bar, the winning line, the code | Errors, decoration |
| `--cream` | #fff4e0 | Sticker borders, selected tabs and chips, toasts | Large fills |
| `--teal` | #35d6c0 | "Play Baba Ayo" buttons (night text, 10.6:1) and "live" dots | Anything else |
| `--muted` | #b8b4e8 | Secondary text (9.8:1 on night, 8.6:1 on deep) | |

Pieces take their colours from the parent: `.me-c` (indigo) or `.op-c` (pink), through `--pm`, `--pd` and `--pl`. Colour is never the only signal: your piece and theirs are different shapes too.

### Type

| Style | Font | Use |
| --- | --- | --- |
| Headings and numbers | Gabarito Variable, 800 to 900 | Titles, buttons, scores, seeds, codes |
| Body | Onest Variable, 400 to 700 | Everything you read |
| Labels | Onest 700, caps, letter-spaced | Kickers, tile labels |

Onest's capital I and lowercase l look alike, so room codes skip I, L, O, 0 and 1, and numbers use Gabarito.

Line height: 1.15 for headings, 1.5 for body text and descriptions (Yves, 16 October 2026: titles and descriptions looked jammed together at 1.05). Descriptions under a sheet title are 14px; captions and notes 13px.

### Spacing

Set on 16 October 2026 because the sheets felt cramped (Yves). A 4px base on an 8px rhythm, the system Material Design, Apple and Atlassian all use, and one rule from Gestalt proximity: the closer two things sit, the more they belong together, so every space outside a group is bigger than the spaces inside it. Use the job tokens, never a raw number.

| Token | Value | Job |
| --- | --- | --- |
| `--space-pair` | 8px | A title and the line under it, a name and its detail (4px, `--sp-50`, inside a row or card) |
| `--space-item` | 12px | Things in one group: stacked buttons, rows, options, a field and its note |
| `--space-block` | 16px | The parts of a sheet |
| `--space-group` | 24px | A title block and what follows it, the content and the buttons that answer it |
| `--sheet-l` / `--sheet-r` | 20px | Sheet sides (screens keep 16px, `--gut-l` and `--gut-r`) |
| `--sheet-top` / `--sheet-bottom` | 16px / 24px | Sheet top under the handle, and bottom above the phone's safe area |

On short phones (640px tall or less) `--space-block` drops to 12px and `--space-group` to 20px, so every sheet still fits a 320 × 568 phone. The order of space never changes.

How sheets use them, in `src/styles/app.css`:

- `.titled` wraps a sheet's `h2` and its description: 8px between them, 24px before what follows.
- `.actions` wraps the buttons that close a sheet (a primary and a ghost): 12px between them, 24px above them.
- `.field-group` keeps a field and the line about it together (the code boxes and their status).
- Rows and cards (`.toggle-row`, `.opt`, `.row-card`, `.hcard`, titles, quests): 14px by 16px inside, a name 4px above its detail, 12px between rows.
- Empty states: icon, then title and line 8px apart, then the button 24px below.

## The logo: Sticker

"Dara" in Gabarito 900, with a fuchsia pill sticker reading "X&O", cream border, tilted -4 degrees and pressed right up against the word. Always written with the & symbol. Web addresses and handles spell it out: `daraxando`. App icons are rendered from the same design by `scripts/icons.cjs`.

## Components

| Component | Where | Notes |
| --- | --- | --- |
| Ankara sticker button (`.btn`) | Everywhere | Cream border, an original print filled tone-on-tone, a different print per kind: primary (Ripple on fuchsia), alt (Swift on indigo), baba (Shell on teal, for every "Play Baba Ayo"), ghost (Shards on raise). **Never tilted.** Press: squeezes, slides the print, sparks on primary. Three sizes, no bare text buttons: big printed primary (one per view), big ghost for the other way out, small (`.sm`) ghost or teal pills side by side under the primary for the other choices. |
| Deck (`Home`) | Home | Swipeable mode cards, active card centred, neighbours peeking. The middle card plays its demo game in CSS. Tapping a card opens the stake picker for that mode, same as Quick match. Plain dots; the active dot changes colour only. No duration tags. |
| Paused card | Match | Over the board when the other player leaves the app: "Paused", who left, and the seconds before you win. The timer bar freezes in grey. |
| Me chip | Home header | Avatar, your title (JJC to Idan, never "Level N"), Aura so far over the next title, and a Danfo bar. Opens You. |
| Title ladder | You, the title pill | All 20 titles in order: number, name, what it means, its language, what it opens, and the Aura it takes. Yours is indigo with a cream ring and scrolled into the middle. |
| Seeds chip | Home header | The seed icon (three grey Ayo seeds) and the balance. Opens the wallet. |
| Nameplate (`Plate`) | Match | Avatar, name, state, their piece, a draining timer bar. On their turn it tilts half a degree, gets a cream ring and shows their print. |
| Stamp | Match | GBAM! (you won the game), CHAI! (they did), NOTIN SPOIL (draw), slammed over the board. |
| Sheet | Choices | Native `<dialog>` from the bottom, with a grab handle and no line along its top edge. Drag it down, tap the dim space or press Escape to close it, and it slides down. The X sits on the title's line, only where there's room and no button already closes the sheet. The result sheet and the Next game sheet (between games of a series) are locked: every way out is a button. The result sheet has an X at the top right (Home), one primary button, then two small buttons side by side. A list inside a sheet scrolls with its bar at the sheet's right edge, outside the cards. |
| Baba Ayo's nudge | Home, streak sheet, celebration, leave sheet | His avatar sulking (a slow tilt, off in reduced motion and lite mode) and one line of Pidgin. On Home it is a pop-up with a teal ring, the same place as the install pop-up, with one teal button and X. |
| Install pop-up | Home only | Slides down from the top, over the screen, never in a layout. Shown at most every three days; closing it snoozes it for two weeks. |
| Notification ask (`PushAsk`) | Home (a streak of 2+ days, played today), a friend room while the host waits | Built 16 October 2026. The install pop-up's frame in two rows: a teal bell on a raised tile, a title and one line ("Keep your 3-day streak", "One reminder at 7 pm, only on days you haven't played."), X at the top right, then **Turn on** (cream pill, 44 px) under the words, so the words get the full width even at 320 px. Left-aligned wherever it shows. One ask per visit, never with another pop-up; X waits 3, 7, 14, then 30 days before that ask comes back. |
| Notification switches | Settings, after Baba Ayo's nudges | **Streak reminder** and **Friend joined your room**, the usual toggle rows. On an iPhone tab: one row saying to install the app first. Blocked on the phone: one row saying where to allow them. |
| Notification | The phone's own tray | The app icon, Baba Ayo or Dara X&O as the title, one line of Pidgin with the quick fix in it. Android's status bar badge is the X&O sticker in white on clear, slightly tilted. |
| Live game card | Quick match sheet | Who is waiting (avatar, name, state, a teal "Waiting 12s" pill, which moves next to the state on phones under 360px), the mode and its rule, and the stake with the pot. Several games: swipeable cards that snap, the next one peeking in and dimmed, dots under them. Join is the one primary button and joins the card in the middle; "Start my own game" is a small button under it. Nobody waiting: a teal radar that keeps pulsing while it looks, "Looking for 12s" or "2 other players are looking", then Start my own game, with Change game or stake and Play Baba Ayo under it. Nothing starts by itself. |
| Record card | Settings | Win rate in teal, a bar split into wins (teal), draws (indigo) and losses (grey), and the best run with a Danfo star. |
| Rotate card | Phones in landscape | CSS only, in `index.html`. |
| Save sheet | You, Settings, first screen (Sign in) | Built 16 October 2026 for Yves's review. Title and one line on what you keep, Google's button, "or use your email", an email field and **Send me a code** (the one primary). Then **Check your email** with six code boxes: the board from the code email in one row (raised cells with Danfo Gabarito digits on a night tray), a blinking Danfo caret in the next box, a short shake and a pink message on a wrong code, **Use another email** and **New code in 30s** as small ghost buttons. |
| Google button | Save sheet | Full width like every other button (Yves, 16 October 2026), built to Google's rules for a custom "Sign in with Google" button: Google's dark fill, grey ring and text colour, Google Sans Medium (cut down to letters, 5 KB, loads only with the button), "Continue with Google", and Google's G taken unchanged from their downloaded assets (`public/google/`). The one button in the game that isn't an Ankara sticker, because Google's rules ask for their look. |
| Switch card | Save sheet, email link page, back from Google | The other player's card (avatar, "Saved player", name, title and seeds), then what happens to the player on this phone in plain words, **Play as {name}**, and **Keep {name}**. |
| Ban sheet | Home and Ranks, for a banned player | Built 16 October 2026. "You can't play other people right now", the date, a **Why** card with the reason written to the player, one line on what still works (Baba Ayo, the streak; title, Aura and seeds are safe) and, in bold, where their ban review stands. Then **Play Baba Ayo** (primary), with **Ask for a review** and **Close** as small ghost buttons side by side (stacked, full width, under 390 px). The middle scrolls if the reason or the answer is long. **Ask for a review** opens a step with a 10 to 500 character box, **Send for review** and **Back**. Shows once each time the app opens, and again whenever Quick match, a mode card or Play a friend is tapped. |
| Watching from outside | Ranks, for a banned player | Yves, 16 October 2026: they see the tables through the window but can't join them. A card under the tabs, "Watching from outside" with a lock, that opens the ban sheet (one line on phones under 640 px tall). Their place is a dashed row with a lock instead of a number and "You'd be 6th", faded, not counted in the table: in the league, among the rows by their Aura this week; on the state and Nigeria tabs, pinned under the list. |
| Stake back | Result sheet | When a farming rule sends both stakes back, the seeds tile reads the stake with "Stake back" (as in a draw), and one line under the tiles says why, for example "Dayo left before making 3 moves, so both stakes went back. The win still counts." It takes the place of the daily seeds line. |
| Privacy notice and Terms of play | `/privacy`, `/terms`; a sheet from the first screen, Settings and the save sheet | Built 16 October 2026. Reading text at body size with 1.6 line height, up to 62 characters wide, `##` headings in Gabarito, a raised box for the short version, indigo bullets. Links in the text and in fine print are underlined in indigo-glow, bold, the one place text links are used, because they sit inside sentences. The page has Back on the left and the title; only the text scrolls. A link to the other document switches the sheet over to it. |
| Message bar (toast) | Everywhere | Yves, 16 October 2026: the old centred pill became a cramped box when the text ran long. Now a cream bar along the bottom, edge to edge like a sheet (rounded top corners, up to 460 px wide on big screens), that slides up and grows upward if the text is long. A teal tick for things that worked, a pink mark for errors, nothing for plain notes. It shows inside an open sheet, so a tap on it never lands on the sheet's buttons, lasts about 40 ms a character (2.6 to 6.5 seconds), and a tap closes it. Keep each message to one short sentence, ideally under 60 characters. |
| Email link page | `/c/…` | Wordmark, the player's avatar, "Sign in as Tunde" or "Save Amaka's player", the address, one primary button and **Not now**. Used or run-out links say so, with **Open Dara X&O**. |

## Rules

- No page ever scrolls. Only lists (Ranks, pickers, sheets with long content) scroll inside their own area. Check 320, 360 and 390 px wide.
- One primary (fuchsia) button per view.
- No one-sided lines on rounded shapes: no light line on top of a sheet, no coloured bar down one side of a card or row. Mark a group with a labelled divider row or a full ring instead.
- Danfo yellow means reward. Losing is never red.
- Instructions and settings in plain standard English. Game moments in the vetted Nigerian words in `docs/CULTURE.md`.

## States

- Loading: three hopping diamonds for screens, breathing rows for Ranks, "…" in result tiles until the reward lands.
- Empty: "Nobody ranked in Rivers yet" with a Play button.
- Errors: match ended, room full, opened in another tab, not enough Dara Seeds, can't reach the game, can't play other people (a banned player opening a friend link, with the lock icon), a refused name ("That name isn't allowed. Pick another one." under the name card). Each says what happened and gives one way out.
- Reconnecting banner. An opponent who drops shows "Lost connection · 14s" and you win if they don't return in 20 seconds.

## Motion

Only `transform` and `opacity` animate. Everything is CSS except the VS splash exit (Motion, lazy loaded with the match screen).

| Moment | How |
| --- | --- |
| Screen change | Fade and 14px lift, 260ms |
| Button press | Squeeze, print slides, sparks |
| Place a piece | Drops in with a little spin |
| Fading | The piece about to vanish wobbles at low opacity |
| Turn clock | A bar drains under the nameplate, turns pink for the last 3 seconds, soft ticks |
| Game end | Stamp slams, winning line turns Danfo |
| Match found | Both cards fly in, "Gbas gbos!" stamps, the pot pops |
| Deck demo | Each piece has its own keyframes, so the board plays a scripted game with no timers |
| Rewards | Aura counts up, level-up card pops |

Reduced motion: near-instant, except the turn clock, which is information. Demo boards show their final position. Low-end phones (`[data-lite]`): fewer sparks, no confetti, slower ambient loops.

## Sound and touch

- Music: a highlife loop synthesised live (talking drum, agogo bell, shekere, pluck), kept soft so it sits in the background. Starts on the first tap if switched on, pauses in the background.
- Effects: your piece is a rising talking drum, theirs a falling one, so you can tell them apart without looking.
- Haptics: Android vibration; on iPhone a hidden switch gives a light tap.
- Each has its own switch in You, Settings. Music also has a button in the header.

## Accessibility

- The board is real buttons with names ("Row 2, column 3, empty"). Arrow keys move, Enter places. Cells stay focusable when it's not your turn.
- Turn and result messages are announced (`aria-live`).
- 44px touch targets, visible Danfo focus ring.
- Contrast: white on fuchsia 4.5:1, white on indigo 8.4:1, night on Danfo 12.5:1. Button prints are tone-on-tone so they don't lower text contrast.

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-14 | React + Vite, not Next.js | Client app over WebSockets, static files are free, one dev server |
| 2026-10-14 | Owambe Night redesign approved and built | Rooted in Nigeria, gamified, light on cheap phones |
| 2026-10-14 | Name Dara X&O, Sticker logo with the sticker against the word | Yves's pick |
| 2026-10-14 | Gabarito + Onest | Yves's pick |
| 2026-10-14 | Aura (progress) and Dara Seeds (stakes) | Yves's names. Two currencies so losing a stake never costs progress |
| 2026-10-14 | No tilt on Home buttons, no duration tags on the Deck, demo games in the Deck | Yves's review |
| 2026-10-14 | Icons from our own SVG sprite, Lucide removed | Smaller download, one visual language |
| 2026-10-14 | No tilt on any button; teal Play Baba Ayo; tap a card to play; softer music | Yves's review on his phone |
| 2026-10-14 | Search widens every 4 s, Baba Ayo offered as soon as nobody is there, busier tables suggested | Nobody should wait long to learn nobody is there |
| 2026-10-14 | Leaving the app pauses the match; 60 s to come back | Yves's call |
| 2026-10-15 | Three button sizes, no bare text buttons | Yves: white text buttons didn't look like buttons and had no order |
| 2026-10-15 | Scrollbars at the right edge, outside the content; flat indigo pill on a thin line | Yves's review |
| 2026-10-15 | Quick match never starts a game by itself; it keeps looking and shows who else is looking | Yves: the countdown was too fast and unclear |
| 2026-10-15 | Inviting a friend: tap the code to copy, sharing keeps the sheet open, Start the game when they join | Yves's test on a second phone |
| 2026-10-15 | Fading is the default game and the first card on the Deck | Yves: it's the challenging one against a person |
| 2026-10-15 | Live now shows every waiting game as swipeable cards; the profile chip drops its Aura numbers | Yves's review on his phone |
| 2026-10-16 | Sign-in email: Baba Ayo's chat header, the code on the game board, editorial PLAY and CREATED BY, a giant cut-off wordmark | Yves picked parts of three of five options |
| 2026-10-16 | Ban sheet, stake-back line on the result sheet, name errors | Milestone 4 (safety), Yves's decisions on bans and farming |
| 2026-10-16 | Message bar: edge to edge along the bottom, with a tick or a mark, and shorter messages everywhere | Yves: the boxed toast looked cramped with long text |
| 2026-10-16 | Banned players watch Ranks and leagues from outside (dashed row for where they'd be), and ask for a ban review in the ban sheet | Yves: let them see it through the window so they reflect on what they did |
| 2026-10-16 | Notifications: our own ask at the right moment (Home with a streak, a friend room), in two rows; switches in Settings; Baba Ayo's Pidgin with the quick fix in the line | Yves: ask when it matters, come back later if closed, persuasive but clear |
| 2026-10-16 | Privacy notice and terms open in a sheet over whatever you're doing, and as pages at /privacy and /terms; underlined links only inside sentences | Reading them must never lose a player's place on the first screen or in Settings |
| 2026-10-16 | Spacing scale and job tokens (pair 8, item 12, block 16, group 24), sheets 20px at the sides, headings at 1.15 line height, the Google button full width | Yves: the sign-in sheet and many titles and descriptions felt jam-packed |

## Open gaps

- A native speaker of Yoruba, Igbo and Hausa checks every word and animal name.
- Real-phone checks on a low-end Android and an iPhone (sound, haptics, install).
- A Nigerian gaming lawyer's written opinion on Dara Seeds: approved 15 October 2026.
