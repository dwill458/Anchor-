CREATE TABLE "anchor_creation_quota_owners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anchor_creation_quota_owners_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anchor_creation_quota_owner_identity" CHECK ("user_id" IS NOT NULL OR "guest_token_hash" IS NOT NULL),
    CONSTRAINT "anchor_creation_quota_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "anchor_creation_quota_owners_user_id_key" ON "anchor_creation_quota_owners"("user_id");
CREATE UNIQUE INDEX "anchor_creation_quota_owners_guest_token_hash_key" ON "anchor_creation_quota_owners"("guest_token_hash");

CREATE TABLE "anchor_creation_sessions" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "quota_scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "anchor_creation_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anchor_creation_sessions_status_check" CHECK ("status" IN ('reserved', 'completed', 'failed', 'expired')),
    CONSTRAINT "anchor_creation_sessions_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "anchor_creation_sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "anchor_creation_quota_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "anchor_creation_sessions_owner_id_idempotency_key_key" ON "anchor_creation_sessions"("owner_id", "idempotency_key");
CREATE INDEX "anchor_creation_sessions_owner_id_quota_scope_status_idx" ON "anchor_creation_sessions"("owner_id", "quota_scope", "status");

CREATE TABLE "anchor_creation_options" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anchor_creation_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anchor_creation_options_position_check" CHECK ("position" BETWEEN 0 AND 1),
    CONSTRAINT "anchor_creation_options_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "anchor_creation_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "anchor_creation_options_session_id_position_key" ON "anchor_creation_options"("session_id", "position");
