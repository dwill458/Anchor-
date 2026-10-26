# Codex Prompt — Ask Chart Motion Pass + Review Screen Polish

**Approved prototype:** https://claude.ai/artifact/Td1ZHuBDyEPqSBFahQtGcf (choreography, timings and copy reference)
**Scope:** `anchor/mobile/src` only. No backend changes.
**This is a tuning pass, not a rebuild.** Ask Chart already has a word reveal (`AskRevealText`), a speaking aura (`AskSpeakingAvatar`), stick-to-bottom scrolling, inline suggestions and a staged generation map. The device recording (Oct 25, 11:13 to 11:16 PM CT) shows why none of it reads as "the Anchor is talking" yet. Every change below is surgical.

**Goal:** the Anchor visibly thinks, then speaks one character at a time, its ring pulses with each word in the anchor's category colour, and the list follows the line being typed. Then the review screen leads with the route.

---

## 0. What the recording shows, and what causes it

| # | Observed | Cause in code |
|---|----------|---------------|
| 1 | About 10 to 12 s of avatar only before the first message. | `useAskChart` runs `getConversation`, then the opening `turn`, in series, and only after Ask mounts. While waiting, `AskMessageRow` renders the draft row with an empty `<View>` next to the avatar (L54–56). There is no bubble. |
| 2 | Replies look like they land whole. | `wordDelay` in `askReveal.ts` is `34 + 3×len` ms per word (about 50 to 65 ms), roughly 20 words per second. A 40-word reply finishes in about 2.5 s. |
| 3 | The ring glow doesn't pulse as the Anchor types. | `AskSpeakingAvatar` runs a fixed 1100 ms bloom loop whenever `active`. Nothing ties it to the words. |
| 4 | A long reply starts with its first line cut off at the top. | `AskRevealText` lays out the whole text with a transparent tail, so the bubble is full height from its first frame. `onContentSizeChange` then calls `scrollToEnd({animated:false})` (AskChartView L141–143), which jumps to the bottom of the bubble. |
| 5 | "Stop" is a small text link above the composer. "Draft my route now" is a small text link. | AskChartView L228–235 (`statusRow`) and L246–250 (`secondary`). |
| 6 | The review screen leads with three equal cards and the route sits third. | `ChartCourseReviewScreen`: destination card, one-move card, then the route. |

---

## 1. Read first

| File | Lines of interest |
|------|-------------------|
| `components/v2/chart/ask/AskMessageRow.tsx` | draft branch L48–63; `AssistantRow` L101–123; `speaking` L104 |
| `components/v2/chart/ask/AskRevealText.tsx` | whole file (94 lines) |
| `components/v2/chart/ask/askReveal.ts` | `progress` / `done` / `active`, `wordDelay`, `tokenize`, `isWordToken` |
| `components/v2/chart/ask/AskAnchorAvatar.tsx` | `AskSpeakingAvatar` L52–77, `SPEAKING_AURA_LEVEL` |
| `components/v2/chart/ask/AskChartView.tsx` | `stick` / `onScroll` / `onContentSizeChange` L96–147; `rows` L102–112; `statusRow` L228–235; `actions` L239–252; `secondary` style |
| `components/v2/chart/ask/AskComposer.tsx` | send button L65–77 |
| `components/v2/chart/ask/AskSuggestions.tsx` | no change expected; read for the entrance stagger |
| `hooks/v2/chart/useAskChart.ts` | mount effect L79–103; `pump` L42–76 (`animate: !reducedMotion && !result.replayed`) |
| `hooks/v2/chart/askChartState.ts` | `draft`, `animate`, `turn_done` |
| `components/v2/chart/ChartCreationFlow.tsx` | `requestPlan` L401; `enterAsk` L410; `showReview` L427; Ask mount L717–727; stage/`ChartGenerationStage` L758–790 |
| `components/v2/chart/ChartCourseReviewScreen.tsx` | layout L84–150; `ChartDestinationCard` L36–52 |
| `components/v2/chart/ChartRouteEditor.tsx` | `ChartRouteEditor` L88–163; `Row` L165+; `routeDropIndexFromOffset` L45 |
| `components/v2/anchor/CircularAnchorRenderer.tsx`, `ThreadAura.tsx` | how `aura` takes `categoryColor`, `strengthProgress`, `strengthBloom` |
| `constants/v2/chartCopy.ts` | `ask` block (L116+), `review` block (L180+) |

