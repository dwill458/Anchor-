import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT,'src','meta.json')))
spec = json.load(open(os.path.join(ROOT,'docs','motion-spec.json')))
man = json.load(open(os.path.join(ROOT,'docs','animation-manifest.json')))
clip = json.load(open(os.path.join(ROOT,'qa','clip_report.json')))
settle = json.load(open(os.path.join(ROOT,'qa','settle_summary.json')))
sizes = {m['slug']: (os.path.getsize(os.path.join(ROOT,'svg','earned',m['slug']+'.svg')), os.path.getsize(os.path.join(ROOT,'svg','locked',m['slug']+'.svg'))) for m in meta}
E = spec['easings']
def bez(n): return 'cubic-bezier(' + ', '.join(str(x) for x in E[n]) + ')'

# ------------------------------------------------------------------ MOTION SPEC
L = []
L.append('# Anchor Milestone Celebration — Motion Specification\n')
L.append('Design reference for the later React Native pass. The browser preview (`preview/index.html`) is driven by the same `docs/motion-spec.json` listed here, so spec and preview cannot drift. **CSS/SMIL/WAAPI are preview-only; nothing here assumes they exist in react-native-svg.**\n')
L.append('## Rules that apply to every family\n')
L.append('- The milestone emblem is the focal point. Thread Strength energy (existing glow) may support it, never cover it. No permanently pulsing gallery: motion plays on first unlock and on replay only.\n- Reveal runs **once**, then **holds the finished earned SVG** (the static earned file is the source of truth for the end state; animation end-state must equal it).\n- Total reveal 2.7–3.0 s. No rotation, no particle bursts, no bouncing/overshoot easing, no filters/blur.\n- Stage order for every family follows the layer order: `structure → emblem → engraving → highlight → accent`, with family-specific timing.\n')
L.append('## Easing library\n\n| Name | cubic-bezier | Use |\n|---|---|---|')
use = {'linear':'—','outCubic':'fades, small pops, pulses','inOutCubic':'stroke drawing','outQuint':'settles, locks, resolves (decelerate hard)','outExpo':'seed/orb emergence'}
for k,v in E.items(): L.append(f'| `{k}` | `{bez(k)}` | {use[k]} |')
L.append('\nReanimated: `Easing.bezier(a,b,c,d)`; Animated API: `Easing.bezier(a,b,c,d)`.\n')
L.append('## Operations\n\n| op | meaning | RN mapping |\n|---|---|---|')
ops = [('draw','Stroke draws on from 0 → full length. Filled shapes, dashed strokes and groups fall back to `fade`.','`strokeDasharray=[len,len]` + animate `strokeDashoffset` len→0. Lengths are in `docs/animation-manifest.json` (`pathLength`). First 5% of the time also lifts opacity 0→1 so the round cap does not show as a dot.'),
 ('fade','Opacity 0 → authored opacity.','`opacity` shared value on `G`/shape.'),
 ('fadeKeys','Opacity keyframes relative to authored opacity.','`withSequence`/interpolate.'),
 ('pop','Opacity 0→1 with scale `from`→1 about the element’s own centre.','`G` with transform; origin = bbox centre (precompute from manifest or hard-code per emblem).'),
 ('radial','Opacity 0→1 with scale `from`→1 about the emblem centre (128,128) — marks gather inward.','Scale about (128,128): `translate(128 128) scale(s) translate(-128 -128)`.'),
 ('raise','Pennant: scaleY 0.05→1 from its base, opacity 0→1.','Scale about the pole base.'),
 ('translateX','Ghost rings slide from `from` px into register (focus pull).','`translateX`.'),
 ('strokewidth','Seams narrow from `from` to authored width (tiles join).','Animate `strokeWidth`.'),
 ('layerScale','Whole layer group scales through `keys` about (128,128) (settle / lock).','Animate a wrapping `G` transform.'),
 ('pulse','Overlay ring r0→r1, gold, opacity 0→0.7→0. **Not part of the SVG artwork.** Thin 2.2-unit ring, not a glow.','Extra `Circle` rendered above the emblem; remove at end.')]
