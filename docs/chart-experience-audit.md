# Chart experience audit and completion

Branch: `feat/vision-conversational-creation-20261020` · Audit date: 2026-10-24 · Scope: the 11-screen Chart reference.

This document is the pre-implementation audit required by the brief. Section G at the end records what was changed afterwards
and what was verified. Every claim in A–F comes from reading the code in the working tree; where a claim rests on an earlier
report (for example `docs/ASK_CHART_IMPLEMENTATION_PLAN.md`) it says so.

## Headline

The brief assumes Ask Chart, the cream creation conversation and the AI-to-Chart action workflow are largely missing. They are
not. They were built in earlier passes (backend `services/chart/ask/*`, mobile `components/v2/chart/ask/*`, migration
`20261021200000_ask_chart`, committed in `c370cfcd8`) and the starting-photo screen is already deleted. The real gaps are
narrower and are listed in section C. The two that matter most to the "one cohesive experience" goal are the navy sheet
hierarchy (still "One move this week", a generic anchor icon, no Thread Strength, no clear route entry) and the action loop
(proposals can only add moves or revise the whole route; the person cannot edit a proposal; the confirmation leaves the
conversation).

---

## A. Current architecture

### A.1 Mobile (`anchor/mobile/src`)

| Concern | Implementation | Status |
|---|---|---|
| Entrance | `components/v2/chart/ChartIntroOpening.tsx`, copy `CHART_COPY.empty` | Working. Locked. |
| Creation flow | `components/v2/chart/ChartCreationFlow.tsx` phases `intro → ask → generating → review ⇄ adjusting → revealed` (+ `failed`) | Working. `ChartContextStep`, `ChartRealityInput` and the follow-up sheet no longer exist. |
| Creation conversation | `components/v2/chart/ask/ChartCreationAsk.tsx` → shared `AskChartView`; `hooks/v2/chart/useAskChart.ts` + pure reducer `askChartState.ts` | Working. Hands `AskPlanInput` to the existing `POST /chart/plan`. |
| Ongoing Ask Chart | `screens/v2/chart/V2ChartAskScreen.tsx` (route `V2ChartAsk`), `useAskProposals`, `AskProposalCard`, `AskSettingsSheet`, `useAskProfile` | Working. No skill entry points, no waypoint context. |
| Media | `useAskMedia`, `AskComposer`, `AskAttachSheet`, `AskAttachments`, `AskVoiceRecorder`, `useAskDictation`, `useAskAttachments` | Working (device-unverified per earlier report). |
| Avatar | `ask/AskAnchorAvatar.tsx` → `components/v2/anchor/CircularAnchorRenderer` with `anchorArt` from `useChartContext` (`anchorRenderProps(anchor)`) | Correct: the user's real SVG. |
| Route review | `ChartCourseReviewScreen`, `ChartRouteEditor`, `ChartAdjustPanel`, `V2ChartAdjustScreen` | Working. Reused. |
| Reveal / map / fog | `ChartGenerationStage`, `map/*`, `ChartLandscape` | Locked. Not touched. |
| Navy sheet | `sheet/ChartSheet` (detents peek/half/full), `sheet/ChartSheetContent`, `ChartWaypointContent` (1,268 lines), `ChartOneMoveRow`, `sheet/ChartSheetHelpRow` | Working; hierarchy gaps below. |
| Practice | `ChartActiveView.onOpenPractice` → `navigation.navigate('V2Practice', { anchorId, recommendedMode, source: 'chart', returnRoute: 'V2Chart' })`; "practiced today" from `sessionStore.todayPractice` | Working. No extra completion screen is added on return. |
| Anchor Details | `V2ChartScreen.openAnchor` → `V2AnchorDetails` | Working. |
| Thread Strength | `adapters/v2/home/threadAdapter.ts` (`toThreadPresentation`: reads the stored value, no math) | Exists; **not shown anywhere in Chart**. |
| Course Log / Journey | `V2ChartJourneyScreen`, `useAnchorCourseLog`, `panel/chartPanelLog` | Working. |
| Move/waypoint mutations | `hooks/v2/chart/useAnchorChart.ts` (`completeMove`, `addMove`, `acceptMove`, `setCurrentMove`, `reachWaypoint`, …) over `services/v2/chartV2Api` and `ChartApiClient` | Working, server-authoritative, idempotent keys. |
| Progress | `map/chartProgress.ts` (`waypointFraction`, `isWaypointReady`), `chartHighWater` (presentation-only high-water marks) | Working. |

