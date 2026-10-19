// One player: who they are, how they sign in, their seeds and matches, and the four things you
// can do (rename, ban or unban, add or take seeds, send a test notification). Each change opens
// a sheet that says what will happen, and the game's admin API logs it.
import { useState } from 'react';
import { stateName } from '../../../shared/places.ts';
import { titleFor } from '../../../shared/progression.ts';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { fmt, lagosDay, shortDay, when } from '../format.ts';
import { modeName } from '../sections.ts';
import type { PlayerDetail } from '../types.ts';
import { back, Button, copyText, Empty, Field, Icon, Loading, Problem, Sheet, toast, useLoad } from '../ui.tsx';
import { PlayerRow } from './Players.tsx';
import { actionText } from './Log.tsx';

type Act = 'rename' | 'ban' | 'unban' | 'seeds' | 'push';

const LEDGER: Record<string, string> = {
  start: 'Starting seeds',
  daily: 'Daily seeds',
  stake: 'Staked on a match',
  pot: 'Won the pot',
  refund: 'Stake back',
  sapa: 'Top-up when low',
  'streak-stake': 'Streak stake',
  'streak-win': 'Streak stake won',
  freeze: 'Bought a Streak Freeze',
  repair: 'Restored a streak',
  admin: 'Changed by you',
};
const KIND: Record<string, string> = { bot: 'Baba Ayo', quick: 'Quick match', friend: 'Friend' };
const PROVIDER: Record<string, string> = { google: 'Google', email: 'Email code' };

export function Player({ id }: { id: string }) {
  const { copy } = useApp();
  const res = useLoad(`${copy}:player:${id}`, () => api.player(copy, id));
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
        <Loading />
      ) : (
        <>
          <Profile d={res.data} onAct={setAct} />
          <Details d={res.data} />
          <ActSheet act={act} d={res.data} onClose={() => setAct(null)} onDone={() => { setAct(null); res.reload(); }} />
        </>
      )}
    </div>
  );
}

function Profile({ d, onAct }: { d: PlayerDetail; onAct: (a: Act) => void }) {
  const p = d.profile;
  const played = p.wins + p.losses + p.draws;
  return (
    <>
      <section className="card">
        <div className="who">
          <span className="initial lg" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
          <div>
            <p className="who-name">{p.name}</p>
            <p className="fine">{titleFor(p.level)} · {stateName(p.state)} · Joined {shortDay(lagosDay(p.createdAt))}</p>
            <p className="fine">{p.lastPlayedDay ? `Last played ${shortDay(p.lastPlayedDay)}` : 'Hasn\'t finished a match'} · {p.saved ? 'Saved their progress' : 'Guest'}</p>
          </div>
        </div>
        <button type="button" className="id-btn" onClick={() => copyText(p.id, 'Player id copied')}>
          <code>{p.id}</code>
          <Icon name="copy" size={16} />
          <span className="sr">Copy the player id</span>
        </button>
        <dl className="stats">
          <div><dt>Dara Seeds</dt><dd>{fmt(p.cowries)}</dd></div>
          <div><dt>Aura</dt><dd>{fmt(p.aura)}</dd></div>
          <div><dt>Rating</dt><dd>{fmt(p.rating)}</dd></div>
          <div><dt>Matches</dt><dd>{fmt(played)}</dd></div>
          <div><dt>Won, drew, lost</dt><dd>{fmt(p.wins)}, {fmt(p.draws)}, {fmt(p.losses)}</dd></div>
          <div><dt>Quick matches</dt><dd>{fmt(p.quickGames)}</dd></div>
          <div><dt>Day streak</dt><dd>{fmt(p.dayStreak)}</dd></div>
          <div><dt>Best run of wins</dt><dd>{fmt(p.bestWinStreak)}</dd></div>
        </dl>
      </section>

      {p.ban && (
        <section className="card ban" aria-labelledby="ban-title">
          <h2 id="ban-title" className="kicker">Banned {when(p.ban.at)}</h2>
          <p>{p.ban.reason}</p>
          <p className="fine">They can still play Baba Ayo. They're off Ranks and leagues and can't play people.</p>
        </section>
      )}

      <div className="act-row">
        <Button kind="ghost" size="sm" onClick={() => onAct('rename')}>Rename</Button>
        {p.ban ? <Button kind="ghost" size="sm" onClick={() => onAct('unban')}>Lift the ban</Button> : <Button kind="ghost" size="sm" onClick={() => onAct('ban')}>Ban</Button>}
        <Button kind="ghost" size="sm" onClick={() => onAct('seeds')}>Add or take seeds</Button>
        <Button kind="ghost" size="sm" onClick={() => onAct('push')}>Test notification</Button>
      </div>
    </>
  );
}

