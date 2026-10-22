# Progress Redesign — Phase 1 Audit (2026-10-19)

Scope read so far: Progress adapter/hook/screen/hero, celebration store + records store, Prisma ledger models, navigator wiring, session store, vision/chart hook inventory. Items marked **TODO** were not yet inspected.

## 1. What exists (reuse)

| Area | Location | Notes |
|---|---|---|
| Progress screen | `screens/v2/progress/V2ProgressScreen.tsx` | Ink hero + cream body (`progressTokens`). Sections: This week, Rhythm, How you practice (`V2EvidenceSummary`), Route, Course log timeline, Weekly Insight. Uses `ProgressiveFocusTransition` (Anchor flies from Details into the hero ring) — must be preserved. |
| Data model | `adapters/v2/progress/progressAdapter.ts`, `types.ts` | Pure functions. Already computes heatmap (Week/Month/Year), rhythm stats, streak w/ grace, route summary (`buildRouteSummary` from real `CourseDetail`), reflections, thread events (derived). |
| Hook | `hooks/v2/progress/useV2Progress.ts` | Selected Anchor is local (`pickedAnchorId`), seeded by route param; never changes app's current Anchor. Inputs: `sessionStore.practiceHistory` (fallback `sessionLog`), `useAnchorChart`, `useAnchorCourseLog`, `celebrationRecordsStore`. |
| Hero | `components/v2/progress/V2ProgressHero.tsx` | Real `CircularAnchorRenderer` (104dp, inside `V2ProgressRing`) with `useAuraStrength` glow (`variant:'details'`). **Contains an extra strength ring + stage pips — both are forbidden by the brief.** |
| Glow | `components/v2/anchor/ThreadAura*.tsx`, `threadAuraModel.ts` | Shared Home/Details aura; entrance bloom constants exist (`HOME_AURA_*`). |
| Celebration sequencing | `stores/v2/celebrationStore.ts` | Level 1–4 priority queue, preempt/skip, session-only. This is the queue for “no stacked overlays”. |
| Celebration history | `stores/v2/celebrationRecordsStore.ts` | **Device-local** (AsyncStorage) first-reached dates for stages + Full Strength. Not authoritative, not cross-device. |
| Server event ledger | `ThreadEventLedger` (+ claims/receipts), `routes/v2/threadEvents.ts` | Server-owned, `idempotencyKey @unique`, presentation claim/receipt per channel. Mobile consumes via `useV2ThreadEventQueue` / `V2ThreadEventCelebration`. |
| Server strength | `ThreadV2State`, `ThreadV2Movement` (before/after/delta), `ThreadStrengthService` | Authoritative strength + per-session history. |
| Chart | `useAnchorChart`, `chartV2Model`, `ChartActiveView`, `ChartMapCrop`, `ChartWorldPreview` | Real route geometry/artwork; `COURSE_COMPLETED`, `WAYPOINT_REACHED` course events exist. |
| Vision | `useV2Vision` (cached `peekV2Vision`/`prefetchV2Vision`), `VisionEditorialPreview` (aliased `VisionBoardPreview`) | Real board composition exists as a preview component. |
| Audio / haptics | `services/CreationSounds.ts`, `hooks/v2/haptics.ts`, `useV2ReduceMotion` | Celebration store doc says use `safeHaptics` + SoundPool/CreationSounds. |

## 2. Conflicts between the brief/mockup and the repo

1. **Strength levels differ.** Repo: Forming <25, Building 25, Established 50, Integrated 75, Reinforced 90, plus a separate **Full Strength** event (`resolveEvolutionStage`). Mockup shows Grounded 20 / Rooted 40 / Established 50 / Embedded 75 / Sovereign 100. Per the brief, milestones will use **repo thresholds and names**; mockup labels are not shipped.
2. **Strength milestone dates are device-local today** (`celebrationRecordsStore`). Brief requires server-authoritative award → needs a new server record.
3. **Practice-count milestones in the adapter are derived and wrongly dated**: `deriveThreadEvents` uses `new Date()` when the Nth session has no date, and thresholds are 10/25/50 (brief wants 1/10/30/100 + 100/500 min). These derived events must not become the source of truth for awards.
4. **Hero** has a 150dp ring + 5 stage pips; brief forbids additional strength rings/bars → remove both, enlarge Anchor to 230–260dp.
5. **Goal reached**: only `Anchor.intentionCompletedAt` / `IntentionCompletionService` represents it; `COURSE_COMPLETED` means all waypoints done, not goal. Journey milestone “Goal reached” will key off `intentionCompletedAt` only.
6. **Practice minutes are per-session records on device** (`practiceHistory`), server has `PracticeSession`; cumulative-minute awards must be evaluated server-side from `PracticeSession`, not the client cache.

## 3. Proposed architecture (for approval)

**Persistence (server, authoritative):** new Prisma model `AnchorMilestone`
`id, userId, anchorId, definitionId, definitionVersion, earnedAt, sourceKind, sourceEntityId, metadata Json, createdAt`, `@@unique([userId, anchorId, definitionId])`, plus a presentation receipt reusing the existing `ThreadEventLedger` claim/receipt mechanism (a `MILESTONE_EARNED` ledger event with `idempotencyKey = milestone:{anchorId}:{definitionId}`), so celebration state never decides ownership.

**Evaluation:** `MilestoneService.evaluate(userId, anchorId, trigger)` called after the existing practice-complete, waypoint, and intention-complete transactions; inserts with `ON CONFLICT DO NOTHING`; returns only newly-created rows. Idempotent by the unique constraint. Strength milestones evaluate against `ThreadV2Movement.afterStrength` (high-water, so decay never revokes).

**Client:** shared definition registry `milestones/registry.ts` (versioned), `useMilestones(anchorId)` (server fetch + offline cache + reconcile on reconnect), milestone presentations enqueued through `celebrationStore` at level 3; replay path calls the same scene component with `awarding:false` and no store/API writes.

**UI:** `V2ProgressHero` rebuild; `V2JourneySection` with a pure `resolveJourneyState({chart, vision, loading})` → `loading | A | B | C | D`; `V2CommitmentSection` (merge week + rhythm); `V2MilestoneShelf`; `V2MilestoneCollectionScreen`; `V2MilestoneDetailScreen`; Course Log regrouped by significance with routine practice behind a toggle.

## 4. Phase plan and what is untouched

Phases 2–7 as in the brief. Not modified: Thread Strength calculation/decay/grace, premium gating, Chart logic, Vision behavior, Practice Completion rewards, bottom navigation, Home carousel, Details.

## 5. Open items (TODO before implementation)

- Read `V2ProgressRoute`, `V2ProgressRhythm`, `V2ThreadEventTimeline`, `V2FocusCompleteScreen`, `usePracticeCompletionScene`, `V2ThreadEventCelebration` in full.
- Confirm how `useV2Vision` exposes “has board / images missing” and how the Vision board `VisionEditorialPreview` is sized.
- Check offline queue pattern (`SyncQueue`) to reuse for milestone reconciliation.
- Check the current uncommitted work on `V2HomeScreen`/`ThreadAura`/Chart files so Phase 2 does not collide with it (working tree is dirty).
- **Asset spec**: no production milestone artwork exists. Phase 4 will ship SVG/animation-layer components with a labelled development fallback and a written asset spec in `docs/progress-redesign/ASSET_SPEC.md`.
