-- Migration: add_anchor_query_indexes
-- Adds composite indexes to the anchors table to cover common query patterns
-- in GET /api/anchors (vault list endpoint).
--
-- Every vault query filters WHERE userId = ? AND isArchived = false,
-- optionally filters isCharged, and sorts by updatedAt or createdAt.
-- The existing single-column index on userId does not cover these filters,
-- causing a full index scan + filter pass at scale.

-- For fresh-database deploys, use regular index creation so Prisma can run this
-- migration inside its default transaction.
CREATE INDEX IF NOT EXISTS "anchors_userId_isArchived_idx"
  ON "anchors"("userId", "isArchived");

-- Covers: WHERE userId = ? AND isCharged = ?  (optional filter in GET /api/anchors)
CREATE INDEX IF NOT EXISTS "anchors_userId_isCharged_idx"
  ON "anchors"("userId", "isCharged");

-- Covers: WHERE userId = ? ORDER BY updatedAt DESC  (default sort)
CREATE INDEX IF NOT EXISTS "anchors_userId_updatedAt_idx"
  ON "anchors"("userId", "updatedAt" DESC);

-- Covers: WHERE userId = ? ORDER BY createdAt DESC  (createdAt sort option)
CREATE INDEX IF NOT EXISTS "anchors_userId_createdAt_idx"
  ON "anchors"("userId", "createdAt" DESC);