Grep for every other consumer of `askReveal`, `tokenize`, `isWordToken`, `wordDelay`, `useAnyRevealing`, `useRevealing` before changing their meaning, and list them in your report.

## 2. Preservation rules (locked)

- **Unchanged:** route names and params, API paths and the `AskChartApi` surface, `useAskChart`'s return shape and `send` / `retry` / `cancel` signatures, `AskPlanInput`, AsyncStorage keys, and every existing analytics event name. New events are additive only (§3.9).
- **testIDs stay exactly:** `ask-list`, `ask-draft`, `ask-thinking`, `ask-bubble-*`, `ask-assistant-*`, `ask-user-*`, `ask-suggestions`, `ask-input`, `ask-send`, `ask-stop`, `ask-build-route`, `ask-draft-now`, `ask-error`, `ask-error-retry`, `chart-review-adjust`, `chart-review-confirm`, `chart-review-one-move`, `chart-route-add`, `chart-route-editor`, `chart-review-count`, `chart-review-destination`.
- **Generation honesty:** the generation stage keeps drawing only what the server returned. Fog of war and the leg-1-only survey stay. Do **not** port the prototype's full-route draw into `ChartGenerationStage`. The 1900 ms finish timer, `onRevealed → showReview`, the explore hand-off (`exploreDelta`, `chartMapScreenTop`) and the Pro gate (`onPremiumRequired`) are untouched.
- **Glow:** reuse `AskSpeakingAvatar`'s Thread Aura (Deon's deliberate exception to the no-glow-rings rule). Add no new rings or halos. The aura stays bound to the anchor's category colour, never hardcoded. Never read or write Thread Strength, and never show a number.
- **Reduced motion** (`reducedMotion` prop, `useV2ReduceMotion`): text appears whole, no pulse, no follow-glide, thinking dots static, no row stagger.
- **Deferred ≠ deleted.** Anything replaced stays as a `// DEFERRED:` comment saying what replaced it.
- **Vocabulary:** nothing in the forbidden list; no "prime/priming" in user-facing copy.
- No sound changes in this pass.

---

## 3. Change tables

### 3.1 Thinking bubble (`AskMessageRow.tsx`, `chartCopy.ts`)

| # | Where | Change |
|---|-------|--------|
| 1a | `AskMessageRow` L54–56 (`item.thinking`) | Replace the empty `<View>` with a `ThinkingBubble` (new component in `ask/`, testID `ask-thinking-bubble`). Same shell as `assistantBubble` (ivory, `borderRadius 26`, `borderTopLeftRadius 8`, `accent.border`, same shadow), padding 13 / 16, `flexDirection:'row'`, `alignSelf:'flex-start'`. Contents: three 7 pt dots filled `accent.fill`, then the status text (1b). Dot motion: translateY 0 → −5 and opacity .45 → 1, 1100 ms loop, 160 ms stagger (Reanimated, `ReduceMotion.Never`). |
| 1b | same | Status text (`typography.bodySM`, `colors.text.secondary`): hidden for the first 1100 ms of thinking, then shown and cycled every 1500 ms with a 180 ms opacity crossfade. Copy keys go in `CHART_COPY.ask.thinkingStatus` (reply) and `CHART_COPY.ask.openingStatus` (the row keyed `loading`): reply `['Reading your answer…', 'Weighing what it changes…', 'Shaping the next question…']`; opening `['Reading your intention…', 'Looking at your Vision…']`. |
| 1c | draft row | `AskSpeakingAvatar` gets `mode="thinking"` here (see 3.3). |
| 1d | draft row | Minimum visible time 600 ms: if the first delta arrives sooner, keep the bubble until 600 ms have passed, then fade the dots out (120 ms) and let the reveal begin in the same bubble. Implement as a small `useMinimumThinking(key, hasText, 600)` hook. It only holds the visual; it must not delay `dispatch`. |
| 1e | a11y | The avatar keeps `testID="ask-thinking"`; the bubble has `accessibilityLabel={COPY.thinking}` and no per-dot announcements. |
| 1f | reduced motion | Dots static at 70% opacity, status text shown from the start, no cycling. |

