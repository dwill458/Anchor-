# Vision visual truth polish — delivery and evidence

Reviewed against `162897.jpg` and against the running native app on the user's signed-in Samsung phone, September 30, 2026. This work continues the existing Vision migration in the shared checkout; it does not replace its backend, persistence, navigation, or cinematic session architecture.

## Visual changes

- A full-width, dominant hero now leads the Canvas. Two images form a complete asymmetric composition; three images use differently sized supporting apertures. Four or more retain three prominent Canvas images, with the collection available through management and Visualize.
- Static paper/ink edge paths blend photographs into the surrounding cream or dark surface. No tape, pins, frames, cork, decorative map, or parchment texture was introduced.
- The user's saved enhanced artwork sits directly at the photograph transition. Its SVG remains the fallback. The one-image position was raised after phone inspection so it clears Add image.
- Edit Vision, Manage images, and Archive live in the overflow menu. Add image occupies the Canvas's lower negative space. My Vision initially shows three lines with Read more; Begin Visualize remains the primary action. Chart is a compact supporting connection.
- Home and Anchor Details share the photograph edge primitive and real hero source. Their short statement and category cue sit below the photograph, keeping the subject visible.
- Add Image retains the dark environment and Make it look like you. Candidate selection and upload previews use the hero's presentation ratio. Creation buttons use the restrained cream treatment.
- A status-bar scrim keeps contrast stable when photographs scroll under the Android status area.

## Image geometry

| Property | Final behavior |
| --- | --- |
| Gemini request | Portrait `9:16`; its response dimensions can vary by provider/model. |
| OpenAI fallback | DALL-E 3 portrait `1024 × 1792`, approximately `4:7`. |
| Storage bounds | At most `1080 × 1920`, using `inside` and `withoutEnlargement`. Original aspect ratio is retained; no upscaling or stretching. Actual encoded width/height are recorded by the existing pipeline. |
| Actual saved sources measured on the phone | Hero: `1024 × 1024` (`1:1`). Supporting image: `768 × 1376` (approximately `0.558:1`). Both are existing generated assets, demonstrating that legacy images have mixed geometry. |
| Single-image Canvas | `0.90:1` aperture. |
| Multi-image hero | `1.12:1` aperture. |
| Two-image support | `1.04:1` aperture at 72% of Canvas width. |
| Three-image supports | `0.70:1` and `0.88:1`, at 47% and 49% of Canvas width. |
| Choose Image / upload preview / developing preview | `1.12:1`, matching the multi-image hero. Supporting apertures necessarily show a different crop. |
| Compact previews | Home approximately `2.86:1`; Details approximately `2.08:1`. Statement height is additional, below photography. |
| Generated crop | Proportional center cover. No face detection or persisted focal-point metadata is claimed. |
| Arbitrary uploads | Proportional cover when at least 65% of the source remains; otherwise proportional contain within a stable aperture. The cinematic entrance applies the same severe-crop policy. |

The generation instructions explicitly describe the `1.12:1` hero crop and the supporting apertures. Essential subjects, faces, hands, and key objects belong in the middle 70% horizontally and between 30% and 65% vertically. Faces and the main focal object should sit between 45% and 55% vertically for compact previews. Top, bottom, and lower corners hold expendable environment, protecting the paper transition and Anchor intersection. The portrait original remains available to the existing full-screen cinematic.

The updated prompt is saved in the backend source. It has **not been deployed**. Live phone generation used the currently deployed provider pipeline, rather than proving that the revised framing instructions have reached production. Raw dimensions before backend encoding were not independently captured in this pass.

## Visual parity and correction loop

Production React Native components were rendered, captured, inspected against the reference, corrected, and captured again. The first comparison exposed rectangular edge seams, weak creation CTA contrast, and preview copy over photography. Corrections added edge overscan, cream CTAs, and copy below photographs. Phone inspection subsequently corrected the single-image Anchor/Add image overlap and status-bar contrast while scrolling.

The resulting composition follows the reference's dominant hero, unequal supporting images, Anchor hinge, lower negative space, restrained Add image, compact statement, primary Visualize action, and quiet Chart connection. The real two-image Vision preserves both the dashboard's “10,000” and the hand-held phone.

