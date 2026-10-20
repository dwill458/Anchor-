# Anchor 2.0 — Expo 58 / SQLCipher performance and stability audit

Audit date: October 18, 2026 (America/Chicago). **Audit only; no application code, native, encryption, backend, or UI implementation changes made by this audit.**

## 1. Executive summary

**Overall recommendation: NOT READY — stabilize the observed Focus completion blocker and establish a verified SQLCipher release baseline before expanding features.** This is a recommendation about the audited QA baseline and its evidence gaps, not a claim that Expo 58 or SQLCipher is intrinsically unstable.

This pass obtained real Android device observations, a native trace, existing-source validation, and a scoped architecture review. It did **not** complete the requested application-wide release performance acceptance. Missing measurements are explicitly marked below. There are not ten confirmed production performance problems in this dataset; the top-ten list separates observations, measurement blockers, and hypotheses.

Key results:

- The running S24 Ultra application is an Expo 58 development client. Metro is running from the Expo 58 worktree, its manifest reports SDK `58.0.0`, and the installed APK contains RN `0.88.0` and Reanimated `4.7.1` version strings. The initially selected workspace is still Expo 54; it was not used as the upgraded-source baseline.
- Focus was observed stranded on “Well done. / Let it settle.” A force-stop/reopen and dev-client reconnect reached another Focus resolving state whose existing diagnostic trail stopped after `handleFocusComplete enter`. This is a core-flow blocker in the observed **development configuration**. A clean test-account reproduction and release reproduction remain outstanding.
- The active Metro manifest omitted the SQLCipher cohort flags. The running process emitted legacy `secure-read`, `secure-write`, and `persist-setItem` chunk events. The source gate explains this path. Consequently, this launch cannot serve as a SQLCipher performance measurement. This does **not** establish a defect in SQLCipher itself.
- One dev JS context reported `app-ready` **36,328 ms after app start**. This is an application readiness marker, not Home touch readiness or production startup. Auth writes reported 19,140 / 24,797 / 30,402 ms; their causal contribution to the Focus stall was not proved.
- Twenty background/resume cycles completed on the existing Focus resolving surface. Activity-start median was **70 ms**, empirical p95 **77 ms**, worst **95 ms**. PSS fell from **1,188,846 to 987,562 KB** across the sequence. These are dev Activity resume observations, not navigation, JS heap, or release leak acceptance.
- TypeScript and Expo dependency alignment passed. Expo Doctor passed **18/20** checks. A focused persistence run passed **5 suites / 59 tests**. The broad test attempt reported **34 failing suites before interruption**; it is not a complete test result. See section 10 for the final rerun status.

Urgent attention: **Focus completion, startup/auth restoration, and QA runtime/cohort identity**. Home aura/carousel, Vision/Visualize, and Chart remain high-priority profiling targets, rather than proven release regressions.

## 2. Exact environment and source baseline

### Source

| Item | Recorded value |
|---|---|
| User workspace | `E:\Projects\Anchor` |
| Workspace branch / commit | `feat/celebration-layer` / `5765acd2710b2f45144ab7da6069b67c4a80b3c4` |
| Workspace declared baseline | Expo `~54.0.34`, RN `0.81.5`; not the SDK 58 audit source |
| Audited upgrade worktree | `C:\Users\dwill\.codex\worktrees\expo58-upgrade\Anchor` |
| Audited branch / commit | `feat/expo58-vision-aura` / `5d9a6497996665eb28b4e3641531cac5a7b34546` |
| Working tree | Dirty before audit; source changes include aura, carousel, teaching, Vision, Focus, and auth. Existing changes preserved. |
| Dirty diff identity | SHA-256 `792d5e7debac1b720f68f5098c2c642c3e5689b9b760e0a22953ac4a168450f6` at summary capture; includes tracked differences from HEAD, not untracked contents |
| JS delivery | Existing Metro PID 3632, `expo start --dev-client -c`, port 8081; `dev=true`, Hermes transform |
| Host | Windows / PowerShell, Node `24.15.0`, npm `11.12.1` |

The exact pre-audit status lists are [root-status-before.txt](expo58-evidence-20261018/root-status-before.txt) and [expo58-status-before.txt](expo58-evidence-20261018/expo58-status-before.txt). The version snapshot and aggregate measurements are in [summary.json](expo58-evidence-20261018/summary.json). A dirty commit plus a diff hash is not a reproducible source archive; untracked diagnostic files and the native build's original source revision were not fully attested.

**Concurrent source drift was detected.** Compared with pre-audit status, `V2PracticeSessionScreen.tsx`, `PracticeCompletionService.ts`, and `encryptedPersistStorage.ts` became modified and `src/utils/focusDebug.ts` appeared untracked. This audit did not edit them. The before/after status comparison is retained in [source-drift.txt](expo58-evidence-20261018/source-drift.txt). Metro could hot-refresh those changes. Therefore runtime observations, source reads, TypeScript and Jest results span a mutable baseline; they cannot certify one frozen build. Source locations reflect the code read during this pass. Freeze and attest a source snapshot before repeatable acceptance.

The primary workspace also changed concurrently: its previously modified `V2PracticeSessionScreen.tsx` and untracked `focusDebug.ts` entries were absent from final status. This audit did not restore/remove those files. [root-status-after.txt](expo58-evidence-20261018/root-status-after.txt) records that independent drift as well as the new audit folder.

Installed dependency versions, read from the upgrade worktree's `node_modules`:

| Package | Version |
|---|---|
| Expo / React Native / React | `58.0.14` / `0.88.0` / `19.3.0` |
| Reanimated / Worklets / Gesture Handler | `4.7.1` / `0.13.0` / `3.3.0` |
| Skia / SVG | `2.14.0` / `15.16.0` |
| expo-sqlite | `58.0.13` |
| TypeScript / Jest | `6.0.3` / `30.5.2` |

### Device and artifacts

