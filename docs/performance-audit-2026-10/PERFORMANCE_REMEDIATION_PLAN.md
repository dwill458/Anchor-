# Anchor 2.0 Performance Remediation Plan

Date: 2026-10-12. Source of truth for every ID: `PERFORMANCE_AUDIT_REPORT.md`. **Nothing in this plan has been implemented; it needs approval before any production code is edited.** The plan does not remove, shorten or simplify any animation, blur, particle, fog, glass layer, imagery, haptic or audio cue, and it keeps Reduce Motion intact. Every fix below keeps the experience inventoried in `MOTION_AND_AUDIO_PRESERVATION_CHECKLIST.md`.

**Effort figures are rough order-of-magnitude estimates for one engineer, not commitments, and are not performance promises.** No performance improvement is claimed anywhere in this plan; acceptance is by measurement against the Phase 0 baseline.

## 1. Why a Phase 0 was added

The brief's five phases assume numbers to compare against. None exist: the root performance docs are stale (all baselines "TBD") and the only runtime data is from a DEBUG dev-client build. Without a release baseline, "fixed" cannot be proven and dev-mode artifacts (inflated JS stalls) could be mistaken for defects. **Phase 0 (baseline and instrumentation) therefore blocks acceptance of every later phase.** It involves no product-code change.

A second ordering decision: **persistence fixes (Phase 1) land before rendering work (Phase 2) is profiled.** The 1.5 s JS stalls per Details open (PERF-012) and the Focus jank (PERF-016) were observed while a SecureStore queue was demonstrably backed up (PERF-002). Whether that contention contributes is unproven, but profiling Phase 2 targets on a build that still has the backlog risks chasing the wrong cause.

## 2. Root-cause clusters

| Cluster | Shared cause | Issues |
|---|---|---|
| RC-1 | Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths | PERF-002, PERF-003, PERF-004, PERF-029, PERF-036, PERF-088 |
| RC-2 | Account/guest state integrity across startup, creation and hydration | PERF-001, PERF-006, PERF-008, PERF-035, PERF-039, PERF-076, PERF-077, PERF-078, PERF-082 |
| RC-3 | Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter | PERF-005, PERF-030, PERF-031, PERF-034, PERF-040, PERF-075, PERF-080, PERF-087 |
| RC-4 | Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight) | PERF-012, PERF-013, PERF-014, PERF-054, PERF-055, PERF-056, PERF-057, PERF-067 |
| RC-5 | Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class) | PERF-015, PERF-016, PERF-017, PERF-018, PERF-019, PERF-020, PERF-022, PERF-023, PERF-051, PERF-053, PERF-061 |
| RC-6 | JS-clock-driven visuals and cues running parallel to UI-thread animation | PERF-021, PERF-048, PERF-052, PERF-060 |
| RC-7 | Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering | PERF-010, PERF-041, PERF-042, PERF-043, PERF-044, PERF-045, PERF-046, PERF-047, PERF-062, PERF-063, PERF-064, PERF-065, PERF-066, PERF-068, PERF-069, PERF-070, PERF-071, PERF-072 |
| RC-8 | Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory | PERF-009, PERF-025, PERF-026, PERF-027, PERF-028, PERF-032, PERF-049, PERF-050, PERF-058, PERF-059, PERF-089 |
| RC-9 | Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene) | PERF-007, PERF-011, PERF-024, PERF-033, PERF-037, PERF-038, PERF-073, PERF-074, PERF-079, PERF-081, PERF-083, PERF-084, PERF-086 |
| RC-10 | Startup concurrency and observability cost | PERF-085 |

Fixing at the cluster level matters: PERF-002/004/029/088/036 are one persistence project, not five patches; PERF-010/041/042/068/070 are one audio-lifecycle change in `useSessionAudio`, `SoundPool` and `AudioSession`; PERF-015/018/023/053/061 are one rule ("animate transform/opacity, never layout props, on the hot path") applied five times; PERF-021/060 are one rule ("cues and clocks follow the UI-thread animation or the audio position, not a parallel JS timer").

## 3. Shared infrastructure to build once

