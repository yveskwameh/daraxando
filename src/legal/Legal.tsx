/**
 * The privacy notice and the terms (docs/BACKEND.md, milestone 7). The words live in
 * privacy.md and terms.md beside this file, the one copy the lawyer reviews and players read.
 *
 * Two ways in: a page at /privacy or /terms (for links from outside the app, Google's sign-in
 * review and the lawyer), and a sheet over whatever you're doing (from the first screen, Settings
 * and the save sheet), so reading them never loses your place. Loaded only when opened.
 */
import { Fragment, useState, type ReactNode } from 'react';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/art';
import { movedInApp, type Go } from '../lib/router';
import privacy from './privacy.md?raw';
import terms from './terms.md?raw';

export type LegalDoc = 'privacy' | 'terms';

const SOURCE: Record<LegalDoc, string> = { privacy, terms };
export const LEGAL_TITLE: Record<LegalDoc, string> = { privacy: 'Privacy notice', terms: 'Terms of play' };

/** **bold**, [a link](https://…), [an email](mailto:…) and [the other page](/terms). Nothing else, so no HTML gets in. */
function inline(text: string, key: string, onDoc?: (d: LegalDoc) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\(((?:https:\/\/|mailto:|\/)[^)\s]+)\)/g;
  let at = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<b key={k}>{m[1]}</b>);
    else {
      const href = m[3];
      const outside = href.startsWith('https://');
      const other = href === '/privacy' || href === '/terms' ? (href.slice(1) as LegalDoc) : null;
      const open = other && onDoc ? (e: { preventDefault: () => void }) => { e.preventDefault(); onDoc(other); } : undefined;
      out.push(<a key={k} href={href} onClick={open} {...(outside ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[2]}</a>);
    }
    at = re.lastIndex;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** A small part of Markdown: ## headings, paragraphs, - lists, > a highlighted box. The # title line is left to the page or sheet. */
export function LegalText({ doc, onDoc }: { doc: LegalDoc; onDoc?: (d: LegalDoc) => void }) {
  const blocks = SOURCE[doc].replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="legal-text">
      {blocks.map((b, i) => {
        const k = `b${i}`;
        if (b.startsWith('# ')) return null;
        if (b.startsWith('## ')) return <h2 key={k}>{b.slice(3)}</h2>;
        if (b.startsWith('### ')) return <h3 key={k}>{b.slice(4)}</h3>;
        if (b.startsWith('> ')) {
          const lines = b.split('\n').map((l) => l.replace(/^>\s?/, ''));
          return <div key={k} className="callout">{lines.map((l, j) => <p key={j}>{inline(l, `${k}-${j}`, onDoc)}</p>)}</div>;
        }
        if (b.startsWith('- ')) {
          // "- " starts an item, "  - " an item inside the one before, anything else carries on the line before.
          const items: { text: string; sub: string[] }[] = [];
          for (const line of b.split('\n')) {
            const top = /^- (.*)$/.exec(line);
            const inner = /^\s+- (.*)$/.exec(line);
            const last = items[items.length - 1];
            if (top) items.push({ text: top[1], sub: [] });
            else if (inner && last) last.sub.push(inner[1]);
            else if (last && last.sub.length) last.sub[last.sub.length - 1] += ` ${line.trim()}`;
            else if (last) last.text += ` ${line.trim()}`;
          }
          return (
            <ul key={k}>
              {items.map((it, j) => (
                <li key={j}>
                  {inline(it.text, `${k}-${j}`, onDoc)}
                  {it.sub.length > 0 && <ul>{it.sub.map((s, n) => <li key={n}>{inline(s, `${k}-${j}-${n}`, onDoc)}</li>)}</ul>}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={k}>{b.split('\n').map((l, j) => <Fragment key={j}>{j > 0 && ' '}{inline(l, `${k}-${j}`, onDoc)}</Fragment>)}</p>;
      })}
    </div>
  );
}

/** /privacy and /terms: works with or without a player on this phone. */
export function LegalPage({ doc, go }: { doc: LegalDoc; go: Go }) {
  const back = () => {
    // Opened from inside the app: back to where you were. Opened from a link: Home (or the first screen).
    if (movedInApp()) history.back();
    else go({ name: 'home' }, { replace: true });
  };
  return (
    <main className="screen" aria-label={LEGAL_TITLE[doc]}>
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Back" onClick={back}><Icon id="i-back" /></button>
        <h1>{LEGAL_TITLE[doc]}</h1>
        <span aria-hidden="true" />
      </div>
      <div className="panel"><LegalText key={doc} doc={doc} onDoc={(d) => go({ name: 'legal', doc: d })} /></div>
    </main>
  );
}

/** The same words in a sheet, over the screen you're on. */
export default function LegalSheet({ doc, open, onClose }: { doc: LegalDoc; open: boolean; onClose: () => void }) {
  // A link to the other one switches the sheet over to it.
  const [shown, setShown] = useState(doc);
  const [last, setLast] = useState({ doc, open });
  if (last.doc !== doc || last.open !== open) {
    setLast({ doc, open });
    if (open) setShown(doc);
  }
  return (
    <Sheet open={open} onClose={onClose} label={LEGAL_TITLE[shown]}>
      <h2>{LEGAL_TITLE[shown]}</h2>
      <div className="scroll" key={shown}><LegalText doc={shown} onDoc={setShown} /></div>
    </Sheet>
  );
}
