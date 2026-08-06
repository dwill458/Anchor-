# Chart Phase 0 — Decision D10

Status: **RESOLVED FROM EVIDENCE — implemented**
Decided: 2026-08-05
Scope: waypoint state derivation, the three blocked reasons, and the mutation
guards that read them. No Chart screens or components were created.

## The question

What is the state of a **current** Waypoint that has **never** had a primary
Anchor linked?

Three candidate answers were on the table:

1. It is `BLOCKED`.
2. It is `CURRENT`, and practice is simply unavailable until an Anchor is linked.
3. A separate derived presentation state is required.

## Decision

**Answer 2.** A never-linked current Waypoint is `CURRENT`. Reach and skip both
remain available. Practice is unavailable until an Anchor is linked. No new
state is introduced: the un-anchored condition is already fully carried by
`WaypointSummary.anchorLink === null`.

`BLOCKED` now means exactly one thing: **an Anchor link that existed has stopped
being usable.**

This was not a product judgement call. It is the only answer consistent with the
frozen contract, and the previous behavior was a defect that made the product
unreachable. The evidence is below; the parts that *are* product calls are
isolated in [Explicitly not decided here](#explicitly-not-decided-here).

## Evidence

### 1. No code path can emit `WAYPOINT_BLOCKED` for a never-linked waypoint

`WAYPOINT_BLOCKED` is emitted in exactly two places, and both require a
pre-existing **active link** to close:

| Site | Trigger |
|---|---|
| [`CourseService.unlinkAnchor`](../../backend/src/services/CourseService.ts) | the owner explicitly unlinks the Anchor on the current waypoint |
| [`CourseService.closeLinksForUnavailableAnchor`](../../backend/src/services/CourseService.ts) | Anchor burn/release closes the links, per contract-freeze amendment A2 |

A waypoint that was never linked has no link to close, so no `WAYPOINT_BLOCKED`
event can ever exist for it. Under the old derivation it nevertheless rendered
as `BLOCKED`. That is a derived state contradicting the canonical event log,
which [`PHASE_0_GAP_REPORT.md`](PHASE_0_GAP_REPORT.md) makes the authority for
the Course Log ("Course Log is a hybrid projection of canonical Course events").

### 2. The contract freeze defines blocking as a consequence of link closure

[`PHASE_0_CONTRACT_FREEZE.md`](PHASE_0_CONTRACT_FREEZE.md): "Before deletion,
active CourseAnchorLinks are closed in the same transaction, their live Anchor
data is refreshed into `anchorSnapshot` with `releasedAtUnlink = true`, affected
current waypoints emit `WAYPOINT_BLOCKED`." Blocking is defined only as an
effect of closing a link. Nothing in the freeze makes an Anchor a precondition
for a waypoint becoming current.

### 3. The `null` branch was an over-broad default, not a designed case

`deriveBlockedReason` is called with the waypoint's *state* link — the active
primary link if one is open, otherwise the most recently closed one
(`stateLinkForWaypoint`). Every genuine unlink or burn therefore arrives as a
**non-null closed link**, handled by the `unlinkedAt` branch, which is what
produces `ANCHOR_UNLINKED` and `ANCHOR_RELEASED` correctly.

The `activeLink === null` case was reachable **only** when a waypoint has no
link record whatsoever, past or present. Mapping that to `ANCHOR_UNLINKED`
overloaded a reason that the emitting code path defines as "the user unlinked an
available Anchor" (`blockedReason: released ? 'ANCHOR_RELEASED' : 'ANCHOR_UNLINKED'`).

### 4. The completion transaction was already written for a null link

`completeWaypoint` writes its reflection with `anchorId: activeLink?.anchorId ?? null`
and accepts an optional `supportingPracticeSessionId`. Under the old rule the
null branch was unreachable, because completion was refused whenever the link
was absent. The transaction was written expecting exactly the case the guard
forbade.

### 5. The mockups contain no link-the-next-Anchor step, and no per-waypoint Anchor requirement

- [Upcoming waypoint sheet](phase-0-references/waypoint-upcoming-sheet-1024x1000.png):
  `5K USERS` renders title, `Not yet on the route`, description, and two
  controls. There is **no `LINKED ANCHOR` section and no link affordance** —
  upcoming waypoints are not expected to carry Anchors.
- [Waypoint reached ceremony](phase-0-references/waypoint-reached-ceremony-1024x1000.png):
  the only forward control is `CONTINUE COURSE`. There is no
  "link an Anchor to your next waypoint" step.
- [`PHASE_0_FIXTURE_MATRIX.md`](PHASE_0_FIXTURE_MATRIX.md) assigns no Anchor
  snapshot to `wp-5k` or `wp-10k`.

This rules out the other two shapes of answer 1: adding an Anchor step to the
ceremony (contradicted by the ceremony capture) and requiring an Anchor on every
waypoint at create/publish time (contradicted by the upcoming sheet and the
matrix).

### 6. Existing copy already presupposes a prior Anchor

`CourseLogScreen` renders `WAYPOINT_BLOCKED` as "Waypoint needs a **new**
Anchor." `ChartHomeScreen` rendered "Blocked — **the linked** Anchor is
unavailable." Both are false for a waypoint that never had one.

### 7. Liveness: the old rule made the product unreachable

A blocked waypoint refuses both complete and skip. With no ceremony step and no
per-waypoint Anchor requirement, no Course could progress past its first
waypoint. That is a defect with no valid product reading, which is why this
memo resolves D10 rather than escalating it.

## Why not a separate derived presentation state

Answer 3 would add a seventh value to `WaypointState`, which is frozen at six
and pinned in three places: the backend contract test's allowed-values
assertion, `VALID_WAYPOINT_STATES` in the fixtures, and the mobile
`WaypointState` union. It would also need a contract-freeze amendment.

It buys nothing. `WaypointSummary.anchorLink` is already part of the frozen
response shape and already distinguishes the three cases a surface needs:

| Situation | `state` | `blockedReason` | `anchorLink` |
|---|---|---|---|
| Anchored and healthy | `CURRENT` | `null` | link with `anchorAvailable: true` |
| Never anchored | `CURRENT` | `null` | `null` |
| Anchor unlinked / burned / archived | `BLOCKED` | set | closed link, snapshot retained |

A presentation layer distinguishes "never anchored" from "healthy" by
`anchorLink === null`. No new state is required, and `hasAvailablePrimaryAnchor`
now expresses the practice gate directly.

## What changed

### Backend

| File | Change |
|---|---|
| [`WaypointStateService.ts`](../../backend/src/services/WaypointStateService.ts) | `deriveBlockedReason` returns `null` when there is no link record at all. The `ANCHOR_DELETED` / `ANCHOR_UNLINKED` / `ANCHOR_RELEASED` branches are unchanged. |
| [`WaypointStateService.ts`](../../backend/src/services/WaypointStateService.ts) | `hasAvailablePrimaryAnchor` no longer means "not blocked" — it now means "has a usable Anchor right now", which is strictly stronger and is what a practice gate needs. |
| [`CourseService.ts`](../../backend/src/services/CourseService.ts) | `completeWaypoint`, `transitionWaypoint` (skip), and `linkAnchor` now derive blocked-ness from `stateLinkForWaypoint`, the same selector the projection uses. |
| [`CourseService.ts`](../../backend/src/services/CourseService.ts) | `WAYPOINT_UNBLOCKED` is emitted only when the waypoint is the current one **and** a prior link exists to have been broken. |

The guard-alignment change is load-bearing, not cosmetic. The mutation guards
previously read `activeLinkForWaypoint` while the projection read
`stateLinkForWaypoint`. Under those two selectors, "never linked", "explicitly
unlinked", and "Anchor burned" all collapse to `null` on the guard side; they
only stayed correct because `null` mapped to a blocked reason. Making `null`
mean "not blocked" without aligning the selectors would have unblocked genuine
unlink and burn cases — the exact regression the risk register calls
"Anchor burn destroys historical context". The two now derive from identical
input, so the server can no longer refuse a transition the client was never
shown as blocked, or permit one it was.

### Mobile

| File | Change |
|---|---|
| [`__fixtures__/phase0.ts`](../../anchor/mobile/src/screens/chart/__fixtures__/phase0.ts) | `reached-next-unlinked` now models `CURRENT` with `anchorLink: null`, `practiceAllowed: false`, mutations allowed. |
| [`ChartHomeScreen.tsx`](../../anchor/mobile/src/screens/chart/ChartHomeScreen.tsx) | The link affordance now follows "no usable Anchor" rather than the `BLOCKED` state, so a never-anchored current waypoint still offers a way to link one. Without this, D10 would have removed the only route to an Anchor. |

Copy in `ChartHomeScreen` is minimal and factual; the designed copy for both the
un-anchored and blocked cases is D5.

### Tests

| Suite | Change |
|---|---|
| `WaypointStateService.test.ts` | `deriveBlockedReason(null, null)` is now `null`; new `describe` block covers CURRENT-when-never-anchored, the practice gate, non-current un-anchored waypoints, and that unlink/release still block. |
| `CourseServiceContract.test.ts` | The three tests that pinned "cannot be reached / cannot be skipped" are replaced by five that assert reach advances the pointer, skip works, a reflection on the reach carries `anchorId: null`, and the first link emits `WAYPOINT_ANCHOR_LINKED` **without** `WAYPOINT_UNBLOCKED`. |
| `phase0Fixtures.test.ts` | New cross-cutting invariants: every `BLOCKED` waypoint retains the link record that explains it; `blockedReason` is null for every non-`BLOCKED` state; an un-anchored current waypoint permits mutations. |

## Migration and backward-compatibility impact

**No migration is required.** Nothing changes on disk.

- **No schema change.** No table, column, enum, or index is touched. The
  `CourseEventType` set frozen in `PHASE_0_CONTRACT_FREEZE.md` is unchanged.
- **No API shape change.** `WaypointState` remains the same six values;
  `BlockedReason` remains the same three. `WaypointSummary` keys are unchanged,
  so the contract test pinning them still passes.
- **No data rewrite.** `BLOCKED`/`ANCHOR_UNLINKED` for a never-linked waypoint
  was never persisted. It was derived at read time from `Course.currentWaypointId`
  plus `CourseAnchorLink` rows. Changing the derivation changes what existing
  rows project to, with no backfill.
- **No historical event is invalidated.** Every `WAYPOINT_BLOCKED` row that
  could exist was emitted from unlink or burn, and both still block. No
  `WAYPOINT_UNBLOCKED` row is orphaned: the tightened emission rule is strictly
  narrower going forward and rewrites nothing.
- **Rollback** is reverting `deriveBlockedReason`, `hasAvailablePrimaryAnchor`,
  and the three `CourseService` call sites. There is no data state to undo.
  `scripts/verify-chart-rollback.js` is unaffected.

**Client/server skew.** A client older than this change, reading a newer server,
sees `CURRENT` where it previously saw `BLOCKED`. Both are values it already
handles; the visible effect is the current-waypoint treatment plus a practice
CTA with no Anchor behind it. A client newer than the server sees
`BLOCKED` + `blockedReason: ANCHOR_UNLINKED` + `anchorLink: null`, which the new
fixture invariant forbids.

Neither is reachable in production: Chart is double-gated behind
`EXPO_PUBLIC_ENABLE_CHART` and the server `chart_enabled` flag, and all Chart
feature flags remain `FROZEN OFF` per the contract freeze. Backend and mobile
must still be released together when the flags are turned on; that ordering
belongs on the Phase 1 rollout checklist.

## Explicitly not decided here

D10 settles the **state derivation**. It does not settle presentation, and no
presentation choice was guessed:

| Open item | Owner |
|---|---|
| Copy and visual treatment for a current waypoint with no Anchor yet | **D5** |
| Copy distinguishing `ANCHOR_RELEASED` / `ANCHOR_UNLINKED` / `ANCHOR_DELETED` | **D5** |
| Whether the reach ceremony *offers* (never requires) linking an Anchor to the next waypoint | **D5**, non-blocking either way — the Course progresses without it |
| Where the "Link an Anchor" affordance sits on the Phase 1 waypoint detail surface | **D5** |

## Test results

Measured immediately after the D10 change, before the later D5 and confirmation
passes added further tests to the same files:

| Suite | Result at D10 |
|---|---|
| `WaypointStateService.test.ts` | 9 passed |
| `CourseServiceContract.test.ts` | 50 passed |
| `CourseService`, `CourseEventService`, `ReflectionService`, `ChartCleanupService`, `chartMigration`, `courses`, `coursesContract` | 78 passed |
| `phase0Fixtures.test.ts` + `courseStoreFixtures.test.ts` | 68 passed |
| `backend` `tsc --noEmit` | clean |
| `anchor/mobile` `tsc --noEmit` | clean |

Final totals across all three passes are in
[`PHASE_0_PREREQUISITES_CLOSURE.md`](PHASE_0_PREREQUISITES_CLOSURE.md#test-results):
198 backend Chart, 451 mobile Chart/store/navigation/practice/analytics, 221
Practice/rituals/Sanctuary regression, both type-checks clean.

## Outcome

`D10 CLOSED`
