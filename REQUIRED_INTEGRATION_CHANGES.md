# REQUIRED_INTEGRATION_CHANGES

Changes UI-D needs from shared/central code it does not own. Nothing below was
applied on this branch.

## Central V2 navigation (`anchor/mobile/src/navigation/v2/`)

UI-D ships a self-contained `V2DailyShellNavigator`
(`screens/v2/home/dailyShell.tsx`) and mounts it inside `V2DevelopmentHome` so
the flow runs today. For production, flatten it into the central stack:

- `navigation/v2/types.ts` — add to `AnchorV2StackParamList`:
  ```ts
  V2Home: undefined;
  V2AnchorLibrary: undefined;
  V2AnchorDetails: { anchorId: string };
  ```
- `navigation/v2/routes.ts` — add `home: 'V2Home'`, `anchorLibrary: 'V2AnchorLibrary'`,
  `anchorDetails: 'V2AnchorDetails'`.
- `navigation/v2/AnchorV2Navigator.tsx` — register the three screens
  (`V2HomeScreen`, `V2AnchorLibraryScreen`, `V2AnchorDetailsScreen` from
  `@/screens/v2/home` and `@/screens/v2/anchors`), and make `V2Home` the
  post-first-run landing instead of `V2DevelopmentHome`.
- Once flattened, `V2DailyShellNavigator` / `V2DevelopmentHome` can be retired.

## External navigation intents

Home and Anchor Details expose these via `V2DailyShellIntents` /
`V2DailyShellIntentsProvider`. Wire them to the real routes owned by other
workstreams:

| Intent | Target owner | Route |
| --- | --- | --- |
| `onCreateAnchor()` | UI-C (Agent 1) | V2 creation flow entry |
| `onOpenPractice(anchorId)` | UI-F | V2 Practice (mode select) for the Anchor |
| `onOpenVision(anchorId)` / `onCreateVision(anchorId)` | UI-G / Agent 3 | V2 Vision |
| `onOpenChart(anchorId?)` / `onCreateChart(anchorId)` | UI-G | V2 Chart |
| `onOpenProgress(anchorId?)` | UI-G | V2 Progress |
| `onOpenProfile()` | UI-D-adjacent / settings | V2 Profile & Settings |
| `onReleaseAnchor(anchorId)` | UI-H | V2 non-destructive Release lifecycle (never the legacy `POST /api/anchors/:id/burn`) |

## Backend

- **Thread movement** — expose server-computed `delta` / `trend` / 7-day
  movement per Anchor (Thread V2 authority). `threadAdapter.ts` will map it into
  `V2ThreadPresentation`; today those fields stay undefined.
- **Vision assets** — a real image/preview per Vision so `HomeVisionState`
  can populate `previewUri` (Workstream H).
- **Release history** — a server query for released Anchors + lineage so
  `useV2AnchorLibrary` can stop deriving "released" purely from the local
  `isReleased` flag (Workstream J).

## Shared UI-A primitives

None required. UI-D composed everything from existing UI-A exports
(`CircularAnchorRenderer`, `V2ThreadStrength`, `V2Screen`, `V2Surface`,
`V2Button`, `V2IconButton`, `V2Badge`, `V2SegmentedControl`, `V2ListRow`,
`V2SectionHeader`, `V2Divider`, `V2TopBar`, `V2EmptyState`, theme tokens,
`useV2ReduceMotion`, `v2Haptics`) without modifying any of them.

## UI-F — Practice + Recommended Today

UI-F exports `V2PracticeScreen`, Prepare-screen entry points, and
`V2_PRACTICE_ROUTE_MANIFEST` from `screens/v2/practice`. Central navigation
must register the manifest's Practice and Prepare routes, pass the fixed
`anchorId`, and wire these typed intents:

| UI-F intent | Integration target | Constraint |
| --- | --- | --- |
| `onBeginPractice(request)` | Existing Focus / Deep Prime / Visualize session entry | Reuse the proven session/audio engines; do not duplicate one in UI-F. |
| `onPremiumCapabilityRequired(request)` | Paywall owner | Pass the backend capability result; UI-F owns no paywall screen. |
| `onCreateVision(anchorId)` / `onOpenVision(anchorId)` | UI-G Vision | The no-Vision Visualize bridge must remain intact. |
| `onReleaseRequested(anchorId, reason?)` | UI-H Release | Use the non-destructive Release lifecycle only; never the legacy burn endpoint. |

The production screen fetches the existing non-consuming backend GET
`/api/v2/anchors/:anchorId/recommendation-context`. Its explicit recommendation
engagement path may POST the existing signal ACK endpoint; never ACK on mount,
refresh, or background fetch. No central navigation implementation was applied
on this branch.
