# Anchor 2.0 — UI-A System Foundation

UI-A is a presentation-only foundation under `anchor/mobile/src/**/v2`. It is opt-in in development only, and no production screen imports this namespace.

## Tokens

Base: `canvas #F4F1E9`, `surface #FBF9F4`, `grouped #ECE8DF`, primary text `#171717`, secondary text `#6C6861`, border `#D8D2C8`.

Semantic tokens: success `#287D57`, warning `#9A6818`, error `#B63B38`, info `#3157D8`. Additional border/text variants exist only for disabled, low-emphasis, and selected states.

Category palette: Desire `#D94F8A`, Health `#2FA879`, Career `#3157D8`, Relationships `#E56F7A`, Creativity `#F28A2E`, Spirituality `#7657D9`, Abundance `#B6A32A`, Family `#C86B45`, Learning `#198C9C`, Adventure `#2D9FC8`, Focus `#62666D`, Custom `#E85D32`.

Use `getCategoryColor`, `getCategoryFieldColor` (12% field), and `getCategorySoftTint` (8% tint); do not hardcode category hexes in screens.

Practice palette: Focus `#8B5CF6`, DeepPrime `#E0A038`, Visualize `#3B82C4`, Release `#DD5F2C`. Use `getPracticeColor` or `getPracticeSoftTint`. Practice accents never replace an Anchor category color.

Spacing is `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Radii are `8, 12, 18, 24, round`. Shadows are intentionally limited to a low-contrast surface shadow.

## Typography and motion

`Bricolage Grotesque` is used for `displayLarge`, `displayMedium`, and `headingXL/LG/MD`; `Figtree` is used for functional headings, body, labels, captions, and numeric utility. The semantic scale lives in `theme/v2/typography.ts`; screens choose roles rather than font sizes.

Motion durations: `instant 0`, `fast 160`, `standard 240`, `slow 360`, `celebration 520`. Motion communicates an action or state change only. All V2 motion reads the existing reduced-motion utility; when enabled, counters set direct values and selection controls avoid animation.

## Primitives

`V2Screen` owns warm canvas, safe area, standard horizontal padding, optional scroll, and optional keyboard avoidance. `V2Surface` and `V2GroupedSurface` provide quiet containers; avoid nested card grids. `V2Section`, `V2ContentStack`, and `V2Divider` provide composition rhythm.

`V2Button` supports primary, secondary, tertiary, destructive; large, medium, compact; icons, loading and disabled state. It preserves layout while loading and has a minimum 44px target. `V2IconButton` is always 44×44 and requires a label. Use it for navigation and utilities, not a text action.

`V2Badge` is for compact status/category/practice labels only. `V2SegmentedControl` is for compact mutually exclusive selections. `V2SectionHeader` supports title, copy, and an optional action. `V2ListRow` supports editorial content rows on canvas or a grouped surface; it is not an iOS Settings clone.

`V2TopBar`, `V2BackButton`, and `V2HeaderUtilityGroup` support contextual navigation. They do not assume permanent tabs.

`V2Skeleton`, `V2ActivityIndicator`, `V2InlineError`, and `V2EmptyState` are composable feedback patterns, not full screens. Skeletons are static warm neutral blocks—no shimmer.

## Circular Anchor

`CircularAnchorRenderer` reuses `components/common/SigilSvg`, the existing stable XML renderer. It has `hero (232)`, `large (152)`, `medium (104)`, `thumbnail (64)`, and `micro (44)` sizes. A single low-opacity category field and fine category border provide context. It must remain centered, flat, circular, and high-contrast: no bevel, rim, aura stack, metallic treatment, rotating ring, or square frame. The wrapper exposes one sensible image description and hides the raw SVG tree from screen readers. It is memoized; `SigilSvg` retains its normalized XML cache.

## Thread Strength

`V2ThreadStrength` accepts `value`, optional server/domain-provided `previousValue`, `delta`, `trend`, `detail`, category, and press callback. It clamps only the displayed 0–100 value; it performs no progression, gain, decay, delta, entitlement, or course calculation. It uses a compact evidence bar and optional movement statement—not an XP meter, rank system, or mystical ring. The counter uses a one-shot shared duration and renders the supplied value directly under Reduce Motion.

## Accessibility and haptics

Every interactive V2 primitive exposes an appropriate role, label, and state. Buttons and icon buttons have at least a 44px target. Text retains font scaling; layouts use flexible copy containers and no universal font-scaling suppression. The locked warm text/surface pairing provides the primary contrast baseline; category colors are accents rather than body-text backgrounds. `v2Haptics` maps meaningful `selection`, `confirmation`, `completion`, `warning`, and `destructiveCommit` events to the existing safe haptic utility. Do not invoke haptics on every tap.

## Gallery and isolation

`V2SystemGallery` is available from `V2DevelopmentHome` via the development-only `AnchorV2Navigator`. It demonstrates colors, typography, actions, icon targets, labels, segment selection, rows, surfaces, Anchor scales, Thread Strength states, and feedback states. It is not a production screen.

The V2 navigator is selected only when `__DEV__` and `EXPO_PUBLIC_ANCHOR_V2_ENABLED=true`; with the flag false, `RootNavigator` remains the production entry point unchanged. UI-B and later work must consume these exports rather than recreate their own tokens or primitives.
