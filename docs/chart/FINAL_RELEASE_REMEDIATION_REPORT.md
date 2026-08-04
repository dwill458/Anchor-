# Anchor Chart Final Release Remediation — Candidate Checkpoint

Date: 2026-08-04  
Status: release-candidate checkpoint; independent H verdict still required  
Branch: `integration/chart-final-release-remediation`  
Base: `286c64b22746188d9e9a97ba0698f7b6977a5eb4`

## Verdict

The two Stage 2 P1 implementation blockers are resolved locally:

- `H-P1-001`: the approved Chart analytics catalog now has production call sites at the semantic boundaries listed below.
- `H-P1-002`: backend Jest now boots with a deterministic non-network test `DATABASE_URL`; `npm test` no longer requires a private `.env`, Railway credentials, or a live database.

This is not a final release-ready verdict. Real production-equivalent PostgreSQL race/rollback execution and physical Android/iOS certification remain blocked by the current environment. The candidate must receive an independent H audit verdict before any release claim.

## Commit chain and isolation

Commits on this branch, in order:

1. `94627f63` — deterministic backend Jest environment
2. `3f9ff2a9` — safe Chart analytics boundaries and de-duplication
3. `737f4f25` — capability response-shape and Sentry privacy boundaries
4. `45d4215b` — Chart export/deletion and entitlement coverage

Final candidate commit: `45d4215b0f8a6e5332bc28f4823ef0332a3c4e0c`.

The source worktree is clean. The unrelated `E:\Projects\Anchor` worktree and H worktrees were not modified. No push or merge was performed, and no H audit artifact or finding was rewritten.

## Changed files

- `.github/workflows/ci.yml`
- `anchor/mobile/src/components/reflection/ReflectionComposer.tsx`
- `anchor/mobile/src/components/reflection/__tests__/reflectionPrivacy.test.ts`
- `anchor/mobile/src/screens/chart/AIPlanReviewScreen.tsx`
- `anchor/mobile/src/screens/chart/ChartHomeScreen.tsx`
- `anchor/mobile/src/screens/chart/CourseCompletionScreen.tsx`
- `anchor/mobile/src/screens/chart/CourseDetailsScreen.tsx`
- `anchor/mobile/src/screens/chart/CourseLogScreen.tsx`
- `anchor/mobile/src/screens/chart/CourseSetupScreen.tsx`
- `anchor/mobile/src/screens/chart/ReflectionComposerScreen.tsx`
- `anchor/mobile/src/screens/chart/WaypointDetailScreen.tsx`
- `anchor/mobile/src/services/AnalyticsService.ts`
- `anchor/mobile/src/services/ChartApiClient.ts`
- `anchor/mobile/src/services/PracticeCompletionService.ts`
- `anchor/mobile/src/services/__tests__/chartAnalyticsSafety.test.ts`
- `anchor/mobile/src/stores/courseStore.ts`
- `anchor/mobile/src/types/chart.ts`
- `backend/jest.config.js`
- `backend/src/api/routes/__tests__/auth.test.ts`
- `backend/src/api/routes/auth.ts`
- `backend/src/config/__tests__/jestEnvironment.test.ts`
- `backend/src/config/jestEnvironment.ts`
- `backend/src/index.ts`
- `backend/src/services/__tests__/ChartCapabilityService.test.ts`
- `backend/src/utils/__tests__/sentryPrivacy.test.ts`
- `backend/src/utils/sentryPrivacy.ts`
- `docs/chart/FINAL_RELEASE_REMEDIATION_REPORT.md`

## Baseline reproduction

At the exact base commit, `backend/npm ci` passed. A clean `backend/npm test -- --runInBand` without shell `DATABASE_URL` failed during module import with `EnvValidationError: Required environment variable DATABASE_URL is missing or empty` in `src/config/env.ts`; this affected 11 suites, including fully mocked suites. The PostgreSQL race suite was opt-in and skipped when `CHART_PG_DATABASE_URL` was absent.

The fix is limited to Jest setup: `backend/src/config/jestEnvironment.ts` sets `NODE_ENV=test`, a non-routable deterministic placeholder URL, and removes accidental PG race opt-in. CI now uses the same setup rather than a separate test environment block.

## Analytics call-site map

All events use the existing `AnalyticsService` typed catalog and `trackChartEventOnce`. Success events are emitted only after the canonical server boundary; the operation key is used only for local de-duplication and is not sent as an analytics property.

