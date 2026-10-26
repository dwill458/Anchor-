# Guided audio pacing audit — 2026-10-26

All **30 currently selectable guided combinations** were checked: Focus
10/30/60 seconds and Deep Focus 2/5/10 minutes with Grounded, Serene, Warm and
Soothing; Visualize Glimpse/Immerse/Embody with Grounded and Serene. Release
does not play scheduled narration. Unused legacy durations are outside this
current V2 selection matrix.

## Findings and repairs

| Coverage | Finding | Result |
| --- | --- | --- |
| Focus, all 12 combinations | Finished mixes distribute complete prompts through the short session. Modular clips fit their windows. | No pacing change. |
| Deep Focus, Grounded/Serene 2m | Intention/settling instructions were separated by long gaps, with multiple instructions in the final seconds. | New V5 mixes: settle/intent at the opening, quiet prompt at 25s, release distractions at 50s, presence at 65s, Anchor at 80s, closing at 110s. |
| Deep Focus, Grounded/Serene 5m | Grounded inhale at 74s and exhale at 159s; intention/Anchor guidance clustered at 161–189s. Serene crowded the opening and had uneven middle gaps. | New V5 mixes distribute guidance near 5/10/30/60/100/155/210/285s, preserving complete breaths. |
| Deep Focus, Grounded/Serene 10m | Previously reported end loading and split clauses. | Earlier V5 repair revalidated. |
| Deep Focus, Warm/Soothing, all six combinations | Separate clips already spread across each duration; no clips exceed their windows. | No pacing change. |
| Visualize Glimpse | Grounded phrase 12 had 1.06s of added silence inside “the feeling”. | Grounded V6; Serene unchanged. |
| Visualize Immerse | Grounded phrases 24/35 and Serene phrases 7/16/24/28/30/35 had added intra-clause gaps. | Both V6; eight phrase repairs. |
| Visualize Embody | Serene phrase 19 split “Notice the … people” by 9.565s; Grounded phrase 37 split “Where do you … feel” by 4.142s. | Both V6; two phrase repairs. |

The five Visualize replacements repair **11 phrases**. The comparison includes
the uninterrupted original narration, so natural pauses such as inhaling before
an exhale are retained. Only gaps enlarged by at least 750ms inside a phrase
are candidates. Glimpse/Immerse/Embody remain 65.245/65.120, 200, and 615 seconds.
Their chapter starts and subsequent phrase starts are unchanged. Repaired
caption ends follow the joined speech; obsolete split caption spans are removed.

## Evidence and verification

- `baseline-matrix.json` records the active assets before this broader audit;
  `matrix.json` and `source-audit.json` describe the replacements. All 68 active
  source assets decode, with zero missing assets or cue-window overruns.
- Unchanged recordings were checked using prior local transcripts/alignment
  data after comparing current asset SHA-256 values with the October 25 source
  inventory. New source transcriptions of all four original 2m/5m mixes also
  confirmed the misplaced instructions. Temporary analysis/transcripts are in
  `E:/Projects/Anchor-audio-qa/20261026`.
- `deep-focus-pacing.json`: all 51 spoken windows in six V5 Deep Focus mixes
  match the retained original audio at their new times. Original 2m and 5m
  masters failed those same position checks before the replacement was built.
- `deep-focus-transcripts.json`: fresh full-recording recognition of the four
  repaired 2m/5m mixes confirms opening, intention, middle, Anchor and closing
  guidance at the new times. Recognition occasionally writes “anger” for
  “Anchor” or hallucinates over quiet music; exact source-waveform preservation
  is checked separately rather than treating those as changes to the wording.
- `visualize-pacing.json`: per-phrase source/output hashes, original versus
  natural gaps, movement times, speech-band tail correlations and correlation
  of the vacated tail with voice-free bed. The original Glimpse recording fails
  the same audio-position validator (correlation -0.08371).
- `repaired-phrase-transcripts.json`: fresh, independent local recognition of
  all 11 repaired Visualize utterances, each matching the complete expected
  text after punctuation normalization. Minimum moved-tail correlation is
  0.999755; minimum vacated-tail/quiet-bed correlation is 0.999509.
- `levels.json`: FFmpeg loudness and true-peak checks for the nine newly changed
  files. No clipping; measured true peaks range from -1.54 to -0.87 dBTP.
- The new map/routing tests failed first (15 cases), then all **21 focused Jest
  suites / 294 tests** passed, including Deep Focus lifecycle and Visualize
  playback, captions, readiness and completion.
- Production Android export passed. `android-export.json` verifies the exact
  SHA-256 bytes of all 11 replacement assets (six Deep Focus V5 and five
  Visualize V6) in `E:/Projects/Anchor-audio-qa/20261026/android-pacing-export`.

## Reproduction

From `anchor/mobile`, with Python/numpy/scipy and FFmpeg available:

```powershell
node scripts/audit-session-audio.cjs docs/qa/audio-pacing-20261026 --check
python scripts/repair-deep-focus-pacing.py validate
python scripts/repair-visualize-pacing.py validate docs/qa/audio-pacing-20261026/baseline-matrix.json E:/Projects/Anchor-audio-qa/20261025/analysis/visualize-forced-alignment-grouped E:/Projects/Anchor-audio-qa/20261025/analysis/raw-forced-alignment
```

`repair-deep-focus-pacing.py build` rebuilds the separate V5 files. The Visualize
repair script's `build` command reconstructs V6 from the baseline files; its
`validate --apply-maps` option updates only the affected caption timings.
All originals are retained. Both scripts validate actual decoded samples.

## Acceptance boundary

This is source-audio, schedule, acoustic, recognition, and bundle verification.
It is not a new full-duration physical speaker/earbud listening pass or an OTA
release. The October 25 device recordings cover the previous masters. Reload
the development app and start a new session to use the replacement recordings.
