# Anchor 2.0 — UI-H — Release Experience

**Batch 3 · Agent 1**
Branch: `anchor-2/ui-h-release`
Worktree: `E:\Projects\Anchor-V2-worktrees\ui-h-release`
Baseline: `807a2ab5`

Release is an **honorable completion transition, never a deletion**. The Anchor
record is preserved forever with a `released` lifecycle; Thread Strength, Course
Log, Waypoints, and session counts remain readable. The legacy destructive
`POST /api/anchors/:id/burn` route is never called from this workstream.

---

## A. HTML REFERENCES AUDITED

| Reference | What was taken from it |
|---|---|
| `Anchor-Archive/Design-References/Anchor-2.0-Prototypes/Anchor Release Fire Prototype - Storyboard Matched.html` | Authoritative phase timeline and copy. Frames: **Resting** (context + consequences, Anchor and hold control fixed), **Commit** (0.99s, 55% fill, "Keep holding…", cancellable), **Isolation** (1.80s → 1.98s, one medium haptic, transaction submitted once, chrome fades ~180ms), **Ignition** (2.10s, single stable lower-edge contact), **Burn 25% / 65%**, **Final Ember** (4.60–4.85s), **Empty pause** (300ms pure near-black `#0B0C0D`), **Completion** (5.25s → 5.65s, soft success haptic, crossfade to `#F4F1E9`, *confirmed success required*). Reduced-Motion frames: isolate at 1.80s, fade artwork + geometry together to 2.20s, 300ms empty pause, crossfade to completion, "zero embers and no combustion". Failure/pending frames: "Release not completed / Nothing was changed / requires a new hold"; "Confirming Release — a timeout is not proof of failure … do not claim success". Accessibility announcements: "Keep holding.", "Release cancelled. Nothing was changed.", "Release committed." Consequence row fixtures: `['Anchor','Moves out of active use']`, `['Vision','Saved with this intention in history']`, `['Chart','Completed course moves to history']`, `['History','Practice and Thread history remain in Progress']`. |
| `…/Anchor Release Fire Prototype - Standalone.html` | Fire/material study: FNV1a(anchorId) deterministic ignition seed, single advancing edge, ember hooks, "Hold with a pointer, Space, or Enter for 1.8 seconds. Lift early to cancel." Confirmed the ceremony is a *consuming dissolution of one object*, not a free-standing flame or ring of light. Reduced Motion "uses the approved fade alternative." |
| `…/Anchor Release Motion Storyboard.html` | Cross-checked the same eight-frame storyboard and the "released long-lived state" / "released state" completion semantics. |
| `Design-References/Design-System-Specs/Anchor_Design_System_Living_Spec_v0_4_BRUSH_LANGUAGE_LOCKED.docx` (Sections 11 & 14) | Warm mineral canvas `#F4F1E9`, Bricolage/Figtree type roles, the "controlled dark exception" rule for ceremony surfaces. (Consumed via the already-locked `theme/v2` tokens — this workstream does not touch theme.) |

---

## B. FILES CREATED

**Constants**
- `anchor/mobile/src/constants/v2/release.ts` — route name, hold/ceremony timings traced to the storyboard, chamber colours, all user-facing copy, base consequence rows.

**Adapters** (`anchor/mobile/src/adapters/v2/release/`)
- `types.ts` — `V2ReleaseAdapter` port, `V2ReleaseRequest` (carries `idempotencyKey`), `V2ReleaseResult`, consequence-snapshot types.
- `releaseConsequences.ts` — `buildReleaseConsequenceSnapshot()`, a pure function that derives the preflight snapshot from real Anchor data; only emits Course/Vision rows when those records are actually linked.
- `releaseApiAdapter.ts` — `createV2ReleaseApiAdapter()` over the shared authenticated client; `V2_RELEASE_ENDPOINT`, `createReleaseIdempotencyKey()`. Maps HTTP outcomes → `released` / `pending` (retryable) / `failed`; treats 409 / "already released" as an idempotent success; treats offline & 5xx & timeout as retryable pending (never a destructive failure).
- `index.ts`

