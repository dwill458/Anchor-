-- Additive evidence only. Existing award IDs, dates and definitions are untouched.
ALTER TABLE "visions" ADD COLUMN "first_committed_at" TIMESTAMP(3), ADD COLUMN "board_completed_at" TIMESTAMP(3);

-- A saved image or authored note proves completed Vision content. A generation shell does not.
UPDATE "visions" v SET "first_committed_at" = evidence.first_at
FROM (SELECT "vision_id", MIN("created_at") AS first_at FROM (
  SELECT "vision_id", "created_at" FROM "vision_scenes" WHERE "asset_id" IS NOT NULL
  UNION ALL SELECT "vision_id", "created_at" FROM "vision_notes"
) content GROUP BY "vision_id") evidence
WHERE v.id = evidence.vision_id;

-- Only a board currently containing eight distinct images is provable. Do not invent the
-- historical moment an edited board once reached eight; capture this verified snapshot.
UPDATE "visions" v SET "board_completed_at" = CURRENT_TIMESTAMP
FROM (SELECT "vision_id" FROM "vision_scenes" WHERE NOT "is_archived" AND "asset_id" IS NOT NULL GROUP BY "vision_id" HAVING COUNT(DISTINCT "asset_id") >= 8) evidence
WHERE v.id = evidence.vision_id;
