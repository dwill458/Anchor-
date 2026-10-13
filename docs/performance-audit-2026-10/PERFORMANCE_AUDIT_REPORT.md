# Anchor 2.0 Performance, Motion and Stability Audit Report

Audit date: 2026-10-12. Repository: `E:\Projects\Anchor` (branch `feat/celebration-layer`, dirty tree: Release hold, evolve store, node tones, creation flow, practice audio sheet). Mobile app: `anchor/mobile`; backend: `backend`.

**The original audit changed no production code.** The subsequent approved remediation pass implements PERF-001 and related startup hydration protection; dated remediation notes below distinguish code/test acceptance from still-unverified device behavior. Raw per-agent evidence is in `raw/` (five reports, ~234 KB); this report is the reconciled, de-duplicated result. The original counts and 89 issue IDs remain the historical audit baseline. Companion documents: `PERFORMANCE_REMEDIATION_PLAN.md`, `MOTION_AND_AUDIO_PRESERVATION_CHECKLIST.md`, `DEVICE_VALIDATION_MATRIX.md`, `EXECUTIVE_SUMMARY.md`.

## 1. Honesty statement: what was and was not measured

- **Every runtime number in this report comes from a DEBUG dev-client build** (`DEBUGGABLE`, expo-dev-launcher, dev-mode JS bundle served by Metro) on one Samsung Galaxy S24 Ultra (SM-S928U1, Android 16, 120 Hz adaptive panel, USB-powered throughout). **They are not production numbers.** Dev mode inflates JS stalls and frame times; native costs (Keystore/fsync, bitmap upload, main-thread blocks) are not inflated by it.
- **No release or profiling build was run.** No iOS device, simulator or emulator was used. No second Android device was used. No Perfetto/simpleperf trace was captured. No jest, tsc or lint was run by any agent (535 test files exist in `src`).
- Of the 89 issues below, **14 are confirmed** (7 observed at runtime on the dev build, 3 measured on disk, 4 verified deterministically in code) and **75 are code-suspected** and need runtime verification. "Confirmed" does not mean "measured in production".
- Not exercised on the device because of paid-generation or destructive risk: Chart, Deep Prime, Visualize playback, Vision creation, Release/Evolve (entrance only viewed), audio bleed across Visualize, thermal/battery unplugged. See `DEVICE_VALIDATION_MATRIX.md`.
- Side effects of the runtime pass on the user's real account: one real 10 s Focus session was run (it hung, PERF-003; it may not have been saved), and the app was force-stopped and reloaded once from Metro. The runtime scratch folder (`%TEMP%\claude\...\scratchpad\runtime\`) contains screenshots and logcat with the user's photos, name and a third-party notification; do not share it.

## 2. How to read this report

**Severity** (as defined in the brief): P0 crash, corruption, blocking failure or critical loss of functionality; P1 major stutter, freeze, audio failure or broken interaction; P2 noticeable inconsistency or repeated micro-stutter; P3 minor.

**Evidence types:** *Runtime observed* (measured on the device, dev build); *Measured on disk*; *Code-verified* (a deterministic fact: a grep, a call chain, a constant; not a cost); *Code suspected* (mechanism read in source, no measurement). A severity assigned to a code-suspected item is a prediction, not a result. Where an agent proposed a higher severity than its evidence supports, the lead lowered it and said so (PERF-015).

**Fields omitted in P3 entries** take these defaults: Measurements "None collected."; Visual preservation "No visual change."; Risk "Low." Where a P3 entry says otherwise, it says so explicitly.

## 3. Reconciliation notes (what the lead corrected or challenged)

1. **V2 is the production navigator.** Agent C reported production builds still run the legacy `RootNavigator`, citing a comment at `App.tsx:110-117`. The lead checked `config/v2FeatureFlag.ts`: `isAnchorV2Enabled` returns `true` unless `EXPO_PUBLIC_ANCHOR_V2_ENABLED === "false"`, and `eas.json` does not set it to `false`. The comment is stale. Consequence: every V2-only finding (PERF-001, 006, 008, 033, 034, 037) is a production risk, not a staging risk. Legacy flows render only when the flag is explicitly off.
2. **PERF-001 verified by the lead.** The `!firebaseUser` branch (`App.tsx:475-481`) calls `authStore.signOut()`, which with no `user.id` skips the snapshot step and synchronously clears anchors, session store, first-run store and `hasCompletedOnboarding`, and does not reset `isGuest`. Still not reproduced on a device.
3. **Agent D marked the anchor vault "clean" (debounced, deduped); Agent E measured the same vault as a 719 KB, 400-chunk SecureStore write that took 32.8 s.** Debouncing and dedupe do not help a payload that large. D's "Stores" clean item is superseded by PERF-002; D's other store findings (PERF-004, 029, 088) stand.
4. **PERF-003 root cause is a hypothesis.** The lead confirmed in `V2PracticeSessionScreen.tsx` that `handleFocusComplete` awaits `completePracticeSession` (a local durable write that goes through the SecureStore-backed queue) before the completion surface proceeds, so a stalled queue would hang it. That the queue was actually stalled by the PERF-002 backlog is circumstantial (no `secure-write` completed in the window; reads reported 185-217 s). One occurrence, not reproduced.
5. **PERF-015 (Details sheet) lowered from the agent's P1 to a provisional P2.** The evidence is the animated prop names; no sheet-drag measurement exists. E measured Details scroll (6.3% janky) and open, not sheet drag. Escalate if the drag run shows high jank on a release build.
6. **PERF-012 stays P2 despite 13/15 opens dropping 31-35 frames.** Those are dev-build numbers. It is the first thing to re-measure on a release build and is listed among the top findings for that reason.
7. **A-05 and B-15 were the same finding** (Visualize 50 ms JS sampler and 10 Hz re-render) and are merged as PERF-021. **A-20 and B-22** (JS timer cues) are merged as PERF-060. **D-13** (latent 12-image Home environment) folded into PERF-026. **E-08** (SecureStore fsync volume) folded into PERF-002. **B-20** was split: the bundled-192 kbps part folded into PERF-028, the cache-hydration part is PERF-071.
8. **Agent C's stale-memory correction:** `navigation/v2/createAnchorGate.ts` (named in the dev notes) does not exist; the live gate is `hooks/v2/paywall/useV2AnchorCreationGate.ts`, which counts local active anchors only and has no "unknown while hydrating" state.
9. **Root performance docs are stale.** `PERFORMANCE_BASELINE.md`, `PERFORMANCE_OPTIMIZATION_SUMMARY.md`, `BUNDLE_ANALYSIS.md`, `DEVICE_PROFILING_GUIDE.md` were last committed 2026-02-02, baselines are "TBD", and they describe `react-native-fast-image`/`expo-av` which are not in use. No baseline exists to compare against; Phase 0 creates one.
10. **Unmeasured estimates are labelled.** D's "~90-270 native calls at launch" (PERF-029) and the "~190 MB transient strings" (PERF-009) are arithmetic on source constants, not measurements.
11. **Dormant code is not a finding.** The Chart world layers (43.3 MB decoded) are not imported by any live module, and `V2HomeCategoryEnvironment` is not rendered; both are noted only as latent (PERF-026, PERF-089).

## 4. Summary counts

| Severity | Total | Confirmed (runtime, disk, or code-verified) | of which runtime-observed (dev build) | Suspected (needs verification) |
|---|---|---|---|---|
| P0 | 1 | 1 | 0 | 0 |
| P1 | 10 | 3 | 2 | 7 |
| P2 | 37 | 8 | 4 | 29 |
| P3 | 41 | 2 | 1 | 39 |
| **Total** | **89** | **14** | **7** | **75** |

Root-cause clusters (issues per cluster): RC-1 6; RC-2 9; RC-3 8; RC-4 8; RC-5 11; RC-6 4; RC-7 18; RC-8 11; RC-9 13; RC-10 1. Definitions are in `PERFORMANCE_REMEDIATION_PLAN.md`.

## 5. Screen and interaction inventory

Full inventory (including handoff state machines, resume handlers, deep links and the legacy navigators) is in `raw/agent-C-navigation-reliability.md` section 1. Condensed:

**Navigator.** `App.tsx` renders `AnchorV2Navigator` (single native stack) when `isAnchorV2Enabled(...)`, which is true by default. The stack is fully remounted when its `key` changes (`AnchorV2Navigator.tsx:557`; see PERF-076). There is one root `ErrorBoundary` and one `V2DialogHost` with `Alert.alert` globally replaced. No `linking` prop; deep links are hand-parsed.

| Route | Screen / file | Notes |
|---|---|---|
| `V2FirstRun` | `screens/v2/onboarding/V2FirstRunFlow.tsx` (journey, intention input, creation flow, `V2SealedSaveScreen`) | initial route when not onboarded; guest path via "Continue without account" |
| `V2DevelopmentHome` (hosts `V2Home`, `V2AnchorLibrary`, `V2AnchorDetails`) | `screens/v2/home/*`, `screens/v2/anchors/*` | Details `animation:'none'` (hero flight owns motion) |
| `FirstAnchorCreation`, `AnchorCreationFlow`, `V2Creation` | `screens/create/IntentionInputScreen.tsx`, `screens/create/flow/AnchorCreationFlowScreen.tsx`, `screens/v2/creation/*` | back locked while sealing; `V2Creation` effectively dev-only |
| `Paywall` and `V2Paywall` | `screens/v2/paywall/V2PaywallScreen.tsx` (two registrations of one screen) | two-step; trial-ended panel |
| `V2Practice` | `screens/v2/practice/*` (Focus, Deep Focus, Visualize, prepare step in-screen) | `V2PracticePrepare` is typed but not registered |
| `V2Vision`, `V2VisionNoteComposer` | `screens/v2/vision/*` |  |
| `V2Chart`, `V2ChartAdjust`, `V2ChartJourney`, `V2ChartWaypoint` | `screens/v2/chart/*` | Waypoint `gestureEnabled:false` |
| `V2Progress`, `V2WeeklyInsight` | `screens/v2/progress/*`, `screens/v2/weeklyInsight/*` |  |
| `V2Release` | `screens/v2/release/V2ReleaseScreen.tsx` | back blocked while locked (PERF-033) |
| `V2NotificationInvitation`, `V2ReminderTime` | `screens/v2/notifications/*` |  |
| `V2Settings`, `V2Auth`, `Login` | legacy `SettingsScreen` (+ account/data, notifications), `V2AuthScreen` | export bug PERF-007 |
| `V2SystemGallery`, `V2EvolvingAnchor` | `screens/v2/system/*` | dev/no entry; gallery ships in release |

**Overlays and sheets** (all RN `<Modal>` have `onRequestClose`): `V2SheetModal`, `CreationSheet`, `V2PlanPickerSheet`, `V2ThreadEventCelebration`, `V2ThreadEventDetailSheet`, `WeeklyHistoryDrawer`, `VisionTwoUpStage` preview modal, `V2DialogHost`, Home `V2ThreadEventModal`, the anchor transition overlay (`ProgressiveFocusTransition`), `SplashController`, and dev-only hosts (`ChartLabDevHost`, `VisionVisualQADevHost`, `CreationFlowQADevHost`, `V2DevFloatingToolbar`).

**Legacy tree** (`RootNavigator`: Onboarding, Main tabs with Vault/Practice/Chart stacks, Settings, Paywall) renders only when the V2 flag is explicitly false; it is inventoried in the raw C report but not audited for performance.

**Handoff state machines** (`creationHandoff`, `practiceHandoff`, `releaseHandoff`, `invitationHandoff`, `evolveReturn` + `evolveSessionStore`, `releaseNavigation`): single-flight guards exist in most; gaps are PERF-081.

## 6. Runtime evidence (Galaxy S24 Ultra, DEBUG build)

Environment: SM-S928U1, Android 16, `com.anchorintentions.app` 2.0.0 (versionCode 39, `DEBUGGABLE`), Metro on :8081, Hermes/Fabric, 120 Hz adaptive (modes 120/80/60/48/30/24/10), USB-charging, thermal status 0 at start and 1 (SKIN 40.4 C, AP up to 48.4 C) at end, real Pro account with 72 local Anchors and 175 practice-history entries.

| Scenario | Frames | Janky (modern) | p50 / p95 / p99 ms | Missed vsync | Slow bitmap uploads |
|---|---|---|---|---|---|
| Home idle 10 s | 1 | 1 | 8 / 8 / 8 | 0 | 0 |
| Home carousel, 6 slow swipes | 890 | 57 (6.4%) | 9 / 24 / 109 | 9 | 29 |
| Home carousel, 6 fast flicks | 526 | 27 (5.1%) | 7 / 21 / 109 | 5 | 10 |
| Home to Details (1 tap) | 92 | 9 (9.8%) | 7 / 36 / 250 | 3 | 4 |
| 15x Home<->Details loop (30 transitions) | 2786 | 213 (7.65%) | 8 / 23 / 250 | 76 | 79 |
| Details scroll 3x | 590 | 37 (6.3%) | 5 / 22 / 40 | 9 | 1 |
| Details to Vision board open | 162 | 22 (13.6%) | 9 / 26 / 150 | 3 | 7 |
| Vision board scroll 3x | 317 | 81 (25.6%) | 13 / 28 / 36 | 43 | 0 |
| Home to Progress | 59 | 8 (13.6%) | 6 / 44 / 250 | 1 | 2 |
| Progress scroll | 366 | 40 (10.9%) | 12 / 17 / 24 | 3 | 0 |
| Home to Visualize setup | 131 | 27 (20.6%) | 9 / 36 / 250 | 5 | 4 |
| Focus 10 s session | 1061 | 403 (38.0%) | 20 / 34 / 42 | 270 | 376 |
| Details to Share Studio open | 223 | 23 (10.3%) | 6 / 26 / 150 | 10 | 5 |

Full table (21 scenarios), memory table, launch timings and logcat summary: `raw/agent-E-runtime-qa.md` section 3.

**Memory.** Long-lived process 2.09-2.29 GB PSS, 724-744 MB graphics, 468-611 MB swap, 2,060-2,710 Views; fresh process 1.22-1.32 GB, 309-379 MB graphics, 486-932 Views. 15 Home<->Details loops: PSS flat (no leak on that route). **Launch.** Hot launch 105 ms; cold `am start -W` 855 ms reaches only the dev launcher; JS `app-ready` ~36 s after JS start in this run (PERF-002). **Stability.** No FATAL/ANR/crash for the app pid; no double-start of audio players seen in the Focus run; all app `AudioTrack`s `stopped` after the session; 5 rapid taps navigated once.

## 7. Issue index

| ID | Sev | Evidence | System | Title |
|---|---|---|---|---|
| PERF-001 | P0 | Code-verified | Startup / auth listener / guest path | Cold start wipes a guest's Anchor and replays onboarding |
| PERF-002 | P1 | Runtime (dev) | Persistence layer / cold start (`anchor-vault-storage`) | Vault persisted through SecureStore in 400 chunks: one write took 32.8 s and queued the auth cache behind it |
| PERF-003 | P1 | Runtime (dev) | Practice / Focus completion | Focus completion screen ("Well done / Let it settle") never advanced (observed once, >2.5 min) |
| PERF-004 | P1 | Suspected | Persistence layer (all encrypted stores) | `writeSecureValue` deletes the old chunks before writing the new ones (non-atomic) |
| PERF-005 | P1 | Suspected | Startup / splash / `AuthService.syncCurrentUser` | Startup can hang on a stalled `/api/auth/sync` (no timeout, fail-open gated on the same call) |
| PERF-006 | P1 | Suspected | Practice completion (guest) | Guests cannot record a practice session |
| PERF-007 | P1 | Code-verified | Settings > Account & data; Profile > Data & privacy | "Export My Data" calls `/auth/me/export`, which does not exist (server route is `/api/auth/me/export`) |
| PERF-008 | P1 | Suspected | Creation save (`useSaveAnchor`) | A failed server save still "succeeds" locally: phantom Anchor that is never uploaded |
| PERF-009 | P1 | Suspected | Vision/Chart photo uploads; backend `/api/v2/assets/upload` | Photo uploads send the original camera file as inline base64, 8 in parallel, against an 8 MB JSON limit |
| PERF-010 | P1 | Suspected | Focus / Deep Focus session audio (Android) | Android: Focus and Deep Focus ambient and narration resume under the Paused overlay after backgrounding |
| PERF-011 | P1 | Suspected | Auth / onboarding first-mount animations (Android) | `entering=` layout animations on first mount of native-stack routes match the known react-native-screens Android NPE class |
| PERF-012 | P2 | Runtime (dev) | Home to Details shared-element hero flight | Each Details open: ~1.5 s of JS-thread stalls, 31-35 skipped main-thread frames on 13 of 15 opens, 250 ms p99 frame |
| PERF-013 | P2 | Suspected | Anchor hero transition provider | Transition context changes 3-5 times per flight; every consumer re-renders and the hide/show hand-off waits on a JS commit |
| PERF-014 | P2 | Suspected | Chart cloud tiles (Details Chart card, Chart open) | First Chart-card mount draws 3 tiles on the JS thread, then PNG-encodes 3 images synchronously |
| PERF-015 | P2 | Suspected | Anchor Details sheet drag and snap | Sheet drag/snap animates `top`, `left`, `width`, `height`, `fontSize`, `lineHeight` every frame (provisional P2; escalate to P1 if measured) |
| PERF-016 | P2 | Runtime (dev) | Focus session animation | Focus session runs far below display rate: 38% janky, p50 20 ms, 376 slow bitmap uploads |
| PERF-017 | P2 | Runtime (dev) | Vision board scroll | Vision board scroll is janky: 25.6% janky, p50 13 ms, 43 missed vsync |
| PERF-018 | P2 | Suspected | Vision board photo recompose / swap | Every photo animates `left/top/width/height` in 4 styles during recompose and swap settle |
| PERF-019 | P2 | Suspected | Chart overlay (flag sway) | Perpetual flag sway redraws the whole overlay canvas (dashed route, path effects) every frame, even with no flag and after blur |
| PERF-020 | P2 | Suspected | Chart living weather | Runtime-shader cloud mask recomputed every frame although the mask inputs are static at rest |
| PERF-021 | P2 | Suspected | Visualize guided playback clock | UI-thread clock is fed by a 50 ms JS `setInterval`; a JS stall freezes then snaps the camera; screen re-renders at 10 Hz; seal haptic keyed to that render |
| PERF-022 | P2 | Suspected | Visualize Skia stage | Full-viewport save-layers and blend rects recorded every frame even at opacity 0 |
| PERF-023 | P2 | Suspected | Thread Strength (Home Progress section) | Layout-prop and SVG-prop animation, double text write, replay on every focus |
| PERF-024 | P2 | Suspected | Accessibility: Reduce Motion hooks (app-wide) | Reduce Motion hooks start `false`, resolve asynchronously and are instantiated 107 times |
| PERF-025 | P2 | Runtime (dev) | Whole app, long-lived process memory | A long-lived process sat at ~2.1-2.3 GB PSS with ~740 MB graphics and 470-610 MB swap; growth source not found |
| PERF-026 | P2 | Measured | Image decode sizing (Vision method step, selector avatars, share previews) | Small display, big bitmap: Vision method polaroids decode three 1920x1280 photos (9.8 MB each) for 104x128 dp slots |
| PERF-027 | P2 | Suspected | Image URLs (Home hero, Details, Vision board, Share Studio; backend `StorageService`) | Presigned URLs change on every read so image caches never hit; private objects carry `Cache-Control: private, no-store` |
| PERF-028 | P2 | Measured | App binary / OTA size (Focus, Deep Focus, Visualize audio) | Bundled 192 kbps "V4" mixes (95.9 MB) undid the 10-07 remote-audio / 128 kbps work; six `REMOTE_AUDIO_TRACKS` entries are now dead |
| PERF-029 | P2 | Suspected | `authStore` persistence | authStore writes its whole persisted blob to SecureStore on every `set()` (no debounce, no dedupe) |
| PERF-030 | P2 | Suspected | Launch network fan-out; backend rate limiter | Full account export every launch, two overlapping anchor-list calls, no response compression, 100 requests / 15 min limiter |
| PERF-031 | P2 | Suspected | Home prewarm / Chart cache | Home prewarm re-requests the Chart for every neighbour on each swipe; its abort can cancel shared in-flight requests; every publish rewrites the Chart blob to SecureStore |
| PERF-032 | P2 | Suspected | Visualize prepare / cinematic assets | Visualize cinematic fetches each photo up to three times |
| PERF-033 | P2 | Suspected | Release (`V2ReleaseScreen`, `useV2Release`) | Release "confirming" state can lock the screen for up to 120 s with no exit |
| PERF-034 | P2 | Suspected | Creation seal / `useSaveAnchor` | Anchor create/seal can freeze for minutes; creation back is locked meanwhile |
| PERF-035 | P2 | Suspected | Guest-to-account finalization (`authStore.finalizePendingFirstAnchorDraft`) | Pending first-anchor finalization POST has no idempotency key |
| PERF-036 | P2 | Code-verified | Offline/reconnect write queues (V2) | No connectivity listener; V2 never drains the practice/scene write queues |
| PERF-037 | P2 | Suspected | Paywall (`useV2Paywall`, `V2PaywallScreen`) | Store success can dead-end ("still being confirmed"); dismiss is not disabled while a purchase runs |
| PERF-038 | P2 | Suspected | Error boundary (`components/ErrorBoundary.tsx`, `App.tsx:1011`) | One whole-app boundary with legacy styling; "Try Again" remounts the entire tree and loses navigation and in-flight state |
| PERF-039 | P2 | Suspected | Auth hydration (`AuthHydrationService`) | Hydration commit can overwrite newer local state (create/release during an in-flight hydration) |
| PERF-040 | P2 | Code-verified | `ApiClient` (all requests) | Every request defaults to a 120 s timeout; 401 has no recovery; slow and offline are indistinguishable |
| PERF-041 | P2 | Suspected | `SoundPool` looped cues (Android) | Looped pool cues (`formBed`, `sealRise`) playing at background time are revived natively and orphaned |
| PERF-042 | P2 | Suspected | Session audio focus (Android) | No audio focus and no "becoming noisy" handling: calls, other media and headphone unplug do not pause narration |
| PERF-043 | P2 | Suspected | Practice audio sheet (Visualize, Focus, Deep Focus) | Ambient toggle does nothing in Visualize, and "Ambient: Off" is ignored in Focus/Deep Focus when a voice is selected |
| PERF-044 | P2 | Suspected | Focus / Deep Focus Sound toggle | Sound off then on desyncs the full-length narration mix (resumes behind the session clock) |
| PERF-045 | P2 | Suspected | Focus Paused overlay | Toggling Sound in the Paused overlay starts audio while paused |
| PERF-046 | P2 | Suspected | `SoundPool` playback rate (creation `distillTick` ladder, chart one-shots) | A pooled player keeps the previous play's playback rate, so default plays come out at a stale pitch |
| PERF-047 | P2 | Suspected | `SoundPool` overflow policy (node tones, chart/thread/release cues) | Re-triggering a one-entry pooled cue builds a cold temporary player instead of reusing the oldest |
| PERF-048 | P2 | Suspected | Focus / Deep Focus session end | End-of-session truncation of the finished mixes and a nondeterministic completion cue |
| PERF-049 | P3 | Measured | Anchor art storage (`AIEnhancer.ts:405-421` -> `StorageService.uploadImageFromBuffer`) | Anchor art stored as raw model output (PNG-labelled), no thumbnail or modern format |
| PERF-050 | P3 | Runtime (dev) | Home carousel | Carousel switching shows jank bursts and slow bitmap uploads |
| PERF-051 | P3 | Suspected | Refresh-rate policy (Android) | 120 Hz is requested only in the creation flow (decision item: do not enable app-wide before the per-frame costs are fixed) |
| PERF-052 | P3 | Suspected | Focus progress ring | Ring progress restarts an 850 ms ease-in-out every second (stop-start crawl) |
| PERF-053 | P3 | Suspected | Release hold fill | Release hold fill animates a percentage `width` |
| PERF-054 | P3 | Suspected | Release burn texture | Burn texture built on the JS thread at 60% of the hold (CPU raster + `readPixels` + a JS pixel loop) |
| PERF-055 | P3 | Suspected | `CircularAnchorRenderer` (every Anchor disc) | Registers two `useAnimatedStyle` hooks and a shared value per instance even when no entrance is used |
| PERF-056 | P3 | Suspected | Home | `carouselMoving`/`homeMotionActive` state re-renders Home at drag start and rest solely to gate the teaching queue |
| PERF-057 | P3 | Suspected | Progress | JS `onScroll` every 16 ms and a scroll-begin re-render |
| PERF-058 | P3 | Suspected | Share Studio | Full 1080x1920 export tree mounts 350 ms after every layout switch while previewing |
| PERF-059 | P3 | Suspected | Visualize setup | A hidden second full session screen and board are mounted behind the setup page |
| PERF-060 | P3 | Suspected | Creation formation, Release burn feel, Vision seal, arrival set | Sound/haptic cues and phase flips ride JS `setTimeout` chains parallel to UI-thread animations |
| PERF-061 | P3 | Suspected | Teaching spotlight (`SpotlightCoach`, `ChartOneMoveTeaching`) | Spotlight animates five scrim views by `left/top/width/height` |
| PERF-062 | P3 | Suspected | `SoundPool.play` first-play latency | `seekTo(0)` before every one-shot, un-prewarmed cues, and cold players after `releaseIdle` |
| PERF-063 | P3 | Suspected | Exits across Focus, Deep Focus, Visualize, Vision seal hold, Release, Chart air | Abrupt stops (no fade) at several exits, and JS-timer volume fades |
| PERF-064 | P3 | Suspected | Voice preview (`VoicePreviewService`) | Rapid taps or sheet close can leave an orphan preview playing (double voice) |
| PERF-065 | P3 | Suspected | Session haptics toggle vs global intensity | Session Haptics toggle is dead when global intensity is 0; selection/notification are not scaled by intensity |
| PERF-066 | P3 | Suspected | Haptic rate (TimeWheel, Home carousel, Choose hold) | Haptic calls are unthrottled on wheels, carousel and the Choose seal hold |
| PERF-067 | P3 | Suspected | Creation start (`SoundPool` prewarm, `NodeToneService`) | Prewarming 16 players during the Intention-to-creation hand-off adds main-thread work |
| PERF-068 | P3 | Suspected | Audio session mode ownership (`AudioSession`, `useAudio`, `useSessionAudio`, `VoicePreviewService`) | Audio-session mode is last-writer-wins across mount/unmount effects; completion cues use a different silent-switch policy than the session |
| PERF-069 | P3 | Suspected | Android notification channels | Channels carry no custom sound (the branded wav only affects iOS and Android < 8); verify intent |
| PERF-070 | P3 | Suspected | `SoundPool` key ownership (Chart intro/active, Release, creation, completion scene, node tones) | Pool keys are released by several owners with no ref-counting |
| PERF-071 | P3 | Suspected | Remote audio cache (`remoteAudio.ts`) | Cache hydration is fired but not awaited before player creation |
| PERF-072 | P3 | Suspected | Looped and legacy audio assets | Loop-point and tail quality: MP3 loops may gap ~25 ms on Android; legacy loops click |
| PERF-073 | P3 | Suspected | Release API adapter | Any HTTP 409 on Release is treated as "already released" |
| PERF-074 | P3 | Suspected | Notification response queue (`App.tsx:882-971`) | A cold-start notification tap can be stranded |
| PERF-075 | P3 | Suspected | Home foreground refresh | Home refreshes Today, Vision and Chart on every AppState `active`, even when covered or recently refreshed |
| PERF-076 | P3 | Suspected | `AnchorV2Navigator` key | Navigator `key` changes mid-flow and remounts the whole stack, including the seal-to-coin continuity |
| PERF-077 | P3 | Suspected | Interactive sign-in (`onAuthStateChanged` + `PostAuthFlowService.run`) | Duplicate `/api/auth/sync` and hydration on every interactive sign-in |
| PERF-078 | P3 | Suspected | Evolve successor link | `evolvedFrom` is recorded only on the local successor |
| PERF-079 | P3 | Suspected | `V2DialogManager` (global `Alert.alert` bridge) | Single dialog slot: a second alert silently drops the first's callbacks; the cancel handler is dropped for 3+ buttons |
| PERF-080 | P3 | Suspected | Polling and Chart refresh | Stale response overwrite: overlapping polls are unordered; `useAnchorChart.refresh` can overwrite a newer published chart |
| PERF-081 | P3 | Suspected | Hand-off modules (`releaseHandoff.ts`, `creationHandoff.ts`) | Guard gaps: fallback runs before the in-flight latch; unhandled rejection; arrival expiry armed only after the pop |
| PERF-082 | P3 | Suspected | Startup readiness (signed-out launches) | Store rehydration is not gated by startup readiness: a returning guest can see a first-run flash |
| PERF-083 | P3 | Suspected | Creation seal/save promise chains | `void pendingSave.then(...)` / `void pending.then(...)` have no `.catch` |
| PERF-084 | P3 | Suspected | Creation-gate paywall navigation | Legacy paywall params in V2: wrong copy and no resume after purchase |
| PERF-085 | P3 | Suspected | Startup concurrency and observability cost | Many startup tasks run inside the splash window; per-request traces; error handlers installed only after first render |
| PERF-086 | P3 | Suspected | Route metadata | Dead/misleading route registrations |
| PERF-087 | P3 | Suspected | Vision generation polling | Poll loops re-render every 2.5 s and have no in-flight guard |
| PERF-088 | P3 | Suspected | Persisted read models (`useV2Vision`, vault, recommendation, Chart caches) | Persisted read models contain expiring presigned URLs and are rewritten on every fetch |
| PERF-089 | P3 | Suspected | Hygiene bundle | Whole-store subscriptions, startup fonts, unbounded small caches, unthrottled backend jobs, EAS archive bulk, duplicate audio cues, dormant ForgeDemo asset |

