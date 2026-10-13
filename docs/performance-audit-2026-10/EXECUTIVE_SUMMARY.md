# Executive Summary: Anchor 2.0 Performance, Motion and Stability Audit

Date: 2026-10-12. Full detail: `PERFORMANCE_AUDIT_REPORT.md`. Plan: `PERFORMANCE_REMEDIATION_PLAN.md`. The original audit changed no production code. The handoff subsequently authorized the PERF-001 fix, non-destructive baseline work, and a storage proposal. Code/test remediation and remaining runtime acceptance are distinguished below; migration and later phases still require approval.

**Read this first:** the original audit's runtime numbers come from a DEBUG dev-client build on one Galaxy S24 Ultra. This continuation has produced a native release APK; the original measurements remain historical DEBUG evidence. No iOS or mid-range-device baseline exists. Of the original 89 issues, 14 are confirmed and 75 are code-suspected. Confirmed does not mean production-measured.

**Current physical V5 result:** On the isolated S24 PERF LAB, the V4 guest flow passed 10/10 cold relaunches, Home–Details–Home passed 30/30 cycles, carousel passed 20/20 swipes (selection 1→21), and ten 72-Anchor cold launches retained index 21 before account testing. The V5 native release was built and installed; the exact Auth Emulator route check passed, and normal UI sign-in reached synthetic Account C's local PRO profile through the unchanged gate. Home then showed “Unable to load your Anchors” because the loopback fixture lacks GET `/api/anchors` and `/api/auth/me/export`. The pre-sign-in 72-Anchor observation does not establish post-sign-in retention, ownership transfer, or canonical account behavior. No Focus session or motion/recovery/audio acceptance was completed. The V5 source tests passed 60/60, consumer tests 5/5, and TypeScript exited 0; these do not substitute for native acceptance.

The following implementation/emulator paragraph preserves the earlier V4 checkpoint; its old V5-pending and Pro-gate-pending statements are superseded by the final V5 result below. Its emulator measurements remain separate from the S24 results.

**Current execution:** PERF-001/082 auth/startup protection is secured in `9a158b7d`, with mounted-App coverage in branch HEAD `6911321c` (`feat/celebration-layer`). Fresh review corrected a premature 4-second required-store recovery deadline to the documented 10 seconds, preserving splash choreography. Senior final validation passed **7 focused suites / 88 tests**; TypeScript passed. Luna's source/test integrity review reached **9.5/10** after returning the initial 9.4 result for stronger App integration coverage. The current 13-suite broader subset has **12 failures / 26 failing assertions**; both existing `AuthHydrationService` retention failures remain. This subset does not replace section 9's historical full-suite 520/13 and 5,128/27 results. The suite is not globally green, and PERF-001/082 remain native-device-validation pending. Current execution and exact paths are in plan section 10. Wireless ADB now identifies the owner's S24 Ultra; testing is restricted to a separate synthetic-data package. Local native release compilation succeeded. The separate APK is identified in plan section 10. Its first S24 launch measured 1,047 ms to Android activity first draw, which is not Home readiness or a ten-launch baseline. The user interacted with that test installation, so it is now protected alongside the owner app; further synthetic testing uses a fresh lab package. The fresh V4 Android 16/x86_64 software-rendered emulator passed guest create/save plus ten cold relaunches, incomplete onboarding once on the ordinary baseline, and 30 Home–Details–Home cycles and 20 carousel switches. Native local email sign-in, returning-user retention and explicit sign-out/B sign-in were exercised; canonical backend transfer remains unverified. Real native SecureStore timings reproduce bulk latency: 400 chunks took 11.399–12.296 seconds in three controlled writes; concurrent auth writes took 11.335–12.222 seconds versus 52–224 ms alone. These are emulator results, not S24 acceptance. Focus remains unrun behind the preserved Pro gate; storage-to-Focus and storage-to-navigation causality remain unproven. No iOS profiling environment is available. The SQLCipher proposal in section 8 remains **unimplemented and pending approval**, including native/runtime, retention/recovery, and rollback decisions. Premium visuals, motion, sound, and haptics have no remediation changes.

## Totals

| Severity | Total | Confirmed | of which runtime-observed (dev) | Suspected |
|---|---|---|---|---|
| P0 | 1 | 1 | 0 | 0 |
| P1 | 10 | 3 | 2 | 7 |
| P2 | 37 | 8 | 4 | 29 |
| P3 | 41 | 2 | 1 | 39 |
| **Total** | **89** | **14** | **7** | **75** |

## Original audit checkpoint: five highest-impact findings

These findings describe the original audit snapshot. PERF-001 has since been fixed and passed the physical guest-retention checks below; the remaining findings retain their original evidence scope until separately revalidated.

1. **PERF-001 (P0, code-verified at the audit checkpoint; fix implemented): a cold start with no Firebase session called the full `signOut()`**, which could wipe a guest's only Anchor and replay onboarding. The startup fix is secured in `9a158b7d`; the S24 PERF LAB guest-retention path passed 10/10 cold relaunches with the Anchor/artwork preserved. Broader account-transition acceptance remains open.
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

## Physical V4 continuation — 2026-10-12

