-- Player codes (worker/codes.ts, docs/CODES-REVIEW.md).
--
-- code_hash: a keyed hash of the player's 16-character code, to find the player when it's typed.
-- code_box:  the code itself, encrypted with the server's secret, so a phone already signed in as
--            the player can show it again in Settings. Nobody reads it in the database.
-- code_at:   when the code was made (a new code replaces the old one, which stops working).
-- code_used_at, code_used_phone: the last time the code opened the player on a phone, and that
--            phone's keyed hash (the same hash as player_phones), so the player's other phones can
--            say "Tunde was opened on another phone".
-- login_v:   the sign-in version. Logins carry it, and "Not me" or a recovery raises it, which
--            signs out every other phone.
ALTER TABLE players ADD COLUMN code_hash TEXT;
ALTER TABLE players ADD COLUMN code_box TEXT;
ALTER TABLE players ADD COLUMN code_at INTEGER;
ALTER TABLE players ADD COLUMN code_used_at INTEGER;
ALTER TABLE players ADD COLUMN code_used_phone TEXT;
ALTER TABLE players ADD COLUMN login_v INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX players_by_code ON players (code_hash) WHERE code_hash IS NOT NULL;

-- "Lost your code? Ask us to help": a request from a phone, answered by Yves in the admin
-- dashboard. Approved requests wait 24 hours, while the player's phones show a warning with
-- Stop, then move the player to the asking phone with a new code. Requests go 30 days after
-- they're settled (the 8 am run), and with the player.
--
-- phone:   the asking phone's keyed hash.
-- secret_hash: a keyed hash of the secret only the asking phone holds, to collect the answer.
-- answers: the form, as JSON (worker/codes.ts, `RecoveryAnswers` in shared/codes.ts).
-- state:   open, waiting (given back, in the 24 hours), refused, stopped (the player tapped Stop) or done.
CREATE TABLE recoveries (
  id          TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  answers     TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open',
  note        TEXT,
  created_at  INTEGER NOT NULL,
  decided_at  INTEGER,
  due_at      INTEGER
);
CREATE INDEX recoveries_by_state ON recoveries (state, created_at);
CREATE INDEX recoveries_by_player ON recoveries (player_id, state);
CREATE INDEX recoveries_by_phone ON recoveries (phone, created_at);
