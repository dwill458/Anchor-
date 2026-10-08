# Codex Prompt — Vision: Add-Image Ceremony

**Approved prototype:** https://claude.ai/artifact/RcLonFR2BsehEi8s7wM9ym (motion, sound and haptic reference; the timings below come from it)
**Scope:** `anchor/mobile/src` (active codebase; not `anchor-v2/`) + one additive backend field.
**One-line goal:** Adding an image to a Vision becomes one continuous ceremony: **Ask → Describe → Develop → Choose → Keep → Seal → Pinned.** The image is a single physical print that travels through every beat. It never cuts to an unrelated screen.

---

## 0. Principle (do not violate)

Every visual beat has to match something the app is actually doing. Do **not** draw, sketch or animate an image before its real asset exists. The "develop" reveal starts only once a candidate's `imageUrl` has resolved (generation) or the local URI is loaded (own photo). While nothing exists yet, show the user's own words and dark, empty prints.

---

## 1. Read first (before changing anything)

| # | File | Why |
|---|------|-----|
| 1 | `screens/v2/vision/V2VisionScreen.tsx` | Mode switch (`view` / `create` / `ready` / `addScene`), `pendingPhoto`, `confirmAddPhoto`, `addGeneratedScene`, `replaceScene`, `warmImage`, `playVisionPin` |
| 2 | `components/v2/vision/V2VisionCreationFlow.tsx` | Steps `empty → method → prompt → generating → uploading`; `choose()`, `pickImages()`, `saveUploads()` |
| 3 | `components/v2/vision/V2VisionAddScene.tsx` | Add-mode describe → two-up |
| 4 | `components/v2/vision/V2VisionAddPhoto.tsx` | Current single-photo confirm screen |
| 5 | `components/v2/vision/VisionTwoUpStage.tsx` | Generation wait + two-up choice + full-screen preview; `visionTwoUpState`, `waitBeat` timers (9s/20s/40s) |
| 6 | `components/v2/vision/VisionMomentInput.tsx` | Describe screen (title line 277, CTA line 281, path toggle line 352, "Make it look like you" ~470) |
| 7 | `components/v2/vision/VisionIntroStage.tsx`, `VisionMethodStage.tsx`, `VisionAddSheet.tsx`, `VisionChoiceSheet.tsx` | Being replaced by the Ask beat |
| 8 | `components/v2/vision/VisionImageArrival.tsx` | Flight from flow to board (`begin` / `resolve` / `land` / `cancel`). **Reuse it for the Pinned landing; do not rewrite it.** |
| 9 | `components/v2/vision/V2SavedVision.tsx` + `board/VisionBoardPhoto.tsx` | Board, Add image entry (line 320 sheet), Replace/Regenerate actions (lines ~183, 240, 289), Begin Visualize (~297) |
| 10 | `components/v2/vision/VisionTornEdge.tsx`, `VisionPaperChrome.tsx` (`VISION_SERIF`, `VISION_GOLD`), `VisionPhotograph.tsx` | Existing paper/torn-edge language to reuse |
| 11 | `components/v2/creation/SealMedallion.tsx` | **Reference only** for the hold pattern (sealRise tone, Light→Medium threshold haptics, Heavy on commit). Do not import or modify it: it is coupled to anchor creation (store count, provenance, `anchor_seal_*` analytics). |
| 12 | `services/CreationSounds.ts`, `services/audio/soundSources.ts`, `hooks/v2/haptics.ts`, `utils/haptics.ts` | Sound keys and haptics (`safeHaptics.impact`) |
| 13 | `hooks/v2/vision/useV2Vision.ts`, `adapters/v2/vision/types.ts`, `adapters/v2/vision/visionAdapter.ts` | `addScene` / `createVision` inputs, read model |
| 14 | Backend: `backend/prisma/schema.prisma` (`model VisionScene`, line ~908), `backend/src/domain/v2/vision.ts` (`CreateVisionSceneSchema`, line 73), `backend/src/services/v2/VisionService.ts` (`addScene`, line 271) | Caption field |

---

## 2. Preservation rules (locked)

