# Anchor 2.0 Vision stabilization — 2026-10-09

## A. Executive summary

Implemented the existing Vision workflow without replacing its print stage, arrival flight, saved board, or generated candidate selection. Personal photos now have a browsable stack and one completion action. The saved board stays open until the user leaves. Captions and the active photo's arrival identity are preserved independently of saved image order. Both client and backend now support eight images.

The ready-asset seal uses a nominal 2,460 ms timeline. Slow persistence remains explicit through the Saving status. This is a source-level timing budget, not a measured device duration or frame-rate result.

Native visual, gesture, keyboard, and performance acceptance is outstanding. Backend/client eight-image support must ship together. No deployment, OTA, or commit was performed.

## B. Root cause analysis

All mobile paths below are relative to `anchor/mobile/src/`.

| Issue | Confirmed source cause | Correction and references |
|---|---|---|
| Uploaded photos could not cycle | The ceremony rendered personal photos by fixed index without an active-stack navigation contract. | `components/v2/vision/ceremony/VisionPhotoStack.tsx` uses stable keys, tap and horizontal swipe, wraparound, an active-photo ref for rapid input, and a count indicator. All prints remain mounted; only three papers are visible. `VisionCeremony.tsx` integrates active-relative placement and gates gestures during sealing/keyboard editing. |
| Seven/eight photos could not survive creation | Picker, board and server shared a six-image limit. Detail layouts stopped at six. | `board/visionBoardLayouts.ts` and `backend/src/domain/v2/vision.ts` now cap at eight. Detail-only seventh/eighth placements extend the existing composition; Visualize retains its camera layout and its timeline accommodates the saved maximum. |
| Completion copy/action was inconsistent | Personal photos and generated selection used the same Keep action and a separate hold-to-seal step. | `VisionCeremony.tsx` commits directly from the CTA: personal/final single-candidate state uses Complete Vision; multiple usable AI candidates retain Keep this one. A PARTIAL job still waits. |
| Caption/arrival could refer to the wrong photo | Caption persistence attached the editable caption to image zero; arrival selected the first uploaded asset even when another photo was in front. | Per-photo caption map plus optional `arrivingAssetId` in `V2VisionCreationFlow.tsx`, `ceremony/useVisionCreationActions.ts`, and `screens/v2/vision/V2VisionScreen.tsx` preserve order, metadata, individual captions, and the active flight destination. |
| Long seal/late placement | The previous additional hold, 1,600 ms minimum sealed dwell, 1,100 ms board rise, and repeated prefetch could extend presentation. | Existing motion is retained with 650 ms movement, 400 ms stamp, 200 ms minimum dwell, 450 ms rise and the existing arrival flight. `VisionDevelop.ts`, `VisionCeremony.tsx`, and `V2VisionScreen.tsx` deduplicate warming and warm all saved images. Readiness requires native development of every selected personal image. |
| Unexpected navigation after sealing | `V2VisionScreen.tsx` scheduled first-image navigation to `V2DevelopmentHome` after a dwell. No automatic Anchor Details dispatch was found in that path. | Removed that effect and return state. Completion switches to the saved board on the current route; existing Back controls remain. |
| Leaving during sealing / background handoff | Route removal had no sealing guard; async handoff required foreground and once-only protection. | Synchronous sealing notification/ref, installed React Navigation 6 `UNSTABLE_usePreventRemove`, disabled native back gesture while busy, and immediate `beforeRemove` fallback. Ceremony pauses board rise while backgrounded, resumes remaining duration, and hands off once. |
| Generated-image retry stayed disabled | Integration regression exposed a real race: image error reentered Develop, reset completed reading, then an already-developed sibling immediately entered Choose and canceled the reading timer. The retried print could never reveal. | `VisionCeremony.tsx` preserves completed reading for the same generation attempt. Retry refreshes the existing job, renews stabilized URLs, and resets only failed images with retry tokens. `VisionPrint.tsx` reloads native image views while retaining print identity. |
| Blank Details preview | Preview selected only tile zero; Details content gating also examined tile zero. An unresolved first asset hid a valid later asset. | `VisionBoardPreview.tsx` and the one-line selection change in `screens/v2/anchors/V2AnchorDetailsScreen.tsx` select the first renderable existing URL. No preview generation pipeline added. Fixture regressions reproduce this source cause; the user's live saved record was not inspected. |
| Unrecoverable rendering failure / obstructed helper | Failed images had no interactive retry; helper/CTA/stack input could compete with keyboard editing. | Preview and interactive saved board expose image retry. Ceremony shows failure/replacement and Saving states, hides helper/CTA and disables stack browsing while keyboard is open, and shows rewrite guidance only during editable Keep. Existing Done dismissal and safe-area geometry are retained. Native overlap remains unverified. |

The exact cause of the reported native visual glitch cannot be certified without a recording of the authenticated route. Corrected wrong-photo handoff, retry lifecycle and loading defects are demonstrated by regression tests; frame pacing is not.

