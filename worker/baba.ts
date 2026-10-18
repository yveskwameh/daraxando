/**
 * What Baba Ayo says. He is the game's bot: an elder, warm, a little cheeky, never rude.
 * His lines in a match are the ones from before the copy pass (Yves, 18 October 2026: the match
 * screen keeps its Pidgin). Lines follow the writing rules in CLAUDE.md and use words from the
 * vetted list in docs/CULTURE.md.
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
    'My turn first. Jeje.',
  ],
  move: ['Hmm.', 'Your move.', 'I see you.', 'Jeje o.', 'Patience, my child.'],
  block: ['Not today.', 'Haba! I saw that one.', 'Patience, my child.', 'You thought.'],
  win: ['Gbam!', 'Shikena.', 'Baba still has it.'],
  lose: ['Yawwa! You got me.', 'Jisi ike. Well played.', 'You too much.'],
  draw: ['Notin spoil.', 'Gbas gbos! Nobody wins.', 'Level. Again?'],
  seriesWin: ['Shikena. Baba takes it. Again?', 'Ndo, my child. Run it back?'],
  seriesLose: ['Odogwu! You take it.', 'Yawwa. You beat Baba fair and square.'],
  seriesDraw: ['Notin spoil. We go again?'],
  emote: ['Hmm.', 'Jeje o.', 'Patience, my child.', 'Haba!', 'No rage bait me.'],
} as const;

export const line = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)];
