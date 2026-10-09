# Chart intelligence and polish

## Initial audit (before implementation)

The active client journey is `V2ChartScreen` -> `ChartCreationFlow` -> optional `ChartContextStep` (Vision destination preview and starting photo) / `ChartRealityInput` (destination definition) -> `chartV2Api.plan` -> proposal/follow-up -> route review -> `createChart`. Saved Charts use `useAnchorChart`, `chartV2Model`, `ChartActiveView`, `ChartWaypointContent`, and the existing map/sheet sequencer. Adjust Route uses `V2ChartAdjustScreen`, proposals, a review, then `applyRoute`. Course Log is projected from CourseEvent snapshots, reflections and practices.

Backend planning lives in `chartPlanPrompt`, `chartPlanSchema`, `ChartPlannerService`, and `chartModelProviders`. The provider chain has bounded timeouts, one fast transient retry and a fallback provider. Zod normalizes shape, counts and labels, but does not check attainability, prerequisites or starting-point alignment. Optional Vision descriptions and up to two images are destination context; unreadable/missing Vision and photos are tolerated. Attached photos are ownership checked. Onboarding provides coarse context. Adjustment sees titles/metric targets and a completed Move count, but lacks actual progress and detailed completed action/history context.

Root causes:

- The destination answer is named `startingContext`, conflating destination and current resources. There is no dedicated persisted actual starting description.
- The planner requires the final waypoint to equal the full destination even for huge goals. The numeric fallback divides targets into 10/25/50/100 percent without evidence.
- Adjustment reasons describe route granularity rather than difficulty; requests for smaller steps lack an explicit prerequisite-repair contract.
- Non-numeric progress means completed Moves, not independent requirements. Numeric validation only accepts positive targets/nonnegative values; presentation discards decreasing baselines.
- Route replacement is serializable/versioned and soft-cancels removed waypoints, preserving completed Moves/events. Retained-waypoint metric changes can nevertheless clear recorded progress. Proposed One Moves are not applied to revised routes.
- The destination screen uses ink colors while established context/review surfaces are cream. Waypoint edit modal needs contained scrolling/keyboard handling. Completed action readability and log wording require checking both active and history surfaces.

Persistence: Prisma Course stores destination, startingContext, version/pointers, lifecycle; Waypoint stores metric values/mode and reach/skip/cancel timestamps; Move stores commitments and completed timestamps; AIPlanProposal stores reviewed candidates/expiration/base version; CourseEvent and ledger events retain immutable action snapshots. Waypoint reach and Move completion remain server authoritative and independent of practice/Thread Strength.

## Implementation plan and affected areas

1. Add separate actual-start context and route scope, preserving legacy `startingContext` semantics. Extend the existing structured model contract with completion criteria and bounded internal planning evidence; deterministic validation rejects critical defects and numeric subdivision. Keep provider limits.
2. Make quick adjustments explicit, supply progress/history, preserve destination and achievements, check proposal version/expiration, and persist revised One Move on acceptance.
3. Add checklist requirements and completion modes alongside legacy moves/none compatibility. Support signed values, zero targets, decreasing metrics, and user overrides through canonical edits. Add additive Prisma migration.
4. Apply cream tokens to destination/adjustment, contain waypoint editing, improve completed text/log detail, retaining map gestures/artwork.
5. Test model boundaries, financial/beginner/prerequisite scenarios, progress modes and route persistence; run backend/mobile checks and available runtime/build validation. Record limitations explicitly.

No production deployment or production database mutation is part of this pass. Product choice: a distant goal may be represented by the next achievable stretch while the original destination remains saved and visible. A stretch finishing must not emit destination-arrival evidence.

## Implemented behavior

