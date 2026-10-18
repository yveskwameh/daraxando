# Typed messages in a match: the lines for the lawyer

Written 18 October 2026, for Yves to send to the lawyer. Nothing here is in the privacy notice or the terms yet. Sent as part of one doc with the offline-play lines (`docs/NEXT-ROUND.md`, step 6).

## What changed

Players could already send six fixed quick messages to the other player in a match ("Gbam!", "Haba!" and so on). On 18 October 2026 Yves asked for players to be able to type their own messages too. It is built and works on the test copy. It is switched off on the real game until the lawyer approves the wording below (`TYPED_ON_REAL_GAME` in `shared/chat.ts`).

How it works:

- A typed message goes only to the other player in that match, as a bubble that disappears after a few seconds. The game never stores or logs it, and our server keeps no copy.
- Up to 40 characters. Emoji and symbols are dropped as the player types.
- To stop strangers moving to a private chat (players can be 13): a message with a phone number, a link, an email address, an @handle or the name of a chat app (WhatsApp, Instagram, Telegram and others) is refused, and the player is told why.
- A message with a rude word is refused on the server, using the same word list the lawyer and the native speaker already approved for player names.
- The other player can mute you for the rest of the match. Baba Ayo, the game's bot, sometimes answers with one of his own lines.
- Nothing about seeds changes. The age line doesn't change.

## 1. Privacy notice, "What other players can see"

Now:

> - **The other player in a match:** the above, your moves and emotes, and whether you're in the app.

Proposed:

> - **The other player in a match:** the above, your moves, the messages you send them (the quick ones and the ones you type), and whether you're in the app. Messages go only to that player, for a few seconds, and we don't keep them.

## 2. Terms, "Playing fair" (optional)

The terms already say "insult, threaten or harass other players". The game blocks contact details in messages anyway, so this line is optional. If the lawyer wants it, add after that line:

> - use messages to share phone numbers, links or other ways to reach you outside the game;

## Questions for the lawyer

1. Is the privacy notice line above right as written?
2. Is the terms line needed? If it is, is it a change that matters enough to ask every existing player to accept the terms again? (The terms promise that. The sheet that asks would be built before the change goes live.)
3. Anything else needed because players aged 13 to 17 can now type to strangers, given the rules above?

## After the lawyer says yes

1. Put the approved line into `src/legal/privacy.md` (and the terms line into `src/legal/terms.md` if approved, bumping `TERMS_VERSION` in `shared/legal.ts` if the lawyer says it matters).
2. Set `TYPED_ON_REAL_GAME = true` in `shared/chat.ts`.
3. Push and merge into `production` as usual.
