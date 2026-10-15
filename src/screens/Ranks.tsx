/**
 * Ranks. League is this week's league: up to 30 players at your level, the top move up a
 * league every Monday and the bottom move down, like a football table. The state and All
 * Nigeria tabs rank quick match ratings.
 */
import { Fragment, useEffect, useState } from 'react';
import { LEAGUES } from '../../shared/habits';
import { levelInfo, titleFor } from '../../shared/progression';
import { stateName } from '../../shared/places';
import type { LeaderRow, LeagueData, LeagueRow } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { Avatar, Icon } from '../components/art';
import { api } from '../lib/api';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';

type Tab = 'league' | 'state' | 'ng';
type Data = { top: LeaderRow[]; me: { rank: number } | null };

export function Ranks({ go }: { go: Go }) {
  const { token, profile } = usePlayer();
  const hasState = profile.state !== 'OUT' && profile.state !== 'NONE';
  const [tab, setTab] = useState<Tab>('league');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

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
            <ol className="list pinned" aria-label="Your rank">
              <Row
                r={{ rank: data.me?.rank ?? 0, id: profile.id, name: profile.name, avatar: profile.avatar, print: profile.print, state: profile.state, rating: profile.rating, level: levelInfo(profile.aura).level }}
                you
                note={data.me ? undefined : 'Not ranked yet'}
              />
            </ol>
          )}
        </>
      )}
    </main>
  );
}

function Row({ r, you, note }: { r: LeaderRow; you?: boolean; note?: string }) {
  return (
    <li className={`lrow${you ? ' you' : ''}`}>
      <span className="n">{r.rank ? fmt(r.rank) : '·'}</span>
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
  }, [token]);

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
          <span>Ends in {until(data.endsAt)} · {rule}</span>
        </div>
      </div>
      {last && <p className="fine">Last week you finished {ordinal(last.rank)} in {LEAGUES[last.tier]}.{moved}</p>}
      {!data.rows ? (
        <div className="empty">
          <Icon id="i-shield" className="big" />
          <h2>Join this week's league</h2>
          <p>Play any match this week to join {name}. Every bit of Aura you earn counts, and the league resets on Monday.</p>
          <button type="button" className="btn primary" onClick={() => go({ name: 'home' })}>Play a match</button>
        </div>
      ) : (
        <LeagueTable rows={data.rows} up={data.up} down={data.down} beatBaba={data.beatBaba} me={profile.id} />
      )}
    </>
  );
}

function LeagueTable({ rows, up, down, beatBaba, me }: { rows: LeagueRow[]; up: number; down: number; beatBaba: boolean; me: string }) {
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
  return (
    <ol className="list league" aria-label="This week's league">
      {marked.map(({ r, n, goingUp, goingDown }, i) => (
        <Fragment key={r.id}>
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
    </ol>
  );
}
