# Chart Phase 0 — Confirmation of D2b, D7, D8, D9

Status: confirmation pass complete
Captured: 2026-08-05
Scope: the four decisions the gap report listed as "recommendation on record, needs
confirmation". Evidence review plus focused tests where the behavior is already
determined. No Chart screens or components were created.

Each item below answers four questions: what behavior is recommended, what
evidence supports it, whether it conflicts with any frozen contract, and what —
if anything — still needs a product answer.

---

## D2b — Is a Course-completion reflection required, and must it be atomic with completion?

### Recommended behavior

**Optional, and separately attachable.** A Course completes when the server says
it completed. A reflection may be added afterwards through the ordinary
`POST /api/reflections` path with `source: COURSE_COMPLETION`. It is not required,
and it is not part of the completion transaction.

### Evidence

| Source | What it shows |
|---|---|
| [Destination reached](phase-0-references/destination-reached-1024x1000.png) | The completion surface has **no reflection form at all**. Its only controls are `VIEW THE JOURNEY` and `Plot what comes next`. Nothing gates the celebration behind input. |
| [Waypoint reached ceremony](phase-0-references/waypoint-reached-ceremony-1024x1000.png) | The reflection that *is* prompted — the waypoint one — renders `Optional` placeholders and a `Skip reflection` control. Optionality is the established pattern for Chart reflections (decision D2a). |
| `ReflectionService` / `ReflectionSource.COURSE_COMPLETION` | The source exists and is accepted (Course only, no waypoint, no practice session), created by a separate `POST /api/reflections`. Nothing binds it to `COURSE_COMPLETED`. |
| `CourseCompletionScreen.tsx` | Renders only after the server reports `COMPLETED` and blocks back navigation before verification. |
| `coursesContract.test.ts` | Reflection create/update/soft-delete, flag and migration fail-closed, and the rule that an update cannot re-bind a reflection's `courseId`. |

### Conflicts with frozen contracts

None. The integrity requirement the atomic option would buy — "completion may
render only after server confirmation" — is already met by `CourseCompletionScreen`
plus the `COURSE_COMPLETED` event, which *is* written inside the completion
transaction. Making the reflection required would need a new transactional path
that does not exist, and would contradict the only capture of the completion
surface.

### Status

**CLOSED.** The recommendation is what the code does and what the only available
mockup shows; the alternative is contradicted by that mockup. Recorded as a
confirmation, not a change — no code was modified for D2b.

Residual, non-blocking: the destination-reached capture shows no entry point for
a course-completion reflection at all, so *where* a user attaches one is a
surface question for D5. Phase 1 can ship the completion screen without it.

---

## D7 — Chart analytics event names and approved properties

### Recommended behavior

Two separable halves.

- **The privacy rule** — Chart analytics may carry opaque IDs only. Course
  destinations, waypoint titles, and reflection content never leave the device.
  This is settled and now enforced by test.
- **The event taxonomy** — the list of Chart event names and each one's
  properties. This is not settled and cannot be derived from anything in the
  repository or the captures.

### Evidence

| Source | What it shows |
|---|---|
| `SENSITIVE_PROPERTY_KEYS` in `AnalyticsService.ts` | Already blocks `destination_text`, `destination`, `waypoint_title`, `reflection`, `reflection_body`, `structured_content`, `what_helped`, `what_learned`, in both snake and camel spellings, at any nesting depth. |
| `PHASE_0_GAP_REPORT.md` risk register | Rates private-reflection leakage as **High**, mitigated by keeping payloads out of analytics and logs. |
| `practice_session_completed` | The only event carrying Chart properties today, and it carries IDs only. |

### Correction made in this pass

The closure document claimed the extended blocklist was "extended and tested".
The extension was real; **the test was not**. `AnalyticsService.test.ts` had no
Chart coverage, and neither did the Chart practice suites. Two tests were added:
one asserting every Chart free-text key is stripped while opaque IDs
(`course_id`, `waypoint_id`, `course_version`, `waypoint_state`) survive, and one
asserting the same holds for free text nested inside a practice-session payload.

The privacy rule is now enforced independently of which event names are approved,
so approving the taxonomy later cannot reopen it.

### Conflicts with frozen contracts

None found. The rule is strictly narrowing.

### Status

**PARTIALLY CLOSED.** Privacy rule closed and enforced by test. Taxonomy blocked.

**Exact decision needed:** the approved list of Chart event names, and for each
one, its non-sensitive properties. Anchor's existing convention is
`snake_case` verb-phrase names (`app_opened`, `practice_session_completed`), which
constrains the shape but not the contents. Nothing else in the repository
constrains it, so it is not inferable and was not guessed.

This does not block Phase 1 implementation: the privacy gate holds for any event
emitted, so surfaces can be built and instrumented once the names are approved.

---

## D8 — Is AI plan review in Phase 1?

### Recommended behavior

