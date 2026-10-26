# Guidance Phase 1 implementation

Scope: approved Phase 1 cleanup only, in PR-A / PR-B / PR-C order. The coordinator and new teaching surfaces remain deferred. Each changeset is independently revertible; pre-existing worktree changes are excluded.

## PR 1 / PR-A: teaching behavior

- Retired ten outdated eligibility beats, retaining their copy and reset keys.
- Home offers only Today before any completed practice, for a ready, unfinished, non-Release card. Copy uses the card mode and duration, with fully spoken accessibility units; cap is one.
- Dismissal saves only displayed beats. Unshown steps remain unseen.
- Home spotlight hole passes touches through. Chart already used a transparent ring; preserved it, reduced its lesson to the approved one step and recorded readiness once per presentation.
- All five teaching hosts yield to queued/presenting milestones.
- Necessary adaptation to the inspected tree: `useCelebrationActive` also reads the existing `celebrationStore` active/queued scenes. The newer presenter already uses this store; milestone-only blocking would miss other celebrations. This adds no coordinator or persistence and changes no celebration behavior.
- `sessionLog` contains completed entries (completion writer `recordSessionInState`, server history reconstruction), so any entry suppresses Home teaching.

Validation: reproduced 18 failing regression assertions before fixes. Focused teaching and Chart sheet run: 19 suites / 93 tests passed; additional final Chart run: 5 tests passed, including repeated measurement. `npx tsc --noEmit --pretty false` passed. Broader screen regression: 76 suites / 1164 tests passed; one unrelated failure in `V2ChartAskScreen` (undefined `text` passed to `AskRevealText`, outside this changeset).

Remaining: Android/iOS native hit testing (target and hole edge), screen readers, font scaling and celebration overlap need device QA. RNTL checks the native pointer-events contract; it does not simulate coordinate hit testing. Seen-on-display and the process-lifetime session cap remain Phase 2 limitations.

## PR 2 / PR-B: vocabulary and inline copy

- Details empty rows use the approved payoff copy. Used the approved short Vision fallback, “Picture where this leads.” Font-metric check using the bundled Figtree font and the existing 158pt text column at 320pt width: full copy needs three lines at 130%; fallback needs two. Chart row can grow beyond its 76pt minimum; native wrapping remains a device check. Updated Chart's accessible label from the same copy constants.
- Progress session descriptions, mode label and all five Android widget labels now say Deep Focus. The AST guard scans V2 and widget literals/JSX/template fragments, excluding comments and tests, allowing only the server enum and recommendation mapping.
- Verified `MODE_COPY` only creates display session descriptions. `practiceModeLabel` has no consumers; `PRACTICE_MODE_THEME` is consumed only by legacy ThreadStrengthDetailScreen. Per plan, left the legacy label unchanged.
- Strength Buffer descriptions are shared between settings and the explainer; displayed “thins” becomes “softens”. Scoring constants are unchanged.
- Hid the non-functional grace badge under the approved Phase 1 decision; kept streak inputs and calculations.
- The shared `threadStrengthCopy.ts` was already present but untracked at handoff. Included it as a required copy dependency, preserving its existing rules, helpers and all other copy.

Validation: new tests reproduced five failures before fixes. Vocabulary / Progress / Thread / settings: 16 suites / 178 tests passed. Details: 53 tests passed after payoff and accessibility changes. TypeScript passed. Device wrapping at 320pt and 130% still requires native confirmation; the font-metric check is not native layout evidence.
