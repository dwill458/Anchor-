# Workstream H — Stage 1 Release Gate Report

**Baseline audited:** `a9a302f96357a89b29ad5d8c656ec74d53125c78`
**Branch:** `agent/chart-workstream-h-release-gate`
**Worktree:** `E:/Projects/Anchor-worktrees/chart-h-release-gate`
**Date:** 2026-08-04
**Stage:** 1 of 2 — **Stage 2 (final A–G integration gate) NOT YET RUN.**

> Workstream G was not available at audit time. Per the H mandate, **no final
> Release GO may be issued from this report.** Stage 1 verdicts below are
> provisional and scoped to `a9a302f`.

---

## 1. Environment matrix

| Item | Value |
| --- | --- |
| Host | Windows 11 Home 10.0.26200, PowerShell + Git Bash |
| Node / npm | repo-pinned; `npm ci` clean in both packages |
| Database | Disposable PostgreSQL 16 (Railway project `anchor-chart-verify`), reached over TCP proxy |
| Devices | **None.** No Android SDK/emulator, no iOS simulator, no physical device |
| Docker | Not installed |

---

## 2. Validation totals (Part 17)

### Backend

| Command | Result |
| --- | --- |
| `npm ci` | PASS |
| `npx jest` | **PASS — 31/31 suites, 468 passed, 10 skipped (H opt-in harnesses)** |
| `npm run type-check` | PASS (exit 0) |
| `npm run build` | PASS (exit 0) |
| `npm run lint` | PASS — 0 errors, 1 pre-existing warning in `visualizationScenes.ts` (not Chart) |

### Mobile

