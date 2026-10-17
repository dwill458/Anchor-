# Native data recovery and startup validation — 2026-10-13

Bounded continuation of the existing persistence repair. Data-integrity acceptance remains OPEN. No deployment, OTA, SQLCipher, framework/native dependency upgrade, animation, audio, haptic, commit, or staging operation was performed.

## 1. Exact source state

- Branch: `feat/celebration-layer`.
- HEAD: `13beacd61d35bffefaa3c5c5ece4416abb3200f9` (`fix: harden account persistence and Vision exports`).
- Unlike the earlier repair report's checkpoint, the timestamp-convergence implementation is already committed in this HEAD. This validation pass made no commits.
- Initially dirty: nine Share Studio/Vision/QA tracked paths plus existing untracked emulator QA artifacts. Their diff/status were recorded before work under `E:\apd\record\native-validation-preexisting.diff` and `native-validation-initial-status.txt`.
- Final normalized Share Studio/Vision diff equals its initial SHA256 (`eab536b341b797924fa2708aa8c26c78cb3bc378ca19c1b61985ae9363a9e13d`). Original safety gate files are unchanged. Evidence: `native-validation-preservation-check.json`. The existing QA result/artifacts were not edited by this pass.
- This pass changes only startup control, adds eight regression tests, and records validation evidence. Original seven safety assertions are unchanged.
- Ten critical product files match the isolated lab by SHA256, including ownership, Anchor/auth stores, reconciliation, AuthHydrationService, startup bootstrap, local auth recovery, and the late required-store guard. Source inventory: `native-validation-critical-source-hashes.json`.
- All 12 checked Metro source-map contents match the exact lab inputs. The Hermes v96 bundle contains `recoveryCopy`, `observedLocalFingerprint`, `pendingLocalMutation`, `__generation_`, `__legacy_manifest`, and the late-auth continuation. Bundle evidence: `native-validation-bundle-input-checks.json`, `native-validation-hermes-markers.json`.

## 2. Native build

The isolated build preserves `com.anchorintentions.perflab20261012`, Hermes production/V2/Fabric, R8 full mode, resource shrinking, non-debuggable/profileable release, demo Firebase, loopback API/Auth, and disabled OTA/telemetry uploads. Gradle uses `-Xmx4096m`, 768 MiB metaspace, one worker, and arm64-v8a/x86_64. Native dependencies/runtime are unchanged. Local release signing uses the existing debug keystore; this is a diagnostic artifact.

Lab-only deviations are archived in `E:\apd\record\native-validation-lab-overlay.diff`: existing Auth emulator routing and numeric startup diagnostics, native storage call counters, a one-shot 14-second synthetic read delay, and injected failure/pause before publication for **only** `native-validation-*` manifests. The synthetic controller invokes the real production stores, durability receipts, hydration service, Firebase Auth, and Android SecureStore. These controls are absent from the product checkout. Their coverage is distinct from normal creation/account-switching UI acceptance.

**BUILD SUCCESSFUL in 42m 9s**, 1,277 tasks (265 executed). R8, release lint, and optimized/shrunk resource packaging all completed; no optimization was disabled. The host was memory constrained during the cold rebuild. Only this task's completed Kotlin compiler daemon was stopped after compilation to release memory.

- Final APK: `E:\apd\record\archive\anchor-perflab20261013-native-recovery-release-r2.apk`
- Final SHA256: `23D06F46DDA9C70E0DA9322D3314887B14C2A2741747DB64EDCA5C119E72624E`
- Size: 253,318,706 bytes; package `com.anchorintentions.perflab20261012`, version 2.0.0/code 39; min SDK 24, target SDK 35, compile SDK 36; both Hermes ABIs present.
- Extracted final APK JS equals the checked generated Hermes bytecode by SHA256: `719EC63B904F947B68F66B7933C373FF412AFA846A4E6F42A2950799F27B9231`.
- Manifest confirms profileable shell access, OTA disabled/NEVER, and no debuggable flag. Local release signing remains the existing debug keystore.
- Provenance: `native-validation-apk-result.json`, `native-validation-apk-manifest.txt`, `native-validation-apk-badging.txt`, and `gradle-native-validation.log`.

The initial artifact is retained as `anchor-perflab20261013-native-recovery-release.apk`, SHA256 `08A4E3F8826F82D3F157AC2C590A21D759AD838C41C6C2B8ADACF91D0FB017BF`. It produced the account, offline, convergence, delayed-hydration, and adapter-fault evidence. The guest controller initially called only local-store sign-out; its assertion correctly stopped when Firebase was still signed in. One lab-only `AuthService.signOut()` call corrected that harness error. R2 rebuilt successfully in **8m 32s**, keeping R8/shrinking enabled and reusing their unchanged outputs. R2 was installed over **only the isolated package**, retaining its vault. Product source is identical between both artifacts; the controller differs by that call. R1 inventories/JS checks remain under `*-r1.json` / `native-validation-harness-r1.ts`.