### A.2 Backend (`backend/src`)

| Concern | Implementation |
|---|---|
| Chart routes | `api/routes/v2/chartRoutes.ts`: `GET chart`, `POST chart/plan`, `plan/adjust`, `POST chart`, `GET proposals/:id`, `PUT charts/:id/route`, moves CRUD (`POST/PATCH moves`, `complete`, `dismiss`), `suggest-moves`. Pro gate on creation (`CHART_PREMIUM_REQUIRED`). |
| Waypoint reach | `POST /api/courses/:courseId/waypoints/:waypointId/complete` (`CourseService.completeWaypoint`), versioned (`expectedCourseVersion`) and idempotent. Explicit user action. |
| Move completion | `ChartService.completeMove`: marks the move COMPLETED, advances `currentMoveId` via `selectNextActiveMove`, appends `MOVE_COMPLETED` course event and the `ONE_MOVE_COMPLETED` ledger event. **Does not touch the waypoint.** |
| Planner | `services/chart/ChartPlannerService.ts`, `chartPlanPrompt.ts`, `chartPlanSchema.ts`, `chartPlanValidation.ts`; proposals persisted in `AIPlanProposal` |
| Providers | `chartModelProviders.ts`: planning primary OpenAI `gpt-5.4-mini`, fallback Gemini `gemini-3.5-flash-lite`; Ask Chart primary `gpt-5.4-mini`, fallback `gemini-3.5-flash` (`resolveAskChartConfig`, env overridable); multi-turn `history`, `streamJson` |
| Ask Chart | `services/chart/ask/`: `AskChartService` (turn, approveMoves, dismiss, confirmRouteApplied), `askChartContext` (read-only context), `askChartPrompt`, `askChartSchema` (zod + JSON schema), `askChartStore`, `askChartPhotos`, `chartAgent.ts` + `chart-agent.md` |
| Routes | `api/routes/v2/askChartRoutes.ts` (turn JSON/SSE, photo, history, profile, memory, coach style, approve/dismiss/route-applied) |
| Data | `ChartConversation`, `ChartMessage`, `ChartCoachProfile`, `ChartMemory` (additive migration, rollback SQL present) |
| Limits | `chartAskLimiter` 40 turns / 10 min / user, `chartAskConcurrencyGuard` (one turn per user+Anchor), global AI ceiling |

### A.3 State flows

- **Create:** entrance → `ask` conversation (`CREATE` mode, `opening` greeting) → `readyToPlan` or "Draft my route now" → `POST chart/plan` → review → `POST chart` → reveal. Photos are optional composer attachments sent by asset id.
- **Complete a move:** tap circle → `chartService.completeMove` → next active move becomes current → `chartV2` projection republished → local toast → map ink sequence (`chartMapSequences`, unchanged).
- **Reach a waypoint:** explicit "Mark waypoint reached" → confirm sheet → `completeWaypoint` → reach beat / fog reveal (locked).
- **Ask Chart proposal:** assistant turn returns `action` → server resolves it against the live chart (`resolveAction`) and stores it on the message → card → approve → `approveMoves` writes through `chartService.addMove` with per-move idempotency keys → message becomes APPLIED only after every move saved.

### A.4 What is real vs unused

Genuinely functional: everything in A.1–A.3. Not connected: nothing found dead on the Chart path, apart from the `// DEFERRED:` blocks in `ChartWaypointContent`/`ChartActiveView` (retained single-column panel, intentionally parked) and the legacy `components/chart/*` preview. `ChartOneMoveRow` reads `move.why` / `move.doneWhen`, **fields that do not exist** on `MoveSummary` (see C, P1-3).

---

## B. Screen-by-screen comparison

