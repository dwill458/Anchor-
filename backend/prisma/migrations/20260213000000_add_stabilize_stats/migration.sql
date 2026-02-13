-- Add Stabilize practice stats to users
ALTER TABLE "users"
  ADD COLUMN "stabilizesTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stabilizeStreakDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastStabilizeAt" TIMESTAMP(3);

