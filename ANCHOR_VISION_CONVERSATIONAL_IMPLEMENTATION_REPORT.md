# Anchor Vision Conversational Creation implementation report

Date: 20 October 2026. Branch: `feat/vision-conversational-creation-20261020`.

**Status: local implementation, targeted automated checks, live-provider fixtures and selected native visual/interaction checks completed. Release remains gated on staging and authenticated device acceptance. No production deployment, OTA, push, or merge has been performed.**

## Executive summary

Extended the existing Vision ceremony with up to five role-labelled references, explicit CREATE/COMPOSE/EDIT/VARIATE intent, exact-candidate refinement, persistent rounds and lineage, encrypted drafts, and session recovery. Initial generation and refinement retain the two-candidate experience. Earlier candidates remain available and can enter the existing caption, seal, and board-arrival flow.

New creation no longer automatically attaches board photographs or their spatial constraints. EDIT receives its exact parent candidate separately from the five attachment slots. The existing photo-expansion implementation is already in this branch's ancestry and has been exercised without merging celebration-layer work.

## Baseline and change control

- Started at `8e82063206049234147f5ef2eae62b8bb63c43dd` on `feat/celebration-layer`; created the implementation branch without switching/resetting the checkout or merging other branches.
- Authoritative checkout: `E:\Projects\Anchor`; mobile: `anchor/mobile`; backend: `backend`. Inspected registered worktrees and the installed packages before editing.
- Mobile declares Expo 58.0.14, React Native 0.88, React 19.3 and TypeScript 6. Node is 24.15.0; generated backend Prisma client is 5.22. No package upgrades or project dependency installations were made.
- Preserved the pre-existing Chart and Thread edits, including the Thread Float migration and untracked Chart live test. Only Vision additions to the shared Prisma schema were staged; the user's Thread schema changes remain outside these commits.
- Read the technical audit, final handoff, editable HTML, and final PNG exports in the approved Antigravity folder. Earlier conceptual designs were not used as the specification.
- Baseline details: [baseline checkpoint](docs/vision-conversational-baseline-20261020.md).

## Agent contributions

Sol defined the contracts and database design; implemented backend intent/reference isolation, generation integration, provider routing, API validation, owner scoping, mobile generation and persistence hooks, ceremony integration, actual board-entry recovery, seal-acknowledgement recovery, migration verification and live provider acceptance. Sol reviewed delegated changes and fixed lifecycle and account-boundary findings.

- Luna A combined the gallery and composer tasks: role chips, five-reference strip, creation presentation, selection/inspection presentation, actual Add Scene sheet adaptation and focused interaction tests.
- Luna C implemented the refinement sheet and its tests, backend service/worker/route tests, independent backend review, and the retention service/CLI under Sol's policy and interfaces.
- Luna D implemented version/lineage and resume presentation, durable-hook tests, the development QA host, and screen-level resume/draft/sealing regression fixtures.
- Luna F independently read the visual-truth exports and reviewed actual captures. Its final score is 9.3/10 for seven selected states; viewport coverage and limitations are recorded in the scorecard.

Shared integration files, generation hooks, provider adapters and Prisma architecture remained under Sol's control. Delegated work used nonoverlapping file ownership in the shared implementation branch.

## Backend architecture and API compatibility

The API's operation expresses user intent independently of the provider endpoint:

| Operation | Source policy | Behaviour |
|---|---|---|
| CREATE | Only explicitly selected attachments | New independent scene; no board-photo inheritance |
| COMPOSE | Two to five explicit attachments | New composition using each role; an image-edits endpoint may implement it |
| EDIT | Exact owned parent candidate plus zero to five attachments | Preserve source content except the requested changes |
| VARIATE | Exact owned parent candidate plus optional attachments | Preserve intended subject; allow composition changes |

No classifier call is added to these explicit UI actions. Uncertain attachment roles default to Inspiration and remain editable.

