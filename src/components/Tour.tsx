/**
 * The new-player walkthrough (docs/WALKTHROUGH.md, approved 21 October 2026): three steps on Home,
 * each lighting up one part of it, with Baba Ayo, "1 of 3" and Skip. It ends on doing: Find a
 * player opens Quick match. Loaded only when it shows, so Home's first download stays small.
 *
 * The lit part is a hole in a dark layer (a ring with a huge shadow), placed over the real button
 * by measuring it. Only opacity and transform animate, and nothing moves with reduced motion.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from './art';

interface Step {
  /** The part of Home it lights up, inside the Home screen. */
  target: string;
  title: string;
  line: string;
  round?: boolean;
}

const STEPS: Step[] = [
  { target: '.home > .actions > .btn.primary', title: 'Play people across Nigeria', line: 'Quick match finds you a player, or starts your own game for others to join.' },
  { target: '.home-top .counters', title: 'Come back every day', line: 'Play once a day to grow your streak. Finish quests to earn Dara Seeds.' },
  { target: '.home-top .me-ring', title: 'This is you', line: 'Your title grows as you play. Tap here for your player code, so you never lose your progress.', round: true },
];

interface Box { left: number; top: number; width: number; height: number }

export type TourEnd = { how: 'done' } | { how: 'skip'; step: 1 | 2 | 3 };

export function Tour({ onEnd, findLabel }: { onEnd: (end: TourEnd) => void; findLabel: string }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [h, setH] = useState(0);
  const layer = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const measure = useCallback(() => {
    const host = layer.current?.parentElement;
    const el = host?.querySelector(STEPS[i].target);
    if (!host || !el) return setBox(null);
    const a = host.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const pad = 6;
    setH(a.height);
    setBox({ left: b.left - a.left - pad, top: b.top - a.top - pad, width: b.width + pad * 2, height: b.height + pad * 2 });
  }, [i]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [measure]);
  useEffect(() => next.current?.focus(), [i]);

  const skip = useCallback(() => onEnd({ how: 'skip', step: (i + 1) as 1 | 2 | 3 }), [i, onEnd]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && skip();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [skip]);

  // The card sits under the lit part when it's in the top half of the screen, above it otherwise.
  const below = !box || box.top + box.height / 2 < h / 2;
  const coachStyle: CSSProperties = box
    ? below ? { top: box.top + box.height + 14 } : { bottom: h - box.top + 14 }
    : { bottom: 24 };

  return (
    <div className="tour" ref={layer}>
      {box ? (
        <div className={`tour-spot${step.round ? ' round' : ''}`} style={{ left: box.left, top: box.top, width: box.width, height: box.height }} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div key={i} className="tour-coach" style={coachStyle} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-line">
        <div className="tour-who">
          <Avatar avatar="baba" size={40} />
          <span className="tour-step">{i + 1} of {STEPS.length}</span>
        </div>
        <b id="tour-title">{step.title}</b>
        <p id="tour-line">{step.line}</p>
        <div className="tour-row">
          <button type="button" className="tour-skip" onClick={skip}>{last ? 'Later' : 'Skip'}</button>
          <span className="tour-dots" aria-hidden="true">
            {STEPS.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}
          </span>
          <button ref={next} type="button" className="tour-go" onClick={() => (last ? onEnd({ how: 'done' }) : setI(i + 1))}>
            {last ? findLabel : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
