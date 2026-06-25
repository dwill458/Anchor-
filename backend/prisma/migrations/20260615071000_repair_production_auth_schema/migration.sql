-- Repair production schema drift that breaks auth sync on Railway.
-- Safe to run repeatedly.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;

CREATE TABLE IF NOT EXISTS "flagged_content" (
  "id" TEXT NOT NULL,
  "anchorId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "flagged_content_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "flagged_content_anchorId_idx" ON "flagged_content"("anchorId");
CREATE INDEX IF NOT EXISTS "flagged_content_userId_idx" ON "flagged_content"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'flagged_content_userId_fkey'
      AND table_name = 'flagged_content'
  ) THEN
    ALTER TABLE "flagged_content"
    ADD CONSTRAINT "flagged_content_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
