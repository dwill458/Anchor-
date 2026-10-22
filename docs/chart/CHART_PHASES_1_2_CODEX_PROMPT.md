# Codex prompt: Chart phases 1–2 (entrance, living weather, sound)

**Repo:** `E:\Projects\Anchor`. Active app: `anchor/mobile/src/` (NOT `anchor-v2/`).
**Approved references:**
- Plan: "Chart — Its Own Experience" (doc).
- Motion prototype: "Chart Entrance Prototype" (artifact, Proposed mode). This is the visual and timing source of truth. Where this prompt and the prototype disagree on a number, this prompt wins.
- Sound files (already trimmed and levelled): `design/sound/chart/processed/*.mp3`.

**Scope:** phase 1 (entrance + clouds-first), phase 2 (living weather) and the Chart sound layer. One shipped change, measured on the Galaxy before phase 3.

**Out of scope (do not start):**
- The map-first bottom sheet (phase 3). The ScrollView layout stays.
- Summit anchor art and the category glow (phase 4).
- The Home/Details card-to-map transition (phase 5).
- Per-category landscapes.

---

## 0. Read first (in this order)

| # | File | Why |
|---|---|---|
| 1 | `screens/v2/chart/V2ChartScreen.tsx` | Route host, loading state, `animation: 'none'` setOptions. **Contains uncommitted Pro-gate work (`creationLocked`, `openPaywall`). Keep it exactly.** |
| 2 | `navigation/v2/AnchorV2Navigator.tsx` (lines ~380–395), `navigation/v2/transitions.ts` | Chart route options and backgrounds |
| 3 | `components/v2/chart/ChartActiveView.tsx` | Open, move-check and reach orchestration, `entrance` prop |
| 4 | `components/v2/chart/map/chartMapSequences.ts`, `chartSequence.ts`, `useChartSequencer.ts`, `chartMapContracts.ts` | Sequence builders, the engine, `SequenceEasing`, `ChartMapAnimState` |
| 5 | `components/v2/chart/chartMotion.ts` | `CHART_MAP_TIMING`, `CHART_EASING` |
| 6 | `components/v2/chart/map/ChartMap.tsx`, `ChartMapLand.tsx`, `ChartMapOverlay.tsx`, `ChartMapMarkers.tsx`, `chartMapShaders.ts`, `useChartMapCamera.ts`, `useChartMapAnimState.ts` | Rendering layers, `CLOUD_SKSL`, the fog field, the camera |
| 7 | `hooks/useAudio.ts`, `utils/haptics.ts` | Audio players (expo-audio) and `safeHaptics` |
| 8 | `hooks/v2/chart/chartHighWater.ts` | The pattern for presentation-only encrypted persistence |
| 9 | `components/v2/chart/map/__tests__/*`, `components/v2/chart/__tests__/*`, `screens/v2/chart/__tests__/*` | Existing contracts |

## 1. Preservation rules (locked)

- **Route names and params** are unchanged: `V2Chart`, `V2ChartWaypoint`, `V2ChartAdjust`, `V2ChartJourney`, `V2ChartRouteParams`.
- **Analytics events and properties** are unchanged (`chart_opened`, `chart_*`).
- **Storage keys are unchanged** (`anchor:v2:chart2:hw:*` and all cache keys). The one new key is listed in §6.
- **`useAnchorChart`, server-authoritative reach and move completion** are untouched. Ceremonies still play only after the server confirms.
- **Every existing `testID` stays.** `ChartMap`, `ChartActiveView` and sequence-builder props stay compatible; new props are optional only.
- **`CHART_COPY` is not changed.** Vocabulary rules still apply: no streak, no points.
- **Deferred ≠ deleted.** Anything removed is commented out with `// DEFERRED:` and never deleted (old `CLOUD_SKSL` usage, `animation: 'none'`, old timings).
- **Reduce Motion** comes from `useV2ReduceMotion` everywhere, and Chart timings keep `ReduceMotion.Never`, as now.
- **No new dependencies.** Skia, Reanimated, expo-audio and expo-haptics are already installed.

## 2. Entrance (phase 1)

