# Agent A: Motion and Rendering audit (raw findings)

Date: 2026-10-12. Repo: `E:\Projects\Anchor\anchor\mobile\src`. Branch `feat/celebration-layer` (uncommitted: Release hold/screen, evolve store, node tones, creation flow; none of it changes the findings below).
Stack read from `package.json`: Expo 54, RN 0.81.5, Reanimated ~4.1.1 with `reanimated.staticFeatureFlags.ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS = true`, Skia 2.2.12, expo-audio. A native `DisplayModeModule` (`android/.../DisplayModeModule.kt`) exists to request 120 Hz.

## Method and honesty statement

- Read-only. I read source, `git status`, and ran grep. I did not run the app, adb, jest or tsc, and I took no measurements.
- Every finding below is **Evidence type = code suspected** unless it says "code fact" (something directly visible in the source, such as a constant or a call site). "Code fact" is still not a measured cost.
- Memory notes read first, so these are NOT re-reported: carousel `runOnJS` thread split (fixed), Home<->Details blank-frame (fixed), Home carousel virtual track, SealMedallion 16 ms interval (retracted), legacy session clock whole-seconds (done), expo-image not installed, `welcome-panorama-master.jpg` 5760x1920 kept on purpose, Skia TextureView first-draw latency (already mitigated by the native frame-one veil).
- Reanimated mechanism assumed throughout (not verified on device): with `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` on, plain view props such as `transform` and `opacity` update synchronously on the UI thread. Layout props (`width`, `height`, `top`, `left`, `fontSize`, `lineHeight`, `%` widths) and non-view props set through `animatedProps` (react-native-svg `strokeDashoffset`, TextInput `text`) are expected to go through the Fabric shadow-tree commit path every frame. The repo's own `theme/v2/motion.ts` comment says "on Android every one of those frames is a Fabric commit". Treat "layout prop = per-frame commit" as the working hypothesis to verify with Systrace, not a proven cost.
- Frame budget: 120 Hz is 8.3 ms, 60 Hz is 16.7 ms.

## Severity summary

| ID | Area | Sev | One line |
|---|---|---|---|
| A-01 | Anchor hero transition | P2 | Context value changes 3-5 times per flight; Home, 5 hero items, Details, Practice and Progress re-render at those moments; the hand-off frame is tied to a React commit |
| A-02 | Details sheet | P1 | Sheet drag/snap animates `top`, `left`, `width`, `height`, `fontSize`, `lineHeight` every frame |
| A-03 | Chart overlay | P2 | Flag sway loop redraws the whole overlay canvas (dashed route, path effects) at display rate for the life of the Chart, even with no flag, and after blur |
| A-04 | Chart weather | P2 | Weather canvas re-runs a 3-image runtime shader mask every frame although the mask inputs are static at rest |
| A-05 | Visualize | P2 | UI-thread clock is fed by a 50 ms JS `setInterval`; a JS stall freezes then snaps the cinematic camera; screen re-renders at 10 Hz |
| A-06 | Visualize stage | P2 | Skia stage always records 4+ full-viewport save-layers and 4 full-viewport blend rects even when their opacity is 0 |
| A-07 | Vision board | P2 | Every photo animates `left/top/width/height` in 4 styles during recompose and swap settle |
| A-08 | Thread Strength (Home Progress) | P2 | Layout-prop and SVG-prop animation, double text path (UI + `runOnJS` per integer), replays on every focus |
| A-09 | Chart cloud tiles | P2 | First Chart card mount draws 3 tiles on the JS thread then PNG-encodes 3 images synchronously |
| A-10 | Refresh rate | P2 | 120 Hz is requested only in the creation flow; every other screen runs at whatever the system picks |
| A-11 | Reduce Motion hooks | P3 (P2 for RM users) | Starts `false`, resolves async; 107 call sites each query native and subscribe |
| A-12 | Focus session ring | P3 | `sessionProgress` restarts an 850 ms ease-in-out every second (stop-start crawl) |
| A-13 | Release hold fill | P3 | Fill animates `width: %` for the 1.8 s hold |
| A-14 | Release burn texture | P3 | CPU raster + `readPixels` + JS pixel loop on the JS thread at 60% of the hold |
| A-15 | CircularAnchorRenderer | P3 | Two `useAnimatedStyle` + one shared value per instance even when unused |
| A-16 | Home | P3 | `carouselMoving` state re-renders Home at drag start and rest; Home also consumes the transition context (see A-01) |
| A-17 | Progress | P3 | JS `onScroll` every 16 ms and `setScrolling` re-render at drag begin |
| A-18 | Share Studio | P3 | Full 1080x1920 export tree mounts 350 ms after every layout switch while previewing |
| A-19 | Visualize setup | P3 | Hidden second full session screen plus second board mounted behind the setup page |
| A-20 | Creation | P3 | Phase flips and sound/haptic cues driven by JS `setTimeout` chains re-render a 1445-line stage mid-animation |
| A-21 | Coach/spotlight | P3 | Teaching spotlight animates 5 layout-prop views |
| A-22 | Auth/onboarding | P1 risk, verify | `entering=` layout animations on first mount of native-stack routes match the known RNS Android NPE class |

Ordering inside each section is by user impact, not by ID.

---

## Findings

### A-01 Anchor hero transition: context churn re-renders every consumer at flight milestones
- **Temp ID**: A-01
- **Screen/System**: Home -> Details -> Setup -> Session shared Anchor transition (`navigation/v2/ProgressiveFocusTransition.tsx`)
- **Proposed severity**: P2
- **Evidence type**: code suspected (the state writes and consumers are code facts; the frame cost is not measured)
- **Symptoms**: a possible hitch at the instant the copy takes over (tap) and at the instant it hands over (landing). The frame where Home hides its disc and the frame where Details un-hides its artwork both wait on a JS render of a large tree.
- **Reproduction**: tap the active Anchor on Home, watch the first 2-3 frames of the flight and the last frame; or Details -> Home back. Profile the JS thread in those windows.
- **Likely root cause + confidence**: Medium-high on the mechanism. `RootTransitionProvider` keeps `flight`, `locked` and `copyMounted` in React state and puts `active`, `copyMounted`, `direction`, `sourcePlace`, `targetPlace`, `flightAnchor` in the memoised context value (`useMemo` at line 771). State writes per flight: `launch` sets `copyMounted false`, `locked true`, `flight` (lines 452-454); `onCopyLayout` sets `copyMounted true` (line 720); `acceptDestination` calls `setFlight(next)` when the destination reports (line 671); `reset` sets `flight null`, `locked false`, `copyMounted false` (lines 349-351). Consumers of the context are heavy trees: `V2HomeScreen` (line 136, 896 lines), every `AnchorHeroItem` (5 mounted slots, `V2HomeHero.tsx:229`), `V2AnchorDetailsScreen` (618, 622, 1633 lines), `V2PracticeRouteScreen` and `V2ProgressRouteScreen` (`AnchorV2Navigator.tsx:115,411`), `V2PracticeScreen` (164, 169), the Focus/Deep Focus/setup screens, `V2ProgressHero`. Memoised children (`TrackSlot`, sections) do not help because context consumers re-render regardless. The hidden-artwork decision (`isPlaceHidden`, line ~946) is a React-state value, which is why the design must re-render the source screen in the same commit that mounts the copy (the layout-effect trick at line 867 is a good optimisation of the ordering but it still pays for the render).
- **Relevant files:lines**: `navigation/v2/ProgressiveFocusTransition.tsx:294-296, 325-351, 440-454, 658-690, 715-721, 771-806`; `components/v2/home/V2HomeHero.tsx:228-229, 296`; `screens/v2/home/V2HomeScreen.tsx:136, 147`; `screens/v2/anchors/V2AnchorDetailsScreen.tsx:618-622`; `navigation/v2/AnchorV2Navigator.tsx:115, 411`.
- **Recommended solution**:
  1. Split the context into a stable "actions + shared values" context (never changes identity: `progress`, `exitProgress`, `revealProgress`, `copyReady`, functions) and a small "flight state" context. Components that only call actions (`V2HomeScreen`, `V2PracticeRouteScreen`, `V2ProgressRouteScreen`, navigator) read only the stable one.
  2. Replace the React-state `copyMounted`/`hidden` for artwork with a shared value `copyVisible` (0/1) written in `onCopyLayout` and `reset`, and let each place hide its artwork with `useAnimatedStyle(() => ({ opacity: copyVisible.value && matches ? 0 : 1 }))`. The place binding already exposes `ref`; add `hiddenStyle`. This moves the hand-off onto the UI thread and makes it independent of JS render cost, which is exactly the property the flash fixes were chasing.
  3. Keep `flight` in a ref for logic; only the layer (`AnchorTransitionLayer`) needs React state, so render it from a tiny state hook local to the layer host.
  4. Keep `acceptDestination`'s `setFlight` out of the consumer path (step 1 covers it).
