-- Vision board: photos taken with the camera, and single described scenes generated later.
ALTER TYPE "VisionSceneSource" ADD VALUE IF NOT EXISTS 'USER_CAMERA';

-- Generation jobs are either a numbered image set (SET, max 3 per Vision) or one
-- described scene added to the board afterwards (SCENE). Scenes number separately.
ALTER TABLE "vision_generations" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SET';
DROP INDEX "vision_generations_vision_id_set_number_key";
CREATE UNIQUE INDEX "vision_generations_vision_id_kind_set_number_key" ON "vision_generations"("vision_id", "kind", "set_number");