for o in ops: L.append(f'| `{o[0]}` | {o[1]} | {o[2]} |')
L.append('')
for fam, d in spec['families'].items():
    members = [m['name'] for m in meta if m['family']==fam]
    L.append(f'## {fam.capitalize()} — {d["title"]}\n')
    L.append(f'**Emotion:** {d["emotion"]} · **Reveal:** {d["duration"]/1000:.1f} s then hold · **Applies to:** {", ".join(members)}\n')
    L.append('| # | Step | Layer / target | Op | Start (ms) | Duration | Stagger | Easing | Opacity / scale |\n|---|---|---|---|---|---|---|---|---|')
    for i,s in enumerate(d['steps'],1):
        tgt = (s.get('layer') or ('group:'+s.get('layerGroup','—'))) + (f' · /{s["match"]}/' if s.get('match') else '') + (f' · not /{s["exclude"]}/' if s.get('exclude') else '')
        st = s['start'] if isinstance(s['start'],int) else f'per-milestone ({s["start"]})'
        stag = '—'
        if s.get('stagger'):
            stag = f'{s["stagger"]} ms' + (f' (spread ≤ {s["maxSpread"]})' if s.get('maxSpread') else '') + (' by id index' if s.get('idIndex') else '')
        dur = s.get('dur') or (s['keys'][-1][0] if s.get('keys') else '—')
        extra = ''
        if s['op'] in ('pop','radial'): extra = f'0→1 / scale {s["from"]}→1'
        elif s['op'] in ('fade',): extra = f'{s.get("from",0)}→1'
        elif s['op']=='layerScale': extra = ' → '.join(str(k) for k in s['keys'])
        elif s['op']=='pulse': extra = f'r {s["r0"]}→{s["r1"]}, opacity 0→.7→0'
        elif s['op']=='fadeKeys': extra = ' → '.join(f't{k[0]}:{k[1]}' for k in s['keys'])
        elif s['op']=='translateX': extra = f'{s["from"]} px → 0'
        elif s['op']=='strokewidth': extra = f'{s["from"]} → authored'
        L.append(f'| {i} | {s["name"]} | {tgt} | `{s["op"]}` | {st} | {dur} | {stag} | `{s.get("ease","—")}` | {extra} |')
    L.append('')
    pm = d.get('perMilestone')
    if pm:
        L.append('**Per-milestone variations**\n')
        for slug, v in pm.items():
            nm = next(m['name'] for m in meta if m['slug']==slug)
            bits = []
            for k in ('pennantStart','summitStart','summitOp','summitFrom'):
                if k in v: bits.append(f'`{k}` = {v[k]}')
            for e in v.get('extra',[]):
                bits.append(f'+ **{e["name"]}** ({e["op"]}, {e["start"]}–{e["start"]+e["dur"]} ms)')
            for k,r in (v.get('replace') or {}).items():
                bits.append(f'`{k}` step: {", ".join(f"{a}=/{b}/" for a,b in r.items())}')
            L.append(f'- **{nm}** (`{slug}`): ' + '; '.join(bits))
        L.append('')
    L.append('**Hold state:** final earned art, all layers at authored opacity, no residual transforms. **Replay:** identical timeline from the reset state (see below).\n')
