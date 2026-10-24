-- Weekly Insight 2.0: a real global scope, timezone-safe week identity, schema version and a draft/final lifecycle.
-- Additive only. Legacy rows (client-authored, schema_version 1) are untouched and stay readable.
ALTER TABLE "weekly_insight_snapshots"
  ADD COLUMN "scope_key"      TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN "week_key"       TEXT,
  ADD COLUMN "time_zone"      TEXT,
  ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "status"         TEXT NOT NULL DEFAULT 'FINAL',
  ADD COLUMN "finalized_at"   TIMESTAMP(3),
  ADD COLUMN "provenance"     TEXT NOT NULL DEFAULT 'LIVE';

-- Legacy per-Anchor rows keep their scope; legacy global rows keep 'GLOBAL'.
UPDATE "weekly_insight_snapshots" SET "scope_key" = COALESCE("anchor_id", 'GLOBAL');

ALTER TABLE "weekly_insight_snapshots"
  ADD CONSTRAINT "weekly_insight_snapshots_status_check" CHECK ("status" IN ('DRAFT', 'FINAL')),
  ADD CONSTRAINT "weekly_insight_snapshots_provenance_check" CHECK ("provenance" IN ('LIVE', 'RECONSTRUCTED')),
  ADD CONSTRAINT "weekly_insight_snapshots_week_key_check" CHECK ("week_key" IS NULL OR "week_key" ~ '^\d{4}-\d{2}-\d{2}$');

-- Legacy rows have a NULL week_key; NULLs are distinct, so this constrains only schema_version 2 rows.
CREATE UNIQUE INDEX "weekly_insight_snapshots_user_id_scope_key_week_key_key"
  ON "weekly_insight_snapshots"("user_id", "scope_key", "week_key");
