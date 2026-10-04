# Vision Detail independent review — round 2

**Score: 9.30 / 10. The required 9.5 threshold is not met.**

Reviewed current source and `final-top.png`, the updated `final-bottom.png`, `long-caption-final.png`, `expanded.png`, `six-photos.png`, `hold-actions.png`, `add-sheet.png`, plus their supplied UI XML. The updated bottom capture shows the production component rather than the Expo menu and confirms the current CTA/disclosure/Chart assessment. Reference remains the leftmost Detail screen in `1-162897.jpg`. This score is an independent reassessment, not an attempt to reach the requested threshold. No product files were changed.

| Dimension | Award / maximum | Evidence, deduction and fix |
|---|---:|---|
| Collage overlap, variety, edges | 1.75 / 2.00 | The narrower inclined left photograph, broader right aperture and central coin now establish the intended asymmetry. Detail supports four through six real photos. The remaining edge treatment still resolves into visible small zigzags along the lower photographs and several clean parallel strokes along the hero; the reference has finer broken, frayed brush detail and less uniform edge depth. **Deduct 0.25:** vary contour depth and frequency more strongly, interrupt the hero strokes into shorter irregular fragments, and add finer fibre marks along the lower edges. Keep this Detail-only and compare the result at matched content width. Preserve all real images. |
| Coin integration | 1.00 / 1.00 | Placement, seam overlap, actual Anchor art, paper rim and shadow remain convincing. No deduction for the person's selected colors. Keep the existing coin texture. |
| Script caption | 0.85 / 1.00 | The script is compact and the 80-character caption now grows the board enough to display every word. However, `final-top.png` wraps the reference fixture as “Freedom Through” / “Creation”; the reference uses three compact lines, “Freedom” / “Through” / “Creation”. This changes the handwritten block's shape and its relationship to Add image. **Deduct 0.15:** tune caption width with the font size so this fixture naturally wraps into three lines, while preserving actual text and measured height for long captions. Do not inject hardcoded line breaks into production content. |
| Existing Chart miniature | 1.50 / 1.50 | Existing map artwork, real category and actual waypoint remain intact. No deduction. |
| Truncation and Read more | 1.00 / 1.00 | Underlined lightweight disclosure and tighter spacing match the reference's treatment. `expanded.png` shows the complete description and Read less, confirmed by XML. The indivisible-token behavior preserves whole words and no longer adds a false ellipsis; this respects the explicit never-midword requirement. No deduction. |
| 60 fps motion | 0.70 / 1.00 | Hold actions and the actual add sheet are now evidenced in still captures/XML, and source uses UI-thread motion. The best supplied scoped sample remains the earlier S24 Ultra development run: 454 frames, p50 9 ms, p90 11 ms, p95 13 ms, p99 28 ms, 10 deadline misses (2.2%). **Deduct 0.30:** sustained midrange 60 fps remains unverified, the scoped sample contains missed deadlines, and later runs are contaminated by development UI/reloads. Capture a clean repeated scroll/focus/hold/drag/sheet run with segment timings, then obtain the required midrange run when hardware is available. Only address slow frames whose cause is measured. |
| Overall feel | 1.50 / 1.50 | Removal of the extra rule, navy CTA, pale eye, serif label and chevron, lighter disclosure, tighter lower spacing and preserved Chart artwork resolve the round-1 overall-feel differences. The remaining localized differences are scored above rather than deducted twice. No additional deduction. |
| **Total** | **9.30 / 10.00** | **0.40 visual deductions plus 0.30 motion/evidence deduction.** |

## Resolved round-1 findings

- Detail layouts now contain every supported scene count; six-photo capture/XML exposes image labels 1 through 6. The Detail fix does not replace the established Visualize preset selector.
- Caption height is measured and the viewport grows. The long-caption capture displays the complete sentence through “together.”
- Whole-token handling preserves indivisible words, with tests for a long first token and entirely unbroken text. The round-1 suggestion of a hard character fallback is withdrawn because it conflicts with the explicit never-midword requirement.
- Stationary hold now reveals Replace, Regenerate and Remove, supported by capture/XML and simultaneous pan/hold source. The add sheet exposes Create an image, Choose from Photos and Take Photo.
- Complete description and Read less are visibly supported. Source still obtains caption from the persisted Vision and Chart summary from the real Chart adapter.

## Current code concern

**Required verification / fix if reproducible — Begin can read a stale window position during scrolling.** `V2SavedVision` now measures the canvas only at layout, scroll-end-drag and momentum-end. Its Begin handler reads `canvasBounds.current` without measuring again; `canvasCapture.current()` synchronously obtains the current UI-thread board projection, but that does not refresh the canvas's window origin. A tap that stops momentum before its end callback refreshes the measurement, or another layout change before measurement completes, can give the protected handoff an outdated origin. Verify tapping Begin while momentum is still moving. If stale, measure the canvas in the Begin action and use the freshly returned window origin with the current projection, or track the scroll offset on the UI thread; preserve the existing synchronous/transition contract and avoid restoring per-frame JS measurements. The supplied still captures do not close this case, and no runtime failure is claimed here.

## Motion evidence boundaries

`gfx-final.txt` reports 806 rendered frames, p95 14 ms, p99 24 ms and 38 deadline misses (4.71%), but the run includes the Expo development menu. It is excluded as a pure-product sample. `motion-round2.mp4`/`gfx-round2` may include reloads and are also unsuitable for a clean sustained-motion conclusion. This reviewer did not independently replay and segment the videos; contamination was reported by the implementer. No flagship development-build result proves sustained 60 fps on midrange Android.

The implementer reports 81 focused tests passing; this reviewer inspected relevant caption/token source and test cases, but did not rerun the suite. Still captures demonstrate visible controls and text, not server persistence, full replace/remove/regenerate completion, drag-order persistence, reduced-motion behavior, or the complete protected Visualize transition. Hardware acceptance remains separate from the weighted still-image comparison.

Next round should include the refined edge/caption captures, a current-source Begin-during-momentum check, and clean motion evidence. Do not inflate the score to close the threshold.
