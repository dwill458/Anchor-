# Isolated Anchor Auth and Focus fixture

This directory contains a diagnostic-only local environment for native authentication callbacks and locally persisted Focus-session sync. It uses the Firebase **demo** project `demo-anchor-perf`, an Auth-only emulator bound to `127.0.0.1:9099`, and a fixture API bound to `127.0.0.1:39999`. The API stores a minimal session summary in RAM and discards intention text, scene snapshots, next actions, passwords, and bearer tokens. It does not use the production backend, Postgres, Firebase cloud resources, or a production service account.

Firebase documents that a `demo-` project has no live resources and that calls for non-emulated products fail; it also documents that Admin SDK accepts emulator ID tokens only when `FIREBASE_AUTH_EMULATOR_HOST` is set. The fixture fixes both the project ID and emulator host. Its Admin app is initialized with only that project ID, and its verifier additionally checks token audience, issuer, and subject.

## Tool provenance

Use the exact Firebase CLI version `15.33.0` from the npm package `firebase-tools`, run with `npm exec` from a temporary directory. The CLI version was confirmed from the npm registry on 2026-10-12. No global install, login, project listing, or cloud resource creation is part of this procedure. Firebase's current CLI documentation requires Node.js 18 or newer; the local Node runtime is 24.15.0.

## Start and test

Run the Auth Emulator from a dedicated temporary directory so CLI state and raw CLI logs stay outside the repository. This pins its config to this directory's Auth-only `firebase.json`, uses fresh Firebase/gcloud config directories, and blanks child-process credential variables:

```powershell
$runRoot = Join-Path $env:TEMP 'anchor-perf-release-20261012-auth-emulator-run'
$cliConfig = Join-Path $env:TEMP 'anchor-perf-release-20261012-firebase-xdg'
$gcloudConfig = Join-Path $env:TEMP 'anchor-perf-release-20261012-gcloud'
New-Item -ItemType Directory -Path $runRoot,$cliConfig,$gcloudConfig -Force | Out-Null
Copy-Item .\firebase.json (Join-Path $runRoot 'firebase.json') -Force
$env:XDG_CONFIG_HOME = $cliConfig
$env:XDG_DATA_HOME = Join-Path $cliConfig 'data'
$env:XDG_CACHE_HOME = Join-Path $cliConfig 'cache'
$env:CLOUDSDK_CONFIG = $gcloudConfig
$env:FIREBASE_TOKEN = ''
$env:GOOGLE_APPLICATION_CREDENTIALS = ''
$env:GCLOUD_PROJECT = ''
$env:GOOGLE_CLOUD_PROJECT = ''
$env:npm_config_cache = Join-Path $env:TEMP 'anchor-perf-release-20261012-npm'
Push-Location $runRoot
npm exec --yes --package=firebase-tools@15.33.0 -- firebase emulators:start --only auth --project demo-anchor-perf --config .\firebase.json --non-interactive
Pop-Location
```

In a second shell, start the fixture API:

```powershell
node .\fixture-api.cjs
```

Create the one-time synthetic account before the tests. This setup refuses an existing `synthetic-account` UID or existing credential file and never overwrites, resets, or deletes an account. Its generated email/password are saved only under task TEMP; output contains only the UID and credential-file path:

```powershell
node .\setup-synthetic-account.cjs
```

For the account-switching diagnostic, optionally create a second independent account with the same fixed demo-project, emulator-only safeguards:

```powershell
node .\setup-synthetic-account.cjs --secondary
node .\test-fixture.cjs --secondary
```

The secondary setup uses only UID `synthetic-account-b` and a separate TEMP file named `synthetic-account-b.credentials.json`. It refuses an existing UID or file, never resets or deletes account A, and prints no email, password, or token. The test signs in only account B and verifies its verified onboarding claim, free (non-comped) fixture response, and UID-scoped Focus session. Account A's credential file and emulator state are untouched by this option.

For authorized local Focus runtime checks that require Pro, create a third, independent demo-only profile:

```powershell
node .\setup-synthetic-account.cjs --comped
node .\test-fixture.cjs --comped
```

This option uses only UID `synthetic-account-c` and TEMP file `synthetic-account-c.credentials.json`. It refuses an existing UID or file and never edits A/B. Only C receives the verified Auth custom claims `anchorPerfOnboarded=true` and `anchorPerfComped=true`. The fixture returns `isComped=true` only when both the verified ID token UID and custom claim match C; request-body flags are ignored, and A/B plus other identities remain Free. No app gate, client entitlement override, RevenueCat state, purchase, paid service, or production account is used. This provides a local synthetic comped profile while leaving the real Focus gate intact.

In a third shell, run the local integration and safety tests:

```powershell
node .\test-fixture.cjs
```

