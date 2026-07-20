# Anchor Recent-Change Regression Audit

**Date:** 2026-07-14  
**Branch:** `codex/widgets-location-priming`  
**Current commit:** `bd9c05fefc93c6f8a77a97cbdfcc86c8e6fecc9a` — *Harden milestone history and delivery*  
**Last known stable commit:** `4c296c0` — *Merge remote-tracking branch `origin/main` into `codex/widgets-location-priming`*  
**Regression window:** `498e56b` through `bd9c05f`, plus the current uncommitted 16-file working-tree diff  
**Implementation status:** Audit only. No production code changed.

## Executive Verdict

Recent changes contain one confirmed P1 data-integrity regression in the current working-tree change set. The new first-anchor reminder eligibility check introduces an `await` after the creation button is re-enabled. A second tap creates a second anchor with a fresh idempotency key; neither the client nor the backend can identify that as the retry of the first request.

The most important affected system is the anchor-creation lifecycle. The same change also exposes an existing multi-writer notification-state pattern to a new, common path: a user whose device permission is already granted. That risk is highly likely but was not reproduced against a real delayed response in this audit.

The recent entitlement work is materially safer than the prior client-only implementation: anchor creation is enforced transactionally on the backend and the billing refresh endpoint derives the RevenueCat user from authenticated server state. No confirmed recent security defect, secret exposure, or client-controlled price/access bypass was found in the reviewed path.

**Current build status: Hold release.** Do not ship the current working-tree patch until REG-001 is fixed and covered by a behavioral double-tap regression test.

## Regression Map

| Severity | Bug | Introduced by | User impact | Reproducible | Recommended action |
|---|---|---|---|---|---|
| P1 | A second press can create a duplicate anchor while the reminder check is pending | Uncommitted working-tree diff after `bd9c05f` | Duplicate saved anchors; trial/pro daily limits can be consumed twice; duplicate creation analytics and follow-on notifications | Yes, by delaying notification eligibility and pressing again after the button is re-enabled | Keep the operation locked through reminder resolution; reuse the same idempotency key only for a real retry |

## Confirmed Regressions

### REG-001: First-anchor reminder check reopens the create action before navigation

**Severity:** P1  
**Confidence:** Confirmed by control-flow inspection  
**Introduced by:** Current uncommitted change to `AnchorRevealScreen.tsx` and `useNotificationController.ts`  
**Affected files:**

- `anchor/mobile/src/screens/create/AnchorRevealScreen.tsx:162-359`
- `anchor/mobile/src/hooks/useNotificationController.ts:697-714`

**Affected users:** Authenticated trial and Pro users creating an anchor; guest first-anchor flow has the same re-entry window for local/pending creation.  
**Affected platforms:** iOS and Android.

**Expected behavior**

One press of **Begin Priming** represents one anchor creation. The control remains unavailable until the app has either navigated away or opened the reminder card. A retry of the same network operation must reuse the original idempotency key.

**Actual behavior**

`handleContinue` clears `isSaving` in its `finally` block at line 307. It then starts `handleAnchorSaved()` without awaiting it and awaits `canOfferFirstAnchorReminder()` at line 359. That eligibility function performs AsyncStorage and native permission I/O and writes notification state. During that await, React renders the button enabled (`disabled={isSaving}` at line 500). A second press re-enters `handleContinue`.

Each invocation creates a new random `idempotencyKey` at line 197. The backend's idempotency protection therefore treats the second press as an unrelated creation, and can persist two anchors with the same user-provided content.

**Reproduction steps**

1. Use an authenticated account below its anchor limit with no existing anchors.
2. Arrange a slow `NotificationService.getPermissionStatus()` or AsyncStorage read (a test mock is sufficient).
3. Tap **Begin Priming** once and wait for the anchor POST to finish.
4. Before the reminder eligibility promise resolves, tap **Begin Priming** again.
5. Observe two `/api/anchors` requests with distinct idempotency keys and two created anchors.

**Execution path**

`Begin Priming` → `AnchorRevealScreen.handleContinue` → create POST → `setIsSaving(false)` → local `addAnchor` / `void handleAnchorSaved()` → `await canOfferFirstAnchorReminder()` → button is enabled before either reminder-card display or navigation. A second invocation repeats the path with a new key.