`POST /api/v2/anchors/:anchorId/vision/scene-generation` retains the legacy single-reference request while accepting operation, sessionId, parentCandidateId and ordered structured references. Legacy and structured reference inputs cannot be mixed. The session API provides owner-scoped create/read/update endpoints under `/vision/creation-sessions`.

Validation covers five distinct asset IDs, role allowlist, labels, prompt limits, image ownership/type/size, exact source membership and ownership, permitted operation/source combinations, viewed-round membership, and the exact chosen board asset at sealing. Existing authentication, entitlement and AI rate limits remain in force.

Existing generation jobs, candidates, polling and retries are reused. A Vision row lock serializes quota checks, job idempotency and round numbering across replicas. Persisted request fingerprints reject reuse of an idempotency key for different input. Two candidate calls run with bounded concurrency. Completed candidates survive partial failures and retries.

Abandon/expiry cancels unfinished job state. Workers and the provider chain check the session before starting subsequent calls, retries/fallback and persistence. An already accepted external provider request cannot be revoked and may still incur a charge; its result is discarded after cancellation.

## Database and retention

Migration: `backend/prisma/migrations/20261020220000_vision_conversation/migration.sql`.

- Added `VisionCreationSession` and ordered `VisionGenerationReference` associations.
- Extended existing generations with nullable session/round/source links and a CREATE operation default. Existing candidates remain the stable candidate IDs and asset source of truth.
- Added session/round uniqueness, role/slot/operation checks, explicit non-null round numbers for session-bound jobs, and source-candidate foreign keys.
- Draft reference JSON represents an unsubmitted mutable draft; normalized job-reference rows represent the immutable submitted round. They have separate purposes.
- Legacy rows survive with their prior assets and default CREATE operation. No destructive backfill or deployed database change was run.

Sessions expire after 30 days. The dry-run-by-default maintenance command processes at most 50 sessions per run after an additional seven-day grace period:

```powershell
cd backend
npx ts-node src/scripts/purgeExpiredVisionConversations.ts
# Review output first. --apply performs deletion and needs release/operator authorization.
```

The purge rechecks expiry under a row lock, uses a serializable transaction, and preserves board images, shared candidates/references, appearance references, legacy sources and other owner drafts. Reference uploads remain under the existing account asset-retention policy. Only unshared generated outputs become eligible for deletion. Storage removal uses the existing best-effort deletion service: reported cleanup requests are not confirmation of physical object deletion. Bucket inventory/retry monitoring remains an operator responsibility.

No maintenance command was run against a live database. The isolated migration harness exercised PostgreSQL constraints, session-history deletion, board-asset preservation and complete account deletion.

## Frontend and recovery

Creation uses the current scene field, dictation, typography/theme, keyboard frame and CTA patterns. The reference gallery supports camera/library, roles, remove/replace, five-photo full state, compact keyboard presentation and count summary. Uploads run sequentially and React state stores local URIs/asset IDs, not five full-size base64 strings.

The actual board Add Scene entry now uses the gallery and durable owner-bound draft. Reopening an unfinished server session offers E1 before a new generation. Returning directly from generation to its draft preserves that session explicitly; starting a different scene clears its visual-reference scope. Regenerating a saved board scene starts with a fresh scope.

Selection reuses the photographic print treatment, inspection and existing keep/seal transitions. Version navigation selects the real two-candidate round. Lineage walks exact candidate IDs, not merely version numbers. Viewing an old round does not rewrite newer rounds. Variation asks for a source when the viewed round has no selected candidate; initial "Neither feels right" remains an independent reroll.

Encrypted drafts are owner/Anchor scoped and retain pending generation idempotency keys across process restarts. Foreground recovery refreshes signed asset URLs. Account/Anchor changes remount ceremony snapshots to clear old images and references immediately. Failed source-image loads can refresh the exact viewed round.

After a confirmed board save, a durable seal receipt is written before the session acknowledgement. A restart retries the exact acknowledgement, never the board mutation. The server accepts replay only for the same already-kept candidate. Expired session receipts are discarded after the already-confirmed board save.