Intentional differences: production sans-serif typography; real saved images and copy; two-image composition for the actual collection; subtler static edge treatment; no handwritten slogan, decorative mountains, map, excessive paper distress, or mockup-only symbols. Real device safe areas and text settings require scrolling instead of compressing the whole conceptual mockup into one viewport.

### Phone evidence

- [Real saved Vision](phone-vision-final.png) and [lower content](phone-vision-lower-final.png).
- [Single-image fixture after correction](phone-fixture-1-final.png), [three-image fixture](phone-fixture-3.png). Fixtures use production components and do not write images or descriptions to the account.
- [Home preview](phone-home-preview.png), [Anchor Details preview](phone-details.png).
- [Add Image](phone-add.png), [description and reference control](phone-add-lower.png), [source picker](phone-sources.png).
- [Live generation](phone-generate.png), [real generated candidates](phone-choose.png).
- [Cinematic entrance recording](phone-visualize-entrance.mp4) and [sampled entrance frames](phone-entrance-contact.png).
- [First completion](phone-visualize-return.png), [repeat completion](phone-completion-final.png).

The physical phone measured 1440 × 3120 pixels. Additional native Android component captures cover 360 × 780 dp and 393 × 852 dp, representing Galaxy-class and iPhone 14 Pro-class geometry. The 393 dp checks are **Android renders at iPhone dimensions, not native iOS acceptance**.

## Touchpoints

| Touchpoint | Final state and verification |
| --- | --- |
| Vision overview | Real phone data inspected; administration moved to overflow; no visible Edit/Manage hierarchy. |
| 0 images | Purposeful empty state and Add image; native fixture inspected. No fake imagery in production. |
| 1 image | One cinematic hero, breathing space, Anchor clear of Add image; phone fixture corrected and rechecked. |
| 2 images | Dominant hero with one asymmetric support; actual saved phone Vision inspected. |
| 3 images | Hero with two unequal supports and connecting Anchor; native fixtures inspected on phone and both representative geometries. |
| 4+ images | Three main images; management holds additional imagery; all saved images remain in Visualize. Six-image fixture inspected and ordering tests passed. |
| Home | Real hero, shared edge language, compact statement/category below photograph; phone inspected. |
| Anchor Details | Same shared preview primitive and real hero; saved enhanced Anchor visible; phone inspected. |
| Add Image | Existing Generate / Photos / Camera picker retained; dark description screen and reference control inspected on phone. |
| Generation | Actual phone request succeeded after the compatibility fix; developing aperture matches hero geometry. |
| Choose Image | Two actual generated candidates rendered at hero ratio. Selection/confirmation behavior covered by targeted tests. Generated candidates were not inserted into the saved Vision. |
| Visualize entrance | Existing locked motion retained; sampled phone recording shows the Canvas holding steady before the existing zoom. Shared edge paths and enhanced mark size align the entrance layers. |
| Visualize completion | Two real 180-second QA sessions reached the canonical completion screen, with enhanced artwork. Server-authoritative Thread Strength changed `55 → 60 → 62`; these are real practice completions. |
| Chart connection | Compact waypoint number, title, and arrow; real phone connection inspected. |

## Enhanced Anchor artwork

The stored model has SVG structure (`reinforcedSigilSvg` / `baseSigilSvg`) and saved enhanced artwork (`enhancedImageUrl`), rather than a separate enhanced-SVG field. Saved Anchor 2.0 surfaces prefer the actual enhanced artwork and retain the real SVG fallback.

The pass closes missing forwarding in the Vision hinge, paywall artifact, Thread event celebration, Release hold control, and Weekly Insight. Weekly Insight facts now carry the canonical SVG and enhanced URL into the persisted visual snapshot; historical snapshots can resolve the matching saved Anchor. Existing enhanced-aware Home, carousel, Details, Gallery, switcher, Chart, practice, completion, transition, Release artwork, and evolving-Anchor renderers were retained. Creation formation necessarily uses structure before a finished enhancement exists.

## Engineering

New shared components/helpers: `VisionImageEdge`, `VisionPhotograph`, `visionImageGeometry`, `VisionStatusBarScrim`. A development-only native QA host renders count states and production surfaces without persistence mutations.

Files changed in this polish pass (paths relative to the workspace):

