import { describe, expect, it } from 'vitest';
import { overPairCap, PAIR_FLOW_MAX, quickQuit } from '../shared/stakes';
import { cleanName } from '../shared/protocol';
import { NAME_POOL } from '../src/lib/names';
import { nameProblem } from '../worker/names';

describe('player names', () => {
  it('lets every suggested name through', () => {
    for (const n of NAME_POOL) expect(nameProblem(n), n).toBeNull();
  });

  it('lets ordinary Nigerian names through, even ones with a short rude word inside', () => {
    const fine = [
      'Bassey', 'Dickson', 'Shittu', 'Nazir', 'Gambari', 'Dara Ade', 'Ọlá', 'Chukwuemeka', 'Ngozi', 'Babatunde',
      'Adaeze', 'Musa Bello', 'Hassan', 'Cassandra', 'Tobi', 'Obinna', 'Sexton', 'Kumasi', 'Dara Ekong',
      'Moderinola', 'Botswana Ben', 'Staffy', 'Ada 4 Real', 'Mumuni', 'Wale 99', 'Ayánṣọlá', 'Ayanshola', 'Ayantunde',
      'Ṣeun', 'Ọláṣùpọ̀', 'Àdìsá', 'Ifeanyi', 'Usman 2', 'Zainab',
    ];
    for (const n of fine) expect(nameProblem(n), n).toBeNull();
  });

  it('stops rude words, however they are spelled', () => {
    const rude = ['fuck', 'F U C K', 'Fuuuck', 'fvck boy', 'Fuuck', 'B1tch', 'b!tch queen', 'Ashawo', 'Olosho 1', 'werey', 'Ass', 'big ass', 'Shit', 'mumu', 'Mugu Boy', 'Ọ̀lọ̀ṣọ̀', 'Shege', 'N1gga', '$lut', 'p0rn', 'fuсk', 'Ｆｕｃｋ', 'Shit2', 'yansh'];
    for (const n of rude) expect(nameProblem(n), n).toBe('rude');
  });

  it('keeps names that pass for the game', () => {
    const taken = ['Baba Ayo', 'babaayo', 'BABA AYO 2', 'Dara', 'Dara X&O', 'DaraXO', 'Admin', 'Mod', 'The Bot', 'Support', 'Official Tunde', 'Yves Kwameh', 'Administrator', 'Bаba Ayo', 'Ｂａｂａ Ａｙｏ', 'Admin1', 'Admin0', 'Bot 3'];
    for (const n of taken) expect(nameProblem(n), n).toBe('reserved');
  });

  it('checks the name as it will be saved', () => {
    const n = cleanName('  Fuuuck   Boy ');
    expect(n).not.toBeNull();
    expect(nameProblem(n!)).toBe('rude');
  });
});

describe('seed farming rules', () => {
  it('caps how far one player can get ahead of the same opponent in a day', () => {
    expect(overPairCap(0, 1_000)).toBe(false);
    expect(overPairCap(4_000, 1_000)).toBe(false);
    expect(overPairCap(4_500, 1_000)).toBe(true);
    expect(overPairCap(PAIR_FLOW_MAX, 100)).toBe(true);
  });

  it('gives high tables three stakes of room', () => {
    expect(overPairCap(0, 10_000)).toBe(false);
    expect(overPairCap(20_000, 10_000)).toBe(false);
    expect(overPairCap(20_001, 10_000)).toBe(true);
    expect(overPairCap(0, 100_000)).toBe(false);
    expect(overPairCap(200_000, 100_000)).toBe(false);
    expect(overPairCap(250_000, 100_000)).toBe(true);
  });

  it('never blocks friends who trade wins', () => {
    // Up 1,000, then down 1,000: back to level, so the next win pays.
    expect(overPairCap(1_000 - 1_000, 1_000)).toBe(false);
    expect(overPairCap(-5_000, 1_000)).toBe(false);
  });

  it('pays nothing when the loser walks away before making 3 moves', () => {
    for (const reason of ['resign', 'abandon', 'timeout', 'idle']) {
      expect(quickQuit(reason, 0, 0), reason).toBe(true);
      expect(quickQuit(reason, 2, 0), reason).toBe(true);
      expect(quickQuit(reason, 3, 0), reason).toBe(false);
    }
  });

  it('only counts quits in the first game, so losing game 1 then quitting still costs the stake', () => {
    for (const reason of ['resign', 'abandon', 'timeout', 'idle']) expect(quickQuit(reason, 2, 1), reason).toBe(false);
  });

  it('pays as usual when the game was won on the board', () => {
    expect(quickQuit('line', 0, 0)).toBe(false);
    expect(quickQuit('line', 2, 0)).toBe(false);
  });
});
