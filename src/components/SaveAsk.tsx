import { Fragment, type ReactNode } from 'react';
import { levelInfo } from '../../shared/progression';
import type { Profile } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { iphoneTab } from '../lib/push';
import { Icon } from './art';
import { TopPop } from './TopPop';

/** "a, b and c", each kept on one line so "4-day" never breaks at the hyphen. */
const list = (xs: string[]): ReactNode =>
  xs.map((x, i) => (
    <Fragment key={x}>
      {i === 0 ? '' : i === xs.length - 1 ? ' and ' : ', '}
      <span className="nowrap">{x}</span>
    </Fragment>
  ));

/**
 * Asks a guest to save their progress (src/lib/asks.ts decides when): over the top of Home like
 * the other asks, naming what they'd lose with their own numbers. On an iPhone in Safari it also
 * says why it matters there: Safari clears a site's data when it isn't opened for a while.
 */
export function SaveAsk({ profile, onSave, onClose }: { profile: Profile; onSave: () => void; onClose: () => void }) {
  const keep = [`your ${levelInfo(profile.aura).title} title`, `${fmt(profile.cowries)} Dara Seeds`];
  if (profile.dayStreak >= 2) keep.push(`${profile.dayStreak}-day streak`);
  const line = iphoneTab()
    ? <>Safari can clear games you don't open for a week. Save to keep {list(keep)}.</>
    : <>Keep {list(keep)} if you change phones.</>;
  return (
    <TopPop className="push-pop" role="alertdialog" label="Save your progress" onHide={onClose}>
      <span className="push-ic"><Icon id="i-shield" className="" /></span>
      <div><b>Save your progress</b><span>{line}</span></div>
      <button type="button" className="mini-btn" onClick={onSave}>Save</button>
      <button type="button" className="x-btn" aria-label="Not now" onClick={onClose}><Icon id="i-close" className="" /></button>
    </TopPop>
  );
}
