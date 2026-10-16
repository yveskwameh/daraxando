/**
 * The install suggestion: slides down from the top, over whatever is on screen, never part
 * of a layout. It goes away by itself after 12 seconds. When it comes back is up to the asks
 * (shared/asks.ts): 14 days after it's shown, then every 30.
 */
import { useEffect, useState } from 'react';
import { closeInstallPop, promptInstall, useInstallPop } from '../lib/install';
import { toast } from '../lib/toast';
import { InstallSheet } from '../sheets/InstallSheet';
import { Icon } from './art';

export function InstallPop() {
  const open = useInstallPop();
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(closeInstallPop, 12_000);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      {open && (
        <div className="install-pop" role="dialog" aria-label="Install Dara X&O">
          <img className="app-ic" src="/icons/icon-192.png" alt="" width={40} height={40} />
          <div>
            <b>Play Dara X&amp;O full screen</b>
            <span>Install it. No address bar, and it opens faster.</span>
          </div>
          <button
            type="button"
            className="mini-btn"
            onClick={async () => {
              closeInstallPop();
              if (!(await promptInstall())) setSteps(true);
            }}
          >
            Install
          </button>
          <button
            type="button"
            className="x-btn"
            aria-label="Not now"
            onClick={() => {
              closeInstallPop();
              toast('Okay. Install is always in You, then Settings.');
            }}
          >
            <Icon id="i-close" className="" />
          </button>
        </div>
      )}
      <InstallSheet open={steps} onClose={() => setSteps(false)} />
    </>
  );
}