| Item | Recorded value |
|---|---|
| Physical Android | Samsung S24 Ultra `SM-S928U1`, ADB serial `R5CX12KBNGR`, Android 16 / API 36 |
| Display | 1440 × 3120 capture; adaptive display modes include 120 Hz. Do not assume every frame was scheduled at 120 Hz. |
| Installed package | `com.anchorintentions.sqlcipherpreview20261015`, version `2.0.0`, versionCode `42` |
| Installed build flags | `DEBUGGABLE`; native dev launcher present |
| Installed APK SHA-256 | `14CA480792F93DCF584E8C976F0A0FFA8C46E9320A24AA774D06EDCBD5878DD2` |
| Installed timestamp | Package manager reported last update October 18, 2026, 13:47:53, device clock |
| Observed power condition | AC powered, battery 14%, battery temperature 39.6°C at trace-end sampling; not a controlled thermal trial |
| Existing release APK | Upgrade worktree `anchor/mobile/android/app/build/outputs/apk/release/app-release.apk`; 240,570,533 bytes |
| Release APK identity | `com.anchorintentions.expo58qa20261016`, version `2.0.0`, code `1`; no debuggable badging; x86_64 native libraries only |
| QA environment distinction | `eas.json:16–26` configures Expo 58 QA with mock auth and an invalid synthetic API host. Current `.env.local` instead sets the production API and mock auth false for the dev server; runtime SQLCipher flags still need independent verification. |
| Release APK SHA-256 | `12F2E606A9FEAA13C06C04A0EDF69FCF9FDA52B15FDF080A288859227F5C8966` |
| Release install outcome | S24 rejected it with `INSTALL_FAILED_NO_MATCHING_ABIS`; existing app was not replaced |
| Emulator | Existing `Expo58QA_API36_x86_64`, Android 36.1 image, 2 GB configured RAM, 60 Hz configured vsync. Snapshot and no-snapshot launch attempts remained ADB offline; owned emulator stopped. No release app launch occurred. |
| iOS | No connected iOS target or usable local simulator tooling; Windows host. Not tested. |

The installed APK's version strings corroborate native version identity but are not a full native-module ABI/source attestation. The x86_64 release artifact predates dirty source changes and has no verified embedded source SHA. It must not be described as the current dirty tree's release baseline.

The preexisting `anchor/mobile/docs/EXPO58_UPGRADE_STATUS.md` records a prior launch of the same hashed synthetic release artifact on an emulator and a non-plaintext DB header. That is useful historical evidence, not a current native query/round-trip benchmark, and the AVD was unavailable in this pass. Its older branch/commit descriptions must not replace the live Git baseline above.

No EAS build, deployment, OTA, native rebuild, database/key extraction, data clearing, uninstall, or paid image generation was performed. Existing phone authentication was retained; supplied test credentials were not used to switch accounts. No destructive backend tests ran. The dev process could perform its normal authenticated sync; this was not an isolated synthetic backend run. Phone interaction stopped when the user asked whether the phone was being controlled.

## 3. Methodology and coverage matrix

Evidence levels used throughout:

- **Observed:** actual device/tool output in this audit; scope and build mode matter.
- **Source verified:** a mechanism exists at the cited location; its user-visible performance cost is not established.
- **Risk:** a testable hypothesis, not a confirmed bottleneck or regression.
- **Blocked/unmeasured:** prerequisite or instrumentation missing; no substituted estimates.

Method: inspect both checkouts and installed packages; verify Metro origin; inspect existing release artifact; capture package-scoped memory/gfx summaries; force-stop/reopen once; reconnect existing dev client; inspect resolving UI and existing diagnostic trail; run 20 rapid background/resume cycles with memory before/background/after each; capture a 10 s native Perfetto trace; execute source checks and existing tests. No new runtime instrumentation was added. Existing diagnostic logging increases dev overhead.

| Requested area | Runtime coverage this pass | Source coverage / remaining acceptance |
|---|---|---|
| Onboarding/auth | Existing authenticated process restoration observed; no new login/signup/guest flow | Startup gates, auth bootstrap, account persistence inspected. Fresh signup, skip, failed auth, offline restoration and user switching unmeasured. |
| Home | No controlled carousel or Home-to-Details run | Five-slot carousel, delayed selection commit, aura activation/foreground gates, Today/Vision/Chart hydration inspected. Zero-strength, three/four-card, glow origin/settling and swipe responsiveness require recordings and traces. |
| Details | No controlled entry/exit loop | Sheet animated reactions, recommendation cache, artwork/aura consumer inspected. Expansion/shrink geometry and retained duplicate trees not measured. |
| Creation | No generation invoked | Scene-context memoization and generation cancellation contract inspected. Text processing, SVG/style switching and candidate handoff costs unmeasured. |
| Vision | No controlled 1/4/8-image board run | Picker/upload, shared cache/request handling, editor/board animation sites and cinematic preparation inspected. Upload/crop/keyboard/commit timing and peak decoded memory unmeasured. |
| Chart | No map/waypoint/pan/zoom run | Shared read cache, route geometry, cloud/fog/grain loading and focus-gated weather inspected. Scaling with waypoint/progress count unmeasured. |
| Practice/audio | Focus resolving blocker observed; process restoration and 20 background/resume cycles | Focus completion chain, canonical persistence, audio cleanup, guided timing inspected. Fresh completed Focus, Deep Prime, Glimpse, Immerse, Embody, Visualize and Release acceptance incomplete. No Release deletion performed. |
| Progress/share/settings | No controlled navigation/export run | Shared state selectors, Share Studio export mount/release path and audio settings interfaces inspected. Export peak PSS, notification, billing and account interactions unmeasured. |
| SQLCipher | Active audited dev launch did not establish enabled cohort; no native query benchmark | Opening/keying, schema, FIFO queue, record codec, transactions, recovery and middleware inspected; focused tests pass. Native encryption/lifecycle/volume matrix remains open. |
| Lifecycle | **20** background/resume cycles of existing resolving surface; one force-stop/reopen | Requested 15–20 repetitions of Home/Details, carousel, Vision, Chart and Practice entry/exit were not completed. |
| Network | Existing startup diagnostics and request code inspected | No controlled HTTP waterfall, request-count, payload-size or endpoint-latency dataset. No backend business logic changed. |

