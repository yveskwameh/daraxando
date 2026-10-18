import { describe, expect, it } from 'vitest';
import { NAME_POOL } from '../shared/names';
import { cleanName } from '../shared/protocol';
import { freeNames, isNameClash, nameKey, nameProblem, numbered, takenNames } from '../worker/names';

/** A stand-in for D1 that knows which name keys are held, and by whom. */
function fakeDb(held: Record<string, string>) {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all() {
              const except = sql.includes('id <>') ? (args.at(-1) as string) : null;
              const keys = (except ? args.slice(0, -1) : args) as string[];
              return { results: keys.filter((k) => held[k] && held[k] !== except).map((k) => ({ name_key: k })) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('unique names (Yves, 17 October 2026)', () => {
  it('compares names without capitals, accents or extra spaces', () => {
    expect(nameKey('Durbar Queen')).toBe('durbar queen');
    expect(nameKey('DURBAR QUEEN')).toBe(nameKey('durbar queen'));
    expect(nameKey('Ọlá')).toBe(nameKey('Ola'));
    // A Cyrillic а looks like a Latin a.
    expect(nameKey('Bаba')).toBe(nameKey('Baba'));
    // Numbers make a different name.
    expect(nameKey('Tobi 2')).not.toBe(nameKey('Tobi'));
  });

  it('names are 3 to 16 letters', () => {
    expect(cleanName('Jo')).toBeNull();
    expect(cleanName('Ada')).toBe('Ada');
    expect(cleanName('x'.repeat(16))).toBe('x'.repeat(16));
  });

  it('keeps title names for the titles', () => {
    for (const n of ['Chief', 'idan', 'JJC', 'Sabi', 'Idan 2', 'Odogwu']) expect(nameProblem(n), n).toBe('reserved');
    for (const n of ['Chief Obi', 'Ugo Eze', 'Sabi Kid', 'Idanre Hills']) expect(nameProblem(n), n).toBeNull();
  });

  it('adds a number that fits in 16 letters', () => {
    expect(numbered('Tobi', 7)).toBe('Tobi 7');
    expect(numbered('Oba Market Mama', 42)).toBe('Oba Market 42');
    expect(numbered('Ogbunike Caver', 92)).toBe('Ogbunike 92');
    expect(numbered('Abcdefghijklmnop', 5)).toBe('Abcdefghijklmn 5');
    for (const p of NAME_POOL) expect(cleanName(numbered(p, 99)), p).not.toBeNull();
  });

  it('knows which names are taken, but not your own', async () => {
    const db = fakeDb({ tobi: 'p1', 'durbar queen': 'p2' });
    expect([...(await takenNames(db, ['TOBI', 'Ada']))]).toEqual(['tobi']);
    expect((await takenNames(db, ['Tobi'], 'p1')).size).toBe(0);
  });

  it('offers only free names, starting from what was typed', async () => {
    const held: Record<string, string> = { tobi: 'p1' };
    for (const p of NAME_POOL) held[nameKey(p)] = 'someone';
    const db = fakeDb(held);
    const ideas = await freeNames(db, 3, { wanted: 'Tobi' });
    expect(ideas).toHaveLength(3);
    expect(ideas[0]).toMatch(/^Tobi \d+$/);
    expect(ideas[1]).toMatch(/^Tobi \d+$/);
    for (const i of ideas) {
      expect(held[nameKey(i)], i).toBeUndefined();
      expect(nameProblem(i), i).toBeNull();
    }
    // Every pool name taken: the ideas still come, with numbers.
    const more = await freeNames(db, 4);
    expect(more).toHaveLength(4);
    for (const i of more) expect(held[nameKey(i)], i).toBeUndefined();
  });

  it('spots the database refusing a taken name', () => {
    expect(isNameClash(new Error('D1_ERROR: UNIQUE constraint failed: players.name_key: SQLITE_CONSTRAINT'))).toBe(true);
    expect(isNameClash(new Error('UNIQUE constraint failed: ledger.id'))).toBe(false);
  });
});
