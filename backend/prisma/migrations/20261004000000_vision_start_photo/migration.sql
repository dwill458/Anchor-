-- A described Vision scene can start from the person's own photo of their real world today.
ALTER TABLE "vision_generations" ADD COLUMN "start_asset_id" TEXT;
