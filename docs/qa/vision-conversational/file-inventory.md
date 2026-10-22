# Vision conversational implementation file inventory

This inventory covers every path in `git diff --name-only 8e820632..306dba3d` (73 code/checkpoint paths) and the final Vision delivery evidence. It excludes unrelated pre-existing Chart/Thread working-tree changes. The user-provided `ANCHOR_VISION_CREATION_AUDIT.md` was input/reference material, not an authored project deliverable, and is intentionally excluded.

## Backend implementation

| File | Purpose |
|---|---|
| `backend/prisma/migrations/20261020220000_vision_conversation/migration.sql` | Adds conversation sessions, ordered references, and generation round/source links. |
| `backend/prisma/schema.prisma` | Defines the persisted session, reference, and generation relations and constraints. |
| `backend/scripts/verify-vision-composition-provider.ts` | Exercises provider composition with explicit visual references. |
| `backend/scripts/verify-vision-conversation-migration.mjs` | Verifies migration behavior and preservation constraints. |
| `backend/scripts/verify-vision-conversation-provider.ts` | Runs provider acceptance checks for conversational generation. |
| `backend/src/api/routes/v2/visionRoutes.ts` | Exposes validated owner-scoped session and scene-generation routes. |
| `backend/src/domain/v2/vision.ts` | Defines Vision operation, candidate, round, and reference domain types. |
| `backend/src/scripts/purgeExpiredVisionConversations.ts` | Provides bounded expiry cleanup entry point for old sessions. |
| `backend/src/services/image/ImageGenerationService.ts` | Routes explicit generation intent and references to image providers. |
| `backend/src/services/image/adapters/GeminiImageProviderAdapter.ts` | Applies role-aware visual-reference instructions to Gemini requests. |
| `backend/src/services/image/adapters/OpenAIImageProviderAdapter.ts` | Preserves exact source imagery for edit/composition requests. |
| `backend/src/services/image/devImageModels.ts` | Registers development image models and provider capabilities. |
| `backend/src/services/image/types.ts` | Defines provider request and reference contracts. |
| `backend/src/services/image/visionReferences.ts` | Builds provider prompts from typed visual references and operations. |
| `backend/src/services/v2/VisionConversationRetentionService.ts` | Expires sessions safely while preserving shared and board-owned assets. |
| `backend/src/services/v2/VisionConversationService.ts` | Implements owner-bound session lifecycle, history, selection, and sealing. |
| `backend/src/services/v2/VisionGenerationService.ts` | Creates and resumes session-bound generation rounds and candidates. |
| `backend/src/services/v2/visionConversationContracts.ts` | Serializes owner-scoped session history and freshly signed asset URLs. |
| `backend/src/services/v2/visionConversationPrompt.ts` | Produces explicit operation-aware generation instructions. |
| `backend/src/services/v2/visionWorldReferences.ts` | Disables implicit board-photo inheritance; scopes legacy world references to explicit scene IDs. |

## Mobile implementation