- Destination definition and actual starting point now travel as separate fields from creation through reviewed proposal and saved Chart. A missing actual starting point receives one useful deterministic question; Vision and starting photos remain optional. Vision supplies future context only.
- The planner produces structured completion criteria and bounded evidence (starting summary, assumptions, prerequisite indices, first-milestone alignment and difficulty-reduction explanation). Schema and deterministic checks reject missing analysis, incompatible destination changes, unsupported baselines, missing/out-of-order prerequisites, non-actionable Moves, empty/duplicate checklist requirements, arbitrary numeric subdivision and unsupported financial capacity. A smaller-step revision receives one additional independent model review. At most two configured providers are used, with the existing one fast transient retry; the chain has a 55-second deadline. No unbounded regeneration loop.
- Financially constrained users without a stated affordable surplus get prerequisite milestones rather than invented dollar targets. A distant journey may cover the next stretch. Completing a stretch does not record the original destination as reached. Further stretches reopen the same Chart, retain historical rows/events and do not exhaust the active-route limit as history grows.
- Adjust Route has four quick instructions and free-form feedback, plus the existing explicit destination-change option. Proposed guidance, destination changes and next Move are visible before applying. Proposal version/ownership/expiration checks remain server authoritative. Failed generation leaves the existing route intact. Completed waypoints stay locked. Recorded numeric/checklist progress cannot be silently erased by retained-waypoint edits; replacements require the existing progress-rewrite confirmation and retain historical rows and completed Moves.
- Numeric tracking supports signed values, zero targets, increasing/decreasing baselines, fractional values and unit-sensitive increments. Checklist requirements persist separately from Moves; toggles publish refreshed server state. Completion tracking shows Not reached/Reached without a fabricated binary percentage. Users can override the tracking type in Edit Waypoint.
- Destination input and adjustment use existing cream tokens. Edit Waypoint has a contained cream surface, scrolling, keyboard avoidance, safe-area padding and Save/Cancel; failed saves retain the draft. Completed One Moves keep readable full text. Course Log uses existing action snapshots where available and retains honest generic wording for unknown historical details. Map artwork, gestures, fog and waypoint-reveal sequencing are retained.

## Entrance sound root cause and fix

The recording shows an entrance followed by persistent audio. Source inspection found the air loop was started for the entire focused Chart screen; a delayed duck-recovery timer could also raise its volume after a stop had begun. The creation intro attempted a fade during unmount after managed players could already have been released.

The air bed is now owned by the actual entrance sequence and stops when it settles, including normal, skip and cancellation paths. Creation intro completion explicitly stops the bed. Stop cancels duck recovery; recovery cannot revive a stopping player. Background/inactive transitions immediately stop the bed and cannot start another one. Blur/unmount cleanup remains. SoundPool, AudioSession ownership and existing settings gates are retained. Six lifecycle regressions were added; five were observed failing before the sound repair.

## Schema and compatibility

Production migration: `backend/prisma/migrations/20261009000000_chart_intelligence/migration.sql`.

- Course: nullable `actual_starting_point`, `route_scope` default DESTINATION, `route_start_position` default 0.
- Proposal: nullable `actual_starting_point`, `route_scope` default DESTINATION.
- Waypoint: nullable requirements JSON and completion criterion; widen progress mode to fit checklist/completion.
- No destructive data migration or invented backfill. Existing moves/none modes and all recorded metric/reach values remain supported.

The full existing migration history plus this migration applied on isolated localhost PostgreSQL. An additional test applied the exact new SQL to populated transaction-local legacy tables, verifying unchanged values, reached dates, modes, destination/version and accepted proposal status. Widening the column changes PostgreSQL prepared-plan metadata: the test uses a fresh query after expansion, and deployment must restart backend database connections after migration. Deploy schema/backend first, then the mobile update. Roll back application behavior using existing Chart feature flags while leaving additive columns in place; do not drop new fields after users have recorded data. No production migration was executed in this pass.

## Validation results

| Check | Result |
| --- | --- |
| Broad mobile Chart/map/screen/hook regression suite | 64 suites, 655 tests passed; 1 snapshot passed |
| Latest editor/progress/adjustment checks after cream polish | 4 suites, 87 tests passed (overlap with broad suite) |
| Backend Chart/Course/Waypoint checks | 7 suites, 92 tests passed |
| Real PostgreSQL integration cases within backend run | 21 passed, including populated legacy migration |
| Mobile TypeScript | Passed, exit 0 |
| Backend TypeScript build | Passed, exit 0 |
| Android production bundle export | Passed, exit 0 |
| Live configured AI providers | Create + smaller-step proposals returned validated next stretches; original destination retained |
| Diff whitespace validation | Passed |

Real database cases verify all three tracking modes, stale versions/proposals, Move completion and idempotency, replacement history, reviewed next Move storage, and seven consecutive stretch extensions retaining fourteen reached waypoint rows. The $111,000 regression first rejects arbitrary numeric reductions, then accepts a reviewed prerequisite route while preserving the recorded $20 metric, completed Move and CourseEvent rows. Tests cover beginner fitness, career prerequisites, creative nonnumeric goals, existing business traction, absent Vision/photo/start, malformed outputs, transient retry and provider failure. Progress presentation tests include decreasing targets, target zero, checklist/Move independence, failed editing and completed text.

