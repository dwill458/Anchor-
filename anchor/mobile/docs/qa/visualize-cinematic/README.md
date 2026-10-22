# Cinematic Visualize — implementation and acceptance

Status: **production route integrated; corrected enhanced-art Android recording reviewed; broader Android and iOS acceptance gates remain OPEN.**

The success metric is whether the person can follow board → photograph → Vision
texture inside their actual Anchor → the same Anchor on the same board without
perceiving separate screens. Passing tests or exports does not establish that.

## Open the real-data prototype

In a development build, sign in, select an Anchor with a saved Vision, open
Practice → Visualize setup, and select **DEV · Cinematic transition prototype**.
The normal Begin action now starts the cinematic production session. The prototype never
calls completion services, changes the Vision, or records practice activity.

The diagnostic reel uses the first saved image and the complete saved board.
It intentionally does not implement the full multi-image session timeline.
Production freezes and uses the selected Anchor's enhanced image URL when
available, including setup, recognition, return, and board. The compression
treatment derives a continuous luminance mask from those pixels without
altering or replacing the saved artwork. Existing board assets, ordering, and
measured intention-card layout are reused.

Play runs a 24-second signature reel and hides diagnostics. Tap the image to show them.
Pause, ±1 frame, and the named checkpoints support frame-by-frame review. Replay
resets the reel. Backgrounding pauses it. Resizing remounts preparation rather
than continuing with stale coordinates. System Reduced Motion uses stationary
compositions and dissolves. Test normal motion with system animation enabled.

Frame statistics are **UI callback intervals**, not proof of GPU presentation
or 60fps. The selected image's RGBA estimate is not peak process/GPU memory.

## Visual acceptance gate

- [x] Android isolated prototype: authenticated real-data recording of all three signature transforms.
- [x] Android production session: authenticated real-data, two-photo 60-second run recorded through natural Done. See the PTS contact sheets below.
- [ ] iOS: authenticated real-data recording of all three signature transforms.
- [ ] Breakout: source pixels/crop align with the board photograph; no flash,
      texture replacement, hard cut, or detached frame.
- [ ] Compression: actual Vision texture remains visibly present in the saved
      enhanced artwork before the clean mark resolves. No rectangular thumbnail.
- [ ] Return: track the mark's center and scale on every frame. Paper, pin,
      and board reveal in the same coordinate space; original composition returns.
- [ ] Compare 1–6-photo layouts and portrait/landscape source images; verify
      long intentions still produce the correct measured mark placement.
- [ ] Profile GPU/render frame pacing and peak memory across playback and at
      least five close/reopen cycles on representative hardware.
- [ ] Review reduced motion, background/pause/resume, loading failure, retry,
      missing SVG, and close during loading/playback.

Required visual rule: the final image, saved enhanced Anchor, parchment, pin, and board share one
continuous spatial transform. The Anchor's center and scale path must be
traceable through the final composition. A sequence of discrete fades fails.

The compositor and native board share one camera definition. During fullscreen
immersion, the hidden environment camera moves to the measured mark while the
foreground preserves its screen crop. During the return the mark and paper
are projected from the same scene point and camera; there is no navigation or
mid-animation screenshot capture.

## Android device evidence available in this workspace

2026-09-29: tested on the authenticated Galaxy S24 Ultra (SM-S928U1),
1440�3120 physical pixels / 384�832 scene viewport, with a real saved two-photo
Vision and saved Anchor. No account reset or Vision edits were performed.

The actual enhanced artwork is an opaque 1024�1024 JPEG (`enhancedImageUrl`),
not an enhanced-SVG field. Its inspected SHA-256 is
`7dbf87c7c688d8241f2c11502ca2054747cf890f68718f80a85ee621d0990fe4`. The same
asset now appears on the preparation board, during the active session, in the
texture-bearing compression, and on the returned board. Evidence:
`android-enhanced-prep-after-restore.png`, `android-enhanced-opening-check.png`,
`android-enhanced-natural-end.png`, and `enhanced-anchor-asset-inspected.png`.