- **Versioned persistence adapter:** generation-swap writes (PERF-004), bulk store off SecureStore with a small SecureStore key/index (PERF-002), per-class queues so auth keys never wait on bulk writes, debounce + dedupe for every store including auth (PERF-029), per-record diffing, migration runner that reads the legacy chunked keys once.
- **Bounded persistence gate:** a helper `withStorageDeadline(promise, ms, fallback)` so completion/save UI never awaits storage unboundedly (PERF-003); a visible "pending save" state.
- **ApiClient taxonomy:** default 20-30 s timeout, per-endpoint overrides for generation/export, `ECONNABORTED` vs offline error codes, one 401 refresh-then-sign-in path, jittered retry for idempotent GETs (PERF-040, 005, 033, 034, 030).
- **Session audio guard:** `wantPlaying` intent in `useSessionAudio` + pool status listener that re-pauses unrequested playback + AppState active re-assert (PERF-010, 041); `ready` promise and session-ownership counter in `AudioSession` (PERF-068); `fadeOutAndStop(player, ms)` shared by every exit (PERF-063); per-key retrigger policy and ref-counted prewarm in `SoundPool` (PERF-047, 070).
- **UI-thread cue scheduler:** `useAnimatedReaction` threshold crossings that `runOnJS` a cue/haptic/phase trigger, with the existing JS timer kept as the completion fallback (PERF-060, 021).
- **Focus-gated animation helper:** one hook that starts a loop only while the screen is focused and the feature is visible and cancels on blur (PERF-019; reuse `useScreenFocused` from `ChartMapWeather`).
- **Reduce Motion store:** module-level value + `useSyncExternalStore`, read once at app start (PERF-024).
- **Transition context split:** stable actions/shared-values context + small flight-state context; artwork hide via shared value (PERF-013).
- **Image pipeline:** stable (bucketed) presigned URLs, `file://` cache keyed by asset id, thumbnail derivatives at 2x display size, server-side resize on upload (PERF-009, 026, 027, 032, 049).
- **Perf harness:** the gfxinfo/meminfo/logcat scripts E used, packaged in `scripts/perf/` with a scenario list, a frame-capture blank-frame detector (the 2026-09-28 method), and a Perfetto config; run on every release candidate.

## 4. Phases

### Phase 0: Baseline, instrumentation and repro (new; no product code)

1. **Exact problems addressed.** The absence of any release baseline; the unverified runtime claims. Re-measure the seven runtime-observed items on a release build to ratify or retire them: PERF-002, 003, 012, 016, 017, 025, 050. Reproduce on a device: PERF-001 (guest cold start), 010 (Focus audio under Paused), 041, 042, 011 (Auth NPE, 20 cold opens), 005 (blackholed API), 024 (Reduce Motion first render).
2. **Required changes.** None to product code. Produce an EAS non-debug build (`developmentClient:false`, release signing or `buildType: apk`; local Gradle is unusable on this machine because of MAX_PATH). Add `scripts/perf/` (harness) and a docs baseline file.
3. **Shared infrastructure.** The perf harness above.
4. **Dependencies.** EAS build credentials/minutes; physical S24 Ultra (available); a mid-range Android and an iPhone with Instruments access (not available in this environment, see `DEVICE_VALIDATION_MATRIX.md`).
5. **Risk.** None to the product. Risk to the plan: a release build may show some Phase 2 items are not real; that is the intent.
6. **Automated tests to add.** None required; commit the harness scripts and a README. Run the existing jest suite once to record the pre-fix pass/fail state (535 test files; `AuthHydrationService.test.ts` is already known to fail).
7. **Manual device tests.** The scenario list in the matrix on S24 release at 120 Hz adaptive and forced 60 Hz; unplugged thermal soak (15 min Focus + Visualize); 20-cycle memory loops per flow from a fresh process.
8. **Completion criteria.** Baseline table filled for every scenario with build type, refresh rate, battery/thermal; each runtime-observed issue marked ratified/downgraded/retired; targets in section 5 ratified or replaced by numbers derived from the baseline.

Estimate: S (2-4 engineer-days, mostly build/queue time).

### Phase 1: Critical stability and data integrity

1. **Exact problems addressed.** 30 issues:
  - PERF-001 [P0] Cold start wipes a guest's Anchor and replays onboarding
  - PERF-002 [P1] Vault persisted through SecureStore in 400 chunks: one write took 32.8 s and queued the auth cache behind it
  - PERF-003 [P1] Focus completion screen ("Well done / Let it settle") never advanced (observed once, >2.5 min)
  - PERF-004 [P1] `writeSecureValue` deletes the old chunks before writing the new ones (non-atomic)
  - PERF-005 [P1] Startup can hang on a stalled `/api/auth/sync` (no timeout, fail-open gated on the same call)
  - PERF-006 [P1] Guests cannot record a practice session
  - PERF-007 [P1] "Export My Data" calls `/auth/me/export`, which does not exist (server route is `/api/auth/me/export`)
  - PERF-008 [P1] A failed server save still "succeeds" locally: phantom Anchor that is never uploaded
  - PERF-011 [P1] `entering=` layout animations on first mount of native-stack routes match the known react-native-screens Android NPE class
  - PERF-029 [P2] authStore writes its whole persisted blob to SecureStore on every `set()` (no debounce, no dedupe)
  - PERF-033 [P2] Release "confirming" state can lock the screen for up to 120 s with no exit
  - PERF-034 [P2] Anchor create/seal can freeze for minutes; creation back is locked meanwhile
  - PERF-035 [P2] Pending first-anchor finalization POST has no idempotency key
  - PERF-036 [P2] No connectivity listener; V2 never drains the practice/scene write queues
  - PERF-037 [P2] Store success can dead-end ("still being confirmed"); dismiss is not disabled while a purchase runs
  - PERF-038 [P2] One whole-app boundary with legacy styling; "Try Again" remounts the entire tree and loses navigation and in-flight state
  - PERF-039 [P2] Hydration commit can overwrite newer local state (create/release during an in-flight hydration)
  - PERF-040 [P2] Every request defaults to a 120 s timeout; 401 has no recovery; slow and offline are indistinguishable
  - PERF-073 [P3] Any HTTP 409 on Release is treated as "already released"
  - PERF-074 [P3] A cold-start notification tap can be stranded
  - PERF-077 [P3] Duplicate `/api/auth/sync` and hydration on every interactive sign-in
  - PERF-078 [P3] `evolvedFrom` is recorded only on the local successor
  - PERF-079 [P3] Single dialog slot: a second alert silently drops the first's callbacks; the cancel handler is dropped for 3+ buttons
  - PERF-081 [P3] Guard gaps: fallback runs before the in-flight latch; unhandled rejection; arrival expiry armed only after the pop
  - PERF-082 [P3] Store rehydration is not gated by startup readiness: a returning guest can see a first-run flash
  - PERF-083 [P3] `void pendingSave.then(...)` / `void pending.then(...)` have no `.catch`
  - PERF-084 [P3] Legacy paywall params in V2: wrong copy and no resume after purchase
  - PERF-086 [P3] Dead/misleading route registrations
  - PERF-088 [P3] Persisted read models contain expiring presigned URLs and are rewritten on every fetch
  - PERF-009 [P1] backend half only (server-side resize on upload; OTA-safe). The client multipart half stays in Phase 4.

