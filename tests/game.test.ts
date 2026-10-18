import { describe, expect, it } from 'vitest';
import { botMove, perfect } from '../shared/bot';
import { isOpen, pairOf, PIECES, PRINTS, AVATARS, unlocksAt, nextUnlockLevel } from '../shared/collections';
import { canPair, searchStage } from '../shared/matching';
import { maxGames, MODES, variantOf, winsNeeded } from '../shared/modes';
import { isStateCode, stateName, zoneOf } from '../shared/places';
import { auraFor, auraForLevel, dayKey, eloDelta, levelInfo, nextDayStreak, tierOf, titleFor, TITLES } from '../shared/progression';
import { cleanName, isRoomCode } from '../shared/protocol';
import {
  emptyBoard, emptyHist, fadingNext, findWin, legalMoves, lineThrough, other, outcomeAfter, place,
  type Board, type Hist, type Mark,
} from '../shared/rules';
import { fee, prize, sapaReady, short, tableLock } from '../shared/stakes';
import { NAME_POOL } from '../src/lib/names';

const board = (s: string): Board => s.replace(/\s/g, '').split('').map((c) => (c === 'X' || c === 'O' ? c : null));
const classic = variantOf('classic');
const fading = variantOf('fading');
const big = variantOf('big');
const pro = variantOf('pro');

describe('rules', () => {
  it('finds lines in every direction on 3×3', () => {
    expect(lineThrough(board('XXX......'), 1, 'X', 3, 3)).toEqual([0, 1, 2]);
    expect(lineThrough(board('O..O..O..'), 3, 'O', 3, 3)).toEqual([0, 3, 6]);
    expect(lineThrough(board('..X.X.X..'), 4, 'X', 3, 3)).toEqual([2, 4, 6]);
    expect(lineThrough(board('X...X...X'), 8, 'X', 3, 3)).toEqual([0, 4, 8]);
    expect(lineThrough(board('XX.......'), 0, 'X', 3, 3)).toBeNull();
  });

  it('needs four on 5×5 and five on 7×7', () => {
    const b5 = emptyBoard(5);
    [6, 7, 8].forEach((i) => (b5[i] = 'X'));
    expect(lineThrough(b5, 7, 'X', 5, 4)).toBeNull();
    b5[9] = 'X';
    expect(lineThrough(b5, 9, 'X', 5, 4)).toEqual([6, 7, 8, 9]);

    const b7 = emptyBoard(7);
    [0, 8, 16, 24].forEach((i) => (b7[i] = 'O'));
    expect(lineThrough(b7, 24, 'O', 7, 5)).toBeNull();
    b7[32] = 'O';
    expect(lineThrough(b7, 32, 'O', 7, 5)).toEqual([0, 8, 16, 24, 32]);
  });

  it('never wraps a line around the edge', () => {
    const b = emptyBoard(5);
    [3, 4, 5, 6].forEach((i) => (b[i] = 'X')); // end of row 1 and start of row 2
    expect(lineThrough(b, 4, 'X', 5, 4)).toBeNull();
    expect(lineThrough(b, 5, 'X', 5, 4)).toBeNull();
  });

  it('calls a full board with no line a draw', () => {
    const b = board('XOXXOOOX.');
    const next = place(b, emptyHist(), 8, 'X', classic);
    expect(outcomeAfter(next.board, 8, 'X', classic, 9)).toEqual({ kind: 'draw' });
  });

  it('removes your oldest piece in Fading', () => {
    let b = emptyBoard(3);
    let h: Hist = emptyHist();
    for (const [i, m] of [[0, 'X'], [4, 'O'], [1, 'X'], [5, 'O'], [8, 'X'], [6, 'O']] as [number, Mark][]) {
      const r = place(b, h, i, m, fading);
      b = r.board;
      h = r.hist;
    }
    expect(fadingNext(h, 'X', fading)).toBe(0);
    const r = place(b, h, 2, 'X', fading);
    expect(r.removed).toBe(0);
    expect(r.board[0]).toBeNull();
    expect(r.board[2]).toBe('X');
    expect(r.hist.X).toEqual([1, 8, 2]);
    // 0 just faded, so 1-2 is not three in a row any more.
    expect(outcomeAfter(r.board, 2, 'X', fading, 7)).toBeNull();
  });

  it('only wins Fading with the pieces still on the board', () => {
    // X has 0, 1 and plays 2, but 0 fades first: no win. O has 3, 4 and plays 5: a win.
    const h: Hist = { X: [0, 1, 7], O: [3, 4] };
    const b = board('XX.OO..X.');
    expect(findWin(b, h, 'X', fading)).toBe(-1);
    expect(findWin(b, h, 'O', fading)).toBe(5);
  });

  it('calls a long Fading game a draw', () => {
    const b = board('XO.......');
    expect(outcomeAfter(b, 1, 'O', fading, 30)).toEqual({ kind: 'draw' });
    expect(outcomeAfter(b, 1, 'O', fading, 29)).toBeNull();
  });

  it('knows the series lengths', () => {
    expect(winsNeeded(MODES.classic.bo)).toBe(3);
    expect(maxGames(MODES.classic.bo)).toBe(7);
    expect(winsNeeded(MODES.pro.bo)).toBe(1);
    expect(maxGames(MODES.pro.bo)).toBe(1);
  });
});

