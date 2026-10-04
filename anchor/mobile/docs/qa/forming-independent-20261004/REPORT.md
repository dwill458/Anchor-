# Independent Forming verification — 2026-10-04

**PASS for the requested three acceptance checks, within the evidence scope below.** Final six-style equivalent raster execution passes continuous-motion checks; independently captured native Prism Flow and Alloy pass through the Applying-to-Choose handoff; selection copy has no longer-wait caveat, forming shows wait expectations; six actual generated Form I/Form II pairs are distinct at glance. No product changes were made by this verifier.

This is not an authenticated-device, release-build, physical-device performance, or universal generation-quality signoff. Native completion used the existing development QA host with fixture responses; actual artwork evidence used the real backend production generation service separately. No fixture artwork was counted as generated-artwork evidence.

## Per-style results

| Style | Final equivalent raster motion | Maximum static interval | Native Applying/handoff | Actual generated Form I/II |
|---|---|---:|---|---|
| Prism Flow | PASS | .05s | PASS: .60s max | PASS |
| Alloy | PASS | .05s | PASS: .50s max | PASS |
| Velvet Ember | PASS | .05s | Not individually captured | PASS |
| Porcelain | PASS | .05s | Not individually captured | PASS |
| Joybrush | PASS | .05s | Not individually captured | PASS |
| Graphic | PASS | .05s | Not individually captured | PASS |

At least five styles, including Prism Flow and Alloy, therefore have actual raster motion evidence and actual generated-pair evidence. The native subset additionally checks scheduling, captions, and the handoff that previously failed.

## Final source and raster motion

Final files are hashed in final-source-hashes.json (captured06:35:48 UTC): FormScene.ts fa48f588f46ed053b680c316c428ee42ff8f8db5954804c51807fc0e36e566d0; AnchorCreationFlowScreen.tsx c143192795f09843d1d22cf43132348fd9f1727c8f0a84308efd87de972102e2. Caption, style material, and picker files are also hashed there.

Reproduction:

    node anchor/mobile/docs/qa/forming-independent-20261004/harness.cjs new "I stay steady and trust my own direction" "prism-flow,alloy,velvet-ember,porcelain,joybrush,graphic" 0.05 anchor/mobile/docs/qa/forming-independent-20261004/final-raster 1

The harness imports the actual current production drawForm, styleStrokes, and buildSceneContext. RecordingPainter records production operations; SVG/libvips rasterizes polyline/circle operations. It is equivalent production-operation raster evidence, not a code-only signoff or independently invented animation. It is not native Skia scheduling. Deterministic text metrics replace native fonts; the260x260 hero crop excludes captions.

Each style has583 frames fromtf=.90–30.00s at20fps (3,498 PNGs total under final-raster/). reduceMotion=false, fade=1, progress=.5; slow=true from12s. final-raster/results_new.json contains timestamps, text operations, and frame deltas. Minimum adjacent-frame changed pixels: Prism482, Alloy480, Velvet482, Porcelain480, Joybrush484, Graphic482. Every sampled frame moves, including material arrival at3.15s and settled wait through30s.

A changed pixel differs by >10 RGB levels; a static run ends once >=25 pixels differ from its start frame. Max static interval.05s means there was no static sampled interval; it does not assert native50ms frame timing. Sparse contact-sheet.png was visually inspected, especially4.0/4.5/5.0/5.5/6.0 and12/20/30s. Dense frame metrics support continuity. Earlier second-intention execution (I am calm and focused) also passed at10fps, max.10s, on the earlier painter snapshot; final native captures use that second geometry.

## Independent native captures and copy

Verifier owned emulator-5554 during final captures; root avoided concurrent builds/device actions. Existing development QA deep link: anchor://creation-flow-qa?start=flow&text=I%20am%20calm%20and%20focused&category=desire&wait=12000. This host replaces only generation completion with local vision photographs after12s; the actual production canvas, animation clock, picker, caption, and sweep run natively.

