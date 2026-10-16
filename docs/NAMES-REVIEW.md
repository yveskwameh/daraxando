# Player names: words to check

16 October 2026. For the native speaker who checked the game's Yoruba, Igbo and Hausa words on 15 October 2026.

**Approved by the native speaker on 16 October 2026.** Any new word added to the list goes back to them first.

The game now refuses some words in player names (`worker/names.ts`). Most are English, but the list also has Pidgin, Yoruba, Igbo and Hausa words that Claude put together from what it knows. **Claude can be wrong about any of them**, so nothing here is final until you have checked it. The meanings below are Claude's understanding, not facts.

## How names are checked

Before checking, a name is changed to a plain form:

- Lower case, with accents and tone marks taken off (Ọ̀lá becomes ola). Yoruba ṣ becomes sh, so Ọlọ́ṣọ̀ reads as olosho.
- Letters from other alphabets that look like ours (a Russian а, a Greek ο) and wide letters (Ｂａｂａ) become plain letters, so nobody can fake "Baba Ayo" with them.
- Numbers and signs that look like letters become those letters (0 to o, 1 to i, 3 to e, 4 to a, 5 to s, 7 to t, @ to a, $ to s), and letters repeated three or more times count once. Whole words are also checked with the numbers left as gaps, so "Admin1" is still Admin.

Then each word is checked one of two ways:

- **Anywhere:** caught even inside a longer name, with spaces taken out ("a sha wo" and "ashawoking" are both caught). Only for words that never appear inside an ordinary name.
- **Whole word:** caught only as a word on its own, because it hides inside ordinary names ("ewu" would otherwise catch names with those letters in a row).

## The Nigerian-language words

| Word | Language | Claude's understanding | Checked |
| --- | --- | --- | --- |
| ashawo, ashewo | Pidgin | Prostitute | Anywhere |
| olosho | Pidgin, from Yoruba | Prostitute | Anywhere |
| werey, weyrey | Pidgin, from Yoruba | Mad person, used as an insult | Anywhere |
| yansh | Pidgin | Buttocks | Whole word (it hides inside Ayanshola) |
| mumu | Pidgin | Fool | Whole word |
| mugu | Pidgin | Fool, someone easy to cheat | Whole word |
| toto | Pidgin | Vulgar word for a woman's private parts | Whole word |
| omoale | Yoruba | Bastard | Anywhere |
| oloriburuku | Yoruba | Wretched or unlucky person, as a curse | Anywhere |
| agbaya | Yoruba | Grown person acting shamelessly | Anywhere |
| apoda | Yoruba | Idiot | Anywhere |
| oloshi | Yoruba | Wretch, good-for-nothing | Anywhere |
| olodo | Yoruba | Dunce | Whole word |
| oponu | Yoruba | Fool | Whole word |
| obo | Yoruba | Vulgar word for a woman's private parts | Whole word |
| anuofia | Igbo | Wild animal, as an insult | Anywhere |
| ewu | Igbo | Goat, as an insult | Whole word |
| wawa | Igbo | A name for people from parts of Enugu, sometimes used to mock | Whole word |
| daniska | Hausa | "Dan iska", a wayward or worthless person | Anywhere |
| shege | Hausa | Bastard | Anywhere |
| karuwa | Hausa | Prostitute | Anywhere |
| mahaukaci | Hausa | Mad person | Anywhere |
| nyamiri | Slur | Slur for Igbo people | Anywhere |
| ngbati | Slur | Slur for Yoruba people | Anywhere |
| kobokobo | Slur | Slur for Hausa and northern people | Anywhere |
| ofemmanu | Slur | Slur for Yoruba people ("palm oil soup") | Anywhere |

**Left out on purpose:** Gambari (a surname, though also used about Hausa people), Aboki (means friend), Mumuni (a name), Ayánṣọlá and Ayanshola (names; "yansh" is only caught on its own), Bassey, Dickson, Shittu and Nazir (they contain English rude words, so those English words are only caught as whole words).

## Names kept for the game

Names can't contain Baba Ayo, Dara X&O (any spelling), Yves Kwameh, Official, Administrator or Moderator, can't be exactly "Dara", and can't have Admin, Mod, Staff, Support, System or Bot as a word on its own. "Dara Ade" is fine.

## Questions

1. Is each word right, and rude enough to block? Should any come off the list?
2. Are there other common spellings we should catch?
3. Which common insults, slurs or sexual words in Pidgin, Yoruba, Igbo or Hausa are missing?
4. Do any of the "anywhere" words appear inside ordinary names or words? If so, they move to "whole word".
5. Is "wawa" offensive enough to block, or is it a normal nickname?

Changes go in `worker/names.ts`; `tests/safety.test.ts` checks that every name the game suggests still passes.
