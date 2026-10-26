# Guidance Phase 3 — Contextual Thread Strength education

Status: source implementation complete; automated verification recorded below. **Not release-ready. Integrated native and Phase 2 acceptance gates remain open.**

## A. Implementation

`thread.glow` is a first-class P0 coordinator scene line in the shared Focus/Deep Focus/Visualize completion experience. It does not run on Home, Chart, Progress or launch.

- Variant A uses the existing `first` scene classification: first-practice history/lifetime count and the existing first-scene flag. Copy: “As your Thread Strength grows, so does your Anchor's glow.”
- Variant B uses the existing `repeat` classification after an actual positive movement. Copy: “Your Thread Strength grew — and your Anchor's glow with it.” Returning users, including users whose first scene was missed, receive this variant once.
- Old `hasSeenThreadStrengthEducation` and old Progress/Home exposure flags do not settle the new relationship lesson. This follows blueprint D-03 and G2. A new voluntary explainer opening retires it through discovery. No onboarding flags or history are reset.
- The approved blueprint restricts G2 to `first`/`repeat`. Stage, Full Strength, zero/negative gain, missing/nonfinite/out-of-range results, unsaved sessions and unidentified sessions do not carry it. At zero, no claim about a lit glow is made.

The implementation requires **canonical synced session movement**, not the fallback Anchor snapshots that the existing completion screen can display. `PracticeCompletionService.flush` copies the server movement into the canonical practice record; the existing session screen forwards its before/after fields and an explicit verification flag. Saved locally but unsynced practice cannot trigger teaching. This changes no session recording or sync semantics.

## B. Lifecycle

1. Practice saves through the existing service. The completion experience remains usable while sync is pending.
2. Server movement populates canonical `threadStrengthBefore`/`threadStrengthAfter`; the caller verifies a synced record and finite fields.
3. The existing completion hook runs its existing bar/glow timeline. Its natural `finishScene` callback exposes `educationReady`, keyed to the exact session and matching before/after values. No teaching timeout is added. Existing animation formulas/timings remain unchanged.
4. Only a verified positive first/repeat result with a naturally finished transition can register an eligible lesson. Interrupted, skipped, dropped or remounted timelines have no new education-ready callback and stay silent. Reduced motion uses the existing crossfade completion callback.
5. The host binds route, account, Anchor and session identity and waits for record hydration and interaction idle. The coordinator arbitrates P0, enforces Show tips, foreground and modal locks, and allows one active teaching.
6. Queued/active milestone and scene celebrations retain priority. Scene lines are exempt from the bubble-only quiet-visit/session allowance rule, so an unselected line may appear after celebration only while the same completion remains valid. A line interrupted after selection does not restart in that visit. No milestone hold API was added or changed.
7. Native layout and scroll coordinates establish whether the entire line is inside the actual completion scroll viewport. Only then does it report visibility. Continuous uncovered visibility for 1,000ms increments displayCount, which settles this scene line. Covering/backgrounding/navigation cancels dwell.
8. Dismiss records `dismissed`; voluntary explainer opening confirms an active `action_performed` and discovers the two related Thread teachings. Other lesson records are untouched. Continue/Again remain the original product actions and do not require lesson acknowledgement.
9. Blur, Continue/Again, background/inactive or account replacement invalidate the completion lesson. Unmount unregisters it. There is no persisted pending-message queue and no later-screen delivery.
10. Existing encrypted account records save the variant, display, attempt and outcome. Guest promotion and restart use the existing record repository. Replay clears presentation records while retaining discovery: learned-by-use lessons remain retired, and otherwise glow replay still waits for another qualifying completion.

## C. Registry

| Entry | Change |
| --- | --- |
| `thread.glow` | Added; P0, scene_line, version-1 record convention; completion on first qualified display; variants A/B; explicit dismissal/action supported. No finite retry cap prematurely marks an unlearned interrupted lesson obsolete. |
| `progress.levels` | Existing identity and presentation retained; the shared explainer now also discovers the glow relationship. |
| Legacy Details card | Automatic production consumer, local eligibility call, surface lock and completion pending-flag writer retired. It was not a canonical registry entry. |
| Other existing entries | No content/eligibility expansion. Shared scene-line support preserves existing bubble and whisper rules. |

