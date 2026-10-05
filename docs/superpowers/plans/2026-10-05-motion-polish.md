# Anchor 2.0 Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared V2 motion layer, upgraded primitives that inherit it, and entrance choreography on the V2 screens that currently appear fully formed.

**Architecture:** Promote Vision's local helpers into `components/v2/motion/` (pure frame functions + thin Reanimated hooks/components), re-export them from `VisionMotion.tsx` so Vision call sites do not change, then adopt them in the V2 primitives and at section level in five screens.

**Tech Stack:** React Native 0.81, Reanimated ~4.1, Jest (jest-expo) + @testing-library/react-native. Root for all paths: `E:\Projects\Anchor\anchor\mobile` (paths below are relative to `src/`).

**Spec:** `docs/superpowers/specs/2026-10-05-motion-polish-design.md` (repo root `E:\Projects\Anchor`). Read it before starting.

## Global Constraints

- Only `AnchorMotion` tokens for timing. Vision's feel is the benchmark: `micro 120`, `quick 180`, `standard 280`, `expressive 420`, `enter` easing, `spring.snap`. No new durations or curves except the three token additions in Task 1.
- Stagger step `60`ms, stagger cap `6`, rise `14`px, press scale `0.98` (all become `AnchorMotion` tokens in Task 1).
- Every hook/component reads `useV2ReduceMotion()` (import from `@/hooks/v2/useV2ReduceMotion`). Reduced = no translate, no scale, short fade (`quick`) or opacity dim only.
- Shared-layer timings pass `reduceMotion: ReduceMotion.Never` (as `chartMotion.ts`/`creationMotion.ts` do) so the in-app override, not Reanimated's implicit OS check, decides.
- Entrances run once on mount and never replay on refocus, refetch, pull-to-refresh or filter change.
- No `entering`/`exiting` props on rows of virtualised lists. No new haptics, no new dependencies.
- Public props and `testID`s of every touched component are unchanged.
- Out of scope: Home, Anchor Details, creation, Visualize, Release, Focus, Practice hub/Prepare (already run inside `PracticeLayer`/`AnchorTransitionScene`), Chart Journey (own `chartMotion`), `screens/create/flow/components/Reveal.tsx`, legacy navigators.
- Preserve CRLF line endings in files that have them; touch no other files.

## Review Focus

1. Reduce Motion on: no translate/scale in any helper or adopted component (Tasks 1, 2, 4, 5).
2. 40+ siblings (Library grid): stagger delay never exceeds `cap * step` (Tasks 1, 7).
3. Disabled / loading `V2Button` and `onPress`-less `V2ListRow` give no press feedback and stay non-pressable (Tasks 4, 5).
4. Re-render / refocus: entrance does not restart (Tasks 1, 7).
5. `V2SegmentedControl` with 1 option, width 0 before first layout, option count changing (Library hides "Released" → 3 vs 2 options), or a `value` matching no option: pill geometry is finite and non-negative (Task 5).

---

### Task 1: Motion tokens and entrance primitives

**Files:**
- Modify: `theme/v2/motion.ts`
- Create: `components/v2/motion/entrance.ts`, `components/v2/motion/Reveal.tsx`, `components/v2/motion/index.ts`
- Test: `components/v2/motion/__tests__/entrance.test.ts`, `components/v2/motion/__tests__/Reveal.test.tsx`

**Interfaces:**
- Produces:
  - `AnchorMotion.stagger = { step: 60, cap: 6 }`, `AnchorMotion.rise = 14`, `AnchorMotion.press = { scale: 0.98 }` (added to the existing `as const` object).
  - `staggerDelay(order: number, base = 0): number` — `base + clamp(order, 0, cap) * step`; non-finite `order` is treated as 0.
  - `revealFrame(progress: number, rise: number, reduceMotion: boolean): { opacity: number; translateY: number }` — marked `'worklet'`; reduced → `translateY: 0`.
  - `useEntrance(delay = 0, duration = AnchorMotion.duration.standard, easing = AnchorMotion.easing.enter): SharedValue<number>` — behaviour copied from `useVisionEntrance` (reduced → `withTiming(1, quick)`), plus `reduceMotion: ReduceMotion.Never`.
  - `Reveal({ order?, base?, rise?, enabled?, style?, children })` — as Vision's `Reveal` but delay is `staggerDelay(order, base)` and `enabled={false}` renders children at progress 1 with no animation (used by Task 7).
  - `index.ts` barrel exporting all of the above.

