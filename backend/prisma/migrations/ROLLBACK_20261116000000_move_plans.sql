-- Rollback for 20261116000000_move_plans. Drops only the four additive plan columns.
ALTER TABLE "moves" DROP COLUMN IF EXISTS "plan_remind",
DROP COLUMN IF EXISTS "plan_time",
DROP COLUMN IF EXISTS "plan_date",
DROP COLUMN IF EXISTS "plan_cue";
