# Anchor Milestone Implementation Report

Date: 2026-10-21. Local, uncommitted implementation in `E:/Projects/Anchor`. No production deployment, live database migration, OTA, native installation, or dependency addition was performed. Pre-existing dirty work was preserved.

## Status

The supplied 20-piece collection is integrated, with separate permanent awards and bounded automatic presentations. Historical reconciliation is quiet; one optional historical welcome-back opportunity is available after a confirmed practice. The centralized coordinator preserves normal practice, Vision arrival, and Chart feedback.

**Production approval remains gated by native acceptance, disposable PostgreSQL concurrency/migration acceptance, and the unrelated repository failures recorded below.** There is no existing mobile caller for the explicit goal-completion endpoint: its server award and presentation API are supported, but a mobile Goal Reached automatic boundary cannot be certified without that product flow. Release/burning an Anchor does not imply reaching its goal.

## Approved source and discrepancies

- Source: `E:/Downloads/anchor-milestones.zip`, extracted unchanged into `design/milestones/approved-20261021/`. The importer records SHA-256 for every earned and locked SVG. Its `--check` mode verifies imported definitions without regenerating artwork.
- The supplied package has **ivory/gold Strength**, rather than the earlier proposed navy/magenta revision. This implementation follows the latest implementation instruction to use the supplied approved collection unchanged. No artwork was recolored or redesigned.
- First Practice, Goal Reached, and First Glimpse are documented screenshot reconstructions. Full Strength is a replacement candidate whose authentic earlier master was unavailable. These are not authenticated original source masters. Existing application masters remain intact in their original files.
- Design slugs are mapped explicitly to existing app IDs. Their artwork metadata never defines eligibility.
- Package Strength requirements differ from the authoritative registry. Preserved: Building 25, Established 50, **Integrated 75, Reinforced 90**, Full Strength 100. The ordering of Integrated/Reinforced in the prose request does not rename IDs or swap thresholds.
- The package calls Goal Reached a final waypoint. Preserved: only `Anchor.intentionCompletedAt` awards Goal Reached; completing a Chart awards All Waypoints separately.
- The actual category counts are 5 Strength, 6 Commitment, 4 Journey, 5 Vision, totaling 20.
- Existing ownership is per `(userId, anchorId, definitionId)`, matching the Anchor-specific gallery. This task retains that scope rather than converting achievements to account-wide awards.

## Implemented IDs and exact eligibility

All rules read persisted, owner-scoped backend facts. Existing award rows and their dates are never recalculated or revoked.

| Stable ID | Requirement | Supplied SVG slug |
| --- | --- | --- |
| `strength.building` | First authoritative movement at or above 25 | `strength_building` |
| `strength.established` | First authoritative movement at or above 50 | `strength_established` |
| `strength.integrated` | First authoritative movement at or above 75 | `strength_integrated` |
| `strength.reinforced` | First authoritative movement at or above 90 | `strength_reinforced` |
| `strength.full` | First authoritative movement at or above 100 | `strength_full_strength` |
| `commitment.practices.1` | 1 completed practice session | `commitment_first_practice` |
| `commitment.practices.10` | 10 completed practice sessions | `commitment_ten_practices` |
| `commitment.practices.30` | 30 completed practice sessions | `commitment_thirty_practices` |
| `commitment.practices.100` | 100 completed practice sessions | `commitment_one_hundred_practices` |
| `commitment.minutes.100` | 6,000 accumulated completed seconds | `commitment_100_minutes` |
| `commitment.minutes.500` | 30,000 accumulated completed seconds | `commitment_500_minutes` |
| `journey.waypoint.first` | First persisted reached waypoint | `journey_first_waypoint` |
| `journey.halfway` | `ceil(live waypoint count / 2)` reached; at least 2 live waypoints; excludes Next Stretch | `journey_halfway` |
| `journey.destination` | Completed non-Next-Stretch Chart with completion timestamp | `journey_all_waypoints` |
| `journey.goal` | Explicit intention completion timestamp | `journey_goal_reached` |
| `vision.first` | First persisted image or authored note (`firstCommittedAt`); generation/description shell does not count | `vision_first_glimpse` |
| `vision.board.complete` | Eight distinct committed, non-archived image assets; captured once | `vision_picture_complete` |
| `vision.visualize.1` | 1 qualifying completed guided Visualize session | `vision_seen_clearly` |
| `vision.visualize.10` | 10 qualifying completed guided Visualize sessions | `vision_familiar_future` |
| `vision.visualize.30` | 30 qualifying completed guided Visualize sessions | `vision_living_the_vision` |

