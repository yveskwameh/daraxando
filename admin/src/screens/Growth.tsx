// Growth: traffic for any window, from the last hour to 30 days or since a time you pick (visits
// from Cloudflare Web Analytics on the live game, and new players from the game), how new players
// get on in their first days, and weekly retention. Plus the Live now card, which Today shows first.
import { useEffect, useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { Bars, HBars } from '../charts.tsx';
import { fmt, lagosDay, pct, shortDay } from '../format.ts';
import type { Bucket, FirstDays, Retention, Traffic } from '../types.ts';
import { go, Icon, Problem, Skeleton, useLoad, usePath } from '../ui.tsx';

/* ---------- Live now ---------- */

export function LiveNow() {
  const { copy } = useApp();
  const now = useLoad(`${copy}:now`, () => api.now(copy));
  const { reload } = now;
  // Every 30 seconds while the dashboard is on screen. Nothing while it's in the background.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && reload(), 30_000);
    const back = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', back);
    };
  }, [reload]);
  const d = now.data;
  return (
    <section className="card live" aria-labelledby="live-title">
      <div className="section-top">
        <h2 id="live-title" className="kicker"><span className="dot" aria-hidden="true" />Live now</h2>
        <button type="button" className="icon-btn sm" aria-label="Refresh" onClick={reload}>
          {now.loading ? <span className="spin" aria-hidden="true" /> : <Icon name="refresh" size={18} />}
        </button>
      </div>
      {now.error && !d ? (
        <p className="fine">{now.error}</p>
      ) : !d ? (
        <p className="fine">Loading</p>
      ) : (
        <>
          <div className="live-main">
            <b className="num">{d.home === null ? 'none' : fmt(d.home)}</b>
            <span className="num-label">{d.home === 1 ? 'player has the game open on Home' : 'players have the game open on Home'}</span>
          </div>
          <ul className="mini-rows">
            <li><span>Looking at Quick match</span><b>{d.looking === null ? 'none' : fmt(d.looking)}</b></li>
            <li><span>Waiting in a game of their own</span><b>{d.waiting === null ? 'none' : fmt(d.waiting)}</b></li>
            <li><span>Finished a match today</span><b>{fmt(d.playedToday)}</b></li>
          </ul>
          <p className="fine">
            {d.home === null ? "Couldn't reach the matchmaker. " : ''}
            Players in the middle of a match show up again when they're back on Home. Updates every 30 seconds.
          </p>
          <a className="link-in" href="/growth?w=1h" onClick={(e) => { e.preventDefault(); go('/growth?w=1h'); }}>Visits and new players in the last hour</a>
        </>
      )}
    </section>
  );
}

/* ---------- Growth ---------- */

export function Growth() {
  return (
    <div className="stack-group">
      <div className="titled">
        <h1>Growth</h1>
        <p className="muted">Traffic and new players for any stretch of time, and how new players get on.</p>
      </div>
      <TrafficCard />
      <div className="growth-pair">
        <FirstDaysCard />
        <RetentionCard />
      </div>
    </div>
  );
}