2. **Required code changes, in this order.**
   1. **PERF-001** (guest wipe): guard the `!firebaseUser` branch and the `App.tsx:603-623` effect so the destructive `signOut()` runs only when a persisted account exists. Small, independent, highest severity: ship first. Add PERF-082 (gate readiness on `authStore`/`firstRunStore` hydration) in the same change so a returning guest never sees a first-run flash.
   2. **Persistence project (PERF-002, 004, 029, 088, 036, 003):** build the versioned adapter; move the vault (and Chart/Vision read models) off SecureStore chunks; write generation-then-swap; debounce/dedupe `authStore`; separate queue for auth keys; drain the practice/scene write queues from `AnchorV2Navigator` on launch, AppState active and reconnect, serialised with a promise chain; stop gating the Focus completion UI on storage (`withStorageDeadline` + pending state).
   3. **Network bounds (PERF-040, 005, 033, 034):** ApiClient taxonomy; 8-10 s timeout on `/api/auth/sync` with an offline fallback and fail-open that does not depend on the same call; 15 s release POST with the existing retry UI; 20-30 s create POST with a stable idempotency key.
   4. **Creation/guest correctness (PERF-008, 035, 006, 039, 077):** failed authenticated saves become `failed` + retry with the same key instead of a phantom local Anchor; add the idempotency key to the first-anchor finalize POST; a guest-local account id for practice completion re-keyed on sign-up; per-anchor revision guard in hydration; skip duplicate sync on interactive sign-in.
   5. **Failure recovery and hygiene (PERF-007, 011, 037, 038, 073, 074, 078, 079, 081, 083, 084, 086):** fix the export URL; replace first-mount `entering` in Auth/SealedSave with shared-value fades after `transitionEnd`; paywall unconfirmed-purchase subscription and dismiss gating; route-level boundaries with a V2 fallback; 409 mapping; notification drain loop; dialog queue; handoff guards and `.catch`; paywall param adapter; dead routes.
   6. **PERF-009 backend:** `sharp` resize/re-encode in `/api/v2/assets/upload` (long edge 2048, JPEG q88).
3. **Shared infrastructure.** Persistence adapter, bounded persistence gate, ApiClient taxonomy.
4. **Dependencies.** Phase 0 (to confirm PERF-001/002/003/005 on release before the migration is designed against dev numbers). Within the phase: PERF-004 (atomic write) must land with or before the PERF-002 migration so the migration itself cannot corrupt state; PERF-029 and PERF-088 ride the same adapter.
5. **Risk to existing behaviour.** Highest in the plan. Storage migration can lose data if the order is wrong (mitigation: write new, verify, flip pointer, delete old; ship behind a flag; keep the legacy reader for two releases). Changing creation failure semantics (PERF-008) changes what users see on a bad network. `doNotMix`-style behaviour changes are not in this phase.
6. **Automated tests to add.** Guest cold-start listener test (seed guest + anchor, fire `null`, assert untouched); SecureStore mock that throws after K calls with the previous value still readable; migration test from a 719 KB chunked fixture; `useAppStartup` with `authRestorationSettled=false` and a persisted user; practice completion with no user and with a hung persistence promise; `useSaveAnchor` rejected POST asserts no `addAnchor`; finalize payload contains the key; release adapter 409 mapping; `flush` interleaving; export URL; paywall unconfirmed-then-flip; throwing-child boundary test.
7. **Manual device tests.** Guest finish, kill, relaunch (Home with the Anchor); mid-onboarding kill and resume; 72-Anchor account cold start on release (`app-ready` vs hydration gap); kill the app during a vault write 20 times and relaunch; blackholed API launch; throttled create and release; 10 s Focus x 10 with completion always advancing; guest session then sign-up (history uploaded once); export on an account with an image Anchor.
8. **Objective completion criteria.** No reproducible P0/P1 in this list under the documented conditions; `app-ready` is not gated by any storage write (hydration-to-ready gap <= 500 ms on the 72-Anchor account, release build); no single secure write > 1 s and no auth-key wait > 250 ms; 0 data loss across 20 forced kills; 20/20 Focus completions advance within 1 s of the end; guest Anchor survives 10 relaunches.

