// Today: the 8 am email for any day, as a page you can act on. What needs you first, then the
// email's headline and sections, each with the last 14 days and a page of its own.
import { useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { Meter, Spark, valueText, type Point } from '../charts.tsx';
import { addDays, dayName, fmt, longDay, shortDay } from '../format.ts';
import { needsFor, type Need } from '../needs.ts';
import { change, headline, limitsOf, SECTIONS, whenFor } from '../sections.ts';
import type { Report } from '../types.ts';
import { Button, go, Icon, Problem, Skeleton, toast, useLoad, useMedia } from '../ui.tsx';
import { LiveNow } from './Growth.tsx';

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
  const needs = range.data ? needsFor(days, day, today, appeals.data ? appeals.data.appeals.length : null) : [];

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

  return (
    <div className="today">
      <div className="today-day">
        <h1 className="wide-only">Today</h1>
        <DayBar />
      </div>
      <div className="today-live">
        <LiveNow />
        {rail && r && <PlanCard r={r} />}
      </div>

      {range.error ? (
        <div className="today-main"><Problem text={range.error} onRetry={range.reload} /></div>
      ) : !range.data ? (
        <>
          <div className="today-main"><Skeleton kind="block" rows={1} label="Getting the numbers" /></div>
          <div className="today-cards"><Skeleton kind="cards" rows={6} label="Getting the numbers" /></div>
        </>
      ) : dayError || !r ? (
        <div className="today-main"><Problem text={dayError ?? 'No numbers for this day.'} onRetry={range.reload} /></div>
      ) : (
        <>
          <div className="today-needs"><Needs needs={needs} /></div>

          <section className="card lead today-lead" aria-labelledby="headline">
            <div className="lead-head">
              <h2 id="headline" className="kicker">{day === today ? 'So far today' : day === yesterday ? "Yesterday's numbers" : `Numbers for ${dayName(day, today)}`}</h2>
              <button type="button" className="icon-btn sm" aria-label="Refresh" onClick={() => { range.reload(); appeals.reload(); }}>
                {range.loading ? <span className="spin" aria-hidden="true" /> : <Icon name="refresh" size={18} />}
              </button>
            </div>
            <p className="lead-text">{headline(r, when === 'today' ? 'so far today' : when)}</p>
            {day === today && <p className="fine">Today isn't over. These numbers grow until midnight, Lagos time.{range.at ? ` Updated ${new Date(range.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.` : ''}</p>}
            <div className="trio">
              <Big label="Played" now={r.players.played} before={before?.players.played ?? r.players.playedDayBefore} />
              <Big label="New players" now={r.players.joined} before={before?.players.joined} />
              <Big label="Matches" now={r.matches.total} before={before?.matches.total} />
            </div>
            <div className="row-btns">
              <a className="btn ghost sm" href={api.reportUrl(copy, day)} target="_blank" rel="noopener">
                <Icon name="open" size={18} />
                <span>View the email</span>
              </a>
              <Button kind="ghost" size="sm" busy={sending} onClick={send}>Email it to me now</Button>
            </div>
          </section>

          <div className="cards today-cards">
            {SECTIONS.map((s) => (s.id === 'plan' ? (rail ? null : <PlanCard key={s.id} r={r} />) : <SectionCard key={s.id} id={s.id} days={days} r={r} before={before} />))}
          </div>
          <p className="fine center today-foot">"Played" means finished a match, on Lagos days. A best-of series counts as one match.</p>
        </>
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

function Needs({ needs }: { needs: Need[] }) {
  if (!needs.length) {
    return (
      <p className="calm">
        <Icon name="check" size={18} />
        Nothing needs you right now.
      </p>
    );
  }
  return (
    <section className="needs" aria-labelledby="needs-title">
      <h2 id="needs-title" className="kicker">Needs you</h2>
      <ul>
        {needs.map((n) => (
          <li key={n.id} className={`need ${n.level}`}>
            <Icon name="alert" size={20} />
            <div>
              <p className="need-title">{n.title}</p>
              <p className="fine">{n.body}</p>
            </div>
            {n.go && (
              <button type="button" className="mini-btn" onClick={() => go(n.go === 'reviews' ? '/reviews' : `/section/${n.go!.slice(8)}`)}>
                {n.action}
              </button>
            )}
          </li>
        ))}
      </ul>
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
