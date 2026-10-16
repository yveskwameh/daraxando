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
 */

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
