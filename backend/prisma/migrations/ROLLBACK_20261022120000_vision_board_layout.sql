-- Emergency destructive rollback. Prefer rolling back the application while retaining these additive columns.
-- Back up layout_positions and board_layout first; do not run against user data without explicit authorization.
ALTER TABLE "vision_notes" DROP COLUMN "layout_positions";
ALTER TABLE "visions" DROP COLUMN "board_layout";
DROP TYPE "VisionBoardLayout";