- **Route names and params:** `V2Vision` and `V2VisionRouteParams` (`anchorId`, `edit`, `initialMode`, `resumeGeneration`), plus `V2Paywall` with context `VISION_PREMIUM_ACTION`, `V2Practice`, and `V2Chart`. All unchanged.
- **API calls:** unchanged. These are `/api/v2/anchors/:anchorId/vision/scene-generation`, the `.../generation/:jobId/retry` route, `/visions/:visionId/scenes` and `/assets/upload`, plus the polling in `useV2VisionSceneGeneration` (2s, foreground only).
- **Function signatures:** `useV2Vision`, `useV2VisionSceneGeneration`, `uploadVisionPhoto`, `pickVisionPhoto`, `VisionImageArrival` context API, `onAssemble`, `onAdd`, `addScene`, and `replaceScene` keep their current signatures. The one exception is the optional `caption` field added in §7.
- **Analytics event names:** keep every existing name exactly as it is: `vision_opened`, `vision_create_started`, `vision_created`, `vision_image_add_started`, `vision_image_generation_started`, `vision_image_selected`, `vision_image_removed`. New events are additive only (§8).
- **AsyncStorage keys:** none are added or renamed.
- **Generation rules:** the paywall pre-check (`isProFeatureLocked`), the idempotency key, `VISION_IMAGE_LIMIT` / `VISION_GENERATION_LIMIT` messaging, and `VISION_BOARD_MAX_IMAGES` all stay as they are.
- **Deferred ≠ deleted.** Replaced UI keeps its code, commented out or unreferenced, with a `// DEFERRED:` line saying what replaced it. Do not delete files.
- **Vocabulary.** UI copy never uses: sigil, ritual, charge, spell, streak, attract, mindfulness, meditation, vision board, occult, prime/priming. "Seal" is approved.
- **Colors.** Ink `#14162B`, cream `#F4EDE0`. Use gold (`VISION_GOLD`) only for the pin head. Category color only for the small eyebrow dot. No glow rings.
- **Reduce Motion** (`useV2ReduceMotion`). Every animation in this prompt collapses to ≤200ms crossfades. The seal hold contract (1600ms) stays the same, because it's a commitment and not decoration.

---

## 3. New component structure

Create **`components/v2/vision/ceremony/`** with:

| File | Responsibility |
|------|----------------|
| `VisionCeremony.tsx` | Owns the beat state machine `ask \| describe \| develop \| choose \| keep \| seal \| pinned`. It renders a persistent ink stage with the active beat's copy and controls fading 550ms, while the print(s) and the Anchor mark stay mounted and animate between positions. Used by **both** first-time creation and add-to-existing (`mode: 'create' \| 'add'`). |
| `VisionPrint.tsx` | One print: a cream paper card (`#F7F1E6`, radius 3, deep drop shadow, paper grain), an image window, an optional caption strip, a sheen sweep while developing, and a pin head. Props: `uri?`, `developing`, `revealed`, `showCaption`, `caption`, `onChangeCaption?`, `pinned`, `reframe?: {x,y}`, `onReframe?`. |
| `VisionDevelop.ts` | The develop timing constants (§5) and a `useDevelopReveal(uri)` hook. The hook resolves `Image.prefetch(uri)` (3s cap, same pattern as `warmImage`), and only then starts the reveal. |
| `VisionSealHold.tsx` | The anchor medallion as the hold target, with a ring drawn on Skia/SVG `strokeDashoffset`. It mirrors SealMedallion's feel (see §5 Seal) but is self-contained. |
| `visionCeremonyCopy.ts` | Every string in this flow, so tests can assert copy. |

`VisionCeremony` wraps the existing pieces instead of replacing them:
- **Describe** renders the existing `VisionMomentInput`. The screen stays; only its title copy changes (§9).
- **Develop/Choose** reads the same `generation.job` that `VisionTwoUpStage` reads today, through `visionTwoUpState(job)`. Its two-up layout logic moves into the ceremony; `VisionTwoUpStage` itself is DEFERRED (§10).
- **Pinned** calls the existing `arrival.begin(...)` with the kept print's measured rect and the anchor rect, exactly as `VisionTwoUpStage` / `V2VisionAddPhoto` do now, so the board's `arrivedFrom` recomposition and `visionPin` sound keep working.

---

## 4. Beat spec

