/**
 * Ranks. League is this week's league: up to 30 players at your level, the top move up a
 * league every Monday and the bottom move down, like a football table. The state and All
 * Nigeria tabs rank quick match ratings.
 *
 * A banned player watches from outside (Yves, 16 October 2026): they see the same tables,
 * with a dashed row for where they'd be, but they aren't in them and can't climb them.
 */
import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import { LEAGUES } from '../../shared/habits';
import { levelInfo, titleFor } from '../../shared/progression';
import { stateName } from '../../shared/places';
import type { LeaderRow, LeagueData, LeagueRow } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { Avatar, Icon } from '../components/art';
import { api } from '../lib/api';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';

// Only banned players ever load this one.
const BanSheet = lazy(() => import('../sheets/BanSheet'));

type Tab = 'league' | 'state' | 'ng';
type Data = { top: LeaderRow[]; me: { rank: number; outside?: true } | null };

export function Ranks({ go }: { go: Go }) {
  const { token, profile } = usePlayer();
  const hasState = profile.state !== 'OUT' && profile.state !== 'NONE';
  const [tab, setTab] = useState<Tab>('league');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    if (tab === 'league') return;
    api.leaderboard(token, tab === 'state' ? profile.state : null).then(
      (d) => live && setData(d),
      (err: Error) => live && setError(err.message),
    );
    return () => { live = false; };
  }, [token, tab, profile.state]);

  const top = data?.top ?? [];
  const inList = top.some((r) => r.id === profile.id);
  const place = tab === 'state' ? stateName(profile.state) : 'Nigeria';

  return (
    <main className="screen" aria-label="Ranks">
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => go({ name: 'home' })}><Icon id="i-back" /></button>
        <h1>Ranks</h1>
        <span />
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'league'} onClick={() => setTab('league')}>League</button>
        {hasState && <button type="button" role="tab" aria-selected={tab === 'state'} onClick={() => setTab('state')}>{stateName(profile.state)}</button>}
        <button type="button" role="tab" aria-selected={tab === 'ng'} onClick={() => setTab('ng')}>All Nigeria</button>
      </div>

      {profile.ban && (
        <button type="button" className="window-note" onClick={() => setReview(true)}>
          <Icon id="i-lock" className="" />
          <span>
            <b>Watching from outside</b>
            <span>The dashed row is where you'd be. Tap to see why, or to ask for a review.</span>
          </span>
        </button>
      )}

      {tab === 'league' ? (
        <League go={go} />
      ) : error ? (
        <div className="empty">
          <Icon id="i-wifi-off" className="big" />
          <h2>Can't load Ranks</h2>
          <p>{error}</p>
        </div>
      ) : !data ? (
        <div className="stack" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}
        </div>
      ) : top.length === 0 ? (
        <div className="empty">
          <Icon id="i-ranks" className="big" />
          <h2>Nobody ranked in {place} yet</h2>
          <p>Win a quick match to put {place} on the board.</p>
          <button type="button" className="btn primary" onClick={() => go({ name: 'home' })}>Play a quick match</button>
        </div>
      ) : (
        <>
          <div className="podium">
            {[top[1], top[0], top[2]].map((r, i) => {
              const place = [2, 1, 3][i];
              if (!r) return <div key={place} className={`pod p${place} empty`} aria-hidden="true"><span className="rk">{place}</span></div>;
              return (
                <div key={r.id} className={`pod p${place}`}>
                  <span className="rk">{r.rank}</span>
                  <Avatar avatar={r.avatar} print={r.print} size={place === 1 ? 52 : 44} />
                  <b>{r.name}</b>
                  <span>{r.rating}</span>
                </div>
              );
            })}
          </div>
          <ol className="list" aria-label={`Ranks in ${place}`}>
            {top.slice(3).map((r) => <Row key={r.id} r={r} you={r.id === profile.id} />)}
          </ol>
          {!inList && (
            <ol className="list pinned" aria-label={profile.ban ? "Where you'd be" : 'Your rank'}>
              <Row
                r={{ rank: data.me?.rank ?? 0, id: profile.id, name: profile.name, avatar: profile.avatar, print: profile.print, state: profile.state, rating: profile.rating, level: levelInfo(profile.aura).level }}
                you={!profile.ban}
                ghost={!!profile.ban}
                note={profile.ban ? (data.me ? `You'd be ${ordinal(data.me.rank)}` : 'Not ranked yet') : data.me ? undefined : 'Not ranked yet'}
              />
            </ol>
          )}
        </>
      )}
      {profile.ban && (
        <Suspense fallback={null}>
          <BanSheet open={review} ban={profile.ban} onClose={() => setReview(false)} onBaba={() => go({ name: 'home' })} />
        </Suspense>
      )}
    </main>
  );
}

