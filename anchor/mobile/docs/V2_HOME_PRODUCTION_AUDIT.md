# Anchor 2.0 Home production audit — 2026-09-17

## Active implementation

`src/screens/v2/home/V2HomeScreen.tsx` is the Home route reached through `V2DevelopmentHome` and `AnchorV2Navigator`. The shared selection authority is `anchorStore.currentAnchorId`, adapted by `useV2SelectedAnchor`; it filters out Anchors outside the signed-in account and released or archived Anchors. Home does not maintain another selected ID.

| Home fact | Production source | Current presentation |
| --- | --- | --- |
| Anchor list, selection, intention, category, artwork | Account-filtered `anchorStore` through `useV2SelectedAnchor` | Center hero with previous and next peek; enhanced image when present, stored SVG fallback |
| Thread Strength and seven-day movement | `GET /api/v2/anchors/:id/recommendation-context`, with stored Anchor strength as a fallback while the request resolves | Compact cream hero row; null remains unmeasured; movement displayed only when server status is `AVAILABLE` |
| Today recommendation | Same non-consuming recommendation-context GET | Server action maps to a Practice mode; internal snake_case reason codes are not displayed |
| Vision relationship and asset | `useV2Vision` and the V2 Anchor Vision endpoint | Omitted when absent; real image/copy shown when ready |
| Chart/Course and Waypoint | Account-bound `courseStore` and explicit Course–Anchor link | Omitted without a proven link; known linked Course errors expose retry |
| Progress preview | `useV2Progress`, selected by Anchor ID | Displays only Anchor lifecycle or Anchor-filtered Practice evidence; event date uses the device locale |
| Practice entitlement | Existing `V2Practice` route, premium capability callback, and `V2Paywall` | Today and All Practices use the existing Practice route; entitlement resume preserves Focus, Deep Prime, or Visualize intent |

## Legacy and placeholder behavior removed from Home

- The standalone dark Thread Strength hero and giant unmeasured typography are gone.
- The old `Your Anchors` horizontal row is gone. The hero carousel owns selection.
- Account-level or unlinked Courses do not appear as a Chart for the selected Anchor.
- Chart store hydration without a known link does not render a loading pill.
- Initially resolving Vision does not flash a Vision card.
- Backend reason identifiers such as `daily_focus` are not shown as product copy.
- Today uses the real active intention as supporting copy when the backend reason is an internal identifier.
- With multiple Anchors, first and last positions wrap so both neighboring peeks remain visible.
- A Practice milestone without a persisted completion timestamp is omitted from the evidence timeline instead of receiving the current date.
- The HTML reference is used for geometry and hierarchy only. Its sample Vision, Chart, and Progress content is not used in production.

## Verification and remaining gates

The user narrowed this session to the real no Vision/no Chart Home state on the connected phone. Live Chart and Vision state coverage is deferred to another session.

- Focused mobile Home and adapter tests: 4 suites, 46 tests passed (17 Home screen tests in the latest run).
- Progress adapter and Home screen after the evidence timestamp fix: 2 suites, 24 tests passed.
- V2 navigator tests: 2 suites, 10 tests passed.
- Backend recommendation tests: 1 suite, 28 tests passed.
- `npm run test:v2-boundary`: passed.
- `git diff --check`: passed.
- Full mobile TypeScript check remains red because of pre-existing `V2VisionCreationFlow.test.tsx` type errors outside Home. The latest check reported no errors in Home files.
- Connected-phone captures in `artifacts/home-phone-current.png`, `artifacts/home-phone-neighbor.png`, `artifacts/home-phone-context.png`, and `artifacts/home-phone-verified.png` show real account data, safe-area placement, neighbor selection, conditional omission, and the centered splice. They confirm category formatting and Today reason filtering. The wraparound peeks and intention-based Today subcopy landed after the last clean app capture and are covered by tests; their final phone appearance remains unverified.
- Real account coverage is currently no Vision/no Chart and multiple Anchors. Negative delta, completion priority, no-network, and purchase continuation still need device verification. Do not call the full acceptance matrix passed.
- The independent reviewer scored the latest clean phone capture 8.5/10 visual. The final wraparound peeks and Today support copy landed after that capture, so the requested 9/10 visual gate is not yet substantiated.
- `progressAdapter.ts` still derives its full Progress screen's highest evolution stage from current strength. Home omits that derived stage from its preview, but the shared adapter needs a persisted-stage authority before that wider claim can be trusted.
