# Ten-minute Deep Focus pacing repair — 2026-10-26

The subsequent [full guided-audio audit](../audio-pacing-20261026/README.md)
also repairs the two- and five-minute mixes and additional Visualize phrases.

The supplied Grounded/Dominic master placed intention and almost all subsequent
guidance at 538.98–595.60s. Earlier breath instructions were split across
113.82s, 239.72s and 379.02s. Serene/Lina also had uneven placement, including
"This doesn't need effort anymore" at 424.88s and its continuation at 582s.
The previous transport QA reproduced the supplied masters accurately but did
not establish acceptable editorial pacing.

V5 keeps the same recorded words, voices and speaking speed. Guidance windows
now start around 7s (settle), 20s (permission and breaths), 60s (intention), 120s
(nothing to solve), 145s (Anchor), 260s (return), 390s (steadiness), 510s
(letting details fall away), and 580s (closing). Both remain exactly 600s.
Split breath/steadiness clauses are rejoined. Warm/Soothing use separate modular
recordings with an already distributed schedule and are unchanged.

`scripts/repair-deep-focus-pacing.py` builds separate `_V5.mp3` files from the
retained original masters. It loops an original voice-free stereo bed with 2s
crossfades and replaces it with original mixed spoken windows using 30ms fades
at clause boundaries. Each spoken window includes its original bed, so the bed
is replaced rather than doubled. Global entry/exit fades are 3s/4s.
`SessionAudioManifest.ts` selects V5 for the two ten-minute finished mixes.

Validation:

- `python scripts/repair-deep-focus-pacing.py validate --original` fails as
  expected: opening guidance missing at 20s (correlation 0.03425).
- `python scripts/repair-deep-focus-pacing.py validate` passes all 21 actual
  decoded spoken-window comparisons, with a minimum required speech-band
  correlation of 0.985. See `pacing.json` for times, correlations and hashes.
- Routing regression tests failed against the old manifest, then passed.
- Six focused Jest suites / 77 tests pass (manifest, Deep Focus session,
  presentation, completion, timeline and managed audio).
- Production Android export passes; both V5 asset hashes are present in the
  export at `E:/Projects/Anchor-audio-qa/20261026/android-export`.
- FFmpeg: stereo 44.1kHz / 192kbps; decoded duration exactly 600s. True peak
  -1.56 dBTP Grounded and -1.53 dBTP Serene; no clipping. Integrated loudness
  -20.95 / -18.66 LUFS respectively; spoken-window gains are retained.

Physical speaker/earbud listening and a complete ten-minute device playback of
V5 remain unverified. Existing October 25 device receipts cover the old files.
The local development app needs a reload/new session to use the updated assets;
this change has not been published as an OTA or installed release.
