# Move plans — Pass 1 report

Worktree `E:\Projects\Anchor-MovePlans`, branch `feat/chart-move-plans` (cut from `feat/vision-seamless-flow` @ 9be69de94). Nothing is committed.
I moved the work out of `E:\Projects\Anchor` because another session was editing Vision files in that checkout while this ran.

## Step 0: targeting table (line numbers as found, before editing)

| # | Target | File | Lines |
|---|---|---|---|
| T1 | `Move` model | backend/prisma/schema.prisma | 665–692 |
| T2 | Migrations folder | backend/prisma/migrations/ | `YYYYMMDDHHMMSS_name/migration.sql`, optional `ROLLBACK_<name>.sql` alongside; latest was `20261029030000_creation_legacy_reconciliation` |
| T3 | `MoveSummary` (backend) | backend/src/types/chart.ts | 115–128 |
| T4 | `projection`, `toMoveSummary` | backend/src/services/CourseService.ts | 179–197, 199–216 |
| T5 | `AddMoveSchema`, `UpdateMoveSchema`; POST and PATCH move handlers | backend/src/api/routes/v2/chartRoutes.ts | 220–228, 230–237; 435–446, 449–459 |
| T6 | `createChart`, `addMove`, `applyAskProposal`, `undoAskProposal`, `updateMove`, `dismissMove`, `completeMove` | backend/src/services/chart/ChartService.ts | 214, 412, 475, 564, 644, 682, 721 |
| T7 | `MoveSummary` (mobile) | anchor/mobile/src/types/chart.ts | 180–193 |
| T8 | `chartV2Api.addMove`, `updateMove` | anchor/mobile/src/services/v2/chartV2Api.ts | 247–252, 254–260 |
| T9 | `useAnchorChart`: `publishChart` 46, `run` 269, `completeMove` 292, `addMove` 311, `editMove` 351, `dismissMove` 362, `reachWaypoint` 414 | anchor/mobile/src/hooks/v2/chart/useAnchorChart.ts | as listed |
| T10 | One Move row: circle 133–147, body 149–182 | anchor/mobile/src/components/v2/chart/ChartOneMoveRow.tsx | 1–211 |
| T11 | `oneMove` mount | anchor/mobile/src/components/v2/chart/ChartWaypointContent.tsx | 412–431 |
| T12 | Sheet pattern | anchor/mobile/src/components/v2/chart/panel/ChartConfirmSheet.tsx (on `V2SheetModal`) | 1–69 |
| T13 | Chart pushes: storage key 59, ids 62, sync 169, one-owner 182–183; `planChartNotifications` | services/notifications/chartNotifications.ts; components/v2/chart/map/chartRhythm.ts | as listed; 227–276 |
| T14 | `scheduleLocalNotification` 622, `cancelNotification` 732, `requestPermissions` 183 | anchor/mobile/src/services/NotificationService.ts | as listed |
| T15 | Chart deep link | chartRhythm.ts 230 (`anchor://v2/chart/{anchorId}`, read by `parseChartNotificationTarget`, chartNotifications.ts 65) | see note |
| T16 | Hand-off card | anchor/mobile/src/components/v2/chart/ChartMoveHandoff.tsx | 54–108 |
| T17 | `CHART_COPY` | anchor/mobile/src/constants/v2/chartCopy.ts | 5–311 |
| T18 | `ASK_TURN_JSON_SCHEMA` 33, `RawTurn` 110, `normalizeScope` 179, `normalizeAskTurn` 188 | backend/src/services/chart/ask/askChartSchema.ts | as listed |
| T19 | `AskMove` 11, `loadChartState` 54, `loadAskContext` 132 | backend/src/services/chart/ask/askChartContext.ts | as listed |
| T20 | Moves written into the prompt | backend/src/services/chart/ask/askChartPrompt.ts | 60 |
| T21 | Agent instructions | backend/src/services/chart/ask/chart-agent.md | 1–167 |
| T22 | `TurnSchema` 45, turn route 126; `AskTurnBody` 67, `turn` 220 | backend/src/api/routes/v2/askChartRoutes.ts; anchor/mobile/src/services/v2/askChartApi.ts | as listed |
| T23 | Proposal card + apply/undo | hooks/v2/chart/useAskProposals.ts (`approve` 52); components/v2/chart/ask/AskChartView.tsx; undo in ChartOneMoveRow.tsx 49–60; askChartApi.ts `approve` 280, `undoProposal` 286 | as listed |
| T24 | Planner `suggestedOneMove` 83/218, `normalizeMove` 447 | backend/src/services/chart/chartPlanSchema.ts; chartPlanPrompt.ts | as listed |
| T25 | `oneMove` hand-off | ChartCreationFlow.tsx 263 (state from `suggestedOneMove.title`), 546 (sent to create); chartRoutes.ts 190/209 (`oneMove` schema), 402 | as listed |