**Root cause**

The loading state is released when backend persistence finishes, rather than when the full user action finishes. The new asynchronous reminder eligibility operation was inserted after that release. This did not yield to the event loop in the previous version: it read the already-hydrated `notifState` synchronously and immediately showed the card or navigated.

**Why this is a regression**

Before the current diff, the post-save decision used synchronous `notifState` checks. The button was only exposed for an effectively synchronous tail of the handler. The new `await` introduces a real re-entry interval after `isSaving` has become false.

**Sibling risks**

- Duplicate guest pending-first-anchor mutations.
- Duplicate `ANCHOR_CREATION_COMPLETED` analytics and friction events.
- Trial-anchor and paid-Pro daily-cap consumption twice for a single intended anchor.
- More than one reminder-card/navigation attempt if both invocations reach the first-anchor branch.

**Recommended fix**

Keep a synchronous in-flight ref (for example, `creationInFlightRef`) set before any awaited work and clear it only after navigation or after the reminder card has been made visible. Keep the button disabled for the same interval. Do not rely on React state alone for a same-tick re-entry guard. Preserve one idempotency key for the entire logical creation attempt; generate a new key only when the user deliberately starts a new attempt after the prior operation settles.

**Regression tests required**

- Render `AnchorRevealScreen` with `canOfferFirstAnchorReminder` held by a deferred promise; press **Begin Priming** twice after the POST resolves but before that promise resolves; assert one create request, one local anchor, and one navigation/card transition.
- Repeat for guest first-anchor finalization; assert exactly one pending mutation.
- Repeat for an offline first POST/retry; assert the retry retains one idempotency key and no second user gesture can create another request.

## Unconfirmed but High-Risk Findings

### HR-001: Concurrent notification-state writers can restore stale reminder choices

**Severity:** P1  
**Confidence:** Highly likely; delayed-response integration scenario not executed in this audit  
**Introduced/exposed by:** Current uncommitted reminder-eligibility change; the underlying full-snapshot notification synchronization predates it  
**Affected files:**

- `anchor/mobile/src/screens/create/AnchorRevealScreen.tsx:350-359`
- `anchor/mobile/src/hooks/useNotificationController.ts:63-70, 682-714, 732-747`
- `anchor/mobile/src/components/notifications/DailyReminderPrompt.tsx:76-139`
- `anchor/mobile/src/services/NotificationSyncService.ts:71-87`
- `backend/src/api/routes/auth.ts:880-885`

**Evidence and risk**

`AnchorRevealScreen` starts `handleAnchorSaved()` fire-and-forget, then calls the new eligibility function. `DailyReminderPrompt` mounts a second `useNotificationController` instance and writes the same `@anchor_notification_state` key. Its **Not Now** and **Done** handlers also call `completeReminderPrompt()` fire-and-forget before dismissing the screen.

Each controller reads and writes a complete state snapshot. The server merges a submitted JSON object shallowly (`notification_state = existing || submitted`), so a delayed request containing the older values overwrites the newer values for every colliding key. After the current change, this is reachable for first-anchor users whose operating-system permission is already granted—the exact group newly allowed to see the card.

**Failure scenario**

1. `handleAnchorSaved` reads pre-card notification state and its server sync is delayed.
2. The user is shown the new granted-permission card, selects a reminder time or taps Not Now, and the prompt instance saves `dailyPrimeEnabled`, time, and completion state.
3. The earlier request completes later and saves its older server response over AsyncStorage.
4. On the next launch, UI state can disagree with the scheduled native notification or the completion state can be stale.

**Recommended fix**

Serialize notification-state mutations behind one module-level queue/mutex and make all actions mutate the latest committed state. Prefer field-level patches with a monotonic revision (or compare-and-swap) over full snapshots. Await prompt resolution before allowing navigation. At minimum, make `handleAnchorSaved` finish before opening the first-anchor card and have a single controller own the flow.

**Tests required**

- Delay the `handleAnchorSaved` sync response, complete a granted-permission first-anchor reminder, then release the older response; assert persisted and server state retain `firstAnchorReminderPromptCompleted` and the selected `dailyPrimeTime`.
- Repeat for Not Now, denied permission, offline sync/retry, app restart, logout/login, and account switch.
- Verify only one controller mutation sequence is active per account.

