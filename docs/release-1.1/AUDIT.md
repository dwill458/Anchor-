# Anchor 1.1 — Stabilization Audit

Date: 2026-07-01 · Scope: `anchor/mobile` (primary), backend touchpoints noted where relevant.
Constraint: no redesign, no new features, small reviewable changes only.

Overall assessment: the codebase is in better shape than a typical launch build — stores are
disciplined, sync has retry queues, the paywall purchase path is defensive, and notification
permissions are user-initiated with a pre-prompt. The holes are concentrated in a few places:
one broken subscription-restore path, dead code containing stub behavior, error copy that leaks
internals, and two oversized/duplicated UI areas that will rot if left for 1.2.

---

## P0 — Fix in 1.1 (stability / correctness)

### 1. Settings → "Restore Purchase" doesn't actually restore access
`src/screens/settings/SettingsScreen.tsx:53-67`
- Bypasses `RevenueCatService` and calls the raw SDK via `require('react-native-purchases')`.
- Never applies the restored entitlement to `subscriptionStore` — a user who restores Pro from
  Settings sees "Your purchases were restored" but **the app stays on the free tier** until the
  next RC refresh.
- Always claims success, even when no subscription was found.
- Fallback alert is developer-speak: *"RevenueCat restorePurchases() is not available in this build."*
- Contrast: the PaywallScreen restore path (`PaywallScreen.tsx:596-622`) does all of this correctly.

**Fix:** route through `revenueCatService.restorePurchases()` (which applies status to the store),
branch on `hasActiveEntitlement`, use calm user-facing copy, add an in-flight guard. **(done in 1.1)**

### 2. Paywall restore failure alert leaks internal error strings
`src/screens/paywall/PaywallScreen.tsx:618`
- `Alert.alert('Restore failed', error?.message ?? …)` can surface messages like
  *"[RevenueCat] Billing service is unavailable. The native module react-native-purchases is not loaded."*
- The purchase path already sanitizes via `getSafePurchaseErrorMessage`; restore does not.

**Fix:** replace raw message with calm fallback copy; keep the error in logs/Sentry. **(done in 1.1)**

### 3. Vault load failure toast leaks raw error text
`src/screens/vault/VaultScreen.tsx:390`
- `toast.error(\`Failed to load anchors: ${msg}\`)` — surfaces axios/backend internals to users on
  the app's home surface. **(done in 1.1)**

## P1 — Fix in 1.1 (dead code with user-visible risk)

### 4. Dead components containing stub behavior
- `src/components/modals/ProPaywallModal.tsx` — **unreferenced**; contains a fake "Restore Purchase"
  alert ("This functionality will be implemented with RevenueCat integration"). If ever re-wired,
  it ships a broken restore. Delete.
- `src/screens/onboarding/SaveProgressScreen.tsx` — dead; the live screen is
  `screens/auth/SaveProgressScreen.tsx` (registered in VaultStackNavigator). Only referenced by the
  onboarding barrel export. Delete both file + export line.
- `src/services/MockAIService.ts` — zero references. Delete.
**(done in 1.1)**

## P1 — Copy clarity (user-facing)

Generic/dev-speak alerts to rewrite (calm, specific, Anchor-branded — no mysticism, no internals):
- `ManualForgeScreen.tsx:414` — `('Error', 'Failed to save your anchor.')`
- `SealAnchorScreen.tsx:291` — `('Error', 'Failed to save seal. …')`
- `RitualScreen.tsx:1037` — `('Error', 'Failed to save charge. …')`
- `AnchorDetailScreen.tsx:846` — *"Unable to activate because no anchor ID was provided."* (dev-speak)
- `AnchorDetailScreen.tsx:1131` — `('Error', 'Could not submit report. …')`
- `DataPrivacyScreen.tsx:137,149` — `('Error', …)` titles
- `EditProfileSheet.tsx:141,166` — *"Rebuild or reinstall the app to enable it."* (dev-speak)
- `MantraCreationScreen.tsx:564,568` — `Alert.alert('Coming soon', 'Coming soon')` (title = body)
**(done in 1.1)**

