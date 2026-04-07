-- Add new architecture fields to anchors table
-- Migration for Phase 1: Foundation & Data Model

-- Add structure lineage fields
ALTER TABLE "anchors" ADD COLUMN "reinforcedSigilSvg" TEXT;
ALTER TABLE "anchors" ADD COLUMN "structureVariant" TEXT NOT NULL DEFAULT 'balanced';

-- Add metadata fields
ALTER TABLE "anchors" ADD COLUMN "reinforcementMetadata" JSONB;
ALTER TABLE "anchors" ADD COLUMN "enhancementMetadata" JSONB;

-- Backfill existing anchors with default values
-- Mark all existing anchors as having skipped reinforcement
UPDATE "anchors"
SET "reinforcementMetadata" = jsonb_build_object(
  'completed', false,
  'skipped', true,
  'strokeCount', 0,
  'fidelityScore', 0,
  'timeSpentMs', 0
)
WHERE "reinforcementMetadata" IS NULL;

-- For existing AI-enhanced anchors, create legacy enhancement metadata
UPDATE "anchors"
SET "enhancementMetadata" = jsonb_build_object(
  'styleApplied', COALESCE("aiStyle", 'legacy'),
  'modelUsed', 'sdxl-text-to-image-legacy',
  'controlMethod', 'none',
  'generationTimeMs', 0,
  'promptUsed', 'legacy_generation',
  'negativePrompt', '',
  'appliedAt', COALESCE("createdAt", NOW())
)
WHERE "enhancedImageUrl" IS NOT NULL
AND "enhancementMetadata" IS NULL;

-- Create index on structureVariant for analytics queries
CREATE INDEX "anchors_structureVariant_idx" ON "anchors"("structureVariant");

-- Add comment to document the new architecture
COMMENT ON COLUMN "anchors"."reinforcedSigilSvg" IS 'User-traced reinforcement version of base sigil (manual tracing session)';
COMMENT ON COLUMN "anchors"."structureVariant" IS 'Deterministic variant chosen: dense, balanced, or minimal';
COMMENT ON COLUMN "anchors"."reinforcementMetadata" IS 'JSON metadata tracking manual reinforcement session (fidelity score, stroke count, etc.)';
COMMENT ON COLUMN "anchors"."enhancementMetadata" IS 'JSON metadata tracking AI style transfer (style applied, model used, prompts, etc.)';