Legacy teaching-store fields, stored values and the card/hook compatibility export are retained for rollback; there is no production caller of that card/hook. No destructive history migration is needed. New glow records start absent, independent of legacy exposure. Regression tests keep old pending history intact while proving Details does not present it.

## D. UX and explanation

The Anchor and existing result remain the hero. A body-small secondary line and wrapping, minimum-44-point text controls sit after the result note. There is no scrim, extra artwork, numeric duplicate, forced step or new animation. The completion result group can scroll when content exceeds the available area; the footer remains outside it. Once measured, the lesson retains its space when hidden, preventing another artwork recenter during departure or celebration yield. This is the smallest layout accommodation made for longer text and narrow screens; native geometry still requires acceptance.

“What’s Thread Strength?” opens the existing `ThreadStrengthExplainerSheet` only when pressed. It remains accessible through the existing Details label and Progress hero. Existing sheet scrim/Back/swipe dismissal is preserved and an explicit accessible Close control is added.

Copy was checked against current `backend/src/services/v2/ThreadStrengthService.ts`, the mobile level table and `threadAuraModel.ts`: eligible activation +12 once (legacy exemptions preserved), daily return +1.5, 0.5 per eligible minute, 600-second daily credited-time cap, maximum 100, Release earns no Strength, decay 3 per counted missed day after sensitivity buffer (2/1/0), Rest Days excluded, and no strength glow at zero. Copy no longer promises every session increases Strength. Surface/Grounded/Rooted/Embedded/Sovereign and their existing thresholds are reused. No scoring, glow, decay, buffer, Rest Days or threshold implementation changed.

## E. Reproducible source baseline

Starting branch: `feat/vision-conversational-creation-20261020`; starting clean HEAD: `b760fb116`. This previously saved owner commit already contains the Thread UI that Phase 2 reported as dirty/untracked. Phase 3 does not newly stage unrelated unfinished Thread work.

Required baseline files are verified as tracked objects in `b760fb116` in `source-baseline.json`: shared explainer, legacy education compatibility export, Progress hero, Details consumer, ThreadAura/model, Focus artwork, PracticeCompletionService and teaching store. Assemble from **b760fb116 plus the Phase 3 commits**, not by cherry-picking onto the earlier coordinator-only commit `1e2bf6c64`. The original Phase 2 shared-UI adaptation patch is historical evidence, not an additional patch to apply.

Changesets:

1. `fd6b364ae`: completion registry, result verification, lifecycle and integration tests.
2. `d58dac5ea`: shared explainer discovery and earning-cap copy.
3. `f8c0e5890`: retire automatic Details education and pending writer; preserve history.
4. `ab352c4a7`: viewport visibility and completion ownership regressions.
5. `b78c9c682`: activation eligibility, Release and zero-glow explanatory copy.
6. `583dae78a`: preserve measured teaching space during departure/yield; actual completion background and starting-milestone regressions.

The last three commits harden PR1/PR2; they add no PR4 teaching or new product scope. Nothing was pushed, merged, deployed or released. Source hashes and exact changed paths are retained. Reproducible committed source does not imply a fresh dependency install, new native binary or on-device acceptance.

## F. Verification

See `verification.json`, `focused.json`, `full-jest.json` and logs for exact commands/counts. Final focused validation: **12/12 suites, 245/245 tests, no skipped tests** (37.987 seconds). Final TypeScript: **exit 0**. Boundary: **exit 1, 39 pre-existing flagged files, none added or removed**; this is file-level comparison, not individual import-edge analysis. **Full Jest: 682 suites: 679 passed, 3 failed; 7,800 tests: 7,796 passed, 3 failed, 1 existing skipped; all 16 snapshots passed (639.424 seconds).** All three failed assertion names exactly match the Phase 2 independently reproduced set; the affected Chart sources/tests are unchanged from starting commit b760fb116. No new failing assertion was identified. This run does not independently rerun that earlier baseline. Source hashes remained unchanged through final verification.

Coverage combines new Phase 3 tests and existing coordinator/service/scene suites:

| Case | Automated evidence |
| --- | --- |
| First Practice / reduced motion / returning positive | Actual completion screen + real host/coordinator; variant predicate and natural scene-end tests. |
| No increase / zero / failed or unsaved / unknown result | Parameterized predicate, existing save/scene/Visualize tests; unverified snapshot integration regression. |
| Interrupted animation / repeated callbacks / remount | Existing scene tests with education-ready assertions; host/runtime duplicate accounting and generic visit ownership. |
| Exit / background / account replacement | Actual completion Continue, background/foreground and account-replacement tests plus shared coordinator foreground/cancellation tests. |
| Celebration precedence / one active / priority | Actual runtime queued milestone and completion-screen starting-milestone tests, scene preemption tests and coordinator arbitration/quiet-visit tests. |
| Already learned / guest promotion / restart | Display settlement, discovery/replay tests and new persisted glow variant/discovery promotion/restart regression. |
| Show tips / dismissal / discovery / no stale navigation | Real runtime suppression and blocked-exit tests, explicit dismiss tests, explainer opening/discovery test and Details retirement regression. |
| Viewport / dwell / controls / reading order | Layout/scroll visibility unit tests, continuous-dwell coordinator tests, component accessibility props and wrapping controls; native reading order/hit testing remain unverified. |

The old Details-card replacement test was observed failing before retirement (the retained pending flag rendered the card), then passed after removal. The new coordinator scene-line test also failed before registration/exemption and passed after implementation. No unrelated tests were disabled. Targeted `-t` development runs skip unmatched tests by filtering; they are not presented as the complete focused/full results.

**Native tests performed for Phase 3: none accepted.** An `adb devices` inventory attempt did not return and was stopped. No app data, teaching history or account was cleared; no native release-like build or iOS environment was available/validated. No screenshot, TalkBack, VoiceOver, native narrow/font-scaled layout, native glow frame synchronization, interaction, gesture/hardware Back or real restart/account transition acceptance is claimed. Jest uses mocked native animation/layout boundaries and does not establish those outcomes.

The full-run failures are:

- `V2ChartFlows`: waypoint completion expects `/api/courses/...`; current service uses `/api/v2/charts/...`.
- `V2ChartAskScreen`: the existing-message case passes undefined text into `AskRevealText`.
- `V2ChartScreen`: an expectation still looks for the removed “Ask Chart” heading.

Their assertion names were compared programmatically with `hardening-20261026/full-jest-final.json`. They are recorded as the previously reproduced failures, not silently fixed or disabled in Phase 3. See `verification.json` for the complete names and machine counts.

## G. Remaining release risks

Carry forward Phase 2 hardening REPORT without upgrading its evidence: startup saved-data restoration blocker, unobserved eligible native Home/Chart lesson presentation, Android hardware/gesture Back event handling, full application presentation, controlled startup performance, native accessibility/text scaling/touch targets, actual celebration overlap, account/restart transitions, release-like cohort and iOS acceptance. The three known Chart failures and 39-file V2 import-boundary debt remain separate from teaching implementation. Native verification must use the actual authenticated route and intended build; no standalone harness substitutes for it.

## H. Further contextual guidance

No additional teaching was implemented. G1 Practice/Today discovery, Vision first-photo/lead-image assistance and Chart next-move comprehension already run through Phase 2. There is no demonstrated gap here that justifies adding another unsolicited explanation.

G8 `weekly.first` is approved but is not automatically ready: the current V2 recap already has RecapOpening and a server-authored next action. Before adding a card, establish the remaining comprehension gap, wire account-aware distinct-week discovery/retirement and verify the relevant next-action section. Keep that work independent from glow. A separate weekly “Rest Days” allowance remains outside teaching scope; the blueprint identifies that naming/behavior conflict and requires separate product/Progress work. No next phase started.

The first broad run was stopped when final geometry/coverage refinements were added; its partial output is retained as `intermediate-full-jest.txt`. Only the final complete run is reported as full-suite verification.

A subsequent unchanged-source `--runInBand` full run was stopped after its process grew to approximately 4 GB without a final summary. Its partial output is `intermediate-memory-growth-full-jest.txt`; no pass/fail counts are inferred from it. The final complete command uses `--maxWorkers=2 --workerIdleMemoryLimit=512MB` (supported by the installed Jest configuration). This bounds worker lifetime without changing test selection, source, assertions or timeouts. The memory growth was observed in the test runner and is not attributed to the app or guidance.

Text command logs are normalized to LF with trailing whitespace removed; assertion text and machine-readable results are preserved.