/** The site that sent a visit, as people say it. Sites that are one product are merged. */
export function sourceName(host: string) {
  const h = host.toLowerCase().replace(/^www\./, '');
  if (!h) return 'No referrer';
  const known: [RegExp, string][] = [
    [/(^|\.)instagram\.com$/, 'Instagram'],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
    [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X'],
    [/(^|\.)tiktok\.com$/, 'TikTok'],
    [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
    [/(^|\.)google\.[a-z.]+$/, 'Google'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
    [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
    [/(^|\.)snapchat\.com$/, 'Snapchat'],
    [/(^|\.)threads\.(net|com)$/, 'Threads'],
    [/(^|\.)bing\.com$/, 'Bing'],
    [/(^|\.)telegram\.(org|me)$|^t\.me$/, 'Telegram'],
    [/(^|\.)yveskwameh\.com$/, 'yveskwameh.com'],
  ];
  return known.find(([re]) => re.test(h))?.[1] ?? h;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const countryName = (code: string) => {
  if (!code) return 'Unknown';
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      return regionNames?.of(code) ?? code;
    } catch {
      return code;
    }
  }
  return code;
};
const DEVICE: Record<string, string> = { mobile: 'Phones', desktop: 'Computers', tablet: 'Tablets' };

function merge(rows: { name: string; visits: number }[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.name, (m.get(r.name) ?? 0) + r.visits);
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/* ---------- traffic for any window ---------- */

const WINDOWS = [
  { id: '1h', label: '1 hour', q: 'hours=1', span: 'hour' },
  { id: '5h', label: '5 hours', q: 'hours=5', span: '5 hours' },
  { id: '12h', label: '12 hours', q: 'hours=12', span: '12 hours' },
  { id: '24h', label: '24 hours', q: 'hours=24', span: '24 hours' },
  { id: '48h', label: '48 hours', q: 'hours=48', span: '48 hours' },
  { id: '72h', label: '3 days', q: 'hours=72', span: '3 days' },
  { id: '7d', label: '7 days', q: 'days=7', span: '7 days' },
  { id: '30d', label: '30 days', q: 'days=30', span: '30 days' },
] as const;
const LAGOS = 'Africa/Lagos';
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LAGOS });
const dayOf = (ms: number) => {
  const day = lagosDay(ms);
  const today = lagosDay();
  if (day === today) return 'Today';
  if (day === lagosDay(Date.now() - 86_400_000)) return 'Yesterday';
  return new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: LAGOS });
};
/** The same, inside a sentence: "today", "yesterday" or "Sat 17 Oct". */
const dayIn = (ms: number) => {
  const d = dayOf(ms);
  return d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : d;
};
const BUCKET_MS: Record<Bucket, number> = { quarter: 900_000, hour: 3_600_000, day: 86_400_000 };
/** "1 h 12 min", "45 min", "3 days". */
export function span(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  if (min < 72 * 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `${Math.round(min / 1440)} days`;
}
/** A Lagos time typed in a date and time box ("2026-10-19T20:30") as ms, or null. */
export function fromLagosInput(v: string) {
  const t = Date.parse(`${v}:00+01:00`);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && Number.isFinite(t) ? t : null;
}
const toLagosInput = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 16);

/** The window in the address: ?w=5h, or ?since=2026-10-19T20:30 (Lagos time). Without either, the last 24 hours. */
function readWindow() {
  const p = new URLSearchParams(location.search);
  const since = fromLagosInput(p.get('since') ?? '');
  if (since !== null) return { id: 'since' as const, q: `since=${since}`, since };
  const w = WINDOWS.find((x) => x.id === p.get('w')) ?? WINDOWS[3];
  return { id: w.id, q: w.q, since: null };
}

/** "Up 34% on the 5 hours before", in words and colour. */
function versus(now: number, before: number, label: string) {
  if (!before) return { text: now ? `None in ${label}` : `None in ${label} either`, cls: '' };
  const change = Math.round(((now - before) / before) * 100);
  if (!change) return { text: `Same as ${label}`, cls: '' };
  return { text: `${change > 0 ? 'Up' : 'Down'} ${fmt(Math.abs(change))}% on ${label}`, cls: change > 0 ? 'up' : 'down' };
}

