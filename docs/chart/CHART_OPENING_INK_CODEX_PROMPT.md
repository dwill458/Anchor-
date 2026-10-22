# Codex prompt: Chart opening, ink draw-in (follow-up to phases 1–3)

Read these first, in this order, before touching code:
1. docs/chart/CHART_PHASES_1_2_CODEX_PROMPT.md (entrance, weather, sound, sequencer)
2. docs/chart/CHART_PHASE_3_CODEX_PROMPT.md (sheet over a full-bleed map)
3. docs/chart/ONE_MOVE_FOLLOWUP (claude/one-move-followup-codex-prompt.md in the Anchor project) — unrelated to this task, do not mix the work
4. design/sound/chart/README.md (what each chart sound is for)

Active code is anchor/mobile/src/. Do not touch anchor-v2/.

## Why
Deon opened Chart on device and said the first thing he sees feels plain, and in his screen recording the "Let's chart the distance between here and there." screen has two problems:
- The headline and body sit on top of the landscape, so they are hard to read.
- The landscape is already finished when the screen appears. Nothing happens, so nothing feels cinematic.

A prototype of the fix was approved ("Chart Opening Sequence", published artifact, version 2). This prompt ports it. The prototype is a motion reference, not code to copy.

## What the user should see (first ever time)
Time is from the screen's first frame. All of it runs on the existing sequencer (useChartSequencer, chartSequence.ts), not on loose timers.

| t (s) | beat |
|---|---|
| 0.00 | Paper only. Chart air starts (startAir), faded in over 600ms. |
| 0.15 | `open` sound. |
| 0.20–3.40 | Contour layer sweeps top to bottom, tilted about 8°. Only the darkest strokes. Reads as the outline being drawn. |
| 1.30–4.90 | Tone layer sweeps behind it, the same direction, same tilt. Hatching and shading fill in. |
| 0.10–6.10 | Camera eases from scale 1.10 to 1.00, origin top center. |
| 4.10–6.70 | The dotted survey route draws from the start to the destination X. |
| 4.10 | `ink` sound at route start. |
| 4.80–5.90 | Headline and body rise 14px and fade in on the paper zone. |
| 6.30–6.90 | Destination X marker pops (scale .4 to 1, slight overshoot). `flag` sound. |
| 6.20–7.20 | Continue button fades in. |
| 6.90 | Lower air (duck) so the copy is not fighting it. |
| 7.20 | Real land image has finished cross-fading in under the ink; ink layers are removed from the tree. |

The last frame must equal today's static intro render (same land image, same route, same X, same camera). Diff a screenshot of the final frame against the current build; the only allowed difference is the paper zone from the next section.

Returning accounts get a short version: both ink layers sweep together in 1.2s, route draws in 1.0s, copy and Continue appear at 1.6s, no camera move, sounds `open` and `ink` only. See "Intro seen" below.

## Legibility fix: paper zone, not a resize
Do not resize or move the map. The creation to Chart handoff (exploreDelta, chartMapScreenTop in ChartCreationFlow.tsx, ChartRevealHandoff.tsx) depends on the map's exact framing. Change nothing about camera, scale, or position.

Instead add one overlay behind the copy: a vertical gradient from transparent at 55% of the screen height to solid paper (the existing paper color token) at 78%, solid to the bottom. Headline, body, and buttons sit on that. Use the existing paper token so dark mode follows. Check contrast of body text against paper: at least 4.5:1 in both themes.

This overlay belongs to the creation layer, so it fades with it at handoff. Confirm in the handoff recording that nothing pops.

## How to draw the ink, with no new image assets
Do not ship new bitmaps. Derive both ink layers from the land image already loaded in the map, with a Skia runtime shader. The land image is drawn through the shader while the ink animates, then the shader layer is dropped.

