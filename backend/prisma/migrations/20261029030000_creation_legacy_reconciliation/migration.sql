-- Additive: durable, idempotent record of how each pre-ledger account was classified.
-- This table never grants or revokes access; it records evidence and the monotonic counter repair.
CREATE TABLE "anchor_creation_reconciliations" (
  "user_id" TEXT NOT NULL,
  "policy_version" INTEGER NOT NULL,
  "classification" TEXT NOT NULL,
  "uncertainties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "evidence" JSONB NOT NULL,
  "counter_before" INTEGER NOT NULL,
  "counter_after" INTEGER NOT NULL,
  "run_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anchor_creation_reconciliations_pkey" PRIMARY KEY ("user_id", "policy_version"),
  CONSTRAINT "anchor_creation_reconciliations_counter_check" CHECK ("counter_after" >= "counter_before"),
  CONSTRAINT "anchor_creation_reconciliations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "anchor_creation_reconciliations_classification_idx" ON "anchor_creation_reconciliations"("policy_version", "classification");
-- Hard-deleted ("burned") saved Anchors keep their original id/time; lookups by user need an index.
CREATE INDEX IF NOT EXISTS "burned_anchors_userId_createdAt_idx" ON "burned_anchors"("userId", "createdAt");