This checkpoint supersedes the earlier phone-locked testing gaps. On the separate synthetic PERF LAB package, full guest creation and ten process-kill/relaunch checks passed on the S24 Ultra (Android 16/API 36, adaptive approximately 120 Hz): one Anchor/artwork retained, no repeated onboarding/recovery. Activity draw median 559 ms (527–616); Anchor hydration 57–72 ms. Mid-onboarding bridge state also survived one termination/relaunch. Owner and user-touched baseline packages were preserved.

An earlier single 72-Anchor/719,217-character cold-vault run read in 2,430 ms and hydrated in 2,438 ms. Three physical native bulk writes took 8,235 / 7,170 / 6,403 ms; overlapping auth adapter writes took 8,172 / 7,134 / 6,369 ms versus 37–131 ms controls. Entire synthetic JSON readback matched; 3,683 native calls, zero failures/fallbacks. This confirms release storage cost and controlled auth-storage interference, not the Focus hang or a navigation frame's cause. Historical debug measurements and emulator results remain separate. Details and evidence locations are in the plan's Physical V4 continuation.

Parent reran seven focused suites: 88 tests pass; TypeScript exit zero. Complete PERF-001/082 acceptance, native fault/recovery scenarios, production account ownership/sync and iOS remain pending. The new verified local demo C comped profile permits unchanged-gate premium testing; it does not establish production billing/entitlement. No migration, animation changes, production backend writes, OTA or publication occurred.

**Latest physical PERF LAB status (2026-10-12):** The S24 V4 guest create/save path passed 10/10 cold relaunches; Home–Details–Home passed 30/30; and 20/20 real-UI carousel swipes moved selection from index 1 to 21. Ten V4 cold runs used the synthetic 72-Anchor vault (719,217 characters / 400 chunks): SecureStore read 1,962–2,468 ms (median 2,423 ms), Anchor hydration 1,969–2,476 ms (median 2,430.5 ms), activity first draw 505–611 ms (median 595.5 ms); all reported 72 Anchors and zero native read failures. `cold01` remains an incomplete attempt and is excluded. The V5 dual-ABI native APK was installed on the isolated lab package. Numeric Auth route verification passed; UI sign-in reached synthetic C's local PRO profile, then Home failed because the local fixture returns 404 for missing GET `/api/anchors` and `/api/auth/me/export`. No post-C retention, ownership transfer, data loss, or canonical backend claim is made. No Focus session, Deep Prime, Visualize, Vision/Chart, startup-fault recovery, active-audio, iOS, or mid-range Android acceptance was completed. Bounded traces remain partial windows and do not establish full-run frame performance or causality.

**Targeted data-integrity remediation (2026-10-12 continuation):** Investigated and resolved the two retained data-safety failures in `src/services/__tests__/AuthHydrationService.test.ts` (`preserves unsynced local temp anchors during authenticated hydration` and `keeps local progress when anchor hydration fails after login`), both confirmed as Class A production correctness defects caused by an `isLockedFreeUser` purge in `AuthHydrationService.hydrateAuthenticatedData` (`7b3a9315`) combined with destructive fallback to an empty `remoteAnchors` array when `/api/anchors` rejected and lack of in-flight/timestamp merge protection (PERF-039). Removed the destructive local-anchor/pending-draft deletion from `AuthHydrationService`, preserved newer local mutations (`updatedAt` comparison) and in-flight created Anchors across both early and final hydration commits, and retained existing current-account backend Anchors plus `remoteAnchorState: 'error'` when `/api/anchors` fails without export/snapshot recovery. `AuthHydrationService.test.ts` now passes **17/17** (13 existing + 4 new targeted data-safety regression tests), all **12 focused auth/startup/hydration/onboarding suites pass (174/174 tests)**, and TypeScript (`tsc --noEmit`) exits 0. Native device account-transfer/hydration validation and SQLCipher/storage migration approval remain separate open gates.



## Senior data-safety review — 2026-10-13

**Account-transition safety remains OPEN.** Independent review reproduced durable loss of an unsynced Account A Anchor after a direct A→B→A switch in four isolated persistence cases, plus a delayed older write overwriting a newer vault state. Account isolation through filtering is not durable data preservation. Missing timestamp convergence and malformed duplicate backend-ID safety assertions also remain red. Targeted corrections to request/account fencing, first-Anchor retry/progress and onboarding deletion pass **10 suites / 252 tests**; this does not close the retention gate. See `PERFORMANCE_REMEDIATION_PLAN.md`, “Senior data-safety review continuation — 2026-10-13”, for findings, exact changes, active failing gates and the unimplemented storage proposal. Prior audit measurements and issue IDs remain unchanged. Native and TypeScript outcomes appear in its final checkpoint. No production database access, deployment, migration or premium visual/audio changes occurred.

Final checkpoint: TypeScript **exit 0**; synthetic A/B/C fixture tests and owner-bound idempotency replay checks pass. Physical SM-S928U1 and emulator-5564 were connected, but the current-source isolated build failed after **11m54s** at R8 with a Java heap out-of-memory error after JS/resource/Kotlin success. **No current APK was installed; no physical or Android emulator runtime acceptance is claimed.** The older Oct-12 APK was rejected as stale. Owned fixture processes and credentials were cleaned up; owner/device data remained untouched. The data-safety gate remains **NO / OPEN**, with seven active failing safety assertions.
