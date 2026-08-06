# Phase 0 Contract Freeze

This document records the frozen Workstream A Chart contract. Amendments below
are additive and approved; existing lifecycle behavior remains canonical unless
an amendment explicitly says otherwise.

## Frozen excerpts

```prisma
enum CourseEventType {
  COURSE_CREATED
  DESTINATION_CHANGED
  WAYPOINT_ADDED
  WAYPOINT_REORDERED
  DESTINATION_ANCHOR_LINKED
  WAYPOINT_ANCHOR_LINKED
  PRACTICE_COMPLETED
  REFLECTION_ADDED
  WAYPOINT_REACHED
  WAYPOINT_SKIPPED
  WAYPOINT_CANCELLED
  WAYPOINT_BLOCKED
  WAYPOINT_UNBLOCKED
  COURSE_COMPLETED
  COURSE_ARCHIVED
  COURSE_RESTORED
}
```

Anchor burn/release remains a hard-delete lifecycle. Before deletion, active
CourseAnchorLinks are closed in the same transaction, their live Anchor data is
refreshed into `anchorSnapshot` with `releasedAtUnlink = true`, affected current
waypoints emit `WAYPOINT_BLOCKED`, affected Courses increment once, and the
existing immutable BurnedAnchor snapshot is preserved. `anchorId` may then be
null through `ON DELETE SET NULL`.

## Approved amendments

### A1 — approved 2026-08-02

`CourseEventType` adds `WAYPOINT_CANCELLED`. It is emitted exactly once when an
authenticated owner cancels an UPCOMING, non-current, non-terminal waypoint.
Its user-facing meaning is: “Waypoint removed from the course.” Its only allowed
snapshot field is `waypointTitle: string`. Cancellation is not `WAYPOINT_SKIPPED`.

### A2 — approved 2026-08-02

Anchor burn/release may hard-delete the live Anchor row after Chart links and
snapshots are safely closed inside the existing lifecycle transaction. Burn does
not complete or advance a waypoint, delete a CourseEvent, or delete a
PracticeSession. Historical rendering uses `CourseAnchorLink.anchorSnapshot`,
and existing BurnedAnchor history remains canonical.

### F1 — approved 2026-08-03

AI Course Planner entitlement and quota policy. This amendment adds only planner
generation policy. It changes no Course or Waypoint state machine, no
`Course.currentWaypointId` authority, no `Waypoint.status`, no existing route,
API signature, error code, analytics name, or storage key.

**Availability.** Free accounts may not generate AI proposals. Trial and Pro
accounts may. Expired accounts may not generate new proposals. Every account
keeps read access to proposals it already owns, subject to normal expiry and
deletion. Manual Course creation stays governed by the existing frozen Chart
entitlement rules and is untouched by this amendment.

**Entitlement source.** Entitlement is derived server-side from the existing
authoritative mechanism — `RevenueCatEntitlementService.getRevenueCatAccess`
plus the persisted `User.subscriptionStatus`, `User.isComped`, and
`User.trialStartedAt` — using the same 7-day trial window already frozen in
`PracticeAccessService` (`TRIAL_DURATION_MS`). No separate planner subscription
concept is introduced. Resolution is:

| State     | Condition                                                                |
| --------- | ------------------------------------------------------------------------ |
| `pro`     | `isComped`, or live entitlement active, or persisted `pro`/`pro_annual`   |
| `trial`   | not `pro` and `now < trialStartedAt + 7d`                                |
| `expired` | not `pro` and `now >= trialStartedAt + 7d`                               |
| `free`    | entitlement inputs missing or unresolvable                               |

**Generation caps.** Server-owned constants, never client literals:

| State     | Cap | Window                          |
| --------- | --- | ------------------------------- |
| `trial`   | 3   | entire trial lifetime           |
| `pro`     | 10  | rolling UTC day                 |
| `free`    | 0   | —                               |
| `expired` | 0   | —                               |

