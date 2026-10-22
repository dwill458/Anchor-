# Agent E - Runtime QA (Galaxy S24 Ultra), 2026-10-12

ALL NUMBERS BELOW ARE FROM A DEBUG / DEV-CLIENT BUILD RUNNING A DEV-MODE JS BUNDLE FROM METRO. They are NOT production numbers. Relative findings (what is slow vs. what is not, queue behaviour, leaks, stuck states) are informative; absolute frame times and JS stall times are inflated by dev mode (no minify, __DEV__ warnings, Reanimated/RN dev checks, PERF logger, JS stall detector).

Scratch artifacts (screenshots, logcat dumps, gfxinfo, screen recording, ui dumps):
`C:\Users\dwill\AppData\Local\Temp\claude\C--Users-dwill--gemini-antigravity-scratch-Anchor\c19a1dc3-6c1c-4602-8a43-c38bf81fafaa\scratchpad\runtime\` (note: some screenshots/recordings contain the user's personal photos and a private notification; do not share).

## 1. Environment and build facts

| Item | Value | How determined |
|---|---|---|
| Device | SM-S928U1, Android 16, adb R5CX12KBNGR, arm64-v8a | adb |
| App | com.anchorintentions.app 2.0.0 versionCode 39, flags `DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA` | `dumpsys package` |
| Build type | Debug dev client (expo-dev-launcher; cold start lands in `DevLauncherActivity`, "Development Build") | screenshot + logcat `Displayed ...DevLauncherActivity` |
| Metro | RUNNING on host :8081 (`curl /status` = `packager-status:running`, node pid 27164), `adb reverse tcp:8081` active | curl, netstat, `adb reverse --list` |
| JS bundle | DEV (logcat `ReactHost.loadJSBundleFromMetro()`; `[PERF]` logger and `VisualProfiler` logs are `__DEV__`-gated and are emitting; `js-stall` detector active) | logcat, perfDiagnostics.ts |
| Engine / arch | Hermes (RN bridgeless, `fabric:true` in `Running "main"`); could not read /proc maps (permission) so Hermes is inferred from bridgeless/Fabric RN | logcat |
| Refresh rate | Panel active mode 120 Hz (modes 120/80/60/48/30/24/10). Samsung adaptive; user pref mode id 1. Touch boost hint "category=high" seen in logcat | `dumpsys SurfaceFlinger`, `dumpsys display` |
| Power | USB powered/charging the whole session (battery 34% at 01:30 to 41% at end), so thermal/battery-drain numbers are not representative of unplugged use | `dumpsys battery` |
| Thermal start | Thermal Status 0, SKIN 37.6-37.8 C, AP 37.8-39.8 C, BAT ~33-36 C | `dumpsys thermalservice` |
| Thermal end | Thermal Status 1 (light), SKIN 40.4 C, AP 37.8-48.4 C (two samples), battery 36.7 C | same |
| Display brightness | 62 (system setting) | settings |
| Account | Real, logged-in Pro account with 72 local anchors, 175 practice history entries (from hydration logs). I made no purchases, no sign-in, no data clears |
| Baseline docs | `PERFORMANCE_BASELINE.md` is an empty TBD template (iPhone 8 / Galaxy A52); `DEVICE_PROFILING_GUIDE.md` says use a release build for profiling. Neither provides baselines to compare against | file read |

Release/profiling build needed for production-grade numbers (NOT done; no build/installs performed): an EAS build with a non-debug profile, e.g. `eas build --profile production --platform android` (or a `preview`/`profiling` profile with `buildType: apk` and `developmentClient: false`), installed on the S24 over USB, then repeat the scenarios below. Local Gradle is not an option (MAX_PATH, per project memory). Runtime coverage of production behaviour is therefore LIMITED.

## 2. Scenario coverage

| Scenario | Status | Notes |
|---|---|---|
| Cold launch | Partially | `am start -W` COLD TotalTime 855 ms, but that is only the dev launcher; app then needed a manual tap on `localhost:8081`. Tap to Home-visible about 38 s in dev (see E-01). Not a production cold-start number |
| Warm / hot launch | Reached | HOT TotalTime 105 ms / WaitTime 115 ms (HOME then `am start`) |
| Home initial render + idle | Reached | Idle 10 s: 1 frame (static) |
| Home carousel switching | Reached | slow swipes and fast flicks measured |
| Home to Details and back, rapid taps | Reached | 5 taps at 120 ms spacing produced a single navigation (debounced correctly) |
| 15x Home<->Details loop with meminfo | Reached | no leak growth |
| Progress | Reached | open + scroll |
| Vision board (open from Details, scroll) | Reached | Vision entrance/creation not entered (can trigger paid generation) |
| Chart | Blocked | this anchor has no Chart ("Create Chart" CTA only); creating one enters a creation flow with paid-AI risk. Not entered |
| Practice Focus (10 s) | Reached | one real 10 s session completed on the real account; completion screen hung (E-02) |
| Deep Prime | Not tested | not reached |
| Visualize (Glimpse/1 min) | Partially | setup screen reached and measured; "Begin Visualize" NOT pressed (possible backend/paid generation) |
| Release / Evolve entrance | Not tested | did not open More-options Release path (destructive-adjacent); only viewed menu items (Share/Download PNG/Wallpaper/Copy) |
| Settings / Profile, Notifications | Reached | |
| Share Studio | Reached | opened from Details more-menu; no export performed |
| Background/foreground during session | Partially | HOME then re-launch while stuck on the Focus completion screen: returned HOT in 105 ms, state unchanged (still stuck) |
| Audio bleed / double-start | Partially | after Focus: all app AudioTracks `state:stopped`, none started; ExoPlayer released at session end. No double-start seen in logcat. Not exercised across Visualize |
| Battery / thermal sustained | Limited | about 25 min of mixed use, USB-charging; thermal status 0 to 1 only |
| Perfetto / simpleperf | Not done | not attempted (no sustained jank scenario justified it in dev mode; trace_processor not verified) |
| Jest perf tests | Not run | focus was the device |

## 3. Raw measurements (dev build)

Method: `adb shell dumpsys gfxinfo com.anchorintentions.app reset`, drive input with `adb shell input tap/swipe`, then `dumpsys gfxinfo com.anchorintentions.app` and read the summary. Helper scripts used `uiautomator dump` to locate elements. gfxinfo percentiles are CPU frame-time (ms); "Janky" is the modern (deadline-based) count, "legacy" the older >16.7 ms count. Panel is 120 Hz so the deadline is about 8.3 ms to 11 ms in Samsung adaptive mode.

| Scenario | Frames | Janky (modern) | Janky (legacy) | p50 | p90 | p95 | p99 | Missed vsync | Slow UI | Slow bitmap upl. | Slow draw cmds | GPU p50/p99 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home idle 10 s | 1 | 1 | 0 | 8 | 8 | 8 | 8 | 0 | 0 | 0 | 1 | 5/5 |
| Home carousel 6 slow swipes | 890 | 57 (6.4%) | 250 (28.1%) | 9 | 17 | 24 | 109 | 9 | 55 | 29 | 13 | 3/9 |
| Home carousel 6 fast flicks | 526 | 27 (5.1%) | 95 (18.1%) | 7 | 13 | 21 | 109 | 5 | 23 | 10 | 3 | 3/8 |
| Home to Details (1 tap) | 92 | 9 (9.8%) | 18 | 7 | 16 | 36 | 250 | 3 | 8 | 4 | 4 | 3/11 |
| 15x Home<->Details loop (30 transitions) | 2786 | 213 (7.65%) | 539 (19.4%) | 8 | 16 | 23 | 250 | 76 | 191 | 79 | 84 | 3/11 |
| Rapid 5 taps on hero | 94 | 12 (12.8%) | 37 | 9 | 18 | 24 | 250 | 3 | 11 | 2 | 4 | 3/12 |
| Details scroll 3x up/down | 590 | 37 (6.3%) | 81 | 5 | 15 | 22 | 40 | 9 | 37 | 1 | 3 | 3/7 |
| Details to Vision board open | 162 | 22 (13.6%) | 28 | 9 | 20 | 26 | 150 | 3 | 6 | 7 | 19 | 5/9 |
| Vision board scroll 3x | 317 | 81 (25.6%) | 129 (40.7%) | 13 | 25 | 28 | 36 | 43 | 73 | 0 | 50 | 6/12 |
| Home to Progress | 59 | 8 (13.6%) | 16 | 6 | 24 | 44 | 250 | 1 | 7 | 2 | 3 | 3/11 |
| Progress scroll | 366 | 40 (10.9%) | 229 (62.6%) | 12 | 17 | 17 | 24 | 3 | 39 | 0 | 2 | 2/8 |
| Home scroll down | 146 | 23 (15.8%) | 38 | 9 | 19 | 21 | 26 | 4 | 20 | 1 | 1 | 4/8 |
| Home to Profile/Settings | 51 | 4 | 21 | 12 | 14 | 65 | 250 | 1 | 3 | 1 | 2 | 6/7 |
| Settings scroll | 124 | 19 (15.3%) | 42 | 9 | 12 | 15 | 22 | 1 | 18 | 0 | 3 | 2/8 |
| Settings to Notifications | 68 | 1 (1.5%) | 2 | 5 | 6 | 7 | 69 | 1 | 1 | 0 | 0 | 2/4 |
| Home to Practice hub ("All Practices") | 54 | 9 (16.7%) | 19 | 13 | 26 | 44 | 250 | 3 | 7 | 3 | 7 | 6/12 |
| Home to Visualize setup | 131 | 27 (20.6%) | 39 | 9 | 18 | 36 | 250 | 5 | 25 | 4 | 11 | 3/10 |
| Focus 10 s session (setup tap to completion screen, 21 s window) | 1061 | 403 (38.0%) | 611 (57.6%) | 20 | 32 | 34 | 42 | 270 | 401 | 376 | 4 | 2/6 |
| Details to Share Studio open | 223 | 23 (10.3%) | 34 | 6 | 17 | 26 | 150 | 10 | 21 | 5 | 7 | 3/9 |

(The 250 ms p99 on every screen transition is the same bucket; see E-03.)

### Memory (`dumpsys meminfo`; PSS KB)

| Snapshot | Java heap PSS | Native PSS | Graphics | TOTAL PSS | Swap PSS | Views |
|---|---|---|---|---|---|---|
| Session start (process already up ~20 min of prior use by others) | 29,628 | 544,600 | 723,940 | 2,091,733 | 531,354 | 2,060 |
| After carousel swipes | 61,836 | 485,832 | 740,088 | 2,154,019 | 573,860 | 2,130 |
| Loop 0 (Home) | 67,424 | 594,312 | 738,748 | 2,292,158 | 610,792 | 2,289 |
| Loop 5 | 59,308 | 532,912 | 741,052 | 2,256,754 | 536,685 | 2,291 |
| Loop 10 | 58,492 | 546,676 | 741,564 | 2,267,203 | 529,629 | 2,291 |
| Loop 15 | 44,224 | 497,340 | 744,000 | 2,202,207 | 524,397 | 2,289 |
| Vision board | 72,272 | 519,400 | 741,952 | 2,253,658 | 496,297 | 2,482 |
| Focus completion (stuck) screen | 52,472 | 579,752 | 744,180 | 2,257,396 | 468,078 | 2,710 |
| FRESH process after force-stop + Metro reload, Share Studio | 62,804 | 615,208 | 379,312 | 1,315,034 | 87 | 932 |
| Fresh process, Home, end of session | 56,568 | 591,928 | 308,532 | 1,227,670 | 52 | 486 |

Findings: no leak across 15 Home<->Details loops (PSS flat to slightly lower; Views flat at 2289-2291). But the long-lived process was at about 2.1-2.3 GB PSS with about 740 MB Graphics and 470-610 MB in swap, versus about 1.2-1.3 GB / 310-380 MB Graphics on a fresh process. The growth happened before this audit began (earlier creation flows/Vision/Chart use) and I did not isolate which screen accumulates it. Views count of 2,000-2,700 on a live process is high.

### Launch

| Measure | Result |
|---|---|
| `am start -W` hot (HOME then start) | LaunchState HOT, Total 105 ms, Wait 115 ms |
| `am start -W` after `force-stop` | LaunchState COLD, Total 855 ms, Wait 857 ms, resolves in `DevLauncherActivity` (dev launcher, not the app) |
| Tap on `http://localhost:8081` in dev launcher to `Running "main"` | about 4.7 s (`loadJSBundleFromMetro` 01:56:43.8, Running main 01:56:48.6) |
| JS `app-ready` (PERF event) | `msSinceAppStart: 35967` (about 36 s after JS start); Home visible by the time of the next check |
| Store hydration (PERF `store-hydration-finished`, ms since JS start) | visualizationScene 1085, locationPriming 1086, anchor 3359 (72 anchors), session 4075 (175 history), auth 4284 |
| Between auth hydration (4.3 s) and `app-ready` (36 s) | one SecureStore write of `anchor-vault-storage`: 719,217 chars in 400 chunks, `ms: 32792`; a 634-char `anchor:cached_user` write queued behind it `ms: 34785` |

