// Reviews: two kinds of request that wait for you.
//  Bans:     banned players asking you to look at their ban again. Lift it (a note is optional)
//            or keep it (a note is required, because the player reads it).
//  Recovery: "Lost your code? Ask us to help" (the game's worker/codes.ts). Each answer is checked
//            against the player. Give it back starts 24 hours in which the player's phones can
//            stop it; refuse sends your note to the asking phone.
import { useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import type { Appeal, Recovery } from '../types.ts';
import { Button, Empty, Field, go, Problem, Skeleton, toast, useLoad } from '../ui.tsx';
import { fmt, shortDate, when } from '../format.ts';

const TAB_KEY = 'admin:reviews-tab';
const savedTab = (): 'bans' | 'recovery' => {
  try {
    return localStorage.getItem(TAB_KEY) === 'recovery' ? 'recovery' : 'bans';
  } catch {
    return 'bans';
  }
};

export function Reviews() {
  const { copy } = useApp();
  const info = useLoad(`${copy}:info`, () => api.info(copy)).data;
  const [tab, setTab] = useState(savedTab);
  const pick = (t: 'bans' | 'recovery') => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* fine */ }
  };
  return (
    <div className="stack-group">
      <div className="titled">
        <h1>Reviews</h1>
        <p className="muted">{tab === 'bans'
          ? 'Banned players can ask you to look at their ban again, once at a time, and again a week after you keep it.'
          : 'Players who lost their code ask from a phone. Give it back when the phone was theirs, or all 3 answers match.'}</p>
      </div>
      <div className="seg wide fit" role="radiogroup" aria-label="Kind of review">
        <button type="button" role="radio" aria-checked={tab === 'bans'} onClick={() => pick('bans')}>Bans</button>
        <button type="button" role="radio" aria-checked={tab === 'recovery'} onClick={() => pick('recovery')}>Recovery</button>
      </div>
      {tab === 'bans' ? <Bans /> : info?.codes === false ? <Empty title="Player codes are off on this copy." text="They turn on once the lawyer approves the privacy lines." /> : <Recoveries />}
    </div>
  );
}

