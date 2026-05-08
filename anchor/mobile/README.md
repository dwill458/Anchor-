<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
# Anchor v2 - Expo Development Build

This app uses an Expo development build (`expo-dev-client`) with native Android/iOS projects checked in.
=======
# Anchor Mobile

React Native + Expo app for Anchor.
>>>>>>> theirs
=======
# Anchor Mobile

React Native + Expo app for Anchor.
>>>>>>> theirs
=======
# Anchor Mobile

React Native + Expo app for Anchor.
>>>>>>> theirs

## Quick Start

```bash
cd anchor/mobile
npm install
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

# Start Metro for the dev client
npx expo start --dev-client --clear

# Build and install the Android development client
npm run android
```

If you are using a USB-connected Android device or emulator, run:

```bash
adb reverse tcp:8081 tcp:8081
```

If you are using a physical device over Wi-Fi, keep the phone on the same network as your computer. If LAN discovery is unreliable, start Metro with:

```bash
npx expo start --dev-client --host tunnel --clear
```

## What's Different from v1
=======
npm start
```

## Firebase and Secret Handling (Required)
>>>>>>> theirs
=======
npm start
```

## Firebase and Secret Handling (Required)
>>>>>>> theirs

This app uses `@react-native-firebase/app` / `auth`, so Firebase config must be handled as **environment-specific secret material**.

### Canonical config location

- Runtime/build config path used by Expo: `anchor/mobile/google-services.json` (via `android.googleServicesFile` in `app.json`).
- `anchor/mobile/android/app/google-services.json` should **not** be committed. It is a generated/native copy and creates duplicate drift risk.

### What is committed vs not committed

- ✅ Committed: `anchor/mobile/google-services.json.example` (template only, no real keys).
- ❌ Not committed: `anchor/mobile/google-services.json`.
- ❌ Not committed: `anchor/mobile/android/app/google-services.json`.

### Local development

1. Copy template:
   ```bash
   cp anchor/mobile/google-services.json.example anchor/mobile/google-services.json
   ```
2. Replace placeholder values with your Firebase Android app config from Firebase Console.
3. Do **not** commit the generated file.

### CI / Build pipeline expectations

GitHub Actions writes `anchor/mobile/google-services.json` at build time from secret `FIREBASE_ANDROID_GOOGLE_SERVICES_JSON_B64`.

- Store this secret as a **base64-encoded full JSON file** in GitHub Actions secrets/environments.
- Decode happens only for Android/all platform builds, immediately before `eas build`.

Generate secret payload:

```bash
base64 -w 0 anchor/mobile/google-services.json
```
<<<<<<< ours

=======
npm start
```

## Firebase and Secret Handling (Required)

This app uses `@react-native-firebase/app` / `auth`, so Firebase config must be handled as **environment-specific secret material**.

### Canonical config location

- Runtime/build config path used by Expo: `anchor/mobile/google-services.json` (via `android.googleServicesFile` in `app.json`).
- `anchor/mobile/android/app/google-services.json` should **not** be committed. It is a generated/native copy and creates duplicate drift risk.

### What is committed vs not committed

- ✅ Committed: `anchor/mobile/google-services.json.example` (template only, no real keys).
- ❌ Not committed: `anchor/mobile/google-services.json`.
- ❌ Not committed: `anchor/mobile/android/app/google-services.json`.

### Local development

1. Copy template:
   ```bash
   cp anchor/mobile/google-services.json.example anchor/mobile/google-services.json
   ```
2. Replace placeholder values with your Firebase Android app config from Firebase Console.
3. Do **not** commit the generated file.

### CI / Build pipeline expectations

GitHub Actions writes `anchor/mobile/google-services.json` at build time from secret `FIREBASE_ANDROID_GOOGLE_SERVICES_JSON_B64`.

- Store this secret as a **base64-encoded full JSON file** in GitHub Actions secrets/environments.
- Decode happens only for Android/all platform builds, immediately before `eas build`.

Generate secret payload:

```bash
base64 -w 0 anchor/mobile/google-services.json
```

>>>>>>> theirs
=======

>>>>>>> theirs
(macOS: `base64 anchor/mobile/google-services.json | tr -d '\n'`)

## Security hardening requirements (Firebase backend)

Leaked mobile config should not grant data access. Enforce these controls in Firebase project `anchor-ac6d6`:

1. **Firestore/Storage rules: default deny** and explicit least-privilege allow paths only.
2. **Auth-required access** for all user data paths (`request.auth != null` + ownership checks).
3. **App Check enforcement ON** for Firestore, Storage, and callable Functions used by this app.
4. **No wildcard public writes/reads** for production collections/buckets.
5. **Rules and App Check changes tested** in staging before production rollout.

### Verification checklist (run before release)
<<<<<<< ours
<<<<<<< ours

<<<<<<< ours
1. Install or rebuild the development client with `npm run android` or `npm run ios`
2. Start Metro with `npx expo start --dev-client --clear`
3. Launch the installed Anchor development build
4. If Android is connected by USB, run `adb reverse tcp:8081 tcp:8081`
=======
- Confirm App Check enforcement toggled to **Enforced** in Firebase Console for used products.
- Validate unauthenticated requests are denied.
- Validate cross-user reads/writes are denied.
- Validate expected authenticated user operations still succeed.
>>>>>>> theirs

## Credential rotation guidance (if repo was public)

Because Firebase API keys/project IDs were previously committed, rotate sensitive credentials and trust anchors:

1. Rotate any exposed API keys in Google Cloud Console.
2. Re-issue compromised service account keys (if any were ever committed).
3. Revisit OAuth client restrictions/package SHA constraints.
4. Audit Firebase Auth authorized domains and remove unknown entries.
5. Review recent access logs for suspicious use.

=======

- Confirm App Check enforcement toggled to **Enforced** in Firebase Console for used products.
- Validate unauthenticated requests are denied.
- Validate cross-user reads/writes are denied.
- Validate expected authenticated user operations still succeed.

## Credential rotation guidance (if repo was public)

Because Firebase API keys/project IDs were previously committed, rotate sensitive credentials and trust anchors:

1. Rotate any exposed API keys in Google Cloud Console.
2. Re-issue compromised service account keys (if any were ever committed).
3. Revisit OAuth client restrictions/package SHA constraints.
4. Audit Firebase Auth authorized domains and remove unknown entries.
5. Review recent access logs for suspicious use.

>>>>>>> theirs
=======

- Confirm App Check enforcement toggled to **Enforced** in Firebase Console for used products.
- Validate unauthenticated requests are denied.
- Validate cross-user reads/writes are denied.
- Validate expected authenticated user operations still succeed.

## Credential rotation guidance (if repo was public)

Because Firebase API keys/project IDs were previously committed, rotate sensitive credentials and trust anchors:

1. Rotate any exposed API keys in Google Cloud Console.
2. Re-issue compromised service account keys (if any were ever committed).
3. Revisit OAuth client restrictions/package SHA constraints.
4. Audit Firebase Auth authorized domains and remove unknown entries.
5. Review recent access logs for suspicious use.

>>>>>>> theirs
## Build notes

```bash
# Prebuild native projects when needed
npx expo prebuild

# Android debug build
cd android && ./gradlew assembleDebug
```
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

## Notes

- Uses Expo SDK 54
- React Native 0.81.5
- TypeScript enabled
- Zustand for state management
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