Estimate: XL (15-25 engineer-days; the persistence migration is the long pole).

### Phase 2: Rendering and frame pacing

1. **Exact problems addressed.** 25 issues:
  - PERF-012 [P2] Each Details open: ~1.5 s of JS-thread stalls, 31-35 skipped main-thread frames on 13 of 15 opens, 250 ms p99 frame
  - PERF-013 [P2] Transition context changes 3-5 times per flight; every consumer re-renders and the hide/show hand-off waits on a JS commit
  - PERF-014 [P2] First Chart-card mount draws 3 tiles on the JS thread, then PNG-encodes 3 images synchronously
  - PERF-015 [P2] Sheet drag/snap animates `top`, `left`, `width`, `height`, `fontSize`, `lineHeight` every frame (provisional P2; escalate to P1 if measured)
  - PERF-016 [P2] Focus session runs far below display rate: 38% janky, p50 20 ms, 376 slow bitmap uploads
  - PERF-017 [P2] Vision board scroll is janky: 25.6% janky, p50 13 ms, 43 missed vsync
  - PERF-018 [P2] Every photo animates `left/top/width/height` in 4 styles during recompose and swap settle
  - PERF-019 [P2] Perpetual flag sway redraws the whole overlay canvas (dashed route, path effects) every frame, even with no flag and after blur
  - PERF-020 [P2] Runtime-shader cloud mask recomputed every frame although the mask inputs are static at rest
  - PERF-021 [P2] UI-thread clock is fed by a 50 ms JS `setInterval`; a JS stall freezes then snaps the camera; screen re-renders at 10 Hz; seal haptic keyed to that render
  - PERF-022 [P2] Full-viewport save-layers and blend rects recorded every frame even at opacity 0
  - PERF-023 [P2] Layout-prop and SVG-prop animation, double text write, replay on every focus
  - PERF-024 [P2] Reduce Motion hooks start `false`, resolve asynchronously and are instantiated 107 times
  - PERF-050 [P3] Carousel switching shows jank bursts and slow bitmap uploads
  - PERF-051 [P3] 120 Hz is requested only in the creation flow (decision item: do not enable app-wide before the per-frame costs are fixed)
  - PERF-052 [P3] Ring progress restarts an 850 ms ease-in-out every second (stop-start crawl)
  - PERF-053 [P3] Release hold fill animates a percentage `width`
  - PERF-054 [P3] Burn texture built on the JS thread at 60% of the hold (CPU raster + `readPixels` + a JS pixel loop)
  - PERF-055 [P3] Registers two `useAnimatedStyle` hooks and a shared value per instance even when no entrance is used
  - PERF-056 [P3] `carouselMoving`/`homeMotionActive` state re-renders Home at drag start and rest solely to gate the teaching queue
  - PERF-057 [P3] JS `onScroll` every 16 ms and a scroll-begin re-render
  - PERF-060 [P3] Sound/haptic cues and phase flips ride JS `setTimeout` chains parallel to UI-thread animations
  - PERF-061 [P3] Spotlight animates five scrim views by `left/top/width/height`
  - PERF-076 [P3] Navigator `key` changes mid-flow and remounts the whole stack, including the seal-to-coin continuity
  - PERF-085 [P3] Many startup tasks run inside the splash window; per-request traces; error handlers installed only after first render

2. **Required code changes, in work-package order.**
   - **2.1 Attribute first.** On the release build capture Perfetto traces of one Home to Details open, one Focus second-by-second, one Vision board scroll. Decide which candidate causes in PERF-012/016/017 are real before touching them.
   - **2.2 Transition architecture (PERF-013, 014, 054, 055, 056, 057, 085, 076):** split the transition context; shared-value artwork hide; pre-bake the three cloud tiles as bundled PNGs (pixel-diff against the runtime renderer, keep a fallback); prepare the Release burn texture at idle; split `CircularAnchorRenderer`; move Home/Progress scroll/teaching flags off React state; defer non-visible Details sections past `V2_TRANSITION_SETTLE_MS`; stop remounting the navigator on `firstRunStep` changes.
   - **2.3 Layout props to transform (PERF-015, 023, 053, 061, 018, 052):** Details sheet title/header/practice card; Thread Strength clip and single text path; Release hold fill `scaleX`; spotlight scrim; Vision board photos (last, highest risk); Focus ring one linear timing.
   - **2.4 Skia gating (PERF-019, 020, 022):** focus-gate and visibility-gate the flag sway (minimum), then move the flag out of the overlay canvas; bake the cloud mask when idle; gate Visualize layers by segment kind.
   - **2.5 Clocks (PERF-021, 060):** anchored UI-thread extrapolation for Visualize; UI-thread threshold-crossing cues for creation, Release burn, Vision seal.
   - **2.6 Jank cases found only at runtime (PERF-016, 017, 050):** after 2.1, fix the re-uploaded bitmap in the Focus field and the per-frame masks on the Vision board (candidates only until traced).
   - **2.7 Reduce Motion (PERF-024)** early in the phase (small, accessibility-critical), and **2.8 refresh-rate policy (PERF-051) last**, enabling high refresh per motion-heavy route only after the frame budget holds at 60 Hz with headroom.
