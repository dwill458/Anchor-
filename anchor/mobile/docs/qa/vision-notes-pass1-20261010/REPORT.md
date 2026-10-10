# Vision Notes — Pass 1

Implemented in the authoritative Expo app. Users can enter the composer through the existing Vision entrance, type up to 200 Unicode code points, explore all 20 requested materials, and see native live text on the selected stationery. Saving is explicitly gated. No note persistence mutation, board placement animation, manipulation, or Visualize note rendering was added.

## Investigation and architecture

Investigation preceded implementation and used supervised Luna agents. Existing integration points are `VisionEntrance`, `VisionCeremony`, `V2VisionScreen`, `VisionBoard`, and the existing V2 native stack. The entrance retains its Polaroids, image-generation/photo choices, and ceremony state machine. A secondary note action is appended below the photo actions. The board now says “Add” and opens the existing entrance; image paths remain available. A full eight-image board can still open note entry, while its image actions are disabled.

`VisionReadModel.notes` is optional and additive. Existing scene/image records are unchanged. `VisionNote` separates stable identity, parent Vision, text content, presentation, and timestamps. Presentation uses normalized center coordinates and dimensions, rotation, scale, style ID, and layer order, consistent with the board's geometry. These are future read contracts only. Existing backend VisionService/routes and the current Vision cache remain the persistence architecture; no second store or draft persistence was introduced.

`VisionNoteRenderer` owns the native text and material presentation. It supports dimensions, normalized placement, rotation, scale, layer order, typography, surface/color overrides, and shadow treatment. It can be reused by future board/Home/Details/Visualize integrations. Those consumers are not wired in this pass.

The composer uses the existing EBGaramond, Inter, and Allison fonts, theme tokens, Reanimated, reduced-motion hook, native stack, and safe-area-context. It contains the preview, input, three tabs, and four-column material swatches in one screen. Keyboard avoidance is `padding` on iOS and `height` on Android. Material changes crossfade over 240ms with a gentle lift/settle; reduced motion skips this animation. The bottom action remains disabled alongside “Preview only. Saving notes will be available in a future update.” Drafts are local and discarded when leaving.

The existing `visionPreviewScreenOptions` helper came from concurrent work and is reused for the new route. Final review restored its existing V2Vision route use after an agent had inadvertently reverted that line; the original route's concurrent fade behavior is preserved. The helper itself was not created by this pass.

## Styles

| Family | Presets |
| --- | --- |
| Sticky Notes (8) | Blush Pink, Butter Yellow, Sky Blue, Sage Green, Lavender, Peach, Warm Ivory, Rose Lined |
| Paper (6) | Ivory Torn, Aged Parchment, Handmade Cream, Blush Torn, Sage Handmade, White Deckled |
| Editorial (6) | Classic Cream, Powder Blue, Minimal Quote, Botanical Shadow, Coastal Illustration, Atmospheric Landscape |

Sticky materials use native color, lines, and shadows. Paper materials share two transparent edge/texture assets with native tints. Editorial materials combine native typography with three restrained illustration/shadow backgrounds. All note text remains editable native text, separate from the artwork. Long or newline-heavy content remains available through the renderer's text viewport rather than being ellipsized.

## Assets

Five actual ImageGen-produced assets, optimized to 512 × 512 PNG. No placeholders: `torn-paper.png`, `handmade-paper.png`, `botanical-shadow.png`, `coastal-illustration.png`, `atmospheric-landscape.png`. None contains text, branding, or unnecessary symbols. Paper cutouts retain transparent exteriors and near-opaque interiors. Assets were visually inspected and alpha checked. Full provenance, size, and alpha details are in `src/assets/vision/notes/README.md`.

## Validation and review

- Whole mobile TypeScript: `npx tsc --noEmit --pretty false` — passed, exit 0; `typecheck.log` is empty.
- Broad relevant Jest selection: `vision|Vision|AnchorV2Navigator` — 57 unaffected suites passed, 454 assertions. The remaining image-entry suite was run against an accidentally restored stale fixture; its raw initial failing results remain in `jest-results.json` and `jest.log` for transparency.
- After exact fixture recovery, the image-entry suite passed 24/24 tests in 142.58s. Captured output is `recovered-add-image.log`. Together these verified runs cover 58 suites and 478 passing tests; this is a combined result, not a rewritten all-green aggregate log.
- Following restoration of the existing concurrent Vision route fade, navigation and transition checks passed again: 3 suites, 43 tests in 18.538s (`navigation-final.log`). These overlap the broad selection and are not added again to the combined count.
- Coverage includes exact preset registry, live preview, all 20 style choices, text limit/paste/emoji, reduced motion, Android/iOS keyboard configuration, note/back navigation, disabled save, renderer geometry and overflow, old read-model compatibility, and existing Vision creation/image regressions.
- Android and iOS Expo bundle exports both passed, exit 0; logs are `export-android.log` and `export-ios.log`. Bundles were exported locally to the temporary workspace, not published.
- Scoped tracked-file `git diff --check` passed. Git emitted routine CRLF normalization warnings.
- Supervised review: note foundation 9.2/10, assets 9.1/10, entrance/navigation review 9.0/10. Below-bar first versions were returned for correction before acceptance. These are code/asset review scores, not device visual-parity scores.

