// Players: find a player by the start of their name, their email address or their player id.
import { useState } from 'react';
import { stateName } from '../../../shared/places.ts';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { fmt } from '../format.ts';
import type { PlayerSummary } from '../types.ts';
import { Button, Empty, go, Icon, Loading, Problem, useLoad, usePath } from '../ui.tsx';

const queryOf = () => new URLSearchParams(location.search).get('q') ?? '';

export function Players() {
  const { copy } = useApp();
  usePath();
  const q = queryOf();
  const [text, setText] = useState(q);
  const found = useLoad(q ? `${copy}:players:${q}` : null, () => api.players(copy, q));

  return (
    <div className="stack-group">
      <div className="titled">
        <h1>Players</h1>
        <p className="muted">Find a player by the start of their name, their email address or their player id.</p>
      </div>
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t) go(`/players?q=${encodeURIComponent(t)}`, { replace: true });
        }}
      >
        <label className="sr" htmlFor="q">Name, email or player id</label>
        <input id="q" className="input" type="search" placeholder="Name, email or player id" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" size="sm" label="Search"><Icon name="search" size={20} /></Button>
      </form>

      {!q ? null : found.error ? (
        <Problem text={found.error} onRetry={found.reload} />
      ) : !found.data ? (
        <Loading label="Looking" />
      ) : found.data.players.length === 0 ? (
        <Empty title="Nobody found." text="Names match from the start. An email address has to be the whole address." />
      ) : (
        <ul className="list">
          {found.data.players.map((p) => <PlayerRow key={p.id} p={p} />)}
        </ul>
      )}
    </div>
  );
}

export function PlayerRow({ p }: { p: Pick<PlayerSummary, 'id' | 'name'> & Partial<PlayerSummary> }) {
  return (
    <li>
      <a className="prow" href={`/players/${p.id}`} onClick={(e) => { e.preventDefault(); go(`/players/${p.id}`); }}>
        <span className="initial" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
        <span className="prow-main">
          <b>{p.name}</b>
          {p.state !== undefined && (
            <small>{[stateName(p.state), `${fmt(p.cowries ?? 0)} seeds`, `${fmt(p.aura ?? 0)} Aura`].join(' · ')}</small>
          )}
        </span>
        <span className="prow-tags">
          {p.ban && <span className="tag-pill bad">Banned</span>}
          {p.saved && <span className="tag-pill">Saved</span>}
        </span>
        <Icon name="right" size={18} />
      </a>
    </li>
  );
}