## 3. Startup reproduction

The physical phone is not connected. No normal-package install, clear, uninstall, vault access, account reset, private-content export, or manual vault edit occurred. The owner's reported "Unable to restore saved data" cause therefore remains unverified.

Two further startup-control defects reproduce with synthetic regressions: auth persistence finishing after ten seconds cannot resume Firebase restore; and signed-out account snapshot stores finishing after ten seconds cannot resume safe cleanup. Both timeouts unsubscribed and returned `false` permanently, with no guaranteed second Firebase event. Pre-fix evidence: 20 existing auth tests pass and two added tests fail (`late-auth-full-suite-red.txt`).

Native current-source tests confirm both delayed-read recovery paths:

| Scenario | Native result |
|---|---|
| One-shot 14-second auth-store read delay | Recovery message at 10.227 s; app ready at 14.610 s; A's Anchor retained. |
| One-shot 14-second bulk-vault read delay | Recovery at 10.049 s; complete local read at 17.906 s; app ready at 17.792 s measured from component mount; 74 A records and recovery copy restored. |
| Ordinary small-vault online/offline startup | No restore error; app-ready clocks approximately 0.84–1.52 s after component mount. |
| Bulk native startup | Local read succeeds; startup eventually becomes ready. Large background persistence/auth work can delay readiness for tens of seconds. No permanent latch reproduced after successful hydration. |

The clocks start at different boundaries. Logs prove the recovery screen mounted and later app readiness succeeded; the auth-delay screenshot was taken after restoration and is not a screenshot of the timeout frame. Numeric evidence: `native-validation-auth-delay-at-timeout.json`, `native-validation-vault-delay.json`.

The source review also finds a separate offline identity limitation: native `CACHED_USER_KEY` contains a bare global backend `User`, with no Firebase UID binding. The network-error fallback accepts that record. Backend account IDs and Firebase UIDs are distinct production identities; equality checks or email inference would be invalid. No cache format/ownership change was guessed. Safe offline restoration requires trusted Firebase-to-backend-account binding evidence, preserving existing cache/vault data while that contract is established. The same-ID demo fixtures cannot certify that production contract.

## 4. Confirmed fix

The timeout still returns fail closed. Separate, cancelable listeners now resume only the current auth generation after actual hydration finishes. Signed-out cleanup additionally requires unchanged account identity and readiness of every store it snapshots/clears. Superseding auth callbacks and unmount cancel the continuation. Unexpected background errors fail closed. Successful initial restoration clears the startup fatal latch; the independent storage/ownership recovery guard remains authoritative.

Product files changed:

- `anchor/mobile/App.tsx`
- `anchor/mobile/src/services/AppAuthBootstrap.ts`
- `anchor/mobile/src/services/appAuthState.ts`
- `anchor/mobile/src/services/__tests__/appAuthState.test.ts`
- `anchor/mobile/src/__tests__/AppStartupHydration.integration.test.tsx`

The existing persistence/reconciliation implementation was not reimplemented or modified in the product checkout.

## 5. Device coverage

Connected emulator: `emulator-5566`, Android 16/API 36, x86_64, 1080×2400, density 420. The isolated package was initially absent. Physical Android and iOS acceptance are not covered by this pass. Existing owner package and unrelated emulator/ADB reverse state are protected.

## 6. Account A → B → restart → offline A

Fixture A/B/C integration checks pass with verified demo Auth tokens, account isolation, idempotency, unchanged free-account limits, and verified C-only comped access. Native tests use real store operations through the lab controller, not the normal creation/account-switching UI.

| Required behavior | Native evidence and limit |
|---|---|
| A creates an unsynced Anchor and receives durable confirmation | Real `addAnchor`/`flushPersistence`, then SecureStore readback: PASS. Native write 114 ms; receipt plus verification/readback 615 ms; initial durable vault 703 characters. |
| B never sees A's private content | PASS after established B session; active A record/recovery getters absent. |
| Force-stop/relaunch while B is active | PASS, new PID; B sees zero A records and cannot retrieve A's recovery copy. |
| Offline A with already-restored native credentials | PASS after online return to A, then removal of API/Auth/credential-bridge reverses and force-stop/relaunch. Native Firebase restores A, `offline=1`, saved Anchor visible in Home. The screenshot shows optional API sections in their error state, rather than blocking local content. |
| Exact B → sign-in A while API is unavailable | **NOT accepted.** With Auth/credential bridge available and API disconnected, `signInWithEmail` fails backend synchronization and signs Firebase out. Settled state is genuinely unauthenticated with no A content exposed. This is distinct from offline restoration of an existing A session. No identity/credential bypass was added. |
| Return online without duplicate local rows | A's visible count remained stable on refresh; later 74-record set retained. **A's production unsynced upload/idempotency is not certified:** legacy Supabase sync is disabled in the lab, and the unsynced record was inserted through the real store, not a full UI upload flow. Guest backend completion/replay is a separate covered case. |

