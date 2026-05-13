-- CreateTable
CREATE TABLE "anchor_variation_pool" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "intention_key" TEXT NOT NULL,
    "structure_hash" TEXT NOT NULL,
    "style_choice" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "reserved_by_request_id" TEXT,
    "reserved_at" TIMESTAMP(3),
    "reserved_until" TIMESTAMP(3),
    "selected_by_anchor_id" TEXT,
    "selected_at" TIMESTAMP(3),
    "source_provider" TEXT,
    "source_model" TEXT,
    "source_prompt" TEXT,
    "source_negative_prompt" TEXT,
    "seed" INTEGER,
    "structure_match_score" DOUBLE PRECISION,
    "iou_score" DOUBLE PRECISION,
    "edge_overlap_score" DOUBLE PRECISION,
    "structure_preserved" BOOLEAN,
    "classification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anchor_variation_pool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anchor_variation_pool_fingerprint_status_idx" ON "anchor_variation_pool"("fingerprint", "status");

-- CreateIndex
CREATE INDEX "anchor_variation_pool_reserved_by_request_id_idx" ON "anchor_variation_pool"("reserved_by_request_id");

-- CreateIndex
CREATE INDEX "anchor_variation_pool_reserved_until_idx" ON "anchor_variation_pool"("reserved_until");

-- CreateIndex
CREATE INDEX "anchor_variation_pool_selected_by_anchor_id_idx" ON "anchor_variation_pool"("selected_by_anchor_id");
