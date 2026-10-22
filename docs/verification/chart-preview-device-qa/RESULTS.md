# ChartPreview QA — 2026-10-01

// DEFERRED: This pre-663ce64e cinematic-map implementation is superseded. The
// corrected etched-map preview and native screenshots live in
// E:/Projects/anchor-chart-map/docs/verification/chart-preview-etched/RESULTS.md.

## Current artwork and category selection

The preview now reuses ChartJourneyWorld and its five current cinematic world layers.
The retired engraved valley renderer is no longer imported by ChartMapCrop.
The single useChartPreview selection carries category from the real Anchor response.
Hero, card and row use getCategoryColor(category); the artwork retains its original colors,
while the active node, active-region ring, active dotted route and progress bar use the category accent.
No hardcoded category colors were added.

ChartMapCrop centers its camera on the active waypoint using chartJourneyGeometry.
Card remains 16:9, with waypoint copy in a separate flowing block below the crop.
The hero uses the same renderer in a taller viewport. Row has no artwork.
The camera changes with the waypoint, rather than displaying a static scene.
Native review exposed stale worklet positioning after changing staticProgress.
Keying the static scene by waypoint position and viewport dimensions keeps the native
camera and dotted SVG route aligned. The renderer itself remains unchanged.
Route segments leave clearance around the numbered nodes.

## Automated checks

92 tests across four focused suites pass, with 15 state/variant snapshots.
Coverage includes all 12 category colors across all three variants, all five states,
all five waypoint crops at narrow/wide widths, loading versus confirmed empty,
press delegation and the locked progress rule including regression and invalid targets.
Focused TypeScript ESLint checks pass.
TypeScript baseline comparison found 11 existing errors and 11 with the new files,
with no introduced diagnostics. Repository-wide typecheck is not green.
See chart-preview-tests.txt.

## Clean Home render-budget baseline

Stashed tracked and untracked work with git stash push -u and verified a clean
checkout of pre-pass commit aace8065 before running:

    npx jest src/screens/v2/home/__tests__/homeRenderBudget.test.tsx --runInBand --no-cache

It failed with the same extra Vision: 1 render when only Today: 1 was expected.
This failure predates ChartPreview. See clean-home-render-budget.txt.
The stash was restored and all 820 inventoried files matched their original hashes.

## Native Android emulator review

Used the installed native development app on the Vision_QA Android emulator,
served by local Metro. Reviewed desire and health category accents, card crops
for waypoints 1–5, row tap delegation and the regressed hero.

- Card labels remain below the map; the active node does not overlap the label.
- Current artwork and the active road region are visible; the crop advances with the waypoint.
- The dotted route follows the road after the static camera reset.
- Waypoint numbers remain unobscured by the route overlay.
- 54 / 1,000 renders a small positive 5.4% bar; hero displays started at 84.
- Tapping the row incremented the QA counter to 1.

Current screenshots: new-map-health-waypoint-1-row-tapped.png,
new-map-category-waypoint-2.png, new-map-health-waypoint-3.png through -5.png,
and new-map-hero-regressed.png.
Older emulator-* screenshots used the retired valley and are superseded.
new-map-desire-waypoint-1.png predates the node-clearance correction and is historical.

## Physical phone and checkout preservation

Only emulator-5554 is connected; physical-phone tap feel remains unverified.
No OTA or production deployment occurred. No existing screen was modified by this pass.
The three pre-existing Home-related edits remain preserved.

Temporary App registration and category-switching QA host exist only on local branch
codex/chart-preview-device-qa, latest commit 9a81ebe7. The original branch is active
again and App.tsx is restored. New shared component/hook/tests remain uncommitted there.

## New shared files

- src/components/chart/ChartPreview.tsx
- src/components/chart/ChartMapCrop.tsx
- src/components/chart/ChartProgressBar.tsx
- src/hooks/useChartPreview.ts
- src/components/chart/__fixtures__/chartPreviewStates.ts
- src/components/chart/__tests__/ChartPreview.test.tsx
- src/components/chart/__tests__/__snapshots__/ChartPreview.test.tsx.snap
- src/hooks/__tests__/useChartPreview.test.tsx
- src/screens/dev/ChartPreviewDevScreen.tsx
- src/screens/dev/__tests__/ChartPreviewDevScreen.test.tsx

Assumptions: labels are one-based, missing metrics display an em dash, unresolved data
returns null, and category is carried through the selection to honor category colors.
The preview contract does not include individual waypoint states, so earlier nodes are
not inferred complete solely from their index; all nodes show complete when the Chart does.
