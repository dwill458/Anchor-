-- Check for orphaned rows in burned_anchors (userId doesn't match any user)
-- This will identify any rows that would fail the foreign key constraint
CREATE TEMP TABLE orphaned_burned_anchors AS
SELECT ba.id, ba."userId"
FROM "burned_anchors" ba
WHERE NOT EXISTS (
  SELECT 1 FROM "users" u WHERE u."id" = ba."userId"
);

-- Check for orphaned rows in flagged_content
CREATE TEMP TABLE orphaned_flagged_content AS
SELECT fc.id, fc."userId"
FROM "flagged_content" fc
WHERE NOT EXISTS (
  SELECT 1 FROM "users" u WHERE u."id" = fc."userId"
);

-- Delete all orphaned rows (they can't be salvaged)
DELETE FROM "burned_anchors"
WHERE id IN (SELECT id FROM orphaned_burned_anchors);

DELETE FROM "flagged_content"
WHERE id IN (SELECT id FROM orphaned_flagged_content);

-- Now add the foreign key constraints
-- Check if constraints already exist before adding (Prisma may have partially applied them)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'burned_anchors_userId_fkey'
  ) THEN
    ALTER TABLE "burned_anchors"
    ADD CONSTRAINT "burned_anchors_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'flagged_content_userId_fkey'
  ) THEN
    ALTER TABLE "flagged_content"
    ADD CONSTRAINT "flagged_content_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;
