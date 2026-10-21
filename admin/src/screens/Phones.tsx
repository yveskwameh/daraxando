// Shared phones: phones that more than one player has used, newest link first, each with its
// players and how they're on it (made on it, signed in on it, or played on it). One person
// making players to farm Dara Seeds shows up here. Brothers and sisters sharing a phone do too,
// so a phone here is a sign, not proof.
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { fmt, lastPlayed, shortDate } from '../format.ts';
import type { PhoneHow, SharedPhones } from '../types.ts';
import { Empty, go, Icon, Problem, Skeleton, useLoad, usePath } from '../ui.tsx';

export const HOW_LABEL: Record<PhoneHow, string> = {
  made: 'Made on this phone',
  signin: 'Signed in on this phone',
  seen: 'Played on this phone',
};
const MINS = [2, 3, 5] as const;

/** Players and Shared phones, one switch at the top of both. */
export function PlayersSwitch({ on }: { on: 'players' | 'phones' }) {
  const items = [
    { id: 'players', href: '/players', label: 'Players' },
    { id: 'phones', href: '/players/phones', label: 'Shared phones' },
  ] as const;
  return (
    <nav className="seg fit view-switch" aria-label="Players or shared phones">
      {items.map((x) => (
        <a key={x.id} href={x.href} aria-current={on === x.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(x.href); }}>{x.label}</a>
      ))}
    </nav>
  );
}

const readMin = () => (MINS.find((n) => n === Number(new URLSearchParams(location.search).get('min'))) ?? 2) as 2 | 3 | 5;

export function Phones() {
  const { copy } = useApp();
  usePath();
  const min = readMin();
  const r = useLoad(`${copy}:phones:${min}`, () => api.phones(copy, min));
  const info = useLoad(`${copy}:info`, () => api.info(copy));

  return (
    <div className="stack-group">
      <PlayersSwitch on="phones" />
      <div className="titled">
        <h1>Shared phones</h1>
        <p className="muted">Phones that more than one player has used, newest first. Staked wins between players on the same phone send both stakes back. Brothers and sisters share phones too, so this is a sign, not proof.</p>
      </div>

      <div className="chips" role="radiogroup" aria-label="How many players">
        {MINS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={min === n} onClick={() => go(n === 2 ? '/players/phones' : `/players/phones?min=${n}`, { replace: true })}>
            {n} or more players
          </button>
        ))}
      </div>

      {info.data && !info.data.phoneLinks && (
        <p className="notice">On the live game, only the phone each player was made on is linked, and phones have no limit on new players, until the lawyer approves (docs/PHONES-REVIEW.md in the game). The test game links every phone a player uses.</p>
      )}

      {r.error ? (
        <Problem text={r.error} onRetry={r.reload} />
      ) : !r.data ? (
        <Skeleton kind="cards" rows={4} label="Getting phones" />
      ) : r.data.phones.length === 0 ? (
        <Empty title={`No phone has ${min} or more players.`} text={min > 2 ? 'Try 2 or more.' : undefined} />
      ) : (
        <>
          <p className="fine">{r.data.total > r.data.phones.length ? `The newest ${fmt(r.data.phones.length)} of ${fmt(r.data.total)} phones.` : `${fmt(r.data.total)} ${r.data.total === 1 ? 'phone' : 'phones'}.`}</p>
          <ul className="phone-grid">
            {r.data.phones.map((p) => <PhoneCard key={p.id} p={p} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function PhoneCard({ p }: { p: SharedPhones['phones'][number] }) {
  const used = lastPlayed(new Date(p.lastAt + 3_600_000).toISOString().slice(0, 10));
  return (
    <li className="card phone-card">
      <div className="phone-head">
        <span className="phone-ic" aria-hidden="true"><Icon name="phone" size={18} /></span>
        <div className="titled tight">
          <b className="phone-name">Phone {p.id}</b>
          <span className="fine">{p.players} players · last used {used ? (used === 'Today' || used === 'Yesterday' ? used.toLowerCase() : used) : shortDate(p.lastAt)}</span>
        </div>
        {p.made30 >= 2 && <span className="tag-pill warn">Made {p.made30} this month</span>}
      </div>
      <ul className="list">
        {p.list.map((x) => (
          <li key={x.id}>
            <a className="prow" href={`/players/${x.id}`} onClick={(e) => { e.preventDefault(); go(`/players/${x.id}`); }}>
              <span className="initial sm" aria-hidden="true">{x.name.charAt(0).toUpperCase()}</span>
              <span className="prow-main">
                <b>{x.name}</b>
                <small>{HOW_LABEL[x.how]}, {shortDate(x.firstAt)} · {fmt(x.cowries)} seeds</small>
              </span>
              <span className="prow-tags">
                {x.banned && <span className="tag-pill bad">Banned</span>}
                {x.saved && !x.banned && <span className="tag-pill saved">Saved</span>}
              </span>
              <Icon name="right" size={18} />
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}
