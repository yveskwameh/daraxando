// System health (docs/HEALTH.md): the live state of everything the game depends on, from the
// game's /api/admin/health (worker/health.ts). A short card on Today, the full list here at
// /health. It checks when you open it and every minute while it's on screen, never in the
// background, and the dashboard's Worker keeps each answer for 30 seconds.
import { useEffect } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import type { Health, HealthCheck, HealthState } from '../types.ts';
import type { Need } from '../needs.ts';
import { Icon, go, Skeleton, useLoad, type Loaded } from '../ui.tsx';

const LABEL: Record<HealthState, string> = { ok: 'Working', warn: 'Needs a look', down: 'Down', off: 'Not set up', unknown: 'Unknown' };
const ICON: Record<HealthState, string> = { ok: 'check', warn: 'alert', down: 'x', off: 'minus', unknown: 'help' };

/** Health for the copy you're on, checked again every minute while the page is on screen. */
export function useHealth(): Loaded<Health> {
  const { copy } = useApp();
  const h = useLoad(`${copy}:health`, () => api.health(copy));
  const { reload } = h;
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && reload(), 60_000);
    const back = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', back);
    };
  }, [reload]);
  return h;
}

/** The checks, with the game's own server in front: if the dashboard can't reach it, that's the problem. */
export function checksOf(h: Loaded<Health>): HealthCheck[] | null {
  if (h.error) return [{ id: 'server', label: 'Game server', state: 'down', detail: `The game didn't answer: ${h.error}` }];
  if (h.data) return [{ id: 'server', label: 'Game server', state: 'ok', detail: deployLine(h.data.deployedAt) }, ...h.data.checks];
  return null;
}

const deployLine = (at: number | null) =>
  at ? `Answering. This version went live ${new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}.` : 'Answering.';

/** Problems lead, then what's working, then what couldn't be checked, then what isn't set up here. */
const RANK: Record<HealthState, number> = { down: 0, warn: 1, ok: 2, unknown: 3, off: 4 };
const problems = (checks: HealthCheck[]) => checks.filter((c) => c.state === 'down' || c.state === 'warn').sort((a, b) => RANK[a.state] - RANK[b.state]);

function summary(checks: HealthCheck[]) {
  const bad = problems(checks);
  const unknown = checks.filter((c) => c.state === 'unknown').length;
  if (!bad.length) return { state: 'ok' as HealthState, title: unknown ? `Working, but ${unknown} couldn't be checked` : 'All systems working' };
  const down = bad.some((c) => c.state === 'down');
  const names = bad.map((c) => c.label);
  const list = names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(' and ');
  return { state: (down ? 'down' : 'warn') as HealthState, title: `${bad.length === 1 ? '1 problem' : `${bad.length} problems`}: ${list}` };
}

const checkedAt = (at: number | null) => (at ? `Checked ${new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '');

/** Down checks for Needs you on Today. */
export function healthNeeds(h: Loaded<Health>): Need[] {
  const checks = checksOf(h) ?? [];
  return checks.filter((c) => c.state === 'down').map((c) => ({
    id: `health:${c.id}`,
    level: 'alarm' as const,
    title: `${c.label} is down`,
    body: c.detail,
    go: 'health' as const,
    action: 'See health',
  }));
}

function StateBadge({ state }: { state: HealthState }) {
  return (
    <span className={`hstate ${state}`}>
      <Icon name={ICON[state]} size={16} />
      {LABEL[state]}
    </span>
  );
}

/** The card on Today: one line when all is well, the problems by name when not. */
export function HealthCard({ h }: { h: Loaded<Health> }) {
  const checks = checksOf(h);
  const s = checks ? summary(checks) : null;
  return (
    <section className={`card health-card ${s?.state ?? ''}`} aria-labelledby="health-title">
      <div className="section-top">
        <h2 id="health-title" className="kicker"><Icon name="pulse" size={16} />System health</h2>
        <button type="button" className="icon-btn sm" aria-label="Check again" onClick={h.reload}>
          {h.loading ? <span className="spin" aria-hidden="true" /> : <Icon name="refresh" size={18} />}
        </button>
      </div>
      {!checks || !s ? (
        <p className="fine">Checking</p>
      ) : (
        <>
          <div className="health-sum">
            <StateBadge state={s.state} />
            <b>{s.title}</b>
          </div>
          {s.state !== 'ok' && (
            <ul className="mini-rows">
              {problems(checks).slice(0, 3).map((c) => <li key={c.id}><span>{c.label}</span><b className={`hword ${c.state}`}>{LABEL[c.state]}</b></li>)}
            </ul>
          )}
          <div className="health-foot">
            <span className="fine">{checks.length} services. {checkedAt(h.at)}</span>
            <button type="button" className="mini-btn" onClick={() => go('/health')}>See all</button>
          </div>
        </>
      )}
    </section>
  );
}

/** The full list at /health. */
export function HealthPage() {
  const { copy } = useApp();
  const h = useHealth();
  const checks = checksOf(h);
  const s = checks ? summary(checks) : null;
  return (
    <div className="stack-group">
      <div className="titled">
        <h1>System health</h1>
        <p className="muted">Everything the {copy === 'live' ? 'live' : 'test'} game depends on, checked now and every minute while this page is open. Nothing about players is checked or kept.</p>
      </div>
      {!checks || !s ? (
        <Skeleton kind="rows" rows={8} label="Checking every service" />
      ) : (
        <>
          <section className={`card health-banner ${s.state}`} aria-live="polite">
            <StateBadge state={s.state} />
            <b>{s.title}</b>
            <span className="fine">{checkedAt(h.at)}</span>
            <button type="button" className="mini-btn" onClick={h.reload} disabled={h.loading}>{h.loading ? 'Checking' : 'Check again'}</button>
          </section>
          <ul className="list health-list">
            {[...checks].sort((a, b) => RANK[a.state] - RANK[b.state]).map((c) => (
              <li key={c.id} className="card health-row">
                <div className="health-row-top">
                  <b>{c.label}</b>
                  <StateBadge state={c.state} />
                </div>
                <p className="fine">{c.detail}</p>
                {c.link && (
                  <a className="fine health-link" href={c.link} target="_blank" rel="noopener">
                    <Icon name="open" size={14} />
                    {c.id === 'cloudflare' ? "Cloudflare's status page" : c.id === 'email' ? "Resend's status page" : c.id === 'google' ? "Google's status page" : 'Cloudflare dashboard'}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="fine center">
            This page only checks while it's open. To hear about problems at any hour, a free outside monitor can watch the game for you (docs/HEALTH.md, "Later, if you want alerts").
          </p>
        </>
      )}
    </div>
  );
}
