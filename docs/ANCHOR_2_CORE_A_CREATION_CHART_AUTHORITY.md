# Anchor 2 Core A: Creation and Chart Authority

## Broken boundary found

`V2CreationRouteScreen` constructed a local `Anchor` with a draft-derived ID and immediately placed it in `anchorStore`. It never called the authenticated Anchor API. The same navigator and V2 Home passed `anchorId` as `V2Chart.courseId`.

## Creation contract

`createV2Anchor` posts the existing canonical `POST /api/anchors` contract with the persisted draft `clientRequestId` as its idempotency key. The backend owns the ID, timestamps, ownership, free-first/paid-second gate, category, intention, structure SVG, selected expression metadata, and idempotent replay. The mobile store is updated only after the server response, so a failed request cannot show a saved Anchor.

## Anchor to Course contract

`POST /api/courses/resolve-for-anchor` is the sole Anchor-context Chart resolver. It reuses the newest non-terminal Course with a live link to that Anchor. With none, explicit Chart entry creates a draft Course and destination Anchor link transactionally, then returns the real `courseId`. Vision is not involved. The endpoint never assumes `anchorId === courseId`.

## Tests and validation

Existing backend Anchor route tests already cover ownership, idempotency races, canonical response, and free creation locking. New resolver code requires targeted route/service tests for reuse, concurrent entry, and unavailable anchors before merge. `git diff --check` passed. Backend `npm run type-check` could not run because this worktree has no backend dependency binary (`tsc` unavailable).

## Migration

No schema migration is required; the implementation uses existing Anchor idempotency and CourseAnchorLink models.

## REQUIRED_INTEGRATION_CHANGES

- Add targeted tests for `resolve-for-anchor` (first entry, existing link reuse, retry/concurrency, auth/ownership, and no duplicate Course).
- Resolve `vision_and_chart` after Vision completion rather than passing an Anchor ID to Chart; this continuation remains owned by the Vision integration lane.
- Perform full mobile/backend suites in an environment with installed workspace dependencies.
