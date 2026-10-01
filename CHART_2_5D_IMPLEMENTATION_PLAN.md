# Anchor 2.0 Chart — Cinematic 2.5D Implementation Plan

## Objective and non-negotiable contracts

Replace the illustrated Chart presentation with a cinematic, camera-driven spatial experience while preserving the authenticated Course, Waypoint, Move, One Move, Vision, persistence, analytics, and server-authoritative completion systems. The final server waypoint remains the destination. No backend or database contract changes are required.

The normal Chart → Waypoint interaction must remain inside one mounted Chart experience. `V2ChartWaypoint` stays available as a compatibility/deep-link entry, but it must render the same shared experience rather than a separate visual implementation.

## Current architecture audit

- `V2ChartScreen` owns authenticated loading, creation, active, completed, released, stale, and error states through `useAnchorChart`.
- `useAnchorChart` owns the account-scoped memory cache, encrypted offline snapshot, server revalidation, mutation serialization, version-conflict refresh, analytics, and shared publishing.
- `chartV2Model.ts` is the pure presentation adapter. `course.currentWaypointId` and `course.currentMoveId` remain authoritative.
- `ChartLandscape.tsx` and `chartRouteGeometry.ts` already provide normalized route geometry, SVG progress drawing, route-travel animation, nodes, destination treatment, and shared Home/Details crops.
- `ChartActiveView` currently stacks large Current Waypoint, One Move, and Destination cards under the landscape.
- `V2ChartWaypointScreen` currently pushes as a separate native-stack route and repeats a cropped landscape before its progress and Move controls.
- Initial Chart-focused baseline on 2026-09-28 was 61/62 tests. During implementation the persisted-offline test was corrected to use the production account-scoped encrypted cache key; the expanded focused suite now passes.

## Approved architecture

```text
V2ChartScreen
└── ChartSpatialExperience
    ├── ChartSpatialScene (continuously mounted)
    │   ├── opaque master environment
    │   ├── qualified optional depth layers
    │   ├── SVG route and progress
    │   ├── native waypoint nodes
    │   └── qualified occlusion cutouts
    ├── FullChartContent
    └── ChartWaypointPanel
```

`ChartSpatialExperience` owns only presentation state: selected waypoint ID, `chart | focusing | waypoint | returning | completing` phase, camera/content shared values, scroll position, and input locks. It resolves the selected ID against the latest `ChartViewModel`; it never decides product state.

Public additions are presentation-only:

- `ChartEnvironment`: category, canonical canvas, master, optional depth layers, route, and camera calibration.
- `ChartSpatialNode`: server waypoint identity plus normalized route progress, derived x/y, and visual state.
- `ChartCameraTarget`: responsive target scale/translation and focal region.

## Camera and responsive mapping

For source canvas `Wc × Hc` rendered into viewport `Vw × Vh`:

```text
coverScale = max(Vw / Wc, Vh / Hc)
cropX = (Vw - Wc × coverScale) / 2
cropY = (Vh - Hc × coverScale) / 2
screenX = cropX + normalizedX × Wc × coverScale
screenY = cropY + normalizedY × Hc × coverScale
```

For node `Q`, viewport center `C`, focal point `F`, and zoom `Z`:

```text
scaledNode = C + Z × (Q - C)
targetTranslation = F - scaledNode
scale(p) = lerp(1, Z, eased(p))
translation(p) = eased(p) × targetTranslation
```

Master, SVG route, nodes, and occlusion use the same camera matrix. Optional planes derive restrained multipliers from the same UI-thread shared value. Back runs the exact inverse and ends at scale `1`, translation `0`.

## Asset gate

The supplied master and five proposed layers are all 720×1280 24-bit JPEGs. Each decodes to about 3.52 MiB as an RGBA runtime texture; all six would be about 21.1 MiB before runtime overhead. The proposed layers contain no alpha channel, include black mattes, and one includes baked checkerboard artifacts. They cannot ship as transparent layers.

- Use `162652.jpg` as the Desire master and source of truth.
- Ship master-only camera travel until aligned alpha assets exist.
- Do not runtime-chroma-key the JPEGs.
- Require PNG or verified lossless WebP alpha exports registered to the master canvas before adding parallax.
- Never mount six full-resolution textures. Target ≤45 MiB concurrent Chart textures on modern devices and ≤32 MiB in an older-device configuration.
- A 720-pixel-wide master is suitable for composition validation but not final high-density 1.35–1.5× acceptance; request 1440×2560 standard and approximately 1800×3200 high-density masters.

## Route, layout, and interaction

- Retrace the new Desire road in normalized master coordinates while retaining arc-length sampling and arbitrary 1–12 waypoint support.
- The final waypoint stays at route progress `1` and receives the restrained destination flag treatment.
- Nodes remain native/SVG, use the existing Desire token, and expose at least 44×44 point hit targets.
- Full Chart hierarchy: identity/header → dominant environment → compact Current Waypoint → primary One Move → compact Destination → Course Log.
- Remove the large card shells, not their data/actions/accessibility.
- Waypoint hierarchy: zoomed environment dissolving into ink header → position/title/rationale/metric/update progress → cream work surface containing committed Moves, One Move, suggestions, add Move, and authoritative completion.

Normal transition target is 900–1000 ms: tap acknowledgement, chrome recession, camera travel, node settle, then content reveal. Reduced motion uses a 180–260 ms crossfade, at most 1.03× scale, and no parallax drift.

Completion never animates optimistically. After server success: engrave the selected node, travel the route, reveal the next current waypoint, acknowledge the next segment, then return to the wide Chart. Failure stays in waypoint mode with truthful error copy.

## Delivery phases and gates

1. Prove master-only waypoint-1 focus/reverse in the development Chart lab. Stop if crop, sharpness, or frame pacing fails.
2. Add the Desire environment manifest and static rest-state parity.
3. Add tested canonical coordinate/camera math, retraced SVG route, node states, and 44-point targets.
4. Add UI-thread camera travel and reduced motion.
5. Integrate one shared production Chart/Waypoint state and compatibility route.
6. Replace Full Chart card stacking with compact hierarchy.
7. Move existing Waypoint controls into the shared work surface.
8. Connect authoritative completion and reverse choreography.
9. Tune texture count, decode timing, overdraw, and worklets.
10. Complete iPhone 14 Pro, Galaxy S24, small-device, tall-Android, accessibility, reduced-motion, and repeated-transition QA.

## Verification

- Unit: cover mapping, crop offsets, camera target/inverse, boundary clamping, 1/2/4/6/8/12 nodes, final-waypoint destination, reduced motion.
- Interaction: every node state, double-tap/interruption, One Move authority, all Move/progress actions, stale/offline/error/released/completed states.
- Navigation: no normal push from Chart, reversible visible/hardware Back, compatibility-route entry, gesture lock only while focused.
- Completion: no optimistic state, correct server-selected next node, idempotent replay, failed request, destination flow.
- Device: alignment, no exposed image bounds or asset seams, ten forward/reverse cycles without drift, VoiceOver/TalkBack, Dynamic Type, frame timing, decode timing, and memory plateau.

## Decisions and dependencies

- Approved: preserve final-waypoint-as-destination semantics.
- Approved: require genuine alpha exports; do not remask the delivered JPEG layers at runtime.
- Approved: one shared spatial experience; no Three.js and no backend contract changes.
- Production parallax remains gated until qualified alpha assets are available.
- Final zoom/focal calibration is accepted only from measured device results.