Each test signs in its selected synthetic email/password account through the local emulator and verifies its real ID token with Firebase Admin. The fixture maps onboarding and comped access only from verified demo Auth claims with their fixed UID rules; caller-supplied body flags cannot set either state. It checks that a practice-session record is retained in fixture RAM under the authenticated UID and that private session snapshots/next-actions are discarded. A second unclaimed emulator account proves request-body flags cannot elevate onboarding or comped access. C's `isComped` profile enables the unchanged client Pro gate for local runtime testing; the other accounts remain Free. Passwords, tokens, email addresses, and request bodies are never printed. The fixture does not implement guest-anchor ownership transfer, billing/purchases, or production backend behavior. All account state is in the emulator's memory and each credential file is separate in TEMP; stop the emulator to clear account state, then remove the TEMP credential files when this diagnostic is finished.

The `POST /api/ai/enhance` fixture accepts only a `temp-` anchor ID and the exact synthetic intention `I build a synthetic test routine`. It discards the submitted SVG and intention, returns one deterministic PNG generated in memory, and serves that PNG from the loopback API. An unauthenticated request follows the production onboarding exception only for this fixed synthetic payload; when a bearer is supplied, it must verify against the demo project and belong to one of the three fixed synthetic UIDs with the verified onboarding claim. Invalid bearers, other intentions, and ordinary anchor IDs are rejected. The native guest path can call this route without a token because its first-anchor style gate allows generation before sign-in and `AuthService.native.ts` returns null when there is no Firebase user. This is a fixed fixture image with synthetic metadata, not measured AI output or evidence of AI image quality. The fixture also does not implement canonical `/api/anchors` persistence, so a backend-finalized account save remains outside its coverage.

## Diagnostic app boundary

The companion review-only native patch is intended for a fresh Android package `com.anchorintentions.perflab20261012` (label `Anchor PERF LAB`, scheme `anchor-perflab20261012`) and must require both that application ID and the exact loopback API/Auth URLs before it calls `useEmulator` or makes a fixture request. Both the owner package `com.anchorintentions.app` and the previously user-touched package `com.anchorintentions.perfbaseline` are rejected by the diagnostic config guard. In the isolated copy only, set `firebase.json` `react-native.android_bypass_emulator_url_remap` to `true` before native compilation, then verify compiled native `FIREBASE_JSON_RAW` contains that boolean setting. Separately verify the native Google Services resources identify `demo-anchor-perf`; after launch, require the numeric `auth-emulator-route { okCode: 1 }` event, whose source assertion accepts only the returned pair `127.0.0.1:9099` after checking `auth().app.options.projectId`, before any phone sign-in. If any check fails, stop without attempting Auth. The patch is not applied to the shared app source and this fixture cannot establish production-backend acceptance.

For a physical Android device, a separately authorized operator may bridge only these two ports using `adb reverse tcp:9099 tcp:9099` and `adb reverse tcp:39999 tcp:39999`. This directory does not execute ADB or install an app. Stop the two local processes after the test; do not use a LAN bind address, external tunnel, real Firebase project ID, or production URL.

The V5 native patch chain is review-only and assumes the APD copy already has the V4 isolated Auth guards (package, demo project, and loopback API). Copy `google-services.perf-diagnostic.json` to both that copy's root `google-services.json` and `android/app/google-services.json`; in that isolated copy's `firebase.json`, set `react-native.android_bypass_emulator_url_remap` to `true`. Apply the selected V5 diagnostic overlays, then apply `../diagnostic-src/startup-fault-v5-consumers.patch` (SHA-256 `4CF6E9E22C7830B264F1B39FD6F92F6BB1997B6F9B68B8CA299BE67D2F4C1CCE`). Set `EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS=1` and `EXPO_PUBLIC_API_URL=http://127.0.0.1:39999`, then build with the Gradle property `-PanchorPerfDiagnostics=true`. Before any phone sign-in, verify compiled native `FIREBASE_JSON_RAW` contains `android_bypass_emulator_url_remap: true`; separately verify the native Google Services resources identify `demo-anchor-perf`. After launch, confirm `auth-emulator-route` reports `okCode:1`; the source check requires the actual `auth().app.options.projectId` to be `demo-anchor-perf` and accepts only the returned route `127.0.0.1:9099`. Stop if any check fails; do not attempt Auth against a remapped or cloud route. The consumer patch adds the endpoint assertion and one-shot startup consumers; it contains no package, app JSON, namespace, or Gradle changes. The old `mobile-auth-diagnostic.patch`, `mobile-auth-diagnostic-v4.patch`, and `startup-fault-v5-hooks.patch` are superseded review artifacts and must not be applied. Do not copy the config or apply patches in the shared product checkout.
