# Anchor 2.0 Performance Remediation Plan

Date: 2026-10-12. Source of truth for every ID: `PERFORMANCE_AUDIT_REPORT.md`. The original audit changed no production code. The subsequent handoff authorizes PERF-001 implementation, non-destructive release baseline work, and a storage proposal only; migration and later remediation require approval. The dated execution record below tracks that work without replacing the original findings. The plan does not remove, shorten or simplify any animation, blur, particle, fog, glass layer, imagery, haptic or audio cue, and it keeps Reduce Motion intact. Every fix below keeps the experience inventoried in `MOTION_AND_AUDIO_PRESERVATION_CHECKLIST.md`.

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
2. **Required changes.** None to product code. Produce an identified non-debug build (`developmentClient:false`, release variant, profiling APK). The original audit reported a local Gradle MAX_PATH obstacle; the current offline dry run was inconclusive and does not confirm that cause. See `DEVICE_VALIDATION_MATRIX.md` section 6 for current build capability and artifact evidence. Add `scripts/perf/` (harness) and record results in the existing baseline table.
3. **Shared infrastructure.** The perf harness above.
4. **Dependencies.** EAS build credentials/minutes if using a cloud build, or a working local release build; an isolated physical Android profiling target. The audit used an S24 Ultra, but no Android device is currently connected. A mid-range Android and an iPhone with Mac/Instruments access remain unavailable; see `DEVICE_VALIDATION_MATRIX.md` section 6. The handoff authorizes non-destructive build/testing; publication is outside this pass.
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

## 8. Storage proposal for approval (2026-10-12; PERF-002/004/029/088, PERF-003 dependency)

Luna traced the current source and existing raw D/E evidence; the senior engineer required corrections to activation, legacy reading, key recovery, and rollback before accepting this proposal. **No storage implementation, dependency, schema, runtime, or migration has changed.**

### Current mechanism and evidence

`anchorStore.ts` persists the complete Anchor array, including SVG strings, intention text, metadata, and image URLs. The audit's 719,217 JSON characters across 72 Anchors (~10 KB each) are plausible from that shape; no owner data was read. `encryptedPersistStorage.ts` uses 1,800-character chunks, deletes old chunks before replacement, and clears mismatched chunks on reads. The generic adapter debounces 400 ms; auth's custom adapter and direct SecureStore helpers bypass that debounce. These JS adapters do not implement one shared application-level queue; the observed native contention is a separate fact.

The 400 chunks, 32.8-second write, and small auth-cache wait are historical DEBUG S24 observations, not release benchmarks. Focus completion awaits `PracticeCompletionService`'s direct durable queue read/write; network flushing is detached afterward. This identifies an awaited storage dependency, but its connection to the observed PERF-003 hang remains unproven. Reproduce it on release before changing the completion gate.

The vault is outside `SECURE_ONLY_PREFIXES`, so the generic adapter can fall back to plaintext AsyncStorage on encryption failures. The future migration must account for existing plaintext legacy copies while preventing new plaintext persistence of private content. The current development-only recovery dump in `App.tsx` also writes a vault copy to AsyncStorage; inventory that path explicitly. Neither path is modified in this proposal.

### Recommended architecture

Use encrypted SQLite via SQLCipher, with a cryptographically random database key held in SecureStore. Keep tokens and small secrets there; bulk private content remains encrypted. `expo-sqlite` and `expo-crypto` are not installed. Implementation must enable the SQLite config plugin's `useSQLCipher:true`, generate the native configuration, and apply the key immediately after opening each database connection, before any schema/data access. Merely storing a key does not encrypt SQLite. This needs new native builds, rather than an OTA-only change. Explicitly change the fixed `runtimeVersion` from `2.0` to a new compatible runtime when implementation is approved, with Android and iOS binaries before any corresponding OTA. [Expo SDK 54 SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/).

Inventory every general adapter, custom auth adapter, and direct helper caller before selecting the migration cohort: Anchor vault, account/profile/session snapshots, auth state, first-run/creation drafts, courses, practice/scene outboxes, Chart/Vision read models, reflections, and preferences. Classify private durable content, small secrets, and rebuildable caches. Preserve the store/domain interfaces and existing hydration result.

Store individual Anchors by stable account scope plus Anchor ID and revision; update changed rows rather than the whole vault. Use a stable local guest scope, an explicit transactional guest-to-account transfer, and an account filter on every query. Pending completions/outbox writes are durable records, not disposable caches. Cache eviction never removes private writing or unsynced content.

