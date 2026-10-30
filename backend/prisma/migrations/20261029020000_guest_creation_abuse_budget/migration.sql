CREATE TABLE "anchor_creation_abuse_budgets" (
  "key" TEXT PRIMARY KEY,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL
);
-- Several authorized enhancement sessions may update the same existing Anchor.
-- Each session still stores exactly one target, including after target deletion.
DROP INDEX "anchor_creation_sessions_saved_anchor_id_key";
CREATE INDEX "anchor_creation_sessions_saved_anchor_id_idx" ON "anchor_creation_sessions"("saved_anchor_id");
