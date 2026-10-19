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

## Not done / still open

- Release-like profiling (needs an approved separate build).
- Remaining per-hero SVG cost: construction ring, underline, percentage digits. Reducing it without changing the visuals needs a design decision (for example fewer SVG views per hero) and fresh measurement.
- Thread Strength glow, Vision board decode, Chart/Progress/Details/practice navigation, memory growth over repeated navigation.
- Full Jest remains at its previously documented 26 failing suites; the Home suites (23 suites, 298 tests) pass with this change.
