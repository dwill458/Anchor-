# Motion and Audio Preservation Checklist

Date: 2026-10-12. Baseline inventory of the animations, durations, easing curves, choreography, effects, transitions, sound cues and haptics that **must survive** the optimisation work. Values are copied from code as found on branch `feat/celebration-layer` (uncommitted changes included) by Agents A and B; none were re-measured on a device. Full source tables: `raw/agent-A-motion-rendering.md` ("Animation inventory") and `raw/agent-B-audio-haptics-timing.md` ("Audio & haptic cue inventory", "Audio ownership map").

## 1. How to use this checklist

- Every remediation change that touches a row below must attach a before/after capture (screen recording with the frame detector for motion; waveform or `sfxLog` for audio; call-count log for haptics) and state "unchanged" or list the intended delta. The "Touched by" column names the PERF items that put a row at risk.
- Freeze the timing constants in golden-value tests before changing code around them (Phase 5 adds these). Constants live in: `navigation/v2/ProgressiveFocusTransition.tsx` (`ANCHOR_TRANSITION_TIMING`), `theme/v2/motion.ts` (`AnchorMotion`), `components/v2/vision/board/visionBoardMotion.ts`, `components/v2/creation/creationMotion.ts`, `components/v2/paywall` (`PAYWALL_TIMING`), `components/v2/chart/*` (`CHART_CAMERA_TIMING`, `CHART_EASING`), `components/v2/release` (`RELEASE_CEREMONY_TIMELINE_MS`), `services/CreationSounds.ts` (`VOLUME`).
- Project lessons to respect (from the dev notes): ceremonial animation durations run fast on device versus the HTML prototypes, so keep them in one constants object and do not shorten them; `FORM_TIMING.sheenPeriod` must stay 2.6; the Reanimated 4 `runOnJS` from the JS thread silently drops, so keep UI-thread and JS-thread commit paths split; Android `Image` with `absoluteFill` zooms in absolute frames; react-native-svg `RadialGradient` needs `rx/ry` on Android.

## 2. Global invariants

- Reduce Motion is respected everywhere: preference wins, else the system value (including Android "animator scale 0 counts as reduced"). The reduced variants listed below (for example hero cross-fade 140 ms, Chart camera reduced 220 ms) must keep working. PERF-024 changes only the first-render value, not the semantics.
- No animation is removed, shortened, replaced by an instant change, or forced to 30 fps. No blur, glass, particle, fog or imagery layer is removed. No sound or haptic cue is removed or disabled to avoid a bug; fixes change ownership, timing source, or fades only.
- Audio remains the master clock for Visualize (position clock); the monotonic clock remains the master for Focus and Deep Focus; the frame clock remains the master for the creation flow proper.
- Haptics keep going through `safeHaptics`/`v2Haptics`, gated by the global intensity unless a session explicitly overrides (PERF-065).
- The Anchor hero is one continuous object across Home, Details, Setup and Session (no flicker, resize jump or teleport). The blank-frame detector must read 0.

## 3. Motion inventory (ms unless noted)