### Logcat summary (log buffer included earlier activity from before my session, noted where used)

- `[PERF] js-stall` events (JS thread gap > about 50 ms; dev only): 1,800 in the buffer (mostly earlier work). Routes: V2Practice 1474, V2Home 205, V2AnchorDetails 44, AnchorCreationFlow 43. Median gap 63 ms, p90 114 ms, max 1,286 ms, 214 gaps >= 100 ms, 6 >= 500 ms.
- During my 15x Home<->Details loop: 136 stalls on V2AnchorDetails totalling 22.3 s, i.e. about 1.49 s of JS-thread stall per Details open (the first is consistently about 400 ms starting about 400 ms after `detailsTransitionLaunch`, then 5-8 more of 90-280 ms over the next 2 s). 13 of 15 opens also logged `Choreographer: Skipped 31-35 frames` on the main thread (about 260-290 ms at 120 Hz).
- No FATAL / ANR / crash for pid 3995 or the post-restart pid. Two huge `Choreographer: Skipped 1158/1379 frames` lines belong to other pids (not this app).
- SecureStore: `SharedPreferencesImpl: Time required to fsync SecureStore.xml` histogram showed about 1,526 / 5,314 / 24,938 / 8,805 fsyncs in the 1/2/4/8/16 ms buckets (about 41 k fsyncs over the process life), consistent with chunked SecureStore writes.
- Audio during Focus: ExoPlayer init 01:53:11.64, AudioTrack started, ExoPlayer Release 01:53:21.565 (about 10 s later, as expected). All app AudioPlaybackConfigurations `state:stopped` afterwards (7 stopped entries listed; none `started`).

