# Dynamic Chart journey implementation and evidence

Updated September 29, 2026. Implementation is present; complete device acceptance remains open for the measurements listed below.

## Visible changes

The full Chart uses the five supplied layers with a continuous road camera. The city is drawn over distant terrain, its water patch has a soft perimeter blend, foreground coverage extends past the viewport, and the sunset is registered behind the skyline. The camera's initial framing accommodates shorter environments without cropping the whole skyline.

Anchor Details has a compact preview with total height `width * 0.6`, matching Vision. Only its waypoint position and title overlay the artwork. Home retains its original SVG instrument, appearance and adapter output by default. The Home rendering branch matches the pre-task backup; `chartRouteGeometry.ts` and `chartMotion.ts` match the pre-task files byte for byte. Existing unrelated dirty work remains in place.

## Geometry and progress

- `chartJourneyGeometry.ts`: 29 traced asphalt centerline points; 512 Catmull–Rom samples; cumulative distance measured in 3240×5760 master coordinates; binary search and interpolation for lookup. Fixed layer registration is separate from runtime waypoint placement.
- Every live waypoint count uses `0.08 + index / (count - 1) * 0.82`; one waypoint starts at 0.08. The destination is independent at 1.0. No backend visual coordinates were added.
- Real server ordering, current pointer, reached/skipped state, cancellation and confirmed course status come from the existing Chart model. Baseline-aware metric fractions drive only the current segment. Invalid metrics contribute zero movement. Final local progress stops at 0.96; confirmed completion permits 1.0.
- `useChartJourneyCamera.ts` and `chartJourneySession.ts`: account/course session memory, texture readiness, interrupted animations, reduced motion, arrival sequencing. Shared values animate the camera. Animated reactions and explicit `runOnJS` handle settled progress/completion.
- `ChartJourneyWorld.tsx`: global scale/translation, bounded layer parallax, exact road-transform node projection, separate 48-point targets and nearest-target selection. Future inspection does not move actual progress. Noncurrent nodes sit behind foreground scenery; the current accent sits above it. More than eight nodes emphasize the current node and its neighbors.

## Changed implementation files

New modules: `ChartJourneyWorld.tsx`, `chartJourneyGeometry.ts`, `chartJourneySession.ts`, `useChartJourneyCamera.ts`, `chartTypography.ts` and their focused tests, under `src/components/v2/chart/`.

Updated Chart integration: `ChartActiveView.tsx`, `ChartCreationFlow.tsx`, `ChartGenerationStage.tsx`, `ChartDestinationReached.tsx`, `ChartChrome.tsx`, `ChartMetricBar.tsx`, `ChartWaypointContent.tsx`, `ChartWorldPreview.tsx`, `src/screens/v2/chart/V2ChartScreen.tsx`, and their affected tests. The completed world stays mounted while the approach finishes, with saved Vision beneath the city hero.

Presentation data: `src/adapters/v2/chart/chartV2Model.ts`, `src/adapters/v2/home/chartAdapter.ts`, and the completed-course opt-in in `V2AnchorDetailsScreen.tsx`. Home does not opt into the new presentation fields. The global SVG test mock gained its missing Image export. Development-only `V2ChartPreview.tsx` provides real renderer fixtures with 3/5/8/12 waypoints and metric/confirmation controls; those controls are never production UI and save nothing.

Assets/scripts: untouched source masters and five runtime derivatives under `src/assets/chart/world/`; `scripts/build-chart-world-assets.mjs`, `scripts/check-chart-journey.mjs`, and `scripts/render-chart-journey-fixtures.py`. The composite master is reference-only and is never required by the production renderer.

## Texture budget

| Layer | Runtime dimensions | RGBA source bytes |
| --- | --- | ---: |
| Sky | 720×1280 | 3,686,400 |
| City | 1080×1920 | 8,294,400 |
| Midground | 1080×1920 | 8,294,400 |
| Road | 1440×2560 | 14,745,600 |
| Foreground | 1080×1920 | 8,294,400 |

Total calculated decoded source size: **43,315,200 bytes / 41.31 MiB**, below the 48 MiB source limit. The asset builder fails if selected source sizes exceed that limit. Originals retain their full resolution and alpha; only runtime derivatives load in the renderer. No transient alternative-resolution sets are used.

This is a dimensions-based byte calculation, not measured native allocation. The city uses an SVG perimeter mask and an invisible RN source-readiness probe for reliable cached re-entry. Its bitmap/cache sharing and mask surfaces need profiling. **The 96 MiB GPU/surface/cache budget has not been verified on either platform**, and native decoded allocation still requires measurement. Whole-process Android `dumpsys meminfo` totals vary with other app content and do not establish the world-specific budget.

## Verification

- Focused Chart, model, Home adapter/rendering, Details and navigation checks: **20 suites / 234 tests passed**. Includes count 0/1/2/3/5/8/12/24, reserved endpoints, aspect-correct distance, finite projection/depth, baseline/invalid metrics, final ceiling, inspection, readiness/retry, camera interruption, account changes, reduced motion, creation, and existing server mutation success/failure flows.
- Baseline/final TypeScript diagnostic comparison normalizes source line numbers. Repository-wide diagnostics remain pre-existing; no added diagnostic was found.
- Android and iOS Hermes exports were produced. Exports are bundle evidence, not device acceptance.
- Real authenticated Galaxy S24 Ultra: navigated Home → compact Details → full Chart and inspected composition. Final mask/cache correction was subsequently verified on the Android emulator because the phone was in use. No real account progress was changed for QA.
- Android emulator `Vision_QA`, API 36.1: verified texture loading and cached reopen, native road-attached nodes at multiple positions, ordinary/final metric movement, and confirmed arrival. Recent logcat checks found no fatal, worklet, TypeError or ReferenceError in these transitions.

## Captures

`android-emulator-393-*` uses 393×852 logical viewport dimensions (iPhone 14 Pro size) on **Android**, not iOS. `android-emulator-360-*` uses 360×780 logical dimensions (Galaxy S24 size). Dev controls overlay these fixture captures and are not shipped UI.

- 393 captures: early views with 3, 5, 8 and 12 waypoints, plus five-waypoint middle, near-city, preconfirmation and arrival states.
- 360 captures: five-waypoint early, middle, near-city, preconfirmation and arrival states.
- `geometry-captures.json`: 40 deterministic geometry captures for both environment sizes, all four counts and five progress positions. `registered-camera-fixtures.jpg` is an offline composition fixture, not native evidence.

The native 3/5/8/12 screenshots visibly demonstrate the same placement algorithm. Distant labels become quieter above eight; every waypoint remains in the journey summary.

## Remaining acceptance

Native iOS rendering and authenticated transitions; measured world-specific decoded/GPU/cache allocations on both platforms; measured frame pacing on hardware; final maximum-zoom clarity at native pixel density; authenticated backend completion with and without saved Vision after the final composition change. The supplied cutouts are not registered identically to the composite, so their fixed registration is intentionally a new composition using the physical road as authority. These open checks must not be described as passed or as full production acceptance.
