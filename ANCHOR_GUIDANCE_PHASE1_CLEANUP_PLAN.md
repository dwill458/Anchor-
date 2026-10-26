# Anchor Guidance — Phase 1 Cleanup Plan

**Status:** proposed, awaiting authorisation. No production code has been changed.
**Goal:** remove wrong, outdated and colliding teaching, and make the remaining tips respect celebrations and real actions. This is done **without** the coordinator, new components or new persistence.
**Principle:** every item is a small, independently revertible change to existing code. No business logic changes: Thread scoring, glow, Chart, Vision, Practice and streak math stay untouched.
**Reference:** registry IDs (G1…G8, I-1…) and decisions (D-xx, P-x) are defined in `ANCHOR_MICRO_TEACHING_AUDIT_AND_BLUEPRINT.md` (v2).

Paths are relative to `anchor/mobile/src` unless noted.

---

## PR-A — Behaviour fixes (teaching plumbing)

### 1.1 Retire outdated beats from eligibility

- **Files:**
  - `hooks/v2/teaching/homeTeaching.ts`
  - `hooks/v2/teaching/detailsTeaching.ts`
  - `hooks/v2/teaching/practiceTeaching.ts`
  - `hooks/v2/teaching/progressTeaching.ts`
  - `constants/v2/teachingCopy.ts`
  - their tests in `hooks/v2/teaching/__tests__/`
- **Change:**
  - `homeTeachingBeats` returns only `['home.today']` (eligibility in 1.2).
  - `detailsTeachingBeats` returns `[]`. The Details empty rows teach inline instead (1.7).
  - `practiceTeachingBeats` returns only `practice.switch` (≥2 anchors and switcher rendered). `practice.today` is retired (G1 is Home-hosted in Phase 1; the Practice-hub fallback arrives in Phase 2).
  - `progressTeachingBeats` returns only `progress.thread` (kept until G7 replaces it). `progress.week`, `progress.rhythm` and `progress.route` are retired.
  - Copy entries are **not deleted**. Move retired IDs into `RETIRED_TEACHING_BEAT_IDS`, so `resetAllTeachingSeen` and the Phase 2 migration can still address their storage keys. `TEACHING_BEAT_IDS` keeps covering both lists for reset.
- **Retired:** `home.progress`, `home.vision`, `home.chart`, `home.thread`, `details.vision`, `details.chart`, `practice.today`, `progress.week`, `progress.rhythm`, `progress.route`.
- **Tests:** eligibility unit tests per screen (new expected arrays). `teachingSeen.test.ts` still resets retired keys.
- **Acceptance:** a new user sees at most `home.today` on Home, nothing on Details, `practice.switch` only with ≥2 anchors, and `progress.thread` only when measured.
- **Risk:** low. Rollback: revert the four functions.

### 1.2 Home Today tip: duration-aware copy and correct eligibility (G1)

- **Files:**
  - `hooks/v2/teaching/homeTeaching.ts`
  - `screens/v2/home/V2HomeScreen.tsx` (around line 492 and the `ScreenTeaching` targets at about 763)
  - `components/v2/teaching/ScreenTeaching.tsx`
  - `components/v2/teaching/SpotlightCoach.tsx` (type only)
  - `constants/v2/teachingCopy.ts`
- **Change:**
  - `homeTeachingBeats({ hasAnchor, todayReady, doneToday, mode, hasCompletedPractice })` returns `['home.today']` only when all of these hold: `hasAnchor`; `todayReady` (`model.today.state === 'ready'`); `!doneToday`; `mode !== 'release'`; `!hasCompletedPractice`. `hasCompletedPractice` = the account's `useSessionStore.sessionLog` has any entry. [A] Confirm `sessionLog` only holds completed sessions; if not, filter on its completion field.
  - `TeachingTarget` becomes `Pick<TeachingStep, 'targetRef' | 'getRect'> & { title?: string; body?: string; accessibilityLabel?: string }`. `ScreenTeaching` already spreads the target after the copy, so a target can override the copy.
  - Copy: title "Start here each day.", body template "Each day Anchor suggests one practice. Today: {mode}, {duration}." / "Each day Anchor suggests one practice. Today: {mode}." Home fills these from `v2PracticeModeTitle(mode)` and `v2PracticeDurationLabel(durationSeconds)`.
  - Accessibility label spells the unit out ("30 seconds", "5 minutes"). Use a small helper beside `v2PracticeDurationLabel`.
  - Home `cap` goes from 2 to 1.
