# One Move implementation QA baseline — 2026-10-08

This is the pre-integration reference for the One Move row and teaching changes. The Chart run started before the new One Move source files appeared in the shared checkout. It is a shared-checkout baseline: several unrelated Chart-opening edits were already dirty, so it must not be treated as a clean-branch result.

## Focused Chart suites

The phase-3 report from 2026-10-07 records **70 passing suites, 1 failing suite, 651 passing tests, and 10 existing `ChartPreview` snapshot failures** (`chart-phase3-20261007/REPORT.md`). The 10 failing snapshots are in `src/components/chart/__tests__/ChartPreview.test.tsx`.

Fresh focused run: `jest --runInBand` for `components/v2/chart`, `screens/v2/chart`, `hooks/v2/chart`, `adapters/v2/chart`, and the legacy `ChartPreview` test.

| Result | Suites | Tests | Snapshots |
| --- | ---: | ---: | ---: |
| Passed | 47 | 505 | 6 |
| Failed | 4 | 17 | 10 |
| Total | 51 | 522 | 16 |

The 4 failing suites were `ChartPreview.test.tsx` (10 snapshot diffs), `V2ChartScreen.test.tsx`, `ChartMapWeather.test.tsx`, and `V2ChartFlows.test.tsx`. The focused failure totals include 7 non-snapshot failures outside the known 10. Treat those additional failures as current shared-checkout baseline until a clean, source-neutral run can isolate them. Raw output and Jest JSON are in `before-chart-focused.log` and `before-chart-focused.json`.

## Vision picker baseline check

The requested five pre-existing Vision photo-picker failures were not reproduced in the available focused runs:

| Suite | Result |
| --- | --- |
| `VisionCeremony.test.tsx` + `VisionMomentInput.test.tsx` | 2 suites / 44 tests passed |
| `V2VisionScreen.addImage.test.tsx` | 1 suite / 14 tests passed |
| `visionPhotoInput.test.ts` | 1 suite / 8 tests passed |

Their raw outputs are `before-vision-picker.log`, `before-vision-add-image.log`, and `before-vision-photo-input.log`, with matching JSON files. An initial npm-launched attempt to run `V2VisionScreen.addImage.test.tsx` stopped before Jest started because npm reported `ENOSPC`; retrying Jest directly with its cache on E: completed successfully. The specific five failures therefore remain unlocated; they should be compared against the named legacy baseline rather than claimed as reproduced here.

## Runtime availability

Read-only `adb devices -l` found only `emulator-5554` (generic x86_64), with no S24 Ultra connected. I dismissed the native dev menu and opened the existing fake-planner Chart lab through its documented deep link, then opened its 5-waypoint fixture (`Nothing is saved`). Screenshot: `emulator-chart-lab-recheck.png`. The emulator is attached to the already-running chart-opening QA proxy on port 8094, which serves the earlier `phase3-qa.bundle`; the fixture still renders the old single-line OneMoveCard and does not contain this integration. I left the QA proxy, Metro process, and ADB reverse mappings untouched. The chart phase-3 report separately records emulator performance and explicitly leaves S24 Ultra acceptance open. This baseline includes no S24 result or first-visit One Move runtime evidence.