Positions are given for a 390×844 reference frame. Derive them from `useWindowDimensions` and safe-area insets; do not hardcode pixels.

### 4.1 Ask *(replaces VisionIntroStage + VisionMethodStage on create; replaces VisionAddSheet on add)*
- Ink stage. Back button top-left. A small Anchor mark (48px, `CircularAnchorRenderer` with the real `anchorArt`) sits top-center.
- Eyebrow: create mode shows the category dot + category label; add mode shows "Add to your vision". Below it, the intention in italic serif, in quotes. Then the headline in serif 36: create mode "When it's true, what do you see?"; add mode "What else do you see?".
- An empty frame sits centered under the headline (~60% width, 4:5): a dashed cream hairline with corner ticks, the dashes marching slowly (14s loop), and a faint breathing radial inside. **This frame is the print**; it becomes the paper in Develop.
- Primary (cream) button "Imagine it from words" → Describe. Secondary (ghost) button "Use my own photo" → library picker (existing `pickVisionPhoto('library')` / `pickImages()`). Under it, a text link "Take a photo" → `pickVisionPhoto('camera')`. Footnote: "You choose what belongs in your Vision."
- *(Revised after Fix Pass 1.)* Ask is silent except for `uiTap` on button presses. `formBed` plays **only during the Develop wait** and fades out when the first print starts revealing. The empty frame is never empty: in create mode it holds `visionDescriptionExample(...)` and is tappable to prefill Describe; in add mode it sits in front of the last board print. See `VISION_CEREMONY_FIX_PASS_1.md` #1–#4.

### 4.2 Describe *(existing `VisionMomentInput`)*
- The empty frame shrinks and fades out (900ms). The Anchor mark stays top-center.
- No behavior change: the path toggle, the chips, "Make it look like you", the word guidance and "Create my images" all keep their current logic. On create, `inputPath` defaults to `'words'` when the person came from "Imagine it from words".
- Chip tap: `v2Haptics.selection()` (already there if present; add it if not).

### 4.3 Develop *(generation path)*
A minute-long wait, told in three honest phases, all driven by the server job:
1. **Reading your moment.** This runs from the request until the job is `RUNNING`, with a minimum of `min(160ms × words, 2600ms)`. The person's own submitted text appears in italic serif 25, centered, every word starting at 18% opacity. The words light to 100% one at a time (`min(160, 2600 / wordCount)` ms each), with a `distillTick` every third word at low volume. The Anchor mark breathes (border opacity 0.18↔0.45, 2.6s loop).
2. **Composing the scene.** The words lift 30px and fade (900ms). Two paper prints slide in side by side (staggered 160ms), with dark image windows (`#121427`) and the sheen sweep looping (2.4s). Status line: "Composing the scene", then at the existing 9s `waitBeat`, "Developing the images".
3. **Reveal per candidate.** When a candidate's `imageUrl` exists **and** has prefetched, that print develops on its own (§5 Develop), with `revealSettle` + `safeHaptics.impact(Light)`. The other print keeps its sheen. Status: "Giving the second one time to develop" while one is still pending; past the existing 20s / 40s beats keep the current reassurance copy. Show a fine pen progress line under the status (150px, cream, `strokeDashoffset` stepping 0.25 → 0.55 → 0.8 → 1 at the phase changes; it **never** implies a percentage).
- Note under the status: "Takes about a minute. You can leave; it keeps developing." (Polling already pauses in the background and catches up on return.)
- On `FAILED`, keep the current retry and edit-description affordances, restyled as cream text links.

