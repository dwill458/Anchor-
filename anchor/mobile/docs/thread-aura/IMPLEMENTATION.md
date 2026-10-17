# Thread Strength living aura

Implemented locally in Home and Anchor Details. Native device acceptance remains pending.

## Rendering

`CircularAnchorRenderer` retains its existing foreground: enhanced image URL and crop, kept expression through `AnchorMark`, or the stored SVG through `SigilSvg`. Aura is an optional decorative layer between the existing paper ground and that foreground. Artwork dimensions, carousel geometry, Details sheet geometry, actions, routes, and existing Home practice-status ring remain unchanged. No new ring is added.

`ThreadAura` uses the existing app performance-tier and reduced-motion policies. On supported installations, `ThreadAuraCanvas` prepares a five-tile alpha atlas from the **unchanged stored SVG** after interactions settle, only for an active presentation. Skia receives the complete XML and its original viewBox; no paths are reconstructed. The atlas stores five Gaussian falloffs (0.006, 0.014, 0.036, 0.12, 0.18 times artwork size). Each tile is clipped separately. Animation samples those cached tiles with a single SkSL shader: tight inner luminosity, shifting outer light/ribbons, diffuse ambient light, and sparse geometry-contained motes. The crisp foreground is rendered last.

The shader uses slow spatial wave interference and displacement, with a maximum 1.8% breath. It never rotates the Anchor. Reanimated drives time, score interpolation and the brief inner-light response on the UI thread; React state is not updated per frame. Shader colors derive from `getCategoryColor`, with small white admixtures for highlights. Existing category tokens are authoritative: for example, Career is currently amber, Creativity violet, and Spirituality blue. This task does not change those tokens to the brief's illustrative palette.

Enhanced artwork stays completely unchanged. Its aura follows its saved structural SVG; opaque enhanced images do not provide a safe stroke-only alpha mask. This is an explicit structural-mask fallback, not an attempt to infer or regenerate enhanced geometry. The opaque foreground can conceal some inner luminosity; enhanced-image visual acceptance requires device review. Kept expressions retain their original foreground treatments; the aura follows their saved structure rather than reproducing decorative expression overlays.

SVGs with external references, images, text, foreign objects or filters, parser failures, missing native Skia, and shader compilation failures use the existing native SVG renderer with a Gaussian alpha-tinted static glow. Low-tier devices and reduced motion also use this static path. The SVG itself is never substituted. This fallback has no particles or continuous motion.

