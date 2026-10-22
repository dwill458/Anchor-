-- Preserve the optional baseline that informed a Chart plan and its accepted
-- Course. Both columns are nullable so existing proposals and Courses retain
-- their current semantics without a backfill or inferred user data.
ALTER TABLE "ai_plan_proposals"
  ADD COLUMN "starting_context" VARCHAR(500);

ALTER TABLE "courses"
  ADD COLUMN "starting_context" VARCHAR(500);
