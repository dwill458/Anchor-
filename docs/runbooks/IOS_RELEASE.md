# iOS Release Runbook

## Source of Truth

The iOS release path is intentionally split across a small set of sources:

- Product config: `anchor/mobile/app.json`
- Generated native project: `npx expo prebuild --platform ios --no-install` from `anchor/mobile/eas.json`
- Runtime env: EAS environment variables / GitHub Actions `vars` and `secrets`
- Firebase secret files: `GoogleService-Info.plist` and `google-services.json`
- Release automation: `.github/workflows/eas-build.yml`

Do not commit live `.env`, Firebase config files, or builder logs.
Treat the generated Xcode project as disposable unless you intentionally decide to commit native iOS sources later.

## Required Release Config

Set these for preview and production builds:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`

Private build-time secrets:

- `SENTRY_AUTH_TOKEN`
- `FIREBASE_IOS_GOOGLE_SERVICE_INFO_PLIST_B64`
- `FIREBASE_ANDROID_GOOGLE_SERVICES_JSON_B64`
- `EXPO_TOKEN`
- `APPLE_APP_SPECIFIC_PASSWORD`

Recommended GitHub `vars`:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN`

## Versioning Rules

- `expo.version` is the customer-facing app version.
- `expo.runtimeVersion.policy = appVersion` keeps OTA compatibility aligned to that app version.
- iOS `buildNumber` is auto-incremented by the `production` EAS profile.
- Use the `preview` channel for TestFlight-style internal validation and `production` for App Store builds.

## Preflight

Before cutting a store build:

1. Verify `anchor/mobile/.env` is not required for CI or EAS cloud builds.
2. Run `anchor/mobile/scripts/validate-release-config.sh` with the intended release env loaded.
3. Confirm App Store Connect metadata is complete:
   support URL, privacy policy URL, age rating, screenshots, subscription text, and App Privacy answers.
4. Confirm iOS push notifications, Sign in with Apple, and in-app purchases are enabled for the app record.
5. Confirm merch remains disabled for v1 unless product scope changes.

## Release QA

Required checks on a release build:

- cold start and auth hydration
- Sign in with Apple
- Google Sign-In
- onboarding completion
- paywall, purchase, restore, and entitlement sync
- notification permission and production APNs registration
- anchor creation, ritual flow, export/share, and biometric unlock
- Sentry startup and handled/unhandled error capture
- OTA update behavior for the current runtime version

Recommended device coverage:

- one recent iPhone on the current iOS release
- one additional simulator size for layout regression coverage

## Build and Submit

1. Push to `main` for preview builds or create a `v*.*.*` tag for production.
2. Let `.github/workflows/eas-build.yml` materialize Firebase files, validate env, and trigger the EAS build.
3. Install the preview/TestFlight build and run the release QA list above.
4. For production tags, verify the auto-submit job completed and the build appeared in App Store Connect.
5. Complete the final App Store Connect smoke pass before submitting for review.

## Rollback

If a release is unhealthy:

- pause rollout or remove the build in App Store Connect if it has not gone live
- disable risky server-side flags first
- ship a new binary for entitlement, auth, or native SDK issues
- use Expo Updates only for JS-safe fixes that match the current runtime version
