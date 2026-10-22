# Chart rollback runbook

**Chart's production rollback is flag-based. It deletes nothing.**

There is no supported destructive production rollback. Dropping the Chart tables
permanently destroys every Reflection body, Course, Waypoint, Course Event,
Anchor link, and AI plan proposal, and re-applying the migration recovers none of
it. `prisma/migrations/ROLLBACK_20260802000000_add_chart_backend_foundation.sql`
therefore refuses to run; the destructive variant is named
`DEV_ONLY_DESTRUCTIVE_ROLLBACK_...` and is guarded for disposable development
databases only. Never point either at production.

---

## 1. Order of operations

Turn off the narrowest control that stops the problem. Each step is independent
and reversible; you do not need to run them all.

| Step | Variable | Set to | Effect |
| --- | --- | --- | --- |
| 1. Kill AI generation only | `ENABLE_CHART_AI_PLANNER` | `false` | `POST /api/course-plans` denies. Existing proposals stay retrievable and eligible ones stay acceptable. No quota is consumed. |
| 2. Stop new Reflection writes | `ENABLE_CHART_REFLECTIONS` | `false` | Reflection creation and editing deny. All existing Reflection text stays readable in the Course Log. |
| 3. Freeze all Chart writes | `ENABLE_CHART_WRITE` | `false` | Every Chart mutation returns `403 FEATURE_DISABLED`. Reads continue. |
| 4. Stop new exposure | `CHART_ROLLOUT_PERCENT` | `0` | No further accounts are bucketed into Chart. Already-bucketed accounts still resolve while `ENABLE_CHART` is true. |
| 5. Full withdrawal | `ENABLE_CHART` | `false` | Every Chart route returns `403`. Mobile resolves all Chart flags false and hides Chart surfaces. |
| 6. Emergency isolation | `CHART_KILL_SWITCH` | `true` | Overrides every other flag and the rollout assignment immediately, regardless of `ENABLE_CHART`. |

`CHART_KILL_SWITCH` is the single switch to reach for under time pressure: it
short-circuits flag composition and rollout bucketing in one move.

Apply a change by updating the backend environment and restarting/redeploying the
API. Flags are read per request from `env`, so no migration or data change is
involved.

## 2. What stays available at every step

- Sanctuary is unaffected.
- Practice is unaffected, including the canonical Practice completion path.
- Old clients keep writing schema-compatible `PracticeSession` rows; the Chart
  columns are nullable.
- Every Chart row is preserved: Courses, Waypoints, Course Events, Course/Anchor
  links, AI plan proposals, and all Reflection text.
- Account data export and account deletion continue to cover Chart entities.

Nothing in this procedure deletes or rewrites a row.

## 3. Verification queries

Run against the production database after the flag change. Counts must be
unchanged from before the rollback.

```sql
SELECT count(*) AS courses            FROM courses;
SELECT count(*) AS waypoints          FROM waypoints;
SELECT count(*) AS course_events      FROM course_events;
SELECT count(*) AS anchor_links       FROM course_anchor_links;
SELECT count(*) AS proposals          FROM ai_plan_proposals;

-- Reflection bodies must still be present, not merely the rows.
SELECT count(*) AS reflections,
       count(*) FILTER (WHERE body IS NOT NULL OR structured_content IS NOT NULL)
         AS with_content
FROM reflections
WHERE deleted_at IS NULL;

-- Practice keeps working for old and new clients.
SELECT count(*) AS practice_sessions,
       count(*) FILTER (WHERE course_id IS NULL) AS non_chart_sessions
FROM practice_sessions;

-- Chart stays migrated; rollback is not a schema change.
SELECT DISTINCT chart_schema_version FROM users;
```

Confirm from the application side:

```bash
# Chart denied while flags are off
curl -s -H "Authorization: Bearer $TOKEN" "$API/api/courses" | jq .error.code   # FEATURE_DISABLED

# Capability projection reports the withdrawal
curl -s -H "Authorization: Bearer $TOKEN" "$API/api/auth/me" | jq .data.chart

# Practice is untouched
curl -s -X POST -H "Authorization: Bearer $TOKEN" "$API/api/practice/stabilize" -d @session.json
```

## 4. Recovery

Re-enable in the reverse order of withdrawal:

1. `CHART_KILL_SWITCH=false`
2. `ENABLE_CHART=true`
3. `CHART_ROLLOUT_PERCENT` back to the intended percentage
4. `ENABLE_CHART_WRITE=true`
5. `ENABLE_CHART_REFLECTIONS=true`
6. `ENABLE_CHART_AI_PLANNER=true` (also needs a valid server-only `GOOGLE_API_KEY`
   and valid planner quota configuration, or generation stays closed with
   `PLANNER_UNAVAILABLE`)

Re-enabling restores access to the preserved data exactly as it was. Because
rollout bucketing is a deterministic hash of the account id, the same accounts
land in the same buckets, so returning `CHART_ROLLOUT_PERCENT` to its previous
value restores the previous cohort rather than reshuffling it. No data migration,
backfill, or replay is required.

Re-run the verification queries in §3 and confirm the counts still match.

## 5. Disposable development databases

Only for a throwaway database you are willing to lose entirely — for example to
re-apply the migration while developing it:

```bash
psql "$DISPOSABLE_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -c "SET anchor.chart_destructive_rollback = 'i_understand_this_permanently_deletes_chart_data';" \
  -f prisma/migrations/DEV_ONLY_DESTRUCTIVE_ROLLBACK_20260802000000_add_chart_backend_foundation.sql

npx prisma migrate deploy   # re-applies the Chart migration onto empty tables
```

Without that `SET`, the script aborts before touching anything. With it, the
script emits a warning that the deletion is permanent, then drops the Chart
tables, types, and `practice_sessions`/`users` Chart columns, and removes the
migration record so the migration can be re-applied.

Re-applying afterwards produces **empty** Chart tables. It does not restore any
Reflection text. That is why this path does not exist for production.
