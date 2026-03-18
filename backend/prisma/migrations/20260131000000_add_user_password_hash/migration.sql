-- Add password hash column for email/password auth
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;

-- Optional: keep authUid in sync for existing email users (if any)
-- UPDATE "users" SET "authUid" = "email" WHERE "authProvider" = 'email' AND "authUid" IS NULL;
