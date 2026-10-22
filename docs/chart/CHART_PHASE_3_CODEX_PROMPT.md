# Codex prompt: Chart phase 3 (the sheet over the map)

**Repo:** `E:\Projects\Anchor`. Active app: `anchor/mobile/src/` (NOT `anchor-v2/`).

**Approved references:**
- Plan: "Chart — Its Own Experience" (doc), section "Map-first layout".
- Motion prototype: "Chart Sheet Prototype" (artifact). It is the source of truth for layout, detents and behaviour. Where this prompt and the prototype disagree on a number, this prompt wins.
- Mobbin references used for the pattern: ride-hailing sheets (Waymo, Uber, Freenow) for one status line and one action at peek and a stop list higher up; Transit's segmented progress bar; Garmin's dark sheet over a light map.

**Builds on:** `CHART_PHASES_1_2_CODEX_PROMPT.md` plus follow-ups 1–4. All of it is already in the tree: living weather, the clouds-first veil, the open/later sequences, `useChartSound`, `ChartRevealHandoff`, route honesty, `chartWeatherHandoff`, `chartLastOpened`, and the dev lab fake actions.

**Scope:**
- The full-bleed map.
- The three-detent ink sheet that replaces the ScrollView panel.
- Waypoint viewing from the sheet.
- No card swaps during sequences, which fixes the slow frames measured in the last run.

**Out of scope (do not start):**
- Summit anchor art and the category glow (phase 4).
- The Home/Details card-to-map transition (phase 5).
- New copy beyond the strings listed in §6.
- New analytics events.

---

## 0. Read first (in this order)

| # | File | Why |
|---|---|---|
| 1 | `components/v2/chart/ChartActiveView.tsx` | It hosts the ScrollView, the `paddingTop: insets.top + 100` strip, `mapHeight`, `ChartScallop`, `panelStyle`, `ChartReachBeat`, the menu and the confirm sheet. This is the main rewrite. |
| 2 | `components/v2/chart/ChartWaypointContent.tsx` | Every panel block and handler: `OneMoveCard`, `DayClosedCard`, `CommitCard`, `MoveListRow`, `ChartMovesManager`, the progress block, the practice row, `PanelButton`, `DestinationCard`, `CourseLogCard`, the progress sheet and the edit modal. |
| 3 | `components/v2/chart/map/ChartWeatherHold.tsx` | `CHART_MAP_TOP`, `chartMapScreenTop()`: the one helper both creation and the loading hold use to line up the map. |
| 4 | `components/v2/chart/ChartCreationFlow.tsx` (around lines 440–600), `ChartRevealHandoff.tsx`, `map/chartWeatherHandoff.ts` | `exploreDelta` and the reveal handoff that must stay pixel-aligned. |
| 5 | `components/v2/chart/map/ChartMap.tsx`, `useChartMapCamera.ts`, `chartMapGeometry.ts` (`clampCamera`), `ChartMapMarkers.tsx`, `ChartMapWeather.tsx` | The camera model and the viewport. |
| 6 | `components/v2/chart/map/chartMapSequences.ts`, `chartMotion.ts` | `onPanel`, the ceremonies and the timings. |
| 7 | `components/v2/chart/panel/ChartMapHeader.tsx`, `components/v2/primitives/V2SheetModal.tsx` | The header overlay, plus the existing sheet grab-zone and skirt conventions. |
| 8 | `screens/v2/chart/V2ChartScreen.tsx` | The host. **The Pro-gate work (`creationLocked`, `openPaywall`) stays exactly as it is.** |
| 9 | Every `__tests__` folder under `components/v2/chart`, `screens/v2/chart` and `components/chart` | Existing contracts and testIDs. |

## 1. Preservation rules (locked)

