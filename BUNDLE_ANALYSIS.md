# Bundle Analysis and Optimization Report

**Date**: 2026-02-01
**Analysis Tool**: depcheck v1.4.7

---

## Summary

This report documents the findings from running bundle analysis and dependency checks on the Anchor mobile app. The goal is to identify and remove unused dependencies and assets to reduce bundle size and improve performance.

---

## Dependency Analysis

### Unused Dependencies (Production)

The following dependencies are installed but not used anywhere in the codebase:

1. **`@expo/metro-config`** (~0.19.0)
   - **Reason**: This is actually used in `metro.config.js` via `expo/metro-config`
   - **Action**: ❌ **KEEP** - False positive, required by Expo
   
2. **`expo-asset`** (~11.0.1)
   - **Usage Check**: Not directly imported in any source files
   - **Action**: ✅ **REMOVE** - Not used, Expo can handle assets without explicit import
   
3. **`expo-av`** (~15.0.1)
   - **Usage Check**: Not imported anywhere
   - **Action**: ✅ **REMOVE** - No audio/video features currently implemented
   
4. **`expo-constants`** (~17.0.3)
   - **Usage Check**: Not imported anywhere
   - **Action**: ✅ **REMOVE** - Can be re-added when needed
   
5. **`react-native-web`** (~0.19.13)
   - **Usage Check**: Not used (mobile-only app)
   - **Action**: ✅ **REMOVE** - Web target not being used

### Unused DevDependencies

1. **`@types/jest`** (^30.0.0)
   - **Usage Check**: TypeScript types for Jest
   - **Action**: ❌ **KEEP** - Used by TypeScript even if not directly imported
   
2. **`typescript`** (~5.3.3)
   - **Usage Check**: Used for type checking
   - **Action**: ❌ **KEEP** - Essential for TypeScript project

---

## Asset Analysis

### Current Assets

```
📁 assets/
  ├── anchor-icon.jpg         432 KB (443,146 bytes)
  └── anchor-logo-official.jpg 398 KB (408,243 bytes)
```

**Total Asset Size**: ~830 KB

### Optimization Opportunities

1. **Image Format Optimization**
   - Both images are JPG format
   - **Recommendation**: Convert to WebP for ~30-50% size reduction
   - **Estimated Savings**: 250-400 KB
   
2. **Image Compression**
   - Both images appear to be high quality
   - **Recommendation**: Optimize with tools like ImageOptim or Sharp
   - **Estimated Savings**: 100-200 KB (if not already optimized)

3. **Adaptive Icons**
   - Consider using different resolutions for different device densities
   - Already handled by Expo's asset system

---

## Bundle Size Breakdown

### Current Dependencies Weight (Estimated)

| Package | Approx Size | Priority |
|---------|-------------|----------|
| react-native | ~5-7 MB | Critical |
| react-navigation | ~500 KB | Critical |
| zustand | ~10 KB | Critical |
| axios | ~100 KB | High |
| date-fns | ~200 KB | Medium |
| expo-* packages (needed) | ~2 MB | High |
| react-native-svg | ~300 KB | Critical |
| react-native-reanimated | ~1 MB | Critical |
| react-native-fast-image | ~50 KB | High |
| **expo-av** (unused) | ~500 KB | **Remove** |
| **expo-asset** (unused) | ~100 KB | **Remove** |
| **expo-constants** (unused) | ~50 KB | **Remove** |
| **react-native-web** (unused) | ~1.5 MB | **Remove** |

**Estimated Savings from Removing Unused Deps**: ~2.15 MB

---

## Recommendations

### High Priority (Implement Now)

1. ✅ **Remove unused dependencies**
   ```bash
   npm uninstall expo-asset expo-av expo-constants react-native-web
   ```
   - **Impact**: Reduce bundle size by ~2.15 MB
   - **Risk**: Low (not used anywhere)

2. ✅ **Optimize images**
   - Convert assets to WebP format
   - **Impact**: Reduce asset size by ~300 KB
   - **Risk**: Very Low

3. ✅ **Use react-native-fast-image** (Already Implemented)
   - Implemented OptimizedImage component
   - Wired into AnchorCard
   - **Impact**: Better image caching and performance
   - **Status**: ✅ Complete

### Medium Priority

1. **Code splitting**
   - Consider lazy loading screens that aren't immediately needed
   - **Impact**: Faster initial load time
   - **Risk**: Medium (requires testing)

2. **Tree shaking verification**
   - Ensure unused exports are removed
   - Review lodash usage (if any) - use specific imports
   - **Impact**: 100-500 KB potential savings

3. **Font optimization**
   - Review if all loaded fonts are used
   - Use font subsetting for custom fonts
   - **Impact**: 50-200 KB per font

### Low Priority

1. **API client optimization**
   - Consider switching from axios to fetch API
   - **Savings**: ~100 KB
   - **Trade-off**: Loss of axios interceptors and convenience features

2. **Date library alternatives**
   - Evaluate if date-fns is fully utilized
   - Consider smaller alternatives like dayjs
   - **Savings**: ~100 KB
   - **Trade-off**: May require code changes

---

## Action Plan

### Phase 1: Immediate (Today)
- [x] Install react-native-fast-image
- [x] Create OptimizedImage component
- [x] Wire OptimizedImage into AnchorCard
- [x] Run depcheck analysis
- [ ] Remove unused dependencies
- [x] Document findings in PERFORMANCE_BASELINE.md

### Phase 2: Short-term (This Week)
- [ ] Optimize image assets (WebP conversion)
- [ ] Run device profiling on iPhone 8
- [ ] Run device profiling on Galaxy A52
- [ ] Fill in PERFORMANCE_BASELINE.md with real metrics

### Phase 3: Medium-term (This Month)
- [ ] Implement lazy loading for non-critical screens
- [ ] Review and optimize font loading
- [ ] Consider tree-shaking improvements

---

## Expected Performance Impact

### Bundle Size
- **Current (estimated)**: ~15-20 MB
- **After Phase 1**: ~13-17 MB (10-15% reduction)
- **After Phase 2**: ~12-16 MB (15-20% reduction)

### Load Time
- **Impact**: 10-20% faster initial load on slow connections
- **Benefit**: Particularly noticeable on low-end devices (iPhone 8, Galaxy A52)

### Memory Usage
- **Impact**: Minimal direct impact from dependency removal
- **Benefit**: Better image caching with react-native-fast-image should reduce memory spikes

---

## Notes

- All measurements are estimates based on typical package sizes
- Actual bundle size should be measured after production build
- Metro bundler performs automatic tree-shaking
- Expo's managed workflow optimizes bundle automatically
- Physical device testing needed for accurate performance metrics

---

## Commands Used

```bash
# Dependency analysis
npx depcheck

# Bundle visualization (attempted, requires native build)
npx react-native-bundle-visualizer

# Asset inspection
Get-ChildItem -Recurse -File | Select-Object FullName, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}}
```

---

## Next Steps

1. ✅ Get user approval to remove unused dependencies
2. ✅ Document findings in this report
3. ⏳ Remove packages after approval
4. ⏳ Run device profiling
5. ⏳ Optimize assets
6. ⏳ Measure actual bundle size in production build
