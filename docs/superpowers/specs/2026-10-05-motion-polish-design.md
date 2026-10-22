# Anchor 2.0 motion polish — design

Date: 2026-10-05. Tree: `E:\Projects\Anchor\anchor\mobile` (branch `feat/creation-flow-polish`, dirty).

## Goal

Make Anchor feel premium and consistent end to end, using the recently built Vision
motion as the quality bar. Scope for this round (agreed): **foundation, then screens**,
V2 only. Legacy navigator stacks (Practice/Chart/Profile/Root) are out of scope.

Success looks like:

- A touch on any V2 control answers the finger the way a Vision control does.
- Screens that currently appear fully formed arrive in reading order.
- One shared motion layer, one set of timings. Vision, Create and the new work stop
  carrying private copies of the same helpers.
- Reduce Motion (OS flag or the in-app override via `useV2ReduceMotion`) still means: no
  travel, a short fade only.
- Nothing replays on refocus, refetch or filter change unless that change is the point.

Non-goals: new durations or curves (Vision's feel is the benchmark and is not retuned),
new haptics, new dependencies, restyling, Home / Anchor Details / creation / Visualize
choreography (they own hero-flight and arrival systems), legacy navigators.

## Audit findings that drive the design

- `AnchorMotion` (`theme/v2/motion.ts`) holds durations, easings and springs. The sheet
  (`V2SheetModal`) and navigator (`navigation/v2/transitions.ts`) already use it well.
- Vision defines `Reveal`, `useVisionEntrance`, `usePressScale`, `useAttention`,
  `AttentionWash`, `VisionStageTransition` locally in
  `components/v2/vision/VisionMotion.tsx`; only four Vision files use `usePressScale`.
  `screens/create/flow/components/Reveal.tsx` is a second, differently-timed `Reveal`.
  `chartMotion.ts` and `creationMotion.ts` carry their own easing sets (intentional,
  ceremonial; left alone).
- Primitives are static: `V2Button` flips opacity to 0.82 on press; `V2IconButton` and
  `V2ListRow` flip a background / opacity; `V2SegmentedControl` snaps its selected
  background; `V2Skeleton` is a flat box; `V2EmptyState`, `V2InlineError`,
  `V2ActivityIndicator` appear with no motion.
- 63 V2 files use `Pressable` with no scale or spring response.
- Screens without entrance choreography: Library, Progress, Weekly Insight, Paywall,
  Practice hub/Prepare/Session, Chart Journey/Adjust (and most of Home below the hero,
  which is left alone).
- ~67 hard-coded durations in V2 beside ~78 `AnchorMotion` uses.

## Design

### 1. Shared motion layer — `components/v2/motion/`

New module (`index.ts` barrel) containing, moved or generalised from `VisionMotion.tsx`
with identical timings:

| Export | Behaviour |
|---|---|
| `useEntrance(delay, duration?, easing?)` | 0→1 once after `delay`; reduced motion = short fade |
| `Reveal({order, base, rise})` | opacity + translateY rise; `order` staggers siblings |
| `STAGGER_MS = 60`, `STAGGER_CAP = 6` | order is clamped so long lists never wait |
| `usePressScale(scaleTo)` / `PressableScale` | 120ms in, snap-spring out, exposes `pressed`; reduced motion dims instead |
| `useAttention` / `AttentionWash` | unchanged |
| `ContentSwap` | cross-fade for in-place content changes (out 120ms, in 280ms after a beat) |
| `Shimmer` | slow opacity pulse for skeletons (gentle easing, `AnchorMotion.duration.ambient`) |

Rules:

- Every hook reads `useV2ReduceMotion()`; none uses Reanimated's implicit OS check
  (matches chart/creation's explicit opt-out for Android animator-scale-0 safety).
- Only `AnchorMotion` tokens. `STAGGER_MS`, `RISE_PX`, `STAGGER_CAP` are added to the
  tokens file, not buried in components.
- `VisionMotion.tsx` re-exports the shared symbols (`Reveal`, `usePressScale`,
  `useAttention`, `AttentionWash`, `AnimatedPressable`, `useVisionEntrance`,
  `VISION_STAGGER_MS`) so no Vision call site changes and Vision behaviour is
  byte-identical. Vision-specific constants (`VISION_PHOTO_ARRIVE`,
  `VisionStageTransition`, etc.) stay in Vision.
- `screens/create/flow/Reveal.tsx` is **not** touched (different feature, separate
  timings, in the dirty tree).
- Unit tests for token values, stagger clamping and reduced-motion branches.

### 2. Primitive upgrades (every screen inherits)

- `V2Button`: scale press via `usePressScale` replacing the 0.82 opacity flip; loading
  cross-fades label → spinner instead of swapping. Disabled/loading stay non-pressable.
- `V2IconButton`: scale press; keep the grouped-background tint as a fade, not a flip.
- `V2ListRow`: pressed background fades in; trailing chevron leans a few px using the
  exposed `pressed` value; rows without `onPress` stay inert.
- `V2SegmentedControl`: a measured pill that slides between options on the `snap`
  spring; the label colour cross-fades. First render places the pill without animating.
- `V2Skeleton`: wrap in `Shimmer`.
- `V2EmptyState`, `V2InlineError`, `V2ActivityIndicator`: enter with fade + small rise;
  not replayed while mounted.
- Public props and testIDs are unchanged. Existing tests keep passing; new tests cover
  reduced-motion fallbacks and the disabled/loading paths.

### 3. Screen choreography

One rule everywhere: top bar first, then content sections in reading order, `Reveal`
with `order`, **once on first mount only**. A refocus, refetch, pull-to-refresh or
filter change never replays the entrance. Filter/tab changes use `ContentSwap`.

Targets, in priority order: Anchor Library (grid items stagger up to the cap; filter
change cross-fades), Progress, Weekly Insight, Paywall, Practice hub and Prepare,
Chart Journey and Adjust. Each screen is read in the plan phase to place `Reveal`
wrappers at section level (no per-row animation inside long lists).

Guards:

- Screens reached through the shared anchor transition (`route.params.anchorTransition`)
  skip entrance motion so they do not fight the hero flight.
- Home, Anchor Details, creation, Visualize, Release and Focus keep their own systems.
- No `entering` props on FlatList/virtualised rows.

### 4. Verification and risk

- `npx tsc --noEmit` and `npx jest` on the touched V2 suites plus the full V2 run at the
  end; compare against the existing-failure log (`creation-polish-existing-failures.log`)
  so pre-existing failures are not attributed to this work.
- Risks and mitigations:
  - A V2 file relies on the old opacity `pressed` style → grep each `Pressable`
    consumer of the touched primitives before changing; keep the prop surface identical.
  - Entrance replay on refocus → entrances run in mount-only effects; no keys derived
    from data.
  - Extra UI-thread work on long lists → stagger cap of 6; no per-row `entering`.
  - Dirty tree → touch only files this work needs; never reformat or revert others'
    changes; CRLF line endings preserved.
- I cannot judge feel on a device. The hand-off includes a short checklist for the S24
  (press scale on buttons, segmented pill slide, Library entrance, Paywall entrance,
  reduce-motion on/off).

## Open assumptions

- The in-app reduce-motion override is the single source for "reduced".
- Settings has no V2-specific screen of its own yet, so it is not a target.
- `V2Skeleton` is only used by `V2Feedback` and the system gallery today, so the shimmer
  is low-traffic; it is included because it is cheap and shared.