| # | Reference | Current | Works | Missing / inconsistent | Backend | Action |
|---|---|---|---|---|---|---|
| 1 | Entrance (keep) | `ChartIntroOpening` | Copy, category art, Continue → ask cross-fade | none | none | Keep. |
| 2 | Start the conversation | `ChartCreationAsk` + `AskChartView`; header "Ask Chart / intention" | Greeting from intention+Vision, composer, optional photo, "Draft my route now" (the "skip") | No "Let's build your route." intro; no quick-answer / photo / skip row (the composer covers them) | `opening` turn | Add intro block (P2). |
| 3–4 | Guided context / timeline | Same view; model `suggestions` render as chips | Adaptive, one question at a time, chips, free text | Reference shows a fixed 5-segment progress bar and "Skip". **Deliberately not copied**: the brief requires adaptive questioning, so a fixed step count would lie. "Skip" = "Draft my route now". | `readyToPlan` | Document deviation. |
| 5 | Chart board (map) | `ChartLandscape`/`map/*` | — | — | — | Locked. |
| 6 | Navy sheet, next move + anchor + Focus | `ChartOneMoveRow` labelled "One move this week"; anchor shown only as a 44 px mark beside the help button; Practice row uses a generic lucide anchor icon | Next move + check circle, expandable detail, route segments, mark-waypoint CTA | "this week" wording; generic icon instead of the real Anchor; **no Thread Strength**; "Why this move"/"Done means" always fall back to generic text | `rationale`, waypoint `completionCriteria` exist | Fix (P1). |
| 7 | Collapsed sheet: next move, Anchor + Focus, Help me move forward, View your route | Peek = title + one-move row; Help row in half tier; route list only at full tier; no "View your route" control | Detents, Help row | Anchor card + "View your route" missing | none | Add (P1). |
| 8 | Ask Chart entry | `V2ChartAskScreen`: greeting + model chips | Cream, avatar, composer, keyboard, streaming | No waypoint/move context heading; the skills Break down / Plan my week / Find another way exist in the backend but **nothing in the UI sends them** | `skill`, `targetMoveId` | Add context header + starters (P1). |
| 9 | Ask Chart response | `AskMessageRow` | Specific replies, restrained category wash on user bubbles, real Anchor avatar | — | — | Keep. |
| 10 | Add to Chart (inline) | `AskProposalCard` ADD_MOVES: "Add to my Chart" / "Not now" | Server-applied, stale/offline/failed handled | Person cannot change a proposed move ("Make changes instead"); no move-edit or replace-move action | `approve` applies stored content only | Add edit-before-approve, `EDIT_MOVE`, `replacesMoveId` (P1). |
| 11 | Confirmation, conversation continues | Approving **navigates to a full-screen `V2ChartRouteUpdated`**, then back | Shown only after the server saved | Leaves the conversation; reference keeps it inline with View my chart / Keep chatting | — | Inline confirmation for moves; keep the full screen for route revisions (P1). |

---

## C. Functionality gap matrix

### P0 — broken navigation, wrong data, lost progress, unusable flows

None found. The creation flow, Anchor Details navigation, Practice round trip, move completion, waypoint reach and proposal
application were all traced end to end and behave as designed. (Device behaviour is unverified: see G.)

### P1 — missing functionality, incomplete interactions, important UX

