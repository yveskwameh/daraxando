/**
 * Player names that aren't allowed (docs/BACKEND.md, milestone 4): insults, slurs and sexual
 * words in English, Pidgin, Yoruba, Igbo and Hausa, and names that pass for the game itself
 * (Baba Ayo, Dara X&O, admin). Checked on the server whenever a name is set, so nothing here
 * ships to phones.
 *
 * The Nigerian-language words are a first list for the native speaker to check, correct and
 * add to (docs/NAMES-REVIEW.md). Like every new word in the game, they need that check.
 *
 * How a name is compared: lower case, accents off (Ọ̀ becomes o, and Yoruba ṣ becomes sh), look-alike digits and signs
 * turned back into letters (0 to o, 1 to i, 3 to e, 4 to a, 5 to s, 7 to t, @ to a, $ to s),
 * and letters repeated three or more times cut to one ("fuuuck"). Then two checks:
 *  - Whole words only, for short words that hide inside ordinary names: "ass" would catch
 *    Bassey, "dick" would catch Dickson.
 *  - Anywhere in the name with the spaces taken out, for longer words that don't, so "F U C K"
 *    and "fuckboy" are both caught.
 *
 * No two players share a name (Yves, 17 October 2026). `nameKey` is how two names are compared,
 * and `players.name_key` holds it with a unique index (migrations/0010_names.sql).
 */
import { NAME_POOL } from '../shared/names';
import { TITLES } from '../shared/progression';
import { NAME_MAX } from '../shared/protocol';

/** Caught anywhere in the name, spaces and dots removed. Only words no ordinary name contains. */
const ANYWHERE = [
  // English
  'fuck', 'fvck', 'phuck', 'bullshit', 'shithead', 'cunt', 'bitch', 'biatch', 'whore', 'slut', 'bastard', 'asshole',
  'arsehole', 'nigger', 'nigga', 'faggot', 'retard', 'rapist', 'porn', 'pussy', 'penis', 'vagina', 'blowjob', 'handjob',
  'dildo', 'motherf', 'wanker', 'twat', 'hitler',
  // Pidgin and Nigerian English
  'ashawo', 'ashewo', 'olosho', 'werey', 'weyrey',
  // Yoruba
  'omoale', 'oloriburuku', 'agbaya', 'apoda', 'oloshi',
  // Igbo
  'anuofia',
  // Hausa
  'daniska', 'shege', 'karuwa', 'mahaukaci',
  // Slurs aimed at peoples of Nigeria
  'nyamiri', 'ngbati', 'kobokobo', 'ofemmanu',
];

/**
 * Caught only as a whole word, because they hide inside ordinary names: "ass" in Bassey, "dick"
 * in Dickson, "shit" in Shittu, "nazi" in Nazir.
 */
const WHOLE_WORD = [
  'ass', 'arse', 'shit', 'dick', 'cock', 'tits', 'tit', 'boobs', 'cum', 'sex', 'anal', 'rape', 'fag', 'hoe', 'kkk',
  'nude', 'nudes', 'nazi', 'fuk',
  'mumu', 'mugu', 'olodo', 'oponu', 'toto', 'obo', 'ewu', 'wawa',
  // Hides inside Ayanshola (Ayánṣọlá) and other Ayan names.
  'yansh',
];

/** Names that pass for the game, its bot or the people who run it. */
const RESERVED_ANYWHERE = ['babaayo', 'daraxo', 'daraxando', 'darax&o', 'yveskwameh', 'official', 'administrator', 'moderator'];
const RESERVED_WORD = ['admin', 'mod', 'staff', 'support', 'system', 'bot'];

const LOOKS = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i', '|': 'i' } as Record<string, string>;

/** Cyrillic and Greek letters that look like Latin ones, so "Bаba Ayo" with a Cyrillic а is still caught. */
const ALIKE: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', ё: 'e', з: '3', і: 'i', ї: 'i', ј: 'j', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't',
  у: 'y', х: 'x', ѕ: 's', ԁ: 'd', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w', ь: 'b', α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k',
  ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ɑ: 'a', ɡ: 'g', ı: 'i',
};

/** Lower case, accents off, look-alike letters made Latin. Digits stay digits. */
function base(raw: string) {
  return raw
    // NFKD also turns full-width letters (Ｂａｂａ) into plain ones.
    .normalize('NFKD')
    // Yoruba ṣ is said "sh", so Ọlọ́ṣọ̀ reads as olosho, the way people type it without accents.
    .replace(/([sS])\u0323/g, '$1h')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\x00-\x7f]/g, (c) => ALIKE[c] ?? c)
    .replace(/(.)\1{2,}/g, '$1');
}

/** The same, with digits and signs that look like letters made into letters ("b1tch"). */
const plain = (raw: string) => base(raw).replace(/[01345@$7!|]/g, (c) => LOOKS[c] ?? c).replace(/(.)\1{2,}/g, '$1');

