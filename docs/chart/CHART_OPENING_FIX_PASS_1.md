# Codex prompt: Chart opening, fix pass 1

Read docs/chart/CHART_OPENING_INK_CODEX_PROMPT.md first. This is a fix pass on what that prompt built. Active code is anchor/mobile/src/. Do not touch anchor-v2/.

I read the implementation after watching Deon's screen recording (Screen_Recording_20261008_173604, Anchor detail to Create Chart, about 22s). The causes below are confirmed from the code, with file references. Where a fix depends on something I did not open, I say so; check it and report.

The route/X not reaching the summit is a separate prompt (CHART_SUMMIT_ROUTE_CODEX_PROMPT.md). Do not fold it into this one.

## What the recording shows
Times are from the start of the file.
- 1.13–1.23s: the dark Anchor detail screen hard-cuts to the paper Chart screen.
- 1.23–1.95s: 0.7s of empty paper. Header ("Chart", "CAREER") and nothing else.
- ~2.0s: the destination X and a short fragment of the dotted route appear on blank paper, before any mountain exists.
- ~2.35s: mountains are half drawn, top first. The dotted route is already visible across the area where terrain has not drawn.
- ~2.55s: full-contrast, dark, crisp ink drawing. Route complete.
- ~2.8s: the whole drawing dims to a pale, foggy map. The cliff pops in with its category tint. Copy and Continue arrive.
- ~3.3s: settled. Headline legible.

From first draw to settled is about 1.3s. This is the short version. The introSeen flag is set from Deon's repeated testing, so he has only been judging the short version. He has probably never watched the full 7s one on this device.

Also at ~9.8s, not part of the entrance: the plan step briefly reads "We found 0 meaningful waypoints for this destination".

## Confirmed causes and fixes

### 1. The 0.7s of empty paper
Confirmed. In ChartCreationFlow.tsx (about lines 284–302) `prepareChartMapIntroArt` only starts after the intro phase has mounted and `introViewportWidth` has been measured. Until the art is decoded, the seen flag is read, and ChartIntroOpening reports `onIntroSurfaceReady` (after two animation frames), the solid `introPreparationCover` (zIndex 10, colors.canvas) covers everything. That cover is the empty paper in the recording.

Fixes:
- Start the art preparation before navigation. V2AnchorDetailsScreen.tsx renders the Create Chart row (`EmptyDashedRow`, about line 530). Kick off `prepareChartMapIntroArt` and `warmChartMapResources` when that row mounts, and again on `onPressIn`, using `useWindowDimensions().width` and the same table and height the flow would compute. The result must land in the same cache the flow reads from, keyed by width, so the flow's call returns instantly. Also prime `getChartIntroSeen` into its module cache at that point.
- Do not wait for a layout pass to know the width. `introViewportWidth` starts null, which costs at least one extra frame. Seed it from `useWindowDimensions().width` and correct it on layout only if it differs.
- Hard limit: never show the preparation cover for more than 250ms. If art or surface readiness is not there by 250ms, drop the cover, skip the sweep, and fall back to the existing reduced path (one crossfade of the settled map). Log it in dev.
- Start startAir and the `open` sound at the first committed frame of the screen, not when the surface is ready.
- The hard cut from the dark Anchor detail: if V2Chart does not already use a fade for this push, use a 240ms fade. Check CREAM_BACKGROUND still prevents a dark or white flash, the status bar does not flicker, and the creation to Chart handoff (inside the screen) is unaffected. If it causes any flash, revert and say so.

### 2. Route and X on blank paper
Confirmed in `introShortSequence` (chartMapSequences.ts, about lines 165–190):
- `p.marker.value = 1` is set at t=0, so the X is visible from the first frame.
- `p.route` tweens 0 to 1 from t=0 in parallel with contour and tone. The sweep goes top to bottom and the route draws from the bottom, so the route is visible where terrain does not exist yet.
The full sequence does not have this problem (route at 4.1s, marker at 6.3s).

Fixes:
- Short: marker starts at 0 and pops after the route ends, never before.
- The route draw may not start until the contour sweep has covered at least 70% of the scene. Short: route starts at 70% of the contour sweep and finishes about 0.5s after terrain completes.
- Mask the route with the same sweep `reveal()` as the terrain so it can only draw where ink already exists, even if timing slips. Apply to full and short.

### 3. The tone flip
Confirmed. `INK_SKSL` (map/chartInkShader.ts) renders an ink-only picture from luminance (`ink = (1 - lum - 0.10)/0.78`, contour threshold `(ink - 0.42) * 2.4`, tone `pow(ink, 0.8) * 0.92`), drawn in the ink color. The real land (with its haze and the category-tinted cliff) is a separate layer that fades in with `p.land` and the shader multiplies its output by `1 - landP`. In the short sequence that crossfade starts at 500ms and overlaps the sweep, which ends at 1200ms. The picture is rendered two ways and the viewer sees one replace the other. The ink render is darker and crisper than the settled map, so the end reads as the drawing washing out.

