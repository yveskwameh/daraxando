-- The daily habit layer (docs/RETENTION.md): the streak and what protects it, the streak
-- bet, daily quests, badges, weekly leagues and friend streaks.

-- Everything per player lives in one small JSON document (see shared/habits.ts), written with
-- a version number so two matches finishing at once can't overwrite each other.
ALTER TABLE players ADD COLUMN habits TEXT NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN habit_v INTEGER NOT NULL DEFAULT 0;

-- Existing streaks carry over: the day they last grew is the last day played.
UPDATE players SET habits = json_object('streakDay', last_played_day, 'best', day_streak)
WHERE last_played_day IS NOT NULL;

-- One row per player per week. Leagues are groups of up to 30 in the same tier.
CREATE TABLE league_entries (
  week       TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  tier       INTEGER NOT NULL,
  grp        TEXT NOT NULL,
  aura       INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (week, player_id)
);
CREATE INDEX league_by_group ON league_entries (grp, aura DESC);
CREATE INDEX league_open_groups ON league_entries (week, tier, grp);

-- Friend streaks: two players who each play a match on the same day keep it going.
-- a is always the smaller id, so a pair has one row. from_id asked; status is pending or active.
CREATE TABLE friend_streaks (
  a          TEXT NOT NULL,
  b          TEXT NOT NULL,
  from_id    TEXT NOT NULL,
  status     TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  last_day   TEXT,
  a_day      TEXT,
  b_day      TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
CREATE INDEX friend_streaks_by_b ON friend_streaks (b);

-- Recent opponents, for adding a friend streak with someone you've played.
CREATE INDEX matches_by_x ON matches (x_id, created_at);
CREATE INDEX matches_by_o ON matches (o_id, created_at);
