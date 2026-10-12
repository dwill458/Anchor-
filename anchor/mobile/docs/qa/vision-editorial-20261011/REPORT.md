> Superseded: the redesign documented below was reverted at the user's request. Current work is the original design with an uploaded-image fitting correction; see [current audit](../vision-upload-fit-20261011/AUDIT.md). Earlier screenshots and score describe the reverted design.

# Vision Board and Share Card editorial polish — 2026-10-11

## Enhanced artwork correction

Following review of the user's saved Board screenshot, the paper seal now forwards the Anchor's actual `enhancedImageUrl` and stored SVG expression to the existing `CircularAnchorRenderer`, matching the other Anchor surfaces. Enhanced artwork and expression geometry/paints are preserved; the cream recoloring applies only to a plain SVG without enhanced artwork or a recorded expression. The export readiness barrier now includes the enhanced artwork asset. The Board and Share Card both use this shared correction. Post-correction TypeScript passed, and three focused suites / 23 tests passed. Earlier gallery renders and the 9.3 score predate this correction; the user's actual enhanced artwork has not been recaptured in a native render.

Implemented with Luna agents for fitting, composition, Share Card, and independent QA; Sol integrated and reviewed the result. Verified production components on an Android emulator and actual saved PNG exports. The independent visual score is **9.3/10 for the reviewed Android fixtures**. Cross-platform and Regal-specific acceptance remain open as described below.

## Implemented improvements and architecture

- Board, Home/Details, and export share a single-image `VisionPhotograph` fitting path. Removed duplicated blurred background images and muddy sidebars. Uploaded photographs use conservative cropping only when at least 86% of their area is retained; unknown/extreme ratios use warm paper containment. Original sources remain intact. Decoded dimensions feed a bounded, stable URI aspect cache and adaptive composition.
- Canonical Board geometry drives the editor, compact previews, and export. One large hero anchors 1–8 photos, with deliberate rotations, restrained overlaps, source-aware frames, and a staggered three-landscape arrangement. Existing dense compact previews beyond eight remain supported; editor capacity is unchanged.
- Torn edges use multi-scale fibre contours with no dashed decorative strokes, eliminating the underlying right-edge artifact. Existing clipping and animation infrastructure is reused.
- The personal Anchor SVG retains its geometry and viewBox, with cream contrast on a dark seal and a restrained metallic rim. Seal diameter is approximately 30% larger than the previous detail treatment. Note-aware seam placement changes only the seal position; saved notes and photograph positions remain intact. Selecting a photograph fades the seal while keeping it mounted.
- Native serif word measurement balances intention lines without example-specific line breaks. Export waits for valid visible text measurement and image readiness. Export scene geometry settles immediately, avoiding an animated-layout capture race. Long intentions retain safe margins, and low-count cards balance their outer negative space. Vision-only bottom branding is about 12% larger.
- Source dimensions propagate through the existing Visualize preparation/session handoff so composition stays coherent. Existing saved Vision schema, image identities/order, notes, camera, animation timing, and route contracts are preserved. No dependencies, migrations, or unrelated Share Studio styles changed.

## Rendered evidence

[Open the full before/after gallery](gallery.html). Baseline images came from the actual original production components, temporarily restored for capture and then restored to the final implementation. All export examples are native saved PNGs at **1080 × 1920**; Board screenshots are **786 × 1704**. They are not HTML approximations.

| Photos | Actual Board | Actual saved Share Card |
|---|---|---|
| 1 | [Board](after-board-1.png) | [PNG export](after-export-1.png) |
| 2 | [Board](after-board-2.png) | [PNG export](after-export-2.png) |
| 3 | [Board](after-board-3.png) | [PNG export](after-export-3.png) |
| 4 | [Board](after-board-4.png) | [PNG export](after-export-4.png) |
| 8 | [Board](after-board-8.png) | [PNG export](after-export-8.png) |

[Before Board](before-board-3.png) / [after Board](after-board-3.png); [before Share preview](before-share-3.png) / [after Share preview](after-share-3.png); [before saved export](before-export-3.png) / [after saved export](after-export-3.png).

Mixed portrait/landscape/square and light/dark fixture photos, boundary-crossing notes, a long intention, and a wide personal SVG were reviewed in the gallery. Home and Details have matching 2/6/8-photo captures. Iteration and diagnostic captures are excluded from the gallery and acceptance evidence.

## Validation

