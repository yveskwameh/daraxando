-- Playing Baba Ayo without internet (shared/offline.ts, worker/offline.ts; Yves, 18 October 2026).
-- One row per one-use pass: whose it is, Baba Ayo's dice for the match played with it, when it
-- was given, how the games played with it ended so far (X, O, D or R per game), and when the
-- match was counted. Kept for 10 days (PASS_KEEP_DAYS), then deleted. The privacy notice lists it.
CREATE TABLE offline_passes (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  issued_at INTEGER NOT NULL,
  mode TEXT,
  level TEXT,
  starter TEXT,
  results TEXT NOT NULL DEFAULT '',
  used_at INTEGER
);
CREATE INDEX offline_passes_player ON offline_passes (player_id, issued_at);
CREATE INDEX offline_passes_issued ON offline_passes (issued_at);
