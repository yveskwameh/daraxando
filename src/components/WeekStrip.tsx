/**
 * This week, Monday to Sunday, the way streak apps show it: a flame on days you played, ice
 * on days a Streak Freeze covered, an empty ring on days you missed, and today outlined.
 */
import { addDays, daysBetween, streakNow, weekKey, type Habits } from '../../shared/habits';
import { Icon } from './art';

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function WeekStrip({ habits, streak, today }: { habits: Habits; streak: number; today: string }) {
  const monday = weekKey(today);
  const now = streakNow(habits, streak, today);
  // Missed days a Streak Freeze is about to cover count as covered already.
  const covering = new Set<string>();
  if (now.freezing && habits.streakDay) for (let i = 1; i <= now.freezing; i++) covering.add(addDays(habits.streakDay, i));
  return (
    <ol className="week" aria-label="This week">
      {NAMES.map((name, i) => {
        const day = addDays(monday, i);
        const ahead = daysBetween(today, day) > 0;
        const played = habits.played.includes(day);
        const frozen = !played && (habits.frozen.includes(day) || covering.has(day));
        const isToday = day === today;
        const state = played ? 'played' : frozen ? 'frozen' : ahead ? 'ahead' : isToday ? 'today' : 'missed';
        const said = { played: 'played', frozen: 'covered by a Streak Freeze', ahead: 'still to come', today: 'today, not played yet', missed: 'missed' }[state];
        return (
          <li key={day} className={`${state}${isToday ? ' is-today' : ''}`} aria-label={`${name}, ${said}`}>
            <span className="d" aria-hidden="true">{name[0]}</span>
            <span className="c" aria-hidden="true">
              {played && <Icon id="i-flame" className="" />}
              {frozen && <Icon id="i-freeze" className="" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
