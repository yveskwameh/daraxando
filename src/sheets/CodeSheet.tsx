/**
 * Your player code (shared/codes.ts, docs/accounts-prototype.html "Saving your player").
 *
 * The QR code and the 16 characters, with every way to keep them: Save image (the main button),
 * Copy, Share to myself, then I saved it. Any of them counts as saving your progress. Opened by
 * the save ask on Home, by Save on You, and from Settings, where Get a new code replaces I saved
 * it. `given` shows a code the player was just handed: a new one after Not me, or after a
 * recovery brought them back.
 */
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/art';
import { Sheet } from '../components/Sheet';
import { copyText } from '../lib/clipboard';
import { drawCard, qrPath, savePicture, shareCode } from '../lib/codeArt';
import { codeApi } from '../lib/codes';
import { buzz } from '../lib/haptics';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 'ask': the save ask on Home (counted in the 8 am email). 'settings': shows Get a new code. */
  from?: 'ask' | 'settings';
  given?: { code: string; title: string; lead: string };
}

export default function CodeSheet({ open, onClose, from, given }: Props) {
  const { token, profile, setProfile } = usePlayer();
  const [code, setCode] = useState<string | null>(given?.code ?? null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'show' | 'renew'>('show');
  const [busy, setBusy] = useState<'' | 'image' | 'renew'>('');
  const kept = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep('show');
    setError('');
    kept.current = false;
    if (given) {
      setCode(given.code);
      return;
    }
    let live = true;
    codeApi.mine(token).then((r) => live && setCode(r.code), (err: Error) => live && setError(err.message));
    return () => { live = false; };
  }, [open, given, token]);

  /** Saving it any way at all counts as saving your progress. Once per open. */
  const keep = () => {
    if (kept.current || profile.saved) return;
    kept.current = true;
    codeApi.kept(token, from === 'ask' ? 'ask' : undefined).then((r) => setProfile(r.profile), () => { kept.current = false; });
  };

  const image = async () => {
    if (!code || busy) return;
    setBusy('image');
    buzz('tap');
    const blob = await drawCard(code, profile.name, profile.avatar);
    const r = blob ? await savePicture(blob, profile.name) : 'failed';
    setBusy('');
    if (r === 'failed') return toast.error("Couldn't save the picture. Copy the code instead.");
    if (r === 'cancelled') return;
    keep();
    if (r === 'saved') toast.ok('Picture saved to your phone.');
  };

  const copy = async () => {
    if (!code) return;
    if (await copyText(code)) {
      keep();
      buzz('tap');
      toast.ok('Code copied. Paste it somewhere only you can see.');
    } else toast.error("Couldn't copy. Write the code down instead.");
  };

  const share = async () => {
    if (!code) return;
    const r = await shareCode(code);
    if (r === 'shared' || r === 'copied') keep();
    if (r === 'copied') toast.ok('Copied. Paste it in a note or a chat to yourself.');
    if (r === 'failed') toast.error("Couldn't share. Copy the code instead.");
  };

  const done = () => {
    keep();
    buzz('win');
    toast.ok('Saved. Your code is in Settings if you need it again.');
    onClose();
  };

  const renew = async () => {
    if (busy) return;
    setBusy('renew');
    try {
      const r = await codeApi.renew(token);
      setCode(r.code);
      setStep('show');
      toast.ok('New code made. Save it: the old one no longer works.');
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy('');
  };

  const qr = code ? qrPath(code) : null;
  const title = given?.title ?? (from === 'settings' ? 'Your player code' : `Keep ${profile.name} on any phone`);

  return (
    <Sheet open={open} onClose={onClose} label={step === 'renew' ? 'Get a new code' : title} closeButton={step === 'show' && !given}>
      {step === 'show' ? (
        <>
          <div className="scroll code-scroll">
          <div className="titled center">
            <h2>{title}</h2>
            <p className="fine">{given?.lead ?? `Type it on any phone to play as ${profile.name}, or scan it from that phone's camera.`}</p>
          </div>
          <div className="code-card" aria-busy={!code || undefined}>
            <span className="qr">
              {qr ? (
                <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code of your player code" shapeRendering="crispEdges"><path d={qr.d} /></svg>
              ) : (
                <Avatar avatar={profile.avatar} print={profile.print} size={64} />
              )}
            </span>
            <span className="code-big" aria-live="polite">{code ?? (error ? '' : 'Making your code')}</span>
            {error ? <p className="form-error" role="alert">{error}</p> : <span className="fine">Keep it to yourself: anyone with it can play as you.</span>}
          </div>
          </div>
          <div className="actions">
            <button type="button" className="btn primary block" disabled={!code || !!busy} onClick={image}>{busy === 'image' ? 'Making the picture' : 'Save image'}</button>
            <div className="more">
              <button type="button" className="btn ghost sm" disabled={!code} onClick={copy}>Copy</button>
              <button type="button" className="btn ghost sm" disabled={!code} onClick={share}>Share to myself</button>
            </div>
            {from === 'settings' && !given ? (
              <button type="button" className="btn ghost block" disabled={!code} onClick={() => setStep('renew')}>Get a new code</button>
            ) : (
              <button type="button" className="btn ghost block" disabled={!code} onClick={done}>I saved it</button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="titled">
            <h2>Get a new code?</h2>
            <p className="fine">Your old code stops working straight away, on paper and in pictures. Phones signed in as {profile.name} stay signed in.</p>
          </div>
          <div className="actions">
            <button type="button" className="btn primary block" disabled={!!busy} onClick={renew}>{busy === 'renew' ? 'Making a new code' : 'Get a new code'}</button>
            <button type="button" className="btn ghost block" onClick={() => setStep('show')}>Keep my code</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
