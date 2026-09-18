# Anchor Home production review packet

This packet accompanies the Handmade Home implementation in `anchor/mobile`.

## Reference inputs

- Product request: `C:\Users\dwill\.codex\attachments\91fec2e6-4e9f-45ee-81e3-74f0c856f43b\pasted-text.txt`
- Approved Handmade reference: `E:\Projects\Anchor\artifacts\website-reference\Anchor 2.0 Screens\01 Home.html`
- Alternate standalone export: `E:\Projects\Anchor\artifacts\unified-creation-source\Anchor 2.0 Export\Anchor Home (Daily Vision + Chart) - Refined - Standalone.html`
- Existing native captures, when available: `E:\Projects\Anchor\edge_final_hero.png`, `E:\Projects\Anchor\edge_final_scrolled.png`, `E:\Projects\Anchor\edge_final_health.png`

## Production data-source map

| Home concern | Source | Adapter/view model | Render rule |
| --- | --- | --- | --- |
| Signed-in account | Firebase auth store | `useV2HomeModel` account gate | No signed-in account yields no account-owned Anchors or Course data |
| Anchor collection | `anchorStore` hydrated from the Anchor API | `useV2SelectedAnchor` | Only active/released Anchors owned by the signed-in user; zero is a real empty state |
| Selected Anchor | persisted selected Anchor id plus owned active list | `useV2SelectedAnchor` / `useV2HomeModel` | Selection is cleared when it is not owned or no longer active |
| Greeting/profile mark | signed-in user display name | `V2HomeHeader` props | Initial is omitted when there is no real display name |
| Hero artwork/category/color | selected Anchor fields and `artworkSvg` | `V2SelectedAnchorHero`, `CircularAnchorRenderer` | Real artwork/category only; unavailable artwork is labeled, never replaced with sample art |
| Thread Strength | selected Anchor `strength`, `strengthCategory`, `strengthDelta` | `toV2ThreadPresentation` | Missing strength is “Not yet measured”; no fabricated zero, delta, or track |
| Today | `fetchV2RecommendationContext(anchorId)` | `useV2HomeToday` / `V2HomePracticeEntry` | None/loading/error/ready remain distinct; ready uses server action/reason and user-selected duration |
| Vision | `useV2Vision(anchorId)` from the V2 Vision API | `toV2HomeVisionState` / `V2HomeVisionSection` | Module is omitted when no actual Vision exists; loading/error are explicit |
| Chart/Course | account-bound hydrated Course store | `toHomeChartState` / `V2HomeChartSection` | Only active Course data associated with the selected Anchor; waypoint count/order/current id are actual |
| Anchor collection switcher | same owned Anchor collection | `V2AnchorQuickSwitch` | Hidden for zero Anchors; one or more real Anchors can be switched |

Practice entry navigates to the real V2 practice session route, which records the
completed duration against the signed-in account and selected Anchor. Visualize
is unavailable until the selected Anchor has a real Vision.

## State and isolation rules

- Home composes modules from the current selected Anchor rather than injecting a fixed page fixture.
- Vision, Today, and Chart queries refresh on navigation focus and app resume; anchor changes abort/reset the Today request and recompute all derived modules.
- Course association uses explicit Anchor links when present. An unlinked legacy Course is accepted only when there is exactly one active Anchor; it is hidden with multiple active Anchors to avoid cross-Anchor leakage.
- A Course with an authoritative `currentWaypointId` never guesses a different current waypoint. Routes render the actual waypoint list for 2, 3, 5, or more waypoints.
- Detail and practice routes re-check account ownership from the signed-in auth state before resolving an Anchor, so persisted or deep-linked ids cannot surface another account's record through the client read model.
- When the server-owned V2 Thread Strength exists, Recommendation Context supplies that value to Home; the V2 practice session waits for the canonical completion write before returning so the next Home read can observe the updated strength.
- The existing `EXPO_PUBLIC_ANCHOR_V2_ENABLED` development rollout gate is preserved; this review covers the V2 Home data/render implementation and does not authorize changing the app-wide release navigation cutover.

## Verification commands

```text
npx tsc --noEmit
npx jest src/adapters/v2/home/__tests__ src/screens/v2/home/__tests__/V2HomeScreen.test.tsx src/screens/v2/practice/__tests__/V2PracticeScreen.test.tsx --runInBand --silent
npm test -- --runInBand --silent
git diff --check
```

Native iOS/Android capture is environment-dependent. The Windows workspace has no available `adb` executable or iOS runtime, so native visual verification must be completed on a configured simulator/device; the Handmade HTML reference remains the visual source of truth.
