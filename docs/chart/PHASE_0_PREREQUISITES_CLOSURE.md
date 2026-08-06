# Chart Phase 0 Prerequisites Closure

Status: remediation pass complete; implementation gate re-recorded below
Captured: 2026-08-05
Scope: closes the prerequisites listed in [`PHASE_0_GAP_REPORT.md`](PHASE_0_GAP_REPORT.md). Additive backend/contract changes and tests only. No Chart visual redesign was started, and no Chart screens or components were created.

## Executive summary

The backend Chart contract was already substantially implemented; what was missing was *proof*. This pass added 154 backend and 419 mobile focused tests that hold the frozen contract in place, closed the three real client-side gaps found during the audit, and corrected two defects that would have caused silent data loss.

Three prerequisites remain **partially closed** and seven decisions remain **blocked on product input** — one of them (D10) is a hard blocker that would stop a Course from progressing past its first waypoint. The Phase 0 decision is therefore **NO-GO**.

> **Update, 2026-08-05.** Two further passes have run since this summary was
> written. D10 was resolved from evidence and implemented
> ([`PHASE_0_D10_DECISION.md`](PHASE_0_D10_DECISION.md)); the behavioral half of
> D5 was closed and contract-tested; and D2b, D8, and D9 were confirmed from
> evidence ([`PHASE_0_CONFIRMATION_DECISIONS.md`](PHASE_0_CONFIRMATION_DECISIONS.md)).
> Three defects were corrected along the way: the mutation guards and the
> projection derived blocked-ness from different link selectors; the mobile store
> had no complete/skip/cancel actions, so those three mutations bypassed the
> offline/stale gate entirely; and the Chart analytics blocklist was never
> actually covered by a test despite being recorded as tested. The gate is still
> **NO-GO**, now on three product/design inputs only — see the
> [Phase 0 decision](#phase-0-decision) at the end of this document.

## Defects found and corrected

| # | Defect | Evidence | Correction |
|---|---|---|---|
| 1 | `CompleteSchema` accepted `reflection.body`, but `normalizeCompletionReflection()` discarded it and stored `body: null`. A client sending a freeform reflection got a `200` and lost the user's text. | [`waypoint-reached-ceremony`](phase-0-references/waypoint-reached-ceremony-1024x1000.png) shows exactly two structured prompts ("What helped you get here?", "What did you learn?") and no freeform field. | Removed `body` from the request schema in [`courses.ts`](../../backend/src/api/routes/courses.ts) and both `CompleteWaypointRequest` types. The route now returns `400 VALIDATION_ERROR` instead of silently dropping input. |
| 2 | `mutationUnavailable()` in [`courseStore.ts`](../../anchor/mobile/src/stores/courseStore.ts) did not gate on `stale`, so all 11 Course mutations could send an `expectedCourseVersion` read more than `CHART_STALE_AFTER_MS` ago. | Fixture matrix `stale` row: "All Course mutations disabled until fresh authoritative data." | Added the `stale` gate and a client-only `STALE` error code. This is the single chokepoint for every mutation, so one line closes all 11. |
| 3 | Chart practice sessions could not carry Course attribution at all: the mobile `PracticeEntrySource` union had no Chart values, and neither `startPractice()` nor `PracticeCompletionService` had a context field — so the backend's existing `course_id`/`waypoint_id` columns were unreachable from the client. | Gap report rows "Practice boundary" and "Practice completion". | Threaded a validated `ChartPracticeContext` through the entry boundary, route params, the encrypted retry queue, the server payload, and analytics. |

Two additional hardening changes were made because the gap report rates private-reflection leakage as a High risk:

- `SENSITIVE_PROPERTY_KEYS` in [`AnalyticsService.ts`](../../anchor/mobile/src/services/AnalyticsService.ts) now blocks `destination_text`, `destination`, `waypoint_title`, `reflection`, `reflection_body`, `structured_content`, `what_helped`, and `what_learned`. Chart analytics may emit opaque IDs only.
- `startPractice()` refuses `mode: 'release'` from a Chart source. Chart owns Course links and snapshots, not the Anchor life cycle, and the current-waypoint sheet offers only FOCUS / VISUALIZE / DEEP PRIME.

## Workstream A — API and backend prerequisites

All ten audited items are **closed**. Backend behavior was not redesigned; the additive changes were the `reflection.body` removal (defect 1) and new tests.

| Prerequisite | Status | Evidence |
|---|---|---|
| Course and Waypoint response shapes | closed | `CourseServiceContract.test.ts` pins the exact key sets of `CourseDetail` and `WaypointSummary`, ISO timestamp formats, and count consistency. |
| Derived Waypoint states | closed | Every state derived from its own timestamp plus the pointer; `DESTINATION` asserted never to appear as a `WaypointState`. |
| `Course.currentWaypointId` | closed | Exactly one derived `CURRENT`, always equal to the pointer; pointer cleared for non-ACTIVE courses; a corrupt pointer yields `needsRepair` and *no* derived `CURRENT`. |
| Completion idempotency and version checks | closed | Replay returns `replayed: true` with zero writes; a stale `expectedCourseVersion` returns `409 COURSE_VERSION_CONFLICT` with the refreshed course in `error.details.course`, and touches nothing. |
| Atomic completion plus reflection | closed | One `$transaction` covers the reach, the pointer advance, the `Reflection` row, `WAYPOINT_REACHED`, `REFLECTION_ADDED`, and `COURSE_COMPLETED`. Reflection and completion use separate idempotency keys. |
| Anchor-link and blocked-state behavior | closed | `ANCHOR_RELEASED` derivation with the historical snapshot retained; blocked waypoints refuse both complete and skip; the pointer never advances because an Anchor was burned. |
| Reflection routes | closed | `coursesContract.test.ts` covers create/update/soft-delete, flag and migration fail-closed, unknown sources, and that an update cannot re-bind a reflection's `courseId`. |
| Course Log pagination | closed | `take: limit + 1` for `hasMore`, cursor `skip: 1`, deterministic `[recordedAt desc, id desc]` ordering, soft-deleted reflections hidden while their event survives, and unapproved snapshot keys dropped. |
| PracticeSession Chart context fields | closed | Already implemented and covered by `practice.test.ts`; verified the columns are soft references with no foreign keys so practice history survives Course deletion. |
| Error codes and ownership checks | closed | Every read and mutation scoped by the authenticated `authUid`; a `userId` in a request body is rejected by the strict schemas; 401/404/409/422/403 codes pinned on the wire. |

Migration and rollback are covered by `chartMigration.test.ts` (21 tests): all Chart tables, enums, and the exact frozen `CourseEventType` set; the one-live-Course, one-active-link, unique-idempotency-key, and unique-position indexes; `ON DELETE SET NULL` for the Course pointer and for `anchor_id` (amendment A2); `chart_schema_version` defaulting to `0` so every existing account reads as `migrationRequired`; and a rollback that is idempotent, complete, and touches nothing outside Chart.

## Workstream B — Practice-entry prerequisites

| Prerequisite | Status | Notes |
|---|---|---|
| `PracticeEntrySource` supports `chart` and `chart_waypoint_detail` | closed | Added to the mobile union with a `PRACTICE_ENTRY_SOURCES` array asserted to match the backend list element-for-element, so a drift becomes a test failure rather than a runtime `400`. |
| Chart context includes `courseId`, `waypointId`, Course version | closed | `ChartPracticeContext` with a runtime validator. Context and source are inseparable in both directions: a Chart source without context is refused, and context from a non-Chart source is refused. |
| Context survives route construction | closed | Threaded into `ActivationRitual`, `Ritual`, `ChargeSetup`, and `VisualizePreparation` params. Non-Chart entries are byte-identical to before — asserted explicitly. |
| Context survives completion, retry queue, backend persistence | closed | Chart columns live on `PracticeSessionRecord`, so the encrypted offline queue replays them verbatim; a retry after an offline failure is asserted byte-identical on all three Chart fields, which is what lets the server's immutable-session check treat it as idempotent instead of a `409`. |
| Context survives analytics | closed | Opaque IDs only, and asserted to contain no intention, destination, or reflection text. Chart properties are omitted entirely for non-Chart sessions. |
| Paywall return targets are preserved | closed | Entitlement denial for focus, deep prime, and visualize all emit `resumeTarget: { kind: 'chart_waypoint', courseId, waypointId }`; the non-Chart `visualize_prepare` target is unchanged. No session route is constructed before entitlement succeeds. |
| Post-practice return lands on Chart | **partially closed** | The contract is frozen and tested as a pure resolver, [`practiceReturn.ts`](../../anchor/mobile/src/navigation/practiceReturn.ts): `returnTo: 'chart'` plus context resolves to the launching waypoint, falls back to Chart home without context, and falls back to Practice if Chart was disabled mid-session. **The five ritual completion screens do not yet call it.** Wiring them is Phase 1 production work and is currently untestable end-to-end because `WaypointDetailScreen` has no practice CTA to return to. |
| Reflection auto-presentation occurs only once when enabled | **partially closed** | No Chart reflection auto-presentation exists yet in any form. The once-only requirement cannot be verified against absent behavior; it depends on the waypoint-ceremony route, which the visual spec lists as a Phase 1 surface. |
| No parallel Chart Practice record | closed | Chart-launched sessions produce exactly one canonical `PracticeSession`; duplicate prevention, cross-account refusal, and single-navigation-call assertions all hold. Chart attribution is fail-closed: a malformed context or a non-Chart source stores null Chart columns rather than failing the completion. |

The three missing mobile client mutations named in the gap report — `completeWaypoint`, `skipWaypoint`, `cancelWaypoint` — were added to [`ChartApiClient.ts`](../../anchor/mobile/src/services/ChartApiClient.ts) along with the `CompleteWaypointRequest`/`CompleteWaypointResponse` types.

> **Correction, 2026-08-05.** Adding them to the client was not sufficient, and
> the row above overstated the closure. The three had no `courseStore` action, so
> nothing routed them through `mutationUnavailable()` — the single chokepoint
> that makes mutations fail closed offline, stale, migrating, needing repair, or
> flag-off. They are now store actions behind that gate, and the fixture-driven
> store test drives all three for every denied fixture. See
> [Anchor-link and blocked-state behavior](#anchor-link-and-blocked-state-behavior--closed-2026-08-05).

## Workstream C — State fixtures and contract verification

The fixture matrix is now executable: [`__fixtures__/phase0.ts`](../../anchor/mobile/src/screens/chart/__fixtures__/phase0.ts) with 21 fixtures (the 20 documented rows plus `reached-next-unlinked`, see D10), verified by 56 assertions in `phase0Fixtures.test.ts` and 12 in `courseStoreFixtures.test.ts` that drive the real store.

Covered: empty, loading, draft-setup, active-current, reached, reached-next-unlinked, current-blocked, upcoming, skipped, cancelled, completed, archived, stale, offline, entitlement-locked, network-error-cached, not-found, version-conflict, migration-required, repair-required, chart-disabled, plus unknown Course and Waypoint deep-link targets.

Each fixture is verified for visible controls and copy, allowed transitions, accessibility semantics (unique ordered positions, non-empty announceable titles, state carried as data rather than colour), analytics behavior, and expected navigation result. Cross-cutting invariants asserted across *all* fixtures: at most one `CURRENT`; `CURRENT` only where the pointer points; no terminal waypoint is current; the pointer is null for every non-ACTIVE course; `DESTINATION` is never a `WaypointState`; and reached counts match the waypoint states.

`courseStoreFixtures.test.ts` proves the matrix is enforced rather than merely documented — it drives the real `courseStore` with each fixture's state and asserts no network call escapes for any denied fixture, with the correct distinct error code for each reason.

Two fixture bugs were caught by these tests and fixed: an archived course cannot have a `CURRENT` waypoint (the pointer is cleared, so the former current derives back to `UPCOMING`), and a fixture with no `lastSyncedAt` must be `stale: true` because that is how the store derives staleness.

## Workstream D — UX prerequisite decisions

### Resolved from evidence

**D1 — Request/response schema and idempotency keys.** Resolved. Every transition takes `{ idempotencyKey, expectedCourseVersion }`. Server-side key scoping is `chart:waypoint-complete:<key>:reached`, `chart:reflection-added:<key>`, `chart:course-completed:<key>`, `chart:waypoint-transition:<key>` (skip), `chart:waypoint-cancelled:<key>`, `chart:anchor-link:<key>`, `chart:waypoint-unblocked:<key>`. Cancel accepts no `reason`; skip accepts an optional one. All now contract-tested.

**D2a — Is a waypoint completion reflection optional?** Resolved from the reference capture: both prompts render an `Optional` placeholder and a `Skip reflection` control is present. It is optional, structured-only, and exactly two fields. Blank-on-both creates no reflection and emits no `REFLECTION_ADDED`.

**D3 — Does the completion response include the next pointer, or must mobile refetch?** Resolved. The response is authoritative and complete for the Course: refreshed `CourseSummary`, both waypoint summaries, the new pointer, `courseCompleted`, `completionEventId`, `replayed`, and an optional `reflectionId`. A `200` needs **no** Course refetch. It contains no log delta, so the Course Log must be refetched separately.

**D4 — How is a blocked current waypoint resolved by relinking?** Resolved. `POST /:courseId/anchor-links` with `replaceLinkId` emits `WAYPOINT_ANCHOR_LINKED` and `WAYPOINT_UNBLOCKED` under separately scoped keys, increments the Course version exactly once, and returns the full `CourseDetail`. The pointer still comes from `Course.currentWaypointId`.

**D9 (mechanism only) — How is the one-live-Course invariant preserved?** Partly resolved. The invariant is enforced in the database by the `courses_one_active_per_user` unique index, and `ACTIVE_COURSE_EXISTS` is raised on create, update, publish, and restore. So a DRAFT can always be created; *publishing* is what is blocked. The user-facing behavior when the user taps "Plot what comes next" while a live Course exists is still a product decision — see D9 below.

### Resolved 2026-08-05 — D10

**D10. Must every Waypoint have a linked Anchor before it can become current?**

**No. Resolved from evidence as option (b); implemented.** A never-linked current
waypoint is `CURRENT`, reach and skip both stay available, and only practice is
withheld until an Anchor is linked. `BLOCKED` is now reserved for a link that
existed and stopped working — the only case any code path emits
`WAYPOINT_BLOCKED` for. No new `WaypointState` was added; `anchorLink === null`
already carried the distinction.

The full evidence chain, the two latent defects corrected alongside it (mismatched
link selectors between the mutation guards and the projection, and a false
`WAYPOINT_UNBLOCKED` on the first-ever link), and the migration/compatibility
analysis are in [`PHASE_0_D10_DECISION.md`](PHASE_0_D10_DECISION.md). No migration
is required. The *presentation* of the un-anchored case remains D5.

### Blocked — require explicit product input

**D2b. Is a Course-completion reflection required, and must it be atomic with completion?**

- Finding: `ReflectionSource.COURSE_COMPLETION` exists and `ReflectionService` accepts it (Course only, no waypoint, no practice session), but it is created by a *separate* `POST /api/reflections`. Nothing makes it atomic with `COURSE_COMPLETED`. The waypoint reflection on the final reach *is* atomic.
- Options: **(a)** Optional and separately attachable (what the code does today). **(b)** Required and atomic, which needs a new transactional path.
- Recommendation: **(a)**. `CourseCompletionScreen` already renders only after the server reports `COMPLETED`, so the integrity requirement is met; making it required would gate a celebration behind a form.
- **Decision required:** confirm (a), or commission the atomic path for (b).

**D5. Visual treatment and copy for `BLOCKED`, `SKIPPED`, and `CANCELLED`.**

**Partially closed 2026-08-05.** The D10 dependency is gone and the *behavioral*
half is now closed and contract-tested — see
[Anchor-link and blocked-state behavior, closed](#anchor-link-and-blocked-state-behavior--closed-2026-08-05)
below. What each state means, which transitions each permits, what the event log
records, and how each renders its Anchor snapshot are all frozen and asserted.

What remains is presentation only, and it cannot be inferred: the prototype
contains none of the three states, and only `CANCELLED` has frozen copy
("Waypoint removed from the course"). `WaypointDetailScreen` still shows one
generic line for all three blocked reasons.

- **Decision still required:** map, linear-list, and detail treatment for
  `BLOCKED` / `SKIPPED` / `CANCELLED`; distinct copy for `ANCHOR_RELEASED`,
  `ANCHOR_UNLINKED`, and `ANCHOR_DELETED`; and copy for the D10 un-anchored
  current waypoint, which is a *fourth* presentation case and is not an error
  state. `ChartHomeScreen` currently carries a minimal factual placeholder
  ("No Anchor linked yet. Link one to practise this waypoint.") that exists only
  so D10 does not remove the sole route to linking an Anchor.

**D6. Supported phone widths, safe-area rules, keyboard policy, dynamic type limits, sheet dismissal and focus rules.**

**Still blocked, and independent of D10.** D6 has no dependency on the state
derivation; nothing in this pass could advance it. Only 390 × 844 was ever
observed, and nothing in the repository or the captures constrains the rest.

- **Decision required:** the supported device matrix and the input/accessibility
  policy. Cannot be inferred.

**D7. Chart analytics event names and approved properties.**

- The privacy *rule* is now closed and enforced (opaque IDs only; the blocklist is extended and tested). The event *taxonomy* is not: only `practice_session_completed` carries Chart properties today.
- **Decision required:** approve the Chart event list and each event's non-sensitive properties.

**D8. Is AI plan review in Phase 1?**

- `AIPlanReview` is a registered placeholder; `chart_ai_planner_enabled` defaults to `false`. Plan generation, persistence, versioning, and failure behavior are all unspecified.
- Recommendation: keep the flag off for Phase 1.
- **Decision required:** confirm deferral, or specify the contract.

**D9. What does "Plot what comes next" do when a live Course already exists?**

- Mechanism resolved above; the UX is not. Options: hide the control while a live Course exists; show it and explain the one-live-Course rule; or offer to archive the current Course first.
- Recommendation: show it with an explanation, and require an explicit archive step — silently archiving a live Course on a "plot a new one" tap is destructive.
- **Decision required:** choose the behavior.

## Anchor-link and blocked-state behavior — closed 2026-08-05

This pass closed the behavioral half of D5 and the client half of prerequisite 5.
Every row is asserted by test; none of it is documentation only.

| Verified | Evidence |
|---|---|
| Linking an Anchor to a current Waypoint | Fresh snapshot captured at link time; one version increment; pointer untouched; refreshed `CourseDetail` returned as the new authority; a second active link without `replaceLinkId`, an archived Anchor, and another account's Anchor are all refused with their own codes. |
| Replacing an unavailable Anchor | `replaceLinkId` closes the old link with `releasedAtUnlink: true`, opens the new one, and emits `WAYPOINT_ANCHOR_LINKED` + `WAYPOINT_UNBLOCKED` under separately scoped keys — two events, **one** version increment. A `replaceLinkId` that is not the active link is refused. |
| Relinking after a burn | The burn already closed the link, so no `replaceLinkId` is used and no second close happens. The waypoint derives back to `CURRENT` with `anchorAvailable: true`. |
| Unlinking and releasing | Unlinking the current waypoint's Anchor emits exactly one `WAYPOINT_BLOCKED` carrying `{ blockedReason }`; a non-current waypoint emits none. The snapshot survives as history and the pointer never moves. `ANCHOR_RELEASED` is recorded instead of `ANCHOR_UNLINKED` when the Anchor is already gone. An already-closed link and a stale version are both refused before anything is written. |
| Blocked and unblocked transitions | `ANCHOR_UNLINKED` derives from an explicitly closed link, `ANCHOR_DELETED` from an open link whose Anchor row is gone, `ANCHOR_RELEASED` from a burn or an archived Anchor. A blocked current waypoint leaves every other waypoint state, the pointer, and the reached count unchanged. No non-`BLOCKED` waypoint ever carries a blocked reason. |
| Completion and skip | Both refuse a blocked waypoint (409 `WAYPOINT_BLOCKED`) and both succeed on an un-anchored one (D10). Reach advances the pointer, writes `WAYPOINT_REACHED`, and attaches `anchorId: null` to a reflection written without a link. |
| Anchor snapshot rendering | `AnchorLinkSummary` and `AnchorSnapshot` key sets pinned; a burned Anchor renders from its snapshot with `anchorAvailable: false`; a malformed snapshot is normalized rather than leaking partial data; a reached waypoint keeps its snapshot. |
| Offline and stale-version behavior | **Defect corrected:** `completeWaypoint`, `skipWaypoint`, and `cancelWaypoint` existed on `ChartApiClient` but had no `courseStore` action, so they never passed through `mutationUnavailable()`. A reach could therefore be sent with an `expectedCourseVersion` from a stale cache — the exact failure the `stale` gate was added to prevent. All three are now store actions behind the same chokepoint, and the fixture-driven store test drives them for every denied fixture and asserts the correct distinct error code. |
| Idempotency and expected version | Every transition carries `{ idempotencyKey, expectedCourseVersion }`; link and unblock use separately scoped keys (`chart:anchor-link:<key>`, `chart:waypoint-unblocked:<key>`), asserted distinct. Stale versions are refused before any write on link, unlink, complete, and skip. |
| Analytics and Course Log events | `WAYPOINT_BLOCKED` and `WAYPOINT_UNBLOCKED` render their frozen meanings, and the blocked reason travels as an approved snapshot key rather than free text. A link event's snapshot carries `{ anchorRole }` only — asserted to contain no Anchor intention text. |
| Archived and completed Courses | Linking is refused with `COURSE_NOT_ACTIVE` on both. |

`courseStore.completeWaypoint` applies D3 directly: the `200` response is
Course-authoritative, so the store merges the two returned waypoint summaries
over the cached list rather than refetching. It falls back to a refetch if the
cache holds a different Course, so it can never invent a waypoint list.

## Test results

All runs are from this pass, on branch `agent/chart-workstream-c`.

| Suite | Result (2026-08-05, after the D10 / D5 / confirmation passes) |
|---|---|
| Backend Chart (10 suites: CourseService, CourseServiceContract, CourseEventService, WaypointStateService, ReflectionService, ChartCleanupService, chartMigration, courses, coursesContract, practice) | **198 passed**, 0 failed |
| Mobile Chart + stores + navigation + types + practice completion + analytics + entitlements (34 suites) | **458 passed**, 0 failed |
| Mobile Practice / rituals / Sanctuary / hooks / entitlements regression (23 suites) | **221 passed**, 1 skipped, 0 failed |
| `backend` `tsc --noEmit` | clean |
| `anchor/mobile` `tsc --noEmit` | clean |

Baseline before the first remediation pass was 22 backend and 87 mobile Chart
tests; the first pass took those to 154 and 419. This pass added 44 backend and
32 mobile tests. The only pre-existing tests changed were the four that pinned
the old D10 behavior, which the decision replaced with five that pin the new one.
Nothing was removed.

## Forbidden prototype behavior — verified absent

| Corrected affordance | Verification |
|---|---|
| `MAKE THIS CURRENT` | No route sets the pointer (`make-current`, `current-waypoint` both 404); `PATCH /:courseId` rejects `currentWaypointId`; the store exposes no `makeCurrent`/`setCurrentWaypoint` action; `WaypointDetailScreen` has no such control. |
| Paused status / multi-Course switcher | `PATCH /:courseId` rejects `status: 'PAUSED'`; `/pause` and `/resume` 404; the store exposes no pause action; `courses_one_active_per_user` enforces one live Course in the database. |
| `destination` as a waypoint status | Asserted in both the backend contract tests and across every fixture. |
| Local `MARK REACHED` state transition | Completion exists only as an online idempotent server mutation; mutations fail closed when offline, stale, migrating, needing repair, or flag-off. |
| Chart owning the Anchor life cycle | `startPractice()` refuses `release` from a Chart source. |
| Prototype practice buttons | Chart practice goes through the single `startPractice` boundary and the canonical `PracticeSession`; asserted to produce exactly one navigation call into a Practice route. |

## No visual redesign started

No file under `anchor/mobile/src/screens/chart/` was restyled, and no Chart screen or component was created. The only new file in that tree is `__fixtures__/phase0.ts`, which is test-only and imported by no production module. Chart remains double-gated behind `EXPO_PUBLIC_ENABLE_CHART` and the server `chart_enabled` flag, and all Chart feature flags remain `FROZEN OFF` per the contract freeze.

## No Chart production surfaces created

Re-verified 2026-08-05. No Chart screen or component was created in any pass.
`anchor/mobile/src/screens/chart/` gained only `__fixtures__/` and `__tests__/`,
both test-only and imported by no production module. The two production edits in
this pass were surgical and both were forced by a decision:

- `ChartHomeScreen.tsx` — the Anchor-link affordance now follows "no usable
  Anchor" rather than the `BLOCKED` state, because D10 would otherwise have
  removed the only route to linking an Anchor. Copy is a factual placeholder;
  designed copy is D5.
- `courseStore.ts` — `completeWaypoint`, `skipWaypoint`, and `cancelWaypoint`
  added as store actions so they pass through the existing mutation gate.

Chart remains double-gated behind `EXPO_PUBLIC_ENABLE_CHART` and the server
`chart_enabled` flag, and every Chart feature flag remains `FROZEN OFF` per the
contract freeze — now pinned by test.

## Phase 0 decision

**NO-GO for Phase 1 implementation.** (2026-08-05, third assessment.)

Every engineering prerequisite is closed and every focused suite passes. Seven of
the ten decisions are resolved: D1, D2a, D2b, D3, D4, D8, D9, D10, plus the
privacy half of D7.

Three product/design inputs remain, and none of them is derivable from the frozen
contract, the code, or the reference captures:

- **D5** — visual treatment and copy for `BLOCKED`, `SKIPPED`, `CANCELLED`, and
  the D10 un-anchored current waypoint. The behavior underneath is closed and
  contract-tested; only the presentation is missing.
- **D6** — supported device matrix and input/accessibility policy. Independent of
  D10; nothing in this pass could advance it.
- **D7** — the analytics event taxonomy. Lowest severity; does not gate
  implementation start.

Two prerequisites remain partially closed by design — post-practice return wiring
and reflection auto-presentation — both waiting on Phase 1 surfaces with frozen,
tested contracts already in place.

**Shortest path to GO: one design review covering D5 and D6.** No engineering
work is required.
