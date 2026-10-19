/**
 * For a banned player (docs/BACKEND.md, milestone 4): why they can't play other people, what
 * still works, and a way to ask for a ban review, whose answer shows here. Shown once each time
 * the app opens, whenever they tap a way to play someone, and from Ranks. Only banned players load it.
 */
import { useEffect, useState } from 'react';
import type { AppealView, Profile } from '../../shared/protocol';
import { Sheet } from '../components/Sheet';
import { call, post } from '../lib/api';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';

const MIN = 10;
const MAX = 500;
const day = (at: number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
const time = (at: number) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function BanSheet({ open, ban, onClose, onBaba }: {
  open: boolean;
  ban: NonNullable<Profile['ban']>;
  onClose: () => void;
  onBaba: () => void;
}) {
  const { token } = usePlayer();
  const [view, setView] = useState<AppealView | null>(null);
  const [step, setStep] = useState<'info' | 'ask'>('info');

  useEffect(() => {
    if (!open) return;
    setStep('info');
    call<AppealView>('/api/appeal', token).then(setView, () => {});
  }, [open, token]);

  return (
    <Sheet open={open} onClose={onClose} label={step === 'ask' ? 'Ask for a review' : 'Online play is off'} closeButton={false}>
      {step === 'ask' ? (
        <AskStep
          token={token}
          onBack={() => setStep('info')}
          onSent={(v) => {
            setView(v);
            setStep('info');
            toast.ok('Sent. The answer shows here.');
          }}
        />
      ) : (
        <Info ban={ban} view={view} onClose={onClose} onBaba={onBaba} onAsk={() => setStep('ask')} />
      )}
    </Sheet>
  );
}

function Info({ ban, view, onClose, onBaba, onAsk }: {
  ban: NonNullable<Profile['ban']>;
  view: AppealView | null;
  onClose: () => void;
  onBaba: () => void;
  onAsk: () => void;
}) {
  const a = view?.appeal ?? null;
  const canAsk = view !== null && view.askFrom !== null && view.askFrom <= Date.now();
  let status = '';
  if (a?.status === 'open') status = `You asked for a review on ${day(a.at)}. The answer shows here.`;
  else if (a?.status === 'kept') {
    status = `Reviewed on ${day(a.decidedAt ?? a.at)}: the ban stays.${a.note ? ` ${a.note}` : ''}`;
    if (!canAsk && view?.askFrom) status += ` Ask again from ${day(view.askFrom)}.`;
  }
  return (
    <>
      <div className="titled">
        <h2>You can't play other people right now</h2>
        <p className="fine">
          Online play was turned off for your account on {day(ban.at)}.
          {ban.until ? ` It comes back on ${day(ban.until)} at ${time(ban.until)}.` : ''}
        </p>
      </div>
      {/* Scrolls on a small phone if the reason or the review's answer is long, so the buttons stay in view. */}
      <div className="scroll">
        <div className="row-card"><div><b>Why</b><span>{ban.reason}</span></div></div>
        <p className="fine">
          Baba Ayo and your streak still work, and your title, Aura and Dara Seeds are safe.
          {status && <> <b className="appeal-status">{status}</b></>}
        </p>
      </div>
      <div className="actions">
        <button type="button" className="btn primary block" onClick={onBaba}>Play Baba Ayo</button>
        {canAsk ? (
          <div className="more stack-narrow">
            <button type="button" className="btn ghost sm" onClick={onAsk}>Ask for a review</button>
            <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
          </div>
        ) : (
          <button type="button" className="btn ghost block" onClick={onClose}>Close</button>
        )}
      </div>
    </>
  );
}

function AskStep({ token, onBack, onSent }: { token: string; onBack: () => void; onSent: (v: AppealView) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = text.trim().length;

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      onSent(await call<AppealView>('/api/appeal', token, post({ message: text })));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="titled">
        <h2>Ask for a review</h2>
        <p className="fine">Tell us what happened and why the ban should be lifted. We read every request, and the answer shows here.</p>
      </div>
      <div className="field-group">
        <textarea
          className="text-in area"
          aria-label="Why the ban should be lifted"
          placeholder="What happened?"
          maxLength={MAX}
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
        />
        <p className={error ? 'form-error' : 'fine'} role="status">
          {error || (n < MIN ? `At least ${MIN} characters.` : `${n} of ${MAX} characters.`)}
        </p>
      </div>
      <div className="actions">
        <button type="button" className="btn primary block" disabled={busy || n < MIN} onClick={send}>{busy ? 'Sending' : 'Send for review'}</button>
        <button type="button" className="btn ghost block" disabled={busy} onClick={onBack}>Back</button>
      </div>
    </>
  );
}