Rate limiting is a separate control and is never the entitlement cap.

**Quota consumption.** One unit is consumed only when a new valid
`AIPlanProposal` is successfully persisted for the authenticated account. These
consume nothing: retry with the same idempotency key, duplicate tap, a
concurrent duplicate resolved to the same proposal, provider timeout before
persistence, provider error before persistence, schema-invalid provider output
before persistence, retrieval, acceptance, dismissal, expiry, staleness, and
read-only viewing. A deterministic fallback that is successfully persisted
consumes one unit, because the user received a valid proposal. Regeneration
after dismissal, expiry, or staleness consumes a unit only when a new proposal
is persisted under a new generation action.

**Acceptance after entitlement change.** An owned, unexpired, non-stale,
non-superseded, non-rejected, not-already-accepted proposal generated while the
account was entitled may still be accepted after trial or Pro expiry, provided
no active Course conflict exists and the account may still create the applicable
Course under frozen Chart rules. Acceptance never consumes generation quota.

**Missing configuration fails closed.** Missing, malformed, or unavailable
planner quota configuration denies new generation with a typed safe error and
performs no provider call. It must never be read as unlimited, inferred from
rate limits, or satisfied by client-supplied entitlement or quota. Retrieval of
owned proposals and acceptance of eligible existing proposals remain available,
and manual Course behavior is unchanged.

**Source of truth.** The backend is authoritative for entitlement, quota count,
quota reset, proposal ownership, cap enforcement, and acceptance eligibility.
The client may display server-returned quota state but may never compute or
authorize generation. The mobile flag alone can never enable generation.

**Flag interaction.** Generation requires all of: Chart build flag, Chart server
flag, AI planner server flag, valid server quota configuration, eligible
server-authoritative entitlement, remaining quota, an authenticated account, and
an online connection.

**Typed denial reasons.** `not_entitled`, `entitlement_expired`,
`quota_exhausted`, `quota_config_unavailable`, `entitlement_unavailable`,
`planner_disabled`. Planner-scoped error codes `PLANNER_NOT_ENTITLED`,
`PLANNER_QUOTA_EXCEEDED`, and `PLANNER_UNAVAILABLE` are added; no existing error
code changes meaning.

## Decision register

| Decision                                  | Status       | Contract                                             |
| ----------------------------------------- | ------------ | ---------------------------------------------------- |
| A1 — explicit waypoint cancellation event | APPROVED     | `WAYPOINT_CANCELLED`; `{ waypointTitle }` only       |
| A2 — burn lifecycle alignment             | APPROVED     | close Chart links/snapshots, then hard-delete Anchor |
| F1 — AI planner entitlement and quota     | APPROVED     | trial 3 lifetime, Pro 10/UTC day, free/expired 0; fail closed |
| `chart_waypoint_detail` entry source      | FROZEN (A)   | Frozen by Workstream A; no amendment required        |
| Course feature flags                      | FROZEN OFF   | No Chart flags are enabled by Workstream A           |
| Mobile Chart UI                           | OUT OF SCOPE | No mobile Chart UI changes in Workstream A           |

### Record — `chart_waypoint_detail` was already frozen

Recorded 2026-08-03 during E+F integration; this is a finding, not an amendment.
`chart_waypoint_detail` entered the contract with Workstream A and is present at
the authoritative B+C+D checkpoint `b43403a`, before Workstream E:
`backend/src/types/chart.ts` declares it in `PracticeEntrySource` and
`PRACTICE_ENTRY_SOURCES`; `POST /api/practice/sessions` enforces the enum and
persists the value verbatim; migration `20260802000000` adds
`practice_sessions.practice_entry_source` as nullable TEXT, so legacy null stays
valid; and `scripts/verifyChartDatabase.ts` asserts the exact literal
round-trips. Workstream E only mirrors the value on the mobile client. It is
used as-is, with no near-duplicate Chart entry source introduced.
