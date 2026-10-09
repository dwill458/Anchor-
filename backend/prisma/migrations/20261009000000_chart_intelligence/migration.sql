ALTER TABLE "courses" ADD COLUMN "route_start_position" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "actual_starting_point" VARCHAR(500), ADD COLUMN "route_scope" VARCHAR(16) NOT NULL DEFAULT 'DESTINATION';
ALTER TABLE "ai_plan_proposals" ADD COLUMN "actual_starting_point" VARCHAR(500), ADD COLUMN "route_scope" VARCHAR(16) NOT NULL DEFAULT 'DESTINATION';
ALTER TABLE "waypoints" ALTER COLUMN "progress_mode" TYPE VARCHAR(16), ADD COLUMN "requirements" JSONB, ADD COLUMN "completion_criteria" VARCHAR(400);
-- Legacy modes and all recorded values remain untouched. New modes are opt-in.
