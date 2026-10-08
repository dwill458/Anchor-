# Vision add-image ceremony — 7 October 2026

Implemented the attached ceremony brief in the existing V2 Vision flow. Ask is the create/add entry, generated candidates develop only after their actual image loads, Choose is a single tap, Keep edits an intention-prefilled caption, and the 1600 ms hold commits once before the existing arrival flight. Direct photos stay local until Seal. Failed saves remain sealed and retry without another hold or duplicate uploads. AI regeneration still uses the same generation service and sealed board images offer Regenerate/Remove with Replace deferred.

The nullable 80-character caption is accepted, persisted, and returned by the backend. Mobile tolerates older responses without it. Crop persistence and captions on board layouts without sufficient paper margin remain explicitly deferred, as requested.

## Validation

- Focused Vision: 32 passing suites, 235 passing tests. Ceremony coverage is 91.83% statements / 84.54% branches; every new ceremony file exceeds the requested 70% / 60% bar. [Results](mobile-vision-tests.txt). This is scoped ceremony coverage, not a claim about whole-app coverage.
- Mobile TypeScript: [mobile-types.txt](mobile-types.txt).
- Backend: 51 passing suites, 898 passing tests; 2 suites and 19 tests already skipped. [Results](backend-tests.txt), [TypeScript](backend-types.txt).
- Full mobile run: 398 passing suites, 3721 passing tests. Four failures outside Vision remain: SettingsScreen, legacy ChartPreview snapshots, AuthHydrationService, and the Home isolation assertion. These also failed in the initial full run. [Full results](mobile-full-tests.txt).
- Prisma schema validation passed; scoped `git diff --check` passed.
- Regression checks cover image availability/load gating, interrupted reveals, AppState activation during subscription, partial generation failure/retry, local-photo upload timing, hold/release/accessible activation, caption persistence, sealed retry, paywall resume, and selection analytics before persistence.

## Android native presentation checks

Captured from the installed development app on the Vision_QA Android emulator (786 × 1704), using the existing dev-only Vision visual host and production ceremony/board components:

| Beat | Capture | Observed |
| --- | --- | --- |
| Ask | [ask.png](ask.png) | Empty print frame, three entry choices, no intro photography. |
| Keep | [keep.png](keep.png) | Real local image, editable caption, reframe hint, Keep action. |
| Seal | [seal.png](seal.png) | Smaller persistent print and hold target. |
| Sealed | [stamp.png](stamp.png) | Stamp stays above caption; sealed confirmation appears. |
| Pinned | [pinned.png](pinned.png) | Cream board, new-image gold pin, “Sit with it now” header. |

The native checks use a local fixture image and a fixture save callback. They verify presentation and native interaction; they do not verify authenticated generation, uploads, API persistence, subscription/paywall behavior, iOS, screen-reader operation, physical-device audio/haptics, or sustained 60 fps. Automated checks exercise the real mobile API boundary with mocks and backend persistence with a mocked database.

## Release order

No deployment was performed. Apply the additive caption migration and deploy the backend before mobile sends captions; the current server's strict schema can reject them until updated. Then ship mobile and complete authenticated Android/iOS acceptance, including generation, own-photo multi-select, resume, accessibility, and device frame pacing.
