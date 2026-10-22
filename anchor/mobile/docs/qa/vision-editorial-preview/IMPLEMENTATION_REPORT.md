# Vision editorial preview delivery

Implemented in the authoritative mobile app, without commits, branch changes, or modifications to Notes-owned code, full Vision board layout, Chart, Practice, or Visualize. Shared-file edits preserve the existing dirty workspace.

Home shows a compact cream composition with one dominant photograph and up to two supporting photographs, a small image-count/View Vision footer, and the existing intention caption. Your Vision, View all, section placement, and routes are preserved. One and two images use their own deterministic compositions without empty frames.

Details uses a taller cream composition with up to five photographs and a clear View Vision footer. Four/five-image arrangements keep the entire primary photograph unobstructed. The large repeated intention is omitted; a distinct description remains a compact caption. Edit and existing route handlers remain intact.

Selection honors the usable featured tile, then the existing canonical image order. Blank/unresolved URLs and duplicate image identities are skipped. Only recognized signing fields are removed when identifying signed storage URLs; proxy image IDs and image transforms remain distinct. The existing native React Native Image cache is reused. The displayed URL is retained across signing refreshes, with a fresh URL used if the retained one fails. Android requests sized image decoding; no full-resolution duplicate blur image is rendered.

The inspected image model contains no dimensions or focal metadata. Unknown images therefore begin with contain. Native image-load dimensions fit the inner paper print to the source aspect without stretching; the outer card canvas remains fixed. Measured aspects have a bounded 128-entry cache. No automatic face detection or invented focal coordinates are claimed. Subject-oriented portrait, object, landscape, square, and extreme-aspect behavior is covered by geometry tests. Individual print bounds can settle after their dimensions load; card dimensions do not change during decoding.

Entrance uses a restrained Reanimated spring reveal, 65ms layer stagger, a 200ms stage fade, and gentle press scale. Existing reduced-motion preferences remove spatial entrance and press scaling. Entrance animations belong to mounting layers and do not replay on ordinary prop changes. The native Vision route dissolves on push/pop with a 520ms iOS duration and a shorter reduced-motion fade. Android owns its native transition duration. This is coordinated native fade plus preview scale feedback, not a geometric shared-element expansion.

Notes integration is read-only: useVisionEditorialNotes accepts the existing VisionNote model and calls the public VisionNoteRenderer with the selected style and actual content. The preview itself accepts optional renderer slots, up to one on Home and two on Details. Unsupported/blank notes are skipped; size-aware, Unicode-safe excerpts preserve legibility. Note persistence, composer, materials, assets, and gestures remain owned by the Notes implementation.

## Files created

- src/components/v2/vision/VisionEditorialPreview.tsx
- src/components/v2/vision/visionEditorialLayout.ts
- src/components/v2/vision/useVisionEditorialNotes.tsx
- src/navigation/v2/visionPreviewTransition.ts
- src/components/v2/vision/__tests__/VisionEditorialPreview.test.tsx
- src/components/v2/vision/__tests__/visionEditorialLayout.test.ts
- src/components/v2/vision/__tests__/useVisionEditorialNotes.test.tsx
- src/components/v2/home/__tests__/V2HomeVisionSection.test.tsx
- src/adapters/v2/home/__tests__/visionPreviewNotes.test.ts
- src/navigation/v2/__tests__/visionPreviewTransition.test.ts

## Files modified

- src/components/v2/vision/VisionBoardPreview.tsx — compatibility export to shared implementation.
- src/components/v2/vision/__tests__/VisionBoardPreview.test.tsx — collage and unavailable-image navigation expectations.
- src/components/v2/home/V2HomeVisionSection.tsx — new preview, featured image, optional Notes.
- src/adapters/v2/home/visionAdapter.ts — pass through real Notes, support note-only Vision.
- src/screens/v2/anchors/V2AnchorDetailsScreen.tsx — isolated preview wiring and duplicate-copy suppression.
- src/screens/v2/anchors/__tests__/V2AnchorDetailsScreen.test.tsx — navigation and copy regression coverage.
- src/navigation/v2/AnchorV2Navigator.tsx — Vision-only transition options.
- src/screens/v2/system/VisionVisualQADevHost.tsx — development-only one/two/three/five-image fixture surfaces.

## Verification and review

- Full TypeScript: npx tsc --noEmit --pretty false, exit 0.
- Combined relevant Jest run: 12 suites, 177 tests passed. Includes new preview/layout/Notes/transition tests, existing Home, Vision return, Details, Home adapter, and canonical ordering regressions. See tests.log.
- Scoped tracked diff whitespace check: passed; Git reports standard CRLF normalization advisories.
- Three Lena delegates investigated in parallel, then implemented separate file groups. Initial 8–8.5/10 results were returned for corrections: unsafe query deduplication, primary-photo overlap, artificial torn-edge strokes, missing scale feedback, and note excerpt legibility.
- Independent final review: correctness 9/10, architecture 9.3/10, performance 9/10, Home visual direction 9/10, Details visual direction 9/10. Independent subset: 4 suites, 27 tests passed.
- Android QA emulator rendered the actual shared production components with explicitly labeled local fixtures. Captured Home one/two/three-image states and Details five-image state. Repeated Home/Details fixture entry was exercised; final capture retained. These fixture actions do not prove authenticated route transitions.

## Evidence and remaining acceptance

Valid final captures: home-android.png, home-one-android.png, home-two-android.png, details-android.png, repeated-entry-android.png. tests.log and typescript.log record final verification. Earlier runtime-start/runtime-retry/home-first/details-first captures are diagnostic attempts, not final visual evidence.

Authenticated Home/Details navigation with the user's actual portrait and Rolls-Royce photos, Android physical-device frame pacing, and iOS rendering remain unverified. The provided reference is a composite mockup, not the original source photographs. Recommended final polish is an authenticated mixed-aspect content review on both platforms, including large text/reduced motion and repeated push/pop; adjust only preview geometry if that review shows a need. No deployment or OTA was performed.
