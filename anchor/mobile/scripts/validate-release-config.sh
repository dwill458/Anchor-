#!/usr/bin/env bash

set -euo pipefail

platform="${1:-${EAS_BUILD_PLATFORM:-all}}"
profile="${2:-${EAS_BUILD_PROFILE:-preview}}"

required_vars=(
  EXPO_PUBLIC_API_URL
  EXPO_PUBLIC_APP_ENV
  EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
)

missing=()

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    missing+=("$var_name")
  fi
done

if [[ "$platform" != "android" ]] && [[ -z "${EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:-}" && -z "${EXPO_PUBLIC_REVENUECAT_API_KEY:-}" ]]; then
  missing+=("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY or EXPO_PUBLIC_REVENUECAT_API_KEY")
fi

if [[ "$platform" != "ios" ]] && [[ -z "${EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:-}" && -z "${EXPO_PUBLIC_REVENUECAT_API_KEY:-}" ]]; then
  missing+=("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY or EXPO_PUBLIC_REVENUECAT_API_KEY")
fi

# Google Sign-In requires OAuth client IDs when the feature is enabled (default on).
if [[ "${EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN:-true}" != "false" ]]; then
  if [[ "$platform" != "android" ]] && [[ -z "${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-}" ]]; then
    missing+=("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID")
  fi
  if [[ -z "${EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:-}" ]]; then
    missing+=("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")
  fi
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  printf 'Missing required mobile release config:\n' >&2
  printf '  - %s\n' "${missing[@]}" >&2
  if [[ "$profile" == "production" ]]; then
    exit 1
  fi
  echo "::warning::Config incomplete — continuing because profile is '$profile' (not production)"
fi

if [[ "$platform" != "android" ]] && [[ ! -f "GoogleService-Info.plist" ]]; then
  echo "Missing GoogleService-Info.plist in anchor/mobile" >&2
  exit 1
fi

if [[ "$platform" != "ios" ]] && [[ ! -f "google-services.json" ]]; then
  echo "Missing google-services.json in anchor/mobile" >&2
  exit 1
fi

echo "Mobile release config looks complete."
