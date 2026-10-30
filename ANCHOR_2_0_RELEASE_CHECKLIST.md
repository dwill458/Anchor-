# Anchor 2.0 release checklist — implementation closeout 2026-10-29

Current decision: **iOS NO-GO; Android NO-GO.** Local implementation and isolated verification only; no production database/deployment/OTA/build/submission/push was performed. The final release audit contains endpoint contracts, policy boundaries, test limitations, changed-file inventory and exact rollout prerequisites.

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

## Engineering evidence

- [x] **PASS:** 55/55 real HTTP PostgreSQL cases; only external Firebase verification, RevenueCat, AI/storage/TTS/analytics use fixtures. This is not real Firebase/device/store acceptance.
- [x] **PASS:** all 58 migrations applied from zero on a fresh isolated PostgreSQL 16 database; Prisma migration status up to date; schema validation passed.
- [x] **PASS:** full backend Jest: 107 suites / 1,833 tests; 7 suites / 107 tests explicitly skipped in the ordinary run. PostgreSQL HTTP tests ran separately with opt-in.
- [x] **PASS:** backend TypeScript and mobile TypeScript after integration.
- [x] **PASS:** all 693 inventoried mobile suite files covered in bounded batches: 7,934 tests passed, zero failed, one pre-existing countdown test skipped. Final creation regressions: 10 suites / 97 tests passed. No missing suite paths; the interrupted initial full Jest invocation is not counted as a pass.
- [x] **PASS:** whole-repository backend lint: zero errors, 85 warnings; eight formatting-only corrections retained identical parsed code structure. Git diff whitespace check passed; no lint rules were disabled.
- [x] **FIXED:** reachable Sharp SVG/native dependency advisory; narrowly updated to 0.35.5, verified actual SVG conversion and focused image/photo tests, repaired invalid PNG fixtures while preserving assertions.
- [x] **FIXED:** compatible body-parser 1.20.9 and express-rate-limit 8.2.2 security patches; global iterative body-shape bounds protect current Zod validation from oversized collection work. New security suites pass 11/11; the mapped-IP bug was reproduced before fixing, while the compressed-request smoke did not reproduce the published crash.
- [x] **FIXED:** inherited whole-repository formatting errors; source behavior and unrelated edits preserved.
- [ ] **P1 OPEN:** V2 import-boundary check still fails across inherited shared/UI imports; preserve ownership and existing UX while correcting/dispositioning architecture.
- [ ] **P1 OPEN:** Expo Doctor 17/20; ignored local-module native sources, native/config sync and 22 SDK patch mismatches remain unresolved.
- [ ] **P1 OPEN:** pre-existing skipped countdown case needs device/clock acceptance; investigate intermittent Windows native PostgreSQL runner failfast and backend open-handle warning. All inventoried suite files have passing final batch results.
- [ ] **P1 OPEN:** package-by-package dependency triage is documented, but conditional SDK/build-tool exposure still requires artifact/ingress proof or reviewed remediation: production-dependency audits still list backend 4 critical / 12 high and mobile 3 critical / 16 high findings. Check actual native/release-image exposure; avoid blind broad upgrades.

## Mandatory production prerequisites

- [ ] **P0 — historical quota cutover:** reconcile unknown successful abandoned generations and deleted history from legacy production windows. Known saved rows are covered, but unavailable history cannot be invented. Obtain trusted evidence or an approved fail-closed transition for overlapping windows before enabling enforcement.
- [ ] **P0 — coordinated legacy upgrade:** inventory actual released 1.5 build/runtime behavior; publish/approve the compatible native client and coordinate mandatory upgrade before backend enforcement. Old unauthenticated/sessionless enhancement calls intentionally receive 426. No unrestricted compatibility bypass exists; do not deploy this backend independently.
- [ ] Verify Firebase anonymous-provider configuration, true native restart/guest persistence, same-UID email/Google/Apple linking, existing-account merge, account switching, two-account authorization, interrupted recovery and deletion on both platforms.
- [ ] Execute real Apple/Google sandbox trial, purchase, renewal, expiry, refund, restore, product/offer mapping and purchase-resumption acceptance with RevenueCat identities.
- [ ] Test actual 1.5 data/account/subscription upgrade, locally-only legacy records, lifetime/history reconciliation, secure storage, backup/restore and recovery.
- [ ] Obtain explicit authorization for production AAB/IPA builds; inspect signing, archived files, effective Android target/page sizes, native libraries, iOS SDK/privacy manifests and permissions. No release binary was built or verified here.
- [ ] Verify App Store Connect/Play products, privacy/Data Safety, account deletion including guest data, review access, age ratings, legal links, current SDK/policy deadlines and console declarations.
- [ ] Complete physical Android/iPhone critical journeys, purchases/restoration, performance/interruption/offline/recovery acceptance; no device was attached during this run.
- [ ] Approve and verify production backups, monitoring, rollback compatibility and staged rollout before any production-impacting action.

The original source-level quota bypasses are closed for the tested protocol. **Neither platform is approved for production release.**