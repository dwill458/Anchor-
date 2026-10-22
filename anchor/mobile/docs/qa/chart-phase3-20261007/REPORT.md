# Chart phase 3 — implementation and QA

Implemented in `anchor/mobile/src`. Changes are uncommitted. Existing unrelated work was preserved.

## Result

The active Chart has a window-sized map, an ink sheet with hidden/peek/half/full positions, fixed tier frames, UI-thread dragging/flicks, a separate map dim, camera recession on settled detents, route segments/list, waypoint inspection, and the existing modal/handler owner. Move/reach/arrival requests force peek. Content changes wait for the sequence's existing call steps or completion and fade in place. The old panel render and removed layout calculations remain marked `// DEFERRED:`.

The supplied **Chart Entrance Prototype (2).html** was inspected. Its sheet preview uses the same ink/radius/grabber/map-recession pattern. Prompt numbers override its full position: a 390×844 screen with 47/34 insets uses hidden 844, peek 648, half 371, full 220. The plan document and separately named Chart Sheet Prototype were not available in the workspace.

Existing card props/handlers remain in use. A compact density context adapts the peek cards to the fixed frame; other moves and secondary day-closed controls are reachable at full. Progress and waypoint editing retain one modal owner. No package dependencies, analytics events, route contracts, server mutation logic, Home/Details crop consumers, creation intro, or Pro-gate source were changed.

## Checks

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean; `tsc-delivery.log` |
| Chart/components/screens/hooks Jest | 70 suites pass, 1 fails; 651 tests pass, 10 existing ChartPreview snapshots fail; `verified-tests.json` |
| Scroll reset + sheet + active view + screen recheck | 59/59 pass; `scroll-recheck.json` |
| Added integration test: no tier renders between reach stamp and commit | 1/1 pass; `reach-render-test.json` |
| Final sheet/active/waypoint/screen recheck after final fixes | **92/92 pass**; `delivery-tests.json` |
| Android export after final source changes | Succeeded; `android-export-delivery.log` and `android-export-delivery/metadata.json` |
| Scoped `git diff --check` | Clean |

Added 18 test cases across five new test files (`ChartSheet`, `ChartSheetContent`, `ChartRouteSegments`, `ChartRouteList`, `chartFullBleed`) and the existing `ChartActiveView` suite. They cover detent maths, snap/flick selection, grabber labels/cycling, back to peek, busy drag gating, Reduce Motion timing, full-only scrolling/reset, peek priority, hidden tiers, upcoming inspection, content deferral/render counts, stored high-water hydration, route fill/meta/presses, and full-bleed land/live-weather transforms. Existing camera crop tests and creation weather/alignment tests pass. Updated screen and active-view expectations address the new tiers while retaining their behavior checks.

## Emulator performance

Only `emulator-5554` was reachable. These are **emulator numbers**, from the existing Android development client with JS development mode off and a minified Hermes-targeted bundle. Logcat confirmed `[chart-phase3-qa] JS_DEV=false`. The temporary entry uses the real Chart lab and its fake actions; it is not an authenticated production-route certification or an EAS preview build.

Measurements use `dumpsys gfxinfo com.anchorintentions.app framestats`. Samples were polled and concatenated to cover the complete interval rather than only the 120-frame ring buffer. `analyze_frames.py` de-duplicates by IntendedVsync, taking the latest FrameCompleted. FPS uses the full first-to-last vsync interval, with no stall filtering. Frame duration and vsync gap are reported separately.

| Scenario | Interval | FPS | Max frame duration | Max vsync gap | Target result |
| --- | ---: | ---: | ---: | ---: | --- |
| Warm idle at peek | 11.150s | 59.91 | 37.13ms | 33.33ms | **Fails** strict 32ms frame ceiling; fps passes |
| Peek→full→peek + three flicks | 6.633s | 59.85 | 35.36ms | 33.33ms | FPS/gap pass |
| Move check | 4.650s | 59.57 | 35.34ms | 33.33ms | FPS/gap pass |
| Reach | 4.583s | 58.04 | 50.58ms | 50.00ms | FPS/vsync-gap pass; frame duration is also shown |

Raw final samples are `idle-warm-framestats.txt`, `drag-final-framestats.txt`, `move-reboot-framestats.txt`, and `reach-reboot-framestats.txt`. All preliminary samples remain in `frame-results.json`. The earlier emulator session deteriorated (idle 52.38fps, move 46.15fps, reach 31.26fps), then Android's system process crashed with an AppOps IntRange error. The emulator was restarted without wiping data; final measurements above were taken afterward. This environmental recovery does not establish a code-only performance improvement. S24 Ultra acceptance remains unmeasured.

## Native interaction evidence and recordings

