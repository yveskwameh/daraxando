/**
 * Everything a player can collect. Four of each kind are open from the start and the rest
 * unlock by level. The art lives in the browser (src/art); the server only needs the ids
 * and levels so nobody can equip something they have not unlocked.
 */

export interface Item { id: string; name: string; lvl: number }

export interface AvatarItem extends Item { alt: string; story: string }
export interface PieceItem extends Item { short: string; pair: string }
export interface PrintItem extends Item { note: string }

export const AVATARS: readonly AvatarItem[] = [
  { id: 'tortoise', name: 'Tortoise', alt: 'Ijapa · Mbe', story: 'Wins with brains, not strength', lvl: 1 },
  { id: 'spider', name: 'Spider', alt: 'Gizo', story: 'The Hausa hero of tricks', lvl: 1 },
  { id: 'hare', name: 'Hare', alt: 'Zomo', story: 'Quick feet, quicker mind', lvl: 1 },
  { id: 'hen', name: 'Hen', alt: 'Adie · Okuko · Kaza', story: 'Runs the compound', lvl: 1 },
  { id: 'lizard', name: 'Agama lizard', alt: 'Alangba · Ngwere · Kadangare', story: 'Nods at every good move', lvl: 2 },
  { id: 'goat', name: 'Goat', alt: 'Ewure · Ewu · Akuya', story: 'Stubborn. Never gives up a square', lvl: 3 },
  { id: 'elephant', name: 'Elephant', alt: 'Erin · Enyi · Giwa', story: 'Never forgets a move', lvl: 4 },
  { id: 'hippo', name: 'Hippo', alt: 'Erinmi', story: 'Calm water, big bite', lvl: 5 },
  { id: 'crane', name: 'Crowned crane', alt: 'Golden crown', story: 'Rare, proud, unmissable', lvl: 6 },
  { id: 'eagle', name: 'Eagle', alt: 'Idi · Ugo · Gaggafa', story: 'Sharp eyes, high flight', lvl: 8 },
  { id: 'horse', name: 'Durbar horse', alt: 'Esin · Inyinya · Doki', story: 'Dressed for the Durbar', lvl: 10 },
  { id: 'fish', name: 'Argungu fish', alt: 'Eja · Azu · Kifi', story: 'The big catch of Kebbi', lvl: 12 },
  { id: 'parrot', name: 'Grey parrot', alt: 'Ayekooto · Icheoku · Aku', story: 'Always has the last word', lvl: 14 },
  { id: 'crocodile', name: 'Crocodile', alt: 'Oni · Agu iyi · Kada', story: 'Waits for the opening', lvl: 16 },
  { id: 'camel', name: 'Camel', alt: 'Rakumi', story: 'Goes the distance', lvl: 18 },
  { id: 'grasshopper', name: 'Grasshopper', alt: 'Tata · Ukpana · Fara', story: 'From an Igbo tale with Mbe the tortoise', lvl: 20 },
];

/** What you place on the board. Labelled "X & O" in the app. */
export const PIECES: readonly PieceItem[] = [
  { id: 'drum', name: 'Talking drum', short: 'drum', pair: 'calabash', lvl: 1 },
  { id: 'calabash', name: 'Calabash', short: 'calabash', pair: 'drum', lvl: 1 },
  { id: 'danfo', name: 'Danfo', short: 'danfo', pair: 'keke', lvl: 1 },
  { id: 'keke', name: 'Keke', short: 'keke', pair: 'danfo', lvl: 1 },
  { id: 'puff', name: 'Puff-puff', short: 'puff-puff', pair: 'chin', lvl: 3 },
  { id: 'chin', name: 'Chin chin', short: 'chin chin', pair: 'puff', lvl: 3 },
  { id: 'gele', name: 'Gele', short: 'gele', pair: 'fila', lvl: 6 },
  { id: 'fila', name: 'Fila', short: 'fila', pair: 'gele', lvl: 6 },
  { id: 'suya', name: 'Suya', short: 'suya', pair: 'bole', lvl: 9 },
  { id: 'bole', name: 'Bole', short: 'bole', pair: 'suya', lvl: 9 },
  { id: 'zobo', name: 'Zobo', short: 'zobo', pair: 'kunu', lvl: 12 },
  { id: 'kunu', name: 'Kunu', short: 'kunu', pair: 'zobo', lvl: 12 },
];