The ceremony's seal hold, arrival coordinator, sounds and haptics were retained. Board layout, note rendering and Visualize implementation files were not redesigned.

## Photo expansion verification

GitHub PR #340 was verified as an open draft containing paper/entrance work, not the expansion implementation described in the prompt. Its head was already in local ancestry. Expansion commits `eb2e9811` and `938c6ed2` are present; `eb2e9811` is an ancestor of the initial checkout. No branch merge or cherry-pick was needed.

Reused `visionPhotoExpand.ts`, `GeminiImageService.extendVisionPhoto`, `VisionPhotoFitScreen.tsx`, `visionPhotoFitProcessing.ts` and `POST /api/v2/vision/photo-expand`. Keep Original, Crop to Fit, Expand with AI, entitlement checks and unavailable-endpoint handling remain. Gallery references do not enter Photo Fit.

A live run of the existing expansion pipeline produced a 1080×1920 image from a square source while retaining the original center. Route/pixel-preservation tests passed. This validates the local pipeline, not production endpoint availability.

Railway's latest inspected production deployment was successful (`06838f70-2a96-429d-973b-756b52004dad`, 20 October 2026 UTC), but its CLI deployment did not expose a commit SHA. Read-only HTTP logs for `/api/v2/vision/photo-expand` showed four 404s and one 401 on 20 October, with no successful expansion in those sampled requests. Deployed endpoint functionality is therefore not confirmed. An authenticated expansion smoke test is required after the coordinated backend release.

## Automated validation

| Check | Actual result |
|---|---|
| Mobile targeted Vision/Photo Fit/board/notes/Visualize/share/navigation, development picker, shared-sheet gesture and animation-harness tests | 92 suites, 944 passed, 0 failed |
| Backend Vision/image-provider/scene/caption/note/expansion/route/retention tests | 20 suites passed, 240 tests passed; 1 database integration suite/2 tests skipped |
| Disposable PostgreSQL migration harness | 8 checks passed |
| Backend and mobile TypeScript | Both final commands exited 0 after source corrections |
| Prisma schema validation and client generation | Passed |
| Scoped backend ESLint | 0 errors; 19 existing/inferred-return-type warnings |
| Mobile ESLint | Unavailable: installed ESLint 10.13.0 finds no flat configuration; no dependency/config upgrade was attempted |
| Android JavaScript/Hermes export | Final source export passed; 18,185,684-byte bundle hash retained in test-summary.json |
| Android native debug packaging | Passed: x86_64 APK; 4m 9s, 815 Gradle tasks; receipt retained, generated APK removed |
| Scoped diff whitespace checks | Passed |

The first baseline mobile run had three Anchor-opacity failures. Investigation found that the shared native-free Reanimated mock never registered its initial shared-value subscriptions. The mock now subscribes and iterates a listener snapshot safely; a separate regression test proves that its stable style handle reacts to value changes. Production animation timing was not changed to satisfy tests. All three baseline failures now pass. The final visual pass also changed the empty-gallery copy; three stale label assertions were updated while explicitly retaining the assertion that no removable references remain after clearing/changing account. The subsequent full targeted run passed all 944 tests.

The initial broad backend baseline also encountered the existing `anchor2Styles` failures and the user's untracked live Chart test (`unsupported_baseline`). Those unrelated files were preserved and excluded from the final targeted Vision set. No passing claim is made for the entire unrelated repository suite.

Test commands and compact machine-readable evidence are retained in `docs/qa/vision-conversational`; temporary build/test logs are removed after verification as requested.

## Live provider and cost evidence

[Provider contact sheet](docs/qa/vision-conversational/provider-contact-sheet.jpg) and the adjacent usage receipts record actual outputs, not mocked generation. Local acceptance used two original images, two edits of exact Option 2, two five-reference compositions with Flare, a two-image Sunburst comparison, and one existing Gemini expansion. No application database or production user records were written.

