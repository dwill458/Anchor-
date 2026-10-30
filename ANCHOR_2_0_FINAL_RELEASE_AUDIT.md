# Anchor 2.0 release implementation closeout — 2026-10-29

## Current decision

**iOS: NO-GO. Android: NO-GO.** The two original quota bypasses are now implemented through the real production creation/save protocol and proven with PostgreSQL HTTP tests. This is local source and isolated-database evidence, not a deployment or a production certification. Historical usage reconciliation, coordinated legacy-client enforcement, remaining engineering gates, real Firebase/store/device acceptance and signed release binaries still block release. No production database, backend deployment, OTA, store submission, credential rotation, Git push or unrelated checkout cleanup was performed.

This closeout supersedes the earlier audit and progress notes retained below. In particular, their statements that the production routes are not wired to the ledger describe the earlier checkout, not the implementation now present.

## Implemented flow and policies

- Native mobile clients establish/reuse Firebase anonymous authentication before guest creation. The Firebase SDK owns persistent identity. Anonymous users stay guests in the existing interface; server-backed guest Anchors remain in the local guest vault across store rehydration. Registration links email/Google/Apple credentials to the same UID. Signing into an existing account transfers guest data only after verified proofs, transactionally combines ownership/history and tombstones the old guest account. Pending transfer proof is encrypted for recovery. Server-confirmed ownership is fetched before the local account handoff; unrelated account transfers and obsolete responses are rejected.
- `POST /api/ai/creation-sessions` requires Firebase authentication, a server-resolved database user and an `Idempotency-Key`; the server returns the session UUID. Generation input is hash-bound to that session. The existing `POST /api/ai/enhance` and `/api/ai/enhance-controlnet` both require that owned session. There is no temporary-ID exemption or developer exemption from the database quota.
- Free creation has one lifetime session budget and preserves the existing one-lifetime-saved-Anchor guard, including legacy saved rows when a counter is stale. Trial creation is capped at seven across the server-verified trial window. RevenueCat's matching subscription `purchase_date` supplies its boundary; configured legacy trials use the persisted server timestamp. A missing verified store start uses a conservative lifetime window, never a client timestamp. Pro creation is capped at ten per **UTC calendar day, 00:00:00Z inclusive to the following midnight exclusive**.
- Quota-owner row locks serialize reservations. Applicable-window accounting includes prior-plan and transferred guest output, plus known saved Anchors without ledger coverage. A first output revalidates the current owner, plan and time window under the owner lock; reservations are excluded from their own revalidation count. Pro-to-Trial changes and guest merges during provider execution cannot commit an extra credit. A call spanning midnight commits against the UTC day stamped on its durable first output.
- A session stores at most two usable options. The first durable usable option commits one credit; the second and missing-option recovery cost no additional credit. Completed abandoned output stays charged. A technical failure with no usable output releases the reservation. Same-key retries rearm the same failed/expired unused session only after capacity is checked again. Reservations expire after 30 minutes; execution uses a 10-minute lease and at most four execution attempts per session. Lost leases cannot write late output. `GET /api/ai/creation-sessions/:id` provides owned, read-only recovery even for expired or attempt-exhausted partial output.
- `POST /api/anchors` verifies session, selected option, ownership, durable state and bound intention/structure. It uses the server's stored artwork and pool reservation metadata. Saving does not spend another generation credit. Session locking and the saved-target marker make repeated saves idempotent even with different client keys; deletion of a saved target does not turn its session into a fresh save authority. Keeping an original SVG also enters the same quota accounting transaction. Keeping the original after AI output explicitly reuses that owned session (`keepOriginal: true`) and does not spend another credit.
- `PUT /api/anchors/:id` requires owned generated-option authority for replacement artwork; unchanged stored artwork retains its canonical server reference. A used option cannot become another Anchor through an update followed by a create. Existing owned Anchors remain readable after subscription expiry. Account deletion cleans up options, sessions and quota owners transactionally before deleting the user.
- All three mobile enhancement callers use the shared session adapter. Modern creation, the actual first-run save hook, legacy promotion and Mantra saving require server confirmation before local success. Stable flow/save keys survive retries; explicit new sets receive new authorization. The Mantra route's local success fallback after a backend denial was removed. Canonical server artwork wins on idempotent replay. Captured account revision/token/identity fences reject late successes and errors, including A-to-B-to-A changes, before data consumption or auth recovery.
- A PostgreSQL ceiling limits anonymous and registered-free first-session identity cycling to 20 execution attempts per normalized-IP hash per UTC day, in addition to existing rate/concurrency middleware. The database ceiling survives process/Redis restart and UID rotation on the same network. Shared networks share this bound; rotating IP addresses remains an abuse risk requiring operational monitoring. Allowlisted developer benefits require a verified Firebase email; the synthetic developer UID is recognized only outside production.

## Database changes

Three additive migrations are present: inherited `20261029000000_anchor_creation_sessions` (owners/sessions/options), `20261029010000_creation_session_execution` (execution lease and saved-target marker), and `20261029020000_guest_creation_abuse_budget` (shared guest ceiling and a non-unique saved-target lookup index). A new isolated PostgreSQL 16 database applied **all 58 repository migrations from zero**, and Prisma migration status reports up to date. Prisma schema validation passed. These migrations were not applied to production; no existing production row was modified.

## Verification evidence

