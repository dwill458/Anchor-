# Device Validation Matrix

Date: 2026-10-12. This states honestly what was and was not tested. **Nothing here is production performance data.** Raw evidence: `raw/agent-E-runtime-qa.md`.

Sections 1–5 retain the original Galaxy S24 DEBUG snapshot. Later release/emulator checks are appended as dated passes and supersede only the specific platform, build, or scenario statements they restate.

## 1. What was tested

| Dimension | Tested | Not tested |
|---|---|---|
| Platform | Android only | iOS (no Mac, no iOS device, no simulator; Windows host). All iOS statements in the audit are source reading. |
| Device class | Physical Samsung Galaxy S24 Ultra SM-S928U1, Android 16, 12 GB class flagship, arm64 | Any mid-range or low-end Android (the repo's own baseline doc names a Galaxy A52 and iPhone 8 as intended low-end references); any tablet; any other Android version |
| Simulators/emulators | none | Android emulator, iOS simulator |
| Build configuration | DEBUG dev client (`DEBUGGABLE`, expo-dev-launcher), dev-mode JS bundle from Metro :8081, Hermes/Fabric | Release/production, EAS profiling build, Hermes sampling profile, minified bundle. **No production-representative measurement exists.** |
| Refresh rate | Panel in adaptive mode (modes 120/80/60/48/30/24/10 available; touch boost "high" seen) | 120 Hz forced; 60 Hz forced; 80 Hz; per-screen refresh policy (PERF-051) |
| Power/thermal | ~25 min mixed use while USB-charging; thermal status 0 to 1 (SKIN 37.6 to 40.4 C, AP up to 48.4 C) | Unplugged battery drain; sustained 15-30 min session thermal throttling |
| Tooling | `dumpsys gfxinfo`/`meminfo`/`SurfaceFlinger`/`thermalservice`/`batterystats`, logcat, uiautomator, screenrecord, adb input | Perfetto, simpleperf, Hermes profiler, Android Studio profiler, Xcode Instruments, systrace |
| Account | Real Pro account, 72 local Anchors, 175 practice-history entries | Guest, free, trial-ended, fresh install; account with a Chart/Vision/Release in progress |
| Static/automated | none run by any agent | jest (535 test files), tsc, lint; known failing: `AuthHydrationService.test.ts` (10-07 note) |

## 2. Scenario coverage (Galaxy S24 Ultra, DEBUG build)

| Scenario | Status | Notes / related issues |
|---|---|---|
| Cold launch | Partial | `am start -W` COLD 855 ms reaches only the dev launcher; tap to Home ~38 s in dev (PERF-002). Not a production number. |
| Warm/hot launch | Reached | HOT 105 ms |
| Home initial render + idle | Reached | idle 10 s = 1 frame |
| Home carousel (slow swipes, fast flicks) | Reached | PERF-050 |
| Home to Details and back; rapid taps; 15x loop with meminfo | Reached | PERF-012; 5 taps -> 1 navigation; no leak |
| Progress open + scroll | Reached | PERF-057 context |
| Vision board open + scroll | Reached | PERF-017. Vision entrance/creation not entered (paid generation). |
| Chart | Blocked | visible Anchor had no Chart (creation enters a paid-AI flow). PERF-014, 019, 020 untested at runtime. |
| Focus 10 s | Reached | PERF-016; completion hung (PERF-003), single run |
| Deep Prime / Deep Focus | Not tested |  |
| Visualize | Partial | setup screen measured; Begin not pressed (possible paid generation). PERF-021, 022 untested. |
| Release / Evolve | Not tested | destructive-adjacent; only the menu was viewed |
| Settings/Profile, Notifications | Reached |  |
| Share Studio open | Reached | no export performed |
| Background/foreground during a session | Partial | HOME then reopen on the stuck Focus completion screen only; PERF-010 untested |
| Audio bleed / double start | Partial | after Focus all app `AudioTrack`s `stopped`; no double start; not exercised across Visualize |
| Auth, onboarding, paywall, purchase/restore | Not tested | would need credentials/purchase; PERF-001, 011, 037 untested |
| Guest path | Not tested | PERF-001, 006 untested |
| Offline/reconnect | Not tested | PERF-005, 036 untested |
| Memory loops for Vision, Visualize, Chart, creation | Not tested | PERF-025 growth source not isolated |
| Back gesture/hardware back | Not tested | dev note: `input keyevent 4` exits the app; in-app back buttons were used |

## 3. Stress conditions

| Condition | Done | Not done |
|---|---|---|
| Repeated navigation | 15x Home<->Details; 5 rapid taps | Rapid tap on other hero routes; interrupted transitions; back during flight |
| Long session | ~25 min mixed use | Multiple consecutive practice sessions; repeated Vision generation; repeated image uploads; repeated audio playback |
| Interruptions | HOME and reopen once | Incoming call, other media, headphone unplug, Bluetooth off, low memory kill, airplane mode |
| Aggressive input | rapid taps on the hero | rapid sheet open/close, Sound toggling, mid-seal back, double Release |

## 4. Validation required before release, by issue

| Needs | Items | Why it cannot be settled by code review |
|---|---|---|
| S24 release build (EAS non-debug) | PERF-002, 003, 012, 013, 014, 015, 016, 017, 025, 050 and every Phase 2 item | dev mode inflates JS stalls and frame times; release may retire or confirm each |
| Physical Android, release, hardware matrix | PERF-010, 041, 042, 043, 044, 045, 048, 066 | native auto-resume, audio focus, route changes, haptic queueing |
| Physical Android, guest and fresh-install flows | PERF-001, 006, 008, 035, 077, 082 | deterministic in code but must be seen to be trusted; data-loss class |
| Throttled/blackholed network on device | PERF-005, 033, 034, 040, 030 | timeout behaviour of OkHttp/fetch/axios |
| Mid-range Android (e.g. Galaxy A-series) release | PERF-012, 016, 017, 019, 020, 022, 025 | per-frame costs and memory show up first on weaker GPUs/RAM |
| iPhone (physical) + Xcode Instruments | every transition/Skia item; PERF-068 (silent switch), 013, 014, 021, 022 | zero iOS coverage so far; iOS differs in decode, audio session, haptics |
| Perfetto/Instruments traces | PERF-012, 016, 017, 019, 020, 054 | attribution of the 400 ms stall, the per-frame bitmap upload, GPU cost |
| Unplugged soak (thermal/battery) | PERF-019, 020, 022, 051 | sustained animation cost and thermal throttling |
| Reduce Motion on, every changed screen | PERF-024 and all Phase 2 items | accessibility must be shown, not assumed |
| Listening tests | PERF-048, 063, 072 | tail fades, cut-offs and loop gaps are perceptual |

## 5. Baseline table to fill in Phase 0

| Scenario | Build | Refresh | Frames | Janky % | p50/p95/p99 ms | Skipped >= 10 | JS stalls > 100 ms | PSS/graphics | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Cold start to Home interactive | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Hot start | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Home carousel | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Home to Details x30 | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Details scroll | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Details sheet drag | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Progress | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Vision board scroll/recompose | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Chart open/idle | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Focus 10 s | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Deep Focus 2 min | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Visualize 1 min | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Release hold (staging account) | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Share Studio | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| Settings | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |
| 20-cycle memory loop per flow | release | 120 adaptive / 60 forced |  |  |  |  |  |  |  |

Existing artifacts: the dev-build numbers in `raw/agent-E-runtime-qa.md` are the only figures; they are not a baseline for acceptance.

## 6. Remediation pass 2 infrastructure recheck (2026-10-12)

**New release measurements: none.** Luna rechecked the available infrastructure without interacting with the owner's app or reading device/user content. `C:\Users\dwill\AppData\Local\Android\Sdk\platform-tools\adb.exe devices -l` returned an empty device list. This Windows host has no Xcode/Instruments access. Host `perfetto`, `trace_processor`, and `simpleperf` commands were not found; device-side Perfetto availability cannot be determined without a connected target. Android SDK/emulator images, Java 17, Node 24, EAS CLI 18.11.0, and the cached Gradle 8.14.3 wrapper are present.

The only Android binary found under `anchor/mobile` is `android/app/build/outputs/apk/debug/app-debug.apk`. `aapt dump badging` identifies `com.anchorintentions.app`, version 2.0.0 / versionCode 39; `aapt dump xmltree` confirms `android:debuggable=true`. No release APK/AAB output was found there. Current source runtimeVersion is `2.0`. EAS `preview` is an internal staging APK profile with a production API endpoint and `EXPO_PUBLIC_SFX_DEBUG=1`; an identified release artifact with instrumentation disabled is needed for representative numbers. `playstore`/`production` produce AABs. Configuration evidence: [eas.json](../../anchor/mobile/eas.json), [app.json](../../anchor/mobile/app.json), [app/build.gradle](../../anchor/mobile/android/app/build.gradle), and [gradle.properties](../../anchor/mobile/android/gradle.properties).

`gradlew.bat --version` succeeded. A non-networking release configuration check (`:app:bundleRelease --dry-run --offline --no-daemon`, Sentry upload disabled) produced no task graph/result after more than 50 seconds and was terminated; this does not establish a build failure or confirm the older MAX_PATH diagnosis. No release build was completed. Local release signing is configured with the debug keystore, so a local release-variant artifact would still need its signing provenance recorded. No cloud build or publication was started.

The existing blank baseline table remains blank. Required next infrastructure is a dedicated test device or isolated emulator, a production-like release binary tied to its source revision, and isolated test data/account. Same-package installation is appropriate on that isolated target. Android hardware, a mid-range device, and a physical iPhone with a Mac/Instruments are still needed for the matrix's hardware acceptance.

On that isolated target, record artifact SHA-256, package/version/runtime, `debuggable=false`, minified Hermes release JS, OS, refresh mode, power/thermal conditions, fixture size, and backend environment. Measure launch using `am start -W` alongside actual Home-interactive readiness; launch activity timing alone is insufficient. Reset and collect `gfxinfo ... framestats` per fixed scenario, collect numeric `meminfo`, and capture a matching Perfetto trace. Repeat the existing Home/Details, Focus entrance/completion, Deep Prime, Vision, Chart, and audio-interruption scenarios after warm-up; keep forward/reverse transitions distinct and report repetitions and percentiles. Retain sanitized numeric evidence only. Do not clear or mutate the owner's account, install over the owner's app, or relabel the prior DEBUG/Metro observations as release baselines.

## 7. Automated implementation validation (2026-10-12)

The final approved PERF-001/082 source passed 5 focused suites / 81 tests, TypeScript, and diff hygiene. Parent independently reran the final focused suite and typecheck. Full Jest completed with 520 passing / 13 failing suites and 5,128 passing / 27 failing tests, plus one existing skipped test; all 27 failing assertions reproduced in the controlled pre-fix auth-store comparison described in plan section 9. The suite is not globally green.

A final local Android production JS/Hermes export passed with V2 enabled, `EXPO_PUBLIC_APP_ENV=production`, SFX diagnostics disabled, and `CI=1`: `%TEMP%\anchor-perf-remediation-20261012\android-production-export-final\_expo\static\js\android\index-9827ef6ba8371eb218f48e9acbe6d442.hbc` (17.3 MB). This is a JavaScript/assets packaging check, **not** a built native release APK, an install, a device observation, or a performance baseline. Nothing was published. The baseline table and physical-device guest/auth/startup/audio acceptance remain open.

## 8. Earlier release-baseline preparation snapshot (2026-10-12)

This dated record supersedes section 6's infrastructure snapshot without changing its historical observations. Source fix commit `9a158b7d3efeab62e42b6d8f8f01d8b45edb3caa`; current branch HEAD `6911321cdf7ee32c9e40346d307dbd44823a34e6` adds only mounted-App tests. Current focused validation: **7 suites / 88 tests passed**, TypeScript exit 0. The documented broader subset is **1 passing / 12 failing suites, 251 passing / 26 failing tests**; it is not a fresh full-suite run. PERF-001/082 still need native guest, relaunch, interrupted-onboarding, recovery, and account-transition validation.

| Infrastructure | Current verified preparation evidence |
|---|---|
| Physical Android connection | Wireless ADB identifies Galaxy S24 Ultra `SM-S928U1`, Android 16 / API 36, arm64-v8a. Owner authorized using the connected phone; its existing `com.anchorintentions.app` installation is protected. |
| OS build | `samsung/e3quew/e3q:16/BP4A.251205.006/S928U1UES6DZH3:user/release-keys`. |
| Display capability | Built-in 1440 x 3120 panel exposes 120/80/60/48/30/24/10 Hz modes. Read-only preparation snapshot was screen OFF, active mode 3 / 60 Hz; this is not a scenario refresh measurement or a forced-mode test. No display settings changed. |
| Device profiler | `/system/bin/perfetto` exists; local help confirms bounded background trace support. No product trace has yet been captured. |
| Host trace analysis | Official `trace_processor` wrapper downloaded to `%TEMP%\anchor-perf-release-20261012\tools\trace_processor.py`; its checksum-verified Windows binary reports **Perfetto v58.2-add693d8b**, RPC API 14. This resolves the previous host-tool absence. [Official download/use guidance](https://perfetto.dev/docs/reference/trace-processor-cli). |
| Local native toolchain | Java 17.0.17, Gradle wrapper 8.14.3, Android SDK/build tools 36.0.0, NDK 27.1.12297006; existing Expo/RN/Reanimated versions retained. |
| Emulators | Existing `Medium_Phone_API_36.1` and `Vision_QA` AVDs inventoried; no emulator measurements established. |
| Candidate isolation | Ordinary release built in `E:\apc\src`; diagnostic copy `E:\apd\src`. Initial `com.anchorintentions.perfbaseline` / `anchor-perfbaseline` was installed fresh for user 0 and subsequently user-touched, so it is now protected. Further testing uses new `com.anchorintentions.perflab20261012` / `anchor-perflab20261012`. Namespace/component classes remain `com.anchorintentions.app`; application IDs/data sandboxes differ. |
| Safety configuration deviations | Production-mode V2 JS, Hermes/Fabric and release minification/shrink are requested; API directed to unused loopback `127.0.0.1:39999`, OTA disabled, telemetry/RevenueCat credentials blank, Firebase collection and messaging auto-init disabled. Native `profileable` access is enabled. Firebase package-name shim enables Gradle matching only, not a valid isolated OAuth/auth registration. No paid build or backend account created. |

Reusable capture and fixture preparation is in `harness/`. Senior preflight verified zero-ADB dry run, owner-package refusal, duration bounds, and deterministic synthetic fixture counts: 1 Anchor / 10,000 ASCII characters and bytes / 6 modeled chunks; 72 Anchors / 719,217 characters and bytes / 400 modeled chunks. These are fixture arithmetic, **not native storage measurements**. `analyze-framestats.py` reports retained ring percentiles separately from platform aggregate counters; neither ring summaries nor activity launch timing alone establish Home-interactive timing, JS/UI causality, or complete scenario frame coverage. The ordinary candidate build remains distinct from the diagnostic storage build.

Native ordinary artifact and installed configuration are verified below; scenario captures and pass/fail outcomes are added only after verification. Blank release rows above remain blank until measured. No owner app data, account, private screenshots, notifications, or production backend records were read or reset in preparation.

| Current native evidence | Verified result / limit |
|---|---|
| Ordinary release APK | `E:\apc\src\android\app\build\outputs\apk\release\app-release.apk`; 298,060,294 bytes; SHA-256 `AEA29C04A00ACCF2A25F7BCD089F531B7C62DAD2502D0C13056BF1CAEB2BAA28`; four ABIs; version 2.0.0(39), runtime 2.0. |
| Runtime configuration | Non-debuggable installed release, production Hermes v96, V2/Fabric, minify/shrink; profiling enabled. API loopback, OTA disabled/NEVER/no URL, telemetry/purchase credentials blank. Diagnostic signing only. Exact deviation ledger: `E:\apc\record`. |
| First physical launch | S24 Ultra Android 16: one cold `am start -W`, TotalTime 1,047 ms / WaitTime 1,054 ms. Activity first draw only; Home-interactive readiness and ten-launch distribution unverified. No emulator numbers substituted. |
| Display metadata | 1440x3120 panel; modes include 120/80/60/48/30/24/10 Hz. Preparation reported 60 Hz with screen off; this is not a scenario's observed refresh rate. No display settings changed. |
| Protected packages | Owner `com.anchorintentions.app` and user-touched `com.anchorintentions.perfbaseline`; no fixture, clear, uninstall, replace or force-stop operations allowed on them in further testing. Fresh lab uses user 0 and separate identity. |
| Archived diagnostic v2 | `E:\apd\record\archive\perfbaseline-v2-url-control.apk`, SHA-256 `41DEBFD3F4E0D47CC72F46AFE0FE7B3AABECF5F8E826B1A6C295DDC05516FB76`; arm64, not installed. Prior v1 APK was overwritten before archiving; only historical hash survives. |
| Build corrections | Same-drive short path, Kotlin incremental off, matching isolated Google Services config, 2,560 MB Gradle heap, ten byte-identical Android MP3 resource aliases in build copies only. No framework upgrades. |
| Fixture gate | Parent 13/13 harness tests pass with stubbed storage. 1/72-Anchor fixture counts and modeled 6/400 chunks are prepared; actual storage latency and native data-safety outcomes remain unmeasured. |

## 9. V4 dual-ABI release and fresh AVD validation (2026-10-12)

At the time of sections 9–11, those results superseded section 8 only for the emulator scenarios; physical phone checks were still pending then. The later Physical V4 continuation below records the specific phone scenarios completed since.

This section adds the current V4 diagnostic artifact and emulator functional evidence. The original DEBUG figures and unfilled frame-baseline table above remain historical; no frame-time or motion baseline is inferred from functional passes or diagnostic events.

| V4 candidate field | Verified value / limit |
|---|---|
| Artifact | `E:\apd\record\archive\anchor-perflab20261012-v4-auth-emulator-dualabi.apk`; 245,152,933 bytes; SHA-256 `EFF1898E0D0B6E532960AD040D416EF2534DADDC2D435B2FBCDB2C2D8DEAA605`. |
| Identity / native targets | `com.anchorintentions.perflab20261012`, label `Anchor PERF LAB`, scheme `anchor-perflab20261012`; arm64-v8a and x86_64; version 2.0.0 / versionCode 39; compile SDK 36, target 35, min SDK 24. Gradle namespace and component class names remain `com.anchorintentions.app`. |
| Release/runtime flags | Release APK with `android:debuggable` absent, profileable shell enabled, Hermes bytecode v96, V2 enabled. OTA is disabled, check-on-launch `NEVER`, and update URL absent. APK v2 signature verified with the local Android debug certificate; this is not a distribution-signed package. |
| Diagnostic network/auth isolation | API is fixed to `http://127.0.0.1:39999`; Firebase resources resolve to demo project `demo-anchor-perf` with a fake API key and zero OAuth clients; Firebase collection and messaging auto-init are disabled. Google sign-in is disabled and production OAuth fallback identifiers are absent from the bundle. Cleartext is allowed only for `localhost`, `127.0.0.1`, and `10.0.2.2`, with base cleartext denied. OTA publication, telemetry and purchase credentials are disabled/blank. These are isolated diagnostic safety deviations, not production configuration. |
| Build provenance | Local Gradle release build, 12m33s; 1,277 actionable tasks (99 executed / 1,178 up-to-date); no EAS/cloud build. V4 inputs and verification are recorded in `E:\apd\record\final-v4-build-provenance.json` and `E:\apd\record\verify\v4-verification-summary.json`. |
| Fresh AVD | `Anchor_PERF_LAB_20261012`, serial `emulator-5564`, Android 16 / API 36 / x86_64, fresh userdata under `E:\anchor-perf-emu-20261012`; headless software graphics and `-no-audio`. Every command targeted this AVD. It is separate from the protected phone installation and existing AVD user data. |
| Ordinary release incomplete-onboarding recovery | On the fresh AVD, ordinary four-ABI baseline cold start rendered welcome/bridge. After Get started, the scenario stopped partway through the bridge, force-closed the app, and relaunched; it resumed the same bridge without a recovery surface: **PASS once**. First activity draw was 11,140 ms / WaitTime 11,153 ms; relaunch draw was 6,400 ms / WaitTime 6,553 ms. These are single emulator activity timings, not Home-ready timings, a distribution, or a device performance comparison. |
| V4 guest creation/save | V4 completed the guest create-and-save path through the real UI on the x86_64 AVD using a fixed loopback-served synthetic image. The image is a deterministic test fixture; this validates a reachable flow/save path, **not image quality, art direction, generated-image fidelity, or production image delivery**. The free configuration remained in place: no Pro entitlement was granted and no Pro gate was bypassed. A 10-second Focus begin opened the Pro paywall; no session or purchase followed. Other premium flows and purchases remain untested. |
| Guest save retention | An interim checkpoint recorded **6/10**. Parent subsequently confirmed **10/10 cold relaunch retention checks PASS** on V4. Each relaunch reported exactly one Anchor, retained the UI-created Career Anchor artwork, and returned without first-run or recovery UI. The guest Anchor was created and sealed through the full UI, saved without an account, and reached Home; no production account was involved. |
| V4 cold relaunch observations | Fresh x86_64 AVD, ten consecutive cold relaunches after saving one guest Anchor. Activity first-draw times (ms), runs 1–10: **4,536; 2,658; 2,711; 3,115; 2,635; 2,804; 2,547; 3,580; 2,937; 2,823**. Anchor hydration times (ms), runs 1–10: **244; 136; 238; 235; 219; 194; 162; 209; 217; 246**. This actual UI-created SecureStore vault was **1,434 characters**, not the 10,000-character synthetic benchmark fixture. These are emulator observations from this single test sequence, not phone results or a broad performance baseline. |
| V4 JS event-loop diagnostic | Runtime emitted the fixed-name numeric `js-loop-histogram` event. This confirms the release diagnostic is active; no frame timeline, full scenario motion distribution, or jank acceptance is claimed from that event alone. |
| Physical phone (at the emulator-only V4 checkpoint) | The phone was still locked during these emulator checks. The later Physical V4 continuation below supersedes this for phone guest-retention and interaction results. The owner app and user-touched `com.anchorintentions.perfbaseline` package remain protected. |

## 10. V4 Home/Details, frame trace, and storage diagnostics (2026-10-12)

These are additional diagnostic results from the same isolated V4 x86_64 AVD and synthetic guest data. They do not replace historical S24 observations or establish phone performance, motion parity, or causal attribution. The fresh AVD was software-rendered at 1080 x 2400 and 60 Hz. UI automation overhead is present in the interaction checks; do not treat these timings as human-input or device-pacing acceptance.

| Scenario | Result / boundary |
|---|---|
| Home → Details → Home | **30/30 real-UI checks complete** with the retained UI-created 1,434-character guest vault. This is emulator functional coverage; UI automation overhead applies. |
| Perfetto/frame summary | 35-second trace covered cycles 4–6 only. The 120-frame retained ring reported p50/p95/p99 **58.338 / 136.277 / 187.178 ms**, max **194.266 ms**. Separate platform counters reported 198 total frames, 112 janky (**56.57%**), 35 missed-vsync, and 12 slow-bitmap frames. PSS was **286,106 KB**. The ring and platform counters have different populations; neither identifies a cause, and this partial software-emulator trace is not phone or full-scenario acceptance. |
| Synthetic 72-Anchor storage seed | The 719,217-character / 400-chunk fixture completed; 3,698 native SecureStore calls, zero failures, zero fallbacks. Seed SecureStore write **10.516 s**, `setItem` helper settlement **11.299 s**, and rehydrate **4.651 s**. These are diagnostic fixture-path measurements, not user-data results. |
| Cold storage comparisons | Normal cold 1-Anchor / 10,000-character run: read **279 ms**, hydrate **299 ms**, activity draw **2,339 ms**. Normal cold 72-Anchor run: read **5,724 ms**, hydrate **5,746 ms**, activity draw **2,177 ms**. Instrumented-measure startup hydration was **7,657 ms** with no recovery surface. These are separate emulator runs; instrumentation and scheduling mean they should not be interpreted as a direct performance comparison. |
| SecureStore contention | Three controlled bulk-write trials: native write **12,296 / 11,399 / 11,733 ms**; isolated auth controls **224 / 52 / 58 ms**; auth operations overlapped with bulk write **12,222 / 11,335 / 11,660 ms**. This supports only the observed isolated local fixture behavior; it does not establish backend/auth account behavior or general device causality. |
| Remaining scenarios | Other premium-gated flows, full audio/listening, lifecycle interruptions, and haptics remain untested. The separate 20-swipe carousel run later completed; see section 11. |

## 11. V4 carousel and isolated account-boundary checks (2026-10-12)

These additional checks used only the isolated V4 x86_64 software emulator and local synthetic services. They do not validate the canonical backend, account ownership migration, premium entitlement, or physical-device behavior.

| Scenario | Result / boundary |
|---|---|
| Home carousel | **20/20 real-UI swipe checks PASS**, selected index 2 → 22. UI automation was used. A separate 35-second `carousel-02` trace reported 1,049 platform frames, 628 janky (**59.87%**), 221 missed-vsync, and 64 slow uploads. Its retained 120-frame ring had p95/p99 **92.856 / 196.583 ms**, max **218.685 ms**. The trace is partial emulator evidence; automation overhead applies and no cause or physical-device motion acceptance is inferred. |
| Storage during carousel trace | The 719,217-character / 400-chunk synthetic vault was present. Two in-trace storage-write spans measured **14.076 s** and **15.963 s**, with zero failures. Later, 21 settled numeric bulk-write completions ranged **12.191–59.471 s** across a wider capture window; they do not map one-to-one to the 20 swipe gestures. These are fixture diagnostics, not production-user storage timings. |
| Isolated demo email A | Native email sign-in to the local demo Auth succeeded on the free profile. A cold return retained the 72-Anchor vault and selected index 22; hydration was **5,854 ms**, activity draw **2,932 ms**. The seeded user ID was already A, so this does not verify guest-data ownership transfer or a production account transition. |
| Isolated demo email B | After intentional UI sign-out reached an empty Home, native email B sign-in produced a profile verified as Free with no A Anchors visible. This is isolated demo-project behavior only; no production backend or ownership transfer was involved. |
| Premium gate | A real 10-second Focus begin opened the Pro paywall; no Focus session began and no purchase occurred. No entitlement was granted or premium gate bypassed. |
| Home lifecycle | A 3-second Home background/foreground round-trip passed; the hot return observation was **160 ms**. The emulator ran with `-no-audio`; this does not test playback resume, interruptions, or audio focus. |
| Still pending at this emulator-only checkpoint | Physical-device and iOS scenario checks, fault-injection coverage, canonical-backend/account migration, full audio/listening, lifecycle interruption behavior, haptics, and other premium flows were still unverified at this point in the chronology. See the later Physical V4 continuation below for the phone scenarios subsequently completed; the remaining limits are unchanged. |

## Physical V4 continuation — 2026-10-12

This dated update supersedes the earlier phone-locked testing gaps; it does not replace the original DEBUG audit or the separate emulator results. All physical interaction and storage checks used the isolated `com.anchorintentions.perflab20261012` package and synthetic records. The owner app and user-touched `com.anchorintentions.perfbaseline` package remained protected.

| Physical V4 check | Verified result and limit |
|---|---|
| Guest creation and retention | Full guest create/save through UI, then **10/10 cold relaunches PASS** on the S24 Ultra (Android 16/API 36, arm64, adaptive display around 120 Hz). One synthetic Anchor and its UI-created artwork remained; no first-run or recovery screen appeared. Activity first-draw median 559 ms (range 527–616); hydration 57–72 ms. One interrupted onboarding bridge state also resumed after relaunch. These are one device's checks, not a device matrix. |
| Home–Details–Home | **30/30 UI-automated cycles PASS** on the physical phone. This is functional route coverage; UI automation overhead applies. The bounded phone Perfetto captures are partial windows and do not represent all 30 cycles or establish a full frame-time distribution or cause. |
| Home carousel | **20/20 UI-automated phone swipes PASS**, with selection moving from index 1 to 21, as recorded in `phone-carousel-summary.jsonl`. This is functional interaction coverage, not a full motion-performance distribution. The separate emulator series in section 11 remains index 2→22. |
| Earlier single 72-Anchor cold run | One prior measurement read in **2,430 ms** and hydrated in **2,438 ms**; it remains a single-run observation, separate from the ten-run series below. |
| Additional 72-Anchor cold series | Ten declared cold runs, `phone-v4-72-cold02.jsonl` through `phone-v4-72-cold11.jsonl`, each read the full synthetic 719,217-character / 400-chunk vault. SecureStore read: **1,962–2,468 ms, median 2,423 ms**. Anchor hydration: **1,969–2,476 ms, median 2,430.5 ms**. Activity first draw: **505–611 ms, median 595.5 ms**. All ten reported 72 hydrated Anchors and zero native read failures. `cold01` is retained as an incomplete attempt that failed before its UI assertion and is excluded from this series. |
| Native bulk write and auth contention | Three physical native bulk writes took **8,235 / 7,170 / 6,403 ms**. Overlapping auth-adapter writes took **8,172 / 7,134 / 6,369 ms**, versus **37–131 ms** same-device controls. The full synthetic JSON readback matched; the run reported **3,683 native calls, zero failures, zero fallbacks**. This is controlled local SecureStore interference evidence, not proof of a Focus hang or navigation-frame cause. |
| V5 artifact and install | Built and installed only on the synthetic S24 PERF LAB package. `E:\apd\record\archive\anchor-perflab20261012-v5-startup-motion-dualabi.apk`, **245,172,537 bytes**, SHA-256 `1702C59554888A30CFAB4AB808467315096484E04928CB1B275C5BCD8DD0A2F7`; arm64-v8a/x86_64, non-debuggable/profileable release, Hermes v96/V2, OTA disabled, diagnostic demo Auth and loopback API. Same isolated diagnostic signer as V4; owner and old user-touched packages were not updated. |
| Auth Emulator and Account C gate | Numeric `auth-emulator-route { okCode: 1 }` verified the intended route. Normal UI sign-in to synthetic C succeeded and the unchanged local PRO gate showed the comped profile. This is not production entitlement, billing, or backend acceptance. |
| Home after C sign-in | **Blocked by fixture coverage.** Home displayed “Unable to load your Anchors”; the loopback fixture has no GET `/api/anchors` or `/api/auth/me/export` routes (404). The 72-Anchor/index-21 guest vault was verified before C sign-in only. No post-C retention, ownership transfer, data loss, or canonical account behavior is claimed. |
| Remaining V5/native scenarios | No Focus session, Deep Prime, Visualize, Vision/Chart interaction, native startup-fault/recovery acceptance, or active-audio/background continuity was completed. The source harness passed 60/60 tests and TypeScript; separate consumer tests passed 5/5. Those checks do not substitute for native runtime acceptance. |
| Evidence | Phone UI summaries: `%TEMP%\anchor-perf-release-20261012\phone-guest-validation-summary.jsonl` (10/10), `%TEMP%\anchor-perf-release-20261012\phone-home-details-summary.jsonl` (30/30), `%TEMP%\anchor-perf-release-20261012\phone-carousel-summary.jsonl` (20/20; index 1→21), and `%TEMP%\anchor-perf-release-20261012\phone-72-cold-summary.jsonl` (repetitions 2–11). Cold event files are `%TEMP%\anchor-perf-release-20261012\numeric\phone-v4-72-cold02.jsonl` through `phone-v4-72-cold11.jsonl`; excluded incomplete attempt is `phone-v4-72-cold01.jsonl`. Earlier single 72-Anchor run: `%TEMP%\anchor-perf-release-20261012\numeric\phone-v4-large-cold01.jsonl`. Storage contention events: `%TEMP%\anchor-perf-release-20261012\numeric\phone-v4-adapter-check02.jsonl`. Sanitized trace summaries are `%TEMP%\anchor-perf-release-20261012\summaries\phone-carousel-adaptive-native-v4-01.numeric-summary.md`, `%TEMP%\anchor-perf-release-20261012\summaries\phone-home-details-60-actual-native-v4-01.numeric-summary.md`, and `%TEMP%\anchor-perf-release-20261012\summaries\phone-home-details-72-adaptive-native-v4-01.numeric-summary.md`. Home/Details and carousel trace bundles with identity sidecars are under `docs\performance-audit-2026-10\harness\captures\6164622d5235435831324b424e47522d57516b50764a2e5f6164622d746c732d636f6e6e6563742e5f746370\`; separate phone seed/adapter captures are under `%TEMP%\anchor-perf-release-20261012\captures\6164622d5235435831324b424e47522d57516b50764a2e5f6164622d746c732d636f6e6e6563742e5f746370\phone-vault-seed-large` and `phone-adapter-contention`. Share numeric summaries, not raw traces. |

The local demo C comped profile remains an isolated test setup; it does not establish production billing or entitlement. Its Pro gate passed, but no Focus session was started. Production ownership/sync, post-C retention, full native fault/recovery, audio/interruption/haptics, iOS, and mid-range Android acceptance remain open. No migration, animation changes, production backend writes, OTA, or publication occurred.

## 12. Canonical fixture completion and data-integrity validation pass (2026-10-12)

| Validation item | Measured outcome / boundary |
|---|---|
| Canonical fixture routes (`fixture-api.cjs`, `test-fixture.cjs`) | Implemented RAM-only `GET /api/auth/me`, `GET /api/anchors`, `GET /api/auth/me/export`, `POST /api/anchors`, `PUT /api/anchors/:id`, `POST /api/anchors/:id/charge`, `POST /api/anchors/:id/activate`, `PUT /api/auth/onboarding-context`, and `PUT /api/auth/notification-state` matching production backend response contracts. Validated with `demo-anchor-perf` Auth Emulator (`127.0.0.1:9099`, `firebase-tools@15.33.0`): `test-fixture.cjs` (primary free A), `test-fixture.cjs --secondary` (free B), and `test-fixture.cjs --comped` (comped C) all **PASS (exit 0)**. Emulator stopped and TEMP credentials deleted after run. |
| Data-integrity & restriction Jest suites (`anchor/mobile`) | **16/16 suites, 228/228 tests PASS**; `npx tsc --noEmit --pretty false` **exit 0**. Covers returning authenticated user hydration, authorized guest-to-account transfer (`pendingFirstAnchorDraft`), unmigrated guest Anchor isolation on user switch, unsynced Anchor survival across login/hydration, `/api/anchors` failure preservation, equal/missing/newer `updatedAt` preservation, authoritative server deletion/Release (`burnedAnchors` / `isReleased`), overlapping hydration race protection (`latestHydrationId`), repeated hydration idempotency, mid-hydration restart recovery, and free/comped/premium gate enforcement (`CREATE_ANCHOR_FREE_LOCKED`). |
| Physical S24 Ultra status | **Blocked by hardware disconnection.** `adb devices -l` showed only `emulator-5564` connected; the physical Galaxy S24 Ultra (`SM-S928U1`) was not attached. Physical release verification of the updated `AuthHydrationService` and canonical fixture routes on the S24 Ultra must be run once the device is reconnected before closing the physical data-integrity gate. |


## Senior data-safety review — 2026-10-13

**Account-transition safety remains OPEN.** Independent review reproduced durable loss of an unsynced Account A Anchor after a direct A→B→A switch in four isolated persistence cases, plus a delayed older write overwriting a newer vault state. Account isolation through filtering is not durable data preservation. Missing timestamp convergence and malformed duplicate backend-ID safety assertions also remain red. Targeted corrections to request/account fencing, first-Anchor retry/progress and onboarding deletion pass **10 suites / 252 tests**; this does not close the retention gate. See `PERFORMANCE_REMEDIATION_PLAN.md`, “Senior data-safety review continuation — 2026-10-13”, for findings, exact changes, active failing gates and the unimplemented storage proposal. Prior audit measurements and issue IDs remain unchanged. Native and TypeScript outcomes appear in its final checkpoint. No production database access, deployment, migration or premium visual/audio changes occurred.

Final checkpoint: TypeScript **exit 0**; synthetic A/B/C fixture tests and owner-bound idempotency replay checks pass. Physical SM-S928U1 and emulator-5564 were connected, but the current-source isolated build failed after **11m54s** at R8 with a Java heap out-of-memory error after JS/resource/Kotlin success. **No current APK was installed; no physical or Android emulator runtime acceptance is claimed.** The older Oct-12 APK was rejected as stale. Owned fixture processes and credentials were cleaned up; owner/device data remained untouched. The data-safety gate remains **NO / OPEN**, with seven active failing safety assertions.

## Account-scoped persistence repair checkpoint — 2026-10-13

The bounded repair is implemented and uncommitted. It retains durable owner partitions beneath the UI array, preserves the legacy source, publishes verified immutable SecureStore generations, fences foreign late updates, and retains account-bound guest draft/mutation progress. No SQLCipher/native dependency/runtime change, OTA, subscription/motion/audio change, or legacy vault deletion is included. The user's reported startup recovery loop also exposed a reproducible timeout latch: successful local restoration after ten seconds now dismisses that timeout screen; actual storage/ownership recovery failures stay closed.

**Source results:** the seven original assertions were rerun red before editing. Four account-retention variants, stale native write ordering, and duplicate backend-ID collapse now pass unchanged. Missing-timestamp convergence remains failing because accepting server writing without evidence of synchronization can discard unknown-timestamp local edits; the existing preservation regression remains green. Focused regression checkpoint: **14 suites / 296 tests PASS**. Final App recovery check: **4/4 PASS**. Storage/partition gates: **14/14 PASS**; real-adapter tests with mocked native storage: **5/5 PASS**. Final TypeScript is clean. Original gate files were not edited. Fixtures with wildcard owners/unauthorized cross-account migration were corrected to explicit synthetic ownership and stronger durable-isolation assertions.

**Readiness remains OPEN:** Account A -> B -> loss of process memory -> offline A retention and exclusion from B are verified in synthetic automated tests for explicitly owned committed records, not yet certified in the native app. Original SecureStore/AsyncStorage sources remain recoverable through interrupted conversion in synthetic tests. Ambiguous ownership is preserved for explicit recovery, never assigned to the next login. This is not permission to begin SQLCipher or animation remediation.

See [ACCOUNT_SCOPED_PERSISTENCE_REPAIR.md](ACCOUNT_SCOPED_PERSISTENCE_REPAIR.md) for root cause, exact changed files, the partition/commit design, regression commands/evidence, limitations, reported-phone restoration boundary, and final native checkpoint. The normal phone package was not installed, cleared, or its vault extracted. Isolated native-build evidence is in `E:\apd\record\gradle-account-repair-4096m.log` and `account-repair-*.json`; the final native result is recorded below.


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
