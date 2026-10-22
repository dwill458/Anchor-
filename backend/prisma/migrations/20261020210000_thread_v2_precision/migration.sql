-- AlterTable: non-destructive precision migration from INTEGER to DOUBLE PRECISION
ALTER TABLE "thread_v2_states" ALTER COLUMN "strength" TYPE DOUBLE PRECISION;
ALTER TABLE "thread_v2_movements" ALTER COLUMN "before_strength" TYPE DOUBLE PRECISION;
ALTER TABLE "thread_v2_movements" ALTER COLUMN "after_strength" TYPE DOUBLE PRECISION;
ALTER TABLE "thread_v2_movements" ALTER COLUMN "delta" TYPE DOUBLE PRECISION;