- **Visual preservation**: identical. Same copy, same frames; the artwork hides/unhides the same frame because the shared value flips in the same UI tick as copy mount/removal. Reduce Motion path unchanged.
- **Risk**: Medium. This is the most-tuned code in the app (blank-frame fix history). Do it behind the existing tests (`anchorTransitionSceneRole`, watchdog, Jest rAF no-op: the shared value route must still work when frames never run, keep the `reset()` JS fallback).
- **Verification**: before/after Systrace or React Profiler commit count during one Home->Details->Home trip (expect commits on Home/Details to drop from about 3-5 to 0-1); S24 screenrecord frame detector (the method from the 2026-09-28 note) must still read 0 blank frames; Jest transition tests.

### A-02 Details sheet drag and snap animates layout props
- **Temp ID**: A-02
- **Screen/System**: Anchor Details (sheet over hero)
- **Proposed severity**: P1 (primary gesture on a core screen; confirm by measurement, could drop to P2)
- **Evidence type**: code suspected (animated prop names are code facts)
- **Symptoms**: uneven frame pacing while dragging the sheet or during its 420 ms snap, mostly on mid-range Android; text re-wrap/re-rasterisation shimmer on the title while it morphs between centred and header sizes.
- **Reproduction**: Details -> drag the sheet handle slowly between rest/half/full; also tap the handle to cycle snaps. Trace UI thread and RenderThread.
- **Likely root cause + confidence**: Medium-high on the mechanism. The code comment at line ~1135 says "The sheet is translated, never resized, so dragging does no layout", but other nodes are driven from the same `sheetY`: `centeredStyle` (`top`, `opacity`), `centeredTitleStyle` (`width`, `fontSize`, `lineHeight`; an `Animated.Text` whose size changes every frame, so a text relayout and glyph re-raster per frame), `headerStyle` (`left`, `top`, `width`, `opacity`), `practiceWrapStyle` (`height`, `opacity`: a height change inside the ScrollView content shifts every section below it each frame, forcing relayout of Vision and Chart cards including their images). `currentLayout` (a `useDerivedValue` building an object per frame) feeds 10 styles plus a reaction.
- **Relevant files:lines**: `screens/v2/anchors/V2AnchorDetailsScreen.tsx:765, 771-797, 887-915, 1074-1076, 1097, 1165`; `components/v2/anchors/anchorDetailsSheetLayout.ts` (`resolveSheetLayout`).
- **Recommended solution**:
  - Title: render the centred title once at its largest size and animate `transform` (translate + uniform scale) plus the existing opacity cross-fade to the separate header title. Keep two text nodes (already the structure) so width/lines never change per frame; derive the centred scale from `centeredFontSize / maxFontSize`.
  - `centeredStyle.top` and `headerStyle.left/top`: convert to `translateX/translateY` from a fixed layout origin.
  - `headerStyle.width`: keep a fixed width (the final header width) and animate opacity only; the header text is hidden until `headerOpacity` > 0 anyway.
  - `practiceWrapStyle.height`: animate `transform: scaleY` is not safe for content; instead keep height fixed at the open value, clip with `overflow: hidden`, and move the content below with `translateY` of the following sections (or place the practice card in an absolutely positioned layer whose reveal is opacity + translate, with a fixed-height spacer swapped at snap settle via `onSettled`).
  - Cache `resolveSheetLayout` into a few scalar derived values (one per consumed field) or compute `t` once and interpolate, to avoid 10 style closures each reading an object.
- **Visual preservation**: end states and the interpolated look must match `resolveSheetLayout` exactly; use the same curves, just applied through transform. Title scale-vs-fontSize differs slightly in hinting only; verify against the prototype screenshots.
- **Risk**: Medium (visual regressions on title/practice card; accessibility ordering). Practice card height change interacts with ScrollView scroll-ability (`scrollOn`).
- **Verification**: Systrace/`dumpsys gfxinfo` jank% while dragging (Details only), before/after; screenshot diff at the three snaps; confirm `scrollOn`/teaching `getTeachingRect` still measure correctly.

### A-03 Chart overlay: perpetual flag sway redraws the whole overlay canvas
- **Temp ID**: A-03
- **Screen/System**: Full Chart (`ChartActiveView` -> `ChartMap` -> `ChartMapOverlay`)
- **Proposed severity**: P2
- **Evidence type**: code suspected (the loop and canvas contents are code facts; per-frame GPU/CPU cost unmeasured)
- **Symptoms**: sustained UI-thread/RenderThread load, heat and battery on the Chart screen even when idle; reduced headroom for the camera and sheet animations; continues while the Chart is covered by another route.
- **Reproduction**: open a Chart with no flag visible (or at rest), leave it idle; sample GPU/UI thread. Navigate to a practice session over it and sample again.
- **Likely root cause + confidence**: Medium-high on the loop, medium on cost. `sway` is a `withRepeat(... -1)` shared value (lines 164-184, 4 s loop). It is consumed through `swayTransform` inside one Skia `Canvas` that also contains the dashed route (`DashPathEffect`), the rough route path, two `DiscretePathEffect` X paths, gradient circles and groups. Any consumed shared-value change invalidates the canvas and replays the whole display list, so every frame re-applies path effects. The loop runs whenever `!reducedMotion` and not intro, regardless of whether a flag is visible (`flagOpacity` 0 or `arrived`), and there is no focus/blur pause (compare `ChartMapWeather.useWeatherDrift`, which does pause on blur). The component comment itself notes: "An invisible flag sway would still invalidate this entire canvas every frame."
- **Relevant files:lines**: `components/v2/chart/map/ChartMapOverlay.tsx:164-184, 196-279`; `components/v2/chart/map/ChartMap.tsx:262-282`; `components/v2/chart/ChartActiveView.tsx:1286`.
- **Recommended solution** (any one, in order of preference):
  1. Move the flag (pole, pennant, sway) out of the overlay `Canvas` into the native marker layer (`ChartMapMarkers`, already RN views under the same camera) or a tiny dedicated Canvas the size of the flag, so sway only invalidates a few paths.
  2. At minimum, start the sway only while `flagOpacity > 0` and the screen is focused (use `useScreenFocused` from `ChartMapWeather.tsx`), and `cancelAnimation(sway)` otherwise.
  3. Cache the static route (dashed + rough path) into a `Picture`/`drawAsImage` image keyed on `revealArc` ranges, or put the route in its own Canvas.
