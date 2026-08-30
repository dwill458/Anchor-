-- Add a dedicated trial anchor, separate from createdAt.
-- Existing rows are backfilled to the deploy timestamp (CURRENT_TIMESTAMP is
-- evaluated once per transaction), giving every current account a fresh 7-day
-- trial window starting at production launch. New rows default to now() at signup.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
