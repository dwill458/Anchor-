# Chart review refinement and waypoint investigation

Implemented locally on 2026-10-23. No deployment, OTA, migration, or user Chart mutation was performed.

## Root cause and evidence

The recent repeated three-waypoint results originated in model planning. Production logs identify OpenAI `gpt-4.1-mini`, with no provider fallback, for the recent workout and 10,000-paying-user proposals. Both stored proposals already contained three waypoints. The latter reduced the destination to 1,000 users, 5,000 users, then 10,000 users/top-ten ranking.

There was no schema, persistence, API, frontend, or map limit of three. The prompt contained competing instructions: complexity bands, a two-to-five NEXT_STRETCH exception, a preference for five, and a preference for the smallest sufficient count. More importantly, normalization reclassified complexity from the resulting count: a three-waypoint route became SIMPLE, even when the declared destination was complex. This masked under-decomposition rather than checking the planning decision.

Older proposals separately used `deterministic-v2` / `template_outline` with three generic milestones after validation failures. The recent examples did not use that fallback. Automatic template substitution is absent from the current flow; it now returns the established retryable planning error after both providers fail. Explicitly selected manual outlines and historical proposals remain supported.

Historical raw model payloads were not retained, so their exact pre-normalization counts cannot be reconstructed. The persisted proposal and provider logs establish that this was upstream of UI rendering. The live evaluation now retains raw and validated payloads, and count-only runtime logs make future boundary comparisons possible without logging private course text.

## Pipeline trace

| Layer | Finding / updated behavior |
| --- | --- |
| System/user prompts | Model selects milestones using destination, starting progress, dependencies, measurability, Vision and adjustment context. Adaptive bands are guidance, not quotas. |
| Model schema | Newly generated routes support 2–8 waypoints. A remaining route after reached milestones may contain one. The model declares a count and short planning rationale before emitting the route. |
| Parsing/validation | Count declaration must match actual length. Declared complexity is preserved. Analyzed plans reject duplicate/missing titles, malformed numeric criteria and invalid prerequisites instead of silently repairing or dropping rows. |
| Provider fallback | OpenAI `gpt-5.4-mini` primary; Gemini `gemini-3.5-flash-lite` fallback on generation or validation failure. Both failures surface the existing error/retry flow. |
| Proposal persistence | Whole validated array is stored. Count-only logs compare validated and persisted counts. |
| Review/API | Whole array maps to draft state. Existing contracts permit up to 12 reviewed waypoints. Oversized adjustments explicitly fail rather than silently slicing. |
| Chart save/retrieval | Existing service saves every reviewed row and projects every saved row. Logs compare reviewed, saved and API counts. No parallel route store or new backend call. |
| Map/fog/progress | Existing dynamic positioning supports up to 12; geometry/fog tests cover variable counts. Course Log/progress identity and ordering stay on existing service paths. |
| Regeneration/adjustment | Same validation helper and provider chain; reached progress preservation remains in place. Existing Charts are not regenerated on retrieval. |

## Adaptive selection

The planner first considers the actual destination and remaining work, then declares its chosen waypoint count and concise reasons. Initial guidance is simple 3–4, moderate 4–5 and complex 5–7, with the absolute generation contract unchanged at 2–8. A genuinely narrower remaining stretch can be shorter; no minimum is imposed merely because a complexity label says COMPLEX.

Each waypoint must establish a meaningful achieved state. Business routes should address retention, repeatable acquisition and operating capacity before sustained scale, rather than only increasing user counts. The prompt separates these achievements from an actionable One Move for the current week, and prohibits invented baselines or arbitrary success thresholds. Vision continues to describe the destination, while present-day evidence supplies starting conditions.

