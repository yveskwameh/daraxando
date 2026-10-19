// One section of the email on its own page: pick a number, see it day by day over 14 or 30 days,
// then every row the email has for the chosen day, and the splits behind them.
import { useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { Bars, HBars, Meter, Split, valueText } from '../charts.tsx';
import { addDays, fmt, shortDay } from '../format.ts';
import { BUCKET_LABEL, cap, KIND_LABEL, limitsOf, MODE_IDS, modeName, sectionById, WAIT_BUCKETS, whenFor } from '../sections.ts';
import type { Kind, Report } from '../types.ts';
import { back, Empty, go, Icon, Problem, Skeleton, useLoad } from '../ui.tsx';
import { DayBar, pointsFor } from './Today.tsx';

export function Section({ id }: { id: string }) {
  const { copy, day, setDay, today } = useApp();
  const s = sectionById(id);
  const [metricId, setMetricId] = useState(s?.metrics[0].id ?? '');
  const [span, setSpan] = useState<14 | 30>(14);
  const range = useLoad(s ? `${copy}:${day}:${span}` : null, () => api.range(copy, day, span));

  if (!s) return <Empty title="There's no such section." />;
  const m = s.metrics.find((x) => x.id === metricId) ?? s.metrics[0];
  const days = range.data?.days ?? [];
  const r = days.find((d) => d.day === day)?.report;
  const dayError = days.find((d) => d.day === day)?.error;
  const when = whenFor(day, today, addDays(today, -1));

  return (
    <div className="stack-group">
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Back to Today" onClick={() => back('/')}>
          <Icon name="left" />
        </button>
        <h1>{s.title}</h1>
      </div>
      <DayBar />

      {range.error ? (
        <Problem text={range.error} onRetry={range.reload} />
      ) : !range.data ? (
        <Skeleton kind="block" rows={1} label="Getting the numbers" />
      ) : (
        <>
          <section className="card" aria-label={`${m.label}, day by day`}>
            <div className="chips" role="radiogroup" aria-label="Which number">
              {s.metrics.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={x.id === m.id} onClick={() => setMetricId(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
            <div className="chart-head">
              <div>
                <b className="num">{r ? valueText(m.get(r), m.unit) : 'none'}</b>
                <span className="num-label">{m.label}, {when === 'today' ? 'so far today' : when}</span>
                {r && m.of && <small className="fine">{m.of(r)}</small>}
              </div>
              <div className="seg sm" role="radiogroup" aria-label="How many days">
                {([14, 30] as const).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={span === n} onClick={() => setSpan(n)}>{n} days</button>
                ))}
              </div>
            </div>
            <Bars
              points={pointsFor(days, m.get, m.of)}
              today={today}
              unit={m.unit}
              label={s.id === 'plan' ? `${m.label} of the free plan` : m.label}
              onPick={(d) => setDay(d)}
              pickedDay={day}
            />
            <details className="table-view">
              <summary>Every day as a table</summary>
              <table>
                <thead><tr><th scope="col">Day</th><th scope="col">{m.label}</th></tr></thead>
                <tbody>
                  {[...days].reverse().map((d) => (
                    <tr key={d.day} aria-current={d.day === day ? 'true' : undefined}>
                      <th scope="row"><button type="button" className="cell-btn" onClick={() => setDay(d.day)}>{shortDay(d.day)}{d.day === today ? ', so far' : ''}</button></th>
                      <td>{d.report ? valueText(m.get(d.report), m.unit) : d.error ?? 'none'}{d.report && m.of ? <small> {m.of(d.report)}</small> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          {dayError || !r ? (
            <Problem text={dayError ?? 'No numbers for this day.'} onRetry={range.reload} />
          ) : (
            <>
              <Extras id={s.id} r={r} />
              {/* The free plan's rows are its meters, shown just above. */}
              {s.id !== 'plan' && <section className="card" aria-labelledby="rows-title">
                <h2 id="rows-title" className="kicker">As in the email</h2>
                <ul className="rows">
                  {s.rows(r, when).map((row) => (
                    <li key={row.label}>
                      <div>
                        <span>{row.label}</span>
                        {row.note && <small className="fine">{cap(row.note)}</small>}
                      </div>
                      <b>{row.value}</b>
                    </li>
                  ))}
                </ul>
              </section>}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** The splits behind a section's numbers, for the chosen day. */
function Extras({ id, r }: { id: string; r: Report }) {
  if (id === 'players') {
    const b = r.players.buckets;
    return (
      <section className="card" aria-labelledby="x-title">
        <h2 id="x-title" className="kicker">Who played</h2>
        <Split
          parts={[
            { label: 'Current', value: b.current },
            { label: 'First day', value: b.new },
            { label: 'Back after 7 to 29 days', value: b.reactivated },
            { label: 'Back after 30+ days', value: b.resurrected },
          ]}
        />
      </section>
    );
  }
  if (id === 'matches') {
    const m = r.matches;
    return (
      <>
        <section className="card" aria-labelledby="x-modes">
          <h2 id="x-modes" className="kicker">By game</h2>
          <HBars rows={MODE_IDS.map((mid) => ({ label: modeName(mid), value: m.modes[mid] ?? 0 }))} />
        </section>
        <section className="card" aria-labelledby="x-kinds">
          <h2 id="x-kinds" className="kicker">Against whom</h2>
          <HBars rows={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ label: KIND_LABEL[k], value: m.kinds[k] }))} />
        </section>
        {m.stakes.length > 0 && (
          <section className="card" aria-labelledby="x-stakes">
            <h2 id="x-stakes" className="kicker">Stakes, against people</h2>
            <HBars rows={m.stakes.map((st) => ({ label: st.stake ? `${fmt(st.stake)} seeds` : 'Free', value: st.n }))} />
          </section>
        )}
      </>
    );
  }
  if (id === 'quick') {
    const q = r.quick;
    const waits = (w: Record<number, number>) => WAIT_BUCKETS.map((b) => ({ label: BUCKET_LABEL[b], value: w[b] ?? 0 }));
    return (
      <>
        <section className="card" aria-labelledby="x-paired">
          <h2 id="x-paired" className="kicker">How long people waited to meet someone</h2>
          {q.paired ? <HBars rows={waits(q.pairedWaits)} /> : <p className="fine">Nobody started a game and met a person this day.</p>}
        </section>
        <section className="card" aria-labelledby="x-left">
          <h2 id="x-left" className="kicker">How long people waited before leaving</h2>
          {q.left ? <HBars rows={waits(q.leftWaits)} /> : <p className="fine">Nobody left a game before someone came this day.</p>}
        </section>
      </>
    );
  }
  if (id === 'saving') {
    const on = r.extra.pushOn;
    return (
      <section className="card" aria-labelledby="x-push">
        <h2 id="x-push" className="kicker">Where they turned on notifications</h2>
        <HBars rows={[{ label: 'The streak ask', value: on['streak-ask'] }, { label: 'The friend ask', value: on['friends-ask'] }, { label: 'Settings', value: on.settings }]} />
      </section>
    );
  }
  if (id === 'also') {
    return r.extra.appealsOpen ? (
      <button type="button" className="card need-link" onClick={() => go('/reviews')}>
        <span>{r.extra.appealsOpen === 1 ? '1 ban review was waiting' : `${fmt(r.extra.appealsOpen)} ban reviews were waiting`}</span>
        <span className="mini-btn">Open Reviews</span>
      </button>
    ) : null;
  }
  if (id === 'plan') {
    if (!r.usage) {
      return <p className="notice">Free plan numbers are off on this copy. Add the CF_ACCOUNT_ID and CF_ANALYTICS_TOKEN secrets to the game to turn them on (the game's README, "Secrets").</p>;
    }
    const u = r.usage;
    return (
      <section className="card" aria-labelledby="x-plan">
        <h2 id="x-plan" className="kicker">{shortDay(u.day)}, UTC day</h2>
        <div className="meters">
          {limitsOf(r).map((l) => <Meter key={l.id} {...l} />)}
        </div>
        <p className="fine">The limits count UTC days and reset at 1 am Lagos time. Going over any of them stops the game until then.</p>
        {u.requests && u.requests.copies.length > 1 && <p className="fine">Requests by copy: {u.requests.copies.map((c) => `${c.name} ${fmt(c.n)}`).join(', ')}.</p>}
        {u.errors ? <p className="fine">{fmt(u.errors)} requests ended in an error. Cloudflare's logs for the Worker show which.</p> : null}
        {u.problems.map((p) => <p key={p} className="fine">Couldn't read {p}</p>)}
      </section>
    );
  }
  return null;
}
