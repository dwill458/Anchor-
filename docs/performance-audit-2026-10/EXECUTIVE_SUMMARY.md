# Executive Summary: Anchor 2.0 Performance, Motion and Stability Audit

Date: 2026-10-12. Full detail: `PERFORMANCE_AUDIT_REPORT.md`. Plan: `PERFORMANCE_REMEDIATION_PLAN.md`. **Audit and plan only; no production code was changed. Awaiting approval before any edit.**

**Read this first:** every runtime number comes from a DEBUG dev-client build on one Galaxy S24 Ultra. No release build, no iOS, no mid-range device, no Perfetto trace. Of 89 issues, 14 are confirmed and 75 are code-suspected. Confirmed does not mean production-measured.

## Totals

| Severity | Total | Confirmed | of which runtime-observed (dev) | Suspected |
|---|---|---|---|---|
| P0 | 1 | 1 | 0 | 0 |
| P1 | 10 | 3 | 2 | 7 |
| P2 | 37 | 8 | 4 | 29 |
| P3 | 41 | 2 | 1 | 39 |
| **Total** | **89** | **14** | **7** | **75** |

## Five highest-impact findings

1. **PERF-001 (P0, code-verified): a cold start with no Firebase session calls the full `signOut()`**, which wipes a guest's only Anchor and replays onboarding. V2 is the production navigator, so this is live. Not yet reproduced on a device.
2. **PERF-002 + PERF-003 (P1, runtime-observed in dev): the Anchor vault is persisted through SecureStore as 719 KB in 400 chunks.** One write took 32.8 s and queued the auth cache behind it; JS `app-ready` came ~36 s in although stores hydrated at 4.3 s. A 10 s Focus session then hung on its completion screen until force-stop (the completion UI awaits a storage write; link to the backlog unproven).
3. **PERF-012 (P2, runtime-observed in dev): each Home-to-Details open costs ~1.5 s of JS stalls and drops 31-35 main-thread frames on 13 of 15 opens.** The first thing to re-measure on a release build; likely causes are PERF-013 (context churn) and PERF-014 (cloud tiles built on JS).
4. **PERF-010 + PERF-042 (P1/P2, library-source read, not yet device-verified): Android audio lifecycle.** Focus/Deep Focus narration and ambient resume under the Paused overlay after backgrounding, and no audio focus means calls, other media and headphone unplug do not pause narration.
5. **PERF-009 + PERF-030 (P1/P2): the network and upload path.** Photos upload as original-resolution base64, 8 in parallel, against an 8 MB limit; launch fires an unbounded full-account export plus duplicate list calls against a 100 requests / 15 min limiter, with a 120 s default timeout and no timeout at all on the startup sync (PERF-005).

## Main shared root causes

- **RC-1** (6 issues): Persistence layer: bulk state in SecureStore, non-atomic, unbatched, serialised queue awaited on UI-critical paths
- **RC-2** (9 issues): Account/guest state integrity across startup, creation and hydration
- **RC-3** (8 issues): Network layer: no real timeouts, launch fan-out, chatty polling, no compression, tight limiter
- **RC-4** (8 issues): Heavy work during navigation / transition architecture (JS commits and mounts inside the hero flight)
- **RC-5** (11 issues): Per-frame layout-prop animation and whole-canvas redraws (animation ownership on the wrong thread/prop class)
- **RC-6** (4 issues): JS-clock-driven visuals and cues running parallel to UI-thread animation
- **RC-7** (18 issues): Audio/haptic lifecycle: native auto-resume, no audio focus, pool ownership, ordering
- **RC-8** (11 issues): Image and asset lifecycle: oversize decode, unstable URLs, bundle bloat, long-session memory
- **RC-9** (13 issues): Failure recovery, dead-ends and accessibility edges (timeouts, locks, boundaries, route hygiene)
- **RC-10** (1 issues): Startup concurrency and observability cost

## Recommended repair order

1. Phase 0: build and measure a release baseline; reproduce PERF-001/010/011/041/042 on a device. Blocks everything else.
2. Quick, independent, high value: PERF-001 (+082), PERF-007, PERF-009 backend resize, PERF-005/040 timeouts.
3. Persistence project: PERF-004 + 002 + 029 + 088, then PERF-003 and 036.
4. Creation/guest correctness (PERF-008, 035, 006, 039) and Release/paywall/boundary recovery.
5. Re-profile, then rendering (transition architecture, layout-to-transform, Skia gating, UI-thread clocks), Reduce Motion early, 120 Hz policy last.
6. Audio lifecycle guard (one shared change), session controls, SoundPool correctness, haptics.
7. Resources (images/URLs, launch fan-out, memory source, bundle), then the visual-parity regression gate.

## Highest-risk regressions to guard against

- Data loss in the storage migration (PERF-002/004): write new, verify, flip, delete old; flag it; keep the legacy reader.
- Blank-frame or teleporting-Anchor regressions in the hero transition (PERF-013): the detector must read 0; keep the watchdog and `reset()` fallback.
- Visualize clock drift or snap (PERF-021): audio must remain the master clock; keep the deterministic tests.
- Vision board gesture/reorder races (PERF-018): last in Phase 2, behind recordings.
- Visual popping at Skia gating/baking handovers (PERF-020/022) and baked cloud-tile or mask differences (PERF-014).
- Audio behaviour changes: `doNotMix` stops the user's music (PERF-042); restarting pooled cues truncates tails (PERF-047); the `wantPlaying` guard must not fight the Visualize fix.
- Creation failure semantics (PERF-008) and Reduce Motion first-render change (PERF-024).

## Estimated complexity per phase (order-of-magnitude, one engineer; not commitments)

| Phase | Scope | Complexity | Rough effort |
|---|---|---|---|
| 0 Baseline and repro | release build, harness, device repro | S | 2-4 days |
| 1 Stability and data integrity | P0 + persistence + network bounds + creation/guest + recovery | XL | 15-25 days |
| 2 Rendering and frame pacing | transition architecture, transforms, Skia, clocks, traced jank | XL | 15-25 days |
| 3 Audio, haptics, sync | lifecycle guard, controls, SoundPool, haptics | L | 10-15 days |
| 4 Resources | images/URLs, launch fan-out, memory, bundle | L | 10-15 days |
| 5 Parity regression | goldens, full re-run, iOS + mid-range | M | 5-8 days + fix loop |

## What requires physical-device validation before release

- A release/profiling build re-run of every runtime-observed item (PERF-002, 003, 012, 016, 017, 025, 050).
- Guest cold start, mid-onboarding kill, and a 72-Anchor cold start (PERF-001, 002, 082).
- Android audio matrix: background/return, calls, other media, earbud unplug, Bluetooth off (PERF-010, 041, 042).
- Throttled and blackholed network launches and creates/releases (PERF-005, 033, 034).
- Chart, Visualize playback, Deep Focus, Release/Evolve and Vision creation, none of which were exercised at runtime.
- Every transition and Skia screen on a mid-range Android and a physical iPhone with Instruments (zero iOS coverage today).
- Reduce Motion on for every changed screen; an unplugged thermal/battery soak.

## Decisions needed from you

Listed in `PERFORMANCE_REMEDIATION_PLAN.md` section 7: where bulk state should live and whether the vault must be encrypted at rest (PERF-002), Android audio focus policy (PERF-042), what "Ambient" means when a voice mix includes its bed (PERF-043), whether bundled 192 kbps mixes were deliberate (PERF-028), image URL lifetime (PERF-027), and a few "is this stepped/replaying motion intentional?" questions (PERF-023, 052).
