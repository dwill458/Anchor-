# Account-scoped persistence repair — 2026-10-13

Status: implementation remains uncommitted. All seven original automated safety assertions now pass after the timestamp follow-up described below. Full native account/interruption acceptance remains open. Earlier checkpoints below describe their results at that time.

## Decision and root cause

The outgoing UI array was also the only live durable collection. Filtering it in `setUser`, `setSession`, and authenticated hydration therefore overwrote the previous account's unsynced records. The adapter's debounce did not order writes that were already executing. It also deleted the previous SecureStore chunks before completing their replacement.

The bounded repair uses **retained owner partitions in the existing encrypted vault**, an alternative to introducing independently switched global keys. Stable scopes are `account:<userId>`, `guest`, and `recovery`. No SQLCipher, new dependency, runtime bump, encryption key policy, subscription, animation, audio, or haptic changes are included.

`anchorOwnership.ts` defines the ownership boundary. The durable collection consists of every partition; the active `anchors` array is a view of the selected partition. Account activation bypasses the durable mutation path. Native de-duplication skips an identical durable payload, so switching accounts does not add another full-vault rewrite. Ordinary durable edits still serialize the full retained collection; this is not a storage performance migration.

Private records with missing owners or historical placeholder owners enter `recovery`; they are not assigned to the first login. Guest records do not appear in authenticated scopes except for the explicitly staged first-Anchor handoff. A persisted transfer-owner ledger and account-specific pending draft/mutation state prevent B from adopting A's guest handoff. The original guest source is retained while retries are pending. Existing backend idempotency and account/request revision fences remain authoritative.

## Legacy preservation and interruption

- Read the existing vault and classify records only from explicit owner metadata. Preserve IDs, private fields, dates, pending records, and selected-owner metadata.
- Retain the original plaintext legacy vault during secure conversion. Do not delete it after the new write.
- Retain the original SecureStore chunks and an `__legacy_manifest` before first publication of a generation manifest. The original source is never reclaimed by generation cleanup.
- Write replacement chunks under a unique generation, read every chunk back, and compare the exact payload before publishing the single manifest pointer.
- Failed/incomplete manifests and chunks raise recovery errors; they are not cleared or converted into an empty vault. Failed restore/write blocks subsequent vault publication and exposes recovery state to startup.
- Keep the previous committed generation. Reclaim only older immutable generations created by this new writer, after publication. A racing reader retries if its manifest has changed. Partial failed writes can leave orphan generation chunks; there is no destructive legacy cleanup or orphan sweep in this repair.

Interrupted conversion is verified using the real adapter with mocked native storage: failure before manifest publication leaves the original readable, retry activates the new generation, and the original chunks/manifest remain intact. Corruption/uncertain ownership requires explicit recovery; resolving ambiguous ownership is deliberately not guessed.

## Ordering and isolation

Payload ownership is captured synchronously at mutation time. Account activation never rewrites records from the outgoing partition. Foreign late Anchor responses cannot replace the incoming account's array. Manifest publication is serialized per logical storage key, and a completed newer generation prevents an older generation from publishing afterward. Native chunk writes can complete out of order without overwriting one another because their keys are immutable.

Failed writes reject the explicit `flushPersistence()` durability receipt and set a recoverable error; last committed bytes stay recoverable. UI setters remain synchronous and are not a durability acknowledgement. First-Anchor backend mutation cursors and completion now await that receipt before advancing. Sealed Save waits for the receipt before presenting guest success; a rejected write retains the draft and displays a retry error. A process kill before any save completes cannot turn an uncommitted edit into a durable edit. Cross-process/native filesystem timing still requires device acceptance; in-memory native mocks do not prove it.

## Original seven assertions

All seven were rerun before editing: **7 failed**, plus the existing A→B→A hydration revision assertion passed. Original gate files and their assertions were not edited.

| Original assertion | Current source result |
|---|---|
| `setSession`, successful B hydration, restart, offline A retention | PASS |
| `setSession`, failed B hydration, restart, offline A retention | PASS |
| `setUser`, successful B hydration, restart, offline A retention | PASS |
| `setUser`, failed B hydration, restart, offline A retention | PASS |
| Older asynchronous native write settles after newer commit | PASS |
| Duplicate backend ID with different local IDs | PASS |
| Missing local ordering timestamp eventually accepts newer server writing | **PASS with retained local recovery evidence** |

At the first repair checkpoint, the last assertion conflicted with the existing passing regression protecting locally edited text/progress with unknown timestamps, including a newer server revision. The current model cannot prove that such writing was synchronized. Advancing its timestamp or accepting the server would discard potentially unsynced changes. The follow-up below resolves this with explicit pending-edit tracking and a retained owner-scoped recovery copy; the original assertions and preservation regression both pass.