- **Everything locked in phases 1–2 §1 still holds.** That covers route names and params, analytics events, storage keys, `useAnchorChart`, server-authoritative reach and move completion, `CHART_COPY` (apart from the §6 additions), the vocabulary rules, Reduce Motion via `useV2ReduceMotion`, and `// DEFERRED:` instead of deleting.
- **Every existing `testID` stays present and reachable** in the new sheet. That includes the `chart-waypoint-*`, `chart-mark-waypoint-cta`, `chart-practice-row`, `chart-progress-*`, `chart-edit-waypoint-*`, `chart-back-to-current`, `chart-action-error`, `chart-reach-error`, `chart-still-right` and `chart-menu*` IDs.
- **Behaviour handlers are moved, not rewritten:** complete move, promote, dismiss, progress update, edit and remove waypoint, reach, archive and delete.
- **Phases 1–2 behaviour stays:**
  - the clouds-first veil and the first-frame guarantee
  - the open and later sequences with their beats and sounds
  - route honesty
  - the `ChartRevealHandoff` overlap and flattened fade
  - Home/Details cards and the creation intro unchanged
- **No new dependencies.** There is no `@gorhom/bottom-sheet` in the repo. Build the sheet with `react-native-gesture-handler` (~2.28) and Reanimated (~4.1), which are already installed.
- **`ChartWaypointContent` is not deleted.** Its blocks are exported and reused (§3.2). Its old single-column render is kept behind `// DEFERRED:`.

## 2. Full-bleed map

| # | File | Change |
|---|---|---|
| 2.1 | `ChartActiveView.tsx` | Comment out with `// DEFERRED:` the `ScrollView`, the `paddingTop: insets.top + 100` paper strip, the `mapHeight` formula, `ChartScallop` and `panelStyle`. The root becomes `View flex:1, backgroundColor: T.paper`. `ChartMap` fills the window (`width × height`). The header stays absolute on top. |
| 2.2 | `useChartMapCamera.ts` / `chartMapGeometry.ts` | Add a camera frame mode `fullBleed` alongside the current clamped mode, which Home/Details crops and creation keep. See the mapping below. Thread an optional `frame` prop through `ChartMap` → land, weather, overlay and markers. Default is the current mode. |
| 2.3 | `map/ChartWeatherHold.tsx` | Update `chartMapScreenTop()` to return the full-bleed art top (`artTop`). Comment out `CHART_MAP_TOP` with `// DEFERRED:`. The loading hold and creation's `exploreDelta` both read this helper, so the reveal alignment follows automatically. **Verify it still lands pixel-exact** (§8). |
| 2.4 | `ChartActiveView.tsx` | `StatusBar` stays `dark-content` over paper. The weather padding already covers the area beyond the art. Paper only shows above and below the art inside that padded cloud cover, so nothing changes there. |

**`fullBleed` mapping.**
- `k = W / 852`
- `artTop = insets.top + 45` (the bottom of the header bar)
- `FY = artTop + 590·k`
- For camera `(cx, cy, s)`: `tx = W/2 − cx·k·s`, `ty = FY − cy·k·s`
- Clamp x only, so the art edge never shows horizontally: when `s ≥ 1`, `tx ∈ [W − W·s, 0]`; when `s < 1`, centre it.
- Never clamp y; paper and padded weather fill it.
- At overview (`426, 590, 1`) the art spans `x 0…W`, `y artTop…artTop + 1180·k`.
- The weather parallax derivation keeps using `T_overview` from this mode.

## 3. The sheet

