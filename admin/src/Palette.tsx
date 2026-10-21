// Search from anywhere (Cmd+K, Ctrl+K or /): players by name, email or player id as you type, plus
// the places in the dashboard and the Live and Test switch. Arrow keys move, Enter opens.
import { useEffect, useRef, useState } from 'react';
import { stateName } from '../../shared/places.ts';
import { useApp } from './App.tsx';
import { api } from './api.ts';
import { fmt, lastPlayed } from './format.ts';
import type { Copy, PlayerSummary } from './types.ts';
import { go, Icon } from './ui.tsx';

const playedHint = (day: string | null | undefined) => {
  const played = lastPlayed(day);
  if (!played) return 'No match yet';
  return `Played ${played === 'Today' || played === 'Yesterday' ? played.toLowerCase() : played}`;
};

type Item = { id: string; label: string; hint?: string; icon: string; run: () => void };

export function Palette({ open, onClose, onCopy }: { open: boolean; onClose: () => void; onCopy: (c: Copy) => void }) {
  const { copy, signOut } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; players: PlayerSummary[]; busy: boolean; error: string | null }>({ q: '', players: [], busy: false, error: null });
  const [at, setAt] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQ('');
      setAt(0);
      setTimeout(() => input.current?.focus(), 0);
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Players as you type, a moment after you stop.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setFound({ q: t, players: [], busy: false, error: null });
      return;
    }
    setFound((f) => ({ ...f, busy: true }));
    const timer = setTimeout(() => {
      api.list(copy, { tab: 'all', sort: 'active', q: t }, 0).then(
        (r) => setFound({ q: t, players: r.players.slice(0, 8), busy: false, error: null }),
        (e: Error) => setFound({ q: t, players: [], busy: false, error: e.message }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [q, copy]);

  const close = () => onClose();
  const to = (href: string) => () => { close(); go(href); };
  const places: Item[] = [
    { id: 'today', label: 'Today', hint: 'Live now and the 8 am numbers', icon: 'today', run: to('/') },
    { id: 'players', label: 'Players', hint: 'Every player', icon: 'players', run: to('/players') },
    { id: 'banned', label: 'Banned players', icon: 'players', run: to('/players?tab=banned') },
    { id: 'phones', label: 'Shared phones', hint: 'Phones with more than one player', icon: 'phone', run: to('/players/phones') },
    { id: 'growth', label: 'Growth', hint: 'Traffic, new players and retention', icon: 'growth', run: to('/growth') },
    { id: 'lasthour', label: 'Traffic in the last hour', hint: 'Visits and new players', icon: 'growth', run: to('/growth?w=1h') },
    // An hour ago in Lagos time is the UTC clock now, as Lagos is an hour ahead.
    { id: 'sincelink', label: 'Traffic since a time', hint: 'For a link you just shared', icon: 'growth', run: to(`/growth?since=${new Date().toISOString().slice(0, 16)}`) },
    { id: 'reviews', label: 'Ban reviews', icon: 'reviews', run: to('/reviews') },
    { id: 'log', label: 'Log', hint: 'Every admin change', icon: 'log', run: to('/log') },
    { id: 'health', label: 'System health', hint: 'Every service the game depends on', icon: 'pulse', run: to('/health') },
    { id: 'plan', label: 'Free plan', icon: 'today', run: to('/section/plan') },
    {
      id: 'copy',
      label: copy === 'live' ? 'Switch to the test game' : 'Switch to the live game',
      icon: 'refresh',
      run: () => { close(); onCopy(copy === 'live' ? 'test' : 'live'); },
    },
    { id: 'signout', label: 'Sign out', hint: 'On this device', icon: 'left', run: () => { close(); signOut(); } },
  ];
  const t = q.trim().toLowerCase();
  const shownPlaces = t ? places.filter((p) => `${p.label} ${p.hint ?? ''}`.toLowerCase().includes(t)) : places;
  const players: Item[] = found.players.map((p) => ({
    id: p.id,
    label: p.name,
    hint: [stateName(p.state), p.ban ? 'Banned' : playedHint(p.lastPlayedDay), `${fmt(p.cowries)} seeds`].join(' · '),
    icon: 'players',
    run: to(`/players/${p.id}`),
  }));
  const items = [...players, ...shownPlaces];
  const pick = Math.min(at, Math.max(0, items.length - 1));

  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Search"
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      {open && (
        <div className="palette-in">
          <div className="palette-search">
            <Icon name="search" size={20} />
            <input
              ref={input}
              value={q}
              onChange={(e) => { setQ(e.target.value); setAt(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(items.length - 1, i + 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
                if (e.key === 'Enter' && items[pick]) { e.preventDefault(); items[pick].run(); }
              }}
              placeholder="Search players by name, email or id"
              aria-label="Search players and places"
              aria-controls="palette-list"
              aria-activedescendant={items[pick] ? `pal-${items[pick].id}` : undefined}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="button" className="esc" onClick={close} aria-label="Close"><span className="esc-key">Esc</span><span className="esc-word">Close</span></button>
          </div>
          <ul id="palette-list" className="palette-list" role="listbox" aria-label="Results">
            {t.length >= 2 && (
              <li className="palette-group" role="presentation">
                {found.busy ? 'Looking' : found.error ? found.error : players.length ? `Players on the ${copy} game` : `No players on the ${copy} game start with that`}
              </li>
            )}
            {items.map((it, i) => (
              <li key={it.id} id={`pal-${it.id}`} role="option" aria-selected={i === pick}>
                <button type="button" onClick={it.run} onMouseEnter={() => setAt(i)}>
                  {it.icon === 'players' && players.includes(it) ? <span className="initial sm" aria-hidden="true">{it.label.charAt(0).toUpperCase()}</span> : <Icon name={it.icon} size={18} />}
                  <span className="palette-text">
                    <b>{it.label}</b>
                    {it.hint && <small>{it.hint}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="palette-foot fine">Up and down to move, Enter to open, Esc to close.</p>
        </div>
      )}
    </dialog>
  );
}
