# Anchor Mobile

Expo development build for Anchor's current mobile client.

This app is the active React Native front end for Anchor. It is built with Expo, TypeScript, Zustand, React Navigation, Firebase Auth, and native modules for audio, haptics, sharing, notifications, and secure storage. The codebase is in active testing and release hardening ahead of the June 1, 2026 target release.

## What This App Covers

- Onboarding and authentication
- Sanctuary / vault browsing
- Intention entry and sigil creation
- Letter distillation and structure forging
- Optional manual reinforcement
- Structure lock and optional AI enhancement
- Mantra generation and audio playback
- Charging, activation, and burning rituals
- Practice flow, profile, settings, trial, and paywall screens

## Quick Start

This app expects an Expo development build. Use `Expo Go` only if the current feature set you need is supported in that client.

```bash
cd anchor/mobile
npm install
npx expo start --dev-client
```

If you are testing on a physical Android device, make sure Metro is reachable from the device. On USB-connected setups, run:

```bash
adb reverse tcp:8081 tcp:8081
```

On macOS, you can also run a native simulator build when needed:

```bash
npm run ios
```

On Windows or when the local native build path is problematic, use the startup guide in the repo root for the development-client workflow.

## Environment

### API URL

Set `EXPO_PUBLIC_API_URL` in `anchor/mobile/.env` to point at the backend API when you are not using a local default.

### Firebase config

This app uses `@react-native-firebase/app` and `@react-native-firebase/auth`, so Firebase config must be handled as environment-specific secret material.

### Sentry build secrets

Preview and production EAS builds are expected to upload Sentry source maps. Configure `SENTRY_AUTH_TOKEN` as an EAS secret, and provide `SENTRY_ORG` / `SENTRY_PROJECT` the same way unless you hardcode them in `sentry.properties`.

### Canonical config file

- Runtime config: `anchor/mobile/google-services.json`
- Template: `anchor/mobile/google-services.json.example`
- Generated native copy that should not be committed: `anchor/mobile/android/app/google-services.json`

### Local setup

1. Copy the template:

```bash
cp anchor/mobile/google-services.json.example anchor/mobile/google-services.json
```

2. Replace placeholders with the Firebase Android app config from Firebase Console.
3. Do not commit the generated config file.

### CI / build pipeline

GitHub Actions can write `anchor/mobile/google-services.json` from the `FIREBASE_ANDROID_GOOGLE_SERVICES_JSON_B64` secret.
Before EAS build submission, run `npm run validate:firebase-config -- --profile preview` (or the target profile) to confirm the Android package, Firebase project, and Google OAuth client IDs still point at the same auth identity.

## Project Structure

```text
anchor/mobile/
├── src/
│   ├── screens/     # Auth, create, rituals, vault, practice, profile, settings, shop
│   ├── components/  # Shared UI, cards, modals, transitions, icons
│   ├── services/    # API, auth, sync, storage, analytics, notifications, TTS
│   ├── stores/      # Zustand state
│   ├── hooks/       # Reusable React hooks
│   ├── utils/       # Sigil logic, helpers, logging, telemetry utilities
│   └── __tests__/   # Test suites
├── TESTING.md       # Mobile testing guide
├── MONITORING.md    # Analytics and observability guide
└── app.json         # Expo config and native permissions
```

## Development

### Test

```bash
npm test
```

### Watch mode

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

## Platform Notes

- Expo SDK 54
- React Native 0.81.5
- TypeScript strict mode
- `expo-dev-client` is enabled
- Native Android and iOS projects are checked in
- The app uses Firebase Auth, Sentry, RevenueCat, notifications, sharing, and secure storage

## Related Docs

- [Root README](../../README.md)
- [Startup Guide](../../docs/runbooks/STARTUP_GUIDE.md)
- [Testing Guide](./TESTING.md)
- [Monitoring Guide](./MONITORING.md)
