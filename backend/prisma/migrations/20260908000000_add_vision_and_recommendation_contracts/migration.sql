-- AlterTable: Add intention_completed_at to anchors
ALTER TABLE "anchors" ADD COLUMN "intention_completed_at" TIMESTAMP(3);

-- CreateIndex: anchors_userId_intention_completed_at_idx
CREATE INDEX "anchors_userId_intention_completed_at_idx" ON "anchors"("userId", "intention_completed_at");

-- CreateEnum: VisionStatus
CREATE TYPE "VisionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum: VisionSceneSource
CREATE TYPE "VisionSceneSource" AS ENUM ('USER_UPLOAD', 'AI_GENERATED');

-- CreateTable: visions
CREATE TABLE "visions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "anchor_id" TEXT NOT NULL,
    "title" VARCHAR(140),
    "description" TEXT,
    "status" "VisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: assets
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vision_scenes
CREATE TABLE "vision_scenes" (
    "id" TEXT NOT NULL,
    "vision_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" "VisionSceneSource" NOT NULL,
    "asset_id" TEXT,
    "prompt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vision_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vision_views
CREATE TABLE "vision_views" (
    "id" TEXT NOT NULL,
    "vision_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "local_date_key" TEXT,
    "time_zone" TEXT,

    CONSTRAINT "vision_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recommendation_signal_acks
CREATE TABLE "recommendation_signal_acks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signal_key" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_signal_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "visions_user_id_status_idx" ON "visions"("user_id", "status");
CREATE INDEX "visions_anchor_id_status_idx" ON "visions"("anchor_id", "status");

CREATE INDEX "assets_user_id_idx" ON "assets"("user_id");

CREATE INDEX "vision_scenes_vision_id_sort_order_idx" ON "vision_scenes"("vision_id", "sort_order");
CREATE INDEX "vision_scenes_user_id_idx" ON "vision_scenes"("user_id");

CREATE INDEX "vision_views_vision_id_viewed_at_idx" ON "vision_views"("vision_id", "viewed_at");
CREATE INDEX "vision_views_user_id_vision_id_viewed_at_idx" ON "vision_views"("user_id", "vision_id", "viewed_at");
CREATE INDEX "vision_views_user_id_vision_id_local_date_key_idx" ON "vision_views"("user_id", "vision_id", "local_date_key");

CREATE UNIQUE INDEX "recommendation_signal_acks_user_id_signal_key_key" ON "recommendation_signal_acks"("user_id", "signal_key");
CREATE INDEX "recommendation_signal_acks_user_id_acknowledged_at_idx" ON "recommendation_signal_acks"("user_id", "acknowledged_at");

-- AddForeignKey
ALTER TABLE "visions" ADD CONSTRAINT "visions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visions" ADD CONSTRAINT "visions_anchor_id_fkey" FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vision_scenes" ADD CONSTRAINT "vision_scenes_vision_id_fkey" FOREIGN KEY ("vision_id") REFERENCES "visions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_scenes" ADD CONSTRAINT "vision_scenes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_scenes" ADD CONSTRAINT "vision_scenes_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vision_views" ADD CONSTRAINT "vision_views_vision_id_fkey" FOREIGN KEY ("vision_id") REFERENCES "visions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_views" ADD CONSTRAINT "vision_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recommendation_signal_acks" ADD CONSTRAINT "recommendation_signal_acks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