L.append('## Notes by milestone (what each reveal is saying)\n')
notes = {
 'strength_building':'Seed orb → inner ring and cardinal marks draw → dashed outer ring (the not-yet-formed structure) → gold arc: growth begun.',
 'strength_established':'Square draws first (the ground), then the rings that sit inside it; gold corner nodes mark the footings.',
 'strength_integrated':'Three circles draw one after another and resolve around the orb; gold arcs sit on the unifying ring.',
 'strength_reinforced':'Hexagon, inner hexagon, then twelve struts brace them; six gold nodes lock the corners last.',
 'commitment_ten_practices':'Ten blades arrive at 70 ms intervals — a countable rhythm — then the beads between them.',
 'commitment_thirty_practices':'Three decades of ten: inner tier, middle, outer, still at a steady pulse; gold rings arrive after.',
 'commitment_one_hundred_practices':'The 100-tick track fills quickly around the dial (12 ms ticks), ten blades gather, ten gold decade marks flash last.',
 'commitment_100_minutes':'Minute scale ticks in, glass and rails draw, gold sand hatch appears bottom-up, thread of sand drops.',
 'commitment_500_minutes':'Posts and rails first, glass draws, bulb fills, gold armillary ring crosses the front, five beads cap the top.',
 'journey_first_waypoint':'Contours draw, origin pops, the first leg inks and a pennant is raised; the rest of the route appears as dotted, yet-to-walk path.',
 'journey_halfway':'Three legs ink in sequence, each ending in a waypoint; the mid-ring and pennant mark the halfway point; the rest stays dotted.',
 'journey_all_waypoints':'All six legs ink one after another with a gold inlay following; the summit lights, the pennant is raised, the bezel ticks close the map.',
 'vision_picture_complete':'Frame fades up faint, picture resolves, then the nine tile seams narrow 14 → 3.4 as the eight images join.',
 'vision_seen_clearly':'Brackets and rings emerge soft; blur ghosts slide into register with the crisp ring (focus pull); orb and arc arrive last.',
 'vision_familiar_future':'Outer ghost arch first (imagined), nearer arch next, the home arch last with a lit doorway: the future becomes familiar.',
 'commitment_first_practice':'Eight points stamp in one by one (cardinals first), the hub ring and ticks fade up, facet lines engrave, gold arcs draw, hub orb lands.',
 'journey_goal_reached':'Contour lines draw in, the two hill crests rise, the road is traced from the foreground to the horizon, the sun and double outline lift, the goal orb lands and thirteen rays draw out.',
 'vision_first_glimpse':'The fine ring emerges, the four-point star resolves from a faint ghost, crosshair and diagonals engrave, then the gold hub ring and orb settle.',
 'strength_full_strength':'Large seed orb, three heavy rings draw outward, hairline axes and halo, gold arcs, then the four satellite orbs lock in; one pulse ring crosses the emblem.',
 'vision_living_the_vision':'Door draws, light fans out through and beyond it, steps rise, the sun settles in the doorway.',
}
L.append('| Milestone | Reveal |\n|---|---|')
for m in meta: L.append(f'| {m["name"]} | {notes[m["slug"]]} |')
L.append('\n## Reduced motion\n')
R = spec['reducedMotion']
L.append(f'- **Treatment:** {R["treatment"]}\n- **Duration/easing:** {R["duration"]} ms, `{R["ease"]}`.\n- **Hold:** {R["hold"]}\n- **Sound/haptics:** {R["keep"]}\n- No Thread Strength energy pulse, no scale, no drawing.\n')
L.append('## Replay behaviour\n')
L.append(f'- {spec["replay"]["behaviour"]}\n- Hold: {spec["replay"]["hold"]}\n- Button and header copy changes (“Back to Milestones”, “Replay · Category”) belong to the app; this spec only covers the emblem.\n')
L.append('## Thread Strength integration\n\nThe existing Thread Strength glow may sit behind the emblem during the reveal and ease up with the first step; it must stay behind `plate` and never exceed the emblem’s own contrast. It is a supporting layer, not part of any SVG here. The only energy element specified is the single `pulse` ring in the Strength family.\n')
open(os.path.join(ROOT,'docs','MOTION_SPEC.md'),'w').write('\n'.join(L))

