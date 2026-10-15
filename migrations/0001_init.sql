-- Players and finished matches. Live match state never touches this database: it lives in
-- the match's Durable Object while the game is on, and only the result is written here.

CREATE TABLE players (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  avatar           TEXT NOT NULL,
  rating           INTEGER NOT NULL DEFAULT 1000,
  xp               INTEGER NOT NULL DEFAULT 0,
  wins             INTEGER NOT NULL DEFAULT 0,
  losses           INTEGER NOT NULL DEFAULT 0,
  draws            INTEGER NOT NULL DEFAULT 0,
  ranked_games     INTEGER NOT NULL DEFAULT 0,
  win_streak       INTEGER NOT NULL DEFAULT 0,
  best_win_streak  INTEGER NOT NULL DEFAULT 0,
  day_streak       INTEGER NOT NULL DEFAULT 0,
  last_played_day  TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

-- The leaderboard only ranks people who have played a ranked game, so the index only
-- holds them. Smaller index, and the top 50 is a 50-row read.
CREATE INDEX players_by_rating ON players (rating DESC) WHERE ranked_games > 0;

CREATE TABLE matches (
  id          TEXT PRIMARY KEY,
  mode        TEXT NOT NULL,
  x_id        TEXT NOT NULL,
  o_id        TEXT NOT NULL,
  winner      TEXT,            -- 'X', 'O', or NULL for a draw
  reason      TEXT NOT NULL,   -- line, draw, timeout, resign, abandon
  moves       TEXT NOT NULL,   -- squares in play order, e.g. '40862'
  created_at  INTEGER NOT NULL
);