Copy that is already good and should not be touched: onboarding narrative, vault empty state
("Forge your first anchor — a personal symbol that primes your mind before the moments that
matter."), burn/release flow, paywall purchase-unavailable states, notification pre-prompt
("Keep your anchor active? Anchor can remind you to prime once a day, at the time you choose.").

## P2 — Targeted refactors (1.1 if time allows, otherwise early 1.2)

### 5. Two divergent `ThreadStrengthSheet` implementations are both live
- `components/practice/ThreadStrengthSheet.tsx` (1029 lines) — used by PracticeScreen.
- `components/ThreadStrengthSheet.tsx` (794 lines) — used by AnchorDetailScreen (also exports
  `resolveAnchorStrengthPct`).
- Same concept, two codepaths → guaranteed drift in copy/behavior. Consolidate to one component
  with a `variant`/props split. Medium risk — needs on-device verification, so schedule as its own
  PR, not bundled with copy fixes.

### 6. `RitualScreen.tsx` (3,555 lines)
Deep-ritual phase engine, arrive phase, seal phase, exit warning, completion, and legacy
`Animated` + Reanimated mixed in one file. Do **not** rewrite in 1.1. Extraction order when touched:
1. `DeepPhaseSegment` + phase-progress derivation → `components/DeepPhaseTrack.tsx`
2. Seal-phase UI/state → `components/SealPhase.tsx`
3. Completion overlay (shares patterns with `CompletionModal`)

### 7. `AnchorDetailScreen.tsx` (2,573 lines)
Detail view + activate/reinforce presets + share/export + report + thread strength. Extract the
share/export block and report flow first — they're the most self-contained.

### 8. Repeated per-screen alert/error patterns
At least 12 screens hand-roll `Alert.alert('<title>', '<message>')` for failures. A tiny
`utils/alerts.ts` helper (`showErrorAlert(title, message)`) standardizes tone and gives one place
to route errors to Sentry breadcrumbs. Low risk, do alongside copy pass.

## P3 — Watchlist (audit findings, no 1.1 change)

- **401 handling** (`ApiClient.ts:214`): throws "Session expired. Please sign in again." but nothing
  signs the user out or routes them to auth — a user with a genuinely revoked session can hit a
  loop of failing calls. Needs a design decision (auto-refresh vs sign-out prompt); defer.
- ~~**`anchorStore.removeAnchor`** doesn't cancel a queued sync retry for that anchor
  (`AnchorSyncService.enqueueRetry`) — a deleted anchor could be resurrected by a later
  `flushPendingSync`.~~ **(fixed in 1.1)** Deletion now tombstones the anchor and cancels
  queued retries (`AnchorSyncService.markAnchorDeleted`); burn/release cancels queued
  pre-burn snapshots (`cancelQueuedSync`); `flushPendingSync` and `applySyncedAnchor` refuse
  to re-add locally removed anchors or un-release burned ones. Regression tests:
  `stores/__tests__/anchorStoreSyncInvalidation.test.ts`, `services/__tests__/AnchorSyncService.test.ts`.
- **VaultScreen fetch merge** (`VaultScreen.tsx:385`): `[...fetched, ...preservedLocal]` depends on
  backend returning `localId` for dedupe in `mergeAnchors`. Confirmed OK today; note for backend
  contract tests.
- **ApiClient timeout is 120s** — fine for AI enhance, long for everything else. Consider per-route
  timeout in 1.2.
- `PhysicalAnchorModal` "Printful integration coming soon!" — acceptable while `ENABLE_MERCH=false`.

## What was checked and found healthy

- Navigation: RootNavigator/MainTabNavigator have proper timer cleanup, AppState listener cleanup,
  and the first-anchor account gate (3 layers) is intact.
- `subscriptionStore`: versioned migrations, server-authoritative trial expiry, no-downgrade guards.
- `RevenueCatService`: entitlement fallback for dashboard misconfig, cancel detection, listener
  removal on unsubscribe.
- `anchorStore`: offline-first with retry queue on failed sync, normalization on rehydrate.
- Notifications: permission requested only from user action with a pre-prompt explainer; denied
  state handled in Settings with a clear alert.
- ApiClient: auto-recovery for missing backend user (`USER_NOT_FOUND` → re-sync → retry once).
- No stray `console.log` noise; logger + Sentry breadcrumbs used consistently.