# ------------------------------------------------------------------ HANDOFF
H = []
H.append('# ANCHOR_MILESTONE_SVG_DESIGN_HANDOFF\n')
H.append('Design and asset creation only. No React Native, backend, milestone logic, gallery, celebration system, schema or dependency was touched. Everything lives in this standalone directory.\n')
H.append('## 1. What was delivered\n\n- **20 earned SVG masters** and **20 matching locked SVGs** (17 new + 3 reconstructions of the existing masters) (`svg/earned`, `svg/locked`)\n- **Reveal-ready layer groups** in every earned file (ids below)\n- **Animated showcase** for all 20: `preview/index.html` (single self-contained file, works offline)\n- **20-milestone contact sheet** (locked + earned): `contact-sheet/contact-sheet.png` and `.html`\n- **Motion specification**: `docs/MOTION_SPEC.md` + machine-readable `docs/motion-spec.json`\n- **Animation manifest** (every animatable id, filled/dashed flags, stroke path lengths): `docs/animation-manifest.json`\n- Generator and QA scripts in `src/` (Python) so every asset can be regenerated.\n')
H.append('## 2. What was not available (please read)\n')
H.append('1. **The original SVG masters were not in anything I could reach.** Full Strength is a vector candidate; First Practice, Goal Reached and First Glimpse are **vector reconstructions traced by eye from your in-app screenshots**, not your files. The plate (cream bevel, fine gold rings at r≈108.6 and r≈101) and ink (#13222C) of the whole set were matched to those screenshots. If you send the real SVGs, swap them in and diff. The synced GitHub branch (`claude/build-anchor-app-aspHi`) predates the 20-milestone gallery: it has no milestone SVGs and its `milestones.ts` still lists the old rank/mark/journey IDs. Your laptop was not connected.\n2. **Real milestone IDs were not available**, so filenames are **provisional design slugs** (`<category>_<name>`). I did not invent app IDs. Rename on integration; the ids inside each SVG are prefixed by the slug so a rename is one search-and-replace.\n3. **The mockup is inconsistent with itself:** category headers say Strength (5) / Commitment (5) / Journey (5) / Vision (5), but the tiles drawn are 5 / 6 / 4 / 5 = 20. I designed to the tiles, which match your brief (16 new + 4 existing).\n')
H.append('## 3. Asset inventory\n')
H.append('| Category | Milestone | Requirement (mockup) | Slug (provisional) | Earned | Locked | Motion family |\n|---|---|---|---|---|---|---|')
for m in meta:
    es, ls = sizes[m['slug']]
    H.append(f'| {m["category"]} | {m["name"]} | {m["req"]} | `{m["slug"]}` | `svg/earned/{m["slug"]}.svg` ({es/1024:.1f} KB) | `svg/locked/{m["slug"]}.svg` ({ls/1024:.1f} KB) | {m["family"]} |')
