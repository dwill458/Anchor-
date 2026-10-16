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
