ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "notification_state" JSONB,
  ADD COLUMN IF NOT EXISTS "expo_push_token" TEXT,
  ADD COLUMN IF NOT EXISTS "fcm_token" TEXT,
  ADD COLUMN IF NOT EXISTS "apns_token" TEXT,
  ADD COLUMN IF NOT EXISTS "notifications_enabled" BOOLEAN NOT NULL DEFAULT true;
