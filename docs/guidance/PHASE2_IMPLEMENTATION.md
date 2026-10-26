# Guidance Phase 2 implementation â€” 2026-10-26

## A. Implementation summary

The existing six approved teachings now share one app-wide coordinator. Feature hosts retain copy, presentation components, contextual eligibility and real feature operations. The coordinator owns arbitration, readiness, ownership, cancellation, frequency, outcomes, discovery and account-scoped persistence. No persistent backlog or new teaching surface was introduced.

The pure coordinator factory (`src/stores/v2/guidanceCoordinator.ts`) is instantiated once by `src/hooks/v2/guidance/guidanceRuntime.ts`. The V2 navigator binds the authenticated account and completed-move discovery through `useGuidanceLifecycle`. `useGuidanceHost` registers current route/account/context/target identity; `useTeachingQueue` is now a compatibility adapter to it. A separate route/account visit key prevents target changes from reopening a visit budget. Old local queue and Chart presentation ownership were removed.

Arbitration is deterministic: priority, registry order, then host key. One active presentation is allowed. Chart has P0 comprehension priority; other existing items use P1/P2. Arbitration never preempts an active teaching. One ordinary bubble plus one Chart allowance is available per foreground session; whispers are exempt. Backgrounding for at least 30 minutes resets session allowances. A selected but unmeasurable presentation consumes its route visit without charging a presentation attempt or reopening a same-visit retry.

Hosts await account hydration and the existing interaction-idle scheduler. Measurement callbacks, context changes, account transitions, blur, keyboard, native sheets, dialogs and backgrounding invalidate or suppress presentation. Celebration stores remain authoritative: guidance subscribes read-only, cancels active guidance and keeps affected visits quiet after the celebration. It acquires no celebration hold.

An attempt is charged only after actual visibility. A display requires 1,000 ms of continuous visibility; covering/remeasuring pauses the dwell. Whisper visibility starts after its existing entry animation. Outcomes distinguish acknowledged, dismissed, action_performed and obsolete. Captured action callbacks require confirmed success and retain account/record identity across navigation; failed operations do not complete guidance. Discovery marks already-used features obsolete, independently of presentation.

Canonical records extend the existing encrypted persistence adapter with a per-account guidance blob; guest records use the existing guest namespace. Legacy teaching and global/per-course Chart flags are migration inputs only. Guest promotion merges settled history, serializes writes and removes consumed guest migration keys after a successful account save. Malformed/unreadable input fails closed. Existing account legacy keys remain for rollback. Typed scoped/global replay retains discovery and records replay intent so per-course legacy flags cannot silently undo replay. `Show tips` is persisted separately from the existing Guide mode setting.

## B. Migration inventory

| Host / integration | Result |
| --- | --- |
| Home Today | Existing copy and eligibility; shared host, account/anchor context, confirmed navigation and practice-history discovery. |
| Practice switch anchor | Shared host; opening the real switcher confirms action/discovery. |
| Vision first photo | Existing whisper; display timing and photo-use discovery coordinated. |
| Vision lead image | Existing spotlight; actual successful reorder confirms action. False results do not settle it. |
| Chart next move | Local orchestration removed; current course/move and readiness feed shared host. Real completion/word-expansion results are confirmed. Scoped replay only affects Chart. |
| Progress levels | Existing teaching registered with anchor context; opening the existing explainer records discovery. |
| Anchor Details | Existing route context; local compatibility lock for the already-present inline Thread education card prevents competing teaching. |
| Native sheet / dialog / keyboard | Transient suppression signals; sheet lock remains through its exit. |
| Settings / dev Chart hosts | Show tips control and typed replay replace legacy reset strings. |
| Practice completion | Confirmed saved session discovers Today; session/scoring behavior unchanged. |

Retired Practice Today is migration input only; no new fallback was added. The existing Thread inline explanation remains under its existing eligibility until the approved later Thread lesson replaces it. No G2 completion-scene lesson, G8 lesson, copy rewrite, new glow/scoring logic, waypoint rule, Vision generation, subscription, premium or onboarding change is included.

The factory plus external-store adapter implements the shared coordination interface without adding a persisted Zustand presentation queue. Full new `guidance_*` analytics/shadow rollout is deferred; existing presentation telemetry remains, and canonical records provide lifecycle/outcome evidence. Native acceptance is explicitly separate below.

## C. Verification

Final full Jest: **679 suites: 677 passed, 2 failed; 7,751 tests: 7,748 passed, 2 failed, 1 pre-existing skipped; 16 snapshots passed** (511.888 seconds). Final TypeScript exited 0. Exact results and commands are recorded in [verification.json](phase2-20261026/verification.json). The final full run uses the shared working tree, including pre-existing changes; it is not an isolated clean-commit acceptance run. No test was disabled or skipped to obtain a result. The one skipped test was already present.