function TrafficCard() {
  const { copy } = useApp();
  usePath();
  const win = readWindow();
  const t = useLoad(`${copy}:traffic:${win.q}`, () => api.traffic(copy, win.q));
  const { reload } = t;
  const rolling = win.id !== '7d' && win.id !== '30d';

  // The last hours and a shared link move fast: every minute while the dashboard is on screen.
  useEffect(() => {
    if (!rolling) return;
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), 60_000);
    return () => clearInterval(timer);
  }, [rolling, reload]);

  const choose = (id: string) => go(`/growth?w=${id}`, { replace: true });
  const since = (v: string) => {
    const ms = fromLagosInput(v);
    if (ms !== null) go(`/growth?since=${v}`, { replace: true });
  };
  const now = Date.now();

  return (
    <section className="card traffic" aria-labelledby="tr-title">
      <div className="section-top">
        <h2 id="tr-title" className="kicker">Traffic and new players</h2>
        <div className="traffic-tools">
          {t.at && <span className="fine">Updated {clock(t.at)}</span>}
          <button type="button" className="icon-btn sm" aria-label="Refresh" onClick={reload}>
            {t.loading && t.data ? <span className="spin" aria-hidden="true" /> : <Icon name="refresh" size={18} />}
          </button>
        </div>
      </div>

      <div className="tab-chips in-card" role="radiogroup" aria-label="How far back">
        {WINDOWS.map((w) => (
          <button key={w.id} type="button" role="radio" aria-checked={win.id === w.id} onClick={() => choose(w.id)}>{w.label}</button>
        ))}
        <button type="button" role="radio" aria-checked={win.id === 'since'} onClick={() => win.id !== 'since' && since(toLagosInput(now - 3_600_000))}>Since a time</button>
      </div>
      {win.since !== null && (
        <label className="field since-field" key={win.since}>
          <span className="field-label">Since (Lagos time)</span>
          <input
            className="input"
            type="datetime-local"
            min={toLagosInput(now - 30 * 86_400_000)}
            max={toLagosInput(now)}
            defaultValue={toLagosInput(win.since)}
            onChange={(e) => since(e.target.value)}
          />
          <span className="field-hint">Pick the time you shared a link to see the traffic since then. Up to 30 days back. Bookmark the page to come back to it.</span>
        </label>
      )}

      {t.error ? (
        <Problem text={t.error} onRetry={reload} />
      ) : !t.data ? (
        <Skeleton kind="block" rows={1} />
      ) : (
        <TrafficBody t={t.data} />
      )}
    </section>
  );
}

