# Migration: Add Refactor Architecture Fields

**Date:** 2026-01-19
**Phase:** Phase 1 - Foundation & Data Model
**Status:** Ready for deployment

---

## Overview

This migration adds the new data model fields required for the architecture refactor, transitioning from AI-first generation to deterministic structure + optional reinforcement + optional AI enhancement.

## Changes

### New Columns Added

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `reinforcedSigilSvg` | TEXT | Yes | NULL | User-traced reinforcement version |
| `structureVariant` | TEXT | No | `'balanced'` | Which deterministic variant was chosen |
| `reinforcementMetadata` | JSONB | Yes | NULL | Manual reinforcement session data |
| `enhancementMetadata` | JSONB | Yes | NULL | AI enhancement details |

### Indexes Added

- `anchors_structureVariant_idx` - For analytics queries on structure variant distribution

### Data Backfill

#### Existing Anchors (reinforcementMetadata)
All existing anchors are marked as having skipped reinforcement:
```json
{
  "completed": false,
  "skipped": true,
  "strokeCount": 0,
  "fidelityScore": 0,
  "timeSpentMs": 0
}
```

#### Existing AI-Enhanced Anchors (enhancementMetadata)
Anchors with `enhancedImageUrl` receive legacy metadata:
```json
{
  "styleApplied": "legacy",
  "modelUsed": "sdxl-text-to-image-legacy",
  "controlMethod": "none",
  "generationTimeMs": 0,
  "promptUsed": "legacy_generation",
  "negativePrompt": "",
  "appliedAt": "[anchor creation timestamp]"
}
```

---

## How to Apply

### Development / Staging

```bash
cd /home/user/Anchor-/backend

# Method 1: Using Prisma (if DB connection available)
npx prisma migrate deploy

# Method 2: Manual SQL execution
psql $DATABASE_URL -f prisma/migrations/20260119000000_add_refactor_architecture_fields/migration.sql
```

### Production

```bash
# 1. Backup database first
pg_dump $PRODUCTION_DATABASE_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration
psql $PRODUCTION_DATABASE_URL -f prisma/migrations/20260119000000_add_refactor_architecture_fields/migration.sql

# 3. Verify
psql $PRODUCTION_DATABASE_URL -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'anchors' ORDER BY ordinal_position;"
```

---

## Rollback

If you need to reverse this migration:

```bash
# WARNING: This will permanently delete data in new columns
# Backup first!

psql $DATABASE_URL -f prisma/migrations/ROLLBACK_add_refactor_architecture_fields.sql
```

---

## Verification Queries

### Check New Columns Exist
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'anchors'
AND column_name IN (
  'reinforcedSigilSvg',
  'structureVariant',
  'reinforcementMetadata',
  'enhancementMetadata'
);
```

### Count Existing Anchors by Structure Variant
```sql
SELECT
  "structureVariant",
  COUNT(*) as count
FROM anchors
GROUP BY "structureVariant";
```

### Check Backfilled Metadata
```sql
SELECT
  COUNT(*) as total_anchors,
  COUNT("reinforcementMetadata") as with_reinforcement_metadata,
  COUNT("enhancementMetadata") as with_enhancement_metadata
FROM anchors;
```

### Sample Metadata Values
```sql
SELECT
  id,
  "intentionText",
  "structureVariant",
  "reinforcementMetadata",
  "enhancementMetadata"
FROM anchors
LIMIT 5;
```

---

## Impact Assessment

### Backward Compatibility
✅ **Fully backward compatible**
- All new columns are nullable or have defaults
- Existing queries continue to work
- Existing anchors are preserved
- Legacy fields remain functional

### Performance
✅ **Minimal impact**
- Adding nullable columns is fast (no table rewrite)
- Index creation is concurrent-safe
- Backfill updates are simple

### Storage
📊 **Moderate increase**
- JSONB columns add ~200-500 bytes per anchor (when populated)
- Estimated increase: ~10-15% for fully populated anchors
- Existing anchors have minimal increase (only backfill metadata)

---

## Next Steps

After applying this migration:

1. ✅ **Update Prisma Client**
   ```bash
   npx prisma generate
   ```

2. ✅ **Update API Routes**
   - Modify anchor creation endpoint to accept new fields
   - Update anchor retrieval to return new fields
   - See: `/backend/src/api/routes/anchors.ts`

3. ✅ **Update Mobile Store**
   - Modify `anchorStore.ts` to handle new fields
   - Update anchor creation flow
   - See: `/apps/mobile/src/stores/anchorStore.ts`

4. ✅ **Test Data Flow**
   - Create new anchor with reinforcement
   - Create new anchor without reinforcement
   - Create new anchor with AI enhancement
   - Verify all data persists correctly

---

## Related Documentation

- [Architecture Refactor Plan](/docs/ARCHITECTURE_REFACTOR_PLAN.md)
- [Data Model Changes](/docs/ARCHITECTURE_REFACTOR_PLAN.md#2-data-model-changes)
- [Phase 1 Implementation Guide](/docs/ARCHITECTURE_REFACTOR_PLAN.md#phase-1-foundation--data-model-week-1-2)

---

## Questions or Issues?

If you encounter problems with this migration:
1. Check database logs for errors
2. Verify connection string and permissions
3. Ensure PostgreSQL version ≥ 12 (for JSONB support)
4. Review rollback script if needed

---

**Migration Author:** Claude (Architecture Team)
**Approved By:** [Awaiting approval]
**Applied On:** [To be filled when applied]
