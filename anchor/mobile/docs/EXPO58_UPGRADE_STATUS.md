# Expo SDK 58 upgrade worktree

## Baseline and provenance

- Upgrade branch: `feat/expo58-upgrade`.
- Integrated source revision: `381b30cad1d5bd8278cf8e16850abc206a675281` (`feat: establish SQLCipher Anchor 2.0 development baseline`), based directly on product revision `b4f6023280960e104df55cea348d9049131cd57b`.
- The upgrade branch starts from the clean integrated SQLCipher commit. The original `codex/sqlcipher-migration` worktree at `13beacd61d35bffefaa3c5c5ece4416abb3200f9` remains untouched with its original dirty and untracked files; its manifest is in `EXPO58_SOURCE_MANIFEST_2026-10-16.txt`.
- The active product worktree remains on `feat/celebration-layer` at `b4f6023`; its pre-existing documentation and diagnostic changes are preserved.

## Owner-tested SQLCipher APK identity

- EAS build: `0eccae08-406a-40ee-ae04-afbee41e303a`, status `FINISHED`, profile/channel `sqlcipher-production-qa`.
- Artifact: `E:\apd\record\sqlcipher-owner-tested-20261016\anchor-sqlcipher-owner-tested.apk`.
- SHA-256: `7B6F2D783A1697773E13CDF08DEA73726E1FB9D241A8C9D430A7FBBE91957F47`.
- Package: `com.anchorintentions.sqlcipherpreview20261015`; app version `2.0.0` / build `41`; runtime `2.0-sqlcipher-v2-realdata-qa`.
- It is the production-backend-connected QA app, separate from `com.anchorintentions.app` and the earlier isolated SQLCipher lab/Preview builds. User-reported S24 acceptance is retained as the owner’s evidence; this task does not reinstall or modify that installation.
- EAS fingerprint in build record: `f41d6ed832f0e9f6d70847a95b50a060c4974b24`. The record has no `sourceRevision`. Local Android fingerprint of the current integrated SQLCipher source with `ANCHOR_SQLCIPHER_PRODUCTION_QA=1` is `3eda2ce92f13686e424a1ccd89a815b502770866`, which does not match. The exact build-input tree is therefore not reproducible from retained metadata. The integrated commit is the safe current migration base, but is not claimed as a byte-for-byte source match for that APK.

## Baseline configuration

- Expo `54.0.34`; React Native `0.81.5`; React `19.1.0`; `expo-sqlite` `16.0.10`.
- SQLCipher is enabled through the Expo SQLite config plugin (`useSQLCipher: true`) in isolated SQLCipher profiles. The runtime retrieves its database key from SecureStore, applies the key before database/schema access, verifies `cipher_version`, validates the database, and fails closed on missing keys or unavailable cipher support. Durable owner-scoped records and writes use the encrypted record database and exclusive transactions.
- Public app identity remains `com.anchorintentions.app`, runtime `2.0`; the product production and OTA profiles remain unchanged on this branch. The owner-tested QA identity and runtime are listed above.
- Toolchain at baseline: Node `v24.15.0` (meets the SDK 58 minimum).

## Baseline verification on the integrated SQLCipher source

- Focused SQLCipher and backup tests: **10 suites / 84 tests passed**.
- TypeScript (`tsc --noEmit --pretty false`): **failed on three existing Android widget prop errors** in `src/widgets/android/AnchorLargeWidget.tsx` and `AnchorSmallWidget.tsx` (`resizeMode` on `ImageWidgetProps`; `scaleToFill` on `SvgWidgetProps`). No Expo 58 changes were present in this baseline run.
- Native Android build and emulator acceptance have not yet been run for the Expo 58 branch.

## SDK checkpoints

The requested migration path is SDK 54 → 55 → 56 → 57 → 58. The official Expo upgrade skill currently advises skipping SDK 56 for projects at SDK 55 or earlier because of a Hermes V1 + Worklets/Reanimated memory regression; the requested SDK 56 step will be kept as a short-lived compatibility checkpoint, not a performance candidate. Use SDK 57.0.9 or later for the subsequent motion-stack checkpoint.

### SDK 55 checkpoint