| ID | Finding | Evidence |
|---|---|---|
| P1-1 | "One move this week" is still the sheet label, teaching copy, review eyebrow ("YOUR FIRST MOVE THIS WEEK"), review helper ("…you can do this week") and planner prompt ("start this week"). Locked decision: **Your Next Move**, no weekly framing. | `chartCopy.ts:18,37,172`, `ChartCourseReviewScreen.tsx:101`, `chartPlanPrompt.ts:136` |
| P1-2 | Navy sheet shows a generic anchor glyph in the Practice row, and never shows Thread Strength. The reference and the brief want the real Anchor, Thread Strength and Focus together, with the Anchor tap going to Details. | `PracticeRow` (lucide `Anchor`), `ChartSheetHelpRow` |
| P1-3 | "Why this move" falls back to the waypoint title and "Done means" to a generic sentence because `ChartOneMoveRow` reads nonexistent `move.why`/`move.doneWhen`. `Move.rationale` and the waypoint's `completionCriteria` are already in the view model and unused here. | `ChartOneMoveRow.optionalMoveDetail` |
| P1-4 | No "View your route" entry; the full route is only reachable by dragging the sheet. | `ChartSheetContent` |
| P1-5 | Ask Chart skills have no UI entry. Break down, Plan my week, Find another way, Reflect exist server-side (`ASK_SKILLS`, `chart-agent.md`) and in the client type, but only free text and model-chosen chips can reach them. No waypoint/move context is shown in the conversation. | `grep BREAK_DOWN` finds only `askChartApi.ts` |
| P1-6 | A proposal cannot be edited before approval, and only `ADD_MOVES` / `REVISE_ROUTE` exist. "Break a move into smaller steps" adds steps but leaves the original oversized move; "edit an existing move" is impossible. | `askChartSchema.ts` action enum, `AskChartService.approveMoves` |
| P1-7 | Approving moves leaves the conversation for a full-screen interstitial. | `V2ChartAskScreen.onMovesApplied` |
| P1-8 | Ask Chart (including the free pre-paywall creation conversation) is not entitlement-gated; only `POST chart` checks Pro. Free users can spend model tokens up to the rate limit (40/10 min) before the paywall at plan time. **Product decision needed**, not changed here: it is a RevenueCat/cost policy, and the brief forbids breaking entitlements. | `askChartRoutes.ts` has no premium check |
| P1-9 | Reopening a completed move is unsupported: `updateMove` rejects COMPLETED, there is no reopen endpoint, and the move row is disabled once checked (`markMoveUndone` label exists but is unreachable). Completions are written to the append-only Course Log and ledger, so reopening needs a defined compensating event. **Decision needed**; not implemented. | `ChartService.updateMove` L529, `ChartOneMoveRow` |

### P2 — polish and minor inconsistencies

| ID | Finding |
|---|---|
| P2-1 | Creation conversation has no "Let's build your route." intro block (reference screen 2). |
| P2-2 | `REVISE_ROUTE` ignores remembered constraints (availability, hours per week) when it builds the revision; only the model's short `detail` is sent. |
| P2-3 | `chart-agent.md` has no explicit "Memory" or "Tool boundaries" sections (the rules exist inline in Core). |
| P2-4 | `AskAttachSheet` and `ChartOneMoveTeaching` contain fixed hex colours (neutral cream/ink, not category colours). Not a category-hardcoding violation; noted only. |
| P2-5 | Mobile `tsc` has pre-existing failures outside Chart (Shop types, Visualize manifests, duplicate nav types) per `tasks/chart-review-refinement/report.md`; not re-baselined here. |

### Outstanding, requires device or owner

Microphone, camera/library, keyboard behaviour, reduced-motion path, release-build frame pacing and cross-device sync cannot be
verified from this environment (no device, no Postgres). They stay on the manual QA list.

---

## D. Reuse vs rebuild

**Must be reused unchanged:** `ChartIntroOpening`, `ChartGenerationStage`, everything under `map/`, `ChartLandscape`,
`ChartStaticMap`, `ChartCourseReviewScreen` and `ChartRouteEditor`, `V2ChartAdjustScreen`, the `V2Practice` flow and its
`returnRoute`, `V2AnchorDetails`, `CircularAnchorRenderer`, `toThreadPresentation`, `useAnchorChart` mutations,
`chartService.addMove/updateMove/dismissMove`, the `AIPlanProposal` pipeline, `useAskChart`/`askChartState`,
`AskChartView`/`AskMessageRow`/`AskComposer`, `useAskMedia`.

**Extended in place (no replacement):**

| Component | Change | Why |
|---|---|---|
| `ChartOneMoveRow` | real why/done-means; new label | P1-1, P1-3 |
| `ChartSheetHelpRow` | now "Help me move forward" + "View your route" | P1-4 |
| `ChartWaypointContent.PracticeRow` | kept; used only as the fallback when there is no Anchor art | duplicate-control avoidance |
| `AskChartView` | optional `header` slot and `starters` row | P1-5, P2-1 |
| `AskProposalCard` | editable titles, replace/edit variants, inline applied panel | P1-6, P1-7 |
| `askChartSchema` / `AskChartService` | `EDIT_MOVE`, `replacesMoveId`, `edits` on approve | P1-6 |

