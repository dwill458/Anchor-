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

## Decision register

| Decision                                  | Status       | Contract                                             |
| ----------------------------------------- | ------------ | ---------------------------------------------------- |
| A1 — explicit waypoint cancellation event | APPROVED     | `WAYPOINT_CANCELLED`; `{ waypointTitle }` only       |
| A2 — burn lifecycle alignment             | APPROVED     | close Chart links/snapshots, then hard-delete Anchor |
| Course feature flags                      | FROZEN OFF   | No Chart flags are enabled by Workstream A           |
| Mobile Chart UI                           | OUT OF SCOPE | No mobile Chart UI changes in Workstream A           |
