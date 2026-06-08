ALTER TABLE "user_settings"
ADD COLUMN "focusSessionAudio" TEXT NOT NULL DEFAULT 'ambient',
ADD COLUMN "primeSessionAudio" TEXT NOT NULL DEFAULT 'ambient';
