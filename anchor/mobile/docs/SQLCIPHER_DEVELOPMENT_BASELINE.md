# Anchor 2.0 SQLCipher development builds

The `sqlcipher-production-qa` Android profile creates a standalone app with
package `com.anchorintentions.sqlcipherpreview20261015`, runtime
`2.0-sqlcipher-v2-realdata-qa`, SQLCipher enabled, and OTA updates disabled.
It uses the Railway production API and production EAS environment. It can read
and write the signed-in owner's production data, so do not use it for
destructive test scenarios. It is separate from `com.anchorintentions.app`.

The Android Gradle profile selects SQLCipher with
`-Pexpo.sqlite.useSQLCipher=true`. The `ANCHOR_SQLCIPHER_PRODUCTION_QA=1`
profile flag changes only the QA app ID, version, label, runtime and update
metadata. The default production package keeps its existing app ID, version,
runtime and OTA settings; its SQLCipher persistence gate remains off.

## Standalone real-account APK

From `anchor/mobile`:

```powershell
npx eas build --platform android --profile sqlcipher-production-qa
```

The EAS `production` environment must contain a `GOOGLE_SERVICES_JSON` file
registered for `com.anchorintentions.sqlcipherpreview20261015` in the production
Firebase project. Do not commit this file. The build fails closed if Android
Firebase configuration is missing.

## Metro development client

```powershell
npx eas build --platform android --profile sqlcipher-development
npx expo start --dev-client
```

This profile uses the same isolated package and SQLCipher database as the
standalone APK, but needs Metro for JavaScript iteration. Keep the known-good
standalone APK outside the app installation as the rollback artifact.

`sqlcipher-realdata-qa` remains an isolated, no-login profile. It is not the
real-account testing profile.