**Hooks** (`anchor/mobile/src/hooks/v2/release/`)
- `useReleaseHold.ts` — the 1.8s deliberate hold: progress fill, haptic crescendo (`v2Haptics.selection()` ticks → one `v2Haptics.completion()` at the top), clean cancel-on-lift with `onCancel`, `reset()` for a fresh hold.
- `useV2Release.ts` — orchestration: builds the snapshot, resolves any linked Course from `courseStore`, runs the idempotent submission (single-flight, stable key across retries), drives the `preflight → dissolving → confirming/failed → completed` stage machine, and performs **non-destructive** local reconciliation exactly once via the shared `anchorStore.releaseAnchor(id)`.
- `index.ts`

**Components** (`anchor/mobile/src/components/v2/release/`)
- `V2ReleaseConsequenceCard.tsx` — the "What releasing this Anchor means" snapshot rows with preserved/ceases/neutral tone markers.
- `V2HoldToReleaseControl.tsx` — Anchor artwork wrapped by a radial `react-native-svg` progress ring; `onPressIn`/`onPressOut` drive the hold; label flips "Hold to release" → "Keep holding…".
- `V2DissolutionCeremony.tsx` — the controlled dark Ceremony Chamber (`#0B0C0D`). Full motion: isolate → ignite → burn → final ember → 300ms empty pause → completion callback, with ≤8 short-lived embers near the object. Reduced Motion: isolate → fade artwork + geometry together → 300ms empty pause → completion, **no embers, no loops, no screen shake**. Announces "Release committed." on mount.
- `V2ReleaseCompletion.tsx` — the "Honoring what you built" celebratory moment on the warm canvas, with primary / secondary continuation actions.
- `V2ReleaseChamberStatus.tsx` — calm in-chamber panels for `confirming` (offline/timeout, honest copy, "Retry now" reuses the same key) and `failed` ("Nothing was changed", "Try again" returns to the consequence summary for a fresh hold).
- `index.ts`

**Screens** (`anchor/mobile/src/screens/v2/release/`)
- `V2ReleaseScreen.tsx` — composes the full experience; props-first with typed continuation callbacks; falls back to an empty state if the Anchor is gone.
- `releaseRoutes.ts` — `V2_RELEASE_ROUTE` / `V2_RELEASE_ROUTE_MANIFEST`, `V2ReleaseRouteParams`, `V2ReleaseContinuationCallbacks`.

**Tests**
- `anchor/mobile/src/adapters/v2/release/__tests__/releaseConsequences.test.ts`
- `anchor/mobile/src/adapters/v2/release/__tests__/releaseApiAdapter.test.ts`
- `anchor/mobile/src/hooks/v2/release/__tests__/useReleaseHold.test.ts`
- `anchor/mobile/src/hooks/v2/release/__tests__/useV2Release.test.ts`
- `anchor/mobile/src/screens/v2/release/__tests__/V2ReleaseScreen.test.tsx`

---

## C. FILES MODIFIED

- `anchor/mobile/src/screens/v2/release/index.ts` — was a placeholder (`export {}`); now re-exports `V2ReleaseScreen`, the route manifest, and the callback types. This file is inside the UI-H ownership boundary.

---

## D. SHARED FILES TOUCHED

**None.**

- No change to `navigation/v2/*`, `theme/v2/*`, `components/v2/primitives/*`, `stores/*`, `backend/*`, or any other batch's `screens/v2/*`.
- `npm run test:v2-boundary` → **V2 import boundary OK**.
- `git diff --check` → clean.
- The shared `anchorStore.releaseAnchor` and `courseStore.activeCourse` are **consumed** (read/called), never modified — permitted for V2 code per the isolation architecture.

---

## E. PREFLIGHT CONSEQUENCE MODEL

`buildReleaseConsequenceSnapshot({ anchor, linkedCourse?, hasLinkedVision? })` returns a
snapshot that always states the honorable outcome and never fabricates a linked record.

