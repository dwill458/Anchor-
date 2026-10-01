# Vision 2 audit — 2026-09-30

## Contract and design
The attached written specification overrides the reference's serif, parchment, compass, handwriting and mountains. Photography leads, the persisted Anchor SVG connects scenes, cream surrounds the overview, ink surrounds creation. Preserve existing Inter typography, server authority and protected cinematic timing.

## Touchpoint inventory
| Area | Files / responsibilities | Decision |
| --- | --- | --- |
| Overview | `screens/v2/vision/V2VisionScreen`, `V2SavedVision`, `VisionAddSheet` | Preserve CRUD, archive, permissions, reorder and replacement; cream editorial overview, clamp statement, quiet Chart link. |
| Shared composition | `board/VisionBoard`, `VisionBoardScene`, `VisionBoardPhoto`, `VisionBoardIntentionCard`, `useVisionBoardScene`, layouts, camera, motion, reorder | Reuse stable roster, gestures, accessibility actions and camera; replace physical materials and normalized layout with canvas geometry. Three overview scenes; complete collection accessible for editing. |
| Previews | `VisionBoardPreview`, `V2HomeVisionSection`, `V2HomeScreen`, `V2AnchorDetailsScreen` | Replace shared preview materials. Keep Home SEE before Today, seen/unseen state, errors and retries, Details navigation and continuous Anchor transition. |
| Creation | `V2VisionCreationFlow`, `VisionMomentInput`, entrance stage, curation/upload, `V2VisionAddScene`, `V2VisionAddPhoto` | Preserve production saving, entitlement resume, uploads, selection ordering. Remove illustrative fake future from empty/input; dark input and large candidates. |
| Generation | `VisionGenerationBoard`, `VisionDevelopingPhoto`, `VisionGenerationStage`, presentation queue, progress helpers | Remove frame/pin/decor; truthful dark materialization using actual candidates. Keep polling, retries and partial recovery. |
| Reference | `useVisionAppearanceReference`, `useProfilePhotoForVision`, `VisionMomentInput` | One optional private reference per existing API. Preserve consent, ownership, upload/removal and expiry; no new multi-person contract. |
| Visualize preparation | `V2PracticeScreen`, `V2VisualizePrepareScreen`, `useV2Vision`, `cinematicAssets` | Prewarm exact frozen assets, readiness before Begin, no decoration assets in readiness gate. |
| Cinematic | `V2CinematicSessionScreen`, `CinematicSessionStage`, `cinematicSessionMotion`, timeline, guidance, geometry, audio manifest, engine/audio hooks | Preserve timing, film motion, image order, active clock and audio. Replace physical scene and photo aperture; remove frame/pin textures. |
| Completion | `PracticeCompletionService.commitVisualizeCompletion`, `V2PracticeScreen`, `V2FocusCompleteScreen`, lifecycle and Thread tests | Already wired in this checkout: guarded single commit and canonical Thread handoff. Verify rather than add a second model. |
| Alternate Visualize | `V2VisualizeSessionScreen`, `visualizeVisionPlan`, `visualizeBoardCamera`, signature prototype | Audit imports; shared geometry change must not introduce physical materials through older paths. Preserve session contract. |
| Chart | overview summary, `V2ChartScreen`, `chartScreenSupport`, `V2ChartPreview` | Keep real route, waypoint and navigation; no giant illustration on Vision. |
| Other entry points | `AnchorV2Navigator`, routes/types, Practice prepare/session, paywall resume, Today/recent activity, Progress, Weekly Insight, Release, development Home | Preserve navigation, premium context and recommendation authority; no alternate physical board renderer. Onboarding mentions Vision concept only. |
| Data | adapters `visionAdapter`, Home adapter; `useV2Vision`, generation hooks, `visionApi`, `visionPhotoInput`, startup prefetch | Reuse encrypted account-scoped cache, unknown/error/empty distinctions, real URLs and ordering. |
| Backend | `visionRoutes`, `VisionService`, `VisionGenerationService`, `VisionAppearanceReferenceService`, `visionScenePlanning`, `ImageGenerationService`, Prisma Vision models | No schema/API rewrite. Preserve provider/fallback safety, retry limits, ownership, idempotency and entitlements. |
| Analytics | `AnalyticsService`, hook operations, session analytics/backend generation | Existing session events retained; audit meaningful Vision lifecycle events and add absent client equivalents without duplicates. |
| Legacy assets | `visionBoardAssets`, generated metrics, board builders, environment assets, Ghost/Real compositions and ApertureGrid | Search actual references before cleanup. Retain compatibility names for shared motion contracts; remove physical renderers/assets only after no live consumers. |
| Tests | Vision component, hook/adapter, overview CRUD, Home/Details, preparation/readiness/lifecycle, Thread completion, backend generation/provider suites | Baseline first; add count/error/readiness/collection tests and update retired physical presentation assertions. |

## Existing work preserved
Initial dirty files: VisionAddSheet, VisionChrome, their tests, VisionBoard and new test, Visualize preparation and test, typography, backend scene planning and test. No resets or unrelated rewrites.

## Risks and validation boundary
Native Android/iOS frame-by-frame performance needs actual runtime QA; unit tests and Expo export cannot establish that. Source audit shows completion exists; the reported missing behavior must be validated against this exact checkout, not assumed from an older version.

## Final audit outcomes
The production navigator override was removed so Vision owns prepared direct entry. Details confirmed-empty Vision is now text and a real creation action; its stock-art prewarm was removed. Home/Details share hero-only previews; the full collection remains editable and available to Visualize. Unused 1.0 compositions, alternate film renderers, physical assets/builders and category entrance photographs were removed after import checks. Chart reached uses an actual authorized VisionPhoto; onboarding retains an explicitly labeled generic concept illustration. See VISION_2_DELIVERY.md for exact files, checks and acceptance gaps.