The supplied request's whole-app completion bar is **not met** by this matrix.

## 4. Startup benchmark results

There is **no valid production/release startup baseline** from this pass.

| Measurement | Samples | Result | Interpretation |
|---|---:|---|---|
| Force-stopped dev Activity start, `am start -W` | 1 | `TotalTime=2377 ms`, `WaitTime=2382 ms` | Ended at **DevLauncherActivity**, not application interactive readiness |
| Dev JS `app-ready` marker | 1 identified JS context | `36,328 ms` since app start | Includes restoration/configuration/dev costs; not Home TTI. Two JS initialization contexts appeared during reconnect, so this is not an isolated cold-start trial. |
| Hot existing Activity resume | 20 | min 60, median **70**, empirical p95 **77**, worst **95 ms** | `am start` Activity timing; UI still resolving. Not JS or screen TTI. |
| Warm process recreation | 0 | Unmeasured | Do not relabel hot resumes as warm process starts |
| Home interactive / first actionable screen | 0 | Unmeasured | Readiness marker is insufficient |

Nearest-rank empirical p95 uses the 19th ordered observation of 20. This small sample has poor tail confidence and is descriptive only. The 20-cycle script uses 500 ms dwell intervals around memory snapshots; it is a rapid lifecycle probe, not a long-duration soak.

Existing diagnostics reported a 424,524-character vault read in 3,822 ms / 236 chunks and a 216,567-character session read in 4,971 ms / 121 chunks in one context. Auth writes of a 13,730-character payload reported 19,140 / 24,797 / 30,402 ms. These are legacy-path dev observations, not SQLCipher timings. `persist-setItem-settled` can precede durable completion due to debounce; a short adapter-settled duration does not contradict a long `secure-write` duration.

## 5. Screen-by-screen measurements and thread evidence

Only the resolving Focus/startup window has new native frame data. The process-level `gfxinfo` sample recorded 10,129 rendered frames, 542 modern janky frames (**5.35%**), p50 **5 ms**, p95 **23 ms**, p99 **46 ms**, 433 missed vsyncs, 299 slow bitmap uploads, and GPU p95 **5 ms**. This summary spans mixed startup/Focus/lifecycle state; counters were not reset at a single controlled screen boundary. It is **not** an FPS measurement, a carousel result, or release acceptance.

The sanitized existing JS-stall dataset contains 45 thresholded observations: median gap **111 ms**, empirical p95 **467 ms**, worst **1119 ms**. These are gaps already selected by the diagnostic's stall threshold, not percentiles of all JS frames, and include startup. No function-level CPU attribution follows from them.

For Home, Details, Creation, Vision, Chart, other Practice modes, Progress, sharing and settings: cold/warm screen entry, transition latency, JS responsiveness, native frame percentiles, CPU, heap and network metrics are **unmeasured**. There is no evidence supporting a score, “smooth” verdict, or approved visual parity statement for those screens.

Supporting files: [phone-focus-restored-gfxinfo.txt](expo58-evidence-20261018/phone-focus-restored-gfxinfo.txt), [phone-restart-perf-sanitized.jsonl](expo58-evidence-20261018/phone-restart-perf-sanitized.jsonl), [lifecycle-samples.json](expo58-evidence-20261018/lifecycle-samples.json). A 16,666,427-byte [Perfetto trace](expo58-evidence-20261018/phone-focus-dev.perfetto-trace) was captured with `sched freq idle am wm gfx view`; no trace-processor attribution was completed. Its existence is not a bottleneck diagnosis.

## 6. SQLCipher performance and lifecycle assessment

**Verdict: current Expo 58 native SQLCipher overhead and encryption acceptance are INCONCLUSIVE. Do not replace or weaken encryption.**

### Audited lifecycle

Paths below are relative to the upgrade worktree's `anchor/mobile/`:

1. `app.config.js:7–27` sets the separate Expo 58 identity, disables updates and enables SQLCipher for `ANCHOR_EXPO58_QA=1`. The SQLCipher production-QA branch is separately gated at `app.config.js:31–49`.
2. `src/storage/sqlcipher/persistence.ts:5–9,45–48` decides persistence routing from **runtime Expo config flags**, rather than merely the package name or native library presence.
3. `src/storage/sqlcipher/runtime.ts:18–64` creates one lazy database owner, validates the cohort, checks DB/WAL/SHM existence, uses a random 32-byte key in SecureStore, verifies a created marker and opens with `useNewConnection:true`. Diagnostics are numeric and opt-in.
4. `database.ts:45–57,62–101` serializes access and unlocks before schema reads; missing/wrong keys fail closed. Initialization reads cipher version, uses WAL / `synchronous=FULL`, schema version checks and transactional schema creation.
5. `database.ts:103–114` uses an exclusive transaction, keys that transaction's connection and checks referential integrity. SDK 58's installed `expo-sqlite/src/SQLiteDatabase.ts:180–204` creates a transaction connection and closes it in `finally`; `runAsync/getAllAsync` manage their own statement lifecycle. No explicit unfinalized prepared-statement leak was established in application code.
6. `database.ts:115–165` loads a namespace, reads all its records, checks checksums, decodes the document and caches encoded records. Legacy import retains source bytes and verifies before activation.
7. `database.ts:170–249` captures writes before queueing, compares records, commits changed rows and atomically batches multiple namespace mutations. Canonical Practice history/outbox writes use this path when enabled (`PracticeCompletionService.ts`, `queueCanonicalCompletion`).
8. `database.ts:401–402` closes and clears the private owner on explicit close. No normal foreground/background close call was established; a long-lived singleton is intentional, not automatically a connection leak. Process death terminates the native owner; restoration/durability must still be tested.

Positive source/test findings: parameterized user values; validated key PRAGMA; no empty fallback on failed unlock; durable receipts published after commit; bounded receipt history; owner-constrained recovery; unchanged-row suppression; multi-document atomic canonical writes. These were not weakened during this audit.

