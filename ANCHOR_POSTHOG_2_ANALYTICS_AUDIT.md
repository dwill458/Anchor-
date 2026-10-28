# ANCHOR 2.0 — POSTHOG ANALYTICS AUDIT (`ANCHOR_POSTHOG_2_ANALYTICS_AUDIT.md`)

**Target Release:** October 31, 2026  
**Audit Date:** October 27, 2026  
**Scope:** Mobile Client (`anchor/mobile/src`) & Backend (`backend/src`)  
**PostHog SDK:** `posthog-react-native` (`^4.53.0`) | RevenueCat SDK: `react-native-purchases` (`^9.15.2`) | Sentry SDK: `@sentry/react-native` (`~8.28.0`)

---

## 1. Executive Summary

Anchor 1.5 established a solid centralized analytics wrapper ([`AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts)) and flow telemetry layer ([`FrictionAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/FrictionAnalytics.ts)), along with domain helpers created during the Anchor 2.0 transition ([`onboardingAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/onboardingAnalytics.ts), [`teachingAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/utils/v2/teachingAnalytics.ts), [`useVisionGenerationAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/vision/useVisionGenerationAnalytics.ts)).

However, our code audit uncovered **three launch-blocking analytics defects** and **several event coverage/naming gaps** across the Anchor 2.0 user journey:

1. **CRITICAL — Unauthenticated Cold-Start Identity Wipe (`App.tsx` & `authStore.ts`):**
   - [`App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L563-L577) calls `AnalyticsService.reset()` and `FrictionAnalytics.reset()` in an effect whenever `user?.id` is falsy — including on every cold start for anonymous and guest users.
   - [`authStore.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/authStore.ts#L167-L180) also calls `applyUserToSubscriptionStore(null)` during storage rehydration (`onRehydrateStorage`), which triggers `AnalyticsService.reset()` when no user is signed in.
   - Because `this.posthog.reset()` generates a brand-new PostHog `distinct_id`, **every anonymous/guest user receives a new anonymous identity on every app launch**, severing multi-session onboarding funnels, guest retention cohorts, and anonymous-to-authenticated user linking.
2. **CRITICAL — Pre-Initialization Event Drop (`App.tsx` & `AnalyticsService.ts`):**
   - [`App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L550-L561) defers `AnalyticsService.initialize()` until `analyticsPreferenceHydrated` becomes `true`.
   - Any events (`splash_started`, `app_opened`, initial screen views, `onboarding_started`) or `identify()` calls fired before preference hydration finishes hit `this.posthog === null` in [`AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L597-L600) and are silently dropped from PostHog in production.
3. **CRITICAL — Misleading Trial vs. Paid Conversion Semantics (`useV2Paywall.ts`):**
   - In [`useV2Paywall.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts#L115-L120), `trackConverted` fires `AnalyticsEvents.TRIAL_CONVERTED` (`trial_converted`) when `outcome === 'trial_started'`.
   - In Anchor 1.5 ([`PaywallScreen.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/paywall/PaywallScreen.tsx#L627)), `trial_converted` meant converting *from* a trial *into* a paid subscription. Firing `trial_converted` on a free trial start conflates free trial starts with paid conversions and corrupts historical 1.5 vs. 2.0 monetization reporting.

---

## 2. Confirmed Repository Findings

### 2.1 PostHog SDK Initialization & Configuration
- **Location:** [`anchor/mobile/src/services/AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L525-L561)
- **Configuration:**
  - `host`: `process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'`
  - `apiKey`: `process.env.EXPO_PUBLIC_POSTHOG_API_KEY`
  - `flushAt`: `20` events
  - `flushInterval`: `30000` ms (30 seconds)
  - `enableSessionReplay`: `false`
- **Gaps Identified:**
  - Events and `identify()` calls triggered before `AnalyticsService.initialize()` completes are not queued and are lost when `this.posthog` is instantiated milliseconds later.
  - Shared context properties on every event currently include only `app_version`, `platform`, `userId`, and `timestamp`. Missing standardized Anchor 2.0 context properties: `experience_version` (`'2.0'` vs `'1.5'`), `environment` (`'development' | 'staging' | 'production'`), `subscription_tier` (`'free' | 'trial' | 'pro'`), and `account_state` (`'anonymous' | 'guest_with_anchor' | 'authenticated'`).

### 2.2 User Identification & Anonymous Identity Management
- **Locations:**
  - [`anchor/mobile/App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L563-L577)
  - [`anchor/mobile/src/stores/authStore.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/authStore.ts#L167-L180)
  - [`anchor/mobile/src/services/AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L685-L692)
- **Confirmed Behavior:**
  - When authenticated, `AnalyticsService.identify(user.id, ...)` calls `this.posthog.identify(userId, sanitizedProps)`, which links the current PostHog anonymous `distinct_id` to `user.id`.
  - However, on unauthenticated startup, both `authStore.onRehydrateStorage` and `App.tsx` invoke `AnalyticsService.reset()` when `user` is `null`.
  - **Fix Required:** `AnalyticsService.reset()` must only invoke `this.posthog.reset()` when transitioning from a previously identified user (`this.userId !== null`) to signed-out, or when explicitly forced on privacy opt-out.

### 2.3 Navigation & Screen Tracking
- **Locations:**
  - [`anchor/mobile/App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L1011-L1028) (`onReady` and `onStateChange` on `NavigationContainer`)
  - [`anchor/mobile/src/services/FrictionAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/FrictionAnalytics.ts#L28-L51)
- **Confirmed Behavior:**
  - Every route change calls `AnalyticsService.screen(currentRouteName)` and `FrictionAnalytics.trackRouteViewed(currentRouteName, ...)`.
  - **Gap:** `ROUTE_FLOW_STEPS` in `FrictionAnalytics.ts` only maps legacy 1.5 route names (`Welcome`, `IntentionInput`, `AIGenerating`, `AnchorReveal`, `Paywall`, etc.) and does not include Anchor 2.0 routes (`V2FirstRun`, `AnchorCreationFlow`, `V2DevelopmentHome`, `V2Practice`, `V2Vision`, `V2Chart`, `V2Paywall`, `V2Release`, `V2WeeklyInsight`).

### 2.4 Error & Performance Tracking
- **Locations:**
  - [`anchor/mobile/src/services/ErrorTrackingService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/ErrorTrackingService.ts) (Sentry)
  - [`anchor/mobile/src/services/FrictionAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/FrictionAnalytics.ts#L194-L216) (`flow_error`)
  - [`anchor/mobile/src/services/ApiClient.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/ApiClient.ts) (`api_error`)
  - [`anchor/mobile/src/services/PerformanceMonitoring.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/PerformanceMonitoring.ts)
- **Confirmed Behavior:**
  - Sentry initializes with `piiScrubbing: true`, `attachScreenshot: false`, `attachViewHierarchy: false`.
  - `AnalyticsEvents.ERROR_OCCURRED` and `AnalyticsEvents.API_ERROR` exist, and `FrictionAnalytics.flowError` emits `flow_error`.

### 2.5 RevenueCat Integration & Subscription Events
- **Locations:**
  - [`anchor/mobile/src/services/RevenueCatService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/RevenueCatService.ts)
  - [`anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts)
  - [`anchor/mobile/src/screens/v2/paywall/V2PaywallScreen.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/paywall/V2PaywallScreen.tsx)
- **Confirmed Behavior:**
  - `RevenueCatService.initialize()` configures `Purchases` and syncs customer identity via `Purchases.logIn(appUserId)` when a user authenticates.
  - **Gap 1:** `RevenueCatService` does not set `$posthogUserId` subscriber attribute on RevenueCat (`Purchases.setAttributes({ $posthogUserId })`) when available, which helps RevenueCat's server-side PostHog integration correlate anonymous/authenticated store webhooks to the exact PostHog person.
  - **Gap 2:** Client-side paywall events in `V2PaywallScreen.tsx` and `useV2Paywall.ts` are missing canonical events: `premium_feature_attempted`, `paywall_page_viewed`, `purchase_started`, `purchase_failed`, `purchase_cancelled`, and `restore_attempted`.
  - **Gap 3 (Semantic Bug):** `useV2Paywall.ts` fires `trial_converted` when starting a trial (`outcome === 'trial_started'`). It must fire `trial_started` instead and reserve conversion semantics for paid conversions, while letting RevenueCat remain authoritative for renewals, expirations, and billing lifecycle outcomes.

### 2.6 Backend Analytics Events
- **Location:** [`backend/src/services/AnalyticsService.ts`](file:///e:/Projects/Anchor/backend/src/services/AnalyticsService.ts)
- **Confirmed Behavior:**
  - Backend `AnalyticsService` is currently a structured console logger (`[Analytics] Track: ...`) with a `TODO` for PostHog Node SDK integration. All PostHog event ingestion currently happens via the mobile SDK (and RevenueCat server-to-server integration if configured externally).

### 2.7 Privacy, Consent, and PII Handling
- **Locations:**
  - [`anchor/mobile/App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx#L288-L320) (`resolveEffectiveAnalyticsEnabled`)
  - [`anchor/mobile/src/services/AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L459-L518) (`sanitizeAnalyticsProperties`)
- **Confirmed Behavior:**
  - User opt-out toggle in Settings (`analyticsEnabled`) is persisted in `AsyncStorage` (`@anchor_settings_analytics_enabled`) and respected via `AnalyticsService.setEnabled(effectiveAnalyticsEnabled)` (which calls `this.posthog.optOut()` / `this.posthog.optIn()`).
  - `sanitizeAnalyticsProperties` strips `intention`, `intentionText`, `intention_text`, `distilledLetters`, `distilled_letters`, `svgData`, `svg_data`, `baseSigilSvg`, `enhancedImageUrl`, `image_url`, `image_base64`, `prompt`, `VisualPrompt`, `reinforcement_prompt`, `user_text`, `mantra`, `mantraText`, `journal_entry`, `reflection_text`, `goal_text`, `email`, `name`, `phone`, `scene`, `scene_snapshot`, `next_action`, `text_content`.
  - **Hardening Required:** Add `caption`, `description`, `notes`, `transcript`, `chat_message`, `message_text`, `displayName`, `display_name`, `token`, `idToken`, `accessToken`, `password`, `photo`, `photo_uri`, `uri`, `vision_text`, and `custom_goal` to `SENSITIVE_PROPERTY_KEYS` so no V2 Vision, Chart, Ask Chart, or Auth payloads can ever leak sensitive text or media URIs.

### 2.8 App Lifecycle & Background/Foreground Handling
- **Locations:**
  - [`anchor/mobile/App.tsx`](file:///e:/Projects/Anchor/anchor/mobile/App.tsx)
  - [`anchor/mobile/src/screens/v2/onboarding/V2FirstRunFlow.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2FirstRunFlow.tsx#L120-L127)
  - [`anchor/mobile/src/screens/v2/practice/focus/V2FocusActiveScreen.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusActiveScreen.tsx)
- **Confirmed Behavior:**
  - `V2FirstRunFlow` listens to `AppState` and emits `onboarding_backgrounded`.
  - Practice screens track backgrounding/pausing separately from user-initiated abandonment.
  - **Gap:** When the app backgrounds (`AppState` transitioning to `'background'`), `AnalyticsService.flush()` should be called non-blockingly so queued onboarding, practice, or paywall events are flushed before the OS suspends the process.

---

## 3. Domain-by-Domain Instrumentation Audit (Anchor 1.5 vs. Anchor 2.0)

### A. Onboarding & First Anchor Creation
| Phase 3A Required Event | Current Status in Repo | Audit Notes & Action |
|---|---|---|
| `onboarding_started` | **Present** (`onboardingAnalytics.ts`) | Preserved. Fired once per onboarding session with `resumed`, `restored_step`, `flow_session_id`. |
| `onboarding_step_viewed` | **Present** (`onboardingAnalytics.ts`) | Preserved. Uses stable step IDs (`welcome`, `bridge`, `motivation`, `creation`, `save`, `complete`). |
| `onboarding_step_completed` | **Present** (`onboardingAnalytics.ts`) | Preserved. Includes `step`, `exit` (`continue` \| `back`), `duration_ms`. |
| `onboarding_abandoned` | **Missing** | Emit when onboarding is backgrounded/exited prior to completion (`OnboardingAnalytics.abandoned` / backgrounded on incomplete step). |
| `intention_submitted` | **Missing** | Emit in `IntentionInputScreen.tsx` and `V2CreationFlow.tsx` when user submits intention (category, input mode, length bucket — never raw text). |
| `anchor_generation_started` | **Partial** (`v2_creation_ai_started` / `FrictionAnalytics`) | Emit canonical `anchor_generation_started` in `AnchorGenerationService.ts` and `V2CreationFlow.tsx`. |
| `anchor_generation_completed` | **Partial** (`v2_creation_ai_completed`) | Emit canonical `anchor_generation_completed` with `duration_ms`, `retry_count`, `variation_count`, `received_two_variations`. |
| `anchor_generation_failed` | **Partial** (`v2_creation_ai_failed` / `flow_error`) | Emit canonical `anchor_generation_failed` with `duration_ms`, `retry_count`, `error_category`. |
| `anchor_variations_presented` | **Missing** | Emit in `AnchorCreationFlowScreen.tsx` and `V2CreationFlow.tsx` when generated variations are presented (`variation_count`, `received_two_variations`). |
| `anchor_selected` | **Partial** (`v2_creation_variation_selected`) | Emit canonical `anchor_selected` in `AnchorCreationFlowScreen.tsx` and `V2CreationFlow.tsx`. |
| `account_save_prompt_viewed` | **Partial** (`onboarding_step_viewed` `step: 'save'`) | Emit canonical `account_save_prompt_viewed` when `V2SealedSaveScreen` mounts. |
| `account_save_skipped` | **Partial** (`auth_guest_chosen`) | Emit canonical `account_save_skipped` when user chooses guest path in `V2SealedSaveScreen`. |
| `account_created` | **Partial** (`auth_succeeded` / `sign_up_completed`) | Emit canonical `account_created` on account registration (`V2SealedSaveScreen`, `V2AuthScreen`, `authStore`), including `from_guest_skip: boolean` to track deferred sign-ups without double-counting. |
| `first_anchor_created` | **Missing** | Emit once upon confirmed persistence of the user's first Anchor (`useSaveAnchor.ts`, `V2CreationFlow.tsx`), guarded against double-counting when a guest later registers and syncs their first Anchor to the server. |

### B. Practice, Thread Strength, Milestones & Release
| Phase 3B Required Event | Current Status in Repo | Audit Notes & Action |
|---|---|---|
| `practice_mode_viewed` | **Missing** | Emit in `V2PracticeScreen.tsx` when user selects/views Focus, Deep Prime, or Visualize mode preparation. |
| `practice_started` | **Legacy Name** (`practice_session_started`) | Emit canonical `practice_started` alongside `practice_session_started` for backward compatibility. |
| `practice_completed` | **Legacy Name** (`practice_session_completed`) | Emit canonical `practice_completed` in `PracticeCompletionService.ts` with `practice_mode`, `planned_duration_ms`, `actual_duration_ms`, `completion_status`, `strength_before`, `strength_after`, `strength_delta`. |
| `practice_abandoned` | **Legacy Name** (`practice_session_ended_early`) | Emit canonical `practice_abandoned` with `practice_mode`, `planned_duration_ms`, `actual_duration_ms`, `exit_reason`. |
| `practice_failed` | **Missing** | Emit canonical `practice_failed` when session persistence or playback fails (`V2PracticeSessionScreen.tsx`, `V2CinematicSessionScreen.tsx`). |
| `thread_strength_changed` | **Missing** | Emit in `PracticeCompletionService.ts` when Thread Strength changes (`strength_before`, `strength_after`, `strength_delta`, `practice_mode`). |
| `milestone_earned` | **Missing** | Emit in `milestoneSnapshots.ts` (`mergeAnchorMilestones`) when new milestone IDs are unlocked (`milestone_id`, `tier`, `category`). |
| `release_completed` | **Missing in V2** (1.5 used `burn_completed`) | Emit canonical `release_completed` in `useV2Release.ts` when server confirms release (`reason`, `has_successor`, `has_linked_course`, `has_linked_vision`). |

### C. Vision
| Phase 3C Required Event | Current Status in Repo | Audit Notes & Action |
|---|---|---|
| `vision_opened` | **Present** (`V2VisionScreen.tsx`) | Preserved. |
| `vision_generation_started` | **Named `vision_image_generation_started`** | Emit canonical `vision_generation_started` alongside existing event in `useV2VisionGeneration.ts` and `useV2VisionSceneGeneration.ts`. |
| `vision_generation_completed` | **Named `vision_image_generation_completed`** | Emit canonical `vision_generation_completed` with `duration_ms`, `retry_count`, `candidate_count`, `provider`. |
| `vision_generation_failed` | **Named `vision_image_generation_failed`** | Emit canonical `vision_generation_failed` with `retry_count`, `error_category`. |
| `vision_image_selected` | **Present** (`VisionCeremony.tsx`, `useV2Vision.ts`) | Preserved. |
| `vision_photo_added` | **Partial** (`vision_image_add_started`) | Emit canonical `vision_photo_added` when a user photo (camera/library) is confirmed and added (`source_type: 'camera' \| 'library'`). |
| `vision_board_saved` | **Named `vision_created` / `vision_seal_completed`** | Emit canonical `vision_board_saved` when Vision board creation or scene addition is saved. |
| `visualize_started` | **Missing** (only `practice_session_started`) | Emit canonical `visualize_started` in `V2CinematicSessionScreen.tsx` with `duration_preset_seconds`, `planned_duration_ms`. |
| `visualize_completed` | **Missing** (only `practice_session_completed`) | Emit canonical `visualize_completed` with `duration_preset_seconds`, `planned_duration_ms`, `actual_duration_ms`. |
| `visualize_abandoned` | **Missing** (only `practice_session_ended_early`) | Emit canonical `visualize_abandoned` with `duration_preset_seconds`, `planned_duration_ms`, `actual_duration_ms`, `exit_reason`. |

### D. Chart & Ask Chart
| Phase 3D Required Event | Current Status in Repo | Audit Notes & Action |
|---|---|---|
| `chart_opened` | **Present** (`V2ChartScreen.tsx`) | Preserved. |
| `chart_planning_started` | **Named `chart_creation_started` / `chart_ask_plan_requested`** | Emit canonical `chart_planning_started` in `ChartCreationFlow.tsx`. |
| `chart_generated` | **Named `chart_generation_succeeded`** | Emit canonical `chart_generated` in `ChartCreationFlow.tsx` with `duration_ms`, `waypoint_count`, `move_count`. |
| `chart_generation_failed` | **Present** (`ChartCreationFlow.tsx`) | Preserved. |
| `chart_approved` | **Named `chart_created`** | Emit canonical `chart_approved` when the user approves and saves the generated Chart in `ChartCreationFlow.tsx`. |
| `chart_adjustment_requested` | **Named `chart_route_adjusted`** | Emit canonical `chart_adjustment_requested` in `ChartCreationFlow.tsx` (`submitAdjust`) and `V2ChartAdjustScreen.tsx`. |
| `one_move_opened` | **Missing** | Emit `one_move_opened` when the active Chart sheet opens/displays the current One Move in `ChartActiveView.tsx`. |
| `one_move_completed` | **Named `chart_move_completed`** | Emit canonical `one_move_completed` in `useAnchorChart.ts` (`completeMove`). |
| `ask_chart_opened` | **Present** (`V2ChartAskScreen.tsx`) | Preserved. |
| `ask_chart_message_sent` | **Named `ask_chart_turn` (on response)** | Emit canonical `ask_chart_message_sent` when the user sends a message in `useAskChart.ts` (safe metadata only: `skill`, `has_attachments`, `message_length` — never message text). |
| `waypoint_reached` | **Named `chart_waypoint_completed`** | Emit canonical `waypoint_reached` in `useAnchorChart.ts` (`reachWaypoint`). |

### E. Paywall & Subscriptions
| Phase 3E Required Event | Current Status in Repo | Audit Notes & Action |
|---|---|---|
| `premium_feature_attempted` | **Missing** | Emit when a gated feature is attempted (or on paywall entry with feature trigger context) with `feature_trigger`, `entry_point`, `subscription_tier`. |
| `paywall_viewed` | **Present** (`V2PaywallScreen.tsx`) | Preserved; enrich with `entry_point`, `paywall_page: 1`, `selected_plan`, `trial_eligible`, `store_platform`. |
| `paywall_page_viewed` | **Partial** (`paywall_step2_viewed`) | Emit canonical `paywall_page_viewed` for page 1 and page 2 (`paywall_page: 1 \| 2`, `entry_point`). |
| `paywall_plan_selected` | **Present** (`V2PaywallScreen.tsx`) | Preserved; enrich with `selected_plan`, `trial_eligible`, `store_platform`. |
| `paywall_cta_tapped` | **Present** (`useV2Paywall.ts`) | Preserved; enrich with `selected_plan`, `trial_eligible`, `store_platform`, `paywall_page`. |
| `paywall_dismissed` | **Present** (`V2PaywallScreen.tsx`) | Preserved. |
| `purchase_started` | **Missing** | Emit in `useV2Paywall.ts` when store transaction starts (`plan`, `productId`, `is_trial_offer`, `store_platform`). |
| `purchase_failed` | **Missing** | Emit in `useV2Paywall.ts` when store transaction fails (`plan`, `productId`, `error_category`, `store_platform`). |
| `purchase_cancelled` | **Missing** | Emit in `useV2Paywall.ts` when user dismisses the store sheet (`plan`, `productId`, `store_platform`). |
| `restore_attempted` | **Named `paywall_restore_tapped`** | Emit canonical `restore_attempted` in `useV2Paywall.ts` with `outcome: 'started' \| 'restored' \| 'no_purchases_found' \| 'failed'`. |

### F. Teaching, Notifications, Sharing & Progress
| Phase 3F Required Event | Current Status in Repo | Audit Notes & Action |
|---|---|---|
| `teaching_shown` | **Named `teaching_beat_shown`** | Emit canonical `teaching_shown` alongside `teaching_beat_shown` in `teachingAnalytics.ts` and `guidanceCoordinator.ts` (`teaching_id`, `screen`, `surface`). |
| `teaching_dismissed` | **Named `teaching_beat_dismissed`** | Emit canonical `teaching_dismissed` alongside `teaching_beat_dismissed` (`teaching_id`, `screen`, `reason`). |
| `teaching_action_taken` | **Named `teaching_beat_advanced`** | Emit canonical `teaching_action_taken` when user advances or completes a guided action (`teaching_id`, `screen`, `action`). |
| `notification_permission_result` | **Partial** (`notification_permission_granted` / `denied`) | Emit canonical `notification_permission_result` (`result: 'granted' \| 'denied' \| 'blocked'`, `source`) in `useReminderEnrollment.ts` and `useNotificationController.ts`. |
| `reminder_enabled` | **Named `personal_reminder_enabled`** | Emit canonical `reminder_enabled` (`hour`, `minute`, `reminder_type`) alongside `personal_reminder_enabled`. |
| `notification_opened` | **Present** (`AnalyticsEvents.NOTIFICATION_OPENED`) | Ensure `NotificationService` emits `notification_opened` with `category`, `template_id`, `action` when user taps a notification. |
| `share_studio_opened` | **Present** (`AnchorShareStudio.tsx`) | Preserved (`share_studio_opened`). |
| `share_exported` | **Named `anchor_export_saved` / `anchor_export_shared`** | Emit canonical `share_exported` (`export_action: 'save' \| 'share'`, `layout`, `show_mark`) in `AnchorShareStudio.tsx`. |
| `weekly_insight_opened` | **Missing** | Emit `weekly_insight_opened` on mount in `V2WeeklyInsightScreen.tsx` and `V2WeeklyRecapScreen.tsx` (`experience_variant: 'v2_recap' \| 'v2_insight'`, `has_anchor_filter`). |

---

## 4. Phase 6 Evaluation — Session Replay & Privacy Masking

- **Current State:** `enableSessionReplay: false` in [`AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L540).
- **Risk Assessment:**
  - Anchor 2.0 renders deeply personal user content across multiple custom surfaces:
    1. Free-form intention input and handwritten/drawn intentions (`IntentionInputScreen`, `V2CreationFlow`).
    2. User-uploaded personal photographs and custom scene descriptions in Vision (`V2VisionScreen`, `VisionCeremony`).
    3. Multi-turn personal coaching conversations and image attachments in Ask Chart (`V2ChartAskScreen`).
    4. Custom Skia/SVG canvases (`ChartMap`, `AnchorSharePreview`, `V2CinematicSessionScreen`).
  - In `posthog-react-native`, React Native Skia canvases and native image pickers require explicit view masking verification on physical iOS and Android devices to guarantee that screenshots do not capture unmasked frames.
- **Launch Decision (Confirmed):**
  - **Keep `enableSessionReplay: false` for the October 31, 2026 launch.**
  - Do not enable Session Replay in production until physical-device masking verification is completed on iOS and Android for all text inputs, personal photos, Vision boards, and Ask Chart threads, and explicit session-recording consent is surfaced.

---

## 5. Assumptions & Items Requiring External Verification

1. **PostHog Project Environment Variables in EAS Build:**
   - *Requires External Verification:* Confirm that `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` are populated in the production EAS build profile (`eas.json` / Expo Secrets) before cutting the October 31 release binary.
2. **RevenueCat Server-to-Server PostHog Integration:**
   - *Requires External Verification:* In the RevenueCat Dashboard (Integrations -> PostHog), verify that RevenueCat is configured to forward authoritative billing lifecycle events (`rc_trial_started_event`, `rc_trial_converted_event`, `rc_initial_purchase_event`, `rc_renewal_event`, `rc_cancellation_event`, `rc_expiration_event`) to the production PostHog project.
   - Our client implementation will now sync `$posthogUserId` via `Purchases.setAttributes` so RevenueCat webhook events join cleanly to the PostHog user profile.
3. **PostHog Dashboards Provisioning:**
   - *External Environment Note:* No PostHog personal API key or MCP server is connected to this workspace. Therefore, in Phase 5 we provide complete, reproducible PostHog dashboard definitions, HogQL queries, and insight JSON specifications in [`ANCHOR_POSTHOG_DASHBOARDS.md`](file:///e:/Projects/Anchor/ANCHOR_POSTHOG_DASHBOARDS.md).