- [ ] **Step 1: Write failing tests.** `entrance.test.ts`: `staggerDelay(0)===0`, `staggerDelay(3)===180`, `staggerDelay(40)===360`, `staggerDelay(-2)===0`, `staggerDelay(NaN)===0`, `staggerDelay(2, 100)===220`; `revealFrame(0, 14, false)` → `{opacity:0, translateY:14}`; `revealFrame(0.5, 14, false).translateY===7`; `revealFrame(0, 14, true)` → `{opacity:0, translateY:0}`; `revealFrame(1, 14, false)` → `{opacity:1, translateY:0}`. `Reveal.test.tsx` (mock `@/hooks/v2/useV2ReduceMotion`; if Reanimated needs it, `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))`): children render; `enabled={false}` renders children; re-rendering with identical props calls `withDelay` exactly once (spy on the reanimated export).
- [ ] **Step 2: Run** `npx jest src/components/v2/motion` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the token additions (with a one-line comment each) and the three files above. `Reveal`'s `useAnimatedStyle` calls `revealFrame`. `useEntrance` effect deps stay `[delay, duration, easing, progress, reduceMotion]` so identical props never restart it.
- [ ] **Step 4: Run** `npx jest src/components/v2/motion` — Expected: PASS. Then `npx tsc --noEmit -p .` — Expected: no new errors.
- [ ] **Step 5: Commit** `git add src/theme/v2/motion.ts src/components/v2/motion && git commit -m "feat(v2): shared motion tokens, stagger and Reveal"`

### Task 2: Press and attention primitives; Vision re-exports

**Files:**
- Create: `components/v2/motion/press.tsx`
- Modify: `components/v2/motion/index.ts`, `components/v2/vision/VisionMotion.tsx`
- Test: `components/v2/motion/__tests__/press.test.ts`, `components/v2/motion/__tests__/press.render.test.tsx`

**Interfaces:**
- Consumes: Task 1 tokens and `index.ts`.
- Produces:
  - `pressFrame(pressed: number, scaleTo: number, reduceMotion: boolean): { scale: number; opacity: number }` (worklet) — `scale: 1 - pressed*(1-scaleTo)`, `opacity: 1`; reduced → `scale: 1`, `opacity: 1 - pressed*0.15`.
  - `usePressScale(scaleTo = AnchorMotion.press.scale): { pressed: SharedValue<number>; style; onPressIn: () => void; onPressOut: () => void }` — 120ms `micro`/`standard` easing in, `spring.snap` out, same as Vision's. `style` returns `{opacity}` when reduced, `{transform:[{scale}]}` otherwise.
  - `AnimatedPressable = Animated.createAnimatedComponent(Pressable)`.
  - `useAttention(): { level: SharedValue<number>; pulse: () => void }` and `AttentionWash({ level, color, radius? })` — moved unchanged from `VisionMotion.tsx`.

- [ ] **Step 1: Write failing tests.** `press.test.ts`: `pressFrame(0,0.98,false)`→`{scale:1,opacity:1}`; `pressFrame(1,0.98,false).scale===0.98`; `pressFrame(1,0.98,true)`→`{scale:1,opacity:0.85}`. `press.render.test.tsx`: a host using `usePressScale` on an `AnimatedPressable` renders its label and fires `onPress` when pressed.
- [ ] **Step 2: Run** `npx jest src/components/v2/motion` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** `press.tsx` by moving `usePressScale`, `useAttention`, `AttentionWash`, `AnimatedPressable` out of `VisionMotion.tsx` and adding `pressFrame`. In `VisionMotion.tsx` delete the moved bodies and re-export under the same names: `Reveal`, `usePressScale`, `useAttention`, `AttentionWash`, `AnimatedPressable`, `useVisionEntrance` (= `useEntrance`), `VISION_STAGGER_MS` (= `AnchorMotion.stagger.step`). Vision-only exports (`VISION_PHOTO_ARRIVE`, `VISION_PHOTO_ACTIONS_IN`, `useVisionContentMotion`, `VisionStageTransition`) stay in place. Non-Vision files that already import `AnimatedPressable`/`VISION_STAGGER_MS` from `VisionMotion` keep working through the re-exports.
- [ ] **Step 4: Run** `npx jest src/components/v2/motion src/components/v2/vision` and `npx tsc --noEmit -p .` — Expected: PASS, no new type errors (Vision suites unchanged and green).
- [ ] **Step 5: Commit** `git commit -am "refactor(v2): move press/attention motion to shared layer"` (add new files first).

### Task 3: ContentSwap and Shimmer

**Files:**
- Create: `components/v2/motion/ContentSwap.tsx`, `components/v2/motion/Shimmer.tsx`
- Modify: `components/v2/motion/index.ts`
- Test: `components/v2/motion/__tests__/ContentSwap.test.tsx`, `components/v2/motion/__tests__/Shimmer.test.tsx`

**Interfaces:**
- Consumes: Task 1/2 barrel.
- Produces:
  - `ContentSwap({ contentKey: string, style?, children })` — wraps children in an `Animated.View` keyed by `contentKey`; the first mount does not animate; later key changes fade the new content in (`FadeIn`, `standard`, delayed `micro`, `enter` easing; reduced → `FadeIn` `quick`). Entering-only: a leaving sibling would double the height in normal flow.
  - `Shimmer({ style?, children })` — opacity pulses `1 ↔ 0.55` with `AnchorMotion.easing.gentle`, half-cycle `AnchorMotion.duration.ambient / 2`, `withRepeat(..., -1, true)`; reduced → static `1`; `cancelAnimation` on unmount.