## 8. Issues

## 8.0  P0 issues

### PERF-001  [P0] Cold start wipes a guest's Anchor and replays onboarding
- **Issue ID:** PERF-001 (raw: C-01)
- **Screen / System:** Startup / auth listener / guest path
- **Severity:** P0
- **Evidence type:** Code-verified (deterministic: grep / call chain read by the lead)
- **Symptoms:** A user who chose "Continue without account" at the sealed save screen relaunches the app: their only Anchor is gone, onboarding restarts, `isGuest` is still true. The same path deletes the onboarding draft and any pending first-anchor draft of every signed-out user on every cold start.
- **Reproduction:** 1) Fresh install, finish onboarding, tap "Continue without account" (`V2FirstRunFlow.tsx:107-121` sets `isGuest`, `completeOnboarding()`). 2) Force-stop, relaunch. 3) Firebase `onAuthStateChanged` fires once with `null`; `App.tsx:475-481` calls `store.signOut()` (also `App.tsx:622`).
- **Measurements:** Not run on a device. Lead re-read the chain: `authStore.signOut()` (`authStore.ts:1005-1090`) skips the snapshot step when `user?.id` is undefined, then synchronously runs `clearAnchors()`, `useSessionStore.reset()`, `useFirstRunStore.reset()` and sets `hasCompletedOnboarding:false`. It does not reset `isGuest`. The rehydrate guard that protects guests (`authStore.ts:1102-1121`) is undone by this listener. V2 is the production navigator (`isAnchorV2Enabled` returns true unless the env value is the string "false"; the "production stays legacy" comment in `App.tsx:110-117` is stale).
- **Likely root cause:** The App-level auth listener treats "no Firebase session" as "signed out" and calls the destructive `signOut()` with no `isGuest`/`hasCompletedOnboarding` guard. Confidence high (call chain read end to end); runtime repro pending.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `App.tsx:467-481, 602-624`; `stores/authStore.ts:1005-1090, 1102-1121`; `screens/v2/onboarding/V2FirstRunFlow.tsx:44-58, 107-121`; `stores/v2/firstRunStore.ts:60, 148-157`
- **Recommended solution:** In the `!firebaseUser` branch and the `App.tsx:603-623` effect, call the destructive `signOut()` only when the persisted store actually holds an account (`user?.id` or `isAuthenticated`); otherwise only `setLoading(false)`. Keep the dev-master branch. Add a jest test: seed `{isGuest:true, hasCompletedOnboarding:true, anchors:[a]}`, fire the listener with `null`, assert nothing is cleared.
- **Visual preservation:** No UI or motion change.
- **Risk:** Low-medium: a stale persisted `user` with no Firebase session must still be cleared; the `user?.id` condition keeps that case.
- **Verification:** Jest as above; device: guest finish, kill, relaunch, expect Home with the Anchor; kill mid-onboarding, relaunch, expect resume.

**Remediation record (2026-10-12):** Approved code correction is implemented in `AppAuthBootstrap`, `appAuthState`, `authStore`, and `App.tsx`. A null Firebase restore no longer invokes destructive cleanup for a guest or pre-account draft. Cleanup of a persisted account waits for the persisted stores it snapshots/resets, checks auth generations before and after asynchronous snapshot work, and coalesces repeated null callbacks without joining a superseded generation. Auth-store hydration no longer resets resumable first-run drafts. Startup readiness follows an explicit processed Firebase result rather than persisted loading flags; auth-store hydration alone cannot authorize cleanup. Unreadable/unresolved local restoration fails closed with a restart/reopen action. Normal screen layouts, animation/audio assets, and motion constants are unchanged.

Regression tests exercise the production registered bootstrap callback with real Zustand stores and mocked Firebase/storage boundaries; they do not mount the complete App or replace physical-device validation. Intentional sign-out retains its existing contract. Existing snapshot writes already issued before supersession remain uncancelable, and full guest-to-account hydration merging is not established by this pass. See the remediation plan execution record for exact final commands, results, changed files, and the independent review. **Device guest relaunch/account-switch acceptance remains pending; no runtime improvement is claimed.**

## 8.1  P1 issues

### PERF-002  [P1] Vault persisted through SecureStore in 400 chunks: one write took 32.8 s and queued the auth cache behind it
- **Issue ID:** PERF-002 (raw: E-01, E-08)
- **Screen / System:** Persistence layer / cold start (`anchor-vault-storage`)
- **Severity:** P1
- **Evidence type:** Runtime observed (gfxinfo/logcat/meminfo, DEBUG build)
- **Symptoms:** JS `app-ready` arrived ~36 s after JS start although every store had hydrated by 4.3 s. A 634-char `anchor:cached_user` write waited 34.8 s behind the vault write. Earlier in the log buffer the same write repeated 12-13 times at 40-135 s each, and secure reads in the Focus-completion window reported 185-217 s (the `ms` field appears to include queue wait).
- **Reproduction:** Force-stop, `am start`, tap localhost:8081 in the dev launcher, `adb logcat | grep PERF`: compare `store-hydration-finished` with `app-ready` and the `secure-write anchor-vault-storage` event.
- **Measurements:** DEV BUILD. Vault payload 719,217 chars for 72 anchors (~10 KB per anchor) in 400 chunks, 403 secure calls, `ms: 32792`. `app-ready` `msSinceAppStart: 35967`. ~41 k `SecureStore.xml` fsyncs over the process life, tail to 128-256 ms (E-08).
- **Likely root cause:** `anchorStore` persists the entire `anchors` array (`anchorStore.ts:484`) through `encryptedPersistStorage`, i.e. expo-secure-store: every 1800-char chunk is an Android Keystore encrypt plus a SharedPreferences commit with fsync, serialised on one native queue, so small critical writes wait behind the vault. The 400 ms debounce does not help a payload this large. Confidence medium-high on mechanism (native cost is not inflated by dev mode); medium that it gates `app-ready` rather than coinciding with it.
- **Root-cause cluster:** RC-1, Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths
- **Relevant files:** `stores/encryptedPersistStorage.ts:80-135, 173-258`; `stores/anchorStore.ts:482-491`; `utils/perfDiagnostics.ts` (`secure-write` events)
- **Recommended solution:** Move bulk state (vault anchors, Chart/Vision read models) to AsyncStorage/MMKV/SQLite and keep only keys, tokens and a small index in SecureStore (encrypt the bulk blob once with a Keystore-held key if encryption-at-rest is required). Give SecureStore a separate queue so auth keys never wait behind bulk writes. Diff by anchor so one change writes one record, not the array.
- **Visual preservation:** Invisible to the user. Same data, same hydration result.
- **Risk:** High: storage migration for existing installs. Needs a versioned migrate that reads the old chunked key once and a rollback-safe order (see PERF-004).
- **Verification:** Release build on the S24: `app-ready` vs `store-hydration-finished` gap; count secure calls per launch and per user action; kill the app mid-write and relaunch with a 72-anchor account.

### PERF-003  [P1] Focus completion screen ("Well done / Let it settle") never advanced (observed once, >2.5 min)
- **Issue ID:** PERF-003 (raw: E-02)
- **Screen / System:** Practice / Focus completion
- **Severity:** P1
- **Evidence type:** Runtime observed (gfxinfo/logcat/meminfo, DEBUG build)
- **Symptoms:** A 10 s Focus session ended, audio released correctly, "Well done / Let it settle" showed, then nothing: no `practice_session_completed` event, taps did nothing, HOME and re-open did not change it, force-stop was required. JS was alive (PERF render counts continued), so it is a logical hang, not a freeze.
- **Reproduction:** Home, All Practices, Focus, 10 sec, Begin Focus, wait. Not reproduced a second time.
- **Measurements:** DEV BUILD, single run: stuck 01:53:21 until force-stop (>2.5 min). Side effect: this run touched the real account (anchor "I am a great dad"); the record may not have saved.
- **Likely root cause:** Lead verified the code path: `handleFocusComplete` (`V2PracticeSessionScreen.tsx:~160-215`) `await`s `PracticeCompletionService.completePracticeSession(..., {flushImmediately:false})` before it reads the fresh anchor/session record, and the completion surface is gated on that promise. That write uses the SecureStore-backed queue, so it can sit behind the PERF-002 backlog. The link to PERF-002 is circumstantial (no `secure-write` completed in the window; reads were reporting 185-217 s). Confidence medium; unproven.
- **Root-cause cluster:** RC-1, Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths
- **Relevant files:** `screens/v2/practice/V2PracticeSessionScreen.tsx:160-215, 251`; `services/PracticeCompletionService.ts:136-150, 241-250, 312-360`
- **Recommended solution:** Never gate the completion UI on storage: advance the phase immediately, run persistence in the background with a bounded timeout and a visible "saved / will save" state, and fall back to the existing `focusPersistenceFailed` path. Fix PERF-002 so the write is fast.
- **Visual preservation:** Completion choreography and copy unchanged; only the gate changes.
- **Risk:** Medium: the completion screen reads the persisted record for the reinforcement display; it needs a pending state.
- **Verification:** Reproduce on a release build with the 72-anchor account; assert `practice_session_completed` fires; force the storage write to hang in a test and assert the UI still advances.

### PERF-004  [P1] `writeSecureValue` deletes the old chunks before writing the new ones (non-atomic)
- **Issue ID:** PERF-004 (raw: D-05)
- **Screen / System:** Persistence layer (all encrypted stores)
- **Severity:** P1
- **Evidence type:** Code suspected
- **Symptoms:** If the process dies between the delete and the final meta write, the key reads back empty or "chunk mismatch; clearing corrupted data" and state is dropped. Highest impact for guest-only local Anchors.
- **Reproduction:** Force-stop during a multi-chunk write (large vault, creation save).
- **Measurements:** None collected. Window is about N Keystore round trips (N up to 400 for the 719 KB vault, PERF-002).
- **Likely root cause:** `clearSecureChunks(name)` (`:118-121`) runs before parallel chunk sets and the meta set (`:122-134`); `readSecureValue` deletes on mismatch (`:104-109`). Confidence high that the window exists; probability depends on kill timing.
- **Root-cause cluster:** RC-1, Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths
- **Relevant files:** `stores/encryptedPersistStorage.ts:80-135`
- **Recommended solution:** Write-new-then-swap: write chunks under a generation suffix, write the meta (pointing at the new generation) last, then delete the previous generation. Combine with chunk diffing (PERF-029).
- **Visual preservation:** None.
- **Risk:** Medium: storage format migration; keep the legacy-key reader.
- **Verification:** Unit test with a SecureStore mock that throws after K calls; assert the previous value still reads back.

### PERF-005  [P1] Startup can hang on a stalled `/api/auth/sync` (no timeout, fail-open gated on the same call)
- **Issue ID:** PERF-005 (raw: C-02)
- **Screen / System:** Startup / splash / `AuthService.syncCurrentUser`
- **Severity:** P1
- **Evidence type:** Code suspected
- **Symptoms:** On a signed-in launch with a captive or stalled connection (TCP open, no reply), the splash never completes.
- **Reproduction:** Signed-in user, API host that accepts the connection but never answers; launch. `AuthService.native.ts:223` fetch has no `AbortController`.
- **Measurements:** Verified facts: RN Android OkHttp is built with `connectTimeout(0)`/`readTimeout(0)` (`node_modules/react-native/.../OkHttpClientProvider.kt:52-53`). Not run.
- **Likely root cause:** `useAppStartup` requires `authRestorationSettled` for both normal readiness and fail-open (`useAppStartup.ts:44-47, 64-76`), so the 4 s `SPLASH_FAIL_OPEN_TIMEOUT_MS` cannot fire while the unbounded call is pending; the offline fallback (`App.tsx:556-568`) runs only after the fetch rejects. Confidence medium-high.
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `services/AuthService.native.ts:223-246`; `hooks/useAppStartup.ts:44-47, 64-76`; `App.tsx:467-575`
- **Recommended solution:** 8-10 s `AbortController` timeout on `syncUserWithBackend` rejecting with an `isNetworkError`-matching message so the cached-user offline path runs; let `useAppStartup` fail open on `timedOut` when a persisted `user` exists.
- **Visual preservation:** Splash visuals unchanged; only the wait is bounded.
- **Risk:** Low: a slow-but-working network lands in offline mode and reconciles in the background.
- **Verification:** Jest on `useAppStartup` with `authRestorationSettled=false` and a persisted user; Android device with a blackholed API.

### PERF-006  [P1] Guests cannot record a practice session
- **Issue ID:** PERF-006 (raw: C-03)
- **Screen / System:** Practice completion (guest)
- **Severity:** P1
- **Evidence type:** Code suspected
- **Symptoms:** A guest finishes Focus/Deep Focus: the completion screen shows "not saved"; no history, streak or thread movement. In the non-focus fallback the complete action silently does nothing.
- **Reproduction:** Continue as guest (reachable once PERF-001 is fixed), start Focus, finish.
- **Measurements:** None collected.
- **Likely root cause:** `resolvedAccountId = accountId ?? anchor?.userId ?? 'local-user'` (`V2PracticeSessionScreen.tsx:168`) but `completePracticeSession` throws "Practice completion account does not match the active account." because `useAuthStore.getState().user?.id` is undefined (`PracticeCompletionService.ts:136-150`); `completeLegacy` returns when `!accountId` (`:422`). Confidence high.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `screens/v2/practice/V2PracticeSessionScreen.tsx:59, 164-205, 420-449`; `services/PracticeCompletionService.ts:136-150, 241-250`
- **Recommended solution:** Define a local-only guest account id accepted by `completePracticeSession`/`queueCanonicalCompletion`, written with `syncState:'pending'` and excluded from `flush` until a real account exists; re-key the queue on account creation (mirror `finalizePendingFirstAnchorDraft`). Make `completeLegacy` surface an error.
- **Visual preservation:** None.
- **Risk:** Medium: touches the practice write queue keying.
- **Verification:** Jest on `PracticeCompletionService` with no user; device guest session then sign-up, history uploaded once.

### PERF-007  [P1] "Export My Data" calls `/auth/me/export`, which does not exist (server route is `/api/auth/me/export`)
- **Issue ID:** PERF-007 (raw: C-04)
- **Screen / System:** Settings > Account & data; Profile > Data & privacy
- **Severity:** P1
- **Evidence type:** Code-verified (deterministic: grep / call chain read by the lead)
- **Symptoms:** Export always ends in the "Export Failed" alert.
- **Reproduction:** Tap Export in Settings > Account & data. `apiClient` has no `/api` prefix; the server mounts the router only at `/api/auth` (`backend/src/index.ts:328`, route `auth.ts:627`), so the call 404s.
- **Measurements:** Verified by grep (client path vs server mount), not run.
- **Likely root cause:** Missing `/api` prefix (hydration correctly uses `/api/auth/me/export`). Confidence high.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `screens/settings/AccountDataSubscreen.tsx:96`; `screens/profile/DataPrivacyScreen.tsx:95`
- **Recommended solution:** Use `/api/auth/me/export`. Secondary: write the export to a file and share its URI instead of one huge `Share.share({message})` string.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Jest with a mocked client asserting the URL; device export on an account with an image Anchor.

### PERF-008  [P1] A failed server save still "succeeds" locally: phantom Anchor that is never uploaded
- **Issue ID:** PERF-008 (raw: C-08)
- **Screen / System:** Creation save (`useSaveAnchor`)
- **Severity:** P1
- **Evidence type:** Code suspected
- **Symptoms:** For a signed-in user, if `POST /api/anchors` fails for any reason except the two limit codes (5xx, 401, timeout after one retry), the flow continues as saved: a local Anchor `anchor-<key>` is added, Home plays the arrival, nothing is queued. Later Vision/Chart/Release/practice calls on that id 404, and hydration keeps non-backend ids forever.
- **Reproduction:** Signed in, API returning 503 on `/api/anchors`, create an Anchor through the V2 flow.
- **Measurements:** None collected.
- **Likely root cause:** `catch (err)` ends with "Continue with local fallback" (`useSaveAnchor.ts:353`). `services/v2/creationPersistence.ts` was written to avoid exactly this but the live flow does not use it; the only retry queue (`AnchorSyncService`) is legacy Supabase and gated off. Confidence high.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `hooks/useSaveAnchor.ts:240-356, 360-385`; `screens/create/flow/AnchorCreationFlowScreen.tsx:678-715`; `stores/anchorStore.ts:165-192`; `services/AuthHydrationService.ts:696-707, 931-945`
- **Recommended solution:** For authenticated saves treat a non-limit failure as `{status:'failed'}`: reset the seal, show the retry affordance, re-send with the same idempotency key. Keep local-first only for the guest-first-anchor branch.
- **Visual preservation:** Reuse the existing seal reset (`chooseRef.current?.reset()`); only an error line is new.
- **Risk:** Medium: changes creation failure semantics.
- **Verification:** Jest on `useSaveAnchor` with a rejected POST asserting no `addAnchor`; device with the API disabled.