H.append('\nFirst Practice, Goal Reached and First Glimpse are vector reconstructions from screenshots of the in-app screens, not the original masters (which were not available and are untouched). Full Strength (100 Strength) is also an existing milestone whose master was unavailable; `strength_full_strength` is a **new vector candidate** for it, designed from the mockup (large gold orb, concentric rings, four satellites) in the new system. Use it, or keep the original.\n')
H.append('## 4. File locations\n```\nanchor-milestones/\n  svg/earned/*.svg  svg/locked/*.svg\n  preview/index.html            # animation showcase (open in any browser)\n  contact-sheet/contact-sheet.{png,html}   \n  docs/MOTION_SPEC.md  motion-spec.json  animation-manifest.json\n  qa/                            # renders, filmstrips, settle + clip reports\n  src/                           # generator (lib.py, emblems.py), preview builder, QA\n```\n')
H.append('## 5. Standards\n')
H.append('**ViewBox:** `0 0 256 256`, all 40 files. Medal plate: cream disc r=120 with soft bevel, fine gold rings r≈108.6 and r≈101. Emblem centre (128,128).\n')
H.append('**Safe zone:** all artwork stays inside r ≤ 94 (inner plate ring is r=101). Measured maximum across all 40 files: **%.1f** (Living the Vision, locked).\n' % max(clip.values()))
H.append('**Symbol scale:** most emblems are drawn at 1:1. To normalise visual weight inside the plate, five are wrapped in `<g id="<slug>__art" transform="…scale(s)…">` : Building 1.20, Established 1.14, Integrated 1.10, Reinforced 1.05, Seen Clearly 1.12. Strokes scale with them (intended).\n')
H.append('**Colour tokens**\n\n| Token | Earned | Locked |\n|---|---|---|')
from_lib = {'ink':('#14162B','#8C867A'),'inkSoft':('#3B3F5E','#A8A295'),'gold':('#C9A24A','#B3AB99'),'goldHi':('#E6C877','#C6BFAE'),'goldDeep':('#8F6F22','#A19A8B'),'plate':('#F6F0E4','#EAE5DB')}
for k,(a,b) in from_lib.items(): H.append(f'| {k} | `{a}` | `{b}` |')
H.append('\nGold sphere: radial gradient `#FBEBB8 → #E2BD5F → #B88E32 → #7C5C1A` (focal 38%/32%) plus a white specular dot. Plate rim: linear gradient `#F0D98C → #C9A24A → #8F6F22`. Locked sphere: `#F6F3EC → #CFC8B9 → #9F988A`. Locked emboss: each shape is drawn three times (white highlight at −1,−1; shadow `#B7B0A0` at +0.9,+0.9; stone main).\n')
H.append('**Stroke hierarchy (viewBox units)**\n\n| Role | Width | Use |\n|---|---|---|\n| Hairline | 1.25 | engraving, rings of ornament (atmosphere only) |\n| Fine | 2.5 | secondary rings, struts, gold arcs |\n| Primary | 4.5 | main emblem forms |\n| Heavy | 6.5 | rails, door arch |\n\nCaps/joins: `round` everywhere except tick marks and seams (`butt`). Nothing essential relies on hairlines: at a 64 px tile a hairline is ≈0.3 px by design, and each emblem is recognisable from its primary/heavy forms alone.\n')
H.append('**Layer / group naming** (earned and locked share ids)\n\n```\n<slug>                       root <svg>\n<slug>__plate                static medal (not animated)\n<slug>__structure            outer geometry, frames, tracks\n<slug>__emblem               primary symbol\n<slug>__engraving            secondary engraving / detail\n<slug>__highlight            gold strokes (EMPTY group in locked files)\n<slug>__accent               orbs, nodes, beads, pennant (final accents)\n<slug>__<layer>-<part>       each animatable child, e.g. __emblem-mark-07, __structure-tick-042, __emblem-seg-3\n```\nChild part prefixes the motion spec relies on: `mark-` `tick-` `seg-` `inlay-` `wp-ring-` `wp-` `contour-` `bezel-` `ghost-` `seam-` `arch-` `ray-` `step-` `orb` `pennant`.\n')
H.append('**Locked vs earned (not colour alone):** locked keeps the plate, structure, emblem, engraving and accents as embossed stone, drops the whole gold highlight layer, replaces gold with stone, flattens the plate rim to a single stone ring. Earned adds the gold rim, gold highlight layer, specular spheres and higher contrast ink.\n')
H.append('**Prestige progression:** Strength goes ring → square-in-circle → three-circle union → braced hexagon lattice; Commitment goes 10 blades → 30 blades in three tiers → 100-tick dial with a 10-blade rosette; the two time pieces go from a bare engraved hourglass to a posted, ringed one with five gold beads; Journey routes grow from one inked leg to the full map with a bezel; Vision goes from a framed picture to a lit doorway with rays beyond it.\n')
H.append('## 6. Animation specification\n\nFull detail in `docs/MOTION_SPEC.md`. Summary:\n\n| Family | Reveal | Shape of the sequence |\n|---|---|---|')
for fam,d in spec['families'].items():
    H.append(f'| {fam.capitalize()} — {d["title"]} | {d["duration"]/1000:.1f} s + hold | ' + ' → '.join(s['name'] for s in d['steps']) + ' |')
