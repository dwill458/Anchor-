# Anchor Vision 2.1 implementation plan and outcome

Design is frozen. This extends the existing native application. No deployment, OTA, production migration, or release is authorized or performed.

## Baseline and references

- Branch: `feat/vision-conversational-creation-20261020`; baseline HEAD `578e1d6a69a19550981f02260ea1e6db73147319`.
- Preserve pre-existing `flowFonts.ts`, root phone captures, and concurrent Gemini/environment changes.
- Read attached final prototype, final Implementation Handoff Sections A-H and `.tmp/vision-prototype/final`. The handoff supersedes the provisional revision field and per-layout scene arrangement proposal. No new board revision column or independent per-layout photo order.
- Existing chain: `VisionService` -> `useV2Vision` -> `V2VisionScreen` -> `V2SavedVision` -> `VisionBoard` -> shared scene/photo/note components. Visualize and Share Studio retain existing renderers and pipelines.
- Initial focused baseline: backend 16 suites/175 tests; mobile 122 suites/1,352 tests. These were feature subsets, not full-suite passes.

## Implemented slices

1. Persistence/API: additive `Vision.boardLayout` enum and nullable sparse `VisionNote.layoutPositions`; existing `updatedAt` concurrency convention; atomic owned slot PUT; atomic replacement through existing scene PATCH. Default Classic and canonical content retained. Migration and model/service tests added.
2. Reliable mutations: confirmed read results, rollback, account/Anchor serialization, stale GET invalidation, encrypted idempotent writes retained until acknowledgement, conditional inverse Undo. Failed saves remain visible through offline Retry. Refresh/reopen replays retained requests with their original preconditions.
3. Shared geometry: pure composition, native font measurements, existing scene renderer. Classic source slots retained; adaptive rows and presentation-only note projection. Approved Editorial/Scrapbook recipes support 1-8 photos. Crop, print, caption and note geometry feed Saved Vision, Visualize, thumbnails and exports.
4. Saved UI: approved live Layout sheet and preview/cancel/apply/rollback/Undo; Begin dock tracks actual button bounds. Existing photo controls and full-screen note composer retained. Focal Reset/Cancel/Done remains local until Done. Final photo protected; Extend unavailable.
5. Integrations: layout passes through practice navigation and frozen preparation. Guided audio, beatmaps, session lifecycle and completion logic retained. Share background suggestion remains separate from layout and respects manual selection. Export pipeline, dimensions, entitlements and watermark rules retained.
6. Native fixes: measured control row outside artwork; focused print/caption fits safe bounds; offline Retry retains errors; Android captions draw above elevated paper; capture mounts only after native measurement and waits for rendered captions.

## Verification

Evidence and exact paths are in `vision-2.1-implementation-report.md`. An x86_64 development APK was built and installed only on an isolated API 36.1 emulator. Metro 8081 serves this checkout; extra Metro ports stopped. Native fixtures never save to an account. Actual exported PNGs were pulled from DCIM and inspected. Browser and mocked evidence cannot establish authenticated persistence, personalized persisted Anchor identity, audio fidelity, two-device behavior or physical frame pacing. Native ANR evidence is preserved and remains an acceptance gate until resolved or isolated.

## Rollback and eventual rollout

Revert only Vision 2.1 application changes while retaining the additive columns and arrangement data. Older clients ignore them and render Classic. Never reset the shared dirty checkout. Destructive rollback SQL is an emergency reference requiring backup and explicit authorization; not executed.

Before a future authorized rollout: validate on disposable PostgreSQL, apply schema before backend/client, run authenticated legacy/cross-device acceptance, then S24/iPhone and lower-performance QA. A green feature subset does not establish release readiness.