### PERF-009  [P1] Photo uploads send the original camera file as inline base64, 8 in parallel, against an 8 MB JSON limit
- **Issue ID:** PERF-009 (raw: D-01)
- **Screen / System:** Vision/Chart photo uploads; backend `/api/v2/assets/upload`
- **Severity:** P1
- **Evidence type:** Code suspected
- **Symptoms:** Multi-photo or high-resolution uploads stall for seconds on cellular, 413 / "Image upload failed" for 50 MP photos, JS heap spikes; full-resolution photos also fail Visualize's 2048x2048 texture cap (`oversizedCount > 0`).
- **Reproduction:** Vision creation > photos > pick 8 photos taken in 50 MP mode on the S24 while watching network and JS heap; then run Visualize on that Vision. For the 413: one 50 MP photo.
- **Measurements:** Disk/code facts, nothing run: backend JSON limit 8 MB for both upload routes (`backend/src/index.ts:243-246`); base64 inflates x4/3 so the raw file must be <= ~6 MB; client reads the original with `FileSystem.readAsStringAsync(Base64)`, concatenates, then axios stringifies (up to 3 live copies); `expo-image-picker` `quality` recompresses but never resizes; `prepareUploads` fires all photos concurrently (`useVisionCreationActions.ts:125-127`, `VISION_BOARD_MAX_IMAGES = 8`). Worst-case ~190 MB of transient strings is lead-checked arithmetic, not measured.
- **Likely root cause:** No downscale or re-encode between picker and storage; base64-in-JSON transport. Backend stores the buffer unchanged (`visionRoutes.ts:432`) and later serves it as the board image. Confidence high.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `components/v2/vision/ceremony/useVisionCreationActions.ts:81-127`; `hooks/v2/vision/visionPhotoInput.ts:36-80`; `hooks/v2/vision/useVisionAppearanceReference.ts:80-95`; `components/v2/chart/chartReferences.ts:36-62`; `screens/v2/practice/visualize/cinematicAssets.tsx:8-16, 96-115`; `backend/src/api/routes/v2/visionRoutes.ts:408-446`
- **Recommended solution:** Step 1 (OTA-safe, backend): in `/assets/upload` run `sharp(buf).rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).jpeg({quality:88,mozjpeg:true})` before storing. Step 2 (needs a native build, `expo-image-manipulator` is not installed): resize to long edge 2048 / JPEG 0.85 on device, upload multipart via `FileSystem.uploadAsync`, cap concurrency at 2.
- **Visual preservation:** Identical on screen: 2048 px exceeds every consumer (1080x1920 share, 4.19 MP Visualize cap). Appearance reference is only a model input.
- **Risk:** Low for the backend resize (`.rotate()` handles EXIF); medium for multipart. Existing stored assets unchanged unless backfilled.
- **Verification:** Upload 12 MP and 50 MP JPEGs: stored object <= ~1 MB and <= 2048 px, no 413; Hermes heap flat during an 8-photo batch; Visualize `oversizedCount === 0`.

### PERF-010  [P1] Android: Focus and Deep Focus ambient and narration resume under the Paused overlay after backgrounding
- **Issue ID:** PERF-010 (raw: B-01)
- **Screen / System:** Focus / Deep Focus session audio (Android)
- **Severity:** P1
- **Evidence type:** Code suspected
- **Symptoms:** Background the app mid-session, return after N seconds: the screen says Paused and the clock is stopped, but the bed and narration are playing, N seconds ahead of the clock; on Resume the narration ends early. iOS is not affected in the normal event order.
- **Reproduction:** Android, sound on, Deep Focus 5 min with voice, press Home, wait 20 s, return, listen under the Paused overlay. Repeat Focus 60 s.
- **Measurements:** Library source read, not reproduced for Focus/Deep Focus. The same mechanism was observed and fixed for Visualize (dev notes).
- **Likely root cause:** expo-audio Android `OnActivityEntersBackground` pauses every playing player and sets `isPaused`; `OnActivityEntersForeground` calls `play()` on every flagged player (`node_modules/expo-audio/android/.../AudioModule.kt:217-248`); JS `pause()` does not clear the flag (`:401-405`). Focus/Deep Focus pause only from the JS AppState handler, which arrives after or races with the native hook. Confidence high on mechanism, medium on frequency.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `hooks/useSessionAudio.ts:108-147`; `screens/v2/practice/focus/V2FocusActiveScreen.tsx:661-712`; `screens/v2/practice/deepFocus/V2DeepFocusActiveScreen.tsx:131-153`; the Visualize fix `visualize/guided/useGuidedPlayback.ts:100-103, 188-196`
- **Recommended solution:** Put the guard in the shared `useSessionAudio` wrapper: keep `wantPlaying` (set by play/pause/stop) and in the existing `playbackStatusUpdate` listener (line 100) call `player.pause()` whenever `status.playing && !wantPlaying`; re-assert pause in an AppState `active` handler. Ignore status events for ~600 ms after a start/resume (`STATUS_SETTLE_MS` as in `useGuidedPlayback`).
- **Visual preservation:** No cue, level or timing changes; only suppresses audio the app did not request.
- **Risk:** Low.
- **Verification:** Android device matrix: Focus 60 s, Deep Focus 2 min, ambient-only, voice-only, background/return; jest on the wrapper emitting `{playing:true}` while `wantPlaying=false`.

