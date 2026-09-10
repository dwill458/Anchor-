-- V2 Batch 3 integration contracts. All transitions retain historical rows.
ALTER TABLE "anchors" ADD COLUMN "released_at" TIMESTAMP(3);
ALTER TABLE "anchors" ADD COLUMN "release_idempotency_key" TEXT;
CREATE UNIQUE INDEX "anchors_release_idempotency_key_key" ON "anchors"("release_idempotency_key");
CREATE INDEX "anchors_userId_released_at_idx" ON "anchors"("userId", "released_at");
ALTER TABLE "waypoints" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE TABLE "thread_event_ledger" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "anchor_id" TEXT,
  "event_type" TEXT NOT NULL, "significance" TEXT NOT NULL, "source_kind" TEXT NOT NULL,
  "source_entity_id" TEXT, "correlation_id" TEXT NOT NULL, "correlation_sequence" INTEGER NOT NULL DEFAULT 0,
  "ledger_sequence" BIGSERIAL NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "occurred_at" TIMESTAMP(3) NOT NULL,
  "idempotency_key" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "thread_event_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "thread_event_ledger_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "thread_event_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "thread_event_ledger_anchor_id_fkey" FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE SET NULL
);
CREATE INDEX "thread_event_ledger_user_id_ledger_sequence_idx" ON "thread_event_ledger"("user_id", "ledger_sequence");
CREATE TABLE "thread_event_presentation_claims" (
  "id" TEXT NOT NULL, "event_id" TEXT NOT NULL, "channel" TEXT NOT NULL, "bundle_key" TEXT NOT NULL,
  "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "thread_event_presentation_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "thread_event_presentation_claims_event_id_channel_key" UNIQUE ("event_id", "channel"),
  CONSTRAINT "thread_event_presentation_claims_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "thread_event_ledger"("id") ON DELETE CASCADE
);
CREATE TABLE "thread_event_presentation_receipts" (
  "id" TEXT NOT NULL, "event_id" TEXT NOT NULL, "channel" TEXT NOT NULL, "status" TEXT NOT NULL,
  "presented_at" TIMESTAMP(3), "settled_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "thread_event_presentation_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "thread_event_presentation_receipts_event_id_channel_key" UNIQUE ("event_id", "channel"),
  CONSTRAINT "thread_event_presentation_receipts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "thread_event_ledger"("id") ON DELETE CASCADE
);
CREATE TABLE "weekly_insight_snapshots" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "anchor_id" TEXT, "week_start" TIMESTAMP(3) NOT NULL,
  "week_end" TIMESTAMP(3) NOT NULL, "snapshot" JSONB NOT NULL, "feedback" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_insight_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "weekly_insight_snapshots_user_id_anchor_id_week_start_key" UNIQUE ("user_id", "anchor_id", "week_start"),
  CONSTRAINT "weekly_insight_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "weekly_insight_snapshots_user_id_week_start_idx" ON "weekly_insight_snapshots"("user_id", "week_start");