- **Visual preservation**: sway amplitude/period unchanged (`SWAY_DEG` 2, `SWAY_HALF_MS` 2000); flag sits at the same map coordinates because marker layer shares the camera transform. Reduce Motion unchanged (no sway).
- **Risk**: Low for option 2, Medium for 1 and 3 (alignment, z-order, test IDs, the planted-flag arrival moments).
- **Verification**: GPU profiler or `adb shell dumpsys gfxinfo` on idle Chart before/after; confirm flag drop (`flagDrop`) and summit pop still align; blur test (open practice over Chart) shows no canvas redraws.

### A-04 Chart weather: runtime-shader mask recomputed every frame while the mask is static
- **Temp ID**: A-04
- **Screen/System**: Full Chart living weather (`ChartMapWeather`)
- **Proposed severity**: P2
- **Evidence type**: code suspected
- **Symptoms**: continuous full-rect shader work for a very slow drift (6-14 map units per second, sub-pixel per frame at 120 Hz).
- **Reproduction**: idle on the Chart with weather ready; GPU counters.
- **Likely root cause + confidence**: Medium. `useFrameCallback` advances `weatherClock` each frame (`ChartMapWeather.tsx:111-123`) so three tile transforms change per frame; the canvas draws haze plus three `ImageShader` rects over the padded map (map + 240 px each side), then a `dstIn` rect with `COVER_SKSL` sampling three images (`fieldDist`, `fieldArc`, `noise`) with uniforms derived from `anim.coverArc/fog/closed` which only change during sequences. The mask result is identical for hundreds of consecutive frames but is recomputed per pixel each frame, inside a `Group layer={<Paint/>}` offscreen layer sized to the padded rect.
- **Relevant files:lines**: `components/v2/chart/map/ChartMapWeather.tsx:105-123, 126-142, 218-272`; `components/v2/chart/map/chartMapShaders.ts` (`COVER_SKSL`).
- **Recommended solution**: when the cover uniforms are idle (not animating: `coverArc/closed/fog` unchanged for N ms), bake the mask once into an `SkImage` (offscreen `drawAsImage`/surface, same approach as the tiles) and draw the clouds with a plain `dstIn` image mask; swap back to the live shader only while the cover animates. Optionally let `useFrameCallback` skip the clock write when `|dt|` is below the movement that would change a pixel (still smooth, but not forced 30 fps: advance every frame, only the redraw invalidation is coalesced when the visible offset delta is under 1/4 px).
- **Visual preservation**: pixel-identical at rest; during a cover change the live shader is used as today. Needs a visual diff test of the baked mask against the live one.
- **Risk**: Medium-high (Skia offscreen lifecycle, texture memory, correctness at the live/baked handover).
- **Verification**: GPU frame time on idle Chart; screenshot diff idle vs live; frame detector across the handover.

### A-05 Visualize: UI-thread clock fed by a 50 ms JS interval; 10 Hz screen re-render
- **Temp ID**: A-05
- **Screen/System**: Visualize (guided cinematic session)
- **Proposed severity**: P2
- **Evidence type**: code suspected
- **Symptoms**: a JS stall of more than about 50 ms makes the camera/photo timeline hold still then glide or snap (`SNAP_FORWARD_MS` 400); micro-stutter in the cinematic move when the JS thread is busy (analytics, haptics, store writes, the 10 Hz re-render).
- **Reproduction**: run a 3 or 10 minute session while generating JS load (for example toggling something that re-renders, or a debug JS busy loop); watch the stage.
- **Likely root cause + confidence**: Medium-high. `useGuidedPlayback` samples `player.getCurrentTime()` every `SAMPLE_MS = 50` in a JS `setInterval` and writes `positionSV.value = withTiming(ms + SAMPLE_MS, { duration: 50, linear })` each tick (lines 77, 200-205). If the next JS sample is late, the UI animation reaches `ms + 50` and stops; the stage derives everything from `elapsed` (`CinematicSessionStage` `useDerivedValue(cinematicSessionFrame(...))`). Separately `setPositionMs` runs every 100 ms (line 81) so `V2CinematicSessionScreen` re-renders 10 times a second for the whole session (it recomputes `resolveGuidedState`, `cinematicSegmentAt`, `cinematicGradeAt`, `segmentProgress`, `onPaper` each render, lines 241-313); the stage is `memo`'d so the cost is the screen shell, not the Skia tree. Contrast: Deep Focus uses one linear `withTiming` for the whole session (`V2DeepFocusActiveScreen.tsx` effect at ~line 130) and has no JS dependency.
- **Relevant files:lines**: `screens/v2/practice/visualize/guided/useGuidedPlayback.ts:12-14, 72-86, 196-208`; `screens/v2/practice/visualize/V2CinematicSessionScreen.tsx:236-253, 300-330`; `screens/v2/practice/visualize/CinematicSessionStage.tsx:105-110`.
- **Recommended solution**: run an anchored UI-thread extrapolation: store `(anchorPositionMs, anchorWallTime)` in shared values on each sample; a derived value computes `anchorPos + (now - anchorWall)` while `running`. The JS sampler only re-anchors when the drift exceeds a small tolerance (for example 60 ms) or on pause/seek/resume, and may sample at 250-500 ms instead of 50. Keep the 100 ms `positionMs` publication for captions/haptics but move caption/segment resolution into a small child component so the screen shell does not re-render, or derive caption index on the UI thread with `useAnimatedReaction` and `runOnJS` only on change.
- **Visual preservation**: timeline identical; the audio remains the master clock (drift correction keeps sync). Reduce Motion path unchanged.
- **Risk**: Medium (clock correctness is central: beat maps depend on audio position; pause/resume/background paths and `snap` semantics must be kept).
- **Verification**: log drift between extrapolated and `getCurrentTime()` over a 10 min session; inject a 300 ms JS stall in a test build and confirm no visible hold; existing guided-playback tests.