function Bans() {
  const { copy } = useApp();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = useLoad(`${copy}:appeals:${show}`, () => api.appeals(copy, show));
  const items = (list.data?.appeals ?? []).filter((a) => show === 'open' || a.status !== 'open');

  return (
    <>
      <div className="seg wide fit" role="radiogroup" aria-label="Which reviews">
        <button type="button" role="radio" aria-checked={show === 'open'} onClick={() => setShow('open')}>Waiting</button>
        <button type="button" role="radio" aria-checked={show === 'all'} onClick={() => setShow('all')}>Answered</button>
      </div>
      {list.error ? (
        <Problem text={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton kind="cards" rows={2} />
      ) : items.length === 0 ? (
        <Empty title={show === 'open' ? 'Nothing waiting.' : 'No answered reviews yet.'} text={show === 'open' ? 'When a banned player asks, it shows here.' : undefined} />
      ) : (
        <ul className="list gap review-list">
          {items.map((a) => <Review key={a.id} a={a} onDone={list.reload} />)}
        </ul>
      )}
    </>
  );
}

function Recoveries() {
  const { copy } = useApp();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = useLoad(`${copy}:recoveries:${show}`, () => api.recoveries(copy, show));
  const items = (list.data?.recoveries ?? []).filter((r) => show === 'open' || (r.state !== 'open' && r.state !== 'waiting'));
  return (
    <>
      <div className="seg wide fit" role="radiogroup" aria-label="Which requests">
        <button type="button" role="radio" aria-checked={show === 'open'} onClick={() => setShow('open')}>Waiting</button>
        <button type="button" role="radio" aria-checked={show === 'all'} onClick={() => setShow('all')}>Answered</button>
      </div>
      {list.error ? (
        <Problem text={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton kind="cards" rows={2} />
      ) : items.length === 0 ? (
        <Empty title={show === 'open' ? 'Nothing waiting.' : 'No answered requests yet.'} text={show === 'open' ? 'When a player asks for help with a lost code, it shows here.' : 'Answered requests go after 30 days.'} />
      ) : (
        <ul className="list gap review-list">
          {items.map((r) => <RecoveryCard key={r.id} r={r} onDone={list.reload} />)}
        </ul>
      )}
    </>
  );
}

const HOW = { made: 'made on it', signin: 'signed in on it', seen: 'played on it' } as const;
const STATE = { open: 'Waiting', waiting: 'Given back, in the 24 hours', refused: 'Refused', stopped: 'Stopped by the player', done: 'Given back' } as const;

function RecoveryCard({ r, onDone }: { r: Recovery; onDone: () => void }) {
  const { copy } = useApp();
  const [mode, setMode] = useState<'give' | 'refuse' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = r.player?.name ?? 'A deleted player';
  const c = r.checks;
  const rows: { label: string; detail: string; ok: boolean; yes: string; no: string }[] = [
    { label: `Asking from a phone ${name} used`, detail: c.phone.ok && c.phone.how ? `${cap(HOW[c.phone.how])}${c.phone.lastAt ? `, last ${shortDate(c.phone.lastAt)}` : ''}` : 'A phone we have never seen with this player', ok: c.phone.ok, yes: 'Yes', no: 'No' },
    { label: `Seeds: about ${fmt(c.seeds.said)}`, detail: c.seeds.has === null ? 'Player gone' : `Has ${fmt(c.seeds.has)}`, ok: c.seeds.ok, yes: 'Matches', no: "Doesn't match" },
    { label: `Started: ${c.month.said}`, detail: c.month.joined ? `Joined ${shortDate(c.month.joined)}` : 'Player gone', ok: c.month.ok, yes: 'Matches', no: "Doesn't match" },
    { label: `Played recently: ${c.opponent.said}`, detail: c.opponent.lastAt ? `Played them ${shortDate(c.opponent.lastAt)}` : 'No match between them', ok: c.opponent.ok, yes: 'Matches', no: "Doesn't match" },
  ];

  const answer = async () => {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      await api.decideRecovery(copy, r.id, mode, note.trim());
      toast.ok(mode === 'give' ? `${name}'s phones are warned. In 24 hours, if nobody stops it, ${name} moves to the asking phone.` : 'Refused. The asking phone shows your note.');
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
        {r.player ? <button type="button" className="name-btn" onClick={() => go(`/players/${r.player!.id}`)}>{name}</button> : <b>{name}</b>}
        <small className="fine">Asked {when(r.at)}</small>
      </div>
      {r.player?.banned && <p className="fine"><span className="tag-pill">Banned</span> This player is banned.</p>}
      <ul className="checks">
        {rows.map((x) => (
          <li key={x.label}>
            <span>{x.label}<small>{x.detail}</small></span>
            <b className={x.ok ? 'ok' : 'no'}>{x.ok ? x.yes : x.no}</b>
          </li>
        ))}
      </ul>
      {r.message && <blockquote>{r.message}</blockquote>}
      <p className={`verdict ${r.suggest}`}>
        {c.phone.ok ? 'Linked phone' : 'No linked phone'} and {r.answersOk} of 3 answers match. {r.suggest === 'give' ? 'Your rule says give it back.' : 'Your rule says refuse.'}
      </p>
      {r.state !== 'open' ? (
        <p className="fine">
          <span className="tag-pill">{STATE[r.state]}</span> {r.decidedAt ? when(r.decidedAt) : ''}
          {r.state === 'waiting' && r.due ? `. Moves ${when(r.due)} unless ${name} taps Stop` : ''}
          {r.note ? `. Your note: ${r.note}` : ''}
        </p>
      ) : mode === null ? (
        <div className="row-btns">
          <Button kind={r.suggest === 'give' ? 'main' : 'ghost'} size="sm" onClick={() => setMode('give')}>Give it back</Button>
          <Button kind={r.suggest === 'refuse' ? 'main' : 'ghost'} size="sm" onClick={() => setMode('refuse')}>Refuse</Button>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void answer(); }}>
          <p className="fine">
            {mode === 'give'
              ? `${name}'s phones get a warning now. In 24 hours, if nobody stops it, ${name} moves to the asking phone with a new code, and every other phone is signed out. It goes in your log.`
              : 'The asking phone shows your note. They can ask again after a week.'}
          </p>
          <Field
            label={mode === 'give' ? 'Note to them, if you want one' : 'Note to them'}
            hint={mode === 'give' ? 'Optional. They see it when the player comes back.' : 'They see it, so write it to them. 3 to 200 characters.'}
            error={error}
          >
            <textarea className="input" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="row-btns">
            <Button type="submit" kind={mode === 'refuse' ? 'danger' : 'main'} size="sm" busy={busy} disabled={mode === 'refuse' && note.trim().length < 3}>
              {mode === 'give' ? 'Give it back in 24 hours' : 'Refuse'}
            </Button>
            <Button kind="ghost" size="sm" onClick={() => { setMode(null); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </li>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
