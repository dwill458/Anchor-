# SQLCipher migration implementation — isolated cohort (2026-10-13/14)

## Decision and scope

Implementation is on `codex/sqlcipher-migration` in `C:\Users\dwill\.codex\worktrees\sqlcipher-migration\Anchor`. The shared checkout remains on `feat/celebration-layer`, initially verified at `13beacd61d35bffefaa3c5c5ece4416abb3200f9`. Its unrelated Share Studio/visual Vision changes were not copied, staged, committed, reset, or modified. Relevant uncommitted startup/storage safety follow-ups were copied into the worktree as prerequisites, not represented as new SQLCipher work.

**Production activation remains disabled.** Native access additionally refuses any application ID except `com.anchorintentions.sqlcipherlab20261013`. No owner vault was read or migrated, no existing owner application was cleared/uninstalled, and no OTA, backend deployment, or store release was published.

**Storage performance improves materially in the controlled native benchmark. Full preservation of every product-level guarantee has not been certified; this implementation is not ready for controlled production rollout review.** The gates below are part of this decision, not claims that retained encrypted bytes alone constitute recovery.

## Architecture and schema

SDK 54 remains in place, with React Native 0.81.5. Added direct dependencies are `expo-sqlite ~16.0.10` and `expo-crypto ~15.0.9`; no Expo/React Native upgrade was made. The isolated Expo configuration enables `useSQLCipher: true` for supported native targets, disables FTS, uses runtime `2.0-sqlcipher-v1-lab`, disables updates and Android backup, and gives Android/iOS a separate application identifier.

The existing Zustand store/service interfaces remain the integration boundary. For the vault, session store, scenes, creation drafts and first-run drafts, a `PersistStorage` adapter receives objects directly instead of `createJSONStorage` serializing the entire vault. The codec creates records for individual Anchors, practice/session/priming entries, reflection drafts, queue events, scene-map entries, account metadata, and scalar progress fields. Existing Anchor payloads retain private intentions, SVG lineage, asset references, Release state, revisions, pending-edit markers and reconciliation/recovery copies. No media-cache, audio, particle, rendering, cinematic, onboarding-layout or subscription change is part of the migration.

Record serialization caches compare against captured immutable values; they do not merely trust object identity. Unchanged SVG/Anchor payloads are not serialized again, and an in-place edit is detected. Membership/order reconstruction is separate small metadata. The current compatibility adapter still traverses the in-memory collection and retains inactive partitions in memory; this is not yet a lazily paged account store.

Schema version 1 uses equivalent record structures rather than one SQLite vault blob:

| Table | Purpose / key |
|---|---|
| `storage_documents` | Namespace, reconstruction shape, document revision, source format/checksum, transactional activation bit |
| `storage_records` | Namespace + stable record identity; owner scope, individual payload, revision and SHA-256 checksum |
| `storage_recovery` | Owner-scoped removed/prior records with revision and reason; original encrypted content is retained |
| `storage_receipts` | Committed namespace revision, changed-record count and timestamp; receipt history bounded to 256 revisions |

`storage_records(scope, namespace)` and `storage_recovery(scope, namespace)` indexes support owner queries. Record identities include collection/domain identity and owner; owner-specific namespaces cover practice queues/history and account snapshots. Scenes have a separate document per owner. Account/guest transfer metadata remains in the vault, with the existing authorization/finalization logic intact. Ambiguous Anchor ownership goes to `recovery`, not the current login.

Writes use parameterized `runAsync` queries, one serialized database fence and `withExclusiveTransactionAsync`. Operations execute through its transaction object. Changed rows only are upserted; unchanged rows are not rewritten. A compare-and-swap on the document revision rejects a stale second writer. Mutation APIs modify the latest durable queue under the same fence; network acknowledgements remove only an unchanged, exactly attempted event. Newer events/edits survive older acknowledgements. A committed receipt is published only after the exclusive transaction resolves.

Expo 16 creates a **new native connection** for each exclusive transaction and issues a deferred `BEGIN` before invoking its callback. That connection is keyed as the first callback operation, before schema/user-data access. Native testing verifies this works on the encrypted database. `foreign_keys` cannot be enabled after `BEGIN`; the adapter therefore explicitly checks `foreign_key_check` on that connection before commit rather than claiming a connection-local PRAGMA inside the transaction enabled enforcement. WAL and FULL synchronous durability are verified natively.

