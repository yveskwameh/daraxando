-- Safety (docs/BACKEND.md, milestone 4): the farming rules, bans, and the admin API's log.

-- The phone a player was made on, as a keyed hash of the app's own random device id (never
-- anything from the phone itself). Players made on the same phone never win seeds from each
-- other. Empty for players made before 16 October 2026.
ALTER TABLE players ADD COLUMN device TEXT;
-- For the admin API: other players made on the same phone.
CREATE INDEX players_by_device ON players (device) WHERE device IS NOT NULL;

-- A ban: no play against people, no Ranks or leagues. Baba Ayo still works. Set and lifted
-- through the admin API (worker/admin.ts).
ALTER TABLE players ADD COLUMN banned_at INTEGER;
ALTER TABLE players ADD COLUMN ban_reason TEXT;

-- 0 when a match's stakes went back instead of to the winner (same phone, the one-way cap,
-- or a quick quit). The one-way cap counts only matches where seeds really moved.
ALTER TABLE matches ADD COLUMN paid INTEGER NOT NULL DEFAULT 1;

-- Every change made through the admin API, so there's always an answer to "who did this?".
CREATE TABLE admin_actions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         INTEGER NOT NULL,
  action     TEXT NOT NULL,
  player_id  TEXT,
  detail     TEXT
);
CREATE INDEX admin_actions_by_player ON admin_actions (player_id, at);
CREATE INDEX admin_actions_by_time ON admin_actions (at);

-- Finding a player by name in the admin API.
CREATE INDEX players_by_name ON players (name COLLATE NOCASE);
