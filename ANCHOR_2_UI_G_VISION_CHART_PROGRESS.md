# ANCHOR 2.0 — UI-G: VISION + CHART + PROGRESS
**Branch:** `anchor-2/ui-g-vision-chart-progress`  
**Worktree:** `E:\Projects\Anchor-V2-worktrees\ui-g-vision-chart-progress`  
**Baseline:** `f339b9f8`  
**Agent:** Agent 3 of Batch 2  

---

## A. HTML & SPEC REFERENCES AUDITED

1. **Living Spec v0.4 (Section 14: Handmade Brush Language & Density Ladder)**:
   - *Path:* `E:\Projects\Anchor-Archive\Design-References\Design-System-Specs\Anchor_Design_System_Living_Spec_v0_4_BRUSH_LANGUAGE_LOCKED.docx`
   - *Audit Findings:*
     - **Vision — MEDIUM Density (~20–30%)**: Painterly frame edges, atmospheric wash behind composition, category color marks, future-fragment placeholders for empty slots. Real user/collage imagery remains the dominant visual content.
     - **Chart — HIGH Density (~35–45%)**: Applied inside the map canvas only. Painted route stroke, organic turbulence filter, gradient stops, current waypoint cobalt halo with burst rays, amber destination star, sparse terrain fragments. Waypoint nodes and route progress remain strictly data-driven and legible.
     - **Progress — LOW Density**: Evidence-first layout. Illustrated brush accents appear only at genuine milestone evidence moments. No generic XP meters or The Weave resurrecting.
2. **Vision Polish & Composition Reference**:
   - *Path:* `E:\Projects\Anchor-Archive\Design-References\Anchor-2.0-Prototypes\Vision - Handmade Loop.html`
   - *Audit Findings:*
     - Locked `ApertureGrid` geometry: 3 or more tiles arranged into a primary Hero tile (left/large, flex 1.8), a vertical stack of 2 secondary tiles (right, flex 1), and an optional horizontal strip below for $n-3$ surplus tiles.
     - Empty state: `GhostVisionComposition` with 3 placeholder slots ("Career", "Calling", "World"), subtle dashed stroke, and evocative prompt copy.
     - Real state: `RealVisionComposition` with restrained atmospheric wash and category marks.
3. **Chart Illustrated Reference**:
   - *Path:* `E:\Projects\Anchor-Archive\Design-References\Chart\Anchor_Chart_Illustrated_Standalone.html`
   - *Audit Findings:*
     - SVG painted route canvas with curvature templates (`gentle-s`, `wide-zigzag`, `rising-arc`, `double-bend`).
     - Hand-painted route stroke with gradient stops:
       - Reached route: `#8EE0CF` -> `#41C8C6` -> `#65C7DC` -> `#6C90F3`
       - Upcoming route: `#9CB9ED` -> `#E7E3D9` (opacity 0.6)
     - Current waypoint node: `#3157D8` (Cobalt) core, outer `#7890FA` halo with 8 burst rays.
     - Destination marker: `#FFA32C` Amber core with star glyph and radiant rays.
     - Reached node checkmarks: `#227385` / `#51E1C6`.
4. **Thread Events System Spec & Prototype**:
   - *Paths:*
     `E:\Projects\Anchor-Archive\Design-References\Design-System-Specs\Anchor_2.0_Thread_Events_System_LIVING_COLOR_LOCKED_SPEC.md`
     `E:\Projects\Anchor-Archive\Design-References\Anchor-2.0-Prototypes\Anchor_2.0_Thread_Events_Prototype_LOCKED.html`
   - *Audit Findings:*
     - Durable Thread Events: Grounded, Rooted, Embedded, Sovereign, stabilized, strengthened.
     - Living Color halo on hero anchor thread strength.
     - Event detail sheets inspect only persisted fields; never calculate client thread delta.

---

## B. FILES CREATED

