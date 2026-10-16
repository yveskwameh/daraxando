/**
 * Game numbers (docs/BACKEND.md, milestone 6): the daily counters behind the 8 am report email
 * (worker/report.ts) and the admin API. Counters hold no player ids. Who played on which day is in
 * `player_days`, written by recordSeries in worker/db.ts.
 *
 * Every count is one upsert on a row that already exists after the first time each day, so it adds
 * one database write to something that writes anyway (a finished match, a pairing, a new room).
 */
import type { Kind } from '../shared/progression';

/** One counter, added to by `by`. Goes in the same batch as the change it counts, where there is one. */
export const bump = (db: D1Database, day: string, name: string, by = 1) =>
  db.prepare('INSERT INTO stat_days (day, name, n) VALUES (?1, ?2, ?3) ON CONFLICT (day, name) DO UPDATE SET n = n + ?3').bind(day, name, by);

/** A finished match: kind, mode and stake in one counter, so a match costs one write. */
export const matchStat = (kind: Kind, mode: string, stake: number) => `m:${kind}:${mode}:${stake}`;

/** Quick match waits, in buckets that read well in an email. The number is where each starts, in seconds. */
export const WAIT_BUCKETS = [0, 10, 30, 60, 120] as const;
export const waitBucket = (ms: number) => {
  const s = ms / 1000;
  let b: number = WAIT_BUCKETS[0];
  for (const x of WAIT_BUCKETS) if (s >= x) b = x;
  return b;
};

/** Counter names, in one place so the report reads exactly what the game writes. */
export const STAT = {
  /** Someone who started their own game met a person; one per player, by how long they waited. */
  paired: (bucket: number) => `qm:paired:${bucket}`,
  pairedMs: 'qm:paired:ms',
  /** Someone who started their own game left before anyone came (took Baba Ayo, changed their mind, closed the app). */
  left: (bucket: number) => `qm:left:${bucket}`,
  leftMs: 'qm:left:ms',
  /** Joined a waiting game from the Quick match list. */
  joined: 'qm:joined',
  /** Tried to join from the list, but someone else got there first or it closed. */
  joinMissed: 'qm:join-missed',
  /** Friend rooms made. Friend matches played are `m:friend:*`. */
  roomMade: 'room:made',
  /** Set once the report for a day has gone out, so a retried run doesn't send it twice. */
  reportSent: 'report:sent',
} as const;
