-- Chart / Workstream A foundation.
-- Additive only: no historical PracticeSession rows are updated and no Course
-- is inferred from existing Anchors or practice history.

ALTER TABLE "users"
  ADD COLUMN "chart_schema_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "practice_sessions"
  ADD COLUMN "course_id" TEXT,
  ADD COLUMN "waypoint_id" TEXT,
  ADD COLUMN "practice_entry_source" TEXT;

CREATE INDEX "practice_sessions_course_id_completed_at_idx"
  ON "practice_sessions"("course_id", "completed_at");

CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "CourseAnchorRole" AS ENUM ('DESTINATION', 'WAYPOINT_PRIMARY');
CREATE TYPE "ReflectionSource" AS ENUM (
  'POST_PRACTICE',
  'MANUAL_COURSE',
  'WAYPOINT_COMPLETION',
  'COURSE_COMPLETION',
  'ANCHOR_RELEASE'
);
CREATE TYPE "ReflectionPromptType" AS ENUM (
  'HOW_DO_YOU_FEEL_NOW',
  'WHAT_CAME_UP',
  'WHAT_STOOD_OUT',
  'WHAT_FELT_STRONGEST',
  'COURSE_STATUS',
  'WAYPOINT_COMPLETION',
  'FINAL_REFLECTION'
);
CREATE TYPE "ReflectionMood" AS ENUM ('CALM', 'FOCUSED', 'ENERGIZED', 'UNCHANGED', 'DISTRACTED');
CREATE TYPE "CourseEventType" AS ENUM (
  'COURSE_CREATED',
  'DESTINATION_CHANGED',
  'WAYPOINT_ADDED',
  'WAYPOINT_REORDERED',
  'DESTINATION_ANCHOR_LINKED',
  'WAYPOINT_ANCHOR_LINKED',
  'PRACTICE_COMPLETED',
  'REFLECTION_ADDED',
  'WAYPOINT_REACHED',
  'WAYPOINT_SKIPPED',
  'WAYPOINT_CANCELLED',
  'WAYPOINT_BLOCKED',
  'WAYPOINT_UNBLOCKED',
  'COURSE_COMPLETED',
  'COURSE_ARCHIVED',
  'COURSE_RESTORED'
);

CREATE TABLE "courses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "destination_text" VARCHAR(140) NOT NULL,
  "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
  "current_waypoint_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_from_proposal_id" TEXT,
  "plotted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "idempotency_key" TEXT,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "waypoints" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" VARCHAR(60) NOT NULL,
  "description" VARCHAR(400),
  "reached_at" TIMESTAMP(3),
  "skipped_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "supporting_practice_session_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "waypoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_anchor_links" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "waypoint_id" TEXT,
  "anchor_id" TEXT,
  "role" "CourseAnchorRole" NOT NULL,
  "anchor_snapshot" JSONB NOT NULL,
  "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unlinked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_anchor_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reflections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "source" "ReflectionSource" NOT NULL,
  "prompt_type" "ReflectionPromptType" NOT NULL,
  "prompt_version" INTEGER NOT NULL DEFAULT 1,
  "body" VARCHAR(1000),
  "structured_content" JSONB,
  "mood_before" "ReflectionMood",
  "mood_after" "ReflectionMood",
  "practice_session_id" TEXT,
  "anchor_id" TEXT,
  "course_id" TEXT,
  "waypoint_id" TEXT,
  "ai_consent_granted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "idempotency_key" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "reflections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reflections_exactly_one_content_check" CHECK (
    ("body" IS NOT NULL AND "structured_content" IS NULL)
    OR ("body" IS NULL AND "structured_content" IS NOT NULL)
  ),
  CONSTRAINT "reflections_prompt_content_check" CHECK (
    ("prompt_type" = 'WAYPOINT_COMPLETION' AND "body" IS NULL AND "structured_content" IS NOT NULL)
    OR ("prompt_type" <> 'WAYPOINT_COMPLETION' AND "body" IS NOT NULL AND "structured_content" IS NULL)
  )
);

CREATE TABLE "course_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "waypoint_id" TEXT,
  "event_type" "CourseEventType" NOT NULL,
  "source_entity_type" TEXT,
  "source_entity_id" TEXT,
  "snapshot" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotency_key" TEXT NOT NULL,
  "event_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "course_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_plan_proposals" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT,
  "base_course_version" INTEGER,
  "planner_version" TEXT NOT NULL,
  "model_version" TEXT NOT NULL,
  "input_hash" TEXT NOT NULL,
  "destination_interpretation" VARCHAR(280) NOT NULL,
  "waypoints" JSONB NOT NULL,
  "generation_source" TEXT NOT NULL,
  "fallback_reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "idempotency_key" TEXT NOT NULL,
  CONSTRAINT "ai_plan_proposals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courses_current_waypoint_id_key"
  ON "courses"("current_waypoint_id");