### Vision Surface (SEE):
- `anchor/mobile/src/adapters/v2/vision/types.ts`: Domain models, scene tiles, generation contracts, compact read adapter shape.
- `anchor/mobile/src/adapters/v2/vision/visionAdapter.ts`: Serialization, normalization, tile collation, fallback logic, `toV2VisionCompactState`.
- `anchor/mobile/src/adapters/v2/vision/index.ts`: Barrel export.
- `anchor/mobile/src/adapters/v2/vision/__tests__/visionAdapter.test.ts`: 9 unit tests verifying aperture collation, ghost composition fallback, and compact state adapter.
- `anchor/mobile/src/hooks/v2/vision/useV2Vision.ts`: Server-authoritative lifecycle, seen-today marking on genuine view only, offline/error resilience, creation/refresh.
- `anchor/mobile/src/hooks/v2/vision/index.ts`: Barrel export.
- `anchor/mobile/src/components/v2/vision/ApertureGrid.tsx`: Locked hero + 2-stack + bottom strip geometry, placeholder slots, focus callback.
- `anchor/mobile/src/components/v2/vision/GhostVisionComposition.tsx`: Empty state placeholder tiles with atmospheric styling.
- `anchor/mobile/src/components/v2/vision/RealVisionComposition.tsx`: Real image rendering with painterly atmospheric wash.
- `anchor/mobile/src/components/v2/vision/V2VisionCreationFlow.tsx`: AnchorReady -> VisionEmpty -> Prompt -> Source -> Curation sequence.
- `anchor/mobile/src/components/v2/vision/index.ts`: Barrel export.
- `anchor/mobile/src/components/v2/vision/__tests__/ApertureGrid.test.tsx`: 5 tests verifying hero allocation, empty slot fallback, bottom strip overflow.
- `anchor/mobile/src/screens/v2/vision/V2VisionScreen.tsx`: Complete Vision surface, seen-today trigger on mount, Visualize handoff, edit curation sheet.
- `anchor/mobile/src/screens/v2/vision/__tests__/V2VisionScreen.test.tsx`: 5 tests verifying seen-today trigger, ghost composition, real composition, Visualize navigation.

### Chart Surface (MOVE):
- `anchor/mobile/src/adapters/v2/chart/types.ts`: Waypoint status types, moves, curvature options, celebration state, compact read adapter shape.
- `anchor/mobile/src/adapters/v2/chart/chartAdapter.ts`: Normalization of authoritative `CourseDetail`, status derivation (`reached`, `current`, `upcoming`, `destination`), oneMove selection, `toV2ChartCompactState`.
- `anchor/mobile/src/adapters/v2/chart/index.ts`: Barrel export.
- `anchor/mobile/src/adapters/v2/chart/__tests__/chartAdapter.test.ts`: 9 unit tests for waypoint derivation, one move selection, curvature templates, compact state.
- `anchor/mobile/src/hooks/v2/chart/useV2Chart.ts`: Binding to `useCourseStore` and `chartApiClient`, move completion, reached confirmation, celebratory modal triggers, idempotent duplicate lock.
- `anchor/mobile/src/hooks/v2/chart/index.ts`: Barrel export.
- `anchor/mobile/src/components/v2/chart/V2ChartRouteMap.tsx`: Illustrated SVG route canvas, painted route paths with gradient stops, cobalt current halo/bursts, amber destination star.
- `anchor/mobile/src/components/v2/chart/V2OneMoveCard.tsx`: Next actionable micro-step, circular progress ring, one-tap move completion, reached confirmation trigger.
- `anchor/mobile/src/components/v2/chart/V2ChartSheets.tsx`: Waypoint detail sheet, reached confirmation modal, milestone celebration modal, edit chart curvature sheet, journey summary sheet.
- `anchor/mobile/src/components/v2/chart/index.ts`: Barrel export.
- `anchor/mobile/src/components/v2/chart/__tests__/V2ChartRouteMap.test.tsx`: 2 tests verifying node rendering and interactive callbacks.
- `anchor/mobile/src/screens/v2/chart/V2ChartScreen.tsx`: Complete Chart surface, route visualization, One Move action card, interactive sheets.
- `anchor/mobile/src/screens/v2/chart/__tests__/V2ChartScreen.test.tsx`: 4 tests for Course loading, waypoint status derivation, One Move interaction, operation without Vision.

