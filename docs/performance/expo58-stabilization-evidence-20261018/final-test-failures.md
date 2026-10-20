# Final Expo 58 candidate Jest failures

The completed candidate run exited 1. This report uses `jest-candidate.json`; the original full-run capture stopped without a summary, so its failure count cannot be used as a completed baseline and the count difference is not proof of improvement.

**Final run:** 567 suites: 542 passed, 25 failed; 5,466 tests passed, 48 failed, 1 pending. `wasInterrupted=false`; `numRuntimeErrorTestSuites=0`. All 25 failed suites contain failed assertion records, so there are **0 suite-load failures** in this final JSON.

All original 34 failed-suite records are present in this run: **9 now pass, 25 still fail**, with **0 newly observed failed suites** outside the original list.

## Failed suites

| Suite | Failed tests | Classification | Concrete failure |
|---|---:|---|---|
| `src/adapters/v2/home/__tests__/adapters.test.ts` | 1 | product assertion needing investigation | Error: expect(received).toEqual(expected) // deep equality - Expected - 0 + Received + 27 @@ -24,6 +24,33 @@ "reached": false, "state": "CURRENT", "title": "Contact 3 creators", }, ], + "weatherProgress": Object { + "courseId":... |
| `src/adapters/v2/home/__tests__/isolation.test.ts` | 1 | product assertion needing investigation | Error: expect(received).toEqual(expected) // deep equality - Expected - 1 + Received + 3 - Array [] + Array [ + "E:\\AnchorQA\\expo58-stabilization-20261018\\candidate\\anchor\\mobile\\src\\screens\\v2\\home\\dailyShell.tsx", +... |
| `src/components/__tests__/ExportAnchorSheet.test.tsx` | 2 | product assertion needing investigation | Error: expect(received).toBe(expected) // Object.is equality Expected: "#14162B" Received: "#121A22" at Object.toBe (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\components\__tests__\ExportAnchorSheet.t... |
| `src/components/share/__tests__/useShareExportRenderer.integration.test.tsx` | 1 | timing/mock candidate | Error: thrown: "Exceeded timeout of 10000 ms for a test. Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout." at _getError (C:\Users\dwil... |
| `src/components/v2/chart/map/__tests__/ChartMap.test.tsx` | 1 | timing/mock candidate | Error: expect(jest.fn()).toHaveBeenCalledTimes(expected) Expected number of calls: 1 Received number of calls: 0 at Object.<anonymous> (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\components\v2\chart\m... |
| `src/components/v2/chart/map/__tests__/ChartMapWeather.test.tsx` | 1 | unresolved | Error: expect(received).toBe(expected) // Object.is equality Expected: 0 Received: undefined at Object.toBe (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\components\v2\chart\map\__tests__\ChartMapWeathe... |
| `src/components/v2/chart/map/__tests__/chartMapResources.test.tsx` | 1 | timing/mock candidate | Error: Unable to find an element with testID: chart-map-marker-0 [36m<View>[39m [36m<View[39m [33mstyle[39m=[32m{ { "opacity": 0, } }[39m [36m>[39m [36m<View[39m [33maccessibilityElementsHidden[39m=[32m{true}[39... |
| `src/components/v2/creation/__tests__/V2CreationFlow.test.tsx` | 1 | product assertion needing investigation | Error: expect(received).toBe(expected) // Object.is equality Expected: "<svg viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" color=\"#FFFFFF\"><g><path d=\"M 38.73,38.53 L 39.54,79.27 L 58.4,18.02 L 78.57,39.84 L 7... |
| `src/components/v2/home/__tests__/homeArrival.test.tsx` | 1 | timing/mock candidate | Error: expect(received).toBeLessThan(expected) Expected: < 1 Received: 1 at Object.toBeLessThan (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\components\v2\home\__tests__\homeArrival.test.tsx:241:46) at... |
| `src/components/v2/home/__tests__/homeArrivalEvolved.test.tsx` | 2 | timing/mock candidate | Error: expect(received).toBeCloseTo(expected) Expected: 0.22 Received: 0 Expected precision: 2 Expected difference: < 0.005 Received difference: 0.22 at Object.toBeCloseTo (E:\AnchorQA\expo58-stabilization-20261018\candidate\an... |
| `src/components/v2/home/__tests__/homeArrivalRelease.test.tsx` | 1 | timing/mock candidate | Error: expect(received).toBeCloseTo(expected) Expected: 1 Received: 0.94 Expected precision: 2 Expected difference: < 0.005 Received difference: 0.06000000000000005 at Object.toBeCloseTo (E:\AnchorQA\expo58-stabilization-202610... |
| `src/components/v2/release/__tests__/V2ReleaseCompletion.test.tsx` | 1 | timing/mock candidate | Error: expect(received).toBe(expected) // Object.is equality Expected: 0 Received: 1 at Object.toBe (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\components\v2\release\__tests__\V2ReleaseCompletion.test... |
| `src/components/v2/vision/board/__tests__/VisionBoardPhoto.test.tsx` | 1 | product assertion needing investigation | Error: expect(jest.fn()).toHaveBeenCalledWith(...expected) Expected: "p1" Number of calls: 0 at Object.<anonymous> (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\components\v2\vision\board\__tests__\Visi... |
| `src/components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx` | 3 | timing/mock candidate | Error: expect(received).toBe(expected) // Object.is equality Expected: 1 Received: 0 at Object.toBe (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\components\v2\vision\ceremony\__tests__\VisionCeremony.t... |
| `src/navigation/v2/__tests__/homeDetailsCoverage.test.tsx` | 1 | timing/mock candidate | Error: expect(jest.fn()).toHaveBeenCalledTimes(expected) Expected number of calls: 1 Received number of calls: 0 at toHaveBeenCalledTimes (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src |
| `src/navigation/v2/__tests__/homeDetailsReverseTransition.test.tsx` | 2 | timing/mock candidate | Error: expect(received).toBeTruthy() Received: null at Object.toBeTruthy (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src |
| `src/navigation/v2/__tests__/progressSharedTransition.test.tsx` | 1 | timing/mock candidate | Error: Unable to find an element with testID: v2-anchor-transition-copy [ [36m<View>[39m [36m<View[39m [33mtestID[39m=[32m"details-art"[39m [36m>[39m [36m<Text[39m [33mtestID[39m=[32m"details-art-state"[39m [36... |
| `src/screens/create/flow/__tests__/creationFlowSounds.test.tsx` | 1 | timing/mock candidate | Error: expect(jest.fn()).toHaveBeenCalledWith(...expected) Expected: "anchorPulse" Received 1: "uiTap" 2: "distillTick", 0.5 3: "distillTick", 0.5 Number of calls: 16 at Object.toHaveBeenCalledWith (E:\AnchorQA\expo58-stabiliza... |
| `src/screens/rituals/__tests__/ActivationScreen.test.tsx` | 16 | timing/mock candidate | Error: Unable to find an element with testID: completion-modal-done [36m<View>[39m [36m<View>[39m [36m<LinearGradient />[39m [36m<View />[39m [36m<View />[39m [36m<View>[39m [36m<View />[39m [36m<View />[39m [3... |
| `src/screens/v2/chart/__tests__/V2ChartScreen.test.tsx` | 1 | timing/mock candidate | Error: expect(received).toBeNull() Received: {"_fiber": {"_debugHookTypes": null, "_debugInfo": null, "_debugNeedsRemount": false, "_debugOwner": [FiberNode], "_debugStack": [Error: react-stack-top-frame], "_debugTask": null, "... |
| `src/screens/v2/home/__tests__/homeRenderBudget.test.tsx` | 1 | product assertion needing investigation | Error: expect(received).toEqual(expected) // deep equality - Expected - 0 + Received + 1 Object { "Today": 1, + "Vision": 1, } at Object.toEqual (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\screens\v2\... |
| `src/screens/v2/practice/visualize/__tests__/V2VisualizePreparation.test.tsx` | 1 | timing/mock candidate | Error: expect(received).toBeUndefined() Received: {"accountId": null, "ambient": false, "anchor": {"activationCount": 0, "baseSigilSvg": "<svg viewBox=\"0 0 10 10\"><path d=\"M1 1L9 9\"/></svg>", "category": "career", "createdA... |
| `src/screens/vault/__tests__/AnchorDetailScreen.test.tsx` | 3 | unresolved | Error: expect(jest.fn()).toHaveBeenCalledWith(...expected) Expected: ObjectContaining {"showOrbs": false, "variant": "practice"} Number of calls: 0 at Object.<anonymous> (E:\AnchorQA\expo58-stabilization-20261018\candidate\anch... |
| `src/services/audio/__tests__/SoundPool.test.ts` | 1 | product assertion needing investigation | Error: expect(received).toBe(expected) // Object.is equality Expected: 16 Received: 24 at Object.toBe (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\services\audio\__tests__\SoundPool.test.ts:264:28) at ... |
| `src/stores/v2/__tests__/creationStore.test.ts` | 2 | product assertion needing investigation | Error: expect(received).toBe(expected) // Object.is equality Expected: "career" Received: "desire" at Object.toBe (E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile\src\stores\v2\__tests__\creationStore.test.ts:... |

## Confirmed mock and fixture repairs

- Candidate focused runs confirmed 6 repaired suites now passing in the full run: `AppStartupHydration`, `PracticeScreen`, `NotificationSettingsScreen`, and the three paywall suites. Repairs supplied missing local `getState`, `removeItem`, and Skia `PathBuilder.Make` chain/detach helper (`RuntimeEffect.Make` was already in the baseline global mock); App startup also received the inactive developer-host image fixture and notification subscription cleanup stub.
- The two `MockNativeMethods` import-path corrections are represented by the now-passing `V2AnchorDetailsScreen` and `V2PracticeAnchorTransition` suites.
- These account for the 8 verified mock/import repair suites. The ninth now-passing suite is `ChartSummitAndRouteScenes`; this report does not attribute its pass to a candidate mock repair. Focused evidence files: `mock-repairs-jest.json` and `mock-repairs-app-startup.json`.

## Original suites now passing

- `src/__tests__/AppStartupHydration.integration.test.tsx`
- `src/components/v2/chart/panel/__tests__/ChartSummitAndRouteScenes.test.tsx`
- `src/components/v2/paywall/twoStep/__tests__/PaywallPreviewTiles.test.tsx`
- `src/screens/practice/__tests__/PracticeScreen.test.tsx`
- `src/screens/v2/anchors/__tests__/V2AnchorDetailsScreen.test.tsx`
- `src/screens/v2/notifications/__tests__/NotificationSettingsScreen.test.tsx`
- `src/screens/v2/paywall/__tests__/V2PaywallScreen.motion.test.tsx`
- `src/screens/v2/paywall/__tests__/V2PaywallScreen.test.tsx`
- `src/screens/v2/practice/__tests__/V2PracticeAnchorTransition.test.tsx`

## Remaining interpretation

Failure classifications are investigative triage, not root-cause proof. “Timing/mock candidate” failures remain open for runtime-vs-test-clock/mock diagnosis; product assertions and unresolved failures need contract/source investigation. No tests or thresholds were changed for this report.


