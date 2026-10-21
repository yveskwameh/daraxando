// Players: every player, with counts and tabs (all, played today, new this week, banned, saved),
// search as you type, filters (state, saved or guest) and an order. On a computer or tablet it's a
// table whose column titles change the order; on a phone it's rows. 25, 50 or 100 a page, with
// numbered pages. Every choice, the page and its size included, lives in the address, so Back
// from a player returns to the same list.
import { useEffect, useState } from 'react';
import { STATES, stateName } from '../../../shared/places.ts';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { fmt, lagosDay, lastPlayed, shortDate } from '../format.ts';
import type { PageSize, PlayerSummary, Sort, Tab } from '../types.ts';
import { Button, Empty, go, Icon, Problem, Skeleton, useLoad, useMedia, usePath } from '../ui.tsx';
import { PlayersSwitch } from './Phones.tsx';

const SIZES: PageSize[] = [25, 50, 100];
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Played today' },
  { id: 'new', label: 'New this week' },
  { id: 'banned', label: 'Banned' },
  { id: 'saved', label: 'Saved' },
];
const SORTS: { id: Sort; label: string }[] = [
  { id: 'new', label: 'Newest first' },
  { id: 'active', label: 'Last played' },
  { id: 'seeds', label: 'Most seeds' },
  { id: 'aura', label: 'Most Aura' },
  { id: 'rating', label: 'Highest rating' },
  { id: 'name', label: 'Name, A to Z' },
];
const STATE_OPTIONS = [...STATES].sort((a, b) => a[1].localeCompare(b[1]));

const defaultSort = (tab: Tab): Sort => (tab === 'today' ? 'active' : 'new');

interface Filters { tab: Tab; sort: Sort; q: string; state: string; account: string; page: number; size: PageSize }

function readFilters(): Filters {
  const p = new URLSearchParams(location.search);
  const tab = (TABS.find((t) => t.id === p.get('tab'))?.id ?? 'all') as Tab;
  const sort = (SORTS.find((s) => s.id === p.get('sort'))?.id ?? defaultSort(tab)) as Sort;
  const page = Math.max(1, Math.floor(Number(p.get('page')) || 1));
  const size = (SIZES.find((n) => n === Number(p.get('size'))) ?? 50) as PageSize;
  return { tab, sort, q: p.get('q') ?? '', state: p.get('state') ?? '', account: p.get('account') ?? '', page, size };
}

function setFilters(f: Filters) {
  const p = new URLSearchParams();
  if (f.tab !== 'all') p.set('tab', f.tab);
  if (f.sort !== defaultSort(f.tab)) p.set('sort', f.sort);
  if (f.q) p.set('q', f.q);
  if (f.state) p.set('state', f.state);
  if (f.account) p.set('account', f.account);
  if (f.size !== 50) p.set('size', String(f.size));
  if (f.page > 1) p.set('page', String(f.page));
  const s = p.toString();
  go(`/players${s ? `?${s}` : ''}`, { replace: true });
}

