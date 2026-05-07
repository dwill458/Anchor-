-- Backfill historical flagged_content rows that were incorrectly keyed by Firebase auth UID
UPDATE "flagged_content" AS fc
SET "userId" = u."id"
FROM "users" AS u
WHERE fc."userId" = u."authUid"
  AND fc."userId" <> u."id";

-- Remove orphaned rows that cannot be tied to a real user account anymore
DELETE FROM "flagged_content" AS fc
WHERE NOT EXISTS (
  SELECT 1
  FROM "users" AS u
  WHERE u."id" = fc."userId"
);

DELETE FROM "burned_anchors" AS ba
WHERE NOT EXISTS (
  SELECT 1
  FROM "users" AS u
  WHERE u."id" = ba."userId"
);

ALTER TABLE "burned_anchors"
ADD CONSTRAINT "burned_anchors_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "flagged_content"
ADD CONSTRAINT "flagged_content_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
