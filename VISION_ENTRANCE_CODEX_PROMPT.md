# Codex Prompt — Vision Entrance: Anchor Opens, Example Prints

**Approved prototype:** https://claude.ai/artifact/LMVC7fcA9Ab1PKFtRqW89p (choreography, geometry and sound reference)
**Builds on:** `VISION_ADD_CEREMONY_CODEX_PROMPT.md` and `VISION_CEREMONY_FIX_PASS_1.md` (both applied).
**Scope:** `anchor/mobile/src` only. No backend changes.
**Goal:** Replace the text-heavy Ask beat with an entrance that leads with pictures. The user's anchor opens the screen, lifts, and three example prints for the anchor's category fan out beneath it and develop. Tapping a print starts Describe from that moment, pre-written. Nine pieces of text on screen become four.

---

## 0. Before you start: assets

This prompt needs **33 example images** (3 for each of 11 categories) at `src/assets/vision/examples/<category>/<1|2|3>.webp`. Deon generates them from the prompts in §7. **If an image file is missing, don't `require()` it.** The manifest (§3) must compile with whatever subset exists, and a category with fewer than three images falls back per §4.6. Don't invent, download or placeholder any imagery.

Image spec: 4:5 portrait, 900×1125, WebP quality 80 (about 60–110 KB each, about 3 MB total).

---

## 1. Read first

