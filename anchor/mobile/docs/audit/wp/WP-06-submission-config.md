# WP-06 — iOS / Android submission config

**Severity:** 🟠 HIGH ×2 + 🟡 MEDIUM ·  **Repo:** `anchor/mobile/`

## Objective
Clear store-submission blockers: Apple Sign-In capability, iOS Privacy Manifest, Android BILLING, expo-media-library plugin, and the cold-start notification-permission prompt.

## Files (touch only these)
- `app.json`
- `eas.json`
- `android/app/src/main/AndroidManifest.xml`
- `App.tsx` (notification permission timing only — lines ~483-520)

## Change 1 — `ios.usesAppleSignIn` (HIGH)
- Sign in with Apple ships (`AuthService.native.ts`, `LoginScreen.tsx`) and Google SSO is offered, so Apple requires the capability.
- Add `"usesAppleSignIn": true` to the `ios` block in `app.json`. After an EAS build, confirm `com.apple.developer.applesignin` is in the generated entitlements and the App ID has the capability.

## Change 2 — iOS Privacy Manifest (HIGH)
- No `PrivacyInfo.xcprivacy` exists. Add `ios.privacyManifests` to `app.json` declaring:
  - `NSPrivacyAccessedAPITypes`: UserDefaults (`CA92.1` — AsyncStorage/SecureStore), File timestamp (`C617.1` — view-shot/media-library).
  - `NSPrivacyCollectedDataTypes`: crash data (Sentry), purchases (RevenueCat), user id/email (Firebase).
- Verify the built `.ipa` contains `PrivacyInfo.xcprivacy`.

## Change 3 — Android BILLING (MEDIUM)
- RevenueCat merges `com.android.vending.BILLING` via autolinking, but it isn't explicit. Either add it to `AndroidManifest.xml`, or after an EAS build verify with `aapt dump permissions <aab>`. Do NOT add it to `app.json` `blockedPermissions`.

## Change 4 — expo-media-library plugin (LOW)
- Add `expo-media-library` to the `plugins` array in `app.json` (e.g. `["expo-media-library", { "savePhotosPermission": "Allow Anchor to save your anchor artwork." }]`) so permissions/usage strings are plugin-managed.

## Change 5 — Notification permission timing (MEDIUM)
- `App.tsx` (~483-520) runs `syncRegistration()` → `requestPermissions()` whenever `user?.id` resolves, prompting iOS at cold start.
- Gate it: call `Notifications.getPermissionsAsync()` first and only proceed to `getRemotePushRegistration()`/request when already granted; let the Settings master toggle (user action) perform the first request. Preserve `getRemotePushRegistration`/`requestPermissions` names.

## Constraints
- Don't remove existing `app.json` permissions/plugins. Keep `ITSAppUsesNonExemptEncryption: false`.
- `eas.json` already injects RevenueCat keys for store profiles — keep that; optionally migrate secrets to EAS Secrets (note only).

## Acceptance criteria
- `app.json` has `ios.usesAppleSignIn`, `ios.privacyManifests`, and the expo-media-library plugin.
- Cold start no longer triggers the iOS notification prompt for a returning user without prior grant.
- `npx tsc --noEmit` passes (App.tsx change compiles); app.json/eas.json are valid JSON.
