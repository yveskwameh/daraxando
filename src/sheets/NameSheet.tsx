/**
 * "What should we call you?" (Yves, 17 October 2026: players set their own name, and it's not
 * optional). The first screen stays one tap with a name the game picks; after the first match,
 * Home asks for a real one. Players whose name another player had first (the game added a
 * number) are asked the same way. The sheet only closes by saving a name, which can be the
 * one already filled in.
 */
import { NameForm } from '../components/NameForm';
import { Sheet } from '../components/Sheet';
import { toast } from '../lib/toast';

export default function NameSheet({ open, kind, onDone }: { open: boolean; kind: 'new' | 'taken'; onDone: () => void }) {
  return (
    <Sheet open={open} onClose={onDone} label={kind === 'new' ? 'Pick your name' : 'Pick a new name'} locked>
      <div className="titled">
        <h2>{kind === 'new' ? 'What should we call you?' : 'Pick a new name'}</h2>
        <p className="muted">
          {kind === 'new'
            ? 'Other players see this name in matches and on Ranks. Every name is one of a kind.'
            : 'Another player had your name first, so the game added a number to yours. Pick the name you want, or keep this one.'}
        </p>
      </div>
      <NameForm
        id="name-sheet-in"
        sheet
        submit="Save my name"
        onSaved={(name) => {
          toast.ok(`You're ${name} now. Change it any time on You.`);
          onDone();
        }}
      />
    </Sheet>
  );
}
