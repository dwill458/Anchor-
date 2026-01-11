# Anchor v2 - Clean Expo Build

A fresh Expo-based build of the Anchor app using only Expo-compatible modules.

## Quick Start

```bash
# Install dependencies
npm install

# Start Expo
npm start

# Or start directly on Android
npm run android
```

## What's Different from v1

- **Clean Expo managed workflow** - No ejected native code
- **expo-av** for audio instead of react-native-sound
- **expo-haptics** for haptic feedback
- **expo-linear-gradient** for gradients
- **No Firebase** - Uses simple auth store (add your auth later)

## Project Structure

```
anchor-v2/
├── App.tsx              # Root component with navigation
├── src/
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── navigation/      # Navigation structure
│   ├── screens/         # All app screens
│   ├── services/        # API and external services
│   ├── stores/          # Zustand state stores
│   ├── theme/           # Colors, typography, spacing
│   ├── types/           # TypeScript types
│   └── utils/           # Utility functions
└── assets/              # Images, fonts, etc.
```

## Running on Device

1. Install Expo Go from Play Store or App Store
2. Run `npm start`
3. Scan QR code with Expo Go app

## Building APK (if needed later)

```bash
# Generate native folders
npx expo prebuild

# Build debug APK
cd android && ./gradlew assembleDebug
```

## Notes

- Uses Expo SDK 52
- React Native 0.76.5
- TypeScript enabled
- Zustand for state management
