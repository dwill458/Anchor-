# Session audio audit — 2026-10-25

Status: **30/30 normal-speed sessions and 4/4 native control/recovery checks passed on the Moto.** Automated audio-stream and timing acceptance is complete; the release boundaries below remain separate.

## Scope and method

- Moto g play (2024), Android 14, USB serial ZY22KPQQHK; installed development build com.anchorintentions.app 2.0.0 (39), native React Native 0.88.0.
- All current public guided combinations: Focus 10/30/60 seconds × Grounded/Serene/Warm/Soothing; Deep Focus 2/5/10 minutes × those four voices; Visualize Glimpse/Immerse/Embody × Grounded/Serene. Total: 30.
- Production session components run through a separate development entry with local fixture content and no practice-history commits. Normal account startup hydration is separate from those fixture callbacks.
- Normal-speed, complete Android digital-output recordings; native playback states; source/capture waveform comparison; local speech recognition and acoustic alignment; actual rendered-caption logs and Anchor screenshots.
- Digital capture verifies the decoded Android audio stream. It does not constitute a human listening test of the physical speaker or earbuds.

## Confirmed causes and repairs

1. **Playback clock consumed buffering time.** A pre-fix Serene 2-minute Deep Focus run ended when narration had reached only 98.061 seconds. Focus and Deep Focus finished mixes now use native playback position. Buffering holds their progress. Muting keeps the narration clock running at zero volume. Failed loads offer a retry in Focus and Deep Focus.
2. **Focus closing narration exceeded its cue window.** Warm/Soothing 30/60-second closing clips need up to about 6.3 seconds; the previous five-second window clipped them. They now start with seven seconds remaining.
3. **Visualize source editing split sentences.** The delivered V4 files match the installed originals byte for byte. In long Serene Visualize, “The feeling…” was split by roughly 8.6 seconds, including a cut fragment. Additional long-session “Keep only the feeling” / “Just look” splits were confirmed against the uninterrupted original narration.
   - New V5 long-session files repair four phrases using the original dry Dominic/Lina recordings and synchronized original music stem.
   - Runtime remains 615 seconds. Original V4 assets are retained. Output remains stereo, 44.1 kHz, 192 kbps MP3.
   - The fitted music stem correlation exceeds 0.99998; unaffected audio correlates above 0.99999 after level normalization. Output true peak is −1.15 dBTP for both voices; integrated loudness is −16.48 / −16.74 LUFS.
4. **Caption maps and Anchor coverage were wrong.** All 248 Visualize phrases were checked against narration. Acoustic alignment replaces early or silence-spanning timestamps; captions include the Anchor chapter and split at long internal spoken pauses. A redundant caption state gate was removed so new text renders immediately.
5. **Displayed/saved Visualize duration was nominal.** Runtime labels and completed duration now follow the actual recordings: approximately 1:05, 3:20, and 10:15. The nominal selection remains the planned-duration identifier.
6. **A native source error could become a false resumable Visualize interruption.** Error status is now handled by the failure callback, including while paused, so the removed player cannot remain presented as resumable. Two focused regression cases cover running and paused failures.

## Completed playback and caption checks

- 30/30 public guided combinations completed exactly once at normal speed, with no native player errors in the accepted recordings. This includes all opening, middle, closing, Anchor, and return sections.
- All 68 active source assets decode successfully; no missing assets or narration clips exceeding their scheduled cue windows.
- All six Visualize runs matched all 248 planned phrases and 263 committed caption segments. No missing captions, wrong text, ordering failures, or caption publish delays above the 350 ms gate. Worst measured publish delay from the acoustically aligned caption start: 246 ms.
- Finished-mix source/capture correlation exceeds 0.995 for every Visualize recording; no weak half-second windows. Modular Focus/Deep Focus speech windows exceed 0.989 after accounting for the native resampler and ambient bed; gain ratios stay between 0.9937 and 1.0050. Complete measurements are retained rather than treating speech recognition as an exact transcript oracle.
- Whole-recording speech recognition sometimes chooses homophones or omits words over quiet music. These differences are retained. Local normalized capture checks independently confirm Serene's “Not excitement…”, “Certainty”, repaired “The feeling…”, and “Keep only the feeling”; the uninterrupted source/capture waveform provides the primary transport check.
- Both repaired V5 filenames and content hashes were observed in the Moto's actual player source, and both V5 assets appear in the final production Android export.
- 34 focused regression suites / 456 tests passed. Production Android bundle export passed. Scoped diff whitespace checks passed.