| File | Purpose |
|---|---|
| `anchor/mobile/src/types/visionConversation.ts` | Shares typed session, round, candidate, and reference contracts. |
| `anchor/mobile/src/components/v2/vision/VisionAddSceneEntry.tsx` | Connects board Add Scene entry to durable session and draft recovery. |
| `anchor/mobile/src/components/v2/vision/VisionAddSceneSheet.tsx` | Presents the compact later-scene prompt and reference composer. |
| `anchor/mobile/src/components/v2/vision/VisionConversationSelection.tsx` | Presents generated candidates with inspect, select, and refine actions. |
| `anchor/mobile/src/components/v2/vision/VisionLineageLine.tsx` | Shows the actual parent-candidate lineage for a viewed candidate. |
| `anchor/mobile/src/components/v2/vision/VisionMomentInput.tsx` | Adds typed reference handling to the existing Vision prompt presentation. |
| `anchor/mobile/src/components/v2/vision/VisionReferenceStrip.tsx` | Manages a bounded five-image reference gallery and roles. |
| `anchor/mobile/src/components/v2/vision/VisionRefineSheet.tsx` | Edits a selected candidate with explicit instructions and references. |
| `anchor/mobile/src/components/v2/vision/VisionResumeCard.tsx` | Offers continue, keep, and start-different actions for saved sessions. |
| `anchor/mobile/src/components/v2/vision/VisionRoleChip.tsx` | Displays and edits a reference image’s semantic role. |
| `anchor/mobile/src/components/v2/vision/VisionVersionStrip.tsx` | Navigates saved conversation rounds and centers the selected version. |
| `anchor/mobile/src/components/v2/vision/VisionSceneField.tsx` | Reuses the shared scene-field presentation for the conversational composer. |
| `anchor/mobile/src/components/v2/vision/ceremony/VisionCeremony.tsx` | Integrates references, candidate history, resume, and sealing into the existing ceremony. |
| `anchor/mobile/src/components/v2/vision/ceremony/useVisionCreationActions.ts` | Connects ceremony actions to the session-aware generation lifecycle. |
| `anchor/mobile/src/hooks/v2/vision/useVisionConversation.ts` | Persists owner-bound drafts and session state for recovery. |
| `anchor/mobile/src/hooks/v2/vision/useV2VisionSceneGeneration.ts` | Starts, polls, and restores idempotent session-backed generation jobs. |
| `anchor/mobile/src/screens/v2/system/VisionConversationQALab.tsx` | Mounts production conversation components on local QA fixtures. |
| `anchor/mobile/src/screens/v2/system/VisionVisualQADevHost.tsx` | Adds the dev-only visual QA surface routing. |
| `anchor/mobile/src/screens/v2/vision/V2VisionScreen.tsx` | Wires board Add Scene and regeneration entry into the conversation flow. |

## Tests

