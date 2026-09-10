# Batch 3 integration contracts

`POST /api/v2/anchors/:anchorId/release` requires `idempotencyKey`. It seals the Anchor with the first server `releasedAt`, archives linked Courses and Waypoints, unlinks active Course links to stop future Course-driven reminders, and retains all historical records. Replays return the original release timestamp.

Thread Events are append-only server facts. `GET /api/v2/thread-events/eligible` returns only events without a terminal receipt for the requested channel. Clients claim a bundle, then persist `PRESENTED` before displaying it; `PRESENTED`, `ACKNOWLEDGED`, and `DISMISSED` all suppress replay after restart. Acknowledgement and dismissal remain one-time terminal settlements.

Weekly Insight snapshots and feedback are persisted through `/api/v2/weekly-insights`. The client can create a deterministic snapshot from persisted source facts only when the server has no snapshot for that review week; history is always fetched from persisted snapshots. Missing evidence is rendered as `Not recorded`, never invented.