Logs are local verification artifacts named `chart-intelligence-mobile-tests.log`, `chart-intelligence-final-ui.log`, `chart-intelligence-backend-tests.log`, `chart-intelligence-mobile-tsc.log`, `chart-intelligence-backend-build.log`, and `chart-intelligence-android-export.log` in this directory. The temporary database is stopped. The generated Android export is retained at `anchor/mobile/.chart-intelligence-export` because automatic cleanup was blocked by tool policy.

## Before/after route evidence

These are test-fixture resources, not invented user account data. The supplied starting point was: limited resources, no investments, little spare money, fifteen minutes available today to review accounts, and no known net-worth total. Destination: Reach $111,000 net worth.

Before, the old deterministic fallback derived numeric targets from fixed fractions: approximately $10,000 → $30,000 → $55,000 → $111,000, without evidence of affordable capacity. This example is reconstructed from the old source, not presented as a captured old model response. An early live candidate also illustrated the problem: all accounts reviewed → $100 monthly margin → $500 buffer → investment account → $5,000 portfolio. That candidate was inadequate and led to additional deterministic capacity/scope checks. Its captured fixture output is retained in `chart-intelligence-live-ai-rejected-example.json` for review; it is not an accepted-quality example.

After, the final live initial route was:

1. Account balances mapped — available existing account balances listed.
2. Essential monthly costs established — essential expenses calculated from records.
3. Affordable contribution identified — a repeatable amount chosen from actual capacity.
4. First deliberate allocation executed — the chosen affordable transfer or payment completed.

The final live smaller-step revision changes the first milestone to **Identify one accessible account balance**, with completion criteria requiring the balance of **one** existing account. Its One Move is **Check the balance of one accessible bank account today**. Future milestones retain expense/capacity prerequisites. All numeric targets remain null. The first milestone now covers one item instead of every account, and no unsupported savings amount is introduced. Both proposals retain the original $111,000 destination and NEXT_STRETCH scope. The final captured model output is `chart-intelligence-live-ai.json`.

The live test can be repeated from backend with `node -r ts-node/register/transpile-only scripts/verifyChartIntelligence.cjs` after explicitly configuring a migrated disposable localhost database on port 55439 and enabling the existing Chart flags. It invokes configured paid providers, creates a fixture user, writes the report and removes that fixture user. Never run it against a production database.

## Acceptance limits and product decisions

Implementation and the verification above are complete; the full device definition of done is **not yet certified**. The Android emulator reports boot complete but its window/activity/input services fail or hang even after a restart. Consequently authenticated native creation/adjustment, keyboard dismissal, visual comparison, physical entrance listening, iOS behavior and frame pacing are unverified. Passing Jest, TypeScript, PostgreSQL and export checks does not replace those checks. No OTA, development build or backend deployment was performed.

Live primary-provider outputs sometimes fail prerequisite validation and fall back to the configured secondary provider. Validation is fail-safe and bounded, but model review plus deterministic checks cannot prove every possible personal journey achievable. Exhausted creation uses the existing clearly labeled manual outline requiring user naming; failed adjustment leaves the route unchanged.

No additional product approval was needed for the requested scope. Decisions: preserve the full destination while planning the next stretch; keep requirements distinct from actions; protect recorded progress by rejecting incompatible retained edits or explicitly reviewing replacements; retain legacy progress modes without inferred backfills. Deployment/migration and device acceptance remain separate operational work.

## Changed files for this pass

Unrelated concurrent Anchor Details/Home edits were preserved and are excluded below. Generated exports and ignored logs are artifacts rather than source changes.