describe('Baba Ayo', () => {
  it('takes a win when it has one', () => {
    for (const level of ['jeje', 'sharp', 'agba'] as const) {
      expect(botMove(board('OO.XX....'), emptyHist(), 'O', classic, level, () => 0.99)).toBe(2);
    }
  });

  it('Sharp-sharp and Agba block', () => {
    expect(botMove(board('XX..O....'), emptyHist(), 'O', classic, 'sharp', () => 0.5)).toBe(2);
    expect(botMove(board('XX..O....'), emptyHist(), 'O', classic, 'agba')).toBe(2);
  });

  it('Agba never loses on 3×3, whatever the other side does', () => {
    let games = 0;
    const play = (b: Board, toMove: Mark, botMark: Mark): void => {
      const free = legalMoves(b);
      if (toMove === botMark) {
        const i = botMove(b, emptyHist(), botMark, classic, 'agba');
        const next = b.slice();
        next[i] = botMark;
        if (lineThrough(next, i, botMark, 3, 3) || legalMoves(next).length === 0) { games++; return; }
        return play(next, other(toMove), botMark);
      }
      for (const i of free) {
        const next = b.slice();
        next[i] = toMove;
        expect(lineThrough(next, i, toMove, 3, 3), `bot lost: ${next.map((c) => c ?? '.').join('')}`).toBeNull();
        if (legalMoves(next).length === 0) { games++; continue; }
        play(next, other(toMove), botMark);
      }
    };
    play(emptyBoard(3), 'X', 'O');
    play(emptyBoard(3), 'X', 'X');
    expect(games).toBeGreaterThan(100);
  });

  it('opens perfectly on 3×3', () => {
    // Every first move draws with perfect play, so all nine are equally good.
    expect(perfect(emptyBoard(3), 'X', classic)).toHaveLength(9);
  });

  it('Agba blocks and wins in Fading', () => {
    const h: Hist = { X: [0, 1], O: [4] };
    expect(botMove(board('XX..O....'), h, 'O', fading, 'agba')).toBe(2);
  });

  it('plays a legal move on big boards, and blocks an open line', () => {
    const b = emptyBoard(7);
    [22, 23, 24].forEach((i) => (b[i] = 'X'));
    b[0] = 'O';
    b[48] = 'O';
    const i = botMove(b, emptyHist(), 'O', pro, 'agba');
    expect(b[i]).toBeNull();
    expect([21, 25]).toContain(i);
    const j = botMove(emptyBoard(5), emptyHist(), 'O', big, 'sharp', () => 0.9);
    expect(j).toBeGreaterThanOrEqual(0);
  });
});

