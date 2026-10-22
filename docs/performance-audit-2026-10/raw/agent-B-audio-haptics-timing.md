# Agent B: Audio, Haptics and Session Timing (read-only audit, 2026-10-12)

Repo: `E:\Projects\Anchor`, mobile app in `anchor/mobile/src` (all paths below are relative to that unless noted).
Branch `feat/celebration-layer`, dirty tree (V2PracticeAudioSheet.tsx, useReleaseHold.ts, V2ReleaseScreen.tsx, NodeToneService.ts, build-node-tones.cjs, node-tones/*.mp3 are uncommitted).
Stack facts used: expo-audio 1.1.1 (native source read in `node_modules/expo-audio`), RN 0.81.5, Reanimated 4.1.

Evidence legend: **code read** = read the source and reasoned about the mechanism, nothing run. **library source** = read `node_modules/expo-audio` native source. **asset measured** = ffprobe/ffmpeg run on the audio file. **not device verified** applies to everything: no app run, no adb, no jest/tsc was needed or run.

Dev notes honoured (not re-reported): Visualize Android "resumes itself under Paused" is fixed for `useGuidedPlayback`; SealMedallion 16 ms interval was retracted 2026-10-07; audio re-encode to 128 k CBR (2026-10-07) and the `releaseIdle` race note in `AnchorCreationFlowScreen` are known. Voice mapping (male = Dominic = "Grounded", female = Lina = "Serene") verified correct, see "Checked and found clean".

Severity summary: P1 x1, P2 x7, P3 x14 (B-01 .. B-22, some merged).

---

## Issues

### B-01  Android: Focus and Deep Focus audio resumes under the Paused overlay after backgrounding
- **Screen/System**: `useSessionAudio` consumers: `screens/v2/practice/focus/V2FocusActiveScreen.tsx`, `screens/v2/practice/deepFocus/V2DeepFocusActiveScreen.tsx` (legacy `FocusSession`, `useDeepPrimeSessionAudio` share it).
- **Proposed severity**: P1 (Android only). iOS is not affected in the normal order of events.
- **Evidence type**: library source + code read (same mechanism as the already-fixed Visualize bug, which was observed on an emulator per memory `project_visualize_guided_playback`). Not reproduced for Focus/Deep Focus.
- **Symptoms**: Background the app during a Focus/Deep Focus session, return after N seconds. The screen shows "Paused" and the clock is stopped, but the ambient bed and the narration are playing. The narration has advanced N seconds past the session clock, so on Resume it is ahead of the visuals and ends early.
- **Reproduction**: Android, sound on, start Deep Focus 5 min with voice, press Home, wait 20 s, return. Listen under the Paused overlay. Repeat for Focus 60 s.
- **Likely root cause (high confidence on mechanism, medium on frequency)**: expo-audio Android `OnActivityEntersBackground` pauses every playing player and sets `player.isPaused = true`; `OnActivityEntersForeground` calls `player.ref.play()` on every flagged player (`node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioModule.kt:217-248`). The JS `pause` function does not clear `isPaused` (`AudioModule.kt:401-405`). The session screens pause their players from the JS AppState handler (`V2FocusActiveScreen.tsx:705-712` -> `pauseSession` 661-683; `useDeepFocusSession.ts:70-75` -> effect at `V2DeepFocusActiveScreen.tsx:131-153`), which on Android arrives after (or races with) the native hook, so the JS `pause()` is a no-op and the native flag survives. iOS has the same shape (`ios/AudioModule.swift:67-81`, `wasPlaying`) but the JS `inactive` event precedes `didEnterBackground`, so the player is already paused and `wasPlaying` stays false.
- **Relevant files:lines**: `hooks/useSessionAudio.ts:108-147` (wrapper has no "intended state"), `V2FocusActiveScreen.tsx:661-712`, `V2DeepFocusActiveScreen.tsx:131-153`; contrast the fix in `screens/v2/practice/visualize/guided/useGuidedPlayback.ts:100-103` and `188-196`.
- **Recommended solution**: Put the guard in the shared wrapper so every session screen gets it. In `useSessionAudio.createSessionAudioPlayer` keep `wantPlaying` (set by `play()`/`pause()`/`stop()`), and in the existing `playbackStatusUpdate` listener (line 100) call `player.pause()` whenever `status.playing && !wantPlaying`. Also re-assert pause in an AppState `active` handler for any wrapper whose `wantPlaying` is false. Keep the Visualize-specific code as is (it also handles the `didJustFinish`/interruption cases).
- **Visual/audio preservation**: No change to any cue, level or timing. Only suppresses audio the app did not ask for.
- **Risk**: Low. A status event can lag a `play()` by a few ms: set `wantPlaying` before calling the native `play()` and ignore events for ~600 ms after a start/resume as `useGuidedPlayback` already does (`STATUS_SETTLE_MS`).
- **Verification**: Android device (or emulator) background/return matrix for Focus 60 s, Deep Focus 2 min, ambient-only, voice-only; add a jest test for the wrapper that emits `{playing:true}` while `wantPlaying=false` and asserts `pause()`.

### B-02  Android: pooled loops and one-shots that were playing at background time are resumed natively and orphaned
- **Screen/System**: `services/audio/SoundPool.ts` and every looped pool cue: `creation:formBed` (creation Form beat, Vision develop wait), `creation:sealRise` loop (Choose hold, Vision seal hold).
- **Proposed severity**: P2 (Android only).
- **Evidence type**: library source + code read (same native hook as B-01). Not reproduced.
- **Symptoms**: Background the app while the Form bed (or a seal-rise loop) is sounding, return later: the bed starts playing again by itself, even if the flow has moved on (Choose screen, Home). It loops until the same pool key is next played or the entry is disposed.
- **Reproduction**: Android, creation flow, background during "Forming" while generation is running, wait until generation finishes, return. Listen on the Choose screen.
- **Likely root cause (medium confidence)**: `AudioModule.kt:217-248` as above. `AnchorCreationFlowScreen.tsx:350-363` stops the bed on `state !== 'active'` via `stop(300)` (a JS `setInterval` fade, `SoundPool.ts:524-533`), which ends in `releaseEntry` -> `player.pause()`, but the native `isPaused` flag stays true; on foreground the native hook calls `play()` on the entry's player. `SoundPool` thinks the entry is idle (`busy=false`) and does nothing. The listener at `SoundPool.ts:197-206` only reacts to `didJustFinish` and `idle`.
- **Relevant files:lines**: `services/audio/SoundPool.ts:156-167` (releaseEntry), `197-206` (listener), `screens/create/flow/AnchorCreationFlowScreen.tsx:349-363`, `components/v2/vision/ceremony/VisionCeremony.tsx:191-195`, `screens/create/flow/useChooseController.ts:197-199,230-235`.
- **Recommended solution**: In the SoundPool status listener add: `if (status.playing && !entry.busy) entry.player.pause()` (guard against re-entry), and add an AppState `active` pass that pauses every non-busy entry. Optional: on background, `releaseEntry(..., discard=true)` for looping busy entries so the native object is removed (removal also drops the native flag).
- **Visual/audio preservation**: None changed. The bed still restarts through the existing foreground paths (`startFormBedSound`, `bedOn`).
- **Risk**: Low; a stray status event for a legitimately starting entry is covered because `busy=true` is set before `play()` (line 381).
- **Verification**: Android, as reproduction; log with `sfxLog` the number of players with `playing && !busy` after foreground (expected 0).

### B-03  Android: no audio focus and no "becoming noisy" handling, so calls, other media and headphone unplug do not pause narration
- **Screen/System**: `services/audio/AudioSession.ts` (interruptionMode) plus expo-audio Android defaults; affects all session audio (Visualize 1/3/10 min, Focus, Deep Focus, voice preview).
- **Proposed severity**: P2 (could be P1 for Visualize Embody 10 min with headphones). iOS is handled by the library.
- **Evidence type**: library source. Not device verified.
- **Symptoms**: (a) Android: unplug wired earbuds or lose a Bluetooth connection mid-session and the narration continues out of the loudspeaker. (b) A heads-up incoming call or another media app starting does not pause the session. The Visualize "audio interruption" detection (`useGuidedPlayback.ts:105-111`) can never fire for these because no pause event is produced.
- **Reproduction**: Android, start Visualize Immerse with earbuds, unplug. Start a podcast in another app while a session plays.
- **Likely root cause (high confidence)**: `AudioSession.ts:16-22` always sends `interruptionMode: 'mixWithOthers'`. In expo-audio Android `requestAudioFocus()` returns immediately for MIX_WITH_OTHERS (`AudioModule.kt:119`), so the app never holds focus and `audioFocusChangeListener` (lines 62-110) never fires. The ExoPlayer is built with `setAudioAttributes(AudioAttributes.DEFAULT, false)` (`AudioPlayer.kt:46`): handleAudioFocus false, and `setHandleAudioBecomingNoisy` is never set (grep of the android sources finds no occurrence). iOS pauses on `.oldDeviceUnavailable` and on interruption began (`ios/AudioModule.swift:347-440`), so iOS is fine.
- **Relevant files:lines**: `services/audio/AudioSession.ts:16-22`; `useGuidedPlayback.ts:105-111`; `node_modules/expo-audio/android/.../AudioModule.kt:119,184-193`, `AudioPlayer.kt:46`.
- **Recommended solution**: Choose per mode. For `'session'` use `interruptionMode: 'doNotMix'` on Android (focus is then requested on first `play()`, loss pauses players, regain resumes; the existing re-pause guards in B-01 keep the Paused state authoritative). Keep `'effects'` as `mixWithOthers`. For becoming-noisy a small patch to expo-audio (patch-package) enabling `setHandleAudioBecomingNoisy(true)`, or a JS route listener, is needed; there is no JS API for it in 1.1.1. Decide separately whether iOS session mode should also stop mixing (product decision, today the user's music keeps playing under narration on both platforms).
- **Visual/audio preservation**: Sessions sound identical; they additionally pause when the system takes the audio. Visualize already treats an unrequested pause as an interruption (shows Paused).
- **Risk**: Medium. `doNotMix` stops the user's own music when a session starts, which is conventional for meditation but is a behaviour change. SFX one-shots played during a session (mode `session`) would also take focus.
- **Verification**: Android hardware: call, Assistant, YouTube, earbud unplug, BT off. Confirm the Visualize Paused overlay appears and the audio position holds.

### B-04  Ambient toggle does nothing in Visualize, and "Ambient: Off" does nothing for Focus/Deep Focus when a voice is selected
- **Screen/System**: Visualize setup/session, Focus and Deep Focus setup (`components/v2/practice/V2PracticeAudioSheet.tsx`), `services/SessionAudioManifest.ts`.
- **Proposed severity**: P2 (settings that do not do what they say).
- **Evidence type**: code read.
- **Symptoms**: Visualize with voice "No guidance" and ambient On: complete silence (the guided mix plays at volume 0 as the clock). Visualize with voice On: the mix always carries its music bed, so ambient Off is ignored. Focus 10/30/60 s and Deep Focus 2/5/10 min with voice On: the finished mix includes its bed, ambient Off is ignored; with voice Off and ambient On the separate ambient track plays.
- **Reproduction**: Open each prepare screen, set the combinations above, begin, listen.
- **Likely root cause (high confidence)**: Visualize passes `muted: voice === 'none'` only (`V2CinematicSessionScreen.tsx:223`) and `ambient` is used for analytics (`backgroundAudio`, line 175). For mixes `resolveSessionAudioPlan` sets `ambientTrack=null` when `voiceIncludesBed` (`SessionAudioManifest.ts:468-476`) and keeps the requested `backgroundAudio` in `configuration` without telling the UI. The sheet (`V2PracticeAudioSheet.tsx:82,179-197`) offers both options whenever `isSessionAudioSelectionAvailable` is true.
- **Relevant files:lines**: as above plus `screens/v2/practice/V2PracticeSessionScreen.tsx:355-366,376-392`.
- **Recommended solution**: Make the UI honest first: when the selected voice's track `includesBed`, disable/annotate the ambient row ("Music is part of this guidance") and for Visualize collapse voice+ambient into the single real choice. For "No guidance + ambient" in Visualize, either play the mix's bed-only asset (needs a bed-only render; the 60/180 ambients exist as `visualize_ambient_1m/3m.mp3` and 300 as remote) at the audio-position clock's expense, or hide the ambient option for Visualize when voice is none. Product decision; do not silently drop the setting.
- **Visual/audio preservation**: Existing tracks unchanged.
- **Risk**: Low for the UI change; medium if bed-only playback is added (the bed would need its own clock tolerance because Visualize's clock is the narration track).
- **Verification**: jest on the sheet for each (voice, ambient, session type) combination; manual listen test.

### B-05  Sound off then on desyncs the full-length narration mix (Focus 10/30/60 s, Deep Focus 2/5/10 min)
- **Screen/System**: `V2FocusActiveScreen.tsx` `toggleSound` (637-648), `V2DeepFocusActiveScreen.tsx` `toggleSound` (205-212).
- **Proposed severity**: P2.
- **Evidence type**: code read.
- **Symptoms**: Mute for 60 s in the middle of a 5 min Deep Focus session, unmute: narration continues from where it was paused, 60 s behind the session clock and visuals; the clock ends the session while the narration is mid-sentence (the mix is stopped in `complete()`, line 108-121). The code comment says "Sound switched on late seeks to the clock", but that only applies when no player exists yet (`played` set / first cue creation).
- **Reproduction**: Deep Focus 2 min with Lina, toggle Sound off at ~20 s, on at ~60 s. Narration restarts from 20 s of content.
- **Likely root cause (high confidence)**: Off = `pause()`, On = `play()` on the same player with no `seekTo(clockElapsed)`.
- **Relevant files:lines**: as above; `useDeepFocusSession.ts:38-39` (`readElapsed`), `V2FocusActiveScreen.tsx:239-266` (`calculateElapsed`).
- **Recommended solution**: On un-mute, `seekTo(readElapsed())` (Deep Focus) / `seekTo(elapsed since cue start)` (Focus mix) before `play()`; or mute by `setVolume(0)` instead of pausing (the bed keeps its position, no seek needed, no restart latency). Volume mute is the simpler and click-free route if a 20 ms ramp is added.
- **Visual/audio preservation**: Keeps all audio. Do not shorten.
- **Risk**: Low.
- **Verification**: Unit test with a fake player recording `seekTo`; manual: mute/unmute and confirm lines match the on-screen phase.

### B-06  Focus: Sound toggle in the Paused overlay starts audio while paused
- **Screen/System**: `V2FocusActiveScreen.tsx:637-648` (toggle) and `951-958` (paused toggle).
- **Proposed severity**: P2.
- **Evidence type**: code read.
- **Symptoms**: Pause the session, tap Sound off then Sound on (both toggles are live in the overlay): the ambient bed and any narration play while the clock is stopped and the screen says Paused; Resume then calls `play()` again (no-op), but the narration is ahead of the clock.
- **Likely root cause (high confidence)**: `toggleSound` calls `ambientPlayerRef.current?.play()` / `voicePlayerRef.current?.play()` unconditionally on enable. Deep Focus guards with `state === 'running'` (`V2DeepFocusActiveScreen.tsx:208`); Focus does not.
- **Recommended solution**: `if (next && !isPaused)`; when paused, only update `soundEnabled`. Combined with B-05, restore on resume (`resumeSession` already plays when `soundEnabled`).
- **Visual/audio preservation**: Unchanged.
- **Risk**: Very low.
- **Verification**: RNTL test: pause, toggle off/on, expect no `play()`.

### B-07  SoundPool never resets playback rate, so a pooled player keeps the previous play's rate
- **Screen/System**: `services/audio/SoundPool.ts` `applyConfig` (384-395). Affects `creation:distillTick` (CreationStage ladder 1.0 -> 1.48), all chart one-shots, any cue played with `rate`.
- **Proposed severity**: P2 for distillTick (audible wrong pitch), P3 elsewhere.
- **Evidence type**: code read.
- **Symptoms**: A later play with the default rate reuses an entry whose last play used a higher rate and sounds at that stale pitch. Example: `components/v2/creation/CreationStage.tsx:417-419` plays `distillTick` at `distillLandingRate(index)` (1.0..1.48 in 0.06 steps); on a second creation run the first landing (index 0, rate 1) is played at whatever the idle pool entry last had, while `AnchorCreationFlowScreen.tsx:876` and `VisionCeremony.tsx:227` play the same pooled key at rate 1 (expecting 1). Chart `open`/`wind` pass rate 1 explicitly (`useChartSound.ts:218,237`) but share entries with jittered cues of the same key.
- **Likely root cause (high confidence)**: `if (rate !== 1) setPlaybackRate(...)` only; there is no else branch and `Entry` does not remember the last rate (`SoundPool.ts:388-394`).
- **Relevant files:lines**: `SoundPool.ts:384-395`, `CreationStage.tsx:1206-1210`.
- **Recommended solution**: Track `entry.rate` and call `setPlaybackRate(rate)` whenever it differs from the entry's current rate (including back to 1). Keep `shouldCorrectPitch=false`.
- **Visual/audio preservation**: Restores the intended cue pitches; no cue removed.
- **Risk**: Low.
- **Verification**: jest: play key with rate 1.3 then rate 1, assert second `setPlaybackRate(1)`; listen test on a second creation run.

### B-08  SoundPool overflow builds a cold temporary player instead of reusing the oldest (comment and code disagree)
- **Screen/System**: `SoundPool.ts` `getMaxPoolSizeForKey` (74-87) and `play` (354-366). Hits every key with max pool size 1: all node tones, chart cues, thread cues, `seal`, `bloom`, release cues, `visionPin`.
- **Proposed severity**: P2 (late or missing cue on re-trigger); impact depends on how often the same key is retriggered inside its clip length.
- **Evidence type**: code read; asset durations measured (e.g. node tone 0.4 s, `sk-seal` 1.4 s, `chart-waypoint_n` 2.0 s, `sk-thread-settle` 0.64 s).
- **Symptoms**: A second play of a pooled cue while the first is still sounding creates a brand-new player (`createEntry(key, true)`, lines 356-359) that must load before `play()` (up to `LOAD_TIMEOUT_MS` 1500 ms, line 28), so the cue is late (load wait + `seekTo`), or dropped if the load times out and the retry also fails. The comment at line 85 says a same-pitch retrigger "reuses the oldest entry"; that branch (360-366) is only reachable if `createEntry` returns null (live-player cap or error).
- **Reproduction**: Creation mapping where two consecutive nodes share a grid cell and land inside 0.4 s; chart waypoint taps in quick succession; thread celebration cue overlapping a prior chord.
- **Likely root cause (high confidence)**: `isPool = entries.length < getMaxPoolSizeForKey(key)`; with max 1 and one busy entry `isPool` is false, `createEntry(key, !isPool)` returns a temporary entry, so `entry` is non-null and the reuse branch is skipped.
- **Recommended solution**: Decide the intended policy per key and encode it: for percussive/short cues (node tones, ui taps) restart the oldest busy entry (`seekTo(0)` + `play()`), exactly as the comment says; allow a temporary overlap only for cues that must ring out (chords, `seal`, `releaseBurn`), and in that case prewarm a second pooled player (`getPoolSizeForKey` 2) so the overlap is warm. Add a SoundPool test for the retrigger policy (none exists: `services/audio/__tests__/SoundPool.test.ts` has no temporary/reuse case).
- **Visual/audio preservation**: Cues keep their sounds; retriggers become prompt instead of late.
- **Risk**: Medium. Restarting a still-ringing cue truncates its tail; choose per key.
- **Verification**: jest for both policies; device: trigger same cue twice within its length with `sfxLog` and measure `loadedAtCall`/timestamps.

### B-09  First-play latency: `seekTo(0)` before every one-shot, un-prewarmed cues, and cold players after `releaseIdle`
- **Screen/System**: `SoundPool.play` (471-486), `playPracticeCompletionCue`, `V2DeepFocusActiveScreen.complete`, Home arrival, onboarding sealed, paywall success, vision pin outside the ceremony, anchorPulse.
- **Proposed severity**: P3.
- **Evidence type**: code read; no latency measured.
- **Symptoms**: A prewarmed cue still waits for an asynchronous `seekTo(0)` round trip before `play()`, so sound lags its paired haptic (haptics call `Haptics.*Async` synchronously, e.g. `useChooseController.ts:207` Heavy then `startSeal` -> `onSealLanded` -> `playCreationSound('seal')`). Keys that are never prewarmed pay a full cold load on first use: `practiceComplete` (Focus end, `V2FocusActiveScreen.tsx:524-529`, then `setAudioSessionMode` await, then cold create), `homeArrival` (`V2HomeScreen.tsx:145`, also awaits AsyncStorage), `onboardingSealed` (`V2SealedSaveScreen.tsx:145`), `paywallSuccess`, `anchorPulse` outside Vision, `visionPin` in Home arrival. After `SoundPool.releaseIdle(keys)` the key has zero entries; the next `play()` creates one inline (cold) because `play()` never re-prewarms. Example: `V2ReleaseScreen.tsx:67-77` disposes `uiTap`, `seal`, `sealRise`, `revealSettle` etc. on entry.
- **Likely root cause (medium)**: Design of `play()`: always `await seekTo(0)` (even for an entry that has never played or already finished at 0) and no re-prewarm.
- **Relevant files:lines**: `SoundPool.ts:354-376,471-486`; `services/audio/practiceCompletionCue.ts:5-10`; `V2FocusActiveScreen.tsx:522-529`; `V2DeepFocusActiveScreen.tsx:117`.
- **Recommended solution**: (1) Track `entry.atStart` (true after create and after `didJustFinish`/seek) and skip the `seekTo(0)` for fresh entries; when seeking is needed, call `play()` without awaiting the seek on iOS if ordering is safe, or seek immediately after finishing (in `releaseEntry`) so the next play is instant. (2) Prewarm `creation:practiceComplete` when a session starts (release at end), `homeArrival` on first Home mount, `onboardingSealed`/`paywallSuccess` on their screens' mounts. (3) Have `play()` queue a prewarm top-up for pooled keys that dropped to zero entries.
- **Visual/audio preservation**: None removed; cues land closer to their haptics.
- **Risk**: Low-medium (more live players: stay under `MAX_LIVE_PLAYERS` 24, comment on line 26).
- **Verification**: Compare `sfxLog` `loadedAtCall`, `source=temporary|prewarmed`, and time from call to `playReached` on device; Perfetto/Instruments audio latency.

### B-10  End-of-session truncation of the finished mixes, and a racy completion cue (Focus 10 s, Deep Focus)
- **Screen/System**: `V2FocusActiveScreen.tsx` (`checkVoiceCues` 417-444, `beginEnding` 522-529), `V2DeepFocusActiveScreen.tsx` (`complete` 108-121), `screens/v2/practice/deepFocus/completionCue.ts`.
- **Proposed severity**: P3 (Focus 10 s possibly P2: heard on every 10 s session).
- **Evidence type**: asset measured + code read. Start latency not measured.
- **Symptoms / measurements**: `Focus_10s_Dominic_V4.mp3` is 10.585 s and `Focus_10s_Lina_V4.mp3` 10.484 s for a 10 s session. The mix's own bed fade-out spans the last ~1.2 s (100 ms RMS, Dominic: -26 dB at 8.9 s falling to -73 dB at 10.5 s; Lina similar). The player starts at the first 250 ms tick after the clock (`remainingMs <= trigger + 200`), so at clock end (10.0 s) the audio is at about 9.5 s, and `beginEnding` calls `voicePlayerRef.current?.stop()` (line 523), cutting the fade at roughly -30 dB instead of letting it finish; `practiceComplete` follows 300 ms later. 30 s and 60 s mixes (29.03/28.88 s and 58.8/58.6 s) end before the clock, so they are fine. Deep Focus mixes are exactly 120/300/600 s with 0.33-0.44 s of digital silence at the tail (asset measured), the session clock completes at the first 250 ms sample at or after the end, and the mix started at clock + L, so `complete()` stops it before `onFinish` fires: `fullMixFinished` is false in almost every run, `shouldPlayDeepFocusCompletionCue` returns false, and the practice-complete cue is skipped; when L is tiny and the sample lands late, the mix can finish first and the cue plays. Behaviour is therefore nondeterministic.
- **Likely root cause (medium)**: Wall/monotonic clock owns the end, audio is a free-running second clock with no offset correction and an unconditional `stop()` at completion.
- **Recommended solution**: Make the mix end authoritative where it exists: on completion fade the mix over 150-300 ms instead of `stop()`, or wait for `onFinish` up to `L + 400 ms`. For Focus 10 s, start the mix at clock start (play at activation, not on the first tick) and keep the session clock at 10.0 s with a 300 ms fade at the end, or let the session resolve phase (Focus resolves for ~2.3 s anyway: `completionTimerRef` 548-555) hold the mix to its natural end. Use `onFinish` or a position check to decide the completion cue deterministically.
- **Visual/audio preservation**: Keeps the mix and the cue; only the cut becomes a fade.
- **Risk**: Low-medium (cue overlap with the mix tail; the existing resolve phase gives room).
- **Verification**: Record device output for 10 s Focus and Deep Focus 2 min end; compare to the asset tail.

### B-11  Abrupt stops (no fade) at several exits, and JS-thread timer fades
- **Screen/System**: Focus end-early, Deep Focus end-early, Visualize unmount/route removal, Vision seal-hold release, Release hold cancel, Chart air bed on unmount, Visualize sound toggle.
- **Proposed severity**: P3.
- **Evidence type**: code read.
- **Details**:
  - `V2FocusActiveScreen.tsx:455-456` `handleEndEarly` stops ambient (0.14) and the narration mid-word with `stop()` (pause + remove). The completion path at 522-529 uses `setVolume(0.04)` (a step, not a fade) then `stop()` 300 ms later; the comment at line 527 mentions "the session bed's fade" but there is none.
  - `V2DeepFocusActiveScreen.tsx:125-130` `handleEndEarly` calls `session.end()` (sets `done`, so `sample()` returns early at `useDeepFocusSession.ts:86`) and then stops players immediately, so the 0.45 s `endFade` in `sampleAudio` (line 82-95) never applies to audio in that path.
  - `useGuidedPlayback.ts:162-174` has a 5-step 300 ms fade, but only via `endEarly`; the unmount cleanup (`useSessionAudio.ts:62-70`) hard-stops, e.g. back navigation or the QA lab leaving the route.
  - `components/v2/vision/ceremony/VisionSealHold.tsx:24` `stop()` -> `tone.current?.stop()` with no fade on release/commit, whereas `useChooseController.ts:199,233` fades 150/200 ms.
  - `screens/v2/release/V2ReleaseScreen.tsx:113` `stopReleaseFall` -> `stop()` abrupt when the hold is cancelled inside the 1.0 s clip.
  - `components/v2/chart/ChartIntroOpening.tsx:122-126` `handleContinue` calls `sound.stopAir()` (400 ms JS ramp) then `onContinue()`; the unmount of `useChartSound` then runs `useAudio` cleanup first (`hooks/useAudio.ts:62-68`, declared before `useChartSound`'s own cleanup at 192-213) which removes the air player mid-ramp. `fadeAirOnUnmount` exists but no caller sets it (grep).
  - `SoundPool` fades (`SoundPool.ts:487-502,519-533`) and `useChartSound.rampTo` (108-124) are `setInterval` volume steps (16 ms and `ms/16`), so under JS load the steps coarsen and clicks are possible; `expo-audio` has no native fade.
- **Recommended solution**: One small shared `fadeOutAndStop(player, ms)` used by all of the above (20-30 ms minimum for one-shots, 150-300 ms for beds/narration); in Deep Focus drive the end-early fade through the existing `endFade` before `onExit`; for unmount-with-fade ensure the owner of the fade outlives `useAudio`'s cleanup (call the ramp in an earlier cleanup or skip `cleanupAllPlayers` for a fading handle). Ramp steps keep `setInterval` but use 8-10 steps at <= 30 ms.
- **Visual/audio preservation**: Nothing shortened or removed; only the cut becomes a short fade.
- **Risk**: Low; Release/Deep Focus exits get 150-300 ms later silence.
- **Verification**: Record/inspect waveform at exit points; jest with fake timers.

### B-12  Voice preview race: rapid taps or sheet close can leave an orphan preview playing (double voice)
- **Screen/System**: `services/VoicePreviewService.ts` `startVoicePreview` (42-93), used by `V2PracticeAudioSheet.tsx:96-102` and Settings.
- **Proposed severity**: P3 (narrow time window).
- **Evidence type**: code read.
- **Symptoms**: Tap preview Dominic then Lina quickly, or close the sheet immediately after tapping: two previews overlap, or a preview starts after the sheet closed and nothing owns it (until the next `stopVoicePreview`).
- **Likely root cause (high confidence on mechanism)**: `startVoicePreview` calls `stopVoicePreview()` then `await setAudioSessionMode('session')` before creating the player. A second call or a `stopVoicePreview()` during that await has nothing to stop; when the first call resumes it creates and plays player A and sets `activePlayer = A`; the second resumes, creates B and overwrites `activePlayer`, leaving A unreferenced and playing. A late resume after `stopVoicePreview()` plays with no UI state.
- **Recommended solution**: Add a monotonically increasing `requestId`; after the `await`, `if (id !== currentId) return false`. Dispose A before assigning B regardless.
- **Visual/audio preservation**: Unchanged.
- **Risk**: Very low.
- **Verification**: jest with a deferred `setAudioSessionMode`.

### B-13  Session Haptics toggle is dead when global haptic intensity is 0; selection/notification are not scaled
- **Screen/System**: `hooks/v2/useSessionAudioSetup.ts:31,41,69`, `utils/haptics.ts:35-61`, all V2 sessions.
- **Proposed severity**: P3.
- **Evidence type**: code read.
- **Symptoms**: Global Haptic Intensity set to 0 in Settings; in a session's prepare card "Haptics" is initially off, the person turns it on, and still feels nothing, because `safeHaptics.selection/notification` return when `getIntensity() <= 0` (lines 46,55) unless `bypassScale`. Conversely intensity 1-33 still plays full-strength notifications/selection (only `impact` is scaled).
- **Likely root cause (high confidence)**: Two sources of truth (session toggle vs global intensity), unified-practice-settings work made the toggle session-only but `safeHaptics` still enforces the global value.
- **Recommended solution**: When the person explicitly enables haptics for a session, pass `bypassScale` (or a `forceOn` option) from the session screens; otherwise show the toggle as off and disabled with the reason. Decide which source wins and document it. Optionally scale notification/selection by intensity.
- **Visual/audio preservation**: None.
- **Risk**: Low.
- **Verification**: jest on `safeHaptics` with intensity 0 and the option; manual.

### B-14  Haptic rate is unthrottled on wheels, carousel and the Choose hold
- **Screen/System**: `components/v2/notifications/TimeWheel.tsx:192-201` (selection per row via `runOnJS`), `components/v2/home/V2HomeAnchorCarousel.tsx:232-242`, `screens/create/flow/useChooseController.ts:146-158` (150 -> 50 ms cadence).
- **Proposed severity**: P3.
- **Evidence type**: code read.
- **Symptoms**: A fast flick across a 60-row minutes wheel can call `runOnJS(safeHaptics.selection)` dozens of times per second, each an async native call; on Android this can queue vibration pulses that continue after the scroll stops. The seal-hold recursion does a `hold.value` JS read plus `impact` at up to 20 Hz.
- **Recommended solution**: A tiny leading-edge limiter in `safeHaptics` (e.g. skip a `selection`/`impact` within 30-40 ms of the previous one, with `bypassThrottle` for one-offs like completions) so every caller benefits. Keep the Choose-hold cadence design values unchanged (150 -> 50 ms) but have it derive timing from `performance.now()` rather than chained `setTimeout`s if it drifts.
- **Visual/audio preservation**: Haptic design kept; only sub-perceptual duplicates are dropped.
- **Risk**: Low.
- **Verification**: Android device; log call count per second during a fast flick.

### B-15  Visualize: 10 Hz React state publish and the seal haptic keyed to it
- **Screen/System**: `useGuidedPlayback.ts:69-83,198-207`, `V2CinematicSessionScreen.tsx:241-253,309-313`.
- **Proposed severity**: P3.
- **Evidence type**: code read; no profile taken.
- **Symptoms/mechanism**: The audio-position clock is sound design-wise: `setInterval(sample, 50)` reads `player.currentTime`, writes the UI-thread value with `withTiming(ms+50, 50)`, and calls `setPositionMs` every 100 ms. Every 100 ms the whole `CinematicRun` re-renders (derived `resolveGuidedState`, `cinematicSegmentAt`, `cinematicGradeAt`, caption lines, `traceVisualize` effect deps) for the full 60/180/600 s, while the Skia stage reads `elapsed` on the UI thread and does not need React state. The seal haptic effect (`V2CinematicSessionScreen.tsx:249-253`) fires on the next committed render after `positionMs >= sealAtMs`, i.e. up to ~100 ms plus render time after the visual (UI-thread) seal moment. A JS stall > 50 ms makes the glide target (`ms + 50`) elapse and the stage freezes until the next sample, then catches up (a jump <= 400 ms glides, > 400 ms snaps).
- **Recommended solution**: Publish React state only when a derived value changes (second boundary for the timer, segment/phrase/imageIndex change, caption change) by computing those in the sampler and comparing to the last value; fire the seal haptic from the sampler when the sampled position first crosses `sealAtMs` (keep the 1500 ms window and the once-only latch). Keep SAMPLE_MS = 50 for the UI-thread value.
- **Visual/audio preservation**: Visual timeline unchanged; the haptic moves up to ~100 ms earlier, closer to the visual.
- **Risk**: Medium (touches the working clock): keep the existing deterministic tests and the `wallClock` seam.
- **Verification**: Existing guided playback tests; systrace JS-thread usage during a 3 min run before/after; device check of the seal haptic against the visual.

### B-16  Sound pool prewarm and JS-driven fades add main-thread work during busy transitions
- **Screen/System**: `SoundPool.prewarm/pumpPrewarmQueue` (254-278, 310-327), `AnchorCreationFlowScreen.tsx:225-233,379`, `NodeToneService.prepare`.
- **Proposed severity**: P3.
- **Evidence type**: code read (cost not measured).
- **Symptoms/mechanism**: Starting creation prewarms `uiTap` x2, `distillTick` x4 and ten node tones (16 players) in batches of 3 every 50 ms (`PREWARM_BATCH_SIZE`, `PREWARM_INTERVAL_MS`), `createAudioPlayer` being a synchronous native constructor (AVPlayer/ExoPlayer plus source resolution) called from JS timers during the Intention -> creation hand-off animation. `NodeToneService.prepare` is also called again when `built` changes (line 379). Each pool entry also keeps `keepAudioSessionActive: true` (line 187).
- **Recommended solution**: Prewarm earlier (on the Intention screen when the primary CTA is armed) or after `InteractionManager.runAfterInteractions`, 1-2 players per tick during animations; prewarm only the node tones for cells the built path actually uses (`prepare(cells)` takes `cells` but ignores it: line 43).
- **Visual/audio preservation**: Same cues, same warm state, started earlier or spread.
- **Risk**: Low.
- **Verification**: Perfetto/Systrace main-thread slices of `createAudioPlayer` at creation start; frame timeline during the hand-off.

### B-17  Audio-session mode is last-writer-wins across mount/unmount effects; completion cues use a different silent-switch policy than the session
- **Screen/System**: `AudioSession.ts` (serialised queue), `useAudio.ts:62-68`, `useSessionAudio.ts:62-70`, `VoicePreviewService.ts:37`, `practiceCompletionCue.ts`, `V2DeepFocusActiveScreen.tsx:117`, `MantraCreationScreen.tsx:444-456`.
- **Proposed severity**: P3 (unverified ordering hazards).
- **Evidence type**: code read; ordering of navigation mounts not verified.
- **Details**:
  1. The queue serialises calls but not intent. Any `stopVoicePreview()` (sheet unmount cleanup `V2PracticeAudioSheet.tsx:76-79`, `V2FocusPrepScreen.tsx:95`) enqueues `'effects'`; if a prepare screen unmounts after the session screen has mounted (replace/reset transitions), the session's `'session'` call is followed by `'effects'` and narration then plays under `playsInSilentMode:false` (iOS `.ambient`, muted by the silent switch). Whether the prepare screen unmounts before or after depends on the navigator and was not traced.
  2. Deep Focus creates and starts its players in the first `sample()` call, synchronously in the same commit as `useSessionAudio`'s mode effect (`V2DeepFocusActiveScreen.tsx:71-107`), so the first `play()` can run before `setAudioModeAsync('session')` resolves (iOS silent switch on: first moments muted until the category switches).
  3. Focus/Deep Focus completion cues switch to `'effects'` (respecting the silent switch, `AudioSession.ts:7`) while the session narration played in silent mode: with the ringer off the person hears the narration but not the completion cue.
- **Recommended solution**: Expose `ready` from `useSessionAudio` (resolved promise of the mode call) and await it before the first `play()`; make session ownership explicit (a counter: `'session'` held while any session screen is mounted; `stopVoicePreview` must not downgrade the mode while the counter > 0); decide and document the silent-switch policy for completion cues (play them in `'session'` mode when the session was audible).
- **Visual/audio preservation**: Unchanged.
- **Risk**: Low-medium.
- **Verification**: iOS with ringer switch on/off: prep -> session transitions, Deep Focus first second, completion cue.

### B-18  Android notification channels carry no custom sound
- **Screen/System**: `services/NotificationService.ts:874-905` (channels), `:33` (`CUSTOM_NOTIFICATION_SOUND`), `app.json:189-193` (plugin sounds).
- **Proposed severity**: P3 (verify intent).
- **Evidence type**: code read.
- **Details**: `notification.wav` (3.0 s, PCM 22.05 kHz mono, asset measured) is attached to notification content (`sound: 'notification.wav'`), which only affects iOS and Android < 8; Android 8+ uses the channel sound, and none of the five `setNotificationChannelAsync` calls sets `sound`. `notification-daily/weekly/checkpoint.wav` are bundled assets with no registration. The channel comment (lines 36-43) says sound is frozen at creation, so adding `sound` needs new channel ids (suffix bump).
- **Recommended solution**: If a branded sound is intended on Android, add `sound: 'notification.wav'` to the channels and bump the version suffixes; otherwise document that Android uses the system default.
- **Risk**: Low. **Verification**: Android 13+ device, trigger a test reminder.

### B-19  Pool key ownership: shared keys released by several owners
- **Screen/System**: `SoundPool.releaseIdle` callers: `useChartSound.ts:66-76` (11 chart keys, used by both `ChartIntroOpening` and `ChartActiveView`), `V2ReleaseScreen.tsx:67-90`, `AnchorCreationFlowScreen.tsx:225-243`, `usePracticeCompletionScene.ts:532-536`, `NodeToneService`.
- **Proposed severity**: P3.
- **Evidence type**: code read (the same hazard is acknowledged in a comment at `AnchorCreationFlowScreen.tsx:229-232` and `VisionCeremony.tsx:171-174`).
- **Mechanism**: `releaseIdle` disposes idle entries by key; nothing is ref-counted. When screen B mounts (prewarm: `needed = target - current` = 0 because A's entries exist) and A unmounts later (release), B's warm entries are gone and are not re-prewarmed. `ChartIntroOpening` and `ChartActiveView` share all 11 keys; the Release screen's mount-time `releaseIdle` list includes `creation:uiTap` and `creation:seal`.
- **Recommended solution**: Ref-count prewarm/release per key (`prewarm` increments, `releaseIdle` decrements and only disposes at zero), keeping the eviction under the live cap.
- **Risk**: Low. **Verification**: unit test with two owners; check `countLivePlayers()` after a Chart intro -> active transition.

### B-20  Remote audio: cache hydration is not awaited before player creation; several remote entries are dead while the same files are bundled at 192 kbps
- **Screen/System**: `services/audio/remoteAudio.ts`, `hooks/useSessionAudio.ts:62-85`, `services/SessionAudioManifest.ts:77-92,98`, `services/visualizeGuidedTracks.ts:5-16`.
- **Proposed severity**: P3 (latency) and a bundle-size note for the bundling agent.
- **Evidence type**: code read; asset sizes/bitrates measured.
- **Details**: (a) `resolvePlayableAudioSource` consults the in-memory `cached` set, which is filled by `hydrateRemoteAudioCache()` fired (not awaited) in the `useSessionAudio` mount effect; on a direct entry (resume, deep link) the first player can be created before hydration finishes and streams a file that is already on disk (only `deepPrimeAmbient` and `visualizeAmbient5m` still go through this path). (b) `REMOTE_AUDIO_TRACKS` still lists DeepFocus 5/10, Embody, but the manifests now `require()` bundled copies (`focus-mix/DeepFocus_*`, `visualize/guided/Embody_*`, all 192 kbps stereo, about 105 MB of mp3 in `src/assets/sounds/{focus-mix,visualize/guided}` plus the 8 remote copies uploaded): the 2026-10-07 re-encode/remote move was superseded by the V4 mix update (commit `e3362c9e`). Not an audio-timing problem, but it explains why Deep Focus start latency is local-decode only and flags a bundle-size item.
- **Recommended solution**: `await hydrateRemoteAudioCache()` inside `useSessionAudio` before the first creation when a remote source is requested (or hydrate in app startup); decide whether the V4 mixes should be re-encoded to 128 k CBR (position-sensitive: verify duration unchanged, as in the earlier pass) or moved remote, and delete the dead table entries.
- **Risk**: Low. **Verification**: airplane-mode start of a cached remote ambient; bundle size diff.

### B-21  Loop-point and tail quality of looped/legacy assets (asset measured)
- **Screen/System**: looped assets: `sk-form-bed.wav` (1.5 s), `sk-seal-rise.wav` (1.1 s, looped in Choose and Vision seal holds), `chart-air.mp3` (12.5 s), `focus-session-ambient.mp3` (188.08 s), legacy `haptic-tone.wav` (0.148 s) and `prime-begin.wav` (1.5 s loop in `useRitualController.ts:267,309`).
- **Proposed severity**: P3 (legacy items P3-low; V1 only).
- **Evidence type**: asset measured (first/last samples and 5 ms RMS via ffmpeg).
- **Findings**: `sk-form-bed.wav` first/last samples -2855/-2593 (seamless within a few percent, good). `chart-air.mp3`: last/first sample 1146/1131 (matched) but encoded MP3s report `start_time` 0.025 s (encoder delay) and expo-audio loops via `REPEAT_MODE_ONE`/native loop, so a 25 ms gap per loop is plausible on Android for MP3 loops (chart-air at 12.5 s, focus ambient at 188 s, at 0.14 volume it is minor). `sk-seal-rise.wav` begins and ends at 0 with a 16422 peak (envelope riser): looped, it pulses every 1.1 s (design intent unknown; the hold lasts 1.2 s / `SEAL_HOLD_MS`, so one pulse in practice). `haptic-tone.wav` first/last samples -11145/+13566 and `prime-begin.wav` 5 ms RMS 486 start vs 9530 end: both click/pulse when looped (legacy ritual only; `haptic-tone` is used non-looped at 0.15 in `useRitualController.ts:217`). `letter-drop.wav` and `ui-select.wav` end on a non-zero sample (legacy one-shots, 60 ms and 30 ms, effectively clicks by design).
- **Recommended solution**: If an Android loop gap is audible, supply gapless WAV/OGG for `chart-air` and the focus ambient or use a crossfaded double player; leave legacy alone unless the V1 flow ships.
- **Risk**: Low. **Verification**: listen test of a 60 s ambient loop on Android.

### B-22  Cue clocks built on `setTimeout` while the visuals run on the UI thread
- **Screen/System**: `hooks/v2/release/useReleaseBurnFeel.ts:44-52` (burn haptic swell: about 10 timeouts started at hold complete), `components/v2/vision/ceremony/VisionSealHold.tsx:38` (`setTimeout(commit, holdMs)` vs `withTiming(1, holdMs)` ring), `components/v2/vision/VisionArrivalSet.tsx:44-56`, `components/v2/creation/CreationStage.tsx:413-422` (`formationTimers` per landing), `V2FocusActiveScreen` controls (250 ms sampler, monotonic: fine).
- **Proposed severity**: P3.
- **Evidence type**: code read.
- **Mechanism**: These start a UI-thread animation and, separately, JS timers for sound/haptic; any JS stall (save, image decode, store hydration) delays the cue relative to the animation and the cue timers are not re-synced. `useReleaseBurnFeel` computes `at - (Date.now() - start)` per timer at schedule time, which is always about `at` (the compensation does nothing). The seal commit can fire late relative to the full ring. The creation flow proper (`AnchorCreationFlowScreen.getFrame`, cues at timeline crossings with clamped `dt`) is frame-clocked and does not have this issue.
- **Recommended solution**: Where the animation is a shared value, fire cues from a UI-thread reaction/`useFrameCallback` crossing (`runOnJS` only for the trigger) or read progress from the shared value; for fixed schedules keep timers but start them from the same instant as the animation and check against progress. Low priority; mostly cosmetic.
- **Risk**: Low. **Verification**: systrace during a busy moment (release save) and compare haptic vs ring.

---

## Audio & haptic cue inventory (Preservation Checklist)

Volumes are `VOLUME` in `services/CreationSounds.ts:7-58` unless stated. "Pool" = shared `SoundPool` players; "Session" = `useSessionAudio` players; "Managed" = `useAudio.createManagedPlayer`.

### Sound cues (pool, `playCreationSound`)
| Cue (file) | Trigger (file:line) | Timing/params | Owner |
|---|---|---|---|
| `uiTap` (`sk-ui-tap.mp3` 0.15 s) | creation taps `AnchorCreationFlowScreen.tsx:544,614,1203`; `IntentionInputScreen.tsx:274`; Vision `VisionCeremony.tsx:529`, `VisionEntrance.tsx:278,279` | vol 1, pool 2 | Creation flow prewarm (225-227); Vision prewarm |
| `distillTick` (`sk-distill-tick.wav` 0.5 s) | `AnchorCreationFlowScreen.tsx:876` per distill event time (`distillEventTimes`, fraction 0.58-0.90 of the distill beat); `VisionCeremony.tsx:227` every 3rd lit word at vol .12; `CreationStage.tsx:419` ladder rate 1.0-1.48 | vol .5, pool 4 | Creation flow prewarm/release (225,236) |
| Node tones `node:0..21` (0.4 s, mp3 on Android, wav on iOS) | `NodeToneService.play` from `AnchorCreationFlowScreen.tsx:885` at `mapEventTimes` | vol .32, pool 1 per cell | `NodeToneService` prepare/release |
| `bloom` (`sk-bloom.mp3` 2.5 s) | Form beat start `AnchorCreationFlowScreen.tsx:347` | vol .55 | creation flow |
| `formBed` (`sk-form-bed.wav` 1.5 s loop) | Form beat `334`; Vision develop wait `VisionCeremony.tsx:193` (fade-in 2500 ms, stop 550 ms) | vol .12 | creation flow, VisionCeremony |
| `formTick` / `formSettle` (0.14 s / 0.7 s) | `formCraftCues` ticks per sheen lap `AnchorCreationFlowScreen.tsx:981`; settle `1005`; Home vision return `visionHomeReturn.tsx:96` | formTick .30, formSettle .35; `FORM_TIMING.sheenPeriod` must stay 2.6 (memory) | creation flow |
| `revealSettle` (1.2 s) | `AnchorCreationFlowScreen.tsx:246,1046`; `CreationStage.tsx:823`; `VisionCeremony.tsx:320`; `VisionEntrance.tsx:273`; `VisionPrint.tsx:140` | vol .55, pool 2 | per screen |
| `sealRise` (1.1 s) | loop in `useChooseController.ts:217` (stop 150/200 ms), loop in `VisionSealHold.tsx:34`, one-shot `SealMedallion.tsx:88` | vol .6 | each screen |
| `seal` (`sk-seal.mp3` 1.4 s) | `onSealLanded` `AnchorCreationFlowScreen.tsx:839`; Vision stamp `VisionCeremony.tsx:363` | vol .9 | creation flow, VisionCeremony |
| `anchorPulse` (1.0 s) | `useChooseController.ts:190` (timer at `SEAL_PULSE_AT * sequenceMs`); `VisionEntrance.tsx:260` | vol .85 | |
| `visionPin` (0.4 s) | `VisionArrivalSet.tsx:53` after `CEREMONY.pinDropMs`; `V2VisionScreen.tsx:64` | vol .45 | |
| `homeArrival` (0.8 s) | `V2HomeScreen.tsx:145`, once ever (AsyncStorage flag) | vol .5 | |
| `onboardingSealed` (2.0 s) | `V2SealedSaveScreen.tsx:145` | vol .6 | |
| `paywallSuccess` (3.98 s) | `useV2Paywall.ts:161,197,226` | vol .6 | |
| `practiceComplete` (2.56 s) | Focus: `playPracticeCompletionCue` 300 ms after `beginEnding` (`V2FocusActiveScreen.tsx:524-529`); Deep Focus `complete()` (117) only if `shouldPlayDeepFocusCompletionCue` | vol .6, after `setAudioSessionMode('effects')` | session screens |
| `releaseFall` (1.0 s) | hold begin `V2ReleaseScreen.tsx:175` | vol .55 | V2ReleaseScreen |
| `releaseBurn` (3.05 s) / `releaseIgnite` (0.52 s, reduced motion) | `useReleaseBurnFeel.ts:46` at hold complete | vol .8 | `useReleaseBurnFeel` |
| `releaseResolve` (1.96 s) | `V2ReleaseCompletion.tsx:174` once per ending | vol .6 | |
| Thread cues `threadSettle/Wake/StageChord_*/ReinforcedLow/FullStrengthChord/Reinforce/StageRelight` | `usePracticeCompletionScene.ts:436-437` (`playSettle`), once per session via `claimThreadSettle`; prewarmed 532-536 | vol .42-.9 | completion scene hook |
| Chart: `open`, `ink` (+ second stroke at 0.45 of draw, vol .75 rate .95), `flag`, `wind`, `waypoint_1-3`, `move-done`, `ink-hold`, `stamp`, `summit-thud`+`summit-chord` (+20 ms), `air` loop | `components/v2/chart/useChartSound.ts`; beats from `chartMapSequences.ts` | rate jitter 0.97-1.03; air 0.9 (ducked .45; in 800 ms, out 400 ms, duck down 120 ms up 600 ms); `note` and `stamp` duck 1300 ms; summit ducks 2200 ms | `useChartSound` (pool for one-shots, managed player for air) |

### Session audio (non-pool)
| Audio | Where | Parameters | Owner |
|---|---|---|---|
| Visualize guided track (Glimpse 65.2 s, Immerse 200 s, Embody 615 s; Dominic/Lina) | `useGuidedPlayback.ts:115-128` | vol 1 (0 when voice none), clock = `player.currentTime` every 50 ms, state publish 100 ms, exit fade 5 steps/300 ms, status settle 600 ms | `useSessionAudio` inside the hook |
| Focus mix 10/30/60 s | `V2FocusActiveScreen.tsx:417-444` | created at first tick after clock start; seeks if late > 1 s; gain 1 | `useSessionAudio` |
| Focus ambient (`focus-session-ambient.mp3` loop) | `V2FocusActiveScreen.tsx:272-281` | vol .14; bumped to .04 on completion | |
| Deep Focus mix 2/5/10 min | `V2DeepFocusActiveScreen.tsx:96-106` | created at first 250 ms sample, seeks if `time > 1` | |
| Deep Focus ambient | `V2DeepFocusActiveScreen.tsx:75-82` | loop, vol from `deepFocusVisualAt().ambientGain` every 250 ms; end fade 0.45 s | |
| Voice preview | `VoicePreviewService.ts` | `focus-session-30s-start` (female gain 1, male .415) | service singleton |
| Legacy: ritual `prime-begin` loop, `haptic-tone`, `prime-complete`, `forge-seal`, `letter-drop` | `useRitualController.ts`, `LetterDistillationScreen.tsx`, `ManualReinforcementScreen.tsx`, `FirstPrimeCompleteScreen.tsx` | V1 flows | `useAudio` managed |
| Notification sound | `NotificationService.ts:33`, `app.json` plugin | `notification.wav` 3 s (iOS) | OS |

### Haptic cues
| Moment | File:line | Type / timing |
|---|---|---|
| Focus begin | `V2FocusActiveScreen.tsx:293` | selection on tap |
| Focus completion | `531-539` | Success notification at +240 ms (immediate under reduced motion) |
| Deep Focus start / end | `V2DeepFocusActiveScreen.tsx:72-74,120` | selection at first sample; selection at `complete()` |
| Visualize seal | `V2CinematicSessionScreen.tsx:249-253` | Success confirmation once, within 1500 ms of `plan.sealAtMs` |
| Release hold | `useReleaseHold.ts:114-119` | selection x6 over 1800 ms sampled every 50 ms; completion Medium (`V2ReleaseScreen.tsx:117`) |
| Release burn | `useReleaseBurnFeel.ts:17-28,44-52` | swell from 220 ms to `emptyPause - 160` ms: gaps 300 -> 95 ms, Light/Medium/Heavy at 35%/72% (not in reduced motion) |
| Release settle | `V2ReleaseCompletion.tsx:175` | Light once |
| Creation | `AnchorCreationFlowScreen.tsx:323-328` `tick()` min gap `MIN_HAPTIC_GAP_MS`: Light at t = 0.03 s, per distill/map event, craft cues (Light/Medium), settle Medium | |
| Choose seal hold | `useChooseController.ts:146-158,207,165` | cadence 150 -> 50 ms, Light then Medium at half; Heavy at complete; Light at `finishSeal` |
| Vision seal hold / ceremony | `VisionSealHold.tsx:33,38`; `VisionCeremony.tsx:359-364`; `VisionEntrance`; `VisionPrint.tsx:140`; `VisionArrivalSet.tsx:48`; `VisionBoardPhoto.tsx:87` | Light at begin, Light at 400 ms, Heavy at stamp (first image), Medium on first non-first landing, Light on print/pin |
| Seal medallion (onboarding) | `SealMedallion.tsx:84,96-99` | Light at begin; Light at 25%, Medium at 75% |
| Thread settle | `usePracticeCompletionScene.ts:438` | `timing.settleHaptic` impact |
| Chart | `ChartActiveView.tsx:273-289`; `ChartWaypointContent.tsx:276` | Light/Heavy beats, Light on move check |
| Wheels/carousel/boards | `TimeWheel.tsx:57`, `V2HomeAnchorCarousel.tsx:232`, `VisionBoard.tsx:83-214`, `V2TimePicker.tsx:35` | selection per detent |
| Share Studio | `AnchorShareStudio.tsx:118,132,136,145` | selection (layout), warning (failure), confirmation (success) |

Notes: all go through `safeHaptics`/`v2Haptics` (gated by global `hapticIntensity`), except legacy direct `Haptics.*Async` calls in V1 screens (`useRitualController`, `SealAnchorScreen`, `ChargeCompleteScreen`, `LetterDistillationScreen`, `Toast.tsx` which is not imported anywhere) and `settingsStore.ts:582` `triggerHaptic` (fires Light on every setter, ignoring intensity).

---

## Audio ownership map (who creates / releases players)

| Owner | Creates | Releases | Notes |
|---|---|---|---|
| `SoundPool` (`services/audio/SoundPool.ts`) | `createAudioPlayer` in `createEntry` (187), cap 24 live players | `disposeEntry` (97-116: pause, remove, release), `releaseEntry` (pause; dispose if temporary/discard), eviction, `releaseIdle(keys)`, settings subscription (41-56, releases only busy entries when effects turn off) | One module-level pool, no ref-counting (B-19); loops are pooled entries |
| `CreationSounds.playCreationSound` | via `SoundPool.play` | handle `.stop(fadeMs)` | Used by creation, Vision, Release, Home, onboarding, paywall, practice completion |
| `NodeToneService` | `SoundPool.register` + prewarm `node:*` | `releaseIdle(TONE_KEYS)` | `prepare` ignores its `cells` argument |
| `useChartSound` | pool one-shots; `createManagedPlayer('chart-air')` | `releaseIdle(cues)` on unmount; air ramp/stop | Two instances (intro, active view) share keys |
| `useAudio` (`hooks/useAudio.ts`) | managed players for loops (`createManagedPlayer`), one-shots go to `SoundPool.playSound` | `cleanupAllPlayers` on unmount or when effects are disabled | Mount sets mode `'effects'` |
| `useSessionAudio` (`hooks/useSessionAudio.ts`) | `createSessionAudioPlayer` (per cue, per bed, per guided track) | `cleanupAllPlayers` + mode `'effects'` on unmount; per-player `stop`/`onFinish` cleanup | Mount sets mode `'session'`, hydrates remote cache |
| `useGuidedPlayback` | one player at mount (`enabled !== false`), plays at `start()` | `stopAudio` (fade) on early end; otherwise `useSessionAudio` unmount | Prepare pass creates none |
| `V2FocusActiveScreen` | ambient on clock activation, one voice player per cue | `stop()` on end/unmount; pause on AppState/pause | `voicePlayerRef` replaced per cue |
| `V2DeepFocusActiveScreen` | ambient + mix from `sampleAudio` | `stop()` in `complete`, `handleEndEarly`, unmount | |
| `VoicePreviewService` | singleton `activePlayer` | `stopVoicePreview` | Race B-12 |
| `AudioSession` | none | n/a | Serialised mode queue (`'effects'` / `'session'`) |
| Legacy: `FocusSession`, `useDeepPrimeSessionAudio`, `useVisualizeSessionAudio`, `MantraCreationScreen` (`AudioModule` direct) | own players | own cleanup | V1 navigators only (`App.tsx:1065`) |

Native lifecycle owners that the above do not see: expo-audio auto-pauses on background and **auto-resumes** flagged players on foreground (B-01, B-02); iOS pauses on interruption and `oldDeviceUnavailable`, resumes with `shouldResume` (`ios/AudioModule.swift:347-440,461-477`); Android does none of the interruption handling in `mixWithOthers` mode (B-03).

---

## Checked and found clean

- **AudioSession queue**: `setAudioSessionMode` is serialised and swallows errors for the chain (`AudioSession.ts:9-31`); SFX `playsInSilentMode:false`, session `true`, background playback off. OK.
- **Voice mapping / wrong-voice**: `guideForVoice` male -> Dominic, else Lina (`visualizeBeatMap.ts:59-61`); `getGuidedTrackAsset(track, guide)` and beat map keyed by the same `plan.guide`; Focus/Deep Focus manifest builds Lina/Dominic mixes per session type and duration; prep and session fallbacks agree (`DEFAULT_SESSION_AUDIO_DEFAULTS` female + ambient; `V2PracticeSessionScreen.tsx:355-392`). `none` voice in Visualize intentionally follows Lina's map muted (documented in the hook).
- **Visualize clock**: audio position is the only clock (`useGuidedPlayback`); pause/resume, background, status-driven interruption, re-pause under Paused, `didJustFinish` repeated events (Android reports `didJustFinish` for every status in ENDED state; `beginCompletion` is latched by `completionStartedRef`), early-exit fade, completion latch, `AppState` listener cleanup. Beat-map/caption/duration constants match the manifest (60/180/600).
- **Focus/Deep Focus session clocks**: monotonic `performance.now()` with paused-time accumulation (`V2FocusActiveScreen.tsx:239-266`, `useDeepFocusSession.ts:12-39`); AppState pause; completion `doneRef` latch prevents double completion; timers cleared on unmount (`577-584`).
- **Release hold**: `useReleaseHold` clears its interval on end/unmount, ends on AppState != active, completion latched by `completedRef`, haptic steps monotonic (`lastHapticStepRef`), `reset()` easing change (uncommitted) is sound; `useReleaseBurnFeel.end` clears all swell timers and stops the cue on unmount/other stage.
- **Choose seal hold haptics**: recursive `setTimeout` cleared in `stopHaptics` on release, complete, unmount; re-checks `holdingRef`/phase before firing (`useChooseController.ts:140-158`).
- **Creation flow cues**: frame-clocked with clamped `dt`, `firedEventsRef` once-only, foreground guard (`foregroundRef`), bed and craft sounds stopped on background and unmount (`AnchorCreationFlowScreen.tsx:349-363`).
- **VisionCeremony**: all `later()` timers are cleared and `alive`-guarded on unmount; bed gated on foreground; keys re-prewarmed on beat/foreground.
- **Thread/celebration layer**: settle cue once per session via `claimThreadSettle`; scenes remount-safe via `playedScenes`; thread events and Home arrival add no extra sounds or haptics beyond the cue inventory.
- **Share Studio** haptics (selection/warning/confirmation) are single-fire per action.
- **Remote audio cache** correctness: size-checked temp file, hashed names, deduped downloads, fallback to streaming.
- **Fade-in/stop-with-fade token safety** in `SoundPool` (`token` checks in fade timers; stop closure follows the retry entry).
- **iOS interruption/route handling** for session audio is provided by expo-audio (pause on interruption began and `oldDeviceUnavailable`).
- Unused/dead (no finding): `Toast.tsx` haptics (component not imported), `SliderSetting`/`ToggleSetting` direct haptics (only referenced by themselves), `ConfirmModal` etc.

## Not covered / limits
- No audio or haptic latency, CPU or frame numbers were measured; all severities rest on source reading plus asset analysis. Everything marked Android needs an Android device run; iOS ordering claims (B-17) need a device with the ringer switch.
- Legacy V1 flows (RitualScreen, ActivationScreen, FocusSession, VisualizeSessionScreen/engine, Mantra, Deep Prime hooks) were only skimmed for loop assets and shared-hook behaviour; they render only when the V2 flag is off.
- Onboarding cinema/splash audio: the only audio found is `onboardingSealed` on `V2SealedSaveScreen`; no separate cinema soundtrack player exists in `src` (no `createAudioPlayer`/`useAudioPlayer` outside the files listed in the ownership map).