Actual tested retention chain: A committed save → B → restart B → online A credential restoration → offline restart A. The stricter offline-switch attempt above was tested separately and failed safely. Evidence files include `a-saved`, `b-isolated`, `b-restarted`, `a-offline-startup`, `a-online-again`, `b-to-a-api-unavailable`, and `bulk-cold-restart` under the `native-validation-` prefix.

## 7. Failure, legacy, and guest coverage

Automated real-adapter tests cover interrupted replacement, missing legacy chunks, Unicode boundaries, interrupted legacy import/retry/source retention, current/previous/legacy generation removal, and identical durable payload de-duplication. Native injected faults use separate synthetic namespaces; distinguish those from canonical vault migration and UI durability-error handling.

- **Failed publication PASS:** a native pre-manifest failure returns the previous committed synthetic payload (`publication-failure`, phase 32).
- **Process interruption PASS:** new chunks were written/read back; the manifest was paused for 45 seconds. Force-stop/new PID occurred within that window; after relaunch the reader returned the prior committed value (`publication-paused` / `publication-restarted`, phase 31).
- **Legacy failure/retry PASS on a separate native key:** publication failure leaves the unversioned source readable; retry publishes converted data while the original encrypted chunk remains unchanged (phases 33/34 in `legacy-interruption`). This does not certify the canonical vault import path's `__legacy_manifest` handling on native hardware; its complete source-retention assertions remain automated.
- **Guest → C binding and transfer PASS:** guest Anchor receives native durability receipt; C is verified comped by the local Auth token/server, and the ledger becomes C-bound. B sees no guest Anchor/draft, including after process restart; C returns with its draft and ledger intact. Backend finalization returns success, local receipt completes, C has one record with C ownership and no pending draft (phases 37/38/39). Original source remains retained; no unauthorized owner adoption was performed. Evidence: `guest-r2-progress`, `guest-c-bound`, `guest-b-excluded`, `guest-b-restarted`, `guest-c-restored`, `guest-finalizing`.
- **Completed transfer restart/replay PASS:** new PID restores C's one backend-owned record, C-bound ledger, and no pending draft. Re-running the finalizer still leaves one C record. Returning to A restores all 74 A records, the unsynced Anchor, and the owner-scoped recovery copy; the transferred guest record is excluded from A. Evidence: `guest-completed-restarted` and `final-retention`.
- The isolated package's large A partitions survive the R1 → R2 update. No clear/uninstall was used. Native canonical-store failed-save UI/receipt handling, missing-key/decryption failure, and malformed/ambiguous canonical vault hydration were not injected.

## 8. Recovery and convergence

Automated tests confirm owner-scoped recovery copies survive serialized reload, B cannot retrieve A's original, later confirmed revisions reconcile under the documented policy, known pending edits remain protected until value acknowledgements, and stale direct/queued/null-field acknowledgements cannot erase newer writing.

Native convergence also passes against the live loopback fixture: first observation preserves the original text (phase 35); a later PUT/server revision is accepted while the original text remains accessible through the owner-scoped getter (phase 36). B cannot retrieve it after switch/restart; A returns and the retained copy is available. This native test covers restart **after** convergence. Restart in the unresolved pre-convergence state and known pending-edit acknowledgement permutations remain automated rather than separately certified natively.

`getLocalRecoveryAnchor` has no non-test production consumer. It is an owner-scoped internal store API, not a shipped recovery/conflict UI. Preserved writing is retrievable through a controlled authenticated store operation, but no practical user self-service recovery flow is implemented. Do not confuse retained evidence with complete user-facing recovery acceptance.

## 9. Automated results

- Unchanged storage gate: **3 suites / 15 tests PASS**; all seven original assertions pass with the senior hydration regression suite.
- Initial current-source targeted regressions: **17 suites / 314 tests PASS**.
- Final regressions after eight new startup tests: **17 suites / 322 tests PASS** (`native-validation-final-regressions.log`).
- TypeScript after final changes: **exit 0** (`late-auth-typescript-final.txt`).
- Diff whitespace check passes. No assertion was weakened, skipped, or removed.

The four existing audit documents receive only an appended current-checkpoint pointer/summary; the new report is `NATIVE_DATA_RECOVERY_VALIDATION.md`. These five documentation paths plus the five startup/test paths listed above are this pass's repository changes. The index remains empty and HEAD is unchanged. Lab-only code, configurations, build products, and diagnostics live outside the shared checkout under `E:\apd`.

## 10. Storage performance