Commitment retains the existing business rule: owner/Anchor-scoped `PracticeSession` rows with `completionStatus=completed`, across existing accepted practice modes; minutes use `completedDurationSeconds`, clamped at zero. Session IDs remain immutable and unique through the canonical completion API. Abandoned sessions are excluded. Visualize additionally requires `practiceMode=visualize`, `metadata.guided_visualize_version=1`, and a referenced Vision owned by the same user and Anchor. Board creation alone cannot satisfy it. Historical sessions without that provenance are not guessed to qualify.

Halfway excludes cancelled, skipped, and archived waypoints; an odd route of five requires three. Existing permanent awards survive later Chart edits. Reconciliation retains the existing registry's current-route semantics; it cannot reconstruct a deleted Chart or an earlier denominator that was never recorded. No synthetic historical Thread peak, missing session, deleted content event, or Visualize provenance is manufactured.

## Awarding and historical policy

- Award creation is server-owned and protected by the existing unique award key. Multiple simultaneous eligible achievements are all recorded.
- `earnedAt` comes from the first qualifying persisted event. Existing award dates, definition versions, source evidence, and metadata remain unchanged.
- Version 1 reconciliation classifies new read-time awards as historical regardless of their age. It never fills `celebratedAt` merely to keep them quiet.
- Additive migration classifies pre-existing award rows as version 1 history while preserving all existing dates and receipts. Repeated evaluation cannot duplicate rows or rewrite dates.
- Action-aware evaluation makes only recent matching event evidence eligible for automatic presentation. Its opportunity window is two minutes. Delayed/offline catch-up remains earned and visible without interrupting another activity.
- A quiet gallery read racing a live completion cannot permanently misclassify that completion: guarded promotion handles both an already-visible row and a `P2002` insert race. Promotion requires identical recent source evidence and no reservation or acknowledgment; it changes presentation classification only.
- Milestone fact scans run asynchronously from canonical write responses. The reservation boundary reevaluates persisted facts to recover a lost/deferred evaluation. A gallery read also reconciles missed awards. This is recoverable eventual award recording, not a replacement for canonical session persistence.
- Gallery reads and background practice queue flushes never request automatic celebrations. Loading/error/offline states do not falsely declare unknown achievements locked or publish a final zero-earned total.

## One automatic presentation per action

`MilestonePresentationService` uses an interactive PostgreSQL transaction, a transaction-scoped advisory lock per user, and a unique `(userId,eventKey)` presentation key. The lock spans Anchors so two devices cannot claim the user's welcome-back opportunity separately. Unique permanent award keys remain the final award duplication defense.

Event identity is the practice session ID, the course plus reached waypoint ID, the Vision plus latest persisted image/note commit ID, or the explicit goal action. Vision identity remains stable if only part of a simultaneous award batch was recorded before a retry.

Selection is deterministic: directly related family first (Commitment for ordinary practice, Vision for Visualize/Vision, Journey for Chart/goal), then descending requirement value, then lexical definition ID. Strength competes after the directly related family. Goal outranks All Waypoints within Journey. Every simultaneous fresh award is marked consumed for automatic presentation; only the selected one is shown. No full-screen backlog or extra summary was introduced.

For history, a single `welcome:v1` opportunity exists per user. At the next confirmed practice with eligible historical awards, new awards take priority. If there are none, the highest relevant historical award is featured. The opportunity is consumed even when a new award wins, so no historical celebration is deferred onto a later practice. Every other historical award stays in the gallery.

Reservations expire after 90 seconds and allow **one automatic attempt**, with no automatic reissue after a crash, interruption, lost response, or expiration. This deliberately favors avoiding repeats over guaranteeing cinematic playback. The permanent award is untouched and manual replay is always available. `celebratedAt` and presentation acknowledgment are written only on actual user completion/dismissal; a consumed/suppressed reservation is not reported as shown.

## Database and API changes

Migration: `backend/prisma/migrations/20261021160000_milestone_presentations/migration.sql`.

