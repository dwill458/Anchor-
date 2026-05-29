# WP-01 — Focus Session BLOCKERs (timer + completion idempotency)

**Severity:** 🔴 BLOCKER ×2 · **Repo:** `anchor/mobile/`

## Objective
Fix the two ship-stopping defects in the Focus Session: (1) a visible MM:SS countdown that violates the "gold ring is the sole time indicator" design contract, and (2) non-idempotent activation completion that double-counts a prime and double-POSTs to the server.

## Files (touch only these)
- `src/screens/rituals/components/FocusSession.tsx`
- `src/screens/rituals/ActivationScreen.tsx`
- `src/stores/anchorStore.ts`

## Change 1 — Remove the MM:SS timer (FocusSession.tsx)
- Line ~1033 renders `<Text style={styles.timerTop} testID="focus-session-timer">{timerDisplay}</Text>` during `running`/`paused`.
- Remove that Text node (the surrounding conditional ~1032-1036); keep the `topBarSpacer` branch so layout matches the seal phase (which already renders only the spacer).
- Remove now-unused `formatTime` (268-271), `timerDisplay`, and `styles.timerTop` (~1197-1204) if no longer referenced.
- The gold `ProgressRing` remains the indicator. Optionally also remove the redundant linear `progressTrack`/`progressFill` (1040-1044) — confirm with product; default: keep ring only, remove linear bar.
- If a test references `testID="focus-session-timer"`, update/remove that assertion rather than keeping a hidden Text.

## Change 2 — Make activation completion idempotent (ActivationScreen.tsx)
- `handleComplete` (264-285) and `logActivationInBackground` (127-243) can run twice: after the seal fires `onComplete` once, the post-session modal stays mounted, and `beforeRemove` (393), `BackHandler` (409), and `onDismiss` (499) re-invoke `handleComplete`.
- Add `const hasLoggedActivationRef = useRef(false);`.
- At the very top of `logActivationInBackground`: `if (hasLoggedActivationRef.current) return; hasLoggedActivationRef.current = true;`.
- This protects `incrementTotalPrimes()` and the `/api/anchors/{id}/activate` POST. (`recordPrimeSession()` is already day-guarded.)

## Change 3 — Defensive guard (anchorStore.ts) — optional but recommended
- `incrementTotalPrimes` (196-202) is a blind `+1`. Leave the +1 semantics, but this is the counter inflated by the double-fire; Change 2 is the real fix. Do **not** change `recordPrimeSession`.

## Constraints
- Preserve `handleComplete`, `logActivationInBackground`, `incrementTotalPrimes`, `recordPrimeSession`, `ProgressRing` names and the `onComplete`/`beforeRemove`/`BackHandler` wiring.
- Do not refactor the session lifecycle beyond these guards.

## Acceptance criteria
- No numeric countdown is rendered anywhere in the running/paused/seal phases of FocusSession (grep for `formatTime(` / `timerDisplay` shows no rendered usage).
- Completing a session then pressing back / dismissing the modal calls `incrementTotalPrimes` and the activate POST exactly once.
- `npx tsc --noEmit` passes; `npx jest ActivationScreen` and any FocusSession tests pass.