## Encryption and key lifecycle

The production adapter's key is 32 cryptographically random bytes from `expo-crypto`, encoded as validated 64-character hex. A raw-key PRAGMA uses only that validated alphabet; PRAGMA keys are not interpolated from user data. All user records/names/scopes use bound SQL parameters. The key is kept in SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, without biometric invalidation. It is read back successfully before opening a newly created database. Keys are not logged, extracted into artifacts, or written to source/configuration.

The database is keyed immediately after its initial open. The adapter checks `cipher_version`, successfully reads `sqlite_master`, rejects a newer schema, and only then performs schema setup. An open/decryption failure remains a failure for that process; it is not converted to an empty document. Base database, WAL and SHM existence are checked before allowing first-key creation. A read-back-verified SecureStore creation marker also prevents silently recreating a previously created database if all three files are missing. A crash after key creation but before DB creation can reuse that key; a previously created DB disappearing requires recovery.

| Situation | Implemented behavior / recoverability |
|---|---|
| Fresh installation | Generate, durably save/read back key, then create encrypted schema |
| Existing-user migration | New database/key; non-destructive old reader; no old source deletion |
| Restart/native update | Reuse saved key; verify decryption/schema before reads or writes |
| Interrupted import | Transaction rolls back or is fully active; preserved source permits retry |
| Missing key with DB/WAL/SHM present | Refuse open/key generation; retain bytes and require recovery |
| Invalid key/unreadable/corrupt DB | Fail closed; never regenerate, recreate, delete, or pretend empty |
| Android uninstall/backup restoration | Keystore/SecureStore material may be irrecoverable; lab backup is disabled |
| iOS keychain | Device-only accessibility is intentional; same-device persistence is not a cross-device recovery guarantee |
| Offline guest/device loss | Local durability works while the device/key survive; there is no implemented cloud/key recovery for unsynced guest content |

If the new DB key is lost but the original SecureStore source remains readable, that source can recover the frozen pre-import data. It cannot recover later writes made only to SQLCipher. If the OS also loses the legacy SecureStore encryption material, preserved legacy bytes may likewise be unreadable. Server synchronization only recovers data actually uploaded; no account-based recovery of arbitrary local/private drafts is promised.

**Release policy remains open:** choose a documented device-local-only policy with selective exclusion of SQLCipher DB/WAL/SHM and SecureStore from Android restore, or design an opt-in encrypted backup/key envelope unlocked by a separate user-held recovery secret. Such an envelope needs authenticated encryption, independent key derivation, account/backup binding and native restore testing. It must not derive the DB key from account IDs, email, device identifiers, or a server-held plaintext secret. No such backup/key-restoration system has been implemented or silently substituted here.

## Non-destructive import, quarantine and rollback

The original chunk/generation reader is exported separately from routed database reads. Import checks the encrypted manifest/chunks first and uses a pre-existing plaintext fallback only when the encrypted source is absent. Incomplete/invalid encrypted sources throw instead of falling through to plaintext. JSON parsing, record identity and declared owner checks must succeed.

Source checksum/format and an inactive document are inserted inside the same transaction as imported records. Import verifies counts, identities, owner scopes, payloads and checksums, then changes the activation bit in that transaction. A partial import is never visible as active. New writes capture values and proven ownership before yielding; the database fence orders them after import. A writer submitted before hydration merges imported membership rather than treating omitted source records as deletion. Older migration revisions require reconciliation instead of overwriting a newer imported record.

Fault checkpoints cover source read, inactive creation, record import, verification, activation write and commit boundaries. The reader never calls conversion writers or source removal. Existing plaintext fallback copies remain exactly as found; the migration adds no plaintext recovery copy. Retention/secure cleanup of already-plaintext legacy data needs a separate approved policy.

Normal logical removals retain source bytes and encrypted recovery history. Whole-vault removal is rejected and requires an explicit owner operation. Recovery archives are internal evidence, not a completed user-facing conflict/restoration flow.