- Expo `55.0.31`; React Native `0.83.10`; React `19.2.0`; `expo-sqlite` `55.0.20`; Reanimated `4.2.1`; Worklets `0.7.4`; Skia `2.4.18`; Gesture Handler `2.30.1`; Screens `4.23.0`.
- `npx expo install --fix`: completed; dependencies are aligned for SDK 55.
- `npx expo-doctor`: **18/20 checks passed**. The remaining checks are the manually managed native-project/config-sync warning and the local Expo module ignore warning. The latter identifies a nonexistent Android directory for the iOS-only `anchor-widget-bridge` module; its iOS sources are tracked. Neither issue is suppressed.
- Breaking config updates: removed `android.edgeToEdgeEnabled` and `newArchEnabled` app.json keys (edge-to-edge is mandatory on Android 16+, and the New Architecture is the default); added SDK-matched direct `expo-font` plus its config plugin to avoid duplicate native versions. The native Android `newArchEnabled=true` and edge-to-edge setting remain in the tracked native project.
- Rebased Android postinstall handling away from SDK 54 version-pinned patches. SDK 55 already scopes Expo Dev Launcher scanner dependencies to debug builds; the app postinstall script retains the portrait-lock removal and its required React Native Android status/navigation bar behavior without stale RN/Dev Launcher patch-package files. `npm run postinstall` passes on SDK 55.

## Expo SDK 56 checkpoint

- Upgrade path: SDK 55 → SDK 56; `expo install --fix` completed. Installed versions: Expo `56.0.23`, React Native `0.85.3`, React `19.2.3`, expo-sqlite `56.0.6`, Reanimated `4.3.1`, Worklets `0.8.3`, Skia `2.6.2`, Gesture Handler `2.31.2`, jest-expo `56.0.5`, TypeScript `6.0.3`.
- `expo config --json --full` succeeds. `expo-doctor` reports 19/22 checks passing. Remaining reports: local Expo module ignore warning for `anchor-widget-bridge`; the SDK 56 Hermes V1 memory regression (known, resolved by SDK 57.0.9+/RN 0.86.2+); and the manually managed native-project/config synchronization warning. No warning was suppressed. No SDK 56 native build or performance assessment is planned while the known Hermes regression is present.
- SDK 56 config migration: removed the deprecated top-level `splash` field; the existing `expo-splash-screen` plugin already preserves its image, width, resize mode, background, and dark-mode values. Custom config plugins now import through the supported `expo/config-plugins` export.
- The first SDK 56 postinstall attempt exhausted C: while Skia copied its iOS simulator framework; dependencies were reinstalled successfully after restoring disk space. The existing C: worktree remains the only active upgrade worktree. No source baseline or other worktree was changed.

## Expo SDK 57 checkpoint

- Upgrade path: SDK 56 → SDK 57; `expo install --fix` completed. Installed versions: Expo `57.0.30`, React Native `0.86.3`, React `19.2.3`, expo-sqlite `57.0.4`, Reanimated `4.5.1`, Worklets `0.10.1`, Skia `2.6.2`, Gesture Handler `2.32.0`, jest-expo `57.0.6`, and TypeScript `6.0.3`.
- `expo-doctor` reports 19/21 checks passing. Only the existing local Expo module ignore warning and manually managed native-project/config synchronization warning remain. The SDK 56 Hermes regression is no longer reported at SDK 57.0.30.
- SDK 57 dependency resolution initially rejected stale RN `0.85.3` with jest-expo `56.0.5`. RN `0.86.3`, jest-expo `57.0.6`, and `@react-native/jest-preset` `0.86.3` were aligned together from Expo’s SDK 57 expected versions; `expo install --fix` then reported all dependencies up to date. No force or legacy-peer-dependency install was used.
- No SDK 57 native build or product acceptance claim has been made yet.

## Expo SDK 58 working tree (implementation complete; owner testing not yet cleared)

