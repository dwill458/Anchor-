# Anchor Milestone Celebration — Motion Specification

Design reference for the later React Native pass. The browser preview (`preview/index.html`) is driven by the same `docs/motion-spec.json` listed here, so spec and preview cannot drift. **CSS/SMIL/WAAPI are preview-only; nothing here assumes they exist in react-native-svg.**

## Rules that apply to every family

- The milestone emblem is the focal point. Thread Strength energy (existing glow) may support it, never cover it. No permanently pulsing gallery: motion plays on first unlock and on replay only.
- Reveal runs **once**, then **holds the finished earned SVG** (the static earned file is the source of truth for the end state; animation end-state must equal it).
- Total reveal 2.7–3.0 s. No rotation, no particle bursts, no bouncing/overshoot easing, no filters/blur.
- Stage order for every family follows the layer order: `structure → emblem → engraving → highlight → accent`, with family-specific timing.

## Easing library

| Name | cubic-bezier | Use |
|---|---|---|
| `linear` | `cubic-bezier(0, 0, 1, 1)` | — |
| `outCubic` | `cubic-bezier(0.33, 1, 0.68, 1)` | fades, small pops, pulses |
| `inOutCubic` | `cubic-bezier(0.65, 0, 0.35, 1)` | stroke drawing |
| `outQuint` | `cubic-bezier(0.22, 1, 0.36, 1)` | settles, locks, resolves (decelerate hard) |
| `outExpo` | `cubic-bezier(0.16, 1, 0.3, 1)` | seed/orb emergence |

Reanimated: `Easing.bezier(a,b,c,d)`; Animated API: `Easing.bezier(a,b,c,d)`.

## Operations

| op | meaning | RN mapping |
|---|---|---|
| `draw` | Stroke draws on from 0 → full length. Filled shapes, dashed strokes and groups fall back to `fade`. | `strokeDasharray=[len,len]` + animate `strokeDashoffset` len→0. Lengths are in `docs/animation-manifest.json` (`pathLength`). First 5% of the time also lifts opacity 0→1 so the round cap does not show as a dot. |
| `fade` | Opacity 0 → authored opacity. | `opacity` shared value on `G`/shape. |
| `fadeKeys` | Opacity keyframes relative to authored opacity. | `withSequence`/interpolate. |
| `pop` | Opacity 0→1 with scale `from`→1 about the element’s own centre. | `G` with transform; origin = bbox centre (precompute from manifest or hard-code per emblem). |
| `radial` | Opacity 0→1 with scale `from`→1 about the emblem centre (128,128) — marks gather inward. | Scale about (128,128): `translate(128 128) scale(s) translate(-128 -128)`. |
| `raise` | Pennant: scaleY 0.05→1 from its base, opacity 0→1. | Scale about the pole base. |
| `translateX` | Ghost rings slide from `from` px into register (focus pull). | `translateX`. |
| `strokewidth` | Seams narrow from `from` to authored width (tiles join). | Animate `strokeWidth`. |
| `layerScale` | Whole layer group scales through `keys` about (128,128) (settle / lock). | Animate a wrapping `G` transform. |
| `pulse` | Overlay ring r0→r1, gold, opacity 0→0.7→0. **Not part of the SVG artwork.** Thin 2.2-unit ring, not a glow. | Extra `Circle` rendered above the emblem; remove at end. |

## Strength — Pulse and Integration

**Emotion:** stability, power, growth · **Reveal:** 2.9 s then hold · **Applies to:** Building, Established, Integrated, Reinforced, Full Strength

