-- Ban reviews (docs/BACKEND.md, milestone 4, Yves 16 October 2026): a banned player asks for
-- their ban to be looked at again, and sees the answer in the app. Answered through the admin
-- API (worker/admin.ts): lifting the ban, or keeping it with a note the player reads.
CREATE TABLE appeals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  -- open, lifted (the ban was lifted) or kept (the ban stays, with a note)
  status      TEXT NOT NULL DEFAULT 'open',
  note        TEXT,
  decided_at  INTEGER
);
CREATE INDEX appeals_by_player ON appeals (player_id, created_at);
CREATE INDEX appeals_by_status ON appeals (status, created_at);
