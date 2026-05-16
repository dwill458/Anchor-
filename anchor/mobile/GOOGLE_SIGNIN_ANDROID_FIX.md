# Google Sign-In Android Fix

## Current blocker

`google-services.json` is present, but the Android Firebase app has no OAuth clients under `client[0].oauth_client`.
That means Google Sign-In cannot succeed for signed Android builds until the correct certificate fingerprints are registered in Firebase / Google Cloud and a fresh `google-services.json` is downloaded.

## What to do

1. Open Firebase Console for project `anchor-ac6d6`.
2. Go to Project settings -> Your apps -> Android app `com.anchorintentions.app`.
3. Add the SHA-1 and SHA-256 fingerprints for every signing key used by Android builds:
   - Local debug keystore
   - EAS internal / preview keystore
   - Play App Signing certificate, if Play Store builds are used
4. Save the Android app settings.
5. Download the regenerated `google-services.json`.
6. Replace [google-services.json](C:/Users/dwill/.gemini/antigravity/scratch/Anchor/anchor/mobile/google-services.json).
7. Rebuild the app with EAS.
8. After verification, set `EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN=true` in the intended build profile(s).

## Local debug fingerprints

These came from [android/app/debug.keystore](C:/Users/dwill/.gemini/antigravity/scratch/Anchor/anchor/mobile/android/app/debug.keystore):

- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

## EAS / Play fingerprints still required

The broken screenshot is likely from an EAS-signed Android build, not the debug keystore. You still need the signing certificate fingerprints for:

- the EAS build keystore used by `preview`
- the EAS / store keystore used by `production`
- Google Play App Signing, if Play re-signing is enabled

Get those fingerprints from Expo credentials or the Play Console, then add them to Firebase before rebuilding.