| # | Step | Layer / target | Op | Start (ms) | Duration | Stagger | Easing | Opacity / scale |
|---|---|---|---|---|---|---|---|---|
| 1 | seed | accent · /accent-orb$/ | `pop` | 0 | 420 | — | `outExpo` | 0→1 / scale 0.35→1 |
| 2 | form | emblem | `draw` | 250 | 650 | 90 ms (spread ≤ 700) | `inOutCubic` |  |
| 3 | frame | structure | `draw` | 650 | 600 | 70 ms (spread ≤ 600) | `inOutCubic` |  |
| 4 | engrave | engraving | `fade` | 1250 | 450 | 55 ms (spread ≤ 700) | `outCubic` | 0→1 |
| 5 | gold | highlight | `draw` | 1750 | 520 | 90 ms (spread ≤ 540) | `inOutCubic` |  |
| 6 | nodes | accent · not /accent-orb$/ | `pop` | 1850 | 360 | 60 ms (spread ≤ 400) | `outCubic` | 0→1 / scale 0.5→1 |
| 7 | settle | group:emblem | `layerScale` | 2100 | 600 | — | `inOutCubic` | 1 → 1.012 → 1 |
| 8 | pulse | group:— | `pulse` | 2100 | 700 | — | `outCubic` | r 12→96, opacity 0→.7→0 |

**Hold state:** final earned art, all layers at authored opacity, no residual transforms. **Replay:** identical timeline from the reset state (see below).

## Commitment — Accumulation and Formation

**Emotion:** discipline, consistency, effort rewarded · **Reveal:** 2.7 s then hold · **Applies to:** Ten Practices, Thirty Practices, One Hundred Practices, 100 Minutes, 500 Minutes, First Practice

| # | Step | Layer / target | Op | Start (ms) | Duration | Stagger | Easing | Opacity / scale |
|---|---|---|---|---|---|---|---|---|
| 1 | marks | emblem · /mark-/ | `radial` | 100 | 260 | 70 ms (spread ≤ 1300) | `outQuint` | 0→1 / scale 0.82→1 |
| 2 | form | emblem · not /mark-/ | `draw` | 100 | 700 | 120 ms (spread ≤ 500) | `inOutCubic` |  |
| 3 | ticks | structure · /tick-/ | `fade` | 200 | 200 | 12 ms (spread ≤ 1300) | `outCubic` | 0→1 |
| 4 | frame | structure · not /tick-/ | `draw` | 600 | 600 | 80 ms (spread ≤ 400) | `inOutCubic` |  |
| 5 | engrave | engraving | `fade` | 1300 | 400 | 35 ms (spread ≤ 500) | `outCubic` | 0→1 |
| 6 | lock | group:emblem | `layerScale` | 1450 | 420 | — | `outQuint` | 1.03 → 1 |
| 7 | gold | highlight | `draw` | 1750 | 420 | 50 ms (spread ≤ 450) | `inOutCubic` |  |
| 8 | orb | accent · /accent-orb$/ | `pop` | 1700 | 360 | — | `outExpo` | 0→1 / scale 0.5→1 |
| 9 | beads | accent · not /accent-orb$/ | `pop` | 1900 | 300 | 40 ms (spread ≤ 400) | `outCubic` | 0→1 / scale 0.4→1 |

**Hold state:** final earned art, all layers at authored opacity, no residual transforms. **Replay:** identical timeline from the reset state (see below).

## Journey — Progress and Arrival

**Emotion:** accomplishment, momentum, arrival · **Reveal:** 3.0 s then hold · **Applies to:** First Waypoint, Halfway, All Waypoints, Goal Reached

| # | Step | Layer / target | Op | Start (ms) | Duration | Stagger | Easing | Opacity / scale |
|---|---|---|---|---|---|---|---|---|
| 1 | terrain | structure · /contour-/ | `draw` | 0 | 700 | 140 ms (spread ≤ 450) | `inOutCubic` |  |
| 2 | origin | emblem · /origin/ | `pop` | 350 | 240 | — | `outCubic` | 0→1 / scale 0.4→1 |
| 3 | route | emblem · /seg-/ | `draw` | 500 | 300 | 300 ms by id index | `inOutCubic` |  |
| 4 | inlay | highlight · /inlay-/ | `draw` | 700 | 300 | 300 ms by id index | `inOutCubic` |  |
| 5 | waypoints | engraving · /wp-ring-/ | `pop` | 800 | 260 | 300 ms by id index | `outCubic` | 0→1 / scale 0.5→1 |
| 6 | waypointOrbs | accent · /accent-wp-\d/ | `pop` | 800 | 260 | 300 ms by id index | `outCubic` | 0→1 / scale 0.3→1 |
| 7 | midMark | highlight · /mid-/ | `pop` | 1900 | 400 | — | `outCubic` | 0→1 / scale 0.6→1 |
| 8 | pennant | accent · /pennant/ | `raise` | per-milestone ($pennantStart) | 450 | — | `outQuint` |  |
| 9 | summit | engraving · /summit-/ | `$summitOp` | per-milestone ($summitStart) | 420 | — | `outCubic` |  |
| 10 | arrival | accent · /accent-wp-6/ | `pop` | 2150 | 420 | — | `outExpo` | 0→1 / scale 0.2→1 |
| 11 | sparks | highlight · /spark-/ | `draw` | 2350 | 350 | 50 ms | `outCubic` |  |
| 12 | bezel | structure · /bezel-/ | `fade` | 2250 | 220 | 25 ms (spread ≤ 600) | `outCubic` | 0→1 |

