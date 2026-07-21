-- Complete the account-scoped canonical practice ledger and backfill legacy
-- completion rows. Historical entries have no trustworthy timezone metadata,
-- so their local date is explicitly inferred in UTC and marked as restored.

ALTER TABLE "practice_sessions"
  ADD COLUMN "local_date_key" TEXT,
  ADD COLUMN "time_zone" TEXT,
  ADD COLUMN "utc_offset_minutes_at_completion" INTEGER,
  ADD COLUMN "completion_source" TEXT,
  ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "legacy_type" TEXT,
  ADD COLUMN "metadata" JSONB;

UPDATE "practice_sessions"
SET
  "local_date_key" = TO_CHAR("completed_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  "time_zone" = 'UTC',
  "utc_offset_minutes_at_completion" = 0,
  "completion_source" = 'restored',
  "metadata" = COALESCE("metadata", '{}'::jsonb) || '{"historicalTimezoneInferred":true}'::jsonb
WHERE "local_date_key" IS NULL;

ALTER TABLE "practice_sessions"
  ALTER COLUMN "local_date_key" SET NOT NULL,
  ALTER COLUMN "time_zone" SET NOT NULL,
  ALTER COLUMN "utc_offset_minutes_at_completion" SET NOT NULL,
  ALTER COLUMN "completion_source" SET NOT NULL;

INSERT INTO "practice_sessions" (
  "id", "userId", "anchorId", "anchor_local_id", "anchor_server_id_snapshot",
  "practice_mode", "planned_duration_seconds", "completed_duration_seconds",
  "completion_status", "started_at", "completed_at", "local_date_key", "time_zone",
  "utc_offset_minutes_at_completion", "completion_source", "schema_version", "legacy_type",
  "guidance_voice", "background_audio", "client_version", "metadata", "updated_at"
)
SELECT
  COALESCE(NULLIF(a."client_event_id", ''), 'legacy-activation:' || a."id"),
  a."userId", a."anchorId", a."anchorId", a."anchorId",
  CASE WHEN a."activationType" = 'deep' THEN 'deep_prime' ELSE 'focus' END,
  GREATEST(COALESCE(a."durationSeconds", 10), 1),
  GREATEST(COALESCE(a."durationSeconds", 10), 1),
  'completed',
  a."activatedAt" - MAKE_INTERVAL(secs => GREATEST(COALESCE(a."durationSeconds", 10), 1)),
  a."activatedAt", TO_CHAR(a."activatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 'UTC', 0,
  'restored', 2, 'activation:' || a."activationType", 'none', 'off', 'legacy-migration',
  '{"historicalTimezoneInferred":true,"migratedFrom":"activations"}'::jsonb, NOW()
FROM "activations" a
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "practice_sessions" (
  "id", "userId", "anchorId", "anchor_local_id", "anchor_server_id_snapshot",
  "practice_mode", "planned_duration_seconds", "completed_duration_seconds",
  "completion_status", "started_at", "completed_at", "local_date_key", "time_zone",
  "utc_offset_minutes_at_completion", "completion_source", "schema_version", "legacy_type",
  "guidance_voice", "background_audio", "client_version", "metadata", "updated_at"
)
SELECT
  COALESCE(NULLIF(c."client_event_id", ''), 'legacy-charge:' || c."id"),
  c."userId", c."anchorId", c."anchorId", c."anchorId", 'deep_prime',
  GREATEST(COALESCE(c."durationSeconds", 60), 1),
  GREATEST(COALESCE(c."durationSeconds", 60), 1),
  'completed',
  c."chargedAt" - MAKE_INTERVAL(secs => GREATEST(COALESCE(c."durationSeconds", 60), 1)),
  c."chargedAt", TO_CHAR(c."chargedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 'UTC', 0,
  'restored', 2, 'charge:' || c."chargeType", 'none',
  CASE WHEN c."ambientSound" IS NULL THEN 'off' ELSE 'ambient' END,
  'legacy-migration',
  '{"historicalTimezoneInferred":true,"migratedFrom":"charges"}'::jsonb, NOW()
FROM "charges" c
WHERE c."completed" = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM "activations" a
    WHERE a."userId" = c."userId"
      AND a."anchorId" = c."anchorId"
      AND (
        (c."client_event_id" IS NOT NULL AND a."client_event_id" = c."client_event_id")
        OR ABS(EXTRACT(EPOCH FROM (a."activatedAt" - c."chargedAt"))) <= 1
      )
  )
ON CONFLICT ("id") DO NOTHING;

-- Burned anchors retain immutable JSON snapshots after their live activation
-- and charge rows cascade away. Restore those completions into the same ledger.
INSERT INTO "practice_sessions" (
  "id", "userId", "anchorId", "anchor_local_id", "anchor_server_id_snapshot",
  "practice_mode", "planned_duration_seconds", "completed_duration_seconds",
  "completion_status", "started_at", "completed_at", "local_date_key", "time_zone",
  "utc_offset_minutes_at_completion", "completion_source", "schema_version", "legacy_type",
  "guidance_voice", "background_audio", "client_version", "metadata", "updated_at"
)
SELECT
  COALESCE(NULLIF(j.item->>'clientEventId', ''), 'legacy-burned-activation:' || b."id" || ':' || (j.item->>'id')),
  b."userId", NULL, b."originalAnchorId", b."originalAnchorId",
  CASE WHEN j.item->>'activationType' = 'deep' THEN 'deep_prime' ELSE 'focus' END,
  GREATEST(COALESCE((j.item->>'durationSeconds')::INTEGER, 10), 1),
  GREATEST(COALESCE((j.item->>'durationSeconds')::INTEGER, 10), 1), 'completed',
  (j.item->>'activatedAt')::TIMESTAMP - MAKE_INTERVAL(secs => GREATEST(COALESCE((j.item->>'durationSeconds')::INTEGER, 10), 1)),
  (j.item->>'activatedAt')::TIMESTAMP,
  TO_CHAR((j.item->>'activatedAt')::TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  'UTC', 0, 'restored', 2, 'burned_activation:' || (j.item->>'activationType'),
  'none', 'off', 'legacy-migration',
  '{"historicalTimezoneInferred":true,"migratedFrom":"burned_anchor_activation_history"}'::jsonb, NOW()
FROM "burned_anchors" b
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(b."activation_history") = 'array'
    THEN b."activation_history" ELSE '[]'::jsonb END
) AS j(item)
WHERE j.item ? 'id' AND j.item ? 'activatedAt'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "practice_sessions" (
  "id", "userId", "anchorId", "anchor_local_id", "anchor_server_id_snapshot",
  "practice_mode", "planned_duration_seconds", "completed_duration_seconds",
  "completion_status", "started_at", "completed_at", "local_date_key", "time_zone",
  "utc_offset_minutes_at_completion", "completion_source", "schema_version", "legacy_type",
  "guidance_voice", "background_audio", "client_version", "metadata", "updated_at"
)
SELECT
  COALESCE(NULLIF(j.item->>'clientEventId', ''), 'legacy-burned-charge:' || b."id" || ':' || (j.item->>'id')),
  b."userId", NULL, b."originalAnchorId", b."originalAnchorId", 'deep_prime',
  GREATEST(COALESCE((j.item->>'durationSeconds')::INTEGER, 60), 1),
  GREATEST(COALESCE((j.item->>'durationSeconds')::INTEGER, 60), 1), 'completed',
  (j.item->>'chargedAt')::TIMESTAMP - MAKE_INTERVAL(secs => GREATEST(COALESCE((j.item->>'durationSeconds')::INTEGER, 60), 1)),
  (j.item->>'chargedAt')::TIMESTAMP,
  TO_CHAR((j.item->>'chargedAt')::TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  'UTC', 0, 'restored', 2, 'burned_charge:' || (j.item->>'chargeType'),
  'none', CASE WHEN j.item->>'ambientSound' IS NULL THEN 'off' ELSE 'ambient' END,
  'legacy-migration',
  '{"historicalTimezoneInferred":true,"migratedFrom":"burned_anchor_charge_history"}'::jsonb, NOW()
FROM "burned_anchors" b
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(b."charge_history") = 'array'
    THEN b."charge_history" ELSE '[]'::jsonb END
) AS j(item)
WHERE j.item ? 'id' AND j.item ? 'chargedAt'
  AND COALESCE((j.item->>'completed')::BOOLEAN, TRUE) = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(b."activation_history") = 'array'
        THEN b."activation_history" ELSE '[]'::jsonb END
    ) AS a(item)
    WHERE
      (j.item->>'clientEventId' IS NOT NULL AND a.item->>'clientEventId' = j.item->>'clientEventId')
      OR ABS(EXTRACT(EPOCH FROM ((a.item->>'activatedAt')::TIMESTAMP - (j.item->>'chargedAt')::TIMESTAMP))) <= 1
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "practice_sessions" (
  "id", "userId", "anchorId", "anchor_local_id", "anchor_server_id_snapshot",
  "practice_mode", "planned_duration_seconds", "completed_duration_seconds",
  "completion_status", "started_at", "completed_at", "local_date_key", "time_zone",
  "utc_offset_minutes_at_completion", "completion_source", "schema_version", "legacy_type",
  "guidance_voice", "background_audio", "client_version", "metadata", "updated_at"
)
SELECT
  'legacy-release:' || b."id", b."userId", NULL, b."originalAnchorId", b."originalAnchorId",
  'release', 45, 45, 'completed', b."burnedAt" - INTERVAL '45 seconds', b."burnedAt",
  TO_CHAR(b."burnedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 'UTC', 0, 'restored', 2, 'burn',
  'none', 'off', 'legacy-migration',
  '{"historicalTimezoneInferred":true,"migratedFrom":"burned_anchors"}'::jsonb, NOW()
FROM "burned_anchors" b
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX "practice_sessions_userId_local_date_key_idx"
ON "practice_sessions"("userId", "local_date_key");