describe('progression', () => {
  it('turns Aura into levels', () => {
    expect(auraForLevel(1)).toBe(0);
    expect(auraForLevel(2)).toBe(100);
    expect(auraForLevel(10)).toBe(4500);
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, span: 100 });
    expect(levelInfo(150)).toMatchObject({ level: 2, into: 50, span: 200, toNext: 150 });
    expect(levelInfo(4500).level).toBe(10);
  });

  it('only suggests names the server accepts', () => {
    for (const n of NAME_POOL) expect(cleanName(n), n).toBe(n);
  });

  it('names every level with a title, never a number', () => {
    expect(TITLES).toHaveLength(20);
    expect(new Set(TITLES.map((t) => t.name)).size).toBe(20);
    expect(levelInfo(0)).toMatchObject({ title: 'JJC', nextTitle: 'Jambite' });
    expect(titleFor(10)).toBe('Dike');
    expect(titleFor(20)).toBe('Idan');
    expect(titleFor(21)).toBe('Idan 2');
    expect(titleFor(25)).toBe('Idan 6');
    // Five from each: Pidgin and campus slang, Yoruba, Igbo, Hausa.
    const by = (l: string[]) => TITLES.filter((t) => l.includes(t.lang)).length;
    expect([by(['Pidgin', 'Campus slang']), by(['Yoruba']), by(['Igbo']), by(['Hausa'])]).toEqual([5, 5, 5, 5]);
  });

  it('gives Aura for every result, more for winning', () => {
    expect(auraFor('quick', 'win')).toBeGreaterThan(auraFor('quick', 'draw'));
    expect(auraFor('quick', 'loss')).toBeGreaterThan(0);
    expect(auraFor('bot', 'win', 'agba')).toBe(30);
  });

  it('moves rating by Elo', () => {
    expect(eloDelta(1000, 1000, 'win')).toBe(16);
    expect(eloDelta(1000, 1000, 'loss')).toBe(-16);
    expect(eloDelta(1000, 1400, 'win')).toBeGreaterThan(16);
  });

  it('names tiers and keeps day streaks', () => {
    expect(tierOf(1000)).toBe('Bronze');
    expect(tierOf(1260)).toBe('Gold');
    expect(nextDayStreak(4, '2026-10-13', '2026-10-14', '2026-10-13')).toBe(5);
    expect(nextDayStreak(4, '2026-10-14', '2026-10-14', '2026-10-13')).toBe(4);
    expect(nextDayStreak(4, '2026-10-10', '2026-10-14', '2026-10-13')).toBe(1);
  });

  it('rolls the day over at midnight in Nigeria', () => {
    expect(dayKey(Date.UTC(2026, 9, 14, 22, 59))).toBe('2026-10-14');
    expect(dayKey(Date.UTC(2026, 9, 14, 23, 1))).toBe('2026-10-15');
  });
});

describe('stakes', () => {
  it('pays the pot, minus the fee on high tables', () => {
    expect(prize(1000)).toBe(2000);
    expect(fee(5000)).toBe(0);
    expect(prize(10000)).toBe(19000);
    expect(prize(100000)).toBe(190000);
  });

  it('explains locked tables', () => {
    const now = Date.UTC(2026, 9, 14);
    const old = { level: 3, cowries: 12_500, createdAt: now - 30 * 86_400_000, coolUntil: 0 };
    expect(tableLock(0, old, now)).toBe('');
    expect(tableLock(5000, old, now)).toBe('');
    expect(tableLock(50000, old, now)).toBe('Opens at Dike');
    expect(tableLock(50000, { ...old, level: 10 }, now)).toBe('You need 50,000');
    expect(tableLock(5000, { ...old, createdAt: now - 86_400_000 }, now)).toBe('Opens after your first week');
    expect(tableLock(10000, { ...old, coolUntil: now + 5 * 60_000 }, now)).toBe('Take a break. Opens in 5 min');
  });

  it('only gives Sapa relief when it is due', () => {
    const now = Date.UTC(2026, 9, 14);
    expect(sapaReady(300, 0, now)).toBe(true);
    expect(sapaReady(600, 0, now)).toBe(false);
    expect(sapaReady(300, now - 3_600_000, now)).toBe(false);
  });

  it('shortens big numbers for the header', () => {
    expect(short(950)).toBe('950');
    expect(short(9500)).toBe('9,500');
    expect(short(12500)).toBe('12.5k');
    expect(short(100000)).toBe('100k');
  });
});

describe('collections and places', () => {
  it('opens four of each from the start', () => {
    for (const list of [AVATARS, PIECES, PRINTS]) expect(list.filter((x) => x.lvl === 1)).toHaveLength(4);
    expect(isOpen(AVATARS, 'tortoise', 1)).toBe(true);
    expect(isOpen(AVATARS, 'eagle', 7)).toBe(false);
    expect(isOpen(AVATARS, 'baba', 99)).toBe(false);
    expect(pairOf('suya')).toBe('bole');
    expect(unlocksAt(2)).toContain('Agama lizard avatar');
    expect(nextUnlockLevel(20)).toBeNull();
  });

  it('knows every state and its zone', () => {
    expect(isStateCode('RI')).toBe(true);
    expect(isStateCode('XX')).toBe(false);
    expect(stateName('RI')).toBe('Rivers');
    expect(stateName('NONE')).toBe('Nigeria');
    expect(zoneOf('LA')).toBe('SW');
    expect(zoneOf('OUT')).toBeNull();
  });
});

