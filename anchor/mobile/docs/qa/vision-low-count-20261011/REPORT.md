# Vision preview composition — October 11, 2026

The shared Home and Anchor Details preview now selects a deterministic hero, pair, or adaptive collage preset by the number of renderable photographs. The preview uses real source dimensions reported by the native image loader and measured card width.

## Implementation

- One image: a centered Polaroid with a −0.8° rotation, existing subtle shadow, and an aspect-aware canvas. The print targets 90% of the image stage, occupying approximately 75–85% of the complete card height at typical phone widths after the footer is reserved. Portrait canvases can grow to 1.12 times card width on Home and 1.06 on Details. Landscape canvases become shorter. Width constraints limit extremely narrow or wide sources.
- Two images: opposing −2°/+2.4° rotations, an offset composition, and 10% overlap along an edge. Wide pairs stack diagonally; portrait, square, and mixed pairs use offset shoulders. Aspect-aware widths keep the supporting print at 81% of the primary print's area before frame insets. Overlap avoids the primary image center; no subject detection or focal metadata is assumed.
- Three or more images: the existing adaptive packing and six-photo composition remain intact. Every renderable photograph is represented individually, including images beyond the former 24-print marker limit.
- Count labels, captions, featured-image order, signed-URL recovery, loading/error fallback, reduced motion, press feedback, and View Vision navigation remain covered by the existing component and screen suites.

Files changed for this request:

1. `src/components/v2/vision/visionEditorialLayout.ts`
2. `src/components/v2/vision/VisionEditorialPreview.tsx`
3. `src/components/v2/vision/__tests__/visionEditorialLayout.test.ts`
4. `src/components/v2/vision/__tests__/VisionEditorialPreview.test.tsx`
5. `src/screens/v2/system/VisionVisualQADevHost.tsx`

The development-only QA host now accepts explicit portrait/square cases and ten-image fixtures. Existing assets provide 720×900 portraits, 1920×1280 landscapes, a 1600×893 landscape, and 720×720 square images. No account content is modified by these fixtures.

## Device comparison

Captured 17 matching pairs of 1440×3120 screenshots on the connected Samsung S24 Ultra using the current development bundle. The first pass was discarded and recaptured after a bundle reload confirmed the new fixture images were active.

| Coverage | Result |
| --- | --- |
| One portrait, landscape, square — Home and Details | Large centered prints; full source aspect preserved; reduced unused canvas for landscapes |
| Two portrait, landscape, square — Home and Details | Both prints visible and prominent; asymmetric placement; restrained edge overlap |
| Mixed portrait/landscape pair — Home and Details | Landscape area increased during visual correction; both prints remain legible |
| Six mixed photographs — Home and Details | No visible regression; comparison regions are pixel-identical |
| Ten photographs — Home | All ten represented; comparison region is pixel-identical |

The unchanged collage comparisons use a fixed native screenshot region `(85, 320, 1270, 1450)`, excluding the clock. Each region contains 7,366,000 channels; zero channels changed for Home six, Details six, and Home ten.

Before/after contact sheets:

- [Home](home-comparison.jpg)
- [Details](details-comparison.jpg)
- [Mixed pairs](mixed-pair-comparison.jpg)
- [Six and ten image collages](collage-comparison.jpg)

All full-resolution `before-*.png` and `after-*.png` captures remain alongside this report. Run `node docs/qa/vision-low-count-20261011/compare-screenshots.cjs` from the mobile directory to rebuild the contact sheets.

## Checks

- Six focused Jest suites: **138 tests passed** after the final composition correction. Suites cover the composition engine, preview renderer, board-preview wrapper, Home Vision section, Home screen, and Anchor Details screen.
- New geometry assertions cover portrait/square/landscape sources, mixed orientations in both orders, multiple card widths, centering, preserved aspects, safe rotated bounds, opposing rotations, 8–12% overlap, prominent relative areas, and clear primary-image centers.
- `git diff --check` passed for the five changed source/test files.
- Global TypeScript reports one unrelated error in `src/components/v2/vision/board/__tests__/VisionPhotoCaptionEditor.test.tsx:56` (mock handler parameter type). No diagnostics reference this task's changed files.

## Coverage limits

The device matrix exercises production Home/Details preview components with explicit sample inputs. It is not a full authenticated navigation matrix for every saved user image. Existing Home/Details interaction tests pass. iOS rendering and frame pacing were not assessed. Images lack reliable focal metadata, so edge subjects cannot be protected automatically from every overlap; the pair presets preserve complete source proportions and keep the overlap away from the primary image center.
