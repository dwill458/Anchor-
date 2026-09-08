# ANCHOR 2.0 — BACKEND UNBLOCK: VISION DOMAIN + RECOMMENDED TODAY CONTRACTS

> **Status:** COMPLETE
> **Lane:** Parallel Agent 3 (Backend Unblock)
> **Scope:** Vision Domain Foundation, Intention Completion (CCR-1), Waypoint / Destination Signals (CCR-2), Recommended Today Projection API

---

## 1. Executive Summary

This deliverable establishes the backend server-owned contracts required to unblock:
- **UI-F Practice** (daily return and session mode recommendations)
- **UI-G Vision / Chart / Progress** (Anchor-scoped persistent Vision mosaic, scene creation/reordering, seen-today tracking)
- **Recommended Today Engine** (server-authoritative First-Match-Wins recommendation loop)
- **Release Recommendation Triggers** (non-destructive consumable completion signals)

All changes are strictly additive, preservation-safe, and hosted in the `/api/v2/` namespace. Legacy services (including `CourseService`, `CourseEventService`, `PracticeSession` ledger, and auth) remain untouched and backward-compatible.

---

## 2. Vision Domain

### 2.1 Models & Architecture
The legacy text-only prompt `VisualizationScene` is replaced by a first-class, Anchor-scoped persistent Vision domain:

```prisma
model Vision {
  id          String       @id @default(uuid())
  userId      String       @map("user_id")
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  anchorId    String       @map("anchor_id")
  anchor      Anchor       @relation(fields: [anchorId], references: [id], onDelete: Cascade)

  title       String?      @db.VarChar(140)
  description String?      @db.Text

  status      VisionStatus @default(ACTIVE)

  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  scenes      VisionScene[]
  views       VisionView[]

  @@index([userId, status])
  @@index([anchorId, status])
  @@map("visions")
}

model VisionScene {
  id          String            @id @default(uuid())
  visionId    String            @map("vision_id")
  vision      Vision            @relation(fields: [visionId], references: [id], onDelete: Cascade)
  userId      String            @map("user_id")
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  sourceType  VisionSceneSource @map("source_type")
  assetId     String?           @map("asset_id")
  asset       Asset?            @relation(fields: [assetId], references: [id], onDelete: SetNull)

  prompt      String?           @db.Text
  sortOrder   Int               @default(0) @map("sort_order")
  isArchived  Boolean           @default(false) @map("is_archived")

  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  @@index([visionId, sortOrder])
  @@index([userId])
  @@map("vision_scenes")
}

model VisionView {
  id           String   @id @default(uuid())
  visionId     String   @map("vision_id")
  vision       Vision   @relation(fields: [visionId], references: [id], onDelete: Cascade)
  userId       String   @map("user_id")
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  viewedAt     DateTime @default(now()) @map("viewed_at")
  localDateKey String?  @map("local_date_key")
  timeZone     String?  @map("time_zone")

  @@index([visionId, viewedAt])
  @@index([userId, visionId, viewedAt])
  @@index([userId, visionId, localDateKey])
  @@map("vision_views")
}

model Asset {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  storageKey    String   @map("storage_key")
  mimeType      String   @map("mime_type")
  fileSizeBytes Int?     @map("file_size_bytes")
  metadata      Json?

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  visionScenes  VisionScene[]

  @@index([userId])
  @@map("assets")
}
```

### 2.2 Ownership & Lifecycle
- **Ownership Verification:** Every Vision, VisionScene, and Asset query and mutation strictly validates that `entity.userId === authUser.id`. Foreign access returns `404 ANCHOR_NOT_FOUND` / `404 VISION_NOT_FOUND` to prevent ID enumeration.
- **Scene Ordering:** `VisionScene.sortOrder` provides deterministic ascending display order (0, 1, 2, ...).
- **Archival Safety:** Deleting a Vision (`DELETE /api/v2/visions/:id`) sets `status = 'ARCHIVED'`. Archived visions are excluded from active retrieval and do not trigger Recommended Today's "Vision exists" rule.

### 2.3 Asset Strategy
- Reuses existing Cloudflare R2 / S3 storage integration via `StorageService`.
- Persists only the server-owned `storageKey`, ownership, MIME metadata, and size. Vision scenes reference an owned `Asset`; they do not persist `imageUrl` or `publicUrl`.
- `POST /api/v2/assets/upload` accepts bounded, validated image base64 for the current stage. It stores Vision objects privately and returns a short-lived signed `resolvedUrl`.
- Production with a configured public R2 domain requires `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME`. Presigned direct upload is a future optimization.

