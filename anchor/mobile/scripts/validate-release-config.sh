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
warnings=()

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

validate_revenuecat_key_prefix() {
  local var_name="$1"
  local expected_prefix="$2"
  local value="${!var_name:-}"

  if [[ -z "$value" ]]; then
    return
  fi

  if [[ "$value" != "${expected_prefix}"* ]]; then
    echo "$var_name must start with ${expected_prefix}" >&2
    exit 1
  fi
}

if [[ "$platform" != "android" ]]; then
  if [[ -n "${EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:-}" ]]; then
    validate_revenuecat_key_prefix EXPO_PUBLIC_REVENUECAT_IOS_API_KEY appl_
  elif [[ -n "${EXPO_PUBLIC_REVENUECAT_API_KEY:-}" ]]; then
    validate_revenuecat_key_prefix EXPO_PUBLIC_REVENUECAT_API_KEY appl_
    warnings+=("Using shared EXPO_PUBLIC_REVENUECAT_API_KEY for iOS; prefer EXPO_PUBLIC_REVENUECAT_IOS_API_KEY")
  fi
fi

if [[ "$platform" != "ios" ]]; then
  if [[ -n "${EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:-}" ]]; then
    validate_revenuecat_key_prefix EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY goog_
  elif [[ -n "${EXPO_PUBLIC_REVENUECAT_API_KEY:-}" ]]; then
    validate_revenuecat_key_prefix EXPO_PUBLIC_REVENUECAT_API_KEY goog_
    warnings+=("Using shared EXPO_PUBLIC_REVENUECAT_API_KEY for Android; prefer EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY")
  fi
fi

if [[ ${#warnings[@]} -gt 0 ]]; then
  printf 'RevenueCat config warnings:\n' >&2
  printf '  - %s\n' "${warnings[@]}" >&2
fi

echo "Mobile release config looks complete."