| System | Values to preserve | Source | Touched by |
|---|---|---|---|
| Anchor hero transition (`ANCHOR_TRANSITION_TIMING`) | details: spring, travel budget 320, exit 0, navigate 0, no reveal; spring `HERO_SPRING` stiffness 230, damping 27, mass 1. practice (hub to setup): exit 120, navigate 130, travel delay 80, travel 400, reveal delay 200/300. fromDetails: exit 0, navigate 0, travel 320. session: exit 220, navigate 220, travel delay 60, travel 500, reveal delay 280/340. visualize: same plus dissolve 420. back: spring, travel 320, navigate 240. progress: exit 180, navigate 0, travel 540, reveal delay 200/380. progressBack: exit 180, travel delay 40, travel 520. reduced: cross-fade 140. `settleMs` 140, `unclaimedMs` 400, `unclaimedFadeMs` 180, `watchdogMs` 900. Easing `HERO_EASE` bezier(0.22,1,0.36,1), `GLIDE_EASE` out(quad); arrive/depart windows shrinking [0.45,0.8]/[0.8,1], growing [0.1,0.45]/[0.45,0.7]; reveal windows [0,.45],[.15,.6],[.3,.8],[.45,1], rise 6. | `navigation/v2/ProgressiveFocusTransition.tsx` | PERF-012, 013, 014, 055, 056, 076 |
| Home carousel | spring `AnchorMotion.spring.carousel` damping 24, stiffness 250, mass 0.75 (rest thresholds 0.5/2.5); commit delay 140; swipe commit distance 40, min travel 10, velocity projection 0.12, rubber band 0.25; pan `activeOffsetX` +-6, `failOffsetY` +-10; neighbour scale 0.72, peek 0.14. Content veil: down to 0.38 over 140 (`easing.enter`), reveal 260 out(cubic), abort reveal 200, fallback timer 600, translateY 6. | `components/v2/home/V2HomeAnchorCarousel.tsx`, `homeElasticScroll.ts` | PERF-050, 056 |
| Home hero entrance | start delay 200; ground 900 bezier(.4,0,.2,1); draw 1100 + 120 delay bezier(.45,0,.25,1); ring delay 1300/1100; halo glow 1200 out(cubic); status ring 1100 (done) / 300 (undone) bezier(0.16,1,0.3,1). | `components/v2/home/*`, `components/v2/anchor/CircularAnchorRenderer.tsx` | PERF-055 |
| Home elastic scroll (Android) | limit 120, resistance 0.5, fling carry 1.1 (cap 22), fling out 120, spring stiffness 240 damping 30. | `homeElasticScroll.ts` | none expected |
| Home arrival (`ARRIVAL_TIMING`) | withFlight 1700, firstWithFlight 3400, practice 2400. | `homeArrival.tsx` | PERF-081 |
| Details sheet | snap 420 ms bezier(0.2,0.8,0.2,1); snaps rest/half/full = 0.671 / 0.464 / max(0.251H, inset+168); toast 1900. Title centred to header morph must end identically (PERF-015 changes the mechanism, not the end states). | `screens/v2/anchors/V2AnchorDetailsScreen.tsx`, `anchorDetailsSheetLayout.ts` | PERF-015 |
| Thread Strength | duration 1400 bezier(0.22,1,0.36,1); min dynamic 350; pill delay 300 + 350 out(quad), translateY 6. Replay-on-focus is a design choice pending confirmation. | `components/v2/thread/ThreadStrength.tsx` | PERF-023 |
| Focus | field transition 520 out(ease); entry 800 (or `ANCHOR_SESSION_ENTRY_MS` = 400 with hand-off); breathing 1.015 over 3200 inOut(sin) reverse; drifts 8300/11200/16800 inOut(sin) reverse; ring restart 850 inOut(sin) each second (stepped look pending confirmation); controls in 180 / out 420 after 3200; prepare auto-advance 3500; prepare fade 350/400; resolve phase ~2.3 s. | `screens/v2/practice/focus/*` | PERF-016, 052, 048 |
| Deep Focus | one linear `withTiming` of `seconds` for the whole session; controls 180/420 after 3200; curtain 0.8 s; end fade 0.45 s. | `screens/v2/practice/deepFocus/*` | PERF-063, 048 |
| Visualize | sample 50, publish 100, snap forward 400, end tolerance 120, early-exit fade 300 in 5 steps, status settle 600; chrome 280; caption in 260 / out 360; photo/camera timeline from `buildGuidedPlan`; entry fade `VISUALIZE_BEGIN_TIMING.fadeMs`; durations Glimpse 65.2 s, Immerse 200 s, Embody 615 s (beat maps keyed to guide). | `screens/v2/practice/visualize/*` | PERF-021, 022, 059 |
| Release | hold 1800 linear, tick 50, 6 haptic steps, cancel 240 out(cubic), burn texture prepared at 60%; `RELEASE_CEREMONY_TIMELINE_MS` isolate 0, ignite 300, burnEarly 1050, burnLate 1950, finalEmber 2800, emptyPause 3050, completion 3350; entrance header/rows/controls 420 out(cubic) delays 40/120/220. Amber `#E8650A` only in burn phases 1-3. | `screens/v2/release/*`, `components/v2/release/*` | PERF-053, 054, 060, 033 |
| Chart | `CHART_CAMERA_TIMING` focus 760, return 680, reduced 220; sheet snap 360 (180 reduced) `CHART_EASING.settle`; weather fade-in 900 out(cubic); first-draw hold 150; flag sway +-2 deg, half period 2000 bezier(.4,0,.6,1), infinite while visible; weather drift billows (6,1.6), near (9,0.6), wisps (14,-2.2) map units/s; tile scales 2/1.6/2; journey camera 1000/800/650 `CHART_EASING.deliberate`, 650+750 sequence near the end. Engraved map and atmospheric clouds keep full quality. | `components/v2/chart/*` | PERF-014, 019, 020 |
| Vision board (`visionBoardMotion.ts`) | render scale 1.7; focus move 900, return 820, camera bezier(0.45,0,0.2,1); zoom 1.4-1.7, fill 0.8; controls at 520 fade 260; lift scale 1.045, long press 320; spring damping 20 stiffness 150; recompose move 1000, enter delay 380, enter 720 (from 1.08 / lift -14), exit 420 to 0.92; frame cross-fade 320; reduced 140/240/240/160. | `components/v2/vision/board/*` | PERF-017, 018 |
| Paywall (`PAYWALL_TIMING`) | medallion fade 900, scale 1100 delay 150 from 0.86; underline 900 delay 500; rise 650 stagger 70; step out 220, step 900; route delay 900, route 1400, waypoint gap 350, flag at 2300; sheen 1400; play ring ~3 s loop. | `components/v2/paywall/*` | PERF-037 |
| Onboarding | panorama `HERO_PAN_MS` sine loop; start transition 320 UI-out, 680 dive, 900 pan, 520 wash, navigate at 660. The 5760x1920 panorama stays (intentional). | `screens/v2/onboarding/*` | PERF-011, 076 |
| Creation (`creationMotion.ts`) | swap out 180 / in 260; distill hold 700; stage fit 520; expression blend 420; hand-off fade 320; formation grid in 900, map travel 360, letter pause 160, stagger 520, map max 6000, map hold 450; `FORM_TIMING.sheenPeriod` 2.6. | `components/v2/creation/*`, `screens/create/flow/*` | PERF-060, 067 |
| Share Studio | enter 320 (scale 0.97 to 1), press 90/140, prepare debounce 350 (PERF-058 may lengthen the debounce; the visible preview must not change). | `components/share/*` | PERF-058 |
| Motion tokens (`theme/v2/motion.ts`) | micro 120, quick 180, standard 280, expressive 420, ambient 3200; easings enter bezier(0.16,1,0.3,1), exit (0.7,0,0.84,1), standard (0.2,0,0,1), emphasized (0.05,0.7,0.1,1), gentle inOut(sin); springs snap 24/280/0.8, soft 20/160/1, sheet 22/230/0.8, reveal 18/140/1.2. | `theme/v2/motion.ts` | all |

