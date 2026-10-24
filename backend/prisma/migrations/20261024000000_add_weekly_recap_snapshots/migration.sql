-- Weekly Insight 2.0: global, server-authoritative weekly recap snapshots.
-- Additive only: the legacy weekly_insight_snapshots table is untouched and stays readable.
-- One row per (user, scope, local week). scope_key is NOT NULL so uniqueness is enforced
-- (the legacy (user_id, anchor_id, week_start) key cannot guard global rows because anchor_id IS NULL).
CREATE TABLE "weekly_recap_snapshots" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "scope_key" TEXT NOT NULL DEFAULT 'GLOBAL',
  "week_key" TEXT NOT NULL,
  "time_zone" TEXT NOT NULL,
  "week_start" TIMESTAMP(3) NOT NULL,
  "week_end" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "content_version" INTEGER NOT NULL DEFAULT 1,
  "content" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalized_at" TIMESTAMP(3),
  "feedback" TEXT,
  "feedback_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weekly_recap_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "weekly_recap_snapshots_status_check" CHECK ("status" IN ('DRAFT', 'FINAL')),
  CONSTRAINT "weekly_recap_snapshots_final_has_finalized_at" CHECK (("status" = 'FINAL') = ("finalized_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "weekly_recap_snapshots_user_id_scope_key_week_key_key"
  ON "weekly_recap_snapshots"("user_id", "scope_key", "week_key");
CREATE INDEX "weekly_recap_snapshots_user_id_week_start_idx"
  ON "weekly_recap_snapshots"("user_id", "week_start");

ALTER TABLE "weekly_recap_snapshots"
  ADD CONSTRAINT "weekly_recap_snapshots_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
