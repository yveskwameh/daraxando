/**
 * Your player on another phone (docs/accounts-prototype.html "Your player on another phone",
 * "A friend's phone" and "Lost your code").
 *
 *  type:    four boxes of four. One real field sits over them, so typing, pasting and the
 *           keyboard's suggestions all just work. Letters a code never has are dropped.
 *  confirm: "Play as Tunde?", with "Keep me on this phone". It starts on when the phone has no
 *           player of its own, and off when it does: then it's a borrow, the phone's own player
 *           stays, and the borrow ends by itself (src/lib/codes.ts).
 *  lost:    "Ask us to help": answers only the real player would know. Yves answers in the admin
 *           dashboard, and the answer comes back on this phone (src/components/AccountPops.tsx).
 */
import { useEffect, useRef, useState } from 'react';
import { codeChars, MONTHS, PLAYER_CODE_LENGTH, RECOVERY_MESSAGE_MAX, showCode, type CodePlayer } from '../../shared/codes';
import { stateName, type StateCode } from '../../shared/places';
import { levelInfo } from '../../shared/progression';
import { cleanName, nameChars } from '../../shared/protocol';
import { fmt } from '../../shared/stakes';
import { Avatar } from '../components/art';
import { Sheet } from '../components/Sheet';
import { codeApi, myRecovery, phonePlayers } from '../lib/codes';
import { buzz } from '../lib/haptics';
import { useSession } from '../lib/session';
import { toast } from '../lib/toast';

type Step = 'type' | 'confirm' | 'lost' | 'sent';

interface Props {
  open: boolean;
  onClose: () => void;
  /** A code from a shared link or QR code, filled in. */
  initial?: string | null;
  /** Use Google or email instead (src/sheets/SaveSheet.tsx). */
  onOther?: () => void;
}

