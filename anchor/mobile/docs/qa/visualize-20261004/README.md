# Visualize photos, light and motion — October 4, 2026

## Changes

1. Preparation and the guided plan retain every attached photo. The plan gives each photo an equal slot in the photo chapter for all three duration choices. There is no phrase-count cap, six-photo cap, wrapping, or silent subset. A failed photo requires Retry; Continue with available images was removed. Tests cover 1–6 photos for both guides/all durations, plus 9 and 40 photos.
2. Each foreground photo stays wholly inside the viewport. A constant-speed translation follows its long axis; a cached 48×48 local contrast centroid chooses the direction. There is no foreground zoom or reversal. Motion continues through incoming/outgoing dissolves. Contrast analysis is an approximation, not face recognition; preserving the whole image protects subjects independently of that approximation. A small blurred background texture is prepared before Begin, and only the current/next foregrounds are rendered.
3. Ambient cream → navy starts at playback position zero and takes two seconds. Navy → cream occupies the track's final two seconds, after the final narrated phrase, and resolves at the completion handoff. Both derive from the same paused/resumed audio position. Existing iris, breathing Anchor, captions, beat maps, narration assets, playback engine and canonical completion persistence remain intact.

## Device recording

`visualize-session.mp4` is an uncut 211.96-second Galaxy S24 Ultra development capture, with device audio, compressed for sharing. It includes setup, the selected three-minute session, all six distinct photos, opening/closing light fades, iris, breathing Anchor and the existing completion screen. The original capture is `visualize-session-master.mp4`. The development trace verified `photos=6 lightReturnMs=193000 durationMs=195000`, six distinct focus coordinates and six prepared backgrounds before recording. The duration control was independently checked as “3 min, selected.”

The development host uses six bundled fixture images through the production preparation/session components, marked as uploads. It does not save a practice against the user's account; the completion screen truthfully reports that the fixture session was not saved. This is not an authenticated persistence acceptance test.

Approximate recording positions:

| Position | Evidence |
| --- | --- |
| Opening seconds after Begin | Cream → navy |
| 0:49 | Portrait desk photo, full image |
| 1:11 | Landscape window photo, full image |
| 1:33 | Family/table photo |
| 1:55 | Home photo |
| 2:17 | Studio photo |
| 2:39 | Movement photo |
| 2:48 onward | Iris / Anchor beat |
| Final two session seconds, after “And move.” | Navy → cream |
| Immediately after the track settles | Existing completion screen |

`all-six-photos.png`, `opening-light.png`, and `closing-light.png` are frames extracted from this recording.

The unchanged track selected by “3 min” lasts 195 seconds. Its photo chapter spans 27.2–157.5 seconds, giving six equal 21.717-second slots. Intro, iris, breathing Anchor and ending retain their narration-based positions; consequently each photograph cannot occupy 30 seconds without changing those protected beats. The first image is additionally visible on the opening/return board.

## Validation and remaining acceptance

- 13 Visualize suites / 162 tests passed, including readiness, all-photo scheduling, clipping bounds in portrait and landscape viewports, no zoom, completion, early exit and background pause/resume.
- Android Expo/Hermes export passed. Scoped diff check passed.
- TypeScript reports only the two existing errors in `V2AnchorDetailsScreen.test.tsx`, lines 563 and 647.
- On-device background test: session paused at 0:41, returned paused, and resumed at 0:42 on the same final photo/compression beat, without rewinding the sequence.
- **Uninterrupted 60fps is not certified on every target device.** An initial Home-backed development capture reported whole-app frame times of 9ms median, 21ms p90, 26ms p95 and 32ms p99. A subsequent unrecorded static-screen check improved to 5ms median and 16ms p99. The final recording reports 5ms median, 10ms p90, 13ms p95 and 17ms p99 across 21,707 frames; steady motion frame callbacks average approximately 8.3–9ms. See `master-log-*.txt` and `master-gfx.txt`. Capture, underlying-screen work and completion handoff can still cause outliers. No mid-range Android or release-build performance acceptance was performed. The screen recording has variable frame timestamps; its average encoded frame rate is not a direct measure of UI refresh cadence.

Android preparation originally fell back when a GPU surface was unavailable on JS. The final code uses CPU surfaces for the tiny focus analysis and cached background preparation. The final device trace confirms all six focus/background results are populated; full-image framing remains the safe fallback if analysis is unavailable on another device.

No narration assets, caption text, caption timing, or beat-map files were changed. The two deliberate adaptations are equal slots within the available photo chapter rather than the entire track, and contrast-guided direction rather than semantic face recognition.