### Measurements still required

| Required SQLCipher metric | Current pass |
|---|---|
| Native load / open / key derivation / schema migration | Unmeasured on verified enabled Expo 58 cohort |
| First and incremental hydration | Unmeasured on that cohort |
| Per-record and batched reads/writes, queue wait vs work | Unmeasured natively |
| Encryption overhead vs equivalent durable baseline | Unmeasured; no ordinary SQLite replacement used |
| Checkpoint latency, WAL growth and transaction keying cost | Unmeasured |
| Synthetic 0/1/72/500/1000-record scale trials | Not run on Expo 58 |
| Force-close, offline/reconnect, auth restore, account A/B | Not certified on SQLCipher in this pass |
| Encrypted header, wrong/missing key and durable recovery | No owner keys/data read; current native encryption proof not collected |

The older [SQLCIPHER_NATIVE_BENCHMARK_RESULTS.json](../performance-audit-2026-10/SQLCIPHER_NATIVE_BENCHMARK_RESULTS.json) records a 72-item synthetic old write of 19,703.45 ms versus new write 415.06 ms, old read 4,533.27 ms versus reopened new read 222.67 ms. Its companion implementation document explicitly uses **SDK 54 / RN 0.81.5**. These are historical single-operation comparisons, not Expo 58 results or current p95s. They support retaining the SQLCipher direction, not signing off this baseline.

## 7. Findings and top ten investigation priorities

Severity follows the request. A risk's priority below is a proposed investigation order, **not a confirmed issue severity**. Every source location refers to the dirty upgrade worktree, not the Expo 54 workspace copy.

### F01 — P0 in observed QA configuration: Focus completion cannot return

- **Feature / evidence:** Focus resolving UI persisted across repeated inspection. After reopen/reconnect the existing debug trail showed `beginEnding`, `save start`, `timer fired -> onComplete`, `handleFocusComplete enter`, with no `persistence settled -> complete` in the captured UI trail. Back did not exit the observed resolving screen. No fresh test-account flow was entered, so clean reproduction and exact wait duration are not certified.
- **Locations:** `src/screens/v2/practice/focus/V2FocusActiveScreen.tsx:465–563`; `src/screens/v2/practice/V2PracticeSessionScreen.tsx:157–278`, especially `await persistence` at 273; `src/services/PracticeCompletionService.ts`, `completePracticeSession/queueCanonicalCompletion`.
- **Reproduction to complete:** On an identified test cohort, finish the shortest supported Focus; follow ending → durable receipt → completion. Repeat online/offline, with a queued storage workload, then force-stop/reopen. Current observation started from an already-running session and repeated resolving-state observation after process restoration.
- **Probable cause:** completion is waiting on its durable-save promise. The chain is source-verified; which operation is pending is **unproved**. The active legacy routing and slow auth writes are relevant correlation, not SQLCipher causality.
- **Proposed correction:** first identify the unresolved stage using bounded numeric receipts; repair that stage and provide an explicit recoverable failure path when local storage fails. Never show a successful save by skipping the durable receipt.
- **Regression risk:** high: duplicate sessions, falsely successful saves, Thread Strength and auth ownership.
- **Validation:** 20 fresh completions plus interrupted/failed writes; exactly one durable canonical event and one completion transition; restart and account-bound replay checks; release reproduction/closure required.

### F02 — P1 measurement/configuration blocker: active SQLCipher routing not established

- **Feature / evidence:** Metro manifest has `sdkVersion:58.0.0` but SQLCipher flags absent. Running PID 6338 emitted legacy chunk reads/writes. A read-only filename search found no `anchor-private-v1.db*` under this package's accessible private tree. That absence corroborates routing but is not independent proof of an encryption failure. Compiled SQLCipher capability and active product persistence are different checks.
- **Locations:** `app.config.js:7–49`; `src/storage/sqlcipher/persistence.ts:5–9,45–48`; `src/stores/encryptedPersistStorage.ts:223–228,352–381`; `src/storage/sqlcipher/cohort.ts:23–25`.
- **Reproduction:** inspect the manifest delivered by the existing Metro launch, then compare the selected adapter's safe diagnostic events. The existing server command did not include a visible QA cohort environment assignment; its inherited environment was not dumped.
- **Probable cause:** missing cohort configuration in the active dev manifest; native package identity alone does not activate the JS gate.
- **Proposed correction:** establish an explicit isolated QA launch whose manifest and runtime adapter agree. Reuse an existing compatible artifact when available. Validate routing before timing it; no production configuration edits are needed for the audit.
- **Regression risk:** high if someone globally bypasses activation safety or migrates the owner's real vault merely to obtain timings.
- **Validation:** verify flag, package/runtime, native cipher version, safe initialization events, encrypted-file checks in a synthetic cohort and zero legacy hot-path writes for routed namespaces. Then rerun F01.

### F03 — P1, dev-observed: long application-readiness and legacy storage work

- **Feature / evidence:** one reconnect JS context reports readiness 36,328 ms after app start; auth write durations 19,140 / 24,797 / 30,402 ms. No production timing claimed; no causal trace of startup critical path completed.
- **Locations:** `App.tsx:340–459,493–530` (hydration/auth gates); `src/services/AppAuthBootstrap.ts:175–303`; `src/stores/encryptedPersistStorage.ts:166–219,375–381`.
- **Reproduction:** controlled cold start with the same local payload, then capture JS start, per-store hydration, durable writes, auth settle and first responsive Home frame separately. Exclude dev launcher and bundle transport from app-only timing.
- **Probable cause:** legacy persistence plus restoration contention is plausible. Dev instrumentation, Metro and normal auth/network work also contribute; no exclusive cause assigned.
- **Proposed correction:** measure the critical-path graph under the verified SQLCipher cohort before changing startup scheduling or persistence. Keep current restoration/data-safety gates.
- **Regression risk:** high for moving readiness ahead of owner restoration or losing pending writes.
- **Validation:** at least 10 release cold and 10 process-warm runs with fixed payload/network/cache state; native timestamps plus an actual input acknowledgment.