- Navigation: `ChartHomeScreen`, `CourseDetailsScreen`, `WaypointDetailScreen`, and `CourseLogScreen`.
- Manual Course: `CourseSetupScreen` for setup, request, and confirmed creation.
- Practice: `WaypointDetailScreen` for start; `PracticeCompletionService` for Chart-specific completion after canonical session POST; `ReflectionComposerScreen` for post-practice Composer open. The canonical `practice_session_completed` event is not redefined.
- Reflections: `ReflectionComposer` for request, durable offline queue confirmation, server confirmation, and typed failure.
- Waypoint/Course completion: `WaypointDetailScreen` and `CourseCompletionScreen`, keyed by server completion/event IDs.
- Planner: `CourseSetupScreen` for request/success/fallback/denial/quota and `AIPlanReviewScreen` for viewed/accepted/dismissed.

The Chart property whitelist accepts only typed state, attribution, duration, quota, offline, fallback, and safe error fields. Destination text, waypoint text, Anchor/Reflection text, planner input/output, provider data, raw API responses, raw error messages, and navigation params are rejected.

## Automated evidence

### Backend

- `npm test -- --runInBand --silent`: 36 suites passed; 527 tests passed; 1 explicit PostgreSQL suite skipped; 19 PostgreSQL tests skipped.
- `npm run type-check`: passed.
- `npm run build`: passed.
- `npm run lint`: 0 errors, 1 existing warning at `backend/src/api/routes/visualizationScenes.ts:60` (`explicit-function-return-type`).
- Focused capability/auth/privacy run: 64 tests passed.
- `/api/auth/me` has an exact top-level capability key and quota key contract, plus canaries for subscription/provider/rollout internals.
- Capability coverage includes free, trial, Pro, expired, comped, unresolved entitlement, unmigrated, quota exhausted, rollout denied, kill switch, planner flag off, missing provider key, and malformed quota configuration.
- Sentry tests cover request-body removal, nested arrays, cycles, casing, private metadata, redacted exception strings, and throwing getters. Logger tests cover Chart freeform and raw error redaction.
- Export/deletion tests cover Chart entities, v4 export, deleted Reflection tombstones, provider-field allowlisting, and explicit Reflection/proposal/Course deletion.

### Mobile

- `npm test -- --runInBand --silent`: 161 suites passed; 1,328 tests passed; 1 test skipped.
- `npx tsc --noEmit`: passed.
- `node scripts/apply-eas-android-patches.js` twice: both runs passed and were idempotent.
- `npx expo export --platform android`: passed and produced the Android bundle in `dist`.
- Export warnings: local Google service files were absent and Sentry organization/project configuration was absent; neither prevented bundling.
- Focused Chart/privacy/offline run: 29 tests passed.

## Gate matrix

| Gate | Result | Evidence / limitation |
| --- | --- | --- |
| P1 analytics call sites | PASS | Static call-site map and full mobile suite. |
| Backend deterministic test bootstrap | PASS | Full backend suite passes without private env or live DB. |
| Typed analytics safety/de-duplication | PASS | Whitelist, nested/cycle/getter tests, account-scoped stable-key test. |
| `/api/auth/me` safe projection | PASS | Exact response shape and capability matrix tests. |
| Logging/Sentry privacy boundary | PASS (harness) | Direct logger and Sentry scrubber transport tests; no external Sentry delivery was exercised. |
| Export/account deletion | PASS (route/unit) | v4 sections, deleted tombstones, proposal allowlist, and explicit delete calls tested; no live account was deleted. |
| Default-off flags/rollback policy | PASS (static/unit) | Existing rollback safety suite passes; Chart and AI planner remain default-off. |
| PostgreSQL production-equivalent migration/races | BLOCKED | Railway read-only inventory reports the existing production Postgres image as `18.3`; the two verification projects have no DB service. This environment has no Docker or `psql`. The real PG suite remains explicitly skipped. No production database was touched. |
| Seeded rollback/reapply | BLOCKED | Requires the unavailable disposable PG18 target; static destructive-rollback guard passes. |
| Android/iOS device certification | BLOCKED | No `adb`, Android emulator, or `xcrun`/iOS environment is available. TalkBack, VoiceOver, Dynamic Type, reduced-motion, low-end performance, and physical offline queue gates are not claimed. |

## Required next independent H actions

1. Run the candidate’s database scripts against a disposable PostgreSQL 18.3 target (or the confirmed production major), including all migration, race, rollback, seeded-data, and reapply checks.
2. Run Android and iOS device certification against commit `45d4215b0f8a6e5332bc28f4823ef0332a3c4e0c`.
3. Complete external transport canary capture if required by the H audit, then issue the independent H GO/NO-GO verdict.

Until those actions pass, this checkpoint is remediation-complete for local code/test gates but not certified for release.
