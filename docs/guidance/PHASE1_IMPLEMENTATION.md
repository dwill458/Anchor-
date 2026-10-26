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

Validation: reproduced 18 failing regression assertions before fixes. Focused teaching and Chart sheet run: 19 suites / 93 tests passed; additional final Chart run: 5 tests passed, including repeated measurement. `npx tsc --noEmit --pretty false` passed. Broader screen regression run pending at this checkpoint.

Remaining: Android/iOS native hit testing (target and hole edge), screen readers, font scaling and celebration overlap need device QA. RNTL checks the native pointer-events contract; it does not simulate coordinate hit testing. Seen-on-display and the process-lifetime session cap remain Phase 2 limitations.
