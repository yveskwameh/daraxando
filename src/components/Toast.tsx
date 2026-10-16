import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { hideToast, useToast } from '../lib/toast';
import { Icon } from './art';

/**
 * The message bar (src/lib/toast.ts). With a sheet open, it goes inside the sheet: sheets are
 * modal dialogs, and anything outside one can't be tapped, so a tap meant to close the bar
 * would land on the sheet's button underneath it. If that sheet closes first, it moves back out.
 */
export function Toast() {
  const t = useToast();
  const [host, setHost] = useState<HTMLDialogElement | null>(null);

  useLayoutEffect(() => {
    if (!t) return;
    let off = () => {};
    // A frame later, so a sheet closing in the same tap (save, then close) counts as closing.
    const frame = requestAnimationFrame(() => {
      const open = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].filter((d) => !d.classList.contains('closing'));
      const top = open.at(-1) ?? null;
      setHost(top);
      if (!top) return;
      const out = () => setHost(null);
      top.addEventListener('close', out);
      off = () => top.removeEventListener('close', out);
    });
    return () => {
      cancelAnimationFrame(frame);
      off();
    };
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) return null;
  const bar = (
    <div
      key={`${t.id}-${host ? 'in' : 'out'}`}
      className={`toast ${t.kind}${t.out ? ' out' : ''}`}
      role="status"
      aria-live="polite"
      onClick={hideToast}
    >
      {t.kind !== 'info' && <span className="t-ic"><Icon id={t.kind === 'ok' ? 'i-check' : 'i-alert'} className="" /></span>}
      <span className="t-text">{t.text}</span>
    </div>
  );
  return createPortal(bar, host ?? document.body);
}