### 3.2 Character reveal (`AskRevealText.tsx`, `askReveal.ts`)

| # | Where | Change |
|---|-------|--------|
| 2a | `askReveal.ts` | The unit of `count` / `setCount` becomes **characters revealed** (code points, so never split a surrogate pair). It is in-memory only, so no migration. Update the doc comments. `finish`, `pause`, `markDone`, `isDone`, `isActive`, `reset`, `useAnyRevealing` and `useRevealing` keep their signatures. |
| 2b | `askReveal.ts` | Add `ASK_REVEAL = { msPerChar: 24, minMsPerChar: 9, capMs: 9000 }` and `charDelay(char, next)`: base `msPerChar`; `,` +85; `;` `:` `—` `–` +120; `.` `!` `?` `…` +230, but **only when the next character is whitespace or the end of text**, so "3.5" and "e.g." don't stall; the first newline of a paragraph break +300; whitespace characters add nothing and reveal in the same tick as the character before them. |
| 2c | `askReveal.ts` | Long replies: `msPerChar = clamp(capMs / totalChars, minMsPerChar, 24)`, so no reply takes more than about 9 s. |
| 2d | `AskRevealText.tsx` | Replace the word counter with a character counter. One character per tick through `setTimeout` (kept as the existing structure). If a perf run on the test device shows JS-thread frame drops, switch to 2 characters per 48 ms via one constant `CHARS_PER_TICK`, and say so in the report. |
| 2e | `AskRevealText.tsx` | Streaming (`final={false}`): the reveal waits at the end of what has arrived, as today. Catch-up: if more than 140 characters are waiting, tick twice as fast; more than 320, four times as fast, so the reveal never trails the stream by more than about 3 s. |
| 2f | `AskRevealText.tsx` | Keep the whole-text-laid-out approach (transparent tail) so the bubble never re-wraps. Keep `registerSkip` and tap-to-skip. A skip jumps to the end and calls `askReveal.finish`. |
| 2g | `askReveal.ts` | `tokenize`, `isWordToken` and `wordDelay`: if nothing else uses them, comment them out with `// DEFERRED: replaced by charDelay (Oct 2026)`. If something else uses them, keep them. |

### 3.3 Ring pulses with the words (`askReveal.ts`, `AskAnchorAvatar.tsx`, `AskRevealText.tsx`)

| # | Where | Change |
|---|-------|--------|
| 3a | `askReveal.ts` | Add a Reanimated shared value `askRevealEnergy = makeMutable(0)` and `askReveal.bump()`: `energy.value = withSequence(withTiming(1, {duration: 60}), withTiming(0, {duration: 380, easing: Easing.out(Easing.quad)}))`, `reduceMotion: ReduceMotion.Never`. |
| 3b | `AskRevealText.tsx` | Call `askReveal.bump()` once at each word boundary (the moment a whitespace character is revealed after a non-whitespace one). Never per character. Not when `reducedMotion` or when the text is restored instantly. |
| 3c | `AskSpeakingAvatar` | New prop `mode?: 'off' \| 'thinking' \| 'speaking'`. Keep `active` working (`active` with no `mode` means `'speaking'`). Keep the existing fade of the level shared value (320 ms in, 700 ms out). |
| 3d | `AskSpeakingAvatar` | `thinking`: today's behaviour (the 1.0 → 1.07 bloom loop, 1100 ms) at 0.8 of `SPEAKING_AURA_LEVEL`. `speaking`: no loop. `strengthProgress = useDerivedValue(() => level.value * full * (0.70 + 0.30 * askRevealEnergy.value))` and `strengthBloom = useDerivedValue(() => 1 + 0.07 * askRevealEnergy.value)`. Between words the glow settles to its 70% resting level, and it flares on each word. `off`: fades out as today. |
| 3e | `AskMessageRow` | Draft row: `mode="thinking"`. `AssistantRow`: `mode={speaking ? 'speaking' : 'off'}`. |
| 3f | Test | The aura gets the category's colour: render for two categories (e.g. career, health) and assert `ThreadAura` receives the matching `categoryColor`. If the aura does not use the category colour, report it and stop; don't patch around it. |

### 3.4 Follow-scroll (`AskChartView.tsx`, `AskRevealText.tsx`, `AskMessageRow.tsx`)

