-- Game controls (shared/controls.ts, worker/controls.ts, docs/controls-prototype.html).
--
-- switches_off: a part of the game Yves turned off in the dashboard, since when and why (only he
--               sees the reason). No row means it's on. Every change is also in admin_actions.
CREATE TABLE switches_off (
  id      TEXT PRIMARY KEY,
  since   INTEGER NOT NULL,
  reason  TEXT
);

-- announcements: one line at the top of Home, shown once per phone between starts_at and ends_at.
--                Never two at the same time. Past ones are kept 30 days for the dashboard's list.
CREATE TABLE announcements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT NOT NULL,
  action      TEXT,
  starts_at   INTEGER NOT NULL,
  ends_at     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  stopped_at  INTEGER
);
CREATE INDEX announcements_by_end ON announcements (ends_at);

-- news: "News from Dara X&O" notifications (docs/NEWS-REVIEW.md, approved 21 October 2026), sent
--       only to phones that turned news on. At most 4 in 30 days. Nothing about players is kept here.
CREATE TABLE news (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  phones      INTEGER NOT NULL DEFAULT 0,
  sent        INTEGER NOT NULL DEFAULT 0,
  done_at     INTEGER
);

-- A third notification setting, off until the player turns it on, and the last news each phone
-- got, so a retried batch never sends twice.
ALTER TABLE push_subs ADD COLUMN news INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_subs ADD COLUMN news_id INTEGER;
CREATE INDEX push_subs_news ON push_subs (news, news_id);
