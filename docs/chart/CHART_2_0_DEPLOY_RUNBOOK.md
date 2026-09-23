# Chart 2.0 — deploy runbook

Everything needed to turn Chart on in production, in order. Written 2026-09-22.
Nothing here has been run: the code is uncommitted on `feat/home-visual-parity`.

**Why Chart currently fails on a device:** the app talks to the Railway backend,
which runs `main`. `main` has no `/api/v2/anchors/:id/chart` route, so every Chart
request 404s and the screen says Chart isn't available yet.

---

## 0. Pre-flight (read-only, ~2 min)

Run in the Supabase SQL editor against the production database. Both queries
should return `0`. They prove the new unique indexes cannot fail on existing data.

```sql
-- Anchors that already have more than one ACTIVE Course (must be 0)
SELECT count(*) FROM (
  SELECT l.anchor_id
  FROM courses c
  JOIN course_anchor_links l
    ON l.course_id = c.id AND l.role = 'DESTINATION' AND l.unlinked_at IS NULL
  WHERE c.status = 'ACTIVE' AND c.deleted_at IS NULL AND l.anchor_id IS NOT NULL
  GROUP BY c.user_id, l.anchor_id HAVING count(*) > 1
) dupes;

-- Users with more than one ACTIVE Course that has no Anchor link (must be 0)
SELECT count(*) FROM (
  SELECT c.user_id
  FROM courses c
  WHERE c.status = 'ACTIVE' AND c.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM course_anchor_links l
      WHERE l.course_id = c.id AND l.role = 'DESTINATION' AND l.unlinked_at IS NULL
    )
  GROUP BY c.user_id HAVING count(*) > 1
) dupes;
```

If either returns more than 0, stop and say so — the migration's unique indexes
would fail and the backend would crash-loop on boot (see step 4).

---

## 1. Review the migration

`backend/prisma/migrations/20260922000000_chart_anchor_routes_and_moves/migration.sql`

It is additive except for one index swap:

| Change | Risk |
| --- | --- |
| `courses` gains `anchor_id`, `vision_id`, `complexity`, `current_move_id` | none (nullable) |
| backfills `anchor_id` from active DESTINATION links | none (one UPDATE) |
| **drops** `courses_one_active_per_user` | this is the rule change: one active Chart per Anchor instead of per user |
| adds `courses_one_active_per_anchor` + `courses_one_active_unanchored_per_user` | fails only if step 0 returned > 0 |
| `waypoints` gains `kind` + 4 metric columns | none (defaults) |
| new `moves` table | none |
| `CourseEventType` gains `MOVE_COMPLETED`, `ROUTE_ADJUSTED` | none |
| `ai_plan_proposals` gains 5 columns | none (nullable/defaulted) |

Verified: applied cleanly to a disposable Postgres 17 with the full migration
history, and `prisma migrate diff` reports no drift for these tables.

---

## 2. Set the Railway variables (before deploying)

Railway → project **Anchor** → service **Anchor-** → Variables. Add:

```
ENABLE_CHART=true
ENABLE_CHART_WRITE=true
ENABLE_CHART_AI_PLANNER=true
```

Optional — OpenAI as the primary planner (Gemini stays as the fallback):

```
OPENAI_API_KEY=sk-...
CHART_OPENAI_MODEL=gpt-4.1-mini        # only if you want a different model
```

Without `OPENAI_API_KEY`, Gemini (`gemini-3.5-flash-lite`, the key already set)
is the only provider, and a deterministic outline is the last resort. Chart
creation still works with no AI at all.

Optional tuning (defaults shown):

```
CHART_AI_PRIMARY_TIMEOUT_MS=20000
CHART_AI_FALLBACK_TIMEOUT_MS=15000
CHART_GEMINI_MODEL=gemini-3.5-flash-lite
```

Saving variables redeploys the current `main`. That is harmless: `main` has no
Chart code, and the flags do nothing until step 3.

---

## 3. Ship the backend

