-- Save your progress (docs/BACKEND.md, milestone 3). A guest player can link Google, an email,
-- or both, and then sign in to the same player on any phone. The player id never changes.

-- 1 once the player has Google or an email linked. Kept on the row so every profile read
-- knows it without another query.
ALTER TABLE players ADD COLUMN saved INTEGER NOT NULL DEFAULT 0;

-- How a player signs in. One Google account and one email per player.
--   provider 'google': subject is Google's id for the account (it never changes), email is
--                      the Google address, shown in Settings and used to find the player by email.
--   provider 'email':  subject and email are the address, in lower case.
CREATE TABLE identities (
  provider   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  email      TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX identities_by_player ON identities (player_id);
CREATE INDEX identities_by_email ON identities (email);

-- One row per code emailed. Only hashes of the code and of the link's secret are kept, so
-- this table is no use to anyone who reads it. Rows go after two days.
--   kind 'save': the guest in player_id is adding this email. 'signin': the email has a player.
--   result: what the code did, so the phone that asked can find out if the link was used instead.
CREATE TABLE email_codes (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  player_id   TEXT,
  code_hash   TEXT NOT NULL,
  link_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  result      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX email_codes_by_email ON email_codes (email, created_at);
CREATE INDEX email_codes_by_time ON email_codes (created_at);

-- A few minutes of memory for Google sign-in: what the phone asked for while the player is on
-- Google's page (kind 'google'), then the outcome waiting for the app to pick it up (kind 'result').
CREATE TABLE auth_handoffs (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  data       TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
