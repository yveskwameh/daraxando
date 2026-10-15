import { prefs, usePrefs } from '../lib/prefs';
import { toast } from '../lib/toast';
import { Icon } from './art';

/** The music switch in the header. Sound effects and vibration have their own in Settings. */
export function MusicToggle() {
  const { music } = usePrefs();
  return (
    <button
      type="button"
      className="icon-btn toggle"
      aria-label="Music"
      aria-pressed={music}
      onClick={() => {
        prefs.set({ music: !music });
        toast(music ? 'Music off' : 'Music on', 1400);
      }}
    >
      <Icon id="i-music" />
    </button>
  );
}
