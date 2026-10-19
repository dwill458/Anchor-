CREATE TABLE "anchor_milestones" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anchor_id" TEXT NOT NULL,
  "definition_id" VARCHAR(64) NOT NULL,
  "definition_version" INTEGER NOT NULL DEFAULT 1,
  "earned_at" TIMESTAMP(3) NOT NULL,
  "source_kind" VARCHAR(32) NOT NULL,
  "source_entity_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "celebrated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anchor_milestones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anchor_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "anchor_milestones_anchor_id_fkey" FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "anchor_milestones_user_id_anchor_id_definition_id_key" ON "anchor_milestones"("user_id", "anchor_id", "definition_id");
CREATE INDEX "anchor_milestones_user_id_anchor_id_earned_at_idx" ON "anchor_milestones"("user_id", "anchor_id", "earned_at");
