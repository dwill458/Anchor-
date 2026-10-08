# Codex Prompt — Vision Ceremony: Fix Pass 1

**Context:** `VISION_ADD_CEREMONY_CODEX_PROMPT.md` was implemented (`components/v2/vision/ceremony/*`, plus edits to `V2VisionScreen`, `V2SavedVision`, `VisionMomentInput`, `VisionBoardPhoto`, and the backend `caption` field). This pass fixes the defects found in a device review and a code read. **Do not re-architect.** Every change below is surgical.

**Scope:** `anchor/mobile/src` only. No backend changes.

---

## Read first

| File | Lines of interest |
|------|-------------------|
| `components/v2/vision/ceremony/VisionCeremony.tsx` | formBed effect (~L103–107); `printPlacement` + `askW` (~L248–265); `anchorPosition` (~L266–269); Ask render (~L300–312); Keep render (~L335–340); `choose` / `neither` |
| `components/v2/vision/ceremony/VisionPrint.tsx` | `imageStyle` scale `* (showCaption ? 1.16 : 1)`; `pan` gesture; caption `TextInput` |
| `components/v2/vision/ceremony/visionCeremonyCopy.ts` | `hint` |
| `components/v2/vision/VisionMomentInput.tsx` | `subtitle` (L283–285), `referenceTitle` (L486, style L598), `ceremony` styles |
| `components/v2/vision/visionGuidance.ts` | `visionDescriptionExample(intention, category)` (L153) |
| `screens/v2/vision/V2VisionScreen.tsx` | `savedImageUrl`, `arrivingSceneId` (~L365), `confirmAddPhoto`, `addGeneratedScene`, `replaceScene` |
| `components/v2/vision/V2SavedVision.tsx` | L319 (corrupted character), edit list (~L285–300), board focus |
| `components/v2/vision/board/VisionBoard.tsx`, `VisionBoardPhoto.tsx` | Focused-photo state, `arriving` pin |

## Preservation rules (unchanged from the original prompt)

- These stay exactly as they are: route names, API paths, function signatures, existing analytics event names, AsyncStorage keys, and the 1600ms seal hold.
- Deferred ≠ deleted: anything removed gets a `// DEFERRED:` comment.
- Forbidden vocabulary is still forbidden.

---

## Change table