- Existing award fields added: `backfill_version`, `automatic_event_key`, `automatic_reserved_at`.
- New `milestone_presentations` table: owner, Anchor, unique event identity, optional featured award ID, expiration, actual acknowledgment timestamp, creation timestamp. User/Anchor foreign keys cascade with their existing records.
- Existing Vision evidence migration `20261020180000_vision_milestone_facts` remains a prerequisite; this task does not apply either migration to a live database.
- `POST /api/v2/anchors/:anchorId/milestone-celebration`: validated `{kind,sourceEntityId,eventId?}`. Chart requires a persisted reached waypoint event ID. Returns one reservation or null. Both ownership and persisted action evidence are checked.
- `POST /api/v2/milestones/:id/celebrated`: accepts the reserved presentation UUID and atomically acknowledges it and its award. Legacy receipt shape remains supported. It never grants an award.
- `GET /api/v2/anchors/:id/milestones`: quiet reconciliation and permanent record.
- Canonical practice response retains the `newMilestones` array shape as an empty legacy field; clients must use the reservation boundary rather than that field to schedule cinematics.
- New client requests and receipt retries bind captured account, token, revision, and active boundary; delayed responses cannot borrow another account's credentials. Read cleanup invalidates outstanding gallery requests.

Transaction design references: [Prisma interactive transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions) and [PostgreSQL transaction advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS). These describe mechanisms, not proof of this migration's deployed behavior.

## Event-to-celebration map

| Event | Award boundary | Allowed presentation boundary |
| --- | --- | --- |
| Focus / Deep Focus | Completed session saved; authoritative movement persisted | Existing shared Focus completion screen is mounted and saved; entry settles; shared Thread coordinator goes idle |
| Guided Visualize | Canonical guided completion persisted with Vision provenance | Guided audio/session finishes; existing Visualize pullback/cream arrival hands off to normal completion; same post-practice boundary |
| Vision images / authored note | Persisted content evidence; eight distinct images captured once | Ceremony completes, images warm, board mounts, and board-arrival activity has finished; no image picker/sealing interruption |
| Chart waypoint | Authoritative reached waypoint and completed Chart state | Existing reach/commit feedback is actually removed from the sheet snapshot, or the summit sequence finishes |
| Explicit goal completion | `intentionCompletedAt` persisted | API supports a goal reservation after existing feedback; no current mobile goal-completion caller was found, so this native boundary remains a release limitation |
| Login / Progress / gallery | Quiet historical reconciliation | None |
| Background/offline practice sync | Persisted eligible session facts | None |
| Manual replay | No award operation | Existing earned detail action; no reservation/receipt mutation |

The shared presenter retains the existing coordinator and measured Thread origin. It waits for holds and current scenes, uses the cream-to-navy transition, and never starts ahead of normal practice completion. Screen focus/unmount guards and an eight-second response cutoff discard late requests. Backgrounding interrupts the scene without falsely acknowledging it or automatically replaying it. Android back and Continue use existing scene dismissal; manual replay retains Back to Milestones. Return destinations remain with the triggering flow rather than a new navigation stack.

The Chart review found an existing delayed-snapshot race: a permitted revision could be consumed before its frame applied, leaving a dismissed commitment card visible. The fix records the revision when the snapshot actually applies and dispatches the milestone boundary after the commitment content is gone. It does not replace the Chart flow.

## SVG and motion integration

All 40 supplied SVGs are imported as `react-native-svg` primitives, including exact paths, original optical transforms, gradients, layers, and palette. IDs and references receive per-instance namespaces. No raster substitution or new dependency is used. All approved features were representable; no unsupported essential filter fallback was needed.

`MilestoneArtwork` is shared by the existing gallery, details, and celebration. Gallery card geometry and filters remain intact. Static artwork is used outside the finite reveal.

Motion follows the supplied manifest and per-emblem specification:

- Strength: Pulse and Integration.
- Commitment: Accumulation and Formation.
- Journey: Progress and Arrival.
- Vision: Emergence and Clarity.

One finite Reanimated timeline drives individual SVG draw/fade/scale/translate and accent operations. Duration includes the last staggered child (roughly 2.7–3.1 seconds). At settle, the scene swaps to the exact static earned renderer and holds it for the user. Reduced motion is the specified 320ms locked-to-earned crossfade. There is no gallery loop, spinning badge, or persistent native glow. Existing sound and haptics remain owned by the scene/coordinator.

