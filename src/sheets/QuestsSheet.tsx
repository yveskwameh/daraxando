/**
 * Daily quests: three small goals a day, each with Aura. Win 3 matches is always one of
 * them; the other two change every day. They reset at midnight, Nigeria time.
 */
import { useEffect, useState } from 'react';
import { questsToday } from '../../shared/habits';
import { dayKey } from '../../shared/progression';
import { Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { usePlayer } from '../lib/session';

/** Midnight in Nigeria (UTC+1) after `now`. */
const nextMidnight = (now: number) => {
  const local = now + 3_600_000;
  return local - (local % 86_400_000) + 86_400_000 - 3_600_000;
};

function useLeft() {
  const [left, setLeft] = useState(() => nextMidnight(Date.now()) - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(nextMidnight(Date.now()) - Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function QuestsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Daily quests">
      {open && <Body />}
    </Sheet>
  );
}

function Body() {
  const { profile } = usePlayer();
  const left = useLeft();
  const list = questsToday(profile.habits, profile.id, dayKey(Date.now()), profile.dayWins);
  const done = list.filter((q) => q.done).length;
  return (
    <>
      <div className="sheet-head">
        <Icon id="i-quest" className="quest-ic" />
        <div className="titled">
          <h2>Daily quests</h2>
          <p className="fine">{done === list.length ? 'All done for today. New quests' : 'New quests'} in {left}.</p>
        </div>
      </div>
      <ol className="quests">
        {list.map((q) => (
          <li key={q.id} className={q.done ? 'done' : ''}>
            <span className="qi" aria-hidden="true">{q.done ? <Icon id="i-check" className="" /> : <Icon id="i-quest" className="" />}</span>
            <div>
              <b>{q.title}</b>
              <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={q.progress} aria-label={`${q.title}: ${q.progress} of ${q.target}`}>
                <i style={{ width: `${Math.max(q.progress ? 8 : 0, (q.progress / q.target) * 100)}%` }} />
              </span>
            </div>
            <span className="qr">
              <small>{q.progress}/{q.target}</small>
              <b><Icon id="i-aura" className="" />+{q.aura}</b>
            </span>
          </li>
        ))}
      </ol>
      <p className="fine">Quick matches, friends and Baba Ayo all count. Quests reset at midnight, Nigeria time.</p>
    </>
  );
}
