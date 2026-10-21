// Log: every change made through the admin API, newest first, from the dashboard or a terminal.
// Also how the 7 pm streak reminders went, and signing out.
import { useState } from 'react';
import { useApp } from '../App.tsx';
import { api } from '../api.ts';
import { fmt, shortDay, when } from '../format.ts';
import type { AdminAction } from '../types.ts';
import { Button, Empty, go, Problem, Skeleton, useLoad, useMedia } from '../ui.tsx';

/** How a logged change reads: a title and a line of detail. */
export function actionText(action: string, d: Record<string, unknown> | null): { title: string; detail: string } {
  const s = (k: string) => (d && typeof d[k] === 'string' ? (d[k] as string) : '');
  const n = (k: string) => (d && typeof d[k] === 'number' ? (d[k] as number) : 0);
  switch (action) {
    case 'rename':
      return { title: 'Renamed', detail: `${s('from')} to ${s('to')}` };
    case 'ban': {
      const until = n('until');
      return { title: until ? `Banned until ${new Date(until).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Banned', detail: s('reason') };
    }
    case 'ban-ended':
      return { title: 'A timed ban ended by itself', detail: s('reason') };
    case 'unban': {
      const was = d && typeof d.was === 'object' && d.was ? (d.was as { reason?: unknown }).reason : null;
      return { title: 'Lifted a ban', detail: typeof was === 'string' && was ? `The ban was for: ${was}` : '' };
    }
    case 'seeds': {
      const a = n('amount');
      const reason = s('reason').replace(/[.!?]+$/, '');
      const had = d && 'before' in d ? `They had ${fmt(n('before'))}.` : '';
      return { title: a > 0 ? `Added ${fmt(a)} seeds` : `Took ${fmt(-a)} seeds`, detail: [reason ? `${reason}.` : '', had].filter(Boolean).join(' ') };
    }
    case 'appeal-lift':
      return { title: 'Lifted a ban after a review', detail: s('note') };
    case 'appeal-keep':
      return { title: 'Kept a ban after a review', detail: s('note') };
    case 'recovery-give':
      return { title: 'Gave a player back after a lost code', detail: s('note') || 'They move to the asking phone after 24 hours, unless they tap Stop.' };
    case 'recovery-refuse':
      return { title: 'Refused a lost-code request', detail: s('note') };
    case 'recovery-stopped':
      return { title: 'The player stopped a lost-code request', detail: 'They tapped Stop on their phone, so they stay where they are.' };
    default:
      return { title: action, detail: d ? JSON.stringify(d) : '' };
  }
}

export function Log() {
  const { copy, signOut } = useApp();
  const [pages, setPages] = useState<AdminAction[][]>([]);
  const [more, setMore] = useState<{ busy: boolean; done: boolean; error: string | null }>({ busy: false, done: false, error: null });
  const first = useLoad(`${copy}:actions`, () => api.actions(copy));
  const streak = useLoad(`${copy}:streak`, () => api.streak(copy));
  const all = [...(first.data?.actions ?? []), ...pages.flat()];
  const table = useMedia('(min-width: 760px)');

  const loadMore = async () => {
    const last = all[all.length - 1];
    if (!last) return;
    setMore({ busy: true, done: false, error: null });
    try {
      const r = await api.actions(copy, last.id);
      setPages((p) => [...p, r.actions]);
      setMore({ busy: false, done: r.actions.length < 50, error: null });
    } catch (e) {
      setMore({ busy: false, done: false, error: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  return (
    <div className="stack-group">
      <div className="titled">
        <h1>Log</h1>
        <p className="muted">Every change made through the admin API, newest first.</p>
      </div>

      <div className="log-grid">
        <div className="log-main">
          {first.error ? (
            <Problem text={first.error} onRetry={first.reload} />
          ) : !first.data ? (
            <Skeleton kind={table ? 'table' : 'rows'} rows={6} />
          ) : all.length === 0 ? (
            <Empty title="No changes yet." text="Renames, bans, seeds and ban reviews show here." />
          ) : (
            <>
              {table ? (
                <div className="table-card">
                  <table className="ptable log-table">
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Change</th>
                        <th scope="col">Player</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all.map((a) => {
                        const t = actionText(a.action, a.detail);
                        return (
                          <tr key={a.id}>
                            <td className="muted nowrap">{when(a.at)}</td>
                            <td>
                              <span className="cell-title">{t.title}</span>
                              {t.detail && <small className="fine cell-sub">{t.detail}</small>}
                            </td>
                            <td>
                              {a.playerId ? (
                                <a className="link-in" href={`/players/${a.playerId}`} onClick={(e) => { e.preventDefault(); go(`/players/${a.playerId}`); }}>Open the player</a>
                              ) : <span className="muted">None</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <section className="card">
                  <ul className="rows">
                    {all.map((a) => {
                      const t = actionText(a.action, a.detail);
                      return (
                        <li key={a.id}>
                          <div>
                            <span>{t.title}</span>
                            {t.detail && <small className="fine">{t.detail}</small>}
                            {a.playerId && (
                              <button type="button" className="link-in" onClick={() => go(`/players/${a.playerId}`)}>Open the player</button>
                            )}
                          </div>
                          <small className="fine">{when(a.at)}</small>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {more.error && <p className="field-error" role="alert">{more.error}</p>}
              {!more.done && (first.data.actions.length >= 50 || pages.length > 0) && (
                <Button kind="ghost" size="sm" busy={more.busy} onClick={loadMore}>Show older changes</Button>
              )}
            </>
          )}
        </div>

        <div className="log-side">
          <section className="card" aria-labelledby="streak-title">
            <h2 id="streak-title" className="kicker">7 pm streak reminders</h2>
            {streak.error ? (
              <p className="fine">{streak.error}</p>
            ) : !streak.data ? (
              <p className="fine">Loading</p>
            ) : streak.data.day ? (
              <p>Last run {shortDay(streak.data.day)}: {fmt(streak.data.sent ?? 0)} sent.</p>
            ) : (
              <p className="fine">No run yet on this copy.</p>
            )}
          </section>

          <section className="card" aria-labelledby="you-title">
            <h2 id="you-title" className="kicker">This device</h2>
            <p className="fine">You stay signed in here for 14 days. Changing the live admin key in Cloudflare signs out every device.</p>
            <Button kind="ghost" size="sm" onClick={signOut}>Sign out</Button>
          </section>
        </div>
      </div>
    </div>
  );
}
