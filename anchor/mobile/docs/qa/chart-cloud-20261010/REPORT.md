# Chart cloud parity — independent visual QA

Date: 2026-10-10 (America/Chicago)

## Verified render

Captured the native Android emulator (API 36.1, 1080 × 2400 px; 420 dpi) using a QA-only Expo entry. The harness rendered the production Home `ChartPreview` and production Details `ChartWorldPreview` side by side at identical read-only course fixtures. Waypoint 1/5 and waypoint 3/5 were checked. No app state was saved.

At both progress states, the Home and Details map crops show the same sculpted, rounded cloud billows and cream atmospheric depth. Waypoint markers, flags, route strokes, card bounds, and crop framing remain aligned and legible. The cloud texture reads as dimensional soft forms rather than the prior broad static haze; the p3 fixture preserves the current waypoint 3 and its revealed route. The static-vs-textured comparison at p3 uses the exact original `ChartMapCrop` implementation copied from `HEAD`, the same fixture, and the same screen dimensions. The route and marker positions match between modes.

## Scorecard

| Dimension | Score | Evidence |
|---|---:|---|
| Sculpted cloud shape and depth | 9/10 | Rounded billows and layered cream depth are clearly visible in both preview crops. |
| Fog/palette continuity | 9/10 | Parchment/cream tones remain consistent; clouds blend into the existing fog without a separate white veil. |
| Waypoint and route visibility | 9/10 | Current waypoint 1 and 3, flags, solid revealed route, and dotted future route remain prominent. |
| Crop and card geometry | 9/10 | Existing Home and Details aspect ratios/bounds are retained; no visible map distortion. |
| Cross-preview steady-state parity | 9/10 | Both production preview components render the same fixture/map state with matching cloud character. |
| Cold-load transition | Not scored | A warm-loaded render is verified; the isolated development client returned to a blank startup frame during a force-stop/relaunch, so static-fallback-to-texture timing/pop was not observed. |
| iOS / physical-device runtime | Not scored | No iOS simulator or authenticated physical-device session was available for this QA run. |

**Steady-state Android visual result: 9/10.** This score covers only the two preview crops and states listed above. It is not a claim of universal platform parity or authenticated production-route acceptance.

## Captures

- [after-p1.png](./after-p1.png) — production Home and Details previews, same 1/5 fixture, textured mode.
- [after-p3.png](./after-p3.png) — production Home and Details previews, same 3/5 fixture, textured mode.
- [before-p3.png](./before-p3.png) — exact original static crop, same 3/5 fixture; comparison target for `after-p3.png`.
- [fullchart-active.png](./fullchart-active.png) — Chart motion-lab menu; this is contextual setup evidence only, does not show the active Chart renderer, and is not included in the score.
- [check-tap.png](./check-tap.png) — QA harness in original static mode, showing the older static cloud treatment and the same route fixture.
- [cold-10s.png](./cold-10s.png) — isolated development-client cold-relaunch blank frame; documents why cold texture transition timing is unverified, not a product regression.

## Harness and limits

The harness is retained as [cloud-preview-entry.tsx](./cloud-preview-entry.tsx), with the pre-change renderer at [ChartMapCropBefore.tsx](./ChartMapCropBefore.tsx). It imports the production preview components and provides explicit 1/3/5 progress fixtures; the entry must be temporarily copied into the mobile app root and served with `extra.expoGo.mainModuleName=cloud-qa-entry`, `dev=true` so the development-only fixture provider is active. The harness does not replace or modify the app's production entry/routes.

The first cold launch spent an extended interval bundling in Metro; the successful captures were made after the entry and map resources had loaded. A later forced restart showed a blank white startup frame at 10 seconds, then recovered to the harness after further wait. I did not observe the cloud transition itself during that restart, so no no-flicker conclusion is made. iOS, physical-device behavior, frame pacing, authenticated Home/Details data, and interaction acceptance remain unverified.

