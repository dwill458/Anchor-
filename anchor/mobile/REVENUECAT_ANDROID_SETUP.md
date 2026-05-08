# RevenueCat Android Setup

This app is wired for a `Monthly + Annual` RevenueCat launch on Android.

## Repo Contract

- Android package name: `com.anchorintentions.app`
- Required env vars:
  - `EXPO_PUBLIC_REVENUECAT_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
  - `EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID`
- RevenueCat package identifiers used by the app:
  - `$rc_monthly`
  - `$rc_annual`

## App Behavior

- The mobile app logs in to RevenueCat with the Firebase user ID.
- The paywall surfaces in this repo only expose `Monthly` and `Annual`.
- `EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID` controls the default selected plan in the Android paywalls and the fallback package used by `purchaseDefaultTrialPackage()`.

## RevenueCat Dashboard

1. Open the Android app entry for `com.anchorintentions.app`.
2. Re-upload the Google service account JSON after any Play Console permission change.
3. Create or confirm a single entitlement for Pro access.
4. Create or confirm a current offering containing:
   - `$rc_monthly`
   - `$rc_annual`
5. Map both Android products to the same Pro entitlement.
6. Do not configure `$rc_lifetime` in the current offering for this launch.

## Google Cloud

Confirm the uploaded JSON belongs to the same Google Cloud project linked through Play Console API access.

Required APIs:

- Google Play Android Developer API
- Google Play Developer Reporting API
- Cloud Pub/Sub API

Required service-account roles:

- `Pub/Sub Editor`
- `Monitoring Viewer`

If roles or APIs change, generate a new JSON key and upload that new key to RevenueCat.

## Google Play Console

Add the service account as a user on the Anchor app and grant:

- `View financial data`
- `Manage orders and subscriptions`
- `View app information and download bulk reports (read-only)`

Also verify a signed AAB for `com.anchorintentions.app` has been uploaded and promoted to at least internal testing before treating RevenueCat credential validation as final.

## EAS / Build Config

Set these values in local `.env` and in the EAS environment used for Android builds:

```bash
EXPO_PUBLIC_REVENUECAT_API_KEY=goog_public_sdk_key_here
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro
EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID=$rc_monthly
```

Production Android builds already use `app-bundle` output in [anchor/mobile/eas.json](/abs/path/c:/Users/dwill/.gemini/antigravity/scratch/Anchor/anchor/mobile/eas.json).

## Verification

1. RevenueCat validator passes `subscriptions API`, `inappproducts API`, and `monetization API`.
2. RevenueCat imports or recognizes the monthly and annual Play products.
3. An internal test build signs in and loads offerings without falling back to an empty package list.
4. A sandbox tester can buy monthly or annual and receive the configured entitlement.
5. Restore purchases reactivates the entitlement on the same tester account.
