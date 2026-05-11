/**
 * Detox E2E Testing Configuration
 *
 * Configures Detox for testing the Anchor mobile app.
 * This file defines test environments and build settings.
 *
 * Prerequisites:
 * - npm install detox-cli detox detox-ios detox-android --save-dev
 * - detox build-framework-cache
 * - detox build-app --configuration ios.sim.debug (for iOS)
 * - detox build-app --configuration android.emu.debug (for Android)
 */

module.exports = {
  testRunner: 'jest',
  apps: {
    ios: {
      type: 'ios.app',
      binaryPath:
        'ios/Build/Products/Release-iphonesimulator/Anchor.app',
      build:
        'xcodebuild -workspace ios/Anchor.xcworkspace -scheme Anchor -configuration Release -sdk iphonesimulator -derivedDataPath ios/Build',
    },
    android: {
      type: 'android.app',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build:
        'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release && cd ..',
    },
  },
  configurations: {
    'ios.sim.debug': {
      app: 'ios',
      device: {
        type: 'iOS Simulator',
        device: {
          type: 'iPhone 15',
        },
      },
    },
    'ios.sim.release': {
      app: 'ios',
      device: {
        type: 'iOS Simulator',
        device: {
          type: 'iPhone 15',
        },
      },
    },
    'android.emu.debug': {
      app: 'android',
      device: {
        type: 'android.emulator',
        device: {
          avdName: 'Pixel_4a_API_31',
        },
      },
    },
    'android.emu.release': {
      app: 'android',
      device: {
        type: 'android.emulator',
        device: {
          avdName: 'Pixel_4a_API_31',
        },
      },
    },
  },
  testRunner: 'jest',
};
