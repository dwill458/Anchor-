# Practice artwork implementation — October 5, 2026

Implemented the supplied art-direction brief in the authoritative mobile app.

- Four canonical JPEG assets replace the old artwork mapping. The same image is used in hero, completed hero, and library cards.
- Removed the old `src/assets/practice/today/focus-loop.mp4` and all Practice video-player mounting, loading, and lifecycle code. Focus remains a still in every state.
- Preserved practice routing, recommendation, entitlement, completion, and layout contracts. Centered the Release strip crop on its ember.
- Removed the hero's added white gradient at the user's explicit request. The hero illustration renders cleanly above the existing cream body.

## Verification

- Focused Jest: 3 suites, 68 tests passed. Command: `npx jest src/components/v2/practice/__tests__/V2PracticeArtwork.test.tsx src/components/v2/practice/__tests__/V2PracticeComponents.test.tsx src/screens/v2/practice/__tests__/V2PracticeScreen.test.tsx --runInBand --silent`.
- Android Expo export passed (exit 0) before the final gradient removal. Export lists all four new JPEGs and does not list the old video. See `export.txt`. The 68 focused tests passed again after gradient removal.
- Scoped `git diff --check` passed.
- Full TypeScript check is not green: nine diagnostics in Anchor Details tests, Chart Adjust styles, and AuthService. None references files changed in this pass. See `typecheck.txt`.
- Independent fresh reviewer scored artwork and source-based crops 9.64/10; see `review.md` for rubric and limitations.
- Final on-device crop verification remains open. Before-image is explicitly labelled `android-practice-before.png`; `artwork-set.jpg` is an asset contact sheet, not a runtime screenshot. Device interaction stopped when the phone was being used. No frame-rate or complete runtime visual signoff is claimed.

No commit, deployment, or OTA was performed. Existing unrelated working-tree changes were preserved.
