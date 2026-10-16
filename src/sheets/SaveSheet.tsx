/**
 * Save your progress, or sign in to a player you saved before (server: worker/accounts.ts).
 *
 *  save:   a guest links Google or an email, so a new phone doesn't start them from zero.
 *  signin: a phone with no player, or a player who wants a different one, signs in with what
 *          that player was saved with.
 *
 * Steps: pick (Google, or an email for a code), code (six boxes on the board from the email,
 * filled by typing, by Gmail's "Copy code" or by the iPhone's suggestion above the keyboard),
 * and switch (the Google account or email belongs to another player, so ask first).
 *
 * Google is a trip to Google's page and back. The answer is collected when the app opens again
 * (src/screens/Account.tsx), so this sheet only starts it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Account, AuthResult, AuthVia, Profile } from '../../shared/protocol';
import { levelInfo } from '../../shared/progression';
import { fmt } from '../../shared/stakes';
import { Avatar, Cowries, Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { auth, shortEmail, type Intent } from '../lib/auth';
import { buzz } from '../lib/haptics';
import { useSession } from '../lib/session';
import { toast } from '../lib/toast';

type Switch = Extract<AuthResult, { token: string }>;
type Step =
  | { s: 'pick' }
  | { s: 'code'; id: string; email: string; kind: Intent; sentAt: number }
  | { s: 'switch'; result: Switch };

const RESEND_S = 30;
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(e.trim());

interface Props {
  open: boolean;
  onClose: () => void;
  intent: Intent;
  /** The screen Google sends the player back to: /, /you or a friend's room (/play/K7P2Q). */
  back: string;
  /** What the player already has linked: its button is left out. */
  has?: Account | null;
}

export default function SaveSheet({ open, onClose, intent, back, has }: Props) {
  const session = useSession();
  const { token, profile } = session;
  const [step, setStep] = useState<Step>({ s: 'pick' });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'' | 'google' | 'email'>('');
  const [error, setError] = useState('');

  // Every time it opens, start from the top.
  useEffect(() => {
    if (!open) return;
    setStep({ s: 'pick' });
    setBusy('');
    setError('');
  }, [open]);

  // Back from Google in a separate browser (iPhones sometimes do this): the save happened there, so look.
  useEffect(() => {
    if (busy !== 'google' || !token) return;
    const look = () => {
      if (document.visibilityState !== 'visible') return;
      api.me(token).then(({ profile: p }) => {
        session.setProfile(p);
        if (p.saved) {
          toast('Saved with Google. Your progress is safe on any phone.');
          onClose();
        } else setBusy('');
      }, () => setBusy(''));
    };
    document.addEventListener('visibilitychange', look);
    return () => document.removeEventListener('visibilitychange', look);
  }, [busy, token, session, onClose]);

  /** What a code, a link or Google came back with. */
  const settle = (r: AuthResult) => {
    switch (r.status) {
      case 'saved':
        session.setProfile(r.profile);
        buzz('win');
        toast(r.via === 'google' ? 'Saved with Google. Your progress is safe on any phone.' : 'Saved. Your progress is safe on any phone.');
        onClose();
        return;
      case 'same':
        session.setProfile(r.profile);
        toast(`You're already playing as ${r.profile.name}.`);
        onClose();
        return;
      case 'signedin':
        buzz('win');
        toast(`Welcome back, ${r.profile.name}.`);
        onClose();
        session.signIn(r.token, r.profile);
        return;
      case 'switch':
        setStep({ s: 'switch', result: r });
        return;
      case 'none':
        setError('No player is saved with that Google account.');
        return;
      case 'error':
        setError(r.message);
    }
  };

  const google = async () => {
    if (busy) return;
    setBusy('google');
    setError('');
    buzz('tap');
    try {
      const { url } = await auth.googleStart(token, intent, back);
      location.assign(url);
    } catch (err) {
      setError((err as Error).message);
      setBusy('');
    }
  };

  const send = async (to = email) => {
    if (busy) return;
    if (!looksLikeEmail(to)) {
      buzz('invalid');
      setError('Check your email address. It should look like name@example.com.');
      return;
    }
    setBusy('email');
    setError('');
    try {
      const r = await auth.emailStart(token, to, intent);
      setStep({ s: 'code', id: r.id, email: to.trim().toLowerCase(), kind: r.kind, sentAt: Date.now() });
    } catch (err) {
      buzz('invalid');
      setError((err as Error).message);
    }
    setBusy('');
  };

  const title = step.s === 'switch' ? null : step.s === 'code' ? 'Check your email' : intent === 'save' ? 'Save your progress' : 'Sign in to your player';

  return (
    <Sheet open={open} onClose={onClose} label={title ?? 'Switch players'}>
      {step.s === 'pick' && (
        <>
          <div>
            <h2>{title}</h2>
            <p className="fine">{intent === 'save' && profile ? keepLine(profile) : 'Use the Google account or the email you saved your player with.'}</p>
          </div>
          {!has?.google && <GoogleButton busy={busy === 'google'} disabled={!!busy} onClick={google} />}
          {!has?.google && !has?.email && <p className="or" aria-hidden="true"><span>or use your email</span></p>}
          {!has?.email && (
            <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <label className="sr" htmlFor="save-email">Your email</label>
              <input
                id="save-email"
                className="text-in email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Your email"
                maxLength={254}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
              />
              <button type="submit" className="btn primary block" disabled={!!busy || !email.trim()}>
                {busy === 'email' ? 'Sending the code' : 'Send me a code'}
              </button>
            </form>
          )}
          <p className={error ? 'form-error' : 'fine'} role={error ? 'alert' : undefined}>
            {error || 'We only use it to sign you in. Nobody else sees it.'}
          </p>
        </>
      )}

      {step.s === 'code' && (
        <CodeStep
          key={step.id}
          step={step}
          intent={intent}
          onResult={settle}
          onOther={() => { setStep({ s: 'pick' }); setError(''); }}
          onResend={async () => {
            try {
              const r = await auth.emailStart(token, step.email, intent);
              setStep({ ...step, id: r.id, kind: r.kind, sentAt: Date.now() });
              toast('New code sent. Use the newest email.');
            } catch (err) {
              toast((err as Error).message);
            }
          }}
          onSavedElsewhere={(p) => {
            session.setProfile(p);
            toast('Saved. Your progress is safe on any phone.');
            onClose();
          }}
        />
      )}

      {step.s === 'switch' && (
        <SwitchCard
          result={step.result}
          current={profile}
          onSwitch={() => {
            buzz('win');
            toast(`You're now playing as ${step.result.profile.name}.`);
            onClose();
            session.signIn(step.result.token, step.result.profile);
          }}
          onKeep={onClose}
        />
      )}
    </Sheet>
  );
}

