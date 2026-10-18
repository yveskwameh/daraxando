/**
 * A pop-up that slides down from the top, over the screen: install, the asks, Baba Ayo, a
 * friend request, a friend joining your room, a new version. Swipe it up to hide it, the way
 * phone notifications go away (Yves, 17 October 2026), or use its X.
 *
 * Swiping up always means "not now". Where the X does something more (decline a friend
 * request, close your room), swiping up only hides the pop-up and leaves things as they are.
 *
 * The drag moves the pop-up directly (transform and opacity only), so nothing re-renders while
 * a finger is on it. Taps on its buttons still work: the drag only starts after the finger has
 * moved up or down by a few pixels.
 */
import { useRef, type PointerEvent, type ReactNode } from 'react';
import { reducedMotion } from '../lib/device';

interface Props {
  className?: string;
  role: 'dialog' | 'alertdialog' | 'status';
  label?: string;
  /** Called once it has slid away. Do what "Not now" does. */
  onHide: () => void;
  children: ReactNode;
}

interface Drag {
  id: number;
  x: number;
  y: number;
  dy: number;
  on: boolean;
  lastY: number;
  lastT: number;
  v: number;
}

/** How far up (px) is enough to hide it, or how fast (px per ms) for a flick. */
const HIDE_PX = 36;
const FLICK = 0.45;

export function TopPop({ className = '', role, label, onHide, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const gone = useRef(false);

  const place = (dy: number, ease = false) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = ease ? 'transform 200ms var(--ease-out), opacity 200ms var(--ease-out)' : 'none';
    el.style.transform = dy ? `translateY(${dy}px)` : '';
    el.style.opacity = dy < 0 ? String(Math.max(0, 1 + dy / 140)) : '';
  };

  const hide = () => {
    if (gone.current) return;
    gone.current = true;
    const el = ref.current;
    if (!el || reducedMotion()) return onHide();
    el.style.transition = 'transform 180ms ease-in, opacity 180ms ease-in';
    el.style.transform = 'translateY(-140%)';
    el.style.opacity = '0';
    setTimeout(onHide, 180);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gone.current) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dy: 0, on: false, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(e.clientX - d.x)) return;
      d.on = true;
      ref.current?.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    // Up follows the finger; down only gives a little, since there's nowhere to go.
    d.dy = dy < 0 ? dy : Math.min(dy * 0.25, 16);
    place(d.dy);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.on) return;
    dragged.current = true;
    setTimeout(() => (dragged.current = false), 50);
    if (d.dy <= -HIDE_PX || (d.dy < -10 && d.v <= -FLICK)) hide();
    else place(0, true);
  };

  return (
    <div
      ref={ref}
      className={`install-pop ${className}`.trim()}
      role={role}
      aria-label={label}
      aria-description="Swipe up to hide"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        // A drag that ends over a button is not a tap on it.
        if (dragged.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}
