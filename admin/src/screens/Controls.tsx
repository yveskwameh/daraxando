// Controls (Yves, 21 October 2026, from the approved docs/controls-prototype.html): turn parts of the
// game off and on without a push, put one announcement on Home, and send news to phones that turned
// news on. Everything goes through the game's admin API (worker/controls.ts) and into the Log.
import { useEffect, useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { BANNER_ACTIONS, BANNER_MAX, lineProblem, NEWS_MAX, NEWS_PER_MONTH, quietWhenOff } from '../../../shared/controls.ts';
import { fmt, shortDate, when } from '../format.ts';
import type { BannerAction, BannerRow, ControlsView, SwitchRow } from '../types.ts';
import { Button, Empty, Field, Icon, Problem, Sheet, Skeleton, toast, useLoad, type Loaded } from '../ui.tsx';

type Tab = 'switches' | 'banner' | 'news';
const TAB_KEY = 'admin:controls-tab';
const savedTab = (): Tab => {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return t === 'banner' || t === 'news' ? t : 'switches';
  } catch {
    return 'switches';
  }
};

export const useControls = () => {
  const { copy } = useApp();
  return useLoad(`${copy}:controls`, () => api.controls(copy));
};

export function Controls() {
  const c = useControls();
  const [tab, setTab] = useState<Tab>(savedTab);
  // Changes come back as the whole page, so the list never shows something stale.
  const [view, setView] = useState<ControlsView | null>(null);
  useEffect(() => setView(c.data), [c.data]);
  const pick = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* fine */ }
  };
  return (
    <div className="stack-group controls">
      <div className="titled">
        <h1>Controls</h1>
        <p className="muted">Turn parts of the game off and on without a push. Changes reach players within a minute, and every change goes in the Log.</p>
      </div>
      <div className="seg wide fit" role="radiogroup" aria-label="Kind of control">
        <button type="button" role="radio" aria-checked={tab === 'switches'} onClick={() => pick('switches')}>Switches</button>
        <button type="button" role="radio" aria-checked={tab === 'banner'} onClick={() => pick('banner')}>Announcement</button>
        <button type="button" role="radio" aria-checked={tab === 'news'} onClick={() => pick('news')}>News</button>
      </div>
      {c.error && !view ? (
        <Problem text={c.error} onRetry={c.reload} />
      ) : !view ? (
        <Skeleton kind="cards" rows={3} label="Getting the controls" />
      ) : tab === 'switches' ? (
        <Switches view={view} onView={setView} />
      ) : tab === 'banner' ? (
        <Announcement view={view} onView={setView} />
      ) : (
        <News view={view} onView={setView} />
      )}
    </div>
  );
}

const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
const sinceText = (ms: number) => (Date.now() - ms < 20 * 3_600_000 ? time(ms) : when(ms));

/* ---------------- switches ---------------- */