## Automated verification

- Focused regression run: **14 suites / 296 tests PASS** covering Anchor/auth stores, AuthHydrationService, PostAuthFlowService, appAuthState, startup integration/hooks, first-run and Sealed Save, ApiClient, first-run store, creation persistence, and recovery UI.
- Final regression includes explicit storage recovery and late-success startup checks, rejected first-Anchor durability confirmation, and rejected guest-save receipt. Evidence: `repair-final-regressions3.log`.
- Retention/order/partition gates: **3 suites / 14 tests PASS**. Added coverage discards all in-memory partitions before reloading saved bytes, imports empty/small/72-record synthetic legacy vaults, retains ambiguous source bytes, fences a foreign late update, preserves guest handoff ownership/cursor through A→B→A, restores saved dates/selection, and reports a failed durable write.
- Real-adapter tests with mocked native storage: **5/5 PASS**. Interrupted replacement, missing legacy chunks, Unicode split-boundary round-trip, interrupted legacy conversion/retry/source preservation, and identical payload de-duplication.
- Senior hydration gates: **2 PASS / 1 FAIL**, as above.
- TypeScript: final `tsc --noEmit --pretty false` exits 0 (`repair-final-types5.log`).
- `git diff --check` passes; existing CRLF notices are not whitespace failures.

All tests use synthetic records and fake native storage. Account snapshots, network fixtures, and module-memory restart simulations are not native force-stop/restart acceptance.

Some old test fixtures used `test-user-123` as a wildcard owner, migrated foreign records, or exposed unapproved guest records to an authenticated account. Fixtures now use explicit synthetic matching owners; cross-account/guest tests assert durable retention **and** exclusion from the incoming UI/migration. Their safety requirements were strengthened, not skipped. `appAuthState` also restores a functioning synthetic SecureStore mock after `resetAllMocks`, so readback verification is tested instead of replacing native reads/writes with no-ops.

## Reported startup recovery loop

The user reported the normal app repeatedly displaying “Unable to restore saved data.” Source investigation reproduced a separate latch: a required local store finishing after the ten-second deadline could never dismiss the recovery screen. The guard now clears the timeout condition only after **both** required stores finish. The app-level regression asserts recovery is shown while unresolved, dismissed after successful late restoration, and saved content remains intact. A real storage/ownership recovery failure remains closed even if middleware hydration callbacks fire.

The connected phone was running `com.anchorintentions.app` (version 2.0.0 / code 39, debuggable). This task did not install, clear, extract its vault, or alter its account. Filtered structural log inspection did not identify the cause of that phone's currently reported error. The source fix is not a claim that the phone's error has been resolved.

## Exact files changed by this repair

Production:

- `anchor/mobile/App.tsx`
- `anchor/mobile/src/stores/anchorOwnership.ts` (new)
- `anchor/mobile/src/stores/anchorStore.ts`
- `anchor/mobile/src/stores/encryptedPersistStorage.ts`
- `anchor/mobile/src/stores/authStore.ts` (preserves earlier uncommitted fixes)
- `anchor/mobile/src/services/AuthHydrationService.ts` (preserves earlier uncommitted fixes)
- `anchor/mobile/src/types/index.ts` (additive pending-draft owner field)
- `anchor/mobile/src/hooks/useRequiredLocalHydrationGuard.ts`
- `anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx`

Tests:

- `anchor/mobile/src/stores/__tests__/secureGeneration.test.ts` (new)
- `anchor/mobile/src/stores/__tests__/authStore.test.ts`
- `anchor/mobile/src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx`
- `anchor/mobile/src/services/__tests__/AuthHydrationService.test.ts`
- `anchor/mobile/src/services/__tests__/PostAuthFlowService.test.ts` (preserves earlier uncommitted tests)
- `anchor/mobile/src/services/__tests__/appAuthState.test.ts`
- `anchor/mobile/src/hooks/__tests__/useRequiredLocalHydrationGuard.test.ts`
- `anchor/mobile/src/__tests__/AppStartupHydration.integration.test.tsx`
- `docs/performance-audit-2026-10/harness/senior-review/ownershipPartition.gate.test.ts` (new)

Documentation: this report, `PERFORMANCE_REMEDIATION_PLAN.md`, `PERFORMANCE_AUDIT_REPORT.md`, and `DEVICE_VALIDATION_MATRIX.md`. Ignored test logs are under `harness/senior-review/repair-*.log`. Isolated source/build diagnostics are under `E:\apd\record\account-repair-*` and `gradle-account-repair-4096m.log`.

