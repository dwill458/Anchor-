CREATE TYPE "VisionAppearanceReferenceSource" AS ENUM ('PROFILE', 'CUSTOM');
CREATE TYPE "VisionGenerationCandidateStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "user_settings"
  ADD COLUMN "use_profile_photo_for_vision" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "vision_appearance_references" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "source" "VisionAppearanceReferenceSource" NOT NULL,
  "profile_fingerprint" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vision_appearance_references_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vision_appearance_references_asset_id_key" ON "vision_appearance_references"("asset_id");
CREATE INDEX "vision_appearance_references_user_id_source_idx" ON "vision_appearance_references"("user_id", "source");
CREATE INDEX "vision_appearance_references_user_id_expires_at_idx" ON "vision_appearance_references"("user_id", "expires_at");

ALTER TABLE "vision_generations" ADD COLUMN "appearance_reference_id" TEXT;
ALTER TABLE "vision_generation_candidates" ALTER COLUMN "asset_id" DROP NOT NULL;
ALTER TABLE "vision_generation_candidates" ADD COLUMN "status" "VisionGenerationCandidateStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "vision_generation_candidates" ADD COLUMN "error" TEXT;

ALTER TABLE "vision_appearance_references"
  ADD CONSTRAINT "vision_appearance_references_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "vision_appearance_references_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vision_generations"
  ADD CONSTRAINT "vision_generations_appearance_reference_id_fkey" FOREIGN KEY ("appearance_reference_id") REFERENCES "vision_appearance_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;