The default primary model was changed after live comparisons: the old model continued to under-decompose some complex examples after prompt changes. `gpt-5.4-mini` produced the final 3/4/5 routes below in approximately 7–12 seconds. The existing Chat Completions, image-input and structured-output integration is retained; these capabilities are documented in the [official model reference](https://developers.openai.com/api/docs/models/gpt-5.4-mini). Gemini remains the fallback, as requested. Existing environment model overrides still apply.

## Live examples

These are actual live provider outputs, using explicitly stated illustrative starting conditions, without writing user Charts. Full contexts, raw responses, validated plans, count comparisons, latency and prompt hash are in [final.json](final.json). Counts matched at raw, normalized and validated boundaries.

| Destination | Starting conditions | Count | Representative route | One Move |
| --- | --- | --- | --- | --- |
| I maintain a consistent workout routine. | Sporadic exercise; three 30-minute home bodyweight slots weekly | 3 | Complete one full workout week → hold the routine through a disrupted week → work out without needing to reset | Pick the three workout slots |
| I successfully complete my first half marathon. | Comfortable 5 km twice weekly; three training days available; first half marathon | 4 | Reliable long-run base → comfortable 10 km → strong 15 km effort → complete the half marathon | Add one longer run each week |
| Anchor has 10,000 paying users. | Launched with 20 paying users; solo developer, ten hours weekly, no paid-ad budget; contact with users and subscription analytics; business Vision supplied | 5 | Understand why paying users stay → better first month for new users → repeatable acquisition channel → support steady monthly growth → 10,000 paying users | Message current users for feedback |

The complex plan establishes retention evidence, onboarding quality, a repeatable channel and support capacity before the final scale target. It avoids repeating 1,000/5,000/10,000 acquisition objectives. The example Moves can begin during the current week; they are not mistaken for completed milestone outcomes.

Additional isolated fallback calls produced Gemini routes of 3/3/4, all validated; advisory bands do not guarantee a fixed number on every call. See [adaptive-gemini.json](adaptive-gemini.json). Earlier model comparisons and [baseline.json](baseline.json) are retained as development evidence, not presented as final outputs.

## Presentation changes

- Replaced the mountain preview with a compact, auto-height destination card. Full destination text wraps, with a small dotted SVG direction cue and restrained gold endpoint. No thumbnail, map geometry, gradients or decorative animation.
- First Move heading and waypoint pill wrap or stack. Bottom buttons also wrap on narrow layouts. Existing multiline autosizing input, keyboard frame, review state, reorder, adjustment and save/reveal flow remain in use.
- Removed the obsolete preview marker animation state. The real etched map remains in the established reveal experience.
- Added a development-only `anchor://chart-review-lab` fixture for the actual review component, with a long destination and five waypoints. Fixture actions close the fixture and never save data; it is not evidence of authenticated save/reveal behavior.

## Changed files

Paths below are relative to the repository. Other dirty workspace files were preserved.

Production implementation:

- `anchor/mobile/src/components/v2/chart/ChartCourseReviewScreen.tsx`
- `anchor/mobile/src/components/v2/chart/ChartCreationFlow.tsx`
- `backend/src/services/chart/chartPlanPrompt.ts`
- `backend/src/services/chart/chartPlanSchema.ts`
- `backend/src/services/chart/chartPlanValidation.ts`
- `backend/src/services/chart/chartModelProviders.ts`
- `backend/src/services/chart/ChartPlannerService.ts`
- `backend/src/services/chart/ChartService.ts`

Focused tests:

- `anchor/mobile/src/components/v2/chart/__tests__/ChartCourseReviewScreen.test.tsx`
- `anchor/mobile/src/components/v2/chart/__tests__/chartLogic.test.ts`
- `anchor/mobile/src/components/v2/chart/map/__tests__/chartMapGeometry.test.ts`
- `backend/src/services/chart/__tests__/chartWaypointPipeline.test.ts`
- `backend/src/services/chart/__tests__/chartPlanSchema.test.ts`
- `backend/src/services/chart/__tests__/chartPlanValidation.test.ts`
- `backend/src/services/chart/__tests__/chart.integration.test.ts`
- `backend/src/services/chart/__tests__/aiPlannerVisionGeneration.test.ts`
- `backend/src/api/routes/v2/__tests__/chartRoutes.test.ts`

Evaluation and development support:

- `backend/scripts/evaluate-chart-waypoints.ts`
- `backend/scripts/inspect-chart-waypoint-counts.ts`
- `anchor/mobile/src/screens/v2/system/ChartCourseReviewFixture.tsx`
- `anchor/mobile/src/screens/v2/system/ChartLabDevHost.tsx`
- This report and generated evidence in `tasks/chart-review-refinement/`.

`ChartRouteEditor.tsx` already contained changes from the preceding review-screen implementation; this refinement reuses that editor without another route-management implementation.

## Verification and remaining limits

- Backend: six focused suites, **100 tests passed**; backend TypeScript check passed.
- Mobile: four focused suites, **60 tests passed**, including review rendering/autosizing, route mapping/reorder, geometry/fog and intro preparation.
- Pipeline tests exercise counts 3–8 through raw model output, validation, proposal storage/retrieval, reordered review, actual Chart service calls backed by an in-memory repository, saved projection and API projection. API contracts also cover 12. These are not claims of new production database writes.
- Mobile geometry tests cover 2–8 and 12 waypoints. Existing Course Log event counts and progress-preservation tests passed.
- Scoped backend lint: no errors, five existing return-type warnings, with the existing Prettier formatting rule excluded. Scoped `git diff --check` passed.
- Mobile TypeScript still fails on existing unrelated Shop product types/StyleSheet usage, Visualize voice manifests and duplicate navigation type entries. It reports no Chart or new fixture errors. The disposable-Postgres integration suite was not run.
- Android rendering could not reach the fixture: the installed development client fails the existing SQLCipher approved-cohort guard before App mounting. The guard was not changed. `android-launch.png` is only launcher/dev-menu evidence, not a review-screen screenshot. iOS device QA remains outstanding, as do authenticated keyboard, drag touch targets and reveal frame-pacing checks on both platforms. Visual parity is not claimed from component tests alone.
- Generated routes remain limited to 8; user-reviewed routes and existing map placement remain limited to 12. No persistence migration is required. Existing One Move edit contract remains 120 characters.
- Read-only production snapshots before and after show **10 existing Charts unchanged**, including waypoint and Move data. Both snapshots have content hash `580428e1b8f00b1d5eb350f1d79d4fb68ae5de980d87d1c551189206372ba1fe`. See [before](existing-charts-before.json) and [after](existing-charts-after.json). Historical saved routes with five and six waypoints also match their original proposal counts.

The implementation is local and needs normal backend/mobile publication before production behavior changes.