/** "Keep your 5,200 Dara Seeds, your JJC title and your 4-day streak on any phone." */
function keepLine(p: Profile) {
  const parts = [`your ${fmt(p.cowries)} Dara Seeds`, `your ${levelInfo(p.aura).title} title`];
  if (p.dayStreak > 0) parts.push(`your ${p.dayStreak}-day streak`);
  return `Keep ${parts.slice(0, -1).join(', ')} and ${parts.at(-1)} on any phone, even a new one.`;
}

function CodeStep({ step, intent, onResult, onOther, onResend, onSavedElsewhere }: {
  step: Extract<Step, { s: 'code' }>;
  intent: Intent;
  onResult: (r: AuthResult) => void;
  onOther: () => void;
  onResend: () => Promise<void>;
  onSavedElsewhere: (p: Profile) => void;
}) {
  const { token } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [wait, setWait] = useState(RESEND_S);
  const tried = useRef('');

  // "New code in 30s", once a second.
  useEffect(() => {
    const tick = () => setWait(Math.max(0, RESEND_S - Math.floor((Date.now() - step.sentAt) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [step.sentAt]);

  // A wrong code: a short shake, the boxes empty, the keyboard stays up.
  const wrong = (message: string) => {
    setError(message);
    setCode('');
    tried.current = '';
    setShake(true);
    setTimeout(() => setShake(false), 420);
    buzz('invalid');
  };

  // Six numbers in: check them straight away, once.
  useEffect(() => {
    if (code.length !== 6 || busy || tried.current === code) return;
    tried.current = code;
    setBusy(true);
    setError('');
    auth.emailCode(token, step.id, code).then(
      (r) => {
        setBusy(false);
        if (r.status === 'error') wrong(r.message);
        else onResult(r);
      },
      (err: Error) => {
        setBusy(false);
        wrong(err.message);
      },
    );
  }, [code, busy, token, step.id, onResult]);

  // Coming back to the app after tapping the link in the email, maybe in another browser.
  useEffect(() => {
    const look = () => {
      if (document.visibilityState !== 'visible') return;
      auth.emailStatus(token, step.id).then(async (s) => {
        if (s.state === 'used' && s.saved && token) onSavedElsewhere((await api.me(token)).profile);
        else if (s.state === 'used') setError('The link in the email was used, so this code is done. Send a new code to sign in on this phone.');
        else if (s.state === 'expired') setError('That code has run out. Send a new one.');
      }, () => {});
    };
    document.addEventListener('visibilitychange', look);
    return () => document.removeEventListener('visibilitychange', look);
  }, [token, step.id, onSavedElsewhere]);

  const other = intent === 'save' && step.kind === 'signin';
  return (
    <>
      <div>
        <h2>Check your email</h2>
        <p className="fine">
          {other ? 'This email already has a player. ' : ''}We sent a 6-digit code to <b>{shortEmail(step.email)}</b>. Type it here, or tap it in the email.
        </p>
      </div>
      <CodeCells value={code} shake={shake} busy={busy} onChange={(v) => { setCode(v); if (error && v) setError(''); }} />
      <p className={error ? 'form-error' : 'fine'} role="status">
        {error || (busy ? 'Checking the code' : 'It works for 10 minutes. No email? Look in Spam or Promotions.')}
      </p>
      <div className="more">
        <button type="button" className="btn ghost sm" onClick={onOther}>Use another email</button>
        <button
          type="button"
          className="btn ghost sm"
          disabled={wait > 0}
          onClick={async () => {
            setCode('');
            tried.current = '';
            setError('');
            await onResend();
          }}
        >
          {wait > 0 ? `New code in ${wait}s` : 'Send a new code'}
        </button>
      </div>
    </>
  );
}

/**
 * Six boxes on the board from the email. One real input sits over them, so the keyboard, paste,
 * Gmail's "Copy code" and the iPhone's code suggestion all just work.
 */
export function CodeCells({ value, onChange, busy, shake }: { value: string; onChange: (v: string) => void; busy?: boolean; shake?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  // Ready to type as soon as the code is on its way.
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <div className={`code-cells${shake ? ' shake' : ''}${busy ? ' busy' : ''}`} data-nodrag>
      <input
        ref={ref}
        aria-label="The 6-digit code"
        className="code-in"
        data-autofocus
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        readOnly={busy}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={i === Math.min(value.length, 5) ? 'cur' : ''} aria-hidden="true">{value[i] ?? ''}</span>
      ))}
    </div>
  );
}

/**
 * Google's button, drawn to Google's own rules for the dark style (#131314 fill, grey ring, the
 * Google mark on the left). The mark is Google's file, public/google-g.svg, from Google's
 * branding page; until it's there, the button shows its words alone.
 */
export function GoogleButton({ busy, disabled, onClick, label = 'Continue with Google' }: { busy?: boolean; disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" className="g-btn" disabled={disabled} onClick={onClick}>
      <img src="/google-g.svg" alt="" width={24} height={24} onError={(e) => { e.currentTarget.hidden = true; }} />
      <span>{busy ? 'Opening Google' : label}</span>
    </button>
  );
}

/** The other player, and what happens to the one on this phone. Used here, on the email link page and after Google. */
export function SwitchCard({ result, current, onSwitch, onKeep, title, lead }: {
  result: Switch;
  current: Profile | null;
  onSwitch: () => void;
  onKeep: () => void;
  title?: string;
  lead?: ReactNode;
}) {
  const p = result.profile;
  const via: Record<AuthVia, string> = { google: 'That Google account', email: 'That email' };
  return (
    <>
      <div>
        <h2>{title ?? `Switch to ${p.name}?`}</h2>
        <p className="fine">{lead ?? `${via[result.via]} already has a player.`}</p>
      </div>
      <div className="me-card switch-card">
        <Avatar avatar={p.avatar} print={p.print} size={48} />
        <div>
          <span className="kicker">Saved player</span>
          <b>{p.name}</b>
          <span><Icon id="i-aura" className="" />{levelInfo(p.aura).title}<Cowries n={p.cowries} compact /></span>
        </div>
      </div>
      {current && (
        <p className="fine">
          {current.saved
            ? `${current.name} is saved too, so you can sign back in to ${current.name} any time.`
            : `${current.name}, the player on this phone now, isn't saved. Switching leaves ${current.name} behind for good.`}
        </p>
      )}
      <button type="button" className="btn primary block" onClick={onSwitch}>Play as {p.name}</button>
      <button type="button" className="btn ghost block" onClick={onKeep}>{current ? `Keep ${current.name}` : 'Not now'}</button>
    </>
  );
}