### PERF-011  [P1] `entering=` layout animations on first mount of native-stack routes match the known react-native-screens Android NPE class
- **Issue ID:** PERF-011 (raw: A-22)
- **Screen / System:** Auth / onboarding first-mount animations (Android)
- **Severity:** P1
- **Evidence type:** Code suspected
- **Symptoms:** Possible Android crash (NPE in `getVisibility()` during `dispatchAttachedToWindow`) when a Reanimated `entering` animation fires while RNS attaches the route fragment. Not reproduced; severity is risk-based.
- **Reproduction:** Cold navigate to `V2Auth` on Android; repeat 20 times, including on a slow first layout or low-end device.
- **Measurements:** None collected. `V2AuthScreen.tsx:314` has an undelayed `entering=`; `V2OnboardingJourney.tsx:257,272` delay 160/380 ms (probably safe); `V2SealedSaveScreen.tsx:367,375-505` use `entering`/`exiting` for in-screen blocks.
- **Likely root cause:** Matches the NPE documented in the V2 navigation perf pass notes. Confidence low-medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `screens/v2/auth/V2AuthScreen.tsx:314, 346, 370-371, 456-457`; `screens/v2/onboarding/V2SealedSaveScreen.tsx:367-505`; `screens/v2/onboarding/V2OnboardingJourney.tsx:257, 272`
- **Recommended solution:** Replace first-mount `entering` with a shared-value fade/rise started after `transitionEnd` or one `requestAnimationFrame` (the repo's documented pattern).
- **Visual preservation:** Same fade durations and offsets.
- **Risk:** Low.
- **Verification:** Android crash monitoring for the NPE signature; 20 cold opens of Auth.

## 8.2  P2 issues

### PERF-012  [P2] Each Details open: ~1.5 s of JS-thread stalls, 31-35 skipped main-thread frames on 13 of 15 opens, 250 ms p99 frame
- **Issue ID:** PERF-012 (raw: E-03)
- **Screen / System:** Home to Details shared-element hero flight
- **Severity:** P2
- **Evidence type:** Runtime observed (gfxinfo/logcat/meminfo, DEBUG build)
- **Symptoms:** A visible hitch on the most-used transition; 5 taps in 0.6 s correctly produced one navigation.
- **Reproduction:** Home, tap the active Anchor, return; 15 loops. Profile JS thread and main thread.
- **Measurements:** DEV BUILD (S24, 120 Hz adaptive). 30 transitions: 213/2786 frames janky (7.65%), p95 23 ms, p99 250 ms, 76 missed vsync, 79 slow bitmap uploads. 136 JS stalls on V2AnchorDetails totalling 22.3 s (~1.49 s per open; first ~400 ms stall starts ~400 ms after `detailsTransitionLaunch`, then 5-8 more of 90-280 ms). `Choreographer: Skipped 31-35 frames` (~260-290 ms) on 13/15 opens. Dev mode inflates JS stalls; the main-thread skips and bitmap uploads suggest a real native cost.
- **Likely root cause:** Not isolated. Candidates: PERF-013 (context churn re-renders Home, Details, Practice, Progress at flight milestones), PERF-014 (cloud tiles built on JS then PNG-encoded at first Chart-card mount), Details mounting the Vision collage / Thread Strength / practice cards during the flight with image decode. Confidence medium-low.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `screens/v2/anchors/V2AnchorDetailsScreen.tsx`; `navigation/v2/ProgressiveFocusTransition.tsx`; `navigation/v2/transitions.ts`; `components/v2/V2AssetPrewarm.tsx`
- **Recommended solution:** Re-measure on a release build first. Then: Perfetto trace of one open to attribute the 400 ms stall; apply PERF-013 and PERF-014; defer non-visible Details sections until after `V2_TRANSITION_SETTLE_MS`.
- **Visual preservation:** Flight geometry, spring (stiffness 230, damping 27) and 320 ms travel budget stay untouched; only what mounts during the flight changes.
- **Risk:** Medium: this is the most-tuned code in the app (blank-frame fix history).
- **Verification:** Same 15-loop gfxinfo run on a release build; JS stalls per open; blank-frame detector from the 2026-09-28 method still reads 0.

### PERF-013  [P2] Transition context changes 3-5 times per flight; every consumer re-renders and the hide/show hand-off waits on a JS commit
- **Issue ID:** PERF-013 (raw: A-01)
- **Screen / System:** Anchor hero transition provider
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Possible hitch at the instant the copy takes over (tap) and at hand-over (landing): the frame where Home hides its disc and Details un-hides its artwork both wait on a JS render of a large tree.
- **Reproduction:** Tap the active Anchor on Home and watch the first 2-3 and last frame of the flight; Details to Home. Profile JS in those windows.
- **Measurements:** None collected.
- **Likely root cause:** `RootTransitionProvider` keeps `flight`, `locked`, `copyMounted` in React state inside the memoised context value (`:771`); state writes: launch (`:452-454`), `onCopyLayout` (`:720`), `acceptDestination` `setFlight` (`:671`), `reset` (`:349-351`). Consumers: `V2HomeScreen:136`, 5 `AnchorHeroItem` (`V2HomeHero.tsx:229`), `V2AnchorDetailsScreen:618-622`, `V2PracticeRouteScreen`/`V2ProgressRouteScreen` (`AnchorV2Navigator.tsx:115,411`), `V2PracticeScreen`. Memoised children do not help consumers of context. Confidence medium-high on mechanism.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `navigation/v2/ProgressiveFocusTransition.tsx:294-296, 325-351, 440-454, 658-690, 715-721, 771-806`; `components/v2/home/V2HomeHero.tsx:228-229`; `screens/v2/home/V2HomeScreen.tsx:136`; `navigation/v2/AnchorV2Navigator.tsx:115, 411`
- **Recommended solution:** (1) Split into a never-changing "actions + shared values" context and a small "flight state" context. (2) Replace React-state `copyMounted`/hidden with a shared value `copyVisible` and let each place hide its artwork via `useAnimatedStyle`, moving the hand-off onto the UI thread. (3) Keep `flight` in a ref; render only the layer from local state.
- **Visual preservation:** Identical frames: the shared value flips in the same UI tick as copy mount/removal. Reduce Motion path (140 ms cross-fade) unchanged.
- **Risk:** Medium-high: watchdog (`watchdogMs` 900), Jest rAF no-op and `reset()` JS fallback must keep working.
- **Verification:** React Profiler commit count per trip (expect 3-5 down to 0-1 on Home/Details); frame-detector reads 0 blank frames; transition jest tests.

### PERF-014  [P2] First Chart-card mount draws 3 tiles on the JS thread, then PNG-encodes 3 images synchronously
- **Issue ID:** PERF-014 (raw: A-09)
- **Screen / System:** Chart cloud tiles (Details Chart card, Chart open)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** A late or jolted landing of the Home to Details flight on the first open of a session, or a stutter on the first Details scroll.
- **Reproduction:** Cold launch, Home to Details for an Anchor that has a Chart; profile the JS thread for 300 ms after Details mounts.
- **Measurements:** None collected.
- **Likely root cause:** `loadCloudTiles` draws ~150 gradient circles per tile via `drawAsImage`; `ChartWeatherVeilPrimer` then runs `encodeToBase64(PNG)` on three 512/384 px RGBA images synchronously (`chartCloudTiles.tsx:183-205`), deferred only by `setTimeout(0)`, which moves it off the frame but not off the JS thread. `ChartMapCrop` mounts the primer on every Details with a Chart. Confidence medium on cost, high that it is on JS.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `components/v2/chart/map/chartCloudTiles.tsx:163-205`; `components/v2/chart/map/ChartWeatherNativeVeil.tsx:99-123`; `components/chart/ChartMapCrop.tsx:57-58`; `components/v2/chart/map/ChartMapWeather.tsx:154-168`
- **Recommended solution:** Tiles are deterministic (seeded LCG, "identical on every device"): pre-bake the three PNGs as bundled assets and use them for both the native veil (`require`) and Skia (`useImage`). If runtime generation stays, run it after idle past `V2_TRANSITION_SETTLE_MS` and write once to the cache dir as file URIs.
- **Visual preservation:** Pixel-identical if baked with the current renderer (image-diff it). Keep a runtime fallback.
- **Risk:** Low-medium: asset pipeline; +~1-2 MB.
- **Verification:** JS busy time after first Details mount; first-launch flight end-frame timing; PNG vs runtime pixel diff.

### PERF-015  [P2] Sheet drag/snap animates `top`, `left`, `width`, `height`, `fontSize`, `lineHeight` every frame (provisional P2; escalate to P1 if measured)
- **Issue ID:** PERF-015 (raw: A-02)
- **Screen / System:** Anchor Details sheet drag and snap
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Uneven frame pacing while dragging the sheet or during its 420 ms snap; title shimmer as it morphs between centred and header sizes; practice-card height change relays out the cards below.
- **Reproduction:** Details, drag the sheet handle slowly between rest/half/full; tap the handle to cycle snaps; trace UI thread and RenderThread.
- **Measurements:** None collected. E measured Details scroll (6.3% janky) and open but not sheet drag. Lead downgraded the agent's P1 to a provisional P2 until the drag is measured.
- **Likely root cause:** `centeredStyle` (`top`), `centeredTitleStyle` (`width`, `fontSize`, `lineHeight` on an `Animated.Text`), `headerStyle` (`left`, `top`, `width`), `practiceWrapStyle` (`height`) are driven from `sheetY`; with `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` layout props are expected to be a Fabric commit per frame (the repo's own `theme/v2/motion.ts` says so). The in-code comment "the sheet is translated, never resized" conflicts with this. `currentLayout` builds an object per frame feeding 10 styles. Confidence medium-high.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `screens/v2/anchors/V2AnchorDetailsScreen.tsx:765, 771-797, 887-915, 1074-1076, 1097, 1165`; `components/v2/anchors/anchorDetailsSheetLayout.ts`
- **Recommended solution:** Title: render once at the largest size and animate `transform` (translate + uniform scale) with the existing opacity cross-fade between the two text nodes. `top`/`left`/`width` to translate with fixed width. Practice card: fixed height + clip, reveal via opacity + translate, swap the spacer at `onSettled`. Collapse `resolveSheetLayout` into scalar derived values.
- **Visual preservation:** Same end states and curves as `resolveSheetLayout` (bezier(0.2,0.8,0.2,1), 420 ms; snaps 0.671/0.464/max(0.251H, inset+168)); hinting difference of scale vs fontSize to be checked against prototype screenshots.
- **Risk:** Medium: title/practice-card visual regressions; `scrollOn` and teaching rects must still measure correctly.
- **Verification:** gfxinfo jank% while dragging before/after; screenshot diff at the three snaps.

### PERF-016  [P2] Focus session runs far below display rate: 38% janky, p50 20 ms, 376 slow bitmap uploads
- **Issue ID:** PERF-016 (raw: E-04)
- **Screen / System:** Focus session animation
- **Severity:** P2
- **Evidence type:** Runtime observed (gfxinfo/logcat/meminfo, DEBUG build)
- **Symptoms:** The full-screen ceremonial field animation on the primary practice path is visibly below 120 Hz.
- **Reproduction:** Home, All Practices, Focus 10 s, Begin; `dumpsys gfxinfo` over the session.
- **Measurements:** DEV BUILD. 1061 frames, 403 janky (38.0%), legacy 57.6%, p50 20 / p90 32 / p99 42 ms, 270 missed vsync, 401 slow UI thread, 376 slow bitmap uploads (highest of any scenario), GPU p50 2 ms. screenrecord averaged ~25 fps (not authoritative). Also 1474 `V2Practice` JS stalls in the buffer, the most of any route.
- **Likely root cause:** GPU is not the limit; cost is CPU/UI thread plus a bitmap re-uploaded per frame, suggesting an Image with an animated transform or a Skia image rebuilt per frame (`V2FocusField` / `V2FocusAnchorArtwork` `breathingStyle`). Confidence medium-low; needs a release trace.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `screens/v2/practice/focus/V2FocusField.tsx`; `screens/v2/practice/focus/V2FocusActiveScreen.tsx`
- **Recommended solution:** Release build + Perfetto/HWUI bitmap-upload trace to find the re-uploading node; then back the artwork with a stable texture (same bitmap, transform-only animation, `renderToHardwareTextureAndroid` where it helps) and remove any per-frame image reconstruction. Compare with Reduce Motion on.
- **Visual preservation:** Breathing 1.015 over 3200 ms inOut(sin) reverse, drifts 8300/11200/16800 ms, field transition 520 ms all unchanged.
- **Risk:** Low-medium.
- **Verification:** gfxinfo on release: janky% and slow bitmap uploads for the same 10 s session; frame-detector for pacing.

### PERF-017  [P2] Vision board scroll is janky: 25.6% janky, p50 13 ms, 43 missed vsync
- **Issue ID:** PERF-017 (raw: E-05)
- **Screen / System:** Vision board scroll
- **Severity:** P2
- **Evidence type:** Runtime observed (gfxinfo/logcat/meminfo, DEBUG build)
- **Symptoms:** Scrolling the photo collage is visibly uneven.
- **Reproduction:** Details to Vision board, scroll 3x; gfxinfo.
- **Measurements:** DEV BUILD. 317 frames, 81 janky (25.6%), legacy 40.7%, p50 13 / p90 25 / p99 36 ms, 50 slow draw commands, 0 slow bitmap uploads; opening the board had 19 slow draw commands.
- **Likely root cause:** Images are already uploaded; the cost is drawing/compositing several large rotated, torn-edge-masked photos each frame in a scrolling surface (scene is laid out at 1.7x `renderScale`). Confidence medium-low.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `components/v2/vision/board/VisionBoardPhoto.tsx`; `components/v2/vision/board/visionBoardMotion.ts`
- **Recommended solution:** Release-build trace first. Candidates: pre-composite each photo's mask once into a cached layer (`renderToHardwareTextureAndroid`), avoid per-frame masks on scrolling content, reduce overdraw of off-screen tiles. Pair with PERF-018.
- **Visual preservation:** Same masks, rotations and framing; compare recordings.
- **Risk:** Medium.
- **Verification:** gfxinfo scroll run on release; screenshot diff of mask edges.

### PERF-018  [P2] Every photo animates `left/top/width/height` in 4 styles during recompose and swap settle
- **Issue ID:** PERF-018 (raw: A-07)
- **Screen / System:** Vision board photo recompose / swap
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Stutter when images are added/removed (1000 ms recompose) and when a drag crosses a slot (all other photos spring to new rects): 4 photos x 4-5 animated layout styles per frame, each with an Image child.
- **Reproduction:** Long-press-drag a photo across slots with 4-6 photos; add or remove a photo.
- **Measurements:** None collected.
- **Likely root cause:** `containerStyle` animates left/top/width/height/zIndex/opacity/transform (`:311-324`), `frameStyle` width/height (`:326`), `windowStyle` left/top/width/height from three blended frame-kind weights (`:328-345`), `captionPositionStyle` top (`:140`). Confidence medium.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `components/v2/vision/board/VisionBoardPhoto.tsx:140, 259-345`; `components/v2/vision/board/visionBoardMotion.ts:20, 29-37`
- **Recommended solution:** Lay each photo out once at its target size; animate translate + uniform scale from the old rect, cross-fade old/new aspect content with the existing landscape/portrait/square weights; snap layout to the new size in `onSettled`.
- **Visual preservation:** Same motion path and timing (recompose move 1000, enter delay 380/720, exit 420, frame cross-fade 320); aspect-change transitions need the cross-fade; compare recordings.
- **Risk:** High: most intricate gesture component (drag-swap races, reorder commit). Do after PERF-015 with recorded baselines.
- **Verification:** Frame pacing during a 6-photo drag on the S24; `visionBoardReorder` unit tests; before/after recordings.

### PERF-019  [P2] Perpetual flag sway redraws the whole overlay canvas (dashed route, path effects) every frame, even with no flag and after blur
- **Issue ID:** PERF-019 (raw: A-03)
- **Screen / System:** Chart overlay (flag sway)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Sustained UI/RenderThread load, heat and battery on an idle Chart; less headroom for camera and sheet; continues while the Chart is covered by another route.
- **Reproduction:** Open a Chart with no visible flag, leave idle, sample GPU/UI thread; then open a practice session over it and sample again.
- **Measurements:** None collected.
- **Likely root cause:** `sway` is a `withRepeat(-1)` shared value (`ChartMapOverlay.tsx:164-184`, 4 s loop) consumed inside one Skia `Canvas` that also holds the dashed route (`DashPathEffect`), rough path, two `DiscretePathEffect` X paths and gradient circles; each change replays the display list. It runs whenever `!reducedMotion` and not intro, regardless of `flagOpacity`/`arrived`, with no focus pause (unlike `useWeatherDrift`). The component's own comment admits the invalidation. Confidence medium-high on the loop, medium on cost.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `components/v2/chart/map/ChartMapOverlay.tsx:164-184, 196-279`; `components/v2/chart/map/ChartMap.tsx:262-282`; `components/v2/chart/ChartActiveView.tsx:1286`
- **Recommended solution:** Preferred: move the flag into the native marker layer or a tiny dedicated Canvas so sway invalidates a few paths. Minimum: start sway only while `flagOpacity > 0` and the screen is focused (`useScreenFocused`), `cancelAnimation(sway)` otherwise. Option: cache the static route as a `Picture`/image.
- **Visual preservation:** Sway amplitude/period unchanged (`SWAY_DEG` 2, half period 2000 ms, bezier(.4,0,.6,1)); flag stays at the same map coordinates; Reduce Motion unchanged.
- **Risk:** Low for the minimum fix; medium for the others (alignment, z-order, flag-drop and summit arrival moments).
- **Verification:** gfxinfo/GPU profiler on an idle Chart before/after; flag drop and summit pop still align; no canvas redraws under a covering route.

### PERF-020  [P2] Runtime-shader cloud mask recomputed every frame although the mask inputs are static at rest
- **Issue ID:** PERF-020 (raw: A-04)
- **Screen / System:** Chart living weather
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Continuous full-rect shader work for a drift of 6-14 map units per second (sub-pixel per frame at 120 Hz).
- **Reproduction:** Idle on a Chart with weather ready; GPU counters.
- **Measurements:** None collected.
- **Likely root cause:** `useFrameCallback` advances `weatherClock` each frame (`ChartMapWeather.tsx:111-123`) so three tile transforms change per frame; a `dstIn` rect with `COVER_SKSL` samples three images with uniforms that only change during sequences, inside a `Group layer` over the padded map. Confidence medium.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `components/v2/chart/map/ChartMapWeather.tsx:105-142, 218-272`; `components/v2/chart/map/chartMapShaders.ts`
- **Recommended solution:** When cover uniforms are idle for N ms, bake the mask once into an `SkImage` (offscreen `drawAsImage`) and draw with a plain `dstIn` image mask; use the live shader only while the cover animates. Optionally coalesce redraw invalidation when the visible offset delta is under 1/4 px (still advancing every frame, not 30 fps).
- **Visual preservation:** Pixel-identical at rest (needs a baked-vs-live visual diff); live shader during cover changes as today.
- **Risk:** Medium-high: Skia offscreen lifecycle, texture memory, live/baked handover.
- **Verification:** GPU frame time on idle Chart; screenshot diff; frame detector across the handover.

### PERF-021  [P2] UI-thread clock is fed by a 50 ms JS `setInterval`; a JS stall freezes then snaps the camera; screen re-renders at 10 Hz; seal haptic keyed to that render
- **Issue ID:** PERF-021 (raw: A-05, B-15)
- **Screen / System:** Visualize guided playback clock
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** A JS stall over ~50 ms makes the camera/photo timeline hold still then glide or snap (`SNAP_FORWARD_MS` 400); micro-stutter when JS is busy; the seal haptic lands up to ~100 ms plus render time after the visual seal moment.
- **Reproduction:** Run a 3 or 10 minute session under JS load (re-render triggers, debug busy loop); watch the stage; systrace JS-thread usage.
- **Measurements:** None collected.
- **Likely root cause:** `useGuidedPlayback` samples `player.getCurrentTime()` every `SAMPLE_MS = 50` in a JS interval and writes `positionSV.value = withTiming(ms + 50, 50, linear)` (`:77, 200-205`); if the next sample is late the animation stops. `setPositionMs` every 100 ms re-renders `V2CinematicSessionScreen` (recomputes `resolveGuidedState`, `cinematicSegmentAt`, `cinematicGradeAt`, captions, `:241-313`); the stage is `memo`d so the cost is the shell. Deep Focus uses one linear `withTiming` for the whole session. Confidence medium-high.
- **Root-cause cluster:** RC-6, JS-clock-driven visuals and cues running parallel to UI-thread animation
- **Relevant files:** `screens/v2/practice/visualize/guided/useGuidedPlayback.ts:12-14, 69-86, 196-208`; `screens/v2/practice/visualize/V2CinematicSessionScreen.tsx:236-330`; `screens/v2/practice/visualize/CinematicSessionStage.tsx:105-110`
- **Recommended solution:** Anchored UI-thread extrapolation: store `(anchorPositionMs, anchorWallTime)` in shared values on each sample, derive `anchorPos + (now - anchorWall)` while running; JS re-anchors only when drift exceeds ~60 ms or on pause/seek/resume and may sample at 250-500 ms. Publish React state only when a derived value changes (second boundary, segment/phrase/image index, caption). Fire the seal haptic from the sampler on first crossing of `sealAtMs` (keep the 1500 ms window and once-only latch).
- **Visual preservation:** Timeline identical; audio stays the master clock; haptic moves up to ~100 ms closer to the visual. Reduce Motion unchanged.
- **Risk:** Medium: clock correctness is central (beat maps, pause/resume/background, snap semantics); keep deterministic tests and the `wallClock` seam.
- **Verification:** Log drift between extrapolated and `getCurrentTime()` over 10 min; inject a 300 ms JS stall in a test build; existing guided-playback tests; JS-thread usage before/after.

### PERF-022  [P2] Full-viewport save-layers and blend rects recorded every frame even at opacity 0
- **Issue ID:** PERF-022 (raw: A-06)
- **Screen / System:** Visualize Skia stage
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** High fixed per-frame GPU cost for the whole session; risk of dropped frames at 120 Hz on non-flagship GPUs.
- **Reproduction:** Run Visualize; GPU profiler during a long silent hold segment.
- **Measurements:** None collected.
- **Likely root cause:** The stage draws, every frame: masked/mark/watermark/reduced layers (`CinematicSessionStage.tsx:214, 225, 238, 247`) and four full-viewport rects (`multiply` warm, `saturation` soften, haze, dim, `:257-260`) plus a halo circle; each `layer=` is a viewport-sized save-layer and non-separable blends read the destination. Skia does not reliably skip zero-alpha non-srcOver blends. Confidence medium.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `screens/v2/practice/visualize/CinematicSessionStage.tsx:211-270`
- **Recommended solution:** Gate each layer by `segment.kind` (already available coarsely on JS and changing a few times a minute), mounting only in segments that use them, with a 1-2 frame overlap; use a plain `Rect` for the always-on dim.
- **Visual preservation:** Identical frames when gating sits where layer opacity is exactly 0 at both edges; frame-compare test at every segment boundary.
- **Risk:** Medium: boundary popping if the gate is one frame early/late.
- **Verification:** GPU frame time in long segments before/after; frame diff at every boundary using the timeline fixtures.

### PERF-023  [P2] Layout-prop and SVG-prop animation, double text write, replay on every focus
- **Issue ID:** PERF-023 (raw: A-08)
- **Screen / System:** Thread Strength (Home Progress section)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** A 1.4 s per-frame animation (clip width, gray left/width, 4 SVG `strokeDashoffset` props, tip dot, count-up) restarts on every focus, competing with the return transition; `0%` text flash at replay start; track pops in after `onLayout`.
- **Reproduction:** Home with an Anchor that has no Vision: go to Details/Practice and back; profile the 1.4 s after focus.
- **Measurements:** None collected.
- **Likely root cause:** `animatedClipStyle` animates `width`, `animatedGrayStyle` `left`/`width`; `strand1..4Props` use `useAnimatedProps` on `strokeDashoffset`; text is written by `animatedTextProps` and again by `useAnimatedReaction` -> `runOnJS(updateNativeText)` per integer (up to ~60-100 JS hops) plus `setNativeProps`; `nav.addListener('focus')` replays (`ThreadStrength.tsx:270-275`). Confidence medium-high.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `components/v2/thread/ThreadStrength.tsx:176-311, 413-512, 560-600`; `components/v2/home/V2HomeProgressSection.tsx:89`
- **Recommended solution:** One text path (keep the UI-thread `animatedTextProps`, delete the reaction + `runOnJS`); animate the clip with `scaleX` + counter-scale or a single `strokeDashoffset`; start the replay after `V2_TRANSITION_SETTLE_MS` (or only on value change, after design confirms); render tracks with a cached width so there is no empty first frame.
- **Visual preservation:** Same reveal (1400 ms bezier(0.22,1,0.36,1)) and end state; the replay-on-focus is a design choice, so only move its start unless design agrees.
- **Risk:** Low-medium.
- **Verification:** JS event count during the reveal (expect ~60-100 fewer); start/end frame visual diff.

### PERF-024  [P2] Reduce Motion hooks start `false`, resolve asynchronously and are instantiated 107 times
- **Issue ID:** PERF-024 (raw: A-11)
- **Screen / System:** Accessibility: Reduce Motion hooks (app-wide)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** For a user whose OS reduces motion, the first render of every screen runs with `reduceMotion = false`, so mount effects start full-motion animations that are cancelled a tick later.
- **Reproduction:** Enable system Reduce Motion / "Remove animations", open an animated screen, log the first `reduceMotion` values.
- **Measurements:** None collected. 107 call sites (grep); each mount makes an async native call and a listener.
- **Likely root cause:** `useSystemReduceMotionEnabled` is `useState(false)` + `AccessibilityInfo.isReduceMotionEnabled().then(...)`; `useCreationReduceMotion`/`useCelebrationReduceMotion` call it twice. Confidence high on the code facts. Raised to P2 because the brief makes Reduce Motion non-negotiable.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `hooks/useReduceMotionEnabled.ts:1-60`; `hooks/v2/useV2ReduceMotion.ts`; `hooks/useCelebrationReduceMotion.ts`
- **Recommended solution:** One module-level store read once at app start, exposed through `useSyncExternalStore` with a single listener so the first render already has the OS value; combine with the settings preference exactly as now; reuse once in the creation/celebration hooks.
- **Visual preservation:** Reduce Motion semantics unchanged (preference wins, else system, including the "animator scale 0 counts as reduced" nuance).
- **Risk:** Low; mock the store in Jest.
- **Verification:** Unit test that the first render has the OS value; count native calls at startup.

### PERF-025  [P2] A long-lived process sat at ~2.1-2.3 GB PSS with ~740 MB graphics and 470-610 MB swap; growth source not found
- **Issue ID:** PERF-025 (raw: E-06)
- **Screen / System:** Whole app, long-lived process memory
- **Severity:** P2
- **Evidence type:** Runtime observed (gfxinfo/logcat/meminfo, DEBUG build)
- **Symptoms:** Risk of OS kill on lower-RAM devices; 2,000-2,700 Views.
- **Reproduction:** `dumpsys meminfo` on a process that has been used for a long session.
- **Measurements:** DEV BUILD. Long-lived: TOTAL PSS 2.09-2.29 GB, Graphics 724-744 MB, Swap 468-611 MB, Views 2,060-2,710. Fresh process after force-stop: 1.22-1.32 GB, Graphics 309-379 MB, Views 486-932. 15 Home/Details loops: PSS flat (2.29 -> 2.20 GB), Views flat at 2289-2291, i.e. no leak on that route. The growth accumulated before the audit started.
- **Likely root cause:** Not isolated. Candidates: retained Vision photos/anchor art textures across screens, Home hero bitmaps, creation/Chart/Visualize flows. Confidence low.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** Whole app; see PERF-026, PERF-032, PERF-059.
- **Recommended solution:** From a fresh release process, loop Vision, Visualize, Chart and creation separately with `meminfo` per cycle to find the accumulating screen; then bound the relevant cache or unmount retained bitmaps.
- **Visual preservation:** No visual change intended; thumbnails/decode sizing must be visually equivalent.
- **Risk:** Low-medium.
- **Verification:** PSS/Graphics/Views per cycle flat across 20 cycles of each flow on a release build.

### PERF-026  [P2] Small display, big bitmap: Vision method polaroids decode three 1920x1280 photos (9.8 MB each) for 104x128 dp slots
- **Issue ID:** PERF-026 (raw: D-08, D-13)
- **Screen / System:** Image decode sizing (Vision method step, selector avatars, share previews)
- **Severity:** P2
- **Evidence type:** Measured on disk (asset/bundle facts)
- **Symptoms:** ~29 MB of bitmap memory and a decode hitch entering the Vision method step for imagery drawn at ~270x336 px.
- **Reproduction:** Open Vision creation to the method step; watch graphics memory rise ~30 MB.
- **Measurements:** Disk/code: `polaroid: width 104, height 128` x3 (`VisionMethodStage.tsx:165`), each 1920x1280 = 9.83 MB decoded; needed at 3x density 312x384 px (~0.5 MB). RN Android `Image` does not downsample bundled or remote sources by default (`ReactImageView.kt:559-562`); only ~8 of 101 `<Image>` usages set `resizeMethod`. Other cases: Vision "generate" card photo 720x1280 (3.7 MB decoded) in a 68% card; selector avatars load 1024x1024 art (4.2 MB) at 40-80 dp (reachability low-confidence); share-environment backgrounds 900x1600 (5.8 MB) in ~180-260 dp previews. Latent: `V2HomeCategoryEnvironment` would mount 12 images at once (75.5 MB decoded) if revived; not rendered anywhere today.
- **Likely root cause:** One master asset reused at very different display sizes. Confidence high.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `components/v2/vision/VisionMethodStage.tsx:84-120, 149, 165`; `components/v2/vision/visionIntroArt.ts:41-46`; `screens/practice/components/AnchorSelectorSheet.tsx:107`; `components/share/StyleEditorialMorphPreview.tsx`; `components/v2/home/V2HomeCategoryEnvironment.tsx:36-47`
- **Recommended solution:** Ship `*-thumb` derivatives at 2x the largest display size (polaroid ~560x373 JPEG q85, ~30 KB); for remote avatars return a 256 px thumbnail (PERF-049) or set `resizeMethod="resize"`; bundled images need pre-sized files. If `V2HomeCategoryEnvironment` is revived: mount active + neighbours only.
- **Visual preservation:** Equivalent when thumbs are >= 2x displayed pixels at the highest density; keep full-res where drawn full-bleed.
- **Risk:** Low.
- **Verification:** Graphics memory on that step; screenshot diff at 3x.

### PERF-027  [P2] Presigned URLs change on every read so image caches never hit; private objects carry `Cache-Control: private, no-store`
- **Issue ID:** PERF-027 (raw: D-02)
- **Screen / System:** Image URLs (Home hero, Details, Vision board, Share Studio; backend `StorageService`)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Artwork and photos are re-downloaded after each launch/refresh; blank or blur frames before art appears; `Image.prefetch` on one read model is wasted when the next read returns different URLs.
- **Reproduction:** Cold launch twice with network logging: same Anchor art with a different `X-Amz-Date`/`X-Amz-Signature`; pull-to-refresh Vision and diff `resolvedImageUrl`.
- **Measurements:** None collected. Facts: `GET /api/anchors` re-signs every `enhancedImageUrl` per request (7-day expiry, `anchors.ts:346-347`); Vision reads re-sign per read (3600 s, `StorageService.ts:281-308`, `VisionService.ts:122-124,496,568`); `buildSignedObjectUrl` signs with the current time; no stable cache key in mobile; private vision uploads stored with `no-store` (`StorageService.ts:467`).
- **Likely root cause:** SigV4 presign uses the current timestamp. Confidence high.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `backend/src/services/StorageService.ts:132-150, 248-308, 467`; `backend/src/api/routes/anchors.ts:318-358`; `backend/src/services/v2/VisionService.ts:122, 496, 568, 680`; `hooks/v2/home/useHomePrewarm.ts`
- **Recommended solution:** Sign with a `signingDate` floored to UTC midnight or a 6 h bucket and 7-day `expiresIn`, so the URL is byte-identical within the bucket; set private-asset `CacheControl` to `private, max-age=31536000, immutable` (keys are unique per upload).
- **Visual preservation:** Same bytes, fewer fetches; removes blank-then-fade flashes.
- **Risk:** Low. Longer-lived Vision URLs widen leak exposure from 1 h to up to 7 days (anchor art is already 7 days); if unacceptable use 1-day expiry floored to 6 h.
- **Verification:** Two reads in the same bucket return identical URLs; second cold launch makes 0 image requests for unchanged art.

### PERF-028  [P2] Bundled 192 kbps "V4" mixes (95.9 MB) undid the 10-07 remote-audio / 128 kbps work; six `REMOTE_AUDIO_TRACKS` entries are now dead
- **Issue ID:** PERF-028 (raw: D-03, B-20(b))
- **Screen / System:** App binary / OTA size (Focus, Deep Focus, Visualize audio)
- **Severity:** P2
- **Evidence type:** Measured on disk (asset/bundle facts)
- **Symptoms:** Larger APK/IPA and OTA payloads; slower install and update; larger EAS archive.
- **Reproduction:** Compare `expo export` asset size: `dist/assets` was 76 MB on 2026-10-09, before commit `e3362c9e` (2026-10-10, "update session audio mix tracks to v4").
- **Measurements:** Measured on disk: 18 files under `focus-mix/` and `visualize/guided/` total 95.9 MB at 192 kbps; six of them (DeepFocus 5 min x2, 10 min x2, Embody 10 min x2 = 72.7 MB) are also in `REMOTE_AUDIO_TRACKS` yet are `require()`d locally; static literal-require total 160.8 MB (mp3 216 files / 111.8 MB). No fresh export was run.
- **Likely root cause:** New mixes delivered as bundled assets; manifest synced to local requires. Confidence high. Whether bundling was a deliberate offline choice is unknown.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `services/SessionAudioManifest.ts:62-98, 229-232`; `services/visualizeGuidedTracks.ts:3-18`; `services/audio/remoteAudio.ts:22-30`; `.easignore`
- **Recommended solution:** Move the six long mixes (optionally Immerse 3 min, 9.6 MB) back to the remote pipeline (`backend/scripts/upload-remote-audio.mjs`) and delete the local files, keeping <= 60 s mixes bundled; or, if offline reliability is intended, re-encode to 128 kbps CBR as on 10-07 (about -32 MB) after confirming beat-map durations are unchanged.
- **Visual preservation:** Audio content unchanged; 128 kbps CBR was accepted on 10-07.
- **Risk:** Medium: 10-minute Visualize Begin is gated on download in the remote design; first offline use needs a prior download; hash and duration verification required.
- **Verification:** `expo export` asset size before/after; ffprobe durations equal; guided playback and beat-map tests pass.

### PERF-029  [P2] authStore writes its whole persisted blob to SecureStore on every `set()` (no debounce, no dedupe)
- **Issue ID:** PERF-029 (raw: D-04)
- **Screen / System:** `authStore` persistence
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Extra native bridge traffic and Keystore AES work during launch; possible dropped frames at the splash-to-Home hand-off; every auth write also re-renders `RootNavigator` (PERF-089).
- **Reproduction:** Dev build with `perfLog`: count `persist-setItem` for `anchor-auth-storage` between launch and Home idle.
- **Measurements:** Estimate, not measured: `writeSecureValue` = 2N + 3 native calls (N = ceil(chars/1800)); for an 8-20 KB blob that is ~13-27 calls x 7-10 launch-path writes = ~90-270 calls.
- **Likely root cause:** `encryptedAuthStorage.setItem` (`authStore.ts:212-228`) bypasses the debounced, deduped `encryptedPersistStorage` (`:173-196`); 43 `set(` sites plus 10 external `setState`. Confidence medium-high.
- **Root-cause cluster:** RC-1, Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths
- **Relevant files:** `stores/authStore.ts:190-232, 1101-1137`; `stores/encryptedPersistStorage.ts:80-135, 173-258`
- **Recommended solution:** Route `encryptedAuthStorage.setItem` through the same `scheduleWrite` (300-400 ms debounce, trailing flush on AppState background and before sign-out); skip unchanged chunks and delete only chunks beyond the new count; persist `profileData` only on change or stop persisting it.
- **Visual preservation:** None.
- **Risk:** Medium: auth persistence must flush before process death; `AuthHydrationService.test.ts` is already failing (10-07 note), add coverage.
- **Verification:** Count native SecureStore calls during launch (from ~100+ to < 20); session restores after kill and relaunch.

### PERF-030  [P2] Full account export every launch, two overlapping anchor-list calls, no response compression, 100 requests / 15 min limiter
- **Issue ID:** PERF-030 (raw: D-06)
- **Screen / System:** Launch network fan-out; backend rate limiter
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Slow first sync on large accounts; Home data arrives late; 429 "Too many requests" after ordinary use; Vision-generation polling errors after a few minutes (promoted to P1 whenever 429 reproduces; the dev notes already record a reload-to-429).
- **Reproduction:** Launch with a network log: `/api/auth/sync`, `/api/auth/me`, `/api/anchors?limit=20`, `/api/anchors?limit=100`, `/api/auth/me/export`, then Home prefetch for up to 3-4 Anchors. Count requests per launch and per swipe.
- **Measurements:** None collected (constants read from source). `fetchCompleteProfile()` plus `AuthHydrationService.ts:672-676` request the anchor list twice (each re-signing URLs); `/api/auth/me/export` is requested on every hydration (`:745`) and runs 14 parallel unbounded Prisma queries duplicating activations/charges (`auth.ts:627-730`); no `compression` middleware in `backend/package.json` or `index.ts`; axios default timeout 120 s, no retry layer; limiter `max: 100` per 15 min per uid (`index.ts:257-273`); Vision polling every 2.5 s = 24 req/min per generation; two `verifyIdToken` passes per request.
- **Likely root cause:** The export endpoint was reused as a hydration source; the limiter was sized for abuse control, not a chatty mobile client. Confidence high.
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `services/AuthHydrationService.ts:655-770`; `services/ApiClient.ts:22-28, 372-396`; `backend/src/api/routes/auth.ts:627-730`; `backend/src/index.ts:239-273`; `backend/src/api/middleware/auth.ts`
- **Recommended solution:** (1) Pass the already-fetched anchors into `fetchCompleteProfile`. (2) Take `/me/export` off the launch path (after Home is interactive, at most once per N hours) or add a `?since=` delta; at least drop the duplicated nested activations/charges. (3) Add gzip `compression()`. (4) Split limiters: reads 600+/15 min, writes and AI strict, polling GETs in their own bucket. (5) Per-call timeouts (15-20 s reads) and one jittered retry for idempotent GETs. (6) Verify the token once per request.
- **Visual preservation:** None.
- **Risk:** Medium for the export change (the client uses it for practice-history migration; keep a forced path).
- **Verification:** Launch request count and bytes before/after; `Content-Encoding: gzip`; no 429 in a 30-minute scripted session.

### PERF-031  [P2] Home prewarm re-requests the Chart for every neighbour on each swipe; its abort can cancel shared in-flight requests; every publish rewrites the Chart blob to SecureStore
- **Issue ID:** PERF-031 (raw: D-07)
- **Screen / System:** Home prewarm / Chart cache
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Network and CPU churn on every swipe; adds to 429 pressure; Chart subscribers re-render on identical refetches; possible spurious error on the Home Vision tile if its shared request is aborted.
- **Reproduction:** Home with >= 3 Anchors, swipe through with a network log.
- **Measurements:** None collected. `warmAnchor` calls `loadAnchorChart(id)` unconditionally (`useHomePrewarm.ts:66`); only in-flight dedupe, no freshness check (`useAnchorChart.ts:91-110`); `publish` notifies with a new object and no deep-equal (`:38-45`, Vision has `sameVision`); effect deps `[anchors, selectedIndex]` (`:90`), `anchorList` rebuilt on selection/practice history (`useV2HomeModel.ts:336-343`); cleanup `controller.abort()` (`:84-88`) aborts the signal passed to `prefetchV2Vision`, which shares `inFlightVision` with mounted `useV2Vision` hooks.
- **Likely root cause:** Missing freshness check (confidence high); abort side effect (medium).
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `hooks/v2/home/useHomePrewarm.ts:18-91`; `hooks/v2/chart/useAnchorChart.ts:36-110`; `hooks/v2/vision/useV2Vision.ts:154-210`
- **Recommended solution:** 60-120 s TTL + `peekAnchorChart` check before `loadAnchorChart` in prewarm; skip `publish` when version/`updatedAt` is unchanged; do not pass the effect-scoped abort signal into shared in-flight requests.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Swipe 10 times: Chart GETs drop from ~30 to <= 3; no listener re-render when the payload is unchanged.

### PERF-032  [P2] Visualize cinematic fetches each photo up to three times
- **Issue ID:** PERF-032 (raw: D-09)
- **Screen / System:** Visualize prepare / cinematic assets
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Longer "preparing" phase on a Vision with 6-8 photos; three HTTP fetches per image over non-cache-stable presigned URLs; 20 s timeout then a partial film; photos above 2048x2048 are dropped.
- **Reproduction:** Open Visualize on a Vision with 6-8 photos with a network log.
- **Measurements:** None collected. Per source: `Image.getSize(url)`, `Image.prefetch(url)` and Skia `useImage(url)` (a separate `Skia.Data.fromURI` fetch) (`cinematicAssets.tsx:40-47, 96-115`); `MAX_CINEMATIC_TEXTURE_PIXELS = 2048*2048` = 16 MiB decoded.
- **Likely root cause:** Each API uses a different cache. Confidence medium.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `screens/v2/practice/visualize/cinematicAssets.tsx:8-133`; `screens/v2/practice/visualize/V2VisualizePrepareScreen.tsx:110-120`
- **Recommended solution:** Download once to the app cache keyed by assetId (assets are immutable) with `FileSystem.downloadAsync`, feed the local `file://` URI to `getSize` and Skia, drop `Image.prefetch`. Pairs with PERF-009 and PERF-027.
- **Visual preservation:** Identical pixels.
- **Risk:** Low-medium.
- **Verification:** One network fetch per photo per install; prepare time on a 6-photo Vision.

### PERF-033  [P2] Release "confirming" state can lock the screen for up to 120 s with no exit
- **Issue ID:** PERF-033 (raw: C-05)
- **Screen / System:** Release (`V2ReleaseScreen`, `useV2Release`)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** After the hold completes and the dissolution ends, if the network hangs the screen sits in "confirming" with hardware back, edge swipe and `beforeRemove` blocked and no button until the request ends.
- **Reproduction:** Throttle the API so `POST /api/v2/anchors/:id/release` hangs.
- **Measurements:** None collected. `stage` is `confirming` while `submissionState` is `submitting`/`pending` after `dissolutionDone` (`useV2Release.ts:229-236`); `locked = dissolving || confirming` (`V2ReleaseScreen.tsx:127`) installs `beforeRemove.preventDefault`, hardware-back `true` and `gestureEnabled:false` (`AnchorV2Navigator.tsx:351-377`); shared `apiClient` timeout is 120 s (`ApiClient.ts:25`); the retry button appears only after the failure.
- **Likely root cause:** A locked state whose only exit is the end of a long request. The server and key are idempotent, so a short timeout and re-submit is safe. Confidence medium-high.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `hooks/v2/release/useV2Release.ts:131-157, 229-236`; `screens/v2/release/V2ReleaseScreen.tsx:127-128`; `navigation/v2/AnchorV2Navigator.tsx:351-377`; `adapters/v2/release/releaseApiAdapter.ts:33-52`
- **Recommended solution:** 15 s timeout on the release POST so the existing `pending`+`retryable` result drives the existing retry UI; reconcile on AppState active (already present); after N seconds offer "Continue, we will finish confirming" while the idempotent retry continues in the background.
- **Visual preservation:** Ceremony and `V2ReleaseChamberStatus` untouched; only the timing of the existing retry affordance changes.
- **Risk:** Medium: release is terminal; rely on the server idempotency key.
- **Verification:** Jest on the adapter with a delayed mock; device with throttled API.

### PERF-034  [P2] Anchor create/seal can freeze for minutes; creation back is locked meanwhile
- **Issue ID:** PERF-034 (raw: C-07)
- **Screen / System:** Creation seal / `useSaveAnchor`
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** On a slow or dead connection after sealing, the medallion sits still (hairline after 1.5 s) with back locked; worst case ~2 x 120 s + 500 ms.
- **Reproduction:** Throttle `POST /api/anchors`.
- **Measurements:** None collected. `useSaveAnchor` posts via `apiClient` (120 s) and retries once after 500 ms on "Network error" (`:~296-326`); `sealing = choose.phase !== 'choosing'` disables `goBack` and hardware back (`AnchorCreationFlowScreen.tsx:1096-1110`).
- **Likely root cause:** Default client timeout (PERF-040) plus a retry that doubles it. Confidence medium.
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `hooks/useSaveAnchor.ts:233-356`; `screens/create/flow/AnchorCreationFlowScreen.tsx:806-840, 1096-1110`; `services/ApiClient.ts:25`
- **Recommended solution:** 20-30 s timeout on the create POST (the idempotency key makes re-send safe), keep the key stable across the in-flow retry, offer the existing "try again" path rather than a silent wait. Combine with PERF-008.
- **Visual preservation:** Seal animation unchanged.
- **Risk:** Medium.
- **Verification:** Throttled-network device run; jest with fake timers on `useSaveAnchor`.

### PERF-035  [P2] Pending first-anchor finalization POST has no idempotency key
- **Issue ID:** PERF-035 (raw: C-09)
- **Screen / System:** Guest-to-account finalization (`authStore.finalizePendingFirstAnchorDraft`)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** If the create response is lost after the server committed, the retry POSTs again: a Pro/trial user gets a duplicate Anchor; a free user gets `CREATE_ANCHOR_FREE_LOCKED` and the "already used its free Anchor" paywall copy though their Anchor exists.
- **Reproduction:** Lose the create response (timeout, or kill between response and `persistPendingDraftProgress`), then retry.
- **Measurements:** None collected.
- **Likely root cause:** `buildAnchorCreatePayload` omits the key although the server supports `Anchor.idempotencyKey @unique` (`authStore.ts:289-304, 753-756, 920-935`); `services/v2/creationPersistence.ts` does send one. Confidence high.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `stores/authStore.ts:289-304, 753-756, 920-935`
- **Recommended solution:** Add a stable key derived from `pendingFirstAnchorDraft.tempAnchorId`; wrap `isFinalizingPendingFirstAnchor` in try/finally.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Jest asserting the key in the POST body; replay returning the existing Anchor.

### PERF-036  [P2] No connectivity listener; V2 never drains the practice/scene write queues
- **Issue ID:** PERF-036 (raw: C-10)
- **Screen / System:** Offline/reconnect write queues (V2)
- **Severity:** P2
- **Evidence type:** Code-verified (deterministic: grep / call chain read by the lead)
- **Symptoms:** A session completed offline stays in `anchor:practice-write-queue:<account>` with `syncState:'failed'`; in V2 it is retried only when another session completes, so server thread strength, streak and progress lag.
- **Reproduction:** Complete a session offline, reconnect, wait.
- **Measurements:** Verified by grep: no NetInfo in `package.json` or source; `flush` is called only from `MainTabNavigator.flushPracticeWrites` (legacy, `:228-236`), `BurningRitualScreen`, and right after a completion (`V2PracticeSessionScreen.tsx:200, 446`). Related (medium): `flush` is read-modify-write on SecureStore with no mutex (`PracticeCompletionService.ts:312-360`): a slow flush A that read `[S1]` can write `[]` after completion B queued `[S1,S2]`.
- **Likely root cause:** `AnchorV2Navigator` has no equivalent of the legacy drain. Confidence high.
- **Root-cause cluster:** RC-1, Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths
- **Relevant files:** `services/PracticeCompletionService.ts:312-360`; `services/VisualizationSceneService`; `navigation/MainTabNavigator.tsx:228-236`; `navigation/v2/AnchorV2Navigator.tsx`
- **Recommended solution:** A small `useQueueDrain` effect in `AnchorV2Navigator`/App that flushes after auth, on AppState active and on a connectivity signal (`@react-native-community/netinfo` or a failed-then-success heuristic); serialise `flush` with a module promise chain like `NotificationCoordinator.runExclusively`.
- **Visual preservation:** None.
- **Risk:** Low-medium.
- **Verification:** Jest with fake timers: one failed record, AppState active, expect one POST; interleaved-flush concurrency test.

### PERF-037  [P2] Store success can dead-end ("still being confirmed"); dismiss is not disabled while a purchase runs
- **Issue ID:** PERF-037 (raw: C-11)
- **Screen / System:** Paywall (`useV2Paywall`, `V2PaywallScreen`)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** (a) After a store transaction where `hasActiveEntitlement` is still false (RevenueCat propagation, Android pending purchase) the user stays on the paywall though the global listener unlocks the store moments later; they must Restore or leave. (b) The step-1 "Maybe later"/X is not disabled while `controller.busy`; if used mid-purchase, `onEntitled` later runs on a removed route and `navigate(resume...)` opens practice/creation the user already left.
- **Reproduction:** Simulate `purchasePackageByIdentifier` returning `hasActiveEntitlement:false` then a store flip; tap Maybe later during a purchase.
- **Measurements:** None collected. No consumer of `isActiveSubscriber` in `components/v2/paywall` or `screens/v2/paywall`.
- **Likely root cause:** No reaction to an entitlement change after an "unconfirmed" outcome; dismissal not gated on `busy`. Confidence medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `hooks/v2/paywall/useV2Paywall.ts:134-205`; `navigation/v2/AnchorV2Navigator.tsx:58-102`; `screens/v2/paywall/V2PaywallScreen.tsx:458, 571`
- **Recommended solution:** After the unconfirmed outcome subscribe once to `useSubscriptionStore.hasActiveEntitlement` (30-60 s cap) and call `finishEntitled` when it flips; disable dismiss while `busy`, or have `handleEntitled` check `navigation.isFocused()` before resuming.
- **Visual preservation:** None (the disabled state already exists for the CTA).
- **Risk:** Low.
- **Verification:** Jest simulating the unconfirmed outcome then a store flip.

### PERF-038  [P2] One whole-app boundary with legacy styling; "Try Again" remounts the entire tree and loses navigation and in-flight state
- **Issue ID:** PERF-038 (raw: C-13)
- **Screen / System:** Error boundary (`components/ErrorBoundary.tsx`, `App.tsx:1011`)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** A render error in any screen replaces the whole app with a dark legacy card; "Try Again" bumps `childKey`, dropping navigation state and in-flight creation/seal state, and persisted data can immediately re-trigger the same error with no escape. Splash-tree errors are uncontained; async/handler errors never reach it.
- **Reproduction:** Throw in a screen render in `__DEV__`; tap Try Again.
- **Measurements:** None collected.
- **Likely root cause:** Single root boundary only (`ErrorBoundary.tsx:48-55, 110`). Confidence medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `components/ErrorBoundary.tsx`; `App.tsx:1011`
- **Recommended solution:** Route-level boundaries around volatile screens (creation flow, Home, practice session, Release) with a V2-styled fallback offering "Back to Home" via `navigation.reset`; keep the root boundary as last resort; offer a safe-mode action after N consecutive resets that clears only volatile caches (not the vault).
- **Visual preservation:** Existing screens unchanged; the fallback is a new surface in V2 colours.
- **Risk:** Low.
- **Verification:** Jest rendering a throwing child; manual throw in `__DEV__`.

### PERF-039  [P2] Hydration commit can overwrite newer local state (create/release during an in-flight hydration)
- **Issue ID:** PERF-039 (raw: C-15)
- **Screen / System:** Auth hydration (`AuthHydrationService`)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** An Anchor created or released while hydration is in flight can vanish or revert until the next sync. Hydration runs in the background after the shell shows and again after every interactive sign-in.
- **Reproduction:** Slow `/api/auth/me/export` or profile call; create or release an Anchor meanwhile.
- **Measurements:** None collected. The early commit builds `nextAnchors = [...fastAnchors, ...preservedLocalAnchors]` keeping only non-backend ids (`AuthHydrationService.ts:696-708`); the final commit (`:931-984`) replaces again from `remoteAnchors` captured before the user acted.
- **Likely root cause:** No per-anchor `updatedAt`/revision comparison and no "locally mutated since request start" guard. Confidence medium.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `services/AuthHydrationService.ts:696-708, 931-984`; `App.tsx:539-549`
- **Recommended solution:** Snapshot a mutation counter (or `updatedAt` per id) at request start; on commit keep local anchors that are newer or appeared after the snapshot.
- **Visual preservation:** None.
- **Risk:** Medium: core store merge.
- **Verification:** Jest simulating a release during a pending hydration.
- **Remediation note (2026-10-12 continuation):** Confirmed as a Class A defect in `AuthHydrationService.ts` alongside the destructive `isLockedFreeUser` local-anchor purge (`7b3a9315`) and empty-array fallback on rejected `/api/anchors`. Updated `AuthHydrationService.hydrateAuthenticatedData` to remove the `isLockedFreeUser` deletion, preserve local non-UUID Anchors and in-flight created backend Anchors (`initialBackendAnchorIds`), merge local Anchors with newer `updatedAt` timestamps over stale server snapshots, and retain existing current-account backend Anchors plus `remoteAnchorState: 'error'` when `/api/anchors` fails without export/snapshot recovery. Verified by `AuthHydrationService.test.ts` (17/17 passing) and 11 related auth/startup/onboarding suites (174/174 total tests passing); physical runtime re-verification remains pending.

### PERF-040  [P2] Every request defaults to a 120 s timeout; 401 has no recovery; slow and offline are indistinguishable
- **Issue ID:** PERF-040 (raw: C-22)
- **Screen / System:** `ApiClient` (all requests)
- **Severity:** P2
- **Evidence type:** Code-verified (deterministic: grep / call chain read by the lead)
- **Symptoms:** Amplifies PERF-033, PERF-034 and PERF-005: any hung call waits two minutes; timeouts and offline both surface as "Network error. Please check your connection."
- **Reproduction:** Hang any endpoint.
- **Measurements:** Verified by grep: `timeout: 120000` (`ApiClient.ts:25`), only `/api/ai/enhance` overrides it (180 s); a 401 without a body throws a plain `Error('Session expired...')` (`:236-239`) with no refresh or sign-out path, so creation maps it only via a regex (`creationPersistence.classifySaveFailure`).
- **Likely root cause:** A single default sized for generation endpoints. Confidence high.
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `services/ApiClient.ts:22-28, 236-239`
- **Recommended solution:** Default 20-30 s, explicit longer values on generation/export; distinguish `ECONNABORTED` from offline in the error; on 401 force one `getIdToken(true)` retry then route to sign-in. Roll out per endpoint.
- **Visual preservation:** None.
- **Risk:** Medium: affects all callers.
- **Verification:** Axios mock-adapter tests per code.

### PERF-041  [P2] Looped pool cues (`formBed`, `sealRise`) playing at background time are revived natively and orphaned
- **Issue ID:** PERF-041 (raw: B-02)
- **Screen / System:** `SoundPool` looped cues (Android)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Background during the Form bed (or a seal-rise loop), return later: the bed starts again by itself even after the flow has moved on, looping until the key is next played or disposed.
- **Reproduction:** Android, creation flow, background during "Forming" while generation runs, return after it finishes; listen on the Choose screen.
- **Measurements:** Library source read, not reproduced.
- **Likely root cause:** Same native hook as PERF-010 (`AudioModule.kt:217-248`): `stop(300)` ends in `releaseEntry` -> `player.pause()` but the native `isPaused` flag stays; the pool thinks the entry is idle (`SoundPool.ts:197-206` reacts only to `didJustFinish`/`idle`). Confidence medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/audio/SoundPool.ts:156-167, 197-206`; `screens/create/flow/AnchorCreationFlowScreen.tsx:349-363`; `components/v2/vision/ceremony/VisionCeremony.tsx:191-195`; `screens/create/flow/useChooseController.ts:197-199, 230-235`
- **Recommended solution:** In the pool status listener: `if (status.playing && !entry.busy) entry.player.pause()`; add an AppState `active` pass that pauses every non-busy entry; optionally discard looping busy entries on background.
- **Visual preservation:** No cue changed; the bed still restarts through its existing foreground paths.
- **Risk:** Low (`busy=true` is set before `play()`).
- **Verification:** Android as reproduced; `sfxLog` count of `playing && !busy` players after foreground should be 0.

### PERF-042  [P2] No audio focus and no "becoming noisy" handling: calls, other media and headphone unplug do not pause narration
- **Issue ID:** PERF-042 (raw: B-03)
- **Screen / System:** Session audio focus (Android)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Unplug earbuds or lose Bluetooth mid-session and the narration plays from the loudspeaker; an incoming call or another media app does not pause the session; Visualize's interruption detection can never fire. iOS is handled by the library.
- **Reproduction:** Android, Visualize Immerse with earbuds, unplug; start a podcast in another app while a session plays.
- **Measurements:** Library source read, not device verified.
- **Likely root cause:** `AudioSession.ts:16-22` always sends `interruptionMode: 'mixWithOthers'`; on Android `requestAudioFocus()` returns immediately for it (`AudioModule.kt:119`), the ExoPlayer is built with `setAudioAttributes(DEFAULT, false)` (`AudioPlayer.kt:46`), and `setHandleAudioBecomingNoisy` is never set. Confidence high.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/audio/AudioSession.ts:16-22`; `visualize/guided/useGuidedPlayback.ts:105-111`; `node_modules/expo-audio/android/.../AudioModule.kt:119, 184-193`; `AudioPlayer.kt:46`
- **Recommended solution:** For mode `session` use `doNotMix` on Android (focus requested on first `play()`, loss pauses, regain resumes; the PERF-010 guard keeps Paused authoritative); keep `effects` as `mixWithOthers`; add becoming-noisy via a `patch-package` patch or a JS route listener (no JS API in 1.1.1). Decide separately whether iOS session mode should stop mixing.
- **Visual preservation:** Sessions sound identical; they additionally pause when the system takes the audio.
- **Risk:** Medium: `doNotMix` stops the user's own music when a session starts (conventional for meditation, but a behaviour change); SFX played in `session` mode would also take focus.
- **Verification:** Android hardware: call, Assistant, YouTube, earbud unplug, BT off; confirm Paused overlay and a held audio position.

### PERF-043  [P2] Ambient toggle does nothing in Visualize, and "Ambient: Off" is ignored in Focus/Deep Focus when a voice is selected
- **Issue ID:** PERF-043 (raw: B-04)
- **Screen / System:** Practice audio sheet (Visualize, Focus, Deep Focus)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Visualize with voice "No guidance" and ambient On is silent (the guided mix plays at volume 0 as the clock); with a voice the mix always carries its bed. Focus 10/30/60 s and Deep Focus 2/5/10 min with a voice ignore ambient Off; voice Off + ambient On plays the separate track.
- **Reproduction:** Open each prepare screen, set the combinations, begin, listen.
- **Measurements:** None collected (code read).
- **Likely root cause:** Visualize passes `muted: voice === 'none'` only (`V2CinematicSessionScreen.tsx:223`) and uses `ambient` for analytics; for mixes `resolveSessionAudioPlan` sets `ambientTrack=null` when `voiceIncludesBed` (`SessionAudioManifest.ts:468-476`) but the sheet offers both options (`V2PracticeAudioSheet.tsx:82, 179-197`). Confidence high. Product decision needed.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `components/v2/practice/V2PracticeAudioSheet.tsx:82, 179-197`; `services/SessionAudioManifest.ts:468-476`; `screens/v2/practice/visualize/V2CinematicSessionScreen.tsx:175, 223`; `screens/v2/practice/V2PracticeSessionScreen.tsx:355-392`
- **Recommended solution:** Make the UI honest first: disable/annotate the ambient row when the selected voice's track `includesBed` ("Music is part of this guidance") and collapse voice+ambient in Visualize; for "No guidance + ambient" either play a bed-only asset (needs a render) or hide the option for Visualize. Do not silently drop the setting.
- **Visual preservation:** Existing tracks unchanged.
- **Risk:** Low for UI; medium if bed-only playback is added (own clock tolerance).
- **Verification:** Jest on the sheet for each (voice, ambient, session) combination; manual listen test.

### PERF-044  [P2] Sound off then on desyncs the full-length narration mix (resumes behind the session clock)
- **Issue ID:** PERF-044 (raw: B-05)
- **Screen / System:** Focus / Deep Focus Sound toggle
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Mute for 60 s mid-session and unmute: narration continues from where it paused, 60 s behind the clock and visuals, and the clock ends the session while the narration is mid-sentence.
- **Reproduction:** Deep Focus 2 min with Lina, Sound off at ~20 s, on at ~60 s.
- **Measurements:** None collected.
- **Likely root cause:** Off = `pause()`, On = `play()` on the same player with no `seekTo(clockElapsed)` (`V2FocusActiveScreen.tsx:637-648`, `V2DeepFocusActiveScreen.tsx:205-212`); the "seeks to the clock" comment applies only when no player exists yet. Confidence high.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `screens/v2/practice/focus/V2FocusActiveScreen.tsx:637-648, 239-266`; `screens/v2/practice/deepFocus/V2DeepFocusActiveScreen.tsx:205-212`; `useDeepFocusSession.ts:38-39`
- **Recommended solution:** On un-mute `seekTo(readElapsed())` before `play()`, or mute with `setVolume(0)` (a 20 ms ramp) so the bed keeps its position with no seek.
- **Visual preservation:** All audio kept; nothing shortened.
- **Risk:** Low.
- **Verification:** Unit test with a fake player recording `seekTo`; manual mute/unmute check against on-screen phases.

### PERF-045  [P2] Toggling Sound in the Paused overlay starts audio while paused
- **Issue ID:** PERF-045 (raw: B-06)
- **Screen / System:** Focus Paused overlay
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Pause, tap Sound off then on: the bed and narration play while the clock is stopped and the screen says Paused; Resume then calls `play()` again (no-op) with the narration ahead of the clock.
- **Reproduction:** Focus, pause, toggle Sound off/on.
- **Measurements:** None collected.
- **Likely root cause:** `toggleSound` calls `play()` unconditionally on enable (`V2FocusActiveScreen.tsx:637-648, 951-958`); Deep Focus guards with `state === 'running'` (`V2DeepFocusActiveScreen.tsx:208`). Confidence high.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `screens/v2/practice/focus/V2FocusActiveScreen.tsx:637-648, 951-958`
- **Recommended solution:** `if (next && !isPaused)`; when paused only update `soundEnabled`; `resumeSession` already plays when enabled. Combine with PERF-044.
- **Visual preservation:** Unchanged.
- **Risk:** Very low.
- **Verification:** RNTL: pause, toggle off/on, expect no `play()`.

### PERF-046  [P2] A pooled player keeps the previous play's playback rate, so default plays come out at a stale pitch
- **Issue ID:** PERF-046 (raw: B-07)
- **Screen / System:** `SoundPool` playback rate (creation `distillTick` ladder, chart one-shots)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** On a second creation run the first landing (index 0, rate 1) plays at whatever rate the idle entry last had; chart cues of the same key are jittered.
- **Reproduction:** Run creation twice; listen to the first `distillTick`.
- **Measurements:** None collected.
- **Likely root cause:** `if (rate !== 1) setPlaybackRate(...)` only, no else, and `Entry` does not remember the last rate (`SoundPool.ts:384-395`); `CreationStage.tsx:417-419` plays the ladder 1.0-1.48 in 0.06 steps while other callers expect rate 1. Confidence high.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/audio/SoundPool.ts:384-395`; `components/v2/creation/CreationStage.tsx:417-419, 1206-1210`; `useChartSound.ts:218, 237`
- **Recommended solution:** Track `entry.rate` and call `setPlaybackRate(rate)` whenever it differs, including back to 1; keep `shouldCorrectPitch=false`.
- **Visual preservation:** Restores the intended cue pitches (ladder 1.0-1.48 and `rate` jitter 0.97-1.03 unchanged).
- **Risk:** Low.
- **Verification:** Jest: play with rate 1.3 then 1, assert the second `setPlaybackRate(1)`; listen to a second creation run.

### PERF-047  [P2] Re-triggering a one-entry pooled cue builds a cold temporary player instead of reusing the oldest
- **Issue ID:** PERF-047 (raw: B-08)
- **Screen / System:** `SoundPool` overflow policy (node tones, chart/thread/release cues)
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** A second play of a pooled cue while the first is still sounding creates a new player that must load before `play()` (up to `LOAD_TIMEOUT_MS` 1500 ms), so the cue is late, or dropped if the load times out.
- **Reproduction:** Two consecutive creation nodes sharing a cell within 0.4 s; quick repeated chart waypoint taps; thread cue overlapping a prior chord.
- **Measurements:** Asset durations measured (node tone 0.4 s, `sk-seal` 1.4 s, `chart-waypoint_n` 2.0 s, `sk-thread-settle` 0.64 s). No latency measured.
- **Likely root cause:** `isPool = entries.length < getMaxPoolSizeForKey(key)`; with max 1 and a busy entry `createEntry(key, !isPool)` returns a temporary entry so the documented reuse branch (`:360-366`) is unreachable; comment at `:85` says it reuses the oldest. Confidence high.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/audio/SoundPool.ts:74-87, 354-366`; `services/audio/__tests__/SoundPool.test.ts` (no retrigger case)
- **Recommended solution:** Encode a per-key policy: percussive/short cues restart the oldest busy entry (`seekTo(0)` + `play()`); cues that must ring out (chords, `seal`, `releaseBurn`) keep an overlap but with a prewarmed second pooled player. Add the missing test.
- **Visual preservation:** Same sounds; retriggers become prompt instead of late.
- **Risk:** Medium: restarting a ringing cue truncates its tail; choose per key.
- **Verification:** Jest for both policies; device `sfxLog` `loadedAtCall`/timestamps.

### PERF-048  [P2] End-of-session truncation of the finished mixes and a nondeterministic completion cue
- **Issue ID:** PERF-048 (raw: B-10)
- **Screen / System:** Focus / Deep Focus session end
- **Severity:** P2
- **Evidence type:** Code suspected
- **Symptoms:** Focus 10 s: the mix is cut at roughly -30 dB instead of finishing its fade, then the cue follows 300 ms later. Deep Focus: the completion cue is skipped in almost every run because `complete()` stops the mix before `onFinish`; occasionally it plays.
- **Reproduction:** Record device output for Focus 10 s and Deep Focus 2 min endings and compare with the asset tail.
- **Measurements:** Asset measured, start latency not measured: `Focus_10s_Dominic_V4.mp3` 10.585 s, `Lina` 10.484 s for a 10 s session; bed fade-out spans the last ~1.2 s (Dominic -26 dB at 8.9 s falling to -73 dB at 10.5 s); the mix starts at the first 250 ms tick after the clock, so at clock end the audio is ~9.5 s in. Deep Focus mixes are exactly 120/300/600 s with 0.33-0.44 s digital silence at the tail. 30/60 s mixes end before the clock (fine).
- **Likely root cause:** The monotonic clock owns the end; audio is a free-running second clock with no offset correction and an unconditional `stop()` (`V2FocusActiveScreen.tsx:522-529`, `V2DeepFocusActiveScreen.tsx:108-121`, `completionCue.ts`). Confidence medium; needs a listening test (the skipped cue may be intended).
- **Root-cause cluster:** RC-6, JS-clock-driven visuals and cues running parallel to UI-thread animation
- **Relevant files:** `screens/v2/practice/focus/V2FocusActiveScreen.tsx:417-444, 522-529`; `screens/v2/practice/deepFocus/V2DeepFocusActiveScreen.tsx:108-121`; `screens/v2/practice/deepFocus/completionCue.ts`
- **Recommended solution:** Fade the mix over 150-300 ms instead of `stop()`, or wait for `onFinish` up to `L + 400 ms`; for Focus 10 s start the mix at activation and fade at the end, or hold the mix through the existing ~2.3 s resolve phase; decide the completion cue deterministically from `onFinish` or a position check.
- **Visual preservation:** Keeps the mix and the cue; the cut becomes a fade.
- **Risk:** Low-medium (cue overlap with the tail; the resolve phase gives room).
- **Verification:** Waveform capture of both endings before/after.

## 8.3  P3 issues

### PERF-049  [P3] Anchor art stored as raw model output (PNG-labelled), no thumbnail or modern format
- **Issue ID:** PERF-049 (raw: D-10)
- **Screen / System:** Anchor art storage (`AIEnhancer.ts:405-421` -> `StorageService.uploadImageFromBuffer`)
- **Severity:** P3
- **Evidence type:** Measured on disk (asset/bundle facts)
- **Symptoms:** 0.75-2.9 MB per art file; list views showing 40 dp avatars download and decode the full 1024x1024.
- **Reproduction:** Compare stored object sizes; open a list view with avatars.
- **Measurements:** Measured on local dev outputs only (`backend/uploads`, newest 400 files): all 1024x1024; 172 true PNG (median 2.39 MB, max 2.95 MB) and 228 JPEG bytes stored under `.png` names/content-type (median 0.89 MB, max 1.40 MB). Production sizes unknown.
- **Likely root cause:** No post-processing between model output and R2. Confidence medium.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `backend/src/services/AIEnhancer.ts:405-421`; `backend/src/services/StorageService.ts:445-480`
- **Recommended solution:** After generation `sharp(buf).webp({lossless:true})` for PNG outputs (pixel-identical, typically 30-50% smaller); keep JPEG outputs as JPEG with the true `ContentType`; write a 256 px thumbnail for list views.
- **Visual preservation:** Lossless WebP is pixel-identical; do not re-encode existing JPEGs.
- **Risk:** Low-medium: verify WebP decode on the iOS minimum.
- **Verification:** Decoded-pixel compare; list-view network bytes.

### PERF-050  [P3] Carousel switching shows jank bursts and slow bitmap uploads
- **Issue ID:** PERF-050 (raw: E-07)
- **Screen / System:** Home carousel
- **Severity:** P3
- **Evidence type:** Runtime observed (gfxinfo/logcat/meminfo, DEBUG build)
- **Symptoms:** Swiping Home's carousel is slightly uneven on first decode of neighbouring heroes; idle Home costs nothing.
- **Reproduction:** 6 slow swipes and 6 fast flicks with gfxinfo.
- **Measurements:** DEV BUILD. Slow swipes: 890 frames, 6.4% janky, p99 109 ms, 29 slow bitmap uploads. Fast flicks: 526 frames, 5.1% janky, p99 109 ms, 10 slow uploads. Home idle 10 s: 1 frame.
- **Likely root cause:** First-time decode/upload of neighbouring hero images during swipes. Confidence low.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `hooks/v2/home/useHomePrewarm.ts`; `components/v2/home/V2HomeAnchorCarousel.tsx`; `components/v2/V2AssetPrewarm.tsx`
- **Recommended solution:** Release-build re-measure; confirm prewarm decodes neighbouring heroes at display size before the swipe.
- **Visual preservation:** Carousel spring (damping 24, stiffness 250, mass 0.75) and gesture constants unchanged.
- **Risk:** Low.
- **Verification:** Same swipe runs on release; slow bitmap uploads per swipe.

### PERF-051  [P3] 120 Hz is requested only in the creation flow (decision item: do not enable app-wide before the per-frame costs are fixed)
- **Issue ID:** PERF-051 (raw: A-10)
- **Screen / System:** Refresh-rate policy (Android)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Creation may render at 120 Hz while Home, Details, Chart, Vision and practice run at the system's adaptive choice, so motion feels different between flows.
- **Reproduction:** Compare the S24 refresh-rate overlay in creation vs Home/Details/Chart.
- **Measurements:** Code fact: `useHighRefreshRate(true, 2600)` has a single caller (`AnchorCreationFlowScreen.tsx:122`); `AnchorDisplayMode.requestHighRefreshRate` sets the highest mode at the current resolution. The S24 panel exposes 10-120 Hz modes; E saw adaptive behaviour and did not force 120 Hz.
- **Likely root cause:** Only one caller. Confidence high on the facts; the effect on perceived smoothness is unmeasured.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `hooks/useHighRefreshRate.ts`; `android/app/src/main/java/com/anchorintentions/app/DisplayModeModule.kt:17-46`; `screens/create/flow/AnchorCreationFlowScreen.tsx:22, 122`
- **Recommended solution:** Fix PERF-013..023 first (a 120 Hz request halves the 8.3 ms budget and will expose them), then request high refresh on motion-heavy routes (Home flight/carousel, Details, Chart, Vision board, Visualize) with the same hook and a restore delay for hand-offs; consider the Android 15 frame-rate-category hint. Never force 30 fps.
- **Visual preservation:** No visual change except smoother motion.
- **Risk:** Medium: battery, thermal, exposes jank.
- **Verification:** Frame-time histogram per screen at 60 vs 120 Hz; 5-minute Chart-idle battery drain.

### PERF-052  [P3] Ring progress restarts an 850 ms ease-in-out every second (stop-start crawl)
- **Issue ID:** PERF-052 (raw: A-12)
- **Screen / System:** Focus progress ring
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** The ring advances in pulses with 150 ms stillness each second; very visible on 10 s sessions (10% per second).
- **Reproduction:** Focus 10 s; watch the thin ring.
- **Measurements:** None collected.
- **Likely root cause:** `useEffect` on `elapsedMs` writes `sessionProgress.value = withTiming(next, {duration:850, easing: gentle})` (`V2FocusActiveScreen.tsx:~215`). Confidence medium-high.
- **Root-cause cluster:** RC-6, JS-clock-driven visuals and cues running parallel to UI-thread animation
- **Relevant files:** `screens/v2/practice/focus/V2FocusActiveScreen.tsx:213-219, 582-612`; `V2FocusField.tsx:145-148`
- **Recommended solution:** On start/resume set `sessionProgress` once to `withTiming(1, {duration: remainingMs, easing: linear})` (as Deep Focus does); `cancelAnimation` on pause and recompute on resume; keep `elapsedMs` state only for the label.
- **Visual preservation:** Ring reaches the same value at the same time; if the stepped look is intentional, skip this item.
- **Risk:** Low.
- **Verification:** 10 s Focus recording: ring progress is linear in time.

### PERF-053  [P3] Release hold fill animates a percentage `width`
- **Issue ID:** PERF-053 (raw: A-13)
- **Screen / System:** Release hold fill
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** A layout pass on the control every frame for the 1.8 s hold, the interaction that must feel exact.
- **Reproduction:** Release screen, hold the button.
- **Measurements:** None collected.
- **Likely root cause:** `fillStyle` animates `width: '${n*100}%'` (`V2HoldToReleaseControl.tsx:37`). Confidence medium.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `components/v2/release/V2HoldToReleaseControl.tsx:36-47, 59`
- **Recommended solution:** Full-width fill with `transformOrigin: 'left'` and `scaleX` (RN 0.81), or `translateX` clipped by the parent (`overflow: hidden` already set).
- **Visual preservation:** Identical fill (parent clips with radius 18).
- **Risk:** Low.
- **Verification:** Frame pacing during the hold; screenshots at 0/50/100%.

### PERF-054  [P3] Burn texture built on the JS thread at 60% of the hold (CPU raster + `readPixels` + a JS pixel loop)
- **Issue ID:** PERF-054 (raw: A-14)
- **Screen / System:** Release burn texture
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** A JS stall around the ignite moment that can delay a haptic tick or the completion handler.
- **Reproduction:** Hold on Release past 60%; profile the JS thread.
- **Measurements:** None collected.
- **Likely root cause:** `createReleaseArtworkImage` rasterises ~732 px, `validateReleaseArtworkImage` reads ~2 MB back and loops ~134k samples in JS, in a `setTimeout(0)` (`V2ReleaseArtwork.tsx:137-160`, `releaseArtworkImage.ts:140-228`). Confidence medium.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `components/v2/release/V2ReleaseArtwork.tsx:137-160`; `components/v2/release/releaseArtworkImage.ts:140-228`; `screens/v2/release/V2ReleaseScreen.tsx:335`
- **Recommended solution:** Prepare when the screen settles (idle after mount) instead of inside the hold, or validate by sampling a small centre rect.
- **Visual preservation:** Invisible work.
- **Risk:** Low.
- **Verification:** JS busy time around 60% hold before/after.

### PERF-055  [P3] Registers two `useAnimatedStyle` hooks and a shared value per instance even when no entrance is used
- **Issue ID:** PERF-055 (raw: A-15)
- **Screen / System:** `CircularAnchorRenderer` (every Anchor disc)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Extra mount time and memory in lists and carousel slot mounts; each flight mounts two copies.
- **Reproduction:** Mount the Anchor library/switcher with many Anchors; profile mount.
- **Measurements:** None collected.
- **Likely root cause:** `useSharedValue(1)` + `groundStyle`/`developStyle` always run (`CircularAnchorRenderer.tsx:70-112`). Confidence medium.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `components/v2/anchor/CircularAnchorRenderer.tsx:70-90, 100-112`
- **Recommended solution:** Split into a plain renderer and an `EntranceCircularAnchor` used only by the Home hero, same markup.
- **Visual preservation:** Identical.
- **Risk:** Low.
- **Verification:** Library mount time with 20 Anchors; hook count in React Profiler.

### PERF-056  [P3] `carouselMoving`/`homeMotionActive` state re-renders Home at drag start and rest solely to gate the teaching queue
- **Issue ID:** PERF-056 (raw: A-16)
- **Screen / System:** Home
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** An extra Home re-render at carousel drag activation and again at rest, and at every `homeMotionActive` flip.
- **Reproduction:** React Profiler on Home while swiping.
- **Measurements:** None collected.
- **Likely root cause:** Two `useState` flags feed `homeIsIdle` for `useTeachingQueue` (`V2HomeScreen.tsx:124-125, 474-480`); sections are memoised, the cost is the Home body. Confidence medium.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `screens/v2/home/V2HomeScreen.tsx:124-125, 474-480`
- **Recommended solution:** Keep both flags in refs plus a small store read only by `useTeachingQueue`.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Profiler render count per swipe.

### PERF-057  [P3] JS `onScroll` every 16 ms and a scroll-begin re-render
- **Issue ID:** PERF-057 (raw: A-17)
- **Screen / System:** Progress
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** One JS event per frame while scrolling and a full screen re-render at drag begin and momentum begin/end.
- **Reproduction:** Progress, scroll with the profiler. (E measured Progress scroll at 10.9% janky, p50 12 ms, dev build.)
- **Measurements:** None collected.
- **Likely root cause:** `onScroll` with `scrollEventThrottle={16}` writes a ref (`V2ProgressScreen.tsx:170`); `setScrolling` re-renders to feed `teachingQueue.blocked` (`:172-175`). Confidence medium.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `screens/v2/progress/V2ProgressScreen.tsx:98, 170-175`
- **Recommended solution:** `useAnimatedScrollHandler` writing a shared value (as Home does) and a ref-based flag for the teaching queue.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** JS event count while scrolling.

### PERF-058  [P3] Full 1080x1920 export tree mounts 350 ms after every layout switch while previewing
- **Issue ID:** PERF-058 (raw: A-18)
- **Screen / System:** Share Studio
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** A hitch ~350 ms after each layout switch or mark toggle; ~8 MB bitmaps plus layout.
- **Reproduction:** Open Share Studio, flip layouts.
- **Measurements:** None collected.
- **Likely root cause:** `prepare(layout, showMark)` debounce 350 ms (`AnchorShareStudio.tsx:60-69`; `useShareExportRenderer.tsx:73-115`). Confidence medium.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `components/share/AnchorShareStudio.tsx:60-69`; `components/share/useShareExportRenderer.tsx:73-115`
- **Recommended solution:** Debounce 800-1000 ms and cancel while the user keeps flipping, or pre-render only after the first dwell; keep the on-demand mount fallback for Save.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Time to PNG for Save after a quick flip vs a dwell; jank while flipping.

### PERF-059  [P3] A hidden second full session screen and board are mounted behind the setup page
- **Issue ID:** PERF-059 (raw: A-19)
- **Screen / System:** Visualize setup
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Extra memory and JS while the user reads the setup page; competes with the audio sheet and duration taps.
- **Reproduction:** Open Visualize setup with 5-6 photos; profile memory/JS.
- **Measurements:** None collected.
- **Likely root cause:** `V2CinematicSessionScreen prepareOnly` in `preparationSurface` (opacity 0) plus the visible `VisionBoardScene` (`V2VisualizePrepareScreen.tsx:337-357, 429-436`). Confidence medium.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `screens/v2/practice/visualize/V2VisualizePrepareScreen.tsx:337-357, 429-436`
- **Recommended solution:** Share one board scene between the collage and the prepare pass, or mount the prepare pass in an idle task and unmount after `onPrepared`.
- **Visual preservation:** None.
- **Risk:** Medium: prepared frame/mark measurements feed the session start.
- **Verification:** Native heap with and without; time-to-`onPrepared`.

### PERF-060  [P3] Sound/haptic cues and phase flips ride JS `setTimeout` chains parallel to UI-thread animations
- **Issue ID:** PERF-060 (raw: A-20, B-22)
- **Screen / System:** Creation formation, Release burn feel, Vision seal, arrival set
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Cue timing drifts from the visual when the JS thread is busy (save, image decode, store hydration); a 1445-line stage re-renders at each phase flip; the seal commit can fire late relative to the full ring.
- **Reproduction:** Creation or Release with a busy JS thread (generation request in flight); compare haptic vs ring.
- **Measurements:** None collected.
- **Likely root cause:** `runFormation` starts a UI `withTiming` and separately schedules `setFormationPhase`, landing sounds, haptics on `setTimeout` (`CreationStage.tsx:365-455, 579-591, 614-650`); `useReleaseBurnFeel.ts:44-52` computes `at - (Date.now() - start)` at schedule time, which is always ~`at`; `VisionSealHold.tsx:38` `setTimeout(commit, holdMs)` vs `withTiming(1, holdMs)`; `VisionArrivalSet.tsx:44-56`. The creation flow proper is frame-clocked and unaffected. Confidence medium.
- **Root-cause cluster:** RC-6, JS-clock-driven visuals and cues running parallel to UI-thread animation
- **Relevant files:** `components/v2/creation/CreationStage.tsx:365-455, 579-650`; `hooks/v2/release/useReleaseBurnFeel.ts:44-52`; `components/v2/vision/ceremony/VisionSealHold.tsx:38`; `components/v2/vision/VisionArrivalSet.tsx:44-56`
- **Recommended solution:** Fire cues from a UI-thread `useAnimatedReaction` crossing (`runOnJS` only for the trigger) or read progress from the shared value; keep the JS timer as the completion fallback (Jest rAF no-op); memoise the formation subtree by phase.
- **Visual preservation:** Cue sets and timings unchanged; they follow the animation exactly.
- **Risk:** Medium: sound/haptic contract tests.
- **Verification:** Log offset between landing sound and visual landing frame under artificial JS load.

### PERF-061  [P3] Spotlight animates five scrim views by `left/top/width/height`
- **Issue ID:** PERF-061 (raw: A-21)
- **Screen / System:** Teaching spotlight (`SpotlightCoach`, `ChartOneMoveTeaching`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** A hitch when the coach mark moves between targets (260 ms) on Home/Details/Progress.
- **Reproduction:** Trigger coach marks.
- **Measurements:** None collected.
- **Likely root cause:** Code fact: layout props animated (`SpotlightCoach.tsx:77-81`, `ChartOneMoveTeaching.tsx:44-48`); impact unmeasured.
- **Root-cause cluster:** RC-5, Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **Relevant files:** `components/v2/teaching/SpotlightCoach.tsx:77-81`; `components/v2/chart/sheet/ChartOneMoveTeaching.tsx:44-48`
- **Recommended solution:** One Skia canvas or a single full-screen view with an SVG `Mask` rect moved by transform, or four fixed scrim views with transform-scaled edges.
- **Visual preservation:** Same spotlight rectangle motion.
- **Risk:** Low-medium.
- **Verification:** Frame pacing during a spotlight move.

### PERF-062  [P3] `seekTo(0)` before every one-shot, un-prewarmed cues, and cold players after `releaseIdle`
- **Issue ID:** PERF-062 (raw: B-09)
- **Screen / System:** `SoundPool.play` first-play latency
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Sound lags its paired haptic; first use of `practiceComplete`, `homeArrival`, `onboardingSealed`, `paywallSuccess`, `anchorPulse` outside Vision and `visionPin` in Home arrival pays a full cold load; after `releaseIdle(keys)` the next `play()` creates one inline (e.g. `V2ReleaseScreen.tsx:67-77`).
- **Reproduction:** Compare `sfxLog` `loadedAtCall`, `source=temporary|prewarmed`, and time from call to `playReached` on device.
- **Measurements:** None collected.
- **Likely root cause:** `play()` always `await seekTo(0)` (even for a fresh entry) and never re-prewarms (`SoundPool.ts:354-376, 471-486`). Haptics call `Haptics.*Async` synchronously (`useChooseController.ts:207`). Confidence medium; no latency measured.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/audio/SoundPool.ts:354-376, 471-486`; `services/audio/practiceCompletionCue.ts:5-10`; `screens/v2/practice/focus/V2FocusActiveScreen.tsx:522-529`; `screens/v2/practice/deepFocus/V2DeepFocusActiveScreen.tsx:117`
- **Recommended solution:** Track `entry.atStart` and skip `seekTo(0)` for fresh entries (seek in `releaseEntry` so the next play is instant); prewarm `practiceComplete` at session start, `homeArrival` on Home mount, `onboardingSealed`/`paywallSuccess` on their screens; top up pooled keys that dropped to zero.
- **Visual preservation:** No cue removed; cues land closer to their haptics.
- **Risk:** Low-medium: stay under `MAX_LIVE_PLAYERS` 24.
- **Verification:** `sfxLog` and Perfetto/Instruments audio latency on device.

### PERF-063  [P3] Abrupt stops (no fade) at several exits, and JS-timer volume fades
- **Issue ID:** PERF-063 (raw: B-11)
- **Screen / System:** Exits across Focus, Deep Focus, Visualize, Vision seal hold, Release, Chart air
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Mid-word narration cuts on end-early; the Deep Focus 0.45 s `endFade` never applies on end-early; Visualize unmount hard-stops; Release hold cancel stops the 1.0 s clip abruptly; Chart air ramp is removed mid-ramp by `useAudio` cleanup.
- **Reproduction:** Exit each flow mid-audio and inspect the waveform.
- **Measurements:** None collected.
- **Likely root cause:** `V2FocusActiveScreen.tsx:455-456, 522-529`; `V2DeepFocusActiveScreen.tsx:125-130` (`session.end()` sets `done` so `sample()` returns early); `useSessionAudio.ts:62-70`; `VisionSealHold.tsx:24`; `V2ReleaseScreen.tsx:113`; `ChartIntroOpening.tsx:122-126` + `hooks/useAudio.ts:62-68` (`fadeAirOnUnmount` has no caller). Fades are `setInterval` volume steps (`SoundPool.ts:487-502, 519-533`, `useChartSound.rampTo`) that coarsen under JS load. Confidence medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** see cause
- **Recommended solution:** One shared `fadeOutAndStop(player, ms)` (20-30 ms minimum for one-shots, 150-300 ms for beds/narration); in Deep Focus drive the end-early fade through `endFade` before `onExit`; ensure the fade owner outlives `useAudio` cleanup; 8-10 steps at <= 30 ms.
- **Visual preservation:** Nothing shortened or removed; only the cut becomes a short fade.
- **Risk:** Low: Release/Deep Focus exits get 150-300 ms later silence.
- **Verification:** Waveform inspection at exit points; jest with fake timers.

### PERF-064  [P3] Rapid taps or sheet close can leave an orphan preview playing (double voice)
- **Issue ID:** PERF-064 (raw: B-12)
- **Screen / System:** Voice preview (`VoicePreviewService`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Tap preview Dominic then Lina quickly, or close the sheet right after tapping: two previews overlap or one starts with no owner.
- **Reproduction:** Rapid taps; close the sheet immediately.
- **Measurements:** None collected.
- **Likely root cause:** `startVoicePreview` calls `stopVoicePreview()` then `await setAudioSessionMode('session')` before creating the player; a second call or stop during the await has nothing to stop (`VoicePreviewService.ts:42-93`). Confidence high on mechanism.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/VoicePreviewService.ts:42-93`; `components/v2/practice/V2PracticeAudioSheet.tsx:76-102`
- **Recommended solution:** A monotonically increasing `requestId`; after the await `if (id !== currentId) return false`; dispose player A before assigning B.
- **Visual preservation:** Unchanged.
- **Risk:** Very low.
- **Verification:** Jest with a deferred `setAudioSessionMode`.

### PERF-065  [P3] Session Haptics toggle is dead when global intensity is 0; selection/notification are not scaled by intensity
- **Issue ID:** PERF-065 (raw: B-13)
- **Screen / System:** Session haptics toggle vs global intensity
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** With global Haptic Intensity 0, turning Haptics on in a session's prepare card still feels nothing; with intensity 1-33, notifications/selection still play full strength (only `impact` scales).
- **Reproduction:** Set intensity 0 in Settings, enable Haptics in a prepare card, run a session.
- **Measurements:** None collected.
- **Likely root cause:** Two sources of truth: `safeHaptics.selection/notification` return when `getIntensity() <= 0` unless `bypassScale` (`utils/haptics.ts:35-61`); the session toggle (`useSessionAudioSetup.ts:31,41,69`) does not pass it. Confidence high.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `hooks/v2/useSessionAudioSetup.ts:31, 41, 69`; `utils/haptics.ts:35-61`
- **Recommended solution:** When haptics are explicitly enabled for a session pass `bypassScale`/`forceOn` from the session screens, or show the toggle disabled with the reason; document which source wins; optionally scale notification/selection.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Jest on `safeHaptics` with intensity 0 and the option.

### PERF-066  [P3] Haptic calls are unthrottled on wheels, carousel and the Choose seal hold
- **Issue ID:** PERF-066 (raw: B-14)
- **Screen / System:** Haptic rate (TimeWheel, Home carousel, Choose hold)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** A fast flick across a 60-row wheel can queue dozens of `selection` calls per second that keep vibrating after the scroll stops (Android); the seal-hold recursion does up to 20 Hz.
- **Reproduction:** Android, fast flick across the minutes wheel; count calls per second.
- **Measurements:** None collected.
- **Likely root cause:** `runOnJS(safeHaptics.selection)` per row (`TimeWheel.tsx:192-201`), `V2HomeAnchorCarousel.tsx:232-242`, `useChooseController.ts:146-158` (150 -> 50 ms). Confidence medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `components/v2/notifications/TimeWheel.tsx:192-201`; `components/v2/home/V2HomeAnchorCarousel.tsx:232-242`; `screens/create/flow/useChooseController.ts:146-158`; `utils/haptics.ts`
- **Recommended solution:** A leading-edge limiter in `safeHaptics` (skip a `selection`/`impact` within 30-40 ms of the previous, with `bypassThrottle` for one-offs); keep the Choose-hold cadence design values, but derive timing from `performance.now()` if it drifts.
- **Visual preservation:** Haptic design kept; only sub-perceptual duplicates dropped.
- **Risk:** Low.
- **Verification:** Android device, log call count per second during a flick.

### PERF-067  [P3] Prewarming 16 players during the Intention-to-creation hand-off adds main-thread work
- **Issue ID:** PERF-067 (raw: B-16)
- **Screen / System:** Creation start (`SoundPool` prewarm, `NodeToneService`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** `createAudioPlayer` is a synchronous native constructor called from JS timers (3 per 50 ms) during the hand-off animation; `NodeToneService.prepare` is called again when `built` changes.
- **Reproduction:** Perfetto/systrace main-thread slices of `createAudioPlayer` at creation start.
- **Measurements:** None collected.
- **Likely root cause:** Starting creation prewarms `uiTap` x2, `distillTick` x4 and ten node tones (`AnchorCreationFlowScreen.tsx:225-233, 379`; `SoundPool.ts:254-278, 310-327`); `prepare(cells)` ignores `cells` (`NodeToneService.ts:43`). Confidence medium; cost not measured.
- **Root-cause cluster:** RC-4, Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **Relevant files:** `services/audio/SoundPool.ts:254-278, 310-327`; `screens/create/flow/AnchorCreationFlowScreen.tsx:225-233, 379`; `services/audio/NodeToneService.ts:43`
- **Recommended solution:** Prewarm earlier (when the Intention CTA is armed) or after `InteractionManager.runAfterInteractions`, 1-2 players per tick; prewarm only the node tones the built path uses.
- **Visual preservation:** Same cues, same warm state.
- **Risk:** Low.
- **Verification:** Frame timeline during the hand-off before/after.

### PERF-068  [P3] Audio-session mode is last-writer-wins across mount/unmount effects; completion cues use a different silent-switch policy than the session
- **Issue ID:** PERF-068 (raw: B-17)
- **Screen / System:** Audio session mode ownership (`AudioSession`, `useAudio`, `useSessionAudio`, `VoicePreviewService`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** (1) If a prepare screen unmounts after the session screen mounts, `stopVoicePreview()` enqueues `effects` after `session`, so narration plays under iOS `.ambient` (muted by the silent switch). (2) Deep Focus can `play()` before the `session` mode call resolves (first moments muted with the ringer off). (3) With the ringer off the narration plays but the completion cue (mode `effects`) does not. Unverified ordering hazards.
- **Reproduction:** iOS with the ringer switch on/off: prepare -> session transitions, Deep Focus first second, completion cue. Whether prepare unmounts before or after the session mounts was not traced.
- **Measurements:** None collected.
- **Likely root cause:** The queue serialises calls but not intent (`AudioSession.ts:9-31`); `V2PracticeAudioSheet.tsx:76-79`, `V2FocusPrepScreen.tsx:95`, `V2DeepFocusActiveScreen.tsx:71-107, 117`. Confidence low-medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/audio/AudioSession.ts`; `hooks/useAudio.ts:62-68`; `hooks/useSessionAudio.ts:62-70`; `services/VoicePreviewService.ts:37`; `services/audio/practiceCompletionCue.ts`
- **Recommended solution:** Expose `ready` from `useSessionAudio` and await it before the first `play()`; make ownership explicit (counter held while any session screen is mounted; `stopVoicePreview` must not downgrade while > 0); decide and document the silent-switch policy for completion cues.
- **Visual preservation:** Unchanged.
- **Risk:** Low-medium.
- **Verification:** iOS device with ringer switch on/off.

### PERF-069  [P3] Channels carry no custom sound (the branded wav only affects iOS and Android < 8); verify intent
- **Issue ID:** PERF-069 (raw: B-18)
- **Screen / System:** Android notification channels
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** `notification.wav` (3.0 s) is attached to content, but Android 8+ uses the channel sound and none of the five `setNotificationChannelAsync` calls sets `sound`; `notification-daily/weekly/checkpoint.wav` are bundled and unregistered.
- **Reproduction:** Android 13+ device, trigger a test reminder.
- **Measurements:** None collected.
- **Likely root cause:** `NotificationService.ts:874-905` (channels), `:33`, `app.json:189-193`; channel sound is frozen at creation, so a change needs new channel ids (suffix bump). Confidence medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/NotificationService.ts:33, 874-905`; `app.json:189-193`
- **Recommended solution:** If a branded sound is intended on Android, add `sound: 'notification.wav'` to the channels and bump the version suffixes; otherwise document that Android uses the system default.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Android 13+ test reminder.

### PERF-070  [P3] Pool keys are released by several owners with no ref-counting
- **Issue ID:** PERF-070 (raw: B-19)
- **Screen / System:** `SoundPool` key ownership (Chart intro/active, Release, creation, completion scene, node tones)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** When screen B prewarms (needed = 0 because A's entries exist) and A unmounts later, B's warm entries are disposed and not re-prewarmed; `ChartIntroOpening` and `ChartActiveView` share 11 keys; Release's mount-time `releaseIdle` includes `creation:uiTap` and `creation:seal`.
- **Reproduction:** Chart intro to active transition; check `countLivePlayers()`.
- **Measurements:** None collected.
- **Likely root cause:** `releaseIdle` disposes idle entries by key (`useChartSound.ts:66-76`, `V2ReleaseScreen.tsx:67-90`, `AnchorCreationFlowScreen.tsx:225-243`, `usePracticeCompletionScene.ts:532-536`); the hazard is acknowledged in comments. Confidence medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** see cause
- **Recommended solution:** Ref-count prewarm/release per key (`prewarm` increments, `releaseIdle` decrements and disposes at zero), keeping eviction under the live cap.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Unit test with two owners; `countLivePlayers()` after a Chart intro to active transition.

### PERF-071  [P3] Cache hydration is fired but not awaited before player creation
- **Issue ID:** PERF-071 (raw: B-20(a))
- **Screen / System:** Remote audio cache (`remoteAudio.ts`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** On a direct entry (resume, deep link) the first player can be created before hydration finishes and stream a file already on disk (only `deepPrimeAmbient` and `visualizeAmbient5m` still use the remote path).
- **Reproduction:** Airplane-mode start of a cached remote ambient.
- **Measurements:** None collected.
- **Likely root cause:** `resolvePlayableAudioSource` consults the in-memory `cached` set filled by `hydrateRemoteAudioCache()`, fired unawaited in the `useSessionAudio` mount effect (`:62-85`). Confidence medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `services/audio/remoteAudio.ts`; `hooks/useSessionAudio.ts:62-85`
- **Recommended solution:** `await hydrateRemoteAudioCache()` before the first creation when a remote source is requested, or hydrate at app startup; delete the dead table entries (PERF-028).
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Airplane-mode start; bundle size diff.

### PERF-072  [P3] Loop-point and tail quality: MP3 loops may gap ~25 ms on Android; legacy loops click
- **Issue ID:** PERF-072 (raw: B-21)
- **Screen / System:** Looped and legacy audio assets
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** `chart-air.mp3` (12.5 s) and `focus-session-ambient.mp3` (188 s) report 0.025 s encoder delay, so a ~25 ms loop gap per cycle is plausible on Android (minor at 0.14 volume); `sk-seal-rise.wav` begins/ends at 0 and pulses if looped (hold is 1.2 s so one pulse in practice); legacy `haptic-tone.wav` and `prime-begin.wav` click when looped (V1 only).
- **Reproduction:** Listen test of a 60 s ambient loop on Android.
- **Measurements:** Asset measured (ffmpeg first/last samples and 5 ms RMS): `sk-form-bed.wav` seamless (-2855/-2593); `chart-air.mp3` matched (1146/1131); `haptic-tone.wav` -11145/+13566; `prime-begin.wav` RMS 486 start vs 9530 end.
- **Likely root cause:** MP3 encoder delay plus native loop. Confidence low-medium.
- **Root-cause cluster:** RC-7, Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **Relevant files:** `src/assets/sounds/*`; `hooks/useChartSound.ts`; `screens/rituals/useRitualController.ts:217, 267, 309`
- **Recommended solution:** If a gap is audible, supply gapless WAV/OGG for `chart-air` and the focus ambient or crossfade a double player; leave legacy alone unless V1 ships.
- **Visual preservation:** Same sounds.
- **Risk:** Low.
- **Verification:** Listen test; waveform.

### PERF-073  [P3] Any HTTP 409 on Release is treated as "already released"
- **Issue ID:** PERF-073 (raw: C-06)
- **Screen / System:** Release API adapter
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** A genuine `ANCHOR_RELEASE_CONFLICT` (409, claim update lost a race, Anchor NOT released) is shown as a completed release and the local record flips to released.
- **Reproduction:** Adapter unit test with a 409 + `ANCHOR_RELEASE_CONFLICT`.
- **Measurements:** None collected.
- **Likely root cause:** `error.status === 409 || ALREADY_RELEASED_CODES` (`releaseApiAdapter.ts:74-77`; server `AnchorReleaseService.ts:45-47`). Confidence medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `adapters/v2/release/releaseApiAdapter.ts:74-77`
- **Recommended solution:** Treat 409 as released only for the codes in `ALREADY_RELEASED_CODES`; map `ANCHOR_RELEASE_CONFLICT` to `pending`+`retryable`.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Adapter unit test.

### PERF-074  [P3] A cold-start notification tap can be stranded
- **Issue ID:** PERF-074 (raw: C-12)
- **Screen / System:** Notification response queue (`App.tsx:882-971`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** App launched from a notification lands on the default screen instead of the target.
- **Reproduction:** Needs auth to settle after the navigator mounts: the response queues while `navRef.isReady()` is false and a 200 ms retry loop starts (`:906-940`); when `initialAuthResolved` flips the effect cleans up, the re-run `drainPendingNotification()` does nothing if the container is still not ready and does not restart the loop, and `getLastNotificationResponseAsync()` returns an id already in `processedResponseIdsRef` (`:924`). The loop also stops at ~6 s.
- **Measurements:** None collected.
- **Likely root cause:** Confidence medium-low on frequency, high on mechanism.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `App.tsx:882-971`
- **Recommended solution:** `drainPendingNotification` calls `startDrainRetryLoop()` when a response is pending and the container is not ready; raise the cap to the startup fail-open horizon; do not add the id to `processedResponseIdsRef` until dispatched.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Jest with fake timers and a mocked `navRef`.

### PERF-075  [P3] Home refreshes Today, Vision and Chart on every AppState `active`, even when covered or recently refreshed
- **Issue ID:** PERF-075 (raw: C-14)
- **Screen / System:** Home foreground refresh
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Each `active` event (including iOS inactive-to-active from the notification shade, permission and share sheets) refires three reads with no recency throttle, competing for JS and the API limit while the user is in a practice session.
- **Reproduction:** Count requests across AppState transitions.
- **Measurements:** None collected.
- **Likely root cause:** `refreshHomeContext()` in the AppState listener (`V2HomeScreen.tsx:194-206`) lacks the `REFOCUS_REFRESH_MS` check the focus path has and does not check focus. Confidence medium.
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `screens/v2/home/V2HomeScreen.tsx:194-206`
- **Recommended solution:** Reuse the focus path's recency check and skip when `navigation.isFocused()` is false (mark stale, refresh on next focus).
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Jest on the listener with fake `Date.now`; request count on device.

### PERF-076  [P3] Navigator `key` changes mid-flow and remounts the whole stack, including the seal-to-coin continuity
- **Issue ID:** PERF-076 (raw: C-16)
- **Screen / System:** `AnchorV2Navigator` key
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Setting `firstRunStep` to `'auth'` (in `onSaved`, ~`:700`, just before `popToTop`) flips the key from `V2FirstRun:guest` to `V2FirstRun:onboarding-save`; `completeOnboarding()` plus `navigation.reset` changes it twice. Possible blank frame; not measured.
- **Reproduction:** Device frame capture of the seal to save transition.
- **Measurements:** None collected.
- **Likely root cause:** Key built from `initialRouteName` + identity (`AnchorV2Navigator.tsx:551-557`). Confidence medium.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `navigation/v2/AnchorV2Navigator.tsx:551-557`; `screens/create/flow/AnchorCreationFlowScreen.tsx:~700`
- **Recommended solution:** Derive the key only from identity (`user?.id`/guest) and let `V2FirstRunFlow` react to step changes internally.
- **Visual preservation:** This is the point: removing the remount protects the seal-to-coin continuity.
- **Risk:** Medium: the key encodes several intentional resets.
- **Verification:** Frame capture of the seal to save transition.

### PERF-077  [P3] Duplicate `/api/auth/sync` and hydration on every interactive sign-in
- **Issue ID:** PERF-077 (raw: C-17)
- **Screen / System:** Interactive sign-in (`onAuthStateChanged` + `PostAuthFlowService.run`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Sign-in/up triggers sync and `hydrateAuthenticatedData` twice; `setSession` from the listener overwrites `hasCompletedOnboarding` from the server and can interleave with the explicit flow's value.
- **Reproduction:** Count `/api/auth/sync` calls on sign-in.
- **Measurements:** None collected.
- **Likely root cause:** Always-on listener (`App.tsx:467-549`) plus `PostAuthFlowService.run` (`:30-100`); `authStore.ts:463-489`. Confidence medium.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `App.tsx:467-549`; `services/PostAuthFlowService.ts:30-100`; `stores/authStore.ts:463-489`
- **Recommended solution:** An "interactive auth in progress" flag the listener respects, or skip when `user.id` already equals the Firebase uid and a sync completed in the last few seconds.
- **Visual preservation:** None.
- **Risk:** Medium.
- **Verification:** Jest integration test counting sync calls.

### PERF-078  [P3] `evolvedFrom` is recorded only on the local successor
- **Issue ID:** PERF-078 (raw: C-18)
- **Screen / System:** Evolve successor link
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** The link does not survive reinstall, sign-out or a second device; the Home "evolved from" line then disappears. (Attach/release ordering and the double-tap latch were checked and are sound.)
- **Reproduction:** Evolve an Anchor, reinstall.
- **Measurements:** None collected.
- **Likely root cause:** Local-only field (`anchorStore.ts:46, 123-128`). Confidence high.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `stores/anchorStore.ts:46, 123-128`
- **Recommended solution:** Optional: persist the link server-side (`classifierMeta.evolvedFrom`) on release confirmation.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Reinstall test.

### PERF-079  [P3] Single dialog slot: a second alert silently drops the first's callbacks; the cancel handler is dropped for 3+ buttons
- **Issue ID:** PERF-079 (raw: C-19)
- **Screen / System:** `V2DialogManager` (global `Alert.alert` bridge)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** A second `Alert.alert` while one is open replaces it without calling the first's `onCancel`/`onPress`, so actions such as the creation account gate's "Go back" are lost; for 3+ button alerts the `cancel` button's `onPress` is never called. Installed in legacy mode too.
- **Reproduction:** Raise two alerts in quick succession.
- **Measurements:** None collected.
- **Likely root cause:** `currentState` holds one dialog (`V2DialogManager.ts:40`); the action-sheet branch maps only non-cancel buttons. Confidence medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `components/v2/feedback/V2DialogManager.ts`
- **Recommended solution:** Queue dialogs FIFO (or resolve the replaced dialog's cancel before showing the next) and wire the cancel button of the action sheet.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Unit test with two sequential alerts.

### PERF-080  [P3] Stale response overwrite: overlapping polls are unordered; `useAnchorChart.refresh` can overwrite a newer published chart
- **Issue ID:** PERF-080 (raw: C-20)
- **Screen / System:** Polling and Chart refresh
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** An older poll response can overwrite a newer job state for one tick (self-heals); the UI shows the older chart until the next refresh after a mutation.
- **Reproduction:** Slow responses; mutate a chart during an in-flight read.
- **Measurements:** None collected.
- **Likely root cause:** Overlapping 2-2.5 s polls with a 120 s timeout; `setData(value)` without a version check (`useAnchorChart.ts:201-236` vs `publishChart`). Confidence medium.
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `hooks/v2/vision/useV2VisionGeneration.ts`; `useV2VisionSceneGeneration.ts`; `hooks/v2/chart/useAnchorChart.ts:201-236`
- **Recommended solution:** Tag each request with an increasing id and ignore older results; compare `version` before `setData`.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Unit tests with out-of-order resolutions.

### PERF-081  [P3] Guard gaps: fallback runs before the in-flight latch; unhandled rejection; arrival expiry armed only after the pop
- **Issue ID:** PERF-081 (raw: C-21)
- **Screen / System:** Hand-off modules (`releaseHandoff.ts`, `creationHandoff.ts`)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** (a) A double tap on Return Home with `canPop` false (or zero Anchors) runs `replace('V2DevelopmentHome')` twice (the caller's `leavingRef` covers the tap path, so reachability is low). (b) `handOffToHome` has no in-flight guard and callers drop the promise (`void handOffToHome(...)`): a rejection from `whenHomeReady`/`prefetchChosenImage` is unhandled and the seal screen never leaves. (c) The 5 s staged-arrival expiry is armed only after the pop, so an arrival staged on save and never handed off stays staged until the next stage.
- **Reproduction:** Double-tap Return Home with no pop target; reject `prefetchChosenImage` in a test.
- **Measurements:** None collected.
- **Likely root cause:** `releaseHandoff.ts:85-92, 167-172`; `creationHandoff.ts`; `AnchorV2Navigator.tsx:~318`; `AnchorCreationFlowScreen.tsx:~706`. Confidence medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `navigation/v2/releaseHandoff.ts:85-92, 167-172`; `navigation/v2/creationHandoff.ts`; `navigation/v2/AnchorV2Navigator.tsx:~318`
- **Recommended solution:** Move the guard above the fallback branches; add `.catch(() => navigation.reset(...Home))` to the callers; arm the expiry inside `prepareHomeArrival`.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Unit tests per branch.

### PERF-082  [P3] Store rehydration is not gated by startup readiness: a returning guest can see a first-run flash
- **Issue ID:** PERF-082 (raw: C-23)
- **Screen / System:** Startup readiness (signed-out launches)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** `useAppStartup` waits for fonts, settings, the auth latch and prime-on-launch, but not for `authStore`/`firstRunStore` hydration (`persist.hasHydrated()` is only used in `__DEV__` logging, `App.tsx:330-354`); for a signed-out launch the auth latch resolves in milliseconds, so the first navigator render can use default auth state then flip `key`/`initialRouteName`. The `V2FirstRunFlow` loading state is plain text.
- **Reproduction:** Cold start as a returning guest; capture the first frames.
- **Measurements:** None collected.
- **Likely root cause:** Hydration not in the readiness dependencies. Confidence medium.
- **Root-cause cluster:** RC-2, Account/guest state integrity across startup, creation and hydration
- **Relevant files:** `hooks/useAppStartup.ts`; `App.tsx:330-354`; `screens/v2/onboarding/V2FirstRunFlow.tsx:91`
- **Recommended solution:** Add `authStore` and `firstRunStore` `hasHydrated` to `useAppStartup`; replace the text loading state with the cream paper background. Pairs with PERF-001 and PERF-002.
- **Visual preservation:** Keeps the splash until stores are ready.
- **Risk:** Low.
- **Verification:** Frame capture of a returning-guest cold start.

### PERF-083  [P3] `void pendingSave.then(...)` / `void pending.then(...)` have no `.catch`
- **Issue ID:** PERF-083 (raw: C-24)
- **Screen / System:** Creation seal/save promise chains
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** If `saveAnchor` ever throws the medallion stays held, `sealing` stays true and both back paths are swallowed: a permanent lock. Reachability is low (all current throw sites are guarded).
- **Reproduction:** Force `saveAnchor` to throw in a test.
- **Measurements:** None collected.
- **Likely root cause:** `AnchorCreationFlowScreen.tsx:798, 819`. Confidence medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `screens/create/flow/AnchorCreationFlowScreen.tsx:798, 819`
- **Recommended solution:** `.catch(() => { savePromiseRef.current = null; flushDeferred(); chooseRef.current?.reset(); })`.
- **Visual preservation:** None.
- **Risk:** None.
- **Verification:** Jest forcing a throw.

### PERF-084  [P3] Legacy paywall params in V2: wrong copy and no resume after purchase
- **Issue ID:** PERF-084 (raw: C-25)
- **Screen / System:** Creation-gate paywall navigation
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** `navigate('Paywall', {source, preferredPlanId})` but `V2PaywallRouteScreen` reads `context` and `resumeIntent` (`AnchorV2Navigator.tsx:58-101`), so the paywall shows `GENERAL_UPGRADE` copy instead of `SECOND_ANCHOR` and the user must tap again after purchase.
- **Reproduction:** Hit the creation gate as a free user with an existing Anchor.
- **Measurements:** None collected.
- **Likely root cause:** Param mismatch in `IntentionInputScreen`, `useSaveAnchor`, the creation flow. Confidence medium.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `screens/create/IntentionInputScreen.tsx`; `hooks/useSaveAnchor.ts`; `navigation/v2/AnchorV2Navigator.tsx:58-101`
- **Recommended solution:** Map `source` to a `context` and pass `resumeIntent:{type:'create_anchor'}` in a thin adapter inside `V2PaywallRouteScreen` (legacy-params fallback).
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Gate flow in a device run; jest on the adapter.

### PERF-085  [P3] Many startup tasks run inside the splash window; per-request traces; error handlers installed only after first render
- **Issue ID:** PERF-085 (raw: C-26)
- **Screen / System:** Startup concurrency and observability cost
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** In release the app starts `loadSettingsSnapshot`, prime-on-launch (parses the whole encrypted vault when the flag is set even though V2 ignores the result), `AuthService.initialize`, `NotificationCoordinator.initialize` with `reconcile({verifyNative:true})`, `Sentry.init` with tracing/profiling (post-first-render effect, `App.tsx:629-637`), `PerformanceMonitoring.initialize`, PostHog init, widget sync, and a signed-out `signOut()` with several removals (PERF-001). `PerformanceMonitoring.startTrace` allocates a trace per HTTP request (`ApiClient.ts:49-56`) and per screen change.
- **Reproduction:** Measure with the existing `HomeStartupProfiler` before changing anything.
- **Measurements:** None collected.
- **Likely root cause:** Unmeasured. `ErrorTrackingService.ts:263-297` installs global handlers only if Sentry is enabled and only after first render.
- **Root-cause cluster:** RC-10, Startup concurrency and observability cost
- **Relevant files:** `App.tsx:204-249, 420-444, 629-637, 756-759`; `services/ApiClient.ts:49-56`; `services/ErrorTrackingService.ts:263-297`
- **Recommended solution:** Defer notification reconcile and PostHog init to after the first Home frame; skip prime-on-launch resolution when `anchorV2Enabled`; install global error handlers before first render.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Startup profiler marks before/after on a physical release build.

### PERF-086  [P3] Dead/misleading route registrations
- **Issue ID:** PERF-086 (raw: C-27)
- **Screen / System:** Route metadata
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** `V2PracticePrepare` is typed (`types.ts:51`) and listed in `ANCHOR_V2_ROUTES` (`routes.ts:17`) but never registered, so `navigate('V2PracticePrepare')` would error; `Paywall` and `V2Paywall` are two registrations of one screen; `V2SystemGallery` ships in release with no entry.
- **Reproduction:** Grep route usage.
- **Measurements:** None collected.
- **Likely root cause:** Leftover metadata. Confidence high.
- **Root-cause cluster:** RC-9, Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **Relevant files:** `navigation/v2/types.ts:51`; `navigation/v2/routes.ts:17`
- **Recommended solution:** Remove or register to avoid future dead navigations.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Typecheck; grep.

### PERF-087  [P3] Poll loops re-render every 2.5 s and have no in-flight guard
- **Issue ID:** PERF-087 (raw: D-11)
- **Screen / System:** Vision generation polling
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** Slow responses stack requests; each poll `setJob(newObject)` re-renders.
- **Reproduction:** Count requests and React commits during one generation.
- **Measurements:** None collected.
- **Likely root cause:** `setInterval(refresh, 2500)` (`useV2VisionGeneration.ts:84-87`; scene variant `useV2VisionSceneGeneration.ts:74-77`), no `if (inFlight) return`, unconditional `setJob`; with the 120 s timeout a slow server stacks requests. Foreground gating and cleanup are correct.
- **Root-cause cluster:** RC-3, Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **Relevant files:** `hooks/v2/vision/useV2VisionGeneration.ts:84-87`; `useV2VisionSceneGeneration.ts:74-77`
- **Recommended solution:** Skip when a request is in flight; `setJob` only when status/progress/`updatedAt` changed; back off 2.5 s to 5 s after 30 s.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** Request count per generation; Profiler commits.

### PERF-088  [P3] Persisted read models contain expiring presigned URLs and are rewritten on every fetch
- **Issue ID:** PERF-088 (raw: D-12)
- **Screen / System:** Persisted read models (`useV2Vision`, vault, recommendation, Chart caches)
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** The 400 ms dedupe never matches because each read has fresh URLs, so a 6-12 KB blob (4-7 chunks, estimate) is fully rewritten on every Home mount/refresh per Anchor; restored reads seed the first frame with URLs that expired up to 1 h after signing.
- **Reproduction:** Count SecureStore calls per Home mount.
- **Measurements:** None collected.
- **Likely root cause:** `persistVisionRead` after every successful fetch (`useV2Vision.ts:86-93, 170-180`) + D-02 URL churn. Confidence medium.
- **Root-cause cluster:** RC-1, Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths
- **Relevant files:** `hooks/v2/vision/useV2Vision.ts:86-93, 170-180`
- **Recommended solution:** Persist storage keys (or URLs with the query stripped) and re-sign on first fetch, or fix PERF-027 so values are stable and dedupe hits.
- **Visual preservation:** None.
- **Risk:** Low.
- **Verification:** SecureStore call count per Home mount.

### PERF-089  [P3] Whole-store subscriptions, startup fonts, unbounded small caches, unthrottled backend jobs, EAS archive bulk, duplicate audio cues, dormant ForgeDemo asset
- **Issue ID:** PERF-089 (raw: D-14)
- **Screen / System:** Hygiene bundle
- **Severity:** P3
- **Evidence type:** Code suspected
- **Symptoms:** (a) `RootNavigator` uses `useAuthStore()` with no selector (`RootNavigator.tsx:65`) and `useTeachingGate` subscribes to the whole store (`useTeachingGate.ts:91`, 18 call sites). (b) 18 TTF registrations (~2.2 MB) via runtime `useFonts` gate the splash; `CormorantGaramond-*` alias CrimsonPro. (c) Unbounded caches: `DISTILLATION_CACHE`, `SIGIL_FORMATION_CACHE`, `SIGIL_RESULT_CACHE`, `encryptedPersistStorage.lastWrittenValue`, `writeCounts`, `authWriteCounts`. (d) Backend generation jobs run fire-and-forget with no concurrency cap (`VisionGenerationService.ts:177, 279, 307`). (e) 277 files / 159.8 MB under `src/assets` and `assets` are not bundled but are uploaded in each EAS archive (`.easignore` lacks `src/assets/chart/world/masters/` 108 MB and `assets/audio-source/` 4 MB). (f) ~1.0 MB byte-identical voice cue files. (g) `ForgeDemo.tsx:12` requires `onboarding_anchor.png` (3.26 MB, 16.8 MB decoded); reachability unconfirmed.
- **Reproduction:** Static scan and disk measurement (measured on disk for e-g).
- **Measurements:** None collected.
- **Likely root cause:** Accumulated drift. Confidence medium-high.
- **Root-cause cluster:** RC-8, Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **Relevant files:** `navigation/RootNavigator.tsx:65`; `utils/useTeachingGate.ts:91`; `App.tsx:298-318`; `hooks/useAppStartup.ts:36-45`; `utils/sigil/*`; `backend/src/services/VisionGenerationService.ts:177, 279, 307`; `.easignore`; `components/onboarding/ForgeDemo.tsx:12`
- **Recommended solution:** Selectors with `useShallow`; embed fonts via the `expo-font` config plugin (needs a native rebuild); small LRU (~200) on the caches; a semaphore (e.g. 3) for generation jobs; add the two folders to `.easignore`; alias duplicate `require`s; drop or confirm the ForgeDemo asset.
- **Visual preservation:** None.
- **Risk:** Low (fonts: native rebuild).
- **Verification:** Each item individually (archive size, render counts, memory).

## 9. Checked and found clean (consolidated coverage)

- Navigation: double-tap duplicate screens (React Navigation 6 `navigate` to an existing name updates rather than pushes; the only `push` is latched); anchor hero provider (`busyRef` + watchdog, timers cleared); handoff single-flight in `practiceHandoff`, `invitationHandoff`, `releaseHandoff` (non-fallback paths); Release idempotency (stable key, `submitLockRef`, Serializable server transaction, hold ends on background, `confirming` reconciles on foreground); Vision generation guards and foreground-only polling; creation generation abort on unmount; Chart mutation locks; notification time/invitation screens; practice pause on background; every RN `<Modal>` has `onRequestClose`; push-token registration; paywall `runExclusive`; RevenueCat `logIn` idempotent.
- Motion: Home carousel gesture thread split (fixed per notes), elastic scroll (all UI-thread worklets), transition provider lifecycle, Deep Focus single UI-thread clock, release hold logic, weather drift pauses on blur, ambient loops gated on `reduceMotion`/`active`, ChartSheet gestures, Vision board camera (pure shared values, transform only), no `BlurView`/`expo-blur` in V2, no `LayoutAnimation`, `VisualProfiler.record` is a no-op outside `__DEV__`, share export mounts only on demand, paywall loops idle-gated.
- Audio: audio-session queue, voice mapping (male = Dominic = "Grounded", female = Lina = "Serene") and beat-map keys, the Visualize audio-position clock (pause/resume/background/interruption/completion latch), monotonic Focus/Deep Focus clocks, release-hold/seal-hold/creation cleanup, VisionCeremony timers, thread-settle once per session, Share Studio haptics, remote-audio cache correctness, iOS interruption and route handling (provided by expo-audio).
- Assets/data: listener and interval cleanup (static scan), Skia disposal (`cinematicPhotoFocus`, bounded chart caches, precomputed fog), Chart landscape master decode-once, Share Studio view-shot sizing, SoundPool 24-player cap, sigil SVG size, Vision photograph `resizeMethod="resize"`, recommendation/Vision prefetch dedupe, Vision generated images normalised server-side, startup preload policy, `sessionStore.sessionLog` cap 50, uncommitted working-tree changes (no regressions seen).
- Runtime: no leak across 15 Home<->Details loops, rapid-tap navigation de-duplicated, hot launch 105 ms, Home idle cost zero, Settings to Notifications 1.5% janky, Focus audio released at session end with no stuck `AudioTrack`, no crashes/ANRs for the app pid.

## 10. Cross-reference: raw finding to PERF ID

| Raw | PERF | Raw | PERF | Raw | PERF |
|---|---|---|---|---|---|
| A-01 | PERF-013 | A-02 | PERF-015 | A-03 | PERF-019 |
| A-04 | PERF-020 | A-05 | PERF-021 | A-06 | PERF-022 |
| A-07 | PERF-018 | A-08 | PERF-023 | A-09 | PERF-014 |
| A-10 | PERF-051 | A-11 | PERF-024 | A-12 | PERF-052 |
| A-13 | PERF-053 | A-14 | PERF-054 | A-15 | PERF-055 |
| A-16 | PERF-056 | A-17 | PERF-057 | A-18 | PERF-058 |
| A-19 | PERF-059 | A-20 | PERF-060 | A-21 | PERF-061 |
| A-22 | PERF-011 | B-01 | PERF-010 | B-02 | PERF-041 |
| B-03 | PERF-042 | B-04 | PERF-043 | B-05 | PERF-044 |
| B-06 | PERF-045 | B-07 | PERF-046 | B-08 | PERF-047 |
| B-09 | PERF-062 | B-10 | PERF-048 | B-11 | PERF-063 |
| B-12 | PERF-064 | B-13 | PERF-065 | B-14 | PERF-066 |
| B-15 | PERF-021 | B-16 | PERF-067 | B-17 | PERF-068 |
| B-18 | PERF-069 | B-19 | PERF-070 | B-20 | PERF-028 |
| B-20 | PERF-071 | B-21 | PERF-072 | B-22 | PERF-060 |
| C-01 | PERF-001 | C-02 | PERF-005 | C-03 | PERF-006 |
| C-04 | PERF-007 | C-05 | PERF-033 | C-06 | PERF-073 |
| C-07 | PERF-034 | C-08 | PERF-008 | C-09 | PERF-035 |
| C-10 | PERF-036 | C-11 | PERF-037 | C-12 | PERF-074 |
| C-13 | PERF-038 | C-14 | PERF-075 | C-15 | PERF-039 |
| C-16 | PERF-076 | C-17 | PERF-077 | C-18 | PERF-078 |
| C-19 | PERF-079 | C-20 | PERF-080 | C-21 | PERF-081 |
| C-22 | PERF-040 | C-23 | PERF-082 | C-24 | PERF-083 |
| C-25 | PERF-084 | C-26 | PERF-085 | C-27 | PERF-086 |
| D-01 | PERF-009 | D-02 | PERF-027 | D-03 | PERF-028 |
| D-04 | PERF-029 | D-05 | PERF-004 | D-06 | PERF-030 |
| D-07 | PERF-031 | D-08 | PERF-026 | D-09 | PERF-032 |
| D-10 | PERF-049 | D-11 | PERF-087 | D-12 | PERF-088 |
| D-13 | PERF-026 | D-14 | PERF-089 | E-01 | PERF-002 |
| E-02 | PERF-003 | E-03 | PERF-012 | E-04 | PERF-016 |
| E-05 | PERF-017 | E-06 | PERF-025 | E-07 | PERF-050 |
| E-08 | PERF-002 |  |  |  |  |

## 11. Release baseline / data-safety continuation (2026-10-12)

This is a continuation of the existing findings, not another audit. Original DEBUG measurements, raw evidence, reconciliation counts, and issue IDs above are preserved. Current execution details and exact changed paths are in remediation plan section 10; native scenario coverage is in Device Validation Matrix sections 9–11; section 8 is the earlier preparation snapshot.

PERF-001/082 source is secured in `9a158b7d` on `feat/celebration-layer`; branch HEAD `6911321c` adds mounted-App integration tests only. The 10-second required-store guard now matches the handoff contract without changing the 4-second splash choreography/fail-open constant. Senior combined gate: **7 suites / 88 tests passed**, TypeScript exit 0. The current documented broader subset retains **12 failing suites / 26 assertions**, including both `AuthHydrationService` local-retention failures. No tests, snapshots, or quality thresholds were weakened. Independent source/test review reached 9.5/10; it is not release/device acceptance. Native guest persistence passed ten cold relaunches after full guest UI creation/save on the fresh emulator; incomplete onboarding resumed once on the ordinary emulator release. Physical guest validation, account transitions, injected failure/restart scenarios, and UI-storage causality remain separate validation items.

The owner's S24 Ultra is connected by wireless ADB (Android 16/API 36, arm64). Native Gradle release compilation succeeded in `E:\apc\src`: ordinary APK SHA-256 `AEA29C04A00ACCF2A25F7BCD089F531B7C62DAD2502D0C13056BF1CAEB2BAA28`, production V2/Hermes, non-debuggable, profileable, OTA disabled and loopback API. First fresh-install cold activity start measured 1,047 ms to first draw (one launch, not Home readiness). The user then interacted with `com.anchorintentions.perfbaseline`, so it is now protected alongside the owner app; further synthetic testing uses fresh `com.anchorintentions.perflab20261012`. Isolated build copies required ten byte-identical Android MP3 aliases, with no playback/choreography changes in shared source. Detailed artifact, signing and correction provenance is in plan section 10 and the Device Validation Matrix. No storage, Focus or frame improvement is inferred from build success or automated tests.

| Scenario / issue | Previous DEBUG observation | Current release evidence | Inference boundary / follow-up |
|---|---|---|---|
| Cold start / PERF-002,082 | ~36-second app-ready; dev launcher cold activity 855 ms | S24 V4: ten full-UI guest relaunches, draw median 559 ms / hydration 57–72 ms. Ten additional 72-Anchor launches, draw median 595.5 ms / hydration median 2,430.5 ms (1,969–2,476) | Activity draw, required-store hydration and historical app-ready clocks differ; Home-ready remains unmeasured. No recovery in either series. |
| Vault persistence / PERF-002 | 719,217 JSON chars, 400 chunks, one write 32.8 seconds | S24 V4: three native writes 8.235 / 7.170 / 6.403 s; adapter 8.646 / 7.580 / 6.805 s; full JSON verified, zero native failures/fallbacks | Physical release bulk latency reproduces. Concurrent auth writes 8.172 / 7.134 / 6.369 s versus 37–131 ms controls confirm adapter interference; pure queue wait and UI causality are not isolated. Separate emulator numbers remain in the plan. |
| Focus completion / PERF-003 | One 10-second session hung >2.5 minutes | No release completion: A/B Free paywall verified on emulator; V5 phone loopback route and synthetic C PRO sign-in verified, but canonical Home hydration is blocked by missing local fixture GET routes | Focus x10 and storage/completion causality remain unverified. No session or gate bypass; guest runs cannot prove the backlog hypothesis. |
| Home–Details / PERF-012 | 13/15 opens lost 31–35 frames; 250 ms p99 in debug | S24 V4: 30/30 full-UI guest cycles. Partial 120 Hz trace actual-frame p95/p99 12.725/43.498 ms; separate gfxinfo 31/611 janky (5.07%). Additional three 72-Anchor 60 Hz cycles pass; trace p95/p99 22.768/45.192 ms | Different fixture/window populations; preserve counts and time bounds. UIAutomator/settling overhead and synthetic art limit acceptance. Storage-to-frame causality remains unproved. |
| Carousel / PERF-050 | 5.1–6.4% jank in six-swipe debug captures | S24 V4: 20/20 verified switches, index 1→21. Partial 120 Hz trace p95/p99 16.285/16.409 ms, max 138.283; separate gfxinfo 94/3,015 janky (3.12%). Twenty full-vault writes, 5.620–9.299 s | Selection persists the full vault: confirmed write amplification. No per-swipe markers or storage-to-specific-frame causal proof. Fixture SVG padding models storage size, not real artwork complexity. |
| Focus motion / PERF-016 | 38% jank, p50 20 ms, 376 slow bitmap uploads | No release session frames yet | Preserve choreography and sound; no rendering correction authorized here. |
| Vision / PERF-017 | Scroll 25.6% jank; 43 missed vsync | No release scroll/image capture yet | Use synthetic imagery and avoid paid generation/private owner images. |
| Chart, Deep Prime, guided Visualize, lifecycle | Original coverage absent/partial | No release coverage yet | Needs isolated synthetic content/account and complete audio/motion scenarios. |

The encrypted SQLite/SQLCipher proposal is unchanged and unimplemented. Multi-second storage cost and auth interference now reproduce on physical release hardware; their UI impact remains open. Correlation or an awaited source dependency does not establish the historical Focus hang's cause. Key recovery/backup, account transfer/isolation, retained-source deletion policy, native runtime compatibility, and compatible-reader rollback remain approval/validation decisions before migration.

## Physical V4 continuation — 2026-10-12

This checkpoint supersedes the earlier phone-locked testing gaps. On the separate synthetic PERF LAB package, full guest creation and ten process-kill/relaunch checks passed on the S24 Ultra (Android 16/API 36, adaptive approximately 120 Hz): one Anchor/artwork retained, no repeated onboarding/recovery. Activity draw median 559 ms (527–616); Anchor hydration 57–72 ms. Mid-onboarding bridge state also survived one termination/relaunch. Owner and user-touched baseline packages were preserved.

The 72-Anchor/719,217-character cold vault read took 2,430 ms and hydration 2,438 ms. Three physical native bulk writes took 8,235 / 7,170 / 6,403 ms; overlapping auth adapter writes took 8,172 / 7,134 / 6,369 ms versus 37–131 ms controls. Entire synthetic JSON readback matched; 3,683 native calls, zero failures/fallbacks. This confirms release storage cost and controlled auth-storage interference, not the Focus hang or a navigation frame's cause. Historical debug measurements and emulator results remain separate. Details and evidence locations are in the plan's Physical V4 continuation.

Parent reran seven focused suites: 88 tests pass; TypeScript exit zero. Complete PERF-001/082 acceptance, native fault/recovery scenarios, production account ownership/sync and iOS remain pending. The new verified local demo C comped profile permits unchanged-gate premium testing; it does not establish production billing/entitlement. No migration, animation changes, production backend writes, OTA or publication occurred.

## Final V5 release and acceptance boundary — 2026-10-12

At the owner's usage-budget wrap-up, the V5 native release APK was built, verified and installed over only the synthetic PERF LAB package: `E:\apd\record\archive\anchor-perflab20261012-v5-startup-motion-dualabi.apk`, SHA-256 `1702C59554888A30CFAB4AB808467315096484E04928CB1B275C5BCD8DD0A2F7`. Non-debuggable/profileable, production Hermes v96/V2/Fabric, OTA off, demo Auth/loopback API. The V4 Android host-remap failure was corrected in native configuration; physical numeric route result `okCode=1` and normal-UI synthetic C sign-in/PRO profile succeeded. These verify local routing/entitlement only. The guest 72-Anchor/index-21 vault persisted before C sign-in. Post-sign-in Home failed because the fixture lacks GET `/api/anchors` and `/api/auth/me/export`; canonical hydration, ownership transfer and post-C content retention remain unverified. No session ran, and no data-loss conclusion follows from that fixture error.

The matching 72-Anchor adaptive Home–Details subset passed three cycles: 30.657-second partial trace, 859 actual frames/857 expected at 8.333 ms cadence, actual-frame p50/p95/p99/max 7.835/16.213/25.303/166.221 ms. Separate 52.659-second gfxinfo: 25/556 janky (4.50%), five missed vsync, 15 slow bitmap uploads; PSS 636,569 KB. Exact package/PID/start ticks matched at both boundaries. This complements the confirmed-60-Hz subset; it is not a controlled optimization comparison or proof that persistence caused a particular frame.

Final source gates: seven suites/88 tests and TypeScript pass; documented broader subset 12 failing suites/26 assertions, including two retained data-safety assertions. V5 harness 60/60 and parent consumer tests 5/5 pass, with APK-input source parity. Native fault/recovery, Focus x10, full Deep Prime, guided Visualize, Vision/Chart interactions, active audio/haptics, complete account matrix and iOS remain pending. Measured release bulk-write latency and auth-storage interference are confirmed; Focus/navigation causality remains suspected. The next phase must complete isolated canonical fixture coverage and data-safety checks before SQLCipher/key/migration/rollback approval. Section 8's proposal is unchanged and unimplemented.

Temporary local Auth/API services and their 9099/39999 reverses were stopped/removed; three generated synthetic credential files were deleted after exact ownership checks. Owner packages/data and original 8081/8000 reverses were preserved; original null refresh keys and 120 Hz preference restored. Evidence/binaries and synthetic lab data were retained. Full artifact, source inventory, timing, validation gaps and cleanup provenance are in plan section 10. No production write, OTA, publication, framework upgrade or animation/audio change occurred.

## Authenticated Hydration, Account Isolation & Data Safety pass — 2026-10-12

This bounded pass hardened `AuthHydrationService` and post-auth account transition boundaries against five data-integrity edge cases, completed the missing canonical synthetic fixture routes (`GET /api/auth/me`, `GET /api/anchors`, `GET /api/auth/me/export`, `POST /api/anchors`, `PUT /api/anchors/:id`, `POST /api/anchors/:id/charge`, `POST /api/anchors/:id/activate`, `PUT /api/auth/onboarding-context`, `PUT /api/auth/notification-state`) in `docs/performance-audit-2026-10/harness/auth-emulator/fixture-api.cjs`, and verified free/comped/premium gating without destructive Anchor cleanup:

- **Source & unit/integration verification:** **16/16 targeted Jest suites (228/228 tests) PASS** (`AuthHydrationService.test.ts` [22/22], `PostAuthFlowService.test.ts`, `V2FirstRunFlow.test.tsx`, `V2SealedSaveScreen.test.tsx`, `appAuthState.test.ts`, `authStore.test.ts`, `subscriptionStore.test.ts`, `AnchorSyncService.test.ts`, `useTrialStatus.test.ts`, `entitlements.test.ts`, `useAppStartup.test.ts`, `SaveProgressScreen.test.tsx`, `AppStartupHydration.integration.test.tsx`, `useRequiredLocalHydrationGuard.test.ts`, `StartupRestoreFailure.test.tsx`, `reloadCurrentApp.test.ts`); TypeScript (`npx tsc --noEmit --pretty false`) **exit 0**.
- **Isolated Auth Emulator + fixture verification:** `node .\test-fixture.cjs`, `node .\test-fixture.cjs --secondary`, and `node .\test-fixture.cjs --comped` all **PASS (exit 0)** against `demo-anchor-perf` on `127.0.0.1:9099`, verifying canonical profile/anchor/export contracts, guest-to-account first-Anchor creation, free-user second-Anchor `403 CREATE_ANCHOR_FREE_LOCKED` enforcement, comped-account unlimited Anchor creation, and strict cross-account isolation between synthetic accounts A, B, and C.
- **Physical device status:** The physical Galaxy S24 Ultra (`SM-S928U1`) was disconnected over wireless ADB during this pass (`adb devices -l` reported only `emulator-5564`). Physical Android release execution of the updated hydration merge and canonical fixture routes remains open pending physical device reconnection before closing the final hardware data-integrity gate.