**No. Keep `chart_ai_planner_enabled` off and leave `AIPlanReview` a placeholder.**

### Evidence

| Source | What it shows |
|---|---|
| `PHASE_0_CONTRACT_FREEZE.md` | "Course feature flags — **FROZEN OFF**. No Chart flags are enabled by Workstream A." |
| `ChartStackNavigator.tsx` | `AIPlanReview` is registered to `ChartPlaceholderScreen`, which renders "AI planning is not available in this shell yet." |
| `DEFAULT_CHART_FEATURE_FLAGS` | `chart_ai_planner_enabled: false`, with a build-time backstop that can only be more restrictive than the server. |
| `PHASE_0_VISUAL_SPEC.md` | Plan generation, persistence, versioning, and failure behavior are all listed as unspecified. |

### Conflicts with frozen contracts

Deferral conflicts with nothing — it is the current frozen state. The *opposite*
choice is what would conflict: shipping AI plan review in Phase 1 would require a
plan generation/persistence/versioning/failure contract that does not exist, plus
turning on a flag the contract freeze holds off.

### Tests added

`chartFlags.test.ts` now pins that the planner flag is off by default, stays off
when the server sends no flags or an empty payload, and is **not** implied by
enabling Chart itself — plus that every Chart flag defaults to false. Enabling AI
planning now has to be a deliberate act with a contract behind it.

### Status

**CLOSED for the Phase 0 gate.** Deferral is the default state, it is pinned by
test, and nothing in Phase 1 is blocked by it. Adding AI plan review later is a
new contract and a new decision, not a Phase 0 prerequisite.

---

## D9 — What does "Plot what comes next" do when a live Course already exists?

### Recommended behavior

**The situation does not arise in the frozen V1 surface set, and no new UX is
needed to prevent it.** Every control that leads to Course setup is already
scoped to a state where no live Course exists.

### Evidence

| Source | What it shows |
|---|---|
| `courses_one_active_per_user` | `CREATE UNIQUE INDEX ... ON "courses" ("user_id") WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL`. The database is the authority. A `COMPLETED` or `ARCHIVED` Course does **not** occupy the slot. |
| `CourseService` | `ACTIVE_COURSE_EXISTS` is raised on create, update/publish, and restore. The application pre-check only improves the error; the index is what enforces it. |
| [Destination reached](phase-0-references/destination-reached-1024x1000.png) | `Plot what comes next` appears **only on a COMPLETED Course**. At that moment there is no live Course and the pointer is null, so the invariant is not in tension. |
| [Course switcher sheet](phase-0-references/course-switcher-sheet-1024x1000.png) | `Plot a new course` appears only in the `YOUR CHARTS` switcher — the surface the frozen contract **removes from V1** ("One live Course; no paused/multiple-live switcher"). |
| `ChartHomeScreen.tsx` | `Plot Your Course` renders only when there is no Course at all; `Plot What Comes Next` renders only in the `isCompleted` branch. Neither is reachable while a Course is `ACTIVE`. |

So the one prototype affordance that could have created a second live Course
while one exists is already deleted by the contract freeze, and the one that
survives lives on a Course that has finished.

### Conflicts with frozen contracts

None. This *is* the frozen contract, verified against the surface set rather than
assumed.

### Tests added

A `One live Course` block in `CourseServiceContract.test.ts`: publishing a draft
while another Course is `ACTIVE` is refused with `ACTIVE_COURSE_EXISTS` and
writes nothing; publishing succeeds when no other Course is active and sets the
pointer to the first waypoint; restoring a Course that was archived *from ACTIVE*
is refused while another is live; the active-Course check is scoped to the owner
and excludes the Course being published; and publishing a Course with no
non-terminal waypoint is refused.

### Status

**CLOSED.** Mechanism and V1 surface behavior are both determined by evidence.

Residual, non-blocking: there is no affordance for abandoning a live Course to
start a new one. The path exists — Manage Course → archive → plot — but it is not
signposted. Whether to add an explicit "replace this course" shortcut is a Phase
1+ product nicety, not a Phase 0 prerequisite, and adding one later cannot
violate the invariant because the database enforces it.

---

## Summary

| Item | Status | What remains |
|---|---|---|
| **D2b** — Course-completion reflection semantics | `CLOSED` | Nothing. Where a completion reflection is offered is a D5 surface question. |
| **D7** — Chart analytics taxonomy | `PARTIALLY CLOSED` | Privacy rule closed and now enforced by test. **Approved event names and their properties still required.** Does not block Phase 1 implementation. |
| **D8** — AI plan review in Phase 1 | `CLOSED` | Nothing. Deferred, pinned by test; enabling it later is a new contract. |
| **D9** — "Plot what comes next" and one live Course | `CLOSED` | Nothing blocking. An explicit "replace this course" shortcut is optional Phase 1+ polish. |

Tests added in this pass: 5 backend (`One live Course`), 2 mobile analytics
privacy, 2 mobile flag defaults. All pass.
