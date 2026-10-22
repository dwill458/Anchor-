# Milestone asset system — audit and validation

## Audit before implementation

- The existing client registry and backend `services/v2/milestones/registry.ts` define 15 permanent IDs: five Strength, six Commitment, four Journey. The concept labels five per category; preserve all existing IDs and thresholds (25/50/75/90/100), then add five Vision definitions for 20 total.
- `AnchorMilestone` already has a unique user/anchor/definition key, immutable earned dates/evidence, and a separate celebration receipt. Reuse this service and cache; do not create another award ledger.
- `PracticeCompletionService.flush` consumes `newMilestones` and authoritative Thread movements from `/api/practice/sessions`. `V2FocusCompleteScreen` preserves the actual Anchor, before/after values, existing SVG glow, save recovery and departure handoff. Its shared completion hook owns the existing timing, cues and coordinator reservation.
- `MilestoneCelebrationHost` is mounted at the navigator. The existing queue waits for the coordinator but can race the completion screen mounting. Its interrupted presenter currently removes pending items; correct that without settling ownership.
- Collection and detail use `MilestoneArtwork`. Existing geometry remains for every non-master legacy asset. Replay already uses the same scene without award mutations; its CTA currently says Continue.
- Reanimated 4.7.1 and react-native-svg 15.16.0 are installed. Reuse UI-thread animated props and existing `CreationSounds`, `v2Haptics`, and shared Reduce Motion hook. No new animation dependency is needed.
- Vision and committed VisionScene/Note rows already persist content timestamps and ownership. Generation candidates and description-only generation drafts are separate from completed content. Guided Visualize persists completed PracticeSession records; distinguish guided completion explicitly instead of counting visits or requests. Picture Complete must record the first actual eight-image board, including its timestamp, before later removal can erase the evidence.
- Goal Reached uses `Anchor.intentionCompletedAt`; it must continue to require user-confirmed completion, never strength or visualization.

## Design contract

Four SVG masters: engraved navy geometry, ivory medallion, restrained metallic gold, small polished focal point; monochromatic embossed locked state. Geometry is independent of choreography. Static grid/detail artwork; only the selected presentation animates. Keep existing collection geometry and practice layout. Navy revelation overlays the existing cream completion; do not recreate its Anchor or fabricate progress. Reduced motion uses a short fade, with no traveling light.

## Implementation

- Four named React SVG components are exported by `MasterEmblem.tsx`: FullStrengthEmblem, FirstPracticeEmblem, GoalReachedEmblem, FirstGlimpseEmblem. `masterAssets.ts` owns immutable, individually addressable paths and registry lookups. Static earned/locked SVG exports and a PNG contact sheet are QA artifacts, never flattened app artwork.
- The selected scene uses one shared finite Reanimated controller, progressive path strokes/fills, Strength expansion/settle, Commitment boundary-before-star formation, Journey contours/route/sunrise, and a Vision aperture. It swaps to static paths after the reveal. A short fade handles reduced motion; no light travel or aperture animation runs in that mode.
- Practice retains the actual SVG/image renderer, authoritative values, save recovery, original scene timings and departure flow. A separate 1.15 reach multiplier expands and settles the existing glow without changing strength. Active-session and completion holds prevent premature award presentation; the existing coordinator finishes the Thread scene before navy revelation begins. The first award fades the backdrop over 650ms, reveals over 1250ms, and gathers light from the measured Anchor center. Later queued awards retain navy. Existing first-practice Thread timing is 3900ms and is preserved rather than compressed to the storyboard's approximate timing.
- Replay uses the same reveal, displays `REPLAY · CATEGORY`, and provides `Back to Milestones`. Close preserves dismissal behavior. Replay never settles receipts or changes progress. All completion controls are guarded against double invocation; audio handles, timers and Reanimated values are cleaned up.
- Pending awards survive host interruption and backgrounding without receipt writes. Vision editing, generation, photo arrival, dragging and active sessions hold presentation. Account changes clear the transient queue. A restart restores encrypted presentation receipts before merging server results, preventing an offline completion from replaying.
- All 15 original IDs, category assignments, threshold rules, persisted earned dates, unique award constraints and Goal Reached's user-confirmed lifecycle event are preserved. Five Vision definitions bring the collection to 20. Counts come from persisted records; the grid remains three columns and static.
- First Glimpse uses the first committed image **or authored note** in a Vision. A persisted description-only generation draft does not qualify. This distinguishes a successful content save from a generation request and supports the existing note-first Vision flow. Picture Complete uses eight distinct, non-archived committed assets. Guided thresholds use distinct completed `PracticeSession` rows in visualize mode, `guided_visualize_version: 1`, and a Vision owned by the same user/Anchor. Existing Visualize duration/completion/scene validation stays intact. Older sessions without guided provenance are not guessed into the new thresholds.