export default function FindSheet({ open, onClose, initial, onOther }: Props) {
  const session = useSession();
  const { token, profile } = session;
  const [step, setStep] = useState<Step>('type');
  const [code, setCode] = useState('');
  const [found, setFound] = useState<CodePlayer | null>(null);
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [asked, setAsked] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep('type');
    setCode(initial ? codeChars(initial).slice(0, PLAYER_CODE_LENGTH) : '');
    setFound(null);
    setError('');
    setBusy(false);
  }, [open, initial]);

  const wrong = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 420);
    buzz('invalid');
  };

  const find = async () => {
    if (code.length !== PLAYER_CODE_LENGTH || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await codeApi.find(token, code);
      if (r.same) {
        toast(`You're already playing as ${r.player.name}.`);
        onClose();
      } else {
        setFound(r.player);
        // A phone with a player of its own: borrowing. A phone with nobody on it: it's theirs.
        setKeep(!profile && phonePlayers.own().length === 0);
        setStep('confirm');
      }
    } catch (err) {
      wrong((err as Error).message);
    }
    setBusy(false);
  };

  const use = async () => {
    if (!found || busy) return;
    setBusy(true);
    try {
      const r = await codeApi.use(token, code);
      if (r.status === 'signedin') {
        buzz('win');
        toast.ok(keep ? `Welcome back, ${r.profile.name}.` : `Playing as ${r.profile.name}. Give the phone back from Home.`);
        onClose();
        session.signIn(r.token, r.profile, { borrow: !keep });
      } else {
        toast(`You're already playing as ${r.profile.name}.`);
        onClose();
      }
    } catch (err) {
      setBusy(false);
      setStep('type');
      wrong((err as Error).message);
    }
  };

  const label = { type: 'Type your player code', confirm: found ? `Play as ${found.name}?` : 'Your player', lost: 'Ask us to help', sent: 'We got it' }[step];

  return (
    <Sheet open={open} onClose={onClose} label={label} closeButton={step === 'type' || step === 'lost'}>
      {step === 'type' && (
        <>
          <div className="titled">
            <h2 className="x-room">Type your player code</h2>
            <p className="fine">The 16 letters and numbers from when you saved your player. Capitals or not, it doesn't matter.</p>
          </div>
          <form className="field-group" noValidate onSubmit={(e) => { e.preventDefault(); void find(); }}>
            <CodeBoxes value={code} shake={shake} busy={busy} onChange={(v) => { setCode(v); if (error) setError(''); }} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="actions">
              <button type="submit" className="btn primary block" disabled={code.length !== PLAYER_CODE_LENGTH || busy}>{busy ? 'Looking' : 'Find my player'}</button>
              <div className="more">
                {onOther && <button type="button" className="btn ghost sm" onClick={onOther}>Use Google or email</button>}
                <button type="button" className="btn ghost sm" onClick={() => { setError(''); setStep('lost'); }}>Lost your code?</button>
              </div>
            </div>
          </form>
        </>
      )}

      {step === 'confirm' && found && (
        <>
          <div className="titled center">
            <span className="hero-av"><Avatar avatar={found.avatar} print={found.print} size={84} /></span>
            <h2>Play as {found.name}?</h2>
            <p className="fine">
              {[levelInfo(found.aura).title, stateName(found.state as StateCode), `${fmt(found.cowries)} seeds`, found.dayStreak > 0 ? `${found.dayStreak}-day streak` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
          {profile && <p className="fine center-text">{profile.name} stays on this phone and comes back with one tap.</p>}
          <div className="toggle-row">
            <div>
              <b>Keep me on this phone</b>
              <span>{keep ? `This is my phone. Next time it opens as ${found.name}.` : "Off: you're borrowing it. You leave when you give it back."}</span>
            </div>
            <button type="button" className="sw-toggle" role="switch" aria-checked={keep} aria-label="Keep me on this phone" onClick={() => setKeep((k) => !k)} />
          </div>
          <div className="actions">
            <button type="button" className="btn primary block" disabled={busy} onClick={use}>{busy ? 'Opening' : `Play as ${found.name}`}</button>
            <button type="button" className="btn ghost block" onClick={() => { setFound(null); setStep('type'); }}>That's not me</button>
          </div>
        </>
      )}

      {step === 'lost' && <LostForm onBack={() => setStep('type')} onSent={(name) => { setAsked(name); setStep('sent'); }} />}

      {step === 'sent' && (
        <>
          <div className="titled center">
            <h2>We got it</h2>
            <p className="fine">We'll look within 2 days. Keep this phone: if we can help, {asked} comes back here, and the game says so when you open it.</p>
          </div>
          <div className="actions">
            <button type="button" className="btn primary block" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Four boxes of four characters, filled from one real field laid over them. */
function CodeBoxes({ value, onChange, busy, shake }: { value: string; onChange: (v: string) => void; busy?: boolean; shake?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Ready to type, unless a link already filled it in.
    if (value.length < PLAYER_CODE_LENGTH) ref.current?.focus({ preventScroll: true });
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cur = Math.min(value.length, PLAYER_CODE_LENGTH - 1);
  return (
    <div className={`pcode${shake ? ' shake' : ''}${busy ? ' busy' : ''}`} data-nodrag>
      <input
        ref={ref}
        aria-label="Your player code, 16 letters and numbers"
        className="pcode-in"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={PLAYER_CODE_LENGTH + 6}
        readOnly={busy}
        value={value.length ? showCode(value) : ''}
        onChange={(e) => onChange(codeChars(e.target.value).slice(0, PLAYER_CODE_LENGTH))}
      />
      {[0, 1, 2, 3].map((g) => (
        <span key={g} className={Math.floor(cur / 4) === g ? 'cur' : ''} aria-hidden="true">
          {value.slice(g * 4, g * 4 + 4) || ' '}
        </span>
      ))}
    </div>
  );
}

/** "Lost your code? Ask us to help." */
function LostForm({ onBack, onSent }: { onBack: () => void; onSent: (name: string) => void }) {
  const { token, profile } = useSession();
  const [name, setName] = useState('');
  const [seeds, setSeeds] = useState('');
  const [month, setMonth] = useState(0);
  const [opponent, setOpponent] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = !!cleanName(name) && seeds.trim() !== '' && month > 0 && !!cleanName(opponent);

  const send = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await codeApi.ask(token, { name, seeds: Number(seeds.replace(/\D/g, '')), month, opponent, message });
      myRecovery.set({ id: r.id, secret: r.secret, name: r.name, at: Date.now() });
      buzz('win');
      onSent(r.name);
    } catch (err) {
      buzz('invalid');
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="titled">
        <h2 className="x-room">Ask us to help</h2>
        <p className="fine">Tell us about your player. If it adds up, we'll bring it back to this phone. {profile ? `${profile.name} stays here too.` : ''}</p>
      </div>
      <form className="scroll lost-form" noValidate onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label className="ask-field">
          <span>Your player's name</span>
          <input className="text-in" value={name} maxLength={16} autoComplete="off" spellCheck={false} onChange={(e) => setName(nameChars(e.target.value))} />
        </label>
        <label className="ask-field">
          <span>About how many Dara Seeds you had</span>
          <input className="text-in" value={seeds} inputMode="numeric" maxLength={9} placeholder="For example 5,000" onChange={(e) => setSeeds(e.target.value.replace(/[^\d,]/g, ''))} />
        </label>
        <label className="ask-field">
          <span>The month you started</span>
          <select className="text-in" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            <option value={0} disabled>Pick a month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label className="ask-field">
          <span>Someone you played recently</span>
          <input className="text-in" value={opponent} maxLength={16} autoComplete="off" spellCheck={false} onChange={(e) => setOpponent(nameChars(e.target.value))} />
        </label>
        <label className="ask-field">
          <span>Anything else (optional)</span>
          <textarea className="text-in" rows={2} value={message} maxLength={RECOVERY_MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary block" disabled={!ready || busy}>{busy ? 'Sending' : 'Send'}</button>
          <button type="button" className="btn ghost block" onClick={onBack}>Back to the code</button>
        </div>
      </form>
    </>
  );
}
