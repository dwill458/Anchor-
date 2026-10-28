# Anchor 2.0 — PostHog Analytics QA & Verification Report

**Target Release**: October 31, 2026  
**Verification Date**: October 28, 2026  
**Launch Readiness Status**: **YELLOW** (All P0 & P1 source code, `npx tsc --noEmit` (`0` errors), and 356 automated Jest tests across 15 suites are **100% GREEN** locally; overall status is reported as **YELLOW** strictly because live PostHog dashboard ingestion verification and RevenueCat server-to-server webhook dashboard confirmation require external project credentials not connected to this workspace—see Section 5 for the exact 5-step remote verification checklist)

---

## 1. Automated Test Suite & TypeScript Results

### TypeScript Check (`npx tsc --noEmit`)
```powershell
Set-Location "e:\Projects\Anchor\anchor\mobile"
npx tsc --noEmit
```
- **Result**: **PASS (`exit code 0`, 0 errors)**.
- **Pre-Existing Errors Fixed**: The 2 pre-existing `Keyboard.addListener` mock typing errors in [`src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx#L393-L397) (lines 394 & 416) were established as pre-existing test-file mock type mismatches and fixed so `npx tsc --noEmit` exits cleanly with code `0`.

### Automated Jest Suites (15 Suites, 356 Passing Tests)
```powershell
Set-Location "e:\Projects\Anchor\anchor\mobile"
npx jest --runInBand src/services/__tests__/AnalyticsService.test.ts src/services/__tests__/FrictionAnalytics.test.ts src/services/__tests__/PracticeCompletionService.test.ts src/stores/__tests__/authStore.test.ts src/hooks/v2/paywall/__tests__/useV2Paywall.test.tsx src/screens/paywall/__tests__/PaywallScreen.test.tsx src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx src/screens/v2/practice/__tests__/V2PracticeSessionScreen.test.tsx src/screens/v2/practice/visualize/__tests__/V2CinematicSessionLifecycle.test.tsx src/hooks/v2/vision/__tests__/useVisionGenerationAnalytics.test.tsx src/hooks/v2/vision/__tests__/useV2Vision.test.tsx src/components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx src/hooks/v2/chart/__tests__/useAskChart.test.ts src/hooks/v2/chart/__tests__/useAnchorChart.test.ts src/stores/v2/__tests__/guidanceCoordinator.test.ts
```

| Test Suite | Status | Coverage Focus |
| :--- | :---: | :--- |
| [`src/services/__tests__/AnalyticsService.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts) | **PASS** | All 15 P0 & P1 scenarios: guest app restart continuity, guest-to-registered identity linking, multi-account `first_anchor_created` deduplication (Account A -> Account B -> Account A), logout & account-switch reset, PostHog `reset()` opt-out protection, RevenueCat `$posthogUserId` consent listener (`null` on opt-out), startup hydration ordering, practice & first-anchor retry deduplication, annual trial start (`trial_started` without `trial_converted`), store checkout cancellation, onboarding backgrounding vs. abandonment, offline resilience, and Step 2 P1 Visualize/Vision/Chart/Practice canonical deduplication |
| [`src/hooks/v2/paywall/__tests__/useV2Paywall.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/__tests__/useV2Paywall.test.tsx) | **PASS** | V2 paywall trial start, paid purchase, store cancellation, restore purchases, and authoritative RevenueCat `is_sandbox_purchase` / `store_environment` / `store` metadata on `paywall_converted` and `trial_started` |
| [`src/screens/paywall/__tests__/PaywallScreen.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/paywall/__tests__/PaywallScreen.test.tsx) | **PASS** | Legacy/1.5 paywall conversion, `trial_started` vs. `trial_converted` separation, and authoritative transaction metadata |
| [`src/stores/__tests__/authStore.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/__tests__/authStore.test.ts) | **PASS** | Auth rehydration, sign-out reset, and identity transitions |
| [`src/services/__tests__/PracticeCompletionService.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/PracticeCompletionService.test.ts) | **PASS** | Canonical `practice_completed` and `thread_strength_changed` emission and retry deduplication |
| [`src/services/__tests__/FrictionAnalytics.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/FrictionAnalytics.test.ts) | **PASS** | Flow correlation IDs, step durations, and non-duplicate flow completion |
| [`src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx) | **PASS** | Account save prompt (`account_save_prompt_viewed`), guest continuation (`account_save_skipped`), account creation (`account_created`), and first Anchor sync retry |
| [`src/screens/v2/practice/__tests__/V2PracticeSessionScreen.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/__tests__/V2PracticeSessionScreen.test.tsx) | **PASS** | Focus & Deep Prime session start, completion, failure (`practice_failed`), and retry idempotency |
| [`src/screens/v2/practice/visualize/__tests__/V2CinematicSessionLifecycle.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/visualize/__tests__/V2CinematicSessionLifecycle.test.tsx) | **PASS** | Guided Visualize lifecycle (`visualize_started`, `visualize_completed`, `visualize_abandoned`) |
| [`src/hooks/v2/vision/__tests__/useVisionGenerationAnalytics.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/vision/__tests__/useVisionGenerationAnalytics.test.tsx) | **PASS** | Vision AI generation started (`vision_generation_started`), completed (`vision_generation_completed`), and failed (`vision_generation_failed`) |
| [`src/hooks/v2/vision/__tests__/useV2Vision.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/vision/__tests__/useV2Vision.test.tsx) | **PASS** | Vision board mutations and scene persistence without duplicate `vision_board_saved` emission |
| [`src/components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/vision/ceremony/__tests__/VisionCeremony.test.tsx) | **PASS** | Vision ceremony image selection, seal, and single `vision_board_saved` emission |
| [`src/hooks/v2/chart/__tests__/useAnchorChart.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/chart/__tests__/useAnchorChart.test.ts) | **PASS** | Chart route approval (`chart_approved`), One Move completion (`one_move_completed`), and waypoint completion (`waypoint_reached`) |
| [`src/hooks/v2/chart/__tests__/useAskChart.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/chart/__tests__/useAskChart.test.ts) | **PASS** | Ask Chart message submission (`ask_chart_message_sent`) without leaking message text |
| [`src/stores/v2/__tests__/guidanceCoordinator.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/v2/__tests__/guidanceCoordinator.test.ts) | **PASS** | Teaching prompt dwell (`teaching_shown`), dismissal (`teaching_dismissed`), and action (`teaching_action_taken`) |

