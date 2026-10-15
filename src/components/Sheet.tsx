/**
 * A bottom sheet built on the native <dialog>, which gives focus trapping, Escape to close
 * and a real modal backdrop for free. Ways to close it, the ones phone users already know:
 *  - the X at the top right, on the same line as the title, on sheets with room for it and
 *    no button of their own that closes them,
 *  - dragging it down (from anywhere except a scrolling list or a text field),
 *  - tapping the dimmed space above it, or Escape.
 * It slides down when it closes, the way it slid up. `locked` sheets (the result, the next
 * game) can only be answered with their buttons: no drag, no backdrop, no Escape. A locked
 * sheet can still show the X with `closeButton`, which then calls `onClose`.
 */
import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Icon } from './art';

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  locked?: boolean;
  /**
   * Show the X at the top right. On by default for sheets that aren't locked. Turn it off
   * where it would crowd the top (tabs first) or where a button already closes the sheet.
   */
  closeButton?: boolean;
  /** What the X says to screen readers, if more than "Close". */
  closeLabel?: string;
  children: ReactNode;
}

/** No slide when the phone asks for less motion. (Low-memory phones still slide: it's one transform.) */
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lists and fields keep their own touch: scrolling and typing never drag the sheet. */
const OWN_TOUCH = 'input, textarea, select, .scroll, .list, .panel, .onb-states, [data-nodrag]';

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

export function Sheet({ open, onClose, label, locked, closeButton = !locked, closeLabel = 'Close', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  // While it slides away, keep showing what it showed last (many sheets render nothing once closed).
  const last = useRef<ReactNode>(null);
  if (open) last.current = children;
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const xRef = useRef<HTMLButtonElement>(null);


  // A layout effect, so the sheet is showing before the X is measured below.
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      d.classList.remove('closing', 'settle');
      d.style.removeProperty('--dy');
      setClosing(false);
      if (!d.open) {
        d.showModal();
        // Focus the first control without scrolling, so the sheet doesn't jump on phones.
        const first = d.querySelector<HTMLElement>('[data-autofocus], .sheet-body button, input');
        first?.focus({ preventScroll: true });
      }
      return;
    }
    if (!d.open) return;
    const done = () => {
      d.close();
      d.classList.remove('closing', 'dragging', 'settle');
      d.style.removeProperty('--dy');
      setClosing(false);
    };
    if (still()) {
      done();
      return;
    }
    setClosing(true);
    d.classList.remove('dragging', 'settle');
    d.classList.add('closing');
    const end = (e: AnimationEvent) => {
      if (e.target === d && e.animationName === 'sheet-down') finish();
    };
    // In case the animation never reports back (a hidden tab), close anyway.
    const t = window.setTimeout(() => finish(), 400);
    function finish() {
      window.clearTimeout(t);
      d!.removeEventListener('animationend', end);
      done();
    }
    d.addEventListener('animationend', end);
    return () => {
      window.clearTimeout(t);
      d.removeEventListener('animationend', end);
    };
  }, [open]);

  // Line the X up with the sheet's title (or its tabs, when the tabs come first), and keep
  // the title clear of it. One measurement per render, only while the sheet is open.
  useLayoutEffect(() => {
    const d = ref.current;
    const x = xRef.current;
    if (!d || !x || !open) return;
    const body = d.querySelector<HTMLElement>('.sheet-body');
    const title = body?.querySelector<HTMLElement>('[data-sheet-title], h2, .big, [role="tablist"]');
    // Leave room for the X beside the title, and beside its description when they sit together.
    const head = title?.parentElement;
    const room = head && head !== body && [...head.children].every((c) => c.tagName === 'H2' || c.tagName === 'P') ? head : title;
    body?.querySelectorAll('.x-room').forEach((el) => el !== room && el.classList.remove('x-room'));
    if (!title || !room) {
      x.style.removeProperty('top');
      return;
    }
    room.classList.add('x-room');
    const box = d.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    const css = getComputedStyle(title);
    const line = title.getAttribute('role') === 'tablist' ? t.height : Math.min(t.height, parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.2);
    x.style.top = `${Math.round(t.top - box.top + line / 2 - x.offsetHeight / 2)}px`;
  });

  const down = (e: PointerEvent<HTMLDialogElement>) => {
    if (locked || !open || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest(OWN_TOUCH)) return;
    const now = performance.now();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dy: 0, on: false, lastY: e.clientY, lastT: now, v: 0 };
  };

  const move = (e: PointerEvent<HTMLDialogElement>) => {
    const g = drag.current;
    const d = ref.current;
    if (!g || !d || e.pointerId !== g.id) return;
    const dy = e.clientY - g.y;
    const dx = e.clientX - g.x;
    if (!g.on) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      // Only a downward pull drags. Up or sideways is left alone.
      if (dy <= 0 || Math.abs(dx) > dy) {
        drag.current = null;
        return;
      }
      g.on = true;
      d.setPointerCapture(e.pointerId);
      d.classList.remove('settle');
      d.classList.add('dragging');
    }
    const now = performance.now();
    if (now > g.lastT) g.v = (e.clientY - g.lastY) / (now - g.lastT);
    g.lastY = e.clientY;
    g.lastT = now;
    g.dy = Math.max(0, dy);
    d.style.setProperty('--dy', `${g.dy}px`);
  };

  const up = (e: PointerEvent<HTMLDialogElement>) => {
    const g = drag.current;
    const d = ref.current;
    drag.current = null;
    if (!g?.on || !d) return;
    justDragged.current = true;
    if (d.hasPointerCapture(e.pointerId)) d.releasePointerCapture(e.pointerId);
    d.classList.remove('dragging');
    // Far enough, or flicked: close. Otherwise spring back.
    if (g.dy > d.offsetHeight * 0.28 || (g.v > 0.55 && g.dy > 24)) {
      onClose();
    } else {
      d.classList.add('settle');
      d.style.setProperty('--dy', '0px');
    }
  };

  const showing = open || closing || !!ref.current?.open;

  return (
    <dialog
      ref={ref}
      className={`sheet${locked ? ' locked' : ''}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (justDragged.current) {
          justDragged.current = false;
          return;
        }
        if (e.target === ref.current && !locked) onClose();
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {showing && (
        <div className="sheet-body">
          <div className="sheet-top">
            {!locked && <span className="grab" aria-hidden="true" />}
            {closeButton && (
              <button ref={xRef} type="button" className="sheet-x" aria-label={closeLabel} onClick={onClose}>
                <Icon id="i-close" className="" />
              </button>
            )}
          </div>
          {open ? children : last.current}
        </div>
      )}
    </dialog>
  );
}