### A-06 Visualize stage: full-viewport layers always recorded at opacity 0
- **Temp ID**: A-06
- **Screen/System**: Visualize cinematic stage (Skia)
- **Proposed severity**: P2
- **Evidence type**: code suspected
- **Symptoms**: high fixed per-frame GPU cost for the whole session regardless of what is on screen; risk of dropped frames at 120 Hz on non-flagship GPUs.
- **Reproduction**: run Visualize; GPU profiler during a long silent "hold" segment.
- **Likely root cause + confidence**: Medium. The stage draws, every frame: `Group layer={<Paint opacity={markOpacity}/>}` (line 214), `layer opacity=maskedOpacity` (225) containing an inner `dstIn` layer, a `watermark` layer (247), a reduced-only layer (238), plus four full-viewport rects: `multiply` warm, `saturation` soften, haze and dim (lines 257-260), and a gradient halo circle. Each `layer=` is a viewport-sized save-layer; `multiply` and especially `saturation` (non-separable) blends read the destination. Many of these have opacity 0 for long stretches (for example the grade rects during a plain photo segment, the masked/mark layers outside arrival/breakout/recognition). Skia does not reliably skip a zero-alpha non-srcOver blend.
- **Relevant files:lines**: `screens/v2/practice/visualize/CinematicSessionStage.tsx:211-270`.
- **Recommended solution**: gate each layer with the segment kind, which is already available coarsely on the JS side (`segment.kind` and `activeIndex` change at beat boundaries, at most a few times a minute): pass `segmentKind` and render the masked/mark/watermark/halo layers only in the segments that use them, and render the grade rects only when the corresponding `timeline` grade can be non-zero in the current segment. Because these are mounted/unmounted at segment edges where their opacity is 0 or just reaching 0, nothing visible changes. For the always-on dim rect, use a plain `Rect` (not a layer), which is cheap.
- **Visual preservation**: identical frames if gating is placed on segments where the layer opacity is exactly 0 at both edges; add a frame-compare test at segment boundaries.
- **Risk**: Medium (boundary popping if the gate is early/late by one frame; mount of a layer mid-fade; keep a 1-2 frame overlap).
- **Verification**: GPU frame time before/after in long segments; frame-diff at every segment boundary using the existing timeline fixtures.

### A-07 Vision board photos: layout-prop animation during recompose and swap
- **Temp ID**: A-07
- **Screen/System**: Vision board (`VisionBoard`, `VisionBoardPhoto`), also Visualize setup/session boards
- **Proposed severity**: P2
- **Evidence type**: code suspected
- **Symptoms**: stutter when images are added/removed (1000 ms recompose) and when a drag crosses a slot (every other photo springs to a new rect); 4 photos x 4-5 animated layout styles per frame.
- **Reproduction**: long-press-drag a photo across slots with 4-6 photos; add or remove a photo.
- **Likely root cause + confidence**: Medium. `containerStyle` animates `left`, `top`, `width`, `height`, `zIndex`, `opacity`, `transform` (lines 311-324); `frameStyle` animates `width`, `height` (326); `windowStyle` animates `left/top/width/height` computed from three blended frame-kind weights (328-345); `captionPositionStyle` animates `top` (140). All driven by springs/timings (`boardSpring` stiffness 150, `boardTiming` 1000 ms) per photo. Photos have `Image` children, so a size change is a relayout and redraw of an image view per frame. The scene is also laid out at 1.7x (`renderScale`) so the views are large before the camera scales them down.
- **Relevant files:lines**: `components/v2/vision/board/VisionBoardPhoto.tsx:140, 311-345, 259-307`; `components/v2/vision/board/visionBoardMotion.ts:20, 29-37`.
- **Recommended solution**: animate transform only: lay each photo out once at its target (slot) size, and for the transition animate `translate` and uniform `scale` from the old rect to the new one; cross-fade between the old-aspect and new-aspect content with opacity (the `landscape/portrait/square` weights already model this) instead of animating `window` rect. Keep the final settle by snapping layout to the new size in `onSettled`. Only photos whose aspect actually changes need the cross-fade.
- **Visual preservation**: same motion path and timing; slight difference possible for non-uniform aspect transitions, so keep the cross-fade; compare recordings.
- **Risk**: High (most intricate gesture/animation component; drag-swap race handling, reorder commit, caption hit areas). Do after A-02 and with recorded baselines.
- **Verification**: frame pacing during a drag with 6 photos on S24; unit tests for `visionBoardReorder`; visual recordings of recompose and swap before/after.

### A-08 Thread Strength (Home Progress section)
- **Temp ID**: A-08
- **Screen/System**: Home Progress section when no Vision exists (`V2HomeProgressSection` -> `ThreadStrength`); also reachable by any future caller
- **Proposed severity**: P2
- **Evidence type**: code suspected
- **Symptoms**: a 1.4 s per-frame animation (clip `width`, gray `left/width`, 4 SVG `strokeDashoffset` props, tip dot, count-up text) that restarts on every screen focus, competing with the return transition; the `0%` text flash at replay start; track pops in after `onLayout` (empty until `trackWidth` is measured and state set).
- **Reproduction**: Home with an Anchor that has no Vision: go to Details/Practice and back; profile the 1.4 s after focus.
- **Likely root cause + confidence**: Medium-high. `animatedClipStyle` animates `width`, `animatedGrayStyle` animates `left` and `width` (lines 458-488, layout props); `strand1..4Props` use `useAnimatedProps` on `strokeDashoffset` of react-native-svg paths (non-view props, 413-456); text is written twice, once by `animatedTextProps` (UI thread) and again by `useAnimatedReaction` -> `runOnJS(updateNativeText)` on every integer change (lines 298-311, up to about 60-100 JS hops per reveal) plus `setNativeProps` in `triggerFocusAnimation`. `nav.addListener('focus')` calls `triggerFocusAnimation` (lines 270-275) so the reveal replays on each focus, at the same time the screen transition is settling.
- **Relevant files:lines**: `components/v2/thread/ThreadStrength.tsx:176-238, 266-311, 413-512, 560-600`; `components/v2/home/V2HomeProgressSection.tsx:89`.
- **Recommended solution**: (a) Use one text path: keep the UI-thread `animatedTextProps` and delete the reaction + `runOnJS(updateNativeText)`; (b) animate the clip with `transform: scaleX` plus an inner counter-scale, or a Skia/SVG `clipPath` driven by one `strokeDashoffset`, instead of `width`/`left`; (c) replay only on first mount and when the value changes, not on every focus (or defer replay to after `V2_TRANSITION_SETTLE_MS`); (d) render the SVG tracks with a measured width cached from the previous mount so there is no empty first frame (or render at `windowWidth - gutters` before layout).
- **Visual preservation**: same reveal curve (`bezier(0.22,1,0.36,1)`, 1400 ms) and end state; the replay-on-focus is a deliberate design choice, so confirm with design before removing it (the safer variant is only moving its start past the settle window).
- **Risk**: Low-Medium.
- **Verification**: JS thread event count during reveal (expect a drop of about 60-100 calls); visual diff of start and end frames.

