-- Emergency destructive rollback. Prefer turning the WEEKLY_RECAP_V2 flag off and keeping these additive columns.
-- Back up schema_version = 2 rows first (their JSON is not recoverable from legacy columns).
DROP INDEX "weekly_insight_snapshots_user_id_scope_key_week_key_key";
ALTER TABLE "weekly_insight_snapshots"
  DROP CONSTRAINT "weekly_insight_snapshots_week_key_check",
  DROP CONSTRAINT "weekly_insight_snapshots_provenance_check",
  DROP CONSTRAINT "weekly_insight_snapshots_status_check",
  DROP COLUMN "provenance", DROP COLUMN "finalized_at", DROP COLUMN "status",
  DROP COLUMN "schema_version", DROP COLUMN "time_zone", DROP COLUMN "week_key", DROP COLUMN "scope_key";
