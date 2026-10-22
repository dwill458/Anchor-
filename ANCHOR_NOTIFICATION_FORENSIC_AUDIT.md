# ANCHOR 2.0 — Notification System Forensic Audit

**Date:** October 9, 2026  
**Auditor:** Senior React Native / Expo Notification Infrastructure Specialist  
**Target:** Anchor Mobile (v2.0.0, Expo SDK 54, React Native 0.81.5), Node.js Backend, Supabase Edge Functions & Migrations  
**Audit Scope:** READ-ONLY Forensic Investigation of Notification Infrastructure, Lifecycle Reliability, and Platform Behavior  

---

## 1. Executive Summary

### Forensic Verdict
Anchor’s notification subsystem is **NOT production-ready**. However, **it does not require an entire architectural rewrite**. The core failures stem from a combination of **critical architectural severance during the Anchor 2.0 redesign**, **conflicting multi-tier scheduling engines**, **faulty lifecycle assumptions**, and **platform-specific native configuration defects**.

### What Is Broken
1. **Total Lifecycle Severance in Anchor 2.0:** With `EXPO_PUBLIC_ANCHOR_V2_ENABLED=true` active across all build profiles, the entire app renders `AnchorV2Navigator`. Not a single Anchor 2.0 screen (`screens/v2/*`) nor `App.tsx` imports or mounts `useNotificationController`. The hook is only mounted inside `NotificationsSubscreen.tsx` (the Settings screen) and dead v1 screens. Consequently, on normal app opens, anchor creation, or practice completion, **notification state is never reconciled, and local notifications are never re-armed**.
2. **Dead Navigation Routes on Notification Taps:** When a user taps any notification, `App.tsx` dispatches `navRef.navigate('Main')`. Route `'Main'` **does not exist** in `AnchorV2Navigator` (`ANCHOR_V2_ROUTES`). The tap silently fails, leaving the user stranded. Furthermore, on cold launches from a notification tap, `getLastNotificationResponseAsync` executes before `navRef.isReady()`, silently dropping the tap.
3. **Priority Inversion Wipes Daily Reminders:** `evaluateNotificationRules` prioritizes `thread_strength` ahead of `daily_prime`. For new or lapsing users with thread strength $< 70\%$, a one-shot alert is scheduled for $T + 5\text{ minutes}$. Because `evaluateNotificationRules.find()` halts on the first eligible candidate, `daily_prime` is discarded, and line 385 explicitly executes `cancelSmartNotifications()`, **wiping out the entire 7-day Daily Practice horizon**. If the user does not reopen the app, they receive one alert 5 minutes later and **never receive another notification again**.
4. **Finite One-Shot Horizons vs. Native Repeating Triggers:** Rather than utilizing operating-system native repeating alarms (`SchedulableTriggerInputTypes.DAILY`), the smart scheduler manually schedules 7 one-shot `DATE` triggers. If a user does not open Anchor within 7 days, all 7 alarms lapse, and the app goes permanently silent. The native repeating method (`NotificationService.scheduleDailyReminder`) exists in the codebase but was orphaned.
5. **Missing Native Sound Resources on Android:** `NotificationService.ts` registers Android channels referencing `notification-daily.wav`, `notification-checkpoint.wav`, and `notification-weekly.wav`. In native Android (`android/app/src/main/res/raw/`), **only `notification.wav` exists**. Furthermore, hyphenated names violate Android resource naming conventions.
6. **Remote Push Token Failure Silently Disables Local Reminders:** If `Notifications.getDevicePushTokenAsync()` fails (e.g. offline, simulator, or credential delay), `NotificationService.getRemotePushRegistration()` catches the error and returns `permissionGranted: false`. `useNotificationController.ts` interprets this as a user denial, sets `state.notificationPermissionStatus = 'denied'`, and permanently suppresses all local notifications.
7. **Decommissioned Backend Push Infrastructure:** Supabase Edge Function `trigger-all.ts` attempts to send remote notifications to FCM using `https://fcm.googleapis.com/fcm/send`—a legacy endpoint permanently decommissioned by Google in June 2024. Direct APNs is completely unimplemented. Remote Expo pushes omit Android `channelId` and iOS `sound`.

### What Works
- OS permission prompting flow (`Notifications.requestPermissionsAsync`) behaves correctly when explicitly initiated by the user.
- Android notification channel creation logic (`createAndroidChannels`) correctly deletes legacy channel IDs and sets high importance for critical alerts.
- Chart notifications (`chartNotifications.ts`) provide an isolated, well-bounded scheduling model for chart-specific weekly recaps and idle nudges.
- Unit tests for template formatting and date math pass consistently within their isolated mock harnesses.

### Confidence Level
**Confirmed:** All findings detailed below have been verified directly against source code files, native manifests, build profiles, and database schemas with exact line-by-line evidence.

