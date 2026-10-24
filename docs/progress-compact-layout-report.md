# Anchor 2.0 compact Progress layout

Implemented 2026-10-24. Changes remain uncommitted in the existing shared checkout.

## Audit and preserved sources

- `useV2Progress` and `toV2ProgressModel` continue to own selected-Anchor progress. Thread Strength is the persisted Anchor value; no scoring or analytics calculations changed.
- Artwork still uses `anchorRenderProps`, `CircularAnchorRenderer`, `useAuraStrength`, and the existing transition placement/reveal hooks. Enhanced artwork and SVG fallbacks remain intact.
- Hero statistics retain `heroStats` and the existing lifetime/session totals, including the reached-waypoint fallback behavior.
- Journey retains `useProgressJourney`, actual Vision tile URLs, and the live route summary/current waypoint/One Move. Chart-only previews reuse `ChartMapCrop`.
- Milestones retain `useAnchorMilestones`, `buildMilestoneItems`, actual earned dates, `MilestoneArtwork`, detail navigation, and the full collection destination. Locked badges use the canonical model.
- Week/Month/Year retain the existing week marks, rhythm totals, heatmap cells, and range state. Practice insights, grace information, and history detail sheets remain accessible.
- Story retains merged milestone/activity records and existing detail routing. Recent events are ordered by their recorded timestamps; unknown dates remain unknown.
- No backend, database, tracking, scoring, eligibility, or global Weekly Insight files were changed by this task. Pre-existing unrelated changes were preserved.

## Presentation changes

- Horizontal navy hero: 100–120dp real Anchor, score and wrapping current level badge to its right, canonical Surface/Grounded/Rooted/Embedded/Sovereign indicator below. Intention text wraps without a fixed line limit.
- Three existing statistics remain in a single navy row with dividers. Thread Strength opens the existing Anchor-specific explanation sheet, mounted only when requested.
- The Progress model exposes no authoritative seven-day strength change. The hero says “7-day change unavailable”; no historical delta is inferred or invented.
- Journey places the Vision thumbnail beside the actual waypoint and next Move. Chart-only Anchors receive a horizontal map/waypoint preview; Vision-only and practice-first states retain their real content and navigation.
- Smaller 56dp milestone badges in a horizontal shelf, with View all in the header and locked styling preserved.
- Week is the default. One compact Monday–Sunday completion row replaces the duplicated week-plus-rhythm presentation; summaries sit below. Month and Year remain switchable. Monthly gaps are smaller.
- Story initially shows the latest three events across existing categories. View all activity opens older history, and Show earlier pages through it ten events at a time. Show recent restores the compact view; changing Anchor resets it.
- Removed the per-Anchor Weekly Insight card only. Global recap implementation remains untouched.
- Body section gaps reduced from 26dp to 12dp; horizontal inset remains 18dp. Wrapping rows and expandable text reduce clipping risk without disabling font scaling.

## Verification

- PASS: 9 focused Jest suites, 168 tests. Includes Progress screen, hero, activity timeline, progress hooks, adapters, vocabulary, range switching, Journey states/navigation, milestone interactions, empty/error/loading states, strength boundaries 0/10/25/50/100, long intention wrapping configuration, and explanation sheet access.
- PASS: scoped `git diff --check`.
- Full mobile TypeScript check: six errors in pre-existing, unrelated Weekly Recap work. Five missing exports in `src/hooks/v2/weeklyRecap/useWeeklyRecap.ts`; one union narrowing error in `src/screens/v2/weeklyRecap/V2WeeklyRecapScreen.tsx`. No diagnostics in the changed Progress files.
- Mobile package has no lint script, ESLint dependency, or mobile lint configuration. No lint tooling was added for this presentation task.
- `adb devices` returned no connected devices. Android/iOS screenshots, authenticated device navigation, S24 Ultra/small-phone rendering, larger accessibility font layout, touch bounds, transitions, and frame pacing remain unverified.
- The 25–35% total height target is not a measured result. The major stacked components and duplicate calendar presentation have been replaced, but before/after rendered content-height measurements and comparison against the supplied reference still require a running app/device. No visual parity claim is made.

## Files changed by this task

Paths below are relative to `anchor/mobile/`:

1. `src/screens/v2/progress/V2ProgressScreen.tsx` — compact section spacing, safe-area bottom padding, remove insight card, reset Story per Anchor.
2. `src/components/v2/progress/V2ProgressHero.tsx` — horizontal artwork/strength, canonical level indicator, explanation access, compact stats.
3. `src/components/v2/progress/V2JourneySection.tsx` — horizontal Vision/waypoint/next Move and shorter Vision-only preview.
4. `src/components/v2/progress/V2ProgressRoute.tsx` — compact horizontal Chart preview option.
5. `src/components/v2/progress/V2MilestoneShelf.tsx` — smaller earned/locked badges and header action.
6. `src/components/v2/progress/V2CommitmentSection.tsx` — consolidate week/rhythm while retaining insights and teaching targets.
7. `src/components/v2/progress/V2ProgressRhythm.tsx` — week marks instead of tall bars, summaries below, tighter month spacing.
8. `src/components/v2/progress/V2ProgressWeek.tsx` — embedded compact Monday–Sunday row.
9. `src/components/v2/progress/V2ThreadEventTimeline.tsx` — three recent events, complete paginated history, compact rows.
10. `src/hooks/v2/progress/useV2Progress.ts` — Week default only.
11. `src/screens/v2/progress/__tests__/V2ProgressScreen.test.tsx` — updated requested presentation contracts.
12. `src/components/v2/progress/__tests__/V2ProgressHero.test.tsx` — compact sizing, canonical levels, boundary values and explanation access.
13. `src/components/v2/progress/__tests__/V2ThreadEventTimeline.test.tsx` — recent ordering, categories, history expansion/pagination and detail access.
14. `src/hooks/v2/progress/__tests__/useV2Progress.test.ts` — Week default regression.

Additional file: `docs/progress-compact-layout-report.md` (this report).