CREATE UNIQUE INDEX "courses_idempotency_key_key"
  ON "courses"("idempotency_key");
CREATE UNIQUE INDEX "waypoints_course_id_position_key"
  ON "waypoints"("course_id", "position");
CREATE UNIQUE INDEX "reflections_idempotency_key_key"
  ON "reflections"("idempotency_key");
CREATE UNIQUE INDEX "course_events_idempotency_key_key"
  ON "course_events"("idempotency_key");
CREATE UNIQUE INDEX "ai_plan_proposals_idempotency_key_key"
  ON "ai_plan_proposals"("idempotency_key");

CREATE INDEX "courses_user_id_status_idx" ON "courses"("user_id", "status");
CREATE INDEX "courses_user_id_deleted_at_idx" ON "courses"("user_id", "deleted_at");
CREATE INDEX "courses_user_id_updated_at_idx" ON "courses"("user_id", "updated_at");
CREATE INDEX "waypoints_course_id_reached_at_idx" ON "waypoints"("course_id", "reached_at");
CREATE INDEX "waypoints_user_id_idx" ON "waypoints"("user_id");
CREATE INDEX "course_anchor_links_course_id_role_unlinked_at_idx" ON "course_anchor_links"("course_id", "role", "unlinked_at");
CREATE INDEX "course_anchor_links_waypoint_id_unlinked_at_idx" ON "course_anchor_links"("waypoint_id", "unlinked_at");
CREATE INDEX "course_anchor_links_anchor_id_idx" ON "course_anchor_links"("anchor_id");
CREATE INDEX "course_anchor_links_user_id_idx" ON "course_anchor_links"("user_id");
CREATE INDEX "reflections_user_id_created_at_idx" ON "reflections"("user_id", "created_at");
CREATE INDEX "reflections_course_id_created_at_idx" ON "reflections"("course_id", "created_at");
CREATE INDEX "reflections_waypoint_id_created_at_idx" ON "reflections"("waypoint_id", "created_at");
CREATE INDEX "reflections_practice_session_id_idx" ON "reflections"("practice_session_id");
CREATE INDEX "course_events_course_id_recorded_at_idx" ON "course_events"("course_id", "recorded_at");
CREATE INDEX "course_events_waypoint_id_recorded_at_idx" ON "course_events"("waypoint_id", "recorded_at");
CREATE INDEX "course_events_user_id_idx" ON "course_events"("user_id");
CREATE INDEX "ai_plan_proposals_user_id_created_at_idx" ON "ai_plan_proposals"("user_id", "created_at");
CREATE INDEX "ai_plan_proposals_course_id_status_idx" ON "ai_plan_proposals"("course_id", "status");

-- Real concurrency authorities. Application pre-checks only improve errors.
CREATE UNIQUE INDEX "courses_one_active_per_user"
  ON "courses" ("user_id")
  WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "course_anchor_links_one_active_waypoint_primary"
  ON "course_anchor_links" ("waypoint_id")
  WHERE "role" = 'WAYPOINT_PRIMARY' AND "unlinked_at" IS NULL;

CREATE UNIQUE INDEX "course_anchor_links_one_active_destination"
  ON "course_anchor_links" ("course_id")
  WHERE "role" = 'DESTINATION' AND "unlinked_at" IS NULL;

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waypoints"
  ADD CONSTRAINT "waypoints_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "waypoints_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_current_waypoint_id_fkey"
  FOREIGN KEY ("current_waypoint_id") REFERENCES "waypoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "course_anchor_links"
  ADD CONSTRAINT "course_anchor_links_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "course_anchor_links_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "course_anchor_links_waypoint_id_fkey"
  FOREIGN KEY ("waypoint_id") REFERENCES "waypoints"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "course_anchor_links_anchor_id_fkey"
  FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reflections"
  ADD CONSTRAINT "reflections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "reflections_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "reflections_waypoint_id_fkey"
  FOREIGN KEY ("waypoint_id") REFERENCES "waypoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_events"
  ADD CONSTRAINT "course_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "course_events_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "course_events_waypoint_id_fkey"
  FOREIGN KEY ("waypoint_id") REFERENCES "waypoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_plan_proposals"
  ADD CONSTRAINT "ai_plan_proposals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_plan_proposals_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "courses" IS 'Chart Course domain; userId is mapped to user_id to support the frozen partial index contract.';
