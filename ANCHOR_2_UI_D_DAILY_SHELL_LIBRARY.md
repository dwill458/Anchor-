# Anchor 2.0 — UI-D: Daily Shell & Anchor Library

UI-D owns **Home**, **Your Anchors**, and **Anchor Details** in the V2 namespace.
It builds only on the post-UI-B baseline (UI-A primitives + UI-B first run) and
touches no shared choke points. It is opt-in in development only
(`EXPO_PUBLIC_ANCHOR_V2_ENABLED=true` + `__DEV__`); production still renders
`RootNavigator` unchanged.

## HTML / spec references audited

Authoritative set: `anchor (10).zip` → `Anchor 2.0 Screens/`, rendered and read
in a browser (the files are JS-packed and need a runtime).

| Surface | Reference | What was taken |
| --- | --- | --- |
| Home | `01 Home.html` | Greeting + utilities (Chart, Create, Profile); selected Anchor as display line + category cue + circular hero; Thread Strength tappable → Progress; TODAY status; practice entry; Vision section; "Next on your Chart" (destination + next move + `n of m waypoints`); "Your Anchors / See all" + circular quick-switch rail with subordinate inactive items. |
| Your Anchors | `03 All Anchors.html` | Back · title · search · create top bar; `All / Active / Released` segmented filter; 3-column circular gallery; each cell = artwork + intention + `Category · Current/Released`; tap → Anchor Details. |
| Anchor Details | `04 Anchor Details.html` | Back top bar; circular hero; intention; small-caps category; `Created <date>`; Thread Strength block with qualitative label + `n sessions have strengthened this Anchor` + View progress; **Practice this Anchor** primary CTA; "How this Anchor was formed" accordion (Original intention / Distilled form / Letter reduction / Construction system / Why this system / Category); Recent practice list + See all sessions; contextual Vision + Chart; Release entry. |
| Living spec | `Anchor_Design_System_Living_Spec_v0_4_THREAD_EVENTS_LIVING_COLOR_LOCKED.docx` | Light editorial shell, `#F4F1E9` canvas, Bricolage/Figtree, restrained category color, contextual navigation, no permanent bottom tab bar, grounded language, server-authoritative Thread, honest empty states. |
| `ANCHOR_2_UI_A_SYSTEM_FOUNDATION.md` / `ANCHOR_2_UI_B_IDENTITY_FIRST_RUN.md` | Consumed UI-A tokens/primitives/renderer/Thread component and UI-B `firstRunStore` conventions verbatim; created no parallel tokens or primitives. |

Written contracts take precedence over older HTML where they conflict (e.g.
Recommended Today logic is deliberately **not** implemented on Home).

## Home

### Hierarchy (as built)

```
Greeting + utilities (Chart · Create Anchor · Profile)
Selected Anchor hero        → tap → Anchor Details
Thread Strength (V2ThreadStrength)   → tap → Progress intent
Practice entry (shell + intent)
Vision section (ready / none)
Chart section (ready / none)
Your Anchors  → "See all" → Your Anchors ; circular quick-switch rail
```

### Selected Anchor model

Single selection authority: the existing `anchorStore.currentAnchorId`.
`useV2SelectedAnchor` adapts it and falls back to the most-recently-updated
active Anchor when the stored id is missing or points at a released/removed
Anchor. Selecting writes straight back with `anchorStore.setCurrentAnchor` — no
parallel V2 selection state.

### Quick switch