- `npx tsc --noEmit --pretty false`: passed, exit 0; [log](typecheck-final.log).
- Relevant Vision components/screens, Share tests, Visualize tests, and Home Vision tests: **71 suites / 682 tests passed**, exit 0; [final log](verified-final-tests.log).
- Targeted regressions cover aspect-aware fitting, URI identity, adaptive geometry, torn-edge strokes, SVG paint/geometry, heading readiness including delayed native layout, note-safe seal placement, selected-photo signature restore, export readiness/frame bounds, and Visualize handoff.
- Scoped `git diff --check`: passed; line-ending notices only.
- Android runtime: photo selection/back restore, Add entry into the actual VisionMomentInput, native note drag and its local position update (bounds changed from `[44,446][238,608]` to `[84,472][278,634]`), PNG save, and Android native image-share chooser verified. No outgoing share message was sent. Existing automated interaction tests cover additions and note workflows.
- [Independent Luna QA review](QA_REVIEW.md): **9.3/10**, supported by hero/support hierarchy, sharp imagery, coherent paper edges, balanced exports, measured heading wrapping, and a readable personal signature. The long-intention eight-photo layout still compresses the collage.

## Limits and follow-up

- The attachment supplied the visual direction as a flattened image; individual original Regal photos were unavailable. Vehicle-specific framing cannot be confirmed from desk/home fixtures.
- Native iOS rendering/gestures, physical mid-range-device frame pacing, authenticated persisted additions/note edits, full opening/closing lifecycle, and live library-picker completion remain unverified. Android fixture route evidence does not establish those results.
- No semantic subject detector or focal schema was added. Source-aware frames and conservative upload fitting protect content; existing source/crop inputs are preserved. Unknown remote dimensions may cause one refinement after first decode. Extreme aspect mismatch retains neutral paper rather than fabricating image pixels.
- More than eight images retain the existing compact-preview behavior and editor limit; this task does not expand storage/editor capacity.
- Changes remain uncommitted. Existing unrelated chart, audio, and backend work was preserved. No OTA or deployment was performed.

## Every changed source/test file

Paths are relative to `anchor/mobile`. Evidence artifacts, logs, baseline backups, report, gallery, and independent review are under `docs/qa/vision-editorial-20261011/`.

- `src/components/share/__tests__/VisionExportTemplate.test.tsx`
- `src/components/share/templates/VisionExportTemplate.tsx`
- `src/components/share/visionBoardExportFrame.ts`
- `src/components/v2/vision/V2SavedVision.tsx`
- `src/components/v2/vision/VisionEditorialPreview.tsx`
- `src/components/v2/vision/VisionImageEdge.tsx`
- `src/components/v2/vision/VisionIntentionHeading.tsx`
- `src/components/v2/vision/VisionPhotograph.tsx`
- `src/components/v2/vision/__tests__/VisionEditorialPreview.test.tsx`
- `src/components/v2/vision/__tests__/VisionImageEdge.test.tsx`
- `src/components/v2/vision/__tests__/VisionIntentionHeading.native.test.tsx`
- `src/components/v2/vision/__tests__/VisionIntentionHeading.test.ts`
- `src/components/v2/vision/__tests__/VisionPhotograph.test.tsx`
- `src/components/v2/vision/__tests__/visionEditorialLayout.test.ts`
- `src/components/v2/vision/__tests__/visionImageGeometry.test.ts`
- `src/components/v2/vision/__tests__/visionPhotoDimensions.test.tsx`
- `src/components/v2/vision/board/VisionBoard.tsx`
- `src/components/v2/vision/board/VisionBoardIntentionCard.tsx`
- `src/components/v2/vision/board/VisionBoardPhoto.tsx`
- `src/components/v2/vision/board/VisionBoardScene.tsx`
- `src/components/v2/vision/board/__tests__/VisionBoard.test.tsx`
- `src/components/v2/vision/board/__tests__/VisionBoardIntentionCard.test.tsx`
- `src/components/v2/vision/board/__tests__/VisionPhotoCaptionEditor.test.tsx`
- `src/components/v2/vision/board/__tests__/visionCanvas.test.ts`
- `src/components/v2/vision/board/__tests__/visionSealPlacement.test.ts`
- `src/components/v2/vision/board/useVisionBoardScene.ts`
- `src/components/v2/vision/board/visionBoardLayouts.ts`
- `src/components/v2/vision/board/visionSealPlacement.ts`
- `src/components/v2/vision/visionEditorialLayout.ts`
- `src/components/v2/vision/visionImageGeometry.ts`
- `src/components/v2/vision/visionPhotoDimensions.ts`
- `src/screens/v2/practice/visualize/V2CinematicSessionScreen.tsx`
- `src/screens/v2/practice/visualize/V2VisualizePrepareScreen.tsx`
- `src/screens/v2/practice/visualize/__tests__/V2VisualizePreparation.test.tsx`
- `src/screens/v2/practice/visualize/__tests__/visualizePhotoFrame.test.ts`
- `src/screens/v2/practice/visualize/visualizePhotoFrame.ts`
- `src/screens/v2/system/VisionVisualQADevHost.tsx`
