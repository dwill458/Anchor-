# E2E Testing Guide: Premium Charge Flow

End-to-end testing for the redesigned ChargeSetupScreen experience with Detox.

## Test Coverage

### Test Suites

1. **chargeFlow.firstTime.e2e.ts** (14 scenarios)
   - First-time user mode selection (Focus/Ritual)
   - Duration selection (preset and custom)
   - Breathing animation auto-advance
   - Ritual execution with correct config
   - Preference auto-save
   - Back button navigation
   - Skip prevention (mandatory breathing)
   - Complete flow verification

2. **chargeFlow.returningUser.e2e.ts** (12 scenarios)
   - Default Charge Display rendering
   - Continue button (frictionless path)
   - Change button (preference editing)
   - New defaults auto-save on completion
   - Back button through multi-step flows
   - Modal picker for custom durations
   - Duration formatting verification
   - Complete quick-path and custom-path flows

### Scenarios Covered

| Scenario | First-Time | Returning | Notes |
|----------|-----------|-----------|-------|
| Mode selection | ✓ | ✓ (via Change) | Two large cards (Focus/Ritual) |
| Duration selection | ✓ | ✓ (via Change) | Mode-specific options |
| Custom duration picker | ✓ | ✓ | Modal 1-30 minute selector |
| Breathing animation | ✓ | ✓ | 3 seconds mandatory |
| Ritual execution | ✓ | ✓ | Correct config loaded |
| Default save | ✓ | ✓ (if different) | Auto-save on completion |
| Back navigation | ✓ | ✓ | Step-aware handling |
| Skip prevention | ✓ | - | Can't skip breathing |
| Haptic feedback | ✓ | ✓ | Light, medium, success |

## Setup Instructions

### Prerequisites

```bash
# Install Detox CLI globally
npm install -g detox-cli

# Install Detox dependencies in project
npm install --save-dev detox detox-cli detox-ios detox-android
```

### Build Configuration

Before running tests, build the app for testing:

**iOS Simulator:**
```bash
# Build framework cache (one-time)
detox build-framework-cache

# Build test app
detox build-app --configuration ios.sim.debug
```

**Android Emulator:**
```bash
# Ensure emulator is running
emulator -avd Pixel_4a_API_31

# Build test app
detox build-app --configuration android.emu.debug
```

### Project Configuration

The Detox configuration is defined in `e2e/config.e2e.js` and specifies:

- **iOS**: iPhone 15 simulator, builds against Release target
- **Android**: Pixel 4a emulator, builds Release APK

Xcode workspace path: `ios/Anchor.xcworkspace`
Gradle location: `android/gradlew`

## Running Tests

### Run All E2E Tests

```bash
# iOS Simulator
detox test --configuration ios.sim.debug

# Android Emulator
detox test --configuration android.emu.debug
```

### Run Specific Test Suite

```bash
# First-time user flow only
detox test chargeFlow.firstTime.e2e.ts --configuration ios.sim.debug

# Returning user flow only
detox test chargeFlow.returningUser.e2e.ts --configuration ios.sim.debug
```

### Run with Verbose Logging

```bash
detox test --configuration ios.sim.debug --verbose
```

### Run with Record/Playback

```bash
# Record all interactions (for debugging)
detox test --configuration ios.sim.debug --record-logs all

# Replay with artifacts
detox test --configuration ios.sim.debug --artifacts-location ./artifacts
```

## Test Data & Fixtures

### First-Time User Setup

Tests assume:
- App launched fresh (no anchors created)
- Settings store empty (no defaults saved)
- Should automatically detect via `anchorCount === 0`

If needed, reset test data:
```bash
# Clear app state between test runs
detox test --configuration ios.sim.debug --cleanup
```

### Returning User Setup

Tests require:
- Existing anchor in database
- Saved default preferences (e.g., Focus mode, 2 min)
- Should be loaded from settingsStore via authStore

For manual setup:
1. Run first-time user flow
2. Complete ritual to auto-save defaults
3. Clear and reinstall app (or mock settingsStore)
4. Tests will use stored defaults

## Key Test Patterns

### Element Queries

```typescript
// Find by text
element(by.text('Continue'))

// Find by type and index
element(by.type('TouchableOpacity')).atIndex(0)

// Find with text match
element(by.matching(/\d+\s?min/))

// Parent/child relationships
element(by.text('2 minutes')).parent()
```

### Waits & Timing

```typescript
// Wait for element to appear (with timeout)
await waitFor(element(by.text('Breathe in...')))
  .toBeVisible()
  .withTimeout(2000); // 2 second timeout

// Wait for state change
await waitFor(element(by.text('STEP 2 OF 2')))
  .toBeVisible()
  .withTimeout(2000);
```

### User Actions

```typescript
// Tap element
await element(by.text('Continue')).tap();

// Multi-tap (for rapid selection)
await element(by.text('Focus Charge')).multiTap();

// Scroll
await element(by.id('scrollView')).scroll(200, 'down');

// Press device back button
await device.pressBack();

// Type text (if applicable)
await element(by.id('input')).typeText('text');
```

### Assertions