## Backend and migration

`20261020180000_vision_milestone_facts` adds nullable `Vision.firstCommittedAt` and `Vision.boardCompletedAt`. Scene creation and evidence capture share a Prisma transaction; a Vision row lock serializes new image commits. Note creation stamps first content in its existing transaction. Post-commit award evaluation uses the existing unique achievement service. The public Vision response model and existing award schema stay compatible.

The migration backfills earliest persisted image/note content. It backfills Picture Complete only for boards currently containing eight distinct live images, at the migration snapshot time. It does **not** invent the historical time an edited board once reached eight. Existing milestone records are untouched. Deploy the migration with the backend before relying on the new Vision fields. It has not been applied to a live database in this task. Reverting code does not require dropping these additive columns.

## Remaining artwork

The other 12 legacy milestones keep their existing artwork: Building, Established, Integrated, Reinforced; Ten Practices, Thirty Practices, One Hundred Practices, 100 Minutes, 500 Minutes; First Waypoint, Halfway, All Waypoints. The four new non-master Vision milestones have purpose-specific lightweight SVG motifs (framed landscape, optical lens, sunrise, doorway). These 16 assets still need the full engraved master treatment for a visually unified 20-piece collection. No generic icon library artwork or generated bitmap replaces an emblem.

## Validation and acceptance limits

- Audit was written before implementation. Master-asset and Vision-rule tests first failed before their corresponding implementation existed.
- Focused mobile regression batch: **22 suites / 327 tests passed**, including collection/detail, snapshots, restart/offline receipt recovery, queue interruption, measured-origin consumption, deterministic multiple awards, reduced motion, original authoritative Focus values/departure behavior, guided Visualize lifecycle, PracticeCompletionService, Vision screens and Chart celebration scenes.
- Additional focused UI batch: **6 suites / 31 tests passed**, including new sound-stop cleanup, saved-Vision teaching/captions, the existing Vision seal hold and Vision-to-Chart routing. These counts overlap the main batch; they are not additive.
- Backend regression batch: **7 suites / 133 tests passed**, covering original milestone rules and history, Vision facts, ownership, duplicates, note/image saves, milestone routes, and practice routes. Additional save-wiring assertions passed in the two Vision service suites.
- Mobile/backend TypeScript and Prisma schema validation passed. Static actual-component SVG rendering passed. Native bundle export results are recorded below after final checks.
- After the final scrollable presentation and sound cleanup changes, the focused reveal/Thread/Focus batch passed **4 suites / 92 tests**. Both platforms exported successfully from the current source: Android `index-d6a7f80a047714e2a2d4e376a58de375.hbc`; iOS `index-38572c282d9379ab122a01f4b6422d7a.hbc`. These are local bundle exports, not installed builds or published updates. Export warnings were existing Sentry org/project fallback and Node NO_COLOR/FORCE_COLOR notices; no bundling error occurred.
- Independent source review caught transactional evidence and offline receipt ordering issues; both were fixed and re-reviewed with no remaining concrete blocker.
- ADB initially listed a device and subsequently reported no connected device. No authenticated native runtime, physical sound/haptics, reduced-motion system setting, transparent-Modal compositing, SVG animated-prop compatibility, real touch behavior, iOS device behavior or S24 Ultra frame-pacing trace was obtained. **60 FPS and visual parity are not claimed.** The contact sheet verifies static geometry only.
- No live migration, Railway deployment, OTA, GitHub push, or production unlock test was performed. Real disposable-database integration acceptance remains open; the existing opt-in database integration suite was not enabled against production.

