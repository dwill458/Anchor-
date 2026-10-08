# One Move independent QA

Date: 2026-10-08  
Reviewer: independent Luna QA agent  
Independent implementation score: **9.0/10**

## Results

The One Move implementation passed independent scoped behavior, lifecycle, layout, final TypeScript, and Android export checks. I rate the implementation 9.0/10 based on the source/spec matrix, final focused test results, and native 360dp/font-scale-1.3 screenshots. The final measured-viewport View wrapper is covered by focused tests, typecheck, and export, but a fresh native smoke of its measurement callback could not be completed: the Expo development client timed out loading the project from the temporary Metro server. This score assesses the implementation, not S24 hardware or 0.25× animation certification.

## Before and after counts

The source-neutral-in-time shared-checkout baseline is in [baseline.md](./baseline.md). The Chart-focused baseline was 47 passing / 4 failing suites, 505 passing / 17 failing tests, and 10 failed snapshots. The broad post-integration run before the last persistence and viewport-only refinements was 52 passing / 3 failing suites, 533 passing / 17 failing tests, and 10 failed snapshots. The same three failing suites were `V2ChartScreen.test.tsx`, `V2ChartFlows.test.tsx`, and the known legacy `ChartPreview.test.tsx`; the ten `ChartPreview` snapshot failures remain. `ChartMapWeather.test.tsx` changed from baseline-failing to passing. These broad counts include parallel Chart-opening work in the shared checkout and should not be attributed solely to One Move.

Final scoped checks after the row persistence and viewport changes:

| Check | Result |
| --- | --- |
| One Move row, teaching, persistence state, ActiveView, WaypointContent | 5 suites, 74 tests passed |
| Waypoint persistence/scoping regression | 1 suite, 35 tests passed |
| Final teaching viewport + ChartSheetContent | 2 suites, 11 tests passed |
| Vision photo-picker suites, before and after | 4 suites / 66 tests passed before and after; the reported five pre-existing failures were not reproduced |
| TypeScript | `npx tsc --noEmit` passed after the final measured-viewport wrapper correction, no diagnostics |
| Android Expo export | Succeeded for the final wrapper snapshot to `%TEMP%\anchor-one-move-export-final2-20261008`; one Android Hermes bundle (16.6 MB) and `metadata.json` produced |

Raw Jest JSON/logs, typecheck log, and export log are saved in this folder. The final Android export emitted a Metro cache-deserialization warning and recovered by performing a full crawl; bundle generation completed successfully.

## Runtime and layout evidence

Native runtime checks used the reversible Chart Motion Lab 5-waypoint fake-planner fixture, not an authenticated production account. At 360dp width and Android font scale 1.3, the first-visit overlay showed all three beats and correctly spotlighted the row, separate checkbox, and text body. The tip card sat above the target. The row title wrapped to two lines; `0 of 1 done`, the waypoint header, and `Update progress →` remained legible without clipping. Expanding the body exposed the full move and all three detail labels. After checking the circle and waiting 3 seconds, the row remained visible with the sage check, struck-through text, `1 of 1 done`, and no helper line. Screenshots are in this folder, including `teaching-final-360dp-font13.png`, `dismissed-final-360dp-font13.png`, `expanded-360dp-font13.png`, and `completed-peek-final-360dp-font13.png`.

After the final measured-viewport View wrapper landed, I started a separate Metro on port 8096 and tried the development-client deep links using both `anchor` and `exp+anchor` schemes. The app displayed Expo's project-loading error with a `SocketTimeoutException`; Metro received no bundle request. I stopped only that temporary Metro process and removed only the 8096 reverse mapping. Therefore the preceding screenshots validate One Move layout and interaction at 360dp/font-scale-1.3, but do not prove the final wrapper's native measurement callback at runtime. The final wrapper itself is covered by 11 focused tests, clean TypeScript, and successful Android export.

