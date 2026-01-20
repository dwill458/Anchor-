-- Rollback script for architecture refactor fields migration
-- Run this if you need to reverse the migration

-- WARNING: This will permanently delete data in the new columns
-- Make sure to backup the database before running this

-- Remove index
DROP INDEX IF EXISTS "anchors_structureVariant_idx";

-- Remove new columns
ALTER TABLE "anchors" DROP COLUMN IF EXISTS "reinforcedSigilSvg";
ALTER TABLE "anchors" DROP COLUMN IF EXISTS "structureVariant";
ALTER TABLE "anchors" DROP COLUMN IF EXISTS "reinforcementMetadata";
ALTER TABLE "anchors" DROP COLUMN IF EXISTS "enhancementMetadata";

-- Verify rollback
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'anchors'
ORDER BY ordinal_position;
