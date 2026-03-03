# Required GitHub Secrets & Environments

## GitHub Environments

Create two environments in **Settings → Environments**:

| Environment | Purpose |
|---|---|
| `preview` | Preview/staging builds (no approval gate) |
| `production` | Production builds + store submission (require manual approval) |

---

## Required Secrets

Add these in **Settings → Secrets and variables → Actions**:

### Global (all workflows)

| Secret | How to get it |
|---|---|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens → Create |
| `SENTRY_DSN` | sentry.io → Project → Settings → Client Keys |

### `production` environment only

| Secret | How to get it |
|---|---|
| `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com → App-Specific Passwords |

### For EAS Submit (store submission) — add to `eas.json` submit config

| Value | Where |
|---|---|
| `APPLE_ID_PLACEHOLDER` | Your Apple ID email |
| `APP_STORE_CONNECT_APP_ID_PLACEHOLDER` | App Store Connect → App → App ID (numeric) |
| `APPLE_TEAM_ID_PLACEHOLDER` | developer.apple.com → Membership → Team ID |
| `google-service-account.json` | Google Play Console → Setup → API access → Service account |

---

## Build Triggers

| Event | Profile | Result |
|---|---|---|
| Push to `main` | `preview` | Internal APK/IPA via EAS |
| Push tag `v*.*.*` | `production` | Store build + auto-submit |
| Manual dispatch | Any | Your choice |
| Pull request | N/A | CI tests only (no build) |
