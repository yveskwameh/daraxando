/** Who you're up against, and the pot if there is one. Shown as a match begins. */
import { m } from 'motion/react';
import { stateName } from '../../shared/places';
import type { SeatView } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { Avatar, Icon } from './art';

export function VsSplash({ me, opp, stake, friend }: { me: SeatView; opp: SeatView; stake: number; friend: boolean }) {
  return (
    <m.div className="vs" role="status" aria-label={`You against ${opp.name}`} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="vs-card me">
        <Avatar avatar={me.avatar} print={me.print} size={64} />
        <div><b>{me.name}</b><span>{stateName(me.state)}</span></div>
      </div>
      <div className="vs-word">VS</div>
      {stake > 0 && <div className="pot"><Icon id="i-seed" className="" />Pot {fmt(stake * 2)}</div>}
      <div className="vs-card op">
        <Avatar avatar={opp.avatar} print={opp.print} size={64} />
        <div><b>{opp.name}</b><span>{friend ? 'Your friend · ' : ''}{stateName(opp.state)}</span></div>
      </div>
    </m.div>
  );
}