### A-09 Chart cloud tiles: JS-thread build and synchronous PNG encode at first Chart-card mount
- **Temp ID**: A-09
- **Screen/System**: Anchor Details Chart card (`ChartMapCrop` + `ChartWeatherVeilPrimer`), Chart opening, any first Chart surface of a session
- **Proposed severity**: P2 (once per session, but lands on the heaviest transition)
- **Evidence type**: code suspected
- **Symptoms**: a late or jolted landing of the Home -> Details flight on first open (destination rect arrives late; `acceptDestination` then glides in `settleMs` 140), or a stutter on first Details scroll/drag.
- **Reproduction**: cold launch, Home -> Details for an Anchor that has a Chart; profile JS thread for 300 ms after Details mounts.
- **Likely root cause + confidence**: Medium on cost, high that it is on the JS thread. `loadCloudTiles` draws three tiles with about 150+ gradient circles through `drawAsImage` (lines 163-181 area), then `ChartWeatherVeilPrimer` (`ChartWeatherNativeVeil.tsx:99-123`) calls `cloudTileUris()` which runs `encodeToBase64(PNG)` on three 512/384 px RGBA images synchronously (`chartCloudTiles.tsx:183-205`), deferred only by `setTimeout(0)`. The `setTimeout(0)` moves it off the current frame but not off the JS thread. `ChartMapCrop` mounts `ChartWeatherVeilPrimer` on every Details with a Chart.
- **Relevant files:lines**: `components/v2/chart/map/chartCloudTiles.tsx:163-205`; `components/v2/chart/map/ChartWeatherNativeVeil.tsx:99-123`; `components/chart/ChartMapCrop.tsx:57-58`; `components/v2/chart/map/ChartMapWeather.tsx:154-168`.
- **Recommended solution**: the tiles are deterministic (seeded LCG, "identical on every device"), so pre-bake the three PNGs as bundled assets (and use them for both the native veil, via `require`, and Skia via `useImage`/`Skia.Image.MakeImageFromEncoded`). That removes `drawAsImage` and all runtime encoding. If runtime generation must stay, run it after the first idle (`InteractionManager.runAfterInteractions` + `requestIdleCallback`-style delay greater than `V2_TRANSITION_SETTLE_MS`) and write the PNGs to the cache directory once (file URIs) instead of base64 data URIs.
- **Visual preservation**: pixel-identical if the baked PNGs are produced by the current renderer; verify with image diff.
- **Risk**: Low-Medium (asset pipeline; app size +about 1-2 MB; keep a runtime fallback).
- **Verification**: JS thread busy time after first Details mount; first-launch flight end-frame timing; PNG-vs-runtime pixel diff.

### A-10 120 Hz is requested only in the creation flow
- **Temp ID**: A-10
- **Screen/System**: whole app on Android
- **Proposed severity**: P2 (consistency, not a defect by itself)
- **Evidence type**: code fact (call sites) + code suspected (effect on perceived smoothness)
- **Symptoms**: creation may render at 120 Hz while Home, Details, Chart, Vision and practice run at the system's adaptive choice (often 60 Hz in "standard" mode or ramping on touch), so animations feel different between flows.
- **Reproduction**: compare an S24 refresh-rate overlay (Developer options) in creation vs Home carousel/Details sheet/Chart idle.
- **Likely root cause + confidence**: High that only one caller exists: `useHighRefreshRate(true, 2600)` appears only in `screens/create/flow/AnchorCreationFlowScreen.tsx:122`; the native module `AnchorDisplayMode.requestHighRefreshRate` sets `preferredDisplayModeId` to the highest mode at the current resolution (`DisplayModeModule.kt`).
- **Relevant files:lines**: `hooks/useHighRefreshRate.ts`; `android/app/src/main/java/com/anchorintentions/app/DisplayModeModule.kt:17-46`; `screens/create/flow/AnchorCreationFlowScreen.tsx:22, 122`.
- **Recommended solution**: do not just turn it on app-wide first. Fix the per-frame costs above (A-01 to A-08) because a 120 Hz request halves the frame budget and will expose them; then request high refresh on the motion-heavy routes (Home carousel and flight, Details, Chart, Vision board, Visualize session) with the same hook and a restore delay for hand-offs; keep static/readout screens on the default. Prefer the Android 15 frame-rate-category hint if the module is extended. Never force 30 fps.
- **Visual preservation**: no visual change except smoother motion on supported panels.
- **Risk**: Medium (battery, thermal, and exposing jank). Gate behind a measured per-screen frame budget.
- **Verification**: frame time histogram per screen at 60 vs 120 Hz on S24; battery drain over a 5 minute Chart idle.

### A-11 Reduce Motion hooks start `false`, resolve async, and are instantiated 107 times
- **Temp ID**: A-11
- **Screen/System**: app-wide (`hooks/useReduceMotionEnabled.ts`)
- **Proposed severity**: P3 (P2 for users with system Reduce Motion on)
- **Evidence type**: code suspected
- **Symptoms**: for a user whose OS reduces motion, the first render of every screen runs with `reduceMotion = false`, so mount effects start full-motion animations (Thread Strength reveal, ambient loops, entrance animations) that are cancelled one tick later when the native answer arrives; possible one-frame flash of animated state.
- **Reproduction**: enable system Reduce Motion (or "Remove animations"), open any animated screen, log the first `reduceMotion` values.
- **Likely root cause + confidence**: High on the code facts. `useSystemReduceMotionEnabled` is `useState(false)` + `AccessibilityInfo.isReduceMotionEnabled().then(...)` + a listener per hook instance; `useReduceMotionEnabled` calls it, and `useCreationReduceMotion`/`useCelebrationReduceMotion` call it twice (once inside `useReduceMotionEnabled`, once directly). 107 call sites in `screens/components/hooks/navigation` (grep). Each mount costs an async native call and a subscription.
- **Relevant files:lines**: `hooks/useReduceMotionEnabled.ts:1-60`; `hooks/v2/useV2ReduceMotion.ts`; `hooks/useCelebrationReduceMotion.ts`.
- **Recommended solution**: one module-level store: read `isReduceMotionEnabled()` once at app start (before first screen), keep the value in a tiny `useSyncExternalStore` source with a single `reduceMotionChanged` listener; every hook returns the current value synchronously on first render. Combine with the settings preference exactly as now. `useCreationReduceMotion` should reuse the same value once.
- **Visual preservation**: Reduce Motion semantics unchanged (preference wins, else system); only removes the wrong first render.
- **Risk**: Low. Needs care for Jest (mock the store) and Android's "animator scale 0 counts as reduced" nuance already documented in the file.
- **Verification**: unit test that the first render already has the OS value; count native calls at startup.

### A-12 Focus session: progress ring crawls (restarted ease-in-out every second)
- **Temp ID**: A-12
- **Screen/System**: Focus active (`V2FocusActiveScreen` + `V2FocusField`)
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: the ring/opacity progress advances in 850 ms ease-in-out pulses with 150 ms still every second; very visible on the 10 s session (10% per second), invisible on long ones. Plus ring updates go through the SVG `strokeDashoffset` `animatedProps` path.
- **Reproduction**: Focus 10 s; watch the thin ring.
- **Likely root cause + confidence**: Medium-high. `useEffect` on `elapsedMs` writes `sessionProgress.value = withTiming(next, { duration: 850, easing: AnchorMotion.easing.gentle })` (line ~215), `gentle` is `inOut(sin)`, restarted once per second (the React state `setElapsedMs` fires only on whole-second changes).
- **Relevant files:lines**: `screens/v2/practice/focus/V2FocusActiveScreen.tsx:213-219, 582-612`; `screens/v2/practice/focus/V2FocusField.tsx:145-148`.
- **Recommended solution**: on session start/resume, set `sessionProgress` once to `withTiming(1, { duration: remainingMs, easing: Easing.linear })` (as Deep Focus does for `seconds`); on pause `cancelAnimation` and hold; on resume recompute. Keep `elapsedMs` state only for the label.
- **Visual preservation**: ring reaches the same value at the same time; motion becomes continuous. If the stepped look is intentional, keep it and ignore this finding.
- **Risk**: Low.
- **Verification**: 10 s Focus recording; ring progress vs time is linear.