3. **Shared infrastructure.** Transition context split, focus-gated animation helper, UI-thread cue scheduler, Reduce Motion store, perf harness.
4. **Dependencies.** Phase 0 (traces and baseline) and the Phase 1 persistence project (to remove the suspected storage-queue contention from the profile). PERF-051 depends on all other items in this phase.
5. **Risk to existing behaviour.** PERF-013 touches the most-tuned code in the app (blank-frame history, watchdog 900 ms, Jest rAF no-op); PERF-018 is the most intricate gesture component; PERF-020/022 can pop at handover boundaries; PERF-021 changes the clock that beat maps depend on. Each is done one at a time behind recordings.
6. **Automated tests to add.** Transition: shared-value hide/show fires in the same tick as copy mount/removal, `reset()` fallback when frames never run, watchdog; Visualize clock: extrapolation drift bound under an injected 300 ms stall, pause/resume/seek; layer-gating frame-compare at every segment boundary using the timeline fixtures; baked-vs-live cloud mask pixel diff; cloud tile PNG vs runtime diff; sheet `resolveSheetLayout` end-state equivalence at the three snaps; Reduce Motion first render has the OS value; `visionBoardReorder` unit tests retained.
7. **Manual device tests.** S24 release, 120 Hz adaptive and forced 60 Hz: 30-transition Home<->Details loop with the blank-frame detector; carousel swipes/flicks; sheet drag at three snaps; Focus 10 s and a long Deep Focus; Visualize 3 min with an injected JS stall; Vision board scroll/recompose/swap with 6 photos; idle Chart for 5 min with and without a flag; Reduce Motion on/off across every changed screen; mid-range Android and an iPhone for the transition and Focus.
8. **Objective completion criteria.** Against the ratified baseline: blank-frame detector 0 on 30 transitions; no `Choreographer: Skipped N>=10` in a 30-transition loop; no JS stall > 100 ms inside the flight window; janky-frame share and slow-bitmap-upload counts on the core scenarios at or under the ratified targets (section 5); idle Chart shows no per-frame canvas redraw under a covering route; recorded motion matches the preservation checklist (durations, easing, end states).

Estimate: XL (15-25 engineer-days).

### Phase 3: Audio, haptics and synchronization

1. **Exact problems addressed.** 20 issues:
  - PERF-010 [P1] Android: Focus and Deep Focus ambient and narration resume under the Paused overlay after backgrounding
  - PERF-041 [P2] Looped pool cues (`formBed`, `sealRise`) playing at background time are revived natively and orphaned
  - PERF-042 [P2] No audio focus and no "becoming noisy" handling: calls, other media and headphone unplug do not pause narration
  - PERF-043 [P2] Ambient toggle does nothing in Visualize, and "Ambient: Off" is ignored in Focus/Deep Focus when a voice is selected
  - PERF-044 [P2] Sound off then on desyncs the full-length narration mix (resumes behind the session clock)
  - PERF-045 [P2] Toggling Sound in the Paused overlay starts audio while paused
  - PERF-046 [P2] A pooled player keeps the previous play's playback rate, so default plays come out at a stale pitch
  - PERF-047 [P2] Re-triggering a one-entry pooled cue builds a cold temporary player instead of reusing the oldest
  - PERF-048 [P2] End-of-session truncation of the finished mixes and a nondeterministic completion cue
  - PERF-062 [P3] `seekTo(0)` before every one-shot, un-prewarmed cues, and cold players after `releaseIdle`
  - PERF-063 [P3] Abrupt stops (no fade) at several exits, and JS-timer volume fades
  - PERF-064 [P3] Rapid taps or sheet close can leave an orphan preview playing (double voice)
  - PERF-065 [P3] Session Haptics toggle is dead when global intensity is 0; selection/notification are not scaled by intensity
  - PERF-066 [P3] Haptic calls are unthrottled on wheels, carousel and the Choose seal hold
  - PERF-067 [P3] Prewarming 16 players during the Intention-to-creation hand-off adds main-thread work
  - PERF-068 [P3] Audio-session mode is last-writer-wins across mount/unmount effects; completion cues use a different silent-switch policy than the session
  - PERF-069 [P3] Channels carry no custom sound (the branded wav only affects iOS and Android < 8); verify intent
  - PERF-070 [P3] Pool keys are released by several owners with no ref-counting
  - PERF-071 [P3] Cache hydration is fired but not awaited before player creation
  - PERF-072 [P3] Loop-point and tail quality: MP3 loops may gap ~25 ms on Android; legacy loops click