| File | Why |
|------|-----|
| `components/v2/vision/ceremony/VisionCeremony.tsx` | Ask layout (~L273–290: `askTop`, `askFrameY`, `askH`, `askW`, `addPreview`, `example`); Ask render (~L331–380: preview print, suggestion `Pressable`, eyebrow, quoted intention, title, footer); `anchorPosition` / `anchorSize` (~L300); `suggest()` (~L316); `back()` |
| `components/v2/vision/ceremony/VisionPrint.tsx` | `VisionPrintSlot`, `VisionPrint` reveal (ink/blur layers), caption strip, `pinned` |
| `components/v2/vision/ceremony/VisionDevelop.ts` | `CEREMONY`, `ceremonyDuration`, `useDevelopReveal` |
| `components/v2/vision/ceremony/visionCeremonyCopy.ts` | Copy keys |
| `components/v2/vision/VisionMomentInput.tsx` | Describe; `ceremony` mode, `subtitle`, `kicker` |
| `screens/v2/vision/V2VisionScreen.tsx` | `previewImageUrl` (from fix pass #3); tiles carry `caption` |
| `types/index.ts` L89 | `AnchorCategory`: desire, health, career, relationships, creativity, spirituality, abundance, family, learning, adventure, custom |
| `utils/categoryDetection.ts` L382 | `resolveAnchorCategory` |
| `services/CreationSounds.ts`, `services/audio/soundSources.ts` | `anchorPulse`, `formTick`, `revealSettle`, `uiTap` |

## 2. Preservation rules

- These stay exactly as they are: route names, API paths, function signatures, existing analytics event names, AsyncStorage keys, the Develop/Choose/Keep/Seal/Pinned beats and the 1600ms seal hold.
- Deferred ≠ deleted: replaced Ask code is kept behind `// DEFERRED: replaced by VisionEntrance (Oct 2026)`.
- Vocabulary: the forbidden list applies to every example caption and moment text. They've been checked; don't rewrite them.
- Gold appears only on the "yours" pin. No glow rings. Only the anchor's hairline ring draws (once).

---

## 3. New files

| File | Responsibility |
|------|----------------|
| `ceremony/visionExamples.ts` | `VISION_EXAMPLES: Record<AnchorCategory, VisionExample[]>` with `type VisionExample = { image: ImageSourcePropType; caption: string; moment: string }`. Data comes from §7. One `require()` per **existing** file. Export `visionExamplesFor(category: AnchorCategory): VisionExample[]`, which returns 0–3 items. |
| `ceremony/VisionEntrance.tsx` | The Ask beat: the open choreography, the fan, idle drift, the tap-to-pick handoff, and the add-mode layout. Props: `mode`, `category`, `anchorArt`, `previewImageUrl`, `previewCaption`, `firstRun: boolean` (play the open), `onPickExample(example, index)`, `onPickEmpty()`, `onWords()`, `onPhoto('library' \| 'camera')`, `onBack()`, `anchorTarget: PrintPlacement` (where the ceremony's persistent top anchor rests, so the hand-off doesn't jump). |

`VisionCeremony` renders `<VisionEntrance …/>` when `beat === 'ask'`, **in place of** the current Ask block. While the entrance plays its open, the ceremony's persistent anchor slot is hidden (`opacity: 0`). The entrance owns the big center anchor. When the lift completes, the persistent anchor appears at `anchorTarget` and the entrance's own anchor unmounts in the same frame. Because both render `CircularAnchorRenderer` with the same `anchorArt` at the same rect, the swap is invisible.

---

## 4. Spec

All times are relative to the entrance mounting. Positions are given for a 390×844 frame; derive them from `useWindowDimensions` and insets.

### 4.1 Open (first visit to Ask in this ceremony, Reduce Motion off)

| t (ms) | Event |
|--------|-------|
| 0 | Ink stage, vignette. Nothing else is visible. |
| 250 | The center anchor (176pt, `CircularAnchorRenderer` with `anchorArt`, at the screen center) fades 0→1 and scales 0.92→1 over 1000ms. A hairline cream ring (0.8pt, r = size/2 + 14) draws clockwise from 12 o'clock over 1100ms (stroke dash). `playCreationSound('anchorPulse', 0.35)`. |
| 1550 | **Lift.** The anchor animates to `anchorTarget` (52pt, top-center under the safe area) over 1000ms with `Easing.bezier(.2,.8,.2,1)`, and the ring fades out (500ms). At the same moment, three prints spawn **from the anchor's center**: scale 0.28, translateY −130 relative to their resting position, opacity 0. They move to their fan positions (§4.2) over 1050ms with the same easing, staggered 0 / 120 / 240ms. |
| 2050 + 120·i | `playCreationSound('formTick', 0.18)` as each print lands. No haptics on landing. |
| 2050 + 160·i | Each print develops: the `VisionPrint` reveal (ink 0.86→0, blur 1→0, scale 1.08→1) with a duration of **2400ms** for the entrance, not the 3400ms used in Develop. No `revealSettle` sound here. |
| 1900 | Headline fades in (700ms) and rises 10pt. |
| 2150 | Buttons fade in and rise 14pt (700ms). |
| 2450 | Hint fades in (600ms). |
| 3600 | Idle drift starts (§4.3). The screen is interactive from 2150. A tap before 3600 cancels the drift start and works normally. |

**Later visits** (Back from Describe, or `firstRun === false`): no open and no sound. The fan, headline and buttons fade in together over `CEREMONY.stageFadeMs` at their resting positions, already developed.

**Reduce Motion:** no open. Show the final state with a 200ms fade, prints already developed, no drift.

### 4.2 Fan geometry

- Center print: width `W = min(width × 0.44, 170)`, height `W × 244/170`. Centered horizontally. Top edge at `anchorTarget.y + anchorTarget.height + 128` (about 250 on the reference frame). z-index above the sides.
- Side prints: same size at scale 0.86, translateX ±`W × 0.53`, translateY +24, rotate ∓9° (left −9°, right +9°). Transform origin is 50% / 120%, so they swing from below like prints in a hand.
- Each print uses `VisionPrint` with `showCaption` and the strip at **52pt** for the entrance (not 62): a tiny label (`Inter-SemiBold` 8.5, letter-spacing 2.2, uppercase, `#8D8778`) above the caption (`VISION_SERIF_ITALIC` 15, ink, one line with ellipsis). The label reads **"Example"** on example prints and **"Yours"** on the user's own print.
- Hint under the fan: "Tap one to start from it" (create) / "Tap the frame, or start from the example" (add). `Inter-Medium` 12, `#9A9AB2`, centered, 16pt below the lowest print edge.
- Buttons (bottom-anchored, 34pt + safe-area bottom): cream "Imagine it from words", ghost "Use my own photo", link "Take a photo". **Removed:** the category eyebrow, the quoted intention line and the footnote.
- Headline: `VISION_SERIF` 34/36, centered, 136pt from the top on the reference frame (about 20pt under the anchor). Copy: "When it's true, what do you see?" (create) / "What else do you see?" (add).
- Check at 667pt (iPhone SE) and 932pt heights. On short screens, shrink `W` until the hint clears the first button by ≥ 16pt; never overlap.

### 4.3 Idle drift

Each print loops a gentle drift around its resting transform with `withRepeat(withSequence(…), -1, true)`: center ±4pt y and ±0.6°; left 7s and right 8s, each ±2pt and ±1°; center 6s. The loops are independent and pause while the app is backgrounded. Stop all drift on the first tap.

### 4.4 Picking an example (create, and the example print in add mode)

1. `v2Haptics.selection()` and `playCreationSound('revealSettle')`.
2. The picked print animates to translateY −60, scale 1.18, rotation 0, raised to the top z-index. The others drop by translateY +420, rotate a further ±12° and fade (all 900ms, bezier(.2,.8,.2,1)). The headline, hint and buttons fade out (300ms).
3. At 900ms: `onPickExample(example, index)`. The ceremony sets `description = example.moment`, `inputPath = 'words'` and `startedFromExample = { category, index }`, then goes to Describe.
4. Describe in this case (ceremony prop `fromExample`):
   - **Kicker** hidden.
   - **Title** "Make it yours."
   - **Subtitle** "Change the details until it's your life, not the example."
   - A small print thumbnail of the example (120pt wide, paper border, rotated −2°) sits above the title.
   - Under the text field: "Started from an example · change anything" (`Inter-Regular` 12, muted).
   - Everything else in Describe is unchanged.
5. The generated images use **the person's text as submitted**. The example image is never sent to generation and never saved to the board.

### 4.5 Add mode (`mode === 'add'`)

- **Left:** the user's most recent board print (`previewImageUrl`), already developed. Gold pin at the top center (16pt, the same gradient as `VisionBoardPhoto`'s arrival pin). Label "Yours", caption = that tile's `caption ?? anchorIntention`. Not pressable.
- **Center:** an empty frame. A `#1A1D36` fill, a dashed cream hairline and corner ticks (the existing `VisionPrint` empty style, but **opaque**, so the side prints don't show through), and "What else?" in `VISION_SERIF_ITALIC` 19 at its center. Tap → `onPickEmpty()` → Describe with an empty description and the standard add copy.
- **Right:** `visionExamplesFor(category)[0]`, pressable per §4.4.
- With no `previewImageUrl`, add mode uses the create layout with the add headline.

### 4.6 Fallbacks

- A category with 3 images: as specified.
- 1–2 images: fill the missing slots from `custom`; if that's also short, render the available prints only (2 prints sit at ±W×0.3, 1 print sits centered).
- 0 images anywhere: render the empty frame in the center (the add-mode center style, labeled "What do you see?"; tap → Describe). Never render the old text-in-frame suggestion.

### 4.7 Sound summary (entrance only)

`anchorPulse` once at open (0.35), `formTick` per print landing (0.18), `revealSettle` on pick, `uiTap` on the buttons. **No loops, no `formBed`.** Nothing plays on later visits until the person taps.

---

## 5. Change table

| # | File | Change |
|---|------|--------|
| 1 | `ceremony/visionExamples.ts` (new) | Manifest per §3 and §7. |
| 2 | `ceremony/VisionEntrance.tsx` (new) | Per §4. Reuse `VisionPrint` and `VisionPrintSlot` for the prints, adding an optional `label?: string` prop to `VisionPrint` for the "Example"/"Yours" line and an optional `captionStripPts` override. |
| 3 | `VisionCeremony.tsx` | When `beat === 'ask'`, render `VisionEntrance`. Hide the persistent anchor slot until the entrance reports lift-complete (`onAnchorHandoff`). Track `entrancePlayed` in a ref so the open runs once per ceremony mount. Add `fromExample` state and pass it to `VisionMomentInput`. The old Ask block (frame suggestion, add-mode preview, eyebrow, intention line, footnote) goes behind `// DEFERRED: replaced by VisionEntrance (Oct 2026)`. On the Ask beat, the ceremony's own prints are `opacity: 0`; they appear when Develop begins. |
| 4 | `VisionPrint.tsx` | Add the `label` and `captionStripPts` props. Add a `revealMs` prop (default `CEREMONY.revealBlurMs`) so the entrance can pass 2400. An `empty` print gets `opaque?: boolean` for the `#1A1D36` fill. |
| 5 | `VisionMomentInput.tsx` | New optional props `fromExample?: { image: ImageSourcePropType }` (thumbnail, title, subtitle and note per §4.4). Ceremony-only; the paper style is untouched. |
| 6 | `visionCeremonyCopy.ts` | Add `exampleLabel: 'Example'`, `yoursLabel: 'Yours'`, `hintCreate: 'Tap one to start from it'`, `hintAdd: 'Tap the frame, or start from the example'`, `whatElse: 'What else?'`, `whatSee: 'What do you see?'`, `makeItYours: 'Make it yours.'`, `makeItYoursSub: "Change the details until it's your life, not the example."`, `fromExample: 'Started from an example · change anything'`. Mark `suggestionLabel`, `anotherMoment` and `footnote` as `// DEFERRED`. |
| 7 | `V2VisionScreen.tsx` | Pass `previewCaption` (`model.tiles[0]?.caption`) alongside `previewImageUrl`. |

## 6. Analytics (additive)

| Event | When | Props |
|-------|------|-------|
| `vision_entrance_viewed` | Entrance mounts | `anchor_id`, `mode`, `category`, `examples_shown` (0–3), `first_run` |
| `vision_example_picked` | Tap on an example print | `anchor_id`, `mode`, `category`, `index` |
| `vision_example_edited` | At generation start, if `startedFromExample` | `anchor_id`, `category`, `index`, `edit_distance_pct` (0–100, character-level, rounded) |

`vision_ceremony_suggestion_tapped` is retired (keep the constant behind `// DEFERRED`). `edit_distance_pct` tells you whether people make the examples their own or ship them untouched.

---

## 7. Example content (manifest data + Gemini prompts)

**Gemini house-style prefix for every image:** "Film photograph, natural light, warm muted tones, subtle grain, candid documentary feel, 4:5 portrait. Faces not visible or softly out of focus. No text, no logos, no watermarks. Scene: "

| Category | # | Caption (≤ 30 chars) | Moment (Describe prefill) | Scene prompt (append to prefix) |
|---|---|---|---|---|
| health | 1 | Morning run, before work | Early morning on the coast path, running before work. Mist on the water, legs feel light, and I'm not in a hurry to stop. | a runner seen from behind mid-stride on a coastal path at sunrise, mist over the sea |
| health | 2 | A kitchen full of real food | Saturday morning in my kitchen, cutting vegetables for the week. Window open, water on the counter, my body feels clean and strong. | hands slicing vegetables on a wooden board in a sunlit kitchen, bowl of fruit, glass of water |
| health | 3 | Summit at sunrise | Standing on the summit at sunrise after the climb. Clouds below me, breathing easy, proud of what my body can do now. | a hiker from behind on a rocky summit at sunrise above a sea of clouds |
| abundance | 1 | Mornings with nowhere to be | Morning on the terrace of a house I own outright. Coffee, laptop closed, the sea below, nowhere I have to be. | a coffee cup and closed laptop on a wooden terrace table overlooking the sea at golden hour |
| abundance | 2 | The keys are mine | Holding the keys to my own front door for the first time. Afternoon light in the hallway, and it's ours. | hands holding house keys in front of an open front door, light-filled hallway |
| abundance | 3 | Dinner is on me | A long table outside at golden hour, everyone I love around it. I'm paying for dinner and I didn't check the price. | a long outdoor dinner table at golden hour with string lights, people softly out of focus |
| career | 1 | My name on the door | Walking into my own studio on a Monday. My name on the glass, the team already here, coffee in my hand. | a glass studio door with morning light, a person's hand on the handle, team blurred inside |
| career | 2 | The room said yes | The end of the pitch. The room is quiet for a second, then they say yes, and I already know what we'll build. | a conference room table after a meeting, notebooks and a laptop, window light, figures blurred |
| career | 3 | Work I'm proud of | Late afternoon at my desk, the last piece shipped. I lean back and look at the work and it's exactly what I meant. | a tidy desk by a window at late afternoon, sketches and a monitor, a chair pushed back |
| relationships | 1 | Sunday with my person | A slow Sunday with the person I love. Two coffees, the paper, their feet on my lap, no plans. | two coffee cups on a bed tray, crumpled sheets, morning light, two pairs of feet at the edge of frame |
| relationships | 2 | Friends who show up | My kitchen full of friends on a Friday night, someone laughing too loud, music on, nobody wants to leave. | a lively kitchen gathering at night, glasses and plates, people softly out of focus, warm lamps |
| relationships | 3 | Walking home together | Walking home side by side after dinner, hands in each other's pockets, talking about nothing. | two people from behind walking down a lamplit street at dusk, close together |
| creativity | 1 | The finished piece | My finished canvas against the studio wall. Paint on my hands, music low, and I don't want to change a thing. | a large finished painting leaning against a studio wall, brushes and jars, afternoon light |
| creativity | 2 | My book on the table | My book, printed, sitting on the table at a small bookshop, and a stranger picking it up. | a stack of the same hardcover book on a bookshop table, a hand reaching for one, no readable text |
| creativity | 3 | The song is done | Last take in the studio. Headphones off, the song finally sounds the way it did in my head. | headphones resting on a mixing desk in a small studio, warm lamp light, a guitar in the background |
| spirituality | 1 | Quiet at first light | Sitting on the porch at first light before anyone's awake. Tea in my hands, my mind still, nothing to fix. | a cup of tea on a wooden porch rail at first light, mist over a field |
| spirituality | 2 | At home in myself | A walk in the forest after rain. I'm not thinking about anything, and that feels like home. | a forest path after rain with light through the trees, a figure far ahead from behind |
| spirituality | 3 | Grateful, out loud | Evening at the window with my journal open, writing down what I'm grateful for, and there's a lot. | an open journal and pen on a windowsill at dusk, handwriting unreadable, soft lamp light |
| family | 1 | Everyone at my table | Holiday dinner at my house, three generations at one table, kids under it, my mother laughing. | a crowded family dinner table from the end, plates and candles, people softly out of focus |
| family | 2 | Bedtime, unhurried | Reading to my kid at bedtime with nowhere else I need to be. Small voice asking for one more page. | a parent's hands holding a picture book beside a child's bed, night lamp, no faces |
| family | 3 | The backyard we built | Summer evening in our backyard, kids running through the sprinkler, me on the grass watching. | a backyard lawn at golden hour with a sprinkler arc and kids blurred in motion |
| learning | 1 | Fluent, finally | Ordering dinner in a café abroad in their language, no app, and the waiter answers like I'm a local. | a café table abroad with a menu and espresso, a hand gesturing, street blurred behind |
| learning | 2 | The certificate is real | Holding my diploma on the steps after graduation, the hard years behind me, family waving from the lawn. | hands holding a rolled diploma on stone steps, families blurred on a lawn behind |
| learning | 3 | I can build it now | Late night at my desk, the thing I taught myself to build actually works, and I can explain every line. | a laptop on a desk at night with an out-of-focus screen glow, notes and a mug, city lights outside |
| adventure | 1 | One-way ticket | Window seat on a one-way flight, the coastline below, the plan loose on purpose. | an airplane window view of a coastline, a hand resting on the sill, a passport on the tray |
| adventure | 2 | Road with no rush | Driving a coast road with the windows down, no itinerary, stopping wherever looks good. | a car dashboard and open window on a winding coast road, sunlight, sea to one side |
| adventure | 3 | Camp above the clouds | Tent pitched on a ridge, the stove going, watching the sun go down over mountains I hiked to. | a small tent on a mountain ridge at sunset with a camp stove steaming |
| desire | 1 | The thing I wanted | The thing I wanted for years, finally in my hands. I keep looking at it and smiling. | hands unwrapping a gift box with tissue paper on a wooden table, soft window light |
| desire | 2 | Saying yes to me | Saying yes to the life I actually want, standing in the doorway of my new place with the light coming in. | a person from behind in the doorway of an empty light-filled apartment |
| desire | 3 | It's here now | The day it became real. I'm standing in the moment I used to picture, and it feels better than I imagined. | a person from behind on a balcony at golden hour overlooking a city, arms relaxed |
| custom | 1 | The day it's true | The day it's true. I'm standing inside the moment I used to picture, and it feels better than I imagined. | a person from behind at a big window at golden hour, the city or landscape beyond |
| custom | 2 | A morning like this | A morning like this, every day. Light through the window, nothing pulling at me, ready for what's next. | morning light through sheer curtains onto a bed and a cup of coffee |
| custom | 3 | Proof it happened | The photo I'll take the day it happens, the one I'll look back at and say, there it is. | an old camera on a table beside printed photographs spread out, window light |

---

## 8. Tests

- `visionExamples.test.ts`: every manifest entry has a caption ≤ 30 characters and a moment ≤ 400 characters, and no copy contains a forbidden word (reuse the vocabulary grep). `visionExamplesFor('custom')` returns ≥ 1 when its files exist.
- `VisionEntrance.test.tsx`:
  - First run plays `anchorPulse` once and `formTick` × prints.
  - A later visit plays no sound.
  - Reduce Motion renders the final state immediately.
  - Tapping an example calls `onPickExample` with the right index after 900ms, and Describe opens with `moment` prefilled and "Make it yours."
  - Add mode renders "Yours" plus the pin and the opaque empty center; tapping the center opens Describe empty.
  - 0 images → the empty-frame fallback; the old suggestion card never renders.
- `VisionCeremony.test.tsx`:
  - The persistent anchor is hidden during the open and shown after the handoff.
  - Back from Describe returns to the entrance without replaying the open.
  - `vision_example_edited.edit_distance_pct` is 0 for an untouched example.
- Run `npx tsc --noEmit` and `npx jest src/components/v2/vision src/screens/v2/vision`. **Paste the real output** in the report.

## 9. Acceptance criteria

- [ ] On a first visit, the anchor opens center-screen, lifts to the top, and three category prints fan out from behind it and develop, matching the prototype's timing within ±100ms.
- [ ] The visible words on Ask are the headline, two buttons, the link, the hint, and the print labels/captions only. No eyebrow, quoted intention, footnote, or text-in-frame suggestion.
- [ ] The prints drift when idle, and the drift stops on tap and in the background.
- [ ] Tapping an example opens "Make it yours." with the moment prefilled and the thumbnail shown. Generation uses the person's edited text; the example image is never saved or sent.
- [ ] Add mode shows "Yours" with the pin, an opaque "What else?" frame, and one example.
- [ ] Sound: `anchorPulse` once, ticks on landing, `revealSettle` on pick. No loops on Ask, ever.
- [ ] Back from Describe shows the entrance at rest, silently, with no replay.
- [ ] Reduce Motion skips the open.
- [ ] Missing images degrade per §4.6 with no crash and no bundler error.
- [ ] There's no anchor jump at the handoff to the persistent anchor.
- [ ] Layout holds at 667pt and 932pt.
- [ ] `tsc` and the vision Jest suites pass; real output is included.