| # | File | Change |
|---|---|---|
| 2.1 | `V2ChartScreen.tsx` | In the `navigation.setOptions` effect, keep `gestureEnabled: !spatialFocused` and comment out `animation: 'none'` with `// DEFERRED: hard cut on push/pop`. |
| 2.2 | `AnchorV2Navigator.tsx` | `V2Chart` options `GRAPHITE_BACKGROUND` → `CREAM_BACKGROUND`, so frame one is map paper, not graphite. `V2ChartWaypoint` keeps `animation: 'none'` (deep-link host) but also switches to `CREAM_BACKGROUND`. |
| 2.3 | `V2ChartScreen.tsx` | Replace the `ActivityIndicator` loading body with a new `ChartWeatherHold`. Keep `testID="v2-chart-screen-loading"` and the label "Opening your Chart". |
| 2.4 | new `components/v2/chart/map/ChartWeatherHold.tsx` | Paper background plus full cloud cover (§3 weather, `closed = 1`, slow drift; static under Reduce Motion). When data lands, `ChartActiveView` mounts already at `closed = 1`, so the clouds simply part. No spinner. |
| 2.5 | `chartMapContracts.ts` | Add to `ChartMapAnimState`: `coverArc: SharedValue<number>` (cloud corridor, separate from `revealArc` ink) and `closed: SharedValue<number>` (1 = full cover everywhere). Extend `SequenceEasing` with `'settle' \| 'draw' \| 'deliberate'`. Extend `SequenceSpec['name']` with `'later'`. |
| 2.6 | `useChartMapAnimState.ts` | Create `coverArc` (initial = `initial.revealArc ?? 0`) and `closed` (initial 0). Add both to the memo. |
| 2.7 | `useChartSequencer.ts` | Map the new easings to `CHART_EASING.settle` / `.draw` / `.deliberate`. |
| 2.8 | `chartMotion.ts` | Replace `CHART_MAP_TIMING.open` (old values kept as `// DEFERRED:`) with the table below, and add `later`. |
| 2.9 | `chartMapSequences.ts` | Rewrite `openSequence` to the beats below and add `laterSequence`. Add an optional `onBeat?: (beat: ChartBeat) => void` to the open, later, move-check, reach and arrival contexts. `type ChartBeat = 'open' \| 'ink' \| 'flag' \| 'check' \| 'stamp' \| 'wind'`. Builders stay pure: beats are `call` steps. |
| 2.10 | new `hooks/v2/chart/chartLastOpened.ts` | Presentation-only "opened today" marker, modeled on `chartHighWater`. Key: `anchor:v2:chart2:opened:{acct}:{courseId}`. Value: the local date `YYYY-MM-DD`. Guests use an in-memory map. Never throws. `useChartOpenedToday(courseId)` returns `{ loaded, openedToday, markOpened() }`. |
| 2.11 | `ChartActiveView.tsx` | Choose the open: `entrance === 'reveal'` gives the existing instant path, unchanged. Otherwise, `openedToday` gives `laterSequence` and anything else gives `openSequence`. Call `markOpened()` when the open starts. Wait for `loaded` (max 150ms, then treat as not opened today) before running. Wire `onBeat` to sound and haptics (§4). |

**`openSequence`** (first open of the day). Every `at`/duration is in ms.