An agent accidentally truncated the existing image-entry test file during an encoding-sensitive write, then restored its committed version. A second agent recovered the complete pre-truncation source from Jest's cached source map, preserving the earlier uncommitted photo tests. The restored file differs from that cached source only in four intended stale-label/full-capacity test lines plus trailing whitespace cleanup. It passes all 24 tests. Recovery backups remain in `%TEMP%/vision-note-test-recovery`. Final test-file SHA256: `CF0EC8789E01CCF15880E8F2E5B3E0E397110972A777466204D97AEBC43B3C7C`.

## Files created

Paths below are relative to `anchor/mobile` and exclude unrelated pre-existing/concurrent changes.

- `src/assets/vision/notes/noteAssets.ts`
- `src/assets/vision/notes/README.md`
- `src/assets/vision/notes/torn-paper.png`
- `src/assets/vision/notes/handmade-paper.png`
- `src/assets/vision/notes/botanical-shadow.png`
- `src/assets/vision/notes/coastal-illustration.png`
- `src/assets/vision/notes/atmospheric-landscape.png`
- `src/components/v2/vision/notes/index.ts`
- `src/components/v2/vision/notes/VisionNoteRenderer.tsx`
- `src/components/v2/vision/notes/visionNoteStyles.ts`
- `src/components/v2/vision/notes/__tests__/VisionNoteRenderer.test.tsx`
- `src/components/v2/vision/notes/__tests__/visionNoteStyles.test.ts`
- `src/components/v2/vision/notes/__tests__/visionNoteCompatibility.test.ts`
- `src/screens/v2/vision/V2VisionNoteComposer.tsx`
- `src/screens/v2/vision/__tests__/V2VisionNoteComposer.test.tsx`
- `docs/qa/vision-notes-pass1-20261010/REPORT.md`
- `docs/qa/vision-notes-pass1-20261010/typecheck.log`
- `docs/qa/vision-notes-pass1-20261010/jest.log`
- `docs/qa/vision-notes-pass1-20261010/jest-results.json`
- `docs/qa/vision-notes-pass1-20261010/recovered-add-image.log`
- `docs/qa/vision-notes-pass1-20261010/export-android.log`
- `docs/qa/vision-notes-pass1-20261010/export-ios.log`
- `docs/qa/vision-notes-pass1-20261010/navigation-final.log`

## Files modified for this pass

- `src/adapters/v2/vision/types.ts`
- `src/navigation/v2/types.ts`
- `src/navigation/v2/routes.ts`
- `src/navigation/v2/AnchorV2Navigator.tsx`
- `src/navigation/v2/__tests__/AnchorV2Navigator.test.tsx`
- `src/components/v2/vision/ceremony/VisionEntrance.tsx`
- `src/components/v2/vision/ceremony/VisionCeremony.tsx`
- `src/components/v2/vision/ceremony/__tests__/VisionEntrance.test.tsx`
- `src/components/v2/vision/board/VisionBoard.tsx`
- `src/components/v2/vision/board/__tests__/VisionBoard.test.tsx`
- `src/screens/v2/vision/V2VisionScreen.tsx`
- `src/screens/v2/vision/__tests__/V2VisionScreen.addImage.test.tsx`

Some of these files already had unrelated dirty changes. This list identifies files touched for Notes, not ownership of their entire Git diff. No commit, deployment, or OTA was performed.

## Known limitations and Pass 2 readiness

No authenticated device interaction, keyboard layout, VoiceOver/TalkBack, frame pacing, or screenshot parity was verified. Android ADB reported no connected devices; iOS simulation was unavailable on this Windows host. Unit tests and bundle exports do not establish device acceptance. Short-screen entrance fitting and real font/texture appearance require device QA.

Pass 2 has the navigation seam, renderer, stable style registry, optimized assets, and additive note contracts ready. It should add validated note CRUD through the existing backend Vision architecture, enforce ownership and geometry/text limits, map reads through the existing Vision cache, enable the save action only after real persistence succeeds, and place notes within the existing board coordinate/camera system. Drag/resize and placement transitions remain future work. Home/Details/Visualize rendering remains for later passes.