### A-13 Release hold fill animates a percentage width
- **Temp ID**: A-13
- **Screen/System**: Release hold control (`V2HoldToReleaseControl`)
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: a layout pass on the control every frame for the 1.8 s hold (the interaction that must feel instant and exact).
- **Reproduction**: Release screen, hold the button.
- **Likely root cause + confidence**: Medium. `fillStyle` animates `width: '${n*100}%'` (line 37). The hold state logic itself (`useReleaseHold`, UI-thread `visualProgress`, haptics at 6 steps) is sound.
- **Relevant files:lines**: `components/v2/release/V2HoldToReleaseControl.tsx:36-47, 59`.
- **Recommended solution**: fill `Animated.View` at full width with `transformOrigin: 'left'` (RN 0.81 supports `transformOrigin`) and `transform: [{ scaleX }]`, or `translateX` of a full-width bar clipped by the parent (`overflow: hidden` is already set).
- **Visual preservation**: identical fill (the parent clips with radius 18); no corner distortion because the fill has no rounding of its own.
- **Risk**: Low.
- **Verification**: frame pacing during hold; screenshot at 0/50/100%.

### A-14 Release burn texture built on the JS thread during the hold
- **Temp ID**: A-14
- **Screen/System**: Release (`V2ReleaseArtwork`)
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: a JS stall at 60% of the hold (`RELEASE_FIRE_PREPARE_AT`) that can delay a haptic tick or the completion handler; at worst a late "ignite".
- **Reproduction**: hold on Release past 60%; profile JS thread.
- **Likely root cause + confidence**: Medium. `createReleaseArtworkImage` creates a CPU raster surface (about 732 px square at 3x), parses and draws the SVG DOM, snapshots, then `validateReleaseArtworkImage` calls `readPixels` (about 2 MB copy to JS) and `artworkHasInk` loops over about 134k samples in JS. All in a `setTimeout(0)` on the JS thread (lines 142-157).
- **Relevant files:lines**: `components/v2/release/V2ReleaseArtwork.tsx:137-160`; `components/v2/release/releaseArtworkImage.ts:140-228`; `screens/v2/release/V2ReleaseScreen.tsx:335`.
- **Recommended solution**: prepare when the screen settles (idle after mount) rather than inside the hold; or validate by sampling a few pixels with `readPixels` on a small rect (for example 64x64 centre crop) instead of the whole image and the JS loop.
- **Visual preservation**: none (invisible work).
- **Risk**: Low.
- **Verification**: JS busy time around 60% hold before/after.

### A-15 `CircularAnchorRenderer` registers animated styles it does not use
- **Temp ID**: A-15
- **Screen/System**: every Anchor disc (Home carousel 5 slots, library, switchers, transition copies, Details, Practice)
- **Proposed severity**: P3
- **Evidence type**: code suspected (cost per instance small; count large)
- **Symptoms**: extra mount time and memory in lists and during carousel slot mounts; each flight mounts two copies.
- **Reproduction**: mount the Anchor library/switcher with many Anchors; profile mount.
- **Likely root cause + confidence**: Medium. The component always calls `useSharedValue(1)` and two `useAnimatedStyle` hooks (`groundStyle`, `developStyle`, lines 82-90) even when `entrance` is undefined and the styles are never attached. `useAnimatedStyle` runs its worklet once on JS at mount for the initial value and registers a mapper.
- **Relevant files:lines**: `components/v2/anchor/CircularAnchorRenderer.tsx:70-90, 100-112`.
- **Recommended solution**: split into `CircularAnchorRenderer` (no animation hooks) and `EntranceCircularAnchor` (hooks, used by Home hero only), keeping the same visual markup; or keep one component and call the animated hooks only inside a child rendered when `entrance` is set.
- **Visual preservation**: identical.
- **Risk**: Low.
- **Verification**: mount time of the library screen with 20 Anchors; hook count in React Profiler.

### A-16 Home: state toggles that only gate the teaching queue re-render the page
- **Temp ID**: A-16
- **Screen/System**: Home
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: a Home re-render at carousel drag activation and again at rest; also at every `homeMotionActive` flip (`useAnimatedReaction` -> `setHomeMotionActive`).
- **Reproduction**: React Profiler on Home while swiping the carousel.
- **Likely root cause + confidence**: Medium. `carouselMoving`/`homeMotionActive` are `useState` (lines 124-125, 474-477) used only to compute `homeIsIdle` for `useTeachingQueue` (line 480). Sections are memoised so the cost is the Home body, hooks and `todayInputs`, not the sections.
- **Relevant files:lines**: `screens/v2/home/V2HomeScreen.tsx:124-125, 474-480`.
- **Recommended solution**: keep both flags in refs plus a single `useSyncExternalStore`/small store read only by `useTeachingQueue`, so Home itself does not re-render; or pass shared values and let the queue poll on its own tick.
- **Visual preservation**: none.
- **Risk**: Low.
- **Verification**: Profiler render count during one swipe.

### A-17 Progress: JS scroll events and a scroll-begin re-render
- **Temp ID**: A-17
- **Screen/System**: Progress
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: one JS event per frame while scrolling and a full screen re-render at drag begin and at momentum begin/end.
- **Reproduction**: Progress, scroll with the profiler.
- **Likely root cause + confidence**: Medium. `onScroll` (JS callback) with `scrollEventThrottle={16}` only writes a ref (line 170); `setScrolling(true/false)` (172-175) re-renders the screen to feed `teachingQueue.blocked`.
- **Relevant files:lines**: `screens/v2/progress/V2ProgressScreen.tsx:98, 170-175`.
- **Recommended solution**: `useAnimatedScrollHandler` writing a shared value for `y` (as Home does), and a ref-based flag for `scrolling` read by the teaching queue.
- **Visual preservation**: none.
- **Risk**: Low.
- **Verification**: JS event count while scrolling.

### A-18 Share Studio: export composition mounted after every layout change
- **Temp ID**: A-18
- **Screen/System**: Share Studio modal
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: a hitch roughly 350 ms after each layout switch or mark toggle while the preview is on screen.
- **Reproduction**: open Share Studio, flip layouts.
- **Likely root cause + confidence**: Medium. `prepare(layout, showMark)` runs 350 ms after any change and mounts a full 1080x1920 off-screen composition with its images (`AnchorShareStudio.tsx:61-69`; `useShareExportRenderer.tsx` `mount`). Bitmaps of that size are about 8 MB each plus layout cost on the JS/main thread.
- **Relevant files:lines**: `components/share/AnchorShareStudio.tsx:60-69`; `components/share/useShareExportRenderer.tsx:73-115`.
- **Recommended solution**: increase the debounce to 800-1000 ms and cancel when the user keeps flipping; or pre-render only after the first dwell; or lower the prepared composition's image decode size to export size, not source size.
- **Visual preservation**: none.
- **Risk**: Low (Save/Share latency trade-off: keep the existing "mount on demand" fallback).
- **Verification**: time to PNG for Save after a quick flip vs after a dwell; jank during flipping.

### A-19 Visualize setup mounts a second full session screen and board
- **Temp ID**: A-19
- **Screen/System**: Visualize setup (`V2VisualizePrepareScreen`)
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: extra memory and JS work while the user reads the setup page; competes with the audio sheet and duration taps.
- **Reproduction**: open Visualize setup with 5-6 photos; profile memory/JS.
- **Likely root cause + confidence**: Medium. A full `V2CinematicSessionScreen prepareOnly` sits in `preparationSurface` (opacity 0, line ~430), in addition to the visible collage `VisionBoardScene` (line ~345). It is mounted only after entry settles (good), but both boards hold decoded photos and shared values.
- **Relevant files:lines**: `screens/v2/practice/visualize/V2VisualizePrepareScreen.tsx:337-357, 429-436`.
- **Recommended solution**: share one board scene between the visible collage and the prepare pass (measure the visible one), or mount the prepare pass in a lower-priority idle task with `InteractionManager` and unmount it after `onPrepared`.
- **Visual preservation**: none.
- **Risk**: Medium (the prepared frame/mark measurements feed the session start).
- **Verification**: native heap with and without; time-to-`onPrepared`.

