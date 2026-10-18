import { describe, expect, it } from 'vitest';
import { nDays } from '../shared/habits';
import { BABA_PUSH } from '../shared/notify';
import { BABA_LINES, babaLine } from '../shared/nudges';
import { streakNote } from '../worker/push';

// Yves, 17 October 2026: "one day", never "one days".
describe('counting days', () => {
  it('says 1 day and 2 days', () => {
    expect(nDays(1)).toBe('1 day');
    expect(nDays(2)).toBe('2 days');
    expect(nDays(30)).toBe('30 days');
  });

  it('never writes "1 days" in Baba Ayo nudges', () => {
    for (let i = 0; i < 300; i++) {
      for (const kind of ['risk', 'ended'] as const) {
        const line = babaLine(kind, { n: 1 });
        expect(line).not.toMatch(/\b1 days\b/);
        expect(line).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('never writes a bare "{n} days" in any line', () => {
    for (const l of [...BABA_LINES.RISK, ...BABA_LINES.ENDED, ...BABA_LINES.BACK, ...BABA_PUSH]) {
      expect(l, l).not.toMatch(/\{n\} days|\{d\} days/);
    }
  });

  it('never writes "1 days" in the 7 pm reminder', () => {
    for (let i = 0; i < 300; i++) {
      const { body } = streakNote(1);
      expect(body).not.toMatch(/\b1 days\b/);
      expect(body).not.toMatch(/\{\w+\}/);
    }
  });
});
