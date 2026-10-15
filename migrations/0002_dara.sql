-- Dara X&O. Players get a home state, a piece (their X & O) and a print. XP becomes Aura,
-- ranked games become quick matches, and Dara Cowries arrive for staking.

ALTER TABLE players RENAME COLUMN xp TO aura;
ALTER TABLE players RENAME COLUMN ranked_games TO quick_games;

ALTER TABLE players ADD COLUMN state TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE players ADD COLUMN piece TEXT NOT NULL DEFAULT 'drum';
ALTER TABLE players ADD COLUMN print TEXT NOT NULL DEFAULT 'line';
ALTER TABLE players ADD COLUMN cowries INTEGER NOT NULL DEFAULT 5000;
-- Matches won today, for the daily goal. Resets when last_played_day changes.
ALTER TABLE players ADD COLUMN day_wins INTEGER NOT NULL DEFAULT 0;
-- The last day the daily cowries were paid.
ALTER TABLE players ADD COLUMN daily_day TEXT;
-- When Sapa relief was last claimed.
ALTER TABLE players ADD COLUMN sapa_at INTEGER NOT NULL DEFAULT 0;
-- High-table losses in a row, and the end of the short break that follows three of them.
ALTER TABLE players ADD COLUMN big_losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN cool_until INTEGER NOT NULL DEFAULT 0;

-- The old avatars were emoji. Everyone starts again as the tortoise.
UPDATE players SET avatar = 'tortoise'
WHERE avatar NOT IN ('tortoise', 'spider', 'hare', 'hen', 'lizard', 'goat', 'elephant', 'hippo',
                     'crane', 'eagle', 'horse', 'fish', 'parrot', 'crocodile', 'camel', 'grasshopper');

-- Ranks has a tab per state. Same idea as players_by_rating: only people with a quick match.
CREATE INDEX players_by_state_rating ON players (state, rating DESC) WHERE quick_games > 0;

-- A match row is now a whole series.
ALTER TABLE matches ADD COLUMN kind TEXT NOT NULL DEFAULT 'quick';
ALTER TABLE matches ADD COLUMN stake INTEGER NOT NULL DEFAULT 0;
-- Games won by X and O, e.g. '3-1'.
ALTER TABLE matches ADD COLUMN score TEXT;

-- Every change to anyone's cowries, so a balance can always be explained:
-- start, daily, sapa, stake (taken at the start of a match), pot (won), refund (draw or cancelled).
CREATE TABLE ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   TEXT NOT NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  match_id    TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX ledger_by_player ON ledger (player_id, created_at);