**Old-binary rollback is not lossless.** Runtime-2.0/old native binaries cannot read writes made exclusively to SQLCipher. Frozen old sources are not a continuously current mirror. Do not deploy a runtime-2.0 OTA for this migration or reintroduce whole-vault dual writes to imply compatibility. A rollback must use a SQLCipher-capable binary with a compatible schema/reader, or an explicitly verified export/conversion process. No old-binary lossless rollback has been certified.

## Feature integration and durability

Anchor creation/Details/update/Release/guest transfer continue using existing store methods, now backed by record persistence in the lab. The existing hydration gate and `flushPersistence` receipt protect confirmation of saved Anchors. Existing ownership, pending mutation, reconciliation, timestamp convergence and guest-finalization rules remain in their original services/stores.

Account snapshot saves pass objects directly into SQLCipher rather than serializing entire snapshot collections. Chart reflection/course-log writes and existing direct secure queues route through the database compatibility boundary; disposable caches are not newly migrated wholesale.

Practice completion commits its canonical account-owned event and outbox entry **in one transaction**, and only then publishes the session projection. It waits for successful session hydration and rechecks account identity. Concurrent duplicate requests join the pending durable receipt. This avoids counting an optimistic completion which subsequently fails. Account snapshot restoration merges canonical completion history so an event remains discoverable even if a process dies before the derived summary persists. Exact Thread Strength/counter replay across every crash/decay/auth permutation still needs native product validation; an immutable event is not a claim that every summary projection has already been certified.

Practice and Anchor retry queues use atomic mutations and exact-event acknowledgement comparisons instead of stale whole-array replacement. Failed sync retains committed events. Scenes preserve owner documents on switching, generation-fence asynchronous restoration, track recovery/loading state, permit retry, and filter all restored maps against combined Release tombstones. Source hydration cannot overwrite an explicitly bound different owner. Scene saves wait for their local write receipt before reporting a local saved result.

Unowned historical creation/progress metadata and full multi-account draft/progress restoration remain release gates. No signed-in identity is guessed during the import. These flows need their complete native migration/recovery matrix, not just table-level owner indexes or mocked middleware assertions.

## Android/iOS native evidence

Native bench package: `com.anchorintentions.sqlcipherlab20261013`; emulator `emulator-5566`, Android 16/API 36, x86_64. Binary is a release/profileable build with Hermes, R8 and resource shrinking, OTA disabled and synthetic Firebase project `demo-anchor-perf`. The benchmark entry is diagnostic-only and replaces the lab's entry file; it is not a product UI redesign or a full authenticated Home/creation acceptance run.

First build compiled the native libraries but failed at inherited Sentry upload configuration (no organization). Uploads were disabled for the lab and release assembly succeeded. Build logs are `E:\apd\record\gradle-sqlcipher-benchmark*.log`. No successful Sentry upload/publication is claimed.

Measured APK: SHA-256 `DEEE3096DACA6A6A6D6370005D716A3267190FF04C6778681CCC8050C0B08058`, 321,225,680 bytes. Package identity was checked before install. No other package was installed, cleared or uninstalled.

The first size/header diagnostic exposed a path bug: Expo SQLite provides a native absolute path, while legacy FileSystem requires a file URI. This also affected the missing-key existence guard. `databaseFileUri` fixes the runtime and harness, with Android/iOS-path/WAL/SHM unit coverage. The corrected native binary demonstrates actual file presence, refuses simulated missing-key generation/replacement, retains the saved key, and refuses simulated recreation of a previously-created missing DB. No real key or file was removed to run those simulations.

Native checks passed: SQLCipher `4.7.0 community`; `journal_mode=wal`; `synchronous=2`; missing-key schema read rejected; wrong random key schema read rejected; correct-key reopen and fixture equality. The app was force-stopped inside the first record import, then a new PID reopened with the same key, recovered/imported all 72 source records and verified exact source preservation. Other import checkpoints are covered by SQLite transaction tests, not separately native-killed at every checkpoint.

