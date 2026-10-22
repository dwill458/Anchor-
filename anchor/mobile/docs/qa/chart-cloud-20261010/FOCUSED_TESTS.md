# Focused chart-cloud verification

Commands run from `anchor/mobile`:

- `npx jest src/components/v2/chart/map/__tests__/chartProgress.test.ts --runInBand` — PASS, 26/26 tests. Covers weighted metric+move progress and strict server completion progress source.
- `npx jest src/components/chart/__tests__/ChartMapCrop.test.tsx --runInBand` — PASS, 1/1 test. Covers textured compositor configuration, responsive crop geometry/waypoint positions, cover progress updates without changing route reveal arc, and inferred display completion with server ACTIVE retaining weather fog.
- `npx jest src/components/v2/chart/map/__tests__/ChartMapWeather.test.tsx --runInBand --testNamePattern="sculpted tile compositor"` — PASS, 1 focused compositor test. Ready textured output uses `COVER_SKSL` and omits the old procedural cloud shader.
- `npx jest src/components/v2/chart/map/__tests__/chartCreationWeather.test.tsx --runInBand` — PASS, 10/10 tests. Living weather and creation transition behavior.
- `npx jest src/components/v2/chart/map/__tests__/ChartMapWeather.test.tsx src/components/chart/__tests__/ChartMapCrop.test.tsx --runInBand` — crop tests PASS; overall 6/7 tests passed. The existing living readiness case timed out at its unchanged 8-second wait for `map-veil` removal.

## Baseline comparison for readiness timeout

To classify the timeout, the HEAD version of `ChartMap.tsx` was copied temporarily into the same map folder and the weather test imported that copy. Temporary files were removed after the run. Command:

`npx jest src/components/v2/chart/map/__tests__/ChartMapWeatherBaseline.test.tsx --runInBand --testNamePattern="clouds first"`

The baseline fails with the same error as the edited source: `expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull()` receives the `map-veil` View after the test's 8-second timeout. The baseline selected test took 15.8 seconds; the isolated suite took 28.8 seconds. The timeout is therefore pre-existing and was not weakened or altered.

Root independently reported the focused chart-map regression set PASS (5 suites, 61 tests), preview contract suites PASS (52 tests), and Android/iOS Expo exports PASS. Final TypeScript check retained only the pre-existing unrelated `VisionPhotoCaptionEditor.test.tsx(56,58)` TS2345 error. `git diff --check` completed without whitespace errors.

