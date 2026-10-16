/**
 * Your streak, the way Duolingo taught everyone to read one: the flame and the count, this
 * week's days, and what you can do about it. A Streak Freeze covers a missed day, an ended
 * streak can be restored for a few days, and a streak stake pays double if you keep it for
 * a week. The Friends tab holds friend streaks: up to 5 friends, kept alive by both of you
 * playing a match each day.
 *
 * Prices are in Dara Seeds, which can never be bought, so nothing here costs money.
 */
import { useEffect, useState } from 'react';
import {
  BET_DAYS, BET_STAKE, BET_WIN, FREEZE_MAX, FREEZE_PRICE, REPAIR_PRICE, betNow, nextMilestone, showBet, streakNow,
} from '../../shared/habits';
import { dayKey } from '../../shared/progression';
import type { FriendsData, FriendView } from '../../shared/protocol';
import { stateName } from '../../shared/places';
import { fmt } from '../../shared/stakes';
import { Avatar, Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { WeekStrip } from '../components/WeekStrip';
import { api } from '../lib/api';
import { buzz } from '../lib/haptics';
import { babaLine } from '../lib/babaNudge';
import { usePrefs } from '../lib/prefs';
import { usePlayer } from '../lib/session';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';

type Tab = 'mine' | 'friends';

const dayName = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

export default function StreakSheet({ open, onClose, tab: start = 'mine' }: { open: boolean; onClose: () => void; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(start);
  useEffect(() => { if (open) setTab(start); }, [open, start]);
  return (
    <Sheet open={open} onClose={onClose} label="Your streak" closeButton={false}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>Your streak</button>
        <button type="button" role="tab" aria-selected={tab === 'friends'} onClick={() => setTab('friends')}>Friend streaks</button>
      </div>
      {tab === 'mine' ? <Mine /> : <Friends />}
    </Sheet>
  );
}

function Mine() {
  const { token, profile, setProfile } = usePlayer();
  const [busy, setBusy] = useState<string | null>(null);
  const today = dayKey(Date.now());
  const h = profile.habits;
  const now = streakNow(h, profile.dayStreak, today);
  const bet = betNow(h, profile.dayStreak, today);
  const next = nextMilestone(now.streak);
  const { nudges } = usePrefs();
  // Baba Ayo has something to say when the streak is at risk or has just ended.
  const [baba] = useState(() =>
    now.streak === 0 && now.restorable ? babaLine('ended', { n: now.restorable.n }) : now.streak > 0 && !now.playedToday ? babaLine('risk', { n: now.streak }) : null,
  );
  const prev = Math.max(0, ...[0, 3, 7, 14, 30, 50, 100].filter((d) => d < next.days));

  const buy = async (action: 'freeze' | 'restore' | 'bet', price: number, done: string) => {
    if (profile.cowries < price) {
      buzz('invalid');
      toast.error(`You need ${fmt(price)} Dara Seeds for that.`);
      return;
    }
    setBusy(action);
    try {
      const r = await api.streak(token, action);
      setProfile(r.profile);
      buzz('win');
      sfx.found();
      toast.ok(done);
    } catch (err) {
      buzz('invalid');
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  let status: string;
  if (now.streak === 0 && now.restorable) status = `Your ${now.restorable.n}-day streak ended. You can still restore it.`;
  else if (now.streak === 0) status = 'Play a match today to start a streak.';
  else if (now.playedToday) status = `Done for today. Play tomorrow to make it ${now.streak + 1}.`;
  else if (now.freezing) status = `A Streak Freeze covered the day you missed. Play today to make it ${now.streak + 1}.`;
  else status = `Play a match today to make it ${now.streak + 1}.`;

  return (
    <div className="scroll streak-body">
      <div className={`streak-hero${now.playedToday ? ' lit' : ''}`}>
        <Icon id={now.playedToday ? 'i-flame' : 'i-flame-off'} className="fl" />
        <div>
          <b>{now.streak}</b>
          <span>day streak</span>
        </div>
      </div>
      <p className="muted streak-status" role="status">{status}</p>
      {nudges && baba && (
        <div className="baba-say">
          <span className="baba-face"><Avatar avatar="baba" size={40} /></span>
          <p>{baba}</p>
        </div>
      )}
      <WeekStrip habits={h} streak={profile.dayStreak} today={today} />

      {now.restorable && (
        <div className="hcard restore">
          <Icon id="i-flame" className="hi" />
          <div>
            <b>Restore your {now.restorable.n}-day streak</b>
            <span>Available until the end of {now.restorable.until === today ? 'today' : dayName(now.restorable.until)}. The days you missed count as covered.</span>
          </div>
          <button type="button" className="mini-btn buy" disabled={busy !== null} onClick={() => void buy('restore', REPAIR_PRICE, 'Streak restored. Keep it going.')}>
            <Icon id="i-seed" className="" />{fmt(REPAIR_PRICE)}
          </button>
        </div>
      )}

      <div className="hcard">
        <Icon id="i-freeze" className="hi ice" />
        <div>
          <b>Streak Freeze <small>{now.freezes} of {FREEZE_MAX}</small></b>
          <span>Covers one day you miss, so your streak stays. It's used for you automatically.</span>
        </div>
        <button
          type="button"
          className="mini-btn buy"
          disabled={busy !== null || now.freezes >= FREEZE_MAX}
          aria-label={now.freezes >= FREEZE_MAX ? `You have ${FREEZE_MAX} Streak Freezes, the most you can hold` : `Get a Streak Freeze for ${FREEZE_PRICE} Dara Seeds`}
          onClick={() => void buy('freeze', FREEZE_PRICE, 'Streak Freeze ready. It covers the next day you miss.')}
        >
          {now.freezes >= FREEZE_MAX ? 'Full' : <><Icon id="i-seed" className="" />{fmt(FREEZE_PRICE)}</>}
        </button>
      </div>

      <div className="hcard">
        <Icon id="i-seed" className="hi" />
        {bet && showBet(bet, today) && bet.status !== 'won' && bet.status !== 'lost' ? (
          <div className="grow">
            <b>Streak stake <small>Day {bet.days} of {BET_DAYS}</small></b>
            <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={BET_DAYS} aria-valuenow={bet.days} aria-label="Streak stake progress">
              <i style={{ width: `${(bet.days / BET_DAYS) * 100}%` }} />
            </span>
            <span>Keep your streak to day {BET_DAYS} and get {fmt(BET_WIN)} back. If it ends, you lose the {fmt(bet.stake)}.</span>
          </div>
        ) : bet?.status === 'won' && showBet(bet, today) ? (
          <div className="grow">
            <b>Streak stake won</b>
            <span>{fmt(BET_WIN)} Dara Seeds are in your wallet. You can stake again any time.</span>
          </div>
        ) : (
          <div className="grow">
            <b>Streak stake</b>
            <span>
              {bet?.status === 'lost' && showBet(bet, today) ? 'Your last streak stake was lost when the streak ended. ' : ''}
              Stake {fmt(BET_STAKE)} Dara Seeds that you'll keep your streak for {BET_DAYS} days. Keep it and get {fmt(BET_WIN)} back.
            </span>
          </div>
        )}
        {(!bet || bet.status !== 'on' || !showBet(bet, today)) && (
          <button
            type="button"
            className="mini-btn buy"
            disabled={busy !== null}
            aria-label={`Stake ${BET_STAKE} Dara Seeds on your streak`}
            onClick={() => {
              if (now.streak < 1) {
                buzz('invalid');
                toast.error('Play a match first to start a streak.');
                return;
              }
              void buy('bet', BET_STAKE, `Stake placed. Keep your streak for ${BET_DAYS} days to get ${fmt(BET_WIN)}.`);
            }}
          >
            <Icon id="i-seed" className="" />Stake {fmt(BET_STAKE)}
          </button>
        )}
      </div>

      <div className="hcard">
        <Icon id="i-aura" className="hi" />
        <div className="grow">
          <b>Next: {next.days}-day streak</b>
          <span className="bar" role="progressbar" aria-valuemin={prev} aria-valuemax={next.days} aria-valuenow={now.streak} aria-label="Progress to the next streak milestone">
            <i style={{ width: `${Math.max(4, ((now.streak - prev) / (next.days - prev)) * 100)}%` }} />
          </span>
          <span>+{next.aura} Aura{next.freeze ? ' and a free Streak Freeze' : ''}. Your best: {h.best} {h.best === 1 ? 'day' : 'days'}.</span>
        </div>
      </div>
      <p className="fine">You have {fmt(profile.cowries)} Dara Seeds. They're for fun: you can't buy, sell, send or cash them out.</p>
    </div>
  );
}

function Friends() {
  const { token } = usePlayer();
  const [data, setData] = useState<FriendsData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.friends(token).then(setData, (err: Error) => setError(err.message));
  }, [token]);

  const act = async (id: string, fn: 'addFriend' | 'dropFriend', done?: string) => {
    setBusy(id);
    try {
      setData(await api[fn](token, id));
      buzz('tap');
      if (done) toast.ok(done);
    } catch (err) {
      buzz('invalid');
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!data) return <div className="stack" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>;

  const incoming = data.friends.filter((f) => f.status === 'incoming');
  const active = data.friends.filter((f) => f.status === 'active');
  const outgoing = data.friends.filter((f) => f.status === 'outgoing');
  const full = active.length + outgoing.length >= 5;

  return (
    <div className="scroll streak-body">
      <p className="muted">Keep a streak going with up to 5 friends. It grows each day you both play a match.</p>

      {incoming.map((f) => (
        <div key={f.id} className="frow ask">
          <Avatar avatar={f.avatar} print={f.print} size={40} />
          <div><b>{f.name}</b><span>Wants to start a friend streak</span></div>
          <button type="button" className="mini-btn" disabled={busy === f.id} onClick={() => void act(f.id, 'addFriend', `Friend streak with ${f.name} started.`)}>Accept</button>
          <button type="button" className="x-btn" aria-label={`Decline ${f.name}`} disabled={busy === f.id} onClick={() => void act(f.id, 'dropFriend')}><Icon id="i-close" className="" /></button>
        </div>
      ))}

      {active.map((f) => <ActiveFriend key={f.id} f={f} busy={busy === f.id} onEnd={() => void act(f.id, 'dropFriend', `Friend streak with ${f.name} ended.`)} />)}

      {outgoing.map((f) => (
        <div key={f.id} className="frow">
          <Avatar avatar={f.avatar} print={f.print} size={40} />
          <div><b>{f.name}</b><span>Waiting for them to accept</span></div>
          <button type="button" className="mini-btn ghost" disabled={busy === f.id} onClick={() => void act(f.id, 'dropFriend')}>Cancel</button>
        </div>
      ))}

      <span className="kicker">People you played lately</span>
      {data.recent.length === 0 ? (
        <p className="fine">Play a friend or a quick match, then add them here.</p>
      ) : (
        data.recent.map((r) => (
          <div key={r.id} className="frow">
            <Avatar avatar={r.avatar} print={r.print} size={40} />
            <div><b>{r.name}</b><span>{stateName(r.state)}</span></div>
            <button
              type="button"
              className="mini-btn"
              disabled={busy === r.id || full}
              aria-label={`Ask ${r.name} for a friend streak`}
              onClick={() => void act(r.id, 'addFriend', `Asked ${r.name}. The streak starts when they accept.`)}
            >
              <Icon id="i-person-add" className="" />Add
            </button>
          </div>
        ))
      )}
      {full && <p className="fine">You have 5 friend streaks, the most you can keep.</p>}
    </div>
  );
}

function ActiveFriend({ f, busy, onEnd }: { f: FriendView; busy: boolean; onEnd: () => void }) {
  const [sure, setSure] = useState(false);
  let line = f.count ? 'Play a match today to keep it going' : 'Both play a match today to start it';
  if (f.youToday && f.themToday) line = 'You both played today';
  else if (f.youToday) line = `Waiting for ${f.name} to play today`;
  else if (f.themToday) line = `${f.name} played today. Your turn.`;
  return (
    <div className="frow">
      <Avatar avatar={f.avatar} print={f.print} size={40} />
      <div><b>{f.name}</b><span>{line}</span></div>
      <span className={`fcount${f.youToday && f.themToday ? ' lit' : ''}`} aria-label={`${f.count}-day friend streak`}>
        <Icon id={f.youToday && f.themToday ? 'i-flame' : 'i-flame-off'} className="" />{f.count}
      </span>
      {sure ? (
        <button type="button" className="mini-btn ghost" disabled={busy} onClick={onEnd}>End it</button>
      ) : (
        <button type="button" className="x-btn" aria-label={`End the friend streak with ${f.name}`} onClick={() => setSure(true)}><Icon id="i-close" className="" /></button>
      )}
    </div>
  );
}
