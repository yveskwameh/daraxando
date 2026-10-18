/**
 * The terms changed in a way that matters (shared/legal.ts), so an existing player accepts the
 * new version before they keep playing, as the terms promise ("Changes to these terms"). It
 * says what changed in plain words, opens both texts in a sheet, and records the version and
 * the time on the server, like Play now does for a new player. Shown instead of any screen
 * until they accept; the legal pages and sign-in links still open. Lawyer approved the
 * 18 October 2026 changes the same day.
 */
import { useState } from 'react';
import { TERMS_CHANGES, TERMS_VERSION } from '../../shared/legal';
import { Avatar } from '../components/art';
import { LegalLink } from '../components/LegalLink';
import { api } from '../lib/api';
import { buzz } from '../lib/haptics';
import { usePlayer } from '../lib/session';
import { toast } from '../lib/toast';

/** "2026-10-18" as "18 October 2026". */
const longDate = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function TermsUpdate() {
  const { token, setProfile } = usePlayer();
  const [busy, setBusy] = useState(false);
  const changes = TERMS_CHANGES[TERMS_VERSION] ?? [];

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.acceptTerms(token, TERMS_VERSION);
      buzz('tap');
      setProfile(r.profile);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="screen terms-update" aria-label="Updated terms">
      <div className="tu-head">
        <Avatar avatar="baba" size={64} />
        <div className="titled">
          <h2>We updated our terms</h2>
          <p className="muted">What changed on {longDate(TERMS_VERSION)}:</p>
        </div>
      </div>
      <ul className="tu-changes">
        {changes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <p className="fine">
        Read the <LegalLink doc="terms">Terms of play</LegalLink> and the <LegalLink doc="privacy">Privacy notice</LegalLink>.
      </p>
      <div className="actions">
        <p className="fine">By tapping Accept and play, you agree to the new Terms of play and have read the Privacy notice.</p>
        <button type="button" className="btn primary block lg" disabled={busy} onClick={() => void accept()}>
          {busy ? 'Saving' : 'Accept and play'}
        </button>
      </div>
    </main>
  );
}