- Installed target: Expo `58.0.14`, React Native `0.88.0`, React `19.3.0`, expo-sqlite `58.0.13`, expo-audio `58.0.9`, expo-file-system `58.0.9`, expo-secure-store `58.0.2`, Reanimated `4.7.1`, Worklets `0.13.0`, Skia `2.14.0`, Gesture Handler `3.3.0`, Screens `4.30.0`, jest-expo `58.0.11`, React Native Jest preset `0.88.0`, TypeScript `6.0.3`.
- `npx expo install --fix` completed and `npx expo install --check` passed. npm required `--legacy-peer-deps` because the date-time picker advertises an optional Windows peer on RN `0.84`; the selected Android/iOS SDK versions were not forced. `expo-doctor`: 18/20 checks pass; the remaining reports are the existing local Expo module ignore warning and manually managed native project/config sync warning.
- Node `24.15.0` is available. SDK 58 migration changes include replacing removed `InteractionManager` calls with a deferred two-frame/settle/idle helper, using public RN instance types and `absoluteFill`, updating Skia path builders, and removing removed StatusBar props. The scheduling helper preserves a delay across navigation transitions; actual transition acceptance remains pending.
- A dedicated QA config is gated by `ANCHOR_EXPO58_QA=1`: label `Anchor Expo 58 QA`, package `com.anchorintentions.expo58qa20261016`, runtime `2.0-expo58-sqlcipher-qa`, OTA disabled, SQLite plugin `useSQLCipher: true`; the `expo58-qa` profile uses mock auth and an invalid synthetic API host. QA app identity is separate from public and SQLCipher QA packages.
- Android compatibility updates include Gradle wrapper `9.4.1`, Android SDK/AGP configuration, Kotlin Android plugin, SDK 58 React host initialization, RN Gradle plugin Kotlin compatibility patch, and the SDK 58 Hermes compiler package. R8 full mode and resource shrinking remain enabled. Gradle heap was raised to 4 GiB after the first R8 attempt exhausted 2 GiB. Six narrow enum keep rules preserve SDK 58 Expo module enum values under R8.
- `npm run postinstall`: passed, applying the RN Gradle plugin, expo-sqlite, widget and Worklets patches. The expo-sqlite patch marks `SQLAction` as Expo Modules v2 `Enumerable` and is required to keep `postinstall` reproducible.
- `npx expo install --fix`, `npx expo install --check`: passed. `npx expo-doctor`: 18/20 checks; remaining notices are the existing local widget module ignore warning and manual native-project/config synchronization notice. No warning was suppressed. Node `24.15.0`.
- `npx tsc --noEmit --pretty false`: passed after SDK migration fixes. Focused SQLCipher/storage/store Jest run: 25/26 suites and 382/384 tests passed. The two failures are existing creation category expectation mismatches (`career` expected vs `desire` actual) in `creationStore.test.ts` and its downstream SVG expectation; no implementation change was made for those unrelated failures.
- Release APK built successfully with R8 enabled at `android/app/build/outputs/apk/release/app-release.apk` (240,570,533 bytes; SHA-256 `12F2E606A9FEAA13C06C04A0EDF69FCF9FDA52B15FDF080A288859227F5C8966`). QA package `com.anchorintentions.expo58qa20261016`, version `2.0.0`, target SDK 36, compile SDK 37. The local APK contains `libexpo-sqlite.so` and SQLCipher codec symbols; CMake was configured with `USE_SQLCIPHER=true` and `SQLITE_HAS_CODEC=1`. On emulator, `anchor-private-v1.db` had a random 16-byte header rather than the SQLite plaintext header, consistent with encrypted-at-rest content. `cipher_version` and an actual encrypted product record round-trip were not independently queried in this runtime pass.
- Release APK installed and launched on `emulator-5554` without a fatal exception. Debug development client used synthetic mock auth and an invalid API endpoint; the Welcome and seeded demo Home rendered. The seeded Home route exposed a Worklets capture warning, fixed in `V2HomeScreen` by capturing the individual shared values; subsequent logs no longer showed the “Cannot copy” warning. HMR reset that synthetic in-memory seed, and Home then showed an empty/loading state. This is not a successful force-stop persistence test.
- Runtime acceptance remains partial: no real backend credentials or owner data were used; Chart/Vision remote loads safely failed against the intentionally invalid synthetic endpoint. Focus, Deep Focus, Visualize, creation/release, PNG export, account switching, offline restore and notification settings were not completed end-to-end. No release-mode performance comparison was made. A Reanimated 4 warning about dependency arrays being ignored on native appeared once; the affected transition/screen flows need owner/emulator retest.
- Local Android build command from `anchor/mobile` (set the environment values in PowerShell first):

  ```powershell
  $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
  $env:ANCHOR_EXPO58_QA = '1'
  $env:EXPO_PUBLIC_ENABLE_MOCK_AUTH = 'true'
  $env:EXPO_PUBLIC_API_URL = 'https://expo58-synthetic.invalid'
  $env:EXPO_PUBLIC_USE_GOOGLE_AUTH = 'false'
  $env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
  .\gradlew.bat :app:assembleRelease --project-prop expo.sqlite.useSQLCipher=true --project-prop reactNativeArchitectures=x86_64 --max-workers=2 --no-daemon --console=plain
  ```