T15 note: `navigation/chartDeepLinks.ts` parses `anchor://chart/{courseId}` links; the Chart pushes use a different shape, `anchor://v2/chart/{anchorId}`, which the App.tsx tap handler reads through `parseChartNotificationTarget`. Move reminders use the push shape, as R2 asks.

## What was built

**Backend**
- Migration `20261116000000_move_plans`: four additive columns on `moves` (`plan_cue` varchar 60, `plan_date` varchar 10, `plan_time` varchar 5, `plan_remind` boolean default false). No backfill. `ROLLBACK_20261116000000_move_plans.sql` drops only those columns. `prisma migrate diff` from the old schema to the new one prints the same SQL.
- `services/chart/movePlan.ts`: `resolvePlanWrite` covers all of P2 (trim and collapse the cue, 1–60 chars; a real date within a year either side; HH:MM 24h; a time needs a date; a reminder needs both). Each failure is a 400 `VALIDATION_ERROR` that names the field (`plan.cue` and so on). `toMovePlan` returns `null` when cue, date and time are all empty.
- `PATCH`/`POST` move bodies take an optional `plan` (`null` clears it). `.strict()` is kept.
- `updateMove` returns 409 `MOVE_NOT_PLANNABLE` for a COMPLETED or DISMISSED Move. A plan-only write keeps the version increment but never changes `currentMoveId`, position or status, and appends no events. Complete and dismiss leave plan fields alone.
- `MoveSummary.plan` is filled by `toMoveSummary`.

**Mobile**
- `adapters/v2/chart/movePlan.ts`: `movePlanState`, `dayChips`/`resolveDayChip`, `formatPlanWhen`, `planFireDate`, `reminderBody`, `planSavedToast`. Day arithmetic uses local calendar fields only, so midnight and DST changes are safe.
- `useAnchorChart.setMovePlan(moveId, plan | null)` uses the `move-plan:{moveId}` busy key.
- `ChartOneMoveRow` has a plan row as a third target under the why line, in states none, planned/today, missed and done. The plan row opens `ChartMovePlanSheet`. The circle and body contracts are unchanged. The row shows only when the parent passes `onSavePlan`, so the dev lab and other mounts are unchanged.
- `panel/ChartMovePlanSheet.tsx` covers S1–S10 (chips, write-your-own cue, Other time, No set time, reminder switch with a permission request through `NotificationService.requestPermissions`, a push preview hidden from screen readers, save/clear/error, and preselection).
- `services/notifications/chartMoveReminders.ts` covers R1–R8.
- The hand-off shows a plan line (`{cue} · {when}`) only when a cue or a day exists.
- The `CHART_COPY.plan` strings and `CHART_COPY.reminder.title` were added.

## How the reminder record is stored

The encrypted key is `anchor:v2:chart2:moveReminders:{encodeURIComponent(accountId)}`. It is written through `encryptedPersistStorage`, the same helper and key style as `chartNotifyStorageKey`. The value is `{ entries: [{ id: 'chart-move:{moveId}', anchorId, moveId, fireDate (ISO), body }] }`. Reconcile works like this:
- It runs once per account at a time (a promise queue), so two quick Chart updates cannot interleave writes.
- It drops entries that have already fired.
- It leaves other anchors' entries alone (R6).
- For this anchor, it cancels any entry that no longer qualifies or whose fire time or body changed, then schedules the missing ones.

**Where reconcile runs (R5).** It runs from the hook's single `publish()` choke point. Every server-confirmed Chart goes through it: setMovePlan, complete, dismiss, edit, reach, Ask apply/undo (through `refreshChartAfterProposal`), Chart load, archive and delete. Archive and delete also call `cancelMoveRemindersForAnchor` explicitly. On account switch or sign-out, `authStore.setUser` calls `cancelAllMoveReminders(previousUserId)`.

**Idle nudge (R7).** `planChartNotifications` takes an optional `moveReminderSoon` (defaults to false). `syncChartNotifications` sets it from the Chart's moves through `hasMoveReminderWithin(…, 48h)`, using a new optional `currentWaypointId` that `ChartActiveView` passes in.

