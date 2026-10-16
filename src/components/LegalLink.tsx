import { lazy, Suspense, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LegalDoc } from '../legal/Legal';

const LegalSheet = lazy(() => import('../legal/Legal'));

/** Opens the privacy notice or the terms in a sheet over the screen, loading the words on the first tap. */
function useLegal(doc: LegalDoc): [() => void, ReactNode] {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const show = () => {
    setUsed(true);
    setOpen(true);
  };
  // Into the page body, so it can open from inside a sentence or a row.
  const sheet = used && createPortal(
    <Suspense fallback={null}>
      <LegalSheet doc={doc} open={open} onClose={() => setOpen(false)} />
    </Suspense>,
    document.body,
  );
  return [show, sheet];
}

/** "Privacy notice" or "Terms of play" as a link inside a sentence, so nothing you were doing is lost. */
export function LegalLink({ doc, children }: { doc: LegalDoc; children: string }) {
  const [show, sheet] = useLegal(doc);
  return (
    <>
      <a
        href={`/${doc}`}
        className="inline-link"
        onClick={(e) => {
          e.preventDefault();
          show();
        }}
      >
        {children}
      </a>
      {sheet}
    </>
  );
}

/** A Settings row for one of them, with a Read button. */
export function LegalRow({ doc, title, line }: { doc: LegalDoc; title: string; line: string }) {
  const [show, sheet] = useLegal(doc);
  return (
    <div className="toggle-row">
      <div><b>{title}</b><span>{line}</span></div>
      <button type="button" className="mini-btn ghost" onClick={show}>Read</button>
      {sheet}
    </div>
  );
}
