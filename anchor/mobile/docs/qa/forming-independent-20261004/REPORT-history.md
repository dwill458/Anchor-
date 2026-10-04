# Independent Forming verification — 2026-10-04

Status: **NO FINAL SIGNOFF**. Five styles pass equivalent production-operation raster motion verification. Actual generated Form I/Form II artwork remains unverified. The supplied native recording initially did not contain Applying, so it cannot certify native wait motion.

Verifier had no involvement in the implementation and made no product changes. Evidence was produced from the current dirty working tree, not inferred from old QA signoffs. Source SHA256 hashes are recorded in source-hashes.json; FormScene SHA256 is 4e83b42105f8dd7f4225bbd54b96ebcb894dbd44b4990d98565e51f005c012bc.

## Motion evidence

The harness loads the actual current production drawForm, styleStrokes, and buildSceneContext TypeScript. RecordingPainter records production operations; SVG converts polyline/circle operations to raster pixels with sharp/libvips. This is actual raster execution of production drawing operations, not code inspection or a replacement animation. It is **not native Skia scheduling**. Deterministic text metrics replace native font measurement; the 260x260 hero crop excludes captions.

Run A intention: I stay steady and trust my own direction. Each style: 583 frames from tf=0.90 to 30.00 seconds, 20fps, reduceMotion=false, fade=1, progress=.5; slow=true after12s. 2,915 PNG frames are under raster/. Run B intention: I am calm and focused. Each style:292 frames from tf=.9–30.0, 10fps, raw rasters analyzed without saving PNGs. Metrics are in raster/results_new.json and raster-second-intention/results_new.json.

A pixel counts as changed when any RGB channel differs by >10 levels. A static interval ends when >=25 pixels differ from its first frame. This detects motion inside the hero crop; it does not use changing progress text, timers, header, FPS overlay, or spinner pixels. Every adjacent sampled frame changes hundreds of pixels, including the redraw/material handoff at3.15s and settled wait through30s. Longest-static values are bounded by the sample interval; they mean there was no static sampled interval, not that the runtime frame period is necessarily50ms.

| Style | Raster motion | Run A minimum changed pixels / adjacent frame | Run A maximum static interval | Run B maximum static interval | Actual generated Form I/II |
|---|---|---:|---:|---:|---|
| Prism Flow | PASS equivalent raster |482|.05s|.10s|UNVERIFIED|
| Alloy | PASS equivalent raster |480|.05s|.10s|UNVERIFIED|
| Velvet Ember | PASS equivalent raster |482|.05s|.10s|UNVERIFIED|
| Porcelain | PASS equivalent raster |480|.05s|.10s|UNVERIFIED|
| Joybrush | PASS equivalent raster |484|.05s|.10s|UNVERIFIED|

The contact-sheet.png was independently visually inspected: travelling white tips and colored halo segments move at4.0,4.5,5.0,5.5,6.0s; sampled12,20,30s wait frames remain lit with different travelling-tip positions. Full dense frames and pixel data, rather than that sparse sheet alone, support continuity.

## Copy evidence

Current StyleScene and AllStylesSheet contain no takes-a-little-longer selection warning. StyleScene renders Choose a style, style names, All, and Form it. Accessibility hint is Recommended only for default. This is source evidence, not a current picker screenshot signoff.

Production drawForm text operations preserve Applying your style… fromtf=.95 throughout30s in all five styles. Prism, Alloy, Porcelain, and Joybrush with longerWait=true also emit Forging your [style] — this one takes a moment. Default Velvet Ember emits Still working on your anchor… at12s and later while retaining Applying your style…. Alloy has its own longerWait override even if recommended (source evidence; main raster run exercises nondefault Alloy). Display names in this harness are IDs to exercise the text branch, so it does not certify native typography or string fit.

## Native evidence limitation

Supplied source: ../forming-verify/prism-native-20261004.mp4. ffprobe reports1080x2400, duration10.556s, average frame rate9360000/950041 (~9.85fps). Extracted at10fps under native-prism/. Frame0001 (0.0s) shows DISTILLING YOUR INTENTION; frame0095 (~9.4s) shows MAPPING YOUR INTENTION. Therefore that recording cannot certify the current Applying wait. It was not counted toward motion acceptance.

## Outstanding acceptance

