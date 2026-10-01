# Visualize polish and Vision entrance pass - 2026-09-30

Implementation is reviewable in the shared checkout. Device visual acceptance remains open. No deployment, OTA, merge or release was performed.

1. **Startup delay.** The real route is `V2PracticeScreen -> V2PracticeSessionScreen -> V2CinematicSessionScreen`. Setup previously fired native image prefetch without awaiting it. Navigation then replaced setup with an explicit preparation screen while native image dimensions, prefetch, Skia decoding, board asset loading, SVG/shader preparation and mark layout completed. The clock correctly waited, but the user experienced that work after pressing Begin.

2. **Startup change and measurements.** The same asset loader and exact scene measurement now run behind the visible setup board. Begin accepts only a prepared snapshot, reuses its texture objects, frame, attachment, parsed artwork, shader, viewport and measured mark, and avoids the setup veil/shared Anchor flight. A regression verifies no second asset-loader request or mark measurement is needed at Begin. `PRACTICE_SESSION_STARTED` includes `assets_prepared_in_setup` and `begin_to_clock_ms` for real runtime measurement. There is no controlled authenticated before/after latency result; no speedup number is claimed.

3. **Discontinuities identified in source.** The preparation surface replacing setup; the visible uncentered measurement board being replaced with the centered cinematic stage; live window/mark layout changes rebuilding geometry at system-bar boundaries; a live Vision refresh being able to replace the session with an unavailable/loading route; ending copy unmounting before its fade-out; and resource callbacks changing identity on host rerenders. These are concrete implementation risks. The saved Android contact sheet confirms the preparation surface and standalone Done ending, but neither sampled frames nor these source findings establish that every risk caused an observed single-frame flash.

4. **Fixes.** Preparation stays behind setup. Normal Begin mounts the prepared cinematic stage directly, without the visible measurement board. The fallback measurement board is hidden. The prepared viewport and first measured mark remain fixed; live Vision revalidation cannot replace a prepared session. Copy remains mounted while opacity falls to zero within the existing board-hold interval. Texture readiness callbacks use stable references and fire for image changes rather than every callback recreation. No longer fades were added. The camera, breakout, image transitions, masks, compression, return geometry functions and timeline files are unchanged.

5. **Readiness and recovery.** Existing dimension/pixel limits, native prefetch and Skia texture decode remain authoritative. Board resources load and a native board is mounted for warm-up/mark measurement; frame and attachment decode, saved SVG parsing and enhanced-art shader readiness finish before Begin. Setup shows its real board with quiet preparation/error copy. Failed assets offer Retry; partial results preserve Continue with available images, selection order, and a coherent selected board at both ends. Preparation cannot start the practice clock, play session audio or record completion. Anchor, Vision ID/text, ordered tiles, artwork, duration and sound/haptic choices are frozen for playback. Paywall return goes through setup for Visualize instead of bypassing preparation.

6. **Setup and Vision entrance.** Visualize uses an ink environment throughout, the actual Vision board as hero, smaller introductory copy, blue segmented duration selection with 44-point minimum targets, quiet Sound/Haptics rows, and its established CTA beneath the content. The production setup no longer offers the dev prototype reel. Vision entrance now gives the existing curated photograph a bounded, visible area beneath its introduction, replaces the tall empty gradient with a scrollable composition, and retains the creation CTA and persistence/generation flow. Native VisionPhoto overscan uses measured pixel dimensions. The entrance atmosphere is not used as a fake saved Vision.

7. **Thread handoff.** The existing engine reaches completion only after its approved Carry copy and silent board hold. After completion persistence and audio settlement, the session enters the existing `V2FocusCompleteScreen` with the shared `practiceTitle="Visualize"` option. Its established ink-to-completion entrance remains intact. There is no standalone cinematic Done button and no modal covering the final board. Background completion waits for foreground before the handoff.