/** The titles players earn (JJC to Idan) aren't names: "Chief" or "Idan 2" alone would look like a rank. */
const TITLE_KEYS = new Set(TITLES.map((t) => t.name.toLowerCase()));

/**
 * A name as it's compared for "taken": lower case, accents off, look-alike letters made Latin,
 * single spaces. "Ọlá", "OLA" and "Ola" are the same name. Digits stay digits, so "Tobi 2" is
 * not "Tobi".
 */
export function nameKey(name: string) {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\x00-\x7f]/g, (c) => ALIKE[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}

export type NameProblem = 'rude' | 'reserved';

/** Why a cleaned name can't be used, or null if it can. */
export function nameProblem(name: string): NameProblem | null {
  const p = plain(name);
  const words = p.split(/[^a-z&]+/).filter(Boolean);
  // Whole words are also checked with digits as gaps, so "Admin1" is still Admin.
  const asTyped = base(name).split(/[^a-z&]+/).filter(Boolean);
  const anyWord = (list: string[]) => [...words, ...asTyped].some((w) => list.includes(w));
  const joined = words.join('');
  // Two letters doubled ("fuuck") aren't cut above, so also check with every double letter made single.
  const single = joined.replace(/(.)\1+/g, '$1');

  // "Dara" alone, or "Dara X&O" and its spellings, pass for the game. A real name like Dara Ade is fine.
  if (joined === 'dara' || RESERVED_ANYWHERE.some((w) => joined.includes(w))) return 'reserved';
  if (TITLE_KEYS.has(nameKey(name).replace(/ \d+$/, ''))) return 'reserved';
  if (anyWord(RESERVED_WORD)) return 'reserved';

  if (ANYWHERE.some((w) => joined.includes(w) || single.includes(w))) return 'rude';
  if (anyWord(WHOLE_WORD)) return 'rude';
  return null;
}

/** What to tell the player. */
export const NAME_PROBLEM_MESSAGE: Record<NameProblem, string> = {
  rude: "That name isn't allowed. Pick another one.",
  reserved: 'That name belongs to the game. Pick another one.',
};

export const NAME_TAKEN_MESSAGE = 'That name is taken. Pick another one.';

/**
 * A name with a number on the end ("Tobi 7"). Too long for 16 letters, it drops whole words from
 * the end first ("Oba Market Mama" gives "Oba Market 42"), and only cuts a word when it's one word.
 */
export function numbered(name: string, n: number) {
  const tail = ` ${n}`;
  const fits = (s: string) => [...s].length + tail.length <= NAME_MAX;
  const words = name.split(' ');
  while (words.length > 1 && !fits(words.join(' '))) words.pop();
  const base = words.join(' ');
  return (fits(base) ? base : [...base].slice(0, NAME_MAX - tail.length).join('')) + tail;
}

/** Which of these names other players already hold. */
export async function takenNames(db: D1Database, names: string[], exceptId?: string): Promise<Set<string>> {
  const keys = [...new Set(names.map(nameKey))];
  if (!keys.length) return new Set();
  const rows = await db
    .prepare(`SELECT name_key FROM players WHERE name_key IN (${keys.map(() => '?').join(',')})${exceptId ? ' AND id <> ?' : ''}`)
    .bind(...keys, ...(exceptId ? [exceptId] : []))
    .all<{ name_key: string }>();
  return new Set(rows.results.map((r) => r.name_key));
}

const shuffle = <T>(list: T[]) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

/**
 * Names nobody holds, checked in one read. With `wanted`, ideas built on it come first ("Tobi 7",
 * "Tobi 42"); then ideas from the pool, with a number when the pool name itself is taken.
 */
export async function freeNames(db: D1Database, count: number, opts: { wanted?: string; exceptId?: string } = {}): Promise<string[]> {
  const nums = shuffle(Array.from({ length: 97 }, (_, i) => i + 2));
  const mine = opts.wanted ? nums.slice(0, 6).map((n) => numbered(opts.wanted!, n)) : [];
  const pool = shuffle([...NAME_POOL]).slice(0, 8);
  // "FESTAC 77" already has its number.
  const poolNumbered = pool.filter((n) => !/\d/.test(n)).map((n, i) => numbered(n, nums[10 + i]));
  const all = [...mine, ...pool, ...poolNumbered].filter((n) => !nameProblem(n));
  const taken = await takenNames(db, all, opts.exceptId);
  const free: string[] = [];
  const seen = new Set<string>();
  // From what they typed, then the pool, then numbered pool names.
  const order = opts.wanted ? [...mine.slice(0, Math.min(2, count)), ...pool, ...mine.slice(2), ...poolNumbered] : [...pool, ...poolNumbered];
  for (const n of order) {
    const k = nameKey(n);
    if (seen.has(k) || taken.has(k) || nameProblem(n)) continue;
    seen.add(k);
    free.push(n);
    if (free.length === count) break;
  }
  return free;
}

/** True when a database error is the unique name index refusing a name someone just took. */
export const isNameClash = (err: unknown) => /UNIQUE constraint failed: players\.name_key/.test(String((err as Error)?.message ?? err));