| File | Purpose |
|---|---|
| `anchor/mobile/src/__tests__/mocks/reactNativeReanimated.ts` | Provides deterministic shared-value behavior for native animation tests. |
| `anchor/mobile/src/__tests__/reactNativeReanimated.test.tsx` | Verifies listener registration and updates in the Reanimated test mock. |
| `anchor/mobile/src/components/v2/vision/__tests__/V2VisionCreationFlow.test.tsx` | Covers the creation ceremony’s conversation flow. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionAddSceneSheet.test.tsx` | Covers composer editing, reference changes, draft callbacks, and sheet actions. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionConversationSelection.test.tsx` | Covers candidate selection and inspection interactions. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionHistoryResume.test.tsx` | Covers version history, lineage, and resume presentation. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionMomentInput.test.tsx` | Covers prompt input and structured references. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionReferenceStrip.test.tsx` | Covers reference gallery limits, roles, and edits. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionRefineSheet.test.tsx` | Covers candidate refinement instructions and reference updates. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionRoleChip.test.tsx` | Covers reference-role chip behavior. |
| `anchor/mobile/src/components/v2/vision/ceremony/__tests__/VisionCeremony.conversation.test.tsx` | Covers ceremony integration with rounds, selection, and resume. |
| `anchor/mobile/src/components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx` | Covers existing ceremony behavior and regression cases. |
| `anchor/mobile/src/hooks/v2/vision/__tests__/useV2VisionSceneGeneration.durable.test.tsx` | Covers durable idempotent job requests and recovery. |
| `anchor/mobile/src/hooks/v2/vision/__tests__/useV2VisionSceneGeneration.test.tsx` | Covers generation hook ownership and lifecycle behavior. |
| `anchor/mobile/src/hooks/v2/vision/__tests__/useVisionConversation.durable.test.tsx` | Covers draft/session durability, owner isolation, and seal acknowledgement recovery. |
| `anchor/mobile/src/screens/v2/vision/__tests__/V2VisionScreen.addImage.test.tsx` | Covers board entry, draft restoration, and exact-candidate resume/save behavior. |
| `backend/src/api/routes/v2/__tests__/visionConversationRoutes.test.ts` | Covers authenticated session and generation route contracts. |
| `backend/src/services/image/__tests__/ImageGenerationService.test.ts` | Covers provider routing and intent/reference policy. |
| `backend/src/services/v2/__tests__/VisionConversationRetentionService.test.ts` | Covers expiry cleanup and asset preservation. |
| `backend/src/services/v2/__tests__/VisionConversationService.test.ts` | Covers session ownership, lineage, selection, and sealing rules. |
| `backend/src/services/v2/__tests__/VisionGenerationService.test.ts` | Covers round generation, retries, idempotency, and worker lifecycle. |
| `backend/src/services/v2/__tests__/visionConversationContract.test.ts` | Covers request validation and compatibility contracts. |
| `backend/src/services/v2/__tests__/visionConversationWorker.test.ts` | Covers asynchronous conversation-generation worker behavior. |
| `backend/src/services/v2/__tests__/visionWorldReferences.test.ts` | Covers reference ownership and provider-input resolution. |

## Committed docs and QA receipts

| File | Purpose |
|---|---|
| `docs/vision-conversational-baseline-20261020.md` | Records the implementation baseline and preserved checkout state. |
| `docs/qa/vision-conversational/composition-flare-receipt.json` | Captures provider composition acceptance for the flare fixture. |
| `docs/qa/vision-conversational/composition-sunburst-expansion-receipt.json` | Captures the provider’s sunburst expansion acceptance result. |
| `docs/qa/vision-conversational/provider-contact-sheet.jpg` | Committed contact sheet of provider-generated composition outputs. |
| `docs/qa/vision-conversational/provider-receipt.json` | Records provider request and output metadata for composition acceptance. |

## Delivery evidence (current working tree)

These artifacts are not part of the committed implementation range; they are included as current delivery evidence:

| File | Purpose |
|---|---|
| `ANCHOR_VISION_CONVERSATIONAL_IMPLEMENTATION_REPORT.md` | Current implementation, validation, and acceptance-status report. |
| `docs/qa/vision-conversational/test-summary.json` | Records focused mobile, backend, and migration test totals. |
| `docs/qa/vision-conversational/regression-matrix.md` | Maps the 30 mandatory flows to automated, fixture, provider, and remaining evidence. |
| `docs/qa/vision-conversational/validation-commands.md` | Records the targeted mobile/backend, migration-harness, and Android packaging commands and limits. |
| `docs/qa/vision-conversational/visual-scorecard.md` | Records independent viewport comparisons and the remaining A1 fit gap. |
| `docs/qa/vision-conversational/native-build-receipt.json` | Records the local native build/QA environment receipt. |
| `docs/qa/vision-conversational/runtime/*.png` | 48 viewport captures of local QA-lab fixtures for the regression matrix and scorecard. |
| `docs/qa/vision-conversational/provider-contact-sheet.jpg` | Actual provider-output contact sheet retained for review. |
| `docs/qa/vision-conversational/cleanup-receipt.json` | Records the requested temporary QA artifact cleanup and retained evidence. |

## Additional committed presentation and integration files

The shared Chart keyboard frame is included only for its opt-in `externalKeyboard` behavior used by a modal that already moves above the IME; its default behavior is unchanged. The sheet drag guard is opt-in and defaults to false.

| File | Purpose |
|---|---|
| `anchor/mobile/src/components/dev/DevImageModelPicker.tsx` | Adds the compact, accessible development-only image-model control used in the composer. |
| `anchor/mobile/src/components/dev/__tests__/DevImageModelPicker.test.tsx` | Verifies compact control size, accessibility label, and model-selection entry. |
| `anchor/mobile/src/components/v2/primitives/V2SheetModal.tsx` | Adds opt-in `deferDragDismiss` behavior for an owner-guarded drag close; it defaults to false. |
| `anchor/mobile/src/components/v2/primitives/__tests__/V2SheetModal.test.tsx` | Verifies guarded drag requests snap back when visibility is retained and exit when the controlled owner closes the sheet. |
| `anchor/mobile/src/components/v2/chart/ChartKeyboardFrame.tsx` | Adds the optional `externalKeyboard` inset behavior; default chart keyboard handling remains intact. |
| `anchor/mobile/src/components/v2/vision/VisionConversationSelection.tsx` | Bounds selection-screen layout by viewport and retains scrollable actions on short screens. |
| `anchor/mobile/src/components/v2/vision/VisionLineageLine.tsx` | Adds a compact layout for the exact lineage display on smaller screens. |
| `anchor/mobile/src/components/v2/vision/VisionMomentInput.tsx` | Refines composer layout and keyboard presentation. |
| `anchor/mobile/src/components/v2/vision/VisionReferenceStrip.tsx` | Refines the reference strip’s compact keyboard and viewport presentation. |
| `anchor/mobile/src/components/v2/vision/VisionRefineSheet.tsx` | Refines the refinement sheet’s keyboard-aware presentation. |
| `anchor/mobile/src/components/v2/vision/VisionResumeCard.tsx` | Refines the saved-session resume presentation. |
| `anchor/mobile/src/components/v2/vision/VisionRoleChip.tsx` | Refines the reference role editor presentation. |
| `anchor/mobile/src/components/v2/vision/ceremony/VisionCeremony.tsx` | Integrates current composer and selection presentation adjustments into the existing flow. |
| `anchor/mobile/src/screens/v2/system/VisionConversationQALab.tsx` | Adds final local fixtures and viewport chrome for screenshot review; its callbacks remain local. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionMomentInput.test.tsx` | Covers composer behavior after the presentation updates. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionReferenceStrip.test.tsx` | Covers reference-strip behavior after the presentation updates. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionRefineSheet.test.tsx` | Covers refinement behavior after the presentation updates. |
| `anchor/mobile/src/components/v2/vision/__tests__/VisionRoleChip.test.tsx` | Covers role-chip behavior after the presentation updates. |
| `backend/src/services/v2/__tests__/visionConversationWorker.test.ts` | Covers that a RevenueCat dashboard photo is not inherited by a new Bloomberg-style editorial article request. |

## Final validation and remaining limits

- Final validation reported by the integration owner: mobile 92 suites / 944 passed / 0 failed; backend 20 suites / 240 passed / 0 failed, with one database suite and two database integration tests skipped; migration harness 8 checks passed; mobile and backend TypeScript passed; final Hermes export passed.
- The independent scorecard is 9.3/10 across seven selected states. The A1 fit issue is fixed, and swipe/Back interactions were verified on the emulator. The scorecard does not represent a full all-viewport pass or device-level performance certification.
- QA PNGs are local fixture renders of production components; the interaction captures demonstrate emulator behavior but do not establish an authenticated end-to-end journey or real backend persistence. Provider receipts are live-provider fixtures, not broad quality coverage.
- Remaining validation includes the two staging database integration tests, authenticated end-to-end journeys, physical iOS permissions/haptics, and release-build frame pacing/60 FPS. The Photo Fit expansion pipeline passed a live-provider center-preservation run, but no authenticated product Photo Fit journey was executed.
- `test-summary.json` records the final rerun totals and compact build/migration evidence.

## Retained artifact paths

| File | Purpose |
|---|---|
| `docs/qa/vision-conversational/cleanup-final-targets.json` | Measured targets left in place after automatic cleanup approval rejection. |
| `docs/qa/vision-conversational/file-inventory.md` | Compact implementation or QA evidence; see the report for scope. |
| `docs/qa/vision-conversational/runtime/a1-375x667.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a1-393x780.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a1-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a1-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a2-375x667.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a2-393x780.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a2-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a2-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a3-375x667.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a3-393x852-after.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a3-393x852-before.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a3-393x852-final.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a3-393x852-role-editor.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a3-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/a4-393x852-keyboard.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/add-sheet-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/b1-375x667.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/b1-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/b1-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/b2-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-375x667.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-393x780.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-393x852-after.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-393x852-final.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-after-keyboard-back.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-android-back-discard-guard.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-swipe-keep-editing.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c1-swipe-keyboard-dismiss.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c2-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c2-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c3-375x667-keyboard.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c3-393x852-keyboard-final.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/c3-393x852-keyboard.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d1-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2a-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2b-375x667-scrolled.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2b-375x667.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2b-393x780.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2b-393x852-after.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2b-393x852-final.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2b-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/d2b-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/diagnostics/a3-393x780-incomplete-before-final-corrections.png` | Historical incomplete capture, excluded from final acceptance. |
| `docs/qa/vision-conversational/runtime/e1-375x667.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/e1-393x780.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/e1-393x852-final.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/e1-393x852.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
| `docs/qa/vision-conversational/runtime/e1-480x1040.png` | Android fixture screenshot; acceptance scope is defined in visual-scorecard.md and regression-matrix.md. |
