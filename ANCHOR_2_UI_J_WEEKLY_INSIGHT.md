# Anchor 2.0 — UI-J Weekly Insight Surface

## A. Spec & HTML References Audited

The implementation is derived directly from the authoritative specifications and interactive prototypes:
- **Living Spec Section 23**: `E:\Projects\Anchor-Archive\Design-References\Design-System-Specs\Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx`
  - Locked 18-rule deterministic narrative taxonomy (First Match Wins).
  - Review window: Sunday 19:00 to Tuesday 12:00 local time.
  - Frozen snapshot architecture preserving historical state without engine re-evaluation drift.
  - Prohibition of gamification, streak counts, badges, and client-side LLM hallucination.
- **Interactive Prototypes**:
  - `E:\Projects\Anchor-Archive\Design-References\Anchor-2.0-Prototypes\Anchor_2.0_Weekly_Insight_Prototype.html`
  - `E:\Projects\Anchor-Archive\Design-References\Anchor-2.0-Prototypes\Anchor_2.0_Weekly_Insight_Prototype (1).html`
  - Verified 13 canonical scenarios: Consistency, Depth, Recovery, Dominant Anchor, Chart Alignment, Waypoint Reached, Evolution Milestone, Completion/Release, Return, Quiet, New User, Missing Chart, and Missing Vision.
  - Sourced editorial layouts, 6 contextual visual shells, 3-column evidence row, interpretation, next direction, feedback chips, and collapsible activity disclosure.
- **Design System Spec (Section 11 & 14)**:
  - `Anchor_Design_System_Living_Spec_v0_4_BRUSH_LANGUAGE_LOCKED.docx`
  - Surface density: Low brush density, warm mineral canvas (`#F4F1E9`), crisp hairline borders (`#E6E2D8`), subtle editorial accent mappings (Career `#3157D8`, Health `#2FA879`, Ambition `#E85D32`, Focus `#8B5CF6`, Prime `#E0A038`, Visualize `#3B82C4`, Release `#DD5F2C`, Neutral `#62666D`).

---

## B. Files Created

A total of 24 isolated files were created in `anchor/mobile`:

### 1. Routes & Taxonomy Constants
- `anchor/mobile/src/constants/v2/weeklyInsightRoutes.ts`: Route name constant (`V2_WEEKLY_INSIGHT_ROUTE = 'V2WeeklyInsight'`), route parameter types, integration callback contracts, and review window timing constants.
- `anchor/mobile/src/constants/v2/weeklyInsightTaxonomy.ts`: 18 canonical rule types, visual types, `V1_INSIGHT_THRESHOLDS` (tuning constants frozen per snapshot version), and editorial color tokens.

### 2. Adapters & Deterministic Selection Engine
- `anchor/mobile/src/adapters/v2/weeklyInsight/types.ts`: TypeScript contracts for `WeeklyInsightFacts`, `WeeklyInsightSnapshot`, `WeeklyDetailedActivity`, `WeeklyInsightHistoryItem`, and visual data payloads.
- `anchor/mobile/src/adapters/v2/weeklyInsight/weeklyReviewWindow.ts`: Authoritative review window calculation (Sunday 19:00 – Tuesday 12:00 local time), completed-week date range derivation, and human-readable formatting.
- `anchor/mobile/src/adapters/v2/weeklyInsight/weeklyInsightSelector.ts`: Pure, deterministic 18-rule selection engine. Evaluates facts in strict precedence order to produce snapshot headline, support copy, visual data, 3-point evidence, comparison note, interpretation, and next direction.
- `anchor/mobile/src/adapters/v2/weeklyInsight/weeklyInsightFactsBuilder.ts`: DTO builder aggregating data from `PracticeSessionRecord` / `SessionLogEntry`, `CourseLogEntry`, and `Anchor` stores, plus 13 prototype scenario fixtures (`PROTOTYPE_WEEKLY_INSIGHT_FIXTURES`) and archive fixtures (`PROTOTYPE_ARCHIVE_ITEMS`).
- `anchor/mobile/src/adapters/v2/weeklyInsight/index.ts`: Barrel export for all weekly insight adapters and types.
- `anchor/mobile/src/adapters/v2/weeklyInsight/__tests__/weeklyReviewWindow.test.ts`: Unit tests validating active window detection across Sunday evening, Monday, Tuesday morning, and midweek closed states.
- `anchor/mobile/src/adapters/v2/weeklyInsight/__tests__/weeklyInsightFactsBuilder.test.ts`: Tests verifying session metrics, active days, mode distribution, thread points, and course log aggregation.
- `anchor/mobile/src/adapters/v2/weeklyInsight/__tests__/weeklyInsightSelector.test.ts`: Comprehensive tests verifying all 18 taxonomy rules and exact matches for all 13 prototype scenarios.

