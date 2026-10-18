/**
 * Which version of the Terms of play and the Privacy notice (src/legal/) a new player accepts by
 * tapping Play now. Saved on the player with the time (players.terms_version, terms_at), as the
 * record of what they agreed to. Change it whenever either text changes in a way that matters.
 */
export const TERMS_VERSION = '2026-10-18';

/**
 * What changed in each version, for the sheet that asks existing players to accept it
 * (src/screens/TermsUpdate.tsx). Newest first.
 */
export const TERMS_CHANGES: Record<string, string[]> = {
  '2026-10-18': [
    "You can play Baba Ayo without internet. The game keeps those matches on your phone until they're sent, and checks every move before they count.",
    "You can type short messages to the other player in a match. Messages can't share phone numbers, links or other ways to reach you outside the game, and we don't keep them.",
  ],
};