2. **Required code changes.**
   - **3.1 One lifecycle guard (PERF-010, 041, 042, 068):** `wantPlaying` + re-pause in `useSessionAudio` and the `SoundPool` status listener; AppState active re-assert; `interruptionMode` per mode (`doNotMix` for `session` on Android, `mixWithOthers` for effects; becoming-noisy via a small patch-package patch or route listener); `ready` before first `play()`; a session-ownership counter so `stopVoicePreview` cannot downgrade the mode.
   - **3.2 Session controls (PERF-043, 044, 045, 048, 063):** honest ambient UI where the voice mix includes the bed; `seekTo(readElapsed())` or volume-mute on un-mute; no `play()` while paused; fade rather than `stop()` at session end and on exits; deterministic completion cue from `onFinish`/position.
   - **3.3 SoundPool correctness (PERF-046, 047, 062, 067, 070, 071):** track and reset playback rate; per-key retrigger policy; skip redundant `seekTo(0)`; targeted prewarm spread after interactions; ref-counted key ownership; await cache hydration.
   - **3.4 Haptics (PERF-065, 066):** session-explicit haptics bypass, leading-edge limiter.
   - **3.5 Remaining (PERF-064, 069, 072):** voice-preview request id; Android channel sound decision; gapless loops if audible.
3. **Shared infrastructure.** Session audio guard, `fadeOutAndStop`, UI-thread cue scheduler (from Phase 2).
4. **Dependencies.** Phase 0 device repro of PERF-010/041/042. PERF-043 and PERF-042 need product decisions (section 7). PERF-021/060 from Phase 2 for cue timing.
5. **Risk to existing behaviour.** `doNotMix` stops the user's own music when a session starts (conventional, but a behaviour change). Restarting a pooled cue can truncate its tail (per-key policy). The `wantPlaying` guard must not fight the Visualize fix already in `useGuidedPlayback`. Nothing is removed or shortened.
6. **Automated tests to add.** Wrapper emits `{playing:true}` while `wantPlaying=false` and expects `pause()`; fake-player `seekTo` on un-mute; paused toggle does not `play()`; SoundPool: rate 1.3 then 1 sets rate 1, retrigger policy per key, ref-counted release, live-player cap; deferred `setAudioSessionMode` voice-preview race; sheet combination matrix (voice x ambient x session); `safeHaptics` intensity 0 with the bypass option and the limiter; waveform/duration tests for session end (tail faded, cue fires once).
7. **Manual device tests.** Android: background/return matrix for Focus 60 s, Deep Focus 2 min, ambient-only, voice-only; incoming call, Assistant, YouTube, earbud unplug, Bluetooth off during Visualize Immerse; second creation run for `distillTick` pitch. iOS: ringer switch on/off through prepare to session to completion cue. Record device output for Focus 10 s and Deep Focus 2 min endings. 10-minute Embody drift check.
8. **Objective completion criteria.** 0 players `playing` while a session is Paused (checked via `dumpsys audio` and `sfxLog` after every foreground); 0 audio audible more than 300 ms after leaving the owning screen; narration/clock offset <= 100 ms at 10 min (position logging) after mute/unmute; completion cue fires exactly once per completed session; no haptic fires after cancellation; no cue in the preservation checklist changed in level, pitch, trigger moment or count.

Estimate: L (10-15 engineer-days; Android hardware matrix dominates).

### Phase 4: Resources and sustained performance

1. **Exact problems addressed.** 15 issues:
  - PERF-009 [P1] Photo uploads send the original camera file as inline base64, 8 in parallel, against an 8 MB JSON limit
  - PERF-025 [P2] A long-lived process sat at ~2.1-2.3 GB PSS with ~740 MB graphics and 470-610 MB swap; growth source not found
  - PERF-026 [P2] Small display, big bitmap: Vision method polaroids decode three 1920x1280 photos (9.8 MB each) for 104x128 dp slots
  - PERF-027 [P2] Presigned URLs change on every read so image caches never hit; private objects carry `Cache-Control: private, no-store`
  - PERF-028 [P2] Bundled 192 kbps "V4" mixes (95.9 MB) undid the 10-07 remote-audio / 128 kbps work; six `REMOTE_AUDIO_TRACKS` entries are now dead
  - PERF-030 [P2] Full account export every launch, two overlapping anchor-list calls, no response compression, 100 requests / 15 min limiter
  - PERF-031 [P2] Home prewarm re-requests the Chart for every neighbour on each swipe; its abort can cancel shared in-flight requests; every publish rewrites the Chart blob to SecureStore
  - PERF-032 [P2] Visualize cinematic fetches each photo up to three times
  - PERF-049 [P3] Anchor art stored as raw model output (PNG-labelled), no thumbnail or modern format
  - PERF-058 [P3] Full 1080x1920 export tree mounts 350 ms after every layout switch while previewing
  - PERF-059 [P3] A hidden second full session screen and board are mounted behind the setup page
  - PERF-075 [P3] Home refreshes Today, Vision and Chart on every AppState `active`, even when covered or recently refreshed
  - PERF-080 [P3] Stale response overwrite: overlapping polls are unordered; `useAnchorChart.refresh` can overwrite a newer published chart
  - PERF-087 [P3] Poll loops re-render every 2.5 s and have no in-flight guard
  - PERF-089 [P3] Whole-store subscriptions, startup fonts, unbounded small caches, unthrottled backend jobs, EAS archive bulk, duplicate audio cues, dormant ForgeDemo asset