Both edits visibly retain Option 2's room, desk, notebook, plant and viewpoint while changing the mug to blue and the light to sunset. Composition combines five attachments and changes the room/view to an ocean-facing studio. One fixture does not prove likeness quality, every instruction, or all provider fallback combinations.

Verified public pricing sources: [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency) and [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). GPT Image 2.5 uses $5/M text input, $8/M image input and $30/M image output tokens; direct Images API requests do not receive cached-input pricing. Flare/Sunburst token rates match, while consumption varies. Gemini 3.1 Flash Image lists $0.50/M input, $3/M text/thinking output and $60/M image output tokens.

| Operation | Measured usage-based estimate for this fixture |
|---|---|
| Initial two candidates, Flare | $0.011710; 11.8 seconds for the initial round |
| Two edits, Sunburst | $0.041398; initial plus edit round took 29.3 seconds |
| Five-reference two-candidate composition, Flare | $0.074600; 13.4 seconds |
| Same composition, Sunburst comparison | $0.080900 |
| Existing Gemini photo expansion | $0.0672 image output plus $0.000183 input; 474 other output tokens remain separately classified in the provider receipt |
| Repeated edits | In this fixture, initial $0.011710 + N × $0.041398; not a guaranteed session price |

Actual invoices, discounts and account usage were unavailable. `quality=auto`, image resolution, attachments, retries and fallback affect costs. The pre-existing adapter per-image estimates ($0.02/$0.04 and Gemini $0.005) are not billing evidence and should not set a new allowance. Existing Pro generation limits were retained: eight requests per ten minutes and twenty SCENE jobs per Vision; no global AI limit increase. At this fixture's measured usage, one initial round plus nineteen edits is approximately $0.7983, and twenty five-reference compositions approximately $1.492, before retries, storage and expansion. A per-Vision cap is not an account spending budget. Before changing allowances, measure production usage and margin across realistic sessions.

Five maximum-size reference uploads can retain up to 25 MB before generated outputs; reused asset IDs avoid another upload on retry. Uploaded references intentionally outlive the conversation purge under existing owner retention. Storage billing and deletion-failure inventory need operator monitoring.

## Native, visual and performance acceptance

The host has 16 GB RAM and no connected phone. Used one disposable headless Android emulator, approximately 2.5 GB guest RAM (image minimum), initially one core and two cores for the final short capture. Metro used one worker. The emulator was stopped during native compilation and the final full test runs, and removed afterward.

The successful native debug build used the installed JDK 17 and SDK with one Gradle/CMake worker. Windows Ninja path limits required changes to generated CMake cache values and manual native targets, followed by packaging with those configure tasks excluded. No native application/dependency source or package versions were changed. A clean ordinary Windows Gradle build without that workaround is not claimed. The first final emulator cold launch also encountered a runtime EventEmitter initialization error; a force-stop/relaunch loaded the same build successfully. This debug startup observation is retained as a limitation, not silently counted as a successful first launch.

Actual fixture captures span 375×667, 393×780, 393×852 and a simulated 480×1040 S24-class logical viewport. The [independent scorecard](docs/qa/vision-conversational/visual-scorecard.md) rates seven selected states 9.3/10; it does not certify every state at every size. A1's 393×780 suggestion overlap was corrected and recaptured. C3 uses a 56-point internally scrolling input on the shortest frame with the tall Gboard keyboard; its prompt, microphone, quick changes and CTA remain accessible. Historical intermediate captures are not acceptance evidence; an incomplete A3 393×780 frame is explicitly archived under runtime/diagnostics, and no final A3-at-780 acceptance is claimed.

Executed Android fixture interactions include opening the real IME, typing without losing focus, first Back hiding the keyboard while preserving the sheet, second Back showing the dirty-instruction guard, and guarded downward swipes followed by Keep editing restoring the changed prompt. Final review found and corrected a shared-sheet swipe exit that could outrun a guarded onClose; the new deferDragDismiss option is enabled only for refinement and preserves defaults for other callers. Focused tests and the final full mobile set cover it.