| Check | Result and limits |
|---|---|
| Real PostgreSQL HTTP flow | **55/55 passed**, fresh isolated `anchor_creation_http_final2_20261029`; real Express routers, authentication middleware, services and PostgreSQL transactions. External Firebase verification, RevenueCat, AI, storage, TTS and analytics are fixtures. This does not prove a real Firebase token or native session lifecycle. |
| Trial 1–7 / 8 | Seven successful sessions allowed; eighth denied. Product/expiry/client-clock fields cannot reset the tested verified period. |
| Pro 1–10 / 11 | Ten successful sessions allowed; eleventh denied. UTC rollover, in-flight window revalidation and plan changes covered. |
| Concurrency | Trial 7 of 12 and Pro 10 of 15 concurrent reservations allowed; duplicates share a session; concurrent option saves create one Anchor. |
| Recovery and failure | Two options consume one credit; missing option adds no credit; no-output failure releases; same-key retry does not double-charge; expired/abandoned/exhausted partial output stays readable; bounded execution attempts verified. |
| Ownership and save | Forged identities/options/sessions, cross-account generation/save/update/recovery and pool metadata forgery denied; repeat save is idempotent; original SVG cannot bypass the shared cap. |
| Guests and linking | Anonymous sync/create/save; same-UID registration; existing-account merge with proof and replay protection; stable-key recovery after merge; preserved quota and existing saved data; deletion cleanup passed. Real OAuth/device persistence remains external acceptance. |
| Historical/plan transitions | Known unledgered saves count; six historical trial saves plus one new generation reaches seven without save double-charge; ten historical Pro saves deny another; Trial 7 then Pro permits three further that day; transferred guest output consumes the applicable target window. |
| Full backend Jest | **107 suites / 1,833 tests passed**, exit 0; 7 suites / 107 tests skipped, including tests that require explicit external/database opt-in. The 55 HTTP tests above were run separately with database opt-in. An open-handle warning occurred before successful process exit. |
| Backend TypeScript | Passed after implementation and Sharp type migration. |
| Mobile TypeScript | Passed after guest partition and account-fence changes. |
| Mobile Jest inventory | **693 distinct inventoried suite files covered in bounded processes: 7,934 tests passed, zero failed, one pre-existing countdown test skipped.** Final creation regressions passed 97 tests across 10 suites, including partial selection/save, full-list recovery, original choice, durable receipts and account fencing. Aggregation uses the latest result for each exact suite path, with no missing paths. The initial all-files Jest process was stopped after approximately 11 minutes without a completion summary; it is not represented as a passing single invocation. |
| Backend lint | **Whole-repository command passed, exit 0: zero errors, 85 warnings.** Eight lint-reported files received formatting only; TypeScript parsed-tree fingerprints matched before/after each write. Existing edits and code behavior were retained. No rule was disabled. |
| V2 boundary | Fails with the existing production-to-V2 import inventory across shared UI, share/export, settings and create surfaces. No boundary exemption was added. |
| Expo Doctor | 17/20 checks passed; local-module native directories are ignored, native/config sync is unresolved, and 22 SDK patch versions mismatch. No broad SDK update was attempted. |
| Git diff | `git diff --check` passed; inherited dirty work is preserved. |
| Device availability | `adb devices` returned no attached devices; no iOS/macOS release environment was used. |

Evidence commands: backend `npm.cmd test -- --runInBand --silent`; database opt-in `npm.cmd test -- --runInBand --silent src/__pg__/anchorCreationFlow.pg.test.ts`; isolated `npx.cmd prisma migrate deploy` and `npx.cmd prisma migrate status`; backend `npm.cmd run type-check`/`npm.cmd run lint`; mobile `npx.cmd tsc --noEmit`, `npm.cmd run test:v2-boundary`, `npx.cmd expo-doctor`, and explicit Jest path batches. Isolated database URLs are intentionally omitted here. Logs are under `%TEMP%`: `anchor-http-trace-20261029.log`, `anchor-backend-release-final-20261029.log`, `anchor-migrations-final-20261029.log`, `anchor-mobile-services-stores-release-20261029.log` and `anchor-mobile-remaining-release-20261029/`. Earlier PostgreSQL attempts intermittently exited with Windows native failfast `-1073740791` before assertions; the final diagnostic run executed all 55 successfully. Do not hide this runner reliability issue or substitute the failed attempts for a result.

## Remaining release blockers and exact next actions