Installed versions inspected: Expo 54.0.34, React Native 0.81.5, Reanimated 4.1.6, Skia 2.2.12, react-native-svg 15.12.1. No dependencies or native build configuration were changed for the aura. The installed Skia APIs were checked along with the [official runtime shader documentation](https://shopify.github.io/react-native-skia/docs/image-filters/runtime-shader/).

## Strength mapping

`s = clamp(threadStrength / 100, 0, 1)`; null, undefined and nonfinite inputs map to zero. There are no discrete animation switches at level boundaries. Let `v = 0.72` for Home and `1` for Details:

| Parameter | Mapping |
| --- | --- |
| Aura radius | `0.012 + 0.16s` |
| Blur progression | `0.014 + 0.106s`, blended across cached falloffs |
| Inner opacity | `v × (0.015 + 0.28s)` |
| Outer opacity | `v × 0.64s^1.3` |
| Displacement amplitude | `v × 0.027s²` |
| Mote visibility / occupied-cell density | `v × 0.22s⁵`, high tier only |
| Ambient intensity | `v × 0.28s³` |

Radii and displacement are relative to artwork/canvas dimensions, not new screen layout dimensions. Final shader alpha is bounded at 0.62 and fades before the canvas boundary. The original Anchor remains fully visible at zero.

Home continues to use `thread.value`; Details continues to use its recommendation/detail Thread Strength value. Existing `PracticeCompletionService` writes the returned score after server confirmation. No Thread Strength computation, grace period, rest-day rule, API, persistence, auth, subscription, or generator code changed.

A mounted aura retains its previous confirmed value while covered. On return, an increase eases for 1500ms and adds a 350ms inner-light lift settling over 1150ms. Decay retreats over 2200ms without a reward. Null/first observations do not fabricate reward history. Fresh mounts show their current value; there is no new persisted last-seen store. Separate Anchor identities reset animation history.

## Lifecycle and performance

Only Home's active center can animate. Home pauses animation during carousel/scroll motion, after the hero scrolls out of view, during artwork transitions, and when the route loses focus. Details follows route visibility and artwork-transition visibility. App backgrounding stops both. Frame callbacks and score animations are cancelled on lifecycle changes and unmount.

The aura canvas is 1.6 times the existing Anchor diameter. Textures are capped at 384px per tile, five tiles per atlas, with at most eight cached atlases: nominal cached pixel storage is at most 22.5MiB, excluding driver overhead and evicted images still referenced by mounted views. Offscreen carousel cards do not prepare atlases. There is no per-frame SVG parsing, rasterization or Gaussian blur.

CanvasKit CPU QA measured about 422ms for one atlas preparation in this Windows environment; this is **not** a native GPU timing or an FPS measurement. It supports deferring preparation away from navigation/drag interactions. Native preparation latency, memory pressure, frame pacing and power use are unverified. Android `adb devices` returned no connected devices. No Android/iOS or low-end hardware performance claim is made.

## Validation

- Mapping, renderer/fallback, foreground preservation, alpha-cache and lifecycle tests: **4 suites, 24 tests passed**. Lifecycle coverage includes confirmed increase while covered, return easing, quiet decay and frame-callback shutdown.
- Home, Details, carousel, original rendering and mapping integration run: **5 suites, 171 tests passed**.
- Regression retry covering Practice completion, Home Practice arrival, existing Hero light, carousel and original rendering: **5 suites, 83 tests passed**. These runs overlap; do not sum them as unique tests.
- A broader directory run terminated with Windows process exit `-1073740791` after several passing suites. The smaller regression retry above completed successfully; no full-suite success is claimed.
- `tsc --noEmit --pretty false`: passed after the final implementation checks.
- Android and iOS Expo/Hermes exports succeeded. These verify bundling, not native rendering or device performance.
- Scoped `git diff --check`: passed.

The available reference was `1-Screen_Recording_20261015_034116_X.mp4`; separate files named `164353.mp4` and `glow_ref.jpg` were not supplied. `reference-contact.png` records sampled reference frames. Its uneven layered falloff and drifting energy informed the treatment, without copying the reference card/flower shapes.

## Visual artifacts

Run `node scripts/render-thread-aura.cjs` from mobile to regenerate the shader studies. This uses the existing traditional generator with a fixed synthetic letter set, the production mapping and production shader. CanvasKit CPU rendering and sharp provide a repeatable study, **not screenshots of authenticated Home/Details**. The motion study is encoded at 12fps for inspection; this does not represent app frame rate.

- `strength-10-50-95.png`: same Anchor at 10, 50, 95, left to right.
- `strength-matrix.png`: 0, 10, 25, 40, 50 on top; 68, 75, 89, 95, 100 below.
- `category-matrix.png`: Health, Career, Desire, Creativity, Spirituality using existing tokens.
- `strength-95-motion.mp4`: high-strength motion study.
- `qa-anchor.svg`: unchanged generated SVG used for the studies.
- `shader-validation.json`: shader compilation, atlas size and CPU preparation evidence.

Pending native acceptance: both platforms and a lower-tier device; actual enhanced and traditional Anchors at the requested strengths; no unexpected clipping or text overlap; crisp foreground/kept expressions; return from a real server-confirmed Practice completion; decay; reduced motion; navigation/scroll/keyboard responsiveness and frame pacing. Visual parity with the reference is not declared.

## Files changed for this task

Modified:

- `src/components/v2/anchor/CircularAnchorRenderer.tsx` — optional aura layer; preserve foreground and dimensions.
- `src/components/v2/home/V2HomeHero.tsx` — use category/geometry aura in place of the old circular gold halo.
- `src/screens/v2/home/V2HomeScreen.tsx` — existing motion/focus gates plus scroll visibility gate.
- `src/screens/v2/anchors/V2AnchorDetailsScreen.tsx` — replace the old radial halo with shared aura.
- `src/__tests__/setup.ts` — add only Filter, FeGaussianBlur and FeColorMatrix mock exports; concurrent unrelated mock edits are preserved.

Added:

- `src/components/v2/anchor/ThreadAura.tsx`
- `src/components/v2/anchor/ThreadAuraCanvas.tsx`
- `src/components/v2/anchor/threadAuraModel.ts`
- `src/components/v2/anchor/threadAuraShader.ts`
- `src/components/v2/anchor/threadAuraTexture.ts`
- `src/components/v2/anchor/ThreadAura.test.tsx`
- `src/components/v2/anchor/ThreadAuraCanvas.test.tsx`
- `src/components/v2/anchor/threadAuraModel.test.ts`
- `src/components/v2/anchor/threadAuraTexture.test.ts`
- `scripts/render-thread-aura.cjs`
- This report and the seven visual/evidence files listed above (including the reference contact sheet).

Changes remain local and uncommitted. No OTA, native build, deployment or publication was performed.