Reproducible source tools: `anchor/mobile/scripts/import-approved-milestones.py --check`, `scripts/generate-milestone-motion-bounds.mjs`, `scripts/qa-approved-milestone-renderer.cjs`. The original design generators and previews remain in the extracted source package, unchanged.

## Validation

See `docs/qa/milestones-integration-20261021/` for JSON reports, logs, rendering sheets, and the empty ADB inventory. Final automated totals are recorded in the validation addendum below.

- Baseline: backend milestone registry/service/routes 50 tests passed; mobile milestone/completion batch 106 passed. Broader baseline practice batch had 279 passes and one existing Focus ink-opacity assertion failure.
- Static source integrity: 40/40 SVG hashes match; all 20 mapped IDs are present.
- Browser serialization of the actual React primitive renderer: **240/240 pixel-identical comparisons** against approved SVGs at 64/96/256 pixels on cream and navy. No outer-border alpha pixels, duplicate instance IDs, or unresolved references. Full collection and Strength sheets were visually inspected.
- Finite reveal tests cover all four families, exact static settle, reduced motion, replay, sound/haptic once semantics, and existing controls.
- Policy/service tests cover thresholds, permanence, minutes, Vision and guided sessions, odd halfway rounding, goal separation, duplicate awards, quiet history, ten historical achievements, one welcome opportunity, new-vs-historical priority, bounded reservations, crash/retry semantics, ownership, and real acknowledgment.
- Event tests cover saved/failed/late practice completion, source unmount/blur, account/token/revision switching, no Progress flood, preserved gallery filtering/totals, Vision delegation, and Chart feedback/snapshot races. These are automated model/component tests, not physical-device timing verification.
- Prisma schema validation and backend typecheck pass. No attached Android device/emulator was available. No iOS device, authenticated native touch/back/return checks, visual animation comparison, sound/haptic audition, memory measurement, or frame-pacing trace was obtained. **Native performance and full visual parity are not certified.**
- PostgreSQL advisory locking, migration application, real concurrent-device reservations, and abrupt process death must be accepted on a disposable database before release. Stateful transaction mocks cover policy but do not establish PostgreSQL isolation behavior.

## User examples

1. **New user, first practice:** canonical session completes and updates Thread Strength. Normal completion plays. First Practice is permanently earned; the mounted completion boundary requests one reservation. Its SVG reveal follows the normal Thread scene. Leaving early cannot remove the award.
2. **Returning user, 30 historical practices:** reconciliation writes supported First/Ten/Thirty Practice awards using original persisted dates and any other supported achievements. Login shows no cinematic queue. Next successful practice shows a new milestone if earned, otherwise at most one featured historical milestone. The remainder stay available for manual replay.
3. **Two milestones in one practice:** both are permanently recorded. The directly related achievement wins deterministically; the other remains earned without another automatic screen.
4. **First Vision:** saved image or authored note qualifies; a generation shell does not. Existing creation/sealing and board arrival finish first, then one Vision reveal may play. Eight selected-but-unsaved images cannot award Picture Complete.
5. **First Visualize:** a fully completed guided session linked to an owned Vision qualifies. Audio, session resolution, pullback, and normal completion are preserved. Seen Clearly has direct-event priority over concurrent Commitment/Strength achievements; all eligible awards remain recorded.

## Rollback and release checklist

Rollback application code selectively using this task's file inventory; do not reset the shared checkout. The database changes are additive and can remain installed while app changes are rolled back. **Never delete award rows, rewrite earn dates, or clear reservations to force playback.** Preserve presentation receipts. Dropping the new table/columns is unnecessary for an application rollback and requires a separate reviewed migration.

- [ ] Obtain approval for production deployment; none is implied by this report.
- [ ] Verify correct database and apply prerequisite Vision evidence migration plus new presentation migration on a disposable database first.
- [ ] Exercise parallel reservations from two clients, unique-insert races, interrupted transactions, and acknowledgment retry against PostgreSQL.
- [ ] Resolve or explicitly accept repository-wide failures/typecheck blockers listed in the validation addendum.
- [ ] Confirm supplied ivory/gold Strength package is the desired release artwork; the navy/magenta revision is not in this ZIP.
- [ ] Validate authenticated Focus, Deep Focus, Visualize, Vision board arrival, Chart feedback, Android back, replay return, background/resume, reduced motion, sound/haptics and frame pacing on Android and iOS.
- [ ] Verify the explicit mobile goal-completion product flow and connect its post-feedback goal boundary if/when that flow exists; do not substitute Release.
- [ ] Coordinate client/backend rollout. Older clients that enqueue every unacknowledged award on Progress reads must be retired or guarded before quiet-history rows with truthful null receipts are exposed. Do not fake `celebratedAt` for compatibility.
- [ ] Monitor award evaluation errors and reservation failures through existing backend logging; gallery reconciliation recovers missed awards, while presentation failure remains optional.