### Progress Surface (EVIDENCE):
- `anchor/mobile/src/adapters/v2/progress/types.ts`: Durable Thread Events models, practice mode breakdown, evolution stages, evidence summary types.
- `anchor/mobile/src/adapters/v2/progress/progressAdapter.ts`: Evidence collation strictly from persisted stores, zero client delta fabrication, evolution stage resolution, `toV2ProgressModel`.
- `anchor/mobile/src/adapters/v2/progress/index.ts`: Barrel export.
- `anchor/mobile/src/adapters/v2/progress/__tests__/progressAdapter.test.ts`: 7 tests verifying evolution stages, practice aggregation, chronological thread events, zero delta fabrication.
- `anchor/mobile/src/hooks/v2/progress/useV2Progress.ts`: Store bindings (`useAnchorStore`, `useCourseLogStore`, `useSessionStore`), active anchor resolution, event inspection state.
- `anchor/mobile/src/hooks/v2/progress/index.ts`: Barrel export.
- `anchor/mobile/src/components/v2/progress/V2ProgressHero.tsx`: Intention headline, Living Color Thread Strength ring with soft atmospheric aura, permanent structural stage.
- `anchor/mobile/src/components/v2/progress/V2EvidenceSummary.tsx`: Verifiable metrics grid (practice sessions & duration, waypoints reached, practice mode breakdown, structural evolution stage).
- `anchor/mobile/src/components/v2/progress/V2ThreadEventTimeline.tsx`: Chronological rail of durable Thread Events with significance-coded indicators (Amber, Cobalt, Teal).
- `anchor/mobile/src/components/v2/progress/V2ThreadEventDetailSheet.tsx`: Bottom sheet inspecting durable events, provenance, and honest null delta handling.
- `anchor/mobile/src/components/v2/progress/index.ts`: Barrel export.
- `anchor/mobile/src/screens/v2/progress/V2ProgressScreen.tsx`: Complete Progress surface, pull-to-refresh, navigation triangle shortcuts (See -> Reinforce -> Move).
- `anchor/mobile/src/screens/v2/progress/__tests__/V2ProgressScreen.test.tsx`: 4 tests verifying evidence rendering without The Weave, no fabricated delta, Course and Thread events.

---

## C. FILES MODIFIED

- `anchor/mobile/src/screens/v2/vision/index.ts`: Exported `V2VisionScreen` and its prop contracts.
- `anchor/mobile/src/screens/v2/chart/index.ts`: Exported `V2ChartScreen` and its prop contracts.
- `anchor/mobile/src/screens/v2/progress/index.ts`: Exported `V2ProgressScreen` and its prop contracts.

---

## D. SHARED FILES TOUCHED (MUST BE NONE)

