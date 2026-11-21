# Move plans — Pass 2 report

Same worktree and branch as Pass 1 (`E:\Projects\Anchor-MovePlans`, `feat/chart-move-plans`). Nothing is committed.

## Targeting table (Pass 2 rows, line numbers after the change)

| # | Target | File | Lines now |
|---|---|---|---|
| T18 | Turn JSON schema (`PLAN_MOVES` 75, `plans` 93), `RawTurn` 148, `AskTurnNormalizeOptions`, `cleanClientToday`, `normalizeScope`, `normalizeAskTurn` | backend/src/services/chart/ask/askChartSchema.ts | as listed |
| T19 | `AskMove.plan`, `AskContext.today`, `loadChartState` plan select, `loadAskContext(…, { today })` | backend/src/services/chart/ask/askChartContext.ts | 11–20, 52, 155 |
| T20 | `describeMovePlan` 8, `describeToday` 16, move `plan` field 81, today line at the top of the user message | backend/src/services/chart/ask/askChartPrompt.ts | as listed |
| T21 | Agent instructions (version 1.3.0) | backend/src/services/chart/ask/chart-agent.md | whole file |
| T22 | `TurnSchema` `clientToday`/`clientWeekday`; `AskTurnBody`, `clientDay()`, `turn()` | askChartRoutes.ts; anchor/mobile/src/services/v2/askChartApi.ts | — |
| T23 | `useAskProposals.approve`, `AskProposalCard`, `V2ChartAskScreen` remind offer, `chatAppliedBatch.moveIds`, row undo | hooks/v2/chart, components/v2/chart/ask, screens/v2/chart | — |
| T24 | Planner `cue` on moves and `suggestedOneMove`, `normalizeMove`, prompt line | backend/src/services/chart/chartPlanSchema.ts, chartPlanPrompt.ts, ChartPlannerService.ts | — |
| T25 | `oneMove.cue` from the proposal to `createChart` | ChartCreationFlow.tsx (create body), chartRoutes.ts (`oneMove` and `suggestedMoves` accept `cue`), ChartService `createChart` | — |
| — | `applyPlanMoves` 640, `undoAskProposal` 697 | backend/src/services/chart/ChartService.ts | as listed |

## What was built

**Ask request (A1–A2).**
- The mobile `askChartApi.turn` now adds `clientToday` (device-local `YYYY-MM-DD`) and `clientWeekday` (`Mon`–`Sun`) to every turn.
- On the server, `cleanClientToday` drops a bad date. A missing, unknown or mismatched weekday is replaced by the date's own weekday. Neither case is an error.
- The user message now starts with one line: "Today for the person is Mon, 2026-11-16." Without a client date it says "You do not know today's date for the person. Do not propose dates."

**Context (A3–A4).**
- `AskMove` gains `plan: { cue, date, time } | null`, with no `remind`.
- In the prompt JSON, each move gets one new field, `plan`: either `planned: After I wake up, Tue 2026-11-17 15:00` or `no plan`.

**Turn schema (A5–A7).**
- Moves and `moveEdit` carry `cue`, `date` and `time` (required and nullable in the JSON schema, nullish in zod).
- There is a new `PLAN_MOVES` action with `plans`. `plans` is required, and empty for other action types.
- `normalizeAskTurn(raw, { clientToday, plannableMoveIds })` cleans every plan:
  - It applies the P2 rules plus a window of today to today + 13 days.
  - A time without a date is dropped, and a date without a client today is dropped.
  - A bad plan is stripped and the move is kept; a turn is never rejected for one.
- For `PLAN_MOVES`, it keeps only ids that are ACTIVE on the current waypoint, deduplicates them, caps them at 3, and drops the whole action when none are left. Its scope is always `MOVE`.
- `resolveAction` builds the `PLAN_MOVES` card, using move titles from the real Chart.