## Departures

1. **Mobile `MoveSummary.plan` is optional** (`plan?: MovePlan | null`). Older cached Charts and many test fixtures don't have it; every reader treats a missing plan as `null`. The backend type is required, as specified.
2. **Partial plan writes merge.** Inside a `plan` object, an omitted field keeps its current value and `null` clears it. If an update removes the date or time and leaves out `remind`, the reminder quietly turns off instead of returning a 400. Sending `remind: true` without a date and time is still a 400.
3. **"Other time" uses the app's existing `TimeWheel`**, not a native picker. `@react-native-community/datetimepicker` is in package.json but nothing imports it, so I can't confirm it is linked in the current dev client. Swapping it in is a single component change if you want the OS picker.
4. **Toast casing.** Only the first letter is lowered ("Plan set: after I wake up, Thu at 8:00 AM"). Lowercasing the whole string would give "after i wake up" and "thu".
5. **12h/24h** comes from `Intl` `hourCycle` and falls back to 12h. `expo-localization` is installed but unused, and its native linking is unverified.
6. **Missed or out-of-range dates** are not preselected when the sheet opens, so one tap on a new day reschedules. The cue is kept.
7. **No chip haptic.** Chart has no selection haptic, so per S11 there is none.

## Tests

New backend: `movePlan.test.ts` (P2 rules, `plan: null`, `toMovePlan`, migration shape) and `chartMovePlanWrite.test.ts` (plan-only write keeps the One Move, version +1, 409 on completed, 400 writes nothing, addMove with a plan, unplanned → `plan: null`).

New mobile: `movePlan.test.ts` (states, midnight, DST both ways, day chips, 12h/24h, toast), `chartMoveReminders.test.ts` (one per qualifying move; complete, dismiss, reach and clear cancel; reschedule on change; no past times; inactive Chart; other anchors survive; sign-out; never throws; idle-nudge skip), `ChartMovePlanSheet.test.tsx`, `useAnchorChartSetMovePlan.test.ts`, `ChartMoveHandoffPlan.test.tsx`, and new cases in `ChartOneMoveRow.test.tsx` (three targets, missed state, no truncation props).

**Counts.** Baseline was measured in `E:\Projects\Anchor` at 9be69de94; Pass 1 was measured in this worktree.

| | Before | After Pass 1 |
|---|---|---|
| Backend jest | 3 failed / 1838 passed (1 failing suite: `api/routes/__tests__/anchors.test.ts`) | 3 failed / 1858 passed (same 3 tests in `anchors.test.ts`, unrelated) |
| Backend `tsc` | 0 errors | 0 errors |
| Mobile jest | 3 failed in 2 suites (`VisionCeremony.test.tsx`, `useCelebrationActive.test.tsx`) | 1 failed in `useCelebrationActive.test.tsx` (pre-existing). `VisionCeremony` passes here; its failure came from the other session's uncommitted Vision edits in the main checkout. |
| Mobile `tsc` | 0 errors | 0 errors |

During the full run, `useAnchorChart.test.ts` failed because reconcile wrote an empty reminder record on every publish. Reconcile now writes only when the record changes, and that suite passes. Backend lint has no errors in the files I touched; the 9 lint errors repo-wide are pre-existing.

## Still needs a real device

- **Android exact alarms.** `scheduleLocalNotification` uses a date trigger on the daily-reminders channel. On Android 12+ without `SCHEDULE_EXACT_ALARM`, delivery can drift by minutes. Check a reminder fires close to its time on the Galaxy.
- **iOS permission prompt timing.** The prompt only appears when the person turns on "Remind me then". Check that the sheet stays put under the system alert, and that a denial shows the Settings line.
- **DST.** Covered by unit tests in America/New_York. On a device, schedule across a change (or set the clock) and confirm local wall-clock delivery.
- **Layout at 360dp and font scale 1.3.** The tests only check that chips have no `numberOfLines` or ellipsis. Check the wrapping looks right on device.
- **Teaching spotlight.** It re-measures through the existing `moveStack` `onLayout`. Check the circle and body highlights still land correctly with the plan row present.
- **12h/24h.** `Intl` follows the locale, not the iOS or Android "24-hour time" toggle. Check on a device with the toggle set against its locale.
- **Production.** The migration must be deployed before the new client reads `plan`. Older clients ignore the field.
