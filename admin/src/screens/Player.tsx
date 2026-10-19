// One player: who they are and their status at the top, one Actions menu (rename, seeds, a test
// notification, then ban or lift the ban, last and in red), the days they played, and everything
// that happened to them as one timeline. Each change opens a sheet that says what will happen,
// and the game's admin API logs it.
import { useEffect, useMemo, useState } from 'react';
import { stateName } from '../../../shared/places.ts';
import { titleFor } from '../../../shared/progression.ts';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { addDays, fmt, lagosDay, lastPlayed, shortDate, shortDay, when } from '../format.ts';
import { modeName } from '../sections.ts';
import type { Info, PlayerDetail } from '../types.ts';
import { back, Button, copyText, Field, Icon, Problem, Sheet, Skeleton, toast, useLoad } from '../ui.tsx';
import { actionText } from './Log.tsx';
import { PlayerRow } from './Players.tsx';

type Act = 'rename' | 'ban' | 'unban' | 'seeds' | 'push';

const LEDGER: Record<string, string> = {
  start: 'Starting seeds',
  daily: 'Daily seeds',
  sapa: 'Top-up when low',
  'streak-stake': 'Streak stake',
  'streak-win': 'Streak stake won',
  freeze: 'Bought a Streak Freeze',
  repair: 'Restored a streak',
  admin: 'Seeds changed by you',
};
/** Seed changes that belong to a match: the match in the timeline already says them. */
const MATCH_LEDGER = new Set(['stake', 'pot', 'refund']);
const KIND: Record<string, string> = { quick: 'Quick match', friend: 'Friend' };
const PROVIDER: Record<string, string> = { google: 'Google', email: 'an email code' };

export function Player({ id }: { id: string }) {
  const { copy } = useApp();
  const res = useLoad(`${copy}:player:${id}`, () => api.player(copy, id));
  const info = useLoad(`${copy}:info`, () => api.info(copy));
  const [menu, setMenu] = useState(false);
  const [act, setAct] = useState<Act | null>(null);

  return (
    <div className="stack-group">
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Back to Players" onClick={() => back('/players')}>
          <Icon name="left" />
        </button>
        <h1>{res.data?.profile.name ?? 'Player'}</h1>
      </div>
      {res.error ? (
        <Problem text={res.error} onRetry={res.reload} />
      ) : !res.data ? (
        <div className="player-grid">
          <div className="player-side"><Skeleton kind="block" rows={1} label="Getting the player" /></div>
          <div className="player-main"><Skeleton kind="rows" rows={6} label="Getting the player" /></div>
        </div>
      ) : (
        <>
          <div className="player-grid">
            <div className="player-side">
              <Profile d={res.data} onMenu={() => setMenu(true)} />
              <Days d={res.data} />
              <More d={res.data} />
            </div>
            <div className="player-main">
              <Timeline d={res.data} />
            </div>
          </div>
          <Sheet open={menu} title="Actions" onClose={() => setMenu(false)}>
            <ActionList d={res.data} onPick={(a) => { setMenu(false); setAct(a); }} />
          </Sheet>
          <ActSheet act={act} d={res.data} info={info.data} onClose={() => setAct(null)} onDone={() => { setAct(null); res.reload(); }} />
        </>
      )}
    </div>
  );
}

function Status({ d }: { d: PlayerDetail }) {
  const p = d.profile;
  const played = lastPlayed(p.lastPlayedDay);
  return (
    <div className="status-row">
      {p.ban ? (
        <span className="status bad">{p.ban.until ? `Banned until ${shortDate(p.ban.until)}` : 'Banned'}</span>
      ) : played === 'Today' ? (
        <span className="status live"><i aria-hidden="true" />Played today</span>
      ) : (
        <span className="status">{played ? `Last played ${played === 'Yesterday' ? 'yesterday' : played}` : "Hasn't finished a match"}</span>
      )}
      <span className="status">{p.saved ? 'Saved' : 'Guest'}</span>
    </div>
  );
}