**Apply and undo (A8–A10).**
- `ADD_MOVES` writes `planCue`, `planDate` and `planTime`, with `planRemind` always false. Stored plans are re-checked for shape only: the date window was applied when the proposal was made, so a day passing since then doesn't drop the plan.
- `PLAN_MOVES` runs inside the same serializable transaction:
  - Every move must still be ACTIVE on the current waypoint, or the proposal returns 409 `PROPOSAL_STALE` and nothing is written.
  - Each move's previous four plan fields are saved into `structured.action.previous`.
  - Each move keeps its `planRemind` unless the new plan has no time.
  - The status becomes `APPLIED`, the course version goes up once, and the response is the usual shape with `added: 0`.
- Undo restores `previous` exactly. `ADD_MOVES` undo is unchanged.

**Chat card (A11–A12).**
- Proposed moves show cue and day/time chips, without a bell.
- A `PLAN_MOVES` card lists each move with its new plan, under "SUGGESTED PLAN", with the buttons "Use this plan" and "Not now".
- After a successful apply, if any applied move now has a date and a time (and its reminder is off), a "Remind me at {time}" chip appears using the earliest time. The chip:
  - asks for notification permission through `NotificationService.requestPermissions`;
  - calls `setMovePlan(id, { remind: true })` on exactly those moves, and reminders reconcile through the Chart cache;
  - shows "Reminder on" when done, or the Settings line if permission is denied.
- Undo works through the existing "Updated from chat · Undo" control, which now also matches moves listed in the batch's `moveIds`.
- After any apply or undo, the Chart is refreshed through `refreshChartAfterProposal` and then `publish`, and reminders reconcile.