Fix: one picture, revealed once.
- Reveal the real land image through the sweep. Use the same `reveal()` math (tilt and soft edge unchanged) as an alpha mask on the base land layer, driven by a new progress value `landSweep`. At landSweep = 1 the layer is the settled map exactly, so there is no end crossfade and no step.
- The ink shader becomes a pen-line accent only: contour strokes, alpha visible only in the band the contour sweep has passed and the land sweep has not yet reached, so the line appears first and the real map fills in behind it. Suggested: `a = contour * max(0, reveal(contourP, s) - reveal(landSweepP, s)) * 0.9`. Remove the `tone` branch of the shader. Remove `p.tone` and `p.land` from the sequences and replace with `landSweep` (keep the names if renaming is too invasive, but the behaviour must change).
- The land sweep trails the contour sweep by about 250ms in short and about 1100ms in full, same direction and tilt.
- The category tint on the cliff is part of the real land, so it arrives with the sweep. Do not add a separate tint tween.
- Acceptance for tone: sample the mean luminance of the map region across the recorded frames. After the sweep edge has passed a region, no frame-to-frame change greater than 6 points of 255. Put the measured series in the report.
- Update the pure TS mirrors (`chartInkReveal`, `chartContourStrength`, the new accent function) and their tests. Remove mirrors for the tone layer if the tone layer is removed.

### 4. The short version needs a beat
Revise `CHART_INTRO_TIMING` (chartMotion.ts, `shortInk`, `shortRoute`, `shortLandCrossfadeAt`, `shortCopyAt`, `shortCopy`, `shortDuration`) to roughly:
- contour sweep 0–1400ms
- land sweep 250–1650ms
- route starts at 1000ms (70% of contour), runs 900ms
- X pops at 1900ms, 450ms
- copy at 1900ms, 400ms
- Continue visible at 2200ms
- total about 2.5s from the first committed frame
Camera stays at 1.0. Full version timings stay as they are, except for the changes forced by items 2 and 3.

### 5. Dev tools so Deon can see the full version
Findings: `introReplayMode` exists and is wired only through screens/v2/system/V2ChartPreview.tsx and ChartLabDevHost. The DEV pill that shows on the Anchor detail screen (bottom right of the Focus bar in the recording) is not in V2AnchorDetailsScreen.tsx. Find where the pill is rendered (probably a global dev overlay).
- Add to it: "Replay opening (full)" (calls `resetChartIntroSeen`, then navigates to V2Chart for the current anchor with a one-shot `introReplayMode: 'full'`), "Replay opening (short)" (same with 'short'), and "Reset intro seen".
- Pass the one-shot mode through the route params and clear it after the intro starts so a later visit is not forced.
- Dev only. Make sure none of it ships in release builds (`__DEV__` guard, and a test that the menu entries do not render when `__DEV__` is false).

### 6. The "0 meaningful waypoints" flash
Confirmed source: constants/v2/chartCopy.ts, line 452, `We found ${count} meaningful waypoint${count === 1 ? '' : 's'} for this destination...`. It is rendered with a count of 0 before the plan arrives.
- Do not render this sentence until the waypoint count is known and greater than zero. While loading, render the headline only, or neutral copy from CHART_COPY with no number.
- A real plan with zero waypoints is an error state with its own copy. Report whether that exists; if not, treat 0 as loading.
- Test: render the plan step in its loading state and assert no digit appears in the support copy.

## Do not change
- Pro-gate work in V2ChartScreen.tsx (creationLocked, openPaywall, onPremiumRequired). Preserve exactly.
- Creation to Chart handoff alignment (exploreDelta, chartMapScreenTop, ChartRevealHandoff flattening).
- High-water route rule and route honesty: dotted survey route in creation; solid ink only for real progress.
- The 10 pre-existing ChartPreview snapshot failures and the 5 unrelated Vision photo-picker failures. Report counts before and after.

## Tests
- Sequence specs: route start is not earlier than the contour sweep reaching 70%; X pop is after route end; short total about 2.5s; no end crossfade step exists in either spec; skip and reduce motion still land on the final state.
- Prefetch: art decode and shader compile are requested when the Create Chart row mounts; the flow's call returns from cache; cold path (no prefetch) shows the cover for no more than 250ms or falls back to the reduced path.
- Route mask: route alpha is 0 wherever the sweep has not reached.
- Accent shader mirror: zero outside the band between contour and land sweep; the settled frame equals the base land exactly.
- Dev menu entries absent when `__DEV__` is false.
- Plan step in loading state shows no numeric count.

## Acceptance
Record the screen twice through the same flow (Anchor detail, Create Chart): once full, once short. Use the new dev menu to force each.
- Never more than 250ms of an empty body after the screen appears.
- The route and X never appear before the terrain around them.
- No luminance jump after the sweep passes (series in the report).
- Cliff tint arrives with the sweep.
- Short version is about 2.5s and reads as drawing, not a flicker. Full version runs to its spec.
- Headline and Continue stay legible throughout.
- Report: for each item, what you found and what you changed, frame numbers, test counts before and after. The S24 Ultra release-build frame rate is still owed; say so again.