## 4. Sound cue inventory (SoundPool, `playCreationSound`)

Volumes are `VOLUME` in `services/CreationSounds.ts`. "Pool" = shared `SoundPool` players.

| Cue (asset) | Trigger | Params | Touched by |
|---|---|---|---|
| `uiTap` (`sk-ui-tap.mp3` 0.15 s) | creation taps; `IntentionInputScreen`; Vision ceremony/entrance taps | vol 1, pool 2 | PERF-062, 070 |
| `distillTick` (`sk-distill-tick.wav` 0.5 s) | per distill event (fraction 0.58-0.90 of the beat); Vision every 3rd lit word at .12; `CreationStage` ladder | vol .5, pool 4; ladder rate 1.0-1.48 in 0.06 steps | PERF-046, 060 |
| Node tones `node:0..21` (0.4 s; mp3 Android, wav iOS) | `NodeToneService.play` at `mapEventTimes` | vol .32, pool 1 per cell | PERF-047, 067 |
| `bloom` (2.5 s) | Form beat start | vol .55 | PERF-062 |
| `formBed` (`sk-form-bed.wav` 1.5 s loop) | Form beat; Vision develop wait | vol .12, fade-in 2500, stop 550 | PERF-041, 072 |
| `formTick` (0.14 s) / `formSettle` (0.7 s) | per sheen lap; settle; Home vision return | formTick .30, formSettle .35 | PERF-060 |
| `revealSettle` (1.2 s) | creation, `CreationStage`, Vision ceremony/entrance/print | vol .55, pool 2 | PERF-062 |
| `sealRise` (1.1 s) | loop in Choose hold and Vision seal hold; one-shot in `SealMedallion` | vol .6 | PERF-041, 063, 072 |
| `seal` (`sk-seal.mp3` 1.4 s) | `onSealLanded`; Vision stamp | vol .9 | PERF-047 |
| `anchorPulse` (1.0 s), `visionPin` (0.4 s), `homeArrival` (0.8 s, once ever), `onboardingSealed` (2.0 s), `paywallSuccess` (3.98 s) | seal hold; Vision pin; first Home arrival; sealed save; purchase success | vol .85 / .45 / .5 / .6 / .6 | PERF-062 |
| `practiceComplete` (2.56 s) | Focus 300 ms after `beginEnding`; Deep Focus `complete()` only if `shouldPlayDeepFocusCompletionCue` | vol .6, after mode `effects` | PERF-048, 068 |
| `releaseFall` (1.0 s), `releaseBurn` (3.05 s) / `releaseIgnite` (0.52 s, reduced motion), `releaseResolve` (1.96 s) | hold begin; hold complete; once per ending | vol .55 / .8 / .6 | PERF-063, 060 |
| Thread cues (`threadSettle/Wake/StageChord_*/ReinforcedLow/FullStrengthChord/Reinforce/StageRelight`) | once per session via `claimThreadSettle`; prewarmed | vol .42-.9 | PERF-047, 070 |
| Chart cues (`open`, `ink` + second stroke at 0.45 of draw vol .75 rate .95, `flag`, `wind`, `waypoint_1-3`, `move-done`, `ink-hold`, `stamp`, `summit-thud` + `summit-chord` (+20 ms), `air` loop) | `useChartSound`; beats from `chartMapSequences.ts` | rate jitter 0.97-1.03; air 0.9 (ducked .45; in 800, out 400, duck down 120 / up 600); note/stamp duck 1300; summit duck 2200 | PERF-063, 070, 072 |

