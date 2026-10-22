# Home and Anchor detail Vision card verification

October 21, 2026. Follow-up to the board recovery. No commit or publication performed.

The supplied Home screenshot showed a separate, confirmed geometry bug: the photo extended into the caption row. Home and Anchor Details both render `VisionPreviewCard`; neither mounts the full interactive board. Consequently the earlier board texture correction alone did not repair this card geometry.

## Cause and repair

- `VisionPreviewCard.tsx` measured the outer card width but positioned prints inside a body with 14pt padding on each side. The stage now measures its actual inner width.
- `visionPreviewCardModel.ts` reserved a fixed stage height of .42 times width for one photo, although that print's mount and rotation extend to approximately .543 times width. Two-photo geometry similarly needed approximately .514 instead of .4. The stage now derives its height from the existing print positions, actual mount proportions, and rotated bottom edges.
- A -34pt Home footer margin could also pull the control into the header on a photo-less card. The footer now follows the complete stage with the existing 8pt caption spacing.

The print positions, rotations, sizes relative to the stage, paper materials, item-count rules, photo selection, navigation and two-line caption behavior are preserved. Notes continue to count toward items without rendering full note assets inside compact cards. Long captions intentionally end with an ellipsis; they do not paint underneath a photograph or button.

Changed production files:

- `src/components/v2/vision/VisionPreviewCard.tsx`
- `src/components/v2/vision/visionPreviewCardModel.ts`

Regression tests added to their existing `__tests__/VisionPreviewCard.test.tsx` and `__tests__/visionPreviewCardModel.test.ts`. Six new checks failed before the repair and passed afterward. The development QA host's Details fixture previously rendered the obsolete `VisionEditorialPreview`; it now renders the same `VisionPreviewCard` used by the real Anchor Details screen.

## Rendered verification

Native Android development app, one RAM-limited emulator. Tested the production card components using isolated local fixtures, not an authenticated owner's account. Home uses its production `V2HomeVisionSection`; Details uses its production card with the host's header-hiding props. Actual Home and Details screen integration tests separately verify their production wiring and open handlers.

At the supplied **628×1280** screenshot size, visually inspected both variants with one photo plus a note, two photos, eight photos plus a note, and notes only. Additional portrait and mixed-image cases were captured. Native XML checks confirm expected print counts and that print bottoms stay above the footer for all ten captures.

At **512×1280, density 256** (320 logical points wide), also inspected Home with one photo/one note and Details with two photos. Captions, photos and controls stay inside the cards without overlap. The development-only QA label and tools overlay are outside the production cards.

- [Reported screenshot beside repaired cards](preview-cards-comparison.jpg)
- [Home and Details count matrix](preview-cards-matrix.jpg)
- [Full native Home capture](card-home-1-notes.png)
- [Full native Details capture](card-details-1-notes.png)
- [Narrow Home](card-home-narrow.png)
- [Narrow Details](card-details-narrow.png)
- Portrait/mixed captures: `card-home-3-portrait.png`, `card-details-3-mixed.png`.

Every original capture has matching native XML. `capture-preview-cards.ps1` and `compare-preview-cards.py` reproduce the matrix and proportional card crops. Fixture photos and statements differ from the user's saved content; no account data was changed.

## Checks

- Card model/rendering plus real Home, Home-return and Anchor Details integration: **5 suites, 158 tests passed** (`preview-cards-integration-tests.log`).
- Existing board recovery/session checks rerun: **20 suites, 383 tests passed** (`preview-cards-board-recheck.log`).
- Full TypeScript and `git diff --check` passed. Line-ending normalization notices only.
- No additional board/session changes; unrelated dirty backend Chart files were left untouched.

The observed card overlap is repaired and the rendered card cases above are visually verified. These fixture captures do not imply authenticated end-to-end account acceptance or release-build performance verification.