The only attached Android device was generic `emulator-5554`; no S24 Ultra was available. Device metrics remained at the restored pre-check override (786×1704, font scale 1.0), my temporary Metro on port 8096 was stopped, and only my 8095/8096 reverse mappings were removed. Existing mappings on 8093/8094/8097/8098/8099/8101 were preserved. The temporary Expo project-load timeout prevented a fresh final-wrapper native smoke; it is recorded as a verification limitation, not as a Chart JS exception.

No S24 first-visit certification, S24 0.25× recording, device audio/haptic review, or feature-specific frame-pacing measurement was performed. The phase-3 report records emulator idle max frame duration of 37.13 ms against the 32 ms ceiling; S24 performance remains open.

## Requirement review

- The circle and body are distinct targets. The visible check is 34px with a 44px hit area; the body clamps to two lines and opens the inline full detail without completing the move.
- `MoveSummary` has no `why` or `doneWhen` fields. The implementation uses waypoint-title and `CHART_COPY.sheet.doneFallback` fallbacks; it does not change the schema.
- The active move API has no undo endpoint. A successful completion remains checked and disabled; the helper line disappears. The check sound remains on the existing server-confirmed route-follow path and is silent for a false/rejected action.
- The completion row persists after its 1.8-second toast, is restored from same-waypoint server completion data, and is cleared when the user chooses another move. Restoration is scoped to the current waypoint so a previous waypoint's completed move cannot shadow the current active move. Day Closed/practice actions remain available.
- Teaching is gated on Chart opening/ceremony/visibility states, persisted per account and course using the encrypted presentation-state helper, and safely retried on storage failure. Replay/reset dev events carry the course ID. The overlay measures the target and scroll viewport and bounds detent retries for oversized/clipped targets.
- Count and progress layout use intrinsic/wrapping rows rather than fixed clipped text. The 360dp/font-scale-1.3 native capture showed no clipping in the waypoint header, count, progress action, or full move detail.
- The teaching replay/reset buttons are exposed through the existing `V2ChartPreview` dev surface consumed by the lab host; this is the implementation's dev-control wiring.

## Changed paths and shared-checkout scope

This shared checkout also contains unrelated, concurrent Chart-opening/ink changes. The combined uncommitted source list is in the parent task's git status; the One Move implementation paths are:

```text
anchor/mobile/src/components/v2/chart/ChartActiveView.tsx
anchor/mobile/src/components/v2/chart/ChartOneMoveRow.tsx
anchor/mobile/src/components/v2/chart/ChartWaypointContent.tsx
anchor/mobile/src/components/v2/chart/map/chartProgress.ts
anchor/mobile/src/components/v2/chart/map/__tests__/chartProgress.test.ts
anchor/mobile/src/components/v2/chart/panel/__tests__/ChartActiveView.test.tsx
anchor/mobile/src/components/v2/chart/panel/__tests__/ChartWaypointContent.test.tsx
anchor/mobile/src/components/v2/chart/sheet/ChartOneMoveTeaching.tsx
anchor/mobile/src/components/v2/chart/sheet/ChartSheet.tsx
anchor/mobile/src/components/v2/chart/sheet/ChartSheetContent.tsx
anchor/mobile/src/components/v2/chart/sheet/__tests__/ChartOneMoveTeaching.test.tsx
anchor/mobile/src/components/v2/chart/sheet/__tests__/ChartSheetContent.test.tsx
anchor/mobile/src/components/v2/chart/sheet/chartOneMoveTypes.ts
anchor/mobile/src/components/v2/chart/__tests__/ChartOneMoveRow.test.tsx
anchor/mobile/src/hooks/v2/chart/chartTaughtState.ts
anchor/mobile/src/hooks/v2/chart/__tests__/chartTaughtState.test.ts
anchor/mobile/src/constants/v2/chartCopy.ts
anchor/mobile/src/screens/v2/system/V2ChartPreview.tsx
```

No production or test source was modified by this reviewer; only QA documentation, raw logs, and screenshots were added. No commits were made.