### R04 — risk, investigate as P1: transaction connection/keying and namespace-scale hydration

- **Source evidence:** `database.ts:103–114` rekeys each exclusive connection and runs `foreign_key_check`; `database.ts:145–153` reads/checksums all namespace records; `recordCodec.ts:13–26,41–116` traverses documents and synchronously compares/serializes/parses payloads.
- **Reproduction / measurement needed:** synthetic increasing record counts, single-row edit and canonical multi-namespace completion. Measure queue wait, native open/key, checksum, encode/decode and commit separately; capture JS tasks.
- **Probable mechanism:** repeated native connection initialization and whole-document reconstruction may become expensive despite changed-row SQL writes. Cost is **not measured** on Expo 58.
- **Proposed correction if proved:** reduce redundant traversal or reuse prepared representations; investigate a supported safe transaction-owner strategy only with equivalent serialization, durability, integrity and key isolation. Do not weaken cipher settings or integrity checks to improve numbers.
- **Risk / validation:** high data-integrity risk; preserve every current fault/ownership test and compare equivalent durable operations at 72/500/1000 records, with native kill recovery.

### R05 — risk, investigate as P1: Vision upload/Visualize peak memory

- **Source evidence:** `src/hooks/v2/vision/visionPhotoInput.ts:36–76` selects a quality but no explicit pixel cap, reads the whole file as base64 and constructs a data URI. `src/screens/v2/practice/visualize/cinematicAssets.tsx:9,41,92–138` caps each cinematic image at 2048² pixels, starts per-source dimension/prefetch work, and decodes Skia resources. React Native prefetch plus Skia decode may occupy distinct image pipelines; duplicate decoding is not proved.
- **Reproduction / evidence needed:** existing synthetic 1/4/8-image boards, mixed upload/generated sources, large camera photo, crop/retry/keyboard transitions; record peak native/graphics/JS heap, decode concurrency and commit latency. No paid regeneration required.
- **Probable mechanism:** full base64 payload copies and simultaneous texture readiness can amplify peaks. A 2048² RGBA image is arithmetically 16 MiB; eight would be 128 MiB for that layer alone, **not a measured allocation or proof the current route accepts eight cinematic images**.
- **Proposed correction if proved:** enforce fit-for-purpose source dimensions and bounded decode/upload concurrency while retaining original/crop/reference fidelity and request contracts.
- **Risk / validation:** medium/high visual and content risk; compare approved images/layout and genuine saved media on Android/iOS, with interruption and cleanup.

### R06 — risk, investigate as P1: carousel and aura mounting/geometry

- **Source evidence:** `src/components/v2/home/V2HomeAnchorCarousel.tsx:23,29,244–272,393–405` maintains five virtual slots and a 140 ms post-settle selection delay. UI-thread pan updates are separated from selection commit. `ThreadAura.tsx:236–246` stops active animation for inactive/background/zero-strength cases but may retain a nonzero static renderer. `ThreadAuraCanvas.tsx:18,29–35,57–59` caps shader coordinate span and renders a canvas at the actual layout size; a 512 coordinate cap is not proof of a 512-pixel framebuffer cap.
- **Reproduction / evidence needed:** slow swipes, rapid reversal, tap neighbors, zero-strength Anchor, hydrated strength arrival, Home/Details return, background/resume; record center geometry, layout measurements, React commits, UI callbacks and GPU surfaces.
- **Probable mechanism:** mounted slot/resource count, activation handoff and measured position could explain lag or origin errors. None has been causally demonstrated here. The 140 ms commit is intentional sequencing, not automatically a bug.
- **Proposed correction if proved:** target redundant mounts/resources or stale geometry without changing approved glow origin, bloom overshoot/settling or global selection semantics.
- **Risk / validation:** high visual/state-machine risk. Require side-by-side recordings and repeated gesture/selection correctness; do not make a spacing-only change.

### R07 — risk, investigate as P2: overlapping Vision generation polling

- **Source evidence:** `src/hooks/v2/vision/useV2VisionGeneration.ts:52–91` polls every 2500 ms while active/foreground. `refresh` has no in-flight lock/cancellation; an AppState resume also refreshes. `src/services/ApiClient.ts:25–28` uses a 120 s default timeout. Generation **start** has a pending-key guard and idempotency key; do not conflate overlapping status GETs with duplicate paid generation.
- **Reproduction / evidence needed:** delay status responses beyond 2.5 s, background/resume and unmount while job active; count concurrent requests, response ordering and post-exit traffic in a synthetic service.
- **Probable mechanism:** timer-based refresh can overlap slow requests; source-verified possibility, no observed request flood.
- **Proposed correction if proved:** coalesce status reads or schedule the next read after completion, with generation/job identity checks and cancellation semantics.
- **Risk / validation:** medium; preserve retry/recovery and progress visibility, prove one active status read per job and no stale result overwrite.

### R08 — risk, investigate as P2: long-session JS sampling and audio delivery

- **Source evidence:** `src/screens/v2/practice/visualize/guided/useGuidedPlayback.ts:12–14,60–82,198–207` samples audio every 50 ms and can publish React position state every 100 ms. Cleanup is present. Focus uses a 250 ms logical sampler with visible-time state limited to whole-second changes (`V2FocusActiveScreen.tsx:587–615`). `src/hooks/useSessionAudio.ts:29–77,86–113` removes players/subscriptions on cleanup. `src/services/audio/remoteAudio.ts:111–154` can stream while a deduplicated disk download runs; simultaneous playback/download bandwidth is plausible, not measured.
- **Reproduction / evidence needed:** actual guided playback with captions/haptics, long stillness, pause/resume, chapter/end, exit at a cue boundary, offline cached and uncached audio; count renders, JS samples, native players and requests.
- **Proposed correction if proved:** reduce state publication or duplicate transport cost while keeping the audio clock authoritative and preserving cues/haptics. No blind per-frame rewrite.
- **Risk / validation:** high timing/feel risk; compare audio-to-frame synchronization and player cleanup on both platforms.