/** Original Ankara-inspired prints. The tiles are drawn in src/art/prints.ts. */
export const PRINTS: readonly PrintItem[] = [
  { id: 'line', name: 'Gbam Line', note: 'House print. Three in a row', lvl: 1 },
  { id: 'ripple', name: 'Ripple', note: 'After the classic "Record" rings', lvl: 1 },
  { id: 'anger', name: "A'nger", note: 'Tiv black and white stripes', lvl: 1 },
  { id: 'etu', name: 'Etu', note: 'Aso-oke indigo pinstripe', lvl: 1 },
  { id: 'swift', name: 'Swift', note: 'Speedbird. Money has wings', lvl: 2 },
  { id: 'fan', name: 'Fan', note: 'The electric fan print', lvl: 3 },
  { id: 'spiral', name: 'Kano Spiral', note: 'Dots circling a centre', lvl: 4 },
  { id: 'shards', name: 'Shards', note: 'Broken pots patchwork', lvl: 5 },
  { id: 'shell', name: 'Shell', note: 'Tortoise shell grid', lvl: 6 },
  { id: 'cowrie', name: 'Cowrie', note: 'The shells that were money', lvl: 7 },
  { id: 'adire', name: 'Adire Grid', note: 'Yoruba indigo blocks', lvl: 8 },
  { id: 'okra', name: 'Okra', note: 'Okra slices, seeds and all', lvl: 10 },
  { id: 'danfo', name: 'Danfo', note: 'Lagos yellow with the black band', lvl: 12 },
  { id: 'eyes', name: 'Eyes', note: 'The classic "Eyes" motif', lvl: 14 },
  { id: 'family', name: 'Family', note: 'Hen and eggs, after "La Famille"', lvl: 16 },
  { id: 'gold', name: 'Gold Record', note: 'For the ones at the top', lvl: 20 },
];

export const DEFAULT_PIECE = 'drum';
export const DEFAULT_PRINT = 'line';

const find = <T extends Item>(list: readonly T[], id: unknown) => list.find((x) => x.id === id);

export const avatarById = (id: string) => find(AVATARS, id) ?? AVATARS[0];
export const pieceById = (id: string) => find(PIECES, id) ?? PIECES[0];
export const printById = (id: string) => find(PRINTS, id) ?? PRINTS[0];

export const isAvatarId = (x: unknown): x is string => !!find(AVATARS, x);
export const isPieceId = (x: unknown): x is string => !!find(PIECES, x);
export const isPrintId = (x: unknown): x is string => !!find(PRINTS, x);

/** The piece your opponent shows when they picked the same one as you. */
export const pairOf = (id: string) => pieceById(id).pair;

/** Can a player at this level use this item? Unknown ids are never open. */
export function isOpen(list: readonly Item[], id: unknown, level: number) {
  const item = find(list, id);
  return !!item && item.lvl <= level;
}

/** Everything that opens at exactly this level, for the "Level 5 unlocks..." teaser. */
export function unlocksAt(level: number) {
  return [
    ...AVATARS.filter((a) => a.lvl === level).map((a) => `${a.name} avatar`),
    ...PRINTS.filter((p) => p.lvl === level).map((p) => `${p.name} print`),
    ...PIECES.filter((p) => p.lvl === level).map((p) => `${p.name} piece`),
  ];
}

/** The next level that unlocks anything, so the teaser never says "nothing new". */
export function nextUnlockLevel(level: number) {
  const all = [...AVATARS, ...PRINTS, ...PIECES].map((x) => x.lvl).filter((l) => l > level);
  return all.length ? Math.min(...all) : null;
}
