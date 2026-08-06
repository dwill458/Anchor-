# Chart Phase 0 Gap Report

Status: Phase 0 complete; remediated 2026-08-05; implementation gate recorded below  
Captured: 2026-08-04 · Remediation pass: 2026-08-05  
Scope: comparison of the standalone HTML reference, the frozen Chart contract, and current repository integration.

> **Remediation update (2026-08-05).** A prerequisite closure pass has run against
> this report. Per-prerequisite status is recorded in the
> [Prerequisite closure status](#prerequisite-closure-status) section below, and
> the full evidence, corrected defects, and decision register are in
> [`PHASE_0_PREREQUISITES_CLOSURE.md`](PHASE_0_PREREQUISITES_CLOSURE.md).
> The gate remains **NO-GO**; the reasons changed.
>
> **Decision update (2026-08-05, later same day).** Three further passes have run.
> D10 is resolved and implemented ([`PHASE_0_D10_DECISION.md`](PHASE_0_D10_DECISION.md));
> the behavioral half of D5 is closed and contract-tested; and D2b, D8, and D9 are
> confirmed from evidence ([`PHASE_0_CONFIRMATION_DECISIONS.md`](PHASE_0_CONFIRMATION_DECISIONS.md)).
> Seven of the ten decisions are now closed. The gate is still **NO-GO**, on three
> product/design inputs only — D5 presentation, D6, and the D7 taxonomy. See
> [Phase 0 decision](#phase-0-decision).

## Executive summary

The visual language is sufficiently captured for a later implementation pass: 390 × 844 phone geometry, exact color/type tokens, map geometry, sheet geometry, copy, and observed animations are documented in [`PHASE_0_VISUAL_SPEC.md`](PHASE_0_VISUAL_SPEC.md), with deterministic state coverage in [`PHASE_0_FIXTURE_MATRIX.md`](PHASE_0_FIXTURE_MATRIX.md).

The reference is not implementation-ready as-is. It contains intentional or prototype-only actions that conflict with the frozen contract, omits several required states, and does not show keyboard, responsive, accessibility, offline, or authoritative mutation behavior. The current repository has useful Chart foundations and backend lifecycle services, but the mobile client has not yet connected all of them to Chart UI.

## Contract conflicts requiring correction

| Prototype observation | Frozen correction | Risk if copied into production |
|---|---|---|
| Upcoming waypoint sheet exposes `MAKE THIS CURRENT`. | Remove it. `Course.currentWaypointId` is the only authority; progression comes from server transitions. | Client can create a second current waypoint or bypass completion rules. |
| `YOUR CHARTS` sheet shows two courses, one `Paused`. | V1 has one live Course; no multiple-live Course switcher or paused state. Historical completed/archived records remain separate. | UI promises unsupported lifecycle and violates one-live invariant. |
| Final route item is rendered with a `destination` waypoint status tag. | Destination is a Course-level marker/entity, not a `WaypointState`. | Persisted/API state can drift from the visual endpoint and derived waypoint state. |
| `MARK REACHED` behaves like a local state transition to a ceremony. | Reach is an online idempotent server mutation; current pointer and events are authoritative. | Duplicate taps, offline completion, or local completion can corrupt the Course. |
| Waypoint ceremony offers two freeform prompts after a local reach. | Define waypoint-completion reflection schema and transaction boundary. Course completion reflection must be atomic with course completion where required. | Reflection can be orphaned or completion shown before server confirmation. |
| Practice mode cards are local prototype buttons. | Launch through the sole `startPractice` boundary and canonical `PracticeSession`, with Chart source/context and entitlement resume target. | Duplicate practice flows and sessions bypass existing entitlement/sync guarantees. |
| Prototype log is a fixed array of sample entries. | Course Log is a hybrid projection of canonical Course events plus linked PracticeSession, Reflection, and Anchor snapshots. | Ordering, deletion, and privacy behavior become inconsistent. |
| Link/change Anchor is presented as a normal Chart action. | Anchor link/snapshot closure and burn/release behavior are transactionally defined; burned snapshots remain in history and current waypoints become blocked. | Historical context disappears or a current waypoint advances incorrectly. |
| Prototype assumes transitions can be completed while the app is present. | Course mutations are disabled offline; cached reads and private local reflection drafts remain available. | False success and data loss during connectivity changes. |
| Chart appears to own the whole Anchor life cycle through its linked card. | Chart does not own Anchor lifecycle; it owns Course links/snapshots and displays canonical Anchor context. | A Chart action can accidentally burn, archive, or mutate an Anchor outside its authority. |

## Coverage gaps in the visual reference

The HTML state chooser covers Chart home, empty, waypoint detail, course details, reflection, waypoint reached, plotting, proposed, and destination reached. It does not provide evidence for:

- loading, network error, not-found, version conflict, stale cache, offline, migration, repair, or disabled-flag surfaces;
- blocked, skipped, and cancelled waypoint rendering or their allowed controls;
- completed versus archived read-only differences;
- entitlement denial and return-to-Chart behavior;
- real practice launch, canonical session creation, completion retry, or duplicate prevention;
- keyboard appearance, keyboard avoidance, text input focus, draft persistence on dismissal, or sheet dismissal while editing;
- smaller/larger phones, Dynamic Island/notch variants, safe-area insets, landscape, dynamic type, or long copy wrapping;
- screen-reader order, announcement behavior, focus restoration, or exact hit targets;
- production asset behavior: the prototype's Anchor art slot renders a placeholder in the captures;
- server timing, error payloads, atomic completion/reflection semantics, or version conflicts.

The destination-reached view also contains an internal content inconsistency: it says `5 of 5 waypoints · Mar 4 → Nov 12` while its quote refers to “four waypoints,” and its route data does not match the active sample exactly. Treat the copy as reference tone, not fixture data.

## Current repository integration assessment

| Area | Existing evidence | Phase 0 assessment |
|---|---|---|
| Tab exposure | `anchor/mobile/src/navigation/MainTabNavigator.tsx` gates Chart behind build/server flags and keeps it out of the default tab bar. | Good foundation; keep the double-gate and read-only fallback. |
| Chart stack | `anchor/mobile/src/navigation/ChartStackNavigator.tsx` registers ChartHome, setup/editor, AI review, waypoint detail, log, reflection, details, completion, and journey routes. | Route inventory exists; behavior and state coverage are incomplete. |
| Types | `anchor/mobile/src/types/chart.ts` defines Course status, six Waypoint states, `currentWaypointId`, events, error codes, stale threshold, and stack params. | Strong alignment; ensure destination is not reintroduced as a waypoint state. |
| Course client | `anchor/mobile/src/services/ChartApiClient.ts` covers initialize/list/get/create/update/publish/archive/restore, waypoint editing/reorder, Anchor links, and Course Log. | Missing mobile client methods for server waypoint completion/skip/cancel/block/unblock and completion/reflection transaction wiring. |
| Backend Course service | `backend/src/api/routes/courses.ts` exposes waypoint complete/skip/cancel routes; `backend/src/services/CourseService.ts` implements pointer advancement, blocked handling, cancellation, event snapshots, and completion transaction logic. | Backend foundation exists; mobile contracts, request schemas, and UI integration need to be frozen against it. |
| Completion/reflection | Backend completion service creates optional completion reflection in the transaction; `ReflectionService` validates reflection sources. | Confirm exact required/optional semantics and expose one client operation with idempotency/version handling. |
| Chart home | `anchor/mobile/src/screens/chart/ChartHomeScreen.tsx` hydrates/refreshes cache, handles migration/errors, renders active/empty/completed/archived paths, and displays a practice placeholder. | Read/state foundation exists; wire real practice and missing state visuals. |
| Map | `anchor/mobile/src/screens/chart/components` has semantic linear fallback, derived current-node geometry, blocked treatment, 44px targets, and reduced-motion tests. | Good implementation baseline; apply captured colors/geometry without making the decorative map the only semantic surface. |
| Waypoint detail | `WaypointDetailScreen.tsx` supports linked Anchor context and Course Log, but no practice, reach, skip, cancel, or corrected transition controls. | Major Phase 1 surface gap. |
| Practice boundary | `anchor/mobile/src/navigation/practiceEntry.ts` is the single entry boundary, but `PracticeEntrySource` has no Chart source. | Add Chart context/source there; do not invent a second route/session path. |
| Practice completion | `PracticeCompletionService.ts` provides encrypted offline queueing, idempotent session dedupe, cross-account guards, and retry. | Reuse unchanged; Chart must supply canonical source and context. |
| Reflections | Encrypted drafts are account-bound and soft-deletable in `reflectionDraftStore.ts`; `ReflectionService.ts` queues private drafts and syncs canonical reflections. | Strong alignment; connect Course Log/completion prompts to one schema. |
| Course Log | `CourseLogScreen.tsx` renders server log entries and cancellation copy; backend joins events with reflections, practice sessions, and Anchor links/snapshots. | Good foundation; document and test deterministic hybrid ordering. |
| Entitlements | `utils/entitlements.ts` centralizes free/pro rules and paywall copy. | Reuse; add Chart resume target and test locked practice fixture. |
| Analytics/privacy | `AnalyticsService.ts` sanitizes sensitive fields and emits screen/practice events. | Add a Phase 1 Chart event taxonomy without logging reflection text, intention, or Anchor content. |
| AI review | `ChartPlaceholderScreen.tsx` says AI planning is unavailable. | Keep the route flag-off or implement the missing contract before exposing prototype actions. |
| Course completion UI | `CourseCompletionScreen.tsx` renders only after server reports `COMPLETED` and blocks back navigation before verification. | Good authority posture; connect the actual completion mutation and waypoint ceremony separately. |
| Deep links | `chartDeepLinks.ts` parses Chart, Course, Waypoint, and Log targets. | Preserve; define stale/not-found resolution and auth restoration behavior. |

## Risk register

| Risk | Severity | Mitigation prerequisite |
|---|---|---|
| Client and server disagree on current pointer | High | Use `currentWaypointId` only; refresh authoritative Course after every transition; add race/idempotency tests. |
| Prototype actions leak into V1 | High | Remove Make Current, paused switcher, and destination waypoint state from the implementation checklist and fixtures. |
| Completion/reflection split | High | Freeze endpoint/request schema and transaction semantics before UI wiring. |
| Offline false success | High | Disable Course mutations offline/stale; keep encrypted draft queue separate from Course mutation queue. |
| Anchor burn destroys historical context | High | Preserve snapshots, close links transactionally, emit blocked state once, and test burn/complete races. |
| Practice duplication or entitlement bypass | High | Add `chart` entry source and route all launches through `startPractice`. |
| Private reflection leakage | High | Keep drafts/log payloads in secure-only storage and out of analytics/logs; test account switching and tombstones. |
| Accessibility regression from decorative map | Medium | Keep linear semantic list; test states, announcements, hit targets, reduced motion, and dynamic type. |
| Visual overfitting to one phone | Medium | Capture supported device sizes and keyboard/safe-area variants in Phase 1. |

## Unresolved decisions

These items need explicit product/engineering answers before the first implementation commit:

1. What exact request/response schema and idempotency key are used by mobile for waypoint complete, skip, cancel, Anchor relink/unblock, and Course completion?
2. Is a waypoint completion reflection optional, required, or mode-specific? Is Course completion reflection required, optional, or separately attachable?
3. Does a server waypoint completion response include the next pointer, full Course, event, and log delta, or must mobile always refetch?
4. How should a blocked current waypoint be resolved when the user links a replacement Anchor, and which event/version is returned?
5. Which visual treatment and copy distinguish `BLOCKED`, `SKIPPED`, and `CANCELLED` on the map and linear list?
6. What are the supported phone widths, safe-area rules, keyboard policy, dynamic type limits, and sheet dismissal/focus rules?
7. Which Chart analytics event names and non-sensitive properties are approved?
8. Is AI plan review in Phase 1, or should `AIPlanReview` remain unavailable behind its flag?
9. Does “Plot what comes next” open a draft Course only, and how does it preserve the one-live-Course invariant?

## Concrete Phase 1 prerequisites

Complete these in order:

1. Approve the corrected interaction/state contract and remove the conflicting prototype affordances from the Phase 1 acceptance checklist.
2. Publish the mobile/backend API contract for waypoint transitions, Anchor unlink/relink/unblock, Course completion, reflection transaction semantics, idempotency, expected version, and error codes.
3. Add Chart as a `PracticeEntrySource`, define the resume target, and connect the existing canonical PracticeSession/entitlement boundary.
4. Turn the fixture matrix into deterministic unit/integration/accessibility fixtures, including race, offline, stale, migration, repair, account-switch, and reduced-motion cases.
5. Implement the missing mobile client/store operations against server authority; keep Course mutations disabled offline and keep private drafts encrypted/soft-deletable.
6. Decide and implement the missing blocked/skipped/cancelled/loading/error/entitlement/migration visuals and their exact copy.
7. Resolve the AI review flag, completion ceremony split, and new-course flow before exposing those buttons.
8. Run a second visual capture pass on supported devices with keyboard, safe-area, dynamic-type, accessibility, and reduced-motion verification.

## Prerequisite closure status

Added 2026-08-05. Statuses are `closed`, `partially closed`, or `blocked`. Evidence for every row is in [`PHASE_0_PREREQUISITES_CLOSURE.md`](PHASE_0_PREREQUISITES_CLOSURE.md).

### Concrete Phase 1 prerequisites (from the list above)

| # | Prerequisite | Status | Note |
|---|---|---|---|
| 1 | Approve the corrected interaction/state contract; remove conflicting prototype affordances | closed | All six corrected affordances are now verified absent by test, not just by checklist. |
| 2 | Publish the mobile/backend API contract for transitions, links, completion, reflection semantics, idempotency, versions, error codes | closed | Contract-tested at both the service and wire layers. Mobile `completeWaypoint`/`skipWaypoint`/`cancelWaypoint` clients added. |
| 3 | Add Chart as a `PracticeEntrySource`, define the resume target, connect the canonical PracticeSession/entitlement boundary | closed | Chart sources, validated `ChartPracticeContext`, `chart_waypoint` resume target, and end-to-end context persistence all landed and tested. |
| 4 | Turn the fixture matrix into deterministic fixtures, including race, offline, stale, migration, repair, account-switch, reduced-motion | closed | 21 executable fixtures; 68 assertions across two suites, including a store-driven suite that proves the rules are enforced. |
| 5 | Implement the missing mobile client/store operations; keep mutations disabled offline; keep drafts encrypted/soft-deletable | closed | Also fixed the missing `stale` mutation gate. **Corrected 2026-08-05:** `completeWaypoint`/`skipWaypoint`/`cancelWaypoint` had been added to the API client but not to `courseStore`, so they bypassed that gate entirely. Now store actions behind the single chokepoint and driven by the fixture test. |
| 6 | Decide and implement the missing blocked/skipped/cancelled/loading/error/entitlement/migration visuals and copy | **blocked** | Decision D5. Its D10 dependency is resolved, and the behavioral half is now closed and tested (see [`PHASE_0_D10_DECISION.md`](PHASE_0_D10_DECISION.md)). What remains is visual treatment and copy, which needs product input. |
| 7 | Resolve the AI review flag, completion ceremony split, and new-course flow | closed | Decisions D8, D2b, and D9 all confirmed from evidence on 2026-08-05 and pinned by test. See [`PHASE_0_CONFIRMATION_DECISIONS.md`](PHASE_0_CONFIRMATION_DECISIONS.md). |
| 8 | Second visual capture pass on supported devices with keyboard, safe-area, dynamic-type, accessibility, reduced-motion verification | **blocked** | Cannot start until D6 defines the supported device matrix and input policy. |

### Unresolved decisions (from the list above)

| # | Decision | Status |
|---|---|---|
| 1 | Request/response schema and idempotency keys for every transition | closed — D1 |
| 2 | Waypoint vs Course completion reflection semantics | closed — waypoint (D2a, optional/structured/two-field) and Course completion (D2b, optional and separately attachable); see [`PHASE_0_CONFIRMATION_DECISIONS.md`](PHASE_0_CONFIRMATION_DECISIONS.md) |
| 3 | Does the completion response include the next pointer, or must mobile refetch? | closed — D3: response is Course-authoritative; the log must be refetched separately |
| 4 | How a blocked current waypoint is resolved by relinking, and what is returned | closed — D4 |
| 5 | Visual treatment and copy for `BLOCKED` / `SKIPPED` / `CANCELLED` | partially closed — D5: behavior closed and contract-tested 2026-08-05; visual treatment and copy still **blocked** |
| 6 | Supported phone widths, safe-area, keyboard, dynamic type, sheet dismissal/focus | **blocked** — D6, and independent of D10 |
| 7 | Approved Chart analytics event names and properties | partially closed — privacy rule closed and now genuinely enforced by test (it previously was not); taxonomy **blocked** (D7). Does not block Phase 1 implementation. |
| 8 | Is AI plan review in Phase 1? | closed — D8: deferred, flag stays off, pinned by test |
| 9 | Does "Plot what comes next" open a draft only, and how is one-live-Course preserved? | closed — D9: no V1 surface can reach setup while a Course is ACTIVE; index + service guards tested |

### New blocker found during remediation

| # | Finding | Status |
|---|---|---|
| 10 | `deriveBlockedReason(null, null)` returned `ANCHOR_UNLINKED`, so a current waypoint that had never had an Anchor linked was `BLOCKED` and could be neither reached nor skipped. A Course therefore could not progress past its first waypoint. | **closed** — D10 resolved from evidence on 2026-08-05; see [`PHASE_0_D10_DECISION.md`](PHASE_0_D10_DECISION.md) |

**D10 outcome.** A never-linked current Waypoint is `CURRENT`, not `BLOCKED`;
reach and skip stay available and only practice is withheld. `BLOCKED` is now
reserved for a link that existed and stopped working — the only case any code
path emits `WAYPOINT_BLOCKED` for. No new `WaypointState` was added; the
un-anchored condition is carried by `anchorLink === null`, which is already part
of the frozen response shape. Two latent defects were corrected with it: the
mutation guards derived blocked-ness from a different link selector than the
projection, and `WAYPOINT_UNBLOCKED` was emitted on the first-ever link to a
waypoint that had never been blocked. No migration is required. The presentation
of the un-anchored case remains D5.

### Coverage gaps in the visual reference — revisited

Of the surfaces the reference could not evidence, the following are now covered as **state and behavior contracts** (not visuals): loading, network error, not-found, version conflict, stale cache, offline, migration, repair, disabled-flag, blocked/skipped/cancelled state semantics, completed vs archived read-only differences, entitlement denial and return-to-Chart, and real practice launch/canonical session/retry/duplicate prevention.

Still unevidenced and still blocked on D5/D6: the *visual* treatment of those states, keyboard and safe-area behavior, device size variants, dynamic type, screen-reader order and announcements, exact hit targets, and production Anchor art.

## Phase 0 decision

**NO-GO for Phase 1 implementation.** (Third assessment, 2026-08-05, on narrower grounds.)

Every engineering prerequisite is now closed and covered by tests, and seven of
the ten decisions are resolved. What remains is **three product/design inputs
that cannot be derived from any artefact in this repository** — not from the
frozen contract, not from the code, and not from the reference captures.

### Remaining blockers

| # | Blocker | Why it cannot be resolved from evidence |
|---|---|---|
| **D5** | Visual treatment and copy for `BLOCKED`, `SKIPPED`, `CANCELLED`, and the D10 un-anchored current waypoint; distinct copy for `ANCHOR_RELEASED` / `ANCHOR_UNLINKED` / `ANCHOR_DELETED` | The prototype contains none of these four states. Only `CANCELLED` has frozen copy. The *behavior* underneath all of them is now closed and contract-tested; only the presentation is missing, and Phase 1's two core surfaces cannot be built without it. |
| **D6** | Supported phone widths, safe-area rules, keyboard policy, dynamic type limits, sheet dismissal and focus rules | Only 390 × 844 was ever captured, and nothing in the repository constrains the rest. Every Phase 1 screen depends on it. Independent of D10. |
| **D7** | Approved Chart analytics event names and each one's non-sensitive properties | The privacy *rule* is closed and now genuinely enforced by test. The taxonomy is a naming decision with no derivable answer. Lowest severity of the three: surfaces can be built first and instrumented once names are approved. |

Prerequisite 8 (second visual capture pass) is blocked transitively on D6.

Two prerequisites remain **partially closed** by design, not by omission: wiring
the post-practice return resolver into the ritual completion screens, and the
reflection auto-presentation rule. Both depend on Phase 1 Chart surfaces that
this phase deliberately did not build, and both have frozen, tested contracts
waiting for them.

### Shortest path to GO

1. **D5** and **D6** — a single design review can settle both. D5's dependency on
   D10 is gone, and its behavioral half is already frozen, so the review is
   scoped to copy and treatment rather than semantics.
2. **D7** — approve the event list. Can run in parallel; does not gate
   implementation start.

No engineering work is required to reach GO. Nothing else is open.