function Switches({ view, onView }: { view: ControlsView; onView: (v: ControlsView) => void }) {
  const { copy } = useApp();
  const [asking, setAsking] = useState<SwitchRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  // The 8 am email being off is a choice, so it doesn't raise the warning line.
  const off = view.switches.filter((s) => !s.on && !quietWhenOff(s.id));
  const groups = [...new Set(view.switches.map((s) => s.group))];

  const set = async (s: SwitchRow, on: boolean, why?: string) => {
    setBusy(s.id);
    try {
      onView(await api.setSwitch(copy, s.id, on, why));
      toast.ok(on ? `Back on: ${s.name}.` : `Turned off: ${s.name}.`);
      setAsking(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {off.length > 0 && (
        <p className="alert-line" role="status">
          <Icon name="alert" size={18} />
          <span>{off.length === 1 ? `1 switch is off: ${off[0].name}, since ${sinceText(off[0].since!)}.` : `${off.length} switches are off: ${off.map((s) => s.name).join(', ')}.`}</span>
        </p>
      )}
      <div className="switch-groups">
        {groups.map((g) => (
          <section key={g} className="card" aria-label={g}>
            <h2 className="kicker">{g}</h2>
            <ul className="sw-list">
              {view.switches.filter((s) => s.group === g).map((s) => (
                <li key={s.id} className={`sw-row${s.on ? '' : ' off'}`}>
                  <div>
                    <b>{s.name}</b>
                    {s.on ? (
                      <span>{s.line}</span>
                    ) : (
                      <span className="sw-off">Off since {sinceText(s.since!)}{s.reason ? `: ${s.reason}` : ''}.{s.off ? ` Players see "${s.off}"` : ''}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="toggle"
                    role="switch"
                    aria-checked={s.on}
                    aria-label={s.name}
                    aria-busy={busy === s.id || undefined}
                    disabled={busy === s.id}
                    onClick={() => {
                      // Turning one back on is one tap. Turning one off asks first.
                      if (!s.on) void set(s, true);
                      else {
                        setReason('');
                        setAsking(s);
                      }
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Sheet open={!!asking} title={asking ? `Turn off ${asking.name}?` : ''} onClose={() => setAsking(null)}>
        {asking && (
          <form
            className="stack-group"
            onSubmit={(e) => {
              e.preventDefault();
              void set(asking, false, reason);
            }}
          >
            <p className="muted">
              {asking.id === 'reminders'
                ? 'No 7 pm streak reminders go out until you turn it back on.'
                : asking.id === 'report'
                ? 'No 8 am email until you turn it back on. Today shows the same numbers, and Send now still sends one.'
                : `Matches already playing finish as normal. Players see: "${asking.off}"`}
            </p>
            <Field label="Why (only you see this)" hint="It goes in the Log with the change.">
              <input className="input" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Matchmaker errors after the update" required minLength={3} />
            </Field>
            <div className="stack">
              <Button kind="danger" type="submit" block busy={busy === asking.id} disabled={reason.trim().length < 3}>{`Turn off ${asking.name}`}</Button>
              <Button kind="ghost" block onClick={() => setAsking(null)}>Keep it on</Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}

/* ---------------- the announcement on Home ---------------- */

const pad = (n: number) => String(n).padStart(2, '0');
/** A time for an <input type="datetime-local">, in this computer's time. */
const localInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const span = (b: { startsAt: number; endsAt: number }) => `${when(b.startsAt)} to ${when(b.endsAt)}`;

function Announcement({ view, onView }: { view: ControlsView; onView: (v: ControlsView) => void }) {
  const { copy } = useApp();
  const current = view.banners.filter((b) => b.state === 'live' || b.state === 'scheduled');
  const past = view.banners.filter((b) => b.state === 'past' || b.state === 'stopped');
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [writing, setWriting] = useState(current.length === 0);
  const [stopping, setStopping] = useState<BannerRow | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = async (b: BannerRow) => {
    setBusy(true);
    try {
      onView(await api.stopBanner(copy, b.id));
      toast.ok('Stopped. Players stop seeing it within a minute.');
      setStopping(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ctl-cols">
      <div className="stack-group">
        {current.map((b) => (
          <section key={b.id} className="card">
            <span className={`state-tag ${b.state}`}>{b.state === 'live' ? 'Showing now' : 'Scheduled'}</span>
            <p className="ann-text">{b.text}</p>
            <p className="fine">{span(b)}{b.action ? `, with a ${BANNER_ACTIONS[b.action]} button` : ''}. Once per phone.</p>
            <div className="act-row">
              <Button kind="ghost" size="sm" onClick={() => { setEditing(b); setWriting(true); }}>Change</Button>
              <Button kind="danger" size="sm" onClick={() => setStopping(b)}>Stop it</Button>
            </div>
          </section>
        ))}
        {writing || editing ? (
          <BannerForm
            key={editing?.id ?? 'new'}
            start={editing}
            onCancel={current.length ? () => { setEditing(null); setWriting(false); } : undefined}
            onDone={(v) => {
              onView(v);
              setEditing(null);
              setWriting(false);
            }}
          />
        ) : (
          <Button kind="ghost" block onClick={() => setWriting(true)}>Write another announcement</Button>
        )}
      </div>
      <section className="card" aria-labelledby="past-ann">
        <h2 id="past-ann" className="kicker">Past 30 days</h2>
        {past.length ? (
          <ul className="plain-rows">
            {past.map((b) => (
              <li key={b.id}>
                <b>{b.text}</b>
                <small>{b.state === 'stopped' ? `Stopped ${when(b.stoppedAt!)}` : `Showed ${span(b)}`}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fine">Announcements you've shown stay here for 30 days, so you can copy one again.</p>
        )}
      </section>
      <Sheet open={!!stopping} title="Stop this announcement?" onClose={() => setStopping(null)}>
        {stopping && (
          <div className="stack-group">
            <p className="muted">"{stopping.text}" stops showing on Home within a minute. Phones that already closed it never see it again either way.</p>
            <div className="stack">
              <Button kind="danger" block busy={busy} onClick={() => void stop(stopping)}>Stop it</Button>
              <Button kind="ghost" block onClick={() => setStopping(null)}>Keep it</Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function BannerForm({ start, onDone, onCancel }: { start: BannerRow | null; onDone: (v: ControlsView) => void; onCancel?: () => void }) {
  const { copy } = useApp();
  const [text, setText] = useState(start?.text ?? '');
  const [action, setAction] = useState<BannerAction | null>(start?.action ?? 'quick');
  const [from, setFrom] = useState(localInput(start?.startsAt ?? Date.now()));
  const [until, setUntil] = useState(localInput(start?.endsAt ?? Date.now() + 86_400_000));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = text.trim() ? lineProblem(text, BANNER_MAX) : null;
  const len = text.trim().length;

  const save = async () => {
    setError(null);
    const startsAt = new Date(from).getTime();
    const endsAt = new Date(until).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return setError('Pick when it starts and ends.');
    setBusy(true);
    try {
      onDone(await api.saveBanner(copy, { id: start?.id, text, action, startsAt, endsAt }));
      toast.ok(startsAt <= Date.now() + 60_000 ? 'Scheduled. Players see it on Home within a minute.' : 'Scheduled.');
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label={start ? 'Change the announcement' : 'Write an announcement'}>
      <h2 className="kicker">{start ? 'Change the announcement' : 'Write an announcement'}</h2>
      <Field label="Message" error={problem}>
        <textarea className="input" value={text} rows={2} aria-invalid={!!problem || undefined} onChange={(e) => setText(e.target.value)} placeholder="Friday is Fading night. Find a player from 8 pm." />
      </Field>
      <span className={`count${len > BANNER_MAX ? ' bad' : ''}`}>{len} of {BANNER_MAX}</span>
      <div className="field">
        <span className="field-label">Button (optional)</span>
        <div className="chips" role="radiogroup" aria-label="Button">
          <button type="button" role="radio" aria-checked={action === null} onClick={() => setAction(null)}>None</button>
          {(Object.keys(BANNER_ACTIONS) as BannerAction[]).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={action === a} onClick={() => setAction(a)}>{BANNER_ACTIONS[a]}</button>
          ))}
        </div>
      </div>
      <div className="two-col">
        <Field label="Shows from"><input className="input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Until"><input className="input" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
      </div>
      <div className="field">
        <span className="field-label">Preview</span>
        <div className="ann-preview" aria-hidden="true">
          <span className="ann-ic"><Icon name="alert" size={18} /></span>
          <div><b>{text.trim() || 'Your message shows here.'}</b>{action && <span className="mini-btn">{BANNER_ACTIONS[action]}</span>}</div>
          <Icon name="x" size={18} />
        </div>
        <span className="field-hint">The game's own top pop-up: once per phone, never mid-match, and never with another pop-up.</span>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className={onCancel ? 'act-row' : 'stack'}>
        <Button type="submit" size="sm" busy={busy} disabled={!len || !!problem}>{start ? 'Save the change' : 'Schedule it'}</Button>
        {onCancel && <Button kind="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

/* ---------------- news notifications ---------------- */

function News({ view, onView }: { view: ControlsView; onView: (v: ControlsView) => void }) {
  const { copy } = useApp();
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = view.news;
  const problem = text.trim() ? lineProblem(text, NEWS_MAX) : null;
  const len = text.trim().length;
  const sending = n.sent.some((x) => !x.doneAt);

  const send = async () => {
    setBusy(true);
    try {
      onView(await api.sendNews(copy, text));
      toast.ok('Sending now, a few phones at a time.');
      setText('');
      setAsking(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't go.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ctl-cols">
      <form className="card" onSubmit={(e) => { e.preventDefault(); setAsking(true); }} aria-label="Send news">
        <h2 className="kicker">News from Dara X&amp;O</h2>
        <p className="fine">
          {fmt(n.phones)} {n.phones === 1 ? 'phone has' : 'phones have'} news turned on. Players were promised {NEWS_PER_MONTH} at most in 30 days: {n.left ? `${n.left} can go now` : `the next can go from ${n.nextAt ? shortDate(n.nextAt) : 'later'}`}. New games, events and fixes only, never about staking.
        </p>
        <Field label="Message" error={problem}>
          <textarea className="input" value={text} rows={3} aria-invalid={!!problem || undefined} onChange={(e) => setText(e.target.value)} placeholder="Big 5×5 is back. Find a player tonight from 8 pm." />
        </Field>
        <span className={`count${len > NEWS_MAX ? ' bad' : ''}`}>{len} of {NEWS_MAX}</span>
        <div className="field">
          <span className="field-label">Preview</span>
          <div className="note-preview" aria-hidden="true">
            <span className="note-ic">D</span>
            <div><b>News from Dara X&amp;O</b><span>{text.trim() || 'Your message shows here.'}</span></div>
          </div>
          <span className="field-hint">Tapping it opens the game on Home.</span>
        </div>
        <Button type="submit" size="sm" disabled={!len || !!problem || n.left === 0 || n.phones === 0 || sending}>
          {n.phones === 0 ? 'No phones have news on yet' : sending ? 'Still sending the last one' : `Send to ${fmt(n.phones)} ${n.phones === 1 ? 'phone' : 'phones'}`}
        </Button>
      </form>
      <section className="card" aria-labelledby="past-news">
        <h2 id="past-news" className="kicker">Sent</h2>
        {n.sent.length ? (
          <ul className="plain-rows">
            {n.sent.map((x) => (
              <li key={x.id}>
                <b>{x.text}</b>
                <small>{when(x.at)}. {x.doneAt ? `Reached ${fmt(x.sent)} of ${fmt(x.phones)} phones.` : `Sending: ${fmt(x.sent)} of ${fmt(x.phones)} so far.`}</small>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Nothing sent yet" text="Players turn news on in Settings, under Notifications." />
        )}
      </section>
      <Sheet open={asking} title={`Send to ${fmt(n.phones)} ${n.phones === 1 ? 'phone' : 'phones'}?`} onClose={() => setAsking(false)}>
        <div className="stack-group">
          <p className="muted">"{text.trim()}" goes to every phone with news turned on. It can't be taken back. That leaves {Math.max(0, n.left - 1)} of {NEWS_PER_MONTH} for the next 30 days.</p>
          <div className="stack">
            <Button block busy={busy} onClick={() => void send()}>Send it</Button>
            <Button kind="ghost" block onClick={() => setAsking(false)}>Not yet</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/** Switches that are off, for Needs you on Today. */
export function controlNeeds(c: Loaded<ControlsView>) {
  const off = c.data?.switches.filter((s) => !s.on && !quietWhenOff(s.id)) ?? [];
  if (!off.length) return [];
  return [{
    id: 'controls',
    level: 'warn' as const,
    title: off.length === 1 ? `${off[0].name} is turned off` : `${off.length} parts of the game are turned off`,
    body: off.length === 1 ? `Since ${sinceText(off[0].since!)}${off[0].reason ? `: ${off[0].reason}` : ''}.` : off.map((s) => s.name).join(', ') + '.',
    go: 'controls' as const,
    action: 'See Controls',
  }];
}
