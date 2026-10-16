-- Notifications (docs/BACKEND.md, milestone 5): one row per phone that turned them on. The
-- endpoint is the address the phone's push service gave it; p256dh and auth are the phone's
-- public keys, which the server uses to encrypt each message so only that phone can read it.
CREATE TABLE push_subs (
  endpoint      TEXT PRIMARY KEY,
  player_id     TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  -- What this phone wants: the 7 pm streak reminder, and a friend joining your room.
  streak        INTEGER NOT NULL DEFAULT 1,
  friends       INTEGER NOT NULL DEFAULT 1,
  -- The day (Lagos time) this phone last got the streak reminder, so it gets at most one a day.
  reminded_day  TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX push_subs_by_player ON push_subs (player_id);
CREATE INDEX push_subs_streak ON push_subs (streak, reminded_day);