### R09 — risk, investigate as P2: retained per-namespace/read-model caches

- **Source evidence:** `database.ts:40,115–118,153,401–402` retains loaded namespace payloads until close. `useV2Vision.ts:68–80,140–144` and `useAnchorChart.ts:27–30,53–58` retain per-Anchor data with account-reset paths, but no per-account count/byte eviction budget. This is different from a proven memory leak. Chart grain cache already evicts at a bound (`ChartMapLand.tsx:120–130`); Vision preview aspects already cap at 128 (`VisionEditorialPreview.tsx:107`).
- **Reproduction / evidence needed:** visit many Anchors/boards/accounts, force GC only in a diagnostic run, compare post-idle heap/native images and cache counts. Native warm caches can legitimately remain resident.
- **Proposed correction if proved:** owner-safe size-aware eviction of reconstructible caches; retain committed/recovery data. Do not indiscriminately clear persistent owner partitions.
- **Risk / validation:** high offline/ownership risk; verify offline reopening, restored edits and account A/B isolation before accepting eviction.

### R10 — risk, investigate as P2: first-use Chart/export resource work

- **Source evidence:** `src/components/v2/chart/map/chartCloudTiles.tsx:148–160` rasterizes three tile layers concurrently once; `ChartMapLand.tsx:36–49,70–137` prepares fog/grain/land resources with caching. `src/components/share/useShareExportRenderer.tsx:136–174,196–211` owns a mounted export target and release path; `AnchorShareStudio.tsx:68–69` releases when hidden. Native allocation spikes and release timing are not measured. Creation's `AnchorCreationFlowScreen.tsx:173–189` memoizes scene assembly; expensive synchronous scene-building cost remains unprofiled.
- **Reproduction / evidence needed:** cold/warm Chart at increasing waypoint counts, pan/zoom/fog reveal, then repeated largest supported Share exports and return to Home. Measure first-use JS/GPU work and post-release PSS.
- **Proposed correction if proved:** preload or split only demonstrated first-use work, or reduce redundant export allocations without changing map geometry, layer fidelity or output resolution.
- **Risk / validation:** medium/high artwork/export risk; compare rendered map, transitions and exported images plus memory recovery over 20 cycles.

## 8. Memory and lifecycle findings

The available 20-cycle data covers **one resolving Practice route**, not 20 executions of each requested workflow.

| PSS sample (KB from dumpsys) | First / range | Median | Empirical p95 |
|---|---|---:|---:|
| Before foreground cycle | first 1,188,846; range 989,851–1,188,846 | 1,013,709 | 1,071,706 |
| Background | range 987,710–1,158,978 | 1,013,660.5 | 1,072,713 |
| After resume | last 987,562; range 987,562–1,078,654 | 1,014,083 | 1,015,769 |

There is **no positive retained-PSS growth signal in this sequence**. PSS fell 201,284 KB from first-before to last-after. This does not show a GC event or prove JS/native-view/media leak freedom; swap, renderer teardown, pressure and caches can move PSS. Separate earlier/later process snapshots must not be used as a within-process leak slope. No Hermes heap snapshots or retained-object dominator analysis were obtained. No completed audio interruption/player-count acceptance exists. A Focus UI block is not an Android ANR without ANR evidence; no ANR was established here.

Source cleanup positives: aura AppState listener removal and frame callback deactivation; Home focus timers/listeners unsubscribe; guided playback interval/AppState cleanup; managed audio players remove/release; Share Studio hides/releases the export target; Chart weather drift is focus-gated. These are source observations, not runtime leak tests.

## 9. Network/backend efficiency

No controlled backend/network latency distribution was collected. In particular, there are no justified endpoint median/p95s, transfer byte totals, offline/reconnect recovery pass counts, or confirmed duplicate expensive requests.

Inspected controls worth preserving:

- `useV2HomeModel.ts:95–151`: Today abort controller, stale presentation preservation and same-result identity checks.
- `useV2Vision.ts:154–196`: shared in-flight GET per account/Anchor and mutation-version protection. Its shared request uses the first caller's AbortSignal; cancellation ownership across subscribers merits a delayed-request test, not a claim of broken behavior.
- `useAnchorChart.ts:96–115,201–246`: shared in-flight GET and concurrent disk/network fallback. Server request continues after a surface unmount; mounted/scope guards prevent that surface's late state update. Continuing a shared cache warm-up can be intentional.
- `V2HomeScreen.tsx:195–236`: foreground refresh, focus cooldown and delayed post-transition refresh. Concurrent foreground/focus refresh may be coalesced by lower layers; no duplicate-request defect established.
- `ApiClient.ts:89–116`: account guard checked before and after asynchronous token lookup; request/response timing traces exist. `USER_NOT_FOUND` recovery retries a request once after auth sync, not an arbitrary unbounded retry loop.
- Vision generation start guards/idempotency are present; overlapping status polling is R07.

Next network trial should use a synthetic/test service with delayed and failed responses, request IDs and sanitized route categories. Separate cache restoration, token lookup, request transport and server duration; measure payload size without logging private intentions, images, tokens or URLs containing signed credentials. Backend business logic stays out of this audit's change scope.

## 10. Expo 58 compatibility and validation

| Check executed | Result / limit |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | **PASS, exit 0**, 0 reported diagnostics; [typecheck.txt](expo58-evidence-20261018/typecheck.txt) |
| QA env `expo install --check` | **PASS, exit 0**; [expo-install-check.txt](expo58-evidence-20261018/expo-install-check.txt) |
| `expo-doctor` | **18 passed / 2 failed / 20 checks**; [expo-doctor.txt](expo58-evidence-20261018/expo-doctor.txt) |
| Persistence tests | **5 suites passed, 59 tests passed, 0 failed**; database/cohort/product/store/secure-generation tests; [jest-storage-results.json](expo58-evidence-20261018/jest-storage-results.json) |
| Initial full Jest attempt | **34 failed suites reported before interruption**. No final passed/failed test count or complete suite count available. [jest.txt](expo58-evidence-20261018/jest.txt) |
| Full Jest rerun | Started with `--runInBand --forceExit --silent --json`; see final validation addendum below. `--forceExit` is an audit runner option, not a test-file edit or proof of clean open handles. |
| Lint | No lint script, project ESLint config or local eslint executable found in the mobile app. No lint pass claimed. |
| Native release execution | Blocked by x86_64-only release artifact and offline AVD. No native build invoked. |
| iOS native compatibility | Not executed. |