Counters measure real SecureStore calls through the shared adapter; auth legacy helpers outside the adapter and AsyncStorage marker calls are not included. Read timing includes a lab marker lookup. Intentional delay/fault windows are excluded from ordinary timing. Logical JSON size differs from physical encrypted allocation; current/previous generations, owner snapshots, and failed-write orphans can consume additional space. Physical allocation was not extracted or measured. Earlier physical 6.4–8.2-second writes cannot be compared directly with emulator measurements or treated as an optimization baseline.

| Observation | Measured result |
|---|---|
| Logical size after first A/B retention | 853 chars; two records plus retained original/reconciliation state after the convergence fixture: 1,998 chars. Added content and recovery evidence are not isolated into a recovery-only size delta. |
| 72 synthetic bulk records plus two existing A records | 706,010 chars / 393 chunks; all 74 restored after process termination. |
| First bulk write | 11.196 s secure-write; total controller commit/verification/explicit readback 18.537 s. Controller interval counted 1,192 native reads, 399 writes, 5 deletes across adapter keys. |
| Bulk cold hydration | 5.732 s secure read / 5.733 s adapter read; 394 native vault read calls; all 74 records restored. |
| Subsequent full-vault writes | 23.561, 29.662, 29.715, 31.470 s in ordinary bulk/restart scenarios. Retained snapshots/failed-write fixtures increase the surrounding vault; timings are not controlled before/after comparisons. |
| Account bind vs durability | Small synthetic binds 3–12 ms; large B bind 71 ms and settlement 44.771 s including an intentional 2 s wait, with 394 vault write calls. That large switch overlaps the R2 rebuild. Pure later C activation with unchanged bytes counted zero vault writes and a 17 ms bind. |
| Startup responsiveness | Bulk app-ready clocks 35.865, 70.809, and 75.412 s in recorded transition/restart cases despite earlier local hydration. No permanent stuck state or data loss was observed; these are not full UI interaction/frame-pacing measurements. |
| Busy guest staging backlog | Secure-write elapsed windows 83.224, 176.931, 212.013 s; a verification read elapsed 102.715 s; final guest receipt/verification elapsed 220.091 s. These overlapping/background-batch windows demonstrate severe backlog, not isolated per-write service-time estimates. |
| Logical size after guest completion | 707,356 chars; later canonical refresh normalizes it to 707,328 chars. Approved original guest source, C's backend record, and transfer ledger remain retained. |

Cold startup and authenticated hydration can still cause full-vault publication. The retained generations and owner snapshots increase shared SecureStore work. Native call counts show write/readback/cleanup amplification; the old per-event `reportedCalls` field excludes some manifest/cleanup calls, so it is not a complete native-call count. Installed Expo SecureStore 15.0.8 uses synchronous SharedPreferences `commit()` for encrypted item writes (`SecureStoreModule.kt:240`), and native process-termination readback was tested separately.

No storage migration, batching optimization, key change, evidence deletion, or motion/audio change follows these observations.

## 11. Remaining risks and recovery requirements

- Owner-phone failure remains unexplained without current-device privacy-safe evidence.
- Unbound native cached profile cannot certify production offline account identity after cache/write/account-transition failures.
- Missing/decryption-invalid keys, incomplete legacy chunks, invalid generation manifests, and ambiguous owners require preservation and explicit recovery evidence, not empty-vault fallback, deletion, or reassignment.
- Native physical-device and iOS matrix remains open; module-memory tests do not replace process termination.
- Exact offline account switching from B to A is not implemented by the tested sign-in/backend-sync path; expired-token offline restoration is not covered.
- Full production upload/de-duplication of A's unsynced Anchor, normal creation/switching UI, and canonical vault corruption/import/failure UI scenarios remain unverified natively.
- Large-vault latency and overlapping persistence work remain severe and measurable; this pass did not optimize them.
- Recovery-copy retention is not a user-facing recovery mechanism.
- No SQLCipher or removal of recovery evidence is authorized by these results.

## 12. Gate decision

**OPEN / cannot close.** Passing source assertions and an isolated native artifact are separate from full hardware, production-identity, owner-phone recovery, and complete end-to-end account/interruption acceptance.

All diagnostic logs, source inventories, native controller/overlay, numeric snapshots, screenshots, and build outputs for this pass are retained under `E:\apd\record\native-validation-*` and `gradle-native-validation.log`.

Cleanup: force-stopped only the isolated lab package, stopped the task-owned Auth/API/credential bridge, removed only their three reverse ports, and deleted the three generated synthetic credential files after exact project/package/host/UID/path checks. Zero owned credential files remain. Original 8081/8000/8082 reverses are preserved. The emulator, installed lab package, encrypted synthetic vault, original sources/recovery copies, both APKs, and diagnostics remain available. No owner account/package/data was altered.
