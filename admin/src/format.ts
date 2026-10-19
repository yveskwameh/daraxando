// How numbers, days and times read on the dashboard. Days are Lagos days, as in the game.

export const fmt = (n: number) => n.toLocaleString('en-US');
export const pct = (share: number) => `${Math.round(share * 100)}%`;
export const share = (part: number, whole: number) => (whole ? part / whole : null);

export const lagosDay = (ms = Date.now()) => new Date(ms + 3_600_000).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
/** "Mon 13 Oct" */
export const shortDay = (day: string) => asDate(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "Monday" */
export const weekday = (day: string) => asDate(day).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
/** "Monday 13 October" */
export const longDay = (day: string) => asDate(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "13 Oct, 18:42", Lagos time */
export const when = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const secs = (s: number | null) => (s === null ? 'none' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`);

/** What a day is called on the dashboard: today, yesterday, or its date. */
export function dayName(day: string, today = lagosDay()) {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return shortDay(day);
}

/** When a player last played, from a Lagos day: "Today", "Yesterday", "3 days ago" or "12 Oct". */
export function lastPlayed(day: string | null | undefined, today = lagosDay()) {
  if (!day) return null;
  const n = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return `${n} days ago`;
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "26 Oct" in Lagos time, for when a timed ban ends. */
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
