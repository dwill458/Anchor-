# Device Profiling Guide

This guide explains how to run performance profiling on iPhone 8 and Galaxy A52 devices and fill in the PERFORMANCE_BASELINE.md file.

---

## Prerequisites

### For iOS (iPhone 8)
- **Physical iPhone 8 device** (not simulator)
- macOS with Xcode installed
- Device connected via USB
- Development build installed on device

### For Android (Galaxy A52)
- **Physical Galaxy A52 device** (not emulator)
- Android Studio installed
- USB debugging enabled on device
- Development build installed on device

---

## Profiling Steps

### 1. Build Development/Release Build

#### iOS
```bash
cd apps/mobile

# For profiling, use a release build for accurate results
npx expo run:ios --device --configuration Release
```

#### Android
```bash
cd apps/mobile

# For profiling, use a release build
npx expo run:android --variant release
```

---

### 2. Enable Performance Monitor

#### On Device
1. Shake the device (physical device)
2. Tap "Show Performance Monitor"
3. You'll see FPS counter in an overlay

#### Via Dev Menu
- **iOS**: Cmd+D in simulator, shake on device
- **Android**: Cmd+M in emulator, shake on device

---

### 3. Measure App Launch Performance

#### Using React Native Performance

**Create a profiling script** (`apps/mobile/scripts/measure-performance.js`):

```javascript
import { PerformanceObserver, performance } from 'react-native-performance';

// Measure cold start
performance.mark('app-start');

// In App.tsx, after mounting
performance.mark('app-interactive');
performance.measure('cold-start', 'app-start', 'app-interactive');

const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});

observer.observe({ entryTypes: ['measure'] });
```

#### Manual Method

1. **Cold Start**: 
   - Kill app completely
   - Clear from background
   - Start timer
   - Launch app
   - Stop when UI is interactive
   
2. **Warm Start**:
   - Send app to background
   - Wait 30 seconds
   - Start timer
   - Resume app
   - Stop when UI is interactive

---

### 4. Profile with Xcode Instruments (iOS)

detailed profiling on iPhone 8:

1. Open Xcode
2. Window → Devices and Simulators
3. Select your iPhone 8
4. Click "Open Instruments"
5. Choose template:
   - **Time Profiler**: CPU usage
   - **Allocations**: Memory usage
   - **Core Animation**: FPS/frame drops

#### Time Profiler
```
1. Select "Time Profiler" template
2. Choose your app from target
3. Click Record (red button)
4. Navigate through app:
   - Home → Forge → Ritual → Settings
   - Repeat 3 times
5. Stop recording
6. Analyze call tree for hot spots
```

#### Allocations (Memory)
```
1. Select "Allocations" template
2. Record during navigation
3. Look for:
   - Peak memory usage
   - Memory growth over time
   - Leaks (if any)
```

#### Core Animation (FPS)
```
1. Select "Core Animation" template
2. Enable "Color Blended Layers"
3. Record during animations:
   - Breath animation
   - Screen transitions
   - Ritual animations
4. Check FPS counter (aim for 60 fps)
```

---

### 5. Profile with Android Studio Profiler (Galaxy A52)

1. Open Android Studio
2. Run → Profile 'app'
3. Select Galaxy A52 device
4. Profiler window opens with CPU, Memory, Network, Energy

#### CPU Profiling
```
1. Click CPU timeline
2. Click "Record"
3. Navigate through app
4. Click "Stop"
5. Analyze flame chart
6. Look for method calls taking >100ms
```

#### Memory Profiling
```
1. Click Memory timeline
2. Record heap dump
3. Navigate through app (5 times through all screens)
4. Record another heap dump
5. Compare:
   - Memory growth
   - Leaked objects
   - Large allocations
```

#### Network Profiling
```
1. Click Network timeline
2. Perform actions that trigger API calls:
   - Load anchors
   - AI generation
   - User profile
3. Record:
   - Request/response times
   - Payload sizes
```

---

### 6. Measure Screen Navigation Performance

#### Method 1: Performance API

Add to each screen's `useEffect`:

```typescript
import { InteractionManager } from 'react-native';

useEffect(() => {
  const start = performance.now();
  
  InteractionManager.runAfterInteractions(() => {
    const end = performance.now();
    console.log(`${screenName} load time: ${end - start}ms`);
  });
}, []);
```

#### Method 2: Manual Timing

1. Start timer when pressing navigation button
2. Stop when new screen is fully rendered
3. Repeat 5 times and take median

---

### 7. Measure Animation Performance

#### Using React Native Performance Monitor

While monitor is visible:
1. Trigger animation (e.g., breath animation)
2. Watch FPS counter
3. Record:
   - Average FPS
   - Minimum FPS (drops)
   - Duration of FPS < 60

#### Using Flipper

1. Open Flipper
2. Connect to device
3. Enable "Layout" plugin
4. Record during animations
5. Check for:
   - Frame drops (red bars)
   - Long frames (>16ms)

---

### 8. Measure Bundle Size

#### Generate Production Bundle

```bash
# iOS
npx expo export --platform ios

# Android
npx expo export --platform android

# Check dist folder
cd dist
du -sh *
```

#### Detailed Analysis

```bash
# Install bundle analyzer
npm install -g @react-native-community/cli

# Generate bundle
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output ./bundle-output/android.bundle \
  --assets-dest ./bundle-output

# Check size
ls -lh ./bundle-output/android.bundle
```

---

### 9. Fill in PERFORMANCE_BASELINE.md

After collecting all metrics, update the baseline document:

#### Example Entry

```markdown
### App Launch Performance

#### iPhone 8
- **Cold Start**: 2847 ms
- **Warm Start**: 892 ms
- **Time to Interactive (TTI)**: 1923 ms

#### Galaxy A52
- **Cold Start**: 2156 ms
- **Warm Start**: 743 ms
- **Time to Interactive (TTI)**: 1542 ms
```

#### Screen Navigation Template

```markdown
| Screen | First Load | Subsequent Loads | Notes |
|--------|------------|------------------|-------|
| Home/Vault | 456 ms | 234 ms | Loaded 12 anchors |
| Forge (Create) | 289 ms | 187 ms | - |
| Ritual | 534 ms | 312 ms | Animation-heavy |
```

#### Animation Performance Template

```markdown
| Animation | Frame Rate | Dropped Frames | Notes |
|-----------|------------|----------------|-------|
| Breath Animation | 58 fps | 3.2% | Slight drops on complex screens |
| Tab Navigator | 60 fps | 0% | Smooth |
```

---

## Automated Profiling (Advanced)

### Using Flashlight (React Native)

```bash
npx flashlight measure --bundleId com.yourapp --testCommand "maestro test flow.yaml"
```

### Using Maestro for E2E Performance

```yaml
# flow.yaml
appId: com.anchor.mobile
---
- launchApp
- tapOn: "Forge"
- waitForAnimationToEnd
- tapOn: "Ritual"
- waitForAnimationToEnd
- back
```

---

## Comparing Metrics

### Create Comparison Script

```typescript
// scripts/compare-devices.ts
const metrics = {
  iPhone8: {
    coldStart: 2847,
    warmStart: 892,
    avgFPS: 58,
  },
  GalaxyA52: {
    coldStart: 2156,
    warmStart: 743,
    avgFPS: 60,
  },
};

console.table(metrics);

// Calculate difference
const diff = {
  coldStartDiff: ((metrics.iPhone8.coldStart - metrics.GalaxyA52.coldStart) / metrics.GalaxyA52.coldStart * 100).toFixed(1),
  warmStartDiff: ((metrics.iPhone8.warmStart - metrics.GalaxyA52.warmStart) / metrics.GalaxyA52.warmStart * 100).toFixed(1),
};

console.log(`iPhone 8 is ${diff.coldStartDiff}% slower on cold start`);
```

---

## Performance Targets

Reference these while profiling:

- **Cold Start**: < 3000ms (target), < 2000ms (ideal)
- **Warm Start**: < 1000ms (target), < 500ms (ideal)
- **Screen Navigation**: < 300ms
- **Animation Frame Rate**: 60 fps (target), 55 fps (minimum acceptable)
- **Memory Usage**: < 200 MB average
- **JS Thread**: Should be < 70% during normal operation

---

## Troubleshooting

### FPS Drops
- Check for unnecessary re-renders (use React DevTools)
- Verify animations use `useNativeDriver: true`
- Profile with Xcode Instruments to find CPU bottlenecks

### High Memory Usage
- Check for memory leaks (listeners not cleaned up)
- Verify images are properly cached
- Use Allocations instrument to find allocations

### Slow Navigation
- Check if screens are loading data synchronously
- Verify API calls are optimized
- Consider lazy loading heavy components

---

## Tools Summary

| Tool | Platform | Purpose | Location |
|------|----------|---------|----------|
| Xcode Instruments | iOS | CPU, Memory, FPS | Xcode → Open Developer Tool → Instruments |
| Android Studio Profiler | Android | CPU, Memory, Network | Android Studio → View → Tool Windows → Profiler |
| Flipper | Both | Network, Layout, Logs | `npx flipper` or Flipper app |
| React Native Perf Monitor | Both | FPS overlay | Dev Menu → Show Perf Monitor |
| Metro Bundler | Both | Bundle analysis | Terminal output during build |

---

## Next Steps

1. [ ] Connect iPhone 8 and run Xcode instruments
2. [ ] Connect Galaxy A52 and run Android Studio profiler
3. [ ] Fill in PERFORMANCE_BASELINE.md with real data
4. [ ] Identify bottlenecks from profiling
5. [ ] Create optimization tickets based on findings
6. [ ] Re-run profiling after optimizations to measure improvement

---

## Example Session Log

```
[2026-02-01 14:30] Started profiling session
[14:31] iPhone 8 connected, Xcode Instruments opened
[14:32] Time Profiler recording started
[14:35] Navigation flow completed (Home→Forge→Ritual→Settings)
[14:36] Recording stopped. Analyzing...
[14:40] Findings:
  - Cold start: 2847ms (needs optimization)
  - Home screen load: 456ms (acceptable)
  - Ritual animation: 58fps (minor drops)
  - Peak memory: 187MB (good)
[14:42] Updated PERFORMANCE_BASELINE.md
[14:43] Session complete
```

Save this log format for reference and comparison in future profiling sessions.
