# App Store Connect Privacy Checklist

Last reviewed: June 8, 2026

This checklist is for the App Store Connect `App Privacy` section and should be reviewed before each iOS submission.

## Confirmed data to disclose

Use these entries unless the code changes:

- `Email Address`
  - Linked to user: `Yes`
  - Used for tracking: `No`
  - Purposes: `App Functionality`
  - Why: Firebase auth and account identity.

- `User ID`
  - Linked to user: `Yes`
  - Used for tracking: `No`
  - Purposes: `App Functionality`
  - Why: app account ID, RevenueCat identity, backend sync, Sentry user context.

- `Purchase History`
  - Linked to user: `Yes`
  - Used for tracking: `No`
  - Purposes: `App Functionality`
  - Why: subscription entitlement state via RevenueCat.

- `Other User Content`
  - Linked to user: `Yes`
  - Used for tracking: `No`
  - Purposes: `App Functionality`
  - Why: free-form intention text and anchor content stored in the account and sent to AI generation endpoints.

- `Crash Data`
  - Linked to user: `Yes`
  - Used for tracking: `No`
  - Purposes: `App Functionality`
  - Why: Sentry crash reporting runs with the authenticated user ID attached in release builds when Sentry is enabled.

- `Performance Data`
  - Linked to user: `Yes`
  - Used for tracking: `No`
  - Purposes: `App Functionality`
  - Why: Sentry performance monitoring and app diagnostics in release builds when Sentry is enabled.

## Usually do not disclose from current v1 code

These do not currently look like off-device collection in the shipped v1 flow, so avoid over-reporting unless implementation changes:

- `Photos or Videos`
  - Profile photos are stored locally in client state.
  - Exported artwork is saved or shared from the device by user action.
  - Re-check if profile photo upload is added server-side.

- `Audio Data`
  - Mantra recording exists in deferred code but is not registered in active navigation for v1.
  - Re-check before submission if `MantraCreationScreen` or any audio upload flow is re-enabled.

- `Product Interaction`
  - Local analytics helper exists, but no remote analytics provider is wired in by default.
  - Re-check if Mixpanel, Amplitude, Firebase Analytics, or similar is enabled.

## Re-check before every submission

- Confirm whether `EXPO_PUBLIC_SENTRY_DSN` is set for the release build.
  - If `No`, you may be able to remove `Crash Data` and `Performance Data` from App Store Connect answers for that release.
  - If `Yes`, keep both disclosed.

- Confirm whether any new remote analytics provider was enabled.
  - If yes, add any additional required data categories and purposes.

- Confirm whether profile photos are uploaded to the backend.
  - If yes, add `Photos or Videos`.

- Confirm whether voice recording is reachable from registered navigation and uploaded.
  - If yes, add `Audio Data`.

## Permission string sanity check

Current iOS prompts in `app.json` should stay aligned with behavior:

- Camera: profile photo capture.
- Photo Library: choose profile photo and save exported artwork.
- Photo Library Add: save exported artwork.
- Face ID: protect secure parts of the app.
- Microphone: only keep if audio recording remains in the binary and reachable soon; otherwise revisit before launch.

## Apple references

- App privacy details:
  - https://developer.apple.com/app-store/app-privacy-details/

- App Store Connect app privacy reference:
  - https://developer.apple.com/help/app-store-connect/reference/app-privacy/

- App Review Guidelines:
  - https://developer.apple.com/app-store/review/guidelines/
