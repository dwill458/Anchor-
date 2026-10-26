# Phase 1 final acceptance — 2026-10-26

Status: implementation stabilized; full acceptance remains open. No Phase 2 code was implemented.

## Today copy and eligibility

The final approved copy now replaces the mode/duration template:

- Title: **Start here each day.**
- Body: **Today suggests one meaningful action to help you move forward with your Anchor.**
- Action: **Got it**

The card still must have an Anchor, be ready and unfinished, use a non-Release practice mode, and belong to someone with no completed practice. First-practice suppression, persisted seen records, the one-teaching Home cap, celebration blocking, focus/readiness and target visibility protections are unchanged. Tests assert the exact static copy for Focus, internal Deep Prime (Deep Focus), and Visualize, and retain the suppression cases.

Recommendation conflicts are intentionally unresolved: Release could fit the generic wording but remains excluded. After completing Today, a next recommendation remains suppressed by doneToday; any completed practice suppresses this teaching globally. All-practices navigation and future non-practice recommendation types do not gain eligibility. Expanding the recommendation model or eligibility requires a separate product decision.

## Validation after the final code changes

| Check | Result |
| --- | --- |
| Focused guidance Jest | 12 suites, 61 tests passed; exact-copy tests first failed before the correction |
| Complete mobile Jest | 674 suites passed, 1 failed; 7,701 tests passed, 1 failed, 1 existing skipped; 16 snapshots passed |
| TypeScript | `npx.cmd tsc --noEmit --pretty false` exited 0 |
| V2 boundary delta | No new flagged files or import edges |

The full Jest command was `npm.cmd test -- --maxWorkers=2 --workerIdleMemoryLimit=768MB --silent --json --outputFile=<temporary result file> --reporters=default --reporters=<temporary progress reporter>`. It completed in 436.822 seconds. The existing skipped test is ActivationScreen's countdown-format test; this work added no skips or disabled assertions.

The remaining Ask Chart failure is `does not seed into a conversation that already has messages`. Its fixture supplies `{ id: 'old' }` without text; the newer AskRevealText renderer calls `Array.from(text)` and throws. No unrelated Chart source or test was changed to hide it.

Baseline evidence distinguishes two states:

- Clean committed `fbc89f1a3`: Ask Chart suite **16/16 passed**.
- That commit plus the saved original pre-Phase-1 dirty source patch: **15 passed, the same 1 failed**. The owning tracked renderer, message row and test match the current source hashes.

Thus the failure predates guidance in the actual dirty handoff, but does not reproduce on the clean committed baseline. Reproduction used current installed dependencies and current copies of previously untracked supporting modules; it is not a complete historical environment snapshot. Logs and provenance are retained below. Separate follow-up: [issue #344](https://github.com/dwill458/Anchor-/issues/344).

The existing boundary checker still exits 1. Committed baseline versus Phase 1 is 37 flagged files to 37; reconstructed dirty handoff versus final working source is 39 to 39, with zero new import edges. Phase 1 introduced no new boundary violation; the repository-wide boundary gate remains red.

## Native acceptance

The Moto was subsequently made available and tested on 2026-10-26. The earlier native deferral is superseded by [the Moto follow-up and evidence](acceptance-20261026/moto-native/README.md).

Native component checks passed for Home/Chart presentation and target touches, Home hole edges, Got it/scrim dismissal, blocking signals, rapid focus changes, 320 dp / 130% text layouts, extracted Details row wrapping, and native widget-preview terminology. These used the production components in an isolated host with in-memory records; full screen/account integration and launcher-hosted widgets remain pending.

Android Back exited this installed development host without reaching JavaScript, including with no teaching mounted. Root cause and intended-build behavior remain unresolved. TalkBack checks were partial: exposed text/actions and Home double-tap activation were observed; full traversal, spoken output and focus behavior are not accepted. VoiceOver/iOS was not tested. See the follow-up for exact limits and restored device settings.

## Scope and rollback review

The three Phase 1 commits are `1a115e218` (teaching behavior), `bbc1ac298` (copy), and `99a9ab8a6` (legacy hygiene and follow-up coverage).

- Phase 1 changed no Thread Strength scoring, glow behavior, Chart/Vision/Practice domain business logic, or backend logic. Store edits gate only legacy teaching emission; celebration presentation is observed, not redesigned.
- No Phase 2 coordinator, host, registry or record implementation was introduced.
- No accidental unrelated dirty changes were found in the committed Phase 1 diff. There is one intentional pre-existing dependency inclusion: PR 2 tracked the formerly untracked `threadStrengthCopy.ts`. Its content matches the original snapshot except for the three approved decay-copy substitutions; scoring constants/helpers are unchanged. This exception supersedes any blanket statement that no pre-existing work was included.
- The final correction stages only its incremental Home changes against a start-of-pass snapshot, preserving unrelated Home work. Other unrelated dirty files remain outside the acceptance changeset.

**Independent rollback is not fully satisfied.** Each original commit reverses cleanly at its own tree. Against the combined Phase 1 tree, PR 3 reverses cleanly, but PR 1 and PR 2 reverse patches overlap later report/test/settings edits. Reversing **PR 3 → PR 2 → PR 1** in a disposable index restores the exact original committed tree (`22949362c62dbb5c1aa02365187f7a0d263bb9ba`). These checks did not modify the user's index or working files.

Conflict-free out-of-order rollback requires regrouping/restacking the overlapping follow-ups or reviewing explicit revert resolutions. Shared branch history has not been rewritten. The final static-copy correction must also be reverted before that tested three-commit rollback sequence. In this dirty tree, preserve the original formerly-untracked copy dependency before reverting PR 2: unrelated work consumes it. A copy is retained in the evidence directory as a rollback reference, not production code.

## Acceptance decision and remaining gates

Guidance-specific automated regression checks pass, static copy matches approval, and the scope audit found no new business-logic or boundary regression. Full Phase 1 acceptance is **not closed**:

1. Native acceptance remains partial: Back delivery, full TalkBack/VoiceOver, real host integration and launcher widget checks are still open.
2. Conflict-free independent rollback of all three changesets is unproven and the reverse-patch checks expose overlaps.
3. Global automated gates remain red for the pre-existing Ask Chart failure (tracked separately in #344) and existing V2 boundary debt.

No task has been silently treated as passed. This report supersedes the earlier dynamic-copy and independent-revert statements in the implementation log.

## Smallest safe Phase 2 starting point — identified only

Use the existing coordinator architecture blueprint's outcome/record model (§3), persistence/migration contract (§6), and implementation sequence (§13). Begin with record types, the pure `settled()` rule, and fixture-based tests for mapping existing teaching records. Preserve legacy keys and distinguish displayed, dismissed, acknowledged, action-performed and obsolete outcomes; interruptions must not become completion. Do not activate a host, select teaching, write migrated records or replace UI behavior in that first slice. This is a proposed starting point only; none of it was implemented during acceptance.

## Retained evidence

See [validation summary](acceptance-20261026/validation-summary.json), [committed-baseline run](acceptance-20261026/baseline-commit-ask.log), [dirty-handoff run](acceptance-20261026/baseline-handoff-ask.log), [baseline provenance](acceptance-20261026/baseline-provenance.json), [scope and rollback audit](acceptance-20261026/scope-audit.json), and [boundary comparison](acceptance-20261026/boundary-comparison.json). The original copy dependency is under `acceptance-20261026/rollback/`.
