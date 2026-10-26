# ANCHOR WEEKLY INSIGHT 2.0 — AUDIT & IMPLEMENTATION BLUEPRINT

**Status:** Investigation only. No production code, schema, navigation or behavior was changed. This document is the only file added.
**Audited:** `E:\Projects\Anchor` — `anchor/mobile/src`, `backend/src`, `backend/prisma`. Audit date: 2026-10-24.
**Legend:** **REUSE** exists and can be leveraged · **MODIFY** exists, needs adjustment · **BUILD** new work · **DECISION** needs product or architecture approval.
**Evidence tags:** **[V]** verified by reading the cited code · **[A]** assumption or inference, stated as such · **[T]** needs a runtime test to confirm.

---

## 1. Executive Summary

### Current condition

Weekly Insight today is a **per-Anchor-flavored, client-generated, deterministic recap that cannot tell the story the mockup wants to tell**. It was built to a locked spec (18-rule narrative taxonomy, frozen snapshots) and its UI shell is solid. But the data layer underneath it is thin and, in several places, wrong. The confirmed problems are:

1. **The recap is computed on the phone from local stores, then uploaded.** The server only stores whatever JSON the client sends and never validates it (`backend/src/api/routes/v2/weeklyInsightRoutes.ts:26-54`). The facts come from `sessionStore.practiceHistory`, `anchorStore.anchors` and a `courseLogStore` that is bound to **one** Chart and caches 50 entries (`stores/courseLogStore.ts:25-30`). A global, multi-Anchor, multi-Chart story cannot be assembled from that. **[V]**
2. **Thread Strength history is fabricated as a flat line.** `threadPoints` is the *current* score repeated seven times (`adapters/v2/weeklyInsight/weeklyInsightFactsBuilder.ts:196-204`). Every thread-based rule (RECOVERY, CONSISTENCY's thread clause, the sparkline) is therefore untruthful or unreachable. **[V]**
3. **Several inputs are dead.** The hook never passes `visionRevisitsCount`, `nextWaypointTitle`, `daysSincePriorPractice` or `priorWeekComparison` (`hooks/v2/weeklyInsight/useWeeklyInsight.ts:92-103`), so the VISUALIZATION rule, RETURN rule and every "vs last week" comparison cannot fire. The builder looks for `ONE_MOVE_COMPLETED` in the course log, but the client's `CourseEventType` has no such member (the real one is `MOVE_COMPLETED`), so One Move counts are always 0 (`factsBuilder:238`, `types/chart.ts:92-110`). `evolutionStage`, `unlockedStageThisWeek` and `lifetimePracticesCount` are read through `as any` and are not on the `Anchor` type (`factsBuilder:170-175`). **[V]**
4. **Four correctness bugs in the persistence and week logic** (detailed in §2.4): global snapshots very likely never persist, snapshots lookup by a non-unique date *label*, the snapshot can freeze at Sunday 19:00 before the week ends, and a deleted/archived Anchor is reported as "released".
5. **The user's feedback is write-only.** It is stored and never read by anything (`weeklyInsightRoutes.ts:55-74`; no other reference in `backend/src`). **[V]**

### What is genuinely good and reusable

The server already records most of the events the mockup needs, **with trustworthy timestamps**: `PracticeSession` (with `localDateKey` + `timeZone`), `Waypoint.reachedAt`, `CourseEvent`, `Anchor.intentionCompletedAt` (preserved through release), `Anchor.releasedAt`, `AnchorMilestone.earnedAt` (a permanent, versioned, idempotent per-Anchor achievement record), `VisionView`, `ThreadV2Movement`, and a `ThreadEventLedger`. The visual toolkit exists too: cream/ink tokens, a Reanimated motion language, real Chart map rendering (`ChartMapCrop`), real Anchor artwork, and Vision image helpers.

### Recommended direction

**Build a server-side global weekly recap read-model, freeze it as a versioned snapshot, and have the phone render it.** In one line: *the server decides what happened; the phone decides how it looks.*

- **BUILD** one backend aggregation service and endpoint (`GET /api/v2/weekly-recap`) that reads canonical tables, never the phone, applies a deterministic hero-selection ladder, and returns one view-model.
- **MODIFY** `weekly_insight_snapshots` (additive migration) so a snapshot has a real *global* scope, a timezone-safe week key, a schema version and a draft→final lifecycle.
- **BUILD** the new screen as composed sections over that view-model; **REUSE** the existing motion, theme, Anchor and Chart rendering.
- **Keep** per-Anchor Progress untouched. Weekly Insight becomes global; Progress keeps its own card and deep-links into the recap.
- **Retire** the client-side facts builder and 18-rule selector from the live path after migration. Old snapshots stay readable through a legacy renderer.

### Where I challenge the mockup (details in §4)

The mockup is a strong editorial direction, but as drawn it has **internal data contradictions, duplicated sections and unfounded visuals**: it shows "2 waypoints reached" against a hero and highlights that show one; its Week in Motion puts the waypoint on Thursday and the completion on Saturday while the dates in its own highlights (Oct 16, Oct 18) are Friday and Sunday; "Your Anchors This Week" repeats Highlights almost one-for-one; the five-node progress trails on Anchor rows imply data that does not exist; it has two near-identical generic text blocks ("This week's reflection" and "What this means"); and it uses three dark panels plus gold on at least six elements, which works against "restrained gold." I recommend a tighter structure (§5).

### Biggest risks to approval

| Risk | Why it matters | Mitigation |
|---|---|---|
| Global snapshot uniqueness (`anchorId = null`) | Probable silent persistence failure today | Fix in the migration (§8.2) with a non-null scope key |
| Late-syncing offline practice | A frozen week can under-count | Draft→final lifecycle closing at the review-window end (§8.4, **DECISION**) |
| Timezone: no user timezone is stored server-side | Week boundaries depend on the device | Store the IANA zone *with the snapshot* at first generation; use `localDateKey` for practice (§10) |
| Serif headline in mockup | The app ships Inter only; `typography.ts` notes the serif is "not loaded" | **DECISION** on bundling a serif (§4, §14) |

---

## 2. Current Implementation Map

All paths are relative to `E:\Projects\Anchor\`. Mobile = `anchor/mobile/src`.

### 2.1 Where Weekly Insight is accessed **[V]**

| Entry point | Code | Passes `anchorId`? |
|---|---|---|
| Home (daily shell intent) | `screens/v2/home/dailyShell.tsx:109` → `navigation.navigate('V2WeeklyInsight')`; also `V2DevelopmentHome.tsx:66` | **No** |
| Per-Anchor Progress card | `screens/v2/progress/V2ProgressScreen.tsx:315-317`; navigator wires it at `navigation/v2/AnchorV2Navigator.tsx:512` → `navigate('V2WeeklyInsight', { anchorId: id })` | **Yes** |
| Route registration | `AnchorV2Navigator.tsx:629`; wrapper at `:404-407`; params type `navigation/v2/types.ts:71`; constant `constants/v2/weeklyInsightRoutes.ts:10` | — |
| Notification | `services/notifications/notificationRules.ts:276-317` (`evaluateWeeklyRecap`, `weeklyRecapEnabled` defaults to **false** at `services/NotificationState.ts:101`). I found **no** code path that routes a weekly-recap notification tap to the `V2WeeklyInsight` screen. **[A]** based on grep of `weekly_recap` + route/navigate terms. | — |

Two entry points feed the **same screen with different scope**, and nothing explains the difference to the user.

The "review window" helper `isWithinWeeklyInsightReviewWindow` (`adapters/v2/weeklyInsight/weeklyReviewWindow.ts:25-45`) is used **only** inside the hook, which returns the flag; the screen never reads it, and Home has no banner gated on it. The window therefore currently gates nothing. **[V]**

### 2.2 Data flow today **[V]**

```
sessionStore.practiceHistory ─┐
anchorStore.anchors ──────────┼─► buildWeeklyInsightFacts()   (adapters/…/weeklyInsightFactsBuilder.ts:78-324)
courseLogStore.entries ───────┤        │  pure DTO
courseStore.activeCourse ─────┘        ▼
                              selectWeeklyInsight()  (…/weeklyInsightSelector.ts, 866 lines, 18 rules, first match wins)
                                       │  WeeklyInsightSnapshot (headline, evidence[3], visualData…)
                                       ▼
        POST /api/v2/weekly-insights  (client-authored JSON; server upserts, `update: {}`)
                                       ▼
                       weekly_insight_snapshots.snapshot (JSONB)
```

Files that make up the feature (all **REUSE or MODIFY** candidates unless noted):

| Layer | Files |
|---|---|
| Screen | `screens/v2/weeklyInsight/V2WeeklyInsightScreen.tsx` (456 lines) |
| Hook | `hooks/v2/weeklyInsight/useWeeklyInsight.ts` (209) |
| Adapters | `adapters/v2/weeklyInsight/{types,weeklyInsightApiAdapter,weeklyInsightFactsBuilder,weeklyInsightSelector,weeklyReviewWindow}.ts` |
| Components | `components/v2/weeklyInsight/{WeeklyInsightVisual,WeeklyEvidenceRow,WeeklyInterpretation,WeeklyNextDirection,WeeklyFeedbackWidget,WeeklyActivityDisclosure,WeeklyHistoryDrawer,WeeklyInsightEmptyState}.tsx` |
| Constants | `constants/v2/weeklyInsightRoutes.ts`, `weeklyInsightTaxonomy.ts` (thresholds frozen as `V1_INSIGHT_THRESHOLDS`) |
| Backend | `backend/src/api/routes/v2/weeklyInsightRoutes.ts` (75 lines), model `WeeklyInsightSnapshot` (`backend/prisma/schema.prisma:270-288`), migration `20260909000000_add_v2_release_thread_events_weekly_insights` |
| Legacy (V1, unrelated) | `utils/weeklyInsight.ts`, `components/WeeklySummaryModal.tsx` (still mounted in `screens/vault/VaultScreen.tsx:663`) |
| Separate Progress copy engine | `adapters/v2/progress/progressInsight.ts` (`buildProgressInsight`) feeds the Progress card |

### 2.3 The ten questions from the brief

| # | Question | Verified answer |
|---|---|---|
| 1 | Where accessed? | §2.1. |
| 2 | How is data retrieved? | Facts from **local** stores; only *history of snapshots* comes from `GET /api/v2/weekly-insights` (`weeklyInsightApiAdapter.ts:9-12`, server `take: 52`). |
| 3 | Global or Anchor-specific? | **Hybrid and inconsistent.** Facts are always computed over *all* anchors/sessions. `anchorId` only (a) picks the "active Anchor" used for thread values (`factsBuilder:184-187`) and (b) filters/keys the stored snapshot. With no `anchorId` the history endpoint returns *every* snapshot (global and per-Anchor mixed) (`weeklyInsightRoutes.ts:12-14`). |
| 4 | How is the week determined? | Device-local clock. `getCompletedWeekDateRange` (`weeklyReviewWindow.ts:75-116`): local Monday 00:00 → Sunday 23:59:59.999. On Sunday **at/after 19:00** the "completed" week is *the current week*, which is not over yet. |
| 5 | What triggers generation? | Opening the screen. An effect (`useWeeklyInsight.ts:183-189`) builds + POSTs if no persisted snapshot matches. No scheduled job, no server trigger. |
| 6 | Dynamic or snapshot? | **Both.** Rendered live from facts until a persisted snapshot with the same `weekLabel` is found (`:111-114`), then the stored one wins. Server is first-write-wins (`update: {}`), so a stale/early write is permanent. |
| 7 | How are past insights accessed? | `WeeklyHistoryDrawer` over `archiveItems` built from the fetched snapshots (`:85`); `selectSnapshot` swaps the displayed one. History comes **only** from persisted rows; `weekOffset` produces live facts for older weeks but is not exposed in any UI I found. **[A]** |
| 8 | What happens on Anchor complete/release? | Builder flags `releasedThisWeek` from `Anchor.archivedAt` (`factsBuilder:150-162`), not `releasedAt`. `intentionCompletedAt` is not read at all (it is not on the shared mobile `Anchor` type in `types/index.ts`; it appears only in the Progress and Release adapters). So *completion* is invisible and *archiving by delete* looks like *release*. |
| 9 | Missing historical data? | Thread: replaced with a flat line (misleading). Prior week: undefined → comparisons silently skipped. Practice on a new device: only what that device has synced into `practiceHistory`. **[A]** on sync completeness. |
| 10 | What can be reused? | Screen shell, section components' *layout*, motion wrappers (`ArrivalScope`, `Reveal`, `ContentSwap`), history drawer, feedback widget, empty state, `weeklyReviewWindow` label formatting (with fixes), snapshot table, feedback route, the 18-rule thresholds as *copy-selection* input. |

### 2.4 Verified defects in the current implementation

These matter for the blueprint because the new design must not inherit them.

| ID | Defect | Evidence | Severity |
|---|---|---|---|
| D1 | **Global snapshot upsert is invalid.** The route passes `anchorId = null` into the compound unique `userId_anchorId_weekStart`. Prisma's generated type requires `anchorId: string` for that input (`node_modules/.prisma/client/index.d.ts:63434-63438`), and Postgres treats `NULL`s as distinct in a unique index anyway. The request body is `any`, so it compiles. Expect either a Prisma validation error or duplicate rows. The mobile call swallows failures (`useWeeklyInsight.ts:188`), so it would be invisible. | `weeklyInsightRoutes.ts:29,36-37`; migration `…weekly_insights/migration.sql` (UNIQUE ("user_id","anchor_id","week_start")) | High **[T]** — confirm with a test against real Postgres |
| D2 | **Snapshots are matched by `weekLabel`.** "Oct 12 – 18" is not unique across years (history is up to 52 rows) and the unfiltered list mixes scopes, so the wrong snapshot can be shown. | `useWeeklyInsight.ts:113` | Medium |
| D3 | **Early freeze.** Window opens Sunday 19:00 and `getCompletedWeekDateRange` treats that Sunday as complete, so the snapshot persisted at 19:05 omits 19:05–23:59 practice forever (first-write-wins). | `weeklyReviewWindow.ts:87-91`, `weeklyInsightRoutes.ts:45` | Medium |
| D4 | **Delete shown as release.** `DELETE /api/anchors/:id` only sets `isArchived`/`archivedAt` (no `releasedAt`, no ledger event) (`backend/src/api/routes/anchors.ts:1197-1233`); the builder treats any in-week `archivedAt` as released. | `factsBuilder:150-162` | Medium |
| D5 | **Fabricated thread line** (see §1). | `factsBuilder:196-204` | High (truthfulness) |
| D6 | **Dead rule inputs / event-name mismatch** (see §1). | `useWeeklyInsight.ts:92-103`, `factsBuilder:238` | Medium |
| D7 | **Feedback never consumed.** | grep | Low (but a wasted signal) |
| D8 | **Two copy engines.** Progress card text (`buildProgressInsight`) and Weekly Insight headline (`selectWeeklyInsight`) are independent, so the card a user taps can say something different from the screen it opens. **[A]** — both exist; I did not render them side by side. | `progressAdapter.ts:921` vs `selector` | Low-Medium |
| D9 | **No backend tests for the weekly-insight route.** | `backend/src/api/routes/v2/__tests__/` has no weekly test | Medium |
| D10 | **Header comment overstates integration.** The builder's file header says it aggregates "canonical Thread Events" (`factsBuilder:1-7`), but the code reads only `sessions`, `anchors` and `courseLogs`; no ledger read exists anywhere in the Weekly Insight code. | `factsBuilder:1-7` vs body | Informational |
| D11 | **The V2 import-boundary check already fails on the current tree.** I ran `node scripts/check-v2-import-boundary.mjs` from `anchor/mobile` (read-only): exit 1 with 37 files reported (e.g. `components/chart/ChartMapCrop.tsx`, `components/chart/ChartPreview.tsx`, `screens/settings/SettingsScreen.tsx`). The earlier implementation report claims "V2 import boundary OK"; that is no longer true. | script output | Low (but it affects acceptance criteria — see AC-28) |

### 2.5 Server-side event sources already in place **[V]**

| Producer | Writes | Where |
|---|---|---|
| Practice completion | `PracticeSession` (unique id, `completionStatus` is literally `'completed'` per zod, `localDateKey`, `timeZone`), `ThreadV2Movement` (1:1 by `sessionId`), ledger `THREAD_STRENGTHENED` (`practice-thread-event:<sessionId>`) | `api/routes/practice.ts:109,345`; `services/v2/ThreadStrengthService.ts:408-423` |
| Waypoint reached | `Waypoint.reachedAt`, `CourseEvent WAYPOINT_REACHED`, ledger `WAYPOINT_REACHED` (`chart-thread-event:<courseEventId>`, HIGH) | `services/CourseService.ts:1136-1166` |
| Destination reached | `Course.completedAt`, `CourseEvent COURSE_COMPLETED`, ledger `DESTINATION_REACHED` (MAJOR; skipped for `NEXT_STRETCH`) | `CourseService.ts:1198-1225` |
| One Move completed | `Move.completedAt`, `CourseEvent MOVE_COMPLETED`, ledger `ONE_MOVE_COMPLETED` | `services/chart/ChartService.ts:636-646` |
| Anchor intention completed | `Anchor.intentionCompletedAt` (set once, race-safe). **No ledger event.** | `services/v2/IntentionCompletionService.ts:41-60` |
| Anchor released | `Anchor.releasedAt` + `archivedAt` + `isArchived`; archives linked Courses/Waypoints (keeps `reachedAt`); ledger `ANCHOR_RELEASED` (MAJOR); replay returns the original timestamp | `services/v2/AnchorReleaseService.ts:31-113` |
| Milestones | `AnchorMilestone` (unique `[userId, anchorId, definitionId]`, `earnedAt` derived from the *source* timestamp, never from "now"; `celebratedAt` is presentation-only) | `prisma/schema.prisma:290-313`; `services/v2/milestones/registry.ts` |
| Vision | `Vision.firstCommittedAt`, `boardCompletedAt`; `VisionView` (with `localDateKey`); `VisionScene` | `VisionService.ts:269-369,1089-1119`; `schema.prisma:1030-1070,1253` |

**The `ThreadEventLedger` has three producing services writing five event types**: `THREAD_STRENGTHENED` (practice), `ONE_MOVE_COMPLETED`, `WAYPOINT_REACHED` and `DESTINATION_REACHED` (Chart, via `appendChartLedgerEvent`), and `ANCHOR_RELEASED`. The mobile type list defines 15 event types (`constants/v2/threadEvents.ts:5-11`), but `ANCHOR_CREATED`, `ANCHOR_COMPLETED`, `EVOLUTION_STAGE_REACHED`, `PRACTICE_MILESTONE_REACHED` and others have **no server producer**. The ledger is therefore *not* a complete event system and must not be treated as the source of truth for the recap. **[V]** (grep of `threadEventLedger` writes in `backend/src`: `ThreadStrengthService`, `AnchorReleaseService`, `CourseService`; `ChartService` calls `appendChartLedgerEvent`).

The ledger's read endpoint is also the wrong shape for history: `GET /thread-events/eligible` returns the oldest 25 events *not yet presented on a channel* (`api/routes/v2/threadEvents.ts:20-56`). It is a presentation queue, not a time-range query.

---

## 3. Data Readiness Matrix

Classification: **A** = available and reliable · **T** = available, requires transformation · **P** = partially available · **N** = not currently available.

| Data point | Class | Canonical source (verified) | What works | What does not / caveats | Use in recap? |
|---|---|---|---|---|---|
| **Active Anchors in a historical week** | **T** | `Anchor.createdAt`, `releasedAt`, `archivedAt`, `intentionCompletedAt` (`schema.prisma:91-212`) | Interval logic: `createdAt ≤ weekEnd` and not (`releasedAt/archivedAt` < `weekStart`) | No `isReleased` column; delete-archive (`archivedAt` only) ≠ release (`releasedAt` set). Mobile list likely excludes archived Anchors from active views **[A]**, so identity/artwork must be fetched server-side | Yes — server-side |
| **Practice sessions / practice days** | **A** (server) / **P** (device cache) | `PracticeSession` (`schema.prisma:444-488`): `localDateKey`, `timeZone`, `utcOffsetMinutesAtCompletion`, `completedAt`, `anchorId` + `anchorServerIdSnapshot` | Unique practice days = distinct `localDateKey`; per-day and per-Anchor counts; survives Anchor archive (`anchorId` SetNull + snapshot) | `GET /api/practice/sessions` is cursor-paged, no date filter (`practice.ts:566-594`) → need a range query. Legacy `Activation`/`Charge` tables are *not* in `PracticeSession` (schema comment says merged at account restoration). Offline sessions appear only after sync | **Yes — always-on stat** |
| **Chart waypoints** | **A** | `Waypoint.reachedAt` (truth), `CourseEvent` (`occurredAt`, idempotent), ledger | Timestamped, idempotent, survives release (`reachedAt` kept; `archivedAt` set); `Waypoint.supportingPracticeSessionId`; `PracticeSession.waypointId/courseId` soft refs | Only **one ACTIVE Course per user** (`CourseService.ts:476-479`) so "several Charts" means *historical* Charts; Courses soft-delete via `deletedAt`; Charts without `anchorId` (pre-2.0) get **no** ledger event (`CourseService.ts:252-255`), so read `Waypoint.reachedAt`, not the ledger; cancelled/skipped waypoints must be excluded | Yes |
| **Anchor completions** | **A** (server) | `Anchor.intentionCompletedAt`; `AnchorMilestone journey.goal` | Original date preserved after release (completion is refused on archived Anchors, release never clears it) | Not in ledger; not on the shared mobile `Anchor` type (`types/index.ts`; only Progress/Release adapters reference it); completion and release are **two separate dates** | Yes |
| **Anchor release** | **A** | `Anchor.releasedAt` (+ ledger `ANCHOR_RELEASED`) | Terminal, idempotent, original timestamp on replay | Must be keyed on `releasedAt`, not `archivedAt` (D4) | Yes |
| **Thread / Consistency strength — weekly delta** | **T** (server only) | `ThreadV2Movement` (before/after/delta per session), `ThreadStrengthService.calculateStrengthAtDate` (`:583`, already used for `delta7d` at `:525-535`) | Per-session movements are exact; strength *as of any instant* is reconstructable including decay | `ThreadV2State` is current-only; movements exclude decay between sessions, so week-start→week-end needs `calculateStrengthAtDate`; legacy client `threadStrength` is current-only. Product label is "Consistency" in UI (`constants/v2/threadEvents.ts:42-56`) | **Secondary only**, server-computed, hidden when unavailable. Never a hero or headline stat |
| **Thread values as a 7-day curve** | **N** | — | — | Nothing stores daily snapshots. Current implementation fakes it (D5) | **No** |
| **Vision creation** | **A** | `Vision.firstCommittedAt`, `AnchorMilestone vision.first` | Dated, idempotent | — | Yes (low priority) |
| **Vision board completed** | **A** | `Vision.boardCompletedAt`, `vision.board.complete` | Dated | — | Yes |
| **Vision revisits / visualize practice** | **A** | `VisionView` (with `localDateKey`); `PracticeSession.practiceMode = 'visualize'` | Counts per day | V1 hook never wired this (D6) | Optional support line |
| **Vision "edited / meaningfully updated"** | **N** | Only `Vision.updatedAt` / `VisionScene.updatedAt` | — | `updatedAt` changes on *any* write; there is no edit-event record. Cannot distinguish creation vs edit vs meaningful update | **No** — do not claim "updated your Vision" |
| **Milestone achievements** | **A** per Anchor / **P** as a global system | `AnchorMilestone` (24 definitions, versioned, `earnedAt` from source) | Permanent, idempotent, decay-proof; `reconcileAndList` backfills offline history | Per-Anchor, not a global feed; **second** event system beside the ledger; `sourceEntityId` overlaps other tables (see double-counting) | Yes, as the *achievement label* layer, deduped |
| **Archived Anchors' historical access** | **A** (data) | All rows retained; `Course.anchorId` SetNull only on hard delete (no hard-delete route; user-account delete cascades) | Artwork fields (`baseSigilSvg`, `reinforcedSigilSvg`, `enhancedImageUrl`) retained | Client-side visibility **[A]** | Yes, resolved server-side |
| **Weekly history (past recaps)** | **P** | `weekly_insight_snapshots.snapshot` JSONB | Stored JSON is immutable text | Client-authored, no schema version, unvalidated, label-keyed, global scope broken (D1–D3). Snapshots hold display strings only, not durable entity refs | Replace; keep legacy rows readable |
| **Today recommendation / next move** | **A** | `RecommendationService.getRecommendationContext` (per Anchor: action ∈ Release/Visualize/Deep Prime/Focus + reason; completion signals) and Chart `currentMove`/home chart state | Existing, tested logic | Per-Anchor; no global "best next move" | **Reuse** (see §5.H) |
| **AI reflection for the week** | **N** | none (selector is deterministic) | — | Chart has AI (planner, Ask Chart); weekly has none | Not in v1 |
| **User timezone (server)** | **N** | none on `User`/`UserSettings` (`schema.prisma:941-974`) | Per-session `PracticeSession.timeZone`, per-view `VisionView.timeZone`; per-request `timeZone` query param on thread/recommendation | No persisted user zone | Capture zone *into the snapshot* (§10) |

### 3.1 Is a dedicated aggregation layer needed?

**Yes — a read-model aggregation service, but not a new write-side event store.**

- The canonical facts are already persisted with good timestamps. A *new* event table would duplicate them and create a third source of truth beside the ledger and `AnchorMilestone`.
- What is missing is a **single query layer** that joins them by week, de-duplicates across them, and applies the hero ladder. That is what to build (§8.1).
- The existing ledger is incomplete (four writers) and shaped as a presentation queue, so it cannot be that layer.

### 3.2 Double-counting risk — verified overlaps

One user action touches several subsystems. Count each **fact once**, keyed on its *source entity*.

| User action | Rows it creates/affects | Safe rule |
|---|---|---|
| Reach a waypoint | `Waypoint.reachedAt` · `CourseEvent WAYPOINT_REACHED` · ledger `WAYPOINT_REACHED` (sourceEntityId = courseEvent id) · `AnchorMilestone journey.waypoint.first` (sourceEntityId = waypoint id), `journey.halfway` (= **course** id) | **Count `Waypoint.reachedAt` only.** Milestones and ledger are annotations keyed to the same waypoint; never add them |
| Reach destination | `Course.completedAt` · `CourseEvent COURSE_COMPLETED` · ledger `DESTINATION_REACHED` · `journey.destination` (= course id) · the final waypoint's own `WAYPOINT_REACHED` | One *destination* event; the last waypoint is **not** also a separate waypoint highlight |
| Practice session | `PracticeSession` · `ThreadV2Movement` · ledger `THREAD_STRENGTHENED` · `AnchorMilestone commitment.practices.N` and `strength.*` (sourceEntityId = **session id**, same as the practice) | **Count `PracticeSession` only.** A strength/practice milestone shares the session's id, so it labels that session instead of adding to totals |
| Complete an intention | `Anchor.intentionCompletedAt` · `journey.goal` (sourceEntityId null) | Key on `anchorId + 'completed'` |
| Release | `Anchor.releasedAt` · ledger `ANCHOR_RELEASED` · archived Courses/Waypoints (`archivedAt`) | Key on `anchorId + 'released'`; archived waypoint rows must **not** produce events |
| Complete + release in one week | Both of the above | One composite hero ("completed and released"), two dated facts |

**Rule:** every highlight carries a `dedupeKey = <sourceKind>:<sourceEntityId>`; `AnchorMilestone` rows whose `sourceEntityId` equals an already-included entity are merged into that entry as a label, not emitted separately.

---

## 4. UX and Design Assessment

Reviewed against the two-screen mockup and the existing Anchor 2.0 system.

### 4.1 What the mockup gets right

- **A clear editorial order**: opening → one big moment → proof → texture → next step. That is a real improvement over the current screen's flat stack of evidence rows.
- **A single hero** with real artwork gives the page a memorable anchor point and a natural place for the one celebratory beat.
- **Warm cream + ink contrast** matches existing tokens: cream `colors.background #F4F1E9`, paper `colors.surface #FBF9F4`, ink `colors.ink.base #121A22` / `raised #18212A` (`theme/v2/colors.ts`).
- **Real imagery per row** (Anchor sigil, Chart, Vision photo) makes rows recognisable at a glance.
- **Quiet utility footer** (activity, past weeks) keeps detail one tap away, consistent with the existing `WeeklyActivityDisclosure`.

### 4.2 Where I challenge it

| # | Mockup element | Problem | Recommendation |
|---|---|---|---|
| 1 | **Stats vs hero/highlights disagree** ("2 waypoints reached"; hero and highlights show one) | This is the exact double-counting hazard in §3.2, drawn into the design. A real recap must reconcile every number to listed events | Every stat tile must be derivable from the event list shown on the same screen. Add a unit test that asserts it (§13) |
| 2 | **Dates contradict weekdays.** Hero/highlights say Oct 16 and Oct 18; Week in Motion marks Thursday (flag) and Saturday (check). Oct 12, 2026 is a Monday, so Oct 16 is **Friday** and Oct 18 is **Sunday** | Looks like illustrative data, but it shows how easily a weekday-index off-by-one slips in (the code uses Monday-first indexing, `factsBuilder:70-73`) | One date-key → weekday function, shared by motion strip, highlights and tests |
| 3 | **"Completed and released" shown as one thing** | Completion (`intentionCompletedAt`) and release (`releasedAt`) are separate facts with separate dates. The brief also asks not to imply deletion | Show **Completed** and **Released** as distinct events when each is in-week; one composite hero when both are. Release copy never uses "removed/deleted" |
| 4 | **"Your Anchors This Week" repeats Highlights** (same three entities, same images, same facts) | Redundant, and the brief asks to avoid repeated cards | Merge. See §5.E/F: Highlights = *events*; the Anchors list becomes a compact *engagement* strip only for Anchors with practice but no highlight |
| 5 | **Five-node progress trails on Anchor rows** (gold nodes for Financial Freedom, pink nodes + hollow end for the completed Anchor, five small dots for Fitness) | Three different encodings on one list. The completed Anchor shows a 5-step path with no data source (an Anchor has no waypoints of its own; a Chart does). The Fitness dots look like days but have no labels | Delete decorative trails. Use real text: "Waypoint 2 of 5 reached" (from Chart), "4 practice days" (from sessions) |
| 6 | **Two generic text blocks** ("This week's reflection", "What this means") | Both are interchangeable motivational copy; the brief explicitly says avoid large blocks of filler | One reflection (§5.G). Drop "What this means" as a separate card |
| 7 | **Three dark navy panels** (hero, reflection, next move) + gold in ≥6 places (eyebrows, hero button outline, stat icon, motion bar, CTA fill, moon) | Gold stops meaning "significant". Dark panels repeat and flatten hierarchy | Hero is the *only* ink panel with gold. Reflection sits on cream. Next Move is a quiet paper row with one filled CTA (§4.4) |
| 8 | **Week in Motion bars of unexplained height** | Bar height implies a quantity with no legend, and the brief wants multiple events per day handled gracefully | Replace with a hybrid strip (§5.D): day column + stacked event markers; tap a day for a sheet |
| 9 | **"GLOBAL RECAP" label** | Internal terminology | "All Anchors" or omit |
| 10 | **Two routes to history** (header clock icon and a "Past weeks" row) | Duplicate | Keep header icon; keep "Past weeks" only if it opens the same drawer — otherwise remove |
| 11 | **Serif display headline** | App type is Inter only. `theme/v2/typography.ts` notes `CrimsonPro-SemiBold` is "not loaded" and Vision serif roles are deferred | **DECISION**: bundle a serif (adds a font asset + load gating) or ship Inter display at 28–42 px with tight tracking (existing `displayLarge`/`headingXL`) |
| 12 | **Mountain illustration** | Not the user's Chart | The app's real Chart is an etched category map with a route overlay (`ChartMapCrop`); use that |
| 13 | **"Your next move" with a Chart-specific step** | Existing recommendation logic returns *practice actions* per Anchor, not Chart steps | Compose from two existing sources (§5.H); never a third engine |
| 14 | **Feedback chips are Yes/Mostly/Not really** | Fine, but placed under a CTA, which risks accidental taps and competes with the primary action | Move feedback *above* Next Move or below the footer rows; keep it a single tidy row |

### 4.3 Design-system fit (what exists)

| Need | Existing asset | Status |
|---|---|---|
| Cream canvas / paper / ink | `colors.background`, `colors.surface`, `colors.ink.*`, `colors.navy #0B203E` | **REUSE** |
| Hairlines | `colors.border.subtle #E5E0D7`, `colors.ink.hairline` | **REUSE** |
| Category colors | `theme/v2/categories.ts` (`getCategoryColor`, `getCategoryTextColor` enforces 4.5:1) | **REUSE** |
| Gold | **Three** golds exist: `CHART_MAP_GOLD #E0A038` (`components/v2/chart/map/chartMapTokens.ts:29`), `colors.paywall.gold #E2BC6B`, `WEEKLY_INSIGHT_COLORS.prime #E0A038` | **DECISION** — pick one `colors.gold` (recommend `#E0A038`, already the Chart's gold) |
| Typography | Inter only (`theme/v2/typography.ts`); roles `displayLarge 42/50`, `headingXL 28/35`, `labelSM` uppercase 11 | **REUSE**; serif is a **DECISION** |
| Motion | `AnchorMotion` durations (120/180/280/420 ms), easings, springs, `stagger {step 60, cap 6}`, `rise 14` (`theme/v2/motion.ts`); `Reveal`, `ArrivalScope`, `ContentSwap` (`components/v2/motion`) | **REUSE** |
| Reduce motion | `useV2ReduceMotion` (in-app setting; Reanimated's OS check is deliberately opted out) | **REUSE** |
| Haptics | `v2Haptics.completion()` / `selection()` (`hooks/v2/haptics.ts`) | **REUSE** |
| Cards / rows | `components/v2/primitives`, Progress cards (`components/v2/progress/*`) | **REUSE** patterns |
| Anchor art | `CircularAnchorRenderer`, `AnchorMark`, `anchorArtworkSvg()` (`components/v2/anchors/anchorPresentation.ts:6`) | **REUSE** |
| Chart art | `ChartMapCrop` (`components/chart/ChartMapCrop.tsx`), `ChartWorldPreview`, `buildRouteTable`, `waypointPlacement`, `useChartMapAnimState` | **REUSE** / **MODIFY** (§7) |
| Vision images | `adapters/v2/vision/orderedVisionImages.ts` | **REUSE** |
| Bottom sheets | existing Progress sheets (`V2ThreadEventDetailSheet`, `V2ProgressAnchorSheet`) | **REUSE** pattern |

**Contrast findings (computed):** gold `#E0A038` on cream `#F4F1E9` is **2.01:1**, so it fails for text and thin lines and is only valid as a *fill on ink* (7.73:1). `colors.semantic.warning #9A6818` on cream is **4.26:1**, which fails AA for small text. Secondary text `#6C6861` on cream is 4.91:1 (passes). `tertiary #858B93` on cream is 3.04:1 (large text only). So: **gold never appears as text or hairline on cream; use ink or the category text color helper instead.**

### 4.4 Revised visual rules

- **Gold = one meaning: "a significant verified event."** It appears at most twice: the hero's marker/rule and (if present) the single most important highlight glyph. Not on eyebrows, icons, stat tiles or CTAs.
- **One ink panel (the hero).** Everything else is cream/paper with hairlines. The Next Move row uses a filled ink button on paper.
- **Category color is identity**, shown as a small marker beside names, never a panel fill.
- **No decorative rings** around Anchors. Anchor art sits in a soft category-wash tile (`getCategoryFieldColor`), as in Progress.
- **Shadows**: none on rows; one soft shadow on the hero only.

---

## 5. Recommended Final Experience

Order and purpose, with the final verdict on each mockup section. Item labels refer to the brief's A–I.

### 5.0 Page skeleton

```
Header            [‹]  Weekly Insight  [history]
A  Opening        range · headline · one-sentence summary
B  Hero           Biggest Moment (dynamic, 1 event)
C  Stats          2 persistent + 1 conditional
D  Week in Motion Mon–Sun hybrid strip → day sheet
E  Also this week ≤3 events not already shown
F  Across Anchors ≤4 engagement rows (practice-only Anchors)
G  Reflection     one template-driven paragraph
H  Next Move      one live action (latest week only)
I  Feedback · See weekly activity · Past weeks
```

Empty sections **collapse entirely** (no empty cards). On a quiet week, B becomes the quiet hero and C–F may all be absent.

### A. Weekly opening — **MODIFY**

- **Date range**: `OCT 12 – 18` (eyebrow). Includes the year when the range crosses a year boundary or is not in the current year (`Dec 29, 2026 – Jan 4, 2027`). Fix `formatWeekDateRange` (`weeklyReviewWindow.ts:50-61`), which ignores years.
- **Headline**: chosen from the **hero kind and counts**, not from a mood. A fixed template table keyed by `heroKind` (§7.3). It must never claim more than the facts support ("You made real progress this week" is allowed only if ≥1 verified progress event exists; otherwise a quiet-week headline).
- **Summary**: one sentence assembled from counted facts only, e.g. "You practiced on 4 days, reached a waypoint, and completed an Anchor." Each clause is emitted only when its count is >0. Max 2 lines at default text size.
- Drop "GLOBAL RECAP" and the redundant "Completed week" subtitle.

### B. Biggest Moment — Dynamic hero — **BUILD**

One hero, selected deterministically (§7). Visual states:

| Hero kind | Art | Copy pattern | Action |
|---|---|---|---|
| `DESTINATION_REACHED` | Chart map at its *final* state (`arrived`) | "Destination reached." + destination text | View Chart |
| `ANCHOR_COMPLETED_RELEASED` | The Anchor's real sigil, calm, intact | "Completed and released." + intention text | Open Anchor (archive view) |
| `ANCHOR_COMPLETED` | Anchor sigil | "Intention completed." | Open Anchor |
| `ANCHOR_RELEASED` | Anchor sigil | "Released with intention." (never "deleted") | Open Anchor (archive view) |
| `WAYPOINT_REACHED` | Chart map **as of that moment** (reached waypoint illuminated) | "Waypoint reached." + waypoint title + "n of N" | View on Chart |
| `STRENGTH_MILESTONE` | Anchor sigil | "Your Anchor reached *Established*." (from `strength.*`) | Open Anchor Progress |
| `VISION_MILESTONE` | Vision image only if a real asset exists, else Anchor sigil | "Vision board complete." / "Your Vision began." | Open Vision |
| `PRACTICE_WEEK` | Anchor sigil of most-practiced Anchor, or a quiet typographic hero | "N practice days." | Open Progress |
| `RETURN` | Anchor sigil | "You came back." (only if a gap ≥14 days is verified) | Open Practice |
| `QUIET` | Typographic only | "A quiet week." + supportive line | Open Home |

Historical accuracy rule: the Chart hero renders the Chart **as it was at week end** (waypoint reached flags derived from `reachedAt ≤ weekEnd`), not as it is today. The frozen snapshot stores `{courseId, waypointId, waypointIndex, waypointTotal, categoryKey, reachedWaypointIds[]}`.

### C. Weekly statistics — **MODIFY**

| Slot | Metric | Always shown? | Source | Rule |
|---|---|---|---|---|
| 1 | **Practice days** ("4 of 7") | Yes, when the week has ≥1 verified session **or** the user had practice data at all | distinct `PracticeSession.localDateKey` | Never "0" for *unknown*; see below |
| 2 | **Practices** (sessions; minutes as sub-label) | Yes (same condition) | `PracticeSession` count and `completedDurationSeconds` sum | Sessions across *all* Anchors |
| 3 | **Conditional**: the most meaningful non-zero of — waypoints reached, Anchors completed, Anchors released, milestones earned | Only if >0 | §3.2 dedupe | Never shows "0"; slot disappears |

**Unknown is not zero.** If the server could not read a domain (error/timeout), that stat is omitted and `dataQuality.missing` lists it; the UI shows nothing in its place. For a genuinely quiet week (domain readable, count 0), Practice days shows "0 of 7" **only** inside the quiet hero's context, not as a bare tile.

Not recommended as tiles: Thread Strength delta (not reliably available for all Anchors/weeks, and users see "Consistency"), "vision updates" (not measurable, §3).

### D. Your Week in Motion — **BUILD** (hybrid strip)

Evaluated three forms:

| Option | Verdict |
|---|---|
| Interactive month-style calendar | Too heavy for one week; adds nothing |
| Pure event timeline (list) | Duplicates Highlights |
| **Hybrid strip: 7 day columns, markers stacked, tap day → sheet** | **Recommended** |

Behavior:

- Columns Mon–Sun, labeled. Each column shows up to **3 practice dots** (one per session, color = practice mode via `theme/v2/practiceColors.ts`) with a "+n" chip beyond 3, and **at most one glyph row** for milestone events (flag = waypoint, check = completed, ring-close = released, eye = vision board). Glyphs stack vertically if several; more than 2 collapse into a "•••" chip.
- **No bar heights.** If minutes should be encoded, add a legend; otherwise don't encode.
- Tap a day (≥44 pt target) → bottom sheet listing that day's events, each row tappable to its destination (§9). Days with no activity are non-interactive and have an accessibility label "No activity".
- Today's column (when viewing a current week) is not highlighted; this is a recap, not a tracker.
- A11y: each column is one accessibility element: "Friday: 2 practices, waypoint reached."

### E. Weekly Highlights ("Also this week") — **BUILD**

- **Max 3 rows**, excluding the hero's `dedupeKey`.
- Ranking: tier priority (§7.1) → significance → recency. Same-type events from one Anchor collapse to one row ("2 waypoints reached — Financial Freedom").
- Row anatomy: art tile (Anchor sigil or Chart crop, never a Vision photo by default), type label, Anchor name (single line, ellipsis; full name in the accessibility label), date, one factual line, chevron.
- Practice-only weeks: one row "N practices across K Anchors" is allowed only when no non-practice highlight exists.

### F. Across your Anchors — **MODIFY** (retain, but narrower)

Assessment: as drawn it adds nothing beyond Highlights. It *does* add value in one case: Anchors that were practiced but had no event. Retain with strict scope:

- Show only Anchors with ≥1 practice this week **and** not already represented in the hero/highlights.
- **Max 4 rows**; rest behind "See weekly activity".
- Row text is real: "4 practice days · 6 practices". No dots, no trails, no progress bars (no data source).
- If a Chart waypoint was reached for that Anchor, it is already a highlight, so it does not repeat here.
- Hidden entirely when the user has one Anchor (the opening and stats already say it).

### G. Weekly Reflection — **BUILD** (template-driven, deterministic)

Options compared:

| Option | Accuracy | Latency | Backend cost | Privacy | Reliability | Verdict |
|---|---|---|---|---|---|---|
| Deterministic copy | Perfect | 0 | 0 | None | Perfect | Too samey over weeks |
| **Template-driven (fact-slotted)** | Perfect | 0 | 0 | None | Perfect | **v1** |
| AI-assisted | Risk of invented claims | 1–4 s | Gemini call per recap | Practice/reflection content leaves the device | Needs fallback | Later, opt-in |
| Hybrid (template + optional AI polish) | Good if schema-constrained | Lazy | Low | Needs consent | Falls back to template | **Candidate v2** |

Recommendation: **template-driven in v1**, 3–5 phrasings per `heroKind` chosen by a stable hash of `userId+weekKey` (so the same week always reads the same, different weeks vary). Every sentence references a verified fact (a count, a title, a date). Banned: causal psychology ("because you're building discipline"), growth claims, streaks, comparisons to others. Optional v2 AI polish must (a) take only the structured facts, never free-text Reflection bodies unless `Reflection.aiConsentGrantedAt` is set (`schema.prisma:687-716`), (b) return JSON validated against allowed fact IDs, (c) be generated once at finalization, never at view time, (d) fall back to the template on any failure. **DECISION D-3.**

Placement: one paragraph on cream, serif/display optional. Removes the second "What this means" block.

### H. Your Next Move — **MODIFY** (compose existing logic; live, not frozen)

Never a new recommender. Priority, evaluated **at view time** for the latest week only:

1. **Active Chart with a current Move** → "Take your next step on *<Chart>*" → Chart (source: home chart state / `chart.nextMove`, `components/v2/chart/ChartWorldPreview.tsx`, `adapters/v2/home/chartAdapter.ts`).
2. Else **recommended practice** for the most-recently-active, non-released Anchor → `RecommendationService.getRecommendationContext` (`services/v2/RecommendationService.ts`; route `GET /anchors/:id/recommendation-context`) — action ∈ Release/Visualize/Deep Prime/Focus, with its own `reason`.
3. Else Vision (if no Vision exists for an active Anchor) or Home.

Rules: omitted when viewing a past week (a stale CTA is misleading) — or replaced by "Back to today"; omitted if the week's hero is a release and the user has no active Anchors (no empty promise). The CTA uses the recommendation's reason text verbatim; the recap adds none.

### I. Feedback and history — **MODIFY**

- Keep "Did this match how your week felt?" with Yes / Mostly / Not really (route already validates these three, `weeklyInsightRoutes.ts:61`).
- **Today it affects nothing (D7).** Recommended behavior: (1) persist against the snapshot id, last answer wins; (2) emit one analytics event with `{recapVersion, heroKind, reflectionTemplateId, rating}`; (3) **do not** personalize or regenerate on feedback in v1 — the sample is tiny and would break "frozen"; (4) review ratings offline monthly to tune the hero ladder and templates; (5) optional follow-up chip on "Not really" (e.g., "Missed something I did / Wrong emphasis") — **DECISION D-6**.
- "See weekly activity" opens the **existing** `WeeklyActivityDisclosure` content, rebuilt on the new view-model (drop the fake thread sparkline).
- **Past weeks**: one entry (header clock) opening the existing drawer, listing final snapshots by `weekKey`, newest first, paginated beyond 52. Legacy V1 snapshots display with a compact legacy renderer.

---

## 6. Global vs. Per-Anchor Architecture

| Concern | **Weekly Insight (global)** | **Progress (per Anchor)** |
|---|---|---|
| Question answered | "What moved forward in my life this week?" | "How is *this* Anchor developing?" |
| Scope | All Anchors, all Charts, one user, one week | One Anchor, rolling ranges (week/month/year) |
| Data owner | **Server read-model** (new) | Mixed: local stores + server (`useV2Progress`) — unchanged |
| Time model | Frozen weeks keyed by `weekKey` | Live ranges |
| Persistence | `weekly_insight_snapshots` (scope GLOBAL) | None beyond existing |
| Thread Strength | Optional per-Anchor secondary line, server-computed | First-class (history, sparkline, stage) |
| Entry | Home, notification, Progress card | Anchor card |

**Separation rules**

1. Weekly Insight never reads Progress adapters, and Progress never reads the weekly snapshot. They share only **server facts** and **UI primitives**.
2. The **Progress "Weekly Insight" card stays** (`components/v2/progress/V2ProgressWeeklyInsight.tsx`) but its tap opens the global recap with `focusAnchorId` (scrolls/highlights that Anchor's rows). The card's own text (`buildProgressInsight`) is relabelled so it cannot be mistaken for the recap headline (fix D8), or reads the latest final snapshot's headline when one exists. **DECISION D-2.**
3. `anchorId` as a *scope* is retired from the snapshot table for new rows. Existing per-Anchor rows remain readable as legacy.
4. Per-Anchor Progress screens keep deriving their own events (`deriveThreadEvents`, `progressAdapter.ts:218`). That function dates stage events from **device-local** celebration records, which is not acceptable for a frozen cross-device recap — one more reason the recap must not borrow it. **[V]**

---

## 7. Dynamic Hero and Personalization Rules

All logic below is **pure and deterministic**: the same candidate set always yields the same hero, headline and reflection. It lives server-side in one domain module (**BUILD** `backend/src/domain/v2/weeklyRecap.ts`) with golden-file tests, and the chosen result is frozen into the snapshot.

### 7.1 Candidate eligibility (applied before ranking)

An event becomes a **candidate** only if all hold:

- It happened within `[weekStart, weekEnd)` in the snapshot's timezone (half-open; see §10 for DST).
- It belongs to the user and its Anchor row exists (archived/released Anchors **are** eligible).
- Waypoint: `reachedAt` set, not `cancelledAt`/`skippedAt`, Course not `deletedAt`. Rows archived by release (`Waypoint.archivedAt`) are still eligible *for their original `reachedAt`* — release must not erase or re-date history.
- Practice: `completionStatus = 'completed'` (the only value the API accepts, `practice.ts:109`).
- Release: `Anchor.releasedAt` set. **`archivedAt` alone is never a release** (D4); it is an "archived" fact and produces no celebratory candidate.
- Milestones: `AnchorMilestone.earnedAt` in range; `celebratedAt` is ignored for dating.
- No candidate is built from Vision `updatedAt` (no edit events exist, §3).

### 7.2 Hero priority ladder

Ranked high → low. This follows the existing presentation ordering `V2_THREAD_EVENT_PRIORITY` (`constants/v2/threadEvents.ts`) with one deliberate change flagged as **DECISION D-4**.

| Tier | Hero kind | Qualifies when | Notes |
|---|---|---|---|
| 1 | `DESTINATION_REACHED` | a non-`NEXT_STRETCH` Course has `completedAt` in range | Suppresses its own final waypoint event |
| 2 | `ANCHOR_COMPLETED_RELEASED` / `ANCHOR_RELEASED` / `ANCHOR_COMPLETED` | `releasedAt` and/or `intentionCompletedAt` in range | Both in range for the same Anchor → one composite hero |
| 3 | `WAYPOINT_REACHED` | ≥1 eligible `reachedAt` in range | **D-4:** placed above strength stages; existing table ranks `EVOLUTION_STAGE_REACHED (100)` above `WAYPOINT_REACHED (90)` |
| 4 | `STRENGTH_MILESTONE` | `strength.building … strength.full` earned in range | Server-dated (`AnchorMilestone`), not the device-local stage dates Progress uses |
| 5 | `VISION_MILESTONE` | `vision.board.complete` (preferred) or `vision.first` in range | Never an "edited/updated" claim |
| 6 | `PRACTICE_COUNT_MILESTONE` | `commitment.practices.N`, `commitment.minutes.N`, `vision.visualize.N` in range | Highest N wins |
| 7 | `PRACTICE_WEEK` | ≥4 distinct practice `localDateKey`s (`V1_INSIGHT_THRESHOLDS.consistencyMinActiveDays`) | Counts only — no streak language |
| 8 | `RETURN` | first completed practice in range after a verified gap ≥14 days (prior session read from the DB) | Needs a prior session; otherwise skipped |
| 9 | `STEADY` | 1–3 practice days | Factual, no judgment |
| 10 | `QUIET` | domain readable, 0 practice and 0 events | Supportive; no "0 progress" language |
| — | *(no recap)* | account has no completed practice and no events ever | Empty state, §10 case 1 |

### 7.3 Ties and simultaneous achievements

Within a tier, pick by this ordered list (first difference wins):

1. **Domain rank**: for waypoints, higher `reachedCount / waypointCount`; for milestones, higher definition rank (static table: `strength.full > reinforced > integrated > established > building`; `practices.100 > 30 > 10 > 1`).
2. **Significance**: MAJOR > HIGH > MEDIUM > LOW.
3. **Most recent** `occurredAt`.
4. **Lexicographic `dedupeKey`** — guarantees total order and bit-for-bit reproducibility.

Rules for multiples:

- **Exactly one hero.** All other candidates flow into "Also this week" in the same order (§5.E), after dedupe.
- **Composite**: complete + release of the same Anchor merge into one hero with two dated lines.
- **Same-moment overlap**: the destination hero removes the final waypoint candidate; any `AnchorMilestone` whose `sourceEntityId` equals an included entity is attached as a **label** to that entity (e.g., "First waypoint"), never listed separately (§3.2).
- **Two waypoints, same Chart, same week**: hero = the later/higher-ratio one; "Also this week" gets one collapsed row "2 waypoints reached".
- **Two Anchors with the same tier**: apply the tie list above; the loser appears in highlights.

### 7.4 Headline and summary selection

`headlineKey = f(heroKind, counts)` from a versioned template table; examples (conceptual, not mandatory copy):

| Hero | Headline | Guard |
|---|---|---|
| `WAYPOINT_REACHED` | "A milestone worth remembering." / "You moved your Chart forward." | requires ≥1 waypoint |
| `ANCHOR_COMPLETED_RELEASED` | "You completed a chapter." | requires both facts |
| `PRACTICE_WEEK` | "Steady work, all week." | requires ≥4 days |
| `STEADY` | "Small steps. Real movement." | requires ≥1 practice |
| `QUIET` | "A quiet week." | requires domain readable and nothing else |

"You made real progress this week." is permitted only when tier ≤ 6 **or** ≥4 practice days. Variants (2–3 per key) are chosen by `hash(userId + weekKey) mod n` so a week never changes wording on re-open.

### 7.5 Personalization limits

Allowed: Anchor intention text, waypoint/destination titles, counts, weekday names, Anchor category color.
Not allowed: inferred emotions or motives, growth/identity claims ("you're becoming…"), comparisons to other users, streak counts, loss framing, claims about Vision "updates", any number not derivable from the listed events.

### 7.6 Proposed view-model (what the server returns and freezes)

```ts
type WeeklyRecapV2 = {
  recapVersion: 2; templateVersion: number;
  weekKey: string;                 // 'YYYY-MM-DD' (local Monday)
  timeZone: string;                // IANA, captured at first generation
  range: { startKey: string; endKey: string; label: string };
  status: 'DRAFT' | 'FINAL'; provenance: 'LIVE' | 'RECONSTRUCTED';
  opening: { headline: string; summary: string };
  hero: Hero;                      // discriminated by `kind`
  stats: Array<{ id: 'PRACTICE_DAYS'|'PRACTICES'|'WAYPOINTS'|'COMPLETED'|'RELEASED'|'MILESTONES'; value: number; of?: number; sub?: string }>;
  motion: Array<{ dateKey: string; weekday: 0|1|2|3|4|5|6;
                  practices: Array<{ id: string; mode: string; anchorId: string }>;
                  markers: Array<{ kind: 'WAYPOINT'|'COMPLETED'|'RELEASED'|'VISION'|'MILESTONE'; dedupeKey: string }> }>;
  highlights: HighlightItem[];     // ≤3, hero excluded
  anchors: Array<{ anchorId: string; practiceDays: number; practices: number }>; // ≤4
  reflection: { templateId: string; text: string };
  refs: { anchors: Record<string, { intention: string; categoryKey: string; isReleased: boolean }>;
          charts: Record<string, { categoryKey: string; destination: string; waypointTotal: number }> };
  dataQuality: { missing: Array<'PRACTICE'|'CHART'|'ANCHOR_LIFECYCLE'|'MILESTONES'|'VISION'> };
};
```

`nextMove` is intentionally **not** part of the frozen model (it is live). All entity text is frozen into `refs`; art is referenced by id and resolved at view time.

---

## 8. Required Backend Changes

### 8.1 Aggregation service — **BUILD**

`backend/src/services/v2/WeeklyRecapService.ts` (+ pure `backend/src/domain/v2/weeklyRecap.ts`).

```
buildRecap({ userId, weekKey, timeZone, now }) →
  1. bounds  = [localMidnight(weekKey), localMidnight(weekKey + 7d))   // half-open, DST-safe
  2. parallel, all userId-scoped and range-bounded:
       practice   : PracticeSession (completedAt widened ±14h, then filter localDateKey ∈ week keys)
       gapBefore  : latest PracticeSession.completedAt < start
       waypoints  : Waypoint reachedAt∈range, not cancelled/skipped, Course.deletedAt null, + Course(anchorId,status,routeScope,completedAt)
       completions: Anchor intentionCompletedAt ∈ range
       releases   : Anchor releasedAt ∈ range
       milestones : AnchorMilestone earnedAt ∈ range   (READ ONLY — no reconcile, see below)
       vision     : Vision firstCommittedAt/boardCompletedAt ∈ range; VisionView count by localDateKey
       anchors    : identity + category + isReleased for every anchorId referenced (archived included)
  3. candidates = normalize + dedupe(§3.2)
  4. hero = select(candidates); stats; motion; highlights; anchors; reflection(template)
  5. mark dataQuality.missing for any domain whose query failed (never coerce failure to 0)
```

- **Reuse** `resolveLocalDateKeyFromDate` (`ThreadStrengthService.ts:53`) and the Vision service's `normalizeTimeZone` / `computeLocalDateKey` (`VisionService.ts:1089-1119`) for zone handling — **REUSE**, do not write a third implementation.
- **Milestones are read-only here.** `GET /anchors/:id/milestones` reconciles (writes). The recap must not trigger writes during a GET. Because waypoint, completion, release and practice facts come from their **source tables**, a not-yet-reconciled milestone simply does not label an event; nothing is lost. (If product wants labels guaranteed, run `milestoneService.reconcileAndList` as a separate finalize-time step, **DECISION D-7**.)
- **Thread/Consistency is excluded from v1** of the recap. `calculateStrengthAtDate` could supply per-Anchor start→end values later (`ThreadStrengthService.ts:583`, already used for `delta7d` at `:525-535`), but its `restDays` input must be sourced correctly first. **[A]** — I did not trace where `restDays` comes from for existing callers.
- **Indexes**: existing indexes cover the needed access paths — `practice_sessions(userId, completedAt)`, `anchors(userId, intentionCompletedAt)` and `(userId, releasedAt)` (`schema.prisma:207-208`), `anchor_milestones(userId, anchorId, earnedAt)`, `waypoints(courseId, reachedAt)`. `waypoints` has no `(userId, reachedAt)`; per-user volume is small, so no new index in v1; revisit if the query shows in traces. **[A]** on volumes.

### 8.2 Schema migration — **MODIFY** (additive, reversible)

Migration is needed, and small. It fixes D1/D2 by giving "global" a real key and giving weeks a timezone-safe identity.

```sql
ALTER TABLE "weekly_insight_snapshots"
  ADD COLUMN "scope_key"      TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN "week_key"       TEXT,                       -- 'YYYY-MM-DD' local Monday; NULL for legacy rows
  ADD COLUMN "time_zone"      TEXT,
  ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1, -- 1 = legacy client-authored, 2 = server recap
  ADD COLUMN "status"         TEXT NOT NULL DEFAULT 'FINAL', -- 'DRAFT' | 'FINAL'
  ADD COLUMN "finalized_at"   TIMESTAMP(3),
  ADD COLUMN "provenance"     TEXT NOT NULL DEFAULT 'LIVE';  -- 'LIVE' | 'RECONSTRUCTED'

UPDATE "weekly_insight_snapshots" SET "scope_key" = COALESCE("anchor_id", 'GLOBAL');

-- NULL week_key (legacy) rows are distinct in Postgres, so this only constrains v2 rows.
CREATE UNIQUE INDEX "weekly_insight_snapshots_user_scope_week_key_key"
  ON "weekly_insight_snapshots"("user_id", "scope_key", "week_key");
```

Prisma model gains the same fields plus `@@unique([userId, scopeKey, weekKey])`. The **existing** `(user_id, anchor_id, week_start)` unique and all existing rows stay untouched. Rollback = drop the new index and columns. Do **not** attempt to dedupe legacy rows in this migration (D1 may already have produced duplicate global rows; they remain legacy-readable).

New *feature data* does not need new tables: milestones, ledger and practice stay as they are. No event table is added (§3.1).

### 8.3 Endpoints — **BUILD** / **MODIFY**

| Endpoint | Purpose | Notes |
|---|---|---|
| `GET /api/v2/weekly-recap/latest?timeZone=` **BUILD** | Server picks the right week and returns the recap | Client no longer decides the week (fixes D3). Applies the lifecycle in §8.4 |
| `GET /api/v2/weekly-recap/:weekKey?timeZone=` **BUILD** | A specific past week | Never-opened old week → `RECONSTRUCTED`, finalized immediately |
| `GET /api/v2/weekly-recaps?cursor=&limit=` **BUILD** | Light history list (id, weekKey, range label, heroKind, headline, status, schemaVersion) | Replaces shipping up to 52 full JSON blobs (`weeklyInsightRoutes.ts:13-17`) |
| `POST /api/v2/weekly-insights/:snapshotId/feedback` **REUSE** | Same route/validation | Keep path for old clients; add analytics event |
| `GET /api/v2/weekly-insights` **MODIFY** (legacy) | Keep for shipped builds | Map `scopeKey` for the null-anchor case; return only schema_version 1 |
| `POST /api/v2/weekly-insights` **MODIFY → deprecate** | Client-authored writes | Reject `recapVersion: 2` payloads; remove after minimum app version moves |

Requirements: reuse `authMiddleware` + `getAuthenticatedUserId` (`routes/v2/authHelper.ts`); rate-limit like `thread.ts` (`express-rate-limit`, per-uid key); validate `weekKey` (`YYYY-MM-DD`, must be a Monday) and `timeZone` (IANA via `normalizeTimeZone`); reject future weeks; send `Server-Timing` like `recommendationRoutes.ts:253` for observability.

### 8.4 Snapshot lifecycle and historical accuracy — **DECISION D-1** (recommendation below)

| State | When | Behavior |
|---|---|---|
| **DRAFT** | From the review-window opening (Sunday 19:00 local) until Tuesday 12:00 local | Recomputed on every open (cheap); same row id, so feedback is stable. UI labels nothing special except "so far" if before Monday 00:00 |
| **FINAL** | First read after Tuesday 12:00 local (lazy finalization) | `status=FINAL`, `finalized_at` set, **immutable** (`update: {}` semantics kept for FINAL). Contains the late-synced offline practice that arrived during the window |
| **RECONSTRUCTED** | Never-opened older week requested | Built only from durable timestamped sources (no ledger, no Thread). Stored `FINAL`, `provenance=RECONSTRUCTED`. Quiet "Rebuilt from your history" footnote |

Why: it fixes D3 (freeze at 19:00 before the week ends), absorbs offline sync lag, and still guarantees that **a recap viewed months later reads exactly as it did** — the finalized JSON is displayed as-is, never recomputed.

Alternative (simpler): open at Monday 00:00 and finalize immediately — loses the Sunday-evening review moment from the locked spec and under-counts late sync. Not recommended.

Why lazy rather than a cron job: no user timezone is stored server-side (§3), so a scheduler cannot know when "Tuesday 12:00 local" is. Lazy finalization on first read uses the timezone supplied with the request, then captured in `time_zone`.

### 8.5 AI reflection architecture — **DECISION D-3** (deferred)

v1 ships template-only (§5.G), so **no backend AI work**. If v2 is approved: a finalize-time job calls the existing Gemini path (`GeminiImageService`-style provider layer, `chartModelProviders.ts`) with structured facts only; output JSON-schema-validated against allowed fact IDs; any failure keeps the template text; cost bounded to one call per finalized recap; consent-gated per `Reflection.aiConsentGrantedAt`.

### 8.6 Backend tests — **BUILD** (none exist, D9)

- Unit: `selectHero` golden cases for every tier, tie-break, composite, destination-suppresses-final-waypoint, dedupe by `dedupeKey`.
- Unit: week bounds across DST, year boundary, non-UTC zones.
- Integration (real Postgres, per `VisionService.integration.test.ts` pattern): global snapshot create/replay (D1 regression), FINAL immutability, DRAFT→FINAL, RECONSTRUCTED, ownership isolation between users.
- Contract: response matches `WeeklyRecapV2` (zod schema shared with mobile if the repo allows, else duplicated with a test that diffs them).

---

## 9. Required Frontend Changes

### 9.1 Component plan

Boundary rule: new code lives under the `v2` directories; `scripts/check-v2-import-boundary.mjs` forbids non-v2 production folders (`components`, `screens`, `theme`, `navigation` outside `v2`) from importing v2 code. v2 → non-v2 imports are allowed. Note the check already fails on the current tree (D11), so the gate for this work is "no new violations".

| Piece | Path | Action |
|---|---|---|
| Container screen | `screens/v2/weeklyInsight/V2WeeklyInsightScreen.tsx` | **MODIFY**: becomes a thin container (loading / error / offline / empty / content). Keep route name `V2WeeklyInsight` and params; add `weekKey?`, `focusAnchorId?`, keep `snapshotId?`, deprecate `anchorId`/`weekOffset` |
| Data hook + store | `hooks/v2/weeklyInsight/useWeeklyRecap.ts` + small zustand store | **BUILD**. App uses zustand + AsyncStorage + `encryptedPersistStorage` and has no react-query/SWR (`package.json`); follow the `courseLogStore` pattern (cache → refresh → offline flag) |
| API client | `adapters/v2/weeklyInsight/weeklyRecapApi.ts` | **BUILD** (replaces `weeklyInsightApiAdapter.ts` for v2; keep legacy file for v1 reads) |
| View-model types | `adapters/v2/weeklyInsight/recapTypes.ts` | **BUILD** (mirror §7.6) |
| Legacy renderer | `components/v2/weeklyInsight/LegacySnapshotView.tsx` | **BUILD**: renders schema-v1 snapshots from history using the *existing* section components |
| Sections | `components/v2/weeklyInsight/recap/{RecapOpening,RecapHero,RecapStats,RecapMotionStrip,RecapDaySheet,RecapHighlights,RecapAnchors,RecapReflection,RecapNextMove,RecapFooter}.tsx` | **BUILD** |
| Hero variants | `RecapHero` → `ChartMomentHero`, `AnchorMomentHero`, `TypographicHero` | **BUILD** |
| Chart crop at a moment | extend `components/chart/ChartMapCrop.tsx` or add a v2 wrapper | **MODIFY** (see §11) |
| History drawer | `WeeklyHistoryDrawer.tsx` | **MODIFY**: consume the light list; paginate |
| Feedback | `WeeklyFeedbackWidget.tsx` | **REUSE** |
| Activity disclosure | `WeeklyActivityDisclosure.tsx` | **MODIFY**: drop thread sparkline; build from `motion`/`stats` |
| Empty state | `WeeklyInsightEmptyState.tsx` | **MODIFY** copy |
| Motion wrappers | `components/v2/motion/{Reveal,ArrivalScope,ContentSwap}` | **REUSE** |
| Retire from live path | `weeklyInsightFactsBuilder.ts`, `weeklyInsightSelector.ts`, `useWeeklyInsight.ts` | Keep until legacy snapshots no longer need them, then remove (Phase 6) |

### 9.2 Navigation destinations (existing routes, `navigation/v2/types.ts`)

| Tap target | Route | Params |
|---|---|---|
| Hero / highlight: waypoint or destination | `V2Chart` (or `V2ChartWaypoint`) | `{ anchorId, courseId }` / `{ anchorId, waypointId }` |
| Anchor completed / released / strength milestone | `V2Progress` (milestone: `V2MilestoneDetail`) | `{ anchorId }` / `{ anchorId, definitionId }` — released Anchors must open in a read-only archive view **[A]**: confirm `V2Progress` handles a released Anchor |
| Vision milestone | `V2Vision` | `{ anchorId }` |
| Next Move (practice) | `V2PracticePrepare` | `{ anchorId, mode }` from the recommendation action |
| Next Move (chart) | `V2Chart` | `{ anchorId, courseId }` |
| Quiet / fallback | Home | — |

Rule: a destination whose target no longer exists (Course deleted, Anchor removed) renders the row **non-tappable** with its frozen text; it never navigates to a dead screen.

### 9.3 Loading, caching, offline

- **FINAL recaps are cached forever** per `accountId + weekKey` (encrypted, like `courseLogStore`'s account-scoped cache). Offline viewing of any previously opened final week works with no network.
- **DRAFT**: show cache immediately, refresh in background; if offline, show cached with a quiet "Updated earlier" label.
- First load with no cache and no network: a calm error state with retry (never the first-week empty state — that would be a false claim).
- Skeleton: reuse `Shimmer` (`components/v2/motion/Shimmer.tsx`) for hero + 3 rows; no layout shift when content lands (fixed hero height per variant).

### 9.4 Incremental migration from today's screen

1. Ship the backend (Phases 1–2) with **no UI change**.
2. Add `useWeeklyRecap` and the new sections behind a flag (`weeklyInsightV2`); old screen remains default.
3. Flip for internal builds; validate against real accounts.
4. Flip for all; old snapshots render via `LegacySnapshotView`.
5. Remove client facts builder/selector and the legacy POST.
Per-Anchor Progress is untouched throughout, except relabelling/linking the card (D-2).

---

## 10. Edge Cases and Historical Accuracy

The governing principle: **a FINAL recap is a document, not a query.** Once finalized it is displayed as stored. Anything that must stay true later (names, titles, counts, dates) is frozen in the snapshot; only artwork and navigation targets resolve live.

| # | Scenario | Explicit behavior |
|---|---|---|
| 1 | **New user, no activity** | No snapshot is created. Server returns an `EMPTY` state; the screen shows `WeeklyInsightEmptyState` ("Your first Weekly Insight arrives after your first full week"). A first partial week (account created mid-week) produces a recap only if ≥1 verified event exists. Today's rule (`sessions.length === 0 && anchors.length === 0`, `useWeeklyInsight.ts:128-131`) wrongly lumps "has an Anchor, no practice" into the generic empty path |
| 2 | **One Anchor** | Section F hidden; copy says "your Anchor"; stats/hero unchanged |
| 3 | **Several Anchors** | F ≤4 rows, highlights ≤3; overflow in the activity disclosure; "+N more" row |
| 4 | **Practice, no milestones** | Hero `PRACTICE_WEEK` (≥4 days) or `STEADY`; stats = practice days + practices; highlights omitted or one rollup row |
| 5 | **Several milestones** | One hero per §7.3; ≤3 highlights; remainder counted in a "+N more this week" row that opens the activity disclosure |
| 6 | **Anchor completed in week** | Hero `ANCHOR_COMPLETED`; Anchor stays active; Next Move uses the existing recommendation (an `intention_completed` completion signal exists in `domain/v2/recommendation.ts`, which should surface the Release action — **[A]**, confirm in `RecommendationService`) |
| 7 | **Released after completion** | Completion week shows "Intention completed". Release week shows "Released", with a line "Completed <date>" from the preserved `intentionCompletedAt` (it is never cleared). Same week → one composite hero. Release copy never says deleted/removed |
| 8 | **Anchor archived/removed (delete route)** | No celebratory event (§7.1). Earlier frozen recaps keep its name and practice. In new recaps its prior-week practice still counts. If its identity can no longer be opened, the row is non-tappable with frozen text |
| 9 | **Missing / partially migrated data** | Pre-2.0 Charts without `anchorId`: include waypoint events from `Waypoint.reachedAt` (the ledger skips them, `CourseService.ts:252-255`) with a neutral tile and the destination text. Sessions with null `anchorId` resolve via `anchorServerIdSnapshot`; if unresolved they still count in totals and show as "an earlier Anchor". **If any domain query fails, do not finalize**: return DRAFT with `dataQuality.missing`, omit that section, never print 0 |
| 10 | **Older week viewed months later** | Stored FINAL JSON rendered as-is. No Next Move (or a "Back to today" action). Navigation targets are checked for existence at tap time |
| 11 | **Week spans two months / two years** | Week identity is the Monday `weekKey`. Label shows both months; shows years when crossing a year boundary or outside the current year (`formatWeekDateRange` needs this, it ignores years today) |
| 12 | **Timezone change / date boundary** | Zone is **locked at first generation** and stored on the row. Practice membership uses each session's own `localDateKey` (device-local at completion), so travel does not move a practice into another day. Timestamp events are converted with the locked zone. Intervals are **half-open** `[Monday 00:00, next Monday 00:00)` computed from local midnights, so DST weeks (23/25-hour days) still have exactly 7 days and the `23:59:59.999` end-of-week hack (`weeklyReviewWindow.ts:96-101`) disappears |
| 13 | **Offline / failed request** | Previously opened FINAL: renders from the encrypted cache, no network. DRAFT: cached copy with a quiet "Updated earlier" note. No cache + no network: error state with Retry — **never** the empty state (that would be a false statement about the user's week) |
| 14 | **Loading, error, empty states** | Loading: skeleton with fixed hero height (no layout shift). Error: calm message + Retry. Empty: first-week copy. Partial: sections omitted, never zero-filled |
| 15 | **Long Anchor names / large text** | Rows `numberOfLines=2`, hero 3; the accessibility label always has the full text; stat tiles reflow to a vertical list at font scale ≥1.3; the motion strip becomes a day-by-day list at ≥1.6 |
| 16 | **Older devices / reduced motion** | One `ChartMap` instance max (hero), mounted after first paint with a same-size placeholder; row art is a lightweight tile, not a map. Reduced motion (the in-app setting via `useV2ReduceMotion`) = ≤180 ms crossfade, no route draw, no haptic flourish |
| 17 | **Underlying data changes after viewing** | FINAL is immutable (§8.4). Changed Anchor intention text, deleted Charts, renamed waypoints do not alter a finalized recap. Known limitation: artwork resolves live, so a re-edited sigil could render differently; archived Anchors do not change |

### 10.1 Never-opened weeks (RECONSTRUCTED)

Built only from durable timestamped sources: practice, `Waypoint.reachedAt`, `intentionCompletedAt`, `releasedAt`, `AnchorMilestone.earnedAt`, `Vision.firstCommittedAt/boardCompletedAt`. Excluded: ledger, Thread values, `updatedAt`-based anything. A quiet footnote says it was rebuilt. **DECISION D-10:** build on demand (recommended) vs show a gap.

### 10.2 Frozen vs live

| Frozen into the recap | Resolved live at view time |
|---|---|
| Anchor intention text, category key | Anchor artwork (sigil, `enhancedImageUrl`) |
| Waypoint title, destination text, `waypointIndex/Total`, reached-ids as of week end | Chart map rendering (deterministic from frozen numbers) |
| Counts, dates, hero choice, headline, reflection text | Vision image URLs (fetched fresh by asset id; fall back to Anchor art if archived) |
| Hero event refs and dedupe keys | Next Move (latest week only) |

---

## 11. Performance, Accessibility, and Motion

### 11.1 Hero animation — recommended sequence

Budget: **≤ 1.1 s total, once per snapshot per device, no layout shift, never blocks reading.** Built entirely from existing motion tokens (`AnchorMotion`: `standard 280`, `expressive 420`, `easing.emphasized`, `stagger`, `rise 14`).

**Chart waypoint (code, REUSE + MODIFY)**

1. 0–280 ms: hero panel arrives with the existing `Reveal` (order 1). The Chart map is already at the *previous* waypoint's state.
2. ~200–900 ms: the route draws from the previous waypoint to the reached one by animating `revealArc` (and `coverArc`) from `placement.arcs[prev]` to `placement.arcs[reached]` with `withTiming(..., { duration: 700, easing: AnchorMotion.easing.emphasized })` — the shared values already exist in `useChartMapAnimState` and are what `ChartMapCrop` currently sets *statically* (`ChartMapCrop.tsx`, `useLayoutEffect`).
3. On arrival: the reached marker resolves (`flagOpacity` / marker state `current → done`) — the existing map vocabulary, not new ornament. One `v2Haptics.completion()`.
4. +120 ms: title/subtitle line fades in under the map ("Waypoint 2 of 5").

Requirements: `ChartMapCrop` hard-codes `reducedMotion` and static values today, so add an `animate`/`fromWaypointIndex` prop (**MODIFY**) rather than forking the map. Gold: the single `goldDot`/marker in the map (already `CHART_MAP_GOLD`), nothing else on the hero is gold except a 1 px rule.

**Completed Anchor (code, REUSE)**

- The actual sigil (`CircularAnchorRenderer`/`anchorArtworkSvg`) sits in a category-wash tile. Over `expressive 420 ms`: opacity 0.85→1 and scale 0.98→1. +120 ms: "Completed · <date>" fades in. No confetti, no flash, no ring burst, no strobing. Release uses the same treatment with a calmer 280 ms and different copy; it must read as *closing a chapter*, not a deletion.

**Play-once rule:** persist `seenRecapHero:<snapshotId>` locally; replays render the final state statically. First view only: haptic + animation.

**Reduced motion / low power:** no route draw, ≤180 ms crossfade (the `useEntrance` reduced path), no haptic flourish. Detection uses the existing in-app setting (`useV2ReduceMotion`), consistent with `Reveal`.

### 11.2 What is code vs. image assets

| Element | Implementation |
|---|---|
| Chart map, route, markers, weather | Code (existing `ChartMap` family); category art already exists in the app (`CHART_PACKS`) — no new bitmaps |
| Anchor sigil | SVG via existing renderer (+ `enhancedImageUrl` when the Anchor has one) |
| Hero background | Ink fill + optional `expo-linear-gradient` wash tinted by category — no image |
| Motion-strip glyphs | Inline SVG / lucide icons (`Flag`, `Check`, etc.) |
| Vision photo (rare hero) | User asset, fetched by id, `expo-image`/`Image` with fixed aspect |
| Headline typeface | **DECISION D-8**: bundle a serif (new font asset + load gating) or use Inter display |
| Gold token | **DECISION D-9**: one `colors.gold` |

### 11.3 Performance

- **One map instance.** `ChartMap` is the heavy piece (textured weather, cloud tiles; see `components/v2/chart/map/*`). Mount it lazily after first paint; rows never mount a second map. Before adding any new animated map surface, follow `DEVICE_PROFILING_GUIDE.md` / `PERFORMANCE_BASELINE.md` (repo root) on a real device; `CLAUDE.md` already notes Skia changes need device testing, not just Jest.
- **Server**: ~8 indexed, bounded queries in parallel (§8.1); target p95 < 400 ms for a heavy account (proposal, **[A]**). DRAFT responses `Cache-Control: private, max-age=60`; FINAL is immutable, cacheable indefinitely.
- **Payload**: history list is light (§8.3); full recap ~4–8 KB.
- **Client**: single store subscription, memoized sections, no per-frame JS work (all motion on the UI thread via Reanimated shared values).

### 11.4 Accessibility

- Every interactive element ≥44×44 pt; day columns and rows have `accessibilityRole="button"` and composed labels ("Friday: 2 practices, waypoint reached. Opens details.").
- Hero is one accessible element with the full sentence; the decorative map/sigil is hidden from the tree (as `ChartMapCrop` already does).
- Text contrast ≥4.5:1: gold is never text on cream (2.01:1); use ink or `getCategoryTextColor`.
- Information never relies on color alone: glyph + label for every marker.
- Dynamic Type to 200%: reflow rules in §10 case 15; no clipped or overlapping text.
- Reading order = visual order; day sheet traps focus and returns it on close.
- Motion respects the in-app reduce-motion setting; no flashing; no content only reachable by animation.

### 11.5 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chart map cost on low-end Android | Medium | Jank on hero | Lazy mount, placeholder, static fallback, profile on baseline device |
| Serif font load causes flash | Medium | Layout shift | Gate render on font ready or use Inter display (D-8) |
| Server query time grows with history | Low | Slow open | Bounded ranges + indexes; DRAFT cache; FINAL frozen |
| Legacy snapshot rendering regressions | Medium | Crash on old rows | `LegacySnapshotView` + fixtures from real old rows |

---

## 12. Implementation Phases

Ordered, with dependencies. Sizes are relative (**S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ 2+ weeks); treat as estimates, not commitments **[A]**.

| Phase | Scope | Depends on | Size | Exit criteria |
|---|---|---|---|---|
| **0 — Stabilize V1** *(only if V1 stays live during the build)* | Fix D1 (null scope), D2 (match by id not label), D3 (don't finalize before week end), D4 (`releasedAt` not `archivedAt`), add route tests (D9) | — | S | Regression tests pass; no silent persistence failure |
| **1 — Contracts & domain** | `WeeklyRecapV2` types, hero ladder, tie-breaks, dedupe, templates, golden tests; **no DB** | Decisions D-1, D-4 | M | Determinism + reconciliation tests green |
| **2 — Backend** | Migration (§8.2), `WeeklyRecapService`, endpoints (§8.3), lifecycle (§8.4), rate limits, integration tests | 1 | M–L | Contract + integration tests green on real Postgres |
| **3 — Mobile data layer** | `useWeeklyRecap`, store + encrypted cache, API client, `LegacySnapshotView`, flag `weeklyInsightV2` | 2 | M | Offline/cached/error states pass; old screen still default |
| **4 — Static UI** | All sections (§5) with real data, no animation, nav wiring, empty/error states | 3, D-8/D-9 | L | UI tests + a11y checks pass |
| **5 — Hero art & motion** | Chart-moment crop (`animate` prop), Anchor completion treatment, play-once, reduced motion, device profiling | 4 | M | Device profile within budget; reduced-motion verified |
| **6 — Rollout & cleanup** | Internal flag-on → all; relink Progress card (D-2); retire client builder/selector and legacy POST (after min app version, D-13) | 5 | S–M | No v1 writers; Progress unchanged |
| **7 — Optional** | AI reflection polish (D-3); Thread delta per Anchor | 6 | M | Only if approved |

Critical path: 1 → 2 → 3 → 4 → 5. Phase 1 can start immediately and needs no schema change.

---

## 13. Testing and Acceptance Criteria

Pass/fail unless noted. Targets marked *(proposal)* are for approval.

### 13.1 Backend

| ID | Criterion |
|---|---|
| AC-01 | **Reconciliation:** for any generated recap, every stat equals the count of unique `dedupeKey`s among the events listed in hero + motion + highlights + activity |
| AC-02 | **Determinism:** identical fixtures produce byte-identical JSON across 100 runs and across two server processes |
| AC-03 | **No double count:** one waypoint reach yields exactly one candidate whether or not the ledger row, `CourseEvent`, or milestone exist; same for practice (`PracticeSession` + movement + ledger + milestone) |
| AC-04 | **Release ≠ archive:** an Anchor archived through `DELETE /api/anchors/:id` (no `releasedAt`) yields no release event |
| AC-05 | **Complete + release:** same week → one composite hero; different weeks → each recap has the correct hero and the release recap shows the preserved completion date |
| AC-06 | **Immutability:** after FINAL, mutating Anchor text, deleting a Chart, or adding late practice leaves the returned JSON hash unchanged |
| AC-07 | **Lifecycle boundary:** DRAFT at Tue 11:59:59 local, FINAL at 12:00:00 (tested in two zones) |
| AC-08 | **DST:** a DST-change week has 7 local days; a 23:30 Sunday session lands in that week; a 00:30 Monday session lands in the next |
| AC-09 | **Year boundary:** `Dec 29 – Jan 4` label and membership correct |
| AC-10 | **Concurrency:** two simultaneous first reads create exactly one row; global scope no longer fails on null (D1 regression) |
| AC-11 | **Partial failure:** a failing domain query never produces a FINAL row; `dataQuality.missing` is set; no zero-fill |
| AC-12 | **Ownership:** user B cannot read/feedback user A's recap (404) |
| AC-13 | **Validation:** non-Monday `weekKey`, invalid zone, future week → 400 |
| AC-14 | **Perf** *(proposal)*: p95 < 400 ms at 100 sessions + 20 events in the week |

### 13.2 Copy and content

| ID | Criterion |
|---|---|
| AC-15 | Every reflection/summary sentence maps to ≥1 fact slot; a template with no slot fails the test |
| AC-16 | Quiet-week copy contains no "0 progress", shame, or streak vocabulary (lint word list) |
| AC-17 | No sentence claims Vision "updates", Thread movement, or causal/psychological interpretation |
| AC-18 | Release copy never contains "delete/removed" |

### 13.3 Mobile

| ID | Criterion |
|---|---|
| AC-19 | Each tappable row navigates to the route/params in §9.2; a dead target is non-tappable |
| AC-20 | Airplane mode: a previously opened FINAL renders fully; a never-opened week shows the error state, **not** the empty state |
| AC-21 | Legacy v1 snapshot opens in `LegacySnapshotView` without crash (fixtures from real old rows) |
| AC-22 | Feedback set/change persists; one analytics event per change; screen state matches server |
| AC-23 | A11y: all targets ≥44 pt; labels present; at font scale 2.0 no clipped or overlapping text; all text ≥4.5:1 |
| AC-24 | Reduced motion: no transform/route animation; ≤180 ms fade; no haptic flourish |
| AC-25 | Gold budget: snapshot test asserts ≤2 gold elements and none as text on cream |
| AC-26 | At most one `ChartMap` mounted; hero shows a same-size placeholder before mount (no layout shift) |
| AC-27 | **Device check** (manual, per `CLAUDE.md`): hero animation profiled on a baseline Android and an iPhone; no dropped-frame regressions vs `PERFORMANCE_BASELINE.md` |

### 13.4 Regression guards

| ID | Criterion |
|---|---|
| AC-28 | `npx tsc --noEmit` (strict) passes in mobile; backend `type-check` and `lint` pass; `npm run test:v2-boundary` reports **no new violations** versus the baseline (it already fails with 37 files today, D11) |
| AC-29 | Existing per-Anchor Progress tests (`V2ProgressScreen.test.tsx` etc.) pass unchanged; the Progress card still opens Weekly Insight |
| AC-30 | Coverage thresholds in `CLAUDE.md` (70% statements/lines, 60% branches) still met |

Test layers: pure unit (domain), backend integration on real Postgres (follow `VisionService.integration.test.ts`), React Native Testing Library per section, one end-to-end happy path, and the manual device pass.

---

## 14. Open Decisions

| ID | Decision | Options | **Recommendation** |
|---|---|---|---|
| **D-1** | Recap lifecycle | (a) DRAFT from Sun 19:00, FINAL at Tue 12:00; (b) available Mon 00:00, final immediately | **(a)** — keeps the locked review moment, fixes the early-freeze (D3), absorbs offline sync lag |
| **D-2** | Progress "Weekly Insight" card | (a) Link to global recap with `focusAnchorId`, relabel text; (b) keep as is | **(a)** — removes the two-engine mismatch (D8) |
| **D-3** | Weekly reflection engine | (a) template only; (b) template + AI polish; (c) AI | **(a) for v1**; (b) later, consent-gated, finalize-time only |
| **D-4** | Hero order: waypoint vs strength stage | (a) waypoint above stage; (b) existing table (stage above waypoint) | **(a)** — Chart is the "Move" behavior; Progress already celebrates stages immediately |
| **D-5** | Show Thread/Consistency in the recap | (a) not in v1; (b) per-Anchor start→end | **(a)** — needs `restDays` sourcing verified and an "unavailable" state |
| **D-6** | Follow-up on "Not really" | (a) none; (b) one optional chip row | **(a)** for v1; revisit with data |
| **D-7** | Reconcile milestones at finalize | (a) yes, non-blocking; (b) never | **(a)** — labels complete, no writes on GET |
| **D-8** | Serif display font | (a) bundle serif; (b) Inter display | Product call; **(b)** is zero-risk, **(a)** matches the mockup |
| **D-9** | Gold token | One `colors.gold` = `#E0A038` vs keeping three | Unify (alias the other two) |
| **D-10** | Never-opened old weeks | (a) reconstruct on demand; (b) show gap | **(a)** with the "rebuilt" footnote |
| **D-11** | Vocabulary | "Anchor completed" (mockup) vs the app's existing "Intention completed" (`V2_THREAD_EVENT_LABELS`) | Use the existing app vocabulary |
| **D-12** | Weekly notification | Currently has no verified deep link to the screen and `weeklyRecapEnabled` defaults off | Out of scope for this blueprint; decide whether Phase 6 wires the tap to `V2WeeklyInsight` |
| **D-13** | Minimum app version to drop legacy `POST /weekly-insights` | — | Set after the flag-on rollout |

---

## Appendix A — Key references (verified)

| Topic | Location |
|---|---|
| Snapshot routes (GET/POST/feedback) | `backend/src/api/routes/v2/weeklyInsightRoutes.ts:9-25, 26-54, 55-74` |
| Snapshot model / migration | `backend/prisma/schema.prisma:270-288`; `backend/prisma/migrations/20260909000000_add_v2_release_thread_events_weekly_insights/migration.sql` |
| Ledger model & read route | `schema.prisma:215-238`; `backend/src/api/routes/v2/threadEvents.ts:20-56` |
| Ledger writers | `services/v2/ThreadStrengthService.ts:408-423`; `services/v2/AnchorReleaseService.ts:98-113`; `services/CourseService.ts:242-272, 1136-1166, 1198-1225`; `services/chart/ChartService.ts:636-646` |
| Release / completion | `services/v2/AnchorReleaseService.ts:31-113`; `services/v2/IntentionCompletionService.ts:41-60`; delete-archives: `api/routes/anchors.ts:1197-1233` |
| One active Chart per user | `services/CourseService.ts:476-479` |
| Practice model / API | `schema.prisma:444-488`; `api/routes/practice.ts:109, 566-594` |
| Thread strength history | `services/v2/ThreadStrengthService.ts:525-535, 583-640`; `ThreadV2Movement` `schema.prisma:350-366` |
| Milestones | `schema.prisma:290-313`; `services/v2/milestones/registry.ts` |
| Vision events | `schema.prisma:1030-1070, 1253-1268`; `services/v2/VisionService.ts:269-369, 1089-1119` |
| Recommendation | `services/v2/RecommendationService.ts`; `domain/v2/recommendation.ts`; `api/routes/v2/recommendationRoutes.ts` |
| Mobile screen / hook / builder | `screens/v2/weeklyInsight/V2WeeklyInsightScreen.tsx`; `hooks/v2/weeklyInsight/useWeeklyInsight.ts:88-114, 183-189`; `adapters/v2/weeklyInsight/weeklyInsightFactsBuilder.ts:78-324` |
| Week/window logic | `adapters/v2/weeklyInsight/weeklyReviewWindow.ts:25-45, 75-116` |
| Entry points | `screens/v2/home/dailyShell.tsx:109`; `screens/v2/progress/V2ProgressScreen.tsx:315`; `navigation/v2/AnchorV2Navigator.tsx:404, 512, 629` |
| Tokens / motion | `theme/v2/colors.ts`, `typography.ts`, `motion.ts`; `components/v2/motion/*`; `hooks/v2/haptics.ts` |
| Chart rendering | `components/chart/ChartMapCrop.tsx`; `components/v2/chart/ChartWorldPreview.tsx`; `components/v2/chart/map/*` |
| Import boundary | `scripts/check-v2-import-boundary.mjs` |

## Appendix B — Assumptions and items not verified

I read code and ran one read-only script (the import-boundary check). I did **not** run the app, the test suites, or any database. Treat these as open:

1. **[T] D1** — the `anchorId = null` upsert failure is inferred from Prisma's generated types and Postgres NULL semantics. Confirm with a real-DB test before relying on it.
2. **[A]** Whether `V2Progress` handles a *released* Anchor read-only (needed for hero/highlight navigation).
3. **[A]** Source of `restDays` for `ThreadStrengthService` callers (blocks any Thread delta in the recap).
4. **[A]** How complete the device `practiceHistory` is on a fresh device (the new design avoids the question by reading the server).
5. **[V]** I ran `scripts/check-v2-import-boundary.mjs` (read-only): it **fails today** with 37 files, including `components/chart/ChartMapCrop.tsx`. Reusing `ChartMapCrop` from new v2 code adds no new violation (v2 → non-v2 is the allowed direction), but the check cannot currently serve as a clean gate. Whether to repair the baseline is outside this blueprint.
6. **[A]** No code path found that routes a weekly-recap notification tap to the screen (grep-based).
7. **[A]** The two-copy-engine mismatch (D8) was established from code structure, not side-by-side rendering.
8. **[A]** Query volumes/latency targets are proposals; no profiling was done.
9. The previous implementation report (`ANCHOR_2_UI_J_WEEKLY_INSIGHT.md`) reports passing suites (44 weekly tests; 190 suites overall). I did not re-run the test suites and cite them only as that document's claim; its "boundary OK" claim is contradicted by item 5.
10. **[A]** `RecommendationService` behavior for a completed-but-not-released Anchor (edge case 6) was inferred from the signal types, not traced.

*End of audit. No implementation has been started; awaiting explicit approval and answers to §14.*
