# Codex prompt: route and destination reach the real summit

Active code is anchor/mobile/src/. Do not touch anchor-v2/.

## Why
Deon, looking at the Chart intro and the Chart map: "the line doesn't go all the way to the summit." He is right. The destination X sits partway up the big peak on the right, well below its apex.

Measured from the land art (map space is 852 x 1180, MAP_W / MAP_H in map/chartMapContracts.ts):
- Apex of the tall right-hand peak: about (741, 80).
- Current route end (last of ROUTE_PTS in map/chartMapGeometry.ts): (660, 370).
That is roughly 290 map units below the apex, about 130px on a 390-wide screen.

The code has a note explaining why it ended there: `// DEFERRED: [629, 380], [713, 292], [734, 190] placed the summit in the header zone.` So the summit was pulled down on purpose, to keep it out from under the header. The real fix is to keep the true summit visible, not to leave the route short.

## What to build
1. **Extend the route to the apex.** Keep every existing vertex of ROUTE_PTS exactly as it is, so the existing geometry (and its arc lengths up to the old end) does not change, and append vertices that climb the peak. Starting values, taken from the art and converted to map space (check them by drawing the route over the land and moving them until the line follows the visible ridge and snow line, not floating in air or crossing the sky):
   - (705, 285), (720, 248), (731, 172), (741, 112)
   The final point is the destination X. Put it a few map units below the very tip (about y 100–115), not on the tip, so the marker and the anchor glyph at arrival do not collide with the outline.
2. **Keep the summit visible in every place it can appear.** This is the part that was deferred before, so check each:
   - Intro screen (ChartIntroOpening): the static map is drawn at full width; confirm the X and the glyph slot clear the header and the paper zone.
   - Creation plan and reveal steps, and the creation to Chart handoff (exploreDelta, chartMapScreenTop in ChartCreationFlow.tsx; ChartRevealHandoff.tsx). The map must not shift or jump at handoff.
   - Active Chart: OVERVIEW_CAMERA ({ cx: 426, cy: 590, s: 1 }), the open sequence's start camera, the full-bleed camera from phase 3, the reach and summit sequences. Each framing must contain the new summit with at least 56dp clear of the header on a 360dp-wide device and on a tall device with a large top inset.
   - If the map must shift down to clear the header, change the map's top offset in one place (CHART_MAP_TOP, ChartWeatherHold.tsx) and state what moved.
   - Summit art circle (`summitArt` in ChartMap.tsx) and the summit flag slot (`summitFlagIndex`): confirm the circle and the pennant fit inside the screen and do not overlap the header or the sheet at its peek detent.
3. **Regenerate everything derived from ROUTE_PTS.**
   - The fog field is precomputed (map/chartFogFieldData.ts). Its cache key is `fog-v1|${JSON.stringify(ROUTE_PTS)}|...` (chartMapGeometry.ts, about line 337). Find the generator for FOG_FIELD_DATA, run it, commit the new data, bump the version in the key, and make sure a stale cache is not reused.
   - Route table, waypoint placement, flag table, weather cover, and any snapshot or test that hard-codes ROUTE_PTS values or arc lengths. Update them intentionally and list each one in the report.
   - Sounds and haptics tied to arc position (ink, flag) should still land on the right vertices.

## Existing charts: what moves
Progress is stored as a per-waypoint fraction (HighWaterMap in chartMapContracts.ts, `routeRevealArc` in map/chartProgress.ts), and waypoint positions are fractions of the route total. Making the route longer means:
- Every waypoint flag slides up the route a little on existing charts.
- For the same progress, the drawn ink ends a little further up the mountain than before. It must never end lower than before.
- Check that claim with a test: for a set of saved states (fresh chart, mid-chart, one waypoint left, finished), compute the revealed end point before and after. After must be on or beyond the old point along the route, never behind it. If any case retreats, stop and tell me; do not ship.
The finished state (`isFinished` returns table.total) now ends at the apex, which is the point of this change.

Do not add a migration or version flag unless a test above fails. Tell me what you found.

## Do not change
- Pro-gate work in V2ChartScreen.tsx (creationLocked, openPaywall, onPremiumRequired). Preserve exactly.
- Route honesty: creation draws the plan as a dotted survey route; solid ink only for real progress. High-water rule: the drawn route never retreats.
- The 10 pre-existing ChartPreview snapshot failures and the 5 unrelated Vision photo-picker failures. Report counts before and after.
- The chart opening fix pass (docs/chart/CHART_OPENING_FIX_PASS_1.md) is a separate task. If both are in flight, land them in separate commits.

## Tests
- ROUTE_PTS prefix unchanged: the first 7 vertices equal the old ones.
- Route table total and summit equal the new geometry; `posAt(table, table.total)` is the new X.
- Retreat test above (four states, before and after).
- Summit clearance: for each camera framing, the summit point projects at least 56dp below the header on 360x640 and 412x915 (with a 48dp top inset).
- Fog field key changes with the new points; stale cache is not used.
- Intro, reveal handoff and active Chart alignment tests still pass, with updated numbers where they are geometry.

## Acceptance
- The dotted route in the intro and the creation plan climbs to the apex of the right-hand peak and the X sits just under the tip.
- On a finished chart, the anchor art circle sits at the summit, fully on screen, clear of the header.
- No jump at the creation to Chart handoff, in a 0.25x recording.
- Existing charts: ink never moves backward.
- Report: final ROUTE_PTS, what moved in the camera framings, the regenerated fog data, snapshots changed, test counts before and after. The S24 Ultra release-build check is still owed.
