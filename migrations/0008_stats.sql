-- Game numbers (docs/BACKEND.md, milestone 6): what the 8 am report email and the admin API count.

-- One row per player per day they finished a match (Lagos days). The report's "played", Duolingo's
-- buckets (new, current, back after a break, at risk) and next-day and week returns come from here.
-- Written once a day per player, kept 400 days, removed with the account.
CREATE TABLE player_days (
  day        TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  PRIMARY KEY (day, player_id)
) WITHOUT ROWID;
CREATE INDEX player_days_by_player ON player_days (player_id, day);

-- Players who played before this table existed get their last day, so they don't all look new.
INSERT OR IGNORE INTO player_days (day, player_id)
  SELECT last_played_day, id FROM players WHERE last_played_day IS NOT NULL;

-- Daily counters, no player ids: matches by kind, mode and stake, Quick match waits, rooms made.
CREATE TABLE stat_days (
  day   TEXT NOT NULL,
  name  TEXT NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
) WITHOUT ROWID;

-- How a player's very first finished match went: win, loss or draw. 'before' for players who had
-- already played when this was added, so they never count as new.
ALTER TABLE players ADD COLUMN first_result TEXT;
UPDATE players SET first_result = 'before' WHERE last_played_day IS NOT NULL;

-- New players per day.
CREATE INDEX players_by_created ON players (created_at);