function TrafficBody({ t }: { t: Traffic }) {
  const w = t.window;
  const length = w.to - w.from;
  const fixed = WINDOWS.find((x) => x.id === w.key);
  const before = w.key === 'since' ? `the ${span(length)} before` : `the ${fixed?.span ?? span(length)} before`;
  const title =
    w.key === 'since'
      ? `Since ${dayIn(w.from)} at ${clock(w.from)}, ${span(length)} ago.`
      : w.bucket === 'day'
        ? `The last ${fixed?.span ?? span(length)}, ${shortDay(new Date(w.from).toISOString().slice(0, 10))} to today (UTC days).`
        : `The last ${fixed?.span ?? span(length)}, since ${dayIn(w.from)} at ${clock(w.from)}.`;
  const web = t.web;
  const hasWeb = web.visits !== undefined;
  const ms = BUCKET_MS[w.bucket];
  const key = (at: number) => String(at);
  const open = key(t.buckets[t.buckets.length - 1]?.at ?? 0);
  // Over more than a day, an hour's label needs its day too: "Sat 21:00".
  const weekday = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', timeZone: LAGOS });
  const axis = (k: string) =>
    w.bucket === 'day' ? shortDay(new Date(Number(k)).toISOString().slice(0, 10)).replace(/^\w+ /, '') : length > 26 * 3_600_000 ? `${weekday(Number(k))} ${clock(Number(k))}` : clock(Number(k));
  const tip = (k: string) => {
    const at = Number(k);
    if (w.bucket === 'day') return `${shortDay(new Date(at).toISOString().slice(0, 10))} (UTC day)`;
    return `${dayOf(at)}, ${clock(at)} to ${clock(at + ms)}`;
  };
  const openNote = w.bucket === 'day' ? "The outlined bar is today, which isn't over yet." : `The outlined bar is the current ${w.bucket === 'hour' ? 'hour' : 'quarter hour'}, which isn't over yet.`;
  const joined = versus(t.players.joined, t.players.before, before);
  const visits = hasWeb ? versus(web.visits!, web.before?.visits ?? 0, before) : null;
  const referers = merge((web.referers ?? []).map((r) => ({ name: sourceName(r.host), visits: r.visits })));

  return (
    <>
      <p className="traffic-when">{title}</p>
      <div className="kpis wide">
        <div>
          <b className="num">{hasWeb ? fmt(web.visits!) : 'none'}</b>
          <span className="num-label">Visits</span>
          {visits && <small className={`fine ${visits.cls}`}>{visits.text}</small>}
        </div>
        <div>
          <b className="num">{hasWeb ? fmt(web.views!) : 'none'}</b>
          <span className="num-label">Page views</span>
        </div>
        <div>
          <b className="num">{fmt(t.players.joined)}</b>
          <span className="num-label">New players</span>
          <small className={`fine ${joined.cls}`}>{joined.text}</small>
        </div>
        <div>
          <b className="num">{fmt(t.players.finished)}</b>
          <span className="num-label">Finished their first match</span>
          {t.players.joined > 0 && <small className="fine">{pct(t.players.finished / t.players.joined)} of new players</small>}
        </div>
        <div>
          <b className="num">{fmt(t.players.savedAny)}</b>
          <span className="num-label">Saved their progress</span>
          <small className="fine">New and old players</small>
        </div>
      </div>

      <div className="traffic-charts">
        {hasWeb && (
          <div className="stack">
            <h3 className="sub-title">Visits</h3>
            <Bars points={t.buckets.map((b) => ({ day: key(b.at), value: b.visits }))} today={open} unit="count" label="Visits" axis={axis} tip={tip} openNote={openNote} />
          </div>
        )}
        <div className="stack">
          <h3 className="sub-title">New players</h3>
          <Bars points={t.buckets.map((b) => ({ day: key(b.at), value: b.joined }))} today={open} unit="count" label="New players" axis={axis} tip={tip} openNote={openNote} />
        </div>
      </div>
      <p className="fine">{w.bucket === 'quarter' ? 'One bar every 15 minutes.' : w.bucket === 'hour' ? 'One bar an hour.' : 'One bar a day.'} Point at a bar, or tap it, to read it.</p>

      {!hasWeb ? (
        <p className="notice">{web.off ?? web.problem}</p>
      ) : (
        <div className="src-grid">
          <div className="stack">
            <h3 className="sub-title">Sites that sent them</h3>
            {referers.length ? <HBars rows={referers.slice(0, 8)} /> : <p className="fine">No visits yet.</p>}
            <p className="fine">No referrer means they typed the address, used a saved link, or came from an app that hides where it came from. WhatsApp often does.</p>
          </div>
          <div className="stack">
            <h3 className="sub-title">Countries</h3>
            {(web.countries ?? []).length ? <HBars rows={merge((web.countries ?? []).map((c) => ({ name: countryName(c.name), visits: c.visits }))).slice(0, 6)} /> : <p className="fine">No visits yet.</p>}
          </div>
          <div className="stack">
            <h3 className="sub-title">Devices</h3>
            {(web.devices ?? []).length ? <HBars rows={merge((web.devices ?? []).map((c) => ({ name: DEVICE[c.name.toLowerCase()] ?? c.name, visits: c.visits })))} /> : <p className="fine">No visits yet.</p>}
          </div>
        </div>
      )}
      <p className="fine">
        Times are Lagos time. Visits come from Cloudflare Web Analytics on the live game and show up a few minutes late; a visit is one arrival at the game, and page views count every screen opened. New players come from the game itself, so they're exact.
      </p>
    </>
  );
}

