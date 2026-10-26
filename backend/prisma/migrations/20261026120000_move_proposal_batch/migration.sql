ALTER TABLE "moves" ADD COLUMN "batch_id" TEXT;
CREATE INDEX "moves_batch_id_idx" ON "moves"("batch_id");