`V2AnchorQuickSwitch` — an open-canvas horizontal circular rail. Inactive
Anchors render at `state="inactive"` (the renderer's 0.48 opacity treatment)
with a low-emphasis label. Tap updates the selected Anchor in place (no modal);
the hero cross-fades on selection change (`motion.standard`) unless Reduce
Motion is on. Hidden when fewer than two Anchors exist.

### Thread presentation

`V2ThreadStrength` is rendered with `value` only. `adapters/v2/home/threadAdapter.ts`
surfaces `anchor.threadStrength` clamped to 0–100 and performs **no**
progression, gain, decay, or delta math. When no strength is stored the adapter
returns `unmeasured: true` and the component shows the value without inventing
movement. `delta` / `trend` / `previousValue` stay undefined until a
server-authoritative Thread movement contract exists (see backend dependencies).

### Vision adapter

```ts
type HomeVisionState =
  | { state: 'none' }
  | { state: 'ready'; visionId: string; previewText: string; previewUri?: string };
```

Derived from `visualizationSceneStore` (existence + text only). The current
Vision domain persists no images, so `ready` carries `previewText`; `previewUri`
is declared for a future Vision-asset contract but never fabricated. Missing →
"Add a Vision" entry.

### Chart adapter

```ts
type HomeChartState =
  | { state: 'none' }
  | { state: 'ready'; courseId; destinationText; nextMove; reachedCount; waypointCount };
```

Derived read-only from `courseStore.activeCourse` (a real `CourseDetail`). It
never advances waypoints, completes destinations, or calls `CourseService`.
Missing / non-ACTIVE → "Start a Chart" entry.

### Progress placeholder

Progress is not implemented in this branch. Home exposes it only as the
Thread Strength tap target (`onOpenProgress` intent). No Weave, no fabricated
movement metrics.

### Home data adapter

`adapters/v2/home/useV2HomeModel()` returns
`{ greeting, hasAnchors, selectedAnchor, thread, anchorList, vision, chart }`.
It is presentation aggregation only — it composes existing stores and is not a
second domain authority.

## Your Anchors

`V2AnchorLibraryScreen` — standalone screen (promoted from the legacy
`VaultGridModal`). `V2TopBar` back + title; `All / Active / Released` segmented
control (the Released option only appears when real released Anchors exist);
`V2AnchorGalleryGrid` 3-column circular gallery on warm canvas. Real
`anchorStore` records only. `useV2AnchorLibrary` derives active/released from the
existing local `isReleased` flag and never fabricates release history.

## Anchor Details

`V2AnchorDetailsScreen` — permanent, clean profile. Sections: circular hero,
intention, small-caps category, created date, Thread Strength block (value +
qualitative label + `n sessions have strengthened this Anchor`), **Practice this
Anchor** primary CTA, `V2FormationProvenance` accordion, `V2AnchorRecentPractice`
(last 3 from `sessionStore.practiceHistory`, See all sessions → Progress),
contextual Vision + Chart rows, and a Release entry.

Formation provenance uses `anchor.distilledLetters`, a grounded letter-reduction
explainer, and an editorial name for `structureVariant`
(`balanced→Focused`, `dense→Contained`, `minimal→Raw` — `constants/v2/home.ts`).
No occult terminology, no merch/talisman, no analytics dump, no atmospheric
decoration.

Actions are **navigation/action intents only**. Release calls
`intents.onReleaseAnchor(anchorId)` and never invokes `anchorStore.releaseAnchor`
/ `removeAnchor` or the legacy destructive burn endpoint.

## Navigation

UI-D does not modify `navigation/v2/{AnchorV2Navigator,routes,types}`. It ships a
self-contained, owned `V2DailyShellNavigator` (`screens/v2/home/dailyShell.tsx`)
wiring `V2Home ↔ V2AnchorLibrary ↔ V2AnchorDetails`. `V2DevelopmentHome` now
renders that shell, so the flow is reachable today via the dev flag → first run →
daily shell. Production integration should flatten the three screens into the
central navigator — see `REQUIRED_INTEGRATION_CHANGES.md`.

External intents (`onOpenPractice`, `onOpenVision`, `onCreateVision`,
`onOpenChart`, `onCreateChart`, `onOpenProgress`, `onCreateAnchor`,
`onOpenProfile`, `onReleaseAnchor`) are provided through
`V2DailyShellIntents` / `V2DailyShellIntentsProvider`. Unwired intents dev-warn.

## Empty states

`no selected Anchor` (Home empty state → Create), `no Vision`, `no Chart`,
`no Progress events`, `only one Anchor` (quick switch hidden), `many Anchors`
(gallery wraps), `Anchor not found` (Details), `nothing released` (filter hidden).
All use UI-A feedback primitives; no missing domain is filled with fake data.

## Accessibility

44×44 utility targets (`V2IconButton`); Anchor hero, quick-switch items, and
gallery cells are accessible buttons with state; selected Anchor announced via
`accessibilityState={{selected}}`; Thread Strength keeps its numeric label from
UI-A; Vision preview has a meaningful text label; Chart next move is text, not
color-only; gallery reading order is logical; the 3-column grid uses relative
widths so Dynamic Type wraps rather than clipping; motion reads
`useV2ReduceMotion` (hero cross-fade and Thread count-up fall back to direct
values).

## Analytics

State-only events via the existing provider (wrapped so analytics can never
break a screen): `v2_home_viewed`, `v2_home_anchor_switched`,
`v2_home_practice_tapped`, `v2_home_vision_tapped`, `v2_home_progress_tapped`,
`v2_home_chart_tapped`, `v2_home_create_anchor_tapped`,
`v2_anchor_library_viewed`, `v2_anchor_details_viewed`,
`v2_anchor_details_practice_tapped` (+ `…_vision_tapped`, `…_chart_tapped`,
`…_progress_tapped`, `…_release_tapped`). Raw intention text is never logged.

## Tests

`src/adapters/v2/home/__tests__/adapters.test.ts` — thread/vision/chart pure
adapters, explicit "no progression math" / "no fabricated image" / "never
advances Chart" assertions.
`src/adapters/v2/home/__tests__/isolation.test.ts` — no imports of other V2
workstream screen namespaces, central V2 navigation, backend, or legacy theme;
not imported by production navigation/screens.
`src/hooks/v2/anchors/__tests__/useV2AnchorLibrary.test.ts` — filters, released
section only with real data.
`src/screens/v2/home/__tests__/V2HomeScreen.test.tsx` — selected Anchor renders,
switch updates selection, Vision none/ready, Chart none/ready, no fake Thread
movement, empty state, Practice/Progress/details intents.
`src/screens/v2/anchors/__tests__/V2AnchorLibraryScreen.test.tsx` — active
render, many Anchors, gallery selection, Released filter only with real data.
`src/screens/v2/anchors/__tests__/V2AnchorDetailsScreen.test.tsx` — correct
Anchor, provenance, Practice/Vision/Chart callbacks, Release is intent-only and
never calls the destructive store actions, not-found state.

## Backend dependencies

- **Server Thread movement** — `delta` / `trend` / weekly movement stay
  undefined on Home and Details until `THREAD_V2_AUTHORITY` exposes
  server-computed movement from `POST /api/practice/sessions` /
  `GET /api/v2/thread/completions/:sessionId`.
- **Vision domain** — no image assets; `HomeVisionState.previewUri` is reserved
  for a future Vision-asset contract (backend Workstream H).
- **Non-destructive Release** — Details exposes a Release intent only; the
  lifecycle screen and the idempotent non-destructive endpoint (Workstream J)
  are out of scope here.
- **Released history** — surfaced only from the local `isReleased` flag; a true
  server release-history query would replace `useV2AnchorLibrary`'s derivation.
- **Recommended Today** — deliberately not on Home; needs consumable
  waypoint/destination signals + intention-complete flag (CCR-1/CCR-2).
