-- Anchor 2.0 safety foundation. All operations are additive or relax a
-- constraint; existing timestamps and application data remain unchanged.

ALTER TABLE "users"
  ALTER COLUMN "trialStartedAt" DROP DEFAULT,
  ALTER COLUMN "trialStartedAt" DROP NOT NULL;

CREATE TABLE "thread_v2_states" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "anchorId" TEXT NOT NULL,
  "strength" INTEGER NOT NULL DEFAULT 50,
  "last_completed_at" TIMESTAMP(3),
  "rule_version" TEXT NOT NULL DEFAULT 'legacy-v1-defaults',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "thread_v2_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "thread_v2_movements" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anchor_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "practice_type" TEXT NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL,
  "before_strength" INTEGER NOT NULL,
  "after_strength" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "thread_v2_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thread_v2_states_userId_anchorId_key" ON "thread_v2_states"("userId", "anchorId");
CREATE INDEX "thread_v2_states_anchorId_idx" ON "thread_v2_states"("anchorId");
CREATE UNIQUE INDEX "thread_v2_movements_session_id_key" ON "thread_v2_movements"("session_id");
CREATE INDEX "thread_v2_movements_user_id_anchor_id_completed_at_idx" ON "thread_v2_movements"("user_id", "anchor_id", "completed_at");

ALTER TABLE "thread_v2_states"
  ADD CONSTRAINT "thread_v2_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "thread_v2_states_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
