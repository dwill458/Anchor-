-- Add missing anchor classifier fields expected by the Prisma schema and API.
-- These columns were added to schema.prisma but never shipped in a migration,
-- which breaks both anchor reads and writes in environments that rely on
-- prisma migrate deploy (for example Railway production).

ALTER TABLE "anchors"
  ADD COLUMN IF NOT EXISTS "planetaryTier" TEXT DEFAULT 'saturn',
  ADD COLUMN IF NOT EXISTS "classifierVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "classifierMeta" JSONB;

UPDATE "anchors"
SET "planetaryTier" = 'saturn'
WHERE "planetaryTier" IS NULL;

UPDATE "anchors"
SET "classifierVersion" = 1
WHERE "classifierVersion" IS NULL;