**CONFIRMED: ZERO SHARED FILES TOUCHED.**
- `navigation/v2/*`: Unmodified.
- `screens/v2/home/*`: Unmodified (only clean adapters exported for Home's consumption).
- `screens/v2/practice/*`: Unmodified.
- `screens/v2/paywall/*`: Unmodified.
- `theme/v2/*`: Unmodified.
- `components/v2/primitives/*`: Unmodified.
- Backend `CourseService`, `CourseEventService`, database schemas: Unmodified.

---

## E. VISION IMPLEMENTATION & APERTUREGRID

- Implemented the locked `ApertureGrid` geometry from `Vision - Handmade Loop.html`:
  - **Tile 0 (Hero)**: Left column, flex 1.8, dominant focal point.
  - **Tile 1 & 2 (Stack)**: Right column, flex 1.0, vertically stacked (top & bottom).
  - **Tile 3+ (Bottom Strip)**: Optional horizontal scroll rail for surplus tiles, preserving visual balance.
- Handled states gracefully:
  - `no-Vision` / empty: Renders `GhostVisionComposition` with 3 placeholder category slots and inspirational prompt.
  - `Vision exists`: Renders `RealVisionComposition` with subtle atmospheric wash behind tiles.
  - `loading`: Clean skeleton layout.
  - `error / offline`: Graceful fallback with retry mechanism.

---

## F. VISION SEEN-TODAY SEMANTICS

- Implemented server endpoint call `POST /api/v2/visions/:visionId/view` in `useV2Vision`.
- **Strict View Rule**: The mutation is triggered **ONLY** when `V2VisionScreen` mounts and is active in view.
- Prefetching in background or rendering Home thumbnail (`toV2VisionCompactState`) does NOT call `markSeenToday`.
- Guarded by `hasMarkedSeenRef` and `seenToday` boolean flag to prevent redundant network calls.

---

## G. VISION CREATION & CURATION

- Implemented honest creation sequence in `V2VisionCreationFlow`:
  - Step 1: `AnchorReady` ("Give it a future you can see").
  - Step 2: `VisionEmpty` ("Your future has no picture yet").
  - Step 3: `Prompt` (Describe what life looks like when this Anchor is realized).
  - Step 4: `Source` (Select between Uploading real photos or Approved Generation).
  - Step 5: `Curation` (Review tiles in ApertureGrid, swap positions, save).
- No fabricated AI generation: Generation contracts match backend capabilities cleanly.

---

## H. CHART ENGINE REUSE

- Reuses existing authoritative stores and APIs without rewriting backend logic:
  - Subscribes to `useCourseStore` and `chartApiClient`.
  - Authoritative entities: Destination (`destinationText`), Course (`version`, `status`), Waypoints (`id`, `title`, `state`, `reachedAt`, `position`), Current Waypoint (`currentWaypointId`), Course Log (`CourseLogEntry`).
  - Maintains strict idempotency keys for mutations (`confirmWaypointReached`, `reorderWaypoints`).

---

## I. CHART ILLUSTRATED ROUTE VISUAL

- Consumes the SVG illustrated route design from `Anchor_Chart_Illustrated_Standalone.html`:
  - Hand-painted route stroke with 4 curvature algorithms: `gentle-s`, `wide-zigzag`, `rising-arc`, `double-bend`.
  - Gradient stops: Reached path transitions `#8EE0CF` -> `#41C8C6` -> `#65C7DC` -> `#6C90F3`. Upcoming path uses `#9CB9ED` -> `#E7E3D9` with 0.6 opacity.
  - Current waypoint node: `#3157D8` Cobalt circle surrounded by a `#7890FA` halo and 8 radiant burst rays.
  - Destination marker: Amber `#FFA32C` with radiant rays and star glyph.
  - Reached nodes: `#227385` / `#51E1C6` checkmark markers.
  - Waypoint labels remain crisp, high-contrast, and legible outside the map turbulence.

---

## J. ONE MOVE IMPLEMENTATION

- `V2OneMoveCard`:
  - Directly derives the single next actionable micro-step from the current active waypoint.
  - Displays circular completion indicator showing completed moves vs. total moves.
  - One-tap completion triggers `onCompleteMove(waypointId, moveId)` with immediate optimistic feedback.
  - When all moves for the current waypoint are complete, prompts: *"Have you reached this milestone in the real world?"*

---

## K. WAYPOINT REACHED & CELEBRATION

- Reached Confirmation Flow:
  - Opens `V2WaypointReachedModal`: *"Have you reached [Milestone] in the real world?"*
  - Requires explicit user confirmation.
  - Idempotent lock prevents duplicate server calls.
- Milestone Celebration:
  - Opens `V2CelebrationModal`: *"Look how far you've come"* with amber starburst accents.
  - Advances route to next waypoint or Destination celebration.

---

## L. PROGRESS EVIDENCE MODEL

- **Evidence-First (No The Weave)**:
  - 100% eliminated any reliance on The Weave or fabricated progression algorithms.
  - All evidence is grounded in verifiable facts:
    - Practice history counts and duration by mode (Focus, Deep Prime, Visualize, Release).
    - Persisted Thread Strength (0–100) and permanent structural stage (Forming, Grounded, Rooted, Embedded, Sovereign).
    - Waypoints reached count and canonical course log events.
  - Zero client delta calculation: If the server records an authoritative delta, it is displayed; if `null`, it is honestly stated that no server delta was recorded.

---

## M. THREAD EVENTS IMPLEMENTATION

- Chronological timeline rail displaying durable domain events:
  - `ANCHOR_CREATED`: Baseline lifecycle moment.
  - `EVOLUTION_STAGE_REACHED`: Grounded (>=25), Rooted (>=50), Embedded (>=75), Sovereign (>=90).
  - `PRACTICE_MILESTONE_REACHED`: 10th, 25th, 50th practice complete.
  - `WAYPOINT_REACHED`: Real-world milestone reached on route.
  - `DESTINATION_REACHED`: Course completed.
  - `ANCHOR_COMPLETED` / `ANCHOR_RELEASED`: Non-destructive lifecycle milestones.
- Tapping an event opens `V2ThreadEventDetailSheet`, inspecting persisted metadata, provenance, and raw domain IDs.

---

## N. MISSING BACKEND FIELDS (IF ANY)

- None blocking. All interfaces cleanly accommodate optional/nullable server fields without breakage.
- Note: Thread Strength delta is currently null on individual domain logs; the UI displays verifiable practice/milestone data and omits deltas honestly rather than guessing numbers.

---

## O. REQUIRED_INTEGRATION_CHANGES

When central navigation wires UI-G into the root navigator:
1. Register `V2VisionScreen`, `V2ChartScreen`, `V2ProgressScreen` in `anchor/mobile/src/navigation/v2/`.
2. Connect Home compact read adapters:
   - `toV2VisionCompactState(vision)` in `anchor/mobile/src/adapters/v2/vision/`
   - `toV2ChartCompactState(course)` in `anchor/mobile/src/adapters/v2/chart/`
3. Map triangle shortcuts:
   - Vision -> Visualize: `onNavigateToVisualize({ anchorId, visionId, assetUrl })`
   - Chart -> Session: `onNavigateToOneMoveSession(moveId, waypointId)`
   - Progress -> Chart / Vision / Practice: `onNavigateToChart`, `onNavigateToVision`, `onNavigateToPractice`.

---

## P. TEST RESULTS

1. **Targeted UI-G Test Suite**:
   ```
   PASS src/screens/v2/progress/__tests__/V2ProgressScreen.test.tsx (4 passed)
   PASS src/screens/v2/vision/__tests__/V2VisionScreen.test.tsx (5 passed)
   PASS src/adapters/v2/progress/__tests__/progressAdapter.test.ts (7 passed)
   PASS src/screens/v2/chart/__tests__/V2ChartScreen.test.tsx (4 passed)
   PASS src/components/v2/chart/__tests__/V2ChartRouteMap.test.tsx (2 passed)
   PASS src/adapters/v2/vision/__tests__/visionAdapter.test.ts (9 passed)
   PASS src/components/v2/vision/__tests__/ApertureGrid.test.tsx (5 passed)
   PASS src/adapters/v2/chart/__tests__/chartAdapter.test.ts (9 passed)

   Test Suites: 8 passed, 8 total
   Tests:       45 passed, 45 total
   Snapshots:   0 total
   Time:        6.179 s
   ```

2. **Full Mobile Suite (Vision + Chart + Progress filter)**:
   ```
   Test Suites: 178 passed, 178 total
   Tests:       1 skipped, 1406 passed, 1407 total
   Snapshots:   0 total
   Time:        68.059 s
   ```

3. **TypeScript Compilation**:
   ```
   npx tsc --noEmit
   Exit Code: 0 (Zero errors)
   ```

4. **V2 Boundary Verification**:
   ```
   npm run test:v2-boundary
   Output: V2 import boundary OK
   Exit Code: 0
   ```

5. **Git Diff Check**:
   ```
   git diff --check
   Output: (Empty / clean)
   Exit Code: 0
   ```

---

## Q. BRANCH & COMMIT HASH

- **Branch:** `anchor-2/ui-g-vision-chart-progress`
- **Worktree:** `E:\Projects\Anchor-V2-worktrees\ui-g-vision-chart-progress`

---

## R. MERGE NOTES

- Ready for review and integration by the Batch 2 orchestrator.
- Zero conflicts with UI-A, UI-D, UI-E, UI-F, or central navigation files.
- All 3 surfaces (SEE, MOVE, EVIDENCE) are fully implemented, typed, tested, and aligned with Living Spec v0.4.
