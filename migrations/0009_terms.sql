-- What each player agreed to (shared/legal.ts): the version of the Terms of play and Privacy notice
-- shown when they tapped Play now, and when. Players made before this have none.
ALTER TABLE players ADD COLUMN terms_version TEXT;
ALTER TABLE players ADD COLUMN terms_at INTEGER;