SkSL sketch (adjust to the repo's shader conventions, and to how the land is already supplied as a shader/image):

```
uniform shader land;
uniform float2 size;
uniform float contourP;   // 0..1, sweep progress, contour layer
uniform float toneP;      // 0..1, sweep progress, tone layer
uniform half3  inkColor;  // existing ink token, so dark mode inverts for free
const float tilt = 0.14;
const float soft = 0.06;

float reveal(float p, float s) {
  float edge = p * (1.0 + tilt + soft) - soft;
  return 1.0 - smoothstep(edge, edge + soft, s);
}

half4 main(float2 xy) {
  half4 c = land.eval(xy);
  float lum = dot(c.rgb, half3(0.299, 0.587, 0.114));
  float ink = clamp((1.0 - lum - 0.10) / 0.78, 0.0, 1.0);
  float contour = clamp((ink - 0.42) * 2.4, 0.0, 1.0);
  float tone = pow(ink, 0.8) * 0.92;
  float s = xy.y / size.y + (xy.x / size.x) * tilt;
  float a = max(contour * reveal(contourP, s), tone * reveal(toneP, s));
  return half4(inkColor * a, a);
}
```

Notes:
- `reveal(0, s)` is 0 everywhere and `reveal(1, s)` is 1 everywhere. Unit test both in a pure TS mirror of the function.
- Cross-fade to the real land image over the last 700ms with a plain opacity value on the real land layer, ink shader layer on top at the same time fading out, then unmount the shader layer.
- Progress values are Reanimated shared values written by the sequencer's tween steps, not React state. Pass them to Skia as uniforms with useDerivedValue. No per-frame JS-thread work.
- Keep the shader inside the existing SKSL file conventions (where FOG_SKSL / CLOUD_SKSL / COVER_SKSL live). Add INK_SKSL there and compile once, cached.
- Existing weather (clouds, fog) must stay off during this intro. Today the intro does not run weather. Keep it that way.

## Route and marker
- Do not change route geometry. Animate the existing dotted survey route's reveal with a trim/dash progress from 0 to 1 over the table above.
- Route honesty is unchanged: creation draws the plan as a dotted survey route. Ink-colored solid route means real progress only. Never use the solid ink route here.
- The destination X is the existing marker. Pop it at the end; do not introduce a flag glyph on this screen.

## Sound
Use useChartSound only. Do not add new sound files.
- startAir at frame 0 (fade in 600ms), stopAir on unmount or when the user taps Continue.
- open at t=0.15, ink at route start, flag at the X marker pop, duck at t=6.9.
- If the user taps Continue early, stop air (existing fade), skip the remaining transient sounds, and jump the sequence to its final state, as the sequencer already does for skip (transient call steps are dropped).

## Intro seen
- Persist a presentation-only flag: key `anchor:v2:chart2:introSeen:{acct}` (per account, not per course). Same encrypted-persist helper pattern as chartLastOpened.ts. New file chartIntroSeen.ts with get/set and a reset for the dev lab.
- Not seen: play the full sequence. Mark seen when the sequence reaches the route start, so quitting early still counts.
- Seen: play the short version.
- Storage failure: play the full sequence, do not crash, do not retry in a loop.

## Reduce motion and skip
- If the system reduce-motion setting is on, use the existing CHART_MAP_REDUCED_FADE path: final state with a single crossfade. No sweep, no camera move, no route draw. Keep the paper zone. Sounds: open only.
- Tapping anywhere that is not a button during the intro skips to the final state in 250ms. Buttons stay live from the moment they appear.

## Frame budget
Use the same measurement you used before (dumpsys gfxinfo framestats, de-duplicated per vsync).
- During the sweep, no more than 3% of frames over 16.7ms and none over 32ms on the emulator.
- If the shader costs too much on the 1136x1573 land at device scale, render the shader into a half-resolution offscreen surface and upscale, and say so in the report.
- If the repo has a performance tier helper, use it: low tier gets the short version always.
- Report real numbers. If a target is missed, report the number and what you tried. Do not claim it passes.
- S24 Ultra release-build measurement is still owed from phases 1–3. Note it again in the report; do not estimate it.

## Files
- New: components/v2/chart/chartIntroSeen.ts
- New: components/v2/chart/map/chartInkShader.ts (INK_SKSL, uniform helpers, pure TS mirror of reveal/ink math for tests)
- New: components/v2/chart/ChartIntroOpening.tsx (the layer: ink shader, paper zone, copy placement, sequence wiring)
- Edit: chartMapSequences.ts (add `introFull` and `introShort` sequence specs), chartMotion.ts (CHART_INTRO_TIMING with the table above, so numbers live in one place)
- Edit: ChartCreationFlow.tsx (mount ChartIntroOpening on the intro step only; leave every other step and the handoff untouched)
- Edit: ChartLabDevHost (dev lab): buttons "Replay opening (full)", "Replay opening (short)", "Reset intro seen"
- CHART_COPY: no copy changes. Headline and body strings stay as they are.

## Do not change
- Pro-gate work in V2ChartScreen.tsx (creationLocked, openPaywall, onPremiumRequired). Preserve exactly.
- Creation to Chart handoff alignment, exploreDelta, chartMapScreenTop, ChartRevealHandoff flattening.
- High-water route rule: the drawn route never retreats.
- The 10 pre-existing ChartPreview snapshot failures and the 5 unrelated Vision photo-picker failures. Do not "fix" them; report counts before and after.

## Tests
- Pure TS: reveal(0,s)=0, reveal(1,s)=1 for s in [0, 1+tilt]; reveal is monotonic in p and in s; ink/contour math matches the shader constants.
- Sequence specs: introFull step order and times match the table; skip drops transient call steps and lands in the final state; introShort is under 2s end to end.
- chartIntroSeen: set/get, storage throws, reset.
- ChartIntroOpening: first mount plays full and sets seen at route start; second mount plays short; reduce motion renders the final state and the single crossfade; tap-to-skip lands the final state; Continue is tappable only after it appears.
- Final frame equals the pre-change static intro (screenshot diff, paper zone masked).

## Acceptance
- A first-time user sees the mountains drawn in as ink, then the route, then the words, on a clean paper zone, and can read every word.
- The last frame matches the old static intro, apart from the paper zone.
- Second and later opens by the same account play the short version.
- Creation to Chart handoff recording at 0.25x shows no jump, flash, or misalignment.
- Reduce motion shows no sweep and no camera move.
- Report: what you built, any departure from this prompt and why, measured frame numbers, test counts before and after, and what is still owed on the S24.