Doctor failures: (1) local Expo-module native directories match overly broad gitignore rules; (2) app config native fields/plugins may not be synchronized when checked-in/generated native directories are present. These require examining generated inputs before future builds; they are not measured frame regressions.

Common test failures include missing Skia mock methods (`RuntimeEffect.Make`), outdated store mocks (`useAnchorStore.getState`), unresolved mapped fixture resources, and failed UI assertions. Examples are `V2PaywallScreen.test.tsx`, `homeRenderBudget.test.tsx`, `AppStartupHydration.integration.test.tsx`, and `ActivationScreen.test.tsx`. Not every failure was triaged, and none is automatically an RN 0.88 product regression. **Do not delete assertions or suppress failures to make this audit green.**

The persistence test driver explicitly replaces cipher-version checks and uses Node's in-memory ordinary SQLite. Its 59 passing tests establish tested ordering/ownership/transaction logic, **not native SQLCipher encryption or mobile latency** (`src/storage/sqlcipher/__tests__/sqliteTestDriver.ts:7–24`).

Installed compatibility metadata lists RN `0.88` with Reanimated `4.7.x` and Worklets `0.13.x`. This matches the [official compatibility guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/) and [4.7 release notes](https://swmansion.com/changelog/reanimated-4-7-0/). Reanimated 4 requires the New Architecture; `newArchEnabled=true` and `hermesEnabled=true` are present in `android/gradle.properties`. `babel-preset-expo` is used; do not infer a missing worklet plugin from the absence of an explicit old Reanimated plugin entry. Aura worklet-called helpers contain `'worklet'` directives (`threadAuraModel.ts:21–83`).

The [Expo 58 SQLite documentation](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) describes native SQLCipher configuration and transaction APIs. Native plugin configuration is build-time capability; runtime routing must be independently verified. No claim of universal compatibility is made for Firebase, billing, widget, SVG filters, audio, view-shot or iOS interop without exercising their real native paths.

## 11. Regression comparison

The October 12 [performance audit](../performance-audit-2026-10/PERFORMANCE_AUDIT_REPORT.md) used SDK 54 debug measurements and a different package/data state. It recorded long SecureStore work, a Focus completion hang (PERF-003), Home/Details frame gaps and media-heavy memory costs. These are historical observations, not directly comparable release baselines.

| Category | Current conclusion |
|---|---|
| A — existing debt | Legacy chunk-storage latency and a Focus durable-save-dependent completion boundary predate this pass. Current symptoms resemble those reports, but identical cause is not proved. |
| B — new Expo 58 regression | **None established.** Dependency/native version identity exists; matched old/new release measurements do not. Current UI test failures need triage. |
| C — SQLCipher overhead | **Unmeasured on current enabled SDK 58 runtime.** Historical SDK 54 synthetic improvement cannot be transplanted. |
| D — new animation/render regression | **None established.** Dirty aura/carousel/Vision changes require controlled recordings and matched trace conditions. |
| E — unverified risks | R04–R10 and all blocked coverage rows remain open. |

Prior remediation claims were not accepted on memory alone. Current source controls and current tests were inspected; historical debug percentages were not presented as new measurements.

## 12. Reproduction package and evidence

All new files are under `docs/performance/`. Reproduction scripts operate on the explicit QA package/device and require deliberate review before reuse:

- [lifecycle-sample.ps1](expo58-evidence-20261018/lifecycle-sample.ps1): exact 20-cycle routine and three memory snapshots per cycle; per-cycle launch and memory files retained.
- [summary.json](expo58-evidence-20261018/summary.json) and [summarize.cjs](expo58-evidence-20261018/summarize.cjs): installed package versions, source identity and reproducible aggregation. Run aggregation after a source change only as a **new** baseline; hashes are capture-time facts.
- [release-manifest.txt](expo58-evidence-20261018/release-manifest.txt), [release-apk-hash.txt](expo58-evidence-20261018/release-apk-hash.txt), [installed-apk-hash.txt](expo58-evidence-20261018/installed-apk-hash.txt): artifact identity evidence.
- [phone-restart-perf-sanitized.jsonl](expo58-evidence-20261018/phone-restart-perf-sanitized.jsonl): numeric/stage fields only, private payloads and identifiers omitted. It is not a complete chronological session log: filtered parsing and reconnect contexts limit interpretation.
- [observations.md](expo58-evidence-20261018/observations.md): compact device/tool observations that were not added to product instrumentation.
- [phone-focus-dev.perfetto-trace](expo58-evidence-20261018/phone-focus-dev.perfetto-trace): local native trace; treat as diagnostic material, inspect before sharing outside the project.
- `emulator-*-stdout.txt` / `emulator-*-stderr.txt`: unsuccessful target-start attempts. The owned emulator was stopped; no guest data wipe used.

Read-only inspector attempts timed out; no Hermes CPU profile or heap snapshot was obtained. The helper in this folder changes no application source. No screenshot containing account artwork was added to this report.

## 13. Proposed fix/verification order and highest-impact improvements

Return this order for review **before optimization work**:

1. **Verify the isolated native/runtime/JS cohort as one baseline.** Record artifact SHA, manifest flags, native cipher version and routing. Fix only the QA launch/configuration mismatch if confirmed; keep the working upgrade and cipher capability. This is the prerequisite to attributing all subsequent measurements.
2. **Resolve F01 with durable-save integrity intact.** Obtain a fresh-account reproduction, identify the pending stage, repair it and test recoverable failure rather than bypassing persistence. This has the highest immediate functional impact.
3. **Complete critical-path startup and persistence profiling.** Measure release cold/warm/interactive milestones with a realistic synthetic vault and canonical completion; separate encryption/transaction cost from legacy import, network/auth and JS projection.
4. **Profile and bound Vision/Visualize memory and preparation where measurements justify it.** Reuse cached/generated content; validate 1/4/8 board cases, uploads, keyboard/crop and exit cleanup.
5. **Profile Home/Details/carousel/aura, then Chart first-use resources.** Record geometry, activation and React/native work at gesture boundaries. Preserve artwork, glow choreography, shared transitions and selection contracts.

In parallel with those evidence steps, triage the existing failing UI tests and repair mocks/fixtures or actual regressions without lowering checks. Only then use them as reliable guards for subsequent optimizations.

Can wait until a measured impact appears: generic memoization, replacing state/navigation libraries, speculative SVG rewrites, changing animation constants, broad cache eviction, rewriting audio clocks, or replacing encrypted storage. These are not approved implementations.

## 14. Budgets, limitations and remaining acceptance

Numerical **release acceptance budgets cannot yet be calibrated from this dev-only dataset**. The following are proposed test gates, not achieved measurements or production promises:

| Dimension | Proposed next-run gate / basis |
|---|---|
| Stability/durability | 0 crashes/ANRs/indefinite completion waits and exactly 1 durable canonical record across each of 20 core-flow repetitions plus interrupt/restart cases |
| Frames | Use actual scheduled display deadlines: 16.67 ms at 60 Hz, 8.33 ms at 120 Hz. Measure deadline-miss rate and long-frame clusters per scenario; do not equate UI and JS rates. Establish release median/p95 before setting a device-specific jank threshold. |
| JS responsiveness | Investigate tasks >50 ms; no repeated long task on a simple input/gesture path. This is a proposed investigation threshold, not proof of current compliance. |
| Startup/navigation | Collect ≥10 controlled release cold and ≥10 process-warm samples; collect ≥30 navigation samples. Use medians/worst first; publish tail statistics with sample count. Investigate >10% repeatable regression beyond observed noise against that **new** matched baseline. |
| Memory | After warm-up, repeat 20 complete entry/exit cycles with fixed dwell/settle periods and GC-aware analysis. Investigate post-settle growth >10% across repeated identical runs; current falling PSS is not an all-route budget. Set absolute per-device native/graphics/heap ceilings after peak trials. |
| Persistence | Capture queue wait/work, init/key and changed-record commit separately at 0/1/72/500/1000 synthetic items. No encryption/durability changes to hit a target. Set per-device limits after enabled native baseline, not from desktop SQLite tests. |
| Network/media | 1 in-flight expensive operation per logical job where coalescing is appropriate; 0 duplicate paid generation starts for a single accepted action; image-count/decode/export peak ceilings must come from real memory measurements. |

Missing prerequisites: a source-attested compatible release target (ARM64 physical or a working x86_64 AVD), verified runtime SQLCipher activation, safe synthetic/test data with existing media/Chart content, controlled network scenarios, supported JS profiling/heap collection, native trace analysis, iOS target and the complete remaining flow matrix. No additional EAS build should be requested until existing compatible artifacts/targets are exhausted.

Additional limitations: existing session and local data volumes were not normalized; dev reconnect had multiple JS contexts; no controlled audio-player counts, touch hit-area/video/frame-by-frame review, long thermal soak, encryption verification or account-switch regression test occurred. Native trace and aggregate gfx counters cannot establish the root cause of the Focus save wait.

## 15. Development-readiness handoff

**NOT READY for feature expansion on the strength of this audit.** First clear the observed Focus blocker, verify the SQLCipher cohort and complete core release acceptance. This verdict does not authorize a rollback of Expo 58, removal of SQLCipher, UI redesign, weaker durability, or speculative refactors.

- **Top ten priorities:** F01 Focus completion; F02 cohort identity; F03 startup/legacy persistence; R04 transaction/hydration scale; R05 Vision memory; R06 carousel/aura mounting/geometry; R07 status polling; R08 guided/audio work; R09 cache retention; R10 Chart/export first-use resources. Only F01–F03 have current observed behavior/configuration evidence; R04–R10 are unverified risks.
- **Top five expected-impact steps:** cohort verification → Focus save closure → release startup/persistence critical-path measurement → Vision/Visualize memory → Home/Details/Chart rendering measurements. Expected impact is qualitative, not a fabricated speedup estimate.
- **SQLCipher verdict:** keep it; architecture has useful batching/durability safeguards and 59 focused tests pass. Native Expo 58 latency, enabled routing and lifecycle acceptance remain uncertified.
- **Expo 58 stability verdict:** running dev client and compatible dependency versions verified; app-wide release stability not established. No proven Expo-caused regression.
- **Platform differences:** Android dev observations only; x86_64 release could not run on ARM64 S24, AVD unavailable, iOS entirely unmeasured.
- **Before development resumes:** repair/close Focus, establish trustworthy cohort/artifact identity, triage failing test gates and run the missing core release scenarios.
- **Later:** only measured optimization candidates; broad memoization, visual tuning and infrastructure replacements can wait.

### Final validation addendum

The full rerun was interrupted after approximately eight minutes. It again reported **34 failing suites** (73 failure blocks in the log, including suite-load errors; these are not 73 uniformly classified failed tests). Discovery found **566 test files**. No final aggregate JSON was produced, so total passed/failed test counts are unavailable and no full-suite pass is claimed. The initial attempt was also interrupted. The rerun used the mutable worktree and cannot certify a frozen snapshot. Evidence: `jest-complete.txt` and `jest-inventory.json`. The complete focused result remains **5/5 suites and 59/59 tests passed**. TypeScript exit 0 and Doctor 18/20 are separately captured checks. No runtime code was changed by this audit; source drift from concurrent work is documented in section 2.