function Row({ r, you, ghost, note }: { r: LeaderRow; you?: boolean; ghost?: boolean; note?: string }) {
  return (
    <li className={`lrow${you ? ' you' : ''}${ghost ? ' ghost' : ''}`}>
      <span className="n">{ghost ? <Icon id="i-lock" className="" /> : r.rank ? fmt(r.rank) : '·'}</span>
      <Avatar avatar={r.avatar} print={r.print} size={36} ring="var(--line)" />
      <span style={{ minWidth: 0 }}>
        <b>{r.name}</b>
        <small>{note ?? (you ? `You · ${stateName(r.state)}` : `${titleFor(r.level)} · ${stateName(r.state)}`)}</small>
      </span>
      <span className="r">{r.rating}</span>
    </li>
  );
}

const until = (ms: number) => {
  const h = Math.max(0, Math.round((ms - Date.now()) / 3_600_000));
  if (h >= 48) return `${Math.round(h / 24)} days`;
  if (h >= 1) return `${h} hour${h === 1 ? '' : 's'}`;
  return 'less than an hour';
};

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** This week's league: a table with a promotion zone at the top and a demotion zone at the bottom. */
function League({ go }: { go: Go }) {
  const { token, profile } = usePlayer();
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.league(token).then(setData, (err: Error) => setError(err.message));
  }, [token, profile.ban]);

  if (error) {
    return (
      <div className="empty">
        <Icon id="i-wifi-off" className="big" />
        <h2>Can't load your league</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (!data) return <div className="stack" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}</div>;

  const name = LEAGUES[data.tier];
  const above = LEAGUES[data.tier + 1];
  const below = LEAGUES[data.tier - 1];
  const last = data.last && data.last.week !== data.week ? data.last : null;
  const moved = last
    ? last.moved === 'up' ? ` You moved up to ${LEAGUES[Math.min(LEAGUES.length - 1, last.tier + 1)]}.` : last.moved === 'down' ? ` You moved down to ${LEAGUES[Math.max(0, last.tier - 1)]}.` : ` You stayed in ${LEAGUES[last.tier]}.`
    : '';

  let rule = `Top ${data.up} move up to ${above}.`;
  if (!above) rule = 'This is the top league. Stay in it.';
  else if (data.beatBaba) rule = `Finish first, above Baba Ayo, to move up to ${above}.`;
  if (data.down && below) rule += ` Bottom ${data.down} move down to ${below}.`;

  return (
    <>
      <div className="league-head">
        <Icon id="i-shield" className="lg-ic" />
        <div>
          <b>{name} League</b>
          {/* The landmark names stay, with the tier in plain words (Yves, 17 October 2026). */}
          <small className="tier">League {data.tier + 1} of {LEAGUES.length}</small>
          <span>Ends in {until(data.endsAt)} · {rule}</span>
        </div>
      </div>
      {last && !data.outside && <p className="fine">Last week you finished {ordinal(last.rank)} in {LEAGUES[last.tier]}.{moved}</p>}
      {!data.rows ? (
        <div className="empty">
          <Icon id="i-shield" className="big" />
          <h2>Join this week's league</h2>
          <p>Play any match this week to join {name}. Every bit of Aura you earn counts, and the league resets on Monday.</p>
          <button type="button" className="btn primary" onClick={() => go({ name: 'home' })}>Play a match</button>
        </div>
      ) : (
        <LeagueTable
          rows={data.rows}
          up={data.up}
          down={data.down}
          beatBaba={data.beatBaba}
          me={profile.id}
          ghost={data.outside ? { id: profile.id, name: profile.name, avatar: profile.avatar, print: profile.print, state: profile.state, aura: data.outside.aura } : undefined}
        />
      )}
    </>
  );
}

function LeagueTable({ rows, up, down, beatBaba, me, ghost }: {
  rows: LeagueRow[];
  up: number;
  down: number;
  beatBaba: boolean;
  me: string;
  /** A banned player: where they'd be, shown as a dashed row that isn't part of the table. */
  ghost?: LeagueRow;
}) {
  const players = rows.filter((r) => !r.bot && r.aura > 0).length;
  const baba = rows.find((r) => r.bot)?.aura ?? 0;
  let pos = 0;
  const marked = rows.map((r) => {
    const counted = !r.bot && r.aura > 0;
    if (counted) pos++;
    const n = pos;
    return {
      r,
      n: counted ? n : null,
      goingUp: counted && n <= up && (!beatBaba || r.aura > baba),
      goingDown: counted && down > 0 && n > players - down,
    };
  });
  // Like a league table on TV: a labelled line under the promotion places and above the
  // demotion places.
  const lastUp = marked.reduce((at, m, i) => (m.goingUp ? i : at), -1);
  const firstDown = marked.findIndex((m) => m.goingDown);
  // Where a banned player would sit: above everyone with less Aura. With none this week, at the bottom.
  const found = ghost && ghost.aura > 0 ? rows.findIndex((r) => r.aura < ghost.aura) : -1;
  const ghostAt = !ghost ? -1 : found === -1 ? rows.length : found;
  const ghostN = ghost && ghost.aura > 0 ? marked.slice(0, ghostAt).filter((m) => m.n !== null).length + 1 : null;
  const ghostRow = ghost && (
    <li className="lrow ghost">
      <span className="n"><Icon id="i-lock" className="" /></span>
      <Avatar avatar={ghost.avatar} print={ghost.print} size={36} ring="var(--line)" />
      <span style={{ minWidth: 0 }}>
        <b>{ghost.name}</b>
        <small>{ghostN ? `You'd be ${ordinal(ghostN)}` : "You'd start here"}</small>
      </span>
      <span className="r">{fmt(ghost.aura)}<small> Aura</small></span>
    </li>
  );
  return (
    <ol className="list league" aria-label="This week's league">
      {marked.map(({ r, n, goingUp, goingDown }, i) => (
        <Fragment key={r.id}>
          {i === ghostAt && ghostRow}
          {i === firstDown && (
            <li className="zone down" aria-hidden="true"><Icon id="i-down" className="" />Demotion zone</li>
          )}
          <li className={`lrow${r.id === me ? ' you' : ''}${goingUp ? ' up' : ''}${goingDown ? ' down' : ''}`}>
            <span className="n">{n ?? '·'}</span>
            <Avatar avatar={r.avatar} print={r.print} size={36} ring="var(--line)" />
            <span style={{ minWidth: 0 }}>
              <b>{r.name}</b>
              <small>{r.bot ? "Sets the pace. He doesn't move." : r.id === me ? `You · ${stateName(r.state)}` : stateName(r.state)}</small>
            </span>
            <span className="r">{fmt(r.aura)}<small> Aura</small></span>
          </li>
          {i === lastUp && (
            <li className="zone up" aria-hidden="true"><Icon id="i-up" className="" />Promotion zone</li>
          )}
        </Fragment>
      ))}
      {ghostAt === rows.length && ghostRow}
    </ol>
  );
}