function Profile({ d, onMenu }: { d: PlayerDetail; onMenu: () => void }) {
  const p = d.profile;
  return (
    <>
      <section className="card p-profile">
        <div className="who">
          <span className="initial lg" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
          <div>
            <p className="who-name">{p.name}</p>
            <p className="fine">{titleFor(p.level)} · {stateName(p.state)} · Joined {shortDay(lagosDay(p.createdAt))}</p>
          </div>
        </div>
        <Status d={d} />
        <Button kind="ghost" size="sm" block onClick={onMenu}>Actions</Button>
        <dl className="stats">
          <div><dt>Dara Seeds</dt><dd>{fmt(p.cowries)}</dd></div>
          <div><dt>Aura</dt><dd>{fmt(p.aura)}</dd></div>
          <div><dt>Days played</dt><dd>{fmt(d.days?.total ?? 0)}</dd></div>
          <div><dt>Day streak</dt><dd>{fmt(p.dayStreak)}</dd></div>
          <div><dt>Rating</dt><dd>{fmt(p.rating)}</dd></div>
          <div><dt>Quick matches</dt><dd>{fmt(p.quickGames)}</dd></div>
          <div><dt>Wins</dt><dd>{fmt(p.wins)}</dd></div>
          <div><dt>Best run of wins</dt><dd>{fmt(p.bestWinStreak)}</dd></div>
        </dl>
        <button type="button" className="id-btn" onClick={() => copyText(p.id, 'Player id copied')}>
          <code>{p.id}</code>
          <Icon name="copy" size={16} />
          <span className="sr">Copy the player id</span>
        </button>
      </section>

      {p.ban && (
        <section className="card ban p-ban" aria-labelledby="ban-title">
          <h2 id="ban-title" className="kicker">Banned {when(p.ban.at)}{p.ban.until ? `, until ${when(p.ban.until)}` : ''}</h2>
          <p>{p.ban.reason}</p>
          <p className="fine">They can still play Baba Ayo. They're off Ranks and leagues and can't play people.</p>
        </section>
      )}
    </>
  );
}

/** The last 12 weeks, a square a day, filled where they finished a match. */
function Days({ d }: { d: PlayerDetail }) {
  const today = lagosDay();
  const played = new Set(d.days?.recent ?? []);
  // Columns are weeks, Monday at the top, ending with this week.
  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const first = addDays(monday, -7 * 11);
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i)));
  const recent = d.days?.recent.length ?? 0;
  return (
    <section className="card p-days" aria-labelledby="days-title">
      <div className="section-top">
        <h2 id="days-title" className="kicker">Days played</h2>
        <span className="fine">{recent === 1 ? '1 day' : `${fmt(recent)} days`} in 12 weeks</span>
      </div>
      <div className="days" role="img" aria-label={`Played on ${recent} of the last 84 days${played.has(today) ? ', including today' : ''}.`}>
        {weeks.map((week, w) => (
          <div key={w} className="days-week">
            {week.map((day) => (
              <i key={day} title={day > today ? undefined : `${shortDay(day)}${played.has(day) ? ': played' : ''}`} className={day > today ? 'future' : played.has(day) ? 'on' : ''} data-today={day === today || undefined} />
            ))}
          </div>
        ))}
      </div>
      <div className="days-key fine"><span>12 weeks ago</span><span>This week</span></div>
    </section>
  );
}

type Item = { at: number; kind: 'match' | 'seeds' | 'change' | 'review' | 'account'; title: string; detail?: string; tone?: 'up' | 'down' | 'bad' };

function Timeline({ d }: { d: PlayerDetail }) {
  const [only, setOnly] = useState<'all' | Item['kind']>('all');
  const [all, setAll] = useState(false);
  const items = useMemo(() => {
    const list: Item[] = [];
    list.push({ at: d.profile.createdAt, kind: 'account', title: 'Joined the game' });
    for (const i of d.identities) list.push({ at: i.createdAt, kind: 'account', title: `Saved their progress with ${PROVIDER[i.provider] ?? i.provider}`, detail: i.email ?? undefined });
    for (const m of d.matches) {
      const verb = m.result === 'win' ? 'Won' : m.result === 'loss' ? 'Lost' : 'Drew';
      list.push({
        at: m.at,
        kind: 'match',
        title: `${verb} against ${m.opponent.name ?? 'a player who left'}`,
        detail: [KIND[m.kind] ?? m.kind, modeName(m.mode), m.score, m.stake ? `${fmt(m.stake)} seeds${m.paid ? '' : ', stakes sent back'}` : 'Free'].join(' · '),
        tone: m.result === 'win' ? 'up' : undefined,
      });
    }
    for (const l of d.ledger) {
      if (MATCH_LEDGER.has(l.reason)) continue;
      list.push({ at: l.at, kind: 'seeds', title: `${l.delta > 0 ? '+' : '−'}${fmt(Math.abs(l.delta))} seeds`, detail: LEDGER[l.reason] ?? l.reason, tone: l.delta > 0 ? 'up' : 'down' });
    }
    for (const a of d.actions) {
      const t = actionText(a.action, a.detail);
      list.push({ at: a.at, kind: 'change', title: t.title, detail: t.detail || undefined, tone: a.action === 'ban' ? 'bad' : undefined });
    }
    for (const a of d.appeals) {
      list.push({ at: a.at, kind: 'review', title: 'Asked for a ban review', detail: `"${a.message}"` });
    }
    return list.sort((a, b) => b.at - a.at);
  }, [d]);
  const shown = items.filter((i) => only === 'all' || i.kind === only);
  const cut = all ? shown : shown.slice(0, 20);
  const filters: { id: 'all' | Item['kind']; label: string }[] = [
    { id: 'all', label: 'Everything' },
    { id: 'match', label: 'Matches' },
    { id: 'seeds', label: 'Seeds' },
    { id: 'change', label: 'Your changes' },
    { id: 'account', label: 'Account' },
  ];
  return (
    <section className="card p-tl" aria-labelledby="tl-title">
      <h2 id="tl-title" className="kicker">Timeline</h2>
      <div className="chips" role="radiogroup" aria-label="Show">
        {filters.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={only === f.id} onClick={() => { setOnly(f.id); setAll(false); }}>{f.label}</button>
        ))}
      </div>
      {cut.length === 0 ? (
        <p className="fine">Nothing here yet.</p>
      ) : (
        <ol className="timeline">
          {cut.map((i, n) => (
            <li key={n} className={i.tone ?? ''}>
              <i aria-hidden="true" />
              <div>
                <span>{i.title}</span>
                {i.detail && <small className="fine">{i.detail}</small>}
              </div>
              <small className="fine when">{when(i.at)}</small>
            </li>
          ))}
        </ol>
      )}
      {!all && shown.length > cut.length && <Button kind="ghost" size="sm" onClick={() => setAll(true)}>Show all {fmt(shown.length)}</Button>}
      <p className="fine">Matches against Baba Ayo aren't kept one by one, so they show only in days played. Matches against people: the last 20.</p>
    </section>
  );
}

