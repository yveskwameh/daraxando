// The dashboard's charts, drawn as plain SVG. One series per chart, in --chart (indigo glow),
// thin bars with rounded tops on the baseline, a tooltip on hover or tap, and today drawn as an
// outline because it isn't over yet. Every chart's numbers are also on screen as text.
import { useId, useState } from 'react';
import { dayName, fmt, pct } from './format.ts';
import type { Unit } from './sections.ts';
import { ALARM, WARN } from './sections.ts';

export type Point = { day: string; value: number | null; of?: string };

export const valueText = (v: number | null, unit: Unit) =>
  v === null ? 'none yet' : unit === 'share' ? pct(v) : unit === 'secs' ? (v < 60 ? `${Math.round(v)} s` : `${Math.floor(v / 60)} min ${Math.round(v % 60)} s`) : fmt(v);

/** A bar with a rounded top on the baseline. */
function bar(x: number, w: number, top: number, base: number, r = 4) {
  const h = base - top;
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${base}V${top + rr}Q${x} ${top} ${x + rr} ${top}H${x + w - rr}Q${x + w} ${top} ${x + w} ${top + rr}V${base}Z`;
}

/** A round top for the axis: 1, 2, 5 or 10 times a power of ten. */
function niceMax(v: number, unit: Unit) {
  if (unit === 'share') return 1;
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** The small chart on each section card: the last days as bars, no axes. */
export function Spark({ points, today, unit }: { points: Point[]; today: string; unit: Unit }) {
  const W = 140;
  const H = 36;
  const max = Math.max(...points.map((p) => p.value ?? 0), unit === 'share' ? 0.0001 : 1);
  const top = unit === 'share' ? 1 : max;
  const slot = W / points.length;
  const w = Math.max(2, slot - 2);
  const label = `Last ${points.length} days: ${points.map((p) => valueText(p.value, unit)).join(', ')}`;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} preserveAspectRatio="none">
      <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="axis" />
      {points.map((p, i) => {
        const v = p.value ?? 0;
        const y = H - 1 - Math.max(v > 0 ? 2 : 0, (v / top) * (H - 2));
        const open = p.day === today;
        return <path key={p.day} d={bar(i * slot + 1, w, y, H - 1, 2)} className={open ? 'bar open' : 'bar'} />;
      })}
    </svg>
  );
}

/** The big chart on a section page: one bar a day, a value axis, a tooltip on hover or tap. */
export function Bars({ points, today, unit, label, onPick, pickedDay }: { points: Point[]; today: string; unit: Unit; label: string; onPick?: (day: string) => void; pickedDay?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const W = 340;
  const H = 180;
  const L = 34; // room for the axis numbers
  const B = 22; // room for the dates
  const plotW = W - L - 4;
  const plotH = H - B - 8;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)), unit);
  const slot = plotW / points.length;
  const w = Math.min(18, Math.max(3, slot - 2));
  const y = (v: number) => 8 + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const tickText = (v: number) => (unit === 'share' ? `${Math.round(v * 100)}%` : unit === 'secs' ? `${Math.round(v)}s` : v >= 10_000 ? `${Math.round(v / 1000)}k` : fmt(Math.round(v * 10) / 10));
  const dateIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const a = active === null ? null : points[active];
  const hasToday = points.some((p) => p.day === today);
  const limitLines = unit === 'share' && label.toLowerCase().includes('of the free plan');

  const move = (d: number) => setActive((i) => Math.max(0, Math.min(points.length - 1, (i ?? points.length - 1) + d)));

  return (
    <figure className="chart">
      <div
        className="chart-box"
        tabIndex={0}
        role="group"
        aria-label={`${label}, one bar a day. Use the arrow keys to read each day.`}
        aria-describedby={`${id}-tip`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
          if (e.key === 'Enter' && a && onPick) onPick(a.day);
          if (e.key === 'Escape') setActive(null);
        }}
        onBlur={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="presentation" onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - 4} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
              <text x={L - 6} y={y(t) + 4} className="tick" textAnchor="end">{tickText(t)}</text>
            </g>
          ))}
          {limitLines && (
            <>
              <line x1={L} x2={W - 4} y1={y(WARN)} y2={y(WARN)} className="ref warn" />
              <line x1={L} x2={W - 4} y1={y(ALARM)} y2={y(ALARM)} className="ref alarm" />
            </>
          )}
          {points.map((p, i) => {
            const x = L + i * slot + (slot - w) / 2;
            const v = p.value ?? 0;
            const top = v > 0 ? Math.min(y(v), y(0) - 2) : y(0);
            const cls = `bar${p.day === today ? ' open' : ''}${active === i ? ' on' : ''}`;
            return (
              <g key={p.day}>
                <path d={bar(x, w, top, y(0))} className={cls} />
                {p.value === null && <text x={x + w / 2} y={y(0) - 4} className="tick none" textAnchor="middle">–</text>}
                <rect
                  x={L + i * slot}
                  y={0}
                  width={slot}
                  height={H - B}
                  className="hit"
                  onPointerEnter={() => setActive(i)}
                  onClick={() => (active === i && onPick ? onPick(p.day) : setActive(i))}
                />
              </g>
            );
          })}
          {dateIdx.map((i, n) => (
            <text key={n} x={L + i * slot + slot / 2} y={H - 6} className="tick" textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}>{shortDate(points[i].day)}</text>
          ))}
        </svg>
        <div id={`${id}-tip`} className="tip" aria-live="polite" hidden={!a} style={a ? { left: `${Math.min(80, Math.max(20, ((L + (active! + 0.5) * slot) / W) * 100))}%` } : undefined}>
          {a && (
            <>
              <b>{valueText(a.value, unit)}</b>
              <span>{dayName(a.day, today)}{a.day === today ? ', so far' : ''}</span>
              {a.of && <span>{a.of}</span>}
              {onPick && a.day !== pickedDay && <span className="tip-go">Tap again to open it</span>}
            </>
          )}
        </div>
      </div>
      {(hasToday || limitLines) && (
        <figcaption className="fine">
          {limitLines ? 'The dashed lines are half and 80% of the daily limit. ' : ''}
          {hasToday ? "The outlined bar is today, which isn't over yet." : ''}
        </figcaption>
      )}
    </figure>
  );
}

/** One share of a free limit: the bar, the number and a word, so colour is never the only sign. */
export function Meter({ label, used, max, share }: { label: string; used: number | null; max: number; share: number | null }) {
  const level = share === null ? 'off' : share >= ALARM ? 'alarm' : share >= WARN ? 'warn' : 'ok';
  const word = level === 'alarm' ? 'Near the limit' : level === 'warn' ? 'Past half' : null;
  return (
    <div className={`meter ${level}`}>
      <div className="meter-top">
        <span>{label}</span>
        <b>{share === null ? 'not available' : pct(share)}</b>
      </div>
      <div className="meter-track" role="img" aria-label={share === null ? `${label}: not available` : `${label}: ${pct(share)} of the daily limit`}>
        {share !== null && <i style={{ transform: `scaleX(${Math.min(1, Math.max(0.01, share))})` }} />}
      </div>
      <div className="meter-sub">
        <span>{used === null ? '' : `${fmt(used)} of ${fmt(max)}`}</span>
        {word && <span className="meter-word">{word}</span>}
      </div>
    </div>
  );
}

/** Labelled bars side by side, for splits like matches by game. */
export function HBars({ rows, unit = 'count' }: { rows: { label: string; value: number; note?: string }[]; unit?: Unit }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="hbar-top">
            <span>{r.label}</span>
            <b>{valueText(r.value, unit)}{unit === 'count' && total > 0 ? <small> {pct(r.value / total)}</small> : null}</b>
          </div>
          <div className="hbar-track"><i style={{ transform: `scaleX(${r.value ? Math.max(0.02, r.value / max) : 0})` }} /></div>
          {r.note && <small className="fine">{r.note}</small>}
        </li>
      ))}
    </ul>
  );
}

/** One bar split into parts, with a key that names each part and its share. */
export function Split({ parts }: { parts: { label: string; value: number }[] }) {
  const sum = parts.reduce((a, p) => a + p.value, 0);
  if (!sum) return <p className="fine">Nobody played this day.</p>;
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.value / sum)}`).join(', ')}>
        {parts.map((p, i) => (p.value ? <i key={p.label} className={`c${i + 1}`} style={{ flexGrow: p.value }} /> : null))}
      </div>
      <ul className="split-key">
        {parts.map((p, i) => (
          <li key={p.label}>
            <i className={`c${i + 1}`} aria-hidden="true" />
            <span>{p.label}</span>
            <b>{fmt(p.value)}</b>
            <small>{pct(p.value / sum)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
