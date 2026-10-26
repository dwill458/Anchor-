-- AlterTable
ALTER TABLE "user_settings"
  ADD COLUMN "thread_strength_sensitivity" TEXT NOT NULL DEFAULT 'balanced',
  ADD COLUMN "decay_preferences_history" JSONB,
  ADD COLUMN "rest_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "thread_v2_states"
  ALTER COLUMN "rule_version" SET DEFAULT 'v2.0-authoritative';