**New, one component:** `sheet/ChartSheetAnchorCard.tsx` (real Anchor, Thread Strength from the existing adapter, Focus). It
replaces the Practice row **in the half tier only**, because the row cannot show the Anchor or Thread Strength. The row's
`onOpenPractice('focus' | 'deep_prime')` contract is unchanged, so premium restrictions and the completion experience are
untouched.

**Not replaced:** the full-screen `ChartRouteUpdated` stays, now used for route revisions, which are a bigger change than a
move.

---

## E. AI system assessment

**Models actually invoked.** Planning: OpenAI `gpt-5.4-mini` → Gemini `gemini-3.5-flash-lite` on failure (changed in the
2026-10-23 refinement after measured comparisons; the old `gpt-4.1-mini` under-decomposed). Ask Chart: `gpt-5.4-mini` →
`gemini-3.5-flash`, chosen from an 8-model benchmark (`benchmark-results/ask-chart/`, ~2.3 s per turn, first text 1.4 s).
There is no evidence in the repo of a demonstrated quality gap that justifies another model, so **no model change is made**.

**Prompts.** Planner: system prompt in `chartPlanPrompt.ts` with adaptive 2–8 waypoints, completion criteria, grounding rules.
Ask Chart: `chart-agent.md` (core + 3 styles + 9 skills, hashed and versioned per message) assembled by `buildAgentSystem`,
plus a JSON context built by `buildAskUserMessage` with every user string labelled untrusted.

**Three-waypoint question.** Already investigated in `tasks/chart-review-refinement/report.md`: cause was the model/prompt
(competing instructions, complexity re-derived from the resulting count). There is no schema, validation, persistence or
rendering limit of three. Fixed there; this audit found nothing further in the pipeline. No waypoints are duplicated anywhere.

**Context coverage.** Ask Chart receives intention, category, Vision (title, description, notes, captions), onboarding
"why it matters", practice counts, remembered preferences, the full route (ids, titles, state, completion criteria, metric,
moves with status) and the eight most recent completed moves. Missing: each move's `rationale` (so "explain this move" works
from titles alone) → added.

**Fallbacks.** A failed model call returns a retryable error. A template route is never offered as an AI revision
(`generation.source !== 'ai'` is rejected). Nothing fabricates an answer.

**Validation.** `normalizeAskTurn` (zod) rejects unrecoverable output; `resolveAction` re-checks every id against the live
chart, de-duplicates against existing moves and rejects reached waypoints. Approval applies **stored** content with
idempotency keys.

**Tool/skill boundaries.** The model never writes. It returns one structured `action`; the server validates and stores it;
the person approves; the server applies through existing service methods. This is the bounded-tool pattern the brief asks for.
Skills (break down, plan week, another approach, stuck, suggest move, explain move, revise route, reflect, creation) are
prompt-level workflows selected by the `skill` field; the proposals they produce flow through the single action channel.

**Coaching style.** Supportive / Driven (default) / Direct are implemented (`ChartCoachProfile`, `AskSettingsSheet`). No
onboarding friction: it is a setting. Style changes tone only; the Core section holds accuracy and safety.

**Memory.** `ChartMemory` holds five whitelisted preference keys per Anchor, written only from explicit statements, and can be
reviewed, corrected, deleted individually or entirely from `AskSettingsSheet`. Chart rows remain the source of truth for
progress. Photos are processed in-request, re-encoded without EXIF, and deleted after 24 h or when the conversation is cleared.

**Cost/latency.** Per-turn provider, model, fallback, latency and agent version/hash are logged. Limits as in A.2.

**Recommended changes (made in G):** include move rationale in context; add `EDIT_MOVE` and `replacesMoveId`; send remembered
constraints into route revisions; add Memory and Tool-boundary sections to the agent file. **Recommended, not made:**
entitlement/cost policy for free-user Ask Chart turns (P1-8).

---

## F. Implementation plan

Dependency order, with acceptance criteria. Phase numbers follow the brief where they map.

