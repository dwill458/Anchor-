# Chart Phase 0 Fixture Matrix

Status: Phase 0 deterministic fixture definition  
Captured: 2026-08-04  
Purpose: freeze state coverage for visual QA, navigation tests, and Phase 1 implementation. This file defines documentation fixtures only; it does not add runtime fixtures or production behavior.

## Fixture conventions

Use deterministic values in all screenshots and tests:

```text
accountId       acct-chart-phase0
courseId        course-chart-phase0
courseVersion   7
destination     Anchor has ten thousand users
plottedAt       2026-03-04T10:00:00.000Z
now             2026-08-04T15:00:00.000Z
```

Waypoint IDs and order:

| ID | Title | Default visual state | Anchor snapshot |
|---|---|---|---|
| `wp-start` | START | `REACHED` for active fixtures; `UPCOMING` in draft fixtures | none |
| `wp-100` | 100 USERS | `REACHED` | “I build in the open without flinching.” |
| `wp-current` | 1K USERS | `CURRENT` | “Anchor has ten thousand users” |
| `wp-5k` | 5K USERS | `UPCOMING` | none |
| `wp-10k` | 10K USERS | `UPCOMING` | none; the course destination is separate |

The final row is deliberately not a `DESTINATION` waypoint state. The Course owns the destination marker and destination text.

## State and fixture matrix

| Fixture | Course/cache state | Waypoints / pointer | Visible surface and controls | Expected navigation | Mutations |
|---|---|---|---|---|---|
| `empty` | No course; `chart_enabled=true`; read/write enabled | none | Empty Chart; `PLOT YOUR COURSE`; `Build it myself` | Plot → `CourseSetup` | Create/publish only when online; no offline server mutation |
| `loading` | No cache; `loading=true` | unknown | `Loading Chart`; no stale data shown | None until load settles | None |
| `draft-setup` | `DRAFT`; version 1 | pointer null; ordered editable waypoints | Setup/editor; destination input; add/reorder/edit | Save/publish → `CourseSetup`/`CourseEditor` | Online only; idempotency key + expected version |
| `active-current` | `ACTIVE`; version 7; fresh cache | `currentWaypointId=wp-current`; start/100 reached, current current, 5k/10k upcoming | Chart home; current marker; progress `2 of 5 waypoints reached`; practice; log; manage | Tap node → `WaypointDetail`; log → `CourseLog`; manage → `CourseDetails` | Practice starts through canonical boundary; course mutations online only |
| `reached` | `ACTIVE`; version 8 after transition | `wp-current=REACHED`; `currentWaypointId=wp-5k`; event `WAYPOINT_REACHED` exactly once | Reached history node; next current marker; optional completion reflection result | Ceremony continuation returns to refreshed Chart; log includes reached event | Online idempotent completion; atomic reflection when supplied |
| `current-blocked` | `ACTIVE`; fresh cache | `currentWaypointId=wp-current`; derived state `BLOCKED`; reason `ANCHOR_RELEASED`; link snapshot retained | Blocked copy and reason; no advance; link/relink resolution | Link existing Anchor → Anchor picker/flow; log → `CourseLog` | Link/unblock online only; no automatic advance; burn did not complete or delete CourseEvent |
| `upcoming` | `ACTIVE`; fresh cache | `wp-5k=UPCOMING`; pointer remains `wp-current` | Upcoming detail/edit where allowed; no current CTA | Tap → `WaypointDetail` | Edit/cancel only if contract permits and online; never “Make This Current” |
| `skipped` | `ACTIVE`; version incremented | `wp-5k=SKIPPED`; pointer advances according to server rule | History item with skipped treatment; no edit/reach action | Log → `CourseLog`; next current remains authoritative | Online, once-only server mutation; no client state write |
| `cancelled` | `ACTIVE`; version incremented | `wp-5k=CANCELLED`; event `WAYPOINT_CANCELLED`; snapshot only `waypointTitle` | History copy “Waypoint removed from the course”; no edit/reach action | Log → `CourseLog` | Owner can cancel exactly once only for upcoming, non-current, non-terminal waypoint; online only |
| `completed` | `COMPLETED`; server-confirmed; fresh | `currentWaypointId=null`; all waypoints terminal/reached/skipped/cancelled as returned | Completion surface; “Completion is confirmed by the server.”; completed journey | View journey → `CompletedJourney`; reflection → unified composer; next course → setup subject to one-live rule | No client completion mutation; reflection may be added only by its contract/flag |
| `archived` | `ARCHIVED`; fresh | pointer null or server-returned historical pointer | Read-only course; restore affordance; no practice | Restore → `CourseDetails` action; journey → `CompletedJourney` if applicable | Restore online only; no edit/reorder/link/practice while archived |
| `stale` | Cached active course; `lastSyncedAt` > 5 minutes; `stale=true`; network available | Same as cached payload, pointer remains display-only until refresh | Cached Chart with stale notice and Retry/Refresh | Retry refreshes; navigation to cached detail remains available | All Course mutations disabled until fresh authoritative data |
| `offline` | Cached active course; `offline=true` | Same as cached payload | Cached reads; offline/read-only notice; local reflection draft affordance | Read-only navigation works; composer can save private local draft | Course mutations disabled; encrypted local drafts remain available and queue only when permitted |
| `entitlement-locked` | Active, fresh, chart enabled | `currentWaypointId=wp-current` | Practice card is visible but locked on selection | Entitlement/paywall → resume target `WaypointDetail(courseId, wp-current)` | No PracticeSession until entitlement succeeds; paywall uses central entitlement copy |
| `network-error-cached` | Cached course plus `errorCode=NETWORK` | Cached pointer | Chart remains usable; “Chart could not refresh. Cached data remains available.”; Retry | Retry; detail/log from cache | No mutations |
| `not-found` | No usable cache; `errorCode=COURSE_NOT_FOUND` | none | Error surface; “That Course is no longer available.”; Retry/back | Back to Chart/empty or retry | None |
| `version-conflict` | Mutation response `COURSE_VERSION_CONFLICT`; server has newer version | Local pointer discarded after refresh | “This Course changed elsewhere. Your view has been refreshed.” | Return to refreshed route | Retry only against new expected version |
| `migration-required` | `migrationRequired=true`; `readOnly=true` | Cache may or may not exist | “Chart needs to finish preparing your account.”; Retry | Retry migration/refresh; no write route | All Course mutations disabled |
| `repair-required` | `needsRepair=true`; `readOnly=true` | Pointer cannot be trusted | Repair/retry notice; no automatic local pointer repair | Retry server hydration | All Course mutations disabled; do not infer a new current waypoint locally |
| `chart-disabled` | `chart_enabled=false` or build flag off | none | Chart unavailable/read-only entry behavior | Root/paywall or retry after flag update | None |