**Per-milestone variations**

- **First Waypoint** (`journey_first_waypoint`): `pennantStart` = 1000; `summitStart` = 1900; `summitOp` = fade; `summitFrom` = 0
- **Halfway** (`journey_halfway`): `pennantStart` = 1500; `summitStart` = 2000; `summitOp` = fade; `summitFrom` = 0
- **All Waypoints** (`journey_all_waypoints`): `pennantStart` = 2250; `summitStart` = 2050; `summitOp` = pop; `summitFrom` = 0.5
- **Goal Reached** (`journey_goal_reached`): `pennantStart` = 0; `summitStart` = 0; `summitOp` = fade; `summitFrom` = 0; + **horizon** (draw, 100–700 ms); + **hills** (fade, 300–900 ms); + **hillLines** (fade, 900–1400 ms); + **sunRise** (pop, 1750–2350 ms); + **goal** (pop, 1950–2370 ms); + **rays** (draw, 2150–2650 ms)

**Hold state:** final earned art, all layers at authored opacity, no residual transforms. **Replay:** identical timeline from the reset state (see below).

## Vision — Emergence and Clarity

**Emotion:** clarity, possibility, realization · **Reveal:** 3.0 s then hold · **Applies to:** First Glimpse, Picture Complete, Seen Clearly, Familiar Future, Living the Vision

| # | Step | Layer / target | Op | Start (ms) | Duration | Stagger | Easing | Opacity / scale |
|---|---|---|---|---|---|---|---|---|
| 1 | emerge | structure | `fadeKeys` | 0 | 1200 | 70 ms (spread ≤ 300) | `outCubic` | t0:0 → t600:0.4 → t1200:1 |
| 2 | resolve | emblem | `pop` | 500 | 900 | 80 ms (spread ≤ 400) | `outQuint` | 0→1 / scale 1.035→1 |
| 3 | engrave | engraving | `fade` | 1500 | 700 | 40 ms (spread ≤ 500) | `outCubic` | 0→1 |
| 4 | orb | accent | `pop` | 1900 | 600 | 60 ms (spread ≤ 300) | `outCubic` | 0→1 / scale 0.8→1 |
| 5 | glow | highlight | `fade` | 2200 | 600 | 60 ms (spread ≤ 300) | `outCubic` | 0→1 |

**Per-milestone variations**

- **Seen Clearly** (`vision_seen_clearly`): + **focusPull** (translateX, 700–1800 ms); `engrave` step: exclude=/ghost-/
- **Picture Complete** (`vision_picture_complete`): + **tilesJoin** (strokewidth, 1300–2300 ms); `engrave` step: exclude=/seam-/
- **Familiar Future** (`vision_familiar_future`): + **ghostArch** (fade, 200–800 ms); + **nearerArch** (fade, 800–1400 ms); + **homeArch** (fade, 1400–2000 ms); `resolve` step: exclude=/arch-/
- **Living the Vision** (`vision_living_the_vision`): + **raysOut** (draw, 1000–1600 ms); + **door** (draw, 300–1300 ms); + **steps** (pop, 1300–1660 ms); `emerge` step: exclude=/ray-/; `resolve` step: exclude=/arch-main|step-/

