# Typed messages in a match: the lines for the lawyer

Written 18 October 2026, for Yves to send to the lawyer, as part of one doc with the offline-play lines (`docs/NEXT-ROUND.md`, step 6).

**Approved by the lawyer on 18 October 2026:** the privacy notice line as written, and the terms line (section 2) too. Both are in `src/legal/privacy.md` and `src/legal/terms.md`. Because the terms changed, `TERMS_VERSION` went up to `2026-10-18` and every existing player accepts the new terms once, on the "We updated our terms" screen. Typed messages are on everywhere.

## What changed

Players could already send six fixed quick messages to the other player in a match ("Gbam!", "Haba!" and so on). On 18 October 2026 Yves asked for players to be able to type their own messages too. It is built and, since the approval, on everywhere (`TYPED_ON_REAL_GAME` in `shared/chat.ts` stays as a quick off switch).

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

## After the lawyer said yes (done 18 October 2026)

1. The approved line is in `src/legal/privacy.md` and the terms line in `src/legal/terms.md`, with `TERMS_VERSION` at `2026-10-18` in `shared/legal.ts` and what changed in `TERMS_CHANGES`.
2. `TYPED_ON_REAL_GAME = true` in `shared/chat.ts`.
3. Yves pushes and merges into `production` as usual.