function FirstDaysCard() {
  const { copy } = useApp();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const fd = useLoad(`${copy}:first:${days}`, () => api.firstDays(copy, days));
  return (
    <section className="card" aria-labelledby="fd-title">
      <div className="section-top">
        <h2 id="fd-title" className="kicker">New players' first days</h2>
        <Seg value={days} options={[7, 30, 90]} onChange={(v) => setDays(v as 7 | 30 | 90)} label="Joined in the last" />
      </div>
      {fd.error ? <Problem text={fd.error} onRetry={fd.reload} /> : !fd.data ? <Skeleton kind="block" rows={1} /> : <Funnel f={fd.data} />}
    </section>
  );
}

function Funnel({ f }: { f: FirstDays }) {
  const steps = [
    { label: 'Joined', note: 'Tapped Play now', n: f.joined },
    { label: 'Finished their first match', n: f.finished },
    { label: 'Came back on another day', n: f.returned },
    { label: 'Played on 3 days or more', n: f.threeDays },
    { label: 'Saved their progress', n: f.saved },
  ];
  if (!f.joined) return <p className="fine">Nobody joined in these days.</p>;
  return (
    <>
      <p className="fine">Players who joined {shortDay(f.from)} to {shortDay(f.to)}.</p>
      <ol className="funnel">
        {steps.map((s, i) => (
          <li key={s.label}>
            <div className="hbar-top">
              <span>{s.label}</span>
              <b>{fmt(s.n)} <small>{pct(s.n / f.joined)}</small></b>
            </div>
            <div className="hbar-track"><i style={{ transform: `scaleX(${s.n ? Math.max(0.01, s.n / f.joined) : 0})` }} /></div>
            {i > 0 && i < 4 && steps[i - 1].n > 0 && <small className="fine">{pct(s.n / steps[i - 1].n)} of the step before</small>}
            {s.note && <small className="fine">{s.note}</small>}
          </li>
        ))}
      </ol>
      <p className="fine">{f.finished ? `${pct(f.won / f.finished)} of them won their first match. ` : ''}Players who joined in the last day or two haven't had the chance to come back yet.</p>
    </>
  );
}

function RetentionCard() {
  const { copy } = useApp();
  const r = useLoad(`${copy}:retention`, () => api.retention(copy, 8));
  return (
    <section className="card" aria-labelledby="ret-title">
      <h2 id="ret-title" className="kicker">Weekly retention</h2>
      {r.error ? <Problem text={r.error} onRetry={r.reload} /> : !r.data ? <Skeleton kind="block" rows={1} /> : <RetentionTable r={r.data} />}
    </section>
  );
}

function RetentionTable({ r }: { r: Retention }) {
  const cols = r.weeks.length;
  const rows = [...r.weeks].reverse();
  return (
    <>
      <div className="table-scroll">
        <table className="cohort">
          <thead>
            <tr>
              <th scope="col">Joined in the week of</th>
              <th scope="col">Players</th>
              {Array.from({ length: cols }, (_, k) => <th key={k} scope="col">{k === 0 ? 'Week 0' : `+${k}`}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.start}>
                <th scope="row">{shortDay(w.start).replace(/^\w+ /, '')}</th>
                <td>{fmt(w.joined)}</td>
                {Array.from({ length: cols }, (_, k) => {
                  if (k >= w.played.length) return <td key={k} className="none" aria-label="Not yet" />;
                  const share = w.joined ? w.played[k] / w.joined : 0;
                  return (
                    <td key={k} className={share >= 0.55 ? 'cell dark' : 'cell'} style={{ ['--a' as string]: String(Math.min(1, share)) }} title={`${fmt(w.played[k])} of ${fmt(w.joined)}`}>
                      {w.joined ? pct(share) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">Weeks run Monday to Sunday, Lagos time. Week 0 is the week they joined; +1 is the week after, and so on. Each cell is the share who finished a match that week, darker for more. This week isn't over yet.</p>
    </>
  );
}

function Seg({ value, options, onChange, label }: { value: number; options: number[]; onChange: (v: number) => void; label: string }) {
  return (
    <div className="seg sm" role="radiogroup" aria-label={label}>
      {options.map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)}>{n} days</button>
      ))}
    </div>
  );
}
