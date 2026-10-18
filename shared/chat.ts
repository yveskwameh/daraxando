/**
 * Messages players type in a match (Yves, 18 October 2026: everyone can type, with rules).
 *
 * Players can be 13 and are often strangers, so a typed message can't carry a way to reach
 * someone outside the game: no phone numbers, links, email addresses, @handles or the names of
 * chat apps. That check runs on the phone (so the player sees why at once) and again on the
 * server. Rude words are refused on the server only, with the names list (`rudeText` in
 * worker/names.ts), so the list never ships to phones. The other player can mute you for the
 * match. Messages are passed on and never stored or logged.
 *
 * On the real game only once the lawyer approves the privacy notice line for it
 * (docs/CHAT-REVIEW.md). Until then the test copy and the Mac have it, the real game doesn't.
 */

/** The longest message, in characters. */
export const MSG_MAX = 40;

/** Turn typing on for the real game, together with the new privacy notice line, once the lawyer says yes. */
export const TYPED_ON_REAL_GAME = false;

export const MSG_CONTACT = "Messages can't have phone numbers, links or social handles.";
export const MSG_RUDE = "That message isn't allowed.";

/**
 * Letters in any language, digits, spaces and plain punctuation. Emoji and other symbols drop
 * out as you type, as they do in names. @, _ and / stay so a handle or link is refused with a
 * reason instead of quietly turning into something else.
 */
export function cleanMessage(raw: string) {
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} .,!?'’\-:;()&@_/+#]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^ /, '')
    .slice(0, MSG_MAX);
}

const LINK = /(https?:|www\.|\.(com|ng|net|org|io|me|co|app|xyz|link|ly|gg|tv|info|biz|online|site|to)\b|\bdot ?com\b)/i;
const HANDLE = /@\s*[\p{L}\p{N}_]/u;
const APPS = /(whats?\s?app|watsap|wh?atsap|\bwa\.me|telegram|\bt\.me|instagram|\binsta\b|\bigs?\b|snap\s?chat|\bsnap\b|tik\s?tok|facebook|\bfb\b|twitter|discord|\bdm\b|\binbox me\b)/i;

/** True if the message carries a way to reach someone outside the game. */
export function hasContact(text: string) {
  if (LINK.test(text) || HANDLE.test(text) || APPS.test(text)) return true;
  // Phone numbers: six or more digits in a row, even with spaces, dots or dashes between them,
  // or seven or more digits anywhere in the message. Scores like "2 to 1" are fine.
  if (/\d(?:[\s.\-()+]*\d){5,}/.test(text)) return true;
  return (text.match(/\d/g) ?? []).length >= 7;
}