8. **Authority and exactly once.** `PracticeCompletionService.commitVisualizeCompletion` and its canonical queue/server sync path are reused unchanged. No extra reinforcement write or strength calculation was introduced. The engine/session guards prevent duplicate persistence; a separate guard prevents duplicate Thread handoff, and the adapter prevents duplicate hub return. Thread values come from the recorded session/store. Failed local persistence is passed as `saved: false`; completion UI and Today return do not pretend it was saved. Tests cover duplicate callbacks, early exit, frozen settings, background readiness/completion, pause/resume, payloads, and completion navigation. Live authenticated server outcomes still require device verification.

9. **Image presentation and generation.** Existing original image sources, image order, cover/aspect calculations, first-photo crop continuity, adjacent mounted images and texture pixel limits remain intact. The presentation adapter currently exposes no focal-point metadata, so this pass does not invent focal points. The generation configuration already uses 9:16 / 1080x1920 with crop-safe framing. Prompt additions ask for coherent anatomy/hands, correct requested objects/screens, identity consistency with supplied references, and ordinary future-memory realism without unsupported achievements/details. Providers and safety routing are unchanged. These prompt edits apply to future generations after backend deployment; existing images were not regenerated.

10. **Verification.** See the adjacent test/export logs for exact commands and results. The final mobile regression run passes **34 suites / 316 tests** and covers Visualize, Vision board/entrance, Practice/Focus/Deep Focus, engine, completion, audio and haptic timing. Backend generation tests pass 17 tests; backend TypeScript build passes. Android and iOS Expo/Hermes exports pass; they are bundle exports, not native builds or device visual acceptance. Mobile TypeScript reports 15 diagnostics in untouched Vision generation/input, notification/stats, legacy Practice, Progress fixture, auth/session and widget files; there are no diagnostics in changed files. `git diff --check` passes. Unrelated shared-checkout edits were preserved.

11. **Open QA.** The connected target is an Android emulator (720x1560), currently at sign-in. An asynchronous request asks the user to sign in for real-data recording. No physical Android/iOS device or iOS simulator is connected. No new complete authenticated recording, frame-by-frame flicker sign-off, GPU frame-pacing/peak-memory profile, real audio/haptic acceptance or controlled startup comparison was obtained. The full 1/3/5-minute, one/multiple-image, reduced-motion, pause/background/exit and failure matrix remains a device gate. The cold loader remains available as a defensive fallback for callers without a prepared snapshot; normal setup and paywall-resume routes use prepared setup. Native decorative-asset presentation still needs frame review even though its board is warmed before Begin. Do not label this production-lock accepted yet.

12. **Files changed by this pass.**

- `src/screens/v2/practice/visualize/V2VisualizePrepareScreen.tsx`
- `src/screens/v2/practice/visualize/V2CinematicSessionScreen.tsx`
- `src/screens/v2/practice/visualize/cinematicAssets.tsx`
- `src/screens/v2/practice/V2PracticePrepareScreen.tsx`
- `src/screens/v2/practice/V2PracticeScreen.tsx`
- `src/screens/v2/practice/V2PracticeSessionScreen.tsx`
- `src/screens/v2/practice/practiceRoutes.ts`
- `src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx` (shared title type only)
- `src/components/v2/vision/V2VisionCreationFlow.tsx`
- `src/components/v2/vision/VisionPhoto.tsx`
- `src/screens/v2/practice/visualize/__tests__/V2CinematicSessionLifecycle.test.tsx`
- `src/screens/v2/practice/visualize/__tests__/V2VisualizePreparation.test.tsx`
- `src/screens/v2/practice/__tests__/V2VisualizeThreadCompletion.test.tsx`
- `src/components/v2/vision/__tests__/V2VisionCreationFlow.test.tsx`
- `src/components/v2/vision/__tests__/VisionPhoto.test.tsx`
- `backend/src/services/v2/visionScenePlanning.ts`
- `backend/src/services/v2/__tests__/visionScenePlanning.test.ts`

Mobile source paths above are relative to `anchor/mobile`. This report and adjacent `polish-*` verification logs/screenshots are supporting evidence. Bundle artifacts are retained under `.expo/visualize-polish-exports/{android,ios}`. Other changes appearing concurrently in the shared backend checkout are outside this pass.
