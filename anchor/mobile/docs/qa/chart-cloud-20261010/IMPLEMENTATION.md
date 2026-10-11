# Chart preview atmosphere parity

The full Chart is the visual source of truth. This pass changes atmospheric rendering on Home and Anchor Details; card typography, spacing, route geometry, waypoint positions, navigation, and server mutations are unchanged. Work remains uncommitted and unpublished. No screenshot attachments were available in this turn.

## Root cause

Home uses `components/chart/ChartPreview` through `V2HomeChartSection`. Details uses the details variant of `components/v2/chart/ChartWorldPreview`. Both converge on `ChartMapCrop`, which already mounts the shared `ChartMap`, rather than a flattened image. The crop omitted the weather mode, selecting the older `CLOUD_SKSL` land shader. The permanent Chart selects living weather, which adds the cached sculpted billows, near clouds, and wisps from `chartCloudTiles` through `WeatherClouds` and the `COVER_SKSL` fog mask.

## Rendering strategy

The new `textured` mode reuses that same cloud compositor with its phase frozen at mount and no active drift. Cached textures, fog images, sampling, cream shading, mask, and layer order are shared with the full Chart. The existing static shader remains a loading/failure fallback and is removed once textured weather is ready. No new cloud artwork, generic blur, or gradient replacement was added.

Clouds and land use the full Chart's `routeRevealArc` target, including weighted move/metric progress and account/Course high-water marks. The existing preview overlay keeps its route drawing and marker positions. Server `COMPLETED` controls atmospheric completion, even when Details infers its display state from reached waypoints.

Both previews retain the 852 by 1180 map coordinate system, uniform width scaling, and vertically cropped 16:9 portal centered on the current waypoint. Clouds tile through the source renderer's padded boundaries. The preview mounts the shared read-only map, without the full interactive Chart screen, sheet, ceremonies, or sound controller.

## Product and test files changed

Paths below are relative to `anchor/mobile`.

- `src/adapters/v2/home/chartAdapter.ts`: supplies authoritative weather progress to Details.
- `src/hooks/useChartPreview.ts`: derives Home's weather arc from the existing Course subscription.
- `src/components/chart/ChartPreview.tsx`: passes the weather arc into its crop.
- `src/components/chart/ChartMapCrop.tsx`: opts into textured weather and updates its cover arc/completion.
- `src/components/v2/chart/ChartWorldPreview.tsx`: passes Details' weather arc/completion.
- `src/components/v2/chart/map/ChartMap.tsx`: shared frozen textured mode; terrain reveal follows cover independently of the existing route overlay.
- `src/components/v2/chart/map/ChartMapWeather.tsx`: freezes the existing cloud tile phase for previews.
- `src/components/v2/chart/map/chartProgress.ts`: derives the same full-Chart progress inputs from Course data.
- `src/components/v2/chart/map/chartPreviewWeather.ts`: new read-only high-water/progress hook.
- `src/components/chart/__tests__/ChartMapCrop.test.tsx`: new crop/cover/geometry/completion checks.
- `src/components/v2/chart/map/__tests__/ChartMapWeather.test.tsx`: textured compositor and fallback checks.
- `src/components/v2/chart/map/__tests__/chartProgress.test.ts`: weighted progress and server completion checks.

QA-only harness, baseline renderer, screenshots, logs, and reports are saved in this directory. Existing unrelated dirty work was preserved.

## Verification

- Home/Details state, selection, and preview contracts: **52 tests passed**, three suites (`preview-contract-tests.json`).
- Full Chart, shared map, creation weather, cloud tiles, and high-water persistence regression checks: **61 tests passed**, five suites, one existing cloud snapshot (`map-regression-tests.json`).
- Focused progress, crop, and sculpted compositor checks: **28 tests passed** (26 progress, one crop integration, one compositor case); see `FOCUSED_TESTS.md`.
- The broader weather/crop run has **6 passing tests and one readiness timeout**. The unchanged full-Chart `clouds first` test also fails against an isolated HEAD renderer copy at the same eight-second veil-removal assertion. The assertion was preserved; baseline reproduction is recorded in `FOCUSED_TESTS.md`.
- Android production Expo export: passed; final stable-source export is recorded in `android-export-final.log`.
- iOS production Expo export: passed (`ios-export.log`). Exports are bundling checks, not installed native builds.
- TypeScript: only the pre-existing `VisionPhotoCaptionEditor.test.tsx:56` TS2345 mock signature error remains (`typecheck.log`); the same error was recorded before Chart changes.
- Scoped `git diff --check`: passed.
- Before Chart edits, `ChartPreview.test.tsx` had **56 passing assertions and 12 stale snapshot failures**. Those snapshots were not regenerated to conceal the baseline mismatch.

Independent native visual findings are recorded alongside this report. iOS native rendering, physical-device frame pacing, and authenticated Home/Details acceptance require separate device evidence; production exports do not establish those results.

## Root independent screenshot review

Reviewed `after-p1.png`, `after-p3.png`, and the correctly selected `before-p3.png` baseline. The Android fixture harness mounts the actual Home and Details preview components. Both updated previews show matching sculpted cloud volumes, cream shading, and terrain depth at waypoints 1 and 3; their route and current waypoint remain aligned with the baseline. These screenshots establish steady-state Android renderer evidence, not authenticated Home/Details acceptance.

The first `before-p1.png` capture did not switch modes and is not valid baseline evidence. Motion-lab menu captures are not full Chart rendering evidence. Cold restart remained on the harness startup screen, so a flash-free cold texture transition is not verified. Native iOS rendering and physical-device performance remain unverified.
