// Today: the 8 am email for any day, as a page you can act on. What needs you first, then the
// email's headline and sections, each with the last 14 days and a page of its own.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { Meter, Spark, valueText, type Point } from '../charts.tsx';
import { addDays, dayName, fmt, longDay, shortDay } from '../format.ts';
import { LEVEL_WORD, needsFor, rankNeeds, type Need } from '../needs.ts';
import { change, headline, limitsOf, SECTIONS, whenFor } from '../sections.ts';
import type { Report } from '../types.ts';
import { go, Icon, Problem, Skeleton, toast, useLoad, useMedia } from '../ui.tsx';
import { LiveNow } from './Growth.tsx';
import { checksOf, HealthCard, healthNeeds, useHealth } from './Health.tsx';
import { controlNeeds, useControls } from './Controls.tsx';

export function DayBar() {
  const { day, setDay, today } = useApp();
  return (
    <div className="daybar">
      <button type="button" className="icon-btn" aria-label="The day before" onClick={() => setDay(addDays(day, -1))}>
        <Icon name="left" />
      </button>
      <label className="day-pick">
        <span className="day-name">{dayName(day, today)}</span>
        <span className="day-long">{longDay(day)}</span>
        <input type="date" value={day} max={today} aria-label="Pick a day" onChange={(e) => e.target.value && e.target.value <= today && setDay(e.target.value)} />
      </label>
      <button type="button" className="icon-btn" aria-label="The day after" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
        <Icon name="right" />
      </button>
    </div>
  );
}

export function useRange(days = 14) {
  const { copy, day } = useApp();
  return useLoad(`${copy}:${day}:${days}`, () => api.range(copy, day, days));
}

