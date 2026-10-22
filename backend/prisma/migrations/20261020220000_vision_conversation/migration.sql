-- Additive: existing Vision generations/candidates and single-reference clients remain readable.
CREATE TABLE "vision_creation_sessions" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "anchor_id" TEXT NOT NULL,
  "vision_id" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT NOT NULL, "draft_prompt" TEXT NOT NULL DEFAULT '',
  "draft_references" JSONB NOT NULL DEFAULT '[]',
  "selected_candidate_id" TEXT, "viewed_round_id" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "vision_creation_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vision_creation_sessions_vision_id_fkey" FOREIGN KEY ("vision_id") REFERENCES "visions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "vision_creation_sessions_selected_candidate_id_fkey" FOREIGN KEY ("selected_candidate_id") REFERENCES "vision_generation_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "vision_creation_sessions_status_check" CHECK ("status" IN ('ACTIVE','SEALED','ABANDONED','EXPIRED'))
);
CREATE INDEX "vision_creation_sessions_user_id_anchor_id_status_updated_at_idx" ON "vision_creation_sessions"("user_id", "anchor_id", "status", "updated_at");
CREATE INDEX "vision_creation_sessions_expires_at_status_idx" ON "vision_creation_sessions"("expires_at", "status");
ALTER TABLE "vision_generations" ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'CREATE',
  ADD COLUMN "session_id" TEXT, ADD COLUMN "round_number" INTEGER, ADD COLUMN "parent_candidate_id" TEXT;
ALTER TABLE "vision_generations" ADD CONSTRAINT "vision_generations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "vision_creation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_generations" ADD CONSTRAINT "vision_generations_parent_candidate_id_fkey" FOREIGN KEY ("parent_candidate_id") REFERENCES "vision_generation_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vision_generations" ADD CONSTRAINT "vision_generations_operation_check" CHECK ("operation" IN ('CREATE','EDIT','COMPOSE','VARIATE'));
ALTER TABLE "vision_generations" ADD CONSTRAINT "vision_generations_parent_intent_check" CHECK (
  "session_id" IS NULL OR ("round_number" IS NOT NULL AND "round_number" >= 0 AND (("operation" IN ('EDIT','VARIATE') AND "parent_candidate_id" IS NOT NULL) OR ("operation" IN ('CREATE','COMPOSE') AND "parent_candidate_id" IS NULL)))
);
CREATE UNIQUE INDEX "vision_generations_session_id_round_number_key" ON "vision_generations"("session_id", "round_number");
CREATE TABLE "vision_generation_references" (
  "id" TEXT NOT NULL, "generation_id" TEXT NOT NULL, "asset_id" TEXT NOT NULL,
  "role" TEXT NOT NULL, "label" VARCHAR(80), "sort_order" INTEGER NOT NULL,
  CONSTRAINT "vision_generation_references_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vision_generation_references_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "vision_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "vision_generation_references_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vision_generation_references_role_check" CHECK ("role" IN ('identity','place','object','inspiration')),
  CONSTRAINT "vision_generation_references_sort_order_check" CHECK ("sort_order" BETWEEN 0 AND 4)
);
CREATE UNIQUE INDEX "vision_generation_references_generation_id_asset_id_key" ON "vision_generation_references"("generation_id", "asset_id");
CREATE UNIQUE INDEX "vision_generation_references_generation_id_sort_order_key" ON "vision_generation_references"("generation_id", "sort_order");
CREATE INDEX "vision_generation_references_asset_id_idx" ON "vision_generation_references"("asset_id");