export function Players() {
  const { copy } = useApp();
  usePath();
  const f = readFilters();
  const table = useMedia('(min-width: 760px)');
  const key = `${copy}:list:${f.tab}:${f.sort}:${f.q}:${f.state}:${f.account}:${f.page}:${f.size}`;
  const counts = useLoad(`${copy}:counts`, () => api.counts(copy));
  const list = useLoad(key, () => api.list(copy, f, f.page - 1));
  const filtered = !!(f.q || f.state || f.account);
  /** Any change but the page starts again at page 1. */
  const change = (patch: Partial<Filters>) => setFilters({ ...readFilters(), ...patch, page: patch.page ?? 1 });

  // Search as you type, a moment after you stop. The address only changes when the words do.
  const [text, setText] = useState(f.q);
  useEffect(() => setText((t) => (t.trim() === f.q ? t : f.q)), [f.q]);
  useEffect(() => {
    const t = text.trim();
    if (t === readFilters().q) return;
    const timer = setTimeout(() => change({ q: t }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const players = list.data?.players ?? [];
  // A new size keeps the first player on screen in view: page 3 at 50 a page is page 5 at 25.
  const pager = list.data && (
    <Pager
      page={f.page}
      size={f.size}
      shown={players.length}
      total={list.data.total}
      more={list.data.more}
      onPage={(page) => change({ page })}
      onSize={(size) => change({ size, page: Math.floor(((f.page - 1) * f.size) / size) + 1 })}
    />
  );

  return (
    <div className="stack-group">
      <PlayersSwitch on="players" />
      <div className="page-title">
        <div className="titled">
          <h1>Players</h1>
          <p className="muted">{counts.data ? `${fmt(counts.data.all)} players in all.` : 'Every player, newest first.'}</p>
        </div>
      </div>

      <div className="tab-chips" role="tablist" aria-label="Which players">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={f.tab === t.id}
            onClick={() => change({ tab: t.id, sort: f.sort === defaultSort(f.tab) ? defaultSort(t.id) : f.sort })}
          >
            <span>{t.label}</span>
            <b>{counts.data ? fmt(counts.data[t.id]) : '·'}</b>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <form className="search-field" role="search" onSubmit={(e) => { e.preventDefault(); change({ q: text.trim() }); }}>
          <Icon name="search" size={18} />
          <label className="sr" htmlFor="q">Search by name, email or player id</label>
          <input id="q" className="input" type="search" placeholder="Name, email or player id" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
        </form>
        <label className="pick">
          <span className="sr">State</span>
          <select value={f.state} onChange={(e) => change({ state: e.target.value })}>
            <option value="">All states</option>
            {STATE_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            <option value="OUT">Outside Nigeria</option>
            <option value="NONE">Didn't say</option>
          </select>
        </label>
        <label className="pick">
          <span className="sr">Account</span>
          <select value={f.account} onChange={(e) => change({ account: e.target.value })}>
            <option value="">Saved and guests</option>
            <option value="saved">Saved only</option>
            <option value="guest">Guests only</option>
          </select>
        </label>
        <label className="pick">
          <span className="sr">Order</span>
          <select value={f.sort} onChange={(e) => change({ sort: e.target.value as Sort })}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {filtered && (
          <button type="button" className="clear-btn" onClick={() => { setText(''); change({ q: '', state: '', account: '' }); }}>
            Clear filters
          </button>
        )}
      </div>

      {list.error ? (
        <Problem text={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton kind={table ? 'table' : 'rows'} rows={8} label="Getting players" />
      ) : players.length === 0 ? (
        f.page > 1 ? (
          <div className="state empty">
            <p className="state-title">No players on page {fmt(f.page)}.</p>
            <Button kind="ghost" size="sm" onClick={() => change({ page: 1 })}>Go to page 1</Button>
          </div>
        ) : (
          <Empty title="No players match." text={filtered ? 'Try clearing the filters. Names match from the start.' : f.tab === 'banned' ? 'Nobody is banned.' : undefined} />
        )
      ) : (
        <>
          {table && pager}
          {table ? <PlayerTable players={players} sort={f.sort} onSort={(sort) => change({ sort })} /> : (
            <ul className="list">
              {players.map((p) => <PlayerRow key={p.id} p={p} />)}
            </ul>
          )}
          {pager}
        </>
      )}
    </div>
  );
}

/** The page numbers to show: the first, the last, and the ones around this page, with gaps. */
export function pageNumbers(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const list = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

function Pager({ page, size, shown, total, more, onPage, onSize }: { page: number; size: PageSize; shown: number; total: number; more: boolean; onPage: (p: number) => void; onSize: (s: PageSize) => void }) {
  const from = (page - 1) * size + 1;
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <nav className="pager" aria-label="Pages">
      <p className="fine pager-count">{fmt(from)} to {fmt(from + shown - 1)} of {fmt(total)}</p>
      <div className="pager-pages">
        <button type="button" className="icon-btn sm" aria-label="The page before" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="left" size={18} />
        </button>
        <span className="pg-nums">
          {pageNumbers(page, pages).map((n, i) =>
            n === 'gap' ? (
              <span key={`gap${i}`} className="pg-gap" aria-hidden="true">…</span>
            ) : (
              <button key={n} type="button" className="pg" aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>
                {fmt(n)}
              </button>
            ),
          )}
        </span>
        <span className="pg-of fine">Page {fmt(page)} of {fmt(pages)}</span>
        <button type="button" className="icon-btn sm" aria-label="The next page" disabled={!more} onClick={() => onPage(page + 1)}>
          <Icon name="right" size={18} />
        </button>
      </div>
      <div className="pager-size">
        <span className="fine" id="rows-label">Rows</span>
        <div className="seg sm" role="radiogroup" aria-labelledby="rows-label">
          {SIZES.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => onSize(n)}>{n}</button>
          ))}
        </div>
      </div>
    </nav>
  );
}

const playedText = (day: string | null | undefined) => lastPlayed(day) ?? 'No match yet';

/** The table on a computer or tablet. Column titles that can order the list are buttons. */
function PlayerTable({ players, sort, onSort }: { players: PlayerSummary[]; sort: Sort; onSort: (s: Sort) => void }) {
  const today = lagosDay();
  const Th = ({ id, label, className = '' }: { id?: Sort; label: string; className?: string }) => (
    <th scope="col" className={className} aria-sort={id && sort === id ? (id === 'name' ? 'ascending' : 'descending') : undefined}>
      {id ? (
        <button type="button" className="th-btn" onClick={() => onSort(id)} aria-label={`${label}. Order by ${SORTS.find((s) => s.id === id)!.label.toLowerCase()}`}>
          <span>{label}</span>
          <svg className="ic sort-ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={id === 'name' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      ) : label}
    </th>
  );
  return (
    <div className="table-card">
      <table className="ptable">
        <thead>
          <tr>
            <Th id="name" label="Player" />
            <Th label="State" className="opt-2" />
            <Th id="active" label="Last played" />
            <Th id="seeds" label="Seeds" className="n" />
            <Th id="aura" label="Aura" className="n opt-1" />
            <Th id="rating" label="Rating" className="n opt-1" />
            <Th id="new" label="Joined" className="opt-2" />
            <Th label="Account" />
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} onClick={(e) => { if (!(e.target as HTMLElement).closest('a')) go(`/players/${p.id}`); }}>
              <td>
                <a className="pcell" href={`/players/${p.id}`} onClick={(e) => { e.preventDefault(); go(`/players/${p.id}`); }}>
                  <span className="initial sm" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
                  <b>{p.name}</b>
                </a>
              </td>
              <td className="opt-2 muted">{stateName(p.state)}</td>
              <td className={p.lastPlayedDay === today ? 'is-today' : 'muted'}>
                {p.lastPlayedDay === today && <i className="live-dot" aria-hidden="true" />}
                {playedText(p.lastPlayedDay)}
              </td>
              <td className="n">{fmt(p.cowries)}</td>
              <td className="n opt-1">{fmt(p.aura)}</td>
              <td className="n opt-1">{fmt(p.rating)}</td>
              <td className="opt-2 muted">{shortDate(p.createdAt)}</td>
              <td>
                <span className="prow-tags">
                  {p.ban && <span className="tag-pill bad">{p.ban.until ? `Banned until ${shortDate(p.ban.until)}` : 'Banned'}</span>}
                  {!p.ban && <span className={`tag-pill${p.saved ? ' saved' : ''}`}>{p.saved ? 'Saved' : 'Guest'}</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlayerRow({ p }: { p: Pick<PlayerSummary, 'id' | 'name'> & Partial<PlayerSummary> }) {
  const played = p.state !== undefined ? lastPlayed(p.lastPlayedDay) : undefined;
  return (
    <li>
      <a className="prow" href={`/players/${p.id}`} onClick={(e) => { e.preventDefault(); go(`/players/${p.id}`); }}>
        <span className="initial" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
        <span className="prow-main">
          <b>{p.name}</b>
          {p.state !== undefined && (
            <small>
              {[stateName(p.state), played ? `Played ${played === 'Today' || played === 'Yesterday' ? played.toLowerCase() : played}` : 'No match yet', `${fmt(p.cowries ?? 0)} seeds`].join(' · ')}
            </small>
          )}
        </span>
        <span className="prow-tags">
          {p.ban && <span className="tag-pill bad">{p.ban.until ? `Banned until ${shortDate(p.ban.until)}` : 'Banned'}</span>}
          {p.saved && <span className="tag-pill">Saved</span>}
        </span>
        <Icon name="right" size={18} />
      </a>
    </li>
  );
}