```typescript
// Element visible
await expect(element(by.text('Text'))).toBeVisible();

// Element not visible
await expect(element(by.text('Text'))).not.toBeVisible();

// Element enabled
await expect(element(by.text('Continue'))).toBeEnabled();

// Element disabled
await expect(element(by.text('Continue'))).toBeDisabled();

// Toggle state
await expect(element(by.text('Selected'))).toHaveToggleValue(true);
```

## Common Issues & Troubleshooting

### Build Failures

**Issue**: `xcodebuild: command not found`
- **Solution**: Ensure Xcode command line tools installed: `xcode-select --install`

**Issue**: Gradle build fails on Android
- **Solution**: Ensure Android SDK installed and `ANDROID_HOME` environment variable set

### Timeout Errors

**Issue**: "waitFor timed out"
- **Cause**: Element not appearing or slower app initialization
- **Solution**: Increase timeout value or check app logs for errors

```typescript
await waitFor(element(by.text('Element')))
  .toBeVisible()
  .withTimeout(5000); // Increase from 2000ms to 5000ms
```

### Emulator/Simulator Issues

**Issue**: "Emulator not running"
- **Solution**: Start emulator before running tests:
  ```bash
  emulator -avd Pixel_4a_API_31
  ```

**Issue**: "Simulator hung"
- **Solution**: Kill and relaunch:
  ```bash
  xcrun simctl erase all
  xcrun simctl create "iPhone 15" com.apple.CoreSimulator.SimDeviceType.iPhone-15 com.apple.CoreSimulator.SimRuntime.iOS-18-2
  ```

### Test State Issues

**Issue**: "Tests pass individually but fail when run together"
- **Cause**: State pollution between tests
- **Solution**: Each test suite calls `device.launchApp()` or `device.reloadReactNative()` to reset state

### Flaky Tests

**Issue**: Tests intermittently fail
- **Common causes**:
  - Timing issues with animations
  - Race conditions in state updates
  - Slow device/simulator
- **Solutions**:
  - Increase `withTimeout()` values
  - Add intermediate waits for state changes
  - Check for animation completion before continuing

## Continuous Integration Setup

### GitHub Actions Example

```yaml
name: E2E Tests

on: [pull_request, push]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install

      - run: detox build-framework-cache

      - run: detox build-app --configuration ios.sim.debug

      - run: detox test --configuration ios.sim.debug --cleanup
```

## Performance Metrics

### Expected Timings

| Action | Duration | Notes |
|--------|----------|-------|
| Mode selection render | < 300ms | Fade-in animation |
| Duration selection render | < 300ms | Step transition |
| Breathing animation | 3000ms | Mandatory, no skip |
| Auto-advance to Ritual | < 500ms | After breathing |
| Total first-time flow | 10-12s | Mode → Duration → Breathing → Ritual |
| Total returning user flow | 8-10s | Default → Breathing → Ritual |

### Profiling

Enable React DevTools Profiler during E2E tests:

```typescript
// In test
await device.disableSynchronization();
// Run performance-sensitive test
await device.enableSynchronization();
```

## Future Enhancements

### Planned Test Coverage

- [ ] Network error scenarios (API failures)
- [ ] Offline mode behavior
- [ ] Accessibility testing (VoiceOver/TalkBack)
- [ ] Low-end device performance
- [ ] Permission denial scenarios
- [ ] App backgrounding/foregrounding
- [ ] Deep link navigation to charge screen
- [ ] Analytics event tracking

### Test Data Factories

Create fixtures for common scenarios:

```typescript
// utils/testFixtures.ts
export const createTestAnchor = (overrides?) => ({
  id: 'test-anchor-1',
  title: 'Test Anchor',
  ...overrides,
});

export const createTestDefaults = () => ({
  defaultChargeMode: 'focus',
  defaultChargeDuration: 120,
});
```

### Custom Commands

Add helper methods for repeated patterns:

```typescript
// helpers/chargeFlow.ts
export async function completeFirstTimeFlow(mode: string, duration: string) {
  await selectMode(mode);
  await selectDuration(duration);
  await confirmContinue();
  await waitForBreathing();
  await waitForRitual();
}
```

## Maintenance

### Updating Tests

When UI changes (e.g., text updates):
1. Update corresponding `by.text()` matchers
2. Test locally with `detox test --configuration ios.sim.debug`
3. Verify all scenarios pass
4. Commit with clear message: "test(e2e): update charge flow matchers"

### Version Compatibility

- **Detox**: >= 20.0 (GPU acceleration support)
- **React Native**: >= 0.71 (async improvements)
- **Node**: >= 18.0

Update with:
```bash
npm install detox@latest detox-cli@latest
```

## Running Tests Locally (Quick Start)

```bash
# 1. Install dependencies
npm install

# 2. Build for testing
detox build-app --configuration ios.sim.debug

# 3. Run tests
detox test --configuration ios.sim.debug --cleanup

# 4. View results
# Green checkmarks = passing tests
# Red X = failing tests
# Check ./artifacts folder for logs/screenshots
```

## Support & Debugging

For test failures, check:

1. **App logs**: `detox test --verbose`
2. **Simulator logs**: `xcrun simctl spawn booted log stream`
3. **Artifacts**: Look in `./artifacts` folder for screenshots/videos
4. **Element inspection**: Use `element(by.text()).tap()` with logging

Example debug run:
```bash
detox test --configuration ios.sim.debug --verbose --record-logs all
```

Then inspect `./artifacts/` for detailed logs and recordings.
