# Anchor Mobile Performance Baseline

Date: February 1, 2026  
Scope: `apps/mobile` (Anchor v2)

## Targets
- Images on 3G: <2s
- Animations: 60fps (no sustained drops)
- Memory: <200MB steady-state
- Bundle: <30MB (release, per-platform)

## Instrumentation Added (this pass)
- `OptimizedImage` now emits image-load traces when `trackLoad` is enabled.
- `SigilSvg` trims XML, keeps rasterization defaults overridable.
- Onboarding `FlatList` now uses `getItemLayout` and tighter windowing.

## Baseline Environment
- Build: TBD (dev client / release)
- Devices: TBD (iPhone 8, Galaxy A52)
- OS versions: TBD
- Network profiles: WiFi, 3G (throttled)
- Test data: TBD (anchor count, variation count)

## Measurement Methodology

### Image Load Times (WiFi / 3G)
1. Use screens with heavy images:
   - Vault (grid)
   - Anchor Reveal (hero image)
   - AI Variation Picker (2x2 grid)
2. Enable `trackLoad` on `OptimizedImage` (already wired for the above).
3. Collect median + p95 from Firebase Performance traces (`image_load_*`).
4. Repeat on WiFi and 3G throttle.

### SVG Render
1. Use SVG-heavy screens:
   - Seal Anchor ritual
   - Structure Forge / Style Selection
2. Enable RN Perf Monitor and record FPS while entering/exiting.
3. Note any rasterization artifacts if `shouldRasterizeIOS` / `renderToHardwareTextureAndroid` are changed.

### Animation Smoothness
1. RN Perf Monitor (JS + UI FPS).
2. Focus on:
   - DistillationAnimationScreen
   - SealAnchorScreen
   - Ritual flows with continuous loops

### Memory
1. iOS: Xcode Instruments (Leaks + Allocations).
2. Android: Android Studio Profiler (Memory).
3. Record cold start, post-onboarding, and vault-scroll snapshots.

### Bundle Size
1. Build release bundles per platform.
2. Use bundle visualization to identify large modules and assets.
3. Capture APK/IPA compressed and uncompressed sizes.

## Baseline Results (TBD)

| Metric | WiFi | 3G | Notes |
| --- | --- | --- | --- |
| Image load (Vault grid, median) | TBD | TBD | `image_load_*` traces |
| Image load (Anchor Reveal, p95) | TBD | TBD | Hero image |
| SVG render (Seal Anchor) | TBD | TBD | FPS min/avg |
| Animation FPS (Distillation) | TBD | TBD | FPS min/avg |
| Memory steady-state | TBD | TBD | MB |
| Bundle size (iOS) | TBD | TBD | MB |
| Bundle size (Android) | TBD | TBD | MB |

## Phase 2 Optimization Status

### Image
- `OptimizedImage` traces added for profiling.
- Prefetch now defaults to `memory-disk` cache policy.
- **Blocked:** `react-native-fast-image` install failed (npm resolution). See blockers.

### SVG
- `SigilSvg` trims XML + keeps platform rasterization defaults overridable.
- Pending: SVGO pass on generated sigils, path simplification.

### Animations
- Existing screens largely use `useNativeDriver: true` where supported.
- Pending: review `useNativeDriver: false` occurrences for possible Reanimated migration.

### Memory
- Screen loops already stop on cleanup in most components.
- Pending: audit long-lived refs + store subscriptions, cache caps.

### Bundle
- Pending: run bundle visualizer and prune unused deps/assets.

## Phase 3 Device Validation (TBD)
- iPhone 8 (iOS TBD)
- Galaxy A52 (Android TBD)

## Blockers / Notes
- `npm install react-native-fast-image` failed due to dependency resolution.
  - Errors: peer type conflicts and `@amplitude/analytics-react-native@^1.6.3` not found in registry.
  - Recommendation: verify registry source, or install with a validated lockfile update.
