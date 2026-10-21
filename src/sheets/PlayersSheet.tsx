/**
 * Players on this phone (docs/accounts-prototype.html "A friend's phone"). Sign out became Switch
 * player: the phone remembers its players (src/lib/codes.ts), so nobody comes back as a new player
 * by accident. Tap one to play as them, bring your own with your code, or start a new player.
 * Removing one only takes them off this phone: their code still brings them back.
 */
import { useEffect, useState } from 'react';
import { Avatar, Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { phonePlayers, type PhonePlayer } from '../lib/codes';
import { buzz } from '../lib/haptics';
import { useSession } from '../lib/session';
import { toast } from '../lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Use my own player: the code sheet. */
  onFind: () => void;
  /** New player: back to the first screen. */
  onNew: () => void;
}

const when = (at: number) => {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days <= 0 ? 'Played today' : days === 1 ? 'Played yesterday' : `Played ${new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
};

export default function PlayersSheet({ open, onClose, onFind, onNew }: Props) {
  const session = useSession();
  const [list, setList] = useState<PhonePlayer[]>([]);
  const [removing, setRemoving] = useState<PhonePlayer | null>(null);
  const current = session.profile?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setList(phonePlayers.list());
    setRemoving(null);
  }, [open]);

  const pick = (p: PhonePlayer) => {
    if (p.id === current) return onClose();
    buzz('tap');
    onClose();
    toast(`Now playing as ${p.name}.`);
    session.switchTo(p.id);
  };

  if (removing) {
    return (
      <Sheet open={open} onClose={onClose} label={`Remove ${removing.name}`} closeButton={false}>
        <div className="titled">
          <h2>Remove {removing.name} from this phone?</h2>
          <p className="fine">{removing.name} isn't deleted. They come back on any phone with their player code, Google or email.</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary block"
            onClick={() => {
              const was = removing;
              session.forget(was.id);
              setList(phonePlayers.list());
              setRemoving(null);
              toast(`${was.name} is off this phone.`);
              if (was.id === current) onClose();
            }}
          >
            Remove from this phone
          </button>
          <button type="button" className="btn ghost block" onClick={() => setRemoving(null)}>Keep {removing.name}</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} label="Players on this phone">
      <div className="titled">
        <h2 className="x-room">Players on this phone</h2>
        <p className="fine">{list.length ? 'Tap a player to play as them.' : 'Nobody yet. Bring your player with your code.'}</p>
      </div>
      {list.length > 0 && (
        <ul className="scroll players-list">
          {list.map((p) => (
            <li key={p.id} className={`prow${p.id === current ? ' now' : ''}`}>
              <button type="button" className="prow-main" onClick={() => pick(p)} aria-current={p.id === current || undefined}>
                <Avatar avatar={p.avatar} print={p.print} size={44} />
                <span>
                  <b>{p.name}</b>
                  <small>{p.borrowed ? 'Borrowing this phone' : p.id === current ? 'Playing now' : when(p.at)}</small>
                </span>
                {p.id === current && <span className="pill">Playing</span>}
              </button>
              <button type="button" className="x-btn" aria-label={`Remove ${p.name} from this phone`} onClick={() => setRemoving(p)}>
                <Icon id="i-close" className="" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="btn primary block" onClick={onFind}>Use my own player</button>
        <button type="button" className="btn ghost block" onClick={onNew}>New player</button>
      </div>
    </Sheet>
  );
}
