import { useEffect, useState } from 'react';

/**
 * Milliseconds left until `endsAt` (server time). Updates once per second, on the second,
 * plus exactly at zero, so the screen re-renders once a second rather than ten times.
 * Smooth visuals like the timer ring run in CSS instead. Null when there is no clock.
 */
export function useCountdown(endsAt: number | null, serverNow: () => number) {
  const [left, setLeft] = useState<number | null>(endsAt ? Math.max(0, endsAt - serverNow()) : null);

  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const ms = Math.max(0, endsAt - serverNow());
      setLeft(ms);
      if (ms > 0) timer = setTimeout(update, ms % 1000 || 1000);
    };
    update();
    return () => clearTimeout(timer);
  }, [endsAt, serverNow]);

  return left;
}