2. **Required code changes.**
   - **4.1 Images:** bucketed presign signing date and immutable cache headers (PERF-027, 088); thumbnails at 2x display size for polaroids/avatars/previews (PERF-026, 049); `file://` cache keyed by asset id for Visualize (PERF-032); client resize + multipart upload with concurrency 2 (PERF-009 client half; needs a native build because `expo-image-manipulator` is not installed); lossless WebP and thumbnails for new Anchor art (PERF-049).
   - **4.2 Network:** pass fetched anchors into `fetchCompleteProfile`; take `/me/export` off the launch path; gzip; split limiters; per-call timeouts and retry; prewarm TTL + `peekAnchorChart`; Home foreground refresh recency check; poll in-flight guard and backoff; ordered-response guard (PERF-030, 031, 075, 087, 080).
   - **4.3 Memory:** find the screen that accumulates the 2.1-2.3 GB long-session PSS by looping each flow from a fresh release process (PERF-025); share or defer the second Visualize board (PERF-059); Share Studio prepare debounce (PERF-058).
   - **4.4 Bundle:** move the six long mixes (72.7 MB) back to the remote pipeline or re-encode to 128 kbps CBR (PERF-028); hygiene bundle (selectors, fonts at build time, LRU caps, generation semaphore, `.easignore`, duplicate cues) (PERF-089).
3. **Shared infrastructure.** Image pipeline; ApiClient taxonomy (from Phase 1).
4. **Dependencies.** Phase 0 baseline; Phase 1 persistence adapter (PERF-088); a native build for the client upload half and build-time fonts; product decisions on URL lifetime (PERF-027) and remote vs bundled audio (PERF-028).
5. **Risk to existing behaviour.** Longer-lived presigned URLs widen leak exposure (Vision from 1 h to up to 7 days unless a 1-day/6 h bucket is chosen). Moving long mixes remote makes first offline use require a prior download. Dropping the launch export needs a forced path for practice-history migration. Thumbnails must be >= 2x displayed pixels.
6. **Automated tests to add.** Two same-bucket presigned reads return identical URLs; upload resize (12 MP and 50 MP) stored <= 2048 px and no 413; `AuthHydrationService` request-count test; prewarm TTL; poll in-flight guard; remote-audio manifest hash and duration equality; thumbnail >= 2x pixel check in a build-time script.
7. **Manual device tests.** 20-cycle memory loops (Vision, Visualize, Chart, creation, Anchor switching) on a fresh release process; 8-photo upload on cellular; 30-minute scripted session with no 429; airplane-mode first use of remote audio; unplugged thermal/battery soak.
8. **Objective completion criteria.** PSS, graphics and Views flat within +-5% across 20 cycles of each flow; second cold launch makes 0 image requests for unchanged art; launch request count and bytes lower than the baseline; no 429 in 30 minutes; `expo export` asset size at or below the 2026-10-09 figure (76 MB) or a documented reason; upload of a 50 MP photo succeeds and Visualize reports `oversizedCount === 0`.

Estimate: L (10-15 engineer-days).

### Phase 5: Full visual-parity and behavioural regression

1. **Exact problems addressed.** Proof that optimisation did not change the experience: every item in the preservation checklist; Reduce Motion; accessibility; iOS parity (the audit had no iOS coverage).
2. **Required changes.** None to product code except fixes for regressions found. Add golden-frame fixtures for the signature moments (hero flight start/mid/end, sheet three snaps, creation seal, Release ignite, Visualize segment boundaries, Chart reveal) and waveform references for the ending/transition cues.
3. **Shared infrastructure.** Perf harness plus a frame-capture diff tool (the blank-frame detector extended with SSIM against golden frames).
4. **Dependencies.** Phases 1-4 complete; iOS device and Instruments access; a mid-range Android.
5. **Risk.** Low to the product; the phase exists to find regressions. Budget a fix loop.
6. **Automated tests to add.** Run the full jest suite (535 files) and tsc; add the golden-value tests listed in the checklist (timing constants frozen: `ANCHOR_TRANSITION_TIMING`, `FORM_TIMING.sheenPeriod` 2.6, `RELEASE_CEREMONY_TIMELINE_MS`, `PAYWALL_TIMING`, `CHART_CAMERA_TIMING`, `visionBoardMotion`).
7. **Manual device tests.** Full Phase 0 scenario list on S24 release (120 Hz adaptive and 60 Hz), a mid-range Android, and an iPhone; side-by-side recordings old vs new for every checklist row; Reduce Motion on; 30-minute soak; unplugged battery/thermal; a clean install through onboarding as guest and as an account.
8. **Objective completion criteria.** Every checklist row verified unchanged; all Phase 1-4 criteria still green on the release candidate; no new P0/P1; baseline-vs-final table published in `DEVICE_VALIDATION_MATRIX.md`.

Estimate: M (5-8 engineer-days plus fix loop).

## 5. Proposed acceptance targets (to be ratified in Phase 0; not measured improvements)

Nothing here is a benchmark result. These are proposed pass/fail rules; the numeric ceilings are starting proposals that Phase 0 replaces with baseline-derived values (rule: never worse than the baseline, and at or below the proposal).

