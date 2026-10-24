// The cap on messages inside one live connection (worker/flood.ts).
import { describe, expect, it } from 'vitest';
import { Flood, FLOOD_CLOSE, FLOOD_CODE, FLOOD_MAX, FLOOD_WINDOW_MS } from '../worker/flood';

const socket = () => {
  const closed: number[] = [];
  return { ws: { close: (code: number) => closed.push(code) } as unknown as WebSocket, closed };
};

describe('message cap per connection', () => {
  it('lets real play through: Quick match ticks once a second', () => {
    const f = new Flood();
    const { ws } = socket();
    for (let t = 0; t < 60_000; t += 1_000) expect(f.allow(ws, t)).toBe(true);
  });

  it('drops messages past the cap, then lets them through in the next window', () => {
    const f = new Flood();
    const { ws, closed } = socket();
    for (let i = 0; i < FLOOD_MAX; i++) expect(f.allow(ws, 100)).toBe(true);
    expect(f.allow(ws, 200)).toBe(false);
    expect(closed).toEqual([]);
    expect(f.allow(ws, 100 + FLOOD_WINDOW_MS)).toBe(true);
  });

  it('closes a connection that keeps flooding, with a code the app reconnects on', () => {
    const f = new Flood();
    const { ws, closed } = socket();
    for (let i = 0; i < FLOOD_CLOSE; i++) f.allow(ws, 0);
    expect(closed).toEqual([]);
    expect(f.allow(ws, 0)).toBe(false);
    expect(closed).toEqual([FLOOD_CODE]);
    expect(FLOOD_CODE).toBeLessThan(4000);
  });

  it('counts each connection on its own', () => {
    const f = new Flood();
    const a = socket(), b = socket();
    for (let i = 0; i < FLOOD_MAX; i++) f.allow(a.ws, 0);
    expect(f.allow(a.ws, 0)).toBe(false);
    expect(f.allow(b.ws, 0)).toBe(true);
  });
});