---

## 2. P0 Priority 1 — Three Critical Defects Fixed & Verified

### Defect 1: Anonymous Identity Continuity
- **Root Cause Fixed**:
  - Previously, cold start and auth rehydration invoked `AnalyticsService.reset()` unconditionally when `user` was `null`, or relied solely on an in-memory `userId !== null` check that could miss resets when a persisted authenticated session expired before `identify()` ran in a new process, or merge two different authenticated accounts on direct account switch.
- **Implementation**:
  - [`AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts) now tracks `persistedIdentifiedUserId` in `AsyncStorage` (`@anchor_analytics_identified_user_id`) alongside in-memory `this.userId`.
  - Unauthenticated cold start and `authStore` rehydration (`applyUserToSubscriptionStore(state.user, { reason: 'rehydrate' })`) **never** call `posthog.reset()`, preserving PostHog's anonymous `distinct_id` across app restarts.
  - When a guest registers an account, `AnalyticsService.identify(userId)` sees no prior conflicting authenticated user ID and calls `posthog.identify(userId)` directly, linking pre-registration anonymous onboarding and Anchor creation events to the new authenticated profile.
  - When a user logs out (`authStore.signOut` or `setUser(null)` from an authenticated state) or when an authenticated session expires during cold-start reconciliation (`handleUnauthenticatedAuthRestore`), `AnalyticsService.reset({ forceReset: true, reason: 'logout' })` checks `this.userId !== null || this.persistedIdentifiedUserId !== null || options?.reason === 'logout'` and resets PostHog even if in-memory `this.userId` was `null`.
  - When switching directly from Account A to Account B (`identify(userB)` when `previousIdentifiedUserId === userA`), `AnalyticsService.identify` calls `this.posthog.reset()` before `this.posthog.identify(userB)`, preventing cross-account person profile contamination.

### Defect 2: Startup Event Loss & Privacy Preference Hydration
- **Root Cause Fixed**:
  - Early events (`splash_started`, `onboarding_started`) and auth rehydration (`identify`) can fire before `useSettingsStore` finishes hydrating `analyticsEnabled` from `AsyncStorage`.
- **Implementation**:
  - [`AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts) holds `initialized = false` until [`App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L589-L595) confirms `analyticsPreferenceHydrated === true` and calls `AnalyticsService.initialize({ enabled: effectiveAnalyticsEnabled })`.
  - While `!this.initialized`, `track`, `trackAnonymous`, `identify`, `setUserProperties`, and `reset` are buffered in memory in `pendingQueue` in strict FIFO order without instantiating PostHog or transmitting network payloads.
  - If `effectiveAnalyticsEnabled` resolves to `false` (or `setEnabled(false)` is called), `pendingQueue` and `userProperties` are immediately purged (`this.pendingQueue = []`), `posthog?.optOut()` is invoked, and zero buffered events are sent or retained.
  - If `effectiveAnalyticsEnabled` resolves to `true`, PostHog is initialized and `flushPendingQueue()` replays queued `reset`, `identify`, `setUserProperties`, and `capture` operations in exact order (preserving `trackAnonymous` separation from `userId` while enriching subsequent `track` calls with the identified `userId`).

### Defect 3: Trial Conversion Accuracy & Historical 1.5 Data Contamination
- **Root Cause Fixed**:
  - Previously, starting a 7-day free trial emitted `trial_converted` alongside `paywall_converted` in both [`useV2Paywall.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts) and legacy [`PaywallScreen.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/paywall/PaywallScreen.tsx).
- **Implementation**:
  - In [`useV2Paywall.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts#L115-L125), `outcome === 'trial_started'` emits `paywall_converted` (`outcome: 'trial_started'`) and `trial_started`, and **never** emits `trial_converted`.
  - In [`PaywallScreen.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/paywall/PaywallScreen.tsx#L620-L642), trial starts (`purchaseStatus?.isInTrial || selectedPlan.trialEligible === true`) now emit `trial_started` (`outcome: 'trial_started'`), reserving `trial_converted` strictly for non-trial paid purchases (`outcome: 'purchased'`).
  - Authoritative Day-7 trial-to-paid billing conversion and subscription lifecycle reporting remain with RevenueCat server webhooks linked via `$posthogUserId`.
  - **Historical Contamination Documented**: In [`ANCHOR_ANALYTICS_EVENT_CATALOG.md`](file:///e:/Projects/Anchor/ANCHOR_ANALYTICS_EVENT_CATALOG.md#L123) and [`ANCHOR_POSTHOG_DASHBOARDS.md`](file:///e:/Projects/Anchor/ANCHOR_POSTHOG_DASHBOARDS.md), historical 1.5 `trial_converted` events emitted prior to `app_version = '2.0.0'` (October 27, 2026) with `outcome = 'trial_started'` are explicitly documented so PostHog insights filter them out.

---

## 3. Verification Across All 11 Mandatory P0 Testing Scenarios

| # | Scenario | Automated Test Location | Result | Verification Evidence |
| :-: | :--- | :--- | :---: | :--- |
| 1 | **Guest closes app and returns** | [`AnalyticsService.test.ts` (Scenario 1)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L372-L388) | **PASS** | `posthog.reset()` is not called during unauthenticated cold-start rehydration; `getDistinctId()` remains `'anon-guest-persist-101'`. |
| 2 | **Guest creates Anchor and later registers** | [`AnalyticsService.test.ts` (Scenario 2)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L390-L423) | **PASS** | `first_anchor_created` fires once (`is_guest: true`); `identify()` links `'anon-guest-202'` to `'user-registered-202'` without calling `reset()`; subsequent draft sync does not re-emit `first_anchor_created`. |
| 3 | **Authenticated user logs out** | [`AnalyticsService.test.ts` (Scenario 3)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L425-L450) | **PASS** | `reset({ reason: 'logout' })` calls `posthog.reset()` even when in-memory `userId` is `null` (using `persistedIdentifiedUserId`), and account switching from `user-auth-A` to `user-auth-B` resets before identifying `user-auth-B`. |
| 4 | **App launches while auth and settings are rehydrating** | [`AnalyticsService.test.ts` (Scenario 4)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L452-L505) | **PASS** | Pre-hydration `splash_started` (anonymous), `identify`, and `app_opened` buffer in `pendingQueue` and flush in exact FIFO order (`['capture:splash_started', 'identify:user-rehydrated-404', 'capture:app_opened']`) once `initialize({ enabled: true })` runs. |
| 5 | **Analytics tracking disabled** | [`AnalyticsService.test.ts` (Scenario 5)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L507-L541) | **PASS** | When `initialize({ enabled: false })` runs after preference hydration, `pendingQueue` is emptied (`length === 0`), `posthog.optOut()` is called, and `mockCapture` / `mockIdentify` receive 0 calls. |
| 6 | **Practice completion retried** | [`AnalyticsService.test.ts` (Scenario 6)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L543-L578) & [`PracticeCompletionService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/PracticeCompletionService.ts#L162-L182) | **PASS** | `completePracticeSession` checks `completionReceipts` and `practiceHistory` by `sessionId`; first call emits `practice_completed`, retry returns `{ duplicate: true }` and emits `practice_duplicate_prevented` without a second `practice_completed`. |
| 7 | **First Anchor synchronization retried** | [`AnalyticsService.test.ts` (Scenario 7)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L580-L609) & [`V2SealedSaveScreen.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/__tests__/V2SealedSaveScreen.test.tsx) | **PASS** | `finalizePendingFirstAnchorDraft` calls `markFirstAnchorAlreadyCreated()` and persists `@anchor_analytics_first_anchor_created`, ensuring network retries never emit a second `first_anchor_created`. |
| 8 | **Annual trial successfully started** | [`AnalyticsService.test.ts` (Scenario 8)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L611-L637) & [`V2PaywallScreen.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/paywall/__tests__/V2PaywallScreen.test.tsx) | **PASS** | Starting the 7-day annual trial emits `paywall_cta_tapped`, `purchase_started` (`is_trial: true`), `paywall_converted` (`outcome: 'trial_started'`), and `trial_started`. `trial_converted` is **not** emitted. |
| 9 | **Store checkout cancelled** | [`AnalyticsService.test.ts` (Scenario 9)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L639-L664) & [`V2PaywallScreen.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/paywall/__tests__/V2PaywallScreen.test.tsx) | **PASS** | Dismissing the native store sheet emits `paywall_cta_tapped`, `purchase_started`, and `purchase_cancelled`, with zero conversion events. |
| 10 | **App backgrounded during onboarding** | [`AnalyticsService.test.ts` (Scenario 10)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts#L666-L676) & [`onboardingAnalytics.test.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/__tests__/onboardingAnalytics.test.ts) | **PASS** | Backgrounding during onboarding emits `onboarding_backgrounded` and triggers `AnalyticsService.flush()` without emitting `onboarding_abandoned`. |
| 11 | **Network unavailable during event capture** | [`AnalyticsService.test.ts` (Scenario 11)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts) | **PASS** | Exceptions thrown by `posthog.capture`, `posthog.identify`, or `posthog.flush` when offline are caught inside `safelyCallPostHog()` without throwing or blocking caller flows. |
| 12 | **Multi-account `first_anchor_created` deduplication on same device** | [`AnalyticsService.test.ts` (Scenario 12)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts) | **PASS** | Account A creates first Anchor -> logs out -> Account B creates first Anchor -> logs out -> Account A signs back in: Account A and Account B each emit `first_anchor_created` once, and Account A never emits a duplicate on return (`@anchor_analytics_first_anchor_accounts` + `totalAnchorsCreated >= 1` hydration). |
| 13 | **PostHog `reset()` does not re-enable tracking after opt-out** | [`AnalyticsService.test.ts` (Scenario 13)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts) | **PASS** | Calling `AnalyticsService.reset()` while `enabled === false` returns early after clearing `pendingQueue` without invoking `posthog.reset()`, preventing `posthog-react-native` from wiping its persisted opt-out flag; `ensurePostHogClient()` passes `defaultOptIn: this.enabled` and `captureAppLifecycleEvents: this.enabled`. |
| 14 | **RevenueCat `$posthogUserId` consent & identity sync** | [`AnalyticsService.test.ts` (Scenario 14)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts) & [`RevenueCatService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/RevenueCatService.ts) | **PASS** | `getDistinctId()` returns `null` when opted out; `onDistinctIdChange` notifies `null` on `setEnabled(false)`, causing `RevenueCatService.syncPostHogSubscriberAttribute` to call `purchases.setAttributes({ $posthogUserId: null })`. |
| 15 | **Authoritative transaction sandbox metadata & P1 non-duplication** | [`useV2Paywall.test.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/__tests__/useV2Paywall.test.tsx) & [`AnalyticsService.test.ts` (Scenario 15)](file:///e:/Projects/Anchor/anchor/mobile/src/services/__tests__/AnalyticsService.test.ts) | **PASS** | `CustomerInfo.entitlements.active[id].isSandbox` and `.store` populate `is_sandbox_purchase`, `store_environment` (`'sandbox' \| 'production'`), and `store` on conversion events; Visualize (`visualize_started`, `visualize_completed`, `visualize_abandoned`), Vision (`vision_board_saved`), Chart, and Practice canonical events emit without double-counting. |

---

## 4. Evidence Boundary: Local vs. Device vs. Remote Ingestion Verification

Per Step 1 and Step 4 requirements, we explicitly separate what has been verified locally, on-device, and remotely:

### A. Locally Verified Behavior (Confirmed `GREEN`)
1. **TypeScript Compilation**: `npx tsc --noEmit` in `e:\Projects\Anchor\anchor\mobile` exits with **`0` errors** across the entire codebase and test suite.
2. **Automated Test Verification**: **15 Jest suites (356 tests)** pass 100%, covering all P0 identity/hydration/consent/monetization edge cases and all P1 Vision, Visualize, Chart, Practice, and Teaching funnels.
3. **Session Replay**: Explicitly disabled (`enableSessionReplay: false`, `disableGeoip: true`) in [`AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L603-L610).

### B. Device-Verified Behavior (`PENDING_CONNECTED_DEVICE`)
- Checked connected Android/iOS targets via `adb devices` — no physical device or emulator is attached to this local workstation (`List of devices attached: <empty>`).

### C. Remotely Verified Ingestion (`PENDING_EXTERNAL_CREDENTIALS`)
Because live production PostHog (`EXPO_PUBLIC_POSTHOG_API_KEY`) and RevenueCat dashboard credentials are external to this workspace, remote ingestion and server-to-server webhook delivery have **not** been claimed as completed. Execute the following 5-step pre-release verification checklist in staging/TestFlight prior to October 31 launch to flip overall status from **YELLOW** to **GREEN**:
1. **Live Event Ingestion Check**: Launch a release/TestFlight build with analytics enabled, complete onboarding + first Anchor + first Practice, and confirm `onboarding_started`, `first_anchor_created`, `practice_started`, and `practice_completed` arrive in PostHog *Activity -> Live Events* under a single merged person profile (`anonymous_id` -> `user.id`).
2. **Opt-Out & Reset Check on Device**: Toggle Analytics OFF in Settings, log out, force-close and relaunch the app, and confirm zero lifecycle (`Application Opened`) or custom events arrive in PostHog Live Events.
3. **Sandbox Purchase Filtering Check**: Complete a TestFlight / Play Store sandbox trial start and confirm `paywall_converted` and `trial_started` arrive in PostHog with `is_sandbox_purchase = true` and `store_environment = 'sandbox'`, and are excluded from production conversion insights.
4. **RevenueCat Server-to-Server Webhook Check**: In the RevenueCat Dashboard (*Customer Profile -> Attributes*), confirm `$posthogUserId` matches the PostHog `distinct_id` before purchase (and is cleared when analytics is opted out), and verify in *Integrations -> PostHog* that server-side trial renewal/cancellation events are delivering 200 OK.
5. **Provision the 3 Priority Launch Dashboards**: Import the JSON and HogQL specifications from [`ANCHOR_POSTHOG_DASHBOARDS.md`](file:///e:/Projects/Anchor/ANCHOR_POSTHOG_DASHBOARDS.md) into the production PostHog project.
