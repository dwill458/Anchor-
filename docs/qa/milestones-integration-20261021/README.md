# Milestone SVG integration QA — 2026-10-21

Executed `node scripts/qa-approved-milestone-renderer.cjs` against the current `ApprovedMilestoneSvg` React renderer and the approved package in `design/milestones/approved-20261021`.

- 20 milestone IDs, both states: all 40 source SHA-256 values match the imported assets.
- 240 browser raster comparisons: every earned/locked asset at 64, 96 and 256 pixels on cream `#F5F1E8` and navy `#101D28`.
- All 240 comparisons are pixel-identical: zero differing channels and zero maximum channel delta.
- No nontransparent pixels touch any outer canvas border at the tested scales, providing raster evidence against clipping at the viewBox boundary.
- Two rendered instances of Full Strength contain 114 unique IDs, zero duplicate IDs, and zero unresolved gradient/clip references.
- Visually inspected both saved sheets. All 20 milestones appear. Strength's five central structures remain distinguishable; locked treatment is intentionally subdued, particularly at 64 pixels on cream, and matches the package exactly.

`collection-react-primitives-96.png` shows all 20 milestones earned and locked on both backgrounds. `strength-react-primitives-scales.png` shows all five Strength milestones at all three sizes in both states and backgrounds. `static-renderer-parity.json` records every comparison and source hash.

The QA script executes the actual React renderer, substituting the `react-native-svg` component boundary with equivalent browser SVG tags for serialization. This verifies authored attributes, geometry, palettes, namespaces, and browser pixels. It does **not** establish native `react-native-svg` pixel parity, actual device timing, GPU/frame pacing, memory, or touch/navigation behavior.

The scene's finite reveal uses the same imported geometry, then replaces it with `MilestoneArtwork`'s static earned renderer when the full manifest timeline (including the last staggered child) has elapsed. Automated scene tests cover that static handoff for all four families and the reduced-motion locked-to-earned transition. Native animation remains unverified.

`adb devices -l` returned an empty device list; see `adb-devices.txt`. No device/emulator interaction, installation, deployment, or owner-data change was performed.

The approved ZIP supplies ivory/gold Strength artwork. This QA preserves that exact appearance and does not certify the earlier proposed navy/magenta redesign. Package provenance also remains unchanged: First Practice, Goal Reached and First Glimpse are screenshot reconstructions, while Full Strength is a new vector candidate whose authentic earlier master was unavailable. These are not authenticated original masters.
