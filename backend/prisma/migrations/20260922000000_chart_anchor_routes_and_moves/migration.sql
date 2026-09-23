-- Anchor 2.0 Chart: one route per Anchor, measurable waypoints, and
-- server-authoritative Moves. Additive except for the active-Course index,
-- which is replaced by a per-Anchor equivalent.

ALTER TYPE "CourseEventType" ADD VALUE IF NOT EXISTS 'MOVE_COMPLETED';
ALTER TYPE "CourseEventType" ADD VALUE IF NOT EXISTS 'ROUTE_ADJUSTED';

-- Courses -------------------------------------------------------------------
ALTER TABLE "courses"
  ADD COLUMN "anchor_id" TEXT,
  ADD COLUMN "vision_id" TEXT,
  ADD COLUMN "complexity" VARCHAR(16),
  ADD COLUMN "current_move_id" TEXT;

-- Existing Courses already name their Anchor through the active DESTINATION
-- link; copy it so the per-Anchor contract holds for current data.
UPDATE "courses" c
SET "anchor_id" = l."anchor_id"
FROM "course_anchor_links" l
WHERE l."course_id" = c."id"
  AND l."role" = 'DESTINATION'
  AND l."unlinked_at" IS NULL
  AND l."anchor_id" IS NOT NULL;

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_anchor_id_fkey"
  FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "courses_anchor_id_idx" ON "courses"("anchor_id");

DROP INDEX IF EXISTS "courses_one_active_per_user";

-- One active route per Anchor. Legacy Courses without an Anchor keep the old
-- one-per-user rule so pre-2.0 data cannot fan out.
CREATE UNIQUE INDEX "courses_one_active_per_anchor"
  ON "courses"("user_id", "anchor_id")
  WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL AND "anchor_id" IS NOT NULL;

CREATE UNIQUE INDEX "courses_one_active_unanchored_per_user"
  ON "courses"("user_id")
  WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL AND "anchor_id" IS NULL;

-- Waypoints -----------------------------------------------------------------
ALTER TABLE "waypoints"
  ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'MILESTONE',
  ADD COLUMN "metric_label" VARCHAR(40),
  ADD COLUMN "metric_baseline" DOUBLE PRECISION,
  ADD COLUMN "metric_target" DOUBLE PRECISION,
  ADD COLUMN "metric_current" DOUBLE PRECISION;

-- Moves ---------------------------------------------------------------------
CREATE TABLE "moves" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "waypoint_id" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "rationale" VARCHAR(280),
  "source" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "position" INTEGER NOT NULL,
  "completed_at" TIMESTAMP(3),
  "dismissed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "idempotency_key" TEXT,
  CONSTRAINT "moves_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "moves_source_check" CHECK ("source" IN ('AI', 'USER')),
  CONSTRAINT "moves_status_check" CHECK ("status" IN ('SUGGESTED', 'ACTIVE', 'COMPLETED', 'DISMISSED'))
);

CREATE UNIQUE INDEX "moves_idempotency_key_key" ON "moves"("idempotency_key");
CREATE INDEX "moves_course_id_status_idx" ON "moves"("course_id", "status");
CREATE INDEX "moves_waypoint_id_status_idx" ON "moves"("waypoint_id", "status");
CREATE INDEX "moves_user_id_completed_at_idx" ON "moves"("user_id", "completed_at");

ALTER TABLE "moves"
  ADD CONSTRAINT "moves_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "moves"
  ADD CONSTRAINT "moves_waypoint_id_fkey"
  FOREIGN KEY ("waypoint_id") REFERENCES "waypoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "courses_current_move_id_key" ON "courses"("current_move_id");
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_current_move_id_fkey"
  FOREIGN KEY ("current_move_id") REFERENCES "moves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Plan proposals --------------------------------------------------------------
ALTER TABLE "ai_plan_proposals"
  ADD COLUMN "anchor_id" TEXT,
  ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'CREATE',
  ADD COLUMN "complexity" VARCHAR(16),
  ADD COLUMN "suggested_one_move" JSONB,
  ADD COLUMN "guidance" VARCHAR(280);
