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
- Strength Buffer descriptions match between settings and the explainer; displayed “thins” becomes “softens”. Scoring constants are unchanged.
- Hid the non-functional grace badge under the approved Phase 1 decision; kept streak inputs and calculations.
- The shared `threadStrengthCopy.ts` was already present but untracked at handoff. Included it as a required copy dependency, preserving its existing rules, helpers and all other copy.

Validation: new tests reproduced five failures before fixes. Vocabulary / Progress / Thread / settings: 16 suites / 178 tests passed. Details: 53 tests passed after payoff and accessibility changes. TypeScript passed. Device wrapping at 320pt and 130% still requires native confirmation; the font-metric check is not native layout evidence.

## PR 3 / PR-C: legacy hygiene

- Anchor creation and completed-session recording retain returning-user flags but queue legacy milestones only when V2 is explicitly disabled.
- V2 navigator clears the old pending backlog once after teaching-store hydration; the hydration listener is removed on unmount. It never clears story flags.
- Removed both IntentionInput legacy gates, whisper state and idle/hesitation timers. Kept field behavior, the scroll-to-field timer, static hints and the “Short. Present. Felt.” info sheet.
- Added `resetTeachingRecords()` and used it in Help & about and the development lab. All user flags survive Replay, including arrival, practice and Thread education flags. Sign-out/account-switch still call the full `reset()`.
- Corrected App's navigator comment and the isolation document: V2 is default unless the flag is exactly `false`.

Validation: new tests reproduced six behavior failures before fixes (plus one stale settings wording assertion from PR 2, updated to “softens”). Expanded store, settings, intention and navigator run: 7 suites / 171 tests passed. TypeScript passed. The full-suite results and final follow-ups are recorded below.

## Validation boundaries

All checks ran in the existing shared working tree on `feat/vision-conversational-creation-20261020`, starting at `fbc89f1a3`, with pre-existing modifications preserved. The commits contain only this task's changes, except the pre-existing shared copy dependency explicitly identified under PR 2. Passing checks are not isolated-checkout or native-release acceptance.

No package/build/lint scripts were added. This package has no lint script or standalone non-native build script; TypeScript and Jest are the available local automated checks. Android/iOS device acceptance from the cleanup plan remains open. Thread Strength scoring, glow rendering, rhythm/streak math and the Phase 2 coordinator were not changed.

The boundary check still reports existing shared/legacy-to-V2 imports across the tree. Removed the new settings-panel V2 import during final review, keeping its approved strings local (the regression test checks parity with the explainer copy), so this task does not add a boundary violation there.

## Final verification

- Final focused regression set: **48 suites / 519 tests passed**. Covers teaching, Chart sheets, Progress components/adapters/screen, Thread copy, settings, intention input, navigator lifecycle, Vision teaching and anchor/session/teaching stores.
- Final `npx tsc --noEmit --pretty false`: **passed**. `git diff --cached --check`: passed.
- Full mobile sweep (`npm test -- --runInBand --silent --json`): **671 suites passed, 4 failed; 7697 tests passed, 4 failed, 1 pre-existing skipped; 16 snapshots passed**. No tests were skipped or disabled by this work.
- Three full-sweep failures were test updates required by this cleanup: Progress's old Deep Prime expectation, SettingsScreen's full-reset-only mock, and Vision's mock treating selected/unshown beats as displayed. Corrected all three; final focused run passed. Follow-up of all four failed suites: **3 suites / 68 tests passed; one unrelated test still failed**.
- Remaining unrelated failure: `screens/v2/chart/__tests__/V2ChartAskScreen.test.tsx` → “does not seed into a conversation that already has messages”. `AskRevealText.tsx:23` executes `Array.from(text)` with undefined text. Neither the component nor its fixture was changed by guidance.
- `npm run test:v2-boundary`: fails on existing shared/legacy-to-V2 imports. The newly introduced settings import was removed; no new panel boundary violation remains.
- Final review added target-action regression coverage for Begin and the move circle alongside the touch-transparent overlays, and a real Vision-host celebration-blocking test. RNTL still does not establish native coordinate hit testing. Phase 1's modal accessibility behavior remains: screen-reader users dismiss “Got it” before acting.
- Final tests ran in the shared working tree; no isolated-checkout, Android or iOS release acceptance is claimed. No native device gates were silently treated as passed.

Logs and full Jest JSON are retained in `C:/Users/dwill/AppData/Local/Temp/anchor-guidance-phase1/` (`final-focused.log`, `full-suite.json`, `failure-followup.log`, `final-types.log`, `boundary-final.log`).

Reproduce the focused regression set from `anchor/mobile`:

```powershell
npm.cmd test -- --runInBand --silent hooks/v2/teaching components/v2/teaching components/v2/chart/sheet components/v2/progress adapters/v2/progress components/v2/thread vocabulary.deepFocus screens/settings screens/create/__tests__/IntentionInputScreen navigation/v2/__tests__/AnchorV2Navigator screens/v2/progress/__tests__/V2ProgressScreen components/v2/vision/__tests__/V2SavedVision.teaching stores/__tests__/guidanceLegacyCleanup stores/__tests__/anchorStore.test stores/__tests__/sessionStore.test stores/__tests__/teachingStoreFirstPractice
npx.cmd tsc --noEmit --pretty false
```