---

## 2. Current Architecture

### Complete Notification System Map

```
                     ┌──────────────────────────────────────────────────────────────┐
                     │                   USER INTERACTION                           │
                     └───────────────────────┬──────────────────────────────────────┘
                                             │
                       ┌─────────────────────┴──────────────────────┐
                       │                                            │
                       ▼                                            ▼
        Settings / NotificationsSubscreen             Anchor 2.0 Workflows
        (Mounts useNotificationController)            (screens/v2/*: Home, Creation,
                       │                               Practice, Vision, Chart)
                       ▼                                            │
        ┌───────────────────────────────┐                           ▼
        │   useNotificationController   │                  [NO NOTIFICATION HOOK
        │   - initOnAppOpen             │                   OR LIFECYCLE CALLS]
        │   - scheduleSmartNotifications│                           │
        │   - toggleNotifications       │                           ▼
        └──────────────┬────────────────┘                  State Never Synced
                       │                                   Horizon Never Armed
         ┌─────────────┴───────────────┐
         ▼                             ▼
┌────────────────────────┐  ┌──────────────────────────────────┐
│ notificationRules.ts   │  │ NotificationSyncService.ts       │
│ Priority:              │  │ PUT /api/auth/notification-state │
│ 1. thread_strength     │  └──────────────────┬───────────────┘
│ 2. unfinished_anchor   │                     │
│ 3. weekly_recap        │                     ▼
│ 4. daily_prime (Horizon)│  ┌──────────────────────────────────┐
└────────┬───────────────┘  │ Node.js Backend (Express)        │
         │                  │ routes/auth.ts                   │
         ▼                  │ Updates 'users' table in Postgres│
┌────────────────────────┐  └──────────────────┬───────────────┘
│ NotificationService.ts │                     │
│ scheduleNotification-  │                     ▼
│ Async (Local DATE /    │  ┌──────────────────────────────────┐
│ DAILY triggers)        │  │ PostgreSQL ('users' table)       │
└────────┬───────────────┘  │ notification_state, expo_push_token│
         │                  └──────────────────┬───────────────┘
         ▼                                     │
┌────────────────────────┐                     ▼
│ Device OS AlarmManager │  ┌──────────────────────────────────┐
│ / UNUserNotification-  │  │ pg_cron (Hourly cron trigger)    │
│ Center                 │  │ net.http_post to trigger-all     │
└────────────────────────┘  └──────────────────┬───────────────┘
                                               │
                                               ▼
                            ┌──────────────────────────────────┐
                            │ Supabase Edge Function           │
                            │ trigger-all.ts                   │
                            │ - Expo Push API                  │
                            │ - Dead FCM Legacy API            │
                            └──────────────────────────────────┘
```

### Architecture Inventory Matrix

