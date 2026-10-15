/**
 * Finding your match. The danfo drives left to right as the search widens every 4 seconds:
 * your state, your zone, all of Nigeria. The Baba Ayo card shows as soon as nobody else is
 * searching (or at 8 seconds), and a busier table is suggested when yours is empty. The
 * search keeps going the whole time, and Baba Ayo never starts on his own.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AVATARS } from '../../shared/collections';
import { MODES } from '../../shared/modes';
import { stateName, zoneName } from '../../shared/places';
import { BABA_OFFER_MS, EMPTY_OFFER_MS, searchStage, SEARCH_STEP_MS } from '../../shared/matching';
import { fmt, tableLock } from '../../shared/stakes';
import { Avatar, Cowries, Icon } from '../components/art';
import { buzz } from '../lib/haptics';
import { prefs, usePrefs } from '../lib/prefs';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { sfx } from '../lib/sound';
import { useLobby } from '../lib/useLobby';
import { BabaSheet } from '../sheets/BabaSheet';

export function Search({ go }: { go: Go }) {
  const { token, profile } = usePlayer();
  const { mode, stake } = usePrefs();
  const [since] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [baba, setBaba] = useState(false);
  // Joined a busier table: match with whoever is there, however far.
  const [wide, setWide] = useState(false);

  const onMatched = useCallback((id: string) => {
    sfx.found();
    go({ name: 'play', id }, { replace: true });
  }, [go]);
  const queue = useMemo(() => ({ mode, stake, wide }), [mode, stake, wide]);
  // The search keeps going while the Baba Ayo sheet is open. Picking a level ends it.
  const { near, online, error } = useLobby(token, queue, onMatched);

  // Half a second keeps the danfo on time with the 4-second steps.
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - since), 500);
    return () => clearInterval(t);
  }, [since]);

  const stage = searchStage(elapsed);
  const empty = !!near && near.all === 0;
  const showBaba = elapsed >= BABA_OFFER_MS || (empty && elapsed >= EMPTY_OFFER_MS);
  // A busier table you can sit at, offered when yours is empty.
  const busier = empty && near?.elsewhere && !tableLock(near.elsewhere.stake, profile, Date.now()) ? near.elsewhere : null;
  const sn = stateName(profile.state);
  const zn = zoneName(profile.state);
  const places = [sn, zn ? `the ${zn}` : 'your zone', 'Nigeria', 'Nigeria'];
  const counts = near ? [near.state, near.zone, near.all, near.all] : null;
  const count = counts?.[stage] ?? 0;
  const nearText = !online
    ? 'Connecting'
    : empty
      ? 'Nobody else at this table right now'
      : stage === 3
        ? 'Still looking for a player'
        : count === 0
          ? `Nobody else searching in ${places[stage]} yet`
          : `${count} ${count === 1 ? 'player' : 'players'} searching in ${places[stage]}`;
  const look = ['Looking nearby', `Looking in ${zn ?? 'your zone'}`, 'Looking across Nigeria', 'Still looking'][stage];

  // A shuffled strip of animals spins in the empty slot.
  const strip = useMemo(() => {
    const ids = AVATARS.map((a) => a.id).sort(() => Math.random() - 0.5).slice(0, 8);
    return [...ids, ids[0]];
  }, []);

  const m = MODES[mode];

  if (error) {
    return (
      <main className="screen center">
        <div className="empty">
          <Icon id="i-seed" className="big" />
          <h2>Can't start this search</h2>
          <p>{error}</p>
          <button type="button" className="btn cream" onClick={() => go({ name: 'home' }, { replace: true })}>Back to home</button>
        </div>
      </main>
    );
  }

  return (
    <main className={`screen${busier ? ' has-switch' : ''}`} aria-label="Finding a match">
      <div className="page-head">
        <button type="button" className="icon-btn" aria-label="Stop searching" onClick={() => go({ name: 'home' }, { replace: true })}>
          <Icon id="i-close" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span className="pill">{m.name} · {stake ? <>Stake <Cowries n={stake} /></> : 'Free'}</span>
        </div>
        <span />
      </div>

      <div className="search-head">
        <h1>Finding your match</h1>
        <p className="muted search-sub">Nearest players first. The search widens every {SEARCH_STEP_MS / 1000} seconds.</p>
      </div>

      <div className="faceoff">
        <div className="fo">
          <Avatar avatar={profile.avatar} print={profile.print} size={88} />
          <b>{profile.name}</b>
          <span>{sn}</span>
        </div>
        <span className="vs-mini">VS</span>
        <div className="fo">
          <span className="slot" aria-hidden="true">
            <i>
              <span className="strip">
                {strip.map((id, i) => (
                  <svg key={i} aria-hidden="true"><use href={`#av-${id}`} /></svg>
                ))}
              </span>
            </i>
          </span>
          <b>Who's next?</b>
          <span>{look}</span>
        </div>
      </div>

      <div className="hroute" aria-hidden="true">
        <div className="hline" />
        <ol className="hstops">
          {[sn, zn ?? 'Your zone', 'All Nigeria', 'Baba Ayo'].map((name, i) => (
            <li key={i} className={`hstop${i < stage ? ' done' : ''}${i === stage ? ' now' : ''}`}>
              <b>{name}</b>
              <span className="t">{i < 3 ? `${(i * SEARCH_STEP_MS) / 1000} to ${((i + 1) * SEARCH_STEP_MS) / 1000} s` : 'Your choice'}</span>
            </li>
          ))}
        </ol>
        <div className="hbus-track" style={{ transform: `translateX(${stage * 25}%)` }}>
          <div className="hbus idle"><svg><use href="#pc-danfo" /></svg></div>
        </div>
      </div>

      <div className="search-foot">
        <p className="near" role="status"><i />{nearText}</p>
        {busier && (
          <div className="row-card switch-card">
            <div>
              <b>{busier.n} {busier.n === 1 ? 'player is' : 'players are'} searching {MODES[busier.mode].name}</b>
              <span>{busier.stake ? `Stake ${fmt(busier.stake)}` : 'Free, no stake'}</span>
            </div>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                buzz('tap');
                setWide(true);
                prefs.set({ mode: busier.mode, stake: busier.stake });
              }}
            >
              Join them
            </button>
          </div>
        )}
        {showBaba && (
          <div className="wait-card">
            <Avatar avatar="baba" size={48} />
            <p><b>{empty ? 'Nobody to play right now' : 'Nobody close yet'}</b>The search keeps going. Or play Baba Ayo now.</p>
            <button type="button" className="btn baba block" onClick={() => setBaba(true)}>Play Baba Ayo</button>
          </div>
        )}
        <button type="button" className="btn ghost block" onClick={() => go({ name: 'home' }, { replace: true })}>Stop searching</button>
        {stake > 0 && <p className="fine search-sub" style={{ textAlign: 'center' }}>Your {fmt(stake)} stake is only taken when a match starts.</p>}
      </div>

      <BabaSheet open={baba} onClose={() => setBaba(false)} mode={mode} go={go} />
    </main>
  );
}