No changes were staged or committed. Existing Share Studio, Vision, unrelated assets, and prior review work were preserved.

## Native checkpoint and readiness

The final product-source release build succeeded in 2m40s after the first successful 4 GiB build (13m57s). Build evidence: `gradle-account-repair-final.log`, `account-repair-final-build-result.json`. The isolated package remains `com.anchorintentions.perflab20261012`, Firebase `demo-anchor-perf`, loopback API/Auth, OTA disabled, R8/resource shrinking/full mode enabled. The old build failed with Java heap OOM at R8. This attempt raises only the isolated Gradle JVM heap from 2 GiB to 4 GiB (768 MiB metaspace), uses one worker, and keeps native dependencies/runtime/release optimization unchanged. Host inventory: approximately 15.2 GiB physical RAM, 3.3 GiB free physical and 11.7 GiB free virtual at preflight. Gradle documents `org.gradle.jvmargs` as the build JVM setting: https://docs.gradle.org/current/userguide/config_gradle.html.

The old full-tree refresh spent time copying test caches; it was interrupted. The bounded copy excludes test caches/docs. Reapplying V5 overlays encountered existing diagnostic files and an older V4 baseline; existing known diagnostic overlay files were restored from the archived lab copy, keeping the new persistence adapter and owner-partition code. Eight critical product-file hashes matched the shared source. The App recovery guard was added to the preserved diagnostic App before the bundle task started; its source/lab hashes and timestamp are recorded separately.

**Answer:** Account A→B→restart→offline A retention and exclusion from B pass automated synthetic tests for explicitly owned, committed records. Native app acceptance remains separate. Legacy source remains recoverable after interrupted conversion in synthetic tests. The overall prerequisite remains **OPEN** until the remaining timestamp safety assertion and native account/guest/interruption matrix are resolved. No SQLCipher or animation remediation follows this task.


## Final native validation checkpoint

The release optimization blocker is repaired in the isolated lab. R8/minification/resource shrinking remain enabled. The final lab-only loopback network-policy rebuild succeeded in **4m36s** (`gradle-account-repair-loopback.log`). APK SHA256: **EC2F3A3AEFF08C6AC4B888051C3D09CF403420E8F325155128623DC81A9C34C4**. Application ID is `com.anchorintentions.perflab20261012`; version 2.0.0 / code 39, non-debuggable, profileable, OTA disabled. Eight repaired product files match the shared-source SHA256 hashes (`account-repair-final-source-hashes.json`). The diagnostic App includes the same storage-recovery guard.

A fresh task-owned Android emulator (`emulator-5570`) installed this APK. Synthetic Firebase A sign-in reached Home without the restore-error screen. Removing both loopback reverse ports and force-stopping/relaunching the lab left offline startup on its loading skeleton; no native offline-content recovery is claimed. Evidence screenshots: `E:\apd\record\account-repair-native`. Android initially denied HTTP to 127.0.0.1; only the lab network-security XML was amended to allow that loopback address. Production network policy was unchanged. The software emulator needed reduced pixel resolution after a SystemUI ANR; this is functional validation, not frame/performance acceptance.

Native **unsynced** Anchor retention, direct A-to-B switching, guest transfer, interrupted-write/conversion recovery, and the complete offline return-to-A matrix remain **unverified**. The automatic approval review rejected creating a synthetic Anchor in the RAM-only local fixture API with the reason "blocked by policy" and no further detail. It was not retried through an alternative tool. The current normal phone was disconnected; no normal package installation, account access, vault extraction, reset, or OTA occurred.

The overall gate remains **OPEN**: six of seven original assertions pass; missing-timestamp convergence still conflicts with the existing protection of potentially unsynced local writing. Final regressions: **14 suites / 296 tests pass**; final TypeScript and diff check pass. Interrupted legacy conversion recovery is verified automatically with mocked native storage, not certified on a device. No commit or staging, SQLCipher, or animation remediation followed.

Task-owned Auth Emulator/API processes were stopped, the fresh emulator was terminated, and all three generated credential files were deleted (zero remaining). Diagnostic build/test evidence is retained.


## Timestamp-convergence repair follow-up — 2026-10-13

The previously failing missing-timestamp assertion now passes **without changing any of the seven original assertions**. First observation preserves the local record and stores owner-scoped reconciliation evidence. A strictly newer server revision from a later hydration may become current only when the local content has not changed and no known local mutation is pending. This observation is not presented as proof of synchronization: the complete original local record is retained as a non-recursive recovery copy inside the same encrypted owner partition. Repeated reads, invalid/older/equal revisions, and fast-list/export reads within one hydration cannot advance the unresolved record.

