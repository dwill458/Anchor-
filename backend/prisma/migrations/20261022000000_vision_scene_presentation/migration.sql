-- Where an image sits on the Vision board (slot 0-7) and how it is framed in its print. All optional: absent means "automatic".
ALTER TABLE "vision_scenes" ADD COLUMN "slot_index" INTEGER;
ALTER TABLE "vision_scenes" ADD COLUMN "focal_x" DOUBLE PRECISION;
ALTER TABLE "vision_scenes" ADD COLUMN "focal_y" DOUBLE PRECISION;
