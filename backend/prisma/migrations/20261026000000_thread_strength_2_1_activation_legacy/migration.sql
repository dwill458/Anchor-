-- Thread Strength 2.1: one-time activation bonus + protected legacy baseline.
-- Additive only. No existing strength, movement, session or milestone value is changed.

ALTER TABLE "thread_v2_states"
  ADD COLUMN "activation_status" TEXT,
  ADD COLUMN "activation_session_id" TEXT,
  ADD COLUMN "activation_awarded_at" TIMESTAMP(3),
  ADD COLUMN "legacy_baseline_strength" DOUBLE PRECISION,
  ADD COLUMN "legacy_baseline_at" TIMESTAMP(3),
  ADD COLUMN "legacy_baseline_date_key" TEXT,
  ADD COLUMN "legacy_baseline_session_id" TEXT,
  ADD COLUMN "legacy_baseline_source" TEXT,
  ADD COLUMN "legacy_baseline_applied_at" TIMESTAMP(3);

ALTER TABLE "thread_v2_states"
  ALTER COLUMN "rule_version" SET DEFAULT 'v2.1-authoritative';

ALTER TABLE "thread_v2_movements"
  ADD COLUMN "activation_bonus" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Every Anchor that has already completed an eligible practice is exempt from the
-- activation bonus. It must never be awarded retroactively or a second time.
UPDATE "thread_v2_states" s
SET "activation_status" = 'legacy_exempt'
WHERE s."activation_status" IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM "thread_v2_movements" m
      WHERE m."user_id" = s."userId" AND m."anchor_id" = s."anchorId"
        AND m."practice_type" <> 'release'
    )
    OR EXISTS (
      SELECT 1 FROM "practice_sessions" p
      WHERE p."userId" = s."userId" AND p."anchorId" = s."anchorId"
        AND p."completion_status" = 'completed' AND p."practice_mode" <> 'release'
    )
  );

-- Anchors with completed practice but no state row yet (movements are synced lazily).
INSERT INTO "thread_v2_states"
  ("id", "userId", "anchorId", "strength", "rule_version", "activation_status", "updated_at")
SELECT gen_random_uuid()::text, p."userId", p."anchorId", 0, 'v2.1-authoritative', 'legacy_exempt', CURRENT_TIMESTAMP
FROM "practice_sessions" p
WHERE p."anchorId" IS NOT NULL
  AND p."completion_status" = 'completed'
  AND p."practice_mode" <> 'release'
GROUP BY p."userId", p."anchorId"
ON CONFLICT ("userId", "anchorId") DO NOTHING;