- The current local APK uses a temporary synthetic Firebase config and is for isolated emulator QA only. It is not the optional production-connected owner QA APK: use a separately registered Firebase QA app/config and the `expo58-qa` EAS profile only after configuring the authorized backend account. Do not install this local APK over the owner's production-connected SQLCipher app, publish OTA, merge, or promote based on the partial runtime evidence. No production app, installed storage or production delivery settings were changed.

## Expo 58 SQLCipher QA development client (2026-10-18)

- Commit: `fce746b3` on `feat/expo58-upgrade` (SDK 58 working tree committed; screenshots, `.cxx`, and secrets excluded).
- Identity: package `com.anchorintentions.sqlcipherpreview20261015`, label `Anchor 2.0 QA`, `versionCode` 42 (owner-tested build is 41), `runtimeVersion` `2.0-sqlcipher-v2-realdata-qa`, OTA disabled.
- Firebase: `android/app/google-services.json` and `google-services.json` are the SQLCipher QA registration (package `com.anchorintentions.sqlcipherpreview20261015`) copied from `E:\Projects\Anchor-SQLCipher`. Both are gitignored and not committed. The earlier synthetic `expo58qa` registration is replaced.
- Backend: `https://anchor-production-26bf.up.railway.app` (same endpoint as the owner-tested SQLCipher QA profile). Mock auth is off; Google sign-in is on.
- EAS profile `expo58-devclient-qa`: `developmentClient: true`, `:app:assembleDebug --project-prop expo.sqlite.useSQLCipher=true`, APK, `ANCHOR_SQLCIPHER_PRODUCTION_QA=1`, no channel (no OTA target).
- Signing reference (owner-tested APK `anchor-sqlcipher-owner-tested.apk`): APK Signature Scheme v2 certificate SHA-256 `77391d32b8cb37d052b4380ff4abba3f927050cd680bd657ed700a0b5e80d154`. The new APK must match this before in-place install.
- Local checks on `fce746b3`: `npx tsc --noEmit --pretty false` passed (exit 0). Focused Jest (13 suites, 124 tests): 122 passed; the 2 failures are the existing `creationStore.test.ts` category expectation mismatches.

- EAS dev-client build `474c9fda-4582-470d-928e-409553db9575` (profile `expo58-devclient-qa`, commit `f0011055`): FINISHED. Artifact APK SHA-256 `ddc59371045c3e172d54a85079413c75b0319634f2a26ffd3d8069eb94a83e40`, package `com.anchorintentions.sqlcipherpreview20261015`, versionCode 42, targetSdk 36. Contains the dev launcher and SQLCipher (`cipher_version` symbols in `libexpo-sqlite.so`). No synthetic API host or `expo58qa` identity present.
- **Signing mismatch, not installable in place yet:** the APK's v2 signer SHA-256 is `ea13887fc3d0236ca957dd54d2a385c1b5a7cc7086bdd99f28f52e48db9fbe32`; the owner-tested APK's is `77391d32b8cb37d052b4380ff4abba3f927050cd680bd657ed700a0b5e80d154`. Android will reject an in-place update. The EAS credential used for this profile must be matched to the owner's keystore on expo.dev before installing over the owner's app.
- Earlier failed EAS attempts on this branch: npm lockfile sync (`c8ebaf3b`), CMake pin 3.31.6 not on EAS image (`f25627ba`), Gradle daemon killed on medium worker (fixed by `large` resource class).
