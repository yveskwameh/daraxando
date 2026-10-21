-- Every phone a player has used (worker/phones.ts, docs/PHONES-REVIEW.md), as the same keyed hash
-- of the app's random phone id that players.device already keeps. Two players who have been on
-- the same phone are linked: staked wins between them send both stakes back, and the admin
-- dashboard shows them together.
--
-- how: 'made'   the player was made on this phone (what players.device has always kept)
--      'signin' the phone signed in to the player with Google or an email code
--      'seen'   the player opened the game on this phone some other way
-- first_at: when the phone was first linked. last_at: when it was last used, updated at most
-- once a day. Links other than 'made' go after 400 days unused (the 8 am run), and every link
-- goes with the player.
CREATE TABLE player_phones (
  player_id TEXT NOT NULL,
  phone     TEXT NOT NULL,
  how       TEXT NOT NULL,
  first_at  INTEGER NOT NULL,
  last_at   INTEGER NOT NULL,
  PRIMARY KEY (player_id, phone)
);
CREATE INDEX player_phones_by_phone ON player_phones (phone, first_at);

-- The phone each existing player was made on, which the game already keeps.
INSERT OR IGNORE INTO player_phones (player_id, phone, how, first_at, last_at)
  SELECT id, device, 'made', created_at, created_at FROM players WHERE device IS NOT NULL;
