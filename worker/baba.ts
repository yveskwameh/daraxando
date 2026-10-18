/**
 * What Baba Ayo says. He is the game's bot: an elder, warm, a little cheeky, never rude.
 * He keeps a light Pidgin voice in his own lines (Yves, 17 October 2026, docs/COPY-PASS.md):
 * words most players would have to look up are left out. Lines follow the writing rules in
 * CLAUDE.md and use words from the vetted list in docs/CULTURE.md.
 */

export const LINES = {
  openerYou: [
    'Oya, you start. Baba is watching.',
    'Go first, my child. Take your time.',
    'Your move. No rush.',
  ],
  openerMe: [
    'Baba goes first. Shine your eye.',
    'I start this one. Watch and learn.',
    'My turn first. Slow and steady.',
  ],
  move: ['Hmm.', 'Your move.', 'I see you.', 'Easy o.', 'Patience, my child.'],
  block: ['Not today.', 'Haba! I saw that one.', 'Patience, my child.', 'You thought.'],
  win: ['Gbam!', 'Shikena.', 'Baba still has it.'],
  lose: ['Yawwa! You got me.', 'Well played, my child.', 'You too much.'],
  draw: ['Notin spoil.', 'Nobody wins this one.', 'Level. Again?'],
  seriesWin: ['Shikena. Baba takes it. Again?', 'Sorry o, my child. Run it back?'],
  seriesLose: ['Odogwu! You take it.', 'Yawwa. You beat Baba fair and square.'],
  seriesDraw: ['Notin spoil. We go again?'],
  emote: ['Hmm.', 'Easy o.', 'Patience, my child.', 'Haba!', 'No rage bait me.'],
} as const;

export const line = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)];
