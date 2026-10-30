ALTER TABLE "anchor_creation_sessions"
  ADD COLUMN "lease_token" TEXT,
  ADD COLUMN "lease_until" TIMESTAMP(3),
  ADD COLUMN "saved_anchor_id" TEXT;
CREATE UNIQUE INDEX "anchor_creation_sessions_saved_anchor_id_key"
  ON "anchor_creation_sessions"("saved_anchor_id");
