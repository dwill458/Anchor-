-- Client-generated key so a retried POST /api/anchors (e.g. after the client
-- never received the response, even though the anchor was created) returns
-- the original anchor instead of creating a duplicate.
ALTER TABLE "anchors"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "anchors_idempotency_key_key"
  ON "anchors" ("idempotency_key");