- `anchor/mobile/src/adapters/v2/chart/__tests__/chartV2Model.test.ts`
- `anchor/mobile/src/adapters/v2/chart/chartV2Model.ts`
- `anchor/mobile/src/components/v2/chart/ChartActiveView.tsx`
- `anchor/mobile/src/components/v2/chart/ChartAdjustPanel.tsx`
- `anchor/mobile/src/components/v2/chart/ChartCreationFlow.tsx`
- `anchor/mobile/src/components/v2/chart/ChartDestinationReached.tsx`
- `anchor/mobile/src/components/v2/chart/ChartIntroOpening.tsx`
- `anchor/mobile/src/components/v2/chart/ChartOneMoveRow.tsx`
- `anchor/mobile/src/components/v2/chart/ChartRealityInput.tsx`
- `anchor/mobile/src/components/v2/chart/ChartRouteEditor.tsx`
- `anchor/mobile/src/components/v2/chart/ChartWaypointContent.tsx`
- `anchor/mobile/src/components/v2/chart/__tests__/ChartIntroOpening.test.tsx`
- `anchor/mobile/src/components/v2/chart/__tests__/useChartSound.test.ts`
- `anchor/mobile/src/components/v2/chart/map/__tests__/chartProgress.test.ts`
- `anchor/mobile/src/components/v2/chart/map/chartMapContracts.ts`
- `anchor/mobile/src/components/v2/chart/map/chartProgress.ts`
- `anchor/mobile/src/components/v2/chart/panel/ChartPanelCards.tsx`
- `anchor/mobile/src/components/v2/chart/panel/__tests__/ChartActiveViewReveal.test.tsx`
- `anchor/mobile/src/components/v2/chart/panel/__tests__/ChartIntelligenceProgress.test.tsx`
- `anchor/mobile/src/components/v2/chart/panel/__tests__/ChartWaypointContent.test.tsx`
- `anchor/mobile/src/components/v2/chart/useChartSound.ts`
- `anchor/mobile/src/components/v2/vision/board/__tests__/visionCanvas.test.ts`
- `anchor/mobile/src/components/v2/vision/ceremony/VisionCeremony.tsx`
- `anchor/mobile/src/components/v2/vision/ceremony/VisionDevelop.ts`
- `anchor/mobile/src/components/v2/vision/ceremony/VisionPrint.tsx`
- `anchor/mobile/src/components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx`
- `anchor/mobile/src/components/v2/vision/ceremony/__tests__/VisionContinuity.test.tsx`
- `anchor/mobile/src/components/v2/vision/ceremony/visionCeremonyCopy.ts`
- `anchor/mobile/src/constants/v2/chartCopy.ts`
- `anchor/mobile/src/hooks/__tests__/useChartPreview.test.tsx`
- `anchor/mobile/src/hooks/useChartPreview.ts`
- `anchor/mobile/src/hooks/v2/chart/useAnchorChart.ts`
- `anchor/mobile/src/screens/v2/chart/V2ChartAdjustScreen.tsx`
- `anchor/mobile/src/screens/v2/chart/V2ChartJourneyScreen.tsx`
- `anchor/mobile/src/screens/v2/chart/V2ChartScreen.tsx`
- `anchor/mobile/src/screens/v2/chart/__tests__/V2ChartAdjustScreen.test.tsx`
- `anchor/mobile/src/screens/v2/chart/__tests__/V2ChartFlows.test.tsx`
- `anchor/mobile/src/screens/v2/chart/__tests__/V2ChartJourneyScreen.test.tsx`
- `anchor/mobile/src/screens/v2/chart/__tests__/V2ChartScreen.test.tsx`
- `anchor/mobile/src/screens/v2/vision/V2VisionScreen.tsx`
- `anchor/mobile/src/screens/v2/vision/__tests__/V2VisionScreen.addImage.test.tsx`
- `anchor/mobile/src/services/v2/chartV2Api.ts`
- `anchor/mobile/src/types/chart.ts`
- `backend/prisma/migrations/20261009000000_chart_intelligence/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/scripts/verifyChartIntelligence.cjs`
- `backend/src/api/routes/courses.ts`
- `backend/src/api/routes/v2/chartRoutes.ts`
- `backend/src/domain/v2/__tests__/visionCaption.test.ts`
- `backend/src/services/CourseService.ts`
- `backend/src/services/WaypointStateService.ts`
- `backend/src/services/chart/ChartPlannerService.ts`
- `backend/src/services/chart/ChartService.ts`
- `backend/src/services/chart/__tests__/chart.integration.test.ts`
- `backend/src/services/chart/__tests__/chartPlanSchema.test.ts`
- `backend/src/services/chart/__tests__/chartPlanValidation.test.ts`
- `backend/src/services/chart/__tests__/chartProgressPreservation.test.ts`
- `backend/src/services/chart/chartPlanPrompt.ts`
- `backend/src/services/chart/chartPlanSchema.ts`
- `backend/src/services/chart/chartPlanValidation.ts`
- `backend/src/services/chart/chartTemplateRoute.ts`
- `backend/src/types/chart.ts`
- `docs/verification/chart-intelligence-2026-10-09.md`
- `docs/verification/chart-intelligence-live-ai-rejected-example.json`
- `docs/verification/chart-intelligence-live-ai.json`