- prism-final2.mp4,40s,540x1200: selected Prism confirmed in prism-selected-final.png. Applying visible from approximately video5s; fade/handoff finishes around16s. Hero-only380x300 crop(x80,y430),10fps resized329x260 over video5.0–16.0s: max static.60s from video14.5s. native-prism-final-hero/ and native-prism-final-metrics.txt contain evidence. prism-final2-sheet.png was reviewed through Choose.
- alloy-final.mp4,35s,540x1200: selected Alloy confirmed in alloy-selected-final.png. Applying visible from approximately video4s; fade/handoff finishes around15.5s. Same hero crop over video4.0–16.0s: max static.50s from video14.3s. native-alloy-final-hero/ and native-alloy-final-metrics.txt contain evidence. alloy-final-sheet.png was reviewed through Choose.

These hero crops exclude header, caption, FPS overlay, and progress, so changing text or counters cannot hide an unmoving anchor. Native frames can repeat at10fps; the longest repeats stay below approximately1s in both final captures. Smooth physical-device performance is unverified; emulator FPS overlay is often around20–27.

Selection screenshots prism-selected-final.png, alloy-selected-final.png, all-final.png, and alloy-all.png show no takes-a-little-longer warning. The forming caption retains Applying your style… and shows Forging your Prism Flow/Alloy — this one takes a moment. Final prism-caption-final-10s.png independently shows stronger15px medium text, with readable helper text fitting the width. Native caption crop execution (native-prism-caption/) shows restrained motion rather than a distracting bounce; source breath/rise is1.5px with92–100% opacity. Native typography was visually inspected; native accessibility/physical-device readability is not certified.

## Actual generated artwork

Actual-pairs-contact-sheet.png contains six real provider pairs. Source images and pair-generation.json: ../forming-pass-20261004/production-pairs/. The generation harness calls GeminiImageService.enhanceSigil with production IDs prism_flow_v2, alloy_v2, porcelain_v2, graphic_v2, velvet_ember_v2, joybrush_v2 and two variations. Provider: gemini-3.1-flash-image-preview. Intention: I build a life of steady courage. These are fresh real provider outputs, not fixture photos, cached legacy pairs, parameter names, or prompt text.

| Style | At-glance observation |
|---|---|
| Prism Flow | Saturated dark red/violet angular prism field versus pale blue/lilac circular refractive field |
| Alloy | Dark incised geometry on warm brushed metal versus pale metal geometry on deep blue brushed field |
| Porcelain | Cream geometry on red glaze versus dark blue geometry on ivory glaze |
| Graphic | Cream geometry on dark angular colored field versus plum geometry with circle/node accents on pale graphic shapes |
| Velvet Ember | Cream geometry on dark burgundy velvet versus dark geometry on light rose velvet |
| Joybrush | Dark geometry on pale field with multicolor diagonal brushwork versus cream geometry on navy field with coral top brush sweep |

All six were independently visually inspected and pass distinction for these actual generated samples. This does not guarantee every future random generation or mobile auth/network delivery/cached pool result.

## Earlier failure and correction

The earlier ../forming-verify/alloy-native-20261004.mp4 had a1.60s hero freeze at video15.6s while Applying remained visible and header changed to Choose. Encoded frames continued, so this was not only a missing video packet. Screenshots alloy-15.6s.png/alloy-17.1s.png document it. Source sweep passed unchanged formTfRef.current; root corrected sweep to advance the clock. Final independent native recordings above no longer reproduce the over1s freeze. The earlier failure is retained as history, not averaged away.

prism-final.mp4 was identified as Plush by its actual caption and excluded from Prism evidence; prism-final2.mp4 is the corrected Prism recording. Earlier supplied prism-native-20261004.mp4 showed distilling/mapping and was excluded. Partial diagnostic native-alloy/ crop did not cover the full hero and is excluded. REPORT-history.md preserves interim findings.

Final disposition: the requested sampled checks PASS, using equivalent raster for six styles, native timing/copy for Prism and Alloy, and actual service-generated artwork for six styles. Native fixture photographs are not counted as real artwork. No authenticated mobile delivery, Android/iOS physical-device acceptance, release performance, reduced-motion animation, all possible geometries, or waits beyond30s are asserted.
