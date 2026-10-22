# Vision Pass 4 — supplied mockup refinement

Implemented and inspected on 2026-10-10. This review supersedes the visual acceptance claims in REPORT.md. The supplied mockup is now available and was compared with the real signed-in six-photo Vision on the wireless Samsung SM-S928U1. No commit, OTA, deployment, or database migration was made.

## Root causes and corrections

1. A row optimizer maximized print area but gave portrait collections a regular grid instead of the asymmetric scrapbook in the reference. Six portrait-dominant photos now use a central tall print with five supporting prints crossing its edges. Source aspect ratios determine physical widths; rotated union bounds determine the final safe fit. Other counts use connected, aspect-aware packing. Every photograph retains a slot.
2. Compact previews explicitly discarded the real note renderer even though Home and Details already supplied saved notes. Both now render actual nonarchived note materials. There is no hardcoded personal text or reference-photo replacement.
3. During Fast Refresh, the aspect cache could reset while child images remained decoded. The child now republishes its retained source dimensions. This was caught in the first live phone comparison.
4. Decorative local images can retain their intrinsic dimensions despite an absolute-fill style. Explicit paper and tape image dimensions prevent oversized texture and clipped backing. Four torn-paper pieces, two restrained tape strips, cream photo frames and small shadows establish the reference's physical language.
5. Saving returned to an existing Vision route whose local state still represented Add. The board is now restored before opening the composer. The confirmed mutation updates the shared cache; stale reads cannot overwrite it.
6. The installed React Navigation 6 navigator has no `popTo`. Its existing-route `navigate` return now also carries the confirmed saved note ID. This activates viewport reveal and the reduced-motion-aware opacity/scale/rotation settle on physical devices.

## Before, target, and after

- [Earlier six-photo fixture comparison](composition-comparison.png) records the old separated composition against the first connected-row implementation. It is historical evidence, not the final mockup match.
- [Provided Home target against the real Samsung Vision](mockup-vs-phone-home.png) uses unretouched card crops at equal width. All six real photographs remain visible, the center is connected, the primary print has hierarchy, and the saved pink note is inside the composition.
- [Count and mixed-aspect matrix](mockup-count-matrix.png) shows final native Android fixtures for Home and Details with 1, 3, 6, and 8 photos.
- [Final real Home capture](phone-home-final.png) shows the clean six-photo preview after temporary-note cleanup, without the refresh banner.
- [Final real Details capture](phone-details-final.png) shows the same actual Anchor, its compact cream header, connected six-photo collage and original pink note. [Provided Details target against the Samsung capture](mockup-vs-phone-details.png) compares unretouched card crops at equal width.

The reference crops some source photographs differently and includes different note text/material. Implementation preserves the real images' aspect ratios and the user's saved words and chosen material; it does not manufacture those differences. Card dimensions remain unchanged.

## Note placement and persistence

The full board owns notes inside its shared composition/camera space. New placement scores central photo subject regions, existing notes, Anchor art, proximity to photo edges, and viewport position. It persists the supported normalized x/y/width/height/rotation/scale/layer order; existing placements are retained. Neutral materials receive a slight rotation. Sticky materials now have square paper corners, a faint adhesive band and an opaque shadow silhouette on Android; torn and editorial materials retain their existing assets and typography.

The new note reveals after confirmed persistence with a short opacity/scale/rotation settle. Reduced motion displays its final state directly. Dragging saves the settled transform and rolls back on failure. Notes remain excluded from photos-only Visualize asset selection.

## Actual physical-device checks