| # | File | Change |
|---|---|---|
| 3.1 | new `components/v2/chart/sheet/ChartSheet.tsx` | The draggable container. Detents, gestures and motion are specified below. |
| 3.2 | `ChartWaypointContent.tsx` | Export the internal blocks unchanged, same props and same testIDs: `OneMoveCard`, `DayClosedCard`, `CommitCard`, `MoveListRow`, `PanelButton`, `DestinationCard`, `CourseLogCard`, plus the progress block as `WaypointProgressBlock` and the practice row as `PracticeRow`. The progress sheet and the edit-waypoint modal stay owned by one component and are opened from the new content. |
| 3.3 | new `components/v2/chart/sheet/ChartSheetContent.tsx` | Composes those blocks into the three tiers (§3.4). It owns the "viewing" state UI and the in-place cross-fade. |
| 3.4 | new `components/v2/chart/sheet/ChartRouteSegments.tsx` and `ChartRouteList.tsx` | The segmented bar and the route list (§3.4). |
| 3.5 | `ChartActiveView.tsx` | Mount `ChartSheet` + `ChartSheetContent` over the map. Wire detent state, viewing, taps and ceremonies (§4). `showStillRight` moves into the sheet at the top of the half tier. `stale` (offline) shows as a line under the peek eyebrow. |