Base rows (always shown, in order):

| id | Label | Detail | Tone |
|---|---|---|---|
| `intention` | Intention | Marked complete and retired from active practice. | neutral |
| `anchor` | Anchor | Sealed into your personal history with status "released". | preserved |
| `reminders` | Daily reminders | Active reminder loops for this Anchor stop. | ceases |
| `history` | History | Thread Strength, Course Log, and session counts stay readable in Your Anchors. | preserved |

Conditional rows (inserted next to `anchor` only when the record is linked):

- `course` — "Archived with the Anchor. Reached waypoints and the full journey remain." When waypoint counts are known the detail appends "*N of M waypoints reached stay in history.*"
- `vision` — "Saved alongside this intention in history."

The linked Course is resolved in `useV2Release` from `courseStore.activeCourse` when its
`destinationAnchorLink.anchorId` (or a waypoint anchor link) matches the Anchor being
released. Vision linkage is accepted as an optional prop (`hasLinkedVision`) because it
requires an async lookup the screen's caller already performs — see
REQUIRED_INTEGRATION_CHANGES.

---

## F. HOLD-TO-RELEASE IMPLEMENTATION (1.8s)

`useReleaseHold` — `RELEASE_HOLD_DURATION_MS = 1800` (implementation value, never shown).

- `beginHold()` (wired to `Pressable.onPressIn`) records a start timestamp and starts a
  50ms sampling interval. Progress = `min(1, elapsed / 1800)`.
- **Haptic crescendo**: progress is divided into `RELEASE_HOLD_HAPTIC_STEPS = 6` bands;
  crossing a band fires `v2Haptics.selection()`. Reaching 1.0 fires a single
  `v2Haptics.completion()` pulse and calls `onComplete`.
- `onSustainStart` fires once when progress first advances past zero → the screen
  announces "Keep holding." and the control label switches to "Keep holding…".