- Wireless device connected at `192.168.0.251:39421`, model SM-S928U1.
- Real Home and Anchor Details inspected with the user's existing six photographs and saved pink note.
- Created temporary `Vision test note6` through the real composer/API. Save returned directly to the existing board; the persisted note was visible without refresh or manual exit. [Capture](phone-save-return.png).
- Edited that temporary note to Ivory Torn, preserving its placement. Save returned directly to the board. [Capture](phone-paper-save-return.png), [save/settle recording](phone-note-save-settle.mp4), [frame sequence](phone-note-save-frames.png).
- Dragged the temporary note. Its measured native bounds changed from `[81,1268][444,1631]` to `[204,1344][567,1707]`.
- Force-stopped and restarted Anchor. After unlocking, reopened the full board: the temporary note retained its edited material and text, and its horizontal bounds remained `[204,567]`, matching the dragged position. Its vertical bounds were `[1403,1766]`; both it and the original note shifted down 59 pixels with the current board viewport. [Restart capture](phone-note-after-restart.png), [native UI bounds](phone-restarted-ui.xml).
- Deleted only `Vision test note6` through the existing confirmation flow. Reopened the board and confirmed that its sole remaining note is the original `I love you` note. [Reopened native UI evidence](phone-cleaned-ui.xml). The original personal note has not been edited or deleted.
- Captured and visually inspected final clean Home and Details screens, then compared both with the supplied mockup. All six photographs are visible in one connected composition; card dimensions have not increased.

## Automated results

- TypeScript: `npx tsc --noEmit` passed; [log](mockup-types-final.log).
- Vision components/hooks/screens, Share Studio, Visualize and Anchor Details: **72 suites, 737 tests passed**; [log](mockup-regressions.log).
- Final composition/material focus: **3 suites, 52 tests passed**; [log](mockup-focused.log).
- React Navigation 6 return and note preview bridge: **2 suites, 44 tests passed**; [log](mockup-native-navigation-tests.log). This ran after the broad regression run.
- Final sticky shadow change: **31 renderer tests passed**; [log](mockup-material-final.log).
- Scoped `git diff --check` passed, with line-ending notices only.

These counts overlap. Failed-save/retry, duplicate-tap protection, all 26 materials, shared cache races, encrypted restore, edit geometry and reduced motion have automated coverage. They are not claims of testing every material or offline retry on the physical phone.

## Exact source/test files modified

The complete combined Pass 4 source/test inventory is [files-modified.txt](files-modified.txt), containing 21 paths. The mockup refinement changed these nine of those paths:

- `src/components/v2/vision/visionEditorialLayout.ts`
- `src/components/v2/vision/VisionEditorialPreview.tsx`
- `src/components/v2/vision/useVisionEditorialNotes.tsx`
- `src/components/v2/vision/notes/VisionNoteRenderer.tsx`
- `src/screens/v2/vision/V2VisionNoteComposer.tsx`
- `src/components/v2/vision/__tests__/visionEditorialLayout.test.ts`
- `src/components/v2/vision/__tests__/VisionEditorialPreview.test.tsx`
- `src/components/v2/vision/__tests__/useVisionEditorialNotes.test.tsx`
- `src/screens/v2/vision/__tests__/V2VisionNoteComposer.test.tsx`

QA evidence, logs, this review and the crop/matrix script are under this directory. Unrelated preexisting dirty mobile/backend work was preserved.

## Limitations, risks, and quality assessment

Native iOS, release-build frame pacing, physical offline retry and all 26 physical material creations remain unverified. There is no reliable face/focal metadata; placement protects conservative central subject regions rather than claiming face detection. Very long notes use readable excerpts in compact previews; the full board retains their complete text. Source dimensions arriving for the first time can recompose the initial loading layout. Portrait-source crops intentionally differ from the artwork when necessary to retain the original photo.

Primary regression risks are extreme aspect mixes, unusually many overlapping notes, and navigator return semantics. Rotated bounds, all-image inventory, material distinctions, save failures, retries and existing-route return have focused coverage. Photo generation/editing, selection, Share Studio and Visualize regressions passed their relevant tests.

**Evidence-based self-assessment: Android composition 9/10; native note lifecycle 9/10.** The final real Home and Details captures retain all six subjects, connect the center, establish a tall central print and overlapping foreground prints, and integrate the actual saved material with tape, backing and restrained shadows. The actual save/edit/drag/restart checks confirm direct return, visible persisted notes and retained placement. This is a self-assessment, not an independent review or a claim of pixel equality: the reference crops photos differently, uses different note text and edges, and has a different Details card aspect. Native iOS and release-performance acceptance remain open and cannot be scored from Android evidence.