| # | File | Defect | Fix |
|---|------|--------|-----|
| 1 | `VisionCeremony.tsx` (formBed effect) | **The ambient bed loops on every beat except Pinned**, including Ask, Describe, Keep and Seal. It's tiring and it's wrong. | Play `formBed` (looped, 2.5s fade-in) **only while `beat === 'develop'`, the app is in the foreground, and no print has started revealing.** Generation path: stop it (550ms fade) the moment the first candidate begins developing. Own-photo path: stop it when the reveal starts. Ask, Describe, Choose, Keep and Seal are silent apart from event sounds. Add `playCreationSound('uiTap')` to the Ask primary/ghost buttons and the Keep button. |
| 2 | `VisionCeremony.tsx` (Ask, create mode) | **The entrance is an empty dashed frame** taking up about a third of the screen. It reads as broken. | Put the suggested moment inside the frame. Render `visionDescriptionExample(anchorIntention, anchorCategory)` centered in the frame: italic serif (`VISION_SERIF_ITALIC`) 17/24, `#F4EDE0` at 72% opacity, max 6 lines with tail ellipsis, 20pt inner padding. Above it, a small label "A moment you could see" (Inter-SemiBold 10, letter-spacing 2, uppercase, `#ADAABC`). **The frame is pressable:** tap → `setDescription(example)`, `setInputPath('words')`, `setBeat('describe')`, `v2Haptics.selection()`, and track `vision_ceremony_suggestion_tapped { anchor_id, mode }` (new event). The text fades out (stageFadeMs) as the frame shrinks into Describe. Keep the marching dashes; remove the radial "breath" inside the frame (the text replaces it). |
| 3 | `VisionCeremony.tsx` (Ask, add mode) | Same empty frame. | Behind the empty frame, render the most recent existing board image as a developed print: paper border, 85% of the frame size, offset −14pt x / +10pt y, rotated −4°, 100% revealed, no caption, not pressable. The empty frame sits in front, rotated +2°, holding the label "Another moment" (same label style as #2) and no example text. Add prop `previewImageUrl?: string \| null` to `VisionCeremony`; `V2VisionScreen` passes `model.tiles[0]?.imageUrl` for `mode="add"`. With no preview image, fall back to the create-mode treatment from #2. |
| 4 | `VisionCeremony.tsx` (`askW`, Ask layout) | The frame is too tall and the buttons sit stranded at the bottom. | Frame height ≤ **30% of usable height** (`askW = Math.min(width * 0.52, usable * 0.30 / 1.25)`). Lay Ask out top-down instead of anchoring the frame to a fixed y: copy block → 28pt gap → frame → 32pt gap → buttons. The footer stays bottom-anchored only if the content would otherwise overlap it (small phones). Check at 667pt (iPhone SE) and 932pt heights. |
| 5 | `VisionCeremony.tsx` (`anchorPosition`) | **On Describe, the persistent anchor mark sits on top of the headline** ("Describe th◯moment") and clips the "CREATE YOUR VISION" kicker. `VisionMomentInput` is a ScrollView, so a fixed mark will always collide. | Anchor `opacity: 0` while `beat === 'describe'` (it fades with stageFadeMs and returns on Develop). In ceremony mode, `VisionMomentInput`'s `paddingTop` goes from `insets.top + 70` to `insets.top + 56`. |
| 6 | `VisionMomentInput.tsx` L283–285 | The subtitle repeats the headline: "Describe the moment you want to see for this Anchor." | When `ceremony` is true and the words path is active: "Present tense. Where you are, what you're doing, how it feels." The photo-path subtitle is unchanged, and so is non-ceremony copy. |
| 7 | `VisionMomentInput.tsx` L486 / L598 | "Make it look like you" wraps onto three lines in 19pt serif inside a narrow column. | In `inkStyles` (ceremony only), `referenceTitle` becomes `Inter-SemiBold` 15/20, `numberOfLines={1}`. Leave the paper style as it is. |
| 8 | `VisionPrint.tsx`, `visionCeremonyCopy.ts` | **Reframe isn't persisted**, so the "Drag the picture to reframe" promise is broken. And the 1.16 overscan stays applied through Seal and Pinned, so the arrival flight (which measures the unzoomed window) jumps at handoff. | Remove reframe for this pass: disable the `pan` gesture with `// DEFERRED: reframe returns when crop offset is persisted`. The overscan multiplier is always 1. Copy `hint` becomes "Tap the line to rewrite it". Keep the `reframe` props in the type so tests and callers compile, just inert. |
| 9 | `VisionCeremony.tsx` (Keep) | **The keyboard covers the caption strip** on most phones (the caption sits at about 60% of the screen height). | Listen to `Keyboard` show/hide (`keyboardWillShow` on iOS, `keyboardDidShow` on Android). While the keyboard is up during Keep, translate the hero print up so its caption strip clears the keyboard by 16pt (`withTiming`, 250ms) and hide the Keep footer. Restore on hide. |
| 10 | `V2SavedVision.tsx` L319 | A corrupted character renders as "Preparing your Vision�". | Replace it with "Preparing your Vision…" (U+2026). Then scan every file touched by the ceremony implementation for U+FFFD and fix any other hits. |
| 11 | `V2VisionScreen.tsx` (`arrivingSceneId`) | The newly pinned scene is found with `tile.imageUrl === savedImageUrl`. Signed URLs can differ between the save response and the refreshed read model, and when they do, the gold pin never drops. | Store the saved **scene id** instead of the URL. In `confirmAddPhoto`, `addGeneratedScene`, `replaceScene` and create's `onAssemble`, take `saved.scenes.find(s => s.assetId === assetId)?.id` into new state `savedSceneId`, and set `arrivingSceneId={justAdded ? savedSceneId : undefined}`. Keep `savedImageUrl` for the arrival flight. Reset both to `null` whenever a ceremony starts. |
| 12 | `V2SavedVision.tsx`, `VisionBoard.tsx` | **The caption is saved but shown nowhere.** Board and Visualize were both deferred, which makes the Keep beat a promise the app doesn't keep. | Show it in two places that need no layout change: (a) in the edit list, under "Image {n} of {total}", as italic serif 15, `colors.text.primary`, one line with ellipsis, only when present; (b) in the board's focused-photo state (tapping a photo glides it into focus), as a single italic serif 15 line directly under the focused photo, fading in with the focus animation. If the focused state has no room under the photo, render it in the existing annotation/caption slot while that photo is focused. `V2VisionTile.caption` is already mapped. The Visualize display stays DEFERRED. |
| 13 | `VisionCeremony.tsx` (Choose → "Neither") | The link stays visible after the server returns `VISION_GENERATION_LIMIT`, so the person taps into a dead end. | When `actions.generation.error` or `actions.notice` comes from `VISION_GENERATION_LIMIT` (expose the error code from `useV2VisionSceneGeneration`, which already maps it in `sceneMessage`), hide the "Neither feels right" link and show the limit message as a note. |

---

## Tests

- **Update** `ceremony/__tests__/VisionCeremony.test.tsx`:
  - formBed starts only on Develop, and stops on the first reveal and when the app backgrounds; no `formBed` on Ask, Describe or Keep.
  - Ask (create) renders the example text, and tapping the frame lands on Describe with it prefilled.
  - Ask (add) renders the preview print when `previewImageUrl` is set, and falls back to the example when it's absent.
  - The anchor is hidden on Describe.
  - The pan gesture is disabled on Keep.
  - The "Neither" link is hidden after a limit error.
- **Add** a V2VisionScreen test: after an add, `arrivingSceneId` equals the saved scene id even when the read-model URL differs from the save response URL.
- **Add** a V2SavedVision test: a tile with a caption shows it in the edit list.
- **Add** a grep test: no U+FFFD in `components/v2/vision/**`.
- Run `npx tsc --noEmit` and `npx jest src/components/v2/vision src/screens/v2/vision`. Both must pass. Report the actual output; don't summarize it.

## Acceptance criteria

- [ ] Silence on Ask, Describe, Choose, Keep and Seal (only tap, seal and reveal cues). The bed plays only during the Develop wait and fades out when the first image starts developing.
- [ ] Create-mode Ask shows the suggested moment inside the frame, and tapping it prefills Describe. Add-mode Ask shows the last print behind a tilted empty frame.
- [ ] The Ask frame is ≤30% of usable height, with no dead band above the buttons on 667pt or 932pt screens.
- [ ] The anchor mark never overlaps Describe's headline or kicker.
- [ ] Describe subtitle (ceremony, words path): "Present tense. Where you are, what you're doing, how it feels." "Make it look like you" fits on one line.
- [ ] No reframe gesture and no reframe hint. The arrival flight has no zoom jump.
- [ ] Caption editing works with the keyboard up on a 667pt screen.
- [ ] "Preparing your Vision…" renders correctly, and there's no U+FFFD anywhere under `components/v2/vision`.
- [ ] The gold pin drops on the new scene after create, add, and regenerate.
- [ ] The caption is visible in the edit list and in the focused photo.
- [ ] After a generation-limit error, "Neither feels right" is hidden.
- [ ] `tsc` and the vision Jest suites pass; real output is included in the report.
