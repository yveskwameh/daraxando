-- No two players share a name (Yves, 17 October 2026; docs/NEXT-ROUND.md, step 2).
--
-- name_key is the name as it's compared: lower case, single spaces, accents off (nameKey in
-- worker/names.ts). A unique index on it means two players can never hold the same name, even
-- when two people pick it at the same moment.
--
-- name_set says whether the player chose their name:
--   0  not yet: the game picked it on the first screen. Asked after their first match.
--   1  they chose it.
--   2  the game changed it, because another player had it first. Asked next time they open Home.
ALTER TABLE players ADD COLUMN name_key TEXT;
ALTER TABLE players ADD COLUMN name_set INTEGER NOT NULL DEFAULT 0;

-- Everyone here before today picked or kept their name on the first screen.
UPDATE players SET name_set = 1;

-- Players who already share a name: the first to take it keeps it. The others get a number
-- (2, 3, ...) and are asked to pick a new name. The name is cut to fit the 16 letters.
UPDATE players
SET name = rtrim(substr(players.name, 1, 16 - 1 - length(d.n))) || ' ' || d.n,
    name_set = 2
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS n
  FROM players
) AS d
WHERE d.id = players.id AND d.n > 1;

-- SQLite's lower() only changes A to Z, which matches nameKey for every name typed without
-- accents. The server sets the full key whenever a name is set from now on.
UPDATE players SET name_key = lower(name);

-- A new numbered name that another player already had ("Tobi 2"): the player who had it keeps
-- it. The numbered one gets no key for now and is still asked to pick a new name, so the index
-- below can't fail.
UPDATE players
SET name_key = NULL, name_set = 2
WHERE EXISTS (
  SELECT 1 FROM players AS p
  WHERE p.name_key = players.name_key AND p.id <> players.id
    AND (p.name_set < players.name_set
      OR (p.name_set = players.name_set
        AND (p.created_at < players.created_at OR (p.created_at = players.created_at AND p.id < players.id))))
);

CREATE UNIQUE INDEX players_name_key ON players (name_key);