| at | dur | Step | Easing |
|---|---|---|---|
| 0 | — | `call` reset: `revealArc = 0`, `coverArc = 0`, `closed = 1`, `mapOpacity = 1`, `flagOpacity = 0`, camera = `{ cx: 405, cy: 650, s: 1.08 }` (clamped by `clampCamera` as now) | — |
| 0 | — | `onBeat('open')` | — |
| 0 | 520 | `closed` 1 → 0 | settle |
| 0 | 720 | `coverArc` 0 → `revealTo` | settle |
| 0 | 900 | camera → overview | deliberate |
| 250 | — | `onBeat('ink')` | — |
| 250 | 850 | `revealArc` 0 → `revealTo` | draw |
| 1000 | — | place the flag (existing `placeFlag`) + `onBeat('flag')` | — |
| 1000 | 250 | `flagDrop` 0 → 1 | out |
| 1200 | — | `onPanel()` (panel's own 350ms rise, unchanged) | — |

Reduce Motion: no `open` beat, everything set at 0, `mapOpacity` 0→1 over `CHART_MAP_REDUCED_FADE` (180), panel at 180.

**`laterSequence`** (already opened today, about 0.6s). Set the final states at 0: `revealArc = coverArc = revealTo`, `closed = 0`, flag placed and settled, camera at overview. Then `fog` 0 → 0.03 over 1200 (inOut) and 0.03 → 0 over 1200 (inOut), and `onPanel()` at 300. No beats. Reduce Motion: no breath, panel at 120.

**Remove the map's own fade-in when clouds are on.** The `useLayoutEffect` that zeroes `mapOpacity` stays for the non-clouds hosts (Home/Details crops). For the permanent Chart, map visibility is gated by the weather being ready (§3.6), not by an opacity fade.

## 3. Living weather (phase 2)

The approach: draw the clouds as their own layer, from pre-rendered tileable textures that drift and get masked by a soft cover field. That way nothing runs a per-pixel fbm every frame, and the land and ink shaders still only run when the camera, reveal or fog change.

| # | File | Change |
|---|---|---|
| 3.1 | new `map/chartCloudTiles.ts` | Build three textures once with `drawAsImage` and cache them like grain (see the recipe below). Export `loadCloudTiles(): Promise<CloudTiles>`, `cachedCloudTiles()`, and add it to `warmChartMapResources`. |
| 3.2 | `chartMapShaders.ts` | Add `COVER_SKSL` (see the spec below). Leave `CLOUD_SKSL` in the file and mark it `// DEFERRED: static cloud look, replaced by ChartMapWeather`. |
| 3.3 | new `map/ChartMapWeather.tsx` | A layer inside its own `<Canvas>`, mounted in `ChartMap` between the land canvas and the overlay canvas, only when `clouds` is true. See the drawing spec below. |
| 3.4 | `ChartMapLand.tsx` | Comment out the `cloudEffect` / `cloudFade` block with `// DEFERRED: clouds moved to ChartMapWeather`. The land draws paper, faint art and ink only. |
| 3.5 | `ChartMap.tsx` | Mount `ChartMapWeather` (props: `width`, `height`, `anim`, `table`, `placement`, `currentIndex`, `reducedMotion`, `arrived`). Pass `onWeatherReady`. |
| 3.6 | `ChartMap.tsx` | **Clouds-first gate.** When `clouds` is true, the single visibility gate becomes `artReady && weatherReady`. The land, overlay and markers never render a frame before the weather is ready. Until then the map area shows paper (the `ChartWeatherHold` look). This is the fix for "terrain shows, then fog rolls over it". |
| 3.7 | `ChartMapOverlay.tsx` | When `clouds && !arrived`, the summit X opacity is `0.35 * (1 - glyph)` (faint through the weather). The dotted ghost route keeps its current `dottedEnd` rule. |
| 3.8 | `ChartMapMarkers.tsx` | When `clouds` is true (new optional prop): markers with index > current + 1 render at opacity **0.18**, and index == current + 1 keeps 0.4. They stay pressable and accessible. Done and current markers are unchanged. |
| 3.9 | `chartMapSequences.ts` | Drive `coverArc` everywhere `revealArc` moves. In `moveCheckSequence`, `coverArc` from → to at `at 120, dur 600, settle`, plus `onBeat('check')` at 0 and `onBeat('ink')` at 200. In `reachSequence`: stamp step + `onBeat('stamp')` at 150; `coverArc` → `endArc + 0.3 × (next leg length)` at `500, dur 900, settle`; `onBeat('wind')` and `onBeat('ink')` at 500; `onBeat('flag')` at the existing `flagAt` (900). Set `fogBreathPeak` 0.035 → **0.02** (keep the old value as `// DEFERRED:`). In `arrivalSequence`: `coverArc` → `table.total` with the fog step, and `onBeat('wind')` at `fogAt`. |

**Cloud tile recipe** (match the prototype):
- **Billows:** 512 px, seed 7, 7 clusters, puff radius 46–96.
- **Near puffs:** 384 px, seed 19, 8 clusters, radius 22–50.
- **Wisps:** 512 px, 26 ellipses.
- **Clusters:** each cluster spans `w = rMax × (2.2–4.2)` and has 5–9 puffs. Puff radius grows toward the cluster centre (`hump = max(.25, 1 − |t| × 1.5)`) and centres lift up by `r × .45 × hump`. Clusters are drawn back to front by y.
- **Puff gradient:** radial, centred `(x − .2r, y − .3r)`, stops `0: rgba(255,254,251,.96)`, `.62: rgba(250,248,243,.78)`, `1: rgba(248,245,239,0)`.
- **Underside:** after each cluster, a **`srcATop`** ellipse at `(cx, cy + .35 rMax)`, `rx = .7w`, `ry = .6 rMax`, radial `rgba(178,167,151,.42) → rgba(196,187,173,.18) @ .6 → 0`. This shades only cloud pixels.
- **Wisps:** ellipses `rx 50–180`, `ry 6–18`, rotated −0.06 rad, white at alpha .25–.6 fading to 0.
- **Tiling:** every element is drawn wrapped (±size) so the tiles repeat seamlessly. Use a seeded LCG (16807) so the textures are identical on every device.

**`COVER_SKSL`** reuses the fog field textures (`fieldDist`, `fieldArc`, `noiseTex`) and the same bilinear 4-cell sampling as `FOG_SKSL`.
- **Uniforms:** `coverArc`, `fog`, `closed`, `tip` (= position at `coverArc + 110`), `current` (current waypoint point, or (−9999, −9999) when none), `total`.
- **Per cell:**
  1. `fa = coverArc + 110`
  2. `d = arc ≤ fa ? dist : |centre − tip|`
  3. `rIn = 90 + 1700·fog`, `fe = 180 + 300·fog`
  4. `al = clamp(1 − (d − rIn)/fe, 0, 1)`
  5. `cover = 1 − smoothstep(.12, .88, al + (n − .5)·.45)`
  6. If `arc > fa && arc < fa + 150 && dist < 80`: `cover *= .74 + .26·(arc − fa)/150`
  7. `dm = |centre − current|`; if `dm < 78`: `cover *= .5 + .5·smoothstep(30, 78, dm)`
  8. `cover *= .9 + .1·min(1, arc/total)`
  9. `cover = max(cover, closed)`
- **Outside the map rect** (0..852 × 0..1180), `cover = 1`.
- **Output:** `half4(cover)` as alpha.

**`ChartMapWeather` drawing** (map space, inside a camera Group):
1. A layer group covering the map rect padded by 240 map units on every side.
2. Haze rect `rgba(233,229,221,.92)`.
3. Billows `ImageShader` with `tx/ty="repeat"`, scale 2.0 map units per tile px, offset by `drift1`.
4. Near puffs at scale 1.6, alpha .9, offset by `drift3`.
5. Wisps at scale 2.0, alpha .8, offset by `drift2`.
6. `COVER_SKSL` rect with `blendMode="dstIn"`.

**Drift.** One Reanimated `useFrameCallback` clock, in map units per second:
- billows `(6, 1.6)`
- near puffs `(9, 0.6)`
- wisps `(14, −2.2)`

Under Reduce Motion there's no frame callback and the offsets stay at 0. Pause the callback when the screen is blurred (`useIsFocused`).

**Parallax.** The weather Group uses the camera transform with a 6% extra: `s₂ = s·(1 + (s − 1)·.06)`, translation `T(s₂) + (T(s) − T_overview)·.06`. Derive it on the UI thread in `useChartMapCamera.ts` as `useChartWeatherTransform`.

**Colours** are paper-derived only: never category-tinted, never gold.

## 4. Sound + haptics

| # | File | Change |
|---|---|---|
| 4.1 | `src/assets/sounds/` | Copy the seven files from `design/sound/chart/processed/` as-is: `chart-air.mp3`, `chart-open.mp3`, `chart-ink.mp3`, `chart-flag.mp3`, `chart-check.mp3`, `chart-stamp.mp3`, `chart-wind.mp3`. Do not re-encode or re-level. |
| 4.2 | `hooks/useAudio.ts` | Add the seven keys to `SOUND_FILES`. No other change; keep its audio mode as-is. |
| 4.3 | new `components/v2/chart/useChartSound.ts` | A wrapper on `useAudio().createManagedPlayer`. Respects `soundEffectsEnabled` (via `useAudio`) and Reduce Motion. See the API below. |
| 4.4 | `ChartActiveView.tsx` | `onBeat` handler: `open → sound.open()`, `ink → sound.ink(durMs)`, `flag → sound.flag() + safeHaptics.impact(Light)`, `check → sound.check() + safeHaptics.selection()`, `stamp → sound.stamp() + safeHaptics.impact(Medium)`, `wind → sound.wind()`. Pass `durMs` per call site: open 850, move check 400, reach 600. `useFocusEffect`: `startAir()` on focus, `stopAir()` on blur. |
| 4.5 | `ChartWeatherHold.tsx` | The air bed may start here, so it is already running when the map parts. Use the same hook instance or start on focus; never two beds at once. |

**`useChartSound` API:**
- `open()`: plays `chart-open`. Skipped under Reduce Motion.
- `ink(durMs)`: plays `chart-ink` at once, and again at `0.45 × durMs` (volume .75, rate .95) when `durMs > 500`. Each play gets a random rate of ±3%.
- `flag()`, `check()`: one-shot, ±3% rate.
- `stamp()`: one-shot, then `duck(1300)`.
- `wind()`: one-shot. Skipped under Reduce Motion.
- `startAir()`: looping `chart-air`, volume ramps 0 → 0.9 over 800ms (stepped `setVolume`, 16 steps). Idempotent.
- `stopAir()`: ramp to 0 over 400ms, then stop.
- `duck(holdMs)`: air to 0.45 in 120ms, hold, back to 0.9 over 600ms.
- **Practice:** no air while Practice audio plays. Chart blurs when Practice opens, so `stopAir` on blur covers it.

## 5. Copy changes

None.

## 6. New storage

| Key | Value | Store |
|---|---|---|
| `anchor:v2:chart2:opened:{acct}:{courseId}` | `"YYYY-MM-DD"` (device local date) | `encryptedPersistStorage`, presentation-only; guests in memory |

## 7. Tests (add or update; keep all existing passing)

- `chartMapSequences.test.ts`: the new open beats/timings, `laterSequence`, `coverArc` stepping in move check/reach/arrival, `fogBreathPeak` 0.02, `onBeat` order per sequence, and the Reduce Motion variants (no `open`/`wind` beats, instant states).
- `chartLastOpened.test.ts`: same day → `openedToday`, next local day → false, guest in-memory, storage failure → false and never throws.
- `ChartMap.test.tsx`: with `clouds`, nothing on the land, overlay or markers renders before weather-ready. Without `clouds` (Home/Details crops) behaviour is unchanged.
- `chartCloudTiles.test.ts`: deterministic output for a seed (puff positions list), tiles cached once.
- `useChartSound.test.ts`: no players when `soundEffectsEnabled` is false; `open`/`wind` are no-ops under Reduce Motion; `startAir` is idempotent; `duck` schedules back to 0.9.
- `V2ChartScreen.test.tsx`: the loading state renders `ChartWeatherHold` with the same testID and label, and the Pro-gate tests still pass.
- Run: `npx tsc --noEmit`, `npx jest src/components/v2/chart src/screens/v2/chart src/hooks --runInBand`, and an Android export (`npx expo export --platform android`).

## 8. Acceptance criteria

- [ ] Opening Chart from Home, Details, Vision or Progress shows **no graphite frame**. Frame one is paper.
- [ ] **No frame ever shows uncharted pencil terrain without cloud cover** (cold start, warm start, Reduce Motion). Verified by screen recording on the Galaxy at 0.25× in Developer options.
- [ ] First open of the day follows the §2 beat table within ±1 frame. A second open the same day takes ≈0.6s, with no redraw and a single breath.
- [ ] Clouds drift in three layers, sit visibly above the land when the camera moves (parallax), and have lit tops and warm shaded undersides. Static under Reduce Motion.
- [ ] Move check: the tip extends, the clouds roll back with it, the check sound plays and the selection haptic fires.
- [ ] Reach: stamp + medium haptic at 150ms, the air bed dips and recovers, wind + ink at 500, the clouds open about 30% into the next leg, flag + light haptic at 900. The server confirms first, as today.
- [ ] Sound off (`soundEffectsEnabled` false) gives total silence and still gives haptics. Leaving Chart fades the air out in 0.4s.
- [ ] **60fps on the Galaxy** with drift, flag sway and the air bed running (Perf monitor). If it misses, drop the near-puffs layer first, then the wisps, and report the result.
- [ ] Home/Details Chart cards (`ChartMapCrop`/`ChartPreview`) look unchanged.
- [ ] Every existing Chart test passes, plus the new ones. tsc is clean and the Android export succeeds.
- [ ] Every removal is `// DEFERRED:` commented, with no deletions. The uncommitted Pro-gate changes in `V2ChartScreen.tsx`, `ChartCreationFlow.tsx` and their test are intact.
- [ ] Report: files changed, tests added, the device FPS reading, and any deviation from this prompt with the reason.