- **Tests:**
  - Copy renders for Focus 30 s, Deep Focus 5 min, Visualize 3 min, and a missing duration.
  - No tip for a Release recommendation, for a done-today card, or after any completed practice.
- **Acceptance:** the tip never states a duration other than the one on the card.
- **Risk:** low.

### 1.3 Dismissal settles only what was shown

- **Files:** `components/v2/teaching/ScreenTeaching.tsx` (onDismiss, lines 37–49), `hooks/v2/teaching/useTeachingQueue.ts` (`dismiss`, lines 77–84).
- **Change:** `onDismiss` passes `Array.from(shown.current)` for **every** reason, not only `'unmeasurable'`. `dismiss()` with no argument commits nothing beyond what `markShown` already recorded. Unshown later steps stay unseen and can appear on a later visit, subject to the existing session cap.
- **Tests:**
  - A 2-step batch dismissed at step 1 leaves step 2 unseen.
  - The `'complete'` reason still marks everything that was shown.
- **Risk:** low. With 1.1, only Progress can still have more than one beat in a batch.

### 1.4 Highlighted target runs its real action (pass-through)

- **Files:**
  - `components/v2/teaching/SpotlightCoach.tsx` (spot `AnimatedPressable`, line 117)
  - `components/v2/chart/sheet/ChartOneMoveTeaching.tsx` (its spotlight pressable)
  - `TeachingWhisper` is unaffected.
- **Change:** replace the spot `AnimatedPressable` with an `Animated.View` that has `pointerEvents="none"`. The four scrim rects keep `onPress → onDismiss('scrim')`. The root stays `box-none`, so a touch inside the hole reaches the real control.
- **What happens next (existing behaviour):**
  - Tapping Today navigates; the screen blurs; the queue tears the tip down. Seen was already recorded on display.
  - Tapping a Chart circle completes the move; `runner.isBusy()` and the sheet snapping hide the coach (`ChartActiveView.tsx:631-633`).
  - Dragging a Vision photo sets `dragging`, so `visionTeachingBlocked` hides the tip.
- **Accessibility:** `accessibilityViewIsModal` stays. Screen-reader users dismiss with "Got it", then act. Phase 3 revisits this with the Context Bubble.
- **Tests:**
  - A press inside the hole calls the target's `onPress` and does not call `onDismiss('scrim')`.
  - A press on the scrim still dismisses.
- **Acceptance:** "Begin" on Today works while the tip is up.
- **Risk:** low to medium. Watch for a double-trigger, where an underlying press and a scrim press fire on the hole's edge. The hole is inset by `PAD`, so scrims don't overlap it.

### 1.5 Celebrations outrank every tip (D-10)

- **Files:**
  - **new** `hooks/v2/teaching/useCelebrationActive.ts`
  - `screens/v2/home/V2HomeScreen.tsx` (`homeIsIdle`)
  - `screens/v2/practice/V2PracticeScreen.tsx` (`blocked`)
  - `screens/v2/progress/V2ProgressScreen.tsx` (`blocked`)
  - `components/v2/vision/V2SavedVision.tsx` (`visionTeachingBlocked`)
  - `components/v2/chart/ChartActiveView.tsx` (the three teaching effects, lines 611–633)
- **Change:**
  - `useCelebrationActive()` returns `useMilestoneCelebrationStore(s => s.queue.length > 0)`. The presenter keeps the presenting item at `queue[0]` until `shift`, so this covers both "presenting" and "queued" (`hooks/v2/milestones/useMilestonePresenter.ts:23-59`).
  - Add it to every teaching block condition, and to Chart's show and hide effects.
  - **Teaching must never call `useMilestonePresentationHold`**: the presenter ends a presentation in progress when any hold appears (`useMilestonePresenter.ts:47`).
- **Tests:**
  - With a queued celebration, no tip presents.
  - When a celebration is enqueued while a tip is visible, the tip hides.
  - No teaching file imports `useMilestonePresentationHold` (static test).
- **Acceptance:** a celebration and a tip are never on screen together.
- **Known limitation (fixed in Phase 2):** a tip pre-empted by a celebration is already marked seen, because seen is recorded on display.

### 1.6 Chart lesson: one accurate step (G6 copy, existing component)

