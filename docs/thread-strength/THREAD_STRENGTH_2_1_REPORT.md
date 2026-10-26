# Thread Strength 2.1 — Implementation Report

Date: 2026-10-25. Scope: incremental refinement of Thread Strength 2.0. The glow, completion
sequence, decay settings and decay rules were not modified.

## 1. Audit findings

- **Scoring** (`backend/src/services/v2/ThreadStrengthService.ts`): 2.0 is duration based —
  +1.5 first practice per day, +0.5 per eligible minute, 10 min/day cap, −3 per unprotected missed day.
  State is *derived by chronological replay* of `ThreadV2Movement` rows; the stored `strength` is a cache.
- **Pre-2.0 scoring** (commit `40501e472`): diminishing-returns per session
  (`gain = base × sameDayMultiplier × (1 − strength/120)`, bases focus 7 / deep 11 / visualize 9,
  first practice jumped to ≥15). Strength was therefore driven by session *count*, not minutes.
- **Glow**: `useAuraStrength` / `CircularAnchorRenderer` already receive the authoritative value on
  Details and Progress. No binding bug found. Untouched.
- **Completion UI**: `usePracticeCompletionScene` already identifies the first practice ("Your Thread has
  begun."). Untouched except for one flag write (see §6).
- **Decay**: `threadStrengthSensitivity`, `decayPreferencesHistory`, `restDays` untouched.
- **Existing explanation sheet**: `components/ThreadStrengthSheet.tsx` is a V1 (dark/gold) component
  already wired to Progress, with stale copy ("Any missed day begins decay"). Replaced on Progress by the new
  shared sheet; still used by the legacy V1 `AnchorDetailScreen`.

## 2. Cause of the drops (79 → 16, 2, 0)

`backend/src/scripts/recalculateThreadStrength2.ts` **deleted every `ThreadV2Movement` for each Anchor** and
re-derived them with the 2.0 formula from the practice sessions, then overwrote `ThreadV2State.strength`.
Under 2.0 a 5-minute daily practice earns 4 points; the old formula awarded 7–15+ points per session regardless
of length. An Anchor with many short sessions therefore fell sharply (e.g. 79 → 16), and Anchors whose
sessions were far apart decayed toward 0 on replay. The new maths is internally consistent; the loss is the
*re-derivation of history under a different formula*, not a decay bug.

## 3. Can pre-migration Strength be recovered?

**Not verified — no production data was queried or changed in this work.**

- Movement rows (`before/afterStrength`) were deleted by the recalculation, and `ThreadV2State.strength`
  was overwritten. Neither is a source.
- **Recoverable source:** `thread_event_ledger` (`THREAD_STRENGTHENED.metadata.afterStrength`). It is
  append-only and written with `upsert … update: {}`, so rows created by the old code survived the
  recalculation. Ledger writes exist since 2026-09-10 (`4d6e29315`). The last event created *before* the 2.0
  recalculation run is the authoritative old strength at that session.
- **Not recoverable from the DB:** Anchors with no pre-cutoff ledger event (sessions before 2026-09-10, or
  never synced to the server). Only a Postgres backup / point-in-time restore from before the 2.0 run could
  cover those.
- Mobile may also hold the old `anchor.threadStrength` locally, but the app has since overwritten it with the
  server value; do not treat it as authoritative.

Run the dry run (below) to learn exactly which Anchors are restorable. Until then, counts are unknown.

## 4. Activation bonus (+12)

- `activationStatus` (`awarded` | `legacy_exempt` | null), `activationSessionId`, `activationAwardedAt` on
  `thread_v2_states`; `activation_bonus` on `thread_v2_movements`.
- Decided inside the existing **Serializable** transaction in `calculateInTransaction`, against persisted
  per-Anchor server state. Therefore idempotent across retries, reinstall, device change and concurrent
  completions (a second concurrent writer aborts/replays and sees the claimed state). `release` never earns or
  claims it. Decay to zero never re-arms it (state is permanent).
- The bonus is pinned to one session id; the shared pure replay adds it only at that session, so it is
  deterministic on every recompute and on late-arriving/out-of-order sessions.
- Migration SQL marks every Anchor with existing non-release movements or completed sessions
  `legacy_exempt` — no retroactive or second bonus.
- Verified: 10 s → 13.5833, 30 s → 13.75, 1 min → 14, 3 min → 15, 5 min → 16, 10 min → 18.5;
  days to 100: 56 / 51 / 44 / 30 / 22 / 14; 30 same-day sessions cannot exceed the daily cap (18.5).
- API: `threadStrengthMovement.activationBonus` is now returned (0 when none).

## 5. Legacy protection

- One-time **protected baseline**, stored on `thread_v2_states` (`legacy_baseline_strength/at/date_key/
  session_id/source/applied_at`). It is *not* a `max()` on every update.
- Replay starts from the baseline at the baseline session's date. Sessions at/before it are not re-earned
  (and burn that day's bonus/minute cap so a same-day session cannot double-credit). Later sessions earn under
  the 2.1 formula with no activation; normal decay applies from the baseline date, so decay since then is
  reproduced, not erased.
- `backend/src/scripts/restoreLegacyThreadStrength.ts --cutoff <ISO of the 2.0 run> [--apply] [--report f.json]`:
  dry-run by default; only uses ledger events created before the cutoff; cross-checks the source session
  belongs to the same user **and** Anchor; refuses invalid values; skips when the baseline would not be
  higher than today's value (never lowers anyone); idempotent via `legacy_baseline_applied_at IS NULL`.
- `recalculateThreadStrength2.ts` now refuses to touch Anchors with an activation decision or baseline.
- **Actual results: none yet.** The script has not been run against any database.

## 6. Education and explanation UI

- `ThreadStrengthExplainerSheet` (`components/v2/thread/`) on `V2SheetModal` (existing sheet primitive):
  title, current value/level/points-to-next, the three required paragraphs, the five levels, "How it grows",
  expandable exact numbers (+12 once, +1.5, +0.5/min, 10 min cap), the user's decay preference with plain
  English, and a note that Strength is not a prediction. Scrollable, safe-area aware.
- Anchor Details: the "NN% Thread Strength" label opens the sheet; the thread line/level still opens Progress
  (existing test id and accessibility label preserved).
- Progress: the existing "THREAD STRENGTH" eyebrow plus the score/level row open the same sheet.
- First-practice education: the completion scene sets `threadStrengthEducationPending` at the moment it
  already writes `hasSeenFirstPracticeScene` (no animation change). `ThreadStrengthEducationCard` appears at the
  top of the Details sheet content only when pending, not yet dismissed and Strength is established; shows the
  real value/level; "Got it" persists `hasSeenThreadStrengthEducation` (teaching store, AsyncStorage).

## 7. Files changed

Backend: `prisma/schema.prisma`; `prisma/migrations/20261026000000_thread_strength_2_1_activation_legacy/`;
`src/services/v2/ThreadStrengthService.ts` (shared `replayThreadStrength`, activation, baseline);
`src/scripts/restoreLegacyThreadStrength.ts` (new); `src/scripts/recalculateThreadStrength2.ts` (guard);
tests `ThreadStrength21.test.ts` (new), `ThreadStrengthService.test.ts` (obsolete 2.0 progression targets removed).

Mobile: `constants/v2/threadStrengthCopy.ts`, `components/v2/thread/ThreadStrengthExplainerSheet.tsx`,
`components/v2/thread/ThreadStrengthEducationCard.tsx` (all new); `stores/teachingStore.ts`;
`hooks/v2/practice/usePracticeCompletionScene.ts`; `screens/v2/anchors/V2AnchorDetailsScreen.tsx`;
`components/v2/progress/V2ProgressHero.tsx`; tests `ThreadStrengthEducation.test.tsx` (new),
`V2AnchorDetailsScreen.test.tsx`, `V2ProgressHero.test.tsx`.

## 8. Test results

- Backend: `ThreadStrengthService.test.ts` + `ThreadStrength21.test.ts` 75/75 pass; `src/services/v2` +
  practice route 396 pass. Full backend run: 1782 pass, 2 suites fail — `WeeklyRecapService.pg.test.ts` and
  `weeklyInsightRoutes.test.ts` (TypeScript errors in weekly-recap code that predate and are unrelated to this work).
- Mobile: full run 7521 pass, 1 fail (`V2VisionScreen.addImage` scene-generation payload) and 1 suite OOM-crashed
  (`VisionAddSceneSheet.test`) — both in Vision files that already had uncommitted changes. `tsc` reports no
  errors in any touched file (pre-existing errors elsewhere).
- Not covered by automation: the concurrency claim is argued from Serializable isolation and the unique
  `session_id`, not exercised against a real Postgres; no on-device visual check of the Details card/sheet or
  Progress hero was done.

## 9. Remaining risks / manual steps

1. Apply the migration, then run the restore script **dry run** with the real cutoff (when the 2.0
   recalculation ran) and review the JSON report before `--apply`. Take a DB snapshot first.
2. Anchors reported `unrecoverable` need a backup restore or stay at their 2.0 value; do not guess.
3. Baseline Strength is as of the baseline session; decay since then is recomputed under *current* decay
   settings, which may differ from what the user experienced under the old 2-day grace.
4. `delta7d` is unavailable for a legacy Anchor within 7 days of its baseline date.
5. Education pending flag is per device; a reinstall resets it (low impact, one-time card).
6. Manual QA: iOS + Android sheet scrolling at large text sizes; Details card placement above Today card;
   confirm completion scene timing is unchanged; confirm no layout shift on the Details thread row.