describe('names and codes', () => {
  it('cleans names and keeps Nigerian letters', () => {
    expect(cleanName('  Palm   Oil Baron ')).toBe('Palm Oil Baron');
    expect(cleanName('Ọlá')).toBe('Ọlá');
    expect(cleanName("A'nger <b>")).toBe("A'nger b");
    expect(cleanName('a')).toBeNull();
    expect(cleanName('x'.repeat(17))).toBeNull();
  });

  it('only accepts room codes from the safe alphabet', () => {
    expect(isRoomCode('K7P2Q')).toBe(true);
    expect(isRoomCode('KIP2Q')).toBe(false);
    expect(isRoomCode('K7P2')).toBe(false);
  });
});

describe('quick match search', () => {
  it('widens every 4 seconds', () => {
    expect(searchStage(0)).toBe(0);
    expect(searchStage(3_999)).toBe(0);
    expect(searchStage(4_000)).toBe(1);
    expect(searchStage(8_000)).toBe(2);
    expect(searchStage(12_000)).toBe(3);
    expect(searchStage(600_000)).toBe(3);
  });

  it('pairs state first, then zone, then Nigeria, then anyone', () => {
    const rivers = { state: 'RI' };
    const delta = { state: 'DE' };
    const lagos = { state: 'LA' };
    const abroad = { state: 'OUT' };
    expect(canPair(rivers, { state: 'RI' }, 0)).toBe(true);
    expect(canPair(rivers, delta, 0)).toBe(false);
    expect(canPair(rivers, delta, 1)).toBe(true);
    expect(canPair(rivers, lagos, 1)).toBe(false);
    expect(canPair(rivers, lagos, 2)).toBe(true);
    expect(canPair(rivers, abroad, 2)).toBe(false);
    expect(canPair(rivers, abroad, 3)).toBe(true);
  });
});

/* ---------------------------------------------------------------- habits: streak, quests, badges, leagues */

import {
  BET_DAYS, BET_WIN, FREEZE_MAX, addDays, betNow, canRepair, emptyHabits, leagueMove, leagueZones, playBadges, playQuests,
  playStreak, questsFor, questsToday, restoreStreak, streakNow, weekKey,
} from '../shared/habits';

describe('day streak', () => {
  const d0 = '2026-10-01';
  const play = (h: ReturnType<typeof emptyHabits>, streak: number, day: string) => playStreak(h, streak, day);

  it('grows by one per day and only once a day', () => {
    const h = emptyHabits();
    let s = play(h, 0, d0).streak;
    expect(s).toBe(1);
    expect(play(h, s, d0).extended).toBe(false);
    s = play(h, s, addDays(d0, 1)).streak;
    expect(s).toBe(2);
  });

  it('uses a Streak Freeze for a missed day, and breaks without one', () => {
    const h = emptyHabits();
    let s = play(h, 0, d0).streak;
    h.freezes = 1;
    expect(streakNow(h, s, addDays(d0, 2))).toMatchObject({ streak: 1, freezing: 1, freezes: 0 });
    const step = play(h, s, addDays(d0, 2));
    s = step.streak;
    expect(step).toMatchObject({ streak: 2, usedFreezes: 1, broke: 0 });
    expect(h.freezes).toBe(0);
    expect(h.frozen).toContain(addDays(d0, 1));
    expect(streakNow(h, s, addDays(d0, 4)).streak).toBe(0);
    expect(play(h, s, addDays(d0, 4))).toMatchObject({ streak: 1, broke: 2 });
  });

  it('gives a free Streak Freeze at 7 days, never more than the maximum', () => {
    const h = emptyHabits();
    h.freezes = FREEZE_MAX;
    let s = 0;
    let m = null;
    for (let i = 0; i < 7; i++) {
      const step = play(h, s, addDays(d0, i));
      s = step.streak;
      if (step.milestone) m = step.milestone;
    }
    expect(s).toBe(7);
    expect(m).toMatchObject({ days: 7, freeze: 1 });
    expect(h.freezes).toBe(FREEZE_MAX);
  });

  it('restores an ended streak before and after a new one starts', () => {
    const a = emptyHabits();
    let s = 0;
    for (let i = 0; i < 5; i++) s = play(a, s, addDays(d0, i)).streak;
    // Missed two days, nothing played since: restore, then today adds one.
    const today = addDays(d0, 7);
    expect(streakNow(a, s, today).restorable?.n).toBe(5);
    expect(restoreStreak(a, s, today)).toEqual({ ok: true, streak: 5 });
    expect(play(a, 5, today).streak).toBe(6);

    const b = emptyHabits();
    s = 0;
    for (let i = 0; i < 4; i++) s = play(b, s, addDays(d0, i)).streak;
    // Missed a day, then played: a new streak of 1. Restoring joins them.
    s = play(b, s, addDays(d0, 5)).streak;
    expect(s).toBe(1);
    expect(streakNow(b, s, addDays(d0, 5)).restorable?.n).toBe(4);
    expect(restoreStreak(b, s, addDays(d0, 5))).toEqual({ ok: true, streak: 5 });
    // Too late after a few days.
    const c = emptyHabits();
    s = play(c, 0, d0).streak;
    s = play(c, s, addDays(d0, 1)).streak;
    expect(streakNow(c, s, addDays(d0, 6)).restorable).toBeNull();
  });

  it('never offers to restore a 1-day streak (Yves, 18 October 2026)', () => {
    const h = emptyHabits();
    let s = play(h, 0, d0).streak;
    // Played one day, missed the next, played today.
    const step = play(h, s, addDays(d0, 2));
    s = step.streak;
    expect(step.broke).toBe(1);
    expect(canRepair(step.broke)).toBe(false);
    expect(streakNow(h, s, addDays(d0, 2)).restorable).toBeNull();
    expect(restoreStreak(h, s, addDays(d0, 2)).ok).toBe(false);
    expect(canRepair(2)).toBe(true);
  });

  it('pays the streak bet after 7 days, and loses it when the streak ends', () => {
    const h = emptyHabits();
    let s = play(h, 0, d0).streak;
    h.bet = { stake: 200, days: 1, placed: d0, status: 'on', ended: null };
    let last = null;
    for (let i = 1; i < BET_DAYS; i++) last = play(h, s = s + 0, addDays(d0, i));
    expect(last?.bet).toEqual({ result: 'won', paid: BET_WIN });
    expect(h.bet.status).toBe('won');

    const g = emptyHabits();
    s = play(g, 0, d0).streak;
    g.bet = { stake: 200, days: 1, placed: d0, status: 'on', ended: null };
    expect(betNow(g, s, addDays(d0, 3))?.status).toBe('lost');
    expect(play(g, s, addDays(d0, 3)).bet).toEqual({ result: 'lost' });
  });
});