- **Files:**
  - `constants/v2/chartCopy.ts` (`teaching.oneMove`, lines 43–62)
  - `components/v2/chart/sheet/ChartOneMoveTeaching.tsx` (target selection `[row, circle, body][beat]`, step counter)
  - `__tests__/ChartOneMoveTeaching.test.tsx`
- **Change:**
  - `beats` becomes one entry, targeting `rowRef`: title "One small step for today.", body "Tap the circle once you've done it. Tap the words to see the details."
  - Remove the "{n} of 3" counter; hide the counter when there is one beat. The button reads "Got it".
  - `circleRef` and `bodyRef` stay mounted for Phase 2 action reporting.
  - No change to show or hide conditions, the per-account taught key, or replay.
- **Tests:** renders one step; the circle press passes through (1.4); `markTeachingShown` fires once.
- **Acceptance:** no copy claims the next move is ready, that the route moves, or that a move can be undone.
- **Risk:** low.

---

## PR-B — User-facing copy alignment

### 1.7 Details empty-row payoff copy (I-1, I-2)

- **File:** `screens/v2/anchors/V2AnchorDetailsScreen.tsx:72-77`.
- **Change:**
  - `visionPayoff`: "Picture where this leads. You'll use it in Visualize."
  - `chartPayoff`: "Turn this into waypoints and a next move."
- **Check:** 2-line wrap in the 76 pt dashed row at 320 pt width and at 130 % font scale. [A] If it wraps badly, keep the line shorter: "Picture where this leads."
- **Not in Phase 1:** the automatic Thread education card stays until G2 ships (Phase 3), so Thread never goes untaught. Its retirement (P-4) is scheduled with G2.

### 1.8 "Deep Focus" in every 2.0 user-facing label (D-01)

- **Change these labels:**
  - `components/v2/progress/progressTokens.ts:54`: `PROGRESS_MODE_LABELS.deepPrime` → `'Deep Focus'`.
  - `adapters/v2/progress/progressAdapter.ts:137`: `MODE_COPY.deepPrime` → `'Deep Focus'`. [A] First confirm `MODE_COPY` values are display-only and not used as lookup keys.
  - `types/practice.ts:12`: `PRACTICE_MODE_LABELS.deep_prime` → `'Deep Focus'`. [A] List its consumers with `git grep practiceModeLabel`. Leave it if it is consumed only by 1.5 screens.
  - `widgets/android/AnchorLargeWidget.tsx:449` "DEEP PRIMES" → "DEEP FOCUS" (shipped only when `EXPO_PUBLIC_ENABLE_WIDGETS=true`).
- **Do not change:**
  - `deep_prime` ids.
  - The `'Deep Prime'` recommendation action (`constants/v2/practice.ts:41-45`, `backend/src/domain/v2/recommendation.ts:10`).
  - `adapters/v2/home/todayForDisplay.ts:5-10`, which maps to that server enum.
  - Analytics values; stored session types; 1.5 screens.
- **Guard test:** add `src/__tests__/vocabulary.deepFocus.test.ts`. It scans string literals under `components/v2`, `screens/v2`, `adapters/v2`, `constants/v2`, `hooks/v2` and `widgets` for `Deep Prime`. The allowlist is the recommendation-action enum, `todayForDisplay`'s server mapping, and comments.
- **Migration:** none.

### 1.9 "Strength Buffer" wording (D-02, accurate half only)

- **Files:**
  - `constants/v2/threadStrengthCopy.ts:42-49` (`THREAD_STRENGTH_DECAY_COPY`)
  - `screens/settings/ThreadStrengthPanel.tsx` (option descriptions, around lines 32–45)
- **Change:** settings copy, so numbers stay. They are accurate and the user chose the setting.
  - Lenient: "Strength Buffer: 2 days away. After that, your thread softens by 3 points for each additional day."
  - Balanced: "Strength Buffer: 1 day away. After that, your thread softens by 3 points for each additional day."
  - Strict: "No Strength Buffer. Your thread softens by 3 points for each day away."
  - Panel descriptions use the same terms. Replace "thins" with "softens" for consistency.
- **Unchanged:** the explainer's "Your rest days never count as time away." It refers to the existing Rest Days feature (see P-1).

### 1.10 Hide the non-functional grace badge (P-3; do only if P-3 approved)

