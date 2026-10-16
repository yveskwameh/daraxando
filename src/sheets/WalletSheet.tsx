/** Your Dara Seeds: how you get them, what they're for, and Sapa relief when you're low. */
import { useState } from 'react';
import { dayKey, titleFor } from '../../shared/progression';
import { BIG_LEVEL, DAILY_COWRIES, fmt, SAPA_BELOW, SAPA_EVERY_MS, SAPA_TO, sapaReady } from '../../shared/stakes';
import { Cowries } from '../components/art';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { buzz } from '../lib/haptics';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';

export function WalletSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, token, setProfile } = usePlayer();
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const low = profile.cowries < SAPA_BELOW;
  const ready = sapaReady(profile.cowries, profile.sapaAt, now);
  const waitMin = Math.ceil((profile.sapaAt + SAPA_EVERY_MS - now) / 60_000);
  const playedToday = profile.lastPlayedDay === dayKey(now);

  const claim = async () => {
    setBusy(true);
    try {
      const res = await api.sapa(token);
      setProfile(res.profile);
      buzz('win');
      toast(`Sapa relief: you have ${fmt(SAPA_TO)} Dara Seeds again.`);
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Your Dara Seeds" closeButton={false}>
      <div className="titled">
        <h2>Your Dara Seeds</h2>
        <div className="wallet-big"><Cowries n={profile.cowries} /></div>
      </div>
      <div className="scroll">
        <div className="stack">
          <div className="row-card"><div><b>Stake them on matches</b><span>Both players put in the same amount and the winner takes the pot.</span></div></div>
          <div className="row-card">
            <div>
              <b>+{fmt(DAILY_COWRIES)} every day you play</b>
              <span>{playedToday ? "Today's are in. Come back tomorrow for more." : 'They land with your first match today.'}</span>
            </div>
          </div>
          <div className="row-card">
            <div>
              <b>Sapa relief</b>
              <span>
                {ready
                  ? `You're low. Get topped up to ${fmt(SAPA_TO)} for free.`
                  : low
                    ? `Next top-up in ${waitMin >= 60 ? `${Math.ceil(waitMin / 60)} h` : `${waitMin} min`}.`
                    : `Below ${fmt(SAPA_BELOW)}? Get topped up to ${fmt(SAPA_TO)} for free, every 4 hours.`}
              </span>
            </div>
            {ready && <button type="button" className="mini-btn" disabled={busy} onClick={claim}>Claim</button>}
          </div>
          <div className="row-card"><div><b>Big tables</b><span>Stakes of 50,000 and 100,000 open when you reach {titleFor(BIG_LEVEL)}, the {BIG_LEVEL}th title.</span></div></div>
        </div>
      </div>
      <p className="fine">Dara Seeds are for fun. You can't buy, sell, send or cash them out. Aura is different: it's your progress, it earns you new titles, and you never lose it.</p>
      <button type="button" className="btn cream block" onClick={onClose}>Got it</button>
    </Sheet>
  );
}
