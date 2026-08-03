-- Manual rollback for the Workstream A Chart foundation migration.
-- Run only after stopping application writes that use Chart fields.

DROP TABLE IF EXISTS "ai_plan_proposals";
DROP TABLE IF EXISTS "course_events";
DROP TABLE IF EXISTS "reflections";
DROP TABLE IF EXISTS "course_anchor_links";
-- Courses and Waypoints reference each other through current_waypoint_id and
-- course_id. Remove the pointer FK before dropping either table.
ALTER TABLE IF EXISTS "courses" DROP CONSTRAINT IF EXISTS "courses_current_waypoint_id_fkey";
DROP TABLE IF EXISTS "waypoints";
DROP TABLE IF EXISTS "courses";

DROP TYPE IF EXISTS "CourseEventType";
DROP TYPE IF EXISTS "ReflectionMood";
DROP TYPE IF EXISTS "ReflectionPromptType";
DROP TYPE IF EXISTS "ReflectionSource";
DROP TYPE IF EXISTS "CourseAnchorRole";
DROP TYPE IF EXISTS "CourseStatus";

DROP INDEX IF EXISTS "practice_sessions_course_id_completed_at_idx";
ALTER TABLE "practice_sessions"
  DROP COLUMN IF EXISTS "practice_entry_source",
  DROP COLUMN IF EXISTS "waypoint_id",
  DROP COLUMN IF EXISTS "course_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "chart_schema_version";

-- Prisma has no automatic down migration. Remove the applied migration record
-- only after every Chart table/type/column above has been removed so that the
-- authored migration can be reapplied cleanly on the disposable database.
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20260802000000_add_chart_backend_foundation';