Use a serialized database writer and exclusive async transactions; all transaction queries use the supplied transaction object. Bind user values as query parameters. Limit retries for database busy/locked errors, and surface failures. Never label a completion saved until its local transaction commits. An operation awaiting a failed database write is only pending in memory unless an independently verified durable mechanism exists; do not claim process-kill safety for it. [Expo transaction guidance](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/#executing-queries-within-an-async-transaction).

### Migration, activation, and crash recovery

1. Keep the legacy store authoritative initially. Add a read-only legacy reader: existing `readSecureValue` deletes corrupt chunks and legacy-migration helpers mutate/delete source data, so they are unsuitable here. Distinguish verified absence, valid data, and incomplete/corrupt/unreadable data. Missing metadata alone cannot establish absence for an existing account. Stop on ambiguity; preserve all source keys and any fallback copies.
2. Obtain the encryption key, import into an inactive database generation, and checkpoint idempotent imports. Serialize migration with mutations or replay an ordered mutation journal before activation; changes made during import must not disappear. Keep UI recovery bounded and explicit while pending data is protected.
3. Verify schemas, identities, counts, revisions, canonical checksums, and database integrity against the source. Commit verification status, schema version, and active generation in **one database transaction**. A SecureStore marker is only a hint. After a crash between the DB commit and marker write, the committed DB control row wins and the marker is repaired; a marker without a committed generation never authorizes activation.
4. Retain the legacy encrypted source and reader for at least two compatible releases, as proposed in Phase 1. Expire that window only after forced-kill/migration/account-isolation checks pass on Android and iOS and a verified recovery/export path exists for guest-only data; failure delays deletion. On import/key/verification failure, do not activate or erase legacy data. Do not use plaintext fallback for new private writes. Once active, recovery uses the committed database; stale legacy snapshots must never silently overwrite newer DB data.

### Key loss, backups, and rollback

Never replace a missing key automatically when a database exists, reset that database, or interpret inability to decrypt as an empty account. Preserve the DB and legacy source and enter a recovery-required state. Import interruption before activation can resume against untouched legacy data. Permanent key loss or post-activation corruption is not proven recoverable: retained legacy data cannot restore newer DB-only writes, and an unreadable encrypted file is evidence preservation, not a recovery mechanism. Android currently has `allowBackup:false`; SecureStore's documented Android backup exclusions mean restoring an encrypted DB without its key cannot recover it. Validate the database/key pair on both platforms. A future guest-data transfer or recovery promise requires a separately approved, verified encrypted export or backup/key-restoration design before release; migration cannot create such a promise. [Expo SecureStore backup guidance](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/#android-auto-backup).

Before activation, abandoning an import returns to unchanged legacy data. **After DB-only writes, an old binary cannot see newer writes.** Lossless downgrade would require maintained legacy dual writes, reintroducing the costly failure-prone path. Recommended rollback is a compatible native/JS build that retains the encrypted DB reader and schema support. Preserve runtime separation and minimum readable schema checks; retained legacy snapshots are recovery evidence, not lossless old-binary rollback.

### Validation and approval decision

Use synthetic source-shaped fixtures near 719 KB, a larger vault, and mixed account/guest/outbox data. Measure release cold hydration, mutation p50/p95, SecureStore call counts/auth wait, frame pacing, and Focus end-to-completion independently. Compare the same device/build conditions. Inject failure and forced kills before/after import checkpoints, verification, DB activation, marker reconciliation, and transaction commits. Test corrupt legacy chunks, missing keys, database corruption, busy writes, account switches, guest transfer, and newer writes followed by rollback. Preserve zero lost Anchors across forced-kill tests and the original 20/20 Focus completion target; no improvement is claimed before measurement.

Approve encrypted SQLCipher storage, the new native/runtime cohort, retention/recovery policy, and the limitation on old-binary downgrade before implementation. Encryption remains the recommended default; alternatives involving plaintext private data need an explicit privacy decision. At this proposal checkpoint, the next authorized step was release baseline testing when an isolated target became available. Section 10 records subsequent partial baseline results; storage migration remains pending approval.

## 9. Approved implementation pass and handoff (2026-10-12)

**Scope:** PERF-001 code correction and related PERF-082 persisted startup readiness; pass 2 non-destructive infrastructure/build checks; pass 3 proposal only. Baseline source revision: `096a26d7c412a030853bb9072fbb9641b280fa9f`, branch `feat/celebration-layer`. The first status inspection found unrelated staged/unstaged work; another session saved it before implementation. No existing work was reset, pruned, or overwritten. This pass is uncommitted, with no staging, deployment, OTA, purchase, or owner-account mutation.

### Root cause and final behavior

The original Firebase null callback and a separate App startup effect both called full `authStore.signOut()` for guests. That resets local Anchors, onboarding and first-run data. A second independent reset in auth-store rehydration also discarded resumable pre-account drafts. Checking a loading flag was insufficient: auth persistence can finish before Firebase's first callback, and asynchronous cleanup can overlap another account/session.

App now registers the extracted production bootstrap listener. Guests and pre-account drafts finish null-session initialization without destructive sign-out; persisted accounts retain intentional cleanup. The first auth-ready signal is one-shot and follows the processed current Firebase callback, not store hydration or a persisted loading flag. Repeated null callbacks share a generation; authenticated callbacks supersede earlier work. Cleanup waits for all eight persisted stores it snapshots or mutates (Anchor, first-run, session, profile, teaching, visualization scene, settings, subscription) and checks ownership/generation around asynchronous snapshots. Auth rehydration leaves resumable first-run cleanup to its owning store. Developer-master behavior remains guarded and available.

Readiness requires first-run and Anchor hydration, including after the splash fail-open timer. An unresolved auth/store hydration wait has a 10-second fail-closed recovery path; a separate 15-second guard covers a missing first Firebase callback only and is canceled on receipt. It does **not** introduce a network sync deadline or resolve PERF-005. Unsafe restoration withholds account screens and offers restart/reopen recovery without clearing unknown data. Retry uses development reload or Expo Updates reload, with no update check, download, or publication; release reload can select an already-downloaded compatible update.

### Verification and review

| Check | Result and limit |
|---|---|
| Behavioral RED | The implementer's extracted unconditional-cleanup baseline failed guest Anchor/draft preservation and repeated-callback cases. This reproduced the destructive behavior with real Zustand stores and mocked service boundaries; it was not a physical-device repro or a mounted-App test. |
| Final focused Jest | **5 suites / 81 tests passed.** Covers returning guests, unfinished onboarding, authenticated restoration, late first Firebase callback, intentional sign-out, account/same-account transitions, repeated callbacks, auth/Anchor/teaching hydration ordering, cancellation/unmount, fatal waits/errors, readiness after timeout, and the actual retry button/reload routes. |
| Broader Jest | **520 suites passed, 13 failed; 5,128 tests passed, 27 failed, 1 previously skipped; 12 snapshot failures.** This full run began before product edits and overlapped implementation; final touched paths were rerun in the focused gate. No tests/snapshots were weakened, skipped, or updated here. |
| Failure baseline comparison | All 13 failed suites were rerun with the changed auth store substituted from exact pre-fix HEAD `096a26d7`; its relative storage import was redirected to the equivalent source alias for resolution. The remaining failing-suite source dependencies are unchanged. **The same 27 failed assertion names reproduced** (250 other assertions passed in that subset). This is a controlled source comparison, not a fresh full-checkout baseline run. |
| TypeScript | Pre-edit and final `tsc --noEmit --pretty false` passed. |
| Packaging | Final Android production JS/Hermes export **passed**: `index-9827ef6ba8371eb218f48e9acbe6d442.hbc` (17.3 MB) in `%TEMP%\anchor-perf-remediation-20261012\android-production-export-final`. It validates local packaging, not a native release binary or hardware performance. |
| Diff hygiene | `git diff --check` passed. |
| Independent code review | **9.6/10** after correction cycles: correctness/safety 9.6, coverage 9.5, architecture/simplicity 9.5, scope/preservation 9.8, evidence/honesty 9.6. Senior engineer independently reviewed and reran the focused gate. |
| Independent baseline/proposal review | **9.6/10** after correcting stale device/build assumptions and key-loss/rollback overclaims. |
| Device/performance acceptance | Not completed. No connected Android device, no iOS profiling environment, no new release frame/startup/audio measurements. Physical guest relaunch, account switching, and restart behavior remain pending. |

Commands run from `anchor/mobile`: `node ./node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath src/services/__tests__/appAuthState.test.ts src/services/__tests__/reloadCurrentApp.test.ts src/components/startup/__tests__/StartupRestoreFailure.test.tsx src/hooks/__tests__/useAppStartup.test.ts src/stores/__tests__/authStore.test.ts`; `node ./node_modules/typescript/bin/tsc --noEmit --pretty false`; full Jest with `--runInBand --silent --json`; Android export with `EXPO_PUBLIC_ANCHOR_V2_ENABLED=true`, `EXPO_PUBLIC_APP_ENV=production`, `EXPO_PUBLIC_SFX_DEBUG=0`, and `CI=1`. Numeric JSON/logs and local exports are retained at `%TEMP%\anchor-perf-remediation-20261012`; no owner data was copied into test fixtures.

### Existing broader failures retained

| Suite (relative to `anchor/mobile/src`) | Failed assertions |
|---|---:|
| `components/v2/creation/__tests__/V2CreationFlow.test.tsx` | 1 |
| `components/chart/__tests__/ChartPreview.test.tsx` | 12 (snapshots) |
| `screens/v2/notifications/__tests__/NotificationSettingsScreen.test.tsx` | 1 |
| `components/v2/chart/map/__tests__/chartMapSequences.test.ts` | 1 |
| `stores/v2/__tests__/creationStore.test.ts` | 2 |
| `adapters/v2/home/__tests__/isolation.test.ts` | 1 |
| `adapters/v2/home/__tests__/adapters.test.ts` | 1 |
| `services/__tests__/AuthHydrationService.test.ts` | 2 |
| `screens/practice/__tests__/PracticeScreen.test.tsx` | 1 |
| `screens/vault/__tests__/AnchorDetailScreen.test.tsx` | 1 |
| `components/__tests__/ExportAnchorSheet.test.tsx` | 2 |
| `components/v2/chart/panel/__tests__/ChartSummitAndRouteScenes.test.tsx` | 1 |
| `services/audio/__tests__/SoundPool.test.ts` | 1 |

### Every file changed in this pass

Paths below are relative to `E:\Projects\Anchor`:

- `anchor/mobile/App.tsx`
- `anchor/mobile/src/hooks/useAppStartup.ts`
- `anchor/mobile/src/hooks/__tests__/useAppStartup.test.ts`
- `anchor/mobile/src/stores/authStore.ts`
- `anchor/mobile/src/services/AppAuthBootstrap.ts` (new)
- `anchor/mobile/src/services/appAuthState.ts` (new)
- `anchor/mobile/src/services/__tests__/appAuthState.test.ts` (new)
- `anchor/mobile/src/services/reloadCurrentApp.ts` (new)
- `anchor/mobile/src/services/__tests__/reloadCurrentApp.test.ts` (new)
- `anchor/mobile/src/components/startup/StartupRestoreFailure.tsx` (new)
- `anchor/mobile/src/components/startup/__tests__/StartupRestoreFailure.test.tsx` (new)
- `docs/performance-audit-2026-10/PERFORMANCE_AUDIT_REPORT.md`
- `docs/performance-audit-2026-10/PERFORMANCE_REMEDIATION_PLAN.md`
- `docs/performance-audit-2026-10/DEVICE_VALIDATION_MATRIX.md`
- `docs/performance-audit-2026-10/EXECUTIVE_SUMMARY.md`

### Safety limits and next step

Tests use isolated mock storage/accounts; the owner's actual Anchors and private raw evidence were not touched. Normal motion, layouts, audio, haptics, premium contracts, and image quality have no changes in this diff. The new recovery surface appears only when startup cannot safely restore local state.

The bootstrap tests do not mount App end-to-end. Guarding stale live cleanup does not cancel snapshot writes already issued, provide storage atomicity, or establish full guest-to-account hydration merge correctness. The two existing `AuthHydrationService` failures concern unsynced/local data retention and remain important follow-up work, alongside PERF-004/039 and the other original findings. No runtime improvement or device-level fix is asserted.

At the previous handoff checkpoint, next: obtain an identified release binary on an isolated Android test target and perform guest/auth relaunch checks plus the existing performance baseline. Approve section 8's encrypted-storage/native-runtime/recovery/rollback decision before migration. Reprofile motion only after approved storage work; later rendering/audio/sustained-performance passes remain outside current implementation authority.

## 10. Release baseline and data-safety validation execution (2026-10-12)

This pass continues section 9; it does not reopen the 89-finding audit or implement section 8's migration. The initial live checkout matched the handoff: branch `feat/celebration-layer`, HEAD `096a26d7c412a030853bb9072fbb9641b280fa9f`, four modified product/test files and the documented new startup files; the index was empty. The documentation edits were retained separately. Three Luna agents were recruited for integrity/tests, isolated native build tooling, and synthetic profiling harness work, with senior review required before acceptance.

### Task A: implementation secured

Committed the reviewed auth/startup implementation as **`9a158b7d3efeab62e42b6d8f8f01d8b45edb3caa`**, `fix(auth): preserve guest data during startup restoration`. Explicit path staging included only 13 product/test files; no `git add .`, reset, stash, publication, or unrelated edits. The mobile working tree was clean after the commit; existing documentation edits remained uncommitted.

The fresh review identified one handoff discrepancy: App's required Anchor/first-run hydration recovery used the **4,000 ms splash fail-open constant**, whereas the documented store recovery contract was 10 seconds. Recovery latched even if a valid restore finished between 4 and 10 seconds. The pass corrected only this guard using `useRequiredLocalHydrationGuard`: each required store has its own 10-second deadline, completing one cannot extend the other's wait, completion cancels its timer, unmount cancels timers, and a real timeout remains fail-closed until restart. The original splash timing and choreography constants are unchanged. Regression tests cover 9-second successful restoration, both unresolved stores, partial restoration without deadline extension, late completion after timeout, and unmount.

| Current check | Result and boundary |
|---|---|
| Original five focused Jest suites | 5 passed / 81 tests passed before the guard correction. |
| Guard correction gate, independently rerun by senior engineer | **6 passed / 86 tests passed**, including the new required-store guard suite; no snapshots updated. |
| Final gate with mounted-App integration, independently rerun by senior engineer | **7 suites / 88 tests passed.** Actual-App integration verifies null Firebase callbacks, recovery hidden at 9 seconds, real recovery UI after 10 seconds, preserved Anchor/draft state, the retry button, and required-store hydration without recovery beyond 15 seconds. Firebase/native storage/reload boundaries remain mocked. |
| TypeScript | Senior `node ./node_modules/typescript/bin/tsc --noEmit --pretty false` completed **exit 0**, no diagnostics. |
| Current documented broader-failure subset | **13 suites: 1 passed, 12 failed; 277 tests: 251 passed, 26 failed.** `ChartSummitAndRouteScenes` now passes. This is a fresh subset run, not a new full-suite result; section 9's historical 520/13 and 5,128/27 remain preserved. |
| Data-retention failures | Both `AuthHydrationService` assertions about unsynced temporary Anchors and retaining local progress after failed hydration still fail. No tests weakened or unrelated fixes attempted. |
| Git hygiene / scope | Working and staged `diff --check` passed. The diff changes auth/startup recovery and its tests; no motion, audio, haptic, navigator, rendering-quality, or animation-duration source was changed. Source scope verification is not device parity acceptance. |

Exact committed paths, relative to repository root:

- `anchor/mobile/App.tsx`
- `anchor/mobile/src/components/startup/StartupRestoreFailure.tsx`
- `anchor/mobile/src/components/startup/__tests__/StartupRestoreFailure.test.tsx`
- `anchor/mobile/src/hooks/useAppStartup.ts`
- `anchor/mobile/src/hooks/__tests__/useAppStartup.test.ts`
- `anchor/mobile/src/hooks/useRequiredLocalHydrationGuard.ts`
- `anchor/mobile/src/hooks/__tests__/useRequiredLocalHydrationGuard.test.ts`
- `anchor/mobile/src/services/AppAuthBootstrap.ts`
- `anchor/mobile/src/services/appAuthState.ts`
- `anchor/mobile/src/services/__tests__/appAuthState.test.ts`
- `anchor/mobile/src/services/reloadCurrentApp.ts`
- `anchor/mobile/src/services/__tests__/reloadCurrentApp.test.ts`
- `anchor/mobile/src/stores/authStore.ts`

Sanitized test evidence is under `%TEMP%\anchor-perf-release-20261012`: focused Jest logs, TypeScript logs, and `documented-broad-summary.txt`. A zero-byte TypeScript log alone is not used as success evidence; exit status was checked. Existing section 9 data-safety limitations still apply: stale snapshot writes already issued are not canceled, storage is not atomic, full guest/account merge correctness remains unproven, and mounted native startup/recovery acceptance is separate from these tests. **PERF-001 and PERF-082 remain native-device-validation pending.**

The additional actual-App integration test is committed separately as **`6911321cdf7ee32c9e40346d307dbd44823a34e6`**, `test(auth): verify startup recovery through App`, with the sole path `anchor/mobile/src/__tests__/AppStartupHydration.integration.test.tsx`. Current branch HEAD is this test-only commit. The native build's runtime source remains identical to `9a158b7d`; no product source changed in the test commit. Luna's initial 9.4 review was returned for stronger App integration evidence; after corrections and mounted-App tests the independent **source/test integrity score is 9.5/10**, not a release/device acceptance score. The integration file also passed TypeScript, exit 0. Final handoff rerun evidence is `focused-jest-7s88-final-parent.log` plus `focused-jest-7s88-exit.json` (7/88, exit 0) and `tsc-handoff-exit.json` (exit 0, diagnostic bytes 0); earlier 6/86 and empty TypeScript logs remain historical.

Final focused command from `anchor/mobile`: `node ./node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath src/__tests__/AppStartupHydration.integration.test.tsx src/services/__tests__/appAuthState.test.ts src/services/__tests__/reloadCurrentApp.test.ts src/components/startup/__tests__/StartupRestoreFailure.test.tsx src/hooks/__tests__/useAppStartup.test.ts src/hooks/__tests__/useRequiredLocalHydrationGuard.test.ts src/stores/__tests__/authStore.test.ts`.

### Tasks B–E: execution boundary

Wireless ADB now identifies the owner's Galaxy S24 Ultra `SM-S928U1`, Android 16 / API 36, arm64; device-side `/system/bin/perfetto` is present. Only device metadata was read during preparation. The existing package `com.anchorintentions.app` is protected. The first separate package `com.anchorintentions.perfbaseline` was installed fresh for user 0. After the user reported interacting with it (sign-in was unsuccessful), that installation was also designated protected: no update, clear, uninstall, or automated fixture operation. Further synthetic testing must use the fresh `com.anchorintentions.perflab20261012` package, label Anchor PERF LAB, scheme `anchor-perflab20261012`, user 0. Production accounts/backend writes remain outside the setup. Native release artifact/results and remaining coverage are recorded below as they become verified. No performance numbers are inferred from test success or fixture chunk arithmetic.

### Native release build evidence and isolation

**Native release binary built: yes.** Ordinary baseline artifact: `E:\apc\src\android\app\build\outputs\apk\release\app-release.apk`, 298,060,294 bytes, SHA-256 `AEA29C04A00ACCF2A25F7BCD089F531B7C62DAD2502D0C13056BF1CAEB2BAA28`. Android package `com.anchorintentions.perfbaseline`, version 2.0.0 (39), runtime 2.0; four ABIs (arm64-v8a, armeabi-v7a, x86, x86_64). Runtime source is commit `9a158b7d`, with `6911321c` adding tests only. Build inputs, exact deviations, manifests and hashes are retained under `E:\apc\record`.

Verified release properties: no `android:debuggable` manifest attribute and installed flags omit DEBUGGABLE; shell profileable; Hermes bytecode version 96 (11,237,972-byte ordinary bundle); production JS and NODE_ENV, V2 navigator enabled, Fabric/new architecture, release minification/resource shrinking. SFX debug/overlays are disabled. Expo Updates is disabled, check NEVER, no update URL. API is loopback `http://127.0.0.1:39999`; telemetry and RevenueCat credentials are blank, Firebase collection/messaging auto-init disabled. These safety deviations must accompany every comparison; the build cannot establish production-network or purchase behavior. Local debug-key signing is intentional for diagnostics (APK v2 verified), not store distribution. No paid cloud resources, OTA, store submission or deployment.

Toolchain retained: Node 24.15.0, Java 17.0.17, Gradle 8.14.3, compile SDK/build tools 36/36.0.0, target SDK 35, minimum 24, NDK 27.1.12297006. Expo 54, React Native 0.81.5 and Reanimated 4.1.1 were not upgraded. Build-only corrections: move cross-drive `C:\ap2` copy to same-drive short `E:\apc`; disable Kotlin incremental compilation after different-root cache failures; correct isolated Google Services client matching; use a 2,560 MB Gradle heap after R8 exhausted 2,048 MB. Sentry upload is skipped. Third-party R8 stack-map warnings remained, but the native build completed.

Android raw audio resource-name collisions required ten MP3 file aliases and matching Android `NodeToneService` require paths **in the isolated copies only**. MP3 bytes were hash-verified identical; iOS WAV mappings, playback durations/rates/volumes and choreography were unchanged. The shared product source was untouched. This is a build packaging correction, with audible runtime parity still unverified; exact aliases/hashes are in `E:\apc\record\audio-resource-disambiguation.json`.

Parent installed the ordinary baseline fresh (`adb install --user 0`, no replacement) on the wireless S24 Ultra SM-S928U1, Android 16/API 36. First explicit cold activity start: **TotalTime 1,047 ms, WaitTime 1,054 ms**, one launch. This is Android activity first draw, **not app-ready/Home interaction or ten-launch acceptance**. No storage, Focus or frame claims follow from it. The user subsequently interacted with the test app and could not sign in; its unregistered isolated OAuth identity does not validate auth. Both owner app and that installation are preserved. Evidence is `%TEMP%\anchor-perf-release-20261012\native-baseline`.

Diagnostic v2 artifact is separately archived at `E:\apd\record\archive\perfbaseline-v2-url-control.apk`, 213,147,133 bytes, SHA-256 `41DEBFD3F4E0D47CC72F46AFE0FE7B3AABECF5F8E826B1A6C295DDC05516FB76`, arm64 release, Hermes v96 bundle 11,254,140 bytes. It was **not installed**. Its old package is now protected. The earlier v1 diagnostic hash `A236C306577199AA3542748AA9B86D6C9BC0CFEB876421D2D567BA0896A0CBFB` is historical provenance only: its binary was overwritten before archival, a disclosed preservation gap. Do not present that APK as available. The fresh v3 lab changes Android identity and uses a fixed demo-project local Auth emulator; no production schema or storage migration is introduced.

The fixture/capture harness remains under `harness/`. Parent independently reran **13/13 stub-adapter tests** for protected-package refusal, exact URL allowlist, non-loopback refusal, pristine onboarding draft, no action on ordinary cold start, checksum-based safe seeding, separately timed adapter reads, and native-error/fallback rejection. The harness-only Jest config maps Expo's virtual environment module to the test process environment; this fixes test bootstrapping without changing product dependencies or guard assertions. These are source-safety checks, not native SecureStore measurements.
### Local Auth fixture gate

The isolated Auth-only Firebase emulator is bound to `127.0.0.1:9099` with fixed `demo-anchor-perf` project; the in-memory fixture API is bound to `127.0.0.1:39999`. Firebase CLI 15.33.0 runs from task-local temporary configuration/cache directories with inherited token/ADC environment variables removed; no login, cloud account/resource operation, production database or real service account. Generated CLI debug logs were moved out of the repository and are ignored. No emulator import/export persistence is used.

Parent independently ran `node harness/auth-emulator/test-fixture.cjs`: **PASS**, exit 0. The test creates an ephemeral synthetic local account, verifies an emulator-issued token through Firebase Admin and audience/issuer/subject checks, exercises auth sync and one synthetic RAM-only practice-session record, rejects invalid tokens/provider/config/project, and confirms scene snapshots/next-actions are discarded. No email, password, token or request body is printed. This is local service integration, **not phone Firebase callback, production backend acceptance, or ten Focus completions**.

The diagnostic native Auth patch remains outside shared product source. It requires exact lab native ID, enabled diagnostic flag, exact loopback API and actual Firebase app projectId `demo-anchor-perf` before calling Auth `useEmulator`. The diagnostic Gradle build checks the copied demo Google Services JSON project/package and refuses fallback. Namespace and native class names remain production-source values; only the isolated application ID differs. The lab adds an exact `127.0.0.1` cleartext exception to its existing Android network-security config; base cleartext denial remains. These deviations must stay attached to all runtime results.
For native Focus validation, a one-time local setup creates UID `synthetic-account`, matching the synthetic Anchor fixture's owner, and a verified `anchorPerfOnboarded=true` claim. Credentials are held only in task TEMP, separate from profiling logs, and setup refuses an existing UID/file rather than resetting anything. The fixture maps onboarding only from the verified demo token claim; a client body flag cannot grant it. Parent reran the updated local test successfully. Premium stays free / isComped false. This allows the active-account durable-queue path to be tested without asserting a production guest merge or bypassing premium gating.

The fresh v3 build's first Gradle attempt failed before compile because PowerShell split an unquoted dotted `-P` argument into an unknown task `.incremental=false`. Retrying with literal argument boundaries corrects tooling only. No framework or app source change was made for this failure. Capture preparation now includes scheduler/frequency/idle events alongside app-filtered gfx/view/Dalvik; restricted local raw traces may contain system process metadata, while shared SQL summaries must filter to the exact lab process. Numeric log collection verifies PID ownership before/after, retains fixed events/finite numeric fields and Android log epoch for clock alignment, and discards other app log lines. Capture preflight continues to issue zero ADB calls.
### Initial native checks and profiler corrections

V3 lab APK archived at `E:\apd\record\archive\anchor-perflab20261012-v3-auth-emulator-release-arm64.apk`, 213,147,913 bytes; SHA-256 `D758779B6FF9CA03C67554D61FE7877BF6D65230C918B23A31D2799A909732EB`. Parent independently verified hash, Android package/label/arm64, non-debuggable installed flags, disabled OTA/Firebase collection, fake demo Firebase resources and APK signature, then installed fresh on the S24 (no replacement). Source/product namespace remains original; all provider authorities use lab ID. V3 build succeeded 12m28s. Public production Google OAuth fallback identifiers remained in its JS config although Firebase is demo-only; no Google sign-in was attempted. A follow-up diagnostic build blanks those fallbacks and disables its unsupported Google sign-in, without touching production configuration.

The S24 keyguard is showing. An exact lab fixture intent launched its process but did not seed an Anchor; no fixture-complete event exists. Native startup numeric events verify an empty Anchor hydration span of **110 ms** and App-component elapsed readiness **59 ms** (different time origins; not Home timing). Eight absent-value SecureStore read spans were **45–86 ms**, and four 297-character auth-state writes were **151–208 ms**, native-call failures 0 in those events. These are fresh **zero-Anchor, locked-device** observations, not one/72-Anchor baselines, UI performance or an improvement versus the historical debug vault. Android launch was UNKNOWN with WaitTime 3,033 ms; no valid cold Home timing is claimed. The exact fixture URL's execution remains unverified under keyguard.

The numeric collector initially saved zero events because React Native quoted/comma-separated console arguments; the pattern was corrected and the same PID yielded **14 numeric-only events**. Raw lines were not retained. The initial empty evidence file remains historical, alongside corrected JSONL in `%TEMP%\anchor-perf-release-20261012\numeric`. Source review also found the event-loop histogram inside the existing dev-only effect, so V3 cannot supply release loop-gap evidence. The V4 overlay moves it to an independent effect, adds numeric no-action/unknown-URL reasons (no URL text), and recognizes only the exact canonical empty Zustand vault while retaining every pristine-state/owner-data guard. **21/21** fixture tests passed; the attempted copied-App integration smoke was unstable and is not claimed as passed. Runtime verification remains required.

Physical Perfetto smoke: Android denied output under `/sdcard/Download` (errno 13). The harness now uses a unique scenario/run path under `/data/misc/perfetto-traces`, refuses pre-existing paths, pulls only that trace and removes only its own file. A bounded **5-second** native capture succeeded and was parsed with Trace Processor v58.2 using the app-filtered SQL. The S24 was locked, so gfxinfo and FrameTimeline contain **0 frames**: motion results are **unavailable**, not 0% jank acceptance. This validates profiling-tool operation only. Restricted trace, metadata, package meminfo/gfxinfo and numeric summaries are under `%TEMP%\anchor-perf-release-20261012\captures\...\capture-preflight-locked\native02`.

### Fresh emulator functional validation

Fallback AVD `Anchor_PERF_LAB_20261012`, serial `emulator-5564`, Android 16/API 36/x86_64, was created from the installed `android-36.1/google_apis_playstore/x86_64` system image with **fresh userdata** under `E:\anchor-perf-emu-20261012`. Child-only AVD/emulator home overrides, 4 GB RAM/4 cores, headless software graphics, no snapshots or Google login; no existing AVD config/userdata was copied or reset. `avdmanager` was absent, so task-specific metadata was generated directly. Emulator timings are separate from phone evidence and may be affected by concurrent host build load.

Parent installed the verified four-ABI ordinary baseline fresh on this AVD. Its same package name as the phone's protected test app refers to a different, new emulator data sandbox; every operation uses exact `emulator-5564` and verifies the task AVD name. The phone's installation was not operated. First emulator cold activity draw: **11,140 ms**, WaitTime 11,153 ms (n=1 initial startup). The user-facing welcome and bridge scenes rendered. After Get started, stopping partway at the bridge, force-close and cold relaunch resumed the same bridge screen with no recovery surface: **incomplete-onboarding persistence PASS on this native emulator scenario**, once. Relaunch activity draw 6,400 ms / WaitTime 6,553 ms. These two activity timings are not a ten-launch distribution or a hardware performance comparison.

UIAutomator could not obtain idle state during the preserved continuous welcome/bridge animation. Synthetic-only emulator screenshots and guarded coordinate input are used for functional checking; no animation is disabled or shortened to accommodate tooling. This was an earlier checkpoint, superseded by the V4 runtime subsections below. Remaining gaps include native recovery fault injection, canonical backend/guest transfer, legitimately entitled Focus x10, complete premium/audio/haptic coverage and physical/iOS acceptance.

### Changed-file inventory at this handoff

Inventory snapshot: branch `feat/celebration-layer`, HEAD `6911321cdf7ee32c9e40346d307dbd44823a34e6`; the index is empty and `anchor/mobile` is clean. The 14 committed product/test paths are split across the two commits below. The five modified audit documents and 26 untracked harness files are documentation/harness work and remain uncommitted. The ignored generated `harness/__pycache__/` directory is excluded; no captures or private runtime artifacts are part of this inventory.

Commit `9a158b7d3efeab62e42b6d8f8f01d8b45edb3caa` (`fix(auth): preserve guest data during startup restoration`) contains 13 paths:

- `anchor/mobile/App.tsx`
- `anchor/mobile/src/components/startup/StartupRestoreFailure.tsx`
- `anchor/mobile/src/components/startup/__tests__/StartupRestoreFailure.test.tsx`
- `anchor/mobile/src/hooks/__tests__/useAppStartup.test.ts`
- `anchor/mobile/src/hooks/__tests__/useRequiredLocalHydrationGuard.test.ts`
- `anchor/mobile/src/hooks/useAppStartup.ts`
- `anchor/mobile/src/hooks/useRequiredLocalHydrationGuard.ts`
- `anchor/mobile/src/services/AppAuthBootstrap.ts`
- `anchor/mobile/src/services/__tests__/appAuthState.test.ts`
- `anchor/mobile/src/services/__tests__/reloadCurrentApp.test.ts`
- `anchor/mobile/src/services/appAuthState.ts`
- `anchor/mobile/src/services/reloadCurrentApp.ts`
- `anchor/mobile/src/stores/authStore.ts`

Commit `6911321cdf7ee32c9e40346d307dbd44823a34e6` (`test(auth): verify startup recovery through App`) contains one path:

- `anchor/mobile/src/__tests__/AppStartupHydration.integration.test.tsx`

Five modified, uncommitted audit documents:

- `docs/performance-audit-2026-10/DEVICE_VALIDATION_MATRIX.md`
- `docs/performance-audit-2026-10/EXECUTIVE_SUMMARY.md`
- `docs/performance-audit-2026-10/MOTION_AND_AUDIO_PRESERVATION_CHECKLIST.md`
- `docs/performance-audit-2026-10/PERFORMANCE_AUDIT_REPORT.md`
- `docs/performance-audit-2026-10/PERFORMANCE_REMEDIATION_PLAN.md`

Twenty-five untracked harness source/documentation files:

- `docs/performance-audit-2026-10/harness/README.md`
- `docs/performance-audit-2026-10/harness/analyze-framestats.py`
- `docs/performance-audit-2026-10/harness/app-filtered-summary.sql`
- `docs/performance-audit-2026-10/harness/capture-android.ps1`
- `docs/performance-audit-2026-10/harness/collect-numeric-diagnostics.ps1`
- `docs/performance-audit-2026-10/harness/generate-synthetic-fixtures.mjs`
- `docs/performance-audit-2026-10/harness/test_analyze_framestats.py`
- `docs/performance-audit-2026-10/harness/validate-harness.ps1`
- `docs/performance-audit-2026-10/harness/diagnostic-src/INTEGRATION.md`
- `docs/performance-audit-2026-10/harness/diagnostic-src/ReleaseStorageBenchmark.test.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/ReleaseStorageBenchmark.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic-v2-perfbaseline.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic-v4-overlay.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/jest.harness.config.cjs`
- `docs/performance-audit-2026-10/harness/diagnostic-src/perfFixtureLinking.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/test-shims/expo-virtual-env.cjs`
- `docs/performance-audit-2026-10/harness/auth-emulator/README.md`
- `docs/performance-audit-2026-10/harness/auth-emulator/diagnostic-config.cjs`
- `docs/performance-audit-2026-10/harness/auth-emulator/firebase.json`
- `docs/performance-audit-2026-10/harness/auth-emulator/fixture-api.cjs`
- `docs/performance-audit-2026-10/harness/auth-emulator/google-services.perf-diagnostic.json`
- `docs/performance-audit-2026-10/harness/auth-emulator/mobile-auth-diagnostic.patch`
- `docs/performance-audit-2026-10/harness/auth-emulator/setup-synthetic-account.cjs`
- `docs/performance-audit-2026-10/harness/auth-emulator/test-fixture.cjs`

One additional untracked harness configuration file:

- `docs/performance-audit-2026-10/harness/.gitignore`

Staged and unstaged whitespace checks passed at inventory time. No product source or test files are currently modified outside the two listed commits.

### V4 emulator runtime results (historical checkpoint, 2026-10-12)

The available diagnostic APK is `E:\apd\record\archive\anchor-perflab20261012-v4-auth-emulator-dualabi.apk`, 245,152,933 bytes, SHA-256 `EFF1898E0D0B6E532960AD040D416EF2534DADDC2D435B2FBCDB2C2D8DEAA605`. Parent independently verified its hash, package/label and arm64-v8a/x86_64 ABIs before fresh emulator installation. Non-debuggable production Hermes v96/V2/Fabric release, profileable, local signing, demo Firebase Auth, exact loopback API, OTA off; production API and OAuth fallback identifiers are absent. Build provenance is `E:\apd\record\final-v4-build-provenance.json`. This isolated diagnostic artifact has safety/instrumentation deviations and does not validate production backend or distribution wiring.

The fresh AVD is Android 16/API 36/x86_64, software graphics, 1080x2400 at observed 60 Hz; no high-refresh mode exists on this AVD. It runs with `-no-audio`. Physical S24 acceptance, 60/adaptive refresh comparisons, audible audio and haptics remain pending. The phone remained locked; neither the owner package nor the user-touched baseline package was operated during this continuation.

Guest creation went through welcome, bridge, Career selection, the fixed synthetic intention, Form, Woven style, generated-form selection, the original hold-to-seal interaction, Save without an account, Progress Saved and Home. The local image fixture returns only a fixed PNG and “Synthetic fixture” classification, discards submitted content, and omits unsupported structure/preservation scores. Both A/B local fixture suites passed, including malformed/production token, ordinary-ID and private-intention rejection. This proves a reachable native guest save path, not AI image quality or canonical backend account saving.

**Ten guest process-kill/cold-relaunch checks passed**, each restoring exactly one Anchor and its artwork without onboarding/recovery UI. The actual UI-created vault was 1,434 characters. Activity first draw ranged 2,547–4,536 ms (median 2,813.5 ms); Anchor hydration ranged 136–246 ms. These time origins differ and are not Home-ready timing. The ordinary release also preserved incomplete onboarding at the bridge after one process termination/relaunch. PERF-001/082 are still physical-device-validation pending. Native delayed/repeated auth callbacks, exact 10/15-second fault injection/recovery/reopen, account merge/switch and production returning-user acceptance remain unverified; focused automated tests cover their documented source boundaries. Normal 72-Anchor initialization completed a measured 7,657 ms hydration and reached Home without recovery.

After preserving guest evidence, parent cleared **only the entirely synthetic V4 sandbox on exact fresh AVD `emulator-5564`**, verifying AVD name and package first. No phone sandbox, existing AVD, owner account or owner content was cleared. Diagnostic fixture seeding bypasses onboarding and is distinct from the preceding full-UI guest test.

| Native storage scenario | Actual V4 emulator measurement | Evidence boundary |
|---|---|---|
| 1-Anchor / 10,000-char cold launch | Activity draw 2,339 ms; SecureStore read 279 ms / 7 calls; Anchor hydration 299 ms | Normal launch without a fixture action; no Home-ready distribution claimed. |
| 72-Anchor / 719,217-char cold launch | Activity draw 2,177 ms; SecureStore read 5,724 ms / 401 calls; hydration 5,746 ms | 400 native chunks; activity draw precedes required-store readiness. Instrumented benchmark launch separately hydrated in 7,657 ms. |
| Initial complete 72-Anchor vault replacement | Native write 10,516 ms / 409 calls (6 previous chunks, 400 new); setItem 11,298.629 ms; rehydrate 4,651 ms | Native write includes clearing prior chunks; adapter includes debounce/scheduling. Synthetic valid-SVG padding models storage size, not artwork/render fidelity. |
| Isolated 1-Anchor adapter roundtrip | setItem 624.998 ms; read+parse 70.618 ms; separate direct SecureStore verification 85.070 ms | One repeat, not cold app hydration. |
| 72-Anchor adapter trial 1 | native write 12,296 ms; setItem 12,711.137 ms; read+parse 4,188.529 ms; direct verification 3,646.522 ms | Fresh diagnostic key, 400 chunks / 403 native write calls. |
| Trial 2 | native write 11,399 ms; setItem 11,816.067 ms; read+parse 4,253.533 ms; verification 4,452.322 ms | Same fixture/adapter, independent trial key. |
| Trial 3 | native write 11,733 ms; setItem 12,147.155 ms; read+parse 3,597.299 ms; verification 4,063.273 ms | Same fixture/adapter, independent trial key. |
| Auth adapter control / overlap | Controls 224, 52, 58 ms; concurrent bulk trials 12,222, 11,335, 11,660 ms | Controlled interference supports head-of-line delay, but spans include adapter work and do not isolate pure queue wait or exact auth-start offsets. |

The completed adapter exercise reported **3,698 native calls, 0 native failures, 0 fallbacks**, 16 read events and 14 write events. All roundtrips matched the entire synthetic JSON and expected Anchor count. Numeric evidence is `%TEMP%\anchor-perf-release-20261012\numeric\v4-adapter-final.jsonl`; earlier per-launch files preserve seed/cold/guest outcomes. Bulk adapter latency and auth interference reproduce in a native release emulator; the historical 32.8-second DEBUG observation is preserved and is not directly comparable to these different hardware/build/fixture measurements.

**30/30 Home → Details → Home functional cycles passed** using the UI-created guest Anchor and original transitions. The primary partial Perfetto window covers cycles 4–6, approximately 34.888 seconds, with UIAutomator verification and 2-second transition settling. Its retained gfxinfo ring has 120 frames (p50/p95/p99/max 58.338/136.277/187.178/194.266 ms); separate platform counters are 198 frames / 112 janky (56.57%), 35 missed vsync, 12 slow bitmap uploads; PSS 286,106 KB. This software-emulator/automation result is not phone frame acceptance or a full 30-cycle frame distribution. The first capture included setup errors/idle and is explicitly incomplete.

The 34.887-second adapter Perfetto window covers startup, the small roundtrip and the first large trial only. FrameTimeline has 384 actual frames (mean 35.093 ms, max 847.923 ms); main/RenderThread scheduled CPU sums are 3,827.149 / 5,068.695 ms, PSS 268,091 KB. Inclusive trace slices overlap; fixed JS/native-module thread codes were not identified, so their CPU is unavailable. The release JS histogram remained active during bulk work: two overlapping 10-second bins had p95 35 ms, max gaps 150/66 ms, with 3/1 samples over 50 ms. These coarse bins show loop activity, not exact JS execution stalls or storage causation. Frame outliers, storage spans and CPU aggregates do **not** establish why Home–Details stutters, whether persistence blocks navigation, or the historical Focus hang's cause.

Focus Begin is Pro-gated on the production navigator for every duration. Both synthetic accounts remain free; no entitlement, continuation route or developer override was used to bypass it. Focus x10, full Deep Prime, guided Visualize, Vision-image and Chart-world interactions, account-backed session completion and audio/background continuity remain unverified. The local fixture does not implement canonical Anchor/Chart/Vision persistence/recommendation endpoints, so error/empty surfaces do not validate those premium scenes.

**Next decision:** the measured native bulk cost and controlled auth interference justify prioritizing storage architecture validation. This pass does not make a production migration ready for approval/implementation. Resolve the two retained AuthHydrationService failures and native account transfer/return/switch checks; obtain safe physical and legitimately entitled isolated coverage; validate SQLCipher/native runtime/key policy, transactional import with source retained until verification, interruption/crash recovery, corruption/key loss, guest backup/export, account isolation and compatible-reader rollback. Section 8 remains the proposal; no migration, production schema/dependency change, framework upgrade, OTA or release publication occurred.

### Emulator local-auth and carousel checkpoint (historical)

Carousel swipes passed **20/20**, with the selected index advancing from 2 to 22 in the 72-Anchor synthetic collection. The earlier coordinate-tap attempt did not advance selection and is retained as incomplete setup; it was not counted as a swipe pass. The primary `carousel/native-v4-02` Perfetto window is 34.917 seconds, a partial capture of the swipe run: platform 1,049 frames / 628 janky (59.87%), 221 missed vsync, 64 slow bitmap uploads; retained ring p95 92.856 ms, p99 196.583 ms, max 218.685 ms. Fixture SVG padding and UIAutomator overhead limit rendering representativeness.

Two full-vault writes completed inside that trace window: 719,217 characters / 400 chunks, 14,076 and 15,963 ms, no failures. A later settled same-PID snapshot records **21** full-vault write completions after the adapter-run cutoff, **12,191–59,471 ms**; no per-swipe markers exist, so these are not asserted as one-to-one gesture writes. Home selection calls the shared `setCurrentAnchor`; the persisted partializer combines `currentAnchorId` with the entire Anchor array. This is a concrete write-amplification mechanism and matches the observed bulk writes during switching. Storage-to-specific-frame causality remains unproved. No carousel, SVG, haptic, sound or transition code was changed.

Native email sign-in to demo account A succeeded through Settings and the actual sign-in screen; the profile remained Free and Home retained all 72 locally seeded Anchors. After writes had settled (last recorded bulk completion more than 180 seconds earlier), a cold relaunch restored the signed-in user and **72 Anchors**, preserved selected index 22, and emitted signed-in fixture refusal reason 1; activity draw 2,932 ms, hydration 5,854 ms. This is local Firebase/native startup retention, not canonical server hydration or guest ownership transfer: the seeded Anchor user IDs already match A and the fixture lacks production Anchor export/merge endpoints.

The actual 10-second Focus Prep/Begin path opened the **normal Pro paywall**. No purchase, fake entitlement, developer override or resume-route bypass occurred; no session, completion timing or Focus x10 result exists. Intentional sign-out was confirmed through the normal UI and left an empty local Home. Subsequent native email sign-in to demo account B matched its generated fixture profile, remained Free, and showed no A Anchor content. These are partial local sign-out/account-switch checks; A/B server persistence, ownership transfer and production recovery remain unverified. A 3-second background/foreground Home check returned the B Home (HOT activity draw 160 ms); there was no active audio session, so audio continuity is unverified.

Delayed/repeated null callbacks and the exact native 10/15-second failure guards/restart/reopen were not fault-injected. The existing automated boundary tests remain the evidence for them. Physical Android, iOS, high refresh, legitimately entitled isolated Focus/Deep Prime/Visualize and production-like isolated backend coverage are required to close the remaining acceptance matrix.

### Physical V4 continuation (2026-10-12; supersedes phone-locked gaps above)

The owner unlocked the wireless S24 Ultra for the separate `com.anchorintentions.perflab20261012` installation. Parent updated only this agent-created synthetic sandbox to the same-signer V4 APK; neither `com.anchorintentions.app` nor the user-touched `com.anchorintentions.perfbaseline` was operated, cleared, replaced or uninstalled. The phone is SM-S928U1, Android 16/API 36/arm64, 1440x3120, adaptive display with a preferred 120 Hz mode. Observed intended-vsync median 8.321 ms supports approximately 120 Hz during the measured windows; it is not delivered FPS. Storage runs were unplugged, battery 55%, reported battery temperature 28.2 C.

| Physical release storage scenario | Measured V4 result | Limit |
|---|---|---|
| Small canonical 1-Anchor cold hydration | Approximately 120 ms; activity draw 959 ms | One synthetic 10,000-character fixture launch, not a distribution or Home-ready time. |
| 72-Anchor / 719,217-character normal cold launch | SecureStore read 2,430 ms / 401 calls; hydration 2,438 ms; activity draw 832 ms | No fixture action on this launch; 400 chunks. |
| Initial replacement of 1 Anchor by 72 | Native write 4,839 ms / 409 calls; adapter 5,244.497 ms; read 2,331 ms; rehydrate 2,395 ms | Includes clearing the previous six chunks. |
| Three independent large adapter writes | Native 8,235 / 7,170 / 6,403 ms; adapter 8,646.417 / 7,579.661 / 6,805.457 ms | Full exact-JSON readback and expected counts verified. |
| Auth controls versus overlapping bulk writes | Controls 37–131 ms; overlap 8,172 / 7,134 / 6,369 ms | Controlled interference; spans do not isolate pure queue wait or Firebase callback latency. |
| Large adapter read+parse | 2,493.067 / 2,469.225 / 2,194.058 ms | Separate direct verification 2,510.985 / 2,428.633 / 2,414.174 ms. |

The completed physical adapter run recorded 3,683 native calls, zero failures and zero fallbacks, 16 reads and 11 writes. Evidence is `%TEMP%\anchor-perf-release-20261012\numeric\phone-v4-adapter-check02.jsonl` and seed/cold files beside it. Multi-second bulk persistence and concurrent auth-adapter delay reproduce on physical release hardware. The old 32.8-second DEBUG write remains historical; these synthetic fixtures/hardware/builds are not a controlled before/after optimization comparison.

The physical seed and adapter Perfetto windows cover 33.618 and 30.635 seconds respectively; the adapter trace covers the first large trial and part of the second, not all three trials. Platform gfxinfo counters were 4/139 janky (2.88%) and 6/411 (1.46%); retained rings differ from those aggregate populations. Samsung traces omitted full package names. Numeric PID fallback summaries are conditional on parent-controlled process lifetime and exact-package `/proc` checks bracketing each diagnostic read, not the entire old capture. Device time was approximately 166 seconds ahead of host time; trace/event alignment uses device clocks. New captures include package/PID/start-tick identity sidecars at both capture boundaries. Neither storage-window frame counters nor coarse 10-second JS histogram bins establish a storage-to-specific-frame causal chain.

After preserving the completed benchmark evidence and verifying the whole dataset synthetic, parent cleared only the phone PERF LAB sandbox for full-UI guest testing. The original welcome/bridge flow survived one mid-onboarding process termination. A new fixed synthetic Career Anchor was created through the real Form, Woven selection, original hold-to-seal, Save without an account, Progress Saved and Home flow. Ten fresh process-kill/relaunch checks passed: one local Anchor and its artwork, no repeated onboarding or recovery UI. Activity first draw 527–616 ms, median 559 ms; required Anchor hydration 57–72 ms. Evidence is `phone-guest-validation-summary.jsonl` and `numeric\phone-v4-guest-validated01..10.jsonl`. An earlier visibility assertion failed while the normal Home teaching tip/scroll hid artwork; storage still restored one Anchor. It is retained as an incomplete setup attempt, excluded from the fresh ten-pass series. Physical guest persistence is verified; complete PERF-001/082 acceptance still requires the remaining auth/recovery/account and iOS matrix.

The seven focused suites were rerun by parent and passed all 88 tests (`focused-jest-7s88-final-parent.log`, exit proof `focused-jest-7s88-exit.json`). Parent TypeScript exited zero with no diagnostic output (`tsc-handoff-final.log`, `tsc-handoff-exit.json`). Harness tests passed 21/21. The two retained AuthHydrationService data-retention assertions and other broader failures remain unresolved; no tests were weakened.

A new independent local demo account C has a verified emulator custom comped claim; the loopback fixture grants comped status only to that UID and claim. A/B remain Free. This enables testing through the unchanged Pro gate without production billing, account, backend, client override or purchase. Earlier Free paywall results are preserved; C session runtime is not yet a result at this checkpoint. Local comped coverage cannot validate production entitlement or canonical guest-account ownership transfer. Diagnostic motion/startup-fault preparation is isolated from shared mobile source and will be independently reviewed before native use.

### Physical motion and repeated-launch checkpoint

The full-UI, single-Anchor phone guest passed 30/30 Home→Details→Home cycles. Its adaptive capture `phone-home-details-adaptive/native-v4-01` had matching package/cmdline/PID 18082/start ticks 67817255 at both boundaries. Perfetto covers 29.962 seconds of the longer run (445 actual frames, expected cadence 8.333 ms): actual-frame p50/p95/p99/max 7.452/12.725/43.498/63.031 ms. Separate gfxinfo spans 127.816 seconds: 31/611 janky (5.07%), six missed vsync, 15 slow bitmap uploads. PSS 546,028 KB. These are automated partial-window baselines, not navigation latency or delivered FPS.

The 72-Anchor carousel passed 20/20 swipes, selected index 1→21. `phone-carousel-adaptive/native-v4-01` has exact package/PID 5714/start ticks 68046493 at both boundaries; 34.940-second trace, 304 actual frames, 8.333 ms expected cadence, p50/p95/p99/max 9.012/16.285/16.409/138.283 ms. Separate gfxinfo spans 222.741 seconds: 94/3,015 janky (3.12%), PSS 675,643 KB. The settled numeric stream contains twenty 719,217-character/400-chunk writes, 803 calls each, zero native failures: native durations 5,620–9,299 ms, median 8,059 ms. No per-swipe marker exists. Selection's whole-vault persistence is confirmed write amplification, while causation of a specific frame or the historical Focus hang remains unproved.

The first requested-60-Hz capture stayed at 120 Hz and is explicitly not 60 Hz evidence. A second approach temporarily set previously absent system min/peak refresh keys to 60 and used a nonpersistent display preference; active mode 3 and trace expected cadence 16.667 ms confirmed 60 Hz. Three Home→Details→Home cycles passed with the 72-Anchor SVG fixture selected at 21. `phone-home-details-60-actual/native-v4-01`: 34.937-second partial trace, 522 actual frames, p50/p95/p99/max 15.788/22.768/45.192/184.586 ms. Separate gfxinfo spans 52.135 seconds: 21/327 janky (6.42%), two missed vsync, 13 slow bitmap uploads; PSS 786,815 KB. The two temporary system keys were deleted back to their original null values; saved preferred/active mode 1 at 120 Hz was verified. This fixture differs from the earlier single-Anchor PNG run; frame distributions are not an optimization comparison. Matching 72-Anchor adaptive subset preparation is separate.

An additional ten 72-Anchor process-kill/cold-relaunch checks passed with selected index 21 preserved, no onboarding or recovery screen: activity draw 505–611 ms (median 595.5), Anchor hydration 1,969–2,476 ms (median 2,430.5). `phone-72-cold-summary.jsonl` is the ten-pass series; a preceding reserved-PowerShell-variable script failure is retained as setup evidence and excluded. A three-second background/foreground check returned that same Home/selection, HOT activity draw 58 ms/Wait 61; there was no active audio, so it is not audio continuity evidence.

V4 phone test-account sign-in was blocked by RNFirebase 24's Android emulator-host remap: exact `127.0.0.1` was rewritten to `10.0.2.2`, explaining why A/B emulator tests succeeded while phone sign-in hung. The immutable V4 native Firebase BuildConfig contains an empty JSON object. V5 must compile the diagnostic-only `android_bypass_emulator_url_remap=true` flag and verify the exact returned loopback host/port before sign-in. This is a local harness/toolchain correction, not a production auth or credential failure. No physical C sign-in, Focus completion or V5 startup-fault result is claimed yet.

### Final complete harness inventory (parent-verified)

Untracked harness source/documentation files: **42**. This replaces earlier interim inventories; raw captures, generated Python caches and TEMP logs/binaries are excluded. Superseded patches are retained with DO NOT APPLY instructions in the integration guide.
- `docs/performance-audit-2026-10/harness/.gitignore`
- `docs/performance-audit-2026-10/harness/analyze-framestats.py`
- `docs/performance-audit-2026-10/harness/app-filtered-summary.sql`
- `docs/performance-audit-2026-10/harness/auth-emulator/diagnostic-config.cjs`
- `docs/performance-audit-2026-10/harness/auth-emulator/firebase.json`
- `docs/performance-audit-2026-10/harness/auth-emulator/fixture-api.cjs`
- `docs/performance-audit-2026-10/harness/auth-emulator/google-services.perf-diagnostic.json`
- `docs/performance-audit-2026-10/harness/auth-emulator/mobile-auth-diagnostic-v4.patch`
- `docs/performance-audit-2026-10/harness/auth-emulator/mobile-auth-diagnostic.patch`
- `docs/performance-audit-2026-10/harness/auth-emulator/README.md`
- `docs/performance-audit-2026-10/harness/auth-emulator/setup-synthetic-account.cjs`
- `docs/performance-audit-2026-10/harness/auth-emulator/test-fixture.cjs`
- `docs/performance-audit-2026-10/harness/capture-android.ps1`
- `docs/performance-audit-2026-10/harness/capture-identity.ps1`
- `docs/performance-audit-2026-10/harness/collect-numeric-diagnostics.ps1`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic-v2-perfbaseline.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic-v4-overlay.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic-v5-overlay.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic-v5-recovery-overlay.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/apd-diagnostic.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/diagnosticEventSchema.test.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/diagnosticEventSchema.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/INTEGRATION.md`
- `docs/performance-audit-2026-10/harness/diagnostic-src/jest.harness.config.cjs`
- `docs/performance-audit-2026-10/harness/diagnostic-src/motion-read-fixtures.json`
- `docs/performance-audit-2026-10/harness/diagnostic-src/perfFixtureLinking.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/ReleaseMotionFixture.test.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/ReleaseMotionFixture.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/ReleaseStorageBenchmark.test.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/ReleaseStorageBenchmark.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/startup-fault-v5-consumers.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/startup-fault-v5-hooks.patch`
- `docs/performance-audit-2026-10/harness/diagnostic-src/startupFaultDiagnostic.test.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/startupFaultDiagnostic.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/SyntheticAnchorFixture.test.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/SyntheticAnchorFixture.ts`
- `docs/performance-audit-2026-10/harness/diagnostic-src/test-shims/expo-virtual-env.cjs`
- `docs/performance-audit-2026-10/harness/diagnostic-src/tsconfig.harness.json`
- `docs/performance-audit-2026-10/harness/generate-synthetic-fixtures.mjs`
- `docs/performance-audit-2026-10/harness/README.md`
- `docs/performance-audit-2026-10/harness/test_analyze_framestats.py`
- `docs/performance-audit-2026-10/harness/validate-harness.ps1`

### Final V5 native and handoff boundary (2026-10-12)

The owner requested wrap-up with approximately 7% usage remaining. Runtime work stopped; this final record supersedes the V5-pending checkpoints above without replacing the historical V4 measurements. **PERF-001 source protection is secured and physical guest persistence passed; complete PERF-001/082, premium motion/audio and recovery acceptance remain pending.**

V5 native release built successfully and was independently verified before parent updated only the agent-created phone PERF LAB package, preserving its synthetic data. Artifact: `E:\apd\record\archive\anchor-perflab20261012-v5-startup-motion-dualabi.apk`, **245,172,537 bytes**, SHA-256 **`1702C59554888A30CFAB4AB808467315096484E04928CB1B275C5BCD8DD0A2F7`**. Package `com.anchorintentions.perflab20261012`, arm64-v8a/x86_64, version 2.0.0 (39), runtime 2.0; local debug-key signing of a non-debuggable/profileable release, production Hermes v96, V2/Fabric, minification/resource shrinking, OTA disabled. No debug overlays or unrelated feature changes. Diagnostic-only demo Firebase, loopback API and instrumentation remain explicit deviations from production wiring. Neither owner nor user-touched baseline installation was updated.

Build duration was 14m34s; 1,277 tasks, 65 executed/1,212 up-to-date. R8 emitted advisory dependency warnings but compilation succeeded. Verification is `E:\apd\record\verify\v5-verification-summary.json`; corrected provenance `E:\apd\record\v5-build-provenance.json` has SHA-256 `462A66A081D4427A14A1E730345FB03546CB874165FF2E8EF467BD4798758937`. All 23 recorded SHA fields are 64 characters and 19 mapped input/artifact hashes match. V5 bundle SHA-256 is `5B69AD8DB124E5DFE3ED036BAED849C14E9B48E9A0C88260C3F15F569632AF39`; 2,004-file input manifest SHA-256 is `DF8D0E6CFCD9B7AB8C18202EAB41ECA4B640679DD386AC7CB26C33E7A58AEFE4`.

The native Firebase configuration now compiles `android_bypass_emulator_url_remap=true`. Physical numeric `auth-emulator-route` result `okCode=1` verifies the intended loopback route. Parent then signed into independent synthetic demo C through the normal UI and verified its local comped **PRO** profile through the unchanged entitlement gate. A/B remain Free; this is not production billing or backend acceptance. The 72-Anchor/index-21 guest vault was retained **before C sign-in**. After sign-in, Home displayed “Unable to load your Anchors”: the loopback fixture lacks GET `/api/anchors` and `/api/auth/me/export`, returning 404. Canonical C hydration/ownership and guest-to-account transfer are therefore unverified; neither data loss nor post-transition retention is inferred. The local API recorded zero sessions. Evidence: `%TEMP%\anchor-perf-release-20261012\numeric\phone-v5-first-launch-route-verified.jsonl`, `phone-v5-c-auth-home.jsonl`, and `phone-v5-c-final-before-stop.jsonl`.

V5 startup/motion harness source passed TypeScript and **60/60** focused harness tests. Parent's separate actual auth/storage consumer tests passed **5/5**, with normalized source-parity proof against the APK inputs. An initial consumer-test configuration failure ran zero tests; the portable configuration was corrected without changing assertions/frameworks. Evidence: `consumer-v5-portable-parent.log`, `consumer-v5-portable-parent-exit.json`, `consumer-v5-parent-source-parity.json`. The numeric collector now recognizes the new fixed event/field allowlists; mock parsing rejects unknown events, string values and unapproved numeric fields. No credentials, tokens, intentions or image payloads are collected.

The isolated fault consumers and existing-cache motion fixtures are prepared, but native 12-second required-store delay, 16-second missing callback, 14-second normal slow callback, restart/reopen, repeated-null callbacks, ten Focus completions, full Deep Prime, guided Visualize, Vision/Chart interactions and active audio/background continuity were **not run to acceptance**. The source 10/15-second tests do not substitute for these native checks. Complete physical account return/switch/merge and iOS also remain open. No SQLCipher migration, production schema change, animation/audio redesign, framework upgrade, production backend write, paid cloud build, OTA or publication occurred.

Cleanup: force-stopped only the known synthetic lab package, removed only its 9099/39999 ADB reverses on phone/fresh emulator, stopped the verified temporary demo Auth CLI and fixture API, and verified no listeners on those ports. Deleted only the three generated synthetic credential files after exact directory/project/application/UID checks. Original 8081/8000 phone reverses remain; system peak/min refresh settings returned to their original null values and saved preferred/active 120 Hz mode was verified. Installed lab data, AVD data, build artifacts and evidence were preserved. Numeric cleanup proof is `%TEMP%\anchor-perf-release-20261012\cleanup-final.json`.

Final Git: `feat/celebration-layer`, HEAD `6911321cdf7ee32c9e40346d307dbd44823a34e6`; product fix `9a158b7d3efeab62e42b6d8f8f01d8b45edb3caa`. Mobile tree clean/index empty. Exact 14 committed paths are listed above; five existing audit documents and the 42-file harness inventory remain uncommitted for review. Broader subset remains 12 failing suites/26 assertions, including two local-retention failures. **Next phase:** complete the missing canonical synthetic API routes and native acceptance matrix, resolve those data-safety failures, then validate/approve section 8's account isolation, SQLCipher/key/backup/runtime, transactional verification/crash recovery and rollback decisions before implementation. The measured bulk-storage and auth interference warrant that work; they do not establish the Focus or navigation cause.

### Targeted AuthHydrationService data-integrity remediation (2026-10-12 continuation)

- **Root cause of the two `AuthHydrationService.test.ts` failures (Class A confirmed production defects, RC-2 / PERF-039):**
  1. `preserves unsynced local temp anchors during authenticated hydration` and `keeps local progress when anchor hydration fails after login` both failed because `AuthHydrationService.hydrateAuthenticatedData` (`src/services/AuthHydrationService.ts`, introduced in `7b3a9315`) computed `isLockedFreeUser = Boolean(user && !hasActiveEntitlement && (user.freeAnchorConsumed || (user.totalAnchorsCreated ?? 0) >= 1))` during both the early `/api/anchors` commit and the final hydration commit, calling `anchorStore.removeAnchor(a.id)` on every local non-UUID Anchor (`!isBackendAnchorId(anchor.id)`), calling `clearPendingFirstAnchorState()`, and setting `preservedLocalAnchors = []`. Because `useSubscriptionStore.getState().hasActiveEntitlement` is unpersisted across cold starts, false while offline, and false for comped/legacy-migration accounts (`user.isComped` / `user.legacyMigrationAccess`), this condition evaluated true for returning users with `totalAnchorsCreated >= 1` and silently destroyed unsynced local Anchors and pending first-anchor drafts/mutations.
  2. When `/api/anchors` rejected and neither `shouldUseExportAnchors` nor `shouldUseAnchorSnapshot` applied, `restoredAnchors` fell back to `remoteAnchors` (`[]`), which also wiped any persisted backend-UUID Anchors in `anchorStore` and cleared `anchorStore.error` via `setAnchors`.
  3. In-flight local mutations or Anchor creations occurring while `hydrateAuthenticatedData` awaited network/snapshot responses could be overwritten by older server snapshots (PERF-039).
- **Remediation (`src/services/AuthHydrationService.ts`):**
  - Removed the destructive `isLockedFreeUser` purge and `clearPendingFirstAnchorState()` calls from `AuthHydrationService.hydrateAuthenticatedData` (explicit user-driven discard remains in `V2SealedSaveScreen`, `SaveProgressScreen`, and `V2FirstRunFlow`).
  - Added `mergeAnchorWithNewerLocalState` so any local Anchor with a strictly newer `updatedAt` timestamp than an incoming server snapshot retains its newer local fields and `Math.max` activation count.
  - Added `selectPreservedLocalAnchors` with `initialBackendAnchorIds` tracking at hydration start so both non-UUID local Anchors and backend-UUID Anchors created locally while hydration is in flight (belonging to the active user or `'guest'`) are preserved.
  - Preserved existing current-account backend-UUID Anchors and retained `remoteAnchorState: 'error'` + error message when `/api/anchors` fails without export or snapshot recovery.
- **Verification:**
  - `src/services/__tests__/AuthHydrationService.test.ts`: **17/17 passed** (all 13 existing tests including both previously failing data-safety tests + 4 new targeted regression tests covering newer local mutations/in-flight creations, guest pending first-anchor draft/mutation preservation on locked free accounts, `/api/anchors` network failure preserving synced and unsynced Anchors, and repeated hydration idempotency).
  - Related suites: `appAuthState.test.ts`, `authStore.test.ts`, `useAppStartup.test.ts`, `useRequiredLocalHydrationGuard.test.ts`, `StartupRestoreFailure.test.tsx`, `reloadCurrentApp.test.ts`, `AppStartupHydration.integration.test.tsx`, `PostAuthFlowService.test.ts`, `V2SealedSaveScreen.test.tsx`, `V2FirstRunFlow.test.tsx`, and `SaveProgressScreen.test.tsx` — **12/12 suites passed (174/174 tests)**.
  - TypeScript (`node ./node_modules/typescript/bin/tsc --noEmit --pretty false`): **exit 0**.
  - Unverified / remaining gates: physical/native device verification of the updated hydration merge against live/synthetic endpoints, PERF-008/035/036 offline queue drain, and Section 8 SQLCipher migration validation/approval.

### Authenticated Hydration, Account Isolation & Data Safety Validation Pass (2026-10-12)

- **Task 1 — Hardened data-integrity edge cases (`anchor/mobile`):**
  1. **Cross-account & guest-Anchor isolation (`src/services/AuthHydrationService.ts`, `src/stores/authStore.ts`):** Added `isGuestOwnedAnchor`, `isAuthorizedPendingFirstAnchorTransfer`, and `canPreserveAnchorForUser` so guest-owned (`userId === 'guest'` or `pending-first-anchor-*`) and foreign-account Anchors cannot leak into an authenticated account during hydration unless explicitly authorized by an active `pendingFirstAnchorDraft` (`source !== 'authenticated'`). Updated `authStore.setUser` and `authStore.setSession` to clear `pendingFirstAnchorDraft` when switching between two distinct authenticated accounts (`state.user.id !== user.id`).
  2. **Equal or missing `updatedAt` preservation (`src/services/AuthHydrationService.ts`, `src/stores/anchorStore.ts`):** Attached a non-enumerable `__missingUpdatedAt: true` marker in `anchorStore.normalizeAnchor` when `updatedAt` is absent/invalid, and updated `mergeAnchorWithNewerLocalState` so local Anchors with equal (`localUpdatedAtMs >= remoteUpdatedAtMs`) or missing `updatedAt` timestamps are preserved over server copies.
  3. **Authoritative server deletion / V2 Release (`src/services/AuthHydrationService.ts`):** Enforced server-confirmed deletion and V2 Release (`isReleased`, `releasedAt`, `archivedAt`, `isArchived: true` in export, and `burnedAnchors` in `/api/auth/me/export`) as authoritative via `collectServerDeletedAnchorIds` and `filterReleasedAnchors`, preventing stale local snapshots or newer local timestamps from resurrecting released/deleted Anchors.
  4. **Overlapping hydration isolation (`src/services/AuthHydrationService.ts`):** Added monotonic `latestHydrationId` plus initial token/user identity checks in `isCurrentAccount()` and export `account.id` verification so overlapping hydration operations cannot apply stale or cross-account data.
  5. **Free/premium/comped restriction enforcement without destructive deletion (`src/stores/authStore.ts`, `src/services/PostAuthFlowService.ts`, `src/screens/v2/onboarding/V2FirstRunFlow.tsx`, `src/screens/v2/onboarding/V2SealedSaveScreen.tsx`):** Honored `remoteCompedAccess`, `legacyMigrationAccess`, `user.isComped`, `user.legacyMigrationAccess`, and `user.subscriptionStatus !== 'free'` alongside RevenueCat `hasActiveEntitlement`. Updated `V2FirstRunFlow` returning-user bypass to purge only unconfirmed non-user-owned drafts (`!isBackendAnchorId(a.id) && a.userId !== user.id`), preserving user-owned unsynced Anchors during temporary entitlement-loading states while keeping the 2nd-Anchor `CREATE_ANCHOR_FREE_LOCKED` gate intact.
- **Task 2 — Canonical synthetic backend fixture routes (`docs/performance-audit-2026-10/harness/auth-emulator/fixture-api.cjs`, `test-fixture.cjs`):**
  - Implemented RAM-only canonical routes matching production backend contracts (`anchor/backend/src/routes/auth.ts`, `anchor/backend/src/routes/anchors.ts`): `GET /api/auth/me`, `GET /api/anchors`, `GET /api/auth/me/export`, `POST /api/anchors` (enforcing `403 CREATE_ANCHOR_FREE_LOCKED` on a second Anchor for non-comped free accounts and allowing unlimited Anchors for comped account C), `PUT /api/anchors/:id`, `POST /api/anchors/:id/charge`, `POST /api/anchors/:id/activate`, `PUT /api/auth/onboarding-context`, and `PUT /api/auth/notification-state`.
  - Validated against the isolated local Firebase Auth Emulator (`demo-anchor-perf`, `127.0.0.1:9099`, `firebase-tools@15.33.0`): `node .\test-fixture.cjs`, `node .\test-fixture.cjs --secondary`, and `node .\test-fixture.cjs --comped` all **PASS (exit 0)**, after which the emulator process was stopped and temporary credential files were removed.
- **Task 3 — Physical Android verification status (Blocker documented):**
  - Checked connected Android targets via `adb devices -l`: the physical Galaxy S24 Ultra (`SM-S928U1`) was disconnected/unavailable during this pass (only `emulator-5564` was attached). Physical on-device execution of the updated hydration and post-auth fixture routes remains a hardware-availability blocker until the S24 Ultra is reconnected.
- **Task 4 & 5 — Regression & TypeScript verification:**
  - **16/16 targeted Jest suites (228/228 tests) PASS**: `AuthHydrationService.test.ts` (22 tests), `PostAuthFlowService.test.ts` (4 tests), `V2FirstRunFlow.test.tsx`, `V2SealedSaveScreen.test.tsx`, `appAuthState.test.ts`, `authStore.test.ts`, `subscriptionStore.test.ts`, `AnchorSyncService.test.ts`, `useTrialStatus.test.ts`, `entitlements.test.ts`, `useAppStartup.test.ts`, `SaveProgressScreen.test.tsx`, `AppStartupHydration.integration.test.tsx`, `useRequiredLocalHydrationGuard.test.ts`, `StartupRestoreFailure.test.tsx`, and `reloadCurrentApp.test.ts`.
  - TypeScript (`npx tsc --noEmit --pretty false`): **exit 0 (0 diagnostics)**.



## Senior data-safety review continuation — 2026-10-13

**Decision: DATA-SAFETY GATE OPEN.** This is an independent continuation of PERF-001/039/082 and the existing PERF-002/004 persistence proposal, not a new 89-issue audit. The prior passing test counts are historical reports; they did not prove durable account retention. Reviewed baseline was HEAD `299d59cc`; unrelated Share Studio/Vision edits and concurrent work were preserved. No commits, publication, production database calls, vault migration, SecureStore redesign, or premium visual/audio/motion changes were authorized or performed in this pass.

### A. Independent findings

| Area | Verdict | Evidence and user risk |
|---|---|---|
| Account switching / durable retention | **Incorrect and unsafe; storage fix not implemented** | `authStore.ts:145` filters the active array in `setUser`/`setSession`. `anchorStore.ts:570-581` persists that entire array to one `anchor-vault-storage` key. Direct switches do not call `saveAnchorSnapshot`; saving a snapshot occurs only in `signOut` (`authStore.ts:1136` onward). Four synthetic safety regressions reproduce permanent loss of A's only unsynced Anchor after A→B, successful or failed B hydration, simulated loss of process memory/real Zustand rehydration, and offline A return. B does not see A in those cases, but isolation is achieved by erasing A. Hydration independently performs destructive filtering (`AuthHydrationService.ts:1005-1022`). |
| Missing timestamp representation | **JSON restoration is correct, reconciliation is incomplete/unsafe** | The non-enumerable Date marker and `toJSON() => null` persist `updatedAt:null`; normalization recreates a marked Date, compatible with older null/absent/invalid timestamps. An Anchor shallow spread retains the same Date reference even though its own marker is omitted. JSON cloning loses the marker until normalized; `new Date(oldDate.getTime())` loses it permanently. `UserLocalStateService.saveAnchorSnapshot` uses JSON and retains null semantics. `AuthHydrationService.ts:841-918` treats missing local ordering as an indefinite local win: two later server revisions still cannot replace stale local fields (failing regression). Legacy `AnchorSyncService.ts:99-134` explicitly calls `toISOString()` and sends the fallback time; retry deserialization normalizes null to now (`:64-69,317-352`). This is inconsistent with JSON persistence, but legacy Supabase sync is disabled in the normal configuration. No timestamp representation rewrite was attempted because choosing server precedence without distinguishing unsynced edits could lose data. |
| First-Anchor transfer | **Correct intent, incomplete as implemented; targeted fixes verified** | The original single promise did not fence intermediate requests or stale catch/finally writes; creation sent no idempotency key. Red tests reproduced token-lookup account change, late create response continuing charge replay, late A failure clearing B's operation, dropped create response retry, consumed-free-slot replay, and loss of confirmed charge progress before an interrupted activation. The corrected operation is bound to account revision, token and draft, and checks each response boundary. Creation and legacy unkeyed mutations now use stable keys. Real backend code accepts create/charge/activate keys and enforces owner identity (`backend/src/api/routes/anchors.ts:155,221,227,631-648,1258-1272,1364-1378`); Prisma has unique create/event constraints. This was source-reviewed, not verified against production. Crash atomicity of the draft, Anchor and cursor remains open. Old response-lost requests sent without a key cannot be retrospectively deduplicated. |
| Hydration / Release | **Correct but incomplete; account-race and onboarding fixes verified** | Existing local-newer/equal timestamp, API-failure preservation, server Release precedence, unrelated local Anchor retention, and free/comped/premium gate tests pass. A new A→B→A test reproduced acceptance of an old A response when its UID/token returned to the original values; a process-local account revision now invalidates that response. PostAuth migration used a stale collection and could commit A into B or remove same-account additions/edits; it now checks context after awaits and reconciles with live state. Returning-user onboarding automatically purged unconfirmed drafts, and explicit discard deleted every temporary Anchor: both were reproduced and corrected. Missing timestamp convergence, malformed duplicate backend IDs, legacy retry Release races, and RevenueCat's internal asynchronous account side effects remain open. |

The canonical first-create and charge/activate payloads select explicit fields and do not send `updatedAt`, so this Date override does not change their backend request shape. The enabled/disabled legacy Supabase adapter uses explicit ISO conversion instead; that inconsistency is documented separately above.

### Account persistence questions answered

1. **Full active array persisted?** Yes. Zustand persists on state changes, including `setAnchors` during filtering; the persisted slice contains the reduced full array.
2. **Can filtering erase A's saved data?** Yes. The durable shared vault is overwritten, and there is no automatic durable backup on a direct `setUser`/`setSession` switch.
3. **Unsynced A Anchors?** Only a previously completed account snapshot or independently queued sync may retain them. Neither is guaranteed. The four regressions use an unsynced Anchor with no prior sign-out snapshot and recover nothing.
4. **Offline A return?** The overwritten vault cannot recreate A. Hydration can load an existing account snapshot even when the network fails, but direct switching need not have created one and snapshots are not live mirrors of edits.
5. **Separate account records?** The active vault is shared. Account-specific `anchor:anchor-snapshot:<userId>` keys exist as sign-out snapshots, not independently maintained authoritative account vaults. Guest and pending-transfer state also live in shared stores.
6. **Interrupted switch?** Not proven safe. Filtering can be persisted before the new auth state is durable; sign-out continues clearing after snapshot failure; chunk writes delete old chunks before new data is complete. No transaction covers auth, Anchor, pending draft or selection.
7. **Guest transfer state?** The direct switch filter permits only the target owner and the `test-user-123` placeholder, then clears pending state; guest-owned pending drafts can be lost. Guest→account bypasses that filter, but hydration retains only an authorized pending transfer and can overwrite other guest records. Placeholder/unowned acceptance is also not a proof of strict owner isolation.
8. **Late persistence writes?** Yes. A new real-adapter synthetic regression delays an older native chunk write, completes a newer write, then releases the old write. Final read returns the older payload. Debouncing does not serialize writes already in flight. This is a fail-open storage ordering problem, independently of hydration invocation fences.

### B. Targeted implementation and compatibility

Production files changed in this review:

- `anchor/mobile/src/stores/authStore.ts`: account revision; operation-owned coalescing/catch/finally; token/draft fences; stable create and fallback mutation keys; explicit attempted-create marker; foreign draft owner rejection; confirmed progress applied before cursor advancement.
- `anchor/mobile/src/types/index.ts`: additive optional `PendingFirstAnchorDraft.createAttempted`. Absent values from older versions remain supported; a fresh locked free draft still cannot create. A prior attempted draft may ask the backend to replay its key; backend creation limits still apply if there is no matching row.
- `anchor/mobile/src/services/ApiClient.ts`: optional context guard before/after async token lookup and captured-token support. A transfer cannot borrow B's token after Firebase switches ahead of its Zustand callback. Existing unbound callers keep their existing contract.
- `anchor/mobile/src/services/AuthHydrationService.ts`: process-local revision fence, updated only after this invocation legitimately establishes its profile owner.
- `anchor/mobile/src/services/PostAuthFlowService.ts`: account/token/revision checks after awaited work; live-state reconciliation retains additions, edits and removals during migration; attempted draft replay may proceed to the server without bypassing server creation limits.
- `anchor/mobile/src/screens/v2/onboarding/V2FirstRunFlow.tsx`: removes automatic local draft/pending-state deletion during a returning-user bypass. Navigation and analytics remain the same.
- `anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx`: explicit discard removes only the pending Anchor. Other unsynced records survive. A response-lost or backend-confirmed pending save can retry its existing server key even if its free slot is now consumed; a fresh locked draft and explicit backend denial still show the existing Pro gate. Visual layout, animations, sounds and haptics were not edited.

Test files changed: existing `authStore.test.ts`, `ApiClient.test.ts`, `PostAuthFlowService.test.ts`, `V2FirstRunFlow.test.tsx`, and `V2SealedSaveScreen.test.tsx`. Added `src/services/__tests__/AuthHydrationSeniorReview.test.ts` and the isolated harness `harness/senior-review/{jest.safety-gate.config.cjs,accountRetention.gate.test.ts,storageOrdering.gate.test.ts}`. The old onboarding test expecting deletion was replaced with the stronger preservation requirement because it asserted the destructive defect; no test was skipped or weakened to obtain green. The charge request assertion now requires the retry key and account guard/token config.

### C. Independent verification and explicit open assertions

- **10 targeted mobile suites / 252 tests PASS**: AuthHydrationService, anchorStore, authStore, PostAuthFlowService, V2FirstRunFlow, V2SealedSaveScreen, appAuthState, AppStartupHydration integration, useAppStartup and ApiClient. Final command: from `anchor/mobile`, `npx jest --runInBand --runTestsByPath` with those ten file paths. Evidence: `senior-review-final-targeted.log` in the local mobile working directory (logs are ignored artifacts, not new product files).
- **Narrow independent Luna review: 9.1/10**, three affected service/store suites independently passed **99/99**. This is a rating of the corrections, not overall storage safety approval.
- **Open mobile safety assertions: 2 failed / 1 passed** in `AuthHydrationSeniorReview.test.ts`: missing timestamp convergence and malformed duplicate backend IDs remain red; A→B→A revision fencing passes. A healthy server cannot normally produce duplicate database primary IDs; this is a defensive malformed-response gate, not evidence of duplicate production rows.
- **Open isolated storage gates: 2 suites / 5 failed tests**. Four direct-switch retention cases and the late-write ordering case fail on synthetic storage only. Run with `npx jest --config ../../docs/performance-audit-2026-10/harness/senior-review/jest.safety-gate.config.cjs --runInBand`. Gate assertions deliberately remain active and failing. Their process-memory reset uses real Zustand persistence rehydration; it is not a native kill/restart claim.
- Initial tooling attempt named a nonexistent `src/__tests__/App.test.tsx`; it ran seven real suites/194 passing tests and one path error. The corrected final command includes the existing `AppStartupHydration.integration.test.tsx`. An intermediate account-revision change invalidated its own owner-establishment path and failed nine old hydration tests; that defect was corrected, and all 22 original hydration tests pass in the final run.
- TypeScript and native rebuild/runtime outcomes are recorded in the final checkpoint below. The prior agent's 203/228 counts and old APK/physical measurements are retained as historical evidence, not current acceptance.

### D. Storage proposal boundary — not implemented

A minimal durable handoff must keep A's records recoverable before hiding them, maintain separate owner-bound authoritative records (or a durable retained partition within the existing vault), await and verify the outgoing snapshot before committing the new account, serialize persistence writes by key, and fail closed on snapshot/write/read corruption instead of clearing unknown data. Recovery must survive kills at every handoff stage; inactive accounts must not enter the active `anchors` array; guest drafts need explicit transfer ownership and durable mutation progress. Existing snapshots could be reused, but making them reliable needs changes to sync/async account APIs and storage ordering/atomicity, not an extra fire-and-forget save beside the current filter. No such architecture change was implemented under this assignment's stop rule. No SQLCipher or SecureStore migration was performed or approved.

Remaining targeted risks: `signOut` clears after a snapshot failure; incomplete chunk reads clear partial data; account-specific snapshot writes use the same non-atomic chunk writer; Release retry cancellation can race an in-flight legacy flush; RevenueCat login/refresh can mutate its internal account state before the outer PostAuth guard detects supersession (rewriting RevenueCat is explicitly out of scope); a first-create replay returns original server content and needs a dirty-content policy if the pending draft was edited after the attempt. All must remain visible in the next persistence safety plan rather than be hidden behind current passing tests.

### E. Data-safety and next-phase decision

**No: a user is not currently guaranteed to switch accounts and later recover all locally saved/unsynced Anchors without private content crossing boundaries.** Durable loss is demonstrated, and strict isolation has additional placeholder/legacy transition gaps. Keep PERF-001/039/082 account-transition acceptance open.

The narrow corrections are appropriate to retain, but the authentication/hydration foundation is **not safe enough to close the prerequisite gate**. PERF-003 Focus may be investigated only as explicitly isolated diagnostic work; this review does not certify readiness to progress on an assumed-safe persistence foundation. SQLCipher planning can incorporate these requirements, but migration approval, implementation and rollout remain separate and unapproved. Stop this continuation after final regression checks, available isolated runtime attempts and documentation.


### Final verification checkpoint — 2026-10-13

| Check | Verified result |
|---|---|
| Final targeted Jest | **10 suites / 252 tests PASS**, exit 0. This includes the additional existing-key retry screen regression. No whole-application Jest rerun was performed. |
| TypeScript | `npx tsc --noEmit --pretty false`: **exit 0**, final output contains no diagnostics. |
| Active safety gates | **7 failing assertions remain**: four durable A→B→A retention variants, one stale asynchronous storage-write ordering case, missing-timestamp convergence, and malformed duplicate backend IDs. The new account-revision hydration case passes. These failures were not skipped or weakened. |
| Synthetic backend/Auth Emulator | Established `demo-anchor-perf` Firebase Auth Emulator and guarded loopback API only. Fixture A, B and comped C tests **PASS**. A persistent-API contract check verifies same-key create replay returns the same Anchor (201→200), charge/activate replay keeps each count at 1, and cross-owner operations return no Anchor content; B's list/export remain empty. This is RAM-only fixture testing, not production database or device persistence acceptance. |
| Fixture correction | `harness/auth-emulator/fixture-api.cjs` originally ignored create `idempotencyKey` and rejected replay after the free slot was consumed. Added owner-checked replay before the cap, matching the real backend. `test-fixture.cjs` now asserts same-owner replay and cross-owner 409/no-data using its existing unclaimed demo account, preserving standalone A/B/C invocation. Node syntax checks and diff check pass. The persistent API process was restarted after the edit; only synthetic RAM records were reset. |
| Connected hardware | ADB showed physical **SM-S928U1** (two wireless transports to the same phone) and **emulator-5564**. Static isolated build gates verified `com.anchorintentions.perflab20261012`, `demo-anchor-perf`, the guarded loopback API/Auth route, and exact hashes of eleven critical product files. Owner `com.anchorintentions.app` and protected `perfbaseline` were not installed, cleared or modified. |
| Current-source native rebuild | **Blocked: no current APK.** The final bounded Gradle attempt ran **11m54s**, completing the 5,906-module JS bundle, resource merge and Kotlin compilation, then failed at `:app:minifyReleaseWithR8` with `java.lang.OutOfMemoryError: Java heap space`. Earlier tooling attempts encountered PowerShell argument splitting, ten stale generated WAV resources from the old lab build, and shared Metro-cache `ENOTEMPTY` contention. Arguments were quoted; only the ten verified generated leaves under the isolated build root were archived/removed; the final attempt used task-local TEMP/TMP. No product audio or build architecture change was made. Further build expansion was stopped. |
| Physical device results | **No current-build physical runtime acceptance.** No new APK was installed; no native startup/sign-in/switch/offline/restart observations from this source are claimed. |
| Android emulator results | **No current-build Android emulator runtime acceptance.** Firebase Auth Emulator/API contract checks above are separate from Android emulator app tests. The existing older lab install was not used to certify current code. |
| Stale APK rejection | The remaining APD `app-release.apk` is **245,172,537 bytes**, last written **2026-10-12 21:57:10 UTC** and predates this review snapshot. It was neither installed nor represented as current. |
| Cleanup | Owned Auth Emulator and fixture API stopped; ports 9099/39999 have no listeners. Transport 7 reverse list is empty. Only the generated A/B/C credential files in the verified synthetic TEMP fixture directory were removed. No device data was cleared. Shared Metro cache, source edits and historical lab evidence were preserved. |

Local build evidence: `E:\apd\record\gradle-auth-review-isolated-tmp.log`, `auth-review-static-isolation-gate.json`, `auth-review-critical-source-hashes.json`, and `auth-review-idempotency-contract.json`. The ten obsolete generated resource leaves and their SHA manifest are preserved in `E:\apd\record\archive\auth-review-stale-resource-leaves-20261013`. Core verification and open gates are also recorded in `harness/senior-review/verification.json`.

All four existing audit documents were updated with this continuation. Besides the seven production and six test files listed above, this pass changes the two fixture files, adds the isolated safety-gate config/two tests/verification JSON, and writes only isolated build/diagnostic artifacts outside the shared source checkout. Unrelated Share Studio/Vision edits, including work added concurrently during this review, remain untouched.

**Final decision remains NO / GATE OPEN.** Available source, Jest and isolated fixture evidence does not establish durable account recovery or complete private-content isolation. The demonstrated retention/order failures must be resolved through an approved durable account-handoff/storage design before treating the foundation as safe for next-phase progression. PERF-003 and SQLCipher are not started or approved by this continuation.

## Account-scoped persistence repair checkpoint — 2026-10-13

The bounded repair is implemented and uncommitted. It retains durable owner partitions beneath the UI array, preserves the legacy source, publishes verified immutable SecureStore generations, fences foreign late updates, and retains account-bound guest draft/mutation progress. No SQLCipher/native dependency/runtime change, OTA, subscription/motion/audio change, or legacy vault deletion is included. The user's reported startup recovery loop also exposed a reproducible timeout latch: successful local restoration after ten seconds now dismisses that timeout screen; actual storage/ownership recovery failures stay closed.

**Source results:** the seven original assertions were rerun red before editing. Four account-retention variants, stale native write ordering, and duplicate backend-ID collapse now pass unchanged. Missing-timestamp convergence remains failing because accepting server writing without evidence of synchronization can discard unknown-timestamp local edits; the existing preservation regression remains green. Focused regression checkpoint: **14 suites / 296 tests PASS**. Final App recovery check: **4/4 PASS**. Storage/partition gates: **14/14 PASS**; real-adapter tests with mocked native storage: **5/5 PASS**. Final TypeScript is clean. Original gate files were not edited. Fixtures with wildcard owners/unauthorized cross-account migration were corrected to explicit synthetic ownership and stronger durable-isolation assertions.

**Readiness remains OPEN:** Account A -> B -> loss of process memory -> offline A retention and exclusion from B are verified in synthetic automated tests for explicitly owned committed records, not yet certified in the native app. Original SecureStore/AsyncStorage sources remain recoverable through interrupted conversion in synthetic tests. Ambiguous ownership is preserved for explicit recovery, never assigned to the next login. This is not permission to begin SQLCipher or animation remediation.

See [ACCOUNT_SCOPED_PERSISTENCE_REPAIR.md](ACCOUNT_SCOPED_PERSISTENCE_REPAIR.md) for root cause, exact changed files, the partition/commit design, regression commands/evidence, limitations, reported-phone restoration boundary, and final native checkpoint. The normal phone package was not installed, cleared, or its vault extracted. Isolated native-build evidence is in `E:\apd\record\gradle-account-repair-4096m.log` and `account-repair-*.json`; the final native result is recorded below.


## Final native validation checkpoint

The release optimization blocker is repaired in the isolated lab. R8/minification/resource shrinking remain enabled. The final lab-only loopback network-policy rebuild succeeded in **4m36s** (`gradle-account-repair-loopback.log`). APK SHA256: **EC2F3A3AEFF08C6AC4B888051C3D09CF403420E8F325155128623DC81A9C34C4**. Application ID is `com.anchorintentions.perflab20261012`; version 2.0.0 / code 39, non-debuggable, profileable, OTA disabled. Eight repaired product files match the shared-source SHA256 hashes (`account-repair-final-source-hashes.json`). The diagnostic App includes the same storage-recovery guard.

A fresh task-owned Android emulator (`emulator-5570`) installed this APK. Synthetic Firebase A sign-in reached Home without the restore-error screen. Removing both loopback reverse ports and force-stopping/relaunching the lab left offline startup on its loading skeleton; no native offline-content recovery is claimed. Evidence screenshots: `E:\apd\record\account-repair-native`. Android initially denied HTTP to 127.0.0.1; only the lab network-security XML was amended to allow that loopback address. Production network policy was unchanged. The software emulator needed reduced pixel resolution after a SystemUI ANR; this is functional validation, not frame/performance acceptance.

Native **unsynced** Anchor retention, direct A-to-B switching, guest transfer, interrupted-write/conversion recovery, and the complete offline return-to-A matrix remain **unverified**. The automatic approval review rejected creating a synthetic Anchor in the RAM-only local fixture API with the reason "blocked by policy" and no further detail. It was not retried through an alternative tool. The current normal phone was disconnected; no normal package installation, account access, vault extraction, reset, or OTA occurred.

The overall gate remains **OPEN**: six of seven original assertions pass; missing-timestamp convergence still conflicts with the existing protection of potentially unsynced local writing. Final regressions: **14 suites / 296 tests pass**; final TypeScript and diff check pass. Interrupted legacy conversion recovery is verified automatically with mocked native storage, not certified on a device. No commit or staging, SQLCipher, or animation remediation followed.

Task-owned Auth Emulator/API processes were stopped, the fresh emulator was terminated, and all three generated credential files were deleted (zero remaining). Diagnostic build/test evidence is retained.


## Timestamp-convergence repair follow-up — 2026-10-13

The previously failing missing-timestamp assertion now passes **without changing any of the seven original assertions**. First observation preserves the local record and stores owner-scoped reconciliation evidence. A strictly newer server revision from a later hydration may become current only when the local content has not changed and no known local mutation is pending. This observation is not presented as proof of synchronization: the complete original local record is retained as a non-recursive recovery copy inside the same encrypted owner partition. Repeated reads, invalid/older/equal revisions, and fast-list/export reads within one hydration cannot advance the unresolved record.

Known edits retain their pending fields until a sync response contains the edited values. Stale direct acknowledgements and queued retries cannot erase a newer pending edit or clear its protection. Existing server-authoritative Release/deletion behavior is preserved. Recovery evidence survives subsequent server refresh/sync; no new plaintext store, dependency, native/runtime, subscription, or UI change was introduced. `getLocalRecoveryAnchor(id)` reads the retained original only from the current owner's partition. There is no new user-facing conflict-resolution screen; unresolved legacy writing stays recoverable through this store API and retained original storage, rather than being marked synchronized or deleted.

Files added/changed in this follow-up: `anchor/mobile/src/services/anchorReconciliation.ts` (new), `anchor/mobile/src/services/AuthHydrationService.ts`, `anchor/mobile/src/stores/anchorStore.ts`, `anchor/mobile/src/types/index.ts`, `anchor/mobile/src/services/__tests__/AuthHydrationTimestampSafety.test.ts` (new), `docs/performance-audit-2026-10/harness/senior-review/ownershipPartition.gate.test.ts`, and this report plus the three audit documents.

Evidence: unchanged failing baseline in `timestamp-baseline.log`; new tests red in `timestamp-safety-red.log`; **17 suites / 312 tests PASS** in `timestamp-regressions-final.log`, **3 suites / 15 storage tests PASS** in `timestamp-storage-gates-final.log`, and final focused nullable-ack/review tests plus TypeScript in `timestamp-final-review.log` / `timestamp-types-final4.log`. Nine timestamp-specific tests cover preserved original/reload, repeated observations, known pending writing/reload, account isolation, bypassed setter edits, confirmed acknowledgements, stale direct/queued acknowledgements, and nullable-field acknowledgement. The storage gate discards every in-memory partition, reloads committed bytes, verifies B cannot retrieve A's original, and restores it unchanged on return to A.

**Readiness:** all seven original automated safety assertions are green. A-to-B/restart/offline-A retention and interrupted legacy conversion remain verified automatically, not in the complete native app matrix. The previously built isolated APK predates this timestamp follow-up; no native acceptance or resolution of the user's current phone restore error is claimed. Changes remain uncommitted and unpublished. SQLCipher and animation remediation remain out of scope. Additional recovery evidence increases encrypted storage size only for records requiring reconciliation; this has not been benchmarked natively.

## Current-source native recovery validation — 2026-10-13

This bounded continuation supersedes earlier source/native readiness checkpoints. The repair and timestamp follow-up are already in HEAD `13beacd61d35bffefaa3c5c5ece4416abb3200f9`; this pass leaves a narrowly tested late-auth/snapshot hydration continuation fix uncommitted. All seven original assertions remain unchanged and pass; final targeted regressions are **17 suites / 322 tests PASS**, storage gates **3 suites / 15 tests PASS**, and TypeScript passes.

The current-source isolated release APK builds with Hermes/V2, R8/resource shrinking, non-debuggable/profileable release, demo/loopback services, and OTA disabled. Final APK SHA256 is **23D06F46DDA9C70E0DA9322D3314887B14C2A2741747DB64EDCA5C119E72624E**. Emulator-native tests cover committed A retention/exclusion from B, actual process restarts, offline restoration of an existing A session, later-revision recovery-copy convergence, late auth/vault hydration recovery, native adapter publication interruption, retained synthetic legacy source, and C-bound guest transfer through B/restart/backend completion/replay. The exact API-offline B-to-A sign-in attempt fails and ends unauthenticated; no account-isolation bypass was added. Physical/iOS and the owner-phone error remain unresolved. Large-vault storage/startup latency remains severe. The acceptance gate remains **OPEN**; no SQLCipher, deployment, OTA, animation/audio/haptic change, staging or commit followed.

See [NATIVE_DATA_RECOVERY_VALIDATION.md](NATIVE_DATA_RECOVERY_VALIDATION.md) for exact Git/source/APK evidence, native-versus-automated boundaries, performance measurements, cache-identity/recovery requirements, remaining scenarios, and cleanup.

## PERF-003 / storage blocking investigation — current bounded pass

See [PERF003_STORAGE_BLOCKING_REMEDIATION.md](PERF003_STORAGE_BLOCKING_REMEDIATION.md) for the current await-chain map, controlled Focus reproducer, identical in-flight write correction, unchanged safety gates, isolated probes, measurements and explicit verification gaps. This supplements the current-source native recovery checkpoint; it does not close physical-device acceptance, restart the audit, or authorize SQLCipher implementation. Changes remain uncommitted and unpublished; motion, visuals, audio and haptics are unchanged.

## SQLCipher implementation checkpoint — 2026-10-14

See [SQLCipher migration implementation](SQLCIPHER_MIGRATION_IMPLEMENTATION.md) and [native measurement evidence](SQLCIPHER_NATIVE_BENCHMARK_RESULTS.json). Implementation and synthetic Android SQLCipher testing are isolated in `codex/sqlcipher-migration`; production activation remains disabled. Measured 72-Anchor read: 4,533.267 ms legacy versus 222.665 ms SQLCipher; single-Anchor update p50: 46,416.314 ms versus 34.739 ms. Encryption, retained-key native updates and interrupted-import recovery passed in the diagnostic package. Full-app data-integrity certification, physical Android/iOS, progress/draft projection replay, key recovery and rollout compatibility remain open. No owner data was migrated and no OTA/release was published. Storage improvement is established; production rollout review is not yet approved.
