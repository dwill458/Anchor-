# Independent Practice artwork review — 2026-10-05

Verdict: **9.64/10; the artwork review gate passes.** No required artwork corrections identified. This is an independent review of the bundled originals and the source-defined crops, not a claim of completed on-device verification.

Reviewed against `E:\downloads\Anchor_Practice_Illustrations_ArtDirection.md`, with the user's subsequent explicit instruction to remove the extra white hero gradient taking precedence over the brief's bottom-fade direction. Reviewer did not generate the assets or edit product code. Each original was inspected with `view_image`. The source review covers `V2PracticeArtwork.tsx`, `V2PracticeGrid.tsx`, and the actual hero component, `V2TodayPracticeCard.tsx`; no `V2PracticeHeroCard.tsx` exists at the supplied location. Follow-up source review confirms the final artwork component contains only the cover image, with no hero gradient import, overlay, or fade style. The user-authorized removal incurs no score deduction.

## Equal-weight rubric

| Criterion | Score / 10 | Evidence and deductions |
| --- | ---: | --- |
| Distinctness | 10.0 | Focus is horizontal still water and one ripple; Deep Focus is an enclosed downward canyon; Visualize is an outward rectangular threshold; Release is an isolated ascending ember. No pair reads as the same scene. |
| Set and palette coherence | 9.5 | Shared deep navy shadows, amber illumination, natural materials, and restrained realism. Deep Focus is darkest and Visualize is warmest as requested. Visualize's broad warm sky is a stronger color field than the other three; this is consistent with its brief but slightly reduces uniformity. |
| One-idea restraint | 9.5 | Each image can be described in one sentence. No people, lettering, badges, ornate arches, castles, or competing symbols. Canyon rock texture and Visualize's layered hills provide more detail than Focus/Release, although the single directional gesture remains clear. |
| Crop and chip safe zones | 9.5 | Central gestures survive the inspected cover crops; hero badges occupy top corners, titles remain in the cream body, and Release has dark edge scrims. Deduction reserves confidence for native capture and the tight strip crop that shortens Release's smoke tail. |
| Release fire/release reading | 9.7 | A glowing charred ember, thin trailing smoke, and a few sparks clearly communicate fire and ascent, with no sunset horizon or bonfire. At strip size the small ember remains legible; its rising motion is implied by the surviving smoke rather than demonstrated through animation. |

Mean: `(10.0 + 9.5 + 9.5 + 9.5 + 9.7) / 5 = 9.64`.

## Crop and layout evidence

All art uses a centered `resizeMode="cover"` image. The hero is 190 dp tall, library artwork is 95 dp tall, and the slim row is 82 dp tall. Grid cards use `floor((windowWidth - 48 - 12) / 2)`. For representative 320–430 dp phone widths, grid artwork widths are 130–185 dp; the four central gestures remain within the corresponding crops. Exact native layout is not inferred from a screenshot.

For a representative 390 dp window with a 342 dp content width:

- Focus at 165 × 95 dp crops approximately source y=70–954 of 1024. The ripple is around y=500–615, centered well inside the crop. Its horizontal span also survives the narrow-phone horizontal crop.
- Deep Focus at 342 × 190 dp crops approximately source y=55–936 of 992. The distant light around y=600 appears around 118 dp down the hero, beneath the badges. The close walls establish descent even after the crop.
- Visualize at 165 × 95 dp retains the center horizon, dark foreground, and plain opening. Its frame is peripheral rather than the key gesture, so modest clipping does not erase the outward view.
- Release at 342 × 82 dp crops approximately source y=102–622 of 724 before its 1.08 scale. The ember is around source y=240–335 and stays near the strip's central upper third. Some lower smoke is trimmed, but enough remains to establish ascent. The left title group is 96 dp wide plus inset; the centered ember occupies the gap before the right descriptor. The scrim's zero-opacity center spans 40–62% of the row and preserves the fire read.

The final hero has no white gradient; its image runs to the boundary with the separate `#F4EFE6` body, as explicitly requested by the user. Removing the overlay changes neither crop geometry nor badge/title placement and leaves the lower artwork unobscured. Hero badges begin at 12 dp from the top and sides; their occupied corners avoid all central gestures. Library PRO badges occupy the top-right corner. The art itself contains no text. This source inspection supports safe-zone compliance but does not prove font scaling, platform compositing, or every possible tablet crop.

## Asset identity

| Bundled JPEG | Pixels | SHA-256 |
| --- | --- | --- |
| practice-focus.jpg | 1536 × 1024 | 2545A53358915C3D231FC3ADFE1FA4541091BE0BB615B281C67B62F9EA729A2A |
| practice-deepfocus.jpg | 1586 × 992 | 689A6749E25FA33C2061C51F3E081DEE1E6C3A527BB3207AB0C50B41D9663850 |
| practice-visualize.jpg | 1536 × 1024 | 24A9D00B34D6BA9D2A6BA89346AF92D5EC07F9DF9E0C27B587CCDD020D2655F1 |
| practice-release.jpg | 2172 × 724 | E75B0522317A627ACC0DD2CAC0BE5496608D66B4CC905C75CE0B6413ABCF2D04 |

These dimensions exceed twice the inspected phone display sizes and leave cover-crop margins. Slow zoom/drift robustness was assessed compositionally; no runtime animation or frame-pacing verification was performed.

## Verification limits and follow-up

The attached phone was not touched because the user is actively using it. No final on-device Practice screenshot was available to this reviewer. `android-practice-before.png` is a before image and provides no evidence of the final assets or crops. The parent reports 68 passing tests and a passing Android export containing the four new JPEGs; this reviewer did not rerun those checks, and they do not replace device verification.

The brief's on-device gate remains outstanding: capture the final screen when the phone is available, confirm chip/title placement, central ember visibility and fire read, and distinguish all four cards at a glance. No score has been assigned to native-device acceptance or 60fps performance. If that capture reveals a crop problem, adjust only the affected crop and review again; no speculative art regeneration is required from the evidence inspected here.