### A-20 Creation: JS-timer driven phases and cues
- **Temp ID**: A-20
- **Screen/System**: Creation formation/generation (`CreationStage`)
- **Proposed severity**: P3
- **Evidence type**: code suspected
- **Symptoms**: small timing drift between UI-thread animation, `SoundPool` ticks and haptics when the JS thread is busy; re-render of a 1445-line stage at each phase flip.
- **Reproduction**: creation with a busy JS thread (generation request in flight).
- **Likely root cause + confidence**: Medium. `runFormation` starts a UI-thread `withTiming` then schedules `setFormationPhase`, landing sounds, haptics and completion on JS `setTimeout`s computed from the same timeline (lines 365-455); generation phases use more timers (579-591, 614-646). A late JS timer desynchronises sound from the visual.
- **Relevant files:lines**: `components/v2/creation/CreationStage.tsx:365-455, 579-591, 614-650`.
- **Recommended solution**: observe the shared `progress` with `useAnimatedReaction` and `runOnJS` the cue/phase on crossing, so cues are tied to the animation, not to a parallel JS clock; memoise the formation subtree by phase.
- **Visual preservation**: none; timing exactly follows the animation.
- **Risk**: Medium (sound/haptic contract tests, Jest rAF no-op: keep the JS timer as the completion fallback as noted in code).
- **Verification**: log offset between landing sound and visual landing frame under artificial JS load.

### A-21 Teaching spotlight animates layout props
- **Temp ID**: A-21
- **Screen/System**: `SpotlightCoach`, `ChartOneMoveTeaching`
- **Proposed severity**: P3
- **Evidence type**: code fact for the props; impact unmeasured
- **Symptoms**: hitch when the coach mark moves between targets (260 ms) on Home/Details/Progress.
- **Reproduction**: trigger coach marks.
- **Likely root cause + confidence**: Medium. Five scrim/spot views animate `left/top/width/height` each frame (`SpotlightCoach.tsx:77-81`, `ChartOneMoveTeaching.tsx:44-48`).
- **Relevant files:lines**: `components/v2/teaching/SpotlightCoach.tsx:77-81`; `components/v2/chart/sheet/ChartOneMoveTeaching.tsx:44-48`.
- **Recommended solution**: one Skia canvas or a single full-screen view with a cut-out drawn by an SVG `Mask` whose rect is animated via transform; or draw the scrim as four fixed views with transform-scaled edges.
- **Visual preservation**: same spotlight rectangle motion.
- **Risk**: Low-Medium.
- **Verification**: frame pacing during a spotlight move.

### A-22 Entering animations on native-stack route first mount (known crash class)
- **Temp ID**: A-22
- **Screen/System**: `V2AuthScreen`, `V2SealedSaveScreen`, `V2OnboardingJourney`
- **Proposed severity**: P1 risk, verify (crash, not smoothness)
- **Evidence type**: code fact (the `entering=` props) against a prior memory note; not reproduced
- **Symptoms**: potential Android NPE `getVisibility()` in `dispatchAttachedToWindow` when a Reanimated `entering` animation fires while react-native-screens attaches the route fragment (memory: `project_v2_navigation_perf_pass`).
- **Reproduction**: cold navigate to `V2Auth` with `animation` other than `none` on Android and watch for the NPE; repeat on low-end device or with a slow first layout.
- **Likely root cause + confidence**: Low-Medium (I did not reproduce). `V2AuthScreen.tsx:314` uses `entering={FadeInDown.duration(...)}` with no delay on its root content; `V2OnboardingJourney.tsx:257,272` delay the entering by 160/380 ms (probably safe); `V2SealedSaveScreen.tsx:367,375-505` use `entering` and `exiting` for in-screen blocks.
- **Relevant files:lines**: `screens/v2/auth/V2AuthScreen.tsx:314, 346, 370-371, 456-457`; `screens/v2/onboarding/V2SealedSaveScreen.tsx:367-505`; `screens/v2/onboarding/V2OnboardingJourney.tsx:257, 272`.
- **Recommended solution**: replace first-mount `entering` with a shared-value fade/rise started in an effect after `navigation.addListener('transitionEnd')` or after one `requestAnimationFrame`, as the memory note prescribes ("In-route layer swaps use shared values instead").
- **Visual preservation**: same fade durations and offsets.
- **Risk**: Low.
- **Verification**: Android crash monitoring for the NPE signature; manual cold open of Auth 20 times.

---

## Animation inventory (for the Motion Preservation Checklist)

Values copied from code. "Dur" in ms.

**Anchor hero transition** (`navigation/v2/ProgressiveFocusTransition.tsx`, `ANCHOR_TRANSITION_TIMING`)
- details (Home -> Details): spring, travel budget 320, exit 0, navigate 0, no reveal. Spring `HERO_SPRING` stiffness 230, damping 27, mass 1 (thresholds ignored by Reanimated 4.1.6 per notes).
- practice (hub -> setup): exit 120, navigate 130, travel delay 80, travel 400, reveal delay 200 / 300.
- fromDetails (Details -> Practice/Release): exit 0, navigate 0, travel 320.
- session: exit 220, navigate 220, travel delay 60, travel 500, reveal delay 280 / 340. visualize: same plus dissolve 420.
- back (Details -> Home): spring, travel 320, navigate 240.
- progress: exit 180, navigate 0, travel 540, reveal delay 200 / 380. progressBack: exit 180, travel delay 40, travel 520.
- reduced: cross-fade 140. settleMs 140, unclaimedMs 400, unclaimedFadeMs 180, watchdogMs 900.
- Easing: `HERO_EASE` bezier(0.22,1,0.36,1); `GLIDE_EASE` out(quad). Arrive/depart windows: shrinking [0.45,0.8]/[0.8,1], growing [0.1,0.45]/[0.45,0.7].
- Reveal: windows [0,.45],[.15,.6],[.3,.8],[.45,1]; rise 6.

**Home**
- Carousel: spring `AnchorMotion.spring.carousel` damping 24, stiffness 250, mass 0.75 (rest thresholds 0.5/2.5); commit delay 140; swipe commit distance 40, min travel 10, velocity projection 0.12, rubber band 0.25, pan activeOffsetX +-6, failOffsetY +-10; neighbour scale 0.72, peek 0.14.
- Content veil: down to 0.38 over 140 (`AnchorMotion.easing.enter`), reveal 260 out(cubic), abort reveal 200, fallback timer 600; translateY 6.
- Hero entrance: start delay 200, ground 900 (bezier .4,0,.2,1), draw 1100 + 120 delay (bezier .45,0,.25,1), ring delay 1300 / 1100.
- Halo glow ease 1200 out(cubic). Status ring 1100 (done) / 300 (undone), bezier(0.16,1,0.3,1).
- Elastic scroll (Android): limit 120, resistance 0.5, fling carry 1.1 (cap 22), fling out 120, spring stiffness 240 damping 30.
- Arrival (`homeArrival.tsx` `ARRIVAL_TIMING`): withFlight 1700, firstWithFlight 3400, practice 2400.