Known edits retain their pending fields until a sync response contains the edited values. Stale direct acknowledgements and queued retries cannot erase a newer pending edit or clear its protection. Existing server-authoritative Release/deletion behavior is preserved. Recovery evidence survives subsequent server refresh/sync; no new plaintext store, dependency, native/runtime, subscription, or UI change was introduced. `getLocalRecoveryAnchor(id)` reads the retained original only from the current owner's partition. There is no new user-facing conflict-resolution screen; unresolved legacy writing stays recoverable through this store API and retained original storage, rather than being marked synchronized or deleted.

Files added/changed in this follow-up: `anchor/mobile/src/services/anchorReconciliation.ts` (new), `anchor/mobile/src/services/AuthHydrationService.ts`, `anchor/mobile/src/stores/anchorStore.ts`, `anchor/mobile/src/types/index.ts`, `anchor/mobile/src/services/__tests__/AuthHydrationTimestampSafety.test.ts` (new), `docs/performance-audit-2026-10/harness/senior-review/ownershipPartition.gate.test.ts`, and this report plus the three audit documents.

Evidence: unchanged failing baseline in `timestamp-baseline.log`; new tests red in `timestamp-safety-red.log`; **17 suites / 312 tests PASS** in `timestamp-regressions-final.log`, **3 suites / 15 storage tests PASS** in `timestamp-storage-gates-final.log`, and final focused nullable-ack/review tests plus TypeScript in `timestamp-final-review.log` / `timestamp-types-final4.log`. Nine timestamp-specific tests cover preserved original/reload, repeated observations, known pending writing/reload, account isolation, bypassed setter edits, confirmed acknowledgements, stale direct/queued acknowledgements, and nullable-field acknowledgement. The storage gate discards every in-memory partition, reloads committed bytes, verifies B cannot retrieve A's original, and restores it unchanged on return to A.

**Readiness:** all seven original automated safety assertions are green. A-to-B/restart/offline-A retention and interrupted legacy conversion remain verified automatically, not in the complete native app matrix. The previously built isolated APK predates this timestamp follow-up; no native acceptance or resolution of the user's current phone restore error is claimed. Changes remain uncommitted and unpublished. SQLCipher and animation remediation remain out of scope. Additional recovery evidence increases encrypted storage size only for records requiring reconciliation; this has not been benchmarked natively.

## Current-source native recovery validation — 2026-10-13

This bounded continuation supersedes earlier source/native readiness checkpoints. The repair and timestamp follow-up are already in HEAD `13beacd61d35bffefaa3c5c5ece4416abb3200f9`; this pass leaves a narrowly tested late-auth/snapshot hydration continuation fix uncommitted. All seven original assertions remain unchanged and pass; final targeted regressions are **17 suites / 322 tests PASS**, storage gates **3 suites / 15 tests PASS**, and TypeScript passes.

The current-source isolated release APK builds with Hermes/V2, R8/resource shrinking, non-debuggable/profileable release, demo/loopback services, and OTA disabled. Final APK SHA256 is **23D06F46DDA9C70E0DA9322D3314887B14C2A2741747DB64EDCA5C119E72624E**. Emulator-native tests cover committed A retention/exclusion from B, actual process restarts, offline restoration of an existing A session, later-revision recovery-copy convergence, late auth/vault hydration recovery, native adapter publication interruption, retained synthetic legacy source, and C-bound guest transfer through B/restart/backend completion/replay. The exact API-offline B-to-A sign-in attempt fails and ends unauthenticated; no account-isolation bypass was added. Physical/iOS and the owner-phone error remain unresolved. Large-vault storage/startup latency remains severe. The acceptance gate remains **OPEN**; no SQLCipher, deployment, OTA, animation/audio/haptic change, staging or commit followed.

See [NATIVE_DATA_RECOVERY_VALIDATION.md](NATIVE_DATA_RECOVERY_VALIDATION.md) for exact Git/source/APK evidence, native-versus-automated boundaries, performance measurements, cache-identity/recovery requirements, remaining scenarios, and cleanup.

## PERF-003 / storage blocking investigation — current bounded pass

See [PERF003_STORAGE_BLOCKING_REMEDIATION.md](PERF003_STORAGE_BLOCKING_REMEDIATION.md) for the current await-chain map, controlled Focus reproducer, identical in-flight write correction, unchanged safety gates, isolated probes, measurements and explicit verification gaps. This supplements the current-source native recovery checkpoint; it does not close physical-device acceptance, restart the audit, or authorize SQLCipher implementation. Changes remain uncommitted and unpublished; motion, visuals, audio and haptics are unchanged.
