-- Diagnose and repair orphaned rows before adding FK constraints.
-- This must be safe on production schemas where either table may be missing
-- and where part of the work may already have run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'burned_anchors'
  ) THEN
    CREATE TEMP TABLE orphaned_burned_anchors AS
    SELECT ba.id, ba."userId"
    FROM "burned_anchors" ba
    WHERE NOT EXISTS (
      SELECT 1 FROM "users" u WHERE u."id" = ba."userId"
    );

    DELETE FROM "burned_anchors"
    WHERE id IN (SELECT id FROM orphaned_burned_anchors);

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'flagged_content'
  ) THEN
    CREATE TEMP TABLE orphaned_flagged_content AS
    SELECT fc.id, fc."userId"
    FROM "flagged_content" fc
    WHERE NOT EXISTS (
      SELECT 1 FROM "users" u WHERE u."id" = fc."userId"
    );

    DELETE FROM "flagged_content"
    WHERE id IN (SELECT id FROM orphaned_flagged_content);

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
