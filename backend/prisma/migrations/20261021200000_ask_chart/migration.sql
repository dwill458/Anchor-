-- Ask Chart: additive only. No existing table or column is changed.
CREATE TABLE "chart_conversations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anchor_id" TEXT NOT NULL,
  "course_id" TEXT,
  "mode" VARCHAR(8) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chart_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chart_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chart_conversations_anchor_id_fkey" FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "chart_conversations_user_id_anchor_id_last_message_at_idx"
  ON "chart_conversations"("user_id", "anchor_id", "last_message_at");

CREATE TABLE "chart_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" VARCHAR(12) NOT NULL,
  "text" VARCHAR(4000) NOT NULL,
  "attachments" JSONB,
  "structured" JSONB,
  "skill" VARCHAR(24),
  "meta" JSONB,
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chart_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chart_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chart_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chart_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "chart_messages_idempotency_key_key" ON "chart_messages"("idempotency_key");
CREATE INDEX "chart_messages_conversation_id_created_at_idx" ON "chart_messages"("conversation_id", "created_at");
CREATE INDEX "chart_messages_user_id_idx" ON "chart_messages"("user_id");

CREATE TABLE "chart_coach_profiles" (
  "user_id" TEXT NOT NULL,
  "style" VARCHAR(12) NOT NULL DEFAULT 'DRIVEN',
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chart_coach_profiles_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "chart_coach_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "chart_memories" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anchor_id" TEXT NOT NULL,
  "key" VARCHAR(24) NOT NULL,
  "value" VARCHAR(200) NOT NULL,
  "source" VARCHAR(16) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chart_memories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chart_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chart_memories_anchor_id_fkey" FOREIGN KEY ("anchor_id") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "chart_memories_user_id_anchor_id_key_key" ON "chart_memories"("user_id", "anchor_id", "key");