function Details({ d }: { d: PlayerDetail }) {
  return (
    <>
      <section className="card" aria-labelledby="t-signin">
        <h2 id="t-signin" className="kicker">Signs in with</h2>
        {d.identities.length ? (
          <ul className="rows">
            {d.identities.map((i) => (
              <li key={`${i.provider}${i.email}`}>
                <div><span>{PROVIDER[i.provider] ?? i.provider}</span>{i.email && <small className="fine">{i.email}</small>}</div>
                <small className="fine">Since {when(i.createdAt)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fine">Nothing yet. They play as a guest on one phone.</p>
        )}
      </section>

      {d.samePhone.length > 0 && (
        <section className="card" aria-labelledby="t-phone">
          <h2 id="t-phone" className="kicker">Other players on the same phone</h2>
          <p className="fine">Their wins against each other don't move seeds.</p>
          <ul className="list">{d.samePhone.map((p) => <PlayerRow key={p.id} p={p} />)}</ul>
        </section>
      )}

      {d.appeals.length > 0 && (
        <section className="card" aria-labelledby="t-appeals">
          <h2 id="t-appeals" className="kicker">Ban reviews</h2>
          <ul className="rows">
            {d.appeals.map((a) => (
              <li key={a.id}>
                <div>
                  <span>"{a.message}"</span>
                  <small className="fine">Asked {when(a.at)}{a.note ? `. Your note: ${a.note}` : ''}</small>
                </div>
                <span className={`tag-pill${a.status === 'open' ? ' warn' : ''}`}>{a.status === 'open' ? 'Waiting' : a.status === 'lifted' ? 'Lifted' : 'Kept'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="t-matches">
        <h2 id="t-matches" className="kicker">Last matches</h2>
        {d.matches.length ? (
          <ul className="rows">
            {d.matches.map((m) => (
              <li key={m.id}>
                <div>
                  <span><b className={`res ${m.result}`}>{m.result === 'win' ? 'Won' : m.result === 'loss' ? 'Lost' : 'Drew'}</b> {m.kind === 'bot' ? 'against Baba Ayo' : `against ${m.opponent.name ?? 'a player who left'}`}</span>
                  <small className="fine">
                    {[modeName(m.mode), KIND[m.kind] ?? m.kind, m.score, m.stake ? `${fmt(m.stake)} seeds${m.paid ? '' : ', stakes sent back'}` : 'Free', when(m.at)].filter(Boolean).join(' · ')}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No matches yet." />
        )}
      </section>

      <section className="card" aria-labelledby="t-ledger">
        <h2 id="t-ledger" className="kicker">Seeds history</h2>
        {d.ledger.length ? (
          <ul className="rows">
            {d.ledger.map((l, i) => (
              <li key={i}>
                <div><span>{LEDGER[l.reason] ?? l.reason}</span><small className="fine">{when(l.at)}</small></div>
                <b className={l.delta > 0 ? 'up' : 'down'}>{l.delta > 0 ? '+' : '−'}{fmt(Math.abs(l.delta))}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fine">No seeds have moved.</p>
        )}
      </section>

      {d.actions.length > 0 && (
        <section className="card" aria-labelledby="t-actions">
          <h2 id="t-actions" className="kicker">Your changes to this player</h2>
          <ul className="rows">
            {d.actions.map((a) => (
              <li key={a.id}>
                <div><span>{actionText(a.action, a.detail).title}</span><small className="fine">{actionText(a.action, a.detail).detail}</small></div>
                <small className="fine">{when(a.at)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const SHEET_TITLE: Record<Act, string> = {
  rename: 'Rename',
  ban: 'Ban this player',
  unban: 'Lift the ban',
  seeds: 'Add or take seeds',
  push: 'Send a test notification',
};

function ActSheet({ act, d, onClose, onDone }: { act: Act | null; d: PlayerDetail; onClose: () => void; onDone: () => void }) {
  const { copy } = useApp();
  const p = d.profile;
  const [name, setName] = useState(p.name);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    setReason('');
    setAmount('');
    setMessage('');
    setName(p.name);
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
        await api.act(copy, p.id, 'ban', { reason: reason.trim() });
        toast.ok(`${p.name} is banned.`);
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
      setReason('');
      setAmount('');
      setMessage('');
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
              <Field label="Reason" hint="They see this, so write it to them. 3 to 200 characters." error={error}>
                <textarea className="input" rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button type="submit" kind="danger" busy={busy} block disabled={reason.trim().length < 3}>Ban {p.name}</Button>
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