## 5. Session audio (non-pool)

| Audio | Parameters to preserve | Touched by |
|---|---|---|
| Visualize guided track (Glimpse 65.2 s, Immerse 200 s, Embody 615 s; Dominic/Lina) | vol 1 (0 when voice none); clock = `player.currentTime` every 50 ms, state publish 100 ms; exit fade 5 steps/300 ms; status settle 600 ms; voice mapping male = Dominic = "Grounded", female = Lina = "Serene" | PERF-021, 028, 042, 043 |
| Focus mix 10/30/60 s | created at first tick after clock start, seeks if late > 1 s, gain 1 | PERF-010, 044, 048 |
| Focus ambient (`focus-session-ambient.mp3` loop) | vol .14; .04 on completion | PERF-010, 072 |
| Deep Focus mix 2/5/10 min and ambient | created at first 250 ms sample, seeks if `time > 1`; ambient loop with `ambientGain` from `deepFocusVisualAt`; end fade 0.45 s | PERF-010, 044, 048, 063 |
| Voice preview | `focus-session-30s-start`, female gain 1, male .415 | PERF-064 |
| Notification sound | `notification.wav` 3 s (iOS) | PERF-069 |

## 6. Haptic inventory

| Moment | Type / timing | Touched by |
|---|---|---|
| Focus begin / completion | selection on tap; Success notification at +240 ms (immediate under Reduce Motion) | PERF-065 |
| Deep Focus start / end | selection at first sample; selection at `complete()` | PERF-065 |
| Visualize seal | Success once within 1500 ms of `plan.sealAtMs` (PERF-021 may fire it from the sampler, up to ~100 ms earlier, closer to the visual) | PERF-021 |
| Release hold | selection x6 over 1800 ms sampled every 50 ms; completion Medium; burn swell from 220 ms to `emptyPause - 160` ms, gaps 300 to 95 ms, Light/Medium/Heavy at 35%/72% (not in Reduce Motion); settle Light once | PERF-053, 060 |
| Creation | Light at t = 0.03 s; per distill/map event; craft cues (Light/Medium); settle Medium; min gap `MIN_HAPTIC_GAP_MS` | PERF-060, 066 |
| Choose seal hold | cadence 150 to 50 ms, Light then Medium at half, Heavy at complete, Light at `finishSeal` | PERF-066 |
| Vision seal/ceremony | Light at begin, Light at 400 ms, Heavy at stamp (first image), Medium on first non-first landing, Light on print/pin | PERF-060 |
| Seal medallion (onboarding) | Light at begin; Light at 25%, Medium at 75% | PERF-060 |
| Thread settle | `timing.settleHaptic` impact | PERF-047 |
| Chart | Light/Heavy beats; Light on move check | PERF-070 |
| Wheels, carousel, boards | selection per detent (PERF-066 adds a sub-perceptual duplicate limiter only) | PERF-066 |
| Share Studio | selection (layout), warning (failure), confirmation (success) | none |

## 7. Audio ownership to preserve while fixing lifecycle

- `SoundPool` (one module-level pool, cap 24 live players), `useAudio` (managed loops), `useSessionAudio` (per-cue/bed/guided players, mode `session` on mount and `effects` on unmount), `useGuidedPlayback` (one player, audio-position clock), the Focus/Deep Focus screens (own ambient and voice players), `VoicePreviewService` (singleton), `AudioSession` (serialised mode queue). Silent switch: effects respect it (`playsInSilentMode:false`), session audio does not.
- expo-audio 1.1.1 natively pauses playing players on background and **auto-resumes** flagged ones on foreground (Android), and handles interruptions/route changes on iOS only. The PERF-010/041/042 guard exists to reconcile this with the app's intent; it must not change what the user hears while the app is in the foreground and playing as requested.

## 8. Verification method per row

- **Motion:** screen-record on the S24 release build, extract frames with ffmpeg, run the blank-frame detector and compare start/mid/end frames against golden captures of the pre-change build; assert the constants in a golden-value test.
- **Audio:** capture device output or log `sfxLog` (`source`, `loadedAtCall`, `playReached`) and compare cue count, start offset, pitch (rate) and level; check `dumpsys audio` for players still `started` after leaving the screen.
- **Haptics:** log calls per second and per event; confirm no fire after cancel; confirm Reduce Motion variants.
