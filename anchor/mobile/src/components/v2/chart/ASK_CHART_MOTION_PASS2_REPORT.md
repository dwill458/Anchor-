# Ask Chart motion, Pass 2

Implemented October 26, 2026. Changes are confined to `anchor/mobile/src`. No commit, backend change, API change, storage change, or locked Ask-file edit was made.

## Initial audit

Before editing, `git status --short` and `git diff --stat` showed a shared dirty checkout: 60 tracked files changed, 1,366 insertions and 1,014 deletions, plus untracked work. This included the approved Ask changes and partial Pass 2 implementation. Those existing changes were preserved.

The remote prototype could not be fetched. The attached `1-Anchor-Ask-Chat.html` and the explicit Pass 2 specification were read. The written product rules take precedence over the prototype's full-route shortcut.

| Item | Before this pass | Result |
| --- | --- | --- |
| 1a | Existed | Reused immediate `runPlan`, 450 ms Ask fade, mounted Ask with disabled interaction, inverse map opacity. Existing `useStagedCopy` starts generation copy at 220 ms, approximately halfway through the hand-off. Added coverage. |
| 1b | Existed | Reused the existing optional `handoffThinking` prop; no locked Ask edit. |
| 1c | Existed | Generation still consumes back without leaving. Added coverage. |
| 2a | Partly | Static current/done/pending checklist existed. Added category dot, 900 ms pulse cycle, 160 ms text crossfade and once-only 180 ms check overshoot. |
| 2b | New | Two Light stage-completion impacts and Medium on ready, once each; reduced motion skips them. |
| 2c | Partly | Polaroid existed. Added ink cover developing after 300 ms over 1,400 ms; URL ref prevents replay. |
| 2d | Partly | Long-wait phrases existed. Added 2,400 ms opacity breath, cancelled on arrival. |
| 2e | Partly | Existing survey/flag sequence retained. Last check completes at flag appearance; status fades at 1,600 ms for 300 ms before the existing finish callback. |
| 2f | Existed | Mapping constants, `firstArc`, finish timer and `onRevealed` behavior unchanged. |
| 3a | New | Explicit proposal-keyed layout-effect scroll reset and protection against a globally focused input outside the new review. |
| 3b | Existed | Panel still starts immediately, using `TT.panelIn` and settle easing. |
| 3c | Partly | Row entrance/key tracking existed. Added intro at panel-in + 80 ms, destination after intro, then 360 ms rows with 70 ms stagger capped after row eight. Proposal identity resets the entrance; edits, additions, reorders and cancelled Adjust do not. |
| 4a | Existed | Reused compact destination, export, 19/25 serif line, layout order and no card padding. |
| 4b | Existed | Reused `renderRowExtra`, measured outer column, inner title row, indent and title-centred rail. Added expanded-last-row coverage. |
| 4c | Partly | Folded input and first-named-row association existed. Moved auto-height state into `OneMoveBlock`; retained input props, Pencil and testIDs. |
| 4d | Partly | Focus measurement on viewport/content changes existed. Added focus handling and a review-only native keyboard fallback for modal presentations. Verified on the phone at 360 x 667 dp. |
| 4e | Existed | Reused secondary-colour vertical grip and original hit area. |
| 4f | Existed | Reused 0.8/1.2 footer proportions, nonwrapping labels below font scale 1.3, and larger-type wrapping. |
| 4g | Existed | Adjust, add-at-bottom, rename, remove, drag, locks, minimum one and maximum twelve retained. Drag verified on device; existing behavior suites pass. |
| 3.5 analytics | New | `chart_review_entered { waypoints, source }` once per proposal; `chart_review_next_move_edited {}` only on the first actual next-move change per proposal. No event renames. |

## Headline and keyboard findings

`ChartKeyboardFrame` previously called its reveal routine on layout/content changes using `TextInput.State.currentlyFocusedInput()`, a global input. Ask remains mounted during hand-off, so that input can still be the Ask composer. The frame had neither a proposal reset nor a check that focus originated inside the new review. A regression test reproduced the unwanted scroll with a retained external input. The exact original recording was not available to prove this was its only cause.

The review now resets to `{ y: 0, animated: false }` on mount/proposal changes. It enables focused-field scrolling only after focus originates inside its scroll view. Existing non-review frame behavior is preserved.

On the Samsung phone's native review modal, the UI-thread keyboard observer did not receive a height: the keyboard covered the footer and focused field. The review now opts into native keyboard-event/metrics fallback when the observer reports zero. Its resulting viewport change reuses the existing measurement/clearance mechanism. No separate one-move scroll offsets were introduced. A focus event also invokes that same mechanism when the keyboard is already open.

In the final small-phone capture, the input's visible bounds end at physical y=924 and the pinned buttons occupy y=1038..1246, above the keyboard. Both buttons remain on the same row.

## Files changed by this pass