**Hold state:** final earned art, all layers at authored opacity, no residual transforms. **Replay:** identical timeline from the reset state (see below).

## Notes by milestone (what each reveal is saying)

| Milestone | Reveal |
|---|---|
| Building | Seed orb → inner ring and cardinal marks draw → dashed outer ring (the not-yet-formed structure) → gold arc: growth begun. |
| Established | Square draws first (the ground), then the rings that sit inside it; gold corner nodes mark the footings. |
| Integrated | Three circles draw one after another and resolve around the orb; gold arcs sit on the unifying ring. |
| Reinforced | Hexagon, inner hexagon, then twelve struts brace them; six gold nodes lock the corners last. |
| Full Strength | Large seed orb, three heavy rings draw outward, hairline axes and halo, gold arcs, then the four satellite orbs lock in; one pulse ring crosses the emblem. |
| Ten Practices | Ten blades arrive at 70 ms intervals — a countable rhythm — then the beads between them. |
| Thirty Practices | Three decades of ten: inner tier, middle, outer, still at a steady pulse; gold rings arrive after. |
| One Hundred Practices | The 100-tick track fills quickly around the dial (12 ms ticks), ten blades gather, ten gold decade marks flash last. |
| 100 Minutes | Minute scale ticks in, glass and rails draw, gold sand hatch appears bottom-up, thread of sand drops. |
| 500 Minutes | Posts and rails first, glass draws, bulb fills, gold armillary ring crosses the front, five beads cap the top. |
| First Waypoint | Contours draw, origin pops, the first leg inks and a pennant is raised; the rest of the route appears as dotted, yet-to-walk path. |
| Halfway | Three legs ink in sequence, each ending in a waypoint; the mid-ring and pennant mark the halfway point; the rest stays dotted. |
| All Waypoints | All six legs ink one after another with a gold inlay following; the summit lights, the pennant is raised, the bezel ticks close the map. |
| First Practice | Eight points stamp in one by one (cardinals first), the hub ring and ticks fade up, facet lines engrave, gold arcs draw, hub orb lands. |
| Goal Reached | Contour lines draw in, the two hill crests rise, the road is traced from the foreground to the horizon, the sun and double outline lift, the goal orb lands and thirteen rays draw out. |
| First Glimpse | The fine ring emerges, the four-point star resolves from a faint ghost, crosshair and diagonals engrave, then the gold hub ring and orb settle. |
| Picture Complete | Frame fades up faint, picture resolves, then the nine tile seams narrow 14 → 3.4 as the eight images join. |
| Seen Clearly | Brackets and rings emerge soft; blur ghosts slide into register with the crisp ring (focus pull); orb and arc arrive last. |
| Familiar Future | Outer ghost arch first (imagined), nearer arch next, the home arch last with a lit doorway: the future becomes familiar. |
| Living the Vision | Door draws, light fans out through and beyond it, steps rise, the sun settles in the doorway. |

## Reduced motion

- **Treatment:** Replace travel, draw, pulse and scale with a single opacity crossfade from the locked artwork to the earned artwork.
- **Duration/easing:** 320 ms, `outCubic`.
- **Hold:** Final earned artwork, full opacity, no residual motion.
- **Sound/haptics:** Haptics and sound still fire (except cues that belong to motion that no longer plays).
- No Thread Strength energy pulse, no scale, no drawing.

## Replay behaviour

- Same timeline as first unlock. Resets every animated element to its start state, runs once, holds the earned artwork. No Thread Strength update, no persistence side effects.
- Hold: Settle on the final earned SVG; the static SVG is the source of truth for the end state.
- Button and header copy changes (“Back to Milestones”, “Replay · Category”) belong to the app; this spec only covers the emblem.

## Thread Strength integration

The existing Thread Strength glow may sit behind the emblem during the reveal and ease up with the first step; it must stay behind `plate` and never exceed the emblem’s own contrast. It is a supporting layer, not part of any SVG here. The only energy element specified is the single `pulse` ring in the Strength family.