| Phase | Work | Acceptance |
|---|---|---|
| 0 | Baseline in an isolated workspace | Chart suites recorded green before any edit (mobile 78 suites / 812 tests; backend chart 9 suites / 145 tests, 2 skipped) |
| 1 Creation | Intro block above the first message; planner prompt "next move" wording; review copy | Intro renders in create mode only; no "this week" in creation copy |
| 2 Navy sheet | "Your Next Move"; real why/done-means; `ChartSheetAnchorCard`; "View your route"; keep one Focus control per tier | Sheet tests updated and green; Anchor tap → Details; Focus → `onOpenPractice('focus')`; Thread Strength matches `toThreadPresentation` |
| 3 Ask Chart | Context header, skill starters, conversation unchanged otherwise | Starters send the right `skill`/`targetMoveId`; absent while a turn runs |
| 4 Actionable AI | `EDIT_MOVE`, `replacesMoveId`, `edits`; card editing; inline confirmation | Server rejects unknown/completed/foreign ids and oversized edits; approval is idempotent; nothing is "applied" before the server confirms |
| 5 Progress/polish | Regression of completion and waypoint progression; type-check; docs | Existing completion/progression tests unchanged and green |

---

## G. Outcome

Written after implementation. Only things that were executed are listed as passing.

### What changed (resolved)

- **"Your next move"** replaces "One move this week" everywhere in Chart copy, the review eyebrow and the planner prompt. No weekly restriction was added or implied.
- **Navy sheet, half tier:** the next move now shows its real *why* (move detail, else the move's stored rationale, else the waypoint title) and the waypoint's real "done means" criteria. The invented per-move count ("0 of 1 done") is gone.
- **New `ChartSheetAnchorCard`:** the user's real Anchor (tap opens Anchor Details), its stored Thread Strength via the existing `toThreadPresentation` adapter (display only, kept separate from Chart progress), and one Focus action that uses the existing Practice flow. Accent comes from the Anchor category through `panelAccent`. It replaces the generic Practice row on the half tier when the Anchor art exists; the Practice row remains the fallback otherwise.
- **`ChartSheetHelpRow`:** now "Ask Chart" and "View your route" (raises the sheet to the full tier). It no longer repeats Focus.
- **Ask Chart:** a context line (waypoint · move) under the intention, and skill starters shown only before the person has said anything: "Break this move down" (`BREAK_DOWN` + current move id), "Plan my week" (`PLAN_WEEK`), "Find another way" (`ANOTHER_APPROACH` + current move id). Hidden when a seeded prompt opens the screen.
- **Planner prompt:** "start this week" changed to "do next".

### Not done (outstanding)

- Edit-before-approve on suggested moves, the `EDIT_MOVE` action, and `replacesMoveId` on `ADD_MOVES`. These touch the zod and JSON schema, `AskChartService`, the approve route and `useAskProposals`, and I did not start them.
- Inline "move added" confirmation in the conversation. The full-screen Route Updated screen still opens after approving moves.
- Creation-mode intro block ("Let's build your route") in `ChartCreationAsk`.
- Moves' `rationale` in the Ask Chart context, remembered memories in `REVISE_ROUTE`, and the `chart-agent.md` 1.2.0 update (Memory and Tool-boundary sections).
- Product decisions left to the owner: entitlement gating for Ask Chart (P1-8) and reopening completed moves (P1-9).

### Tests executed (cloud workspace)

- Mobile chart + chart screens: 65 suites, 707 tests, all passing (baseline before edits was 78 suites / 812 tests across the wider set; the chart-scoped run above is the relevant one after edits).
- Mobile Ask Chart suites: 11 suites, 143 tests passing, including the new `AskStarters` tests and 2 new starter tests in `V2ChartAskScreen.test.tsx`.
- `tsc --noEmit` on mobile: clean for chart files; one unrelated error (`AppStartupHydration.integration.test.tsx` cannot find `../../App`) because the cloud copy did not include `App.tsx`.
- Backend `src/services/chart` + `src/api`: 36 suites passed, 2 skipped, 539 tests passed, 23 skipped, using a Prisma stub (the real client could not be generated here).

### Not verified

No device or simulator run: Skia rendering, sheet gestures, keyboard behavior, microphone/camera, reduced motion on hardware, cross-device sync. DB-backed suites (Postgres) were not run.

### Known limitation

When the day-closed card is showing, a second Focus control can still appear alongside the Anchor card.