1. Review actual generated Form I and Form II pairs for each of five checked styles. Prompt instructions, alternative parameter labels, raster stand-in materials, and old cached pairs do not prove actual artwork distinction.
2. Native Applying wait recording/caption screenshots, including style-picker copy; native performance has no signoff from this raster harness.
3. Reduced-motion mode intentionally disables travelling motion and is outside the continuous-motion check. This verification does not assert native frame smoothness, physical-device acceptance, every intention geometry, or waits beyond30s.

Final signoff is withheld until all requested acceptance criteria have evidence. An unverified criterion is neither an observed pass nor an observed product failure.

## Follow-up evidence — 06:29 UTC

The actual production generation pairs are now independently reviewed. actual-pairs-contact-sheet.png contains Prism Flow, Alloy, Porcelain, Graphic, Velvet Ember. Source artifacts are ../forming-pass-20261004/production-pairs/*-form-[1,2].png and pair-generation.json. Generation harness explicitly calls GeminiImageService.enhanceSigil with production generationStyle IDs prism_flow_v2, alloy_v2, porcelain_v2, graphic_v2, velvet_ember_v2; the two variations are real provider outputs (gemini-3.1-flash-image-preview). They are not fixture images or prompt-only evidence. Canonical intention: I build a life of steady courage. This direct service run verifies actual new generation, not mobile auth/network delivery or cached pools.

| Style | Actual Form I/Form II at-glance distinction | Independent observation |
|---|---|---|
| Prism Flow | PASS | Form I saturated dark red/violet angular prism field; Form II pale blue/lilac circular refractive field |
| Alloy | PASS | Dark incised geometry on brushed warm metal versus pale metal geometry on deep blue brushed field |
| Porcelain | PASS | Cream geometry on red glaze versus dark blue geometry on ivory glaze |
| Graphic | PASS | Cream geometry on dark angular colored field versus plum geometry and circle/node accents on pale graphic shapes |
| Velvet Ember | PASS | Cream geometry on dark burgundy velvet versus dark geometry on light rose velvet |

Graphic additionally ran production raster at20fps tf.9–30s (raster-graphic/results_new.json); minimum adjacent-frame delta482 pixels, maximum static interval.05s. Thus five styles now have both equivalent raster motion passes and actual generated artwork passes: Prism Flow, Alloy, Porcelain, Graphic, Velvet Ember. Joybrush is supplementary motion evidence.

Native picker screenshots ../forming-verify/style-current.png and early frames of ../forming-verify/alloy_form.mp4 were visually inspected: All styles and selected Alloy have no takes-a-little-longer warning. Native screenshot alloy-applying-5s.png shows Applying your style… and Forging your Alloy — this one takes a moment.

Native Alloy capture ../forming-verify/alloy_form.mp4 (18.1596s,540x1200) was independently checked over video5.0–18.1s. Hero-only crop(380x300,x80,y430),10fps resized329x260; native-alloy-hero/. Maximum static run.30s starting video13.0s. PASS for this observed Applying interval. Partial diagnostic native-alloy/ crop is excluded because it did not cover the full hero; use native-alloy-hero/.

**Newer native capture reveals an unresolved acceptance failure.** ../forming-verify/alloy-native-20261004.mp4 is29.0016s,1080x2400. Hero-only crop(760x600,x160,y860),10fps resized329x260; native-alloy-fullwait/. Maximum static run1.60s from video15.6s. Independent full frames alloy-15.6s.png and alloy-17.1s.png show identical lit-head positions while Applying your style… remains visible. Header changes from FORMING YOUR ANCHOR to CHOOSE YOUR ANCHOR. ffprobe shows encoded frames throughout this interval, so the interval is not solely caused by a missing video packet. The criterion of no static interval over about1s while Applying remains visible fails in this recording.

Source clue: AnchorCreationFlowScreen form case advances formTfRef.current; sweep case passes the unchanged formTfRef.current to drawForm. The existing clock is frozen during forming-to-Choose sweep. The native stall correlates with the handoff/Choose mount. A scheduling/decoding cause is not established by this observation; concurrent build workload may be relevant but does not erase the observed failure. Parent was informed, and no product code was changed by verifier.

Caption follow-up changed source after the original hash capture. The original raster run remains evidence for that earlier snapshot; final source hashes and motion runs require refresh after implementation is stable. **Current final status remains NO SIGNOFF until the observed native handoff freeze is resolved and recaptured.** Actual artwork distinction no longer blocks the checked five styles.
