/**
 * Pick a game, from the chip on Home's game picture. Every way to play uses the game picked
 * here: Quick match, a friend's room and Baba Ayo. Picking one closes the sheet.
 */
import type { CSSProperties } from 'react';
import { isNewMode, MODE_IDS, MODES, seriesLabel, type ModeId } from '../../shared/modes';
import { dayKey } from '../../shared/progression';
import { printBg } from '../art/prints';
import { Sheet } from '../components/Sheet';
import { buzz } from '../lib/haptics';

export default function ModeSheet({ open, onClose, mode, onPick }: { open: boolean; onClose: () => void; mode: ModeId; onPick: (m: ModeId) => void }) {
  const today = dayKey(Date.now());
  return (
    <Sheet open={open} onClose={onClose} label="Pick a game">
      <div className="titled">
        <h2>Pick a game</h2>
        <p className="muted">Every way to play uses the game you pick.</p>
      </div>
      <div className="mode-tiles" role="group" aria-label="Games">
        {MODE_IDS.map((id) => {
          const m = MODES[id];
          const isNew = isNewMode(m, today);
          return (
            <button
              key={id}
              type="button"
              className="mode-tile"
              aria-pressed={id === mode}
              aria-label={`${m.name}. ${m.rule} ${seriesLabel(m.bo)}.${isNew ? ' New.' : ''}`}
              style={{ '--band': printBg(m.band) } as CSSProperties}
              onClick={() => {
                buzz('tap');
                onPick(id);
              }}
            >
              <b>{m.name}</b>
              <span>{m.hint}</span>
              <small>{seriesLabel(m.bo)}{isNew && <i className="pill hot">New</i>}</small>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