| Area | Metric | Baseline source | Proposed target |
|---|---|---|---|
| Failures | Reproducible P0/P1 in release-critical flows | this audit | 0 |
| Navigation | Duplicate screens from repeated taps | E: 5 taps -> 1 navigation (dev) | 0 over 100 scripted rapid-tap runs |
| Transitions | Blank-frame flashes across transitions | frame-capture detector (2026-09-28 method) | 0 on 30 transitions per hero route |
| Transitions | `Choreographer: Skipped N>=10` per 30-transition loop | E: 13 of 15 Details opens skipped 31-35 (dev) | 0 on release |
| Transitions | JS stall > 100 ms inside the flight window | E: ~1.49 s total per open (dev) | 0 on release |
| Frame pacing | Janky-frame share (modern gfxinfo), core interactions (carousel, Home<->Details, Details scroll/sheet) | E table (dev): 5-10% | <= 50% of release baseline and <= 3% |
| Frame pacing | Janky-frame share, heavy ceremonial screens (Focus, Vision, Chart, Visualize) | E (dev): Focus 38%, Vision 25.6% | <= 50% of release baseline and <= 5% |
| Frame pacing | p99 frame time on core interactions | E (dev): 250 ms on every open | no frame over 100 ms; p95 within the display's frame budget at 60 Hz |
| Startup | `app-ready` minus store hydration | E (dev): ~31.7 s | <= 500 ms (no storage write in the critical path) |
| Startup | Time to interactive Home, cold, release | none (dev launcher only) | baseline, then never worse; fail-open <= 4 s on a stalled API |
| Storage | Longest SecureStore write; auth-key queue wait | E (dev): 32.8 s / 34.8 s | <= 1 s / <= 250 ms |
| Touch latency | Tap to first visual response | none | measure with high-speed capture; target <= 100 ms |
| Audio | Players playing while Paused/after leaving screen | none (B: code only) | 0; <= 300 ms tail after exit |
| Audio | Narration vs clock drift over 10 min incl. mute/unmute | none | <= 100 ms |
| Haptics | Fires per intended event; fires after cancel | none | 1; 0 |
| Memory | PSS / graphics / Views across 20 cycles per flow | E: flat on Home<->Details; long-session 2.1-2.3 GB | flat within +-5%; long-session graphics <= fresh-process baseline + agreed headroom |
| Network | Requests and bytes per launch; 429 in 30 min | none | lower than baseline; 0 |
| Animation | Persistent loops after owning screen exits (Chart sway, weather, Thread Strength) | none | 0 (verified by frame-callback/animation counters) |
| Thermal | Thermal status after 15 min unplugged Focus + Visualize | E: 0->1 plugged in | no throttling-induced jank increase over the session |

## 6. Recommended repair order

1. Phase 0 baseline and device repro (blocks everything).
2. PERF-001 guest wipe (+ PERF-082), PERF-007 export URL, PERF-009 backend resize, PERF-005/040 timeouts: small, independent, high value.
3. Persistence project: PERF-004 + PERF-002 + PERF-029 + PERF-088, then PERF-003 and PERF-036 on the new adapter.
4. Creation/guest correctness: PERF-008 + PERF-035, then PERF-006, PERF-039, PERF-077.
5. Release/paywall/boundary recovery: PERF-033, 034, 037, 038, 011 and the P3 recovery items.
6. Re-profile on release with the backlog gone; then Phase 2 in work-package order (2.2 transition, 2.3 transforms, 2.4 Skia, 2.5 clocks, 2.6 traced jank), Reduce Motion (PERF-024) early, refresh policy last.
7. Phase 3 audio lifecycle guard (PERF-010/041/042) first because it is one shared change, then session controls and SoundPool.
8. Phase 4 resources: images and URLs, launch fan-out, memory source, bundle.
9. Phase 5 parity regression and release candidate gate.

## 7. Decisions needed from the product owner before the affected work starts

- **PERF-002:** Where does bulk state live (AsyncStorage/MMKV/SQLite) and is encryption-at-rest of the Anchor vault required, or only of tokens/identity?
- **PERF-042:** Should Android session audio take audio focus (`doNotMix`: pauses the user's own music, pauses for calls)? Same question for iOS.
- **PERF-043:** What should "Ambient" mean when the selected guidance mix already includes its bed, and in Visualize with "No guidance"?
- **PERF-048:** Is the skipped Deep Focus completion cue intended? Should the Focus 10 s mix finish its fade?
- **PERF-027:** Acceptable Vision photo URL lifetime (1 h today; up to 7 days, or 1 day floored to 6 h).
- **PERF-028:** Were the 192 kbps V4 mixes bundled deliberately for offline reliability? Remote, or 128 kbps CBR?
- **PERF-023:** Is Thread Strength replaying its reveal on every focus intended?
- **PERF-052:** Is the stepped Focus ring (restart each second) intended, especially on 10 s sessions?
- **PERF-069:** Should Android notifications use the branded sound?
- **PERF-051:** Appetite for 120 Hz on motion-heavy routes once the frame budget holds (battery trade-off).
