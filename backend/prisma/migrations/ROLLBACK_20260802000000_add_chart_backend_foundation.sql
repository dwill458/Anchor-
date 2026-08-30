-- Chart has no destructive production rollback. This script refuses to run.
--
-- Dropping the Chart tables permanently destroys every Reflection body, Course,
-- Waypoint, Course Event, Anchor link, and AI plan proposal in the database.
-- Re-applying the migration afterwards recreates empty tables; it does not
-- recover a single row. No runbook may instruct an operator to do this to
-- production.
--
-- The supported production rollback is flag-based and preserves all user-owned
-- Chart data. See docs/runbooks/CHART_ROLLBACK.md for the exact environment
-- variables, order of operations, verification queries, and re-enable steps.
--
-- Disposable development databases have their own explicitly named script:
--   prisma/migrations/DEV_ONLY_DESTRUCTIVE_ROLLBACK_20260802000000_add_chart_backend_foundation.sql
-- It is guarded and refuses to run without an explicit opt-in.

DO $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'insufficient_privilege',
    MESSAGE = 'Refusing to run a destructive Chart schema rollback.',
    DETAIL  = 'Dropping the Chart tables permanently deletes all Reflection text, Courses, Waypoints, Course Events, Anchor links, and AI plan proposals. Re-applying the migration does not restore any of it.',
    HINT    = 'Production rollback is flag-based and deletes nothing: see docs/runbooks/CHART_ROLLBACK.md. For a disposable development database use DEV_ONLY_DESTRUCTIVE_ROLLBACK_20260802000000_add_chart_backend_foundation.sql.';
END
$$;
