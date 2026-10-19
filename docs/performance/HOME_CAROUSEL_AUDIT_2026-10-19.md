# Home carousel performance audit (2026-10-19)

Status: **partial**. Home carousel swipe hitches were profiled and one cause removed. Other priority areas (Thread Strength glow, Vision, Chart, Progress, Details and practice navigation) were **not measured** in this pass.

## Method and limits

- Device: Samsung Galaxy S24 Ultra (SM-S928U1, Android 16, 120 Hz adaptive), USB powered, thermal status 1.
- Build: existing SQLCipher **debuggable dev client** (`com.anchorintentions.sqlcipherpreview20261015`). Dex status is `run-from-apk`; ART does not AOT-compile debuggable apps, so Java work (React Native SVG, Fabric mounting) runs interpreted/JIT-warming. **These are dev-build numbers, not release numbers.** No release-like build was made.
- The Metro server on :8081 during the run served `E:\Projects\Anchor-VisionMaterial` (branch `feat/vision-material-system`), not this worktree. The Home carousel, hero and aura-renderer files measured were identical to this branch's HEAD; `ThreadAura.tsx` and `V2HomeScreen.tsx` differed (uncommitted edits there). All numbers describe that served tree, with temporary edits reverted afterwards.
- Interaction: 6 horizontal swipes on the Home carousel (450 ms drag, 1 s rest), alternating direction, repeated 3 times per variant. Frame data from `dumpsys gfxinfo` (reset before each run) and one Perfetto trace (frame, view, input, gfx, sched).
- The dev perf-monitor overlay was visible on screen during runs.

## Baseline (unchanged code, 3 runs)

| Scenario | Frames | Janky | p50 | p95 | p99 | Slow bitmap uploads |
|---|---|---|---|---|---|---|
| Slow swipe, run 1 | 998 | 8.62% | 9 ms | 25 ms | 109 ms | 22 |
| Slow swipe, run 2 | 993 | 6.75% | 9 ms | 21 ms | 113 ms | |
| Slow swipe, run 3 | 962 | 7.90% | 9 ms | 22 ms | 109 ms | |
| Fast flick, runs 1-3 | 712-752 | 8.6-10.0% | 9 ms | 28-32 ms | 97-125 ms | 20 |

GPU time was 3-4 ms per frame (p50-p99), so the cost is main-thread/UI work, not GPU rendering.

## Findings

1. **One ~100 ms main-thread frame per swipe** (`Choreographer#doFrame`, mostly `traversal` -> `Record View#draw()` 65-77 ms, plus `postAndWait` 9-43 ms and RenderThread `syncFrameState` 35-43 ms). 19 frames over 30 ms across 8 swipes, in a repeating cycle.
2. Each of those frames carries a Fabric mount transaction that removes 43-120 native views and inserts 23-119, with `RNSVGSvgView`/`RNSVGGroup`/`RNSVGPath` creations. That is a hero mounting/unmounting as the track window shifts.
3. Each hero brings four `react-native-svg` views (construction ring, intention underline, hand-drawn percentage digits, status ring). Hiding all four dropped p99 from ~109 ms to ~38-44 ms. Hiding one alone gave ~97-121 ms (no clear change); hiding three left 61-81 ms. The cost is roughly additive per SVG view on this build.
4. **Refuted:** recycling the five slot components (key = virtualIndex mod 5) did not help (p99 109-121 ms). Reverted.
5. `simpleperf` shows ART/JIT frames at ~37% of samples on this build. A release build is expected to be materially faster on the Java side, but that is not measured.

## Change made

