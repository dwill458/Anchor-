# Chart Opening — current status

## Local handoff — October 8

The user requested local completion and explicitly canceled OTA delivery. **No EAS update was published**, and the other projects' services were left running.

Full and Short replay controls plus intro-seen reset are available in the Chart lab. An internal V2 staging/preview build now also has a direct **Settings → Chart opening preview** entry; production does not show it. Development menus and deep-link listeners stay development-only. The main checkout's existing global teaching-reset footer stays development-only too.

The final access changes passed **2 suites / 18 tests**, including the Settings row event and production-hidden checks. TypeScript and diff whitespace checks passed in the isolated checkout, and the independent access review found no blocking issue. The isolated source is based on the last preview checkpoint `f56063a84`; concurrent One Move, tips, and Vision work was excluded from its overlay. No release or device-install claim is made.

The current source is **not accepted at the requested 9/10 bar**. The settled intro matches the static reference, and the final isolated Chart regression overlay passes, but measured Android frame pacing remains far outside the required limits. The physical Samsung S24 check and an authenticated creation-to-active-Chart handoff are still outstanding.

Independent review scored the result **8.3/10 overall**: code 9.2, tests 9.4, visual 9.6, interactions 9.0. The pacing gate and unperformed production-device/authenticated-handoff checks keep it below 9.

## Current source and validation

- Final served Hermes bundle: `final-source-afterprep-current.bundle`, 7,398,169 bytes, SHA-256 `20311295BE6DCD5353F69F213CE8378C65658F9D61FD35FA151102CA5CD27609`; verification: `final-source-afterprep-verification.json`. The final source has no production timing/probe logs. The bundle includes the QA replay entry’s sibling-clock marker.
- The final code keeps the intro overlay sway stopped for the intro surface, returns a stable identity camera matrix while route progress is hidden, and warms only the full-size grain texture before the sequence. The last full-size grain preparation change landed after the measured pacing candidate; it runs before the sequence and leaves the renderer/sweep unchanged. Therefore the pacing figures below are explicitly from the immediately preceding renderer candidate, SHA-256 `8849A673080281A1F615745519C4A5E8B1DE3B82D3BF0DDA8884BD6C1FCB2AF9`, not a benchmark of the final preparation change.
- Focused source validation passed **11 suites / 102 tests**. TypeScript and Android export also passed (reported by the implementation lead). The isolated detached-HEAD overlay passed **47 suites / 455 tests and 1 snapshot**, using 27 hash-matched opening-owned files plus only the approved `ChartChrome` layout-prop and `V2ChartScreen` intro-readiness test hunks. Full overlay hashes are in `final-overlay-file-hashes.json`; machine report: `final-overlay-regression.json`. Concurrent One Move source and tests were excluded.
- Baseline comparison: `post-change-chart-preview-vision-input.json` reports 2 suites / 76 tests, 66 passed / 10 failed. All 10 failures are the same pre-existing `ChartPreview` snapshots (hero and card variants); `visionPhotoInput.test.ts` passed. The separate Vision photo/picker set passed **6 suites / 44 tests** in `post-change-vision-photo-tests.json`, matching its baseline count.

## Native evidence

- Device configuration: emulator-5554, 786×1704 WM override, density320, font scale1.0. A cold Full run, Reduced motion, and an early map-area skip were exercised on the final source bundle. Reduced and skip both reached the settled full-size map, copy, and Continue state. The QA fixture has a no-op creation callback; it does not prove authenticated save or active-Chart handoff.
- Final settled screenshot `finalsource-full-final.png` was compared with `intro-before.png`, masking status/navigation bars and the approved paper band. Outside those masks: **938,484 pixels compared; 0 pixels had a channel delta above 12/255; MAE 0.01305; maximum channel delta 1**. Details: `final-source-masked-diff.json`.
- The Full recording is `finalsource-full.mp4`; it has no in-frame runner timer because the production timing anchor was removed. Earlier runner-clocked evidence from the measured renderer candidate showed paper-only through about +1.02s, sparse marks around +1.58s, partial marks around +2.05s, and developed ink by about +3.05–3.5s. Treat those times as candidate-qualified; the current prep-only source change was not given another timing capture.
- Full, Reduced, and queued early-skip artifacts from the final bundle are `finalsource-full-final.png`, `finalsource-reduced-final.png`, `finalsource-skip-before.png`, and `finalsource-skip-after.png`; selection logs are stored alongside them. No authenticated Chart transition was tested.

## Evidence retention

The temporary production runner log was removed. Retain the task-owned QA replay fixture and captured evidence for the remaining acceptance checks. Once those checks finish, archive the needed evidence and remove only the task-owned temporary fixture files when they are no longer needed. No QA artifacts were deleted during this pass.

## Frame-pacing result and remaining gate

On the measured renderer candidate (`8849A673…B2AF9`), the cold no-clock exact runner window [29087.762, 29094.962]s yielded **197 unique frames / 7.167s / 27.35fps; 177/197 (89.848%) over 16.7ms; 148 over 32ms; median 37.585ms; max 213.086ms**. After force-stopping background Google Photos without clearing its data, a same-source warm run yielded **355 unique frames / 7.117s / 49.74fps; 324/355 (91.268%) over 16.7ms; 85 over 32ms; median 25.898ms; max 161.104ms**. Both fail the ≤3% over 16.7ms and zero-over-32ms thresholds. Raw logs and frame polls: `wrapper-camera-perf-logcat.txt`, `wrapper-camera-perf-polls.txt`, `wrapper-camera-controlled-warm-logcat.txt`, and `wrapper-camera-controlled-warm-polls.txt`; derivation uses `chart-opening-evidence.py frames-window` and deduplicates IntendedVsync to the latest completed frame.

The AVD was resource-constrained: before the controlled run, only 563 MiB of 16 GiB host RAM and about 200 MiB of emulator RAM were free; the host sampled 55–73% CPU. Google Photos was force-stopped while Anchor QA held foreground focus. The warm result still failed badly, so the resource snapshot does not excuse it. The final prep-only source change has no new performance measurement. A physical Samsung S24 release-build pass and authenticated handoff remain due.
