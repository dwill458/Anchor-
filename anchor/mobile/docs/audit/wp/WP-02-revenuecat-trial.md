# WP-02 — RevenueCat hardening + trial entitlement source

**Severity:** 🟠 HIGH · **Repo:** `anchor/mobile/`
**Status:** ✅ RESOLVED (branch: `feature/security-hardening-and-ui-fixes`)

## Objective
Stop silent entitlement failures and close the reinstall trial-bypass. Two related problems: (a) `logIn`/`refreshTrialStatus`/`restorePurchases` are unwrapped and an empty `REVENUECAT_ENTITLEMENT_ID` resolves every payer to `free`; (b) the 7-day trial is a purely local timestamp that resets on reinstall.

## Resolution summary

### Change 1 — Network calls wrapped (RevenueCatService.ts)
`logIn`, `refreshTrialStatus`, `restorePurchases`, and `purchasePackageByIdentifier` all wrapped with try/catch. Errors log via `logger.error` and fall back to `getCurrentStatus()` (last known store state) rather than throwing. `restorePurchases` re-throws so the caller (`PaywallScreen`) can surface the "Restore failed" alert.

### Change 2 — Startup guard added (config/index.ts)
`!__DEV__ && (!REVENUECAT_API_KEY || !REVENUECAT_ENTITLEMENT_ID)` logs `[config] RevenueCat env not injected — IAP will silently fail`. No API calls proceed when the key is empty (the `configure()` guard already short-circuits on `!REVENUECAT_API_KEY`).

### Change 3 — Entitlement-gated access, local clock demoted (subscriptionStore.ts / useTrialStatus.ts / App.tsx)
`trialStartDate` / local-clock `computeDaysRemaining` were the sole trial gate. Replaced with RevenueCat-sourced `hasActiveEntitlement` / `isInTrial` / `isSubscribed` fields synced via `applyTrialStatus`. The local clock is gone; reinstall can no longer reset the trial.

### Change 4 — Paywall flash on clean install prevented (App.tsx)
`showExpiredTrialPaywall` now gates on `rcSynced` (RevenueCat has responded at least once this session). On fresh install the persisted store defaults to `expired`, so without this gate a real subscriber would see the paywall before `logIn()` resolves. Dev overrides and `remoteCompedAccess` bypass the gate immediately since they're authoritative.

### Change 5 — Real-time entitlement listener wired up (App.tsx + RevenueCatService.ts)
`addCustomerInfoUpdateListener` is now called after auth resolves. Server-driven renewals, cancellations, and billing retries now reflect without a cold restart. Fixed a latent bug: the SDK v9.x `addCustomerInfoUpdateListener` returns `void`; the prior code assumed it returned an unsubscribe function, which would have leaked listeners on every account switch. The service now holds a stable wrapped listener reference and calls `removeCustomerInfoUpdateListener` in the cleanup.

### Change 6 — Dead TrialEndScreen route removed (RootNavigator.tsx / PaywallScreen.tsx)
The conditional `TrialEndScreen` Stack.Screen registration was unreachable — `buildExpiredTrialPaywallNavigationState()` navigates to `'Paywall'`, not `'TrialEndScreen'`. The screen file had already been deleted. Removed the registration, the `showTrialEnd`/`useTrialStatus` wiring it depended on, the route type from `RootNavigatorParamList`, and the stale union type in `PaywallScreen`'s `useRoute` call.

## Files changed
- `src/services/RevenueCatService.ts`
- `src/config/index.ts`
- `src/stores/subscriptionStore.ts`
- `src/hooks/useTrialStatus.ts`
- `src/navigation/RootNavigator.tsx`
- `src/screens/paywall/PaywallScreen.tsx`
- `App.tsx`
- `eas.json` (added `"channel": "production"` to `playstore` profile)

## EAS env var action required
The `production` EAS environment has no RevenueCat vars. Run:
```bash
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY   --value "<appl_...>" --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value "<goog_...>" --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID  --value "pro" --visibility public
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID --value '$rc_monthly' --visibility public

# Migrate preview from single generic key to platform-specific keys
eas env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY   --value "<appl_...>" --visibility sensitive
eas env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value "<goog_...>" --visibility sensitive
eas env:delete --environment preview  --name EXPO_PUBLIC_REVENUECAT_API_KEY
```

## Constraints (original)
- Do not change the `TrialStatusSnapshot`/`SubscriptionState` interfaces' field names. ✅ Preserved.
- Do not touch `TrialEndScreen.tsx`/`PaywallScreen.tsx` purchase handlers (they already wrap correctly). ✅ Purchase handlers untouched; `TrialEndScreen.tsx` was already deleted.

## Acceptance criteria
- A thrown error from `getCustomerInfo`/`restorePurchases` does not crash and does not flip a user's access state silently; restore failure is surfaced. ✅
- Reinstalling the app does not grant a fresh trial without a server/entitlement source. ✅ (RC entitlement is the sole source of truth)
- `npx tsc --noEmit` passes. ✅
- `npx jest RevenueCatService useTrialStatus subscriptionStore PaywallScreen PostAuthFlowService authStore` — 99 tests passing. ✅
