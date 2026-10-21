# ANCHOR_MILESTONE_SVG_DESIGN_HANDOFF

Design and asset creation only. No React Native, backend, milestone logic, gallery, celebration system, schema or dependency was touched. Everything lives in this standalone directory.

## 1. What was delivered

- **20 earned SVG masters** and **20 matching locked SVGs** (17 new + 3 reconstructions of the existing masters) (`svg/earned`, `svg/locked`)
- **Reveal-ready layer groups** in every earned file (ids below)
- **Animated showcase** for all 20: `preview/index.html` (single self-contained file, works offline)
- **20-milestone contact sheet** (locked + earned): `contact-sheet/contact-sheet.png` and `.html`
- **Motion specification**: `docs/MOTION_SPEC.md` + machine-readable `docs/motion-spec.json`
- **Animation manifest** (every animatable id, filled/dashed flags, stroke path lengths): `docs/animation-manifest.json`
- Generator and QA scripts in `src/` (Python) so every asset can be regenerated.

## 2. What was not available (please read)

1. **The original SVG masters were not in anything I could reach.** Full Strength is a vector candidate; First Practice, Goal Reached and First Glimpse are **vector reconstructions traced by eye from your in-app screenshots**, not your files. The plate (cream bevel, fine gold rings at r≈108.6 and r≈101) and ink (#13222C) of the whole set were matched to those screenshots. If you send the real SVGs, swap them in and diff. The synced GitHub branch (`claude/build-anchor-app-aspHi`) predates the 20-milestone gallery: it has no milestone SVGs and its `milestones.ts` still lists the old rank/mark/journey IDs. Your laptop was not connected.
2. **Real milestone IDs were not available**, so filenames are **provisional design slugs** (`<category>_<name>`). I did not invent app IDs. Rename on integration; the ids inside each SVG are prefixed by the slug so a rename is one search-and-replace.
3. **The mockup is inconsistent with itself:** category headers say Strength (5) / Commitment (5) / Journey (5) / Vision (5), but the tiles drawn are 5 / 6 / 4 / 5 = 20. I designed to the tiles, which match your brief (16 new + 4 existing).

## 3. Asset inventory

| Category | Milestone | Requirement (mockup) | Slug (provisional) | Earned | Locked | Motion family |
|---|---|---|---|---|---|---|
| Strength | Building | First Anchor | `strength_building` | `svg/earned/strength_building.svg` (4.7 KB) | `svg/locked/strength_building.svg` (8.3 KB) | strength |
| Strength | Established | 10 Strength | `strength_established` | `svg/earned/strength_established.svg` (4.7 KB) | `svg/locked/strength_established.svg` (6.8 KB) | strength |
| Strength | Integrated | 30 Strength | `strength_integrated` | `svg/earned/strength_integrated.svg` (6.0 KB) | `svg/locked/strength_integrated.svg` (10.5 KB) | strength |
| Strength | Reinforced | 70 Strength | `strength_reinforced` | `svg/earned/strength_reinforced.svg` (7.9 KB) | `svg/locked/strength_reinforced.svg` (14.0 KB) | strength |
| Strength | Full Strength | 100 Strength | `strength_full_strength` | `svg/earned/strength_full_strength.svg` (11.2 KB) | `svg/locked/strength_full_strength.svg` (20.5 KB) | strength |
| Commitment | Ten Practices | 10 practices | `commitment_ten_practices` | `svg/earned/commitment_ten_practices.svg` (9.7 KB) | `svg/locked/commitment_ten_practices.svg` (21.3 KB) | commitment |
| Commitment | Thirty Practices | 30 practices | `commitment_thirty_practices` | `svg/earned/commitment_thirty_practices.svg` (16.5 KB) | `svg/locked/commitment_thirty_practices.svg` (38.5 KB) | commitment |
| Commitment | One Hundred Practices | 100 practices | `commitment_one_hundred_practices` | `svg/earned/commitment_one_hundred_practices.svg` (28.7 KB) | `svg/locked/commitment_one_hundred_practices.svg` (63.2 KB) | commitment |
| Commitment | 100 Minutes | 100 minutes | `commitment_100_minutes` | `svg/earned/commitment_100_minutes.svg` (15.6 KB) | `svg/locked/commitment_100_minutes.svg` (36.0 KB) | commitment |
| Commitment | 500 Minutes | 500 minutes | `commitment_500_minutes` | `svg/earned/commitment_500_minutes.svg` (9.2 KB) | `svg/locked/commitment_500_minutes.svg` (16.5 KB) | commitment |
| Journey | First Waypoint | 1 waypoint | `journey_first_waypoint` | `svg/earned/journey_first_waypoint.svg` (10.1 KB) | `svg/locked/journey_first_waypoint.svg` (23.7 KB) | journey |
| Journey | Halfway | 50% waypoints | `journey_halfway` | `svg/earned/journey_halfway.svg` (11.0 KB) | `svg/locked/journey_halfway.svg` (24.1 KB) | journey |
| Journey | All Waypoints | All waypoints | `journey_all_waypoints` | `svg/earned/journey_all_waypoints.svg` (17.7 KB) | `svg/locked/journey_all_waypoints.svg` (37.0 KB) | journey |
| Commitment | First Practice | 1 practice | `commitment_first_practice` | `svg/earned/commitment_first_practice.svg` (8.4 KB) | `svg/locked/commitment_first_practice.svg` (15.6 KB) | commitment |
| Journey | Goal Reached | Final waypoint | `journey_goal_reached` | `svg/earned/journey_goal_reached.svg` (8.7 KB) | `svg/locked/journey_goal_reached.svg` (10.9 KB) | journey |
| Vision | First Glimpse | Create a Vision | `vision_first_glimpse` | `svg/earned/vision_first_glimpse.svg` (5.9 KB) | `svg/locked/vision_first_glimpse.svg` (11.2 KB) | vision |
| Vision | Picture Complete | 8 images | `vision_picture_complete` | `svg/earned/vision_picture_complete.svg` (8.8 KB) | `svg/locked/vision_picture_complete.svg` (18.6 KB) | vision |
| Vision | Seen Clearly | 1 Visualize | `vision_seen_clearly` | `svg/earned/vision_seen_clearly.svg` (6.1 KB) | `svg/locked/vision_seen_clearly.svg` (11.9 KB) | vision |
| Vision | Familiar Future | 10 Visualize | `vision_familiar_future` | `svg/earned/vision_familiar_future.svg` (4.9 KB) | `svg/locked/vision_familiar_future.svg` (8.6 KB) | vision |
| Vision | Living the Vision | 30 Visualize | `vision_living_the_vision` | `svg/earned/vision_living_the_vision.svg` (8.0 KB) | `svg/locked/vision_living_the_vision.svg` (16.4 KB) | vision |

First Practice, Goal Reached and First Glimpse are vector reconstructions from screenshots of the in-app screens, not the original masters (which were not available and are untouched). Full Strength (100 Strength) is also an existing milestone whose master was unavailable; `strength_full_strength` is a **new vector candidate** for it, designed from the mockup (large gold orb, concentric rings, four satellites) in the new system. Use it, or keep the original.

## 4. File locations
```
anchor-milestones/
  svg/earned/*.svg  svg/locked/*.svg
  preview/index.html            # animation showcase (open in any browser)
  contact-sheet/contact-sheet.{png,html}   
  docs/MOTION_SPEC.md  motion-spec.json  animation-manifest.json
  qa/                            # renders, filmstrips, settle + clip reports
  src/                           # generator (lib.py, emblems.py), preview builder, QA
```

## 5. Standards

**ViewBox:** `0 0 256 256`, all 40 files. Medal plate: cream disc r=120 with soft bevel, fine gold rings r≈108.6 and r≈101. Emblem centre (128,128).

**Safe zone:** all artwork stays inside r ≤ 94 (inner plate ring is r=101). Measured maximum across all 40 files: **94.2** (Living the Vision, locked).

**Symbol scale:** most emblems are drawn at 1:1. To normalise visual weight inside the plate, five are wrapped in `<g id="<slug>__art" transform="…scale(s)…">` : Building 1.20, Established 1.14, Integrated 1.10, Reinforced 1.05, Seen Clearly 1.12. Strokes scale with them (intended).

**Colour tokens**

| Token | Earned | Locked |
|---|---|---|
| ink | `#14162B` | `#8C867A` |
| inkSoft | `#3B3F5E` | `#A8A295` |
| gold | `#C9A24A` | `#B3AB99` |
| goldHi | `#E6C877` | `#C6BFAE` |
| goldDeep | `#8F6F22` | `#A19A8B` |
| plate | `#F6F0E4` | `#EAE5DB` |

Gold sphere: radial gradient `#FBEBB8 → #E2BD5F → #B88E32 → #7C5C1A` (focal 38%/32%) plus a white specular dot. Plate rim: linear gradient `#F0D98C → #C9A24A → #8F6F22`. Locked sphere: `#F6F3EC → #CFC8B9 → #9F988A`. Locked emboss: each shape is drawn three times (white highlight at −1,−1; shadow `#B7B0A0` at +0.9,+0.9; stone main).

**Stroke hierarchy (viewBox units)**

| Role | Width | Use |
|---|---|---|
| Hairline | 1.25 | engraving, rings of ornament (atmosphere only) |
| Fine | 2.5 | secondary rings, struts, gold arcs |
| Primary | 4.5 | main emblem forms |
| Heavy | 6.5 | rails, door arch |

Caps/joins: `round` everywhere except tick marks and seams (`butt`). Nothing essential relies on hairlines: at a 64 px tile a hairline is ≈0.3 px by design, and each emblem is recognisable from its primary/heavy forms alone.

**Layer / group naming** (earned and locked share ids)

```
<slug>                       root <svg>
<slug>__plate                static medal (not animated)
<slug>__structure            outer geometry, frames, tracks
<slug>__emblem               primary symbol
<slug>__engraving            secondary engraving / detail
<slug>__highlight            gold strokes (EMPTY group in locked files)
<slug>__accent               orbs, nodes, beads, pennant (final accents)
<slug>__<layer>-<part>       each animatable child, e.g. __emblem-mark-07, __structure-tick-042, __emblem-seg-3
```
Child part prefixes the motion spec relies on: `mark-` `tick-` `seg-` `inlay-` `wp-ring-` `wp-` `contour-` `bezel-` `ghost-` `seam-` `arch-` `ray-` `step-` `orb` `pennant`.

**Locked vs earned (not colour alone):** locked keeps the plate, structure, emblem, engraving and accents as embossed stone, drops the whole gold highlight layer, replaces gold with stone, flattens the plate rim to a single stone ring. Earned adds the gold rim, gold highlight layer, specular spheres and higher contrast ink.

**Prestige progression:** Strength goes ring → square-in-circle → three-circle union → braced hexagon lattice; Commitment goes 10 blades → 30 blades in three tiers → 100-tick dial with a 10-blade rosette; the two time pieces go from a bare engraved hourglass to a posted, ringed one with five gold beads; Journey routes grow from one inked leg to the full map with a bezel; Vision goes from a framed picture to a lit doorway with rays beyond it.

## 6. Animation specification

Full detail in `docs/MOTION_SPEC.md`. Summary:

| Family | Reveal | Shape of the sequence |
|---|---|---|
| Strength — Pulse and Integration | 2.9 s + hold | seed → form → frame → engrave → gold → nodes → settle → pulse |
| Commitment — Accumulation and Formation | 2.7 s + hold | marks → form → ticks → frame → engrave → lock → gold → orb → beads |
| Journey — Progress and Arrival | 3.0 s + hold | terrain → origin → route → inlay → waypoints → waypointOrbs → midMark → pennant → summit → arrival → sparks → bezel |
| Vision — Emergence and Clarity | 3.0 s + hold | emerge → resolve → engrave → orb → glow |

Reduced motion: 320 ms crossfade from locked art to earned art. Replay: same timeline, no progress side effects, holds earned art.

**Implementation separation (as requested)**

1. *Static SVG geometry* — `svg/**`. Source of truth for the end state.
2. *Animatable groups* — the ids above, listed with filled/dashed flags and stroke lengths in `docs/animation-manifest.json`.
3. *Preview implementation* — `preview/index.html` (Web Animations API; preview only).
4. *Platform-independent spec* — `docs/motion-spec.json` and `MOTION_SPEC.md`.

Suggested RN approach: render the earned SVG with `react-native-svg`, wrap each layer/child in `AnimatedG`/animated props (Reanimated), drive `strokeDashoffset` from the manifest lengths for `draw` steps, and feed the JSON timeline to one shared sequencer so all 16 reveals share code.

## 7. Preview instructions

Open `preview/index.html` in Chrome/Safari/Firefox (no server needed). Pick a milestone in the left list: **Play reveal**, **Earned**, **Locked**, **Play all 20**. Use the scrub bar to inspect any moment, the speed menu for slow motion, **Reduced motion** to see the crossfade, **Cream stage** to view on the gallery background. The timeline panel shows each step’s window. The “Gallery-size check” panel shows locked/earned at 96, 64 and 44 px.

## 8. QA performed

| Check | Result |
|---|---|
| All 40 SVGs parse as XML and render | pass (`xmllint`, Chromium) |
| Raster/embedded images, filters, clipPath, CSS, SMIL, external fonts | none used in any SVG |
| Art stays inside plate (no clipped strokes) | pass — max art radius 94.2 ≤ 108 (limit 111) |
| Earned vs locked distinguishable at 44/64/96 px | pass (visual review of tile rows) |
| All 20 reveals played in Chromium; filmstrips reviewed | pass (`qa/strips`) |
| Animation settles on the earned art | pass — held-end frame vs static earned frame: no pixel differs by >100/255 in the large majority, and at most 3 pixels do in the other three; remaining differences are edge anti-aliasing (≤ ~4% of pixels differ at all) |
| Console errors during playback | none |

Not verified: real react-native-svg rendering on a device, and real gallery tile dimensions (I used 44–96 px as a proxy for the 3-column tiles seen in the recording).

## 9. Known rendering limitations

- Locked files triple each shape for the emboss, so they are ~3× the element count of earned. If that is heavy in a 20-tile grid, rasterise locked tiles once or use a single stone pass with the plate shadow.
- Radial/linear gradients and `fill-opacity` (used for the doorway tint) are supported by react-native-svg but should be checked on Android.
- `pathLength` is used **only** by the preview (injected at runtime), never written into the masters; RN must use the measured lengths.
- `transform-box`/`transform-origin` are CSS preview features; in RN pass explicit origins (centre 128,128 or per-element bbox centres).
- The Strength `pulse` is an overlay circle, not in the SVG.
- The gold specular dot on orbs is a plain white circle at ~55% opacity, not a filter.

## 10. Decisions requiring your approval

1. **Style bridge.** The plate (cream bevel, two fine gold rings) and navy ink of the whole set now match the screenshots of your existing masters, and the three existing medals are rebuilt as vectors in the same system. What I could not match is any paper grain or painterly shading present in the real files, because I only had screenshots. Send the original SVGs and I will diff them against these reconstructions and swap them in.
2. **Provisional slugs → real IDs.** Send the milestone ID list (or the branch that has the 20-tile gallery) and I will rename.
3. **Gold usage vs the Living Design System** (“gold is a reserved active-state signal and never fills large areas”): earned art uses gold only for orbs, nodes, small arcs and hairlines; the one exception is a 22% gold tint inside the two doorway emblems. Say if you want that removed. The Strength `pulse` ring is a thin 2.2-unit line, not a glow, but note the Living Spec’s “no glow/aura rings” rule and your existing Thread Strength glow exception.
4. **Hourglass retained for 100 / 500 Minutes.** I kept the mockup’s hourglass because it reads instantly at tile size, but rebuilt it as engraved hatch glass with a minute scale (100) and a posted frame with an armillary ring (500). If you want to leave hourglass behind entirely, tell me.
5. **Journey is a map, not mountains.** First Waypoint / Halfway / All Waypoints use one shared contour map and trail so progress reads across the three; Goal Reached (landscape with sun) stays the arrival moment. This follows the Chart’s etched-map direction.
6. **Plate included in every SVG** (`__plate`). If the gallery tile already supplies the disc, drop that one group.
7. **Mobbin reference:** your standing rule is Mobbin for app screens; these are medal assets rather than screens, so I did not run a Mobbin pass. Say if you want one for the gallery tile layout.
