# Home and Anchor Details previews — 2026-09-29

## Implementation

Home keeps its greeting, profile/add actions, category atmosphere, hero artwork, horizontal Anchor carousel, intention, Thread Strength, cream-to-ink seam and server-authoritative Today. The lower sequence remains Today → Vision → Chart → Recent Practice. Existing Progress fallback and weekly review are preserved. Recent Practice now exposes the existing Progress destination via View all.

Details remains cream and follows identity → Thread Strength → Vision → Recommended Practice → Chart → Recent Practice → Release. Release remains an unfilled lifecycle row, separated by a hairline; the existing Release route and confirmation flow are retained. Null Thread Strength displays a dash, while its status remains Not established.

`VisionBoardPreview` uses the existing physical board, torn photo frames, measured apertures, map/leaf details and fastener assets. It displays real persisted images, with three photographs per swipeable page and actual page controls. A single photo gets a centered composition. Native statement text sits on the existing intention paper, capped at three lines. Home and Details share this rendering and their existing per-Anchor Vision read model. Details Edit opens the existing description editor directly. Loading/errors remain distinct from confirmed absence; failed Vision reads expose Retry.

`ChartWorldPreview` reuses `ChartPreview`/`ChartLandscape` and the canonical category art, route geometry, completed/current/upcoming nodes and bounded route reveal. The crop centers the real current node using that category's asset dimensions and registered route. Title, destination and current Move flow beneath the artwork and can grow with long copy. Home omits confirmed absence and unresolved relationships; Details retains its real Create Chart action. Loading and errors never invent nodes or progression.

No new bitmap assets, data fetchers, continuous animation loops, backend writes, recommendation rules, analytics rules or category colors were introduced.

## Verification

- Targeted final run: **30 suites / 314 tests passed**. Includes Home, Details, Home adapters, carousel/hero navigation, shared board preview, existing Vision board tests, Vision screens/edit flow, Chart components/hooks/geometry, and recommendation cache.
- Extended Vision run: 19 suites / 125 tests passed; one unrelated scene-generation test failed. The pre-existing uncommitted `useV2VisionSceneGeneration` change sends `appearanceReferenceId: null`; its test expects that field to be absent. Neither that hook nor its test was changed for this work.
- TypeScript: 14 distinct baseline diagnostics remained, with no added diagnostics after normalizing source line numbers. Baseline errors are in Vision generation work, legacy nullable-strength consumers and a Progress test. See before/after logs.
- Android and iOS Expo exports succeeded (5,575 Android modules; 5,567 iOS modules). Bundling does not establish iOS visual acceptance.
- `git diff --check` passed.

## Native visual evidence and limits

The screenshots are an **isolated Android preview fixture**, rendering the actual production preview components with explicit fixture content and bundled Vision entrance photographs. They do not show an authenticated user's board. The fixture uses long waypoint/Move text, one/three/six images, cream/ink surfaces, Desire/Health environments and 411-/384-point widths. The current node, paper text and controls remained clear of each other; long Vision text truncates and Chart copy grows in normal flow. The temporary entrypoint was restored byte-for-byte and emulator density restored to 420.

- [Dark, 411 pt](android-dark-411.png)
- [Cream, single photo, 411 pt](android-light-single-411.png)
- [Cream, six images in two pages, 411 pt](android-light-six-images-411.png)
- [Cream, Health Chart, 384 pt](android-light-health-384.png)

The emulator was signed out at onboarding. Full authenticated Home/Details flows, actual account data, physical Galaxy S24 and iPhone 14 Pro layouts, iOS runtime, slow-image/loading arrival behavior and end-to-end carousel switching require further device QA. Screen/adapter tests cover all Vision/Chart presence combinations and Anchor isolation, but do not establish visual acceptance for those full live screens.