function More({ d }: { d: PlayerDetail }) {
  if (!d.samePhone.length) return null;
  return (
    <section className="card p-more" aria-labelledby="t-phone">
      <h2 id="t-phone" className="kicker">Other players on the same phone</h2>
      <p className="fine">Their wins against each other don't move seeds.</p>
      <ul className="list">{d.samePhone.map((p) => <PlayerRow key={p.id} p={p} />)}</ul>
    </section>
  );
}

function ActionList({ d, onPick }: { d: PlayerDetail; onPick: (a: Act) => void }) {
  const p = d.profile;
  return (
    <ul className="menu">
      <li><button type="button" onClick={() => onPick('rename')}><b>Rename</b><small>Give them a new name. The game's name rules apply.</small></button></li>
      <li><button type="button" onClick={() => onPick('seeds')}><b>Add or take seeds</b><small>For fixing mistakes. They have {fmt(p.cowries)}.</small></button></li>
      <li><button type="button" onClick={() => onPick('push')}><b>Send a test notification</b><small>To every phone where they turned notifications on.</small></button></li>
      <li className="menu-gap" aria-hidden="true" />
      {p.ban ? (
        <li><button type="button" onClick={() => onPick('unban')}><b>Lift the ban</b><small>They can play people again.</small></button></li>
      ) : (
        <li><button type="button" className="danger" onClick={() => onPick('ban')}><b>Ban…</b><small>No play against people, off Ranks and leagues.</small></button></li>
      )}
    </ul>
  );
}

const SHEET_TITLE: Record<Act, string> = {
  rename: 'Rename',
  ban: 'Ban this player',
  unban: 'Lift the ban',
  seeds: 'Add or take seeds',
  push: 'Send a test notification',
};

/** Reasons Yves gives most, written to the player, who reads them. */
const REASONS = [
  { label: 'Rude name', text: 'Your name broke the name rules.' },
  { label: 'Rude messages', text: 'Your messages in matches broke the rules.' },
  { label: 'Farming seeds', text: 'Playing against your own second account to win seeds.' },
  { label: 'Other', text: '' },
];
const LENGTH_LABEL: Record<number, string> = { 1: '24 hours', 7: '7 days', 30: '30 days' };