**Detents** (window y of the sheet's top edge; `H` = window height):

| Detent | Top y | Visible content |
|---|---|---|
| hidden | `H` | Before the entrance's `onPanel` |
| peek | `H − (162 + insets.bottom)` | Peek tier |
| half | `H − round(0.56·H)` | Peek + half tiers |
| full | `artTop + 128` (just below the Vision polaroid; clamped so the sheet is ≥ 0.62·H tall) | All tiers. Content scrolls inside. |

**Sheet look.**
- Background `T.ink`, top radius 26, shadow `0 −10 30 rgba(17,24,32,.45)`, grabber 38×5 at `rgba(239,234,223,.28)`.
- Padding: 20 horizontal, 4 top; bottom padding = `insets.bottom + 24`.
- Its height is `H − fullTop`; it moves only by `translateY`, never by changing height.

**Gestures** (gesture-handler `Gesture.Pan`, all on the UI thread):
- **The grab zone (grabber + peek header row) always drags.**
- **The content area drags the sheet unless it's at full.** At full the content is a `ScrollView`. When it's scrolled to the top and the user pulls down, the sheet drags (simultaneous handlers with `scrollY ≤ 0` gating). This is the standard map-sheet behaviour.
- **On release,** a flick faster than 800 pt/s goes to the next detent in that direction. Otherwise it snaps to the nearest detent.
- **Snap motion:** `withTiming(…, 360ms, CHART_EASING.settle)`, no spring overshoot. Under Reduce Motion it's 180ms linear.
- **Tapping the grabber** cycles peek → half → full → peek. The grabber is an `accessibilityRole="button"` labelled "Expand panel" or "Collapse panel", announcing the new detent.
- **Hardware back:** if the sheet is above peek, go to peek. Otherwise use the existing `offCurrent` and back behaviour.
- **Dragging is disabled while a sequence runs** (`runner.isBusy()`): the open, a reach, an arrival or a move check.

**The map recedes behind the sheet.**
- `f = clamp((peekY − sheetY) / (peekY − halfY), 0, 1)` as a derived value.
- Map dim overlay: `rgba(17,24,32, 0.15·f)`, `pointerEvents="none"`.
- When the sheet settles at half or full, the camera eases to overview at `s 0.96` (420ms, deliberate). Back at peek, it returns to `s 1`.
- This camera move only happens on detent change, never per frame during a drag.
- The flag, sway, drift and air bed keep running throughout.

### 3.4 Tiers

**Peek** (fixed height; nothing in it changes height between states):
1. Row: the eyebrow `Waypoint {n} of {N} · {Current|Reached|Upcoming}` (category label colour for the current waypoint, muted otherwise) on the left; the compact value on the right (`valueRow.strong` + unit, for example "2 of 5 leads"), hidden when viewing another waypoint.
2. Title: serif 24, two lines max.
3. One of these, in priority order:
   - `CommitCard`, while `commit` is set.
   - `DayClosedCard`, when the day is closed.
   - `OneMoveCard`, collapsed. Its expanded "other moves" list renders in the full tier, not inline.
   - Read-only, when viewing another waypoint: the rationale (two lines) + a "Back to waypoint {current}" outline button (`testID chart-back-to-current`).

**Half** (fades in 0 → 1 as the sheet passes peek → half; opacity 0 at peek):
- the `showStillRight` card, when set
- `ChartRouteSegments`
- `WaypointProgressBlock` (value row + edit progress)
- `PracticeRow`
- the Mark reached `PanelButton` + the reach and action error lines

When viewing another waypoint, the half tier instead shows that waypoint's moves (read-only `MoveListRow`s), plus `ChartMovesManager` if it's editable, as today.

**Full** (scrolls):
- "Your route" (`ChartRouteList`)
- the current waypoint's other moves + `ChartMovesManager`
- `DestinationCard` (with the Vision image)
- `CourseLogCard`

**`ChartRouteSegments`:**
- N equal segments, 6pt tall, radius 3, gap 4, track `#2A3440`.
- Fill: reached = 1, current = the same `p` the drawn route uses (`waypointFraction`), upcoming = 0.
- Colour is the category label colour.
- Fill width animates over 600ms with the settle easing.
- Under Reduce Motion it's a 180ms cross-fade.

**`ChartRouteList`:**
- One row per waypoint: number dot (filled for reached, ring for current, dashed for upcoming), title, and a right meta: `Reached {MMM d}` for reached, `{p}%` for current, nothing for upcoming.
- A 2pt connector line runs between the dots.
- Rows are buttons (`Waypoint {n}: {title}`) that call `viewWaypoint(i)` (§4).
- Upcoming titles show in muted text. The user wrote them, so this isn't a spoiler. The map still keeps them under cloud.

**In-place swap (no card swaps).** When the viewed waypoint changes, or a ceremony changes the current waypoint, the content container fades to 0 (120ms), the content updates, then it fades back in (160ms). The container keeps its frame. Never mount or unmount a tier, and never animate layout height, while a map sequence runs. If an update lands mid-sequence, defer the swap to the sequence's next `call` step or its `onEnd`. This is the fix for the 50–117ms gaps measured on move checks and reaches.

## 4. Interaction wiring (`ChartActiveView`)

| Event | Behaviour |
|---|---|
| Entrance `onPanel` | The sheet goes hidden → peek (360ms settle), replacing the old `panelStyle` fade. Reduce Motion: a 180ms fade-in at peek. |
| Reveal entrance (from creation) | The same `onPanel` → peek, and `ChartRevealHandoff` is unchanged. The last creation frame and the first Chart frame must still match (§8). |
| Marker tap | The existing `handleMarkerPress` logic, plus `viewWaypoint(index)`. |
| Route-list row tap | `viewWaypoint(index)`. |
| `viewWaypoint(i)` | `setViewIdx(i)`, sheet to peek, content swap, camera `focusOn(i)`. For `i === currentIndex`, go back to overview (`backToCurrent`). The selected marker keeps its existing selected ring. |
| Map tap (not a marker) | If a sequence is busy, skip it (existing). Else, if viewing a non-current waypoint, `backToCurrent()`. Else, if the sheet is above peek, go to peek. Else, the existing zoom toggle. |
| Move check | Sheet to peek if needed. The sequence and beats are unchanged. The content updates in place: the segment fill, the value and the next One Move. |
| Reach / Mark reached confirm | Sheet to peek at step 0, before the stamp. The reach beat card positions itself 12pt above the peek top, not at a fixed bottom. The current waypoint's content swaps at the sequence's existing commit step. |
| Arrival | Sheet to peek. Then the existing arrival sequence, with the sheet's content swapping to the arrived state at `panelAt`. |
| Menu (`…`) | Unchanged (`V2SheetModal` above everything). |

## 5. Performance

- **One gesture and one derived value drive the sheet, the dim and the tier opacities.** No `setState` per frame.
- **Only these update React state:** a detent settling, a viewed-waypoint change, and server data. Each is a single state update.
- **During a running sequence, defer content swaps** to sequence steps (§3.4).
- **The weather canvas is untouched by sheet motion.** The dim is a separate RN view.
- **Measure on the S24 Ultra with a release-like build** (EAS preview, or dev with JS dev mode off). If the S24 isn't reachable, use the emulator and label the numbers as emulator numbers. Use `dumpsys gfxinfo … framestats`, de-duplicated per vsync like the last run.
  - Idle at peek, 10s: at least 58fps, no frame over 32ms.
  - A drag peek → full → peek, plus three flicks: at least 55fps, no gap over 50ms.
  - A move check and a reach: at least 55fps, no gap over 50ms. That's down from 117ms and 67ms in the last run.

## 6. Copy

| Key (add to `CHART_COPY.sheet`) | Text |
|---|---|
| `expand` | Expand panel |
| `collapse` | Collapse panel |
| `eyebrow` | Waypoint {n} of {N} · {state} |
| `stateCurrent` / `stateReached` / `stateUpcoming` | Current / Reached / Upcoming |
| `routeHeading` | Your route |
| `reachedOn` | Reached {date} |
| `backTo` | Back to waypoint {n} |

No other copy changes. Existing labels keep their current `CHART_COPY` keys.

## 7. Tests (add or update; keep all existing passing)

- **`ChartSheet.test.tsx`:** the detent positions for a 390×844 window with insets 47/34; grabber cycling and labels; hardware back to peek; drag disabled while busy; Reduce Motion timing.
- **`ChartSheetContent.test.tsx`:**
  - the peek priority order (commit > day closed > One Move > read-only)
  - the half tier hidden at peek
  - viewing an upcoming waypoint shows its rationale and the back button
  - every legacy testID is present
- **`ChartRouteSegments.test.tsx`** and **`ChartRouteList.test.tsx`:** fills match the route's `p`; meta strings; row press calls `viewWaypoint`.
- **`ChartActiveView` tests:**
  - the entrance ends with the sheet at peek
  - a marker tap goes to peek and focuses the marker
  - a map tap goes back to current
  - a reach forces peek before the stamp beat
  - no content swap mid-sequence (spy on render counts of the tier containers during a reach)
- **Camera:** a `fullBleed` mapping test (the overview art spans `0…W` horizontally from `artTop`, x is clamped, y isn't), and the clamped mode unchanged for crops.
- **Creation:** `exploreDelta` equals the new `chartMapScreenTop` delta; `chartCreationWeather.test.tsx` passes.
- **Run:** `npx tsc --noEmit`, the Chart, screen and hook jest suites, and an Android export.

## 8. Acceptance criteria

- [ ] The map is full-bleed. There's no paper strip, no ScrollView and no scallop. The header and Vision polaroid float on the map.
- [ ] At peek, the waypoint, the value and the One Move check are visible and usable one-handed. The map is at least 70% of the screen.
- [ ] Drags and flicks snap to peek, half and full. Content scrolls only at full, and pulling down from the top of the scroll drags the sheet.
- [ ] The map dims (up to 15%) and eases back to `s 0.96` at half or full, and returns at peek.
- [ ] A marker or route-row tap flies the camera there, swaps the sheet content in place at peek, and "Back to waypoint n" returns. The sheet frame never jumps.
- [ ] A move check, a reach and an arrival force peek first. The reach beat card sits just above the sheet.
- [ ] The phases 1–2 gates still pass. A 0.25× recording of a cold open, a later visit and Create → Review → Explore shows zero bare-paper frames, zero uncovered-terrain frames, and a pixel-aligned reveal handoff.
- [ ] The §5 frame targets are met, with the numbers reported (device or labelled emulator).
- [ ] Home/Details cards, `ChartPreview` and the creation intro are unchanged. Every legacy testID is present.
- [ ] tsc is clean, and the tests pass apart from the existing `ChartPreview` snapshot failures. The Android export succeeds.
- [ ] Every removal is behind `// DEFERRED:`, with no deletions. The Pro-gate changes are intact.
- [ ] **Report:** files changed, tests added, the frame numbers, recordings, and any deviation with the reason.