- `endHold()` (wired to `Pressable.onPressOut`) before completion: clears the timer, sets
  progress back to `0`, fires `onCancel` (screen announces "Release cancelled. Nothing was
  changed."). **No release request is ever sent from the hold.** Reduced Motion resets
  immediately (there is no retreat animation in the hook; the visual ring simply snaps).
- Once complete the hook is inert until `reset()` — used after a definitive failure, which
  the storyboard says "requires a new hold".
- The clock is injectable (`now`) for deterministic tests.

The radial ring is drawn in `V2HoldToReleaseControl` with a `react-native-svg` `<Circle>`
using `strokeDasharray`/`strokeDashoffset`, filling around the hero-size Anchor artwork.

---

## G. DISSOLUTION CEREMONY & REDUCE MOTION PATH

`V2DissolutionCeremony` renders the controlled dark "Ceremony Chamber" (`#0B0C0D`) and
runs a `setTimeout` timeline (offsets in `constants/v2/release.ts`, condensed from the
storyboard's absolute times while preserving order and the 300ms empty pause):

**Full motion** — `isolate → ignite (300) → burnEarly (1050) → burnLate (1950) → finalEmber (2800) → emptyPause (3050) → completion callback (3450)`.
Artwork opacity eases 1 → 0.35 → 0; ≤8 small embers drift upward near the object during
the burn and thin to 3 at the final ember; the artwork is absent during the empty pause.
No travel, no scaling of the object, no free-standing flame, no screen shake.

**Reduced Motion** — `isolate → fade (120) → emptyPause (520) → completion callback (820)`.
A single opacity fade of the artwork *and its geometry together*, a 300ms empty pause,
then the crossfade. **No embers, no `Animated.loop`, no shake.** The chamber exposes
`accessibilityRole="progressbar"` / label "Releasing this Anchor" and announces "Release
committed." on mount. Verified by test: `ember-0` is never rendered and the reduced
timeline resolves in under 1s.

When the ceremony's visual timeline finishes it calls `markDissolutionComplete()`. The
screen only advances to the completion moment once **both** the ceremony has settled
**and** the server has confirmed — otherwise it shows the calm in-chamber `confirming`
panel.

---

## H. NON-DESTRUCTIVE RELEASE API INTEGRATION

- **Endpoint**: `POST /api/v2/anchors/:anchorId/release` (`V2_RELEASE_ENDPOINT`). The
  adapter asserts the URL never matches `/burn`.
- **Idempotency**: `createReleaseIdempotencyKey(anchorId)` →
  `release-<anchorId>-<ts>-<rand>`. Generated once per attempt in `useV2Release` (a ref)
  and sent verbatim on every retry of that attempt. A new key is only minted after
  `reset()` (a fresh hold).
- **Request body**: `{ idempotencyKey, reason? }`.
- **Outcome mapping**:
  - `2xx` → `released` (+ `releasedAt`, `lifecycleState`).
  - `409` / code `ANCHOR_ALREADY_RELEASED` | `ALREADY_RELEASED` | `ANCHOR_RELEASED` →
    `released` (idempotent replay is a success, not an error).
  - offline ("Network error…"), `5xx`, timeout → `pending` with `retryable: true`.
    A timeout is **never** reported as success or as "nothing changed".
  - definitive `4xx` → `failed`, `retryable: false`.
  - The adapter is contracted to **resolve, never reject**.
- **Reconciliation**: on a confirmed `released`, `useV2Release` calls the shared
  `anchorStore.releaseAnchor(anchorId)` exactly once (guarded by a ref). That store
  action is already non-destructive — it flips `isReleased`/`releasedAt`, cancels queued
  pre-release sync snapshots, and leaves the Anchor record, its history, and all Course
  events intact. No Course/Waypoint/Thread mutation happens in this workstream.

### Backend status

`backend/src/api/routes/v2/anchorLifecycleRoutes.ts` currently exposes
`POST /api/v2/anchors/:id/complete` (`IntentionCompletionService`, sets
`intentionCompletedAt`, naturally idempotent) but **no `/release` route yet** and it does
not accept an `idempotencyKey`. The mobile adapter targets the canonical `/release`
contract; wiring the backend is listed below. `ALLOW_LEGACY_DESTRUCTIVE_RELEASE` remains
`false` and untouched.

---

## I. REQUIRED_INTEGRATION_CHANGES

These belong to central-navigation / backend owners — **not done here** to respect the
ownership boundary.

1. **Register the route** in `anchor/mobile/src/navigation/v2/AnchorV2Navigator.tsx` and
   `routes.ts` / `types.ts`:
   ```ts
   import { V2ReleaseScreen, V2_RELEASE_ROUTE } from '@/screens/v2/release';
   // ANCHOR_V2_ROUTES.release = V2_RELEASE_ROUTE            // 'V2Release'
   // AnchorV2StackParamList['V2Release'] = { anchorId: string; reason?: string }
   <Stack.Screen name="V2Release" component={V2ReleaseRouteScreen} />
   ```
   with a small route wrapper that reads `route.params.anchorId` and supplies:
   ```ts
   onReleaseCompleted: (anchorId) => navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] })
     // or navigate to 'V2AnchorDetails' { anchorId } so history stays one tap away
   onCancel: () => navigation.goBack()
   ```
2. **Wire the existing entry point**: `AnchorV2Navigator.tsx`'s
   `V2PracticeRouteScreen` already has `onReleaseRequested={(_id) => { /* Handled via UI-H */ }}`.
   Point it at `navigation.navigate('V2Release', { anchorId: id, reason })`. The
   Practice route manifest already declares `onReleaseRequested(anchorId, reason?)`.
3. **Vision linkage**: pass `hasLinkedVision` into `V2ReleaseScreen` from the caller
   (e.g. `useV2Vision(anchorId).vision != null`) so the preflight snapshot can show the
   Vision consequence row. Optional; defaults to hidden.
4. **Backend** (`backend/*`, Workstream J / backend owner): add
   `POST /api/v2/anchors/:anchorId/release` to `v2/anchorLifecycleRoutes.ts` backed by a
   non-destructive service that sets `status: 'released'` + `releasedAt`, archives linked
   Course/Waypoints (no deletion), stops reminder loops, accepts and de-dupes on
   `idempotencyKey`, and returns `{ lifecycleState: 'released', releasedAt }`. Response
   shape `{ success, data }` is already handled by the adapter. Until it ships, the
   adapter will classify calls as `pending`/`failed` and the UI degrades gracefully
   (calm "Confirming release…" with retry; no false success).

---

## J. TEST RESULTS

Run in `anchor/mobile`:

| Command | Result |
|---|---|
| `npx jest --testPathPattern=release` | **5 suites / 28 tests passed** |
| `npx tsc --noEmit` | **passed** (exit 0) |
| `npm run test:v2-boundary` | **V2 import boundary OK** |
| `git diff --check` | **clean** |
| `npm test` (full mobile suite) | **191 suites passed · 1485 passed, 1 skipped** (no regressions) |

Required-scenario coverage:

| # | Scenario | Test |
|---|---|---|
| 1 | Preflight shows intention + consequence snapshot | `V2ReleaseScreen.test.tsx › preflight shows the intention…`; `releaseConsequences.test.ts` |
| 2 | Hold < 1.8s cancels & resets cleanly | `useReleaseHold.test.ts › cancels and resets cleanly…`; `V2ReleaseScreen.test.tsx › a hold shorter than 1.8s cancels` |
| 3 | Full 1.8s hold triggers submission + transition | `useReleaseHold.test.ts › completes and fires the completion haptic…`; `V2ReleaseScreen.test.tsx › completing the 1.8s hold…` |
| 4 | Submission is idempotent, never calls legacy `/burn` | `releaseApiAdapter.test.ts › targets the non-destructive V2 release endpoint and never the legacy /burn route` / `…forwards the caller-supplied idempotency key`; `useV2Release.test.ts › submits an idempotent release…` |
| 5 | Error/offline during submission allows retry without corruption | `releaseApiAdapter.test.ts › classifies an offline network error as retryable pending`; `useV2Release.test.ts › allows retry after an offline pending result, reusing the same idempotency key`; `V2ReleaseScreen.test.tsx › a definitive failure keeps the Anchor active…` |
| 6 | Reduce Motion shows accessible non-animated dissolution | `V2ReleaseScreen.test.tsx › Reduced Motion runs an accessible non-animated dissolution and reaches completion` |
| 7 | Post-release navigates / invokes `onReleaseCompleted` | `V2ReleaseScreen.test.tsx › Reduced Motion …` (asserts `onReleaseCompleted('anchor-1')` on CTA press); `useV2Release.test.ts › …completes and reconciles once` |
| 8 | V2 import boundary passes | `npm run test:v2-boundary` |

Full suite after this work: **`191 passed, 191 total` · `1485 passed, 1 skipped`** — no regressions.

---

## K. BRANCH & COMMIT HASH

- Branch: `anchor-2/ui-h-release`
- Baseline: `807a2ab5`
- Commit: <!-- COMMIT_HASH -->

---

## L. MERGE NOTES

- **Do not merge into integration** (per batch instructions). Pushed to
  `origin/anchor-2/ui-h-release` for review.
- **No conflicts expected**: every new file is under a UI-H-exclusive path
  (`{screens,components,hooks,adapters}/v2/release/*`, `constants/v2/release.ts`). The
  only edited file, `screens/v2/release/index.ts`, was an unowned placeholder.
- **Integration is inert until wired**: nothing imports `screens/v2/release` yet, so
  merging is safe even before the navigator changes in section I land. The feature is
  reachable only once `AnchorV2Navigator` registers the route and Practice's
  `onReleaseRequested` points at it.
- **Backend dependency**: the celebratory completion path requires the
  `POST /api/v2/anchors/:anchorId/release` endpoint (section I.4). Without it the UI
  stays honest — calm "Confirming release…" with retry — and never claims a false
  success or performs local reconciliation.
- No new dependencies. No migrations. No changes to feature flags or CI.
