# Apple review authentication repair — 2026-11-05

## Findings and changes

- Guideline 2.1(a): `AuthService.native.ts` passed the same raw nonce to Expo Apple authentication and Firebase. The installed Expo Swift module forwards that value unchanged to Apple. Firebase requires the token's nonce to be SHA-256 of its raw nonce. Generate 32 secure random bytes through the existing `expo-crypto` dependency, send the hexadecimal SHA-256 digest to Apple, and retain the original nonce for Firebase. Removed the `Math.random` fallback.
- Guideline 4: the rejected `V2SealedSaveScreen` used custom Apple SVG artwork. Replaced that control with `AppleAuthenticationButton`, preserving its action, height, black appearance, availability check, and loading interaction lock. The existing partial native-button fix in `V2AuthScreen` was preserved. Legacy login and signup already use the native button; no active screen still imports `AppleIcon`.
- Guideline 2.5.4: installed `expo-audio` defaults `enableBackgroundPlayback` to true. Explicitly disabled background playback and recording. Anchor's existing `AudioSession` already sets `shouldPlayInBackground: false`. Generated iOS configuration has no background modes and retains `com.apple.developer.applesignin: [Default]`.

## Android audit

- Android uses the same native Firebase service, but Google sign-in exchanges its Google ID token without an Apple nonce. The Apple nonce failure does not apply to that path.
- Apple-unavailable behavior preserves the Google and email choices, and does not invoke the Apple credential exchange.
- Production package matches both local Firebase JSON files. The configured Google web client ID matches Firebase's web OAuth client; two Android certificate registrations exist. This does not verify the certificate of a Play-delivered binary.
- Existing tests verify guest progress transfer when Google or Apple credentials already belong to another account. These remain passing.
- Tracked Android manifest contains no audio playback service or foreground-service permission. Audio background support is now also disabled in generated configuration for future prebuilds.

## Verification

- Reproduction test failed before the service fix with `Apple token nonce does not match SHA256 of raw nonce`; it passes after the fix and verifies distinct nonces across attempts.
- Five focused Jest suites: **58 passed**. Covers native auth, sealed save, V2 auth, legacy login, and audio session.
- `npx tsc --noEmit --pretty false`: passed.
- `npx expo export --platform ios`: passed; bundled the production iOS JavaScript and assets into a temporary directory. This is not a signed native build or device test.
- `node scripts/validate-firebase-config.js --profile production`: passed.
- iOS prebuild config plus `compileModsAsync` in introspection mode: background modes `[]`, Apple entitlement `[Default]`.
- `git diff --check`: passed.
- Full cross-platform `expo config --type introspect` hit an existing MainActivity lookup assertion against the fully qualified Android activity name. The iOS-only generated-config check above succeeds. No native files were regenerated or overwritten.

## Release acceptance still required

No Android device was connected; this Windows host cannot perform an iOS device authentication. Tests use provider-boundary doubles and do not establish live Firebase/Apple/Google authentication, native appearance, or store acceptance.

Build a new iOS binary for the native configuration change. Before resubmitting, test the submitted build on iPhone and iPad: first Apple authorization (including Hide My Email), returning account, cancel/retry, and saving the first Anchor through Home. Cover fresh install and update. On a Play-distributed Android build, verify Google and email sign-in, guest progress retention, cancel/retry, and relaunch. Do not describe this as device-verified until those checks pass.

Sources: [Firebase Apple nonce contract](https://firebase.google.com/docs/auth/ios/apple), [Expo native Apple button](https://docs.expo.dev/versions/v56.0.0/sdk/apple-authentication/), [Expo audio plugin options](https://docs.expo.dev/versions/latest/sdk/audio/). Installed Expo 58 module/plugin sources were inspected as well.