Animation API references checked: [Reanimated animated props](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedProps/), [animation cancellation](https://docs.swmansion.com/react-native-reanimated/docs/core/cancelAnimation/). These document the implementation mechanism, not native acceptance.

## Workspace delivery

Implemented in the existing `feat/celebration-layer` checkout. Changes remain local and uncommitted for review. No dependencies were added. The file list below includes implementation, tests, migration, documentation, reproducible SVG rendering script, and the earned/locked SVG plus PNG QA exports. Repository root: `E:/Projects/Anchor`.

### All 53 changed or added files

- anchor/mobile/src/components/v2/anchor/CircularAnchorRenderer.tsx
- anchor/mobile/src/components/v2/anchor/ThreadAura.tsx
- anchor/mobile/src/components/v2/milestones/MilestoneArtwork.tsx
- anchor/mobile/src/components/v2/milestones/MilestoneCelebrationHost.tsx
- anchor/mobile/src/components/v2/milestones/MilestoneCelebrationScene.tsx
- anchor/mobile/src/components/v2/milestones/__tests__/MilestoneArtwork.test.tsx
- anchor/mobile/src/components/v2/milestones/__tests__/MilestoneCelebrationScene.test.tsx
- anchor/mobile/src/components/v2/vision/V2SavedVision.tsx
- anchor/mobile/src/hooks/v2/milestones/__tests__/useMilestonePresenter.test.tsx
- anchor/mobile/src/hooks/v2/milestones/useMilestonePresenter.ts
- anchor/mobile/src/hooks/v2/practice/usePracticeCompletionScene.ts
- anchor/mobile/src/milestones/__tests__/milestones.test.ts
- anchor/mobile/src/milestones/artGeometry.ts
- anchor/mobile/src/milestones/registry.ts
- anchor/mobile/src/navigation/v2/AnchorV2Navigator.tsx
- anchor/mobile/src/screens/v2/milestones/V2MilestoneCollectionScreen.tsx
- anchor/mobile/src/screens/v2/milestones/V2MilestoneDetailScreen.tsx
- anchor/mobile/src/screens/v2/practice/V2PracticeSessionScreen.tsx
- anchor/mobile/src/screens/v2/practice/focus/V2FocusAnchorArtwork.tsx
- anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx
- anchor/mobile/src/screens/v2/practice/visualize/V2CinematicSessionScreen.tsx
- anchor/mobile/src/screens/v2/vision/V2VisionScreen.tsx
- anchor/mobile/src/stores/v2/__tests__/milestoneCelebrationStore.test.ts
- anchor/mobile/src/stores/v2/milestoneCelebrationStore.ts
- backend/prisma/schema.prisma
- backend/src/services/v2/VisionService.ts
- backend/src/services/v2/__tests__/VisionCaptionPersistence.test.ts
- backend/src/services/v2/__tests__/VisionNoteService.test.ts
- backend/src/services/v2/__tests__/VisionService.test.ts
- backend/src/services/v2/milestones/MilestoneService.ts
- backend/src/services/v2/milestones/__tests__/MilestoneService.test.ts
- backend/src/services/v2/milestones/__tests__/registry.test.ts
- backend/src/services/v2/milestones/registry.ts
- anchor/mobile/docs/qa/milestone-asset-system-20261020.md
- anchor/mobile/docs/qa/milestone-assets-20261020/commitment.practices.1-earned.svg
- anchor/mobile/docs/qa/milestone-assets-20261020/commitment.practices.1-locked.svg
- anchor/mobile/docs/qa/milestone-assets-20261020/journey.goal-earned.svg
- anchor/mobile/docs/qa/milestone-assets-20261020/journey.goal-locked.svg
- anchor/mobile/docs/qa/milestone-assets-20261020/master-emblems.png
- anchor/mobile/docs/qa/milestone-assets-20261020/strength.full-earned.svg
- anchor/mobile/docs/qa/milestone-assets-20261020/strength.full-locked.svg
- anchor/mobile/docs/qa/milestone-assets-20261020/vision.first-earned.svg
- anchor/mobile/docs/qa/milestone-assets-20261020/vision.first-locked.svg
- anchor/mobile/scripts/render-milestone-masters.cjs
- anchor/mobile/src/components/v2/milestones/MasterEmblem.tsx
- anchor/mobile/src/components/v2/milestones/MilestoneLightStream.tsx
- anchor/mobile/src/components/v2/milestones/useMilestoneReveal.ts
- anchor/mobile/src/hooks/v2/milestones/useMilestonePresentationHold.ts
- anchor/mobile/src/milestones/__tests__/masterAssets.test.ts
- anchor/mobile/src/milestones/__tests__/queueVisionMilestones.test.ts
- anchor/mobile/src/milestones/masterAssets.ts
- anchor/mobile/src/milestones/queueVisionMilestones.ts
- backend/prisma/migrations/20261020180000_vision_milestone_facts/migration.sql