The corrected final source binary also built successfully (1m32s final incremental build), was installed over the existing lab package without clearing data, and revalidated encryption, both lifecycle guards, original key reuse and all 72/256 fixtures. Final APK SHA-256: `27F30860A46AC32A735DA9706C7239D80D8BE3F8F9B87F6DCF434823FE4EA671`, 321,232,748 bytes. Evidence: `gradle-sqlcipher-revision-final.log`, `sqlcipher-final-apk-identity.json`, `sqlcipher-native-events.log`. The original benchmark artifact is retained separately as `sqlcipher-benchmark-measured-v1.apk`.

iOS configuration is provided; no suitable macOS/iOS build/device environment was available. Physical Android, iOS, full app visual parity, frame pacing, guided audio/haptics and actual authentication/navigation acceptance are not certified by this benchmark.

## Measurements

The native diagnostic executes the current generation-safe legacy writer/reader and new record database in the **same release process/emulator**, with identical deterministic synthetic SVG-bearing fixtures. Legacy writes below are direct durable writer measurements, excluding the 400 ms middleware debounce. The synthetic account has 72 Anchors / 752,835 JSON characters. Legacy retained generations and the other synthetic benchmark namespaces share SecureStore's preferences file; the figures characterize this controlled workload, not all devices or a clean one-key preferences file.

| Records | Old initial write, ms | New initial write, ms | Old read, ms | New reopened read, ms |
|---:|---:|---:|---:|---:|
| 0 | 74.194 | 41.623 | 19.700 | 64.258 |
| 1 | 293.273 | 54.240 | 89.215 | 67.279 |
| 10 | 2,566.262 | 96.918 | 731.921 | 75.502 |
| 72 | 19,703.448 | 415.059 | 4,533.266 | 222.665 |
| 256 | 121,054.079 | 1,370.898 | 16,595.249 | 402.458 |

| Metric | Old SecureStore | New SQLCipher |
|---|---|---|
| Cold startup / usable Home | No paired full-app measurement in this run | No paired full-app measurement in this run |
| Cold storage initialization | No directly equivalent DB initialization operation | 512.860 ms first install; 280.260 ms after process restart; 2,550.352 and 2,434.765 ms after later native updates with the larger retained fixtures |
| 72-Anchor load | 4,533.266 ms, one read | 222.665 ms including reopened DB setup, one read |
| Single Anchor creation into empty namespace | 293.273 ms | 54.240 ms |
| Single Anchor update in 72-record account | p50 46,416.314 ms; p95/p99 46,525.624 ms; n=3 | p50 34.739 ms; p95 38.766 ms; p99 44.441 ms; n=40 |
| Practice completion (full product flow) | Not measured as a comparable pair | Not measured as a comparable pair; native outbox-only write p50 39.433 / p95 49.620 / p99 55.399 ms, n=30 |
| Account switch (full auth/navigation flow) | No paired measurement | No paired measurement; owner-index reads A after reopen 75.080 ms, B warm 3.798 ms, each returned exactly its own one record |
| Write backlog | Historical guest backlog up to 220 s is not a fresh paired measurement | 30 simultaneous synthetic updates settled in 1,006.078 ms; no multi-minute backlog in that measured burst |
| Storage size | 8,422,604 bytes total retained benchmark SecureStore preferences | 5,644,288 bytes checkpointed benchmark database |

The 72-record read is about **20.4x faster** and first import/write about **47.5x faster** in this measured workload. Repeated one-Anchor update p50 is about **1,336x faster**, heavily reflecting legacy chunk/retained-generation preferences amplification. Small-sample empirical p95/p99 values are observations, not production tail-latency guarantees. A 72-record one-row edit uses four SQL mutation calls (document revision, changed record, receipt, receipt pruning) plus constant connection/transaction/integrity setup, rather than rewriting ~419 chunks plus readback/obsolete-generation operations. Crypto calls and internal BEGIN/COMMIT/native module calls are not being misreported as fully counted bridge calls.

Physical size totals contain different retained generations/recovery records and multiple benchmark namespaces; they are not a per-account or like-for-like space-efficiency ratio. Post-update combined benchmark-process memory was 105,956 KiB PSS / 241,780 KiB RSS, with 135 KiB swap PSS. Nine JS timer gaps over 100 ms occurred across the combined legacy/new workload; they are not attributed to either adapter, and are not native frame-pacing measurements. SQL connection setup, hashing, statements and COMMIT are included in write latency; isolated COMMIT-only latency and complete native bridge-operation counts were not captured.

