/** Play Baba Ayo, the game's bot. Pick how hard he plays. No stakes, no rating. */
import { useState } from 'react';
import { BOT_LEVEL_INFO, BOT_LEVELS, type BotLevel } from '../../shared/bot';
import { MODES, seriesLabel, type ModeId } from '../../shared/modes';
import { AURA_BOT } from '../../shared/progression';
import { Avatar } from '../components/art';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import type { Go } from '../lib/router';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';

export function BabaSheet({ open, onClose, mode, go }: { open: boolean; onClose: () => void; mode: ModeId; go: Go }) {
  const { token } = usePlayer();
  const [busy, setBusy] = useState<BotLevel | null>(null);
  const m = MODES[mode];

  const play = async (level: BotLevel) => {
    setBusy(level);
    try {
      const { matchId } = await api.playBot(token, mode, level);
      onClose();
      go({ name: 'play', id: matchId });
    } catch (err) {
      toast((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label="Play Baba Ayo">
      <div className="sheet-head">
        <Avatar avatar="baba" size={56} />
        <div>
          <h2>Play Baba Ayo</h2>
          <p className="muted" style={{ fontSize: '0.875rem' }}>Baba Ayo is the game's bot. Pick how hard he plays.</p>
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