### 3. Visual Components & Presentation Shells
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyInsightVisual.tsx`: Contextual visual shell rendering 6 visual types (`anchor`, `evolution`, `release`, `thread`, `chart`, `activity`) using SVG graphics and editorial typography.
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyEvidenceRow.tsx`: 3-column tabular metric cards (value, uppercase metric label, qualitative context) and comparison callout.
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyInterpretation.tsx`: "What this means" editorial breakdown grounding the narrative in observed behavior.
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyNextDirection.tsx`: "Next week" forward-looking prompt with accented vertical bar.
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyFeedbackWidget.tsx`: 3-chip reflection rating ("Did this match how the week felt?" — Yes / Mostly / Not really).
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyActivityDisclosure.tsx`: Collapsible accordion ("See weekly activity") revealing Practices/Days/Minutes metrics, mini 7-day thread polyline, mode distribution bars, connected Chart/Vision entities, and canonical event timeline.
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyHistoryDrawer.tsx`: Bottom sheet modal presenting preserved historical snapshots with freeze guarantees.
- `anchor/mobile/src/components/v2/weeklyInsight/WeeklyInsightEmptyState.tsx`: Calm first-week empty state with reassurance copy when insufficient practice exists.
- `anchor/mobile/src/components/v2/weeklyInsight/index.ts`: Barrel export for UI components.

### 4. Custom Hook & Screen
- `anchor/mobile/src/hooks/v2/weeklyInsight/useWeeklyInsight.ts`: Custom hook managing snapshot selection, review window calculation, facts building, historical snapshot switching, feedback submission, and pull-to-refresh.
- `anchor/mobile/src/hooks/v2/weeklyInsight/index.ts`: Barrel export for hooks.
- `anchor/mobile/src/screens/v2/weeklyInsight/V2WeeklyInsightScreen.tsx`: Top-level Weekly Insight surface integrating editorial header, date range, primary story, contextual visual, evidence table, interpretation, next direction, feedback widget, collapsible activity breakdown, historical drawer, and transient feedback toast.
- `anchor/mobile/src/screens/v2/weeklyInsight/index.ts`: Barrel export for screen.
- `anchor/mobile/src/screens/v2/weeklyInsight/__tests__/V2WeeklyInsightScreen.test.tsx`: Integration tests covering render states, depth narrative, activity aggregation, drawer interactions, feedback submission, and graceful degradation for missing Chart / Vision domains.

---

## C. Files Modified

**None**. No existing codebase files were modified.

---

## D. Shared Files Touched (Must Be None)

**Zero shared files touched**.
- `src/navigation/*`: NOT modified.
- `src/screens/v2/home/*`: NOT modified.
- `src/screens/v2/chart/*`: NOT modified.
- `src/screens/v2/vision/*`: NOT modified.
- `src/screens/v2/practice/*`: NOT modified.
- `src/theme/v2/*`: NOT modified.
- `backend/*`: NOT modified.

---

## E. Deterministic Narrative Selection

The Weekly Insight narrative is determined 100% deterministically through an 18-rule priority hierarchy ("First Match Wins"), evaluating visible and persisted evidence without generative hallucination:

1. **DESTINATION_REACHED**: Course destination completed this week.
2. **COMPLETION_RELEASE**: Anchor completed and released/archived this week.
3. **EVOLUTION_MILESTONE**: Anchor unlocked an evolution stage (e.g. Grounded → Rooted).
4. **WAYPOINT_REACHED**: Chart waypoint reached this week with execution progress.
5. **PRACTICE_MILESTONE**: Canonical practice milestone reached (e.g. 25, 50, 100 practices).
6. **RECOVERY**: Thread dipped early and recovered by $\ge 10$ points over $\ge 2$ subsequent practices.
7. **QUIET**: Exactly 0 completed practices; descriptive recap without scolding or trend claims.
8. **RETURN**: First completed practice after $\ge 14$ days of inactivity.
9. **NEW_USER**: First week ever or $< 2$ weeks of history; descriptive onboarding pattern without comparison.
10. **LOW_ACTIVITY**: Exactly 1 completed practice; factual statement without habit claims.
11. **CHART_ALIGNMENT**: $\ge 65\%$ of completed practices linked to the active Chart waypoint.
12. **CHART_EXECUTION**: $\ge 2$ One Moves completed alongside supporting waypoint practices.
13. **DEPTH**: $\ge 2$ Deep Prime sessions representing $\ge 50\%$ of practices (or $\ge 20\%$ gain vs prior week).
14. **PRIMARY_ANCHOR** (Dominant Anchor): Multiple anchors present, with one receiving $\ge 65\%$ share and $\ge 25$ percentage points lead over the second anchor.
15. **CONSISTENCY**: Active across $\ge 4$ days with net thread delta $\ge -2$.
16. **VISUALIZATION**: $\ge 2$ Visualize sessions paired with $\ge 2$ durable Vision revisits.
17. **SPLIT_ATTENTION**: $\ge 4$ practices evenly distributed across $\ge 3$ active Anchors (no anchor $> 50\%$).
18. **GENERAL**: Deterministic fallback stating factual practice count and thread movement.

**Anti-Gamification Guarantees**:
- No streak counters or day streak loss threats.
- No XP, levels, badges, rings, or leaderboards.
- No artificial urgency or guilt framing for quieter weeks.
- Tone remains calm, observational, and anchored in verifiable telemetry.

---

## F. Review Window & Snapshot Contract

- **Active Review Window**: Opens Sunday at 19:00 local time and closes Tuesday at 12:00 local time.
- **Off-Window Display**: The snapshot computed for the prior completed week remains viewable throughout the week until the next review window opens.
- **First-Week Handling**: When history is empty and no practice occurred, the surface renders `WeeklyInsightEmptyState` with reassurance copy: *"Your first Weekly Insight will arrive after your first completed week of practice."*
- **Snapshot Immutability**: Each generated snapshot is stamped with a versioned threshold ID (`V1`), preventing historical snapshots in the archive from changing if product thresholds evolve.

---

## G. Detailed Activity Breakdown

The collapsible `WeeklyActivityDisclosure` provides verified telemetry without cluttering the primary narrative:
- **Top Row Metrics**: Total completed practices, active days count, and accumulated practice duration in minutes.
- **Thread Strength Trajectory**: Mini SVG sparkline polyline visualizing the 7-day movement ($Monday \to Sunday$) with starting and ending scores.
- **Mode Distribution**: Mode mix breakdown (Focus, Deep Prime, Visualize, Release) with proportional width bars and session counts.
- **Connected Activity**: Explicit links to active Anchor (with evolution stage), active Chart waypoint (if enrolled), and Vision document (if configured). Omitted cleanly when optional domains are absent.
- **Canonical Event Timeline**: Chronological log of verifiable milestone events that occurred during the week.

---

## H. Snapshot History & Feedback

- **History Archive Drawer**: `WeeklyHistoryDrawer` displays past weekly snapshots (week range, primary headline, practice count, and date). Selecting an entry displays the historical snapshot in place without leaking current week data.
- **User Reflection Control**: `WeeklyFeedbackWidget` prompts *"Did this match how the week felt?"* with three response options: `Yes`, `Mostly`, and `Not really`.
- **Interaction Feedback**: Selecting an option invokes `onFeedbackSubmit(snapshotId, rating)`, highlights the chip, and displays a 1.4-second transient toast (`"Reflection saved"`).

---

## I. Required Integration Changes

To wire the Weekly Insight surface into the central app navigation:

1. **Register Route**:
   In `anchor/mobile/src/navigation/` (e.g. `AppNavigator.tsx` or `HomeStackNavigator.tsx`):
   ```typescript
   import { V2_WEEKLY_INSIGHT_ROUTE } from '../constants/v2/weeklyInsightRoutes';
   import { V2WeeklyInsightScreen } from '../screens/v2/weeklyInsight';

   // In Stack.Navigator:
   <Stack.Screen
     name={V2_WEEKLY_INSIGHT_ROUTE}
     component={V2WeeklyInsightScreen}
     options={{ headerShown: false }}
   />
   ```

2. **Home Screen / Review Banner Integration**:
   In `anchor/mobile/src/screens/v2/home/`:
   ```typescript
   import { isWithinWeeklyInsightReviewWindow } from '../adapters/v2/weeklyInsight';
   import { V2_WEEKLY_INSIGHT_ROUTE } from '../constants/v2/weeklyInsightRoutes';

   // Check if the review banner should appear on Home:
   const showWeeklyReviewBanner = isWithinWeeklyInsightReviewWindow();

   // Navigation on banner tap:
   navigation.navigate(V2_WEEKLY_INSIGHT_ROUTE, { anchorId: currentAnchor.id });
   ```

3. **Analytics / Feedback Logging**:
   Wire `onFeedbackSubmit` callback in route parameters or container to log feedback:
   ```typescript
   onFeedbackSubmit: (snapshotId, rating) => {
     AnalyticsService.logEvent('weekly_insight_feedback', { snapshotId, rating });
   }
   ```

---

## J. Test Results

All verification suites executed and passed in `anchor/mobile`:

1. **Weekly Insight Test Suite**:
   ```bash
   npm test -- --testPathPattern=weeklyInsight
   ```
   - `src/adapters/v2/weeklyInsight/__tests__/weeklyInsightSelector.test.ts` (17 passed)
   - `src/adapters/v2/weeklyInsight/__tests__/weeklyReviewWindow.test.ts` (7 passed)
   - `src/adapters/v2/weeklyInsight/__tests__/weeklyInsightFactsBuilder.test.ts` (2 passed)
   - `src/screens/v2/weeklyInsight/__tests__/V2WeeklyInsightScreen.test.tsx` (7 passed)
   - `src/utils/__tests__/weeklyInsight.test.ts` (11 passed)
   - **Total**: 5 test suites, 44 tests passed (0 failed).

2. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   - **Result**: Exit code 0, zero errors.

3. **V2 Import Boundary Check**:
   ```bash
   npm run test:v2-boundary
   ```
   - **Result**: "V2 import boundary OK", zero boundary violations.

4. **Full Repository Test Suite**:
   ```bash
   npm test
   ```
   - **Result**: 190 test suites passed, 1,493 tests passed (1 skipped), 0 failed.

5. **Git Diff Check**:
   ```bash
   git diff --check
   ```
   - **Result**: Clean, zero whitespace or formatting issues.

---

## K. Branch & Commit Hash

- **Branch**: `anchor-2/ui-j-weekly-insight`
- **Worktree**: `E:\Projects\Anchor-V2-worktrees\ui-j-weekly-insight`
- **Baseline**: `807a2ab5`
- **Commit Message**: `feat(v2): implement UI-J weekly insight surface`

---

## L. Merge Notes

- **Self-Contained Isolation**: All changes are strictly encapsulated in `src/adapters/v2/weeklyInsight/`, `src/components/v2/weeklyInsight/`, `src/constants/v2/weeklyInsight*`, `src/hooks/v2/weeklyInsight/`, and `src/screens/v2/weeklyInsight/`.
- **Zero Central Conflict**: No files in `src/navigation/*`, `src/screens/v2/home/*`, or shared theme files were edited. Integration requires only adding the route registration and review window banner check documented in Section I.
- **Ready for Review**: Fully tested, type-safe, and ready for integration testing.