export function Today() {
  const { copy, day, today } = useApp();
  const range = useRange(14);
  const appeals = useLoad(`${copy}:appeals-open`, () => api.appeals(copy, 'open'));
  // Phones with 3 or more players that gained one in the last day (the game's worker/phones.ts).
  const phones = useLoad(`${copy}:phones:3`, () => api.phones(copy, 3));
  // Lost-code requests waiting for an answer (the game's worker/codes.ts).
  const lost = useLoad(`${copy}:recoveries-open`, () => api.recoveries(copy, 'open'));
  const lostOpen = lost.data?.recoveries.filter((x) => x.state === 'open').length ?? 0;
  // System health (docs/HEALTH.md): the card under Live now, and anything down on Needs you.
  const health = useHealth();
  // Switches turned off in Controls stay on Needs you until they're back on.
  const controls = useControls();
  const [sending, setSending] = useState(false);
  const yesterday = addDays(today, -1);
  const when = whenFor(day, today, yesterday);

  const days = range.data?.days ?? [];
  const at = days.findIndex((d) => d.day === day);
  const r = at >= 0 ? days[at].report : undefined;
  const before = at > 0 ? days[at - 1].report : undefined;
  const dayError = at >= 0 ? days[at].error : undefined;
  /** On a computer the free plan sits under Live now, beside the numbers. */
  const rail = useMedia('(min-width: 1024px)') && !dayError;
  const busy = phones.data?.busy ?? 0;
  const needs = range.data
    ? [
        ...needsFor(days, day, today, appeals.data ? appeals.data.appeals.length : null),
        ...healthNeeds(health),
        ...controlNeeds(controls),
        ...(lostOpen > 0
          ? [{
              id: 'recovery',
              level: 'warn' as const,
              title: lostOpen === 1 ? 'Someone lost their player code' : `${lostOpen} players lost their code`,
              body: 'They asked for help from a phone. Check their answers in Reviews, then Recovery.',
              go: 'reviews' as const,
              action: 'Answer',
            }]
          : []),
        ...(busy > 0
          ? [{
              id: 'phones',
              level: 'warn' as const,
              title: busy === 1 ? 'A phone got its third player in the last day' : `${busy} phones got a third player in the last day`,
              body: 'It can be one person making players to farm seeds, or a family sharing a phone. Check who they are.',
              go: 'phones' as const,
              action: 'See shared phones',
            }]
          : []),
      ]
    : [];

  const send = async () => {
    setSending(true);
    try {
      const res = await api.sendReport(copy, day);
      toast.ok(`Sent to ${res.to === 1 ? '1 address' : `${res.to} addresses`}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The email didn't go.");
    } finally {
      setSending(false);
    }
  };

  const ranked = rankNeeds(needs);
  const checks = checksOf(health);
  const healthLine = !checks ? '' : checks.every((c) => c.state === 'ok' || c.state === 'off')
    ? `All ${checks.filter((c) => c.state === 'ok').length} services working.`
    : checks.some((c) => c.state === 'down' || c.state === 'warn') ? 'A service needs a look.' : 'Some services couldn\'t be checked.';

  return (
    <div className="today">
      <div className="today-day">
        <h1 className="wide-only">Today</h1>
        <DayBar />
      </div>

      {range.data && r && !dayError && (
        <StatusLine
          needs={ranked.length}
          line={ranked.length ? 'Start with the first one. The rest can wait until it\'s done.' : `Nothing needs you. ${headline(r, when === 'today' ? 'so far today' : when).split('. ')[0]}. ${healthLine}`.trim()}
          at={range.at}
        />
      )}

      <div className="today-cols">
        <div className="today-main">
          {range.error ? (
            <Problem text={range.error} onRetry={range.reload} />
          ) : !range.data ? (
            <>
              <Skeleton kind="block" rows={1} label="Getting the numbers" />
              <Skeleton kind="cards" rows={4} label="Getting the numbers" />
            </>
          ) : dayError || !r ? (
            <Problem text={dayError ?? 'No numbers for this day.'} onRetry={range.reload} />
          ) : (
            <>
              {ranked.length > 0 && <Needs needs={ranked} />}

              <section className="card lead" aria-labelledby="headline">
                <div className="lead-head">
                  <h2 id="headline" className="kicker">{day === today ? 'So far today' : day === yesterday ? "Yesterday's numbers" : `Numbers for ${dayName(day, today)}`}</h2>
                  <div className="lead-tools">
                    <EmailMenu href={api.reportUrl(copy, day)} sending={sending} onSend={send} />
                    <button type="button" className="icon-btn sm" aria-label="Refresh" onClick={() => { range.reload(); appeals.reload(); }}>
                      {range.loading ? <span className="spin" aria-hidden="true" /> : <Icon name="refresh" size={18} />}
                    </button>
                  </div>
                </div>
                <p className="lead-text">{headline(r, when === 'today' ? 'so far today' : when)}</p>
                {day === today && <p className="fine">Today isn't over. These numbers grow until midnight, Lagos time.{range.at ? ` Updated ${new Date(range.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.` : ''}</p>}
                <div className="trio">
                  <Big label="Played" now={r.players.played} before={before?.players.played ?? r.players.playedDayBefore} />
                  <Big label="New players" now={r.players.joined} before={before?.players.joined} />
                  <Big label="Matches" now={r.matches.total} before={before?.matches.total} />
                </div>
              </section>

              <div className="cards today-cards">
                {SECTIONS.map((s) => (s.id === 'plan' ? (rail ? null : <PlanCard key={s.id} r={r} />) : <SectionCard key={s.id} id={s.id} days={days} r={r} before={before} />))}
              </div>
              <p className="fine center today-foot">"Played" means finished a match, on Lagos days. A best-of series counts as one match.</p>
            </>
          )}
        </div>

        <div className="today-live">
          <LiveNow />
          <HealthCard h={health} />
          {rail && r && <PlanCard r={r} />}
        </div>
      </div>
    </div>
  );
}

/** One line at the top that says how things are, the same height every time. */
function StatusLine({ needs, line, at }: { needs: number; line: string; at: number | null }) {
  return (
    <section className={`status-line ${needs ? 'needs' : 'ok'}`} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true">{needs ? needs : <Icon name="check" size={18} />}</span>
      <div>
        <b>{needs === 0 ? 'All clear' : needs === 1 ? '1 thing needs you' : `${needs} things need you`}</b>
        <span>{line}</span>
      </div>
      {at && <small>Checked {new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small>}
    </section>
  );
}

/** "View the email" and "Email it to me now", tucked into the numbers card so the page has one main button. */
function EmailMenu({ href, sending, onSend }: { href: string; sending: boolean; onSend: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', away);
    addEventListener('keydown', key);
    return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="email-menu" ref={box}>
      <button type="button" className="menu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {sending ? <span className="spin" aria-hidden="true" /> : <Icon name="mail" size={16} />}
        <span>The 8 am email</span>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <a role="menuitem" href={href} target="_blank" rel="noopener" onClick={() => setOpen(false)}><Icon name="open" size={16} />View the email</a>
          <button type="button" role="menuitem" disabled={sending} onClick={() => { setOpen(false); onSend(); }}><Icon name="send" size={16} />Email it to me now</button>
        </div>
      )}
    </div>
  );
}

function Big({ label, now, before }: { label: string; now: number; before?: number }) {
  return (
    <div className="big">
      <b>{fmt(now)}</b>
      <span>{label}</span>
      {before !== undefined && <small className={now > before ? 'up' : now < before ? 'down' : ''}>{now === before ? 'Same' : `${now > before ? 'Up' : 'Down'} ${fmt(Math.abs(now - before))}`}</small>}
    </div>
  );
}

/** Needs you: one card, in the order to do them. Only the first gets a button; three show, the rest wait behind "Show more". */
function Needs({ needs }: { needs: Need[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? needs : needs.slice(0, 3);
  const open = (n: Need) => {
    if (n.id === 'recovery') { try { localStorage.setItem('admin:reviews-tab', 'recovery'); } catch { /* fine */ } }
    go(n.go === 'reviews' ? '/reviews' : n.go === 'health' ? '/health' : n.go === 'controls' ? '/controls' : n.go === 'phones' ? '/players/phones?min=3' : `/section/${n.go!.slice(8)}`);
  };
  return (
    <section className="card needs-card" aria-labelledby="needs-title">
      <h2 id="needs-title" className="kicker">Needs you, in order</h2>
      <ol className="todo">
        {shown.map((n, i) => (
          <li key={n.id} className={n.level}>
            <span className="todo-n" aria-hidden="true">{i + 1}</span>
            <div>
              <p className="need-title">{n.title}</p>
              <p className="fine"><span className="lvl">{LEVEL_WORD[n.level]}.</span> {n.body}</p>
            </div>
            {n.go && (i === 0
              ? <button type="button" className="mini-btn" onClick={() => open(n)}>{n.action}</button>
              : <button type="button" className="go-link" onClick={() => open(n)}>{n.action}</button>)}
          </li>
        ))}
      </ol>
      {needs.length > 3 && (
        <button type="button" className="more-link" aria-expanded={all} onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show ${needs.length - 3} more`}
        </button>
      )}
    </section>
  );
}

export function pointsFor(days: { day: string; report?: Report }[], get: (r: Report) => number | null, of?: (r: Report) => string): Point[] {
  return days.map((d) => ({ day: d.day, value: d.report ? get(d.report) : null, of: d.report && of ? of(d.report) : undefined }));
}

function SectionCard({ id, days, r, before }: { id: string; days: { day: string; report?: Report }[]; r: Report; before?: Report }) {
  const { today } = useApp();
  const s = SECTIONS.find((x) => x.id === id)!;
  const m = s.metrics[0];
  const now = m.get(r);
  const prev = before ? m.get(before) : null;
  const sub = m.unit === 'count' && now !== null && prev !== null ? change(now, prev) : m.of ? m.of(r) : '';
  return (
    <a className="card section-card" href={`/section/${id}`} onClick={(e) => { e.preventDefault(); go(`/section/${id}`); }}>
      <div className="section-top">
        <h2 className="kicker">{s.title}</h2>
        <Icon name="right" size={18} />
      </div>
      <div className="section-body">
        <div>
          <b className="num">{valueText(now, m.unit)}</b>
          <span className="num-label">{m.label}</span>
          {sub && <small className="fine">{sub.charAt(0).toUpperCase() + sub.slice(1)}</small>}
        </div>
        <Spark points={pointsFor(days, m.get)} today={today} unit={m.unit} />
      </div>
      {id === 'also' && (
        <ul className="mini-rows">
          {s.rows(r, '').map((row) => (
            <li key={row.label}><span>{row.label}</span><b>{row.value}</b></li>
          ))}
        </ul>
      )}
    </a>
  );
}

function PlanCard({ r }: { r: Report }) {
  const lim = limitsOf(r);
  return (
    <a className="card section-card" href="/section/plan" onClick={(e) => { e.preventDefault(); go('/section/plan'); }}>
      <div className="section-top">
        <h2 className="kicker">Free plan{r.usage ? `, ${shortDay(r.usage.day)} (UTC)` : ''}</h2>
        <Icon name="right" size={18} />
      </div>
      {r.usage ? (
        <div className="meters">
          {lim.map((l) => <Meter key={l.id} {...l} />)}
        </div>
      ) : (
        <p className="fine">Free plan numbers are off on this copy. Add the CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN secrets to the game to turn them on.</p>
      )}
    </a>
  );
}