### 2.4 Seen-Today & Timezone Semantics
- Recommended Today requires knowing whether an active Vision exists and has not been seen today.
- `POST /api/v2/visions/:visionId/view`:
  - Records a server-timestamped view event.
  - Computes `localDateKey` (`YYYY-MM-DD`) on the server using the user's wall-clock day in their IANA timezone (from `timeZone` body parameter, query parameter, or `X-Timezone` header; invalid values normalize to UTC).
  - Repeated views on the same day are completely safe and idempotent (`seenToday = true`).
  - Next-day evaluation automatically resets `seenToday` to `false` when the local wall-clock date key rolls over.

### 2.5 Vision API Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v2/anchors/:anchorId/vision` | Fetch active Vision with resolved scenes and `seenToday` flag |
| `POST` | `/api/v2/anchors/:anchorId/vision` | Create or initialize active Vision for Anchor |
| `PATCH` | `/api/v2/visions/:visionId` | Update Vision title, description, or status |
| `DELETE` | `/api/v2/visions/:visionId` | Archive Vision |
| `POST` | `/api/v2/visions/:visionId/scenes` | Add scene (`USER_UPLOAD` or `AI_GENERATED`) |
| `PUT` | `/api/v2/visions/:visionId/scenes/reorder` | Reorder scenes |
| `DELETE` | `/api/v2/visions/:visionId/scenes/:sceneId` | Archive/remove scene |
| `POST` | `/api/v2/visions/:visionId/view` | Record view event (sets `seenToday = true`) |
| `POST` | `/api/v2/assets/upload` | Upload a bounded image asset from base64 |

---

## 3. CCR-1: Intention Completion

### 3.1 Schema & Lifecycle State
The `Anchor` model is extended with:
```prisma
intentionCompletedAt DateTime? @map("intention_completed_at")
```

Lifecycle states are strictly separated:
- `active`: Anchor is not archived, `intentionCompletedAt == null`.
- `completed`: Anchor is not archived, `intentionCompletedAt != null`.
- `released`: Anchor has been archived/burned (`isArchived == true`).

Completion does **NOT** equal release. Completing an intention leaves the Anchor, its practice history, and Chart courses intact.

### 3.2 Endpoints
- `POST /api/v2/anchors/:id/complete` (and `PATCH /api/v2/anchors/:id/complete`)
  - **Ownership:** Caller must own the Anchor.
  - **Idempotency:** If already completed, the original `intentionCompletedAt` timestamp is preserved without re-stamping.
  - **Non-Destructive:** Does not release or delete Anchor; does not mutate Chart.
  - **Response:**
    ```json
    {
      "success": true,
      "data": {
        "id": "anchor-1",
        "intentionText": "I finish what I start",
        "category": "career",
        "lifecycleState": "completed",
        "intentionCompletedAt": "2026-09-08T03:12:00.000Z",
        "isArchived": false
      }
    }
    ```

---

## 4. CCR-2: Waypoint / Destination Recommendation Signals

### 4.1 Durable Acknowledgement Model
`CourseEvent` records (`COURSE_COMPLETED`, `WAYPOINT_REACHED`) are treated as immutable audit history. To prevent recommended Release actions from looping forever, a durable acknowledgement table tracks consumption:

```prisma
model RecommendationSignalAck {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  signalKey      String   @map("signal_key")
  signalType     String   @map("signal_type")
  acknowledgedAt DateTime @default(now()) @map("acknowledged_at")

  @@unique([userId, signalKey])
  @@index([userId, acknowledgedAt])
  @@map("recommendation_signal_acks")
}
```

### 4.2 Signal Priority
All three signals are the same highest-priority completion context and produce `Release`:
- `intention_completed`: emitted when the Anchor's intention is marked complete.
- `waypoint_reached`: emitted when a linked Course has `WAYPOINT_REACHED`.
- `destination_reached`: emitted when a linked Course has `COURSE_COMPLETED`.

Signal keys are deterministic and include the authenticated user, Course event ID, Course ID, waypoint ID where applicable, and signal type. Intention completion keys include the authenticated user, Anchor ID, and signal type.

### 4.3 Consumption Semantics
- Merely fetching `GET /api/v2/anchors/:anchorId/recommendation-context` does **NOT** consume the signal.
- Consumption occurs only when explicitly acknowledged via:
  - `POST /api/v2/anchors/:anchorId/recommendation-signals/:signalId/ack` (or `/api/v2/recommendations/signals/:signalId/ack`).