## 4. Issues

### E-01  App startup / persistence layer: SecureStore-backed vault write blocks `app-ready` for about 33 s (dev)
- Screen/System: cold start, `anchor-vault-storage` (zustand persist over expo-secure-store), `utils/perfDiagnostics` events.
- Proposed severity: P1 (verify in release; if it reproduces there it is P0 for startup).
- Evidence type: runtime observed (PERF logs; dev build).
- Symptoms: after Metro load, JS reports `app-ready` about 36 s after JS start although all stores hydrated by 4.3 s. In the same window a single SecureStore write of the vault (719,217 chars split into 400 chunks, 403 secure calls) took 32.8 s, and a tiny 634-char `anchor:cached_user` write waited 34.8 s behind it. Earlier in the log buffer, the same vault write repeated 12-13 times with measured 40-135 s each (`persist-setItem-settled count 12/13`), and reads in the Focus-completion window were taking 185-217 s (the `ms` field on secure-read appears to include queue wait).
- Reproduction: force-stop the app, `am start`, tap localhost:8081, watch `adb logcat | grep PERF` for `store-hydration-finished` vs `app-ready` vs `secure-write anchor-vault-storage`.
- Measurements: see Launch table above. The vault payload is 719 KB for 72 anchors (about 10 KB per anchor, i.e. image URLs/SVG/metadata stored in SecureStore).
- Suspected root cause (confidence medium-high for the mechanism, medium that it gates `app-ready` rather than merely coinciding): large JSON persisted through expo-secure-store in 400 chunks. Every chunk is a Keystore encrypt + SharedPreferences commit with fsync, serialized on `ncFunctionQueue`; one queue means small, critical writes (auth cache) wait behind the vault. Dev mode makes JS slower but does not slow native Keystore/fsync, so this is likely to occur in release too.
- Relevant files: persist storage adapter that emits `secure-write` (search `secure-write` in `anchor/mobile/src`, perfDiagnostics.ts), `anchor-vault-storage` store (anchorStore/vault persist config).
- Verification: release build on this device; log `app-ready` vs the vault write; move vault to AsyncStorage/MMKV/SQLite or store only an index in SecureStore; split queues so auth keys are not behind the vault.

