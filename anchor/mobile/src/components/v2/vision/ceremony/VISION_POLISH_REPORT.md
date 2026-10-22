# Vision picker, paper, seal, and arrival polish — October 9, 2026

Implementation is confined to `anchor/mobile/src`. Device acceptance remains open. No commit, OTA, deployment, backend change, route rename, API-path change, storage-key change, or existing analytics-event rename was made.

## Reference audit before implementation

The checkout is local `feat/celebration-layer`, at `814905b4`. Current ceremony/board work is present here through `9d15d93a`; the suggested `anchor-2/ui-g-vision-chart-progress` and `anchor-2/core-c-vision-weekly-insight` branches contain earlier Vision components but not this ceremony/board implementation.

| Reference file, relative to `src` | Source branch | Behavior reused |
| --- | --- | --- |
| `components/v2/vision/ceremony/VisionCeremony.tsx` | local `feat/celebration-layer` | Existing beats, stamp timing, save/retry contract, coordinator request, foreground handling, in-place board handoff |
| `components/v2/vision/ceremony/VisionDevelop.ts` | local `feat/celebration-layer` | 1600ms hold, 650ms print movement, 400ms stamp, 450ms board rise, 550ms pin drop, Reduce Motion durations |
| `components/v2/vision/VisionImageArrival.tsx` | local `feat/celebration-layer` | Measuring the real board aperture, decoded-image readiness, 760ms flight, bounded recovery; legacy single-image API remains available |
| `components/v2/vision/board/VisionBoard.tsx`, `VisionBoardScene.tsx`, `visionBoardLayouts.ts` | local `feat/celebration-layer` | Existing tile-count slots and geometry; no new board composition |
| `components/v2/vision/board/VisionBoardPhoto.tsx` | local `feat/celebration-layer` | Existing gold arrival pin and UI-thread board movement |
| `screens/v2/vision/V2VisionScreen.tsx` | local `feat/celebration-layer` | Server-authoritative saved scenes, stable scene-ID matching despite refreshed signed URLs, staying on the board |
| `components/v2/threadEvents/V2ThreadEventCelebration.tsx` | checked on `anchor-2/ui-i-thread-events` and current checkout | Existing visual reference; this component has no sound/haptic trigger to copy |
| `stores/v2/celebrationStore.ts`, `utils/haptics.ts`, `services/CreationSounds.ts` | current checkout | Existing L4/L2 coordination, settings-aware Heavy/Medium requests, pooled seal/pin audio |

The requested celebration spec was absent locally and from remote `main`. Implementation initially stopped to report differences: later holds were 900ms, Heavy fired for later sets too, pins added Light, and generated ink/blur defaults were 1600/3400ms. The user then authorized using the current ceremony as the reference. The existing components and cue family were reused with the requested 1600ms hold and 2400ms generated ink/blur timing. Entrance-example timings remain unchanged.

## Resulting behavior

- Picker launch shows an ink holding state with the real Anchor breathing once. Missing native presentation evidence after 1500ms exposes retry and Back without losing the ceremony. Old attempts cannot overwrite a newer selection. Native focus-loss/AppState signals produce `vision_picker_open_ms`; timeout/launch errors produce `vision_picker_failed`.
- Own photos render sharply on cream paper, with a 600ms settle after decode, no ink/blur/develop copy, and no develop bed. Upload starts in parallel; successful and pending uploads are reused at Seal. Slow reads/uploads use a hairline. Scene persistence still happens only on completion.
- Multiple photos use stable, separately mounted paper cards on one UI-thread drag offset. Visible gap is 18pt; neighbors scale to 0.94, dim to 0.8, and rotate up to 2.5 degrees. Selection crosses at half the card distance. The release spring uses damping 18, stiffness 180, and release velocity. Dots sit below the cards; the photo counter is removed. Captions/hints remain on the paper; Replace moves beside Complete Vision. Existing support up to eight images is preserved.
- Generated candidates keep the existing ink/blur development component, now with the requested 2400ms timing. The wait bed stops when the first real candidate starts revealing.
- Seal draws a gold rule on the paper, sinks the print four points, and fades in “Sealed.” at the stamp. The first set requests one Heavy and seal cue there. Later sets do not request Heavy at the stamp. The sealed paper holds for at least 1600ms after the stamp and stays visible if persistence takes longer. Saving uses an indeterminate hairline that fills only on completion.
- Every selected asset persists as its own scene. Flights target each scene's measured existing board aperture, matched by scene ID. Available decoders and slots synchronize before the 120ms card-order stagger. Gold pins start after landing; captions fade after pin completion. The board Anchor stays at opacity zero until the last pin finishes. A later set requests one Medium at its first flight's impact; batch pins do not add Light/Heavy. Backgrounding pauses the flight timeline. Missing callbacks have a bounded fallback to the saved board. Temporary flight bitmaps unmount after completion.