Latest cold-init phase tracing: file existence 49.999 ms; first SecureStore key read 1,919.213 ms; native DB open 34.149 ms; first lifecycle-marker durability 163.108 ms; remaining keyed/schema setup about 268.297 ms, total 2,434.765 ms. Later key reads were 14.910–22.920 ms. **SecureStore key retrieval is the measured remaining cold-storage bottleneck.** The retained 8.42 MB preferences file is a plausible contributor (the SDK uses a shared preferences file), but preferences parsing versus first Keystore access has not been isolated. Legacy source cannot be prematurely deleted to improve this number. Whole-app authentication/network/render/navigation costs remain separately unmeasured.

Storage, authentication, network, React rendering and navigation are distinct timing domains. This run measures storage and a diagnostic Activity launch, not usable Home. Earlier 35.865–75.412 s app-ready observations remain in the native recovery report; they are not replaced with the 222.665 ms database-read result. No claim is made that SQLCipher fixes unrelated network or animation delays.

## Tests and remaining gates

- Original unchanged compatibility safety gates: 4 suites / 18 tests pass, including the seven original assertions and additional single-flight safeguards. Those tests use the original mocked storage boundary; they are not proof every assertion was rerun against native SQLCipher.
- Final expanded targeted regression: 14 suites / 283 tests pass (`sqlcipher-regression-final.log`). Receipt/scene/key-lifecycle slice: 5 suites / 93 tests pass. After the final stale-record revision guard, both SQLite/store integration suites passed again: 25 tests (`sqlcipher-final-revision-tests.log`). These are overlapping checkpoints, not additive coverage counts.
- Real SQLite transaction/real store integration tests cover one-of-72 incremental writes, A/B/restart/offline-A retention, owner scene restoration, ambiguous owner exclusion, account namespace validation, source preservation at import checkpoints, missing-key refusal, stale-writer CAS, atomic multi-document rollback, concurrent queue additions/acknowledgements, practice failure propagation and failed rapid completion isolation. SQLite test drivers intentionally do **not** claim encryption proof; encryption is verified natively.
- Final TypeScript check passed with no diagnostics; whitespace checks passed. Evidence is tracked in the harness logs. No original assertion was weakened, skipped or removed.

Before controlled production rollout review: run the complete SQLCipher full-app creation/Details/onboarding/auth/practice/progress/Vision/Chart/Release/guest-transfer matrix, source-format/corruption/owner-ambiguity recovery UI and process-kill permutations; certify progress projection replay and multi-owner drafts; implement usable owner-authorized recovery operations; decide backup/key recovery and source-retention policy; perform extended usage/memory/native operation/frame tracing; validate physical Android and iOS; and define a compatible-binary rollback/forward-fix process. Keep the lab-only activation guard until these are resolved. No production activation is recommended merely because the storage benchmark is fast.

## Exact migration files

New files:

- `anchor/mobile/app.config.js`
- `anchor/mobile/src/storage/sqlcipher/databaseFileUri.ts`
- `anchor/mobile/src/storage/sqlcipher/schema.ts`
- `anchor/mobile/src/storage/sqlcipher/recordCodec.ts`
- `anchor/mobile/src/storage/sqlcipher/database.ts`
- `anchor/mobile/src/storage/sqlcipher/runtime.ts`
- `anchor/mobile/src/storage/sqlcipher/persistence.ts`
- `anchor/mobile/src/storage/sqlcipher/__tests__/sqliteTestDriver.ts`
- `anchor/mobile/src/storage/sqlcipher/__tests__/database.test.ts`
- `anchor/mobile/src/storage/sqlcipher/__tests__/store.integration.test.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/SqlCipherBenchmark.tsx`
- `docs/performance-audit-2026-10/SQLCIPHER_MIGRATION_IMPLEMENTATION.md` and `SQLCIPHER_NATIVE_BENCHMARK_RESULTS.json`.

Modified for this migration:

