-- Add onboarding completion flag to users
ALTER TABLE "users"
  ADD COLUMN "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;