1. **P0 rollout/data gate:** reconcile quota windows that overlap the old unledgered production paths before enabling enforcement. Known saved history is counted automatically. Previously abandoned successful generations, deleted historical rows and their trial attribution cannot be reconstructed from saved Anchors alone. Obtain trusted historical evidence or a controlled, fail-closed cutover for these overlapping windows. The isolated tests do not establish an accurate baseline for every live 1.5 account.
2. **P0 coordinated compatibility gate:** old anonymous clients cannot securely prove ownership with timestamp IDs. Both enhancement aliases intentionally return `426 ANCHOR_CREATION_UPGRADE_REQUIRED` without verified identity/session authority; no unrestricted bypass exists. Identify actual live App Store/Play builds and OTA runtimes, make the compatible native client available, and coordinate a mandatory-upgrade enforcement window before authorizing backend rollout. Source identifies the affected request protocol, not the exact released build range. Deploying this backend independently would interrupt old creation requests. Existing authenticated accounts/subscriptions and existing Anchor reads are retained; historical locally-only generated records need an explicitly verified migration/reconciliation path rather than being trusted as new save authority.
3. **P1 engineering gates:** resolve/disposition import-boundary architecture and Doctor/native archive issues, and the pre-existing skipped countdown acceptance case. All inventoried mobile suite paths are covered by the final batch evidence. Investigate the intermittent Windows native runner failure and backend open handles. Preserve the security assertions and ownership fences while repairing fixtures.
4. **P1 dependency/security gate:** Sharp was upgraded narrowly from 0.34.5 to **0.35.5**, with corresponding lockfile and named type import. Its installed rasterizer reports libvips 8.18.7 / librsvg 2.63.2; real SVG-to-PNG conversion passed, image validation/provider tests passed 12/12 and photo-expansion tests 11/11. Two malformed PNG test fixtures were replaced with valid generated PNGs without weakening assertions. The patched library must still be verified in the Linux release image. [Sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
5. Fresh production-dependency audits still report backend **60 findings (4 critical, 12 high, 43 moderate, 1 low)** and mobile **31 (3 critical, 16 high, 7 moderate, 5 low)**. Counts are package findings, not proven exploitability. The critical `proxy-addr` advisory requires affected subnet trust configuration; this source uses numeric `trust proxy = 1`, so that specific condition is absent. Real proxy topology still needs verification. Backend protobufjs is reached through Google SDKs using application/SDK descriptors; no application endpoint accepting arbitrary protobuf schemas was found. Firebase's websocket-driver is present transitively; no application Realtime Database use was found. fast-xml-parser is present in storage SDKs; remote parsing and remaining SDK/tooling exposure have conditional dispositions in the package-by-package triage appendix, rather than blanket approval. Mobile CLI/Node tooling findings must be separated from actual native bundled reachability using a production artifact. No broad `npm audit fix --force` was run. [proxy-addr advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).
6. **External acceptance:** enable/verify Firebase anonymous auth in the intended project and run native restart/reinstall, guest-first-Anchor, same-UID linking, existing-account merge, two-account access and interrupted recovery on iOS and Android. Run real Apple/Google sandbox trial 7/8, purchase/renewal/expiry/refund/restore/account-switch/resume tests with RevenueCat identity mapping. Test the published 1.5 upgrade with actual data and backup/recovery fixtures. None was performed here.
7. **Binary/store gates:** obtain separate authorization for production Android AAB/iOS IPA builds. Inspect effective signing identities, Android target/16 KB native page support, release-image dependencies, iOS SDK/privacy manifests/permissions and the archived EAS files. Apple requires Xcode 26+/iOS 26 SDK+; Google Play's current app-update target is API 36. Verify the applicable 16 KB deadline/extension in the actual console. Verify privacy/Data Safety, account deletion including guest data, legal URLs, age ratings, review access, billing products and store disclosures before submission. [Apple requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a), [Play target policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [Android page-size guidance](https://developer.android.com/guide/practices/page-sizes).

## Final verification addendum and changed files

The compatible client also waits for the private persistence receipt of its exact flow/save key before reserving or saving. Failed storage writes stop before provider/API work; unfinished output can recover from the durable server session. Missing-option recovery deduplicates the full server response before limiting candidates. A usable single option can be explicitly selected, held and saved through the existing flow, rather than being stranded behind the pair requirement. Choosing the original after generation sends the same owned session with `keepOriginal: true`; no second credit is spent.

Additional security fixes: compatible `body-parser` **1.20.9** and `express-rate-limit` **8.2.2** are installed and locked. The mapped-IP regression failed before the limiter patch and passes afterward. The published compressed-body crash condition is reachable in the parser configuration, but the bounded local child-process probes did **not** reproduce that crash; they stayed healthy before and after patching. A global iterative body-shape guard runs after the existing byte parsers and before auth/routes, bounding arrays/object keys to 1,024 entries, total nodes to 8,192 and depth to 32. It preserves raw Buffer handling and existing photo byte limits. This bounds Zod 3 per-item error work without a major schema-library migration. The two new security suites pass **11/11** tests. See [all high/critical package dispositions](docs/security/anchor-2-release-dependency-triage-20261029.md); final backend production-dependency audit is 60 findings (4 critical / 12 high / 43 moderate / 1 low).

The final ordinary backend run completed with **107 passing suites / 1,833 passing tests**, 7 suites / 107 tests skipped, exit 0. To diagnose intermittent native Windows failures, that exact run used `node --max-old-space-size=4096 node_modules/jest/bin/jest.js --runInBand --silent --setupFilesAfterEnv="C:\Users\dwill\AppData\Local\Temp\anchor-jest-case-trace.cjs"`, with `ANCHOR_CREATION_TEST_DATABASE_URL` unset. The temporary hook only prints each case name in `beforeEach`; it changes no assertion, mock or timeout. The separate PostgreSQL run passed **55/55** with a four-connection Prisma pool and unchanged 12/15 simultaneous HTTP reservation assertions. All 58 migrations and up-to-date migration history were verified on a new isolated database. An open-handle warning preceded clean backend exit; prior native failfast remains a runner reliability investigation, not an assertion failure hidden by retries.

Mobile aggregation covers **693 of 693 exact suite paths, 7,934 passed tests, zero failed, one pre-existing skipped countdown case**. The latest successful result per exact path is aggregated from 43 Jest JSON reports; there are no missing paths. Some initially timed-out large batches were subdivided, and three outdated screen-fixture contracts plus the Activation fixture ownership context were corrected without weakening assertions. Final creation regressions pass **10 suites / 97 tests** after the last flow changes. Evidence: `%TEMP%/anchor-mobile-aggregate-release-20261029.json`; the remaining single skipped case is `ActivationScreen counts down in mm:ss format` in `ActivationScreen.test.tsx:447`. Both backend and mobile TypeScript checks passed. Whole-backend lint now passes with **zero errors / 85 warnings**, and no rule was disabled.

Eight files needed formatting-only corrections to close the inherited lint gate: `api/routes/v2/askChartRoutes.ts`, `api/routes/v2/chartRoutes.ts`, `services/CourseService.ts`, `services/chart/ChartService.ts`, `services/chart/ask/AskChartService.ts`, `services/chart/ask/askChartSchema.ts`, `services/chart/ask/askChartScope.ts` and `types/chart.ts`, all below `backend/src/`. Each parsed TypeScript tree matched before/after formatting. No route, value, policy or control flow was changed in those corrections.

Production endpoint integration also includes `POST /api/auth/sync`, `POST /api/auth/guest-transfer-token`, `POST /api/auth/merge-guest` and `DELETE /api/auth/me`, alongside the creation/recovery/enhance and Anchor create/update routes described above. Mantra/TTS, Vision and Chart remain separate operations with their existing authentication/ownership/premium/rate policies; they are not blindly charged as Anchor creation sessions. No alternate caller of the Anchor image-generation service was found beyond the two protected aliases.

The inventory below is the **complete final dirty checkout**, including inherited work. It does not attribute every line to this run: the prior onboarding, Analytics, Vision, Chart security and preliminary ledger work was retained. The original HEAD remains `9bf7fcae3`; no commit, push or cleanup was performed. The first migration and preliminary ledger/test were inherited and completed in place. The two release documents and dependency appendix provide the handoff, while the implementation is in the production paths listed below.

- `ANCHOR_2_0_FINAL_RELEASE_AUDIT.md`
- `ANCHOR_2_0_RELEASE_CHECKLIST.md`
- `anchor/mobile/src/components/v2/creation/__tests__/V2CreationFlow.test.tsx`
- `anchor/mobile/src/components/v2/creation/CandidatePager.tsx`
- `anchor/mobile/src/components/v2/creation/CreationStage.tsx`
- `anchor/mobile/src/components/v2/creation/V2CreationFlow.tsx`
- `anchor/mobile/src/components/v2/vision/__tests__/VisionAddSceneSheet.test.tsx`
- `anchor/mobile/src/constants/v2/creation.ts`
- `anchor/mobile/src/hooks/__tests__/useSaveAnchor.quota.test.tsx`
- `anchor/mobile/src/hooks/useSaveAnchor.ts`
- `anchor/mobile/src/hooks/v2/vision/useV2Vision.ts`
- `anchor/mobile/src/screens/create/__tests__/AIGeneratingScreen.test.tsx`
- `anchor/mobile/src/screens/create/__tests__/AnchorRevealScreen.test.tsx`
- `anchor/mobile/src/screens/create/__tests__/IntentionInputScreen.test.tsx`
- `anchor/mobile/src/screens/create/__tests__/MantraCreationScreen.test.tsx`
- `anchor/mobile/src/screens/create/AIGeneratingScreen.tsx`
- `anchor/mobile/src/screens/create/AIVariationPickerScreen.tsx`
- `anchor/mobile/src/screens/create/flow/AnchorCreationFlowScreen.tsx`
- `anchor/mobile/src/screens/create/flow/generatedForms.ts`
- `anchor/mobile/src/screens/create/IntentionInputScreen.tsx`
- `anchor/mobile/src/screens/create/MantraCreationScreen.tsx`
- `anchor/mobile/src/screens/rituals/__tests__/ActivationScreen.test.tsx`
- `anchor/mobile/src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx`
- `anchor/mobile/src/screens/v2/onboarding/V2FirstRunFlow.tsx`
- `anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx`
- `anchor/mobile/src/services/__tests__/AnchorCreationSession.test.ts`
- `anchor/mobile/src/services/__tests__/AnchorGenerationService.devModel.test.ts`
- `anchor/mobile/src/services/__tests__/ApiClient.test.ts`
- `anchor/mobile/src/services/__tests__/AuthService.native.test.ts`
- `anchor/mobile/src/services/__tests__/BackendAnchorService.test.ts`
- `anchor/mobile/src/services/__tests__/SentryProductBreadcrumbs.test.ts`
- `anchor/mobile/src/services/AnalyticsService.ts`
- `anchor/mobile/src/services/AnchorCreationSession.ts`
- `anchor/mobile/src/services/AnchorGenerationService.ts`
- `anchor/mobile/src/services/ApiClient.ts`
- `anchor/mobile/src/services/AuthService.native.ts`
- `anchor/mobile/src/services/AuthService.ts`
- `anchor/mobile/src/services/BackendAnchorService.ts`
- `anchor/mobile/src/services/CreationAuthContext.ts`
- `anchor/mobile/src/services/v2/__tests__/creationPersistence.test.ts`
- `anchor/mobile/src/services/v2/__tests__/guestCreationPersistence.test.ts`
- `anchor/mobile/src/services/v2/creationPersistence.ts`
- `anchor/mobile/src/stores/__tests__/authStore.test.ts`
- `anchor/mobile/src/stores/__tests__/creationDraftReceipts.test.ts`
- `anchor/mobile/src/stores/authStore.ts`
- `anchor/mobile/src/stores/firstAnchorFlowStore.ts`
- `anchor/mobile/src/stores/v2/creationStore.ts`
- `anchor/mobile/src/types/index.ts`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/prisma/migrations/20261029000000_anchor_creation_sessions/migration.sql`
- `backend/prisma/migrations/20261029010000_creation_session_execution/migration.sql`
- `backend/prisma/migrations/20261029020000_guest_creation_abuse_budget/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/__pg__/anchorCreationFlow.pg.test.ts`
- `backend/src/__pg__/anchorCreationLedger.pg.test.ts`
- `backend/src/__pg__/chartRaces.pg.test.ts`
- `backend/src/api/middleware/__tests__/aiRateLimit.test.ts`
- `backend/src/api/middleware/__tests__/auth.test.ts`
- `backend/src/api/middleware/__tests__/bodyComplexity.test.ts`
- `backend/src/api/middleware/__tests__/requestAbuseSafety.test.ts`
- `backend/src/api/middleware/aiRateLimit.ts`
- `backend/src/api/middleware/auth.ts`
- `backend/src/api/middleware/bodyComplexity.ts`
- `backend/src/api/routes/__tests__/ai.test.ts`
- `backend/src/api/routes/__tests__/anchors.test.ts`
- `backend/src/api/routes/__tests__/auth.test.ts`
- `backend/src/api/routes/ai.ts`
- `backend/src/api/routes/anchors.ts`
- `backend/src/api/routes/auth.ts`
- `backend/src/api/routes/v2/askChartRoutes.ts`
- `backend/src/api/routes/v2/chartRoutes.ts`
- `backend/src/index.ts`
- `backend/src/services/__tests__/ChartCapabilityService.test.ts`
- `backend/src/services/__tests__/CoursePlannerService.test.ts`
- `backend/src/services/__tests__/PlannerEntitlementService.test.ts`
- `backend/src/services/__tests__/RevenueCatEntitlementService.test.ts`
- `backend/src/services/AnchorCreationLedger.ts`
- `backend/src/services/AnchorCreationQuotaPolicy.ts`
- `backend/src/services/AnchorCreationService.ts`
- `backend/src/services/chart/ask/askChartSchema.ts`
- `backend/src/services/chart/ask/AskChartService.ts`
- `backend/src/services/chart/ChartService.ts`
- `backend/src/services/CourseService.ts`
- `backend/src/services/GuestAccountMergeService.ts`
- `backend/src/services/MonetizationAccessService.ts`
- `backend/src/services/PlannerEntitlementService.ts`
- `backend/src/services/RevenueCatEntitlementService.ts`
- `backend/src/services/v2/__tests__/VisionGenerationService.test.ts`
- `backend/src/services/v2/visionPhotoExpand.ts`
- `docs/security/anchor-2-release-dependency-triage-20261029.md`

## Earlier audit and investigation record (historical)

# Anchor 2.0 final production release audit

Audit date: 2026-10-29. Checkout: `feat/chat-proposal-batch-ui`, commit `9bf7fcae3b7241ca3e599a98949b3db82543100a`, plus pre-existing uncommitted onboarding and analytics edits. This is a bounded audit, not a certification of the entire codebase or deployed service. No production build, deployment, submission, OTA, purchase, destructive database operation, or release was initiated.

## Decision

**iOS: NO-GO. Android: NO-GO.** Two source-confirmed release blockers against the specified generation policy remain. Neither has been proven against the deployed backend. Critical journeys, release binaries, subscriptions, migration and platform console configuration also lack sufficient evidence. Passing mocked tests or static configuration does not close those gates.

## Findings requiring correction

1. **P0 — generation quota bypass in the inspected source.** `backend/src/api/routes/ai.ts:211` permits unauthenticated requests with an `anchorId` beginning `temp-`, and `:700` mounts the handler with optional authentication. The path generates artwork and is protected by rate/concurrency limits, but the inspected handler has no durable user lifetime or trial generation check. A caller can request repeated temporary generations without consuming the save-time counter; authenticated temporary requests also use this path. This conflicts with the specified generation limits and creates AI cost exposure. It does not establish that a second saved free Anchor can be created. Verify actual deployment and run controlled negative tests. A safe repair needs a server-authoritative reservation/accounting design that preserves guest onboarding, retries, failed generation recovery and 1.5 compatibility; an abrupt authentication requirement would break the existing path.
2. **P1 — seven-generation trial cap absent from the Anchor save gate.** `backend/src/api/routes/anchors.ts:405` resolves monetization, assigns every `hasProAccess` user to the same paid branch, and counts up to ten saved Anchors per UTC day. It does not distinguish `isTrialPeriod` or count seven generations over the trial. `totalAnchorsCreated` only protects free saved Anchor creation. Generation and saving are separate operations, so adding a simple count of existing Anchor rows would not enforce the requested rule or survive deletion. A durable trial-period reservation ledger and authoritative trial identity/boundaries need design, migration and concurrency tests. Do not infer store trial start from an unrelated legacy field.

Neither issue was changed: a correct fix crosses the guest onboarding, billing, generation and legacy compatibility boundaries and cannot be established safely as an isolated patch from the available evidence. Backend deployment requires separate authorization.

## Security and entitlement observations

- Firebase Admin `verifyIdToken` is used in `backend/src/api/middleware/auth.ts:106`; no revocation check argument is supplied. Firebase signature, issuer and audience verification is delegated to the SDK; revoked-session behavior is not demonstrated. The focused auth tests mock verification.
- The Anchor save path locks the user row within a transaction and increments `totalAnchorsCreated` (`anchors.ts:405, 695`); idempotency ownership is checked. This is code evidence, not a real PostgreSQL concurrency or two-user IDOR test. Deletion/reinstall/account-linking and legacy counter backfill remain unverified.
- `RevenueCatEntitlementService.ts` fetches entitlement by server user ID, caches for 60 seconds and permits a last verified active snapshot for up to 24 hours during service failure, bounded by its reported expiry in `MonetizationAccessService.ts`. A refund/revocation during an outage can remain effective until refresh or expiry; operational acceptability and real store behavior require verification. No RevenueCat webhook route was established by the limited search; do not assume webhook support, replay protection or live configuration.
- The enhance handler checks ownership for non-temporary Anchor IDs. This is not an exhaustive endpoint ownership audit. Vision, Chart, image storage, uploads, signed URLs, rate limiter distribution, direct premium API access, SSRF, error disclosure, account deletion and cross-user tests remain open.
- `EXPO_PUBLIC` and Git history have not received a complete secret scan. Do not interpret absence of a reported secret as proof none exists. Actual environment values, provider credentials, storage policies and signing credentials were not inspected or printed.
- Dependency audit found known advisories; vulnerability reachability and fixes are **not fully triaged**. Backend: 5 critical, 24 high, 44 moderate, 10 low; mobile: 3 critical, 15 high, 13 moderate, 9 low. Counts are package-level audit results, not confirmed exploitable issues. Backend critical package names include `fast-xml-parser`, `handlebars`, `protobufjs`, `proxy-addr`, `websocket-driver`; mobile includes `protobufjs`, `shell-quote`, `websocket-driver`. Runtime direct dependencies including `axios` and `sharp` have high findings. Investigate applicable versions, actual paths and fixes before release; no blind upgrades were made.

## Purchase lifecycle and privacy

Focused mocked backend entitlement/billing tests passed, and the mobile paywall conditionally renders trial copy based on `offersTrial`. They do not verify App Store or Play products, price, introductory offer duration/eligibility, restore, renewal, refunds, billing hold, grace, account transfers, offline behavior or purchase resumption. No actual transactions were performed. RevenueCat configuration and production identity mapping need both-platform sandbox validation. The analytics focused suite passed, but the full funnel, logout identification, privacy consent, event payload and actual PostHog behavior are unverified. No claim is made that personal data cannot reach logs or analytics.

## Migration and user journeys

The existing live 1.5 upgrade, account and subscription restoration, guest linking, lifetime counter backfill, storage failure recovery, and all real-device journeys remain untested. The normal production profile is separate from the opt-in SQLCipher cohorts in `anchor/mobile/app.config.js`; the owner-pilot profile has migration disabled. Do not assert that production activates SQLCipher or that its migration has passed. Verify the actual intended production binary/profile, legacy fixtures, secure storage, recovery and coexistence before upload. Anchor creation, Home, all practice modes, Vision, Chart, notifications, deletion and failure paths need end-to-end execution, including data persistence and cross-account isolation. No Android device was attached (`adb devices` returned an empty list); no iOS device or macOS/Xcode environment was available in this Windows session.

## Platform and build evidence

- `anchor/mobile/app.json`: version 2.0.0, bundle/application ID `com.anchorintentions.app`, iOS build 16, Android versionCode 39, runtime 2.0; production EAS profile requests store distribution and Android app bundle with auto increment. These are source values; effective versions, production credentials, store identity and resulting artifacts are unverified.
- Checked-in Android `app/build.gradle:110` specifies target SDK 36. Release build type references debug signing in the checked-in file; determine whether EAS injects and actually uses the production upload key by inspecting an authorized build artifact and Play signing fingerprints. Do not upload a debug-signed artifact.
- Expo Doctor reports native directories with config fields that may not sync, ignored local module native directories, and 22 SDK patch mismatches. The actual EAS archive, prebuild behavior and effective native configuration must be examined. No AAB/IPA was built because authorization was not provided. No native signing, 16 KB page-size compatibility, privacy manifest merge, permissions, Xcode/SDK or release crash validation was performed.
- Apple requires Xcode 26+ and iOS 26 SDK+ for uploads since April 28, 2026 and completed age-rating questions: [Apple requirements](https://developer.apple.com/news/upcoming-requirements/?id=02212025a). Google requires target API 36 for app updates from August 31, 2026 unless an applicable extension is granted: [Google Play target requirements](https://support.google.com/googleplay/android-developer/answer/11926878). Google requires an in-app deletion option and a functional external deletion resource: [Google account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111). Console state, legal URLs, screenshots, review account, IAP availability, Data Safety and privacy disclosures are unverified.

## Commands and results

Windows PowerShell, Node v24.15.0, npm 11.12.1, existing installed dependencies. Commands run in the paths indicated; logs are local temporary files and may contain test data. Exit codes below are the underlying commands, not the PowerShell wrapper.

| Directory | Command | Result |
|---|---|---|
| backend | `npm.cmd run type-check` | 0, passed |
| backend | `npm.cmd run lint` | 1, 2,605 errors and 73 warnings; output includes extensive CRLF/prettier violations. Other failures require triage; do not classify all as line endings. |
| backend | `npm.cmd test -- --runInBand` | Windows process exit -1073740791; incomplete, no suite summary. Cause not established. |
| backend | `npm.cmd test -- --runInBand src/api/routes/__tests__/anchors.test.ts src/api/routes/__tests__/billing.test.ts src/api/middleware/__tests__/auth.test.ts src/services/__tests__/RevenueCatEntitlementService.test.ts src/services/__tests__/MonetizationAccessService.test.ts` | 0; 5 suites, 81 tests passed; mocks limit conclusions. |
| backend | `npm.cmd audit --json` | 1; 83 package findings, reachability untriaged. |
| anchor/mobile | `npx.cmd tsc --noEmit` | 2; errors at `VisionAddSceneSheet.test.tsx:80` and `useV2Vision.ts:231`. |
| anchor/mobile | `npm.cmd test -- --runInBand` | Interrupted after no test output; no result, not a pass. |
| anchor/mobile | `npm.cmd test -- --runInBand --testPathPatterns=AnalyticsService` | 0; 1 suite, 43 tests passed. |
| anchor/mobile | `npm.cmd test -- --runInBand --testPathPatterns='(AnalyticsService|funnel|paywall|secureGeneration|sqlcipher)'` | 255; Windows shell interpreted pipe characters. No tests ran; full funnel and focused storage/paywall remain unverified. |
| anchor/mobile | `npm.cmd run validate:firebase-config` | 0; preview profile Android Firebase file/package validation only. |
| anchor/mobile | `npm.cmd run test:v2-boundary` | 1; lists production-to-V2 import violations. Impact and intended scope require investigation. |
| anchor/mobile | `npm.cmd audit --json` | 1; 40 package findings, reachability untriaged. |
| anchor/mobile | `npx.cmd expo-doctor` | 1; 17/20 checks passed, three failed as described above. |
| root | `adb devices` | 0; no attached devices. |

No mobile ESLint script was found. No integration database, iOS release validation, Android AAB validation or store tests were run. Production configuration validation was limited to source inspection; Firebase check used preview profile. No production secrets were printed intentionally.

## Fixes and files

No product or infrastructure fixes were applied. Audit deliverables are `ANCHOR_2_0_FINAL_RELEASE_AUDIT.md` and `ANCHOR_2_0_RELEASE_CHECKLIST.md`. Existing five dirty paths were preserved. No dependency upgrades were made.

## Required manual and follow-up checks

1. Implement and independently test server-authoritative generation quotas, including anonymous onboarding, failure/refund, simultaneous requests, retries, trial transitions, existing accounts and both app versions. Verify deployed version only with approved release procedure.
2. Execute two-account authenticated IDOR and direct premium API tests in a safe isolated environment, including Vision/Chart/images, expiry/revocation, upload constraints and credentials exposure.
3. Complete advisory reachability triage, secret/history scan, logging and endpoint inventory; resolve reachable material risks.
4. Resolve or explicitly disposition TypeScript, lint, boundary and Expo Doctor failures; rerun complete suites, funnel and real-PostgreSQL race tests.
5. Perform realistic 1.5 upgrade and migration tests with backup/recovery, guest linking, reinstall and cross-account isolation.
6. Run actual iOS and Android store-sandbox purchase lifecycle, offer eligibility, prices, restore and account switching.
7. Test actual release candidates on S24 Ultra/Android 16, Moto g play/Android 14 and supported iPhones, including every critical journey, offline, interruptions and stability.
8. Verify both store consoles, deletion website, privacy, policies, review access and product configuration.
9. After separate build authorization, validate IPA/AAB signing, effective SDK/target, page-size support and native release configuration.
10. Confirm deployment inventory, backups, rollback compatibility, monitoring and tested emergency controls before rollout.

## Rollback and recovery planning

Before any rollout, identify the currently live 1.5 store binaries, backend deployment and OTA channel/runtime, obtain and verify recoverable database and object-storage backups, and test restore in isolation. Preserve old-client compatibility and do not reverse or delete production data casually. Verify the actual flags and operator access before relying on a kill switch. If errors, entitlement failures or data integrity problems rise, pause the store rollout, disable only a verified safe feature flag if available, and restore the previous compatible backend/OTA through the approved operational process. An app already installed cannot be instantly rolled back via store submission; a compatible corrective binary or previously validated OTA may be needed. No rollback or backup restore was tested here.

## Remediation update — 2026-10-29

**Both original quota blockers remain open; iOS and Android remain NO-GO.** The earlier finding should be read precisely: the requested free limit is one lifetime **saved** Anchor, not one lifetime preview. `/api/ai/enhance` accepts temporary IDs; V2 creation requests up to two interpretations and may issue another request for a missing interpretation. Legacy screens also use temporary IDs, sometimes without a Firebase token. `POST /api/anchors` separately serializes and counts saves. The API lacks a shared durable generation accounting boundary, and generation and save cannot safely be conflated. `anchors.ts` uses UTC calendar days for its current saved-row Pro cap. Existing mobile entitlement code has retired the trial Anchor counter, so it does not establish the requested seven-generation accounting semantics. The question of whether a generation unit is a successful preview request or a completed creation containing multiple previews was submitted for product clarification; it remains unresolved at this update.

The real RevenueCat v1 customer response documents `period_type` under the subscription record, not necessarily on the entitlement: [RevenueCat customer information](https://www.revenuecat.com/docs/customers/customer-info). The existing service read only the entitlement field, so a normal store response could misclassify a trial as paid. `backend/src/services/RevenueCatEntitlementService.ts` now looks up the matching product subscription period first, retaining the former field as a compatibility fallback. The new mocked regression failed before the change and passed afterward; 2 focused suites, 12 tests passed. Real Apple and Google subscription responses, product-key mapping, grace/refund behavior and client consequences remain unverified. This corrects classification in this path, not quota enforcement. `PlannerEntitlementService` separately treats active RevenueCat access as Pro and can use persisted status when RevenueCat is unavailable; its intended Chart policy and expiry behavior need a separate security review.

Mobile TypeScript failed on an uninitialized shared request variable and nullable test parent. `anchor/mobile/src/hooks/v2/vision/useV2Vision.ts` now guards the variable during cleanup; `anchor/mobile/src/components/v2/vision/__tests__/VisionAddSceneSheet.test.tsx` asserts the parent exists before indexing. `npx.cmd tsc --noEmit` passed (exit 0), as did the Vision sheet suite (17 tests) and useV2Vision suites (55 tests). This does not constitute device verification.

Additional checks, Windows Node 24.15.0, npm 11.12.1:

| Working directory | Command | Result |
|---|---|---|
| backend | `npm.cmd test -- --runInBand src/services/__tests__/RevenueCatEntitlementService.test.ts` before fix | exit 1; added test failed as expected |
| backend | `npm.cmd test -- --runInBand src/services/__tests__/RevenueCatEntitlementService.test.ts src/services/__tests__/MonetizationAccessService.test.ts` | exit 0; 2 suites, 12 tests |
| backend | `npm.cmd run type-check` | exit 0 |
| backend | `npm.cmd test -- --runInBand` | Windows exit -1073740791 again; no completion summary; cause unverified |
| mobile | `npx.cmd tsc --noEmit` | exit 0 |
| mobile | `npm.cmd test -- --runInBand --testPathPatterns=VisionAddSceneSheet.test.tsx` | exit 0; 17 tests |
| mobile | `npm.cmd test -- --runInBand --testPathPatterns=useV2Vision` | exit 0; 55 tests |
| mobile | `npm.cmd test -- --runInBand --testPathPatterns=paywall` | exit 0; 10 suites, 76 tests |
| mobile | `npm.cmd test -- --runInBand --testPathPatterns=secureGeneration` | exit 0; 6 tests |
| mobile | `npm.cmd test -- --runInBand --testPathPatterns=sqlcipher` | exit 0; 4 suites, 55 tests; no actual device migration |
| mobile | `npm.cmd test -- --runInBand --testPathPatterns=onboardingAnalytics` | exit 0; 37 tests |
| mobile | `npm.cmd test -- --runInBand --testPathPatterns=funnel` | exit 0 but no tests found; not a pass |

No local PostgreSQL installation, running PostgreSQL service, Docker command, or configured isolated database was established during this remediation. No realistic quota, multi-user or concurrent database integration test was executed. Do not use production as a substitute. No schema or database changes were made.

Other failed-check classification: backend lint remains **unverified**, with CRLF errors and other violations requiring triage; V2 boundary check remains **unverified**, and its string-based scanner flags shared components as well as actual imports, so its architectural intent must be assessed before changing code or the check. Expo Doctor remains **unverified**: checked-in Android native sources and ignored iOS prebuild require inspection of the actual EAS build process; patch mismatches alone do not prove a binary defect. Full suites remain **unverified**, and the backend Windows crash is not explained. Dependency audit remains **unverified for release**: `npm explain` shows `proxy-addr` in Express runtime, `protobufjs` in Google/Firebase dependencies, `websocket-driver` through Firebase, and Handlebars in the `ts-jest` dev path. This identifies installation paths, not exploitability; assess trust-proxy configuration and actual attacker-controlled inputs as well as all other high/critical findings. No dependency upgrades or suppressions were applied.

Changed during remediation: the RevenueCat service and its test, the two Vision TypeScript files above, and these reports. No migration, deployment, production build, OTA or submission was performed. Safe rollout requires testing against an isolated migrated PostgreSQL database, both real store sandbox formats and legacy clients, then a separately authorized backend deployment with an additive migration and rollback plan if the final quota design requires one.

The mobile full-suite retry `npm.cmd test -- --runInBand` produced no suite output and was interrupted; it remains incomplete. `git diff --check` passed for the current working tree (with Git line-ending warnings). The existing dirty onboarding and analytics files were not edited by this remediation.

## Approved quota policy and follow-up — 2026-10-29

The user finalized the accounting unit: **one successful creation session**, including two initial interpretations, recovery of a missing interpretation and saving a selection, commits one generation credit when usable options are durably recorded. An abandoned successful session counts; all-technical-failure releases the reservation. Free one-lifetime-saved-Anchor access remains separate; trial has seven successful sessions per trial, and Pro has ten per server day. The prior request for a product decision is resolved. Existing save logic uses a UTC calendar day, while another older document describes a rolling window; the currently implemented save path is the concrete contract evidence, but the new generation-session reset has not been implemented or validated.

**The original two generation-policy blockers remain open.** There is no server-owned creation-session table, durable reservation/option record, request budget, guest-to-account binding or integrated session idempotency. The current saved-row count is not equivalent to successful generation sessions. No claim is made that seven/eight trial or ten/eleven Pro generation attempts are enforced. Legacy clients can send temporary IDs based on timestamps and do not provide a server session identity; distinguishing a lost-response retry from a fresh request must be addressed without assuming client-provided identity. This is an implementation/compatibility problem still to solve, not a reason to consider quotas complete.

Changes made in this follow-up:

- `backend/src/services/PlannerEntitlementService.ts`: removed the unbounded fallback from persisted subscription status; a verified RevenueCat result is checked against expiry, verified store trials use the trial planner tier, and the existing explicitly configured legacy-migration bridge remains available. No verified snapshot during an outage now denies access instead of trusting an old boolean. The RevenueCat service may use an active previously verified snapshot for at most 24 hours and the planner checks its expiry; revocation during an outage can remain undetected within that window. Review the outage tradeoff and real store grace/refund behavior before release.
- `backend/src/api/middleware/aiRateLimit.ts` and `backend/src/api/routes/ai.ts`: an additional anonymous IP ceiling of 20 requests per 24-hour rolling window applies to both enhancement route aliases. Requests consume this operational limit even when they fail. Existing rate/concurrency controls remain. This is a proportionate cost-control mitigation, **not a durable generation quota or protection against IP rotation**. Users on shared networks share an allowance; when Redis is absent the existing limiter uses process-local memory and multiplies across instances or resets on restart. Confirm production Redis before relying on it. Authenticated account requests skip only this additional guest ceiling and still use existing controls.
- `backend/src/api/middleware/__tests__/aiRateLimit.test.ts`, `backend/src/services/__tests__/PlannerEntitlementService.test.ts`: added guest, forged-body, authenticated-skip, stale/expired and trial tests. `backend/src/__pg__/chartRaces.pg.test.ts` now supplies deterministic RevenueCat and AI fixtures while exercising real database transactions.

An isolated PostgreSQL 16 database named `anchor_quota_audit_1793301497` was created locally in WSL; no production database was used. `npx.cmd prisma migrate deploy` completed with exit 0 on this fresh database. The ordinary Jest setup intentionally deletes `CHART_PG_DATABASE_URL`: the initial nominal run skipped all 19 tests. A separate temporary setup explicitly selected only the isolated test database. The first real attempt failed to connect while WSL was idle. A second attempt was interrupted after it became clear its provider fixture was not safe for an isolated test. The third run reached the database and failed five planner tests because the missing-key fixture was rejected before fallback; 14 passed. After replacing it with an explicit in-process failing provider fixture, the fourth run passed **19/19** real PostgreSQL Chart race/replay tests (RevenueCat and AI mocked). It does not test the requested Anchor generation quota.

Additional commands and outcomes:

- `npm.cmd test -- --runInBand src/services/__tests__/PlannerEntitlementService.test.ts src/services/__tests__/RevenueCatEntitlementService.test.ts src/services/__tests__/MonetizationAccessService.test.ts`: exit 0, 3 suites / 35 tests; mocked provider.
- `npm.cmd test -- --runInBand src/api/middleware/__tests__/aiRateLimit.test.ts src/api/routes/__tests__/ai.test.ts`: exit 0, 2 suites / 26 tests; middleware and provider mocked where applicable.
- `npm.cmd run type-check` (backend): exit 0. `git diff --check`: exit 0, with line-ending warnings.
- `npm.cmd test -- --runInBand --setupFiles <temporary isolated setup> -- src/__pg__/chartRaces.pg.test.ts`: final exit 0, 19 tests; see limitations above.

No production migrations, deployments, OTA, store submission or build were performed. Existing release checks, dependency triage, real store purchase lifecycle and device verification remain open as documented above. The isolated test database and role were left in place for follow-up; they contain test records and must not be confused with production. Before upload, complete and prove the integrated creation-session accounting, session ownership and guest linking, recovery, retries, failed operations, direct API and concurrency cases on isolated PostgreSQL; reconcile legacy clients and deploy only after separate authorization. Both platforms remain **NO-GO**.

## Creation-session implementation progress — 2026-10-29

**Both quota blockers remain open; iOS and Android remain NO-GO.** Added an additive PostgreSQL schema for quota owners, creation sessions and up to two durable options, plus an internal ledger that serializes reservation counts by locking the owner row. This ledger is not connected to any API route and is not a complete quota implementation. In particular, trusted guest identity issuance and account linking, authoritative trial-period identity, bounded generation attempts, interruption recovery, legacy compatibility, saving integration and abandoned-session reconciliation still require implementation. Legacy anonymous requests can supply fresh timestamp-based temporary IDs and carry no durable credential; those IDs cannot establish ownership or distinguish a retry from a new session. Do not treat the schema as a working bypass fix.

The migration was executed directly with psql against the existing isolated local PostgreSQL 16 database `anchor_quota_audit_1793301497`; it was not recorded in Prisma's migration history there. No production database was accessed. `prisma validate` and backend `npm run type-check` passed. The new real PostgreSQL ledger suite passed **4/4 tests**: concurrent 7/12 and 10/16 reservations, duplicate reservation with two options, and failure release. These are ledger-level results, not the required end-to-end trial 7/8 or Pro 10/11 API proofs. No guest-link, route bypass, real generation, or legacy integration tests were executed. The migration, service and tests are preliminary and must not be deployed as a complete policy fix.

## Route protection and migration-chain follow-up — 2026-10-29

The shared handlers for `POST /api/ai/enhance` and `POST /api/ai/enhance-controlnet` now reject requests without a verified Firebase identity with HTTP 426 and `ANCHOR_CREATION_UPGRADE_REQUIRED` before invoking the provider. This closes the anonymous temporary-ID bypass in the current source only. Authenticated generation still does not use the ledger or enforce generation quotas; the save endpoint does not verify a session or option. Both quota release blockers remain open.

**Rollout impact:** current inspected V2 guest onboarding and unauthenticated legacy creation calls do not send a Firebase token, so this change blocks their artwork generation until a compatible client with verified guest identity and account linking is shipped. The exact released version/build range is not established from the inspected source. Do not deploy this change independently. Existing saved records and read paths were not changed. The upgrade response does not imply that a compatible app has already been released.

Fresh isolated PostgreSQL 16 database `anchor_creation_migrate_20261029`: `prisma migrate deploy` applied all 56 migrations, including `20261029000000_anchor_creation_sessions`; 56 finished migration records, zero rolled back, and `prisma migrate status` reports up to date. The first status attempt had a schema engine connection error; a retry succeeded. Mocked-provider route suite passed 12/12, including both anonymous-alias rejection tests. Backend type-check and `git diff --check` passed. No real API quota tests were run; trial 7/8, Pro 10/11, guest linking, cross-account rejection, recovery and save authorization remain unverified and unimplemented. No production database or deployment was touched.
