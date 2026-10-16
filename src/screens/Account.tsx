/**
 * The two ways into the app from outside it while signing in (server: worker/accounts.ts):
 *
 *  - CodeLink: the page the link in a code email opens (/c/…). Mail apps and scanners open links
 *    on their own, so nothing happens until the player taps the button.
 *  - AccountReturn: back from Google's page with #signin=… in the address. It collects what
 *    happened, says so, and asks before switching to another player.
 */
import { useEffect, useState } from 'react';
import type { AuthResult } from '../../shared/protocol';
import { Avatar, Icon, Wordmark } from '../components/art';
import { Sheet } from '../components/Sheet';
import { auth, shortEmail, type LinkPeek } from '../lib/auth';
import { buzz } from '../lib/haptics';
import type { Go } from '../lib/router';
import { useSession } from '../lib/session';
import { toast } from '../lib/toast';
import { SwitchCard } from '../sheets/SaveSheet';

type WithToken = Extract<AuthResult, { token: string }>;

/** Each Google outcome is collected once, even when React runs an effect twice while developing. */
const collecting = new Map<string, Promise<AuthResult>>();

export function AccountReturn() {
  const session = useSession();
  const { returning, token } = session;
  const [ask, setAsk] = useState<WithToken | null>(null);

  useEffect(() => {
    if (!returning) return;
    let live = true;
    let job = collecting.get(returning);
    if (!job) {
      job = auth.finish(token, returning).catch((err: Error) => ({ status: 'error', message: err.message }) as AuthResult);
      collecting.set(returning, job);
    }
    job.then((r) => {
      if (!live) return;
      switch (r.status) {
        case 'saved':
          session.setProfile(r.profile);
          buzz('win');
          toast.ok('Saved with Google. You can sign in on any phone.');
          break;
        case 'same':
          session.setProfile(r.profile);
          toast(`You're already playing as ${r.profile.name}.`);
          break;
        case 'signedin':
          buzz('win');
          session.signIn(r.token, r.profile);
          toast.ok(`Welcome back, ${r.profile.name}.`);
          break;
        case 'switch':
          setAsk(r);
          return;
        case 'none':
          toast.error(token ? 'No player uses that Google account yet.' : 'No player uses that Google account yet. Tap Play now to start.');
          break;
        case 'error':
          toast.error(r.message);
      }
      session.returned();
    });
    return () => { live = false; };
  }, [returning]); // once per trip to Google

  if (!ask) return null;
  const done = () => {
    setAsk(null);
    session.returned();
  };
  return (
    <Sheet open onClose={done} label="Switch players" closeButton={false}>
      <SwitchCard
        result={ask}
        current={session.profile}
        onSwitch={() => {
          buzz('win');
          session.signIn(ask.token, ask.profile);
          toast.ok(`You're now playing as ${ask.profile.name}.`);
          done();
        }}
        onKeep={done}
      />
    </Sheet>
  );
}

export function CodeLink({ link, go }: { link: string; go: Go }) {
  const session = useSession();
  const [peek, setPeek] = useState<LinkPeek | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<WithToken | null>(null);

  useEffect(() => {
    let live = true;
    auth.peekLink(session.token, link).then((p) => live && setPeek(p), (err: Error) => live && setError(err.message));
    return () => { live = false; };
  }, [link]); // the player on this phone doesn't change what the link is

  const home = () => go({ name: 'home' }, { replace: true });

  const use = async () => {
    if (busy || !peek) return;
    setBusy(true);
    setError('');
    buzz('tap');
    try {
      const r = await auth.emailLink(session.token, link);
      const name = peek.player?.name ?? 'your player';
      switch (r.status) {
        case 'saved':
          session.setProfile(r.profile);
          buzz('win');
          toast.ok('Saved. You can sign in on any phone.');
          return home();
        case 'same':
          toast(`You're already playing as ${r.profile.name}.`);
          return home();
        case 'signedin':
          buzz('win');
          session.signIn(r.token, r.profile);
          toast.ok(peek.kind === 'save' ? `Saved. You're playing as ${name} here too.` : `Welcome back, ${name}.`);
          return home();
        case 'switch':
          setAsk(r);
          setBusy(false);
          return;
        default:
          setError(r.status === 'error' ? r.message : 'That did not work. Ask for a new code in Dara X&O.');
          setBusy(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  // Nothing to show yet.
  if (!peek && !error) {
    return (
      <main className="screen center" aria-busy="true">
        <div className="loader" aria-hidden="true"><span /><span /><span /></div>
        <p className="sr">Loading</p>
      </main>
    );
  }

  // A link that doesn't work, or one that already did its job.
  if (!peek || peek.state !== 'ready') {
    const used = peek?.state === 'used';
    return (
      <main className="screen center link-page">
        <div className="empty">
          <Icon id={used ? 'i-check' : 'i-lock'} className="big" />
          <h2>{used ? 'This link was used' : peek ? 'This link has run out' : "This link doesn't work"}</h2>
          <p>{used ? 'Each code works once. If you still need to sign in, ask for a new code in Dara X&O.' : error || 'Codes work for 10 minutes. Ask for a new one in Dara X&O.'}</p>
          <button type="button" className="btn primary lg" onClick={home}>Open Dara X&amp;O</button>
        </div>
      </main>
    );
  }

  const p = peek.player;
  const save = peek.kind === 'save';
  return (
    <main className="screen onb link-page" aria-label={save ? 'Save your progress' : 'Sign in'}>
      <div className="onb-head"><Wordmark /></div>
      {ask ? (
        <div className="link-ask">
          <SwitchCard
            result={ask}
            current={session.profile}
            title={save ? `Saved. Play as ${ask.profile.name} here?` : undefined}
            lead={save ? `${shortEmail(peek.email)} now keeps ${ask.profile.name}'s progress safe.` : undefined}
            onSwitch={() => {
              buzz('win');
              session.signIn(ask.token, ask.profile);
              toast.ok(`You're now playing as ${ask.profile.name}.`);
              home();
            }}
            onKeep={home}
          />
        </div>
      ) : (
        <>
          <div className="link-card">
            {p && <Avatar avatar={p.avatar} print={p.print} size={88} />}
            <span className="kicker">{save ? 'Save your progress' : 'Sign in'}</span>
            <h2>{save ? `Save ${p?.name ?? 'your'} player` : `Sign in as ${p?.name ?? 'your player'}`}</h2>
            <p>
              {save
                ? <>Link <b>{shortEmail(peek.email)}</b> to {p?.name ?? 'your player'}, so the seeds, title and streak follow you to any phone.</>
                : <><b>{shortEmail(peek.email)}</b> is saved with {p?.name ?? 'a player'}. Tap below to play as {p?.name ?? 'them'} here.</>}
            </p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className="btn primary block lg" disabled={busy} onClick={use}>
            {busy ? 'One moment' : save ? 'Save my progress' : `Play as ${p?.name ?? 'my player'}`}
          </button>
          <button type="button" className="btn ghost block" onClick={home}>Not now</button>
        </>
      )}
    </main>
  );
}
