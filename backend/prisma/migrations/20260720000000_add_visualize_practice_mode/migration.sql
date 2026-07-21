-- Additive Visualize/canonical-practice migration. Legacy activation and charge
-- tables intentionally remain untouched for backward-compatible restoration.

ALTER TABLE "user_settings"
ADD COLUMN "visualizeSessionDuration" INTEGER NOT NULL DEFAULT 180;

ALTER TABLE "user_settings"
ALTER COLUMN "sessionAudioDefaults"
SET DEFAULT '{"focus":{"guidanceVoice":"female","backgroundAudio":"ambient"},"deep_prime":{"guidanceVoice":"female","backgroundAudio":"ambient"},"visualize":{"guidanceVoice":"female","backgroundAudio":"ambient"}}';

UPDATE "user_settings"
SET "sessionAudioDefaults" = COALESCE("sessionAudioDefaults", '{}'::jsonb) ||
  '{"visualize":{"guidanceVoice":"female","backgroundAudio":"ambient"}}'::jsonb
WHERE NOT (COALESCE("sessionAudioDefaults", '{}'::jsonb) ? 'visualize');

CREATE TABLE "practice_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "anchorId" TEXT,
  "anchor_local_id" TEXT,
  "anchor_server_id_snapshot" TEXT,
  "practice_mode" TEXT NOT NULL,
  "planned_duration_seconds" INTEGER NOT NULL,
  "completed_duration_seconds" INTEGER NOT NULL,
  "completion_status" TEXT NOT NULL DEFAULT 'completed',
  "started_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL,
  "guidance_voice" TEXT NOT NULL,
  "background_audio" TEXT NOT NULL,
  "scene_snapshot" TEXT,
  "next_action" TEXT,
  "client_version" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualization_scenes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "anchorId" TEXT NOT NULL,
  "current_text" TEXT NOT NULL,
  "original_suggestion" TEXT NOT NULL,
  "generation_source" TEXT NOT NULL,
  "generation_version" TEXT NOT NULL,
  "client_updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visualization_scenes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practice_sessions_userId_completed_at_idx"
ON "practice_sessions"("userId", "completed_at");
CREATE INDEX "practice_sessions_userId_practice_mode_idx"
ON "practice_sessions"("userId", "practice_mode");
CREATE INDEX "practice_sessions_userId_anchorId_idx"
ON "practice_sessions"("userId", "anchorId");
CREATE UNIQUE INDEX "visualization_scenes_anchorId_key"
ON "visualization_scenes"("anchorId");
CREATE UNIQUE INDEX "visualization_scenes_userId_anchorId_key"
ON "visualization_scenes"("userId", "anchorId");
CREATE INDEX "visualization_scenes_userId_updated_at_idx"
ON "visualization_scenes"("userId", "updated_at");

ALTER TABLE "practice_sessions"
ADD CONSTRAINT "practice_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_sessions"
ADD CONSTRAINT "practice_sessions_anchorId_fkey"
FOREIGN KEY ("anchorId") REFERENCES "anchors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "visualization_scenes"
ADD CONSTRAINT "visualization_scenes_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualization_scenes"
ADD CONSTRAINT "visualization_scenes_anchorId_fkey"
FOREIGN KEY ("anchorId") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
