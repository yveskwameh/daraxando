// Ban reviews: banned players asking you to look at their ban again. Lift it (a note is optional)
// or keep it (a note is required, because the player reads it).
import { useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import type { Appeal } from '../types.ts';
import { Button, Empty, Field, go, Loading, Problem, toast, useLoad } from '../ui.tsx';
import { when } from '../format.ts';

export function Reviews() {
  const { copy } = useApp();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = useLoad(`${copy}:appeals:${show}`, () => api.appeals(copy, show));
  const items = (list.data?.appeals ?? []).filter((a) => show === 'open' || a.status !== 'open');

  return (
    <div className="stack-group">
      <div className="titled">
        <h1>Ban reviews</h1>
        <p className="muted">Banned players can ask you to look at their ban again, once at a time, and again a week after you keep it.</p>
      </div>
      <div className="seg wide" role="radiogroup" aria-label="Which reviews">
        <button type="button" role="radio" aria-checked={show === 'open'} onClick={() => setShow('open')}>Waiting</button>
        <button type="button" role="radio" aria-checked={show === 'all'} onClick={() => setShow('all')}>Answered</button>
      </div>
      {list.error ? (
        <Problem text={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title={show === 'open' ? 'Nothing waiting.' : 'No answered reviews yet.'} text={show === 'open' ? 'When a banned player asks, it shows here.' : undefined} />
      ) : (
        <ul className="list gap">
          {items.map((a) => <Review key={a.id} a={a} onDone={list.reload} />)}
        </ul>
      )}
    </div>
  );
}

function Review({ a, onDone }: { a: Appeal; onDone: () => void }) {
  const { copy } = useApp();
  const [mode, setMode] = useState<'lift' | 'keep' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answer = async () => {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      await api.answer(copy, a.id, mode, note.trim());
      toast.ok(mode === 'lift' ? `${a.name ?? 'The player'}'s ban is lifted.` : 'The ban stays. They can see your note.');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card review">
      <div className="review-head">
        <button type="button" className="name-btn" onClick={() => go(`/players/${a.playerId}`)}>{a.name ?? 'A player'}</button>
        <small className="fine">Asked {when(a.at)}</small>
      </div>
      {a.banReason !== null && (
        <p className="fine">Banned {a.bannedAt ? when(a.bannedAt) : ''}{a.banReason ? `: ${a.banReason}` : ''}</p>
      )}
      <blockquote>{a.message}</blockquote>
      {a.status !== 'open' ? (
        <p className="fine"><span className="tag-pill">{a.status === 'lifted' ? 'Lifted' : 'Kept'}</span> {a.decidedAt ? when(a.decidedAt) : ''}{a.note ? `. Your note: ${a.note}` : ''}</p>
      ) : mode === null ? (
        <div className="row-btns">
          <Button size="sm" onClick={() => setMode('lift')}>Lift the ban</Button>
          <Button kind="ghost" size="sm" onClick={() => setMode('keep')}>Keep the ban</Button>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void answer(); }}>
          <Field
            label={mode === 'lift' ? 'Note to them, if you want one' : 'Note to them'}
            hint={mode === 'lift' ? 'Optional. They see it.' : 'They see it, so write it to them. 3 to 300 characters.'}
            error={error}
          >
            <textarea className="input" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="row-btns">
            <Button type="submit" kind={mode === 'keep' ? 'danger' : 'main'} size="sm" busy={busy} disabled={mode === 'keep' && note.trim().length < 3}>
              {mode === 'lift' ? 'Lift the ban' : 'Keep the ban'}
            </Button>
            <Button kind="ghost" size="sm" onClick={() => { setMode(null); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </li>
  );
}
