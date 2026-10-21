import { useEffect, useState } from 'react';

/**
 * On computers and tablets, the game sits inside a drawn iPhone 17 (Yves, 21 October 2026, from the
 * approved prototype docs/phone-frame-prototype.html): a black frame, the camera pill, a status bar
 * with the real time, and the home bar. Phones never get it: there the game stays full screen.
 * The sizes and every layer that has to stay inside the screen (sheets, the message bar, the
 * full-screen moments) are in src/styles/app.css, "Phone frame".
 */
export const FRAME_QUERY = '(min-width: 640px) and (min-height: 640px)';

const clock = () => {
  const d = new Date();
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function PhoneFrame() {
  const [on, setOn] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(FRAME_QUERY).matches);
  const [time, setTime] = useState(clock);

  useEffect(() => {
    const mq = matchMedia(FRAME_QUERY);
    const change = () => setOn(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);

  // The status bar's time, checked every 15 seconds and only while the frame shows.
  useEffect(() => {
    if (!on) return;
    setTime(clock());
    const t = window.setInterval(() => setTime(clock()), 15_000);
    return () => window.clearInterval(t);
  }, [on]);

  if (!on) return null;
  return (
    <div className="phone" aria-hidden="true">
      <span className="ph-btn l action" />
      <span className="ph-btn l up" />
      <span className="ph-btn l down" />
      <span className="ph-btn r power" />
      <div className="ph-status">
        <span className="ph-time">{time}</span>
        <span className="ph-icons">
          <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z" /><path d="M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0z" /><path d="M1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.4 1.4a7.6 7.6 0 0 0-10.8 0z" /></svg>
          <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="20" height="9" rx="2" /><rect x="25" y="4.5" width="1.6" height="4" rx=".8" opacity=".45" /></svg>
        </span>
      </div>
      <span className="ph-island" />
      <span className="ph-home" />
    </div>
  );
}
