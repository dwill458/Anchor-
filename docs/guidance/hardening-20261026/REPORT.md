# Phase 2 acceptance and hardening -- 2026-10-26

Status: **targeted fixes implemented; actual-app acceptance remains blocked. No release sign-off. No Phase 3 work.**

## Repository and evidence

Started on `feat/vision-conversational-creation-20261020`, HEAD `1e2bf6c6433e258bd9cf03b75c1ba5ecf11a0546`. Read the four root audit/architecture documents, `docs/guidance/PHASE2_IMPLEMENTATION.md`, and the Phase 2 verification, native checklist, baseline, source hashes and Thread adaptation evidence. Foundation commits: `081128d26`, `f0d130052`, `6eec57aa8`; evidence: `1e2bf6c64`.

`starting-status.txt` records the extensive pre-existing dirty tree. No files were staged, committed, reset or cleaned. No business milestones were completed, no teaching history was cleared, no account was signed out. Unrelated Thread, backend, audio, Chart motion and startup work remains in place. `hardening-only.patch` isolates this task from the owner's dirty Home/ChartSheetContent edits; it is for review against the recorded shared-tree baseline, not blind application to HEAD. `source-scope.json` lists every task source/test path.

## 1. Missing integrated Chart lesson

**The historical Moto suppression reason is still not established.** This work proves a measurement defect, but does not prove it caused that observation. Source eligibility and automated reproduction are distinct from observing an eligible owner/QA account on a device.

Trace of the actual implementation:

| Gate | Source and behavior | Device conclusion |
| --- | --- | --- |
| Registration | `ChartActiveView` registers `chart.next_move` through `useGuidanceHost`; priority 0 in `guidanceRegistry`. | Not reached in this session's authenticated navigation. |
| Hydration | `useGuidanceLifecycle` binds the auth account. Host waits for encrypted records and Chart per-course legacy migration, then interaction idle. Rejected reads fail closed. | Auth/anchor/session reads appeared in earlier dev logs; no current complete coordinator trace. |
| Course/move | Candidate requires `oneMove`, unfinished course and `completedMoveCount === 0`. Course and move identities bind the host key. | Owner's current course and count not inspected; do not infer eligibility from a visible move row. |
| Discovery | Bound-account, ready course history with a completed move discovers Chart; `ChartActiveView` also discovers from completed-move count; expanding real move words discovers it. | Existing discovery not read or reset. |
| Replay | Scoped replay clears Chart presentation records and allowance, preserves discovery, reconstructs `obsolete/learned_by_use`; explicit replay prevents legacy per-course flags re-importing. | Replay is not a force-show. Architecture section 6.4 explicitly says users with completed moves should not see G6 again. |
| Preference | Runtime `tips` lock when persisted `showTips === false`. Separate from Guide mode. | Current value unverified. |
| Visit | Route/account visit ownership survives course/target replacement. Selection reserves one visit. | Current visit/quiet sets unverified. |
| Arbitration | Registry priority, then registry order, then host key; no preemption of an active teaching. | No evidence of competing active teaching on device. |
| Session | Chart has its own single P0 allowance; ordinary bubble allowance is separate. Charge starts only at visibility. | Current allowance unverified. |
| Target | Real row/circle/body refs plus root/window/viewport measurements. Chart can request sheet expansion; stale callbacks are generation-checked. | Integrated measurement unverified. |
| Ready | Focused, idle, opening complete, refs mounted, not day hold/busy/reaching/dialog/menu/ceremony; current host allows peek/half. | No current authenticated trace. Full-detent compatibility remains an acceptance concern at large text sizes. |
| Suppression | Runtime reads keyboard, native sheets, dialog, foreground, Show tips and celebration stores. Celebrations quiet the visit and hold no teaching dependency. | Not observed with a live lesson. |
| Lifecycle | Visibility starts attempt/session accounting; 1000ms continuous visible dwell starts display accounting; real action needs confirmed success; tokens reject stale actions. | Automated evidence only. |

Correct suppression is established **conditionally** for completed-feature discovery, disabled tips, spent allowance, quiet celebration visits and unready contexts. Which condition applied to the historical Moto run remains unknown.

Temporary privacy-safe host/startup diagnostics were tried and removed. The current native debugger advertised a Hermes endpoint but closed evaluation connections with code 1006. No personal account values are included in the saved evidence.

## 2-3. Confirmed defects and measurement recovery

Confirmed by failing tests before the correction:

- A selection that never became visible spent the entire visit. Later target layout could not recover it. Pure coordinator and real hook reproductions failed before the fix.
- `SpotlightCoach` scheduled both RAF and a 16ms fallback without a one-shot guard. Both could measure, announce and report ready for the same step. A one-shot guard now covers both callback orders.

Implemented recovery:

- Optional `targetRevision` is a readiness event, separate from host/context identity. It does not unmount or reopen the visit.
- Automatic 1500ms presentation timeout and explicit `unmeasurable`/`timeout` can wait for a changed target revision, only before any actual visibility.
- Maximum initial selection plus two recoveries per visit, preserved when another feature is replayed. No polling, timer-only rearming, extra persisted attempts or extra session charges for unrendered selections.
- Readiness changes received during the first measurement window are retained. At timeout they can enable one bounded recovery.
- Completed/visible/ordinary-cancelled visits cannot rearm. Blur, unregister, candidate loss, modal/celebration locks, account changes and backgrounding cancel recovery, including a recovery already queued for arbitration.
- Home forwards real Today wrapper layout changes. Chart forwards viewport and move-stack layout changes. Host hydration completion reads the latest revision.
- Chart's existing 180ms measurement interval was removed. Root layout, viewport/detent changes and a single 16ms deferred measurement drive measurement. Existing generation checks continue to reject late native callbacks.

Regression evidence: final focused run passed 13 suites / 192 tests. An additional scoped-replay retry-bound regression failed (4 selections instead of 3), was corrected, and passes alongside the coordinator/host suites. Final comprehensive counts follow below. Includes pure coordinator, real runtime/host hook, persistence, Spotlight, Chart overlay/sheet/active view, Home and teaching compatibility adapter. Both scheduler orders, late target layout, events before timeout, retry bounds and cancellation are covered. This is not integrated native acceptance.

## 4. Clean-checkout Thread dependencies

**Clean-checkout equivalence is not achieved; exact dependencies are now documented below.** Adding only the Phase 2 adaptation hunks would reference unfinished UI missing from HEAD. No owner Thread UI was staged or committed.

| Dependency | HEAD | Existing working tree | Safe integration |
| --- | --- | --- | --- |
| Details inline card lock | Details has no education card/import/eligibility hook. | Imports untracked `ThreadStrengthEducationCard.tsx`, reads `useThreadStrengthEducation(realThreadValue)`, renders `educationShown`, acquires the layout-effect surface lock; depends on unfinished Details changes and teaching flags. | Land the owner's card + eligibility and Details integration as their own reviewed feature change. Apply the lock, Show tips/focus/celebration/explainer conditions and release cleanup in the same change. Do not add a lock to HEAD when no card is rendered. |
| Explainer discovery | Progress opens committed legacy `components/ThreadStrengthSheet.tsx`; Details' new explainer route is absent. | Progress and Details open untracked `ThreadStrengthExplainerSheet.tsx`. Its opening captures `beginGuidanceAction(account, 'progress.levels', 'link:explainer')`, confirms success and calls discovery. | Land the owner's explainer and caller changes together, retaining account-bound action capture and once-per-opening discovery. Alternatively add the same opening contract to the committed Progress caller around its existing legacy sheet, and later move it into the new sheet. Keep old and new opening hooks from double-reporting. |

Supporting paths: `components/v2/progress/V2ProgressHero.tsx`, `screens/v2/anchors/V2AnchorDetailsScreen.tsx`, `components/v2/thread/ThreadStrengthEducationCard.tsx`, `components/v2/thread/ThreadStrengthExplainerSheet.tsx`, the existing `teachingStore` flags and practice-completion pending-education signal. Exact prior integration deltas are in `../phase2-20261026/shared-thread-ui-adaptations.json`. This is an integration plan, not implemented Thread changes.

Before sign-off: assemble only that explicitly reviewed Thread change plus coordinator commits in a separate clean checkout, then test real explainer discovery and card-vs-guidance exclusion with the actual components. Current shared-tree tests cannot establish that clean-checkout result.

## 5. Android Back

Available device: Moto g play (2024), Android 14, package `com.anchorintentions.app`, version 2.0.0/code 39, DEBUGGABLE, targetSdk 36; gesture-navigation setting was 2. Only one Android device was available (USB and Wi-Fi list entries refer to the same Moto). No release-like package was installed.

Prior evidence remains: injected Back from real Progress exited to launcher with no teaching visible. This session could not reach that authenticated stack because of the startup blocker. Do not use Back from the recovery screen or developer launcher to infer app stack handling.

Inspected JS Back handlers, navigator registrations, `MainActivity.invokeDefaultOnBackPressed`, manifest and installed React Native `ReactActivity.java`. The library contains its targetSdk-36 dispatcher callback; native defaults and JS consumption must be instrumented on the actual build to distinguish event delivery from an unhandled root fallback. Source inspection does not establish receipt or handling on the installed device. No Back fix was made without a confirmed cause. Hardware/key Back with/without visible guidance, system Back gesture, and release-like comparison remain pending.

## 6. Startup performance

This session observed the real app's **Unable to restore saved data** recovery surface after restart/reload, before authenticated Home. `native-restore-blocker.png` contains only that generic surface. The owner storage was preserved; no unrelated startup/storage repair was attempted.