Navigation implementation was checked against the installed package and [React Navigation's native-stack guidance](https://reactnavigation.org/docs/navigation-events/).

## C. Luna sub-agent report

| Agent | Assignment / actual changes | Integration issues |
|---|---|---|
| A — flow | Inspected personal/generated persistence and navigation. Removed first-image automatic return in `V2VisionScreen.tsx`; added stay-on-board and initial multi-photo screen tests. | Transferred screen ownership to lead for integration. Later independently reviewed B/C/D and lead changes; lead reviewed A's original changes. A did implement part of navigation, so that portion is not a fully fresh-agent review. |
| B — stack | Added `VisionPhotoStack.tsx` and its tests; added image-error callback in `VisionPrint.tsx` and continuity coverage. | Explicitly transferred stack/print ownership to C before integration. Lead review caught and corrected worklet dispatch, caption identity and arrival assumptions during integration. |
| C — seal | Changed `VisionCeremony.tsx`, `VisionDevelop.ts`, `VisionPrint.tsx`, stack integration, ceremony copy, and ceremony/continuity tests. Integrated foreground lifecycle, saving state, retries, and direct completion. | Lead rejected a transient early single-candidate advance during PARTIAL generation; restored terminal-only choice. Lead independently found/fixed the generated retry reading race. `VisionSealHold.tsx` was audited and remains unchanged. |
| D — copy/preview | Changed `VisionBoardPreview.tsx` and its tests. Audited caption keyboard controls and existing SavedVision safe-area behavior. | Lead added the Details content-gate regression and interactive saved-board retry. No changes to unrelated Details/Chart work. |
| Lead — integration | Added eight-image client/server support and layouts, per-photo persistence and arrival contract, saved-board retry, navigation guards, all-image prewarming, Details gate fix, final retry race correction, and regression coverage. | Shared checkout contained unrelated Chart, audio and Anchor creation changes. Those were preserved. Windows write locks required sequential ownership and retries. |

## D. Test results

Final results are recorded in `anchor/mobile/docs/qa/vision-stabilization-20261009/`.

| Check | Result / evidence |
|---|---|
| Integrated mobile Vision + Details + Visualize + navigator tests | **54 suites, 577 tests passed; 0 failed**, 149.212 seconds. `tests-final.txt`. No filtered-out scenarios or skipped tests in this final run. |
| Backend Vision schema/service/caption tests | **3 suites, 26 tests passed; 0 failed**. `backend-vision-tests.txt`. |
| Full mobile TypeScript: `npx tsc --noEmit` | **PASS, 0 diagnostics**. `typecheck-final.txt`. Earlier Vision diagnostics were corrected; a concurrent unrelated creation-flow diagnostic was fixed by the other work before this final check. |
| Full backend TypeScript: `npx tsc --noEmit` | **PASS, 0 diagnostics**. `backend-typecheck-final.txt`. |
| Targeted backend ESLint: `src/domain/v2/vision.ts` | **FAIL, 22 existing Prettier errors**; exact HEAD contents reproduced the same 22 findings. `backend-lint-final.txt` and `backend-lint-baseline.txt`. No new lint finding attributed to the limit/comment change. |
| Mobile lint | Not configured: no mobile ESLint script/configuration. No lint pass is claimed. |
| `git diff --check` | **PASS**. Line-ending warnings do not represent whitespace errors. |

The first two integrated runs failed (9 and 1 tests respectively); they are retained as `tests-integration-first.txt` and `tests-integration-second.txt`. The remaining retry regression revealed the reading lifecycle race and passed after the source fix. `retry-final.txt` is a filtered diagnostic run; its other tests are skipped by the filter, and all run in the final green suite. An earlier repository-wide run accidentally used an unsupported plural filter flag and was interrupted; `tests-baseline.txt` is not a complete suite result and is not used for acceptance. The full repository-wide test suite is not certified green.

The final integrated command, from `anchor/mobile`, was:

```powershell
npm test -- --runInBand --no-watchman --testPathPattern='src/(components/v2/vision|hooks/v2/vision|adapters/v2/vision|screens/v2/vision|screens/v2/practice/visualize|screens/v2/anchors/__tests__/V2AnchorDetailsScreen.test|navigation/v2/__tests__/AnchorV2Navigator)'
```

Covered by component/hook/service tests: 1/2/4/6/7/8 photos, stack tap/swipe direction and wrap, stable component identity, repeated input, captions/order/metadata, selected last-photo arrival, direct completion, AI PARTIAL wait and terminal choice, duplicate commit guards, persistence retry, image retry, foreground/background handoff, reopen without seal replay, completed-board navigation, Details unresolved-first-image preview, and Visualize lifecycle/timeline.

Platform limitations: Windows has no iOS simulator/physical device. Android emulator `emulator-5554` enumerates and answers a simple shell echo, but activity/package queries and a bounded screenshot attempt did not complete. No authenticated Android UI, gesture, animation, frame pacing, keyboard or native back test passed. No physical-device test was performed. React Native animations/gestures are mocked in Jest.

Still required on Android and iOS: real picker permissions/camera/library, 7/8 high-resolution image memory and crop, horizontal swipe versus scrolling/caption editing, rapid gestures, keyboard/safe-area visibility, native back during seal and after completion, loading/offline/re-signed URL recovery, measured duration and frame pacing, background/resume during arrival, and app termination followed by persisted-board recovery. No universal 60 fps claim is made.

## E. Independent quality review

Luna Agent A reviewed the integrated B/C/D and lead changes after implementation. The lead separately reviewed A's original navigation changes and all final code. This was a distinct review pass, though A was not an entirely new reviewer for its own earlier navigation removal.

| Category | Weight | Score / 10 | Evidence and deductions |
|---|---:|---:|---|
| Functional correctness | 25% | 9.3 | Counts, ordering, captions, candidate selection, retry and completion regressions pass. Real parent-scroll/gesture conflicts remain unverified. |
| Animation smoothness | 20% | 8.2 | Existing continuous stage and nominal 2.46-second choreography; timer/foreground tests pass. Native frame pacing and visual glitches have not been observed after the change. |
| Navigation and state lifecycle | 20% | 9.3 | Automatic return removed, same-tap removal guard, native-stack hook, once-only completion and background handoff tests pass. Hardware back and iOS swipe-back remain unverified. |
| Visual polish and copy | 15% | 8.8 | Correct CTA, current-photo indicator, caption/edit/retry states and Details preview regression pass. Native keyboard/safe-area/crop/layout comparison is outstanding. |
| Persistence and reliability | 10% | 9.1 | Ordered multi-upload payloads retain metadata and captions; active-photo arrival and retry tests pass. Process-kill/relaunch and real signed-URL failure recovery remain unverified. |
| Regression coverage | 10% | 9.4 | 577 mobile tests, 26 backend tests and full TypeScript checks pass. No native interaction coverage; existing backend lint errors and absent mobile lint remain. |

Weighted score: `9.3*.25 + 8.2*.20 + 9.3*.20 + 8.8*.15 + 9.1*.10 + 9.4*.10 = 8.995/10`, rounded to **9.00/10**. No unresolved critical source defect was found. The **9.2 acceptance target is not substantiated**. Automated state tests do not establish native motion smoothness or visual parity; repeated source changes cannot eliminate that evidence gap.

## F. Final verdict

**CONDITIONAL.** Functional implementation and focused regressions are complete, but Vision is **not yet approved to ship at the requested 9.2 quality bar**. Complete the Android/iOS checks above and rerun the independent review. Deploy the matching eight-image backend contract before distributing a client that allows seven/eight selections. Preserve the uncommitted boundary until release work is explicitly requested.

## Files changed by this assignment

Mobile prefix: `anchor/mobile/src/`.

- `components/v2/vision/V2VisionCreationFlow.tsx`
- `components/v2/vision/VisionBoardPreview.tsx`
- `components/v2/vision/__tests__/VisionBoardPreview.test.tsx`
- `components/v2/vision/board/VisionBoardPhoto.tsx`
- `components/v2/vision/board/visionBoardLayouts.ts`
- `components/v2/vision/board/__tests__/VisionBoardPhoto.test.tsx`
- `components/v2/vision/board/__tests__/visionCanvas.test.ts`
- `components/v2/vision/ceremony/VisionCeremony.tsx`
- `components/v2/vision/ceremony/VisionDevelop.ts`
- `components/v2/vision/ceremony/VisionPhotoStack.tsx` (new)
- `components/v2/vision/ceremony/VisionPrint.tsx`
- `components/v2/vision/ceremony/useVisionCreationActions.ts`
- `components/v2/vision/ceremony/visionCeremonyCopy.ts`
- `components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx`
- `components/v2/vision/ceremony/__tests__/VisionContinuity.test.tsx`
- `components/v2/vision/ceremony/__tests__/VisionPhotoStack.test.tsx` (new)
- `screens/v2/vision/V2VisionScreen.tsx`
- `screens/v2/vision/__tests__/V2VisionScreen.addImage.test.tsx`
- `screens/v2/vision/__tests__/V2VisionScreen.test.tsx`
- `screens/v2/anchors/V2AnchorDetailsScreen.tsx` (only Vision tile selection; preserves pre-existing edits)
- `screens/v2/anchors/__tests__/V2AnchorDetailsScreen.test.tsx` (one new Vision regression; preserves pre-existing tests)
- `screens/v2/practice/visualize/__tests__/cinematicTimeline.test.ts` (eight-image maximum expectation)
- `backend/src/domain/v2/vision.ts`
- `backend/src/domain/v2/__tests__/visionCaption.test.ts`
- This report and QA evidence under `anchor/mobile/docs/qa/vision-stabilization-20261009/`.
