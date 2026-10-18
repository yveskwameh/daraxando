/** Play Baba Ayo, the game's bot. Pick how hard he plays. No stakes, no rating. */
import { useRef, useState } from 'react';
import { BOT_LEVEL_INFO, BOT_LEVELS, type BotLevel } from '../../shared/bot';
import { MODES, seriesLabel, type ModeId } from '../../shared/modes';
import { AURA_BOT } from '../../shared/progression';
import { Avatar } from '../components/art';
import { Sheet } from '../components/Sheet';
import { api, type ApiError } from '../lib/api';
import { offlineOn } from '../lib/offline';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';

export function BabaSheet({ open, onClose, mode, go }: { open: boolean; onClose: () => void; mode: ModeId; go: Go }) {
  const { token, profile, online } = usePlayer();
  const [busy, setBusy] = useState<BotLevel | null>(null);
  // A double tap must start one game, not two: the state above only updates after a render.
  const starting = useRef(false);
  const m = MODES[mode];

  const play = async (level: BotLevel) => {
    if (starting.current) return;
    starting.current = true;
    setBusy(level);
    // No internet: Baba Ayo plays on the phone (src/lib/localMatch.ts), and the match counts
    // once it's sent, if there was a pass for it.
    const local = async () => {
      const r = (await import('../lib/localMatch')).startLocal(profile.id, mode, level);
      onClose();
      toast(r.counts ? "Playing offline. It counts when you're back online." : "Playing offline, just for fun this time.");
      go({ name: 'play', id: r.id });
    };
    try {
      if (!online && offlineOn()) return await local();
      const { matchId } = await api.playBot(token, mode, level);
      onClose();
      go({ name: 'play', id: matchId });
    } catch (err) {
      if ((err as ApiError).status === 0 && offlineOn()) return local().catch(() => {});
      toast.error((err as Error).message);
      starting.current = false;
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label="Play Baba Ayo">
      <div className="sheet-head">
        <Avatar avatar="baba" size={56} />
        <div className="titled">
          <h2>Play Baba Ayo</h2>
          <p className="muted">Baba Ayo is the game's bot. Pick how hard he plays.</p>
        </div>
      </div>
      <p className="fine">{m.name} · {seriesLabel(m.bo)} · No stake. Your Dara Seeds and rating stay the same.</p>
      <div className="stack">
        {BOT_LEVELS.map((l) => (
          <button key={l} type="button" className="opt" disabled={!!busy} onClick={() => play(l)}>
            <span />
            <span>
              <b>{busy === l ? 'Setting up the board' : BOT_LEVEL_INFO[l].name}</b>
              <span>{BOT_LEVEL_INFO[l].note}</span>
            </span>
            <span className="tag-xp">Win +{AURA_BOT[l].win} Aura</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