### HR-002: Server and client RevenueCat entitlement interpretation can disagree on configuration error

**Severity:** P2  
**Confidence:** Suspected configuration-sensitive issue  
**Introduced by:** `9f496f1` billing hardening  
**Affected files:**

- `anchor/mobile/src/services/RevenueCatService.ts:177-221`
- `backend/src/services/RevenueCatEntitlementService.ts:58-78`
- `anchor/mobile/src/screens/paywall/PaywallScreen.tsx:559-628`

The mobile SDK intentionally falls back to any active entitlement, and then to active store subscription IDs, when the configured entitlement mapping is absent. The server accepts only `REVENUECAT_ENTITLEMENT_ID` (default `pro`). A dashboard mapping error can therefore produce a store-confirmed purchase that the mobile SDK recognizes but the server rejects, leaving the purchaser on the paywall. This is a safe failure rather than an unauthorized unlock, but it is a paid-user access risk.

Use one shared, deployed entitlement identifier and add a release-health check that compares the mobile build setting, backend setting, active offering package IDs, and RevenueCat entitlement identifier. Do not weaken the server confirmation requirement.

## Test Coverage Gaps

- No `AnchorRevealScreen` behavioral test covers a second press after backend success but before reminder eligibility resolves.
- The new `canOfferFirstAnchorReminder` tests verify granted/denied eligibility only; they do not exercise the screen, create request, navigation, persistence, or a delayed response.
- Notification tests mock controller methods independently. They do not model the two-controller, one-storage-key race or out-of-order server responses.
- Billing tests cover forged client fields and server unavailability, but not a valid store purchase under a mismatched client/server entitlement mapping.
- No deployment test applies the full Prisma migration chain against an empty database and an upgrade fixture. `prisma validate` validates schema shape only; it does not execute migrations.

## Test Results

### Mobile targeted suites

`npm test -- --runInBand` passed **17 suites / 244 tests**:

- notification controller, Daily Reminder Prompt, auth store, Auth Hydration
- main navigation, Practice, Charge Setup, Paywall
- milestone tracking, forge-moment store, session store, storage classification
- notification rules, RevenueCat service/subscription store, widget bridge and large widget

`npx tsc --noEmit` passed.

### Backend targeted suites

`npm test -- --runInBand` passed **4 suites / 96 tests**:

- billing route
- anchors route
- auth route
- RevenueCat entitlement service

`npx prisma validate` and `npx tsc --noEmit` passed.

### Hygiene/security checks

- `git diff --check` passed.
- No tracked `.env` file was found; only `.env.example` files are tracked.
- The reviewed billing endpoint requires Firebase authentication, derives the RevenueCat app user ID server-side, and ignores client-submitted product/price/user fields.
- No recent hard-coded secret or exposed `EXPO_PUBLIC_*` secret pattern was found by the targeted scan.

Passing tests do not cover REG-001 because the suite does not render the screen with a deferred eligibility call and a repeated press.

## Release Recommendation

**Hold release.**

REG-001 can create duplicate user data and consume time-limited creation capacity. Fix it before release, add the behavioral regression coverage, and run the focused suite again. Address HR-001 in the same patch if the first-anchor granted-permission card is intended to ship; otherwise the new path can leave reminder state stale after a delayed sync.

## Fix Order

1. **REG-001 — data integrity:** keep anchor creation locked until the final navigation/card state is committed; add the double-tap test.
2. **HR-001 — notification state correctness:** serialize notification updates, eliminate full-snapshot stale overwrites, and add delayed-response/account-switch coverage.
3. **HR-002 — subscription access reliability:** validate production RevenueCat entitlement configuration across client/server before rollout.
4. Add an integration migration-chain test for fresh install and upgrade paths.
5. Retest free, trial, and Pro creation limits after the creation-flow fix.

## Audit Scope and Evidence

The review covered current working-tree changes and the post-`4c296c0` commits: widget/location priming (`498e56b`), entitlement gates (`14cdacb`), billing/widget hardening (`9f496f1`), and milestone-history delivery (`bd9c05f`). It traced the current creation/reminder path, auth/session clearing, notification storage/sync, server-side creation limits, billing confirmation, recent migrations, and the relevant test suites. Existing uncommitted work was inspected only; no source or production configuration was modified.