- `anchor/mobile/App.tsx`
- `anchor/mobile/src/screens/v2/system/VisionVisualQADevHost.tsx`
- `anchor/mobile/src/components/v2/vision/{VisionImageEdge.tsx,VisionPhotograph.tsx,visionImageGeometry.ts,VisionChrome.tsx,VisionBoardPreview.tsx,V2SavedVision.tsx,VisionCandidateSelection.tsx,VisionGenerationBoard.tsx,VisionMomentInput.tsx,V2VisionAddScene.tsx,V2VisionAddPhoto.tsx}`
- `anchor/mobile/src/components/v2/vision/board/{visionBoardLayouts.ts,VisionBoard.tsx,VisionBoardScene.tsx,VisionBoardPhoto.tsx,VisionBoardIntentionCard.tsx}`
- `anchor/mobile/src/adapters/v2/vision/{types.ts,visionAdapter.ts}`
- `anchor/mobile/src/hooks/v2/vision/{useV2VisionGeneration.ts,useV2VisionSceneGeneration.ts}`
- `anchor/mobile/src/screens/v2/practice/visualize/CinematicSessionStage.tsx`
- `anchor/mobile/src/hooks/v2/paywall/useV2PaywallArtifact.ts`
- `anchor/mobile/src/components/v2/paywall/V2PaywallArtifact.tsx`
- `anchor/mobile/src/components/v2/threadEvents/V2ThreadEventCelebration.tsx` (celebration and modal wrapper)
- `anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx`
- `anchor/mobile/src/components/v2/release/V2HoldToReleaseControl.tsx`
- `anchor/mobile/src/screens/v2/release/V2ReleaseScreen.tsx`
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyInsightVisual.tsx`
- `anchor/mobile/src/adapters/v2/weeklyInsight/{types.ts,weeklyInsightFactsBuilder.ts,weeklyInsightSelector.ts}`
- `backend/src/services/v2/visionScenePlanning.ts`
- Associated geometry, Anchor hinge, Vision screen, generation-hook, weekly-facts, and prompt tests; this report and QA evidence.

The checkout also contains earlier uncommitted migration changes and removed corkboard assets. Those were preserved and are not all attributable to this polish pass.

### Tests and build results

| Check | Result |
| --- | --- |
| Focused mobile Vision / Visualize / artwork / Home / Release regression run | **44 suites, 384 tests passed** — `mobile-tests-final.txt`. |
| Preview / paywall / pricing / entitlement follow-up | **7 suites, 39 tests passed** — `preview-artwork-tests.txt`. |
| Generation compatibility regression | Two tests failed with the old null field, then **2 suites, 13 tests passed** after the fix — `generation-compat-red.txt`, `generation-compat-green.txt`. |
| Weekly Insight artwork and selector follow-up | **4 suites, 37 tests passed** — `weekly-artwork-tests.txt`. |
| Backend generation service, scene planning, provider fallback | **3 suites, 47 tests passed** — `backend-tests.txt`. |
| Backend TypeScript | Passed — `backend-typescript.txt`. |
| Mobile TypeScript | **11 existing errors remain**, in notification / weekly stats / legacy practice / Progress test fixture / auth / session / widget code. No errors in the changed Vision or artwork files — `mobile-typescript-final.txt`. |
| Expo Android and iOS exports | Passed — `platform-export-final.txt`. Export success is distinct from native iOS/device acceptance. |
| Whitespace diff check | Passed; Git emitted existing CRLF normalization warnings. |

### Compatibility fix discovered on the phone

The deployed strict generation schema returned HTTP 400 `VALIDATION_ERROR` for an unused `appearanceReferenceId: null`. Both generation hooks now omit the optional field when no reference is selected, and retain it when selected. This restores live no-reference generation without weakening server validation, changing provider order, or bypassing entitlements.

### Remaining limits

- Revised generation framing and the existing backend reference-photo contract changes still require backend deployment. The current deployed schema was proven to reject the reference field; the null omission restores ordinary generation but does not deploy reference support.
- No OTA or backend deployment was performed. The phone ran the local development build through Metro.
- Native iOS hardware, audible audio quality, and manual camera/library import were not independently accepted in this pass. Their existing lifecycle/contracts remain covered by the focused tests where applicable.
- Arbitrary off-center uploaded subjects have no face detector or editable focal-point metadata; severe aspect mismatches use contain. Generated framing is guided by the prompt, not guaranteed by a detector.
- The two live cinematic QA completions changed the real account's practice history and Thread Strength to 62. Saved Vision imagery, ordering, and description were left intact.