describe('daily quests', () => {
  it('gives everyone win 3 plus two daily quests, the same all day', () => {
    const q = questsFor('player-1', '2026-10-15');
    expect(q[0]).toBe('win3');
    expect(new Set(q).size).toBe(3);
    expect(questsFor('player-1', '2026-10-15')).toEqual(q);
  });

  it('counts matches and finishes quests once', () => {
    const h = emptyHabits();
    const day = '2026-10-15';
    const ids = questsFor('p', day);
    const e = { kind: 'friend' as const, mode: 'fading' as const, result: 'win' as const };
    playQuests(h, 'p', day, e, 0);
    playQuests(h, 'p', day, e, 1);
    const done = playQuests(h, 'p', day, e, 2);
    expect(done.some((d) => d.id === 'win3' && !d.paid)).toBe(true);
    const list = questsToday(h, 'p', day, 3);
    expect(list.map((x) => x.id)).toEqual(ids);
    expect(list[0].done).toBe(true);
  });
});

describe('badges and leagues', () => {
  it('awards each star once', () => {
    const h = emptyHabits();
    const win = { kind: 'bot' as const, mode: 'pro' as const, result: 'win' as const, level: 'agba' as const };
    const first = playBadges(h, win, null);
    expect(first.map((b) => b.id).sort()).toEqual(['agba', 'pro']);
    expect(playBadges(h, win, null).length).toBe(0);
  });

  it('starts weeks on Monday, Nigeria time', () => {
    expect(weekKey('2026-10-15')).toBe('2026-10-12');
    expect(weekKey('2026-10-12')).toBe('2026-10-12');
    expect(weekKey('2026-10-18')).toBe('2026-10-12');
  });

  it('moves the top up and the bottom down, but not in small leagues', () => {
    expect(leagueZones(30, 2)).toEqual({ up: 7, down: 5, beatBaba: false });
    expect(leagueZones(4, 0)).toEqual({ up: 1, down: 0, beatBaba: true });
    expect(leagueMove(1, 4, 0, 200, 150)).toBe('up');
    expect(leagueMove(1, 4, 0, 100, 150)).toBe('stay');
    expect(leagueMove(4, 4, 0)).toBe('stay');
    expect(leagueMove(30, 30, 3)).toBe('down');
    expect(leagueZones(30, 5).up).toBe(0);
  });
});
