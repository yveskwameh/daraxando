-- Timed bans (Yves, 19 October 2026; the admin dashboard, admin/README.md): when a ban ends by
-- itself. NULL means it lasts until it's lifted. Off on the real game until the lawyer approves
-- the privacy notice line (docs/BANS-REVIEW.md), so there it stays NULL. An ended ban is lifted
-- the next time the player opens the game, or by the 8 am run (liftEndedBans in worker/db.ts).
ALTER TABLE players ADD COLUMN ban_until INTEGER;
