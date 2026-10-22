ALTER TABLE "anchor_milestones"
  ADD COLUMN "backfill_version" INTEGER,
  ADD COLUMN "automatic_event_key" TEXT,
  ADD COLUMN "automatic_reserved_at" TIMESTAMP(3);

-- Existing awards retain dates and real receipts. They become quiet history.
UPDATE "anchor_milestones" SET "backfill_version" = 1;

CREATE TABLE "milestone_presentations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anchor_id" TEXT NOT NULL,
  "event_key" TEXT NOT NULL,
  "milestone_id" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "acknowledged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "milestone_presentations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "milestone_presentations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "milestone_presentations_anchor_id_fkey" FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "milestone_presentations_user_id_event_key_key"
  ON "milestone_presentations"("user_id", "event_key");
