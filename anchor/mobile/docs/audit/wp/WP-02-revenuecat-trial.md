# WP-02 — RevenueCat hardening + trial entitlement source

**Severity:** 🟠 HIGH · **Repo:** `anchor/mobile/`

## Objective
Stop silent entitlement failures and close the reinstall trial-bypass. Two related problems: (a) `logIn`/`refreshTrialStatus`/`restorePurchases` are unwrapped and an empty `REVENUECAT_ENTITLEMENT_ID` resolves every payer to `free`; (b) the 7-day trial is a purely local timestamp that resets on reinstall.

## Files (touch only these)
- `src/services/RevenueCatService.ts`
- `src/config/index.ts`
- `src/stores/subscriptionStore.ts`
- `src/hooks/useTrialStatus.ts`
- `src/navigation/RootNavigator.tsx`

## Change 1 — Wrap network entitlement calls (RevenueCatService.ts)
- `logIn` (188-198), `refreshTrialStatus` (200-209), `restorePurchases` (292-301) have no try/catch. Wrap each: on error `logger.error(...)` and return `this.getCurrentStatus()` (last known) instead of throwing. For `restorePurchases`, also rethrow or return a flag so the caller can show a "Restore failed" message — do not silently succeed.

## Change 2 — Fail-fast on misconfig (config/index.ts)
- `REVENUECAT_ENTITLEMENT_ID` / `REVENUECAT_API_KEY` default to `''`. Add a startup guard: when `!__DEV__ && (!REVENUECAT_API_KEY || !REVENUECAT_ENTITLEMENT_ID)` → `logger.error('[config] RevenueCat env not injected — IAP will silently fail')`. Keep the constants/exports unchanged.

## Change 3 — Gate Pro on the entitlement, not the local clock (subscriptionStore.ts / useTrialStatus.ts / RootNavigator.tsx)
- Today `getEffectiveTier` (subscriptionStore.ts:103) and `useTrialStatus` (105-107) grant `pro` purely from `computeDaysRemaining(trialStartDate) > 0`, with no purchase/server check. `trialStartDate` is wiped on reinstall.
- Decide with product (ask via the audit owner) between:
  - **(Preferred)** Treat local `trialStartDate` as an offline UX cache only; require `hasActiveEntitlement` (RevenueCat) or `remoteCompedAccess` for `pro`. Keep showing day-count from the local cache but do not grant access on it alone after first sync.
  - **(Alt)** Model the trial as a RevenueCat offering/entitlement keyed to `appUserID`/`originalPurchaseDate` so reinstalls cannot reset it.
- Keep `computeDaysRemaining`, `TRIAL_DURATION_DAYS`, `getEffectiveTier`, `useTrialInit`, `subscriptionStatus` names and the persist key `anchor-subscription-override-storage`.

## Constraints
- Do not change the `TrialStatusSnapshot`/`SubscriptionState` interfaces' field names.
- Do not touch `TrialEndScreen.tsx`/`PaywallScreen.tsx` purchase handlers (they already wrap correctly).

## Acceptance criteria
- A thrown error from `getCustomerInfo`/`restorePurchases` does not crash and does not flip a user's access state silently; restore failure is surfaced.
- Reinstalling the app does not grant a fresh trial without a server/entitlement source (per chosen approach).
- `npx tsc --noEmit` passes; `npx jest RevenueCatService useTrialStatus subscriptionStore` passes.