Reviewed production capture: `android-enhanced-production-60s.mp4`
(124.485s container duration including navigation lead-in and completed-state
hold). The selected session was 60 seconds with two saved photos and completed
naturally through Done. `android-enhanced-contact.jpg` and individual
`enhanced-pts-<time>.jpg` frames use MP4 presentation timestamps. PTS 50 shows
the contracting photo aperture, PTS 51 shows the ornate saved strokes carrying
photo texture, PTS 52 shows the clean same artwork, PTS 55�57 show the continuous
return, and PTS 62 shows Done after the tail. These sampled frames are not a
frame-by-frame acceptance or a GPU presentation measurement.

The saved raster was inspected directly. Luminance-based alpha is continuous
(rather than thresholded or traced), retaining the enhanced artwork's exact
linework; the isolated Skia layer uses a circular clip matching the native
board's crop and padding. The radial-aperture and luminance masks remain a union
so the full image can contract continuously before the artwork resolves.

The post-session `dumpsys meminfo` sample in `android-prod-final-meminfo.txt`
is 1,178,857 KB total PSS, 1,017,732 KB RSS, and 283,180 KB graphics. This is a
single sample, not a controlled baseline or peak, and does not close the
memory/performance gate. Earlier prototype frame-interval readings predate this
production asset integration and do not establish GPU presentation rate.

No iOS device/simulator evidence is available. Pause/background/resume, reduced
motion, failure recovery, alternate durations, other image counts and layouts,
repeated entry/exit, and controlled frame-pacing and peak-memory profiling
remain open. Android evidence covers only this authenticated 60-second,
two-photo path; the broader acceptance gates remain OPEN.

Focused regression command passed **18 suites / 210 tests** on 2026-09-29,
covering Visualize, board, session engine/audio, completion, and Practice flows.
A repository TypeScript check still reports unrelated pre-existing diagnostics;
no clean repository-wide TypeScript result is claimed. Earlier Android/iOS
development exports predate the enhanced-art correction and are not native builds.

## Production integration and remaining device review

1. The session freezes the saved Anchor, its enhanced image URL (or saved SVG fallback), content, and ordered images. Native
   board assets and Skia textures load before the monotonic clock starts. Retry
   and Continue with available images rebuild both boards from the same selected set.
   Each image is checked before Skia decode and limited to 4,194,304 pixels
   (2048 × 2048, about 16 MiB for one RGBA texture), regardless of encoded
   file size. Generated 1080 × 1920 images fit this bound. Oversized images
   get truthful recovery copy and can be excluded with Continue when other
   images are ready. Six maximum-size textures and board assets may still use
   substantial peak memory; process and GPU memory need device profiling.
2. The 60/180/300-second multi-image timeline reserves the approved
   timing budgets: arrival 3/4/5s, breakout 3s, moment transitions 2s, final
   uninterrupted hold 2s, feeling 3s, compression 4s, recognition 2s, return 4s,
   carry copy 3s, silent board hold 1s. Allocate the remainder to immersion.
3. Sparse complete thoughts use saved Vision description, with deliberate silence.
   Ambient audio remains continuous; one compatible existing recorded cue is retimed
   into the first immersion. The first immersion and completed compression use
   one-shot optional haptics.
4. The existing monotonic engine owns pause, backgrounding, completion, and early
   exit. The final board hold ends at the selected duration; only then can the
   completion service run and Done appear. Backend and return contracts are unchanged.
5. Android and iOS development exports passed before the enhanced-art correction.
   These are bundle checks, not native builds or device acceptance. A normal Android
   60-second, two-photo production run has since been recorded and reviewed above.
   iOS review, alternate durations and image counts, pause/background/recovery,
   repeated entry/exit, and controlled memory/GPU pacing remain open.

Keep the prototype until that evidence exists. Do not infer acceptance from its
presence, mathematical tests, a successful Hermes bundle, or emulator boot.
