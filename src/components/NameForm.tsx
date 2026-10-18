/**
 * Picking your name, on You and in the "What should we call you?" sheet. No two players share a
 * name (Yves, 17 October 2026), so it checks as you type: "Available", or why not, with names
 * nobody has to tap instead. The server checks again when you save, in case someone took it
 * in between.
 */
import { useEffect, useRef, useState } from 'react';
import { cleanName, NAME_MAX, NAME_MIN, NAME_RULE, nameChars } from '../../shared/protocol';
import { api, ApiError } from '../lib/api';
import { buzz } from '../lib/haptics';
import { suggestNames } from '../lib/names';
import { usePlayer } from '../lib/session';
import { Icon } from './art';

type Status = { kind: 'idle' | 'checking' | 'ok' | 'mine' } | { kind: 'no'; message: string };

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

interface Props {
  /** The id of the field, for its label. */
  id: string;
  /** What the main button says. */
  submit: string;
  /** Called with the saved name, once the server has it. */
  onSaved: (name: string) => void;
  /** Shows a Cancel button. */
  onCancel?: () => void;
  /**
   * In the name sheet: saving the name you already have confirms it, and the button is the
   * sheet's one big button.
   */
  sheet?: boolean;
}

export function NameForm({ id, submit, onSaved, onCancel, sheet }: Props) {
  const { token, profile, setProfile } = usePlayer();
  const current = profile.name;
  const [value, setValue] = useState(current);
  const [ideas, setIdeas] = useState<string[]>(() => suggestNames(3, current));
  const [status, setStatus] = useState<Status>({ kind: 'mine' });
  const [busy, setBusy] = useState(false);
  const asked = useRef(0);
  const clean = cleanName(value);

  // Ideas nobody has yet, from the server.
  const moreIdeas = () => {
    api.nameIdeas(token).then((r) => r.ideas.length && setIdeas(r.ideas.slice(0, 3)), () => {});
  };
  useEffect(moreIdeas, [token]);

  // Check as you type, a moment after the last key.
  useEffect(() => {
    const n = ++asked.current;
    if (!clean) {
      setStatus(value.trim() ? { kind: 'no', message: NAME_RULE } : { kind: 'idle' });
      return;
    }
    if (same(clean, current)) {
      setStatus({ kind: 'mine' });
      return;
    }
    setStatus({ kind: 'checking' });
    const t = setTimeout(() => {
      api.checkName(token, clean).then(
        (r) => {
          if (n !== asked.current) return;
          setStatus(r.ok ? { kind: 'ok' } : { kind: 'no', message: r.message ?? 'Pick another name.' });
          if (r.ideas?.length) setIdeas(r.ideas);
        },
        // Offline or busy: say nothing now. Saving checks again.
        () => n === asked.current && setStatus({ kind: 'idle' }),
      );
    }, 450);
    return () => clearTimeout(t);
  }, [clean, value, current, token]);

  const canSave = !!clean && !busy && status.kind !== 'no' && status.kind !== 'checking' && (sheet || clean !== current);

  const save = async () => {
    if (!clean || !canSave) {
      buzz('invalid');
      return;
    }
    setBusy(true);
    try {
      const r = await api.updateMe(token, { name: clean });
      setProfile(r.profile);
      buzz('tap');
      onSaved(r.profile.name);
    } catch (err) {
      buzz('invalid');
      setStatus({ kind: 'no', message: (err as Error).message });
      if (err instanceof ApiError && err.ideas?.length) setIdeas(err.ideas);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={sheet ? 'name-form in-sheet' : 'edit name-form'}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="sr" htmlFor={id}>Your name</label>
      <input
        id={id}
        className="text-in"
        value={value}
        maxLength={NAME_MAX}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        data-autofocus
        aria-describedby={`${id}-status`}
        aria-invalid={status.kind === 'no'}
        onChange={(e) => setValue(nameChars(e.target.value))}
      />
      <p id={`${id}-status`} className={`name-status ${status.kind}`} role="status" aria-live="polite">
        {status.kind === 'ok' && <><Icon id="i-check" className="" />Available</>}
        {status.kind === 'mine' && (same(value.trim(), current) ? 'Your name now' : '')}
        {status.kind === 'checking' && 'Checking'}
        {status.kind === 'no' && status.message}
        {status.kind === 'idle' && `${NAME_MIN} to ${NAME_MAX} letters or numbers`}
      </p>
      <div className="chips-row" role="group" aria-label="Name ideas">
        {ideas.map((n) => (
          <button key={n} type="button" aria-pressed={n === value} onClick={() => setValue(n)}>{n}</button>
        ))}
        <button type="button" aria-label="More name ideas" onClick={moreIdeas}>
          <Icon id="i-shuffle" className="" style={{ width: 16, height: 16, verticalAlign: -3 }} />
        </button>
      </div>
      {sheet ? (
        <div className="actions">
          <button type="submit" className="btn primary block" disabled={!canSave}>{busy ? 'Saving' : submit}</button>
        </div>
      ) : (
        <div className="edit-row">
          {onCancel && <button type="button" className="mini-btn ghost" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="mini-btn" disabled={!canSave}>{busy ? 'Saving' : submit}</button>
        </div>
      )}
    </form>
  );
}