- **File:** `components/v2/progress/V2ProgressWeek.tsx:63-68`.
- **Change:** don't render the "Grace day ready / used" pill. `streak` data and math are untouched.
- **Tests:** snapshot without the pill.
- **Why:** `consumeGraceDay()` has no callers, so the pill always says "ready", and the bridge ends as soon as the user practices (blueprint §0).

---

## PR-C — Legacy hygiene

### 1.11 Stop dead legacy queues and whispers under 2.0

- **Files:**
  - `stores/anchorStore.ts:323-332`
  - `stores/sessionStore.ts:616-630`
  - `navigation/v2/AnchorV2Navigator.tsx` (mount effect)
  - `screens/create/IntentionInputScreen.tsx` (lines about 93, 124–151, 210–250)
- **Change:**
  - Wrap the two `queueMilestone(...)` calls in `if (!isAnchorV2Enabled())`. The `setUserFlag(...)` calls stay; legacy returning-user checks read them.
  - On `AnchorV2Navigator` mount, after `useTeachingStore.persist.hasHydrated()`, set `pendingMilestones: []` once.
  - In `IntentionInputScreen`, remove both `useTeachingGate` calls, the idle and hesitation timers, `showUndertone` and the undertone render. **Keep** the "Short. Present. Felt." info sheet; it may keep reading `TEACHINGS.intention_input_*_v1.copy`, so no copy changes.
- **Tests:**
  - Under 2.0, `addAnchor` and session completion don't grow `pendingMilestones`.
  - The intention screen renders no whisper with Guide mode on.
  - The info sheet still opens.
- **Risk:** low. The 1.5 navigator path is unchanged when the flag is `'false'`.

### 1.12 "Replay app tips" stops resetting first-time story flags (C-2)

- **Files:** `stores/teachingStore.ts`, `screens/settings/HelpAboutSubscreen.tsx:55-67`, `screens/v2/system/ChartLabDevHost.tsx:24`.
- **Change:**
  - Add `resetTeachingRecords()`. It resets `showCounts`, `lastShownAt`, `exhaustedIds`, `lastVeilCardAt`, `pendingMilestones`, the trace-hint maps and session fields. It **preserves `userFlags`**.
  - Help & about uses it instead of `reset()`.
  - Sign-out and account-switch keep the full `reset()` (account isolation). Per-account flags arrive in Phase 2.
- **Tests:** after Replay, `hasSeenFirstAnchorArrival` and `hasSeenFirstPracticeScene` are unchanged; V2 tips are unseen again.
- **Acceptance:** Replay never replays the first-Anchor arrival or the first-practice scene.

### 1.13 Correct stale documentation

- **Files:** `anchor/mobile/App.tsx:101-102` (comment) and `ANCHOR_2_V2_ISOLATION_ARCHITECTURE.md` (repo root).
- **Change:** state that `isAnchorV2Enabled()` returns true unless `EXPO_PUBLIC_ANCHOR_V2_ENABLED === 'false'`. This is a comment and docs change only.

---

## Explicitly out of Phase 1

These are not in Phase 1:

- The coordinator, outcome records, dwell-based "displayed" and pre-emption without marking seen.
- The Context Bubble component; G2 (scene line); the Practice-hub fallback for G1; G3/G5/G7/G8 as new surfaces.
- "Show tips" (P-2).
- Rest Days and rhythm logic (P-1).
- Retiring the Details Thread card (P-4).
- Teaching-state sync (P-6).
- The Chart circle's accessibility-label fix (P-7, a separate Chart ticket).
- Deleting `HeroHalo`.

## Verification checklist (per PR)

- `npx tsc --noEmit`; `npx jest hooks/v2/teaching components/v2/teaching components/v2/chart/sheet screens/v2 adapters/v2/progress`.
- Device pass on Android and iOS:
  1. Fresh guest: first Anchor → Home tip shows the real mode and duration.
  2. Tap Today with the tip up → practice opens.
  3. Complete a practice → no Home tip afterwards.
  4. Chart with a move → one-step tip; the circle tap completes the move.
  5. Force a milestone (dev toolbar) while on Home → no tip overlaps it.
  6. Replay tips → no first-Anchor arrival replay.
  7. Progress shows "Deep Focus" and no grace pill.

## Suggested order and size

PR-A (1–2 days) → PR-B (½ day, plus copy review) → PR-C (½ day). Each PR can merge on its own; together they fix the High and Medium defects from v1 (D1, D2, D3, D4, D5, D7, D8) except the per-process session cap (Phase 2).
