/**
 * Progress: Aura, levels, rating and streaks.
 *
 * Aura is the game's experience points. Every finished match gives some, more for winning,
 * and it never goes down. Aura sets your level, and levels unlock avatars, prints and pieces.
 * Rating is separate: it moves up and down with quick match results and decides Ranks.
 */
import type { BotLevel } from './bot';

/** Quick match is rated. Friend and Baba Ayo games are not. */
export type Kind = 'quick' | 'friend' | 'bot';
export type Result = 'win' | 'loss' | 'draw';

export const START_RATING = 1000;
export const MIN_RATING = 100;
const ELO_K = 32;

/** Standard Elo: beat a stronger player and you gain more. */
export function eloDelta(mine: number, theirs: number, result: Result) {
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  return Math.round(ELO_K * (score - expected));
}

/** Aura for one finished match (a whole series, not each game). */
export const AURA_PVP: Record<'quick' | 'friend', Record<Result, number>> = {
  quick: { win: 60, draw: 30, loss: 15 },
  friend: { win: 40, draw: 20, loss: 10 },
};

export const AURA_BOT: Record<BotLevel, Record<Result, number>> = {
  jeje: { win: 10, draw: 5, loss: 5 },
  sharp: { win: 20, draw: 10, loss: 5 },
  agba: { win: 30, draw: 15, loss: 5 },
};

export function auraFor(kind: Kind, result: Result, level?: BotLevel) {
  if (kind === 'bot') return AURA_BOT[level ?? 'sharp'][result];
  return AURA_PVP[kind][result];
}

/** Win this many matches in a day for a bonus. */
export const DAILY_GOAL = 3;
export const GOAL_BONUS = 50;

/** Total Aura needed to reach a level. Level 2 at 100, level 3 at 300, level 10 at 4,500. */
export const auraForLevel = (level: number) => 50 * level * (level - 1);

/**
 * Players see a title, never "Level 3". Twenty Nigerian titles of respect, from the newcomer
 * (JJC) to the one who does the impossible (Idan), five each from Pidgin, Yoruba, Igbo and
 * Hausa, rotating so no language sits above another. Yves asked for this on 15 October 2026.
 * No royal titles (they would rank one people's king above another's), nothing political,
 * religious or tied to one artist. Every Yoruba, Igbo and Hausa title waits for the
 * native-speaker check (docs/CULTURE.md, "Titles"). Spelled without tone marks, like the
 * rest of the game's words.
 */
export const TITLES = [
  { name: 'JJC', lang: 'Pidgin', means: 'Johnny Just Come. New in town.' },
  { name: 'Jambite', lang: 'Campus slang', means: 'Fresh on campus. First year.' },
  { name: 'Sabi', lang: 'Pidgin', means: 'You know the game now.' },
  { name: 'Gwani', lang: 'Hausa', means: 'The skilled one.' },
  { name: 'Ogbonge', lang: 'Pidgin', means: 'Top quality. Original.' },
  { name: 'Ogidi', lang: 'Yoruba', means: 'The real deal. Solid.' },
  { name: 'Agu', lang: 'Igbo', means: 'The leopard.' },
  { name: 'Jarumi', lang: 'Hausa', means: 'The warrior.' },
  { name: 'Akoni', lang: 'Yoruba', means: 'The hero.' },
  { name: 'Dike', lang: 'Igbo', means: 'The brave one.' },
  { name: 'Gwarzo', lang: 'Hausa', means: 'The champion.' },
  { name: 'Gbajumo', lang: 'Yoruba', means: 'Everybody knows your name.' },
  { name: 'Omenka', lang: 'Igbo', means: 'Master of the craft.' },
  { name: 'Zaki', lang: 'Hausa', means: 'The lion.' },
  { name: 'Ojogbon', lang: 'Yoruba', means: 'The professor.' },
  { name: 'Ugo', lang: 'Igbo', means: 'The eagle. The highest honour.' },
  { name: 'Gagarumi', lang: 'Hausa', means: 'The formidable one.' },
  { name: 'Chief', lang: 'Pidgin', means: 'Everybody greets you.' },
  { name: 'Odogwu', lang: 'Igbo', means: 'The great one.' },
  { name: 'Idan', lang: 'Yoruba', means: 'The one who does the impossible.' },
] as const;

/** A level's title. Past the last one, the top title counts up: Idan 2, Idan 3. */
export function titleFor(level: number) {
  const top = TITLES.length;
  if (level <= top) return TITLES[Math.max(1, level) - 1].name;
  return `${TITLES[top - 1].name} ${level - top + 1}`;
}

/** What a level's title means, in plain English. */
export const titleMeans = (level: number) => TITLES[Math.min(Math.max(1, level), TITLES.length) - 1].means;

export function levelInfo(aura: number) {
  let level = 1;
  while (auraForLevel(level + 1) <= aura) level++;
  const floor = auraForLevel(level);
  const next = auraForLevel(level + 1);
  return { level, title: titleFor(level), nextTitle: titleFor(level + 1), into: aura - floor, span: next - floor, toNext: next - aura };
}

export const TIERS = [
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 1100 },
  { name: 'Gold', min: 1250 },
  { name: 'Platinum', min: 1400 },
  { name: 'Diamond', min: 1600 },
] as const;

export function tierOf(rating: number) {
  let tier: (typeof TIERS)[number] = TIERS[0];
  for (const t of TIERS) if (rating >= t.min) tier = t;
  return tier.name;
}

/**
 * The calendar day in Nigeria (West Africa Time, UTC+1, no daylight saving), so a day's
 * streak and daily cowries roll over at midnight where the players are.
 */
export const dayKey = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);

/** The streak after playing on `today`, given the last day played. */
export function nextDayStreak(streak: number, lastDay: string | null, today: string, yesterday: string) {
  if (lastDay === today) return Math.max(1, streak);
  if (lastDay === yesterday) return streak + 1;
  return 1;
}
