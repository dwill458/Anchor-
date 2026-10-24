# Weekly Insight 2.0: Implementation Report

Global, server-authoritative weekly recap, dark-launched behind a flag. Progress stays per Anchor. The classic Weekly Insight remains fully operational.

## What was built

**Domain (`backend/src/domain/v2/weeklyRecap.ts`)**: one calculation engine for everything the user sees.
- Hero ladder: destination > intention completed > waypoint > moves (2+) > single move > milestone > release > practice > quiet. A week with completed moves and no waypoint is a `MOVES_PROGRESS` recap, never quiet.
- Dedupe: one count per (kind, canonical entity). `Move.completedAt` is canonical; CourseEvent `MOVE_COMPLETED` and ledger rows are annotations and never add. Moves are never converted into waypoint counts and vice versa; moves tied to a waypoint reached in the week are folded into that waypoint's highlight line while still counting in the move stat.
- Milestones that label an already-counted waypoint/move/destination/intention are annotations; distinct milestones stay distinct.
- Completion and release are separate facts (`intention_completed_at` vs `released_at`).
- Lifecycle: PREVIEW (Sun 19:00 local) > PROVISIONAL (Mon 00:00) > FINAL (Tue 12:00 local, lazy on first read). DST-safe half-open week window from local midnights.
- Reconciliation: `listed + absorbed + omitted = countedTotal`, so events missing from the capped highlight list are still accounted for.
- Historical route: VERIFIED only if no structural Course changes happened after week end and a frozen week-end state exists; otherwise UNVERIFIED and no route is drawn.

**Persistence**: additive migration `20261024000000_add_weekly_recap_snapshots` creates `weekly_recap_snapshots`. Unique `(user_id, scope_key, week_key)` with `scope_key NOT NULL`, which fixes the legacy table's weakness (its `(user_id, anchor_id, week_start)` key cannot guard global rows because `anchor_id` is NULL). CHECK constraints: status in (DRAFT, FINAL) and FINAL iff `finalized_at` set. The row locks its IANA time zone at first generation. Compare-and-set updates via `revision`. Rollback: `ROLLBACK_20261024000000_add_weekly_recap_snapshots.sql`.

**Backend**: `WeeklyRecapService` + `weeklyRecapSql.ts` (plain SQL, run through Prisma `$queryRawUnsafe` in production and `pg` in tests), routes `GET /api/v2/weekly-recap/latest`, `GET /api/v2/weekly-recap/:weekKey`, `GET /api/v2/weekly-recaps`, `POST /api/v2/weekly-recap/:weekKey/feedback` (FINAL only; 409 otherwise). Flag: `WEEKLY_INSIGHT_V2_ENABLED=true` (default off; 403 `FEATURE_DISABLED`). Legacy `/weekly-insights` endpoints are untouched.

