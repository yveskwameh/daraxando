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
| Live game card | Quick match sheet | Who is waiting (avatar, name, state, a teal "Waiting 12s" pill, which moves next to the state on phones under 360px), the mode and its rule, and the stake with the pot. Several games: swipeable cards that snap, the next one peeking in and dimmed, dots under them. Join is the one primary button and joins the card in the middle; "Start my own game" is a small button under it. Nobody waiting: a teal radar that keeps pulsing while it looks, "Looking for 12s" or "2 other players are looking", then Start my own game, with Change game or stake and Play Baba Ayo under it. Nothing starts by itself. |
| Record card | Settings | Win rate in teal, a bar split into wins (teal), draws (indigo) and losses (grey), and the best run with a Danfo star. |
| Rotate card | Phones in landscape | CSS only, in `index.html`. |
| Save sheet | You, Settings, first screen (Sign in) | Built 16 October 2026 for Yves's review. Title and one line on what you keep, Google's button, "or use your email", an email field and **Send me a code** (the one primary). Then **Check your email** with six code boxes: the board from the code email in one row (raised cells with Danfo Gabarito digits on a night tray), a blinking Danfo caret in the next box, a short shake and a pink message on a wrong code, **Use another email** and **New code in 30s** as small ghost buttons. |
| Google button | Save sheet | Google's dark style, not ours, because Google's rules ask for it: #131314 fill, a thin grey ring, Roboto, Google's mark on the left from Google's own file. A pill, the same height as our buttons. |
| Switch card | Save sheet, email link page, back from Google | The other player's card (avatar, "Saved player", name, title and seeds), then what happens to the player on this phone in plain words, **Play as {name}**, and **Keep {name}**. |
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
- Errors: match ended, room full, opened in another tab, not enough Dara Seeds, can't reach the game. Each says what happened and gives one way out.
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

## Open gaps

- A native speaker of Yoruba, Igbo and Hausa checks every word and animal name.
- Real-phone checks on a low-end Android and an iPhone (sound, haptics, install).
- A Nigerian gaming lawyer's written opinion on Dara Seeds: approved 15 October 2026.