No physical Android/iOS, authenticated product end-to-end, Release-build frame pacing, or 60 FPS certification is claimed. Debug emulator timing is not a supported-hardware performance measurement. Existing Reanimated motion, cached images and URI-based references were retained, but smoothness, microphone/permission behavior, sound/haptics and process-death recovery still require authenticated device acceptance. Photo expansion was exercised as a live service fixture, not an authenticated Photo Fit journey.

## Release readiness

1. Review the retained native scorecard and its documented compact-keyboard compromise; extend acceptance to authenticated device journeys. Selected-state fixture captures at all four requested viewport classes are complete.
2. Run the additive migration against a backed-up release/staging database and execute the two currently skipped database integration tests there.
3. Release backend and photo expansion together before the new mobile client. Existing clients remain supported by the additive API.
4. Perform authenticated generation/refinement, ownership/Pro gating, restart/URL recovery, exact older-candidate sealing and photo-expansion smoke tests on that release.
5. Review maintenance dry-run output and storage retention costs before scheduling the purge. Production scheduling/deletion has not been performed.
6. Verify a current development/release build on supported Android and iOS hardware, including keyboard/back, microphone, camera/library permissions, sound/haptics and frame pacing.
7. Obtain explicit user authorization before push, merge, OTA or production deployment. Roll back the mobile/client release first if needed; leave the additive database fields in place rather than dropping history.

## Cleanup

Cleanup results are recorded in [cleanup-receipt.json](docs/qa/vision-conversational/cleanup-receipt.json). Removed 186 paths containing 16,274 files, totalling 16,401,762,058 logical bytes (15.28 GiB): primary-checkout native outputs/caches, this run's export, disposable emulator/registration, isolated migration harness, raw provider outputs and temporary logs after collecting compact evidence. Retained source, report, test/provider/build receipts and screenshots. Other worktree builds and global SDK/Gradle caches were preserved. Removed-byte totals represent logical file sizes rather than an exact measured free-volume delta.

Automatic approval review rejected final removal of `anchor/mobile/node_modules/@react-native/gradle-plugin/.gradle`, its `.kotlin` cache, and `.codex-vision-cleanup.ps1`, returning only "blocked by policy" with no more detailed reason. Those three remaining paths total 170,679 bytes, are measured in the receipt and were left in place; no bypass was attempted. The generated APK/native output directories and disposable emulator were already removed successfully.

## Exact file inventory

The [exact file inventory](docs/qa/vision-conversational/file-inventory.md) lists implementation, tests, scripts and retained delivery evidence with their purposes. The [30-flow regression matrix](docs/qa/vision-conversational/regression-matrix.md) separates automated, provider, fixture-runtime and outstanding authenticated acceptance. Pre-existing user changes are excluded.

## Known issues and unverified gates

- Two real-database integration tests remain skipped; the isolated PostgreSQL harness supplements them but does not replace staging migration/transaction validation.
- Authenticated generation/refinement, restart recovery, older-candidate sealing, entitlement transitions and expansion against the coordinated deployed backend remain unexecuted. Existing tests validate contracts and state transitions, not a deployed user journey.
- Independent visual scoring covers selected fixture states. The short-screen C3 input intentionally scrolls internally; full physical Android/iOS visual/accessibility and interaction acceptance remains outstanding.
- Native debug packaging required a Windows generated-cache workaround; EAS/Linux, iOS and Release builds were not run. The observed cold-start debug initialization error was cleared by relaunch and is not considered Release-build validation.
- No supported-hardware FPS, memory peak or startup benchmark was executed. No global limits were raised; actual account invoices and production storage costs were unavailable.
- Production photo-expansion endpoint contents cannot be proven from the inspected CLI deployment metadata/log sample. Staging/release authenticated smoke checks remain required.
- Three small cleanup targets remain after automatic approval review rejected their removal; see the cleanup receipt. Other task build outputs were removed.

Production release is not authorized by this report. Obtain explicit release authorization only after the staging/device gates above have been reviewed and satisfied.