### E-02  Focus session completion screen never advances ("Well done. / Let it settle.") - stuck at least 5 minutes
- Screen/System: V2 Practice Focus (`V2FocusActiveScreen.tsx`, `V2PracticeSessionScreen.tsx`).
- Proposed severity: P1 (user is trapped on the completion screen) - single occurrence, not yet reproduced a second time, so treat confidence as medium.
- Evidence type: runtime observed (dev build; one run).
- Symptoms: 10 s Focus session ran, audio stopped/released correctly, "Well done / Let it settle" appeared; no `practice_session_completed` analytics event or any further navigation followed. Taps on the screen did nothing (only element in the UI tree is the full-screen "Show Focus controls" button). HOME and re-open did not change it (state persisted). Required force-stop to leave. JS thread was alive (PERF render-counts continued every 5 s, CPU idle), so it is a logical hang, not a freeze.
- Reproduction: Home, All Practices, Focus, 10 sec, Begin Focus, wait. Not reproduced twice.
- Measurements: stuck from 01:53:21 until force-stop at 01:55:5x (>2.5 min observed; screen checked again after background/foreground).
- Suspected root cause (medium): `handleFocusComplete` in V2PracticeSessionScreen.tsx `await persistence` (the `PracticeCompletionService.completePracticeSession` promise, `flushImmediately:false`) before `setFocusPhase('complete')`. If that local durable write is queued behind the SecureStore backlog described in E-01 (secure reads during this window were being reported at 185-217 s), the completion UI waits for it. Evidence for this link is circumstantial: no `secure-write` events completed in the window, only slow reads.
- Verification: reproduce on release build; add a timeout/fallback so `setFocusPhase('complete')` is not gated on storage; check `practice_session_completed` is emitted.
- Side effect to note: this run created/attempted one real 10 s Focus record on the user's account (anchor "I am a great dad"); it may not have been saved (consistent with the hang).

