# Performance Baseline

This document tracks performance metrics for the Anchor mobile app across different device tiers.

## Test Devices

### Low-End Device: iPhone 8
- **Chipset**: Apple A11 Bionic
- **RAM**: 2 GB
- **Year**: 2017
- **Screen**: 4.7" Retina (750 x 1334)

### Mid-Range Device: Samsung Galaxy A52
- **Chipset**: Snapdragon 720G
- **RAM**: 6 GB
- **Year**: 2021
- **Screen**: 6.5" Super AMOLED (1080 x 2400)

---

## Performance Metrics

### App Launch Performance

#### iPhone 8
- **Cold Start**: TBD ms
- **Warm Start**: TBD ms
- **Time to Interactive (TTI)**: TBD ms

#### Galaxy A52
- **Cold Start**: TBD ms
- **Warm Start**: TBD ms
- **Time to Interactive (TTI)**: TBD ms

---

### Screen Navigation Performance

#### iPhone 8
| Screen | First Load | Subsequent Loads | Notes |
|--------|------------|------------------|-------|
| Home/Vault | TBD ms | TBD ms | - |
| Forge (Create) | TBD ms | TBD ms | - |
| Ritual | TBD ms | TBD ms | - |
| AI Generation | TBD ms | TBD ms | - |
| Settings | TBD ms | TBD ms | - |

#### Galaxy A52
| Screen | First Load | Subsequent Loads | Notes |
|--------|------------|------------------|-------|
| Home/Vault | TBD ms | TBD ms | - |
| Forge (Create) | TBD ms | TBD ms | - |
| Ritual | TBD ms | TBD ms | - |
| AI Generation | TBD ms | TBD ms | - |
| Settings | TBD ms | TBD ms | - |

---

### Animation Performance

#### iPhone 8
| Animation | Frame Rate | Dropped Frames | Notes |
|-----------|------------|----------------|-------|
| Breath Animation (Logo) | TBD fps | TBD% | - |
| Tab Navigator | TBD fps | TBD% | - |
| Screen Transitions | TBD fps | TBD% | - |
| Ritual Animations | TBD fps | TBD% | - |

#### Galaxy A52
| Animation | Frame Rate | Dropped Frames | Notes |
|-----------|------------|----------------|-------|
| Breath Animation (Logo) | TBD fps | TBD% | - |
| Tab Navigator | TBD fps | TBD% | - |
| Screen Transitions | TBD fps | TBD% | - |
| Ritual Animations | TBD fps | TBD% | - |

---

### Memory Usage

#### iPhone 8
- **Idle State**: TBD MB
- **During Navigation**: TBD MB
- **Peak Usage**: TBD MB
- **Average Usage**: TBD MB

#### Galaxy A52
- **Idle State**: TBD MB
- **During Navigation**: TBD MB
- **Peak Usage**: TBD MB
- **Average Usage**: TBD MB

---

### Bundle Size

- **Total Bundle Size**: TBD MB
- **JavaScript Bundle**: TBD MB
- **Assets Size**: TBD MB
- **Native Code Size**: TBD MB

#### Asset Breakdown
| Asset Type | Size | Count | Notes |
|------------|------|-------|-------|
| Images | TBD MB | TBD | - |
| Fonts | TBD MB | TBD | - |
| Audio | TBD MB | TBD | - |
| Other | TBD MB | TBD | - |

---

### Network Performance

#### Image Loading
| Device | Average Load Time | Cache Hit Rate | Notes |
|--------|------------------|----------------|-------|
| iPhone 8 | TBD ms | TBD% | - |
| Galaxy A52 | TBD ms | TBD% | - |

#### API Requests
| Endpoint | iPhone 8 | Galaxy A52 | Notes |
|----------|----------|------------|-------|
| /api/anchors | TBD ms | TBD ms | - |
| /api/ai/enhance | TBD ms | TBD ms | - |
| /api/user/profile | TBD ms | TBD ms | - |

---

## Performance Targets

### Critical Thresholds
- **App Launch (Cold)**: < 3000ms
- **App Launch (Warm)**: < 1000ms
- **Screen Transitions**: < 300ms
- **Animation Frame Rate**: 60 fps (target), 55 fps (minimum)
- **Memory Usage**: < 200 MB (average)
- **Time to Interactive**: < 2000ms

### Optimization Priorities
1. **High Priority**
   - [ ] Reduce cold start time
   - [ ] Optimize animation performance
   - [ ] Implement image caching (react-native-fast-image)
   
2. **Medium Priority**
   - [ ] Bundle size reduction
   - [ ] Memory optimization
   - [ ] Network request optimization

3. **Low Priority**
   - [ ] Further asset optimization
   - [ ] Code splitting exploration

---

## Testing Methodology

### Tools
- **React Native Performance Monitor**: Built-in FPS monitor
- **Flipper**: Network and memory profiling
- **Xcode Instruments**: iOS profiling
- **Android Studio Profiler**: Android profiling
- **Metro Bundle Analyzer**: Bundle size analysis

### Profiling Commands

```bash
# Enable performance monitoring in app
# Shake device (physical) or Cmd+D (iOS simulator) / Cmd+M (Android)
# Select "Show Performance Monitor"

# Android profiling
adb shell dumpsys meminfo [package-name]
adb shell dumpsys gfxinfo [package-name]

# Bundle analysis
npx react-native-bundle-visualizer

# Memory profiling
# Use Flipper's Memory inspector during runtime
```

### Testing Scenarios
1. **Cold Start**: Kill app, clear from background, launch
2. **Warm Start**: Send to background, wait 30s, resume
3. **Navigation Flow**: Home → Forge → Ritual → back to Home
4. **Heavy Load**: Load screen with 20+ anchors
5. **Memory Stress**: Navigate through all screens 5 times
6. **Animation Stress**: Trigger all animations in sequence

---

## Changelog

### 2026-02-01
- Created baseline document structure
- Installed react-native-fast-image for image optimization
- Created OptimizedImage component
- Added performance monitoring methodology

---

## Notes

- All tests should be run on physical devices, not emulators
- Network tests should be on stable WiFi (not cellular)
- Devices should be at ~50% battery and normal temperature
- Close all other apps before testing
- Use release builds for accurate performance metrics
- Record multiple runs and use median values
