/** Pick a table before Quick match. Locked tables say why, in plain words. */
import { useState } from 'react';
import type { Profile } from '../../shared/protocol';
import { fee, fmt, prize, short, TABLES, tableLock } from '../../shared/stakes';
import { Cowries, Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { buzz } from '../lib/haptics';
import { toast } from '../lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  stake: number;
  onGo: (stake: number) => void;
}

export function StakeSheet({ open, onClose, profile, stake, onGo }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label="Pick your stake">
      <StakeBody profile={profile} initial={stake} onGo={onGo} />
    </Sheet>
  );
}

function StakeBody({ profile, initial, onGo }: { profile: Profile; initial: number; onGo: (stake: number) => void }) {
  const now = Date.now();
  const lockOf = (n: number) => tableLock(n, profile, now);
  const [pick, setPick] = useState(() => (lockOf(initial) ? 0 : initial));

  return (
    <>
      <div className="titled">
        <h2>Pick your stake</h2>
        <p className="fine">Both players put in the same amount. The winner takes the pot. A draw gives both stakes back.</p>
      </div>
      <div className="scroll">
        <div className="tables" role="group" aria-label="Tables">
          {TABLES.map((n) => {
            const lock = lockOf(n);
            return (
              <button
                key={n}
                type="button"
                className="table-row"
                aria-pressed={n === pick}
                aria-disabled={!!lock}
                onClick={() => {
                  if (lock) {
                    buzz('invalid');
                    toast.error(`${lock}.`);
                    return;
                  }
                  buzz('tap');
                  setPick(n);
                }}
              >
                <span className="amt">{n ? <><Icon id="i-seed" className="" />{short(n)}</> : 'Free'}</span>
                <span>
                  <b>{n ? `Winner takes ${fmt(prize(n))}` : 'Play for Aura only'}</b>
                  <small>{lock || (n ? (fee(n) ? '5% table fee' : 'No table fee') : 'Nothing at stake')}</small>
                </span>
                {lock ? <Icon id="i-lock" className="lock" /> : <span />}
              </button>
            );
          })}
        </div>
      </div>
      <p className="fine">
        You have <b><Cowries n={profile.cowries} /></b> Dara Seeds. They're for fun: you can't buy, sell, send or cash them out.
      </p>
      <button type="button" className="btn primary block" onClick={() => onGo(pick)}>
        Find a match · {pick ? `Stake ${fmt(pick)}` : 'Free'}
      </button>
    </>
  );
}