**Mobile**: view-model, offline cache (a FINAL copy is never overwritten by a provisional one; per-account namespace; corrupt cache tolerated), API adapter, `useWeeklyRecap`, `V2WeeklyRecapScreen`, sections, `RecapHistoricalMap` (renders through the existing `ChartMapCrop` unchanged, from verified state only, requires a complete contiguous per-waypoint mask), `WeeklyInsightEntry`. Client flag: `EXPO_PUBLIC_WEEKLY_INSIGHT_V2=true`. Classic screen is shown when: the flag is off, the server reports `FEATURE_DISABLED`, the user taps "Classic Weekly Insight", or a deep link carries `snapshotId`/`weekOffset > 0`. Home and Progress entry points are unchanged (both still navigate to `V2WeeklyInsight`; Progress passes `anchorId`, which the recap shows as context and uses to sort that Anchor's highlights first).

## Files

Created (backend): `src/domain/v2/weeklyRecap.ts`, `src/domain/v2/__tests__/weeklyRecap.test.ts`, `src/services/v2/WeeklyRecapService.ts`, `src/services/v2/weeklyRecapSql.ts`, `src/services/v2/__tests__/WeeklyRecapService.pg.test.ts`, `src/api/routes/v2/weeklyRecapRoutes.ts`, `src/api/routes/v2/__tests__/weeklyRecapRoutes.test.ts`, `prisma/migrations/20261024000000_add_weekly_recap_snapshots/migration.sql`, `prisma/migrations/ROLLBACK_20261024000000_add_weekly_recap_snapshots.sql`.

Modified (backend): `prisma/schema.prisma` (new model + `User.weeklyRecapSnapshots` relation), `src/api/routes/v2/index.ts` (import + mount).

Created (mobile, under `anchor/mobile/src`): `adapters/v2/weeklyRecap/{recapTypes,recapViewModel,recapRepository,weeklyRecapApi}.ts`, `adapters/v2/weeklyRecap/__tests__/{recapViewModel,recapRepository}.test.ts`, `constants/v2/weeklyInsightFlags.ts`, `hooks/v2/weeklyRecap/useWeeklyRecap.ts`, `components/v2/weeklyRecap/{RecapSections,RecapHistoricalMap}.tsx`, `screens/v2/weeklyRecap/{V2WeeklyRecapScreen,WeeklyInsightEntry}.tsx`.

Modified (mobile): `navigation/v2/AnchorV2Navigator.tsx` (route screen now renders `WeeklyInsightEntry`; unused classic import removed).

Protected systems: no change to Chart map/fog/reveal/camera/waypoint code, `ChartMapCrop`, or the Progress screen. No architectural conflict required altering them.

## Tests executed

| Suite | Where | Result |
|---|---|---|
| Domain contract (`weeklyRecap.test.ts`) | cloud, ts-jest | 29 passed |
| Service on real PostgreSQL 16 (`WeeklyRecapService.pg.test.ts`) | cloud, local PG with all 51 repo migrations replayed + new migration | 18 passed |
| Route tests (`weeklyRecapRoutes.test.ts`) | cloud, ts-jest with stubbed auth/prisma | 7 passed |
| Mobile view-model + repository | cloud, ts-jest | 22 passed |
| `check-v2-import-boundary.mjs` | device | exit 1, the same 37 baseline files; no new violations |

The PostgreSQL suite covers: moves-only week; duplicate CourseEvent annotations; reconciliation against canonical row counts including moves omitted from highlights; milestone annotation; completion vs release; archived Anchors; per-user isolation; draft > provisional refresh > FINAL at Tuesday noon; immutability after finalization; feedback only after FINAL; no write before preview; latest-week selection; time-zone lock across devices (NY then Tokyo); invalid zone/week; 16 concurrent first generations (one row); 16 concurrent finalizations with and without a prior draft (one FINAL row, identical content); DB-level uniqueness/CHECK/NOT NULL enforcement; DST fall-back boundary (169-hour week); practice days from local date keys; historical map VERIFIED vs UNVERIFIED.

The PG suite is skipped unless `TEST_DATABASE_URL` points at a disposable database (and needs `npm i -D pg`), so the default suite stays hermetic.

## Not executed / baseline

- The repo's full backend and mobile jest suites were **not** run. Jest on the mounted Windows folder did not complete in my sandbox (>10 min), so I cannot report baseline failures by name. Run `npm test` in `backend` and `anchor/mobile` and compare against a clean checkout.
- The Prisma client itself could not be generated in my sandbox (engine download blocked), so the production Prisma execution path (`$queryRawUnsafe`) and `routes/v2/index.ts` mounting were not exercised. The SQL was; the thin adapter was not. `routeRegistration.test.ts` is the first thing to run on your machine.
- Mobile screens (`V2WeeklyRecapScreen`, sections, historical map) are untested on a device or simulator. Device testing is still required before enabling the flag.
- Mobile project typecheck: see the final report; if not marked complete there, run `npx tsc --noEmit` in `anchor/mobile`.
- `prisma migrate diff` / `migrate deploy` were not run (same engine limitation); the migration SQL was hand-written, applied to a real PostgreSQL 16 instance and checked against the Prisma model conventions. Run `npx prisma migrate diff --from-migrations ... --to-schema-datamodel` or `prisma migrate deploy` on staging to confirm no drift.

## Remaining risks and decisions

1. **Lazy finalization**: FINAL is written on the first read after Tuesday noon. A user who never opens the recap has no row for that week; opening it later still finalizes from canonical data (so late-synced events up to that moment are included). A scheduled finalizer is optional.
2. **Late data after finalization** is intentionally excluded (frozen snapshot).
3. **Released/archived Anchor deep links**: Chart/Practice taps for non-active Anchors fall back to the general screens, because navigation to those destinations was not verified.
4. **Historical map category/title**: the map needs the Anchor in the local store for its category; otherwise the note "Route progress for this week isn't available" is shown.
5. **Milestone titles** are not shown (no display names are stored server-side); milestone-only weeks use generic copy.
6. **Counting rules to confirm**: deleted Courses and cancelled waypoints (`cancelled_at`) are excluded/included as written in `weeklyRecapSql.ts`; practice sessions count only when `completion_status = 'completed'`.
7. **Legacy table** `weekly_insight_snapshots` keeps its NULL-anchor uniqueness gap; it is untouched and still serves classic history.

## Rollout

1. Run migrations; deploy backend with `WEEKLY_INSIGHT_V2_ENABLED` unset (routes return 403).
2. Run the full suites and `routeRegistration.test.ts`.
3. Device-test with `EXPO_PUBLIC_WEEKLY_INSIGHT_V2=true` and the server flag on in staging (Sunday preview, Monday provisional, Tuesday final, offline, two time zones).
4. Enable server flag, then client flag. To roll back, unset either flag; classic is served immediately.
