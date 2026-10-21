# Vision regression recovery

Verification completed locally on October 21, 2026. Changes remain uncommitted. No deployment or OTA was performed.

Follow-up: [Home and Anchor detail Vision cards](PREVIEW_CARDS.md) were checked and their separate stage/caption overlap repaired. Includes additional native screenshots and 158 passing card/screen integration tests; the original 383 recovery tests were rerun successfully.

## Confirmed causes

Git comparison identified asset integration `f1abbea257605ca66c379fc6d42b1e4486d1bfdd`, following `d0696d1d`, as the material rendering regression. The bounded scrapbook recipes predate it (`1c950499`). No entire commit or branch was reset.

| Symptom | Confirmed implementation cause | Repair |
| --- | --- | --- |
| Giant sticky notes, Polaroids, backing layers, editor paper and selector images | `VisionMaterialSurface.tsx` gave bundled React Native Images absolute edges without overriding intrinsic width/height. Installed Android Image adds source dimensions before the supplied style. Assets were 600×600, 600×720, or 512×160; `resizeMode="stretch"` stretches inside that intrinsic image rectangle, not its smaller parent. | Both base and tint images now explicitly resolve width and height to 100% of their bounded parent. A native-style regression test failed for all 26 materials before the fix. |
| Photos appeared displaced, blank paper below them | Frame textures overflowed independently of the explicitly measured photo/aperture geometry. | Correct material sizing restores alignment with existing photo geometry. |
| Anchor away from center at low photo counts | Existing normalized recipes deliberately placed it at x=.73 for one photo and x=.2 for two, independently of the material bug. | Centered low-count medallions and checked their actual rendered diameter clears Add. Four-to-eight-photo recipes remain intact. |
| Apparent arbitrary board height / lower content misalignment | Oversized assets painted beyond the board. Its Yoga viewport was already determined by photo-count recipes, not note count. Entrance additionally fitted photos alone while rendering notes/Anchor, and did not reserve measured intention/category height. | Kept board height recipes; bounded assets. Entrance fit includes existing notes and real Anchor and reserves measured identity space. |
| Note deletion left editing controls behind | Selected note ID remained after the note disappeared. | Clear selection when the selected note is removed or archived. |
| Final photo cannot be removed | Existing server invariant requires at least one photo (`backend/src/services/v2/VisionService.ts`, remove scene). UI feedback previously appeared farther down the page. | Immediate explanatory alert. Server rule preserved. Other photo deletion and note deletion work in native local QA. |
| Add Scene input barely responds to taps with keyboard open | Android moved a child by transform outside its measured parent. Native field looked about 429px tall but its reachable bounds were only 104px, with an ancestor starting below much of the visible field. | Put the measured keyboard inset on the modal root layout instead. Native field bounds now cover the visible field, including top/bottom cursor taps. |
| Excess typing work in Add Scene | Reference callbacks changed each keystroke, rebuilding five reference cards repeatedly (5 initial renders became 20 after three changes). | Stable callback carrying latest text, memoized reference strip. Regression test confirms five renders remain five while typing. |

## Layout and assets

All 26 generated full-size material assets and 16 thumbnails are retained unchanged. No assets were generated or replaced. The realistic peeled paper remains.

Board photos, notes, Anchor and tape continue to use the existing normalized scene coordinate system and explicitly measured element dimensions. Editor preview, board notes, material cards, color swatches, frames and tape keep their separate parent dimensions; the shared texture fills those dimensions. Intrinsic image size no longer determines any of them. Existing visible-paper text positioning is retained. Adding/removing notes does not expand the board viewport.

The note composer reserves two input lines plus the counter instead of an excessive empty input block. Preview stays above input, selectors remain in the scrollable form, and the footer stays above the keyboard/safe area. Lower palette labels are accessible by normal scrolling; see the additional bottom capture.

## Files repaired

Production paths relative to `anchor/mobile/`:

- `src/components/v2/vision/material/VisionMaterialSurface.tsx` — explicit texture dimensions.
- `src/components/v2/vision/board/visionBoardLayouts.ts` — centered low-count Anchor positions; existing photo recipes/heights preserved.
- `src/components/v2/vision/board/VisionBoard.tsx` — clear stale note selection.
- `src/components/v2/vision/V2SavedVision.tsx` — immediate final-photo explanation.
- `src/components/v2/vision/VisionAddSceneSheet.tsx` — measured Android keyboard layout and stable reference callback.
- `src/components/v2/vision/VisionReferenceStrip.tsx` — avoid rebuilding reference cards on text changes.
- `src/components/v2/primitives/V2SheetModal.tsx` — optional measured bottom inset; other consumers default to zero.
- `src/screens/v2/vision/V2VisionNoteComposer.tsx` — input region spacing.
- `src/screens/v2/practice/visualize/V2VisualizePrepareScreen.tsx` — entrance-only identity measurement and complete composition fitting.
- `src/screens/v2/practice/visualize/visualizePhotoFrame.ts` — opt-in entrance bounds for notes/Anchor; existing photo-only callers preserve their behavior.

QA host: `src/screens/v2/system/VisionVisualQADevHost.tsx` adds local recovery matrices and the installed development-build URL scheme. It exercises production components with isolated fixture state and existing finished Anchor artwork.

Test paths changed/added:

