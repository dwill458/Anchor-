ALTER TABLE "user_settings"
ADD COLUMN "focusSessionMode" TEXT NOT NULL DEFAULT 'quick',
ADD COLUMN "focusSessionDuration" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "primeSessionDuration" INTEGER NOT NULL DEFAULT 120;