- `components/v2/chart/ChartCreationFlow.tsx`: proposal identity, persisted entrance tracking, additive analytics.
- `components/v2/chart/ChartGenerationStage.tsx`: checklist, stage haptics, developing print, long-wait breath and status exit.
- `components/v2/chart/ChartCourseReviewScreen.tsx`: staged intro/destination, proposal reset, isolated auto-height block, keyboard fallback opt-in.
- `components/v2/chart/ChartKeyboardFrame.tsx`: review reset, local-focus guard, focus reveal and optional native-modal fallback.
- `screens/v2/system/ChartLabDevHost.tsx`: development toolbar `pointerEvents="box-none"`; its background intercepted touches over Continue. This allowed the existing fixture to exercise the actual flow.
- `components/v2/chart/__tests__/ChartGenerationStage.motion.test.tsx`: new.
- `components/v2/chart/__tests__/ChartCreationFlow.motion.test.tsx`: new.
- `components/v2/chart/__tests__/ChartCourseReviewScreen.motion.test.tsx`: new.
- `components/v2/chart/__tests__/ChartKeyboardFrame.test.tsx`: new.
- `components/v2/chart/__tests__/ChartRouteEditor.motion.test.tsx`: added expanded-last-row rail test to the pre-existing untracked suite.
- This report.

`ChartRouteEditor.tsx`, the existing `ChartCourseReviewScreen.test.tsx`, `chartMotion.ts` and `chartCopy.ts` already contained relevant changes at the initial audit; this pass did not edit them.

## Test results

Before implementation, the requested existing selection plus route, preview and input regression suites reported:

```text
Test Suites: 9 passed, 9 total
Tests:       186 passed, 186 total
Snapshots:   15 passed, 15 total
Time:        30.997 s
```

Separate photo/preview verification reported 10 suites, 158 tests and 15 snapshots passing. The reported historical 10 ChartPreview snapshot failures and 5 Vision photo-picker failures did not reproduce: observed counts were 0 before and 0 after. No snapshot update or unrelated test repair was performed.

Final expanded selection includes all the new motion/frame suites, existing review, V2ChartScreen, ChartCreationFlow, AskChartView, V2ChartFlows, route motion, ChartPreview and photo/picker suites:

```powershell
npx jest --runInBand --watch=false --silent --testPathPatterns='ChartCourseReviewScreen|V2ChartScreen.test|ChartCreationFlow|AskChartView.test|ChartRouteEditor.motion|ChartKeyboardFrame.test|ChartGenerationStage.motion|ChartPreview.test|visionPhoto|VisionAddPhoto|PhotoPicker|V2ChartFlows.test'
```

```text
Test Suites: 20 passed, 20 total
Tests:       267 passed, 267 total
Snapshots:   15 passed, 15 total
Time:        45.941 s
```

Failure count: **0 before -> 0 after**. The final selection is larger because it includes new tests and additional regression suites.

```text
npx tsc --noEmit --pretty false
[no diagnostic output]
Exit code: 0
```

Whitespace verification passed. Git emitted pre-existing CRLF-normalization warnings for dirty files; no whitespace errors were reported.

## Device evidence and limits

Samsung SM-S928U1, Android 16; temporary 1440 x 2668 pixel display at density 640, yielding 360 x 667 dp. Original physical size 1440 x 3120, density 600, automatic rotation 1 and user rotation 0 were restored after testing.

Evidence is outside the checkout, in `C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/`:

- [Draft -> generation -> review recording](C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/handoff-generation-review.mp4)
- [Hand-off frames](C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/handoff-frames.png)
- [Review entrance frames](C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/review-entrance-frames.png)
- [Review arrival](C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/review-arrival-360x667.png)
- [Final keyboard clearance](C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/review-keyboard-360x667-final.png)
- [Expanded-row reorder](C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/review-after-drag.png)
- [Reduced-motion review](C:/Users/dwill/AppData/Local/Temp/anchor-chart-pass2/review-reduced-motion.png)

The recording shows the Ask surface fading into the map with no blank frame, the flag/check completion, status exit and staged review with a fully visible headline. The first expanded row was dragged below the next row; the next-move block followed the new first waypoint. Reveal saved through the existing fixture API and reached the active Chart with the reordered first waypoint. A separate reduced-motion fixture run reached review successfully. Keyboard clearance and one-row footer were checked in the standalone review fixture.

The existing motion lab uses `preview-anchor`, which cannot open a real Ask conversation. Its supported opening-error "Draft my route now" action was used, followed by its nine-second fixture planner. This is real component/native-motion evidence, not a completed live conversation or authenticated production save. No real account Chart was created.

The lab provides no image URL, so print development/re-render protection was verified by Jest, not visually on device. Long-wait breathing and once-only haptic calls were verified by Jest; subjective haptic feel was not independently scored. Native iOS acceptance remains unverified. The lab's teaching toolbar and the phone's keyboard accessory overlays remain visible in some captures.

Locked Ask behavior, the opening, paywall wiring, route/API/storage contracts, sound, survey geometry, route high-water rules, `save()`, reveal flattening, `exploreDelta` and `chartMapScreenTop` were deliberately not changed.
