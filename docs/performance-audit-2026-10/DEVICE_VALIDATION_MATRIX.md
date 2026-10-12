# Device Validation Matrix

Date: 2026-10-12. This states honestly what was and was not tested. **Nothing here is production performance data.** Raw evidence: `raw/agent-E-runtime-qa.md`.

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