| Command | Result |
| --- | --- |
| `npm ci` | PASS |
| `npx jest --runInBand` | **PASS — 158/158 suites, 1296 passed, 1 skipped** |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx expo export --platform android` | PASS — 12.7 MB Hermes bundle emitted |

### H-authored suites

| Suite | Result |
| --- | --- |
| Real-PostgreSQL race suite (`pgRaces.h.test.ts`) | **PASS — 7/7** |
| Privacy canary suite (`privacyCanary.h.test.ts`) | **PASS — 5/5** |
| Defect harnesses (`H_GATE_DEFECTS=1`) | **FAIL by design — 4 failing assertions pin H-001/H-002/H-003** |

> **Environment note.** A clean checkout without `backend/.env` fails 7 backend
> suites at import time on `EnvValidationError: DATABASE_URL`. This is expected
> per `CLAUDE.md` (`cp .env.example .env`), but it means any CI or reviewer
> running `npm test` without that step gets misleading evidence. Recorded as
> **H-006 (P2)**.

---

## 3. Frozen-contract traceability matrix (Part 1)

| Frozen decision | Implementation | Verified by | Result |
| --- | --- | --- | --- |
| One active Course per account | `courses_one_active_per_user` partial unique index | PG race test + `CourseService.createCourse/updateCourse` | **PASS** |
| `Course.currentWaypointId` sole authority | `courses.current_waypoint_id` + `selectNextWaypoint` | Code audit + PG completion race | **PASS** |
| No `Waypoint.status` | `waypoints` has only `reached_at`/`skipped_at`/`cancelled_at` | Live schema query on PG | **PASS** |
| Six derived waypoint states | `WaypointState` union; `buildWaypointSummary` | `src/types/chart.ts:10-16` | **PASS** |
| Atomic + idempotent completion | `runSerializable` + `CourseEvent` idempotency key | PG double-completion race → exactly 1 `WAYPOINT_REACHED` | **PASS (own-account)** / **FAIL (foreign key collision — H-002)** |
| Chart never owns Anchors | `CourseAnchorLink` join + `onDelete: SetNull` on `anchorId` | Schema audit | **PASS** |
| One primary Anchor per waypoint | `course_anchor_links_one_active_waypoint_primary` | Live schema query | **PASS** |
| Destination/waypoint role separation | `course_anchor_links_one_active_destination` + `CourseAnchorRole` | Live schema query | **PASS** |
| Release/burn blocks current waypoint | `deriveBlockedReason`, `WAYPOINT_BLOCKED` emission | Code audit | **PASS** |
| PracticeSession Chart context | `course_id`/`waypoint_id`/`practice_entry_source` nullable | PG old- and new-client write tests | **PASS** |
| One shared Reflection entity | Single `reflections` table, 5 sources | Schema + `ReflectionService` | **PASS** |
| Course Log hybrid ordering | `orderBy [occurredAt, recordedAt, id]` + cursor | `listLog` audit | **PASS** |
| No offline Course mutation | `courseStore.readOnly` when `offline` | Code audit | **PASS** |
| AI proposal-only architecture | `AIPlanProposal` → explicit `accept` → Course | Code audit | **PASS** |
| Deterministic Course Insights | `buildObservations` — counts/durations into fixed templates, no model call | Code audit | **PASS** |
| No repeated onboarding | No Chart onboarding gate present | Code audit | **PASS** |
| No inferred Course creation | Creation only via explicit `POST /` or `accept` | Code audit | **PASS** |
| No `MAKE THIS CURRENT` | Repo-wide grep: 0 hits | Grep | **PASS** |
| No `PAUSED` | Repo-wide grep: only pre-existing `practice_session_paused` analytics | Grep | **PASS** |
| Expired-history behaviour | No entitlement gate on read/complete/accept | Code audit vs F1 | **PASS** |
| Free manual-Course behaviour | Governed by the one-active index, not a planner gate | Code audit vs F1 | **PASS** |
| Default-off deployment | `chart_schema_version` defaults `0`; all flags default off | Live PG query after migration | **PASS** |
| Backend-first compatibility | Nullable Chart columns; old-client write proven | PG old-client write | **PASS** |
| `WAYPOINT_CANCELLED` (A1) | `cancelWaypoint`, snapshot `{waypointTitle}` only | Code + snapshot allowlist test | **PASS** |
| Hard-delete Anchor lifecycle + snapshots (A2) | `anchorSnapshot`, `releasedAtUnlink`, `ON DELETE SET NULL` | Schema + `stateLinkForWaypoint` | **PASS** |
| Planner amendment F1 | `PlannerEntitlementService` + `plannerPolicy` | PG quota races (5/5) | **PASS** |

**Comment-vs-behaviour check:** no frozen requirement was found to rest on a
comment alone. Snapshot allowlisting, quota caps, role separation, and the
active-Course rule are all enforced by database constraints or executable
guards.

---

## 4. Findings

### H-001 — Explicit offline Reflection save never queues; UI claims it did

- **Severity:** **P1** (escalates to P0 data loss on logout)
- **Affected commit:** `a9a302f`
- **Environment:** Mobile, Jest + `@testing-library/react-native`
- **Prerequisites:** `chart_reflections_enabled`, `courseStore.offline === true`
- **Reproduction:**
  1. Open Reflection Composer (any non-completion source), type text.
  2. Tap **Save reflection** while offline.
  3. `save()` calls `reflectionService.queueExplicitCreate(draft)` → draft persisted `saveState: 'queued'`.
  4. `setError('Saved on this device. It will sync when you're back online.')` triggers a re-render.
  5. `ReflectionComposer.tsx:100-110` recomputes the `draft` memo — its dep array includes `props`, which is a **new object on every render** — so the memo always recomputes.
  6. `ReflectionComposer.tsx:114-116` autosave effect fires `draftStore.upsert(draft)`.
  7. `reflectionDraftStore.upsert` **replaces** the record (`{...drafts, [key]: draft}`, no merge), and `draftFromProps` hard-codes `saveState: 'draft'`, `retryCount: 0`, plus a **freshly generated `idempotencyKey`**.
- **Expected:** draft stays `queued` with a stable idempotency key so `flushQueuedCreates` sends it on reconnect (Part 12: "explicit offline Reflection create queues once", "queued create preserves idempotency", "offline UI does not claim success").
- **Actual:** `saveState` reverts to `'draft'` within one render. `ReflectionService.flushQueuedCreates` skips anything not exactly `'queued'`, so the reflection is **never sent**. The success message is false.
- **Escalation:** `clearAccount` / `purgeReflectionDraftsForAccount` wipes the encrypted draft store on logout and account switch. A user who saves offline and then logs out **permanently loses** writing the app said was saved.
- **Frozen requirement:** Part 12 offline/recovery contract.
- **Evidence:** `anchor/mobile/src/__h_gate__/offlineReflectionQueue.h.test.tsx` — `Expected: "queued" / Received: "draft"`.
- **Suspected owner:** Workstream E/G (reflection composer + draft store).
- **Proposed narrow remediation:** in `ReflectionComposer`, exclude `props` from the `draft` memo dependency list (depend on the specific fields), and make the autosave effect preserve an existing `queued`/`failed` `saveState` and `idempotencyKey` rather than overwriting them — e.g. have `upsert` merge `saveState`, `retryCount`, and `idempotencyKey` from the stored record when the incoming draft is a plain autosave.
- **Verification status:** OPEN — reproduced, not fixed.

### H-002 — `completeWaypoint` replay skips ownership check: false success + foreign event id

- **Severity:** **P1**
- **Affected commit:** `a9a302f`
- **Environment:** Backend, Jest with mocked Prisma
- **Prerequisites:** a `CourseEvent` already exists whose `idempotencyKey` equals `chart:waypoint-complete:<clientKey>:reached`. `CourseEvent.idempotencyKey` is **globally unique** (`schema.prisma:482`) and `<clientKey>` is client-supplied (`courses.ts:16`, 1–200 chars).
- **Reproduction:** call `POST /api/courses/:courseId/waypoints/:waypointId/complete` with an `idempotencyKey` that collides with another account's completion event.
- **Expected:** typed safe denial (`IDEMPOTENCY_CONFLICT`), as `CourseEventService.append` (`CourseEventService.ts:85-93`) and `cancelWaypoint` (`CourseService.ts:987-997`) both already do.
- **Actual:** `CourseService.ts:786-813` returns early on the raw `findUnique` hit with **no** `userId` / `courseId` / `waypointId` check, so `append`'s guard never runs. Caller receives HTTP 200 with `replayed: true`, `completionEventId` set to the **other account's CourseEvent UUID**, and `completedWaypoint` derived from their own still-unreached (here `BLOCKED`) waypoint. The waypoint is not completed but the client is told it was.
- **Frozen requirement:** atomic and idempotent waypoint completion; object-level authorization with typed safe denial and no existence leak.
- **Evidence:** `backend/src/__h_gate__/waypointReplayOwnership.h.test.ts` — `Expected: not "foreign-event-id"`.
- **Suspected owner:** Workstream A/B (CourseService).
- **Proposed narrow remediation:** in `completeWaypoint`, after the `findUnique`, throw `IDEMPOTENCY_CONFLICT` unless `existing.userId === userId && existing.courseId === courseId && existing.waypointId === waypointId && existing.eventType === WAYPOINT_REACHED` — the exact guard `cancelWaypoint` already uses.
- **Verification status:** OPEN — reproduced, not fixed.

### H-003 — `skipWaypoint` replay skips ownership check: silent no-op reported as success

- **Severity:** **P1**
- **Affected commit:** `a9a302f`
- **Reproduction:** as H-002, against `.../skip`.
- **Expected:** `IDEMPOTENCY_CONFLICT`.
- **Actual:** `CourseService.ts:1057-1060` — `if (existing) return projection(await findCourse(tx, userId, courseId));`. Resolves 200 with the caller's **unchanged** course. No skip is performed; no error is surfaced. Same-account key reuse across two different waypoints silently swallows the second skip.
- **Evidence:** same harness — `Received promise resolved instead of rejected`, resolved value shows `waypoint-current` still `state: "BLOCKED"`, `skippedAt: null`.
- **Suspected owner:** Workstream A/B.
- **Proposed narrow remediation:** apply the same four-field guard in `transitionWaypoint`.
- **Verification status:** OPEN — reproduced, not fixed.

### H-004 — Chart rollback script silently destroys all Reflection text

- **Severity:** **P1** (P0 if referenced by a production runbook)
- **File:** `backend/prisma/migrations/ROLLBACK_20260802000000_add_chart_backend_foundation.sql`
- **Reproduction:** seeded a Reflection containing `H-CANARY-REFLECTION-TEXT-9f3a`, ran the rollback, then re-applied the migration. Post-reapply `SELECT count(*) FROM reflections` → **0**.
- **Expected (Part 14):** rollback preserves Chart data; "no forced deletion".
- **Actual:** the script `DROP TABLE`s `reflections`, `courses`, `waypoints`, `course_events`, `course_anchor_links`, `ai_plan_proposals` unconditionally. Reflection text is unrecoverable. The header reads as production-intended ("Run only after stopping application writes"); only a trailing comment mentions "the disposable database". There is **no** guard, confirmation, or backup step.
- **Aggravating factor:** no runbook anywhere in `docs/` references this file, so there is currently **no documented Chart rollback procedure at all** — an operator improvising during an incident is the likely path to running it.
- **Suspected owner:** Workstream A (migration author) + G (release runbook).
- **Proposed narrow remediation:** (a) add a prominent header stating this is a destructive developer-only script that permanently deletes user reflections; (b) require an explicit opt-in (e.g. `\if :{?H_CONFIRM_DESTRUCTIVE_CHART_ROLLBACK}`); (c) document the **flag-based** rollback (§6 below) as the production path.
- **Verification status:** OPEN.

### H-005 — AI plan proposals absent from account data export

- **Severity:** **P2**
- **Detail:** `GET /api/auth/me/export` exports `courses, waypoints, courseAnchorLinks, reflections, courseEvents` but **not** `aIPlanProposal`. Account deletion *does* cover it (`auth.ts:1124`).
- **Expected (Part 15):** export verified for generated / accepted / stale proposals.
- **Mitigating:** proposals are transient (30-min TTL, purged 7 days after expiry).
- **Proposed remediation:** add `prisma.aIPlanProposal.findMany({ where: { userId } })` to the export payload, or record a documented, privacy-reviewed decision to exclude transient proposals.
- **Verification status:** OPEN.

### H-006 — Backend suite fails 7 suites without `.env`

- **Severity:** **P2**
- **Detail:** `EnvValidationError: Required environment variable DATABASE_URL` at module import in 7 suites. Expected per `CLAUDE.md`, but it makes an unqualified `npm test` produce misleading evidence.
- **Proposed remediation:** add a `jest.setup` that supplies test-safe defaults, or document the `cp .env.example .env` prerequisite in the backend test script output.

### H-007 — Cache-hydration failure logs the raw error object

- **Severity:** **P2** (defence-in-depth; no production exposure)
- **Detail:** `courseStore.ts:133` — `logger.warn('[courseStore] Failed to hydrate Chart cache', error)`. On a corrupt cache the error is a `SyntaxError` from `JSON.parse`, whose V8/Hermes message can embed a fragment of the parsed string, i.e. `destinationText` / waypoint titles.
- **Mitigating:** `logger` is gated on `__DEV__ && debugLoggingEnabled`; production Android export emits nothing. Verified: the message strings survive into the Hermes bundle but the call is runtime-gated.
- **Proposed remediation:** log a structural discriminator only (e.g. `error instanceof SyntaxError ? 'parse_error' : 'io_error'`).

---

## 5. Section results

### Security (Part 2)

Every Chart route resolves the account server-side from `req.user.uid` →
`prisma.user.findUnique({ where: { authUid } })`; no route accepts a client
`userId`. All service reads are scoped (`findFirst({ id, userId })`).
Cross-account read/edit/delete/archive/restore/complete/link/reflect/retrieve/
accept paths all deny via `COURSE_NOT_FOUND` / `REFLECTION_NOT_FOUND` /
`PRACTICE_SESSION_ACCOUNT_MISMATCH` without existence leaks.

**Exception:** the idempotency-replay paths in H-002/H-003 bypass the ownership
guard and leak a foreign `CourseEvent` id. `ReflectionService.create`,
`cancelWaypoint`, `CourseEventService.append`, and `CoursePlannerService.generate`
all implement the guard correctly — the two defects are inconsistencies, not a
systemic gap.

Input validation is strict Zod with `.strict()` everywhere, bounded lengths
(destination 140, title 60, description 400, reflection 1000, structured 2000),
`max(7)` waypoints, and coerced/bounded pagination. Unknown keys, unknown enum
values, deep nesting, and oversized arrays are rejected.

**Verdict: NO-GO** — H-002/H-003 are open P1s.

### Real PostgreSQL (Part 3)

7/7 race tests pass against real PostgreSQL 16 under `Serializable`:

| Race | Result |
| --- | --- |
| Two trial requests for the 3rd lifetime slot | 1 fulfilled, 1 `PLANNER_QUOTA_EXCEEDED`, final count exactly 3 |
| 4th trial generation | Denied, persists nothing |
| Two Pro requests for the 10th rolling-day slot | 1 fulfilled, final count exactly 10 |
| 3 concurrent duplicate idempotency keys | 3 fulfilled, **1** proposal, **1** unit consumed |
| Replay after quota exhaustion | Returns original proposal; count unchanged |
| Two concurrent Course publishes | 1 fulfilled; exactly 1 ACTIVE course |
| Double waypoint completion (same key) | Exactly 1 `WAYPOINT_REACHED`; `reachedAt` set |

Deterministic fallback was exercised throughout (no provider key), confirming
F1's "a persisted fallback consumes one unit". RevenueCat returned 401 and the
service correctly fell back to persisted status, logging only `appUserId` + HTTP
status — no private text.

**Not executed:** skip-vs-complete, cancel-vs-complete, archive-vs-completion,
burn-vs-completion, replace-vs-burn, restore/delete conflict races.

**Verdict: PARTIAL** — quota and active-Course races proven; lifecycle-conflict races outstanding.

### Migration (Part 3)

Full cycle executed on real PostgreSQL:

1. Pre-Chart baseline — 0 Chart tables, 3 core tables, seeded user/anchor/session. **PASS**
2. Chart migration forward — 6 tables created; pre-Chart session preserved with NULL Chart columns; `chart_schema_version` default `0`. **PASS**
3. Old-client PracticeSession write post-migration — **PASS**
4. New-client write with `practice_entry_source='chart_waypoint_detail'` — round-trips verbatim. **PASS**
5. Rollback — 6 Chart tables dropped; users/anchors/practice_sessions **all preserved**; old-client write still works. **PASS (with H-004)**
6. Reapply — clean; 4 sessions intact. **PASS**

Migration failure leaves Sanctuary and Practice fully usable. **Proven.**

**Verdict: GO** (H-004 is a rollback-artifact safety issue, not a migration correctness issue).

### Privacy (Part 4)

5/5 canary tests pass. Verified:

- `errorHandler` logs only `{path, method, code}` — never message or stack (`errorHandler.ts:48-53`).
- Raw internal errors never reach the client (`'An unexpected error occurred'`).
- `CourseEvent` snapshots are allowlisted to 10 keys, reject anything else, and are size-capped at 512 bytes.
- Sentry `beforeSend` deletes `event.request.data` wholesale, reduces `event.user` to `id`, and key-scrubs headers/extra.
- Deep links and `chartContext` carry **IDs only** — `normalizeChartPracticeContext` rejects anything that is not a safe identifier plus the frozen entry source.
- Only 3 log call sites exist across all Chart code (2 mobile, 1 backend); the backend one logs IDs only.
- Zero Chart analytics events exist, so no analytics leak surface exists yet.

**Residual gap:** `event.exception.values[].value` is scrubbed only for
emails/bearer/token patterns, so a driver or validation message embedding user
text would survive to Sentry. No such path was found in Chart code today, but it
is not structurally prevented. Tracked with H-007 as defence-in-depth.

**Verdict: GO for `a9a302f`** — must be re-run against G's analytics catalog.

### Analytics (Part 5)

**NOT EXECUTED — no Chart analytics events exist at baseline.** Repo-wide search
of `AnalyticsService` and all Chart source found zero Chart event names in either
package. The event catalog is a Workstream G deliverable. **DEFERRED.**

### Sentry / logging (Part 6)

Covered under Privacy above. Built Android bundle scanned: the two `courseStore`
log strings survive minification but the calls are `__DEV__`-gated, so production
emits nothing. No Chart-introduced debug logging is active in the built output.

**Verdict: GO for `a9a302f`.**

### Notifications (Part 7)

No Chart notification code path exists — only flag plumbing
(`chart_notifications_enabled`, default `false`). Searched
`src/services/notifications/` for any Chart reference: none. No accidental path
exists, so nothing can leak reflection/destination/waypoint text or open another
account's Course.

**Verdict: DEFERRED, not failed** — correct per the H mandate.

### Accessibility (Part 8) — static only

Verified from source:

- **CourseMap is correctly hidden from the a11y tree** — `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` on `CourseMap`, `WaypointNode`, and both `MiniRoute` branches.
- **`LinearWaypointList` is the comprehension surface** and announces position, title, state, anchor availability, and blocked reason in one label (`chartUi.tsx:122`).
- **Touch targets all ≥44px**: button `minHeight: 48`, waypoint row `68`, retry `44`.
- `ChartButton` sets role/label/hint; `Pressable` supplies `accessibilityState.disabled`.
- Live regions present for errors (`assertive`) and sync status (`polite`).
- Reflection input has an explicit `accessibilityLabel`; counter is a polite live region.

Minor gaps (P2, not filed individually): the `dates` string is rendered visually
but omitted from the row's a11y label; the current row conveys state through its
label text rather than `accessibilityState.selected`; `LinearWaypointList`'s
container label sits on a non-`accessible` `View` (no-op on iOS).

**NOT EXECUTED:** VoiceOver, TalkBack, keyboard navigation, screen magnification,
increased contrast, and all Dynamic Type sizing (clipping, overlap, truncation,
mood-picker wrapping, CTA obstruction). No device available.

**Verdict: NO-GO — insufficient evidence.**

### Reduced motion (Part 9) — static only

- Halo: `reducedMotion` short-circuits to a static `opacity 0.55, scale 1`; no `withRepeat` starts.
- Route advancement: `useCourseMapAdvancement` returns `IDLE` immediately, no transient animating phase.
- Route segment illumination and waypoint settle both gated.
- Animations run as Reanimated worklets (UI thread), not JS-thread.
- Reduced motion affects only presentation — no business state, no skipped server validation.
- Blocked waypoints never animate (`resolveSafeAdvancement`).

**NOT EXECUTED:** on-device confirmation with the OS reduce-motion setting.

**Verdict: PROVISIONAL PASS, unconfirmed on device.**

### Performance (Part 11)

**NOT EXECUTED.** No low-end Android target available. Frame rates, dropped
frames, render counts, memory growth, CPU during continuous halo, startup deltas,
Course Log pagination cost, and draft-write typing latency are all unmeasured.

Static observations only: halo runs off-thread via Reanimated; advancement
dedupes by `eventId`; Course Log is cursor-paginated with `limit ≤ 100` (not
unbounded). **H-001's** memo-recompute-per-render also means the encrypted draft
store is written on every keystroke render — a plausible typing-stall source that
must be measured once fixed.

**Verdict: NO-GO — insufficient evidence.**

### Offline and recovery (Part 12)

- Cached Course reads offline: **PASS** (`readCache` + `normalizeSnapshot`, account-scoped, schema-versioned).
- No offline Course mutation: **PASS** (`updateReadOnly` forces read-only when offline).
- Drafts stored encrypted, never plaintext AsyncStorage: **PASS** (existing test proves no fallback).
- Account switch discards prior-account drafts: **PASS** (`bindAccount` clears synchronously *before* awaiting I/O).
- Deleted Reflection cannot resurrect: **PASS** (tombstone honoured on replay; `create` returns the tombstone).
- **Explicit offline create queues once: FAIL — H-001.**
- Reconnect flush refuses on account mismatch and drops the draft rather than replaying: **PASS**.

**Verdict: NO-GO — H-001.**

### Entitlements (Part 13)

| State | Requirement | Result |
| --- | --- | --- |
| Free | No AI generation | **PASS** — cap 0, `not_entitled` |
| Free | One manual Course | **PASS** — enforced by the one-active index |
| Trial | 3 lifetime persisted proposals | **PASS** — PG-proven |
| Trial | 4th denied | **PASS** — PG-proven |
| Trial | Retries count once | **PASS** — PG-proven (3 concurrent dupes → 1 unit) |
| Trial | Fallback counts once when persisted | **PASS** — every PG test used the fallback path |
| Pro | 10 per rolling UTC day | **PASS** — PG-proven |
| Pro | Cap-edge concurrency | **PASS** — PG-proven |
| Expired | History visible, no new generation | **PASS** — no entitlement gate on reads; cap 0 |
| Expired | Eligible proposal acceptance | **PASS** — `accept()` deliberately has no entitlement check, per F1 |
| Unknown | Fails closed | **PASS** — `resolvePlannerEntitlement` returns `null` → `entitlement_unavailable` |
| Missing config | Fails closed, no provider call | **PASS** — `resolvePlannerQuotaConfig()` null → denial before `generateWithProvider` |

Enforcement is inside the serializable transaction (`CoursePlannerService.ts:304-316`),
not merely the pre-check — the pre-check only avoids a wasted provider call.
Caps are server constants; a present-but-unparseable env override returns `null`
rather than silently defaulting. Rate limiting is a separate 20/hr control.

**Verdict: GO.**

### Flags and rollback (Part 14)

Flag composition is correct and fail-closed: every `require*` helper requires
`chart_enabled` **and** its specific flag; mobile `resolveChartFeatureFlags`
ANDs the build flag with `server.<flag> === true`, so a missing/malformed server
value resolves to `false`. Default state is all-off with `chart_schema_version 0`.

Rollback proven at the database level (see Migration). Sanctuary, Practice, and
old-client Practice writes all survive.

**NOT EXECUTED:** rollout 0/partial/100, emergency kill switch, stale capability
cache, capability change mid-session, flag disabled after Chart practice /
after proposal generation / before acceptance. These depend on G's rollout layer.

**Verdict: PARTIAL — DB rollback GO; flag rollback DEFERRED to G.**

### Export and deletion (Part 15)

- Export includes courses, waypoints, courseAnchorLinks, reflections, courseEvents. **PASS**
- Export omits `aIPlanProposal`. **H-005 (P2)**
- Deletion removes reflections → proposals → courses in one transaction, all `userId`-scoped; waypoints/events/links cascade. **PASS**
- Cascade rules verified: all Chart tables `onDelete: Cascade` from `User`; Anchor FKs `SetNull` per A2. **PASS**

**Verdict: GO with H-005 outstanding.**

### Clean-install reproducibility (Part 16)

`npm ci` succeeded cleanly in both packages from this fresh worktree; type-check,
Jest, Android export, backend install/test/build all pass. **G's patch script
does not exist at this baseline**, so patch idempotency and its
fail-safe-on-unknown-source behaviour are **DEFERRED to Stage 2.**

---

## 6. Recommended production rollback procedure

Chart's production rollback is **flag-based, not schema-based**. Never run
`ROLLBACK_20260802000000_*.sql` against production (see H-004).

| Step | Switch | Expected behaviour |
| --- | --- | --- |
| 1. Kill generation only | `ENABLE_CHART_AI_PLANNER=false` | `PLANNER_UNAVAILABLE`/`FEATURE_DISABLED`; existing proposals and Courses unaffected |
| 2. Kill reflection writes | `ENABLE_CHART_REFLECTIONS=false` | Composer shows read-only notice; Course Log stays readable |
| 3. Freeze all Chart writes | `ENABLE_CHART_WRITE=false` | Reads continue; all mutations `403 FEATURE_DISABLED` |
| 4. Full kill switch | `ENABLE_CHART=false` | Every Chart route `403`; mobile flags resolve false; Chart surfaces hide |

At every step: Sanctuary and Practice remain fully available, existing Practice
completion is unaffected, old clients keep writing schema-compatible
PracticeSessions, all Chart rows are preserved, and nothing is deleted. Recovery
is re-enabling the flag; no data migration is required.

---

## 7. Stage 1 verdicts

| Gate | Verdict | Basis |
| --- | --- | --- |
| Security | **NO-GO** | H-002, H-003 (P1) |
| Privacy | **GO (provisional)** | 5/5 canaries; must re-run against G's analytics |
| Accessibility | **NO-GO** | No device evidence; Dynamic Type unverified |
| Performance | **NO-GO** | Not measured |
| Migration | **GO** | Full forward/rollback/reapply proven on real PostgreSQL |
| Rollback | **PARTIAL** | DB rollback proven; H-004 open; flag rollback deferred to G |
| Entitlements | **GO** | F1 fully proven on real PostgreSQL |
| Analytics | **DEFERRED** | No Chart events exist at baseline |
| **Release** | **NO-GO** | 4 open P1 findings; G not audited; Parts 5, 10, 11, 16 not executed |

**Open findings:** P0 — 0. P1 — 4 (H-001, H-002, H-003, H-004). P2 — 3 (H-005, H-006, H-007).
**Remediated:** none (Stage 1 is audit-only; H does not fix production code).

---

## 8. Stage 2 entry criteria

1. G supplies a validated A–G integration commit.
2. Reset this branch to that commit (or create a new clean worktree from it).
3. Re-run the entire gate from scratch — a Stage 1 pass is not a release pass.
4. Additionally execute: analytics catalog verification (Part 5), device matrix
   (Part 10), measured performance (Part 11), flag/rollout/kill-switch matrix
   (Part 14), patch-script reproducibility (Part 16), and the outstanding
   lifecycle-conflict races (Part 3).
5. Confirm H-001…H-004 fixes by the owning workstreams and re-run the defect
   harnesses with `H_GATE_DEFECTS=1` — all four must go green.

---

## 9. H-authored artifacts (test-only)

| Path | Purpose |
| --- | --- |
| `backend/src/__h_gate__/pgRaces.h.test.ts` | Real-PostgreSQL race suite; opt-in via `H_PG_DATABASE_URL` |
| `backend/src/__h_gate__/privacyCanary.h.test.ts` | Privacy canary suite; always runs |
| `backend/src/__h_gate__/waypointReplayOwnership.h.test.ts` | Pins H-002/H-003; opt-in via `H_GATE_DEFECTS=1` |
| `backend/src/__h_gate__/query.js` | Raw read helper for the verification database |
| `backend/src/__h_gate__/seedPreChart.js` | Pre-Chart seed for the migration test |
| `anchor/mobile/src/__h_gate__/offlineReflectionQueue.h.test.tsx` | Pins H-001; opt-in via `H_GATE_DEFECTS=1` |

No production file was modified by Workstream H.

### Reproducing the PostgreSQL suite

```bash
# Provision a disposable instance (Railway shown; any PG 16 works)
railway tcp-proxy create --port 5432 --service Postgres
export H_PG_DATABASE_URL="postgresql://<user>:<pass>@<proxy-host>:<port>/railway"
export DATABASE_URL="$H_PG_DATABASE_URL"

cd backend
npx prisma migrate deploy
npx jest src/__h_gate__/pgRaces.h.test.ts --runInBand

# Defect harnesses (expected to fail until H-001..H-003 are fixed)
H_GATE_DEFECTS=1 npx jest src/__h_gate__/waypointReplayOwnership.h.test.ts
cd ../anchor/mobile && H_GATE_DEFECTS=1 npx jest src/__h_gate__/
```
