-- Only add foreign key constraints if tables exist
-- This handles the case where tables may not have been created yet

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'burned_anchors'
  ) THEN
    -- First, delete any orphaned rows that would fail the constraint
    DELETE FROM "burned_anchors"
    WHERE NOT EXISTS (
      SELECT 1 FROM "users" u WHERE u."id" = "burned_anchors"."userId"
    );

    -- Then add the constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'burned_anchors'
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
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'flagged_content'
  ) THEN
    -- First, delete any orphaned rows that would fail the constraint
    DELETE FROM "flagged_content"
    WHERE NOT EXISTS (
      SELECT 1 FROM "users" u WHERE u."id" = "flagged_content"."userId"
    );

    -- Then add the constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'flagged_content'
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
