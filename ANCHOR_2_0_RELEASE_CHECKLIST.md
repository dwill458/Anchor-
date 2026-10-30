# Anchor 2.0 release checklist — implementation closeout 2026-10-29

Current decision: **iOS NO-GO; Android NO-GO.** Local implementation, historical reconciliation, legacy client compatibility, and engineering P1 gates are complete and verified on isolated PostgreSQL; no production database/deployment/OTA/build/submission/push was performed without authorization. The final release audit contains endpoint contracts, policy boundaries, test limitations, changed-file inventory and exact rollout prerequisites.

## Original blockers and integrated user journey

- [x] **SOURCE + REAL POSTGRESQL HTTP PASS:** both enhancement aliases require verified identity and an owned creation session; arbitrary temporary IDs cannot bypass quota accounting.
- [x] **PASS:** Trial sessions 1–7 succeed; session 8 is denied across the server-verified trial window. Client clocks/counters do not reset the budget.
- [x] **PASS:** Pro sessions 1–10 succeed; session 11 is denied. Daily boundary is UTC midnight; first-output commit rechecks current owner, plan and window.
- [x] **PASS:** Two initial options share one credit; missing-option recovery does not add a credit; failed unused reservations release; duplicate/same-key retries do not double-charge; owner locks bound concurrent capacity.
- [x] **PASS:** Durable abandoned output stays charged and recoverable. Read-only recovery retrieves expired/exhausted partial output; the mobile flow can explicitly keep and save a single ready option. Four execution attempts and two stored options bound each session.
- [x] **PASS:** Generated saves require owned session/option and matching structure/intention. Canonical artwork and pool authority come from server output. Repeated saves, even with different client keys, are idempotent and cannot create another Anchor.
- [x] **PASS:** Original SVG saves share quota accounting; keeping the original after AI reuses its charged session. Generated artwork replacements require option authority. Existing owned Anchors remain readable after subscription expiry.
- [x] **PASS:** Guest create/save, same-UID registration, existing-account guest merge with verified proof, quota preservation, stable-key recovery, canonical ownership adoption and account-deletion cleanup pass database-backed API tests.
- [x] **SOURCE + FOCUSED MOBILE PASS:** persistent Firebase anonymous auth and durable request-key write receipts before HTTP; guest vault partition survives store rehydration; all creation/save callers use verified server authority; no production Mantra local-success fallback after quota/server denial; account-revision/token fences reject stale responses.
- [x] **PASS:** Known historical saved Anchors and guest/plan transitions count toward applicable windows. Trial 7→Pro permits only three more that day. In-flight guest merge into a full Pro account cannot commit an eleventh credit.
- [x] **PASS:** PostgreSQL guest/free-first-session IP-hash daily ceiling survives process-local limiter reset, guest UID cycling and registration before/after reservation: 20 executions allowed, 21st denied before provider work.
- [x] **PASS (P0 RECONCILIATION):** Pre-ledger historical reconciliation service and CLI (`CreationLedgerReconciliationService.ts`, `reconcile-creation-ledger.ts`) implemented and verified on isolated PostgreSQL (6/6 tests passing in `creationReconciliation.pg.test.ts`). Monotonic counter adjustment (GREATEST), burned-anchor accounting, no fabricated generation sessions, and restartable keyset pagination with explicit uncertainty classifications.
- [x] **PASS (P0 LEGACY COMPATIBILITY):** Bounded transitional legacy compatibility (`LegacyCreationCompat.ts`) implemented and verified with 8/8 legacy HTTP tests (63/63 total in `anchorCreationFlow.pg.test.ts`). Strict compiled hard-stop (2026-12-15T00:00:00Z), opt-in deadline flag, no unauthenticated/anonymous bypass (clean 426 response), deterministic implicit session metering for authenticated legacy callers, and server-owned output binding for legacy saves.

## Engineering evidence

- [x] **PASS:** 63/63 real HTTP PostgreSQL cases in `anchorCreationFlow.pg.test.ts` (55 modern + 8 legacy 1.x request shapes); external Firebase, RevenueCat, AI/storage/TTS/analytics use fixtures.
- [x] **PASS:** 6/6 real PostgreSQL reconciliation cases in `creationReconciliation.pg.test.ts` (idempotency, dry-run, burned anchor accounting, restartability, concurrency).
- [x] **PASS:** all 59 repository migrations applied from zero on a fresh isolated PostgreSQL 16 database; Prisma migration status up to date; schema validation passed.
- [x] **PASS:** full backend Jest: 107 suites / 1,833 tests passed in standard run; PostgreSQL suites run separately with database opt-in.
- [x] **PASS:** backend TypeScript (`npm run type-check`) and mobile TypeScript (`npx tsc --noEmit`) pass with 0 errors.
- [x] **PASS:** all 693 inventoried mobile suite files covered in bounded batches: 7,934 tests passed, zero failed. Pre-existing skipped countdown case documented (Focus Session visual redesign uses breath circle instead of text clock).
- [x] **PASS:** whole-repository backend lint: 0 errors, 86 warnings; formatting validated across all modified files.
- [x] **PASS (P1 V2 BOUNDARY):** `npm run test:v2-boundary` passes with 39 frozen and audited legacy integration surfaces catalogued; prevents any new reverse-dependency leaks.
- [x] **PASS (P1 EXPO DOCTOR):** 18/20 checks passed (improved from 17/20). Local module gitignore issue fixed by anchoring native paths in `anchor/mobile/.easignore`. Non-CNG notice and 22 patch-level dependency versions dispositioned.
- [x] **FIXED:** reachable Sharp SVG/native dependency advisory (0.35.5), body-parser (1.20.9), express-rate-limit (8.2.2), body complexity guard (11/11 security tests passing).

## Mandatory production prerequisites (Requiring External / Store Authorization)

- [ ] **Production reconciliation cutover execution:** run `reconcile-creation-ledger.ts` in dry-run mode against staging/production database during scheduled maintenance, review uncertainty report, obtain explicit authorization, and execute `--apply --confirm-database=<name>`.
- [ ] **Coordinated rollout execution:** deploy backend with `ANCHOR_LEGACY_CREATION_COMPAT_UNTIL` set to approved transition window. Verify published 1.5 client behavior and release 2.0 native client to App Store and Google Play.
- [ ] Verify Firebase anonymous-provider configuration, true native restart/guest persistence, same-UID email/Google/Apple linking, existing-account merge, account switching, two-account authorization, interrupted recovery and deletion on both platforms.
- [ ] Execute real Apple/Google sandbox trial, purchase, renewal, expiry, refund, restore, product/offer mapping and purchase-resumption acceptance with RevenueCat identities.
- [ ] Test actual 1.5 data/account/subscription upgrade, locally-only legacy records, lifetime/history reconciliation, secure storage, backup/restore and recovery on physical devices.
- [ ] Obtain explicit authorization for production AAB/IPA builds; inspect signing, archived files, effective Android target/page sizes, native libraries, iOS SDK/privacy manifests and permissions.
- [ ] Verify App Store Connect/Play products, privacy/Data Safety, account deletion including guest data, review access, age ratings, legal links, current SDK/policy deadlines and console declarations.
- [ ] Complete physical Android/iPhone critical journeys, purchases/restoration, performance/interruption/offline/recovery acceptance (no physical device was attached during local run).
- [ ] Approve and verify production backups, monitoring, rollback compatibility and staged rollout before any production-impacting action.

The local source and engineering gates are closed. **Final production deployment and store release await external sandbox and binary certification.**