- [ ] **Step 1: Write failing tests.** `ContentSwap`: renders children for key `a`; after `rerender` with key `b` renders the new children; first render passes `entering` as `undefined` (assert via the animated view's props or by mocking `Animated.View`). `Shimmer`: renders children; with reduce-motion mocked true, `withRepeat` is not called.
- [ ] **Step 2: Run** `npx jest src/components/v2/motion` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** both components and export them.
- [ ] **Step 4: Run** `npx jest src/components/v2/motion` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/components/v2/motion && git commit -m "feat(v2): ContentSwap and Shimmer"`

### Task 4: V2Button and V2IconButton

**Files:**
- Modify: `components/v2/primitives/V2Button.tsx`, `components/v2/primitives/V2IconButton.tsx`
- Test: `components/v2/__tests__/primitives.test.tsx` (extend), existing assertions must still pass

**Interfaces:**
- Consumes: `usePressScale`, `AnimatedPressable` from `@/components/v2/motion`.
- Produces: same props/testIDs as today. `V2Button`: press = scale, the `styles.pressed` opacity flip is removed; while `loading` the label cross-fades out and the spinner (`testID` `${testID ?? 'v2-button'}-loading`) fades in over `AnchorMotion.duration.quick`. `V2IconButton`: scale press; the grouped-background tint is kept but applied as an animated background opacity layer, not a style flip.

- [ ] **Step 1: Write failing tests** in `primitives.test.tsx`: disabled `V2Button` does not call `onPress` and has `accessibilityState.disabled`; loading `V2Button` renders the `-loading` testID and does not call `onPress`; enabled `V2Button`/`V2IconButton` still call `onPress`; reduced-motion mocked true still renders and presses.
- [ ] **Step 2: Run** `npx jest src/components/v2/__tests__/primitives.test.tsx` — Expected: FAIL only where behaviour is new; note any pre-existing assertion that depends on the old `pressed` style and update it to the new contract.
- [ ] **Step 3: Implement.** Use `AnimatedPressable` with `onPressIn/onPressOut` from `usePressScale` and its `style` composed after `base/size/variant/disabled/style`. Inactive buttons skip the animated style.
- [ ] **Step 4: Run** `npx jest src/components/v2` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(v2): scale press on V2Button and V2IconButton"`

### Task 5: V2ListRow and V2SegmentedControl

**Files:**
- Modify: `components/v2/primitives/V2ListRow.tsx`, `components/v2/primitives/V2SegmentedControl.tsx`
- Create: `components/v2/primitives/segmentedGeometry.ts`
- Test: `components/v2/primitives/__tests__/segmentedGeometry.test.ts`, `components/v2/__tests__/primitives.test.tsx` (extend)

**Interfaces:**
- Produces: `segmentGeometry(controlWidth: number, count: number, selectedIndex: number, padding: number): { segmentWidth: number; offset: number }` — `inner = max(0, controlWidth - 2*padding)`, `segmentWidth = count > 0 ? inner/count : 0`, `selectedIndex` clamped to `[0, max(0,count-1)]`, `offset = padding + index*segmentWidth`; every value finite and `>= 0`.
- `V2ListRow`: when `onPress` is set the pressed background fades in (`AnchorMotion.duration.micro`) and the trailing chevron shifts right 2px via `pressed`; with no `onPress` it renders as today (no animated handlers). Props unchanged.
- `V2SegmentedControl`: a measured pill (`onLayout` on the control) translates to the selected segment on `AnchorMotion.spring.snap`; the first layout positions it without animating; selected label colour switches as today; props unchanged; reduced → positions with `withTiming(..., micro)`.

- [ ] **Step 1: Write failing tests.** Geometry: `(300,3,1,3)` → `segmentWidth 98`, `offset 101`; `(0,3,1,3)` → `{0, 3}`; `(300,1,0,3)`; `(300,3,-1,3)` and `(300,3,9,3)` clamp; `count 0` → `segmentWidth 0`. Render: `V2SegmentedControl` still fires `onChange` with the tapped value and keeps `accessibilityState.selected` on the matching option, also when `value` matches no option; `V2ListRow` without `onPress` has no `button` role and ignores press.
- [ ] **Step 2: Run** `npx jest src/components/v2` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** geometry, then the two components.
- [ ] **Step 4: Run** `npx jest src/components/v2 src/screens/v2/anchors` and `npx tsc --noEmit -p .` — Expected: PASS (Library screen test still green).
- [ ] **Step 5: Commit** `git add src/components/v2/primitives && git commit -m "feat(v2): list row press and sliding segmented pill"`

### Task 6: V2Feedback states

**Files:**
- Modify: `components/v2/feedback/V2Feedback.tsx`
- Test: `components/v2/feedback/__tests__/V2Feedback.test.tsx` (create)

**Interfaces:**
- Consumes: `Reveal`, `Shimmer`.
- Produces: `V2Skeleton` wraps its box in `Shimmer`; `V2EmptyState`, `V2InlineError`, `V2ActivityIndicator` wrap their root in `Reveal` (`rise` default). Props, roles (`progressbar`, `alert`, `header`) and `testID`s unchanged.

- [ ] **Step 1: Write failing tests:** each component still renders its text and a11y role; `V2InlineError` shows "Try again" only with `onRetry` and calls it when pressed; `V2Skeleton` forwards `testID`.
- [ ] **Step 2: Run** `npx jest src/components/v2/feedback` — Expected: FAIL (file missing) or PASS for pre-existing behaviour; fix the test file until it targets only behaviour that exists.
- [ ] **Step 3: Implement** the wrappers.
- [ ] **Step 4: Run** `npx jest src/components/v2 src/screens/v2` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(v2): shimmer skeleton and arriving feedback states"` (add the new test file).

### Task 7: Anchor Library

**Files:**
- Modify: `components/v2/anchors/V2AnchorGalleryGrid.tsx`, `components/v2/anchors/V2AnchorGalleryItem.tsx`, `screens/v2/anchors/V2AnchorLibraryScreen.tsx`
- Test: `screens/v2/anchors/__tests__/V2AnchorLibraryScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: `Reveal`, `ContentSwap`, `usePressScale`, `AnimatedPressable`, `staggerDelay`.
- Produces: top bar and filter arrive first (`Reveal order 0`, `1`); grid cells use `Reveal order={index + 2}` (clamped by the token) **only on the first mount** — the screen keeps a `settledRef` set after the first effect and passes `enabled={!settledRef.current}`; a filter change wraps the grid/empty state in `ContentSwap contentKey={filter}`; `V2AnchorGalleryItem` gets the scale press in place of the `pressed` opacity style. No `entering` on cells.

- [ ] **Step 1: Write failing tests:** with 40 entries all 40 items render (no cap on rendering); tapping an item still calls `navigation.navigate('V2AnchorDetails', …)`; switching the filter to `released` re-renders the empty/grid content without throwing; `withDelay` is not invoked for newly mounted cells after the first mount (spy), and a re-render with the same entries does not invoke it again.
- [ ] **Step 2: Run** `npx jest src/screens/v2/anchors` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the screen/grid/item changes as above; skip entrance motion when the route params carry `anchorTransition`.
- [ ] **Step 4: Run** `npx jest src/screens/v2/anchors src/components/v2/anchors` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(v2): Library entrance, filter cross-fade and press"`

### Task 8: Progress screen

**Files:**
- Modify: `screens/v2/progress/V2ProgressScreen.tsx`
- Test: `screens/v2/progress/__tests__/V2ProgressScreen.test.tsx` (extend)

**Interfaces:** Consumes `Reveal`. Wrap, in reading order, inside the loaded `ScrollView` only: nav-triangle row (`order 0`), `V2ProgressHero` (`1`), `V2EvidenceSummary` (`2`), `V2ThreadEventTimeline` (`3`). Header and the loading/error/empty branches are untouched. The event-detail sheet is untouched.

- [ ] **Step 1: Write failing test:** the loaded screen still renders hero, summary and timeline `testID`s; pressing refresh (`${testID}-refresh-btn`) re-renders without calling `withDelay` again.
- [ ] **Step 2: Run** `npx jest src/screens/v2/progress` — Expected: new test FAILS.
- [ ] **Step 3: Implement** the four wrappers (`style` passthrough not needed).
- [ ] **Step 4: Run** `npx jest src/screens/v2/progress src/components/v2` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(v2): Progress entrance choreography"`

### Task 9: Weekly Insight screen

**Files:**
- Modify: `screens/v2/weeklyInsight/V2WeeklyInsightScreen.tsx`
- Test: `screens/v2/weeklyInsight/__tests__/V2WeeklyInsightScreen.test.tsx` (extend)

**Interfaces:** Consumes `Reveal`, `ContentSwap`. In the loaded branch wrap sections in reading order: date row (`0`), hero headline/support (`1`), `WeeklyInsightVisual` (`2`), `WeeklyEvidenceRow` (`3`), `WeeklyInterpretation` (`4`), `WeeklyNextDirection` + feedback widget + disclosure share `order 5` (cap). Selecting a historical snapshot cross-fades the scroll content with `ContentSwap contentKey={snapshot.id}` (use the existing snapshot identifier field; if none exists, the selected-snapshot id from the hook) and does not replay the stagger. The loading, empty and toast branches are untouched; the existing `Animated.Value` toast stays.

- [ ] **Step 1: Write failing tests:** loaded screen still renders every section `testID`; selecting a historical snapshot (existing test helper/flow) shows the new snapshot's headline and the toast text "Historical snapshot".
- [ ] **Step 2: Run** `npx jest src/screens/v2/weeklyInsight` — Expected: new assertions FAIL or the test file needs the harness the existing tests already use; reuse it.
- [ ] **Step 3: Implement** the wrappers.
- [ ] **Step 4: Run** `npx jest src/screens/v2/weeklyInsight src/components/v2/weeklyInsight` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(v2): Weekly Insight entrance and snapshot cross-fade"`

### Task 10: Paywall

**Files:**
- Modify: `components/v2/paywall/V2PaywallSheet.tsx`, `components/v2/paywall/V2TrialEndedPanel.tsx`
- Test: `screens/v2/paywall/__tests__/V2PaywallScreen.test.tsx` (extend)

**Interfaces:** Consumes `Reveal`, `usePressScale`, `AnimatedPressable`. `V2PaywallSheet` scroll content, in order: artifact slot (`0`), eyebrow+headline+body (`1`), benefits (`2`), trial timeline (`3`, rendered conditionally as today), offer card (`4`). `V2TrialEndedPanel`: eyebrow/headline/body (`0`), recap (`1`), plan radios (`2`), actions (`3`). `PlanRadio` rows get the scale press. The sheet's own grabber/close row and `V2PlanPickerSheet` are untouched. Purchase, pricing and entitlement logic are not touched.

- [ ] **Step 1: Write failing tests:** for context `TRIAL_ENDED` and a normal context, every existing `testID` (`v2-paywall-sheet-*`, `v2-paywall-close`, `v2-paywall-plan-annual`, `v2-paywall-plan-monthly`) is present; tapping a plan still calls `setSelectedPlan`; a non-purchasable plan stays disabled.
- [ ] **Step 2: Run** `npx jest src/screens/v2/paywall` — Expected: new tests FAIL where behaviour is new.
- [ ] **Step 3: Implement** the wrappers and press.
- [ ] **Step 4: Run** `npx jest src/screens/v2/paywall src/components/v2/paywall src/hooks/v2/paywall` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(v2): Paywall entrance and plan press"`

### Task 11: Chart Adjust

**Files:**
- Modify: `screens/v2/chart/V2ChartAdjustScreen.tsx`
- Test: `screens/v2/chart/__tests__/V2ChartAdjustScreen.test.tsx` (extend)

**Interfaces:** Consumes `Reveal`, `ContentSwap`. In the scroll content: hero block (`0`), panel container (`1`). Switching `phase` between `ask` and `review` cross-fades the body with `ContentSwap contentKey={phase}` instead of replaying a stagger. Header, map strip, keyboard handling, archive/delete/edit actions and all `testID`s (`chart-adjust-*`) untouched.

- [ ] **Step 1: Write failing tests:** `chart-adjust-active`, `chart-adjust-manual`, `chart-adjust-archive`, `chart-adjust-delete` still render in the `ask` phase and still fire their handlers; back in `review` returns to `ask`.
- [ ] **Step 2: Run** `npx jest src/screens/v2/chart/__tests__/V2ChartAdjustScreen.test.tsx` — Expected: new tests FAIL or pass; adjust until they pin the preserved behaviour.
- [ ] **Step 3: Implement** the wrappers.
- [ ] **Step 4: Run** `npx jest src/screens/v2/chart src/components/v2/chart` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(v2): Chart Adjust entrance and phase cross-fade"`

### Task 12: Full verification and device checklist

**Files:**
- Create: `docs/superpowers/plans/2026-10-05-motion-polish-device-checklist.md` (repo root `E:\Projects\Anchor`)

- [ ] **Step 1: Run** `npx tsc --noEmit -p .` and `npx jest src/components/v2 src/screens/v2 src/navigation src/hooks` — Expected: no failures beyond those already listed in `creation-polish-existing-failures.log`; report each pre-existing failure by name.
- [ ] **Step 2: Audit leftovers:** `grep -rn "pressed && styles.pressed\|opacity: 0.82" src/components/v2/primitives` — Expected: no matches in the touched primitives.
- [ ] **Step 3: Write the checklist** for the S24: press scale on buttons/rows/plan radios; segmented pill slide (Library filter); Library, Progress, Weekly Insight, Paywall, Chart Adjust entrance order; no replay on back-navigation or pull-to-refresh; skeleton shimmer in the System Gallery; reduce-motion on (in-app "on") shows fades only; Android animator scale 0 behaves.
- [ ] **Step 4: Commit** `git add docs && git commit -m "docs: motion polish device checklist"`