- `anchor/mobile/package.json`, `anchor/mobile/package-lock.json`
- `anchor/mobile/src/stores/anchorStore.ts`
- `anchor/mobile/src/stores/encryptedPersistStorage.ts` (also preserves the prior single-flight follow-up)
- `anchor/mobile/src/stores/sessionStore.ts`
- `anchor/mobile/src/stores/visualizationSceneStore.ts`
- `anchor/mobile/src/stores/firstAnchorFlowStore.ts`
- `anchor/mobile/src/stores/v2/creationStore.ts`
- `anchor/mobile/src/stores/v2/firstRunStore.ts`
- `anchor/mobile/src/services/AnchorSyncService.ts`
- `anchor/mobile/src/services/PracticeCompletionService.ts`
- `anchor/mobile/src/services/UserLocalStateService.ts`
- `anchor/mobile/src/services/VisualizationSceneService.ts`
- The four requested audit documents receive a current migration checkpoint pointer.

Carried prerequisites, separately identified: existing uncommitted `App.tsx`, `AppStartupHydration.integration.test.tsx`, `AppAuthBootstrap.ts`, `appAuthState.ts`, `appAuthState.test.ts`, the original `storageSingleFlight.gate.test.ts` and `NATIVE_DATA_RECOVERY_VALIDATION.md`. Lab-only index, native Gradle/configuration/Firebase/manifest changes, dependency installation and APK/log outputs are under `E:\apd`, not the shared production checkout. Native benchmark entry is preserved in the repository harness so it is reviewable.

## Reproduction and evidence

Official SDK references: [Expo SDK 54 SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) and [Expo SDK 54 SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/). The native transaction implementation and Android path/preferences behavior were also checked against the installed SDK source.

Use the isolated worktree, never the owner's installed application. `ANCHOR_SQLCIPHER_LAB=1` selects the separate native package/runtime and SQLCipher config; without it, public Expo config retains the original production package/runtime and does not activate migration. The existing lab build at `E:\apd\src` sets `expo.sqlite.useSQLCipher=true` directly in native Gradle configuration, uses demo Firebase, disables backup/OTA and disables Sentry auto/native uploads. Native sources were compiled with the current storage implementation; the benchmark entry is the repository harness file copied into the lab.

Build with `gradlew.bat :app:assembleRelease --max-workers=1 --console=plain` and `SENTRY_DISABLE_AUTO_UPLOAD=true`, `SENTRY_DISABLE_NATIVE_UPLOAD=true`. Verify APK package identity before install. Install/update only `com.anchorintentions.sqlcipherlab20261013`. First harness run pauses at `ready-for-process-kill`; force-stop that exact package and restart it within the checkpoint window. The second run recovers import and performs the legacy/new comparisons. On subsequent runs, the harness detects the completed 256-record fixture, validates native-update/key/lifecycle/header behavior and avoids rewriting the benchmark again.

No old reader or source has been removed. There is no scheduled cleanup, deployment or automatic production activation. Source-retention duration, recovery UX and approved key/backup policy are release decisions still open.
## Final checkpoint — 2026-10-14

The final revision-guard binary completed the retained-data native check (PID 14452): SQLCipher 4.7/WAL/FULL, missing and wrong keys rejected, missing-key and missing-database lifecycle guards refused replacement, the same saved key reopened all 72/256 records, and the file header remained encrypted. No synthetic data or legacy source was cleared. This launch measured 2,466.922 ms database initialization, including 1,632.435 ms first SecureStore key read; later key reads were 17.220–20.492 ms. The earlier phase trace remains above to show launch variability. ADB diagnostic Activity launch took 7,146 ms; this is not time to usable Home.

The stale numeric record revision guard now rejects a lower serverRevision/revision even within one coordinator, in addition to document CAS against conflicting coordinators. The source configuration disables FTS; the existing direct native lab Gradle build retained its FTS default. Both enable SQLCipher; this difference does not establish a release configuration parity result.

Production sequence remains gated: finish full-app safety/recovery and progress/draft projection certification in isolated native builds; validate physical Android/iOS and key/backup policy; review a separately signed compatible native cohort; only then consider an explicitly authorized opt-in rollout. Runtime 2.0 binaries cannot receive this native migration by OTA. A forward-fix capable binary with the SQLCipher reader is the rollback baseline; returning to an old SecureStore-only binary would omit new database-only writes and is not lossless.