- Once acknowledged, the signal is permanently excluded from future context projections for that user.
- Unrelated historical events (events that occurred before an Anchor was linked to a Course) are filtered out and do not trigger recommendations.

---

## 5. Recommended Today Projection API

### 5.1 Endpoint
`GET /api/v2/anchors/:anchorId/recommendation-context?timeZone=America/New_York`

### 5.2 First-Match-Wins Priority Evaluation
The server evaluates and returns the authoritative recommendation in exact locked order:
1. **Completion Signal Pending** $\rightarrow$ `Release` (reason: `destination_reached` | `waypoint_reached` | `intention_completed`)
2. **Vision exists AND unseen today** $\rightarrow$ `Visualize` (reason: `unseen_vision`)
3. **delta7d < 0** $\rightarrow$ `Deep Prime` (reason: `thread_decay`)
4. **Otherwise** $\rightarrow$ `Focus` (reason: `daily_focus`)

### 5.3 Response Shape
```json
{
  "success": true,
  "data": {
    "anchorId": "anchor-1",
    "completionSignal": {
     "id": "user=user-1&course=course-456&event=evt-waypoint-123&waypoint=wp-789&type=waypoint_reached",
      "type": "waypoint_reached",
      "courseId": "course-456",
      "waypointId": "wp-789",
      "waypointTitle": "Launch MVP landing page",
      "occurredAt": "2026-09-08T02:30:00.000Z"
    },
    "vision": {
      "exists": true,
      "seenToday": false,
      "visionId": "vision-123"
    },
    "thread": {
      "delta7d": null,
      "delta7dStatus": "UNAVAILABLE",
      "status": "UNAVAILABLE",
      "blockerReason": "THREAD_DELTA7D_BLOCKER: Server stores completion-time history facts but does not execute continuous 7-day decay modeling without user sensitivity preferences."
    },
    "recommendation": {
      "action": "Release",
      "reason": "waypoint_reached"
    }
  }
}
```

---

## 6. Thread delta7d Status

### `THREAD_DELTA7D_BLOCKER`
- **Current State:** The database stores `before_strength`, `after_strength`, and `reinforcement_gained` on `practice_sessions` table as forward-only historical facts recorded upon session completion.
- **Blocker:** The backend does not run continuous daily decay calculations across calendar days without practice sessions, nor does it persist user sensitivity settings (`lenient`, `balanced`, `strict`).
- **Contract Fulfillment:** `delta7d` is safely returned as `null` with `delta7dStatus: "UNAVAILABLE"` (and the backward-compatible `status: "UNAVAILABLE"` alias). This causes Rule 3 to be skipped and falls through to `Focus`; no absolute-strength, reinforcement, or session-count proxy is used.

---

## 7. Compatibility & Safety Matrix

| Subsystem | Impact | Verification |
| :--- | :--- | :--- |
| `CourseService` | Untouched | All methods, transitions, and validations preserved verbatim |
| `CourseEventService` | Untouched | Event append and snapshot validation preserved |
| `PracticeSession` Ledger | Untouched | Timezone context and practice history preserved |
| Database Migration | Additive Only | No tables or columns dropped or altered destructively |
| Legacy Endpoints | Preserved | `/api/anchors/*`, `/api/practice/*`, `/api/courses/*` unchanged |

---

## 8. REQUIRED_INTEGRATION_CHANGES

For frontend agents implementing **UI-F Practice**, **UI-G Vision / Chart / Progress**, and **Recommended Today**:

1. **Recommended Today Daily Query:**
   Call `GET /api/v2/anchors/:anchorId/recommendation-context` with query param `?timeZone=<Intl.DateTimeFormat().resolvedOptions().timeZone>`.
2. **Release Recommendation Presentation & Acknowledgement:**
   When user commit or dismiss occurs for a completion recommendation, call `POST /api/v2/anchors/:anchorId/recommendation-signals/:signalId/ack` with `{ signalType: completionSignal.type }`.
3. **Vision Daily Return (`SEE` / `VISION` loop):**
   When the user opens Glance mode or views the Vision mosaic, call `POST /api/v2/visions/:visionId/view` with `{ timeZone: userTimeZone }` to record the daily view event.
4. **Intention Completion (Manual / Modal):**
   When the user marks an intention complete, call `POST /api/v2/anchors/:id/complete`. This transitions the Anchor to `completed` and generates a one-shot Release recommendation.
