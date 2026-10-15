/** Step-by-step install directions for browsers without a one-tap install prompt. */
import { Icon } from '../components/art';
import { Sheet } from '../components/Sheet';
import { isIOS, isOperaMini } from '../lib/device';

export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Install Dara X&O" closeButton={false}>
      {isOperaMini ? (
        <>
          <h2>Open in Chrome to play</h2>
          <p className="muted">Opera Mini's data-saving mode can't run live games. Copy the link and open it in Chrome or Opera.</p>
        </>
      ) : isIOS ? (
        <>
          <h2>Add Dara X&amp;O to your iPhone</h2>
          <ol className="steps">
            <li><span>Tap <Icon id="i-dots" className="" /> next to the address bar, or <Icon id="i-share" className="" /> at the bottom.</span></li>
            <li><span>Tap <b>Share</b>.</span></li>
            <li><span>Tap <b>Add to Home Screen</b>. If you can't see it, tap <b>View More</b> first.</span></li>
            <li><span>Leave <b>Open as Web App</b> on.</span></li>
            <li><span>Tap <b>Add</b>. Open it from your home screen to play full screen.</span></li>
          </ol>
        </>
      ) : (
        <>
          <h2>Install Dara X&amp;O</h2>
          <ol className="steps">
            <li><span>Tap <Icon id="i-vdots" className="" /> at the top right of your browser.</span></li>
            <li><span>Tap <b>Add to Home screen</b> or <b>Install app</b>.</span></li>
            <li><span>Tap <b>Install</b>. It opens without the address bar.</span></li>
          </ol>
        </>
      )}
      <button type="button" className="btn cream block" onClick={onClose}>Got it</button>
    </Sheet>
  );
}