function ActSheet({ act, d, info, onClose, onDone }: { act: Act | null; d: PlayerDetail; info: Info | null; onClose: () => void; onDone: () => void }) {
  const { copy } = useApp();
  const p = d.profile;
  const [name, setName] = useState(p.name);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState<number | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timed = !!info?.timedBans;
  const lengths = timed ? (info?.banDays ?? []) : [];
  // A first ban is usually short: 7 days where bans can end by themselves.
  useEffect(() => {
    if (act === 'ban') setDays(timed && lengths.includes(7) ? 7 : null);
  }, [act, timed]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setError(null);
    setReason('');
    setDays(null);
    setPreset(null);
    setAmount('');
    setMessage('');
    setName(p.name);
  };
  const close = () => {
    reset();
    onClose();
  };

  const run = async () => {
    if (!act) return;
    setBusy(true);
    setError(null);
    try {
      if (act === 'rename') {
        await api.act(copy, p.id, 'rename', { name: name.trim() });
        toast.ok(`Renamed to ${name.trim()}.`);
      } else if (act === 'ban') {
        await api.act(copy, p.id, 'ban', days ? { reason: reason.trim(), days } : { reason: reason.trim() });
        toast.ok(days ? `${p.name} is banned for ${LENGTH_LABEL[days] ?? `${days} days`}.` : `${p.name} is banned.`);
      } else if (act === 'unban') {
        await api.act(copy, p.id, 'unban');
        toast.ok(`${p.name}'s ban is lifted.`);
      } else if (act === 'seeds') {
        const n = Number(amount.replace(/[\s,]/g, ''));
        await api.act(copy, p.id, 'seeds', { amount: n, reason: reason.trim() });
        toast.ok(`${n > 0 ? 'Added' : 'Took'} ${fmt(Math.abs(n))} seeds.`);
      } else {
        const r = await api.act(copy, p.id, 'push', message.trim() ? { body: message.trim() } : {});
        if (!r.phones) toast("They haven't turned on notifications on any phone.");
        else toast.ok(`Sent to ${r.sent} of ${r.phones} ${r.phones === 1 ? 'phone' : 'phones'}.`);
      }
      reset();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const n = Number(amount.replace(/[\s,]/g, ''));
  const seedsOk = Number.isInteger(n) && n !== 0 && reason.trim().length >= 3;

  return (
    <Sheet open={!!act} title={act ? SHEET_TITLE[act] : ''} onClose={close}>
      {act && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          {act === 'rename' && (
            <>
              <p className="muted">The game's name rules apply: 3 to 16 letters, numbers and single spaces, not rude, and not taken.</p>
              <Field label="New name" error={error}>
                <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </Field>
              <Button type="submit" busy={busy} block disabled={name.trim() === p.name || name.trim().length < 3}>Rename to {name.trim() || '…'}</Button>
            </>
          )}
          {act === 'ban' && (
            <>
              <p className="muted">{p.name} won't be able to play people, and drops off Ranks and leagues. They can still play Baba Ayo, and they can ask you to look at the ban again.</p>
              <div className="field">
                <span className="field-label">Reason</span>
                <div className="chips" role="radiogroup" aria-label="Reason">
                  {REASONS.map((r) => (
                    <button key={r.label} type="button" role="radio" aria-checked={preset === r.label} onClick={() => { setPreset(r.label); setReason(r.text); }}>{r.label}</button>
                  ))}
                </div>
              </div>
              <Field label="What they read" hint="They see this, so write it to them. 3 to 200 characters." error={error}>
                <textarea className="input" rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="field">
                <span className="field-label">How long</span>
                <div className="chips" role="radiogroup" aria-label="How long">
                  {lengths.map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={days === n} onClick={() => setDays(n)}>{LENGTH_LABEL[n] ?? `${n} days`}</button>
                  ))}
                  <button type="button" role="radio" aria-checked={days === null} onClick={() => setDays(null)}>Until I lift it</button>
                </div>
                {!timed && <span className="field-hint">Bans that end by themselves are on the test game. On the live game they wait for the lawyer's OK (docs/BANS-REVIEW.md).</span>}
              </div>
              <Button type="submit" kind="danger" busy={busy} block disabled={reason.trim().length < 3}>
                {days ? `Ban ${p.name} for ${LENGTH_LABEL[days] ?? `${days} days`}` : `Ban ${p.name} until I lift it`}
              </Button>
            </>
          )}
          {act === 'unban' && (
            <>
              <p className="muted">{p.name} can play people again and comes back to Ranks. A ban review they asked for is answered as lifted.</p>
              {error && <p className="field-error" role="alert">{error}</p>}
              <Button type="submit" busy={busy} block>Lift the ban</Button>
            </>
          )}
          {act === 'seeds' && (
            <>
              <p className="muted">For fixing mistakes. {p.name} has {fmt(p.cowries)} seeds. Use a minus sign to take seeds. Nobody goes below 0.</p>
              <Field label="Amount" hint="For example 500 or -200">
                <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d\s,-]/g, ''))} />
              </Field>
              {seedsOk && <p className="fine">They go from {fmt(p.cowries)} to {fmt(p.cowries + n)}.</p>}
              <Field label="Reason" hint="For your log. 3 to 200 characters." error={error}>
                <input className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button type="submit" busy={busy} block disabled={!seedsOk}>
                {seedsOk ? `${n > 0 ? 'Add' : 'Take'} ${fmt(Math.abs(n))} seeds` : 'Add or take seeds'}
              </Button>
            </>
          )}
          {act === 'push' && (
            <>
              <p className="muted">Goes to every phone where {p.name} turned on notifications. Use it to check notifications reach them.</p>
              <Field label="Message" hint="Leave it empty to send: A test notification from Dara X&O." error={error}>
                <input className="input" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
              <Button type="submit" busy={busy} block>Send</Button>
            </>
          )}
        </form>
      )}
    </Sheet>
  );
}
