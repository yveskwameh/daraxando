import { describe, expect, it } from 'vitest';
import { cleanMessage, hasContact, MSG_MAX } from '../shared/chat';
import { EMOTES } from '../shared/protocol';
import { rudeText } from '../worker/names';

describe('typed match messages (Yves, 18 October 2026)', () => {
  it('drops emoji and symbols as you type, keeps accents, and stops at the limit', () => {
    expect(cleanMessage('Nice one 😂🔥')).toBe('Nice one ');
    expect(cleanMessage('  Ẹ ku ise   o')).toBe('Ẹ ku ise o');
    expect(cleanMessage('x'.repeat(60))).toHaveLength(MSG_MAX);
  });

  it('refuses ways to reach someone outside the game', () => {
    for (const t of [
      '0803 123 4567', '+234 803 123 4567', '08031234567', 'call me 0803-123-4567', 'my number 080 31 23 45 67',
      'www.tobi.com', 'tobi.ng', 'see daraxo dot com', 'https://x.co',
      'tobi@gmail.com', 'follow @tobi', 'whatsapp me', 'my ig is tobi23', 'snap me', 'add me on telegram', 'dm me',
    ]) expect(hasContact(t), t).toBe(true);
  });

  it('lets ordinary game talk through, numbers and all', () => {
    for (const t of ['Gbam! 2 to 1', 'Nice one o', 'You too much', 'Good game, again?', 'I have won 5 games today', 'Best of 3 next', 'Haba! Level 1 to 1']) {
      expect(hasContact(t), t).toBe(false);
    }
    for (const e of EMOTES) expect(hasContact(e), e).toBe(false);
  });

  it('refuses rude words word by word, without catching words across the gaps', () => {
    for (const t of ['fuck you', 'f u c k', 'you be ashawo', 'mumu', 'shit move', 'b1tch']) expect(rudeText(t), t).toBe(true);
    for (const t of ['what happen is this', 'Bassey wins again', 'Dickson is sharp', 'Shittu played well', 'nice one', 'pass it on']) {
      expect(rudeText(t), t).toBe(false);
    }
    for (const e of EMOTES) expect(rudeText(e), e).toBe(false);
  });
});
