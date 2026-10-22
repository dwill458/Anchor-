# Creation grid audio: Samsung Android reproduction

Device: Samsung SM-S928U1, Android 16. Authenticated Anchor development build.

The supplied recording and SFX log show missing audible notes despite all nine `play()` calls
succeeding. The mapping sequence is cells 13, 22, 23, 20, 8, 3, 12, 18, 25, with pitch keys
4, 2, 4, 21, 16, 4, 2, 16, 9. This rules out missing timeline events and logged cap/load drops
for this run; a successful playback call alone does not establish audible output.

## Runtime evidence

- `android-wav-missing-nodes.mp4`: actual creation route with the original WAV tones, recorded
  through Android playback capture while keeping speaker playback enabled. Missing notes reproduced.
- Direct output capture contains all nine WAV tones. It redirects the output and therefore does
  not establish normal speaker-path acceptance. The user confirmed missing notes without recording.
- Removing the initial seek, reducing the pool to five players, creating fresh players, starting
  playback during loading, and resampling the WAV to 48 kHz did not consistently recover every note.
  These experiments were runtime-only and were restored before reloading the app.
- `android-mp3-nine-nodes.mp4`: actual creation route using MP3 copies of the identical synthesized
  tones, through Android playback capture with speaker playback enabled. All nine attacks appeared,
  in the expected pitch order. Measured attack positions: 4.80, 5.14, 5.63, 6.02, 6.40, 6.89,
  7.32, 7.75, 8.09 seconds in the recording. Times include native playback latency.
- The MP3 bytes tested on the phone match all ten bundled MP3 assets exactly. The device experiment
  used cache-file URIs; repository wiring uses Metro asset IDs. The final reloaded app included the
  MP3 modules, but the device disconnected before its final replay could be captured.

The evidence supports changing the Android decoder path. It does not establish the internal cause
of the Samsung/native PCM failure or independently confirm listening without capture after the fix.

## Change and validation

Android selects 48 kHz, 192 kbps MP3 copies of the existing waveforms. iOS keeps the original WAVs.
Pitch keys, volume 0.32, settings gate, scheduler, pooling and release behavior are unchanged.

- 6 focused Jest suites / 17 tests passed, including Android MP3 and iOS WAV source selection.
- `npx tsc --noEmit --pretty false` passed.
- Android Expo export completed successfully, with the ten MP3 assets included.
- `node scripts/build-node-tones.cjs --android --validate` passed. It checks exact original WAVs,
  decoded Android duration and waveform RMS error under 0.02 against the original synthesizer.
- Scoped `git diff --check` passed.

Regeneration: `node scripts/build-node-tones.cjs --android` (requires FFmpeg).

Changes are local and uncommitted. No OTA or native build was published. Reload the development
app to load the new asset selection, then confirm the nine-node run with normal speaker listening.
