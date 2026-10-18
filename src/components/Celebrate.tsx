/**
 * After a match, before the result sheet: the moments worth a full screen, one at a time,
 * like Duolingo after a lesson. Your streak growing (first match of the day), a streak stake
 * won, quests finished, badges earned. Each one has a Continue button; tapping anywhere works
 * too. Nothing shows when nothing happened.
 */
import { useEffect, useState } from 'react';
import { BADGES, BET_DAYS, canRepair, type Habits } from '../../shared/habits';
import { dayKey } from '../../shared/progression';
import type { HabitOutcome } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { babaLine } from '../lib/babaNudge';
import { buzz } from '../lib/haptics';
import { prefs } from '../lib/prefs';
import { sfx } from '../lib/sound';
import { Avatar, Icon } from './art';
import { WeekStrip } from './WeekStrip';

type Step = 'streak' | 'bet' | 'quests' | 'badges';

export function stepsFor(h: HabitOutcome | undefined): Step[] {
  if (!h) return [];
  const steps: Step[] = [];
  if (h.extended) steps.push('streak');
  if (h.bet?.result === 'won') steps.push('bet');
  if (h.quests.length) steps.push('quests');
  if (h.badges.length) steps.push('badges');
  return steps;
}

export function Celebrate({ outcome, habits, onDone }: { outcome: HabitOutcome; habits: Habits; onDone: () => void }) {
  const steps = stepsFor(outcome);
  const [at, setAt] = useState(0);
  const step = steps[at];

  useEffect(() => {
    if (!step) return;
    if (step === 'streak' || step === 'bet') { sfx.levelUp(); buzz('win'); } else { sfx.found(); buzz('stamp'); }
  }, [step]);

  if (!step) return null;
  const next = () => (at + 1 < steps.length ? setAt(at + 1) : onDone());

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-label="Match rewards" onClick={next}>
      <div className="cel-body" key={step}>
        {step === 'streak' && <StreakStep o={outcome} habits={habits} />}
        {step === 'bet' && (
          <>
            <Icon id="i-seed" className="cel-ic" />
            <p className="cel-big">+{fmt(outcome.bet?.result === 'won' ? outcome.bet.paid : 0)}</p>
            <p className="cel-sub">Streak stake won</p>
            <p className="muted">You kept your streak for {BET_DAYS} days. The Dara Seeds are in your wallet.</p>
          </>
        )}
        {step === 'quests' && (
          <>
            <Icon id="i-quest" className="cel-ic quest" />
            <p className="cel-sub">{outcome.quests.length > 1 ? 'Quests done' : 'Quest done'}</p>
            <ul className="cel-list">
              {outcome.quests.map((q) => (
                <li key={q.id}><Icon id="i-check" className="" /><span>{q.title}</span><b><Icon id="i-aura" className="" />+{q.aura}</b></li>
              ))}
            </ul>
          </>
        )}
        {step === 'badges' && (
          <>
            <Icon id="i-star" className="cel-ic star" />
            <p className="cel-sub">{outcome.badges.length > 1 ? 'New badges' : 'New badge'}</p>
            <ul className="cel-list">
              {outcome.badges.map((b) => (
                <li key={`${b.id}${b.star}`}>
                  <span className="stars" aria-label={`${b.star} of 3 stars`}>
                    {[1, 2, 3].map((n) => <Icon key={n} id="i-star" className={n <= b.star ? 'on' : ''} />)}
                  </span>
                  <span>{BADGES.find((x) => x.id === b.id)?.name ?? b.name}</span>
                  <b><Icon id="i-aura" className="" />+{b.aura}</b>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="btn primary block lg" data-autofocus onClick={(e) => { e.stopPropagation(); next(); }}>Continue</button>
      </div>
    </div>
  );
}

function StreakStep({ o, habits }: { o: HabitOutcome; habits: Habits }) {
  const [n, setN] = useState(Math.max(0, o.streak - 1));
  // Only a streak that can be restored gets the "it ended" line and Baba Ayo's sulk. A 1-day
  // streak that ended is just day 1 again.
  const repairable = canRepair(o.broke);
  const [baba] = useState(() => (repairable && prefs.get().nudges ? babaLine('ended', { n: o.broke }) : null));
  useEffect(() => {
    const t = setTimeout(() => setN(o.streak), 450);
    return () => clearTimeout(t);
  }, [o.streak]);
  let line: string;
  if (o.milestone) line = `${o.milestone.days}-day streak. +${o.milestone.aura} Aura${o.milestone.freeze ? ' and a free Streak Freeze' : ''}.`;
  else if (repairable) line = `Your ${o.broke}-day streak ended, so this is day 1. You can restore the old one from your streak for a few days.`;
  else if (o.streak === 1) line = 'Day 1. Play tomorrow to make it 2.';
  else line = `Play tomorrow to make it ${o.streak + 1}.`;
  return (
    <>
      <Icon id="i-flame" className="cel-ic flame" />
      <p className="cel-big" aria-live="polite">{n}</p>
      <p className="cel-sub">day streak</p>
      <WeekStrip habits={habits} streak={o.streak} today={dayKey(Date.now())} />
      <p className="muted">{line}</p>
      {baba && (
        <div className="baba-say">
          <span className="baba-face ended"><Avatar avatar="baba" size={40} /></span>
          <p>{baba}</p>
        </div>
      )}
      {o.usedFreezes > 0 && <p className="fine"><Icon id="i-freeze" className="ice-i" /> A Streak Freeze covered the day you missed.</p>}
      {o.bet?.result === 'progress' && <p className="fine">Streak stake: day {o.bet.days} of {BET_DAYS}.</p>}
      {o.bet?.result === 'lost' && <p className="fine">Your streak stake was lost when the streak ended.</p>}
    </>
  );
}
