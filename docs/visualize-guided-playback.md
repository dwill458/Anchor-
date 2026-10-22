# Visualize guided playback

Visualize plays one finished guided track per length and drives every visual from that track's real playback
position. The beat maps in `anchor/mobile/src/screens/v2/practice/visualize/beatmaps/` are the only source of
narration timing.

```
player.currentTime ──► useGuidedPlayback ──► positionSV (UI thread) ──► cinematicSessionFrame(timeline) ──► Skia stage
                              │
                              └─► positionMs (React, 100 ms) ──► resolveGuidedState(plan) ──► captions, seal haptic, controls
```

| Piece | File |
| --- | --- |
| Beat maps (JSON, untouched) + loader | `visualize/beatmaps/*.json`, `visualize/guided/visualizeBeatMap.ts` |
| Plan: beat map → stage timeline, grade, captions | `visualize/guided/visualizeGuidedPlan.ts` |
| Audio clock, pause/resume/interruption/background | `visualize/guided/useGuidedPlayback.ts` |
| Grade + luminance breath (worklet-safe) | `visualize/guided/cinematicGrade.ts` |
| Caption text (the maps carry unpunctuated text) | `visualize/guided/visualizeCaptions.ts` |
| Finished mixes (6 mp3) | `src/assets/sounds/visualize/guided/`, `src/services/visualizeGuidedTracks.ts` |

## Rules the code enforces

- **One clock.** `useGuidedPlayback` samples `player.currentTime` every 50 ms. The stage glides to the next
  expected sample on the UI thread and snaps on any jump (resume, seek, foreground). No second timeline exists.
- **No catch-up.** Resume and foreground return assign the position directly; the frame is derived from
  `position + plan`, never replayed. The seal haptic is skipped if the session returns more than 1.5 s past it.
- **Three levels.** Chapter events (image change, grade, Vision to Anchor to board) lead the narration by 1 s
  (`GUIDED_LEAD_MS`, clamped at 0). Phrase events are captions and phrase-level crossfades. Silence removes activity.
- **Silence.** `silenceSpans` comes from the map's own `silence_after`. Positional motion (`breakout`) is shortened
  to finish before the next 5 s+ silence. Inside a 5 s+ silence only a luminance breath (peak 4 %) remains.
- **Restraint by length.** `TRACK_PLANS` holds the per-track differences as data pointing at phrase ids:
  Glimpse at most 2 images, Immerse and Embody at most 4 with 2.2 s / 3.2 s / 4.5 s crossfades. The sequence only
  moves forward; it never wraps and never forces every image to appear. One image still works.
- **Anchor hierarchy.** Corner watermark at 12 to 30 % in Vision chapters; the Anchor chapter darkens everything,
  hides captions, and shows the user's real artwork. The seal haptic fires once, when it resolves.
- **Completion** comes only from the track finishing. Ending early stops audio and never calls `onComplete`.
- **Sound off** still plays the track at volume 0, because it is the clock.

## Lengths

Mobile and backend accept 60, 180 and 600 s. 300 s is the retired five-minute length: the backend still accepts it
for old records, and the app resolves a stored 300 to 180. Records carry the nominal length (60/180/600), not the
track's real length (64.8 s / 195 s / 615 s).

## Known limits

- The beat maps carry text without apostrophes or punctuation; captions come from an explicit table in
  `visualizeCaptions.ts`. A new narrated phrase needs an entry or its caption is dropped rather than shown broken.
- Audio output latency (Bluetooth) is not compensated; visuals follow the decoder position.
- The six mixes add about 41 MB to the bundle.

## Motion and craft (2026-10-03 polish)

- **Push-in.** `plan.push` is one ease-out push (`cinematicPushAt`): quick after the breakout, exactly still by the
  chapter that wants stillness (Glimpse 7 % to NORMALIZE, Immerse 3 % to EXPERIENCE, Embody none). It ends before any
  long silence and is zero under Reduce Motion.
- **Grade arc.** Glimpse warms toward "This is simply your life", then cools to 0.7 into HOLD.
- **Watermark.** Drawn under the grade (so it is warmed and softened with the photograph), as the symbol alone: the ink
  shape for enhanced artwork, never a disc. 68 px, 16 to 30 % opacity.
- **Held Anchor.** A halo and a 7 % luminance breathe on a ~7 s period during `recognition` only.
- **Vision to Anchor and open/close.** The iris collapses onto the Anchor (the photo survives only inside the symbol's
  shape), and the session opens on the board card, expands to full-bleed and contracts back to it.
