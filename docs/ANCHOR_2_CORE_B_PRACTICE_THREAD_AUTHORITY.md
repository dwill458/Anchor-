# Anchor 2.0 — Core B: Practice / Thread Authority

## Broken boundary found

V2 Prepare renders real mode/duration choices but only emits an optional `onBeginPractice`; the development-only `AnchorV2Navigator` supplied no callback. Canonical completion already reaches `POST /api/practice/sessions`, but Thread movement was conditionally shadowed and Recommended Today always exposed `delta7d: null`.

## Implemented authority changes

- Every accepted canonical PracticeSession now invokes the server Thread ledger. Replaying the same session ID returns the same idempotent movement, so retries neither add gain nor duplicate the ledger event.
- Movement continues to persist `beforeStrength`, `afterStrength`, and `delta`; the Thread Event ledger upsert remains keyed by session ID.
- `delta7d` now replays the authoritative Thread movement ledger at `now` and at exactly seven days earlier, applying the existing legacy-default decay rule at both boundaries. It is unavailable only for an Anchor younger than seven days or without an initialized movement ledger.
- Recommended Today retains first-match order: completion, unseen Vision, negative delta7d, Focus.

## Required integration changes

`AnchorV2Navigator` is mounted as a standalone development navigator, outside the mature `MainTabNavigator` / `PracticeStackNavigator`. It cannot push the existing Focus, Deep Prime, or Visualize engines without a narrow, approved session-engine bridge route. This branch intentionally does not invent a second engine or alter V2 creation/chart hunks in that shared file. Wire `onBeginPractice` to that bridge before declaring V2 Prepare runtime-complete.

## Validation

`git diff --check` passes. Targeted backend Jest was attempted but this worktree has no backend Jest installation (`jest` is not recognized), so full backend/mobile suites remain runtime validation work.

## Runtime QA still needed

Verify the bridge starts exactly one audio player/timer and that the canonical completion response is shown by the V2 completion presentation without client-side movement calculation.
