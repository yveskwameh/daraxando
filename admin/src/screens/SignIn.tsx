// Signing in: paste the live admin key once. The dashboard keeps you signed in on this device
// for 14 days with a cookie only it can read, and never stores the key itself.
import { useState } from 'react';
import { api } from '../api.ts';
import { Button, Field } from '../ui.tsx';

export function SignIn({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = key.replace(/[^\x21-\x7e]/g, '');
    if (clean.length < 32) {
      setError('The admin key is at least 32 characters. Paste the whole key.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.signIn(clean);
      setKey('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="signin">
      <div className="signin-card">
        <div className="titled">
          <span className="wordmark lg">Dara<span className="tag">X&amp;O</span></span>
          <h1>Admin</h1>
          <p className="muted">Your game's numbers, players and ban reviews, for the live game and the test game.</p>
        </div>
        {ready ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="Live admin key" error={error} hint="It's in Passwords. You stay signed in on this device for 14 days.">
              <input
                className="input"
                type="password"
                name="key"
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                aria-invalid={!!error}
              />
            </Field>
            <Button type="submit" busy={busy} block>Sign in</Button>
          </form>
        ) : (
          <p className="notice">The dashboard has no live admin key yet. Add ADMIN_KEY_LIVE in Cloudflare (admin/README.md), then reload this page.</p>
        )}
      </div>
    </main>
  );
}
