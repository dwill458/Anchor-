-- =====================================================================
-- DISPOSABLE DEVELOPMENT DATABASES ONLY. NEVER RUN THIS IN PRODUCTION.
--
-- This script DROPs the Chart tables. Every Reflection body, Course,
-- Waypoint, Course Event, Course/Anchor link, and AI plan proposal in the
-- database is PERMANENTLY DELETED. The loss is IRREVERSIBLE: re-applying
-- 20260802000000_add_chart_backend_foundation recreates empty tables and
-- restores nothing.
--
-- Its only supported use is resetting a throwaway database so the migration
-- can be re-applied while developing or verifying it.
--
-- Production rollback is FLAG-BASED and deletes no data. See
-- docs/runbooks/CHART_ROLLBACK.md.
--
-- Running this file with no opt-in aborts before touching anything. To
-- proceed on a disposable database, opt in explicitly in the same session:
--
--   psql "$DISPOSABLE_DATABASE_URL" \
--     -v ON_ERROR_STOP=1 \
--     -c "SET anchor.chart_destructive_rollback = 'i_understand_this_permanently_deletes_chart_data';" \
--     -f prisma/migrations/DEV_ONLY_DESTRUCTIVE_ROLLBACK_20260802000000_add_chart_backend_foundation.sql
--
-- (`SET` is session-scoped, so pass it with -c on the same psql invocation,
-- or run it as the first statement of the same connection.)
-- =====================================================================

DO $$
BEGIN
  IF current_setting('anchor.chart_destructive_rollback', true)
       IS DISTINCT FROM 'i_understand_this_permanently_deletes_chart_data' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'Refusing to run the destructive Chart rollback: no explicit opt-in for this session.',
      DETAIL  = 'This script drops courses, waypoints, course_events, course_anchor_links, ai_plan_proposals, and reflections. All Reflection text is permanently destroyed and re-applying the migration recovers none of it.',
      HINT    = 'Disposable development databases only. Production rollback is flag-based: see docs/runbooks/CHART_ROLLBACK.md. To proceed here run: SET anchor.chart_destructive_rollback = ''i_understand_this_permanently_deletes_chart_data'';';
  END IF;

  RAISE WARNING 'DESTRUCTIVE Chart rollback confirmed. All Chart data, including every Reflection body, is being permanently deleted and cannot be recovered.';
END
$$;

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