Railway deploys from `main`, so this work has to be merged. From `E:\Projects\Anchor`:

```bash
git checkout -b feat/chart-2.0
git add -A
git commit -m "feat(chart): Anchor 2.0 Chart — per-Anchor routes, Moves, AI planner"
git push -u origin feat/chart-2.0
# open a PR into main, then merge it
```

`npm start` runs `prisma migrate deploy` before the server boots, so **merging
applies the migration automatically**. No manual migrate command is needed.

---

## 4. Watch the first boot

Railway → service **Anchor-** → Deployments → Logs. Expect:

```
... Applying migration `20260922000000_chart_anchor_routes_and_moves`
... Server running on port ...
```

If the migration fails the process exits and Railway restarts it in a loop; the
old version stays live only until the new deploy replaces it, so treat a failure
as urgent:

1. Copy the Postgres error from the logs.
2. Roll back by redeploying the previous deployment in Railway (Deployments → the
   last good one → Redeploy).
3. The migration is transactional: a failure leaves the database unchanged.

---

## 5. Verify

Do **not** curl the endpoint to check this. Every `/api/v2/*` path answers `401
UNAUTHORIZED` without a token, whether or not the route exists (the V2 routers
apply auth before matching), so curl cannot tell you if Chart deployed. Confirm
instead that Railway's active deployment points at the merge commit, and that the
boot log shows the migration applied.

Then in the app, on an Anchor with no Chart:

1. Open Chart → "Give this Anchor somewhere to go."
2. Create a Chart → answer "Where are you starting from?" → the map reveal runs.
3. A route comes back → rename a waypoint → **Looks right** → "Your route is ready."
4. Home shows `YOUR CHART`, the waypoint position and the One Move.
5. Complete the One Move → it disappears and Progress gains "Move completed".

If step 3 returns a plain outline with "We couldn't map this one automatically",
the AI providers were unreachable — check `GEMINI_API_KEY`/`OPENAI_API_KEY` and
the `chart_planner_attempt` log lines (they record provider, outcome and latency,
never user content).

---

## 6. Mobile

The Chart UI is mobile-side and ships with the app bundle, not with the backend:

- **Dev (Metro)**: already running from this tree.
- **Testers/production**: the OTA branch is `codex/phase-1-smart-notifications`
  (see the branch/deploy split note) — this work must reach that branch and be
  published with EAS Update before anyone but you sees Chart.

---

## Rollback

Fastest: set `ENABLE_CHART=false` in Railway. Every Chart endpoint then returns
`FEATURE_DISABLED`, and the app shows "Chart isn't available yet." Data is kept.

To undo the schema (only if truly needed — this drops saved Moves):

```sql
BEGIN;
DROP INDEX IF EXISTS "courses_one_active_per_anchor";
DROP INDEX IF EXISTS "courses_one_active_unanchored_per_user";
CREATE UNIQUE INDEX "courses_one_active_per_user"
  ON "courses"("user_id") WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL;
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_current_move_id_fkey";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "current_move_id";
DROP TABLE IF EXISTS "moves";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "anchor_id",
  DROP COLUMN IF EXISTS "vision_id", DROP COLUMN IF EXISTS "complexity";
ALTER TABLE "waypoints" DROP COLUMN IF EXISTS "kind",
  DROP COLUMN IF EXISTS "metric_label", DROP COLUMN IF EXISTS "metric_baseline",
  DROP COLUMN IF EXISTS "metric_target", DROP COLUMN IF EXISTS "metric_current";
ALTER TABLE "ai_plan_proposals" DROP COLUMN IF EXISTS "anchor_id",
  DROP COLUMN IF EXISTS "kind", DROP COLUMN IF EXISTS "complexity",
  DROP COLUMN IF EXISTS "suggested_one_move", DROP COLUMN IF EXISTS "guidance";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260922000000_chart_anchor_routes_and_moves';
COMMIT;
```

Enum values added to `CourseEventType` cannot be dropped in Postgres; they are
harmless if unused.
