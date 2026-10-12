# Uploaded-photo fitting audit and redesign rollback

The previous Vision editorial redesign is reverted. Layouts, image/frame sizes, rotations, overlaps, seal placement/size, paper edges, intention typography, Home/Details previews, Share Card styling, and Visualize handoffs are restored to the pre-redesign source. The redesign implementation is archived under `../vision-editorial-20261011/reverted-source/`; its earlier screenshots and 9.3 visual score are superseded. No saved Vision data, schema, or original image asset was changed. Unrelated dirty chart/audio/backend work was preserved.

## Audit performed before implementing the fitting correction

- `visionPhotoInput.ts`: ImagePicker sets `allowsEditing: false`; the preview/upload passes the selected URI and reads the selected file bytes. Picker quality is the pre-existing 0.85 setting. The client discards picker width/height from its result; the renderer therefore relies on native decoded dimensions.
- `visionRoutes.ts` uploads: Sharp validates metadata/mime type; `uploadImageAssetFromBuffer` receives the original buffer. `StorageService.ts` stores that buffer directly. This upload path does not center-crop, resize, or blur the photo. The separate AI reference transforms are not the displayed uploaded asset.
- `V2VisionTile` includes source type but no dependable width/height or focal point. BoardScene recognizes both USER_UPLOAD and USER_CAMERA. Both Board and Share Card use `VisionPhotograph`; Home/Details use their existing source-aware renderer and are restored unchanged.
- Original Board geometry is fixed by `visionBoardLayouts.ts`, independent of uploaded source aspect. Hero/support apertures vary by image count. No geometry adjustment is needed to correct image fitting.
- Original `visionImageFit` allows cover only when at least 86% of the source survives, otherwise contain. Before decode it incorrectly returns cover for unknown uploaded dimensions. Original `VisionPhotograph` then adds a cover-sized duplicate at blurRadius 22 and scale 1.15, plus a dark rgba(15,20,25,0.18) veil. Those layers cause muddy sidebars when the foreground is contained. Fitting also trusts the requested aspect rather than the actual native aperture.
- Audited local native-fixture source dimensions: desk 1920×1280 (1.5), wide window 1600×893 (1.7917), family 1920×1280 (1.5), with no EXIF orientation tags. [Exact dimensions](source-dimensions.json). These are fixtures, not the user's originals. The individual uploaded photos shown in the supplied flattened screenshot were unavailable, so their original dimensions and exact native subject framing remain unverified.

## Isolated correction

Only two production files differ from the restored source:

1. `src/components/v2/vision/VisionPhotograph.tsx`: uploads use one downsampled image in the existing clipped aperture. Unsafe crops preserve the whole original on neutral board paper rather than a blurred/dark duplicate. Image onLayout supplies the actual aperture aspect; it never resizes or repositions the print. The image remains mounted as dimensions arrive. Upload readiness now waits for its single foreground; generated-image layers and readiness are unchanged.
2. `src/components/v2/vision/visionImageGeometry.ts`: unknown uploaded dimensions start contained, then use the existing 86% retention threshold after decode. Generated and full-screen fitting policies are unchanged. No semantic subject detection or focal coordinate is invented.

Tests changed: `VisionPhotograph.test.tsx`, `visionImageGeometry.test.ts`. A pre-existing strict TypeScript keyboard-mock variance error reappeared after restoring `VisionPhotoCaptionEditor.test.tsx`; only its mock argument typing was corrected, preserving behavior.

## Verification

- New regression tests failed against the original renderer, then passed with the isolated fix.
- Nine suites / 74 tests passed: photograph, fitting, original editorial layouts/previews, Board, BoardPhoto, intention card, Share Card export, and photo picker/upload. [Log](tests.log).
- Caption editor: one suite / five tests passed. Total focused validation: **10 suites / 79 tests**.
- `npx tsc --noEmit --pretty false` passed, exit 0. [Log](typecheck.log).
- Restored source files checked against pre-redesign HEAD, and redesign-only helper/test files verified absent. [Rollback verification](rollback-verification.json).
- A temporary development fixture marked native images USER_UPLOAD for attempted Board/export inspection; the QA host was restored afterwards and has no final diff.
- Fresh Android render/export validation could not complete: emulator startup produced an app-not-responding dialog, then stalled on a blank startup screen after a force-stop/restart. Diagnostic launch images and emulator logs are retained. No new native render or export is claimed. Existing tests establish contracts, not rendered acceptance or performance. Native iOS and the user's original photos remain unverified.

Changes remain uncommitted. No OTA, deployment, dependency, or schema change was performed.