| # | Where | Change |
|---|-------|--------|
| 4a | `AskChartView` | Add a `CellRendererComponent` to the `FlatList` that records each cell's `{y, height}` in a `cellLayout` ref (`Map<key, layout>`), forwarding the original `onLayout`. If this breaks virtualization or `removeClippedSubviews`, fall back to `measureLayout` against the scroll node, and say which you used. |
| 4b | `AskRevealText` | Add `onLine?: (lineBottomY: number) => void`. Use `onTextLayout` on the full text to get each line's `y` and `height`. As the character counter advances, work out the current line and call `onLine` **only when the line index changes** (never per character). `y` is relative to the `<Text>`. |
| 4c | `AskMessageRow` | Pass `onLine` up as `onFollow(key, y + paddingTop)` (the bubble's `paddingTop` is 14). Add it to the props and to the `renderItem` deps. |
| 4d | `AskChartView` `followLine(key, yInRow)` | If `stick.current`: `desired = cell.y + yInRow + spacing[4] - listHeight`. Clamp so the bubble top stays visible: `desired = Math.min(desired, cell.y - spacing[3])`. If `desired > currentOffset`, call `scrollToOffset({ offset: desired, animated: true })`. Reduced motion: `animated: false`. |
| 4e | `AskChartView` L141–143 | `onContentSizeChange` keeps calling `scrollToEnd`, but with `animated: true`, and **not** while the last assistant row is being revealed (`useAnyRevealing()` / `askReveal.isActive`). During a reveal only `followLine` scrolls. The suggestions footer, error rows and the person's own new message still scroll to the end. |
| 4f | `AskChartView` | When `stick.current` is false (the person scrolled up more than the existing 96 pt threshold) and a reveal is active or new content arrived below: show a "New" pill (navy, `ArrowDown` 14 pt, label `CHART_COPY.ask.jumpToLatest = 'New'`, testID `ask-new-pill`) just above the footer. Tapping it sets `stick.current = true`, calls `scrollToEnd({animated:true})` and hides the pill. It hides itself when the list is back within 96 pt of the bottom. Nothing ever yanks a person who scrolled up. |
| 4g | `AskChartView` | When the suggestions footer mounts after a reveal, the resulting content-size change scrolls (animated) so the chips are fully visible with `spacing[4]` clearance above the footer. |

### 3.5 Stop control and "Draft my route now" (`AskChartView.tsx`, `AskComposer.tsx`)

| # | Where | Change |
|---|-------|--------|
| 5a | `AskComposer` | New props `busy?: boolean`, `onStop?: () => void`. While `busy`, the 48 pt send button shows a filled 16 pt square (lucide `Square`, filled with `accent.onFill`) on `accent.fill` at full opacity, with `accessibilityLabel={COPY.stop}` and `testID="ask-stop"`. Pressing it calls `onStop` (a light haptic like send). Icons crossfade over 140 ms. When not busy, everything is as today (`testID="ask-send"`). |
| 5b | `AskChartView` L228–235 | Remove the "Stop" text link and its row. Keep the `preparingChange` status text (`stage === 'preparing_change'`) as a one-line text above the composer with no Stop. Pass `busy={state.turn !== 'idle'}` and `onStop={ask.cancel}` to `AskComposer`. Comment the removed row `// DEFERRED: replaced by the composer stop control (Oct 2026)`. |
| 5c | `AskChartView` `secondary` / `secondaryText` | The secondary action becomes an outlined pill: 44 pt high, horizontal padding 18, `borderWidth 1.25`, `borderColor ASK_TOKENS.ink`, transparent fill, label `typography.labelMD` in `ASK_TOKENS.ink`, trailing `ArrowRight` 14 pt, centred. Enter with `FadeInDown` 200 ms (reduced motion: none). `testID` and `label` unchanged. The primary "Build my route" is unchanged. |

### 3.6 Opening greeting wait (`useAskChart.ts`, `ChartCreationFlow.tsx`, new `askOpeningPrefetch.ts`)

**Step 1: measure first (report before building step 2).** Add dev-log marks and one additive field on the existing `ask_chart_turn` event, `firstDeltaMs`. Marks: mount → `getConversation` resolved → `turn` started → first `onReply` delta → `turn_done`. Run once on the device and paste the breakdown.

| # | Where | Change |
|---|-------|--------|
| 6a | new `hooks/v2/chart/askOpeningPrefetch.ts` | `startAskOpening(anchorId, api = askChartApi)`: returns a shared promise, cached per `anchorId` for 3 minutes. It runs `getConversation`; only if the conversation is empty does it run the opening `turn` (`opening: true`) with the same idempotency key the hook would use (export `openingKeyFor(anchorId)` and have `useAskChart` read the key from there, so one greeting exists per anchor server-side). It **buffers** the stream and the final result; it dispatches nothing. Failures resolve to `null`. |
| 6b | `ChartCreationFlow` | Call `startAskOpening(anchorId)` as soon as `phase === 'intro'` mounts (next to the existing intro prefetch), only when the anchor has no Chart and the Ask will be offered. Don't await it. |
| 6c | `useAskChart` mount effect | If a prefetch exists, await it. On success dispatch `loaded` and then `turn_done` with `animate: !reducedMotion` (**not** `replayed`, because this client generated it, so it must animate) and skip the second API call. If it is `null` or stale, run today's path unchanged. If it is still in flight when Ask mounts, show the thinking bubble (3.1) with the opening status copy and join the same promise. |
| 6d | all | The buffered greeting plays through the normal reveal (3.2). Don't pre-reveal it. |
| 6e | cost | One extra opening generation per person who reaches the Chart intro without continuing. Acceptable; mention it in the report. Don't prefetch when `greet === false`. |

### 3.7 Ask → generation hand-off (`ChartCreationFlow.tsx`, no generation rebuild)

| # | Where | Change |
|---|-------|--------|
| 7a | `requestPlan` / Ask visibility | Today the Ask view disappears at once when `phase` becomes `'generating'`. Change the visual only: keep the Ask mounted for 450 ms with the composer disabled and the avatar in `thinking`, cross-fading the Ask out (`askIn` → 0, `CHART_EASING.exit`) while the generation map fades in. **Do not delay `runPlan` or the API call.** Inspect how the Ask is hidden when `phase !== 'ask'` (`styles.hidden`) and adapt. Reduced motion: current behaviour. |

### 3.8 Review screen (`ChartCourseReviewScreen.tsx`, `ChartRouteEditor.tsx`)

| # | File | Change |
|---|------|--------|
| 8a | `ChartCourseReviewScreen` | Order becomes: headline, intro, a **compact** destination (one row: `YOUR DESTINATION` eyebrow above the serif line at 19/25, no extra padding; add `compact?: boolean` to `ChartDestinationCard`), then the **route section directly**. Remove the one-move card from the top (8b moves it). The footer is unchanged in meaning. |
| 8b | `ChartRouteEditor` | Add `renderRowExtra?: (waypoint: DraftWaypoint, index: number) => React.ReactNode`. Restructure `Row` so the outer `Animated.View` is a column holding the existing row content (badge, title, handle) in an inner row, then the extra, indented by badge width + gap (28 + `spacing[3]`). The existing `onLayout` on the outer view already feeds `rowHeights`, so drag math stays correct. The rail geometry must centre on the **title line**: use `ROW_HEIGHT / 2` instead of `rowHeights[index] / 2`. |
| 8c | `ChartCourseReviewScreen` | Pass `renderRowExtra` returning the existing one-move block for the **first named waypoint only** (`firstNamedIndex`): eyebrow `YOUR NEXT MOVE` with its `FOR WAYPOINT n` pill, the `oneMoveFor(...)` explainer, and the same multiline `TextInput` with its auto-height logic and `testID="chart-review-one-move"`. Props `oneMove` / `onOneMoveChange` and the `Pencil` stay. If the person drags a different waypoint to the top, the block follows the first named one. Old top-of-screen card: `// DEFERRED: folded into the first waypoint row (Oct 2026)`. |
| 8d | `ChartRouteEditor` | Handle icon: `GripVertical` instead of `GripHorizontal`, same 44 × `ROW_HEIGHT` hit area, `colors.text.secondary`. |
| 8e | `ChartCourseReviewScreen` footer | `actions` currently wraps ("Reveal my Chart →" breaks onto two lines at about 390 pt). Make it a single non-wrapping row: `Adjust route` `flex: 0.8`, `Reveal my Chart` `flex: 1.2`, labels `numberOfLines={1}`. Allow wrapping only when the system font scale is ≥ 1.3. |
| 8f | Review arrival | After `showReview`'s panel rise settles (`TT.panelIn` + 100 ms), each route row enters with `FadeInDown` 360 ms, 70 ms stagger, capped at 8 rows. Only the first time the review mounts for that proposal. Never on edits, reorders or re-renders (track entered `waypoint.key`s in a ref). Reduced motion: none. |
| 8g | Do not change | "Adjust route" still opens `ChartAdjustPanel` (the AI revision). Do not rename it. "Add waypoint" stays the in-list row. `MAX_WAYPOINTS` stays 12 and the minimum stays 1. The prototype's 3 and 7 are not product rules. The `Reveal my Chart` hand-off (`save()` → reveal → explore) is unchanged. |

### 3.9 Analytics (additive only)

`ask_chart_reveal_skipped { chars, total }`, `ask_chart_follow_released {}` (the person scrolled up during a reveal), and the `firstDeltaMs` field on `ask_chart_turn`. No other events, and no renames.

---

## 4. Tests

- `askReveal`: `charDelay` values; no pause on `3.5` / `e.g.`; surrogate pairs are never split; the 9 s cap scaling; the catch-up multipliers at 140 and 320 characters of backlog.
- `AskRevealText` (fake timers): exactly N characters visible after N ticks, the tail is transparent, a restored (`isDone`) key renders whole instantly, tap-skip finishes immediately, `onLine` fires once per line.
- Pulse: `bump` fires once per word boundary, never per character, and never under `reducedMotion`.
- `AskMessageRow` draft: shows `ask-thinking-bubble`, status text appears at 1100 ms and cycles, 600 ms minimum hold, static under reduced motion.
- `AskChartView`: with a bubble taller than the list, `scrollToOffset` never exceeds `cell.y − spacing[3]`; with `stick=false` there are no scroll calls and `ask-new-pill` appears; the pill hides at the bottom; the text "Stop" is gone and `ask-stop` is in the composer while busy; `ask-draft-now` is a bordered button.
- `useAskChart` + prefetch: a prefetched opening is consumed with no second `turn` call, `animate` is true, the idempotency key is shared, a failed or stale prefetch falls back to today's path.
- Aura category colour (3f).
- Review: the next-move input renders inside the first named row with its testID, `routeDropIndexFromOffset` still resolves correctly with a tall first row (add a case), rail geometry, the footer stays on one row at 360 dp, and row entrance runs once.
- Run the existing `AskChartView.test.tsx`, `ChartCourseReviewScreen.test.tsx`, `V2ChartScreen.test.tsx` and the ChartCreationFlow tests. Report failure counts **before and after**; don't fix unrelated failures.

## 5. Acceptance criteria (device)

- [ ] On entering Ask, a thinking bubble (dots in the category colour) is visible within 150 ms of the first frame whenever the greeting isn't ready; no avatar-only gap.
- [ ] Opening-greeting timing breakdown pasted (§3.6 step 1), plus the same numbers after prefetch. After prefetch the first character appears within 500 ms of Ask becoming visible on a normal connection.
- [ ] Text arrives about 40 characters per second with visible pauses at punctuation; a 3-sentence reply takes a few seconds, not under 3.
- [ ] The ring flares on each word and settles between words; the colour matches the anchor's category (check a Career and a Health anchor); it fades out when the reply ends or is skipped.
- [ ] During a long reply the first line stays on screen and the list glides one line at a time; scrolling up mid-reply stops following and shows "New".
- [ ] The Stop square replaces send while the Anchor is working; the "Stop" text link is gone; "Draft my route now" is an outlined button.
- [ ] Review: route first, next move inside waypoint 1, drag works with the expanded row, the footer is on one row, rows settle in once.
- [ ] Reduced motion pass: instant text, static dots, no pulse, no stagger.
- [ ] `npx tsc --noEmit` and the touched Jest suites pass; real output is included in the report.

## 6. Report back

Files changed; the §3.6 timing breakdown; the `CellRendererComponent` vs `measureLayout` decision; whether `CHARS_PER_TICK` stayed at 1; every other consumer of `askReveal` you found; failure counts before and after; anything you deliberately did not do and why.