### E-03  Home to Details transition: about 1.5 s of JS-thread stalls per open, 250 ms p99 frames, 13/15 opens drop 31-35 frames
- Screen/System: V2Home to V2AnchorDetails shared-element hero flight.
- Proposed severity: P2 (dev build; may drop to P3 in release).
- Evidence type: runtime observed.
- Symptoms/measurements: 30 transitions in the loop: 213/2786 janky (7.65%), p95 23 ms, p99 250 ms; `Choreographer Skipped 31-35 frames` (about 260-290 ms main-thread block) on 13 of 15 opens; 136 JS stalls on V2AnchorDetails totalling 22.3 s (about 1.49 s per open; first about 400 ms stall starts about 400 ms after `detailsTransitionLaunch`, `snapFinished`/`detailsTransitionFinished` also logged). Rapid taps (5 in 0.6 s) correctly produced one navigation.
- Suspected root cause (medium-low): Details mounting heavy content (Vision photo collage, Thread Strength, practice cards, plus image decode/"slow bitmap uploads" 79 in loop) during the flight. Dev mode inflates JS stalls; the 250 ms p99 bucket and main-thread skipped frames suggest at least one real main-thread cost (bitmap uploads/layout).
- Relevant files: `screens/v2/anchor/*Details*`, `navigation/v2/transitions.ts`, `V2AssetPrewarm.tsx`.
- Verification: same loop on a release build; Perfetto trace of one open.

### E-04  Focus session animation runs far below display rate (38% janky, p50 20 ms)
- Screen/System: V2FocusActiveScreen / V2FocusField during the session.
- Proposed severity: P2 (full-screen ceremonial animation on the primary practice path; dev-mode caveat applies).
- Evidence type: runtime observed.
- Measurements: 1061 frames, 403 janky (38.0%), p50 20 ms, p90 32 ms, p99 42 ms, 270 missed vsync, 401 slow UI thread, 376 slow bitmap uploads (the highest of any scenario), GPU p50 only 2 ms. Video recording averaged 25 fps (screenrecord, not authoritative). GPU is not the limit; the cost is CPU/UI-thread and per-frame bitmap uploads, i.e. something re-uploads a bitmap each frame (anchor artwork Image with animated transform, or Skia picture/Image rebuilt per frame) during the field animation.
- Suspected root cause (medium-low): `V2FocusField` + `V2FocusAnchorArtwork` `breathingStyle` scaling an Image / re-created texture; JS stall detector also logged repeated 50-210 ms V2Practice stalls (1474 V2Practice stalls in the buffer, by far the most of any route).
- Verification: release build + gfxinfo; Perfetto/HWUI "bitmap upload" check; toggle `reduceMotion` to compare.