- Removed the Home hero status ring (`HeroStatusRing`, the thin gold ring with a gold dot at twelve o'clock) at the owner's request. Deleted the component and its now-unused constants. The paper disc, hand-drawn underline, Thread Strength reading, Thread Aura and carousel behaviour are untouched.
- Measured effect (same sequence, served-tree copy of this patch, 3 runs): p99 **73 / 73 / 85 ms** versus **109-113 ms** baseline. p95 (22-24 ms) and jank percentage (7.7-8.7%) are within noise of baseline. Note this is p99, not a 60 FPS result: p95 still exceeds 16.67 ms on the dev build.

## Navigation and glow baseline (same device and served tree, dev build, no changes)

Taps by `adb input`, frames from `dumpsys gfxinfo` reset before each action, 3 s window (4 s for Vision/Chart). 4 cycles each except where noted. "Back" is the in-app back arrow. The device renders at 120 Hz; "janky" is gfxinfo's deadline-based count.

| Interaction | Janky frames | p99 frame | Missed vsync | Notes |
|---|---|---|---|---|
| Home to Details | 3.5-6.4% | 150-200 ms | 6-7 | one stall per open; glow stays aligned |
| Details to Home | 1.2-2.0% | 21-32 ms | 1-3 | smooth |
| Home to Progress | 5.4-7.4% | 133-150 ms | 5-7 | one stall per open |
| Progress to Home | ~1.5% | 16-24 ms | 2-5 | smooth |
| Home to Vision | 1.8-2.1% | 40-77 ms | 4-6 | no large decode stall |
| Vision scroll (3 up/down) | 0.8-1.1% | 18-19 ms | 0 | 1148 frames, no slow bitmap uploads |
| Vision to Home | 15-25% of ~45-52 frames | 150-200 ms | 1-4 | one stall per return; short window so the percentage is inflated |
| Home to Chart | 6.8-9.9% | 46-150 ms | 12-21 | worst entrance measured; first open showed a coach mark |
| Chart to Home | 10-15% of ~100 frames | 150-200 ms | 2-3 | one stall per return |
| Idle Home, 53% glow hero (4 clean runs, 10 s) | 0.4-0.6% | 12 ms | 0 | ~128 frames per 10 s (120 Hz sustained); GPU 3 ms p50, 7-8 ms p99 |

Two earlier idle runs (GPU 10-11 ms) overlapped someone touching the phone and were discarded. The Thread Strength glow is not a bottleneck at idle on this device; its cost during swipes is bundled into the carousel hitch above. A 120 Hz to 60 Hz idle drop was visible in the dev overlay after navigation.

## Trace of the open and return stalls (Perfetto, dev build)

One 35 s trace covered Chart, Details and Progress opens plus the Vision and Chart returns (the ring buffer dropped the first seconds, so the first open is missing; the clock offset to my tap times is not exact, so frames are attributed by content, not by tap).

- **Opens** (Chart, Details, Progress): a first frame of 130-250 ms made of two phases. The "animation" phase (Fabric mounting) takes 45-145 ms and creates 190-380 native views at once, including about 70 `react-native-svg` views, Skia picture views, ~20-50 texts and 6 images (Details: 372 INSERT, 133 UPDATE_STATE and 382 UPDATE_LAYOUT instructions in one transaction). The "traversal" phase then spends 70-120 ms in `Record View#draw()` for the first draw of those views, plus 10-60 ms waiting on the RenderThread (`postAndWait`, bitmap upload). Follow-up frames of 25-120 ms are more first draws.
- **Returns** (Vision/Chart to Home): 40-90 ms frames that are almost all `Record View#draw()` with no mounting. Home's views are redrawn on return.
- **Refuted experiment:** skipping Details' three below-the-fold sections (Vision preview, Chart preview, Recent Practice) in the served tree left two back-to-back stalls per open (about 165-180 ms and 150-186 ms, against about 246 ms and 118 ms before). Deferring those sections would therefore not remove the stall; the cost is the first draw of the visible hero (artwork, glow canvas, SVG) and screen mount. No deferral code was written. The experiment was reverted and the file verified byte-identical.
- The stalls share the root of the carousel hitch: first draw of `react-native-svg` views and large native view trees on a debuggable build whose Java runs interpreted/JIT-warming (dex status `run-from-apk`). How much of this remains in a release build is unmeasured, and any structural fix (fewer SVG views, Skia instead of SVG for decorations, splitting screen mounts) changes rendering and needs a design decision plus a release-like baseline.

## Fix 1: hero underline and percentage SVGs only on the centred slot (commit 989ac630)

Neighbouring slots keep same-size spacers instead of mounting the `IntentionMark` and `HandDrawnPercentage` SVG views; the centred slot mounts them as before. Footprint is unchanged, so nothing shifts when a hero becomes centred. Measured on the dev build against the served tree, same swipes and gesture timing, status ring already removed in both columns after the baseline:

| Interaction | Baseline | Ring removed | Ring removed + fix 1 |
|---|---|---|---|
| Carousel, 6 slow swipes: p99 | 109-113 ms | 73-85 ms | **44 / 44 / 57 ms** |
| Carousel: p95 | 21-25 ms | 22-24 ms | **16-17 ms** |
| Carousel: janky frames | 6.8-8.6% | 7.7-8.7% | **4.9-6.1%** |
| Home to Details open: p99 (6 cycles) | 150-200 ms | not measured | 65-93 ms (2 outliers 13 and 121 ms while warming) |
| Home to Details open: janky | 3.5-6.4% | | 2.6-3.2% (steady state) |
| Home to Progress open: p99 | 133-150 ms | | 34-46 ms steady state (10-73 ms while warming) |
| Home to Progress open: janky | 5.4-7.4% | | 3.8-4.2% |
| Vision open: p99 | 40-77 ms | | 23-69 ms |
| Chart open: janky / missed vsync | 6.8-9.9% / 12-21 | | 7.3% / 19 (one run) |
| Return to Home from Details or Progress | 16-32 ms | | 21-31 ms (unchanged, already fine) |
| Return to Home from Vision or Chart: p99 | 150-200 ms | | 150 ms bucket (unchanged) |

Visual check on the device: settled hero shows underline and digits; mid-swipe the departing hero fades its underline and digits; the arriving hero (10%, "Steady this week") is complete once settled. Jest: 23 Home suites, 298 tests pass; `tsc` clean. The gain in Details and Progress opens is a side effect (fewer views to draw on the Home beneath the shared-element flight), not a change to those screens.

**Why returns still stall (root cause, from library source and trace).** `react-native-svg` 15.16.0 `SvgView.onDetachedFromWindow` recycles its `Bitmap`, and the next `onDraw` rasterizes the whole SVG again on the main thread. When Home is covered by Vision or Chart its views detach, and on return every `SvgView` on Home re-rasterizes at once (75-79 ms of pure `Record View#draw()` in the trace, no mounting). The same mechanism makes the first draw of any new SVG view expensive. The largest SVG on Home is the dashed construction ring (about 1000 px square per hero, five heroes mounted, two of them off-screen staging copies). An experiment to confirm that, hiding the construction ring everywhere, was started but interrupted because the owner needed the phone; it was reverted and not measured.

Candidates, not yet tried: (a) do not mount the construction ring on the two off-screen staging slots (no visual change, they are never visible while staged); (b) fewer or smaller SVG views on Home; (c) keeping Home attached while covered, which trades memory and draw cost.

## Release-like measurement attempt (not completed)

Goal: separate dev-build overhead from real cost by re-measuring the same interactions on a release build. Result: **no release or emulator numbers were obtained.** What was learned:

- **The real SQLCipher QA app cannot be updated in place by any local build.** Its installed APK is signed with an EAS-managed key (SHA-256 `ea13887f...`); every local `debug.keystore` is `fac61745...`. A release build for `com.anchorintentions.sqlcipherpreview20261015` would need that EAS credential (an EAS cloud build), or an uninstall, which would destroy the encrypted local data and was not done. Local `eas build --local` is not supported on Windows.
- **Separate-identity builds work locally.** Debug and R8-release APKs for `com.anchorintentions.expo58qa20261016` (own package, own data, synthetic Firebase config, mock auth, synthetic API) built for arm64-v8a and x86_64. That identity starts empty, so a carousel test needs anchors created through the guest flow, and Vision/Chart cannot load because the synthetic API is unreachable.
- **Build recipe notes** (all local, gitignored, none committed): set `sdk.dir` and `cmake.dir` (CMake 3.31.6) in `android/local.properties`, because CMake 3.22.1's ninja fails on the long `react-native-reanimated` object paths even with Windows long paths enabled; the Google Services plugin needs `android/app/google-services.json`, and `app.json` needs `google-services.json` and `GoogleService-Info.plist` at the project root; the debug variant is an Expo dev client and needs its own Metro server; the first dev bundle takes ~40 s and must be pre-warmed or the dev client's request times out. A separate Metro on :8082 avoided touching the owner's :8081 server. Release builds took ~8-13 min, debug ~8-14 min.
- **Hardware limits:** the 16 GB host had under 1 GB free while Gradle R8, the emulator and Metro overlapped. The existing `Expo58QA_API36_x86_64` AVD did not come online (ADB `offline` after 4-6 minutes in default, cold-boot and software-GPU modes, with WHPX active), so no emulator measurements were made. The owner then needed the phone back.
- Forcing AOT compilation (`cmd package compile -m speed`) does not apply to debuggable apps; the installed dev client stayed `verify`/`run-from-apk`.

## Not done / still open

- Release-like profiling (needs an approved separate build).
- Remaining per-hero SVG cost: construction ring, underline, percentage digits. Reducing it without changing the visuals needs a design decision (for example fewer SVG views per hero) and fresh measurement.
- Root causes of the per-open stalls in Details, Progress and Chart, and of the return stall from Vision and Chart (measured, not yet traced or fixed).
- Focus, Deep Prime and Visualize startup, and practice completion: not exercised, because starting a session writes to the real account.
- Memory growth over repeated navigation, and glow cost at 60 Hz or on a release build.
- Side effect to know about: a tap on the Chart coach-mark scrim dismissed the first-time overlay during testing.
- Full Jest remains at its previously documented 26 failing suites; the Home suites (23 suites, 298 tests) pass with this change.
