-- Recover historical userId inconsistencies before adding FK constraints.
-- This migration must be safe to retry in production where some tables may
-- not exist yet and where the migration may have partially applied before.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'flagged_content'
  ) THEN
    -- Backfill rows that were incorrectly keyed by Firebase auth UID.
    UPDATE "flagged_content" AS fc
    SET "userId" = u."id"
    FROM "users" AS u
    WHERE fc."userId" = u."authUid"
      AND fc."userId" <> u."id";

    -- Remove orphaned rows that can no longer be matched to a user.
    DELETE FROM "flagged_content" AS fc
    WHERE NOT EXISTS (
      SELECT 1
      FROM "users" AS u
      WHERE u."id" = fc."userId"
    );

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'flagged_content'
        AND constraint_name = 'flagged_content_userId_fkey'
    ) THEN
      ALTER TABLE "flagged_content"
      ADD CONSTRAINT "flagged_content_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'burned_anchors'
  ) THEN
    DELETE FROM "burned_anchors" AS ba
    WHERE NOT EXISTS (
      SELECT 1
      FROM "users" AS u
      WHERE u."id" = ba."userId"
    );

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'burned_anchors'
        AND constraint_name = 'burned_anchors_userId_fkey'
    ) THEN
      ALTER TABLE "burned_anchors"
      ADD CONSTRAINT "burned_anchors_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