### E-05  Vision board scroll is janky (25.6% janky, p50 13 ms, 43 missed vsync)
- Screen/System: V2 Vision board (photo collage).
- Proposed severity: P2.
- Evidence type: runtime observed.
- Measurements: 317 frames, 81 janky (25.6%), legacy 40.7%, p50 13 / p90 25 / p99 36 ms, 50 slow draw commands, 0 slow bitmap uploads (so images are already uploaded; cost is drawing/compositing many large, rotated/torn-edge masked photos).
- Suspected root cause (medium-low): 5 large photographs with masked/torn-edge overlays and rotations drawn each frame in a scrolling surface. Also measured 19 slow draw commands when first opening the board.
- Verification: release build; try `renderToHardwareTextureAndroid`/pre-composited masks.

### E-06  Long-session memory footprint high (about 2.1-2.3 GB PSS, 740 MB Graphics, 470-610 MB swap)
- Screen/System: whole app, long-lived process.
- Proposed severity: P2 (risk of OS kill on lower-RAM devices; this phone has 12 GB).
- Evidence type: runtime observed (growth source not isolated).
- Measurements: see memory table. No growth across the Home<->Details loop, so the growth is not from that route. A fresh process sits at 1.2-1.3 GB PSS (Graphics 310-380 MB), so the larger footprint accumulated earlier in the session (not measured by me). Views 2,000-2,700.
- Suspected root cause (low): cumulative large image textures (Vision photos, anchor art, generated imagery) retained across screens; Home carousel keeping many hero bitmaps.
- Verification: loop other flows (Vision, Visualize, Chart, creation) from a fresh process with meminfo per cycle on a release build.

### E-07  Carousel switching shows jank bursts and slow bitmap uploads
- Screen/System: Home carousel.
- Proposed severity: P3.
- Evidence type: runtime observed.
- Measurements: slow swipes 6.4% janky, p99 109 ms, 29 slow bitmap uploads in 890 frames; fast flicks 5.1% janky, p99 109 ms, 10 slow uploads. Idle Home costs nothing (1 frame in 10 s), so the carousel itself is idle-clean.
- Suspected root cause (low): first-time decode/upload of neighbouring hero images during swipes.
- Verification: release build; check prewarm.

### E-08  Secondary: SecureStore fsync volume
- Screen/System: persistence layer.
- Severity: P3 (related to E-01).
- Evidence: logcat histogram of about 41 k SecureStore.xml fsyncs over the process life, with a long tail to 128-256 ms (18 + 4 events).
- Verification: count secure calls per user action in release.

Not an issue / positives measured: 15x loop memory stable; rapid-tap navigation de-duplicated; hot launch 105 ms; Settings to Notifications 1.5% janky; Home idle zero cost; Focus audio released at session end with no stuck AudioTrack; no crashes/ANRs for the app pid; no double-start of players observed in the Focus run.

## 5. Not verified / needs device validation

1. Everything above on a RELEASE/production build (E-01 in particular; E-02 reproduction).
2. True cold-start time and time-to-interactive (only the dev launcher was timed).
3. Whether `app-ready` is actually gated on the vault write (E-01) or only coincident; needs code read of the gating logic or a trace with that write disabled.
4. E-02 reproducibility (single run); whether the Focus record was saved locally/server-side.
5. Deep Prime, Visualize playback (Glimpse 1 min), Chart (existing chart), Vision entrance/creation, Release/Evolve entrance: not exercised (paid-generation or destructive risk, or no existing chart on the visible anchor).
6. Audio bleed after leaving Visualize screens; background/foreground mid-session (only done on the stuck completion screen).
7. Sustained thermal/battery behaviour while unplugged (device was on USB charging throughout).
8. Real-gesture back (the memory note says `input keyevent 4` exits the app); in-app back buttons were used.
9. 60 Hz vs 120 Hz behaviour: adaptive mode; 120 Hz not forced.
10. Perfetto/simpleperf traces: none captured.
11. Jest perf/animation tests: not run.
12. Memory growth source for the 2.1-2.3 GB long-session PSS (E-06).
13. Privacy note: logcat/screenshots in the scratch folder include the user's name, photos and a third-party notification; delete before sharing.
