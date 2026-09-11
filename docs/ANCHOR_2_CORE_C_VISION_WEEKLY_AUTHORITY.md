# Anchor 2.0 Core C: Vision and Weekly Insight Authority

## Broken boundaries repaired

- Vision curation previously converted Unsplash prototype candidates (`cand-*`) into `assetId` values. The Vision service correctly rejected those values because they were not user-owned `Asset` rows.
- Weekly Insight previously constructed facts from device stores, selected a narrative locally, and posted that narrative as canonical history.

## Vision asset flow

The V2 creation surface now offers only the implemented pathway: the user selects images from the media library. Each local URI is base64 encoded by the Vision hook and sent to `POST /api/v2/assets/upload`. The existing server route authenticates the user, enforces a 5 MB bound, validates declared and decoded MIME type (`png`, `jpeg`, `webp`, `gif`), stores the object privately, registers an owned `Asset`, and returns its canonical ID. Only those returned IDs are sent in the Vision create request. A failed upload leaves the creation surface open and does not claim a saved Vision.

Asset ownership validation remains in `VisionService` for create and add-scene. Vision scenes preserve asset IDs across reloads and only resolve a short-lived storage URL for display. Upload does not call the Vision-view endpoint, so it cannot mark a Vision as seen today.

AI VISION GENERATION: **DEFERRED / NOT REQUIRED.** The locked V2 material requires real user imagery and explicitly rejects fake generated imagery; it does not supply a locked provider-backed Vision-generation contract. The prior generated-candidate promise was removed rather than simulated.

## Weekly evidence and snapshots

`WeeklyInsightService` is the sole snapshot generator. It reads persisted `PracticeSession`, `ThreadV2Movement`, `ThreadEventLedger`, `CourseEvent`, `VisionView`, and `Anchor` records. It returns known values from those sources and represents unavailable Thread/Course/Vision evidence as `null` / `Not recorded`, never a device-derived zero.

The device now requests `POST /api/v2/weekly-insights/generate` with optional `anchorId` and account timezone only. It cannot submit practice counts, strength, delta, events, or narrative. The server owns the timezone-aware Monday-to-Sunday week frame and idempotently upserts the snapshot using the existing `(userId, anchorId, weekStart)` key. History remains the persisted server snapshot collection.

## Agent B dependency

Weekly Insight consumes persisted `ThreadV2Movement.beforeStrength`, `afterStrength`, and `delta`; it does not calculate `delta7d` or recompute Thread movement. Agent B remains the owner of that contract.

## Validation and remaining runtime QA

`git diff --check` passes. Full TypeScript/test commands require node dependencies in this worktree; the backend `npm run type-check` currently cannot locate `tsc`. Runtime QA still required: image-library permissions on device, real private-storage upload, retry after network interruption, and server snapshot rendering across timezone boundaries.

## REQUIRED_INTEGRATION_CHANGES

None for Prisma or navigation. Integrators should preserve the new generated-snapshot API contract and ensure Agent B's authoritative Thread movement writes remain available before Weekly Insight generation.
