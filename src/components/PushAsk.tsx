import { useState } from 'react';
import { pushPrefs, setPush, type PushKind } from '../lib/push';
import { toast } from '../lib/toast';
import { Icon } from './art';

const DONE: Record<PushKind, string> = {
  streak: 'Streak reminders are on.',
  friends: "Done. We'll tell you when your friend joins.",
};

/**
 * Asks to turn on one kind of notification, at the moment it matters (src/lib/push.ts): over
 * the top of the screen like the install pop-up. "Turn on" opens the phone's own permission box.
 */
export function PushAsk({ kind, title, line, token, onDone }: { kind: PushKind; title: string; line: string; token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const turnOn = async () => {
    setBusy(true);
    const r = await setPush(token, { ...pushPrefs(), [kind]: true }, kind === 'streak' ? 'streak-ask' : 'friends-ask');
    if (r.ok) toast.ok(DONE[kind]);
    else if (r.why === 'blocked') toast.error("Notifications are blocked. Allow them in your phone's settings.");
    else if (r.why === 'unsupported') toast.error("This phone can't show notifications here.");
    else toast.error(r.message ?? "That didn't work. Try again from Settings.");
    onDone();
  };
  return (
    <div className="install-pop push-pop" role="alertdialog" aria-label={title}>
      <span className="push-ic"><Icon id="i-bell" className="" /></span>
      <div><b>{title}</b><span>{line}</span></div>
      <button type="button" className="mini-btn" disabled={busy} onClick={turnOn}>Turn on</button>
      <button type="button" className="x-btn" aria-label="Not now" onClick={onDone}><Icon id="i-close" className="" /></button>
    </div>
  );
}