**Agent file (A13–A18), now version 1.3.0.**
- The output contract covers the plan fields and `PLAN_MOVES` (cue source, when a date is allowed, never invent a time, ask for a time at most once, read each move's `planned:` line).
- `plan-week` is rewritten to use real days. Existing moves are planned with `PLAN_MOVES`, only new moves use `ADD_MOVES`, and plans the person set themselves are never moved.
- `stuck` carries the current move's plan over, or proposes a new date when the problem is no time.
- `break-down` and `suggest-move` give each move a cue and no dates.
- `remember` uses the `availability` key when the person says when they are free.
- **Vocabulary changes (A18):** one line changed, from "into a sigil, a ritual and a Chart" to "into an Anchor, a practice and a Chart". A grep for sigil, ritual, charge, streak and prime found nothing else.

**Strings (A19).** Every user-facing "Ask Chart" in mobile copy now reads "Ask Anchor":
- `CHART_COPY.ask`: `thinking`, `unavailable`, `busy`, `rateLimited`, `disabled`, `assistantSaid`;
- `AskSettingsSheet`: the settings label, both alerts, the style note, the memory title and the empty-memory text;
- the dictation alert title;
- the stream fallback error message.

Identifiers, file names, comments and model-facing text are unchanged.

**Planner (A20–A22).**
- `PlannedMove` gains `cue` in the JSON schema, the zod schema and `normalizeMove` (cleaned, at most 60 characters, otherwise null). The planner prompt gets the one specified line.
- Older saved proposals read back with `cue: null`.
- The client sends `oneMove.cue` back from the proposal. `createChart` writes `planCue` on the One Move and on each saved suggestion; route applies and adjustments also write it on suggestions they create.
- The route bodies accept `cue` on `oneMove` and `suggestedMoves`. This is required: the client sends the proposal's waypoint moves back as-is, and the schemas are `.strict()`.
- On the One Move card, a cue with no day shows the dashed chip "{cue} · Pick a day".

## Departures

1. **The Ask screen stays open after an apply that includes a timed move**, so the "Remind me at" chip can be used. With no timed move it goes back to the Chart as before. This also changes the old `ADD_MOVES` flow, but only when Ask proposed a time.
2. **"{cue} · Pick a day" shows for any cue-only plan**, including a cue the person set without a day. The data doesn't record whether a cue came from the planner or from the person.
3. **The prompt's `today` field** used to be the server's UTC date. It is now the client's date, or `null`, so it can't contradict the A2 line.
4. **`AskMove.plan` and `AskContext.today` are optional**, so existing fixtures still type-check. Missing reads as "no plan" or "unknown today".
5. **A `PLAN_MOVES` undo leaves the message status at APPLIED**, as `ADD_MOVES` undo does. Undoing twice restores the same values, which is harmless.
6. **Extra copy keys** under `CHART_COPY.ask.proposal`, beyond the specified `usePlan`, `notNow` and `remindAt`: `planEyebrow` "SUGGESTED PLAN", `planApplied` "Plan saved to your Chart", `planDismissed` "Plan left as it was", `remindSet` "Reminder on". They need your sign-off.
7. **No new analytics events.** The existing `ask_chart_proposal_applied` event fires for `PLAN_MOVES` with `type: 'PLAN_MOVES'`. Tapping the remind chip is not tracked; tell me if you want it.

## Tests

New backend:
- `askChartPlans.test.ts`: window stripping, time without a date, 61-character cue, no client today means no dates, `moveEdit` cleaning, `PLAN_MOVES` filtering and capping, empty action dropped, scope MOVE, old turns still parse, `cleanClientToday`, `describeToday`, `describeMovePlan`, planner cue in `normalizeMove`.
- `chartAskPlanApply.test.ts`: `PLAN_MOVES` writes and keeps `planRemind` except when the time goes, `previous` stored, version +1 once, apply twice is a no-op, undo restores exactly, three stale cases return 409 and write nothing; `ADD_MOVES` plans with `planRemind` false; `createChart` writes `planCue` on the One Move and suggestions and accepts a cue-less proposal.
- `AskChartService.test.ts` (four cases): the prompt states today, `planned:` and `no plan` lines and remembered availability; the no-today line; a plan-week fixture with availability "wakes at 3pm" and six model plans ends with three, all within 14 days, with one surviving time (the model's own) and none added; an empty `PLAN_MOVES` is dropped.

New mobile:
- `clientDay` and the turn body (two existing body assertions updated to include it).
- Plan chips on proposed moves, the `PLAN_MOVES` card and its labels, the remind chip only when offered and "Reminder on" after.
- `approve` reports exactly the moves with a date and a time, and none when nothing has a time.
- Undo on a move in a plan batch.
- "{cue} · Pick a day".
- String tests updated for "Ask Anchor".

**Counts**

| | Before Pass 2 (end of Pass 1) | After Pass 2 |
|---|---|---|
| Backend jest | 3 failed / 1858 passed | 3 failed / 1881 passed (the same 3 in `anchors.test.ts`, unrelated) |
| Backend `tsc` | 0 errors | 0 errors |
| Backend lint (repo-wide) | 9 errors, all pre-existing | 7 errors, all pre-existing; 0 in files this pass touched (one unused `now` in `askChartPrompt.ts` fixed) |
| Mobile jest | 1 failed / 7998 passed | 1 failed / 8007 passed (`useCelebrationActive`, pre-existing) |
| Mobile `tsc` | 0 errors | 0 errors |

## Still needs a real device

- A full "Plan my week" conversation against the real model: real days, at most three moves, no invented times, an `availability` memory saved when you say when you're free.
- Applying a plan and then "Remind me at": the iOS permission prompt over the chat, and exactly one notification per timed move.
- Undo from the Chart card after a plan applied in chat.
- A new Chart from creation where the conversation gave a cue: the One Move should read "{cue} · Pick a day".
- The Pass 1 device list still applies (Android exact alarms, DST, 360dp and font scale 1.3, teaching spotlight).
- **Deploy order:** backend first, including the migration. A new client sends `cue` on create, which an old server's strict schema rejects with a 400.