Three subsequent startup attempts are recorded in `startup-runs.json`: native activity TotalTime 2921, 2627 and 2640ms, with 46.5, 45.6 and 45.7s observation windows. None logged app-ready or provided Home/coordinator timing. These attempts ran while Jest used the host and did not positively detect the restore message during their observation windows and must be treated as incomplete developer-client launches, not successful restored-app samples. Native activity launch is not the first interactive Home frame.

`native-startup-observations.json` separately captures an opportunistic development reload: anchor hydration observed at 11641ms after App mount, session at 13828ms, auth at 14230ms. These are separate from the three attempted launches, have a JS clock origin, and are not native-entry measurements or a controlled benchmark.

No valid enabled/bypass paired comparison was obtained. Guidance history hydration duration, coordinator initialization duration, screen-data hydration, navigation readiness and first interactive Home frame remain unmeasured. The earlier Phase 2 single enabled/bypass samples are not upgraded to benchmark evidence. No performance improvement or guidance overhead claim is justified.

Remaining profiling procedure: use an eligible isolated QA account and verified runtime, collect native-entry and JS clock-aligned markers, three or more alternating enabled/bypass runs with identical cache/auth/data conditions, then median/range for each named stage and a real interaction/frame marker. Bypass must be development-only, suppress host/runtime work without changing auth/storage/navigation, and be removed or restored before final verification. Do not run CPU-heavy Jest sweeps concurrently with those performance runs.

## 7. Native acceptance

| Acceptance item | Result |
| --- | --- |
| Real Home / Chart lesson actually visible | Blocked this session; not accepted. |
| Spotlight target touch, real action, dismissal and replay | Automated coverage passed; native pending. |
| Navigation cancellation / celebration precedence | Automated coverage passed; real-screen native pending. |
| Account persistence, switch, restart | Automated coverage passed; native pending. No owner history reset. |
| TalkBack reading order / focus / announcements | Pending integrated lesson. |
| Text scaling / target positioning | Pending integrated lesson. |
| Android hardware and gesture Back | Pending actual navigation and release-like cohort. |
| iOS | Pending: no iOS environment. |

No isolated harness result is being substituted for these checks. The isolated eligible QA account/setup requested during this run was not supplied.

## 8. Validation

Final frozen-source validation (see `verification.json`):

| Check | Exact outcome |
| --- | --- |
| Complete Jest | 681 suites: 678 passed, 3 failed. 7771 tests: 7767 passed, 3 failed, 1 existing skipped. 16/16 snapshots passed. 566.763 seconds. |
| Focused coordinator/screens | 13/13 suites, 192/192 tests passed. |
| TypeScript | `tsc --noEmit --pretty false`, exit 0. |
| V2 boundary | Exit 1, 39 flagged files; same count as prior Phase 2. Existing debt, not a passing check or fresh import-edge comparison. |
| Source stability | All 12 hardening source/test file hashes unchanged during the final complete sweep. |
| Patch check | Reverse dry run passes with `--ignore-whitespace` for Windows line endings. No files applied or staged. |

All three final failed test names match the reconstructed baseline. No test was disabled or skipped for this work. The first broad sweep and early failed reproduction/resolver attempts are retained as intermediate evidence; `*-final.*` and `verification.json` are the final results. Machine-readable commands, test names, hashes and scope are saved alongside this report. This is shared-tree verification, not clean-checkout or native acceptance.

Reconstructed pre-hardening Chart baseline: 3 suites failed, 53 tests passed, 3 failed (56 total). The two original failures remain separate:

1. Existing-message Ask screen reaches `AskRevealText` with undefined text (`Array.from`).
2. Waypoint completion test expects `/api/courses/...`, implementation uses `/api/v2/charts/...`.

A third current shared-tree failure also reproduces before hardening: `V2ChartScreen` expects the removed `Ask Chart` heading. It is not folded into a coordinator issue. Reconstruction uses exact HEAD bytes for previously clean edited modules and removes only this task's deltas from already-dirty Home/ChartSheetContent; all other shared-tree dependencies remain current. See `baseline-provenance.json` and `baseline-chart-final.*`. It is not pristine historical checkout evidence. Earlier baseline attempts had resolver errors and are not acceptance evidence.

## 9. Remaining release blockers

- Historical integrated Chart suppression reason not observed; eligible actual-screen teaching unproven.
- Owner/client startup recovery and debugger connection obstruct device validation.
- Clean-checkout Thread equivalence pending separately reviewed owner UI integration.
- Android Back event delivery/handling and release-like/system-gesture verification pending.
- Controlled native-entry-to-interactive-Home enabled/bypass profile missing.
- Integrated accessibility, text scaling, celebration, account-switch and restart gates pending; iOS pending.
- Three independently reproduced Chart failures and existing import-boundary debt remain separate issues.

Automatic approval review rejected a second Metro launch command with "blocked by policy" and provided no more specific reason. That fallback was not retried by another route. The existing Metro session was retained.