### 4.4 Develop *(own-photo path)*
- One print at curate size. The local `uri` is the source (nothing uploads before Seal; that matches today's confirm-before-upload rule). Status steps "Placing your photo" (0ms) → "Finding the light" (1300ms) → "Developing" (2500ms), each with `formTick` and `v2Haptics.selection()`. The reveal starts at 600ms. Then go to Keep at ~4400ms.
- **Multi-select** (create mode, `pickImages()` allows up to `VISION_BOARD_MAX_IMAGES`): develop them as a stack. The hero is in front and up to two more peek behind, rotated ±3°, each revealing 400ms after the previous one. Keep shows the hero's caption only. Seal seals the whole set. Upload starts **at Seal** (the existing `uploadOne` loop), and Pinned waits on it (§4.7).

### 4.5 Choose *(generation path; replaces the two-up grid + full-screen "Use this one")*
- Heading "Tap the one that feels right." Prints sit at ±1.2° rotation.
- Tap a print: `v2Haptics.selection()` + `revealSettle`. The chosen print animates to curate position (900ms, `Easing.bezier(.2,.8,.2,1)`) and grows its caption strip (the window's bottom inset animates 8 → 62). The other slides down offscreen while rotating 8° and fades.
- Footer link: "Neither feels right, try again · {n} left". It calls the existing retry/regenerate path and respects the existing generation limit. `n` comes from whatever limit the job/vision exposes. If none is exposed, show the link without the count and add a `// TODO(limit)`.
- The full-screen preview inside `VisionTwoUpStage` is **not** used.

### 4.6 Keep
- Eyebrow "Write one line on it". The print sits at curate size, the caption strip shows one line of italic serif 21 ink, prefilled with the anchor intention plus a period. Tapping the line edits it inline (single line, max 80 chars; Return dismisses).
- Under the print:
  - Generation path: "See both again" returns to Choose (Replace is still allowed pre-commit).
  - Own-photo path: "Replace photo" re-opens the picker.
- Hint: "Drag the picture to reframe · tap the line to rewrite it". The image sits at 116% inside its window and a pan gesture offsets it, clamped to ±22 / ±28 pts. **Store only the caption this pass;** reframe is visual-only (`// DEFERRED: persist crop offset`).
- Primary: "Keep this one" → Seal.

### 4.7 Seal *(new; this is where Replace locks)*
- The print rises to the upper third (smaller). Copy: "Hold your anchor to seal it." / "Once it's sealed, it stays. That's the point." The anchor medallion (128px) sits centered below with a ring track (cream 14%). Bottom label: "PRESS AND HOLD".
- **Hold (1600ms):** start `sealRise` looped and `impact(Light)`. Ring fill tracks progress. The medallion scales 1 → 0.94. Fire `impact(Light)` at 25% and `impact(Medium)` at 75%. **Release early:** the ring decays to 0 over 350ms, stop `sealRise`, no side effects.
- **On commit:** stop `sealRise`. The medallion flies to the print's bottom-right corner (78px, overlapping the image window, not the caption), then stamps: scale 1.5 → 0.92 → 1 over 550ms. Then `impact(Heavy)` + the `seal` sound, a single cream hairline ripple ring from the stamp point (scale 0.6 → 3.2, opacity 0.8 → 0, 1100ms; this is one ring, not a glow), and the print presses (scale 0.975 at 30% of 500ms). Copy swaps to "Sealed." / "This is where it leads." and the hint fades out.
- **The save happens here**, behind the stamp. Generation path: `onAdd` / `onAssemble` with the chosen candidate. Own photo: `confirmAddPhoto` / `saveUploads`. Both pass `caption`. Hold on the "Sealed." frame until the save resolves, with a minimum of 1600ms after the stamp. On failure, show the existing error copy under the print with a "Try again" link. That link re-runs the save without another hold, and the seal stays committed.
- Keyboard/a11y: the medallion is `accessibilityRole="button"`, labelled "Your anchor. Press and hold to seal.", with `accessibilityActions` `[{name:'activate'}]` committing immediately (VoiceOver users can't do timed holds).

### 4.8 Pinned
- Fade `formBed` out. The cream board rises from the bottom using `VisionTornEdge` as the leading edge (1100ms, `Easing.bezier(.7,0,.2,1)`), so the ink is torn away. Call `arrival.begin(printRect, anchorRect)`, then `resolve(url)` when the saved scene's `resolvedImageUrl` is known (as today). The board's existing landing and `visionPin` sound play.
- **Pin head:** for the newly landed scene only, `VisionBoardPhoto` shows a gold pin (16px radial: `#F3DCA0` → `VISION_GOLD` → `#7d5d22`) dropping from −40px at 1.6× scale to rest (550ms, 350ms delay), with `impact(Light)`. If `VisionBoardPhoto` already renders a pin/tape element, animate that one instead of adding a new one.
- Add mode: the new print lands overlapping the previous hero per the existing board layout. Don't change `visionBoardLayouts`.
- After landing, `V2SavedVision` shows a one-session header above Begin Visualize: **"Sit with it now"**, with "Thirty seconds, eyes on the picture. This is the first one." (create) or "Thirty seconds with the new picture first." (add). Pass it as a new optional prop `justAdded?: 'create' | 'add'`, cleared when the screen loses focus. Begin Visualize behavior is unchanged.
- Toast (existing V2 toast if one exists, otherwise skip): "Vision added to "{intention}"" / "Added to your vision".

---

## 5. Motion and timing constants (`VisionDevelop.ts`)

```ts
export const CEREMONY = {
  stageFadeMs: 550,
  printMoveMs: 900,                   // Easing.bezier(0.2, 0.8, 0.2, 1)
  frameMarchMs: 14000,
  wordLightMaxMs: 160, wordLightTotalMs: 2600,
  sheenLoopMs: 2400,
  revealInkMs: 1600,                  // ink overlay 0.86 → 0
  revealBlurMs: 3400,                 // blurred copy 1 → 0, Easing.bezier(0.4, 0.1, 0.2, 1)
  revealScaleFrom: 1.06,
  choiceExitRotateDeg: 8,
  captionStripPts: 62,
  sealHoldMs: 1600, sealDecayMs: 350,
  stampMs: 550, rippleMs: 1100, pressMs: 500,
  sealedMinHoldMs: 1600,
  boardRiseMs: 1100,                  // Easing.bezier(0.7, 0, 0.2, 1)
  pinDropMs: 550, pinDelayMs: 350,
} as const;
```

**Develop reveal in React Native:** RN has no CSS grayscale/blur filter, so stack three layers inside the image window:
1. the sharp image;
2. the same image with `blurRadius={24}`;
3. an ink overlay `#14162B`.

The image starts at scale 1.06. Animate the ink overlay 0.86 → 0 over `revealInkMs`, the blurred copy 1 → 0 over `revealBlurMs`, and the scale to 1 over `revealBlurMs`. All on the UI thread (Reanimated).

---

## 6. Surgical change table

| # | File | Change |
|---|------|--------|
| 1 | `components/v2/vision/ceremony/*` (new) | Build the §3 components to the §4 spec. |
| 2 | `V2VisionScreen.tsx` | `mode === 'addScene'` renders `<VisionCeremony mode="add" …/>` instead of `V2VisionAddScene`. `pendingPhoto` renders `<VisionCeremony mode="add" startAt="develop" photo={pendingPhoto} …/>` instead of `V2VisionAddPhoto`. Create (`mode create/ready` or `state none`) renders `<VisionCeremony mode="create" …/>` instead of `V2VisionCreationFlow`, passing through the same props (`onSaveDescription`, `onAssemble`, `onUploadAsset`, `resumeGeneration`, `onResumeGenerationConsumed`, `onPremiumRequired`). Thread `caption` into `addScene` / `createVision` calls. Pass `justAdded` to `V2SavedVision` after a successful add. **Regenerate** (`openImageGeneration` → `replaceSceneId`) keeps using the ceremony with `startAt="describe"`; Seal still applies. |
| 3 | `V2VisionCreationFlow.tsx` | Keep its logic (`generate`, `choose`, `pickImages`, `uploadOne`, `saveUploads`, the paywall resume). Move the rendering to `VisionCeremony`: either the ceremony calls these functions, or extract them into `useVisionCreationActions()` (preferred) with signatures unchanged. The `uploading` "Placing your photos…" block → `// DEFERRED: replaced by ceremony Develop (own-photo stack)`. Auto-save on all-uploaded now fires **after Seal**, not on upload completion. |
| 4 | `V2VisionAddScene.tsx` | Logic stays (`handleGenerate`, `handleSelect`). The render switches to the ceremony; leave the old JSX under `// DEFERRED:`. |
| 5 | `V2VisionAddPhoto.tsx` | Unreferenced after #2. Add a top-of-file `// DEFERRED: replaced by VisionCeremony develop → keep → seal for single photos.` Do not delete. |
| 6 | `VisionIntroStage.tsx`, `VisionMethodStage.tsx` | Unreferenced from the flow after #3. `// DEFERRED: replaced by ceremony Ask beat.` They are still imported by `VisionVisualQADevHost.tsx`; leave that import working. |
| 7 | `V2SavedVision.tsx` | The "Add image" entry opens the ceremony at Ask (`onAddGenerate`-style callback, new prop `onAddImage`) instead of `VisionAddSheet`. Keep `VisionAddSheet` rendered-but-unreachable behind `// DEFERRED:`. Add the `justAdded` header (§4.8). |
| 8 | `V2SavedVision.tsx` (Replace) | **Locked rule: Replace is cut off once an image is kept.** Remove the board's "Replace" action for existing scenes (the `onReplace` menu path near lines 183/240) behind `// DEFERRED: Replace locks at Seal (decision Oct 2026); remove + add remains.` Keep "Regenerate" for `AI_GENERATED` scenes exactly as it is now (capped). Keep "Remove". |
| 9 | `VisionTwoUpStage.tsx` | Unreferenced after #2–#4. `// DEFERRED: replaced by ceremony Develop/Choose.` Keep `visionTwoUp.ts` (the ceremony uses `visionTwoUpState`). |
| 10 | `board/VisionBoardPhoto.tsx` | Optional `caption?: string` and `arriving?: boolean` props. Render the pin drop when `arriving`. Render the caption in italic serif ~13pt in the bottom paper margin **only if** the existing paper bottom margin is ≥ 24pt. Otherwise `// DEFERRED: caption on board` and render nothing; do not change board layout to make room. |
| 11 | `adapters/v2/vision/types.ts`, `visionAdapter.ts` | `VisionSceneReadModel.caption: string \| null`; `V2VisionTile.caption?: string \| null`; map it through. |
| 12 | `hooks/v2/vision/useV2Vision.ts` | `addScene` / `createVision` scene inputs accept optional `caption`, forwarded in the POST body. |
| 13 | Backend (§7) | Additive `caption` field. |

---

## 7. Backend (additive only)

- `schema.prisma` → `model VisionScene`: add `caption String? @db.VarChar(80)`. New migration `add_vision_scene_caption` with a matching `ROLLBACK_…sql` (the repo convention).
- `domain/v2/vision.ts` → `CreateVisionSceneSchema`: add `caption: z.string().trim().max(80).optional().nullable()`. The schema is `.strict()`, so this field **must** be added before mobile sends it. Also accept `caption` inside `CreateVisionSchema`'s scenes array if it reuses this schema.
- `VisionService.addScene` / create path: persist `caption`, return it in the scene read model.
- **Deploy order:** backend (Railway) first, mobile second. Mobile must tolerate `caption` being absent from responses.

---

## 8. Analytics (additive)

| Event | When | Props |
|-------|------|-------|
| `vision_ceremony_beat_viewed` | Each beat enters | `anchor_id`, `mode` (`create`/`add`/`regenerate`), `beat`, `path` (`words`/`photo`/`own_photo`) |
| `vision_seal_started` | First hold-begin per print | `anchor_id`, `mode`, `path` |
| `vision_seal_abandoned` | Release before commit | `anchor_id`, `progress` (0–1, 2dp) |
| `vision_seal_completed` | Commit | `anchor_id`, `mode`, `path`, `caption_edited` (bool), `hold_attempts` |
| `vision_caption_edited` | Caption differs from prefill at Seal | `anchor_id`, `length` |

Existing events keep their current triggers. `vision_image_selected` still fires on the choice; if it fired on the old full-screen confirm, it now fires on the Choose tap.

---

## 9. Copy change table

| File | Line | Old | New |
|------|------|-----|-----|
| `VisionMomentInput.tsx` | 277 | `isCreate ? 'What do you see?' : 'What else do you see?'` | `isCreate ? 'Describe the moment it's already true.' : 'Describe another moment from this future.'` |
| `VisionMomentInput.tsx` | 281 | `'Create my images'` | unchanged |
| `V2VisionCreationFlow.tsx` | `paperTitle` (uploading block) | `'Placing your photos…'` | DEFERRED (block replaced) |
| `V2VisionAddPhoto.tsx` | hint | `'Bring this photo into your Vision.'` | DEFERRED (screen replaced) |
| `visionCeremonyCopy.ts` (new) | — | — | Every string in §4 verbatim: "When it's true, what do you see?", "What else do you see?", "Add to your vision", "Imagine it from words", "Use my own photo", "Take a photo", "You choose what belongs in your Vision.", "Your vision", "Your future is taking shape.", "Reading your moment", "Composing the scene", "Developing the images", "Giving the second one time to develop", "Takes about a minute. You can leave; it keeps developing.", "Placing your photo", "Finding the light", "Developing", "Tap the one that feels right.", "Neither feels right, try again", "Write one line on it", "Drag the picture to reframe · tap the line to rewrite it", "See both again", "Replace photo", "Keep this one", "Hold your anchor to seal it.", "Once it's sealed, it stays. That's the point.", "Press and hold", "Sealed.", "This is where it leads.", "Sit with it now", "Thirty seconds, eyes on the picture. This is the first one.", "Thirty seconds with the new picture first.", "Added to your vision" |

---

## 10. Deferred (comment, don't delete)

- `VisionIntroStage`, `VisionMethodStage`, `VisionAddSheet`, `VisionTwoUpStage`, `V2VisionAddPhoto`, and the "Placing your photos…" block.
- The board "Replace" action (§6 #8).
- Persisting the reframe offset.
- Showing the caption inside Visualize.
- Caption on the board when the paper margin is too small (§6 #10).

---

## 11. Tests

- Update `V2VisionCreationFlow.test.tsx`, `VisionAddSheet.test.tsx`, and `VisionImageArrival.test.tsx` for the new entry points. Keep existing testIDs where the element survives.
- New `ceremony/__tests__`:
  - The beat order for create, add, own-photo, and regenerate.
  - **No reveal before a candidate `imageUrl` exists** (a PARTIAL job with one candidate develops exactly one print).
  - Hold < 1600ms makes no save call.
  - Hold = 1600ms makes exactly one save call, with `caption`.
  - A failed save after Seal shows retry and never requires a second hold.
  - The accessibility `activate` action commits.
  - Reduce Motion: no animation longer than 200ms; the hold is still 1600ms.
  - No forbidden vocabulary in `visionCeremonyCopy.ts` (grep test).
- Backend: `CreateVisionSceneSchema` accepts a caption ≤80, rejects >80; the read model returns `caption`.
- Run `npx tsc --noEmit`, `npm test` (mobile), and `npm test && npm run type-check` (backend). Coverage thresholds (70/60) must hold.

---

## 12. Acceptance criteria

- [ ] There is no stock/intro art anywhere in the add or create flow. Ask is the first screen in both modes, and the board's "Add image" opens Ask, not a sheet.
- [ ] The print is one persistent element from the Ask frame to the board landing. No hard cuts between beats.
- [ ] Generation: the user's own words light up during the wait, two dark prints appear, each develops **only** when its image exists, and Choose is a single tap with no full-screen confirm.
- [ ] Own photo (single and multi): it develops from local URIs, nothing uploads before Seal, and multi-select develops as a stack.
- [ ] Caption is prefilled with the intention, editable inline, max 80 characters, persisted on the scene, and returned by the API.
- [ ] Seal: the 1600ms hold on the anchor, `sealRise` → `seal`, Light/Light/Medium/Heavy haptics, the stamp lands in the print corner without covering the caption, and the save fires exactly once.
- [ ] After Seal the board offers no Replace for that scene; Regenerate (AI scenes, capped) and Remove still work.
- [ ] Pinned: the torn-edge cream rise, the existing arrival flight and `visionPin`, the gold pin drops on the new scene only, and the "Sit with it now" header appears above Begin Visualize.
- [ ] Backgrounding mid-Develop pauses polling and stops `formBed`. Returning catches up, and any images that arrived in the meantime develop on return.
- [ ] The paywall resume (`resumeGeneration`) lands in Develop with the saved description.
- [ ] Reduce Motion is respected; VoiceOver/TalkBack can complete Seal.
- [ ] All route names, API paths, function signatures, and existing analytics names are unchanged; the new events fire as specified.
- [ ] `tsc`, mobile tests and backend tests all pass; coverage thresholds hold.
