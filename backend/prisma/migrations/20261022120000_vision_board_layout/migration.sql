-- Additive: existing scene slots, crops, captions, notes and Anchor associations are untouched.
CREATE TYPE "VisionBoardLayout" AS ENUM ('CLASSIC', 'EDITORIAL', 'SCRAPBOOK');
ALTER TABLE "visions" ADD COLUMN "board_layout" "VisionBoardLayout" NOT NULL DEFAULT 'CLASSIC';
ALTER TABLE "vision_notes" ADD COLUMN "layout_positions" JSONB NULL;