- `src/components/v2/vision/material/__tests__/VisionMaterialSurface.test.tsx`
- `src/components/v2/vision/__tests__/V2SavedVision.removal.test.tsx`
- `src/components/v2/vision/__tests__/VisionAddSceneSheet.test.tsx`
- `src/components/v2/primitives/__tests__/V2SheetModal.test.tsx`
- `src/components/v2/vision/board/__tests__/VisionBoardScrapbook.test.tsx`
- `src/components/v2/vision/board/__tests__/visionCanvas.test.ts`
- `src/components/v2/vision/board/__tests__/visionScrapbookLayouts.test.ts`
- `src/screens/v2/practice/visualize/__tests__/V2VisualizePreparation.test.tsx`
- `src/screens/v2/practice/visualize/__tests__/visualizePhotoFrame.test.ts`

Evidence and reproduction scripts are in this directory. Two old photo-frame assertions also failed against unchanged HEAD sources (saved under `baseline/` and `entrance-baseline-tests.log`): one demanded width greater than the maximum allowed width; another failed on floating point epsilon. Assertions now respect the existing maximum and a 0.01 tolerance. The preparation render assertion now expects the notes and real Anchor already present in the integrated implementation and approved reference; session gating assertions remain.

## Native verification

One isolated Android emulator, two cores, requested 2GB RAM; emulator enforced a 2560MB guest minimum. Used one Metro instance with two workers. Existing user AVD/data were preserved. Screenshots come from the running native development app, not web renders. Board/entrance captures are **628×1280**; note editor captures are **455×1280**, matching the supplied regression screenshots.

| Check | Native evidence | Result |
| --- | --- | --- |
| One photo, zero notes | [Screenshot](recovery-1-0.png) | Bounded frame, centered real Anchor, Add visible. |
| One photo, one note | [Screenshot](recovery-1-1.png) | Note remains bounded; photo and Anchor remain visible. |
| Four photos, one note | [Screenshot](recovery-4-1.png) | Organic overlap, rotations, centered artwork and existing aura. |
| Eight photos, multiple notes | [Top](recovery-8-3.png), [lower scroll](eight-photos-lower-exact.png) | Deterministic board; Add, My Vision and Begin reachable without asset overflow. |
| Zero photos with notes, extra check | [Screenshot](recovery-0-3.png) | Empty-photo board remains bounded. |
| Add a Note, keyboard closed | [Screenshot](composer-tall-closed-final.png), [palette bottom](composer-grid-bottom.png) | Preview, input, cards, fonts and labeled swatches separated; footer visible. |
| Add a Note, keyboard open | [Screenshot](composer-keyboard.png) | Input and enabled Add to Vision above keyboard; form scrolls. |
| Visualize entrance | [Screenshot](visualize-entrance-exact.png), [native XML](visualize-entrance-exact.xml) | Full collage/Anchor/intention visible; Begin enabled and clickable. Earlier cold preparation remained pending; final re-entry completed normally. No session started. |
| Note removal | [Selected](note-selected.png), [confirm](note-delete-confirm.png), [removed](note-deleted.png) | Local note removed; toolbar clears. |
| Photo removal | [Three photos after removal](photo-removed-three-photos.png), [last photo explanation](last-photo-explanation.png) | Four-to-three removal works; final image rule explained. |
| Board Add | `add-button-ui.xml`, `add-sheet-ui.xml` | Native Add opens scene sheet; Add a Note opens composer. |
| Scene field keyboard interaction | [Screenshot](add-scene-typing-final.png), [native XML](add-scene-typing-final-ui.xml), [result](typing-result.txt) | Top and bottom cursor taps work; 108 paced characters retained exactly in a 491-character draft. |

Side-by-side comparisons visually inspected: [board](board-side-by-side.jpg), [note editor](composer-side-by-side.jpg), [entrance](entrance-side-by-side.jpg), [count matrix](board-count-matrix.jpg). Approved panels are cropped from the supplied references and proportionally enlarged; native source PNGs are retained unaltered.

## Automated verification

`verify.ps1`: **20 suites passed, 383 tests passed**. Includes material sizing, board geometry and note-count height stability across 1–8 photos, gestures, note CRUD, photo removal, keyboard sheet layout, reference render behavior, composer, entrance, and protected session lifecycle/readiness tests. Full TypeScript check passed. `git diff --check` passed (line-ending normalization notices only). Logs: `focused-tests-final.log`, `types-final.log`.

## Preservation and remaining acceptance limits

No backend, persistence, uploads, generation, Thread Strength calculations, active session, guided audio, chapter timing, session animations or completion implementation changed. The existing aura renderer is used with fixture strength 60. No owner data was changed. No session was begun.

This is native **fixture-based layout and interaction verification**, not authenticated owner CRUD acceptance. Fixture imagery, text and Anchor differ from the approved sample; saved note positions are preserved rather than forced to the mockup's top-right placement. Existing Practice navigation, type styling and variable photo aspects remain. Entrance collage is somewhat smaller than the sample to fit the current header and measured intention above the footer; exact visual parity is not claimed.

A zero-delay 335-character ADB injection dropped tail characters in this debug emulator. Paced typing passed, and both the measured hit-area defect and unnecessary reference rerenders are fixed. The zero-delay stress case is not claimed as passed; release-build typing performance remains unverified. Repeated synthetic `r` keystrokes can also trigger React Native's development reload shortcut, so paced verification avoided that character. See retained typing artifacts for the unsuccessful stress attempt.

The material/layout regression is repaired and rendered screens were visually inspected. Full production acceptance remains open for authenticated CRUD and release-build typing performance; these checks should not be inferred from Jest, fixture screenshots, or the enabled preparation button.
