CREATE TYPE "VisionGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'PARTIAL', 'COMPLETE', 'FAILED');

-- An Anchor has one active Vision. Archived Visions remain available for history.
CREATE UNIQUE INDEX "visions_one_active_per_anchor_key" ON "visions"("anchor_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "vision_scenes_active_asset_key" ON "vision_scenes"("vision_id", "asset_id") WHERE "is_archived" = false AND "asset_id" IS NOT NULL;

CREATE TABLE "vision_generations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anchor_id" TEXT NOT NULL,
  "vision_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "plan" JSONB,
  "set_number" INTEGER NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "status" "VisionGenerationStatus" NOT NULL DEFAULT 'QUEUED',
  "stage" TEXT NOT NULL DEFAULT 'planning',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vision_generations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vision_generation_candidates" (
  "id" TEXT NOT NULL,
  "generation_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vision_generation_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vision_generations_vision_id_set_number_key" ON "vision_generations"("vision_id", "set_number");
CREATE INDEX "vision_generations_user_id_anchor_id_created_at_idx" ON "vision_generations"("user_id", "anchor_id", "created_at");
CREATE UNIQUE INDEX "vision_generation_candidates_generation_id_sort_order_key" ON "vision_generation_candidates"("generation_id", "sort_order");
CREATE INDEX "vision_generation_candidates_asset_id_idx" ON "vision_generation_candidates"("asset_id");

ALTER TABLE "vision_generations" ADD CONSTRAINT "vision_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_generations" ADD CONSTRAINT "vision_generations_anchor_id_fkey" FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_generations" ADD CONSTRAINT "vision_generations_vision_id_fkey" FOREIGN KEY ("vision_id") REFERENCES "visions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_generation_candidates" ADD CONSTRAINT "vision_generation_candidates_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "vision_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_generation_candidates" ADD CONSTRAINT "vision_generation_candidates_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
