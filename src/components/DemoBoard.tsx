/**
 * A little board that plays a short, scripted game of a mode on a loop, so a new player
 * sees how each mode works before they pick it.
 *
 * It runs entirely on CSS animations (opacity and transform only), with no timers and no
 * re-renders. Cards that are not in front show the final position instead of playing, and
 * so does everyone who asked their phone to reduce motion.
 */
import type { CSSProperties } from 'react';
import { pairOf } from '../../shared/collections';
import { MODE_IDS, MODES, type ModeId } from '../../shared/modes';
import { Piece } from './art';

type Who = 'm' | 'o';

/** Short games that end in a win, one per mode. In Fading, watch the oldest pieces vanish. */
const SCRIPTS: Record<ModeId, { moves: [number, Who][]; line: number[] }> = {
  classic: { moves: [[0, 'm'], [1, 'o'], [4, 'm'], [2, 'o'], [8, 'm']], line: [0, 4, 8] },
  fading: { moves: [[1, 'm'], [0, 'o'], [3, 'm'], [8, 'o'], [4, 'm'], [2, 'o'], [5, 'm']], line: [3, 4, 5] },
  big: { moves: [[5, 'm'], [0, 'o'], [6, 'm'], [12, 'o'], [7, 'm'], [13, 'o'], [8, 'm']], line: [5, 6, 7, 8] },
  pro: { moves: [[8, 'm'], [9, 'o'], [16, 'm'], [17, 'o'], [24, 'm'], [25, 'o'], [32, 'm'], [33, 'o'], [40, 'm']], line: [8, 16, 24, 32, 40] },
};

const STEP = 700;

/** For each move, the move at which it fades away (Fading only), or null. */
function fades(mode: ModeId) {
  const { moves } = SCRIPTS[mode];
  const keep = MODES[mode].fade;
  const hist: Record<Who, number[]> = { m: [], o: [] };
  const gone: (number | null)[] = moves.map(() => null);
  moves.forEach(([, w], k) => {
    if (keep && hist[w].length >= keep) gone[hist[w].shift()!] = k;
    hist[w].push(k);
  });
  return gone;
}

let injected = false;

/** Builds one set of keyframes per piece, so every piece appears (and fades) on its own beat. */
function injectKeyframes() {
  if (injected) return;
  injected = true;
  let css = '';
  for (const id of MODE_IDS) {
    const { moves } = SCRIPTS[id];
    const total = (moves.length + 5) * STEP;
    const pct = (t: number) => `${Math.min(100, Math.max(0, (t / total) * 100)).toFixed(2)}%`;
    const end = total - STEP * 0.4;
    const gone = fades(id);
    moves.forEach((_, k) => {
      const on = (k + 1) * STEP;
      const off = gone[k] !== null ? (gone[k]! + 1) * STEP : end;
      css += `@keyframes dm-${id}-${k}{0%,${pct(on - 1)}{opacity:0;transform:scale(.3) rotate(-20deg)}${pct(on + 260)}{opacity:1;transform:none}${pct(off - 1)}{opacity:1;transform:none}${pct(off + 220)},100%{opacity:0;transform:scale(.6)}}`;
    });
    const winAt = (moves.length + 1) * STEP;
    css += `@keyframes dm-${id}-w{0%,${pct(winAt - 1)}{opacity:0}${pct(winAt + 200)}{opacity:1}${pct(end - 1)}{opacity:1}${pct(end + 220)},100%{opacity:0}}`;
  }
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
}

export function DemoBoard({ mode, piece, playing }: { mode: ModeId; piece: string; playing: boolean }) {
  injectKeyframes();
  const { n } = MODES[mode];
  const { moves, line } = SCRIPTS[mode];
  const total = (moves.length + 5) * STEP;
  const gone = fades(mode);
  const at = new Map(moves.map(([cell, who], k) => [cell, { who, k }]));
  const anim = (name: string): CSSProperties | undefined =>
    playing ? { animation: `${name} ${total}ms cubic-bezier(.2,.8,.2,1) infinite both` } : undefined;

  return (
    <div className="demo" style={{ '--n': n } as CSSProperties} aria-hidden="true">
      {Array.from({ length: n * n }, (_, i) => {
        const p = at.get(i);
        return (
          <i key={i}>
            {line.includes(i) && <u style={anim(`dm-${mode}-w`)} />}
            {p && (
              <b className={`${p.who === 'm' ? 'me-c' : 'op-c'}${gone[p.k] !== null ? ' gone' : ''}`} style={anim(`dm-${mode}-${p.k}`)}>
                <Piece id={p.who === 'm' ? piece : pairOf(piece)} />
              </b>
            )}
          </i>
        );
      })}
    </div>
  );
}