Verified in the lab: usable peek check, grabber expansion, drags/flicks, full content scrolling, downward sheet drag from the scroll top, hardware back to peek, route-row focus, numbered back action, map-tap return, move completion and confirmed reach. The waypoint flight stays focused when its peek snap finishes. A collapsed sheet resets its scroll offset so the half controls remain visible.

- [Final peek](peek-final.png), [full scrolled](scroll-full-verified.png), [pull down to peek](pull-down-verified.png), [upcoming waypoint focus](waypoint-focus-verified.png), [reach result](reach-reboot.png).
- [Cold open, original](cold-open-final.mp4) · [0.25×](cold-open-quarter.mp4).
- [Later visit, original](later-open.mp4) · [0.25×](later-open-quarter.mp4).
- [Create → Review → Explore, verified interaction run](create-verified.mp4) · [0.25×](create-verified-quarter.mp4).
- [Reach, original](reach.mp4) · [0.25×](reach-quarter.mp4).
- [Arrival, original](arrival.mp4) · [0.25×](arrival-quarter.mp4) · [Arrived at peek](arrival.png). Verified through three confirmed reaches in the lab.

The native lab's debug controls can be seen behind the sheet in recordings. Its fixture has no Vision image; Vision image/menu/log contracts remain covered by screen tests.

## Remaining acceptance limits

1. The strict idle “no frame over 32ms” target is not met on this emulator. No threshold was changed.
2. Mathematical creation alignment passes for multiple window/inset combinations, including the live weather frame regression test. **Pixel-exact/zero-frame handoff acceptance is not certified.** The first long emulator recording shows a brief cover/terrain discontinuity during the creation overlap (`create-review-explore.mp4`, `reveal-8fps.png`). The locked `ChartRevealHandoff` overlap/fade and creation choreography were preserved. Recordings are provided for review rather than a claim of zero discontinuities.
3. S24 hardware, authenticated production-route performance, listening/haptics and device Reduce Motion were not measured. Reduce Motion behavior is covered in tests.
4. The named plan document/separate sheet artifact could not be compared; the supplied entrance HTML and this prompt were used.

## Source files edited in this run

Paths below are relative to `anchor/mobile/`:

```text
src/components/v2/chart/ChartActiveView.tsx
src/components/v2/chart/ChartReachBeat.tsx
src/components/v2/chart/ChartWaypointContent.tsx
src/components/v2/chart/map/ChartMap.tsx
src/components/v2/chart/map/ChartMapLand.tsx
src/components/v2/chart/map/ChartMapMarkers.tsx
src/components/v2/chart/map/ChartMapOverlay.tsx
src/components/v2/chart/map/ChartMapWeather.tsx
src/components/v2/chart/map/ChartWeatherHold.tsx
src/components/v2/chart/map/ChartWeatherNativeVeil.tsx
src/components/v2/chart/map/chartMapGeometry.ts
src/components/v2/chart/map/useChartMapCamera.ts
src/components/v2/chart/map/__tests__/chartCreationWeather.test.tsx
src/components/v2/chart/map/__tests__/chartFullBleed.test.ts
src/components/v2/chart/panel/ChartPanelCards.tsx
src/components/v2/chart/panel/__tests__/ChartActiveView.test.tsx
src/components/v2/chart/panel/__tests__/ChartActiveViewReveal.test.tsx
src/components/v2/chart/sheet/ChartSheet.tsx
src/components/v2/chart/sheet/ChartSheetContent.tsx
src/components/v2/chart/sheet/ChartRouteSegments.tsx
src/components/v2/chart/sheet/ChartRouteList.tsx
src/components/v2/chart/sheet/__tests__/ChartSheet.test.tsx
src/components/v2/chart/sheet/__tests__/ChartSheetContent.test.tsx
src/components/v2/chart/sheet/__tests__/ChartRouteSegments.test.tsx
src/components/v2/chart/sheet/__tests__/ChartRouteList.test.tsx
src/constants/v2/chartCopy.ts
src/screens/v2/chart/__tests__/V2ChartFlows.test.tsx
src/screens/v2/chart/__tests__/V2ChartScreen.test.tsx
```

QA artifacts/scripts/logs are contained in this directory. The temporary Metro entry and proxy are archived here for reproducibility; they do not replace the app entry or package configuration. The existing dirty `useChartSound` changes were not edited in this run.

The temporary QA servers on ports 8093/8094 were stopped and their ADB forwards removed. The shared Metro server on 8081 was preserved. Older `android-export/` and `android-export-final/` folders remain because automatic approval review blocked their removal; `android-export-delivery/` is the final export. `create-final*` and `full-scrolled.png` came from a failed coordinate-based automation attempt and are not acceptance evidence; the verified recordings/screenshots linked above use visible control labels.