**Details**: sheet snap 420 ms bezier(0.2,0.8,0.2,1); snaps rest/half/full from `resolveSheetSnaps` (0.671 / 0.464 / max(0.251H, inset+168)); toast 1900.

**Thread Strength**: duration 1400 bezier(0.22,1,0.36,1); min dynamic 350; pill delay 300 + 350 out(quad), translateY 6.

**Focus** (`V2FocusActiveScreen`, `V2FocusField`): field transition 520 out(ease); entry 800 (or `ANCHOR_SESSION_ENTRY_MS` = 280+340-220 = 400 with hand-off); breathing 1.015 over 3200 inOut(sin) reverse; drifts 8300/11200/16800 inOut(sin) reverse; ring restart 850 inOut(sin) every second; controls in 180 / out 420 after 3200; prepare auto-advance 3500; prepare fade 350/400.
**Deep Focus**: one linear `withTiming` of `seconds` for the whole session; controls 180 in / 420 out after 3200; curtain 0.8 s; end fade 0.45 s.
**Visualize** (`useGuidedPlayback`, stage): sample 50, publish 100, snap forward 400, end tolerance 120, early-exit fade 300 in 5 steps, status settle 600; chrome 280; caption in 260 / out 360; photo/camera timeline from `buildGuidedPlan`; entry fade `VISUALIZE_BEGIN_TIMING.fadeMs`.
**Release**: hold 1800 linear, tick 50, 6 haptic steps, cancel 240 out(cubic), prepare at 60%; ceremony `RELEASE_CEREMONY_TIMELINE_MS` isolate 0, ignite 300, burnEarly 1050, burnLate 1950, finalEmber 2800, emptyPause 3050, completion 3350; entrance header/rows/controls 420 out(cubic) delays 40/120/220.
**Chart**: `CHART_CAMERA_TIMING` focus 760, return 680, reduced 220; sheet snap 360 (180 reduced) `CHART_EASING.settle`; weather fade-in 900 out(cubic); first-draw hold 150; flag sway +-2 deg, half period 2000 bezier(.4,0,.6,1), infinite; weather drift billows (6,1.6), near (9,0.6), wisps (14,-2.2) map units/s; tile scales 2/1.6/2; journey camera 1000/800/650 `CHART_EASING.deliberate`, 650+750 sequence near the end.
**Vision board** (`visionBoardMotion.ts`): render scale 1.7; focus move 900, return 820, camera bezier(0.45,0,0.2,1); zoom 1.4-1.7, fill 0.8; controls at 520 fade 260; lift scale 1.045, long press 320; spring damping 20 stiffness 150; recompose move 1000, enter delay 380, enter 720 (from 1.08 / lift -14), exit 420 to 0.92; frame cross-fade 320; reduced 140/240/240/160.
**Paywall** (`PAYWALL_TIMING`): medallion fade 900, scale 1100 delay 150 from 0.86; underline 900 delay 500; rise 650 stagger 70; step out 220, step 900; route delay 900, route 1400, waypoint gap 350, flag at 2300; sheen 1400; play ring about 3 s loop.
**Onboarding**: panorama `HERO_PAN_MS` sine loop; start transition 320 UI-out, 680 dive, 900 pan, 520 wash, navigate at 660.
**Creation** (`creationMotion.ts`): swap out 180 / in 260; distill hold 700; stage fit 520; expression blend 420; hand-off fade 320; formation grid in 900, map travel 360, letter pause 160, stagger 520, map max 6000, map hold 450.
**Share Studio**: enter 320 (scale 0.97 -> 1), press 90/140, prepare debounce 350.
**Motion tokens** (`theme/v2/motion.ts`): micro 120, quick 180, standard 280, expressive 420, ambient 3200; easings enter bezier(0.16,1,0.3,1), exit (0.7,0,0.84,1), standard (0.2,0,0,1), emphasized (0.05,0.7,0.1,1), gentle inOut(sin); springs snap 24/280/0.8, soft 20/160/1, sheet 22/230/0.8, reveal 18/140/1.2.

## Checked and found clean (coverage)

- **Home carousel gestures**: UI-thread vs JS-thread commit split is correct (`move` calls `onSettled` directly; spring callbacks use `runOnJS` on the UI thread); `onBegin` catches the track mid-flight; `ended` guard on `onFinalize`; stale-target guard in `onSettled`; commit timer cleaned up on unmount.
- **Elastic scroll** (`homeElasticScroll.ts`): all UI-thread worklets, simultaneous with native scroll, no JS per frame.
- **Transition provider lifecycle**: every timer cleared on unmount (`useEffect(() => clearTimers)`), watchdog resets, `measureInWindow` fallback at 250 ms, single flight lock, `unregisterPlace` token check.
- **Deep Focus**: single UI-thread clock, six derived styles from one `seconds` value, `V2FocusField` `motionActive=false` so no ambient loops; cleanup cancels animations and audio.
- **Release hold logic** (`useReleaseHold`): UI-thread fill, JS state only at haptic steps, AppState cancel, interval cleared on unmount.
- **Weather drift lifecycle**: `useWeatherDrift` pauses the frame callback on blur and resets the clock; `GenerationEtching` frame callback activates only while running and freezes after cut.
- **Ambient loops gating**: `V2FocusField`, `EvolvingAnchor`, Paywall CTA/hero/tiles gate on `reduceMotion`/`active` and cancel in cleanup.
- **ChartSheet** gestures: `activeOffsetY`, `busy` guard, snap with `ReduceMotion.Never`; `detent` state only at settle.
- **Vision board camera**: pure shared-value camera, transform only; drag uses `dragX/dragY` transforms; swap order in a shared value; reorder commit only on finalize.
- **No `BlurView`/`expo-blur` in V2**, no `LayoutAnimation` use, no `react-native-reanimated` `useFrameCallback` outside Chart weather, GenerationEtching and a dev host.
- **`V2ThreadStrength.tsx`** uses RN `Animated` with `useNativeDriver: false` and `setDisplayed` per frame, but it is rendered only in `V2SystemGallery` (not on any product screen), so no production impact; delete or fix if it is revived.
- **Sound ticks in release/creation**: SoundPool-based, not blocking the UI thread.
- **`VisualProfiler.record`** returns immediately outside `__DEV__`, so the many `runOnJS(VisualProfiler.record)` calls only cost the thread hop in release.
- **Share export**: capture path is `renderPng` with keep-warm and `nextFrames`, mounts only on demand.
- **Paywall** loops are idle-gated and cancelled; layout measurement via `useTileWidth` has an initial value, so no empty first frame.

## Noticed outside the brief (not scored)

- `VisionBoardPhoto` styles use iOS `shadow*` props only (`styles.photo`); on Android these render nothing, so the lifted photo has no shadow.
- `V2AssetPrewarm` renders 1x1 images; on Android with Fresco the decode size may then be 1x1, so it may only warm the disk cache (the file's own comment says "there this only warms the cache").
- `V2HomeHero` passes `renderHero` as a `useCallback` with `thread`, `selectedIndex` and `onOpenActive` in deps; `handleOpenActive` depends on `model.anchorList`, so any list refresh rebuilds all five hero items.