## Verification

Final checks ran from `E:/Projects/Anchor/anchor/mobile`.

```text
npx tsc --noEmit
tsc exit code: 0
```

The compiler emitted no diagnostics. The exit-code line was printed by the command wrapper.

```text
npx jest --runInBand --watch=false --testPathPattern=vision --silent --json --outputFile=C:/Users/dwill/AppData/Local/Temp/vision-polish-delivery.json

Test Suites: 46 passed, 46 total
Tests:       383 passed, 383 total
Snapshots:   0 total
Time:        181.359 s, estimated 187 s
Test results written to: C:\Users\dwill\AppData\Local\Temp\vision-polish-delivery.json
```

`git diff --check` also passed. The report and every task-owned changed source/test file remain uncommitted.

Regression coverage includes own-photo decode readiness/600ms settle, no own-photo ink, picker timeout/retry/stale results and native presentation latency, pager half-distance selection and stable views, per-photo captions/source metadata/order, upload reuse after failed saves, route-removal protection, signed-URL refreshes, generated wait-bed cleanup, one first-set Heavy, one later-set Medium, pin-after-impact timing, 120ms staggering, slow-sibling synchronization, and bounded arrival recovery.

## Device acceptance still required

ADB listed `emulator-5554`. The ADB server was reset after shell commands hung; `sys.boot_completed` and a shell echo responded, but Android package/UI inspection and screenshot capture still timed out. No authenticated fresh-account first/second-image run, device celebration log transcript, visual comparison, hardware listening/haptic check, or frame-pacing acceptance is claimed.

Expo SDK 54's picker API exposes neither native thumbnail coordinates nor a search-autofocus option. The app dismisses its own keyboard and uses the native picker defaults; the settle starts from the local paper staging position, not an invented thumbnail coordinate. Google Photos' internal search focus must still be checked on the actual device. Open latency uses native focus loss as a proxy; when the platform exposes no signal, the log explicitly records that presentation was unobserved rather than treating selection time as open latency. See [Expo ImagePicker](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/) and [React Native AppState](https://reactnative.dev/docs/appstate).

`[celebration]` traces cover picker presentation/return, photo settled/print developed, seal stamp, arrival landed, and pin dropped. They record level, haptic request, and whether the sound pool returned a play handle. Haptic hardware delivery cannot be inferred from the current safe wrapper: the log explicitly marks it as requiring device verification. The fresh-account device requirement (one L4 first, one Medium later, no duplicates) remains open.

## Files changed by this task

Paths below are relative to `anchor/mobile/src`.

- `components/v2/vision/VisionImageArrival.tsx`
- `components/v2/vision/VisionArrivalSet.tsx`
- `components/v2/vision/__tests__/VisionArrivalSet.test.tsx`
- `components/v2/vision/board/VisionBoardIntentionCard.tsx`
- `components/v2/vision/board/VisionBoardPhoto.tsx`
- `components/v2/vision/ceremony/VisionCeremony.tsx`
- `components/v2/vision/ceremony/VisionHairline.tsx`
- `components/v2/vision/ceremony/VisionPhotoStack.tsx`
- `components/v2/vision/ceremony/VisionPickerHolding.tsx`
- `components/v2/vision/ceremony/VisionPrint.tsx`
- `components/v2/vision/ceremony/useVisionCreationActions.ts`
- `components/v2/vision/ceremony/visionCelebrationTrace.ts`
- `components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx`
- `components/v2/vision/ceremony/__tests__/VisionContinuity.test.tsx`
- `components/v2/vision/ceremony/__tests__/VisionPhotoStack.test.tsx`
- `components/v2/vision/ceremony/__tests__/VisionPickerHolding.test.tsx`
- `components/v2/vision/ceremony/VISION_POLISH_REPORT.md`
- `screens/v2/vision/V2VisionScreen.tsx`
- `screens/v2/vision/__tests__/V2VisionScreen.addImage.test.tsx`

An unrelated untracked root file, `ANCHOR_NOTIFICATION_FORENSIC_AUDIT.md`, appeared during this task and was left untouched.