H.append('\nReduced motion: 320 ms crossfade from locked art to earned art. Replay: same timeline, no progress side effects, holds earned art.\n')
H.append('**Implementation separation (as requested)**\n\n1. *Static SVG geometry* — `svg/**`. Source of truth for the end state.\n2. *Animatable groups* — the ids above, listed with filled/dashed flags and stroke lengths in `docs/animation-manifest.json`.\n3. *Preview implementation* — `preview/index.html` (Web Animations API; preview only).\n4. *Platform-independent spec* — `docs/motion-spec.json` and `MOTION_SPEC.md`.\n\nSuggested RN approach: render the earned SVG with `react-native-svg`, wrap each layer/child in `AnimatedG`/animated props (Reanimated), drive `strokeDashoffset` from the manifest lengths for `draw` steps, and feed the JSON timeline to one shared sequencer so all 16 reveals share code.\n')
H.append('## 7. Preview instructions\n\nOpen `preview/index.html` in Chrome/Safari/Firefox (no server needed). Pick a milestone in the left list: **Play reveal**, **Earned**, **Locked**, **Play all 20**. Use the scrub bar to inspect any moment, the speed menu for slow motion, **Reduced motion** to see the crossfade, **Cream stage** to view on the gallery background. The timeline panel shows each step’s window. The “Gallery-size check” panel shows locked/earned at 96, 64 and 44 px.\n')
H.append('## 8. QA performed\n')
H.append('| Check | Result |\n|---|---|\n| All 40 SVGs parse as XML and render | pass (`xmllint`, Chromium) |\n| Raster/embedded images, filters, clipPath, CSS, SMIL, external fonts | none used in any SVG |\n| Art stays inside plate (no clipped strokes) | pass — max art radius %.1f ≤ 108 (limit 111) |\n| Earned vs locked distinguishable at 44/64/96 px | pass (visual review of tile rows) |\n| All 20 reveals played in Chromium; filmstrips reviewed | pass (`qa/strips`) |\n| Animation settles on the earned art | pass — held-end frame vs static earned frame: no pixel differs by >100/255 in the large majority, and at most 3 pixels do in the other three; remaining differences are edge anti-aliasing (≤ ~4%% of pixels differ at all) |\n| Console errors during playback | none |\n' % max(clip.values()))
H.append('Not verified: real react-native-svg rendering on a device, and real gallery tile dimensions (I used 44–96 px as a proxy for the 3-column tiles seen in the recording).\n')
H.append('## 9. Known rendering limitations\n\n- Locked files triple each shape for the emboss, so they are ~3× the element count of earned. If that is heavy in a 20-tile grid, rasterise locked tiles once or use a single stone pass with the plate shadow.\n- Radial/linear gradients and `fill-opacity` (used for the doorway tint) are supported by react-native-svg but should be checked on Android.\n- `pathLength` is used **only** by the preview (injected at runtime), never written into the masters; RN must use the measured lengths.\n- `transform-box`/`transform-origin` are CSS preview features; in RN pass explicit origins (centre 128,128 or per-element bbox centres).\n- The Strength `pulse` is an overlay circle, not in the SVG.\n- The gold specular dot on orbs is a plain white circle at ~55% opacity, not a filter.\n')
H.append('## 10. Decisions requiring your approval\n')
H.append('1. **Style bridge.** The plate (cream bevel, two fine gold rings) and navy ink of the whole set now match the screenshots of your existing masters, and the three existing medals are rebuilt as vectors in the same system. What I could not match is any paper grain or painterly shading present in the real files, because I only had screenshots. Send the original SVGs and I will diff them against these reconstructions and swap them in.\n2. **Provisional slugs → real IDs.** Send the milestone ID list (or the branch that has the 20-tile gallery) and I will rename.\n3. **Gold usage vs the Living Design System** (“gold is a reserved active-state signal and never fills large areas”): earned art uses gold only for orbs, nodes, small arcs and hairlines; the one exception is a 22% gold tint inside the two doorway emblems. Say if you want that removed. The Strength `pulse` ring is a thin 2.2-unit line, not a glow, but note the Living Spec’s “no glow/aura rings” rule and your existing Thread Strength glow exception.\n4. **Hourglass retained for 100 / 500 Minutes.** I kept the mockup’s hourglass because it reads instantly at tile size, but rebuilt it as engraved hatch glass with a minute scale (100) and a posted frame with an armillary ring (500). If you want to leave hourglass behind entirely, tell me.\n5. **Journey is a map, not mountains.** First Waypoint / Halfway / All Waypoints use one shared contour map and trail so progress reads across the three; Goal Reached (landscape with sun) stays the arrival moment. This follows the Chart’s etched-map direction.\n6. **Plate included in every SVG** (`__plate`). If the gallery tile already supplies the disc, drop that one group.\n7. **Mobbin reference:** your standing rule is Mobbin for app screens; these are medal assets rather than screens, so I did not run a Mobbin pass. Say if you want one for the gallery tile layout.\n')
open(os.path.join(ROOT,'ANCHOR_MILESTONE_SVG_DESIGN_HANDOFF.md'),'w').write('\n'.join(H))
print('docs ok')
