# Codex prompt: One Move detail and first-time teaching (follow-up to phase 3)

Read docs/chart/CHART_PHASE_3_CODEX_PROMPT.md first. This prompt changes the One Move row inside ChartSheet, fixes truncated text in the sheet's waypoint header, and adds a one-time teaching overlay. It does not change phase 3 layout, detents, or the route list. Active code is anchor/mobile/src/. Do not touch anchor-v2/.

## Why
Deon's screen recording (Oct 7) shows:
- The One Move text is clamped to one line ("Schedule gym sessions for th…"), so the move can't be read.
- Tapping the row or its chevron does nothing visible, so the move's detail is unreachable.
- Tapping the circle completes the move immediately, with no teaching. He did not know what the circle did, what "route holds at 90% until you confirm" meant, or why "Practice today" is there.
- Other text in the same sheet is cut off: the header count reads "0 of 1 move done moves …" and the progress line reads "moves draw this leg  Update p…".

A prototype was approved ("One Move Detail Prototype", published artifact). It is a behaviour and layout reference, not code to copy.

## Behaviour
1. **Two targets on the row, clearly separate.**
   - Circle (left): toggles done. Visible circle 34px, hit area at least 44px. Never opens detail.
   - Body (text plus a "Tap to read it all" hint): toggles an expanded state. Never completes.
   - The row itself is not one big button.
2. **Collapsed:** text clamps to 2 lines, with a "Tap to read it all ⌄" hint row under it.
3. **Expanded:** full text (no clamp), then a detail block with three labelled lines from the move record:
   - WHY THIS MOVE: `move.why`. If empty, fall back to the waypoint title.
   - DONE MEANS: `move.doneWhen`. If empty, fall back to CHART_COPY.sheet.doneFallback.
   - TOWARD: the waypoint title.
   Collapse with "Show less ⌃". Only one move is expanded at a time. If the move data has no `why` or `doneWhen` field today, do not invent a schema change; use the fallbacks and tell me in the report.
4. **Done:** circle fills sage with a check (600ms pulse; with reduce motion, no pulse). Text strikes through in the secondary ink color. Count changes to "1 of 1 done". Toast: "Move done. Your route is holding." for 1.8s. Tapping the circle again undoes it through the existing undo path if one exists; if none exists, the circle stays done and the helper line does not say "undo". Report which.
5. **Helper line under the row:**
   - Not done: "Tap the circle when it's done. Tap the words to see the detail."
   - Done (undo exists): "Tap the circle again to undo."
   - Done (no undo): hide the helper line.
6. **Route-holds note:** replace the current "route holds at 90% until you confirm" copy with CHART_COPY.sheet.routeHolds: "The move is done. Mark the waypoint reached when you feel it is." The 90% value stays visible in the progress bar only, never in this sentence.
7. **Truncation fixes in the waypoint tier of the sheet:**
   - Header right side ("0 of 1 move done moves …"): shorten to "0 of 1 done" and let it wrap or sit on its own line. No ellipsis on counts, ever.
   - "moves draw this leg" and "Update p…": either wrap onto a second line under the count, or drop "Update progress" to its own row. No clipped words at 360dp width and with the largest system font setting.
8. **Help button:** a "?" in the sheet's eyebrow row (next to "Waypoint 1 of 4 · Current") replays the teaching overlay from beat 1, any time.

## First-time teaching overlay
Show once per account and course, on first render of a course that has at least one move. Persist with the existing encrypted pattern, key `anchor:v2:chart2:taught:{acct}:{courseId}` (value "1"). Presentation-only, like chartLastOpened.ts. If storage fails, show it again next session; never crash.

Do not show it while the chart opening sequence, the reach ceremony, or any sheet-hidden state is running. Wait until the sheet is at peak or half and the opening has finished.

Three beats, spotlight style: dim scrim with a cut-out around the target, a cream tip card, an arrow toward the target, "n of 3", and Next / Got it.
1. Target: the whole move row. Title: "This is your one move." Body: "Each waypoint has one small thing to do this week. It is the only thing that moves your route forward."
2. Target: the circle. Title: "The circle is for done." Body: "Tap it when you have actually done the move. Your route only moves when you do."
3. Target: the text. Title: "The words are for detail." Body: "Tap the text to read the full move, why it matters, and what counts as done."

Rules:
- Scrim tap or Got it dismisses and marks taught. Back button dismisses too.
- Place the tip above the target if there is no room below, otherwise below. Re-measure on sheet detent change and window resize (measureInWindow or onLayout).
- If the sheet is at peak and the target is partly off-screen, snap the sheet to half first, then show beat 1.
- After dismissal the scrim must not intercept sheet drags or map taps.
- Reduce motion: no spotlight tween, cut instantly between beats.
- All strings under CHART_COPY.teaching.oneMove and CHART_COPY.sheet. No hardcoded strings.
- Accessibility: tip card is announced; beat targets keep their own accessibility labels; the circle's label is "Mark this move done" and flips to "Mark this move not done" when done; the body has role button with expanded state.

## Files
- New: ChartOneMoveRow.tsx (circle, body, expanded detail, done state), extracted from OneMoveCard in ChartWaypointContent.tsx.
- New: ChartOneMoveTeaching.tsx (overlay with three beats, spotlight, tip).
- New: chartTaughtState.ts (get/set taught flag, same encrypted-persist helper and key pattern as chartLastOpened.ts, plus a reset for the dev lab).
- Edit: ChartSheetContent.tsx (wire the row into the Waypoint tier; mount the overlay in ChartSheet; fix the truncated header and progress text).
- Edit: CHART_COPY (teaching.oneMove.*, sheet.routeHolds, sheet.doneFallback, shorter count strings).
- Edit: ChartLabDevHost: buttons "Replay move teaching" and "Reset move teaching".

## Do not change
- Pro-gate work in V2ChartScreen.tsx (creationLocked, openPaywall, onPremiumRequired). Preserve exactly.
- The completeMove / handleCompleteMove contract. The circle still calls the same completion action.
- Sound: the circle still plays useChartSound().check. Expand and collapse play nothing.
- The 10 pre-existing ChartPreview snapshot failures and the 5 unrelated Vision photo-picker failures. Do not "fix" them; report counts before and after.

## Tests
- Circle tap calls completeMove once and does not toggle expanded.
- Body tap toggles expanded and does not call completeMove.
- Expanded shows full text and three detail labels; collapsed clamps to 2 lines. Fallbacks used when `why` / `doneWhen` are empty.
- Only one move expanded at a time.
- Teaching shows once: after dismiss, a second mount does not show it; the "?" button reopens it at beat 1.
- Teaching does not show during the opening or reach ceremony.
- Storage throws: overlay still renders, nothing crashes.
- Count and progress strings render without ellipsis at 360dp and at font scale 1.3.

## Acceptance
- On the S24 Ultra, a first-time user can read the full move without leaving the sheet.
- In a 0.25x recording of a first visit, the circle and the text are never confused.
- No clipped words in the waypoint header or progress line.
- Frame time stays within the phase 3 budget. Expanding a move must not re-mount the card list.
- Report: what you built, any departure and why, whether undo exists, whether `why` / `doneWhen` exist in the data, test counts before and after, and what is still owed on the S24.