See `matrix.md` for each completed duration/voice and `acceptance.json` for the machine-readable acceptance receipt. Screenshots retain each Visualize guide/duration's Anchor appearance and matching caption.

## Native control and recovery results

| Check | Observed result |
|---|---|
| Focus unavailable source → retry | Native `Source error`; no false completion after holding 12 seconds beyond the 10-second nominal duration; Retry loaded the source and played the full session. |
| Deep Focus mute → unmute | Same narration player advanced from 23.099 to 28.080 seconds while muted; no restart. |
| Deep Focus pause → resume | Position held while paused; the same player resumed at 56.231 seconds after pausing at 56.222 seconds. |
| Visualize background → resume | Paused on background; the same player resumed near 8.5 seconds and completed. |
| Focus modular closing cue while muted | The closing cue was already advancing at 1.023 seconds with native `mute: true`; unmuting restored that cue, and the session completed once. |

The last two Deep Focus operations share one control run, giving four complete control runs. Native status and completed-run receipts are in `evidence/native-control-evidence.json`. Controls grouped beneath an Android accessibility root were operated using visually inspected hit areas, with screenshots retained. Failed QA harness attempts are excluded from acceptance and preserved in the private working evidence.

## Repaired source identity

| Active file | SHA-256 |
|---|---|
| Embody_Final_10min15_V5.mp3 | `86c4c59f6a107e354dceaef3b4cbb6ee7dc5d5c28aadf0de1fe0ecf29f52b540` |
| Embody_Final_Lina_10min15_V5.mp3 | `6ae2574b29431b83e9cf883c57491b00b2a9ce2a2688cbcb05dcaa2777b12d3d` |

## Evidence

- Raw accepted recordings and review excerpts: `E:\Projects\Anchor-audio-qa\20261025`.
- All 30 accepted FLACs are in that folder's `accepted` directory. Acceptance records include their SHA-256 digests. Source/alignment/transcript JSONs are preserved in its `analysis` directory.
- The four additional completed control recordings are preserved in its `controls` directory.
- Working evidence, intermediate failures, source transcripts, alignment details, native logs, and source-repair provenance: `C:\Users\dwill\AppData\Local\Temp\anchor-session-audio-qa-20261025`.
- Original narration/music stems were found in `E:\downloads\Anchor_Audio_Package.zip`; original installed mixes match `E:\downloads\Anchor_Audio_V4_Complete.zip`.
- Acoustic alignment uses the documented [TorchAudio CTC alignment method](https://docs.pytorch.org/audio/2.8/tutorials/ctc_forced_alignment_api_tutorial.html), with local original-source and capture evidence retained. No narration was uploaded for analysis.

## Release boundaries observed

- The main app currently encounters `SQLCipher activation requires an approved native cohort build` with this installed package/development-server configuration. The guard and user data were preserved; audio fixtures do not establish main-app startup or persistence acceptance.
- The project typecheck currently reports 15 diagnostics outside the changed audio paths. Those diagnostics are retained separately.
- Fixes are local and uncommitted. No release, OTA, backend deployment, or account practice-history changes were performed by the test callbacks.
- After all acceptance receipts were saved, the shared ADB server stopped responding to inventory/reverse queries. The audio recorder/proxy/logging helpers were stopped; the shared ADB server was left running to preserve the other attached device. Final removal of the temporary 8094 reverse could not be confirmed. This happened after the completed recordings and control checks.