## Task file inventory

Application/backend changes are limited to milestone assets/rendering/motion, the existing milestone coordinator/read/cache, shared practice completion boundary, Vision boundary, Chart feedback/snapshot handling, authoritative milestone service and canonical event hooks, Prisma additions, and their tests. Pre-existing audio, Vision artwork/layout, entitlement, app configuration, auth, and Chart planner changes were not claimed as part of this task.

The final machine-readable inventory is `docs/qa/milestones-integration-20261021/task-files.json`; it lists milestone task paths separately from the original dirty checkout. The approved source package includes all original SVGs, previews, handoff, generator and QA material.

## Validation addendum — completed runs

| Run | Result | Evidence |
| --- | --- | --- |
| Backend milestone + practice + courses + Vision | **159 passed, 8 suites** | `backend-focused-tests.json` |
| Mobile milestone + practice + Vision + Chart integration | **396 passed, 1 failed, 28 suites** | `mobile-integration-tests.json` |
| Later focused mobile run, including source-account guards and practice return callbacks | **190 passed, 1 failed, 16 suites** | `mobile-focused-tests.json` |
| Full backend repository | **1,149 passed, 50 failed, 23 skipped; 70 passed / 2 failed / 2 skipped suites** | `backend-tests.json` |
| Full mobile repository attempt | **5,998 passed, 26 failed, 1 skipped; 595 passed / 8 failed suites; 12 snapshot mismatches** | `mobile-tests.json` |
| Final native bundle compilation | **Android and iOS exports succeeded** | `android-export.log`, `ios-export.log` |
| SVG integrity and static browser renderer | **40 source hashes; 240 exact pixel comparisons** | `static-renderer-parity.json` |
| Prisma validation / backend TypeScript | **Passed** | Executed locally; no live schema change |
| Mobile TypeScript | **Blocked by 3 existing legacy Visualize voice typing errors** | `mobile-typecheck.txt` |

The mobile focused/integration failure is the baseline `V2FocusCompleteScreen entry — arrives from the ink field by default, which fades away`: expected opacity 1, received 0 under the Reanimated test environment. It was present before this task's behavioral changes and remains unmodified. New post-save, late-confirmation, navigation/blur, reservation, return, and account-switch tests pass. The separate Chart regression run passed 74 tests; these overlap the integration run and are not additional totals to add.

The full repository run began during implementation. It includes the old Progress expectation that a gallery read queues a celebration; that expectation was subsequently replaced with the requested no-login-flood contract and passes in the final focused/integration runs. Other full-mobile failures were existing navigation transition assertions, onboarding lifecycle tests whose Anchor-store mock is not callable by the existing milestone host, ChartPreview snapshots, and voice-preview volume. A separate four-file navigation rerun reproduced 11 failures / 16 passes without changes to those navigation files. No snapshots or assertions were deleted to make the suite green.

Full-backend failures are 49 legacy Anchor style byte-snapshot assertions and one live-provider Chart-planner validation failure. Those style/planner changes are outside this task; the initial checkout already contained Chart-planner edits. Whole-repository success is not claimed.

Successful local export artifacts: Android `index-c7419ead0bd115df70bf9654f8d46367.hbc`; iOS `index-5bbdbff13167f9fcabc489c550ac9c25.hbc`. Both exports include the final practice-return implementation. These are local bundles under `.tmp/`, not installed applications, device acceptance, uploaded builds, or published updates. Export warnings were existing Sentry organization/project fallback and Node color-environment notices.

Practice celebration Continue/dismiss returns through the existing practice departure callback exactly once while its source remains active. Vision/Chart automatic dismissal leaves the user on their existing board/Chart destination. Interrupted scenes do not invoke stale navigation callbacks.