Focused coordinator, persistence and actual lifecycle-store tests pass 44 tests across 3 suites. Coverage includes competing hosts, dwell, presentation limits, account transitions, failed reads, guest promotion, delayed callbacks, modal/dialog/keyboard/celebration suppression, scoped replay, old Chart flags, shared visit budgets and completed-feature suppression. Navigation wiring tests isolate the lifecycle hook; the separate runtime suite exercises it with actual stores.

Two unrelated Chart failures reproduce with the task-edited modules resolved to their exact pre-task snapshots: 54 passed / 2 failed across 3 suites. This reconstruction uses current dependencies and unchanged shared-tree files, so it is not a pristine historical checkout. [Baseline output](phase2-20261026/baseline-chart-followup.txt):

- `V2ChartAskScreen`: the existing-message test reaches `AskRevealText` with undefined text (`Array.from`).
- `V2ChartFlows`: waypoint test expects `/api/courses/...`; the existing service posts `/api/v2/charts/...`. Guidance does not change that service or completion contract.

The V2 boundary checker remains red: 39 pre-task flagged files and 39 final flagged files, no newly flagged files. This is a file-level comparison, not proof of zero new import edges. See [comparison](phase2-20261026/boundary-comparison.json). Do not describe the overall boundary check as passing.

On the physical Moto, authenticated Home, Progress and Chart rendered. Chart panel expansion and real move-text expansion worked without completing a move. The integrated lesson did not appear after scoped replay for this account; its device-side eligibility reason was not established. These observations do not establish spotlight hit-testing or integrated teaching acceptance. Injected Back from real Progress, with no teaching visible, exited to the launcher. No native-navigation fix was attempted without a cause.

Home startup was slow. Single stable development samples measured app-ready/Home-hydrated at 21.1/29.8 seconds with guidance and 18.1/26.4 seconds with a temporary guidance bypass. The delay persisted without guidance. These samples do not establish a regression budget or rule out overhead. The bypass was restored byte-for-byte before final validation. Existing Metro/package/runtime settings were preserved. [Sanitized native evidence](phase2-20261026/native-checks.json) contains no account screenshots or personal content.

## D. Remaining issues and source scope

Coordinator automated checks have no identified failing test. Native eligibility/presentation remains unverified for an eligible integrated account. Release gates remain: Android Back/root-cause investigation, system Back gesture, TalkBack focus/order/announcements, real celebration overlap, restart persistence, account transitions, integrated narrow/font-scaled overlays, and iOS VoiceOver/touch/placement/safe areas. See [native checklist](phase2-20261026/NATIVE_ACCEPTANCE_CHECKLIST.md).

Slow development startup is unresolved. It should be profiled from app gate through encrypted store hydration and authenticated Home loading on the intended release cohort. The current evidence cannot attribute it to guidance alone. The two Chart test failures and boundary debt remain separate pre-existing issues.

Work began on `feat/vision-conversational-creation-20261020` at `4dad43ec97cb40448eb372ca5a34733e373e979d`, with substantial unrelated dirty work. Foundation commits are `081128d26` and `f0d130052`; integration commit is `6eec57aa8`; an evidence commit follows. Only task deltas were staged against HEAD using an independent index and pre-task byte snapshots. Existing backend, audio, Thread scoring/glow and other feature changes were preserved.

Two integrations depend on pre-existing dirty/untracked Thread UI: the Details inline-education compatibility lock and the explainer discovery hook. They remain in the shared working tree rather than committing the user's entire Thread UI. [Exact task adaptation patch](phase2-20261026/shared-thread-ui-adaptations.json) records original-to-current deltas; it also contains the Details context line already committed. It is evidence for review, not a patch to apply blindly to HEAD. Clean committed source does not independently include those two local UI adaptations. Final tests validate the actual shared tree.

## E. Phase 3 readiness

Before adding teaching content, close the native ownership/measurement/accessibility/persistence/account gates with an eligible QA account and the intended release-like build. Diagnose Back and startup separately. Do not reset the owner's real history simply to force lessons.

For the approved Thread completion-scene lesson, establish the saved-session/celebration boundary, approved copy/variant metadata, exact real-action success contract, target measurement and first-use history predicate. Register the new definition and discovery inputs; add coordinator and host tests for interruptions, repeat limits, account isolation and real celebration precedence. Retire the existing inline compatibility path only when its approved replacement ships. Additional lessons must not create local queues, a second completion store or celebration holds.

## F. Final status

- Phase 2 implementation: complete in the shared working tree, with the two explicitly recorded local Thread UI adaptations.
- Automated verification: complete; TypeScript passes, full Jest has two independently reproduced pre-existing failures, boundary check retains existing debt.
- Native acceptance: partial; integrated lesson presentation and required platform checks remain open.
- Release-ready: no. No merge, push, deployment or release sign-off was performed.