## Deterministic event fixtures

Every event fixture uses `courseId=course-chart-phase0`, monotonic `createdAt`, and a stable `idempotencyKey`. The event is canonical; entity details are joined by ID and snapshot data.

| Event | Required payload evidence | Expected copy / effect |
|---|---|---|
| `COURSE_CREATED` | Course snapshot, destination, initial version | Course appears in Chart history. |
| `DESTINATION_CHANGED` | Destination before/after, version | Course-level destination changes; no waypoint state change. |
| `WAYPOINT_ADDED` | Waypoint title/order, version | New upcoming waypoint. |
| `WAYPOINT_REORDERED` | Ordered IDs, version | Route order changes; pointer remains the authority. |
| `DESTINATION_ANCHOR_LINKED` | Anchor snapshot and link ID | Destination marker/card gains linked Anchor context. |
| `WAYPOINT_ANCHOR_LINKED` | Waypoint ID, Anchor snapshot and link ID | Waypoint gains linked Anchor context. |
| `PRACTICE_COMPLETED` | Canonical PracticeSession ID, course/waypoint IDs, mode | Log joins the session; repeated upload is deduplicated. |
| `REFLECTION_ADDED` | Reflection ID, source, prompt version, soft-delete state | Log joins the unified private Reflection. |
| `WAYPOINT_REACHED` | Waypoint snapshot, prior/next pointer, optional reflection ID | Current pointer advances only from server transaction. |
| `WAYPOINT_SKIPPED` | Waypoint snapshot, prior/next pointer | Waypoint becomes terminal; pointer follows server rule. |
| `WAYPOINT_CANCELLED` | Only `waypointTitle` snapshot for cancellation | Copy “Waypoint removed from the course”; no resurrection. |
| `WAYPOINT_BLOCKED` | Waypoint ID, reason, link/snapshot evidence | Current waypoint remains blocked; no automatic advance. |
| `WAYPOINT_UNBLOCKED` | Waypoint/link evidence, version | Current waypoint can resume; pointer still comes from Course. |
| `COURSE_COMPLETED` | Completion event, final pointer null, atomic reflection relation where applicable | Completion ceremony may render only after server confirmation. |
| `COURSE_ARCHIVED` / `COURSE_RESTORED` | Prior status, version, actor, idempotency key | Read-only/archive or restored state. |

## Fixture assertions

These assertions should become Phase 1 test cases before visual polish:

- A Course has at most one live `currentWaypointId`; no client-local current flag may win over it.
- `DESTINATION` never appears as a `WaypointState` in API/client fixtures.
- A blocked current waypoint never advances because an Anchor was burned or released.
- Anchor burn closes Chart links/snapshots before hard deletion; the burned snapshot remains in history and the affected current waypoint is blocked.
- `WAYPOINT_CANCELLED` is emitted once, only for an eligible upcoming waypoint, with only `waypointTitle` in the cancellation snapshot.
- Repeated completion requests with the same idempotency key produce one event and one state transition.
- Completion plus completion reflection is atomic; a client cannot show completed state before the server response.
- Course mutations fail closed offline, stale, migration, repair, or entitlement states as appropriate.
- Cached reads and encrypted private local reflection drafts remain available offline.
- Chart-launched practice uses the canonical `PracticeSession` and the single `startPractice` boundary.
- Course Log ordering remains deterministic when an event joins a PracticeSession, Reflection, Anchor snapshot, or Waypoint snapshot.
- Completed and archived fixtures do not expose edit/reorder/reach/cancel controls.
- Reduced motion renders the final route state without waiting for animation.

## Visual reference mapping

The supplied HTML captures cover `active-current`, `empty`, `upcoming`, `reflection`, `reached`, `plotting`, `proposed`, and destination-completed visuals. They do not cover loading, errors, stale/offline, blocked, skipped, cancelled, entitlement, migration, repair, or real keyboard behavior. See the [visual specification](PHASE_0_VISUAL_SPEC.md) for the complete screenshot index.