| Subsystem Component | Active / Inactive / Orphaned | File Path & Identifiers | Purpose / Mechanism |
| :--- | :--- | :--- | :--- |
| **Smart Controller** | **Partially Active** (Settings only) | [`useNotificationController.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/useNotificationController.ts#L149) | Evaluates rules, coordinates 7-day horizon, syncs state to server. |
| **Notification Rules** | **Active** (via Controller) | [`notificationRules.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/notifications/notificationRules.ts#L318) | Rule evaluation for thread strength, unfinished anchor, weekly recap, daily prime. |
| **Core Local Service** | **Active** | [`NotificationService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationService.ts#L127) | Wraps `expo-notifications`, manages channels, triggers local notifications. |
| **Chart Notifications** | **Active** (Chart view only) | [`chartNotifications.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/notifications/chartNotifications.ts#L169) | Local recap & idle nudges (`chart-recap:*`, `chart-idle:*`). |
| **Trial End Reminder** | **Active** (Paywall only) | [`trialReminder.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/trialReminder.ts#L35) | Local notification scheduled 2 days before trial ends. |
| **Daily Goal Nudges** | **Orphaned** | [`DailyGoalNudgeService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/DailyGoalNudgeService.ts#L136) | Checkpoint nudges (`daily-goal-checkpoint:*`). Never called in v2 production. |
| **Legacy Repeating Daily** | **Orphaned** | [`NotificationService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationService.ts#L273) | `scheduleDailyReminder()` uses `DAILY` repeating trigger; bypassed by Smart Controller. |
| **Legacy Priority Resolver** | **Dead Code** | [`NotificationPriority.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationPriority.ts#L10) | V1 Alchemist/Weaver/Mirror/Micro-Prime priority resolver. Unused. |
| **Legacy Eligibility** | **Dead Code** | [`NotificationEligibility.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationEligibility.ts#L6) | V1 eligibility evaluator. Unused. |
| **Tap Response Handler** | **Active (Broken)** | [`App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L789) | Listens to notification responses; navigates to non-existent `'Main'` route. |
| **Backend State API** | **Active** | [`backend/src/api/routes/auth.ts`](file:///e:/Projects/Anchor/backend/src/api/routes/auth.ts#L1017) | `PUT /api/auth/notification-state` persists state and push tokens in PostgreSQL. |
| **Remote Push Cron** | **Active (Broken)** | [`supabase/functions/notifications/trigger-all.ts`](file:///e:/Projects/Anchor/supabase/functions/notifications/trigger-all.ts#L435) | Hourly cron worker sending push notifications via Expo and dead FCM API. |

---

## 3. Critical Findings

### Finding 1: Anchor 2.0 Architectural Severance (Root Lifecycle Disconnect)
- **Severity:** Critical
- **Confidence:** Confirmed
- **File & Lines:** [`App.tsx#L940`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L940), [`eas.json#L22`](file:///e:/Projects/Anchor/anchor/mobile/eas.json#L22), [`useNotificationController.ts#L149`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/useNotificationController.ts#L149)
- **Evidence:**  
  In `eas.json`, all build profiles specify `"EXPO_PUBLIC_ANCHOR_V2_ENABLED": "true"`. `App.tsx` line 940 mounts `<AnchorV2Navigator />`. A complete audit of `src/screens/v2/` reveals **zero** imports of `useNotificationController`, `NotificationService`, or notification lifecycle triggers.  
  `useNotificationController` is only imported in `NotificationsSubscreen.tsx` and legacy v1 screens (`screens/rituals/*`, `screens/practice/*`).
- **Failure Impact:**  
  When a user launches Anchor 2.0, creates anchors, or completes daily practice, `useNotificationController` is never executed. `initOnAppOpen` never fires. `handlePrimeComplete` is never called. Notification state is never updated, and local notifications are never re-armed.
- **Correction:**  
  Lift notification initialization into an application-level root provider mounted inside `App.tsx` (or `AnchorV2Navigator`), and connect practice completion events in `V2FocusCompleteScreen.tsx` directly to the notification lifecycle.
- **Estimated Complexity:** Low (1 day)

---

### Finding 2: Notification Tap Routes to Non-Existent `'Main'` Screen & Drops Cold Starts
- **Severity:** Critical
- **Confidence:** Confirmed
- **File & Lines:** [`App.tsx#L789-L839`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L789-L839), [`routes.ts#L7-L23`](file:///e:/Projects/Anchor/anchor/mobile/src/navigation/v2/routes.ts#L7-L23)
- **Evidence:**  
  Lines 806–813 of `App.tsx`:
  ```typescript
  switch (action.action) {
    case 'open_daily_reminder':
    case 'open_streak_protection':
    case 'open_weekly_summary':
    case 'open_notification_category':
      navRef.navigate('Main');
      break;
  }
  ```
  In `ANCHOR_V2_ROUTES`, the registered routes are `V2FirstRun`, `V2DevelopmentHome`, `V2Practice`, `V2Vision`, `V2Chart`, etc. There is **no route named `'Main'`**.  
  Additionally, on cold launch, line 831 calls `Notifications.getLastNotificationResponseAsync()`. Line 802 immediately checks:
  ```typescript
  if (!navRef.isReady()) {
    return;
  }
  ```
  When the app is launching, `navRef.isReady()` is `false`. The cold-start tap response is silently discarded.
- **Failure Impact:**  
  Tapping a notification never takes the user to their practice, anchor, or chart. On cold launches, the tap does nothing; on warm launches, it fails with a navigation warning or stays on the current screen.
- **Correction:**  
  Queue pending launch notification responses until `navRef.isReady()` is true, and map notification categories to valid Anchor 2.0 routes (`V2DevelopmentHome`, `V2Practice`, `V2Chart`).
- **Estimated Complexity:** Low (0.5 day)

---

### Finding 3: Priority Inversion Cancels Daily Practice 7-Day Horizon
- **Severity:** Critical
- **Confidence:** Confirmed
- **File & Lines:** [`notificationRules.ts#L318-L328`](file:///e:/Projects/Anchor/anchor/mobile/src/services/notifications/notificationRules.ts#L318-L328), [`notificationRules.ts#L224-L239`](file:///e:/Projects/Anchor/anchor/mobile/src/services/notifications/notificationRules.ts#L224-L239), [`useNotificationController.ts#L384-L425`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/useNotificationController.ts#L384-L425)
- **Evidence:**  
  `evaluateNotificationRules` orders rules:
  1. `evaluateThreadStrength`
  2. `evaluateUnfinishedAnchor`
  3. `evaluateWeeklyRecap`
  4. `evaluateDailyPrime`  
  If a user has not practiced today and thread strength is $< 70\%$, `evaluateThreadStrength` generates a fire date of $T + 5\text{ minutes}$ (`SOON_MS`).  
  `scheduleSmartNotifications` finds the first matching rule (`thread_strength`). It calls:
  ```typescript
  await cancelSmartNotifications(context);
  ```
  which executes:
  ```typescript
  NotificationService.cancelSmartNotificationSeries('daily_prime', DAILY_PRIME_HORIZON_DAYS);
  ```
  `scheduleDailyPrimeHorizon()` is only invoked if `result.category === 'daily_prime'`.
- **Failure Impact:**  
  When an alert (such as thread strength) fires, the entire 7-day Daily Practice reminder queue is deleted. The app schedules a single notification 5 minutes out. If the user does not open the app again, **they never receive another notification**.
- **Correction:**  
  Decouple the Daily Practice reminder from transient engagement alerts. Daily Practice reminders should use an independent, un-preemptible native repeating schedule.
- **Estimated Complexity:** Medium (1 day)

---

### Finding 4: Finite Horizon vs. True Repeating Schedules
- **Severity:** High
- **Confidence:** Confirmed
- **File & Lines:** [`useNotificationController.ts#L63-L74`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/useNotificationController.ts#L63-L74), [`useNotificationController.ts#L121-L134`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/useNotificationController.ts#L121-L134), [`NotificationService.ts#L577-L581`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationService.ts#L577-L581)
- **Evidence:**  
  `scheduleDailyPrimeHorizon` generates 7 individual `SchedulableTriggerInputTypes.DATE` one-shot notifications (`dayOffset = 1; dayOffset < 7`).  
  `NotificationService.ts` contains `buildDailyTrigger` (`SchedulableTriggerInputTypes.DAILY`), which repeats indefinitely at OS level without app execution, but it is **only** used by `scheduleDailyReminder`, which is never called by the active controller.
- **Failure Impact:**  
  If a user is inactive for 8 days, all 7 scheduled alarms have passed. The device has no scheduled alarms remaining. The app cannot re-arm them unless the user opens it.
- **Correction:**  
  Switch Daily Practice reminders to `SchedulableTriggerInputTypes.DAILY`.
- **Estimated Complexity:** Low (0.5 day)

---

### Finding 5: Missing Android Notification Sound Assets & Illegal File Names
- **Severity:** High
- **Confidence:** Confirmed
- **File & Lines:** [`NotificationService.ts#L33-L36`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationService.ts#L33-L36), [`NotificationService.ts#L743-L780`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationService.ts#L743-L780), [`android/app/src/main/res/raw/`](file:///e:/Projects/Anchor/anchor/mobile/android/app/src/main/res/raw/)
- **Evidence:**  
  `NotificationService.ts` lines 748, 756, 778 configure Android channels with:
  - `sound: 'notification-daily.wav'`
  - `sound: 'notification-checkpoint.wav'`
  - `sound: 'notification-weekly.wav'`  
  Inspection of `android/app/src/main/res/raw/` shows that **only `notification.wav` exists**. The other three files are missing. Furthermore, Android resource names cannot contain hyphens.
- **Failure Impact:**  
  On Android devices, channel creation can fail or fallback to silent notification delivery. Because `ensureAndroidChannels()` is called prior to scheduling any notification, any channel exception aborts the entire scheduling call.
- **Correction:**  
  Copy and rename sound files to valid Android resource identifiers (`notification_daily.wav`, etc.) in `res/raw` or revert to the standard default system notification sound.
- **Estimated Complexity:** Low (0.5 day)

---

### Finding 6: Push Registration Failure Falsely Overwrites Permission to 'Denied'
- **Severity:** High
- **Confidence:** Confirmed
- **File & Lines:** [`NotificationService.ts#L233-L248`](file:///e:/Projects/Anchor/anchor/mobile/src/services/NotificationService.ts#L233-L248), [`useNotificationController.ts#L617-L623`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/useNotificationController.ts#L617-L623), [`notificationRules.ts#L148-L150`](file:///e:/Projects/Anchor/anchor/mobile/src/services/notifications/notificationRules.ts#L148-L150)
- **Evidence:**  
  In `NotificationService.getRemotePushRegistration()`:
  ```typescript
  } catch (error) {
    this.recordError(new ServiceError('notifications/permission-request-failed', ...));
    return {
      permissionGranted: false,
      expoPushToken: null,
      fcmToken: null,
      apnsToken: null,
    };
  }
  ```
  In `useNotificationController.ts`:
  ```typescript
  if (registration.permissionGranted) {
    state.notificationPermissionStatus = 'granted';
  } else {
    state.notificationPermissionStatus = 'denied';
  }
  ```
  In `notificationRules.ts`:
  ```typescript
  if (!state.notification_enabled || state.notificationPermissionStatus !== 'granted') {
    return false;
  }
  ```
- **Failure Impact:**  
  If a user grants OS notification permissions, but remote token generation fails (e.g. offline, simulator, APNs network delay), `permissionGranted` is returned as `false`. The controller updates local state to `'denied'`. `canSendCategory` subsequently rejects all local notifications.
- **Correction:**  
  Separate OS permission status from remote push token registration. Remote token acquisition failure should never overwrite local notification permission.
- **Estimated Complexity:** Low (0.5 day)

---

### Finding 7: Backend Push Deliveries Use Decommissioned FCM API & Lack APNs
- **Severity:** High
- **Confidence:** Confirmed
- **File & Lines:** [`trigger-all.ts#L340-L389`](file:///e:/Projects/Anchor/supabase/functions/notifications/trigger-all.ts#L340-L389)
- **Evidence:**  
  `trigger-all.ts` line 348 posts to:
  `https://fcm.googleapis.com/fcm/send`  
  This is the legacy FCM HTTP API, which Google **permanently shut down in June 2024**. Any FCM push requests sent to this endpoint fail. Furthermore, line 335 shows that direct APNs delivery is completely unimplemented.
- **Failure Impact:**  
  Any fallback or direct FCM/APNs remote push delivery fails permanently.
- **Correction:**  
  Standardize on Expo Push API (`https://exp.host/--/api/v2/push/send`) or migrate to FCM v1 HTTP API (`https://fcm.googleapis.com/v1/projects/...`).
- **Estimated Complexity:** Medium (1 day)

---

### Finding 8: Stale Token Retention and Cross-Account Push Pollution
- **Severity:** Medium
- **Confidence:** Confirmed
- **File & Lines:** [`authStore.ts#L1085-L1096`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/authStore.ts#L1085-L1096), [`backend/src/api/routes/auth.ts#L1066-L1084`](file:///e:/Projects/Anchor/backend/src/api/routes/auth.ts#L1066-L1084)
- **Evidence:**  
  `authStore.signOut()` does not invoke `clearPushTokensFromServer()`. When user B signs in on a device previously used by user A, `syncPushTokensToServer()` updates user B's row in PostgreSQL, but **does not clear the token from user A's row**.
- **Failure Impact:**  
  Both user accounts have the identical `expo_push_token` stored in the database. When the Supabase cron runs, `trigger-all.ts` sends notifications for both users to the same physical device, resulting in duplicate and cross-account notifications.
- **Correction:**  
  Clear push tokens on sign out, and update backend `PUT /api/auth/notification-state` to disassociate a push token from any existing user before assigning it to a new one.
- **Estimated Complexity:** Low (0.5 day)

---

## 4. iOS Findings

### 1. APNs Credentials & Entitlements
- **Entitlements:** In `app.json`, `ios` configuration does **not** specify `aps-environment` in an entitlements block. When building via EAS, Expo automatically handles push notification entitlements if credentials are configured in the Expo Dashboard.
- **APNs Key Requirement:** In standalone builds (TestFlight / App Store), `Notifications.getExpoPushTokenAsync()` requires that an Apple Push Notification Key (`.p8`) be uploaded to the Expo project (`8fc5bf55-b18f-41c9-a8ce-767b307debb7`). If this key is missing or expired, Expo Push tickets fail with `DeviceNotRegistered` or APNs rejection.

### 2. Foreground Presentation Options
- In `NotificationService.ts` lines 22–29:
  ```typescript
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  ```
  This configuration adheres to iOS guidelines for displaying banners while the app is foregrounded.

### 3. Simulator Behavior
- `Notifications.getDevicePushTokenAsync()` fails on standard iOS Simulators unless running on Apple Silicon with macOS 13+ and configured APNs credentials. As noted in Finding 6, this error cascades and marks permissions as `denied`.

### 4. Silent Remote Notifications
- Remote payloads in `trigger-all.ts` (`sendExpoPush`) do not specify `"sound": "default"`. On iOS, an APNs payload without a sound key is delivered silently into the notification center without waking the screen or making an audible alert.

---

## 5. Android Findings

### 1. Runtime Permissions (Android 13+ / API 33+)
- `app.json` line 136 and `AndroidManifest.xml` line 7 correctly request `android.permission.POST_NOTIFICATIONS`.
- However, if the user grants OS permissions, but the app fails to fetch a remote token, the controller treats it as denied.

### 2. Android Notification Channels
- Android 8.0+ (API 26+) requires that every notification be posted to a valid notification channel.
- In `NotificationService.ts`, `createAndroidChannels()` registers 5 channels with `AndroidImportance.HIGH` and `DEFAULT`.
- **Channel Versioning:** Android locks channel importance upon initial creation. Anchor correctly appends `-v3` to channel IDs to force updates on reinstall or migration.
- **Sound Crash / Fallback:** As noted in Finding 5, channels reference non-existent sound files (`notification-daily.wav`), leading to silent fallback or channel setup failure.

### 3. AlarmManager, Doze Mode, and Inexact Timing
- Local notifications scheduled via `expo-notifications` utilize Android's `AlarmManager`.
- Android 14+ (API 34+) and Android 15 (API 35, target SDK in `build.gradle`) heavily restrict exact alarms. Without `SCHEDULE_EXACT_ALARM` or `USE_EXACT_ALARM`, alarms scheduled via `AlarmManager` are subject to Doze mode batching. Notifications can be delayed by 15–60 minutes unless the user whitelists the app or the device exits maintenance windows.

### 4. Android Status Bar Icon
- `app.json` does not configure `icon` or `color` under the `expo-notifications` plugin.
- On Android, notifications fall back to `ic_launcher`. Because this is a multi-color adaptive icon rather than a white silhouette on transparent background, Android displays a solid white circle or distorted grey box.

---

## 6. Backend Findings

### 1. Node.js Backend Scope
- The Node.js Express backend (`anchor-backend`) contains **no scheduling workers, queues, or push dispatch logic**.
- Its sole notification responsibility is providing the endpoint `PUT /api/auth/notification-state` ([`auth.ts#L1017`](file:///e:/Projects/Anchor/backend/src/api/routes/auth.ts#L1017)), which merges incoming JSON state and push tokens into the `users` table.

### 2. Supabase Cron and Edge Function Dispatch
- Push scheduling is executed by `supabase/functions/notifications/trigger-all.ts`, driven by `supabase/migrations/20260529000000_notifications_hourly_cron.sql`.
- The migration schedules an hourly cron via `cron.schedule`:
  ```sql
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/notifications/trigger-all',
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  ```
- **Vault Dependency:** If `vault.decrypted_secrets` lacks `project_url` or `service_role_key`, the URL evaluates to `NULL` and `net.http_post` silently fails.

### 3. Push Ticket vs. Receipt Verification
- In `trigger-all.ts` lines 286–295, the service inspects the HTTP response from `https://exp.host/--/api/v2/push/send`.
- An HTTP `ok` ticket from Expo **only** indicates that the Expo push server received the request. It does **not** indicate that APNs or FCM accepted it. The backend never queries `https://exp.host/--/api/v2/push/getReceipts`. True delivery failures are completely invisible.

### 4. Conflicting Local and Remote Schedulers
- The mobile app schedules local notifications for `daily_prime`.
- Simultaneously, the Supabase cron executes `trigger-all.ts`, which evaluates whether the current UTC hour matches the user's `dailyPrimeTime` and dispatches a remote push.
- If both local and remote delivery are active, the user receives **duplicate notifications** for the same event.

---

## 7. Historical Failure Hypotheses

Based on forensic evidence, the observed failure symptoms across Anchor 1.0, 1.5, and 2.0 can be attributed to four distinct phases:

| Symptom Observed | Root Cause Mechanism Identified | Confidence |
| :--- | :--- | :--- |
| **"Notifications stopped after 1–7 days"** | **Finite Horizon Lapse:** Local reminders used one-shot `DATE` triggers (a 7-day queue). If the user did not open the app to trigger a re-arm cycle, the queue ran dry. | **Confirmed** |
| **"User set a daily reminder, but received an alert 5 minutes later and never heard from Anchor again"** | **Priority Inversion / Horizon Wipe:** `evaluateThreadStrength` fired on lapsing users (strength $< 70\%$) with a 5-minute delay. Because it was evaluated first, it wiped out the 7-day `daily_prime` horizon. | **Confirmed** |
| **"Enabled notifications in settings, but nothing ever arrived"** | **Token Failure Cascade:** Fetching push tokens offline or on simulator failed, causing the app to mark permissions as `denied` locally, suppressing all local scheduling. | **Confirmed** |
| **"Android reminders never fired on 1.0"** | **CALENDAR Trigger Incompatibility:** `expo-notifications` rejected `CALENDAR` triggers on Android with an unhandled native error (repaired in commit `e033689d`, but replaced with fragile one-shot horizon). | **Confirmed** |
| **"Silent notifications on Android"** | **Missing Sound Assets:** Android channels configured with missing/hyphenated sound files in `res/raw` defaulted to silent. | **Confirmed** |
| **"Anchor 2.0 complete silence"** | **Architectural Severance:** Switching to `AnchorV2Navigator` disconnected `useNotificationController` completely from the user lifecycle. | **Confirmed** |

---

## 8. Recommended Anchor 2.0 Architecture

### Core Philosophy: "Single Source of Truth, Native Repeating Alarms"
Anchor 2.0 does not need complex AI-driven push logic or conflicting cloud crons. The most reliable mobile reminder architecture uses **local OS repeating triggers for core habits**, with server-side push reserved exclusively for transactional or cross-device re-engagement.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ANCHOR 2.0 NOTIFICATION MODEL                   │
├────────────────────────────────┬───────────────────────────────────────┤
│ Notification Category          │ Execution Mechanism                   │
├────────────────────────────────┼───────────────────────────────────────┤
│ 1. Daily Practice Reminder     │ Local OS Native Repeating (DAILY)     │
│ 2. Consistency / Thread Alert  │ Local One-Shot (Scheduled on session) │
│ 3. Chart / One Move Reminder   │ Local One-Shot (chartNotifications.ts)│
│ 4. Re-engagement / Inactivity  │ Server-Driven Push (Supabase Cron)    │
│ 5. Trial Expiration Warning    │ Local One-Shot (trialReminder.ts)     │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Architectural Guarantees
1. **No Competing Schedulers:**
   - The user's primary habit (Daily Practice) is owned **exclusively** by the local device using `SchedulableTriggerInputTypes.DAILY`. The server cron **never** sends Daily Practice reminders if local notifications are active.
2. **Infinite Repeating Daily Habit:**
   - Replacing the 7-day one-shot horizon with a native repeating daily trigger ensures reminders fire indefinitely, even if the user does not open the app for 30 days.
3. **Decoupled Priority:**
   - Engagement alerts (Thread Strength, Chart moves) must **never** cancel or preempt the Daily Practice schedule.
4. **Resilient Permission State:**
   - Local permission state must reflect solely `Notifications.getPermissionsAsync()`. Remote token errors must never downgrade local permission to denied.
5. **Universal Root Lifecycle:**
   - Notification initialization and lifecycle monitoring must be housed in a root provider mounted at the top level of `App.tsx`, active regardless of which navigation stack is displayed.

---

## 9. Prioritized Repair Plan

### P0 — Must Fix Before Launch (Launch Blockers)

1. **Mount Notification Provider at App Root:**
   - Create a lightweight `NotificationProvider` wrapping `<NavigationContainer>` in `App.tsx`.
   - Ensure `initOnAppOpen()` and state reconciliation execute on every app launch in Anchor 2.0.
   - Wire `V2FocusCompleteScreen.tsx` to notify completion so `primed_today` updates correctly.
2. **Fix Notification Tap Navigation in `App.tsx`:**
   - Replace `'Main'` route dispatches in `App.tsx` with valid Anchor 2.0 targets (`V2DevelopmentHome`, `V2Practice`).
   - Implement navigation readiness queuing to prevent cold-start notification taps from being dropped.
3. **Decouple Daily Practice from Horizon Cancellation:**
   - Convert Daily Practice reminders in `NotificationService.ts` to `SchedulableTriggerInputTypes.DAILY`.
   - Prevent `cancelSmartNotifications()` from wiping out Daily Practice reminders when an alert is scheduled.
4. **Isolate Remote Token Failures from Local Permissions:**
   - In `useNotificationController.ts`, decouple `state.notificationPermissionStatus` from `registration.permissionGranted`.
5. **Fix Android Notification Sounds & Assets:**
   - Remove missing custom sound references (`notification-daily.wav`, etc.) from Android channel setup or place valid non-hyphenated sound files in `android/app/src/main/res/raw/`.

### P1 — Important Reliability Improvements

1. **Configure Android Notification Icon:**
   - Add a clean, monochrome 96x96 PNG notification icon to `app.json` under `expo-notifications` config plugin.
2. **Disable Competing Supabase Daily Prime Push:**
   - In `supabase/functions/notifications/trigger-all.ts`, disable `daily_prime` push dispatches so server pushes do not double-fire against local repeating reminders.
3. **Fix Token Clearing on Sign Out:**
   - Call `clearPushTokensFromServer()` inside `authStore.signOut()`.
   - Ensure `PUT /api/auth/notification-state` clears a token from previous user rows before assigning it to a new user.
4. **Decommission Dead FCM Legacy Endpoint:**
   - Remove `https://fcm.googleapis.com/fcm/send` from `trigger-all.ts` to prevent failing requests.

### P2 — Future Enhancements

1. **Expo Push Receipt Processing:**
   - Implement an asynchronous worker to query `/api/v2/push/getReceipts` and automatically purge pruned device tokens.
2. **Timezone Transition Listener:**
   - Listen for device timezone changes on app resume and automatically adjust repeating reminder schedules.
3. **Quiet Hours Enforcement for Server Pushes:**
   - Add a strict user-controlled quiet hours window to server-side push evaluation.

---

## 10. Physical Device Test Matrix

Because native notification delivery involves the operating system kernel, Doze mode, and manufacturer battery management, **unit tests with mocked modules cannot verify delivery**. The following verification plan must be executed on physical hardware:

### Test Suite A: iOS Physical Device (iPhone with iOS 17 / 18)

| Test ID | Scenario | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **IOS-01** | First-time permission prompt | Clean install | Open app -> Settings -> Notifications -> Enable toggle | iOS system dialog appears; granting updates toggle to ON without error. |
| **IOS-02** | Foreground presentation | Reminders enabled | Set test reminder for $T + 1\text{ min}$, keep app open | Banner displays at top of screen with sound; app does not crash. |
| **IOS-03** | Background delivery & sound | Reminders enabled | Set test reminder for $T + 2\text{ min}$, lock device | Screen wakes; banner appears on lock screen; sound plays audibly. |
| **IOS-04** | Cold launch from notification tap | Reminders enabled | Schedule reminder for $T + 1\text{ min}$, force-kill app, tap banner | App cold launches directly into Practice / Home; does not freeze or drop tap. |
| **IOS-05** | App unlaunched for 8+ days | Reminders enabled | Schedule Daily Practice reminder, advance device date by 8 days | Daily Practice reminder fires on day 8 without the app having been opened. |

### Test Suite B: Android Physical Device (Android 13 / 14 / 15)

| Test ID | Scenario | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **AND-01** | POST_NOTIFICATIONS prompt | Clean install | Open app -> Settings -> Notifications -> Enable toggle | Native Android runtime permission prompt displays. |
| **AND-02** | Channel verification in OS Settings | Permission granted | Navigate to Android Settings -> Apps -> Anchor -> Notifications | Channels display: "Daily Reminders", "Thread Strength", etc. with High importance. |
| **AND-03** | Status bar icon rendering | Reminders enabled | Trigger notification | Status bar displays a crisp monochrome icon, not a solid white box or square. |
| **AND-04** | Doze Mode / Lock Screen delivery | Reminders enabled | Schedule reminder for $T + 10\text{ min}$, unplug and lock device | Notification delivers reliably to lock screen without being killed by OS. |
| **AND-05** | Reboot persistence | Reminders enabled | Schedule reminder, reboot physical device, do not open app | Scheduled Daily Practice reminder fires at scheduled time after device reboot. |

---

## 11. Open Questions

1. **Supabase Vault Secrets in Production:**
   - Are `project_url` and `service_role_key` actively populated in Supabase Vault in the live production database, or has the hourly pg_cron job been executing against `NULL`?
2. **Apple APNs Auth Key (.p8) Status in Expo:**
   - Is an active Apple Push Notifications Key uploaded to the EAS project `8fc5bf55-b18f-41c9-a8ce-767b307debb7` on `expo.dev`?
3. **Product Intent on Dual Delivery:**
   - Did the product team intend for Daily Practice reminders to be delivered locally, remotely from the server, or both?

---

## 12. Final Verdict

### Is the current notification system production-ready?
**No.** Anchor’s notification system is currently severed from Anchor 2.0 user flows, dispatches broken navigation routes on tap, wipes out daily reminder queues when engagement alerts fire, and references missing Android sound assets.

### Can it be repaired without a rewrite?
**Yes.** The underlying components (`NotificationService.ts`, `NotificationsSubscreen.tsx`, `chartNotifications.ts`, and `app.json`) are well-structured. The failures are integration and configuration defects, not architectural dead ends. A targeted repair plan will restore complete reliability without rewriting the system.

### What are the three most important fixes?
1. **Reconnect the Notification Lifecycle to Anchor 2.0:** Mount a root notification provider in `App.tsx` and hook practice completion in `V2FocusCompleteScreen.tsx` so state is reconciled and armed during regular use.
2. **Repair Tap Navigation in `App.tsx`:** Route taps to valid Anchor 2.0 screens and queue launch responses until navigation is ready.
3. **Decouple Daily Practice into a Native Repeating Daily Alarm:** Eliminate the fragile 7-day one-shot horizon and prevent transient engagement alerts from cancelling daily reminders.

### What must be verified on physical devices before launch?
1. Delivery of a Daily Practice reminder after 48 hours of app inactivity.
2. Cold-start app launch behavior when tapping a notification on both an iPhone and an Android device.
3. Correct rendering of the notification icon and playback of sound across Android 13+ and iOS 17+.

### What should NOT be changed?
- **Do NOT rebuild `NotificationService.ts` from scratch:** Its Android channel versioning, permission reading, and Expo wrappers are solid.
- **Do NOT touch `chartNotifications.ts`:** Its bounded scheduling model for Chart recap and idle nudges is self-contained and working properly.
- **Do NOT introduce new external notification services (e.g. OneSignal, Braze, Novu):** The existing Expo and native toolset is more than sufficient for Anchor 2.0's requirements and adding external SDKs will only introduce additional failure modes.
