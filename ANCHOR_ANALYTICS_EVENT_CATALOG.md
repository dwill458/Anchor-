# Anchor 2.0 — Canonical PostHog Event Catalog

**Target Release**: October 31, 2026  
**Source of Truth**: [`AnalyticsService.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts), [`FrictionAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/FrictionAnalytics.ts), [`onboardingAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/onboardingAnalytics.ts), [`teachingAnalytics.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/teachingAnalytics.ts)

---

## 1. Shared Event Context & Privacy Contract

Every event emitted through [`AnalyticsService.track()`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L609-L645) or [`AnalyticsService.trackAnonymous()`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L651-L686) automatically attaches the following shared properties:

| Property | Type | Values / Format | Description |
| :--- | :--- | :--- | :--- |
| `timestamp` | `string` (ISO 8601) | e.g. `2026-10-27T23:00:00.000Z` | Client timestamp when event was recorded |
| `platform` | `'ios' \| 'android' \| 'web'` | React Native `Platform.OS` | Client OS platform |
| `app_version` | `string` | e.g. `2.0.0` | Expo runtime app version |
| `experience_version` | `'1.5' \| '2.0'` | `'2.0'` when Anchor 2.0 flag is active | Distinguishes 1.5 legacy vs 2.0 experience |
| `environment` | `'development' \| 'staging' \| 'production'` | Derived from `EXPO_PUBLIC_APP_ENV` / `monitoringConfig.environment` | Runtime environment |
| `is_sandbox` | `boolean` | `true` in `__DEV__` or non-production builds | Segments dev/sandbox activity so it cannot contaminate production reporting |
| `subscription_tier` | `'free' \| 'trial' \| 'pro'` | From [`subscriptionStore`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/subscriptionStore.ts) | User's active entitlement state at event time |
| `account_state` | `'anonymous' \| 'guest_with_anchor' \| 'authenticated'` | From [`authStore`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/authStore.ts) | Whether the user is anonymous, a guest with a local Anchor, or signed in |
| `userId` | `string \| null` (UUID) | Attached only on identified `track()` calls; omitted on `trackAnonymous()` | Canonical backend/Firebase account ID |

### Strictly Redacted Sensitive Keys (`SENSITIVE_PROPERTY_KEYS`)
[`sanitizeAnalyticsProperties()`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts#L387-L423) recursively strips all keys matching:
- **User-generated intentions & text**: `intention`, `intentionText`, `intention_text`, `raw_intention`, `goal_text`, `custom_goal`, `mantra`, `mantra_text`, `distilled_letters`, `prompt`, `negative_prompt`, `user_prompt`
- **Vision & Personal Photos**: `scene`, `scene_text`, `scene_snapshot`, `vision_text`, `caption`, `description`, `notes`, `image_url`, `image_uri`, `photo`, `photo_uri`, `enhanced_image_url`, `svg_data`, `base_sigil_svg`
- **Chart & Ask Chart Content**: `next_action`, `text_content`, `message`, `message_text`, `chat_message`, `transcript`
- **PII & Credentials**: `email`, `displayName`, `display_name`, `token`, `idToken`, `accessToken`, `refreshToken`, `password`

---

## 2. Canonical Event Registry by Domain

### A. Onboarding & Anchor Creation (Phase 3A)

| Canonical Event | Alias / Companion Events | Firing Condition | Key Properties |
| :--- | :--- | :--- | :--- |
| `onboarding_started` | — | Fired once when first-run onboarding begins ([`OnboardingAnalytics.started`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/onboardingAnalytics.ts#L102-L106)) | `flow_version`, `entry_point`, `platform`, `app_version`, `reduced_motion`, `is_returning_device` |
| `onboarding_step_viewed` | `flow_step_viewed` | Fired once per onboarding step arrival ([`OnboardingAnalytics.stepViewed`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/onboardingAnalytics.ts#L108-L115)) | `step_id`, `step_index`, `flow_version` |
| `onboarding_step_completed` | `flow_step_completed` | Fired when user advances past an onboarding step ([`OnboardingAnalytics.stepCompleted`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/onboardingAnalytics.ts#L117-L124)) | `step_id`, `step_index`, `duration_ms`, `selection` |
| `onboarding_abandoned` | `flow_step_abandoned` (`flow: 'onboarding_auth'`) | Fired only on confirmed onboarding exit (`OnboardingAnalytics.abandoned`). **Never aliased from `onboarding_backgrounded`** so temporary app backgrounding is strictly distinguished from abandonment | `step`, `reason` (`'exit'`), `duration_ms` |
| `onboarding_backgrounded` | `app_backgrounded` | Fired when the app transitions to background during onboarding (`OnboardingAnalytics.backgrounded`); triggers `AnalyticsService.flush()` without marking the funnel abandoned | `step`, `flow_session_id` |
| `intention_submitted` | `v2_creation_intention_completed` | Fired when user submits a valid intention in [`IntentionInputScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/create/IntentionInputScreen.tsx) or [`V2CreationFlow`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/creation/V2CreationFlow.tsx) | `category`, `source` (`'typed' \| 'drawn'`), `from_onboarding` (`boolean`), `is_evolve` (`boolean`), `intention_length` (`number`), `distilled_letter_count` (`number`) |
| `anchor_generation_started` | `v2_creation_generation_started`, `v2_creation_ai_started`, `ai_generation_started` | Fired when AI Anchor artwork generation request begins in [`AnchorGenerationService`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnchorGenerationService.ts) or [`V2CreationFlow`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/creation/V2CreationFlow.tsx) | `style_choice`, `category`, `attempt` (`number`), `is_retry` (`boolean`) |
| `anchor_generation_completed` | `v2_creation_generation_completed`, `v2_creation_ai_completed`, `ai_generation_completed` | Fired when AI Anchor generation resolves and candidate variations are ready | `style_choice`, `category`, `attempt` (`number`), `duration_ms` (`number`), `variation_count` (`number`), `received_two_variations` (`boolean`), `provider`, `model_used` |
| `anchor_generation_failed` | `v2_creation_generation_failed`, `v2_creation_ai_failed`, `ai_generation_failed` | Fired when AI Anchor generation throws a network, timeout, or provider failure | `style_choice`, `category`, `attempt` (`number`), `failure_category` (`'network_error' \| 'ai_generation_timeout' \| 'ai_generation_failed'`), `error_code` |
| `anchor_variations_presented` | — | Fired when the 2 generated Anchor variations are displayed to the user in `phase === 'choose'` | `category`, `variation_count` (`number`), `received_two_variations` (`boolean`), `style_choice`, `from_onboarding` (`boolean`) |
| `anchor_selected` | `variation_selected` | Fired when user selects and seals a variation in [`AnchorCreationFlowScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/create/flow/AnchorCreationFlowScreen.tsx) or [`V2CreationFlow`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/creation/V2CreationFlow.tsx) | `category`, `selected_index` (`number`), `variation_count` (`number`), `style_choice`, `from_onboarding` (`boolean`) |
| `account_save_prompt_viewed` | `onboarding_step_viewed` (`step_id: 'account_save_prompt'`) | Fired when [`V2SealedSaveScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx) presents the account backup prompt after sealing the first Anchor | `step_id: 'account_save_prompt'`, `entry_point: 'sealed_save_screen'` |
| `account_save_skipped` | `auth_guest_chosen` | Fired when user taps "Continue without an account" on [`V2SealedSaveScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx) | `source` (`'onboarding_save' \| 'auth_gate'`) |
| `account_created` | `auth_succeeded`, `sign_up_completed` | Fired when account authentication succeeds during onboarding or sign-up | `source`, `method` (`'apple' \| 'google' \| 'email'`), `mode` (`'create' \| 'signin'`), `is_returning_user` (`boolean`) |
| `first_anchor_created` | `anchor_creation_completed` | Fired **at most once** per user lifecycle via [`AnalyticsService.trackFirstAnchorCreatedOnce()`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts) upon confirmed creation of the first Anchor. Backed by in-memory state, per-device `AsyncStorage` (`@anchor_analytics_first_anchor_created`), per-account `AsyncStorage` set (`@anchor_analytics_first_anchor_accounts`), `user.totalAnchorsCreated >= 1` hydration on `identify()`, and [`markFirstAnchorAlreadyCreated()`](file:///e:/Projects/Anchor/anchor/mobile/src/services/AnalyticsService.ts) so guest registration, multi-account switching on the same device (Account A -> Account B -> Account A), app restarts, or `finalizePendingFirstAnchorDraft` retries never emit a duplicate `first_anchor_created` for the same user | `anchor_id`, `account_id`, `category`, `is_guest` (`boolean`), `backend_synced` (`boolean`), `has_enhanced_image` (`boolean`), `structure_variant` |

---

### B. Practice, Thread Strength, Milestones & Release (Phase 3B)

| Canonical Event | Alias / Companion Events | Firing Condition | Key Properties |
| :--- | :--- | :--- | :--- |
| `practice_mode_viewed` | — | Fired when user selects a practice mode in [`V2PracticeScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/V2PracticeScreen.tsx) to open its preparation view | `practice_mode` (`'focus' \| 'deep_prime' \| 'visualize' \| 'release'`), `anchor_id`, `entry_point` (`'practice_hub' \| 'recommended_today'`) |
| `practice_started` | `practice_session_started` | Fired when the active practice session clock actually begins | `practice_mode`, `session_id`, `anchor_id`, `duration_seconds`, `guidance_voice`, `background_audio` |
| `practice_completed` | `practice_session_completed` | Fired by [`PracticeCompletionService.completePracticeSession()`](file:///e:/Projects/Anchor/anchor/mobile/src/services/PracticeCompletionService.ts#L265-L278) only when full planned duration is met and canonical receipt commits | `practice_mode`, `session_id`, `planned_duration_ms`, `actual_duration_ms`, `completion_status` (`'completed'`), `strength_before`, `strength_after`, `strength_delta`, `local_date_key`, `sync_outcome` |
| `practice_abandoned` | `practice_session_abandoned` | Fired when user explicitly exits an active session before completion | `practice_mode`, `session_id`, `anchor_id`, `planned_duration_ms`, `actual_duration_ms`, `exit_reason` |
| `practice_failed` | — | Fired when durable session persistence or guided audio fails during [`V2PracticeSessionScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/V2PracticeSessionScreen.tsx) or [`V2CinematicSessionScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/visualize/V2CinematicSessionScreen.tsx) | `practice_mode`, `session_id`, `anchor_id`, `planned_duration_ms`, `actual_duration_ms`, `error_code` |
| `thread_strength_changed` | — | Fired in [`PracticeCompletionService`](file:///e:/Projects/Anchor/anchor/mobile/src/services/PracticeCompletionService.ts#L280-L295) when an Anchor's Thread Strength updates after practice completion | `anchor_id`, `practice_mode`, `session_id`, `strength_before` (`number`), `strength_after` (`number`), `strength_delta` (`number`) |
| `milestone_earned` | — | Fired in [`applyServerRecords()`](file:///e:/Projects/Anchor/anchor/mobile/src/milestones/milestoneSnapshots.ts#L95-L125) when the server records a newly earned milestone on an Anchor | `milestone_id`, `milestone_type`, `anchor_id` |
| `release_completed` | — | Fired in [`useV2Release`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/release/useV2Release.ts#L216-L234) when the server confirms an Anchor release (`submissionState === 'confirmed'`) | `anchor_id`, `reason` (`'complete' \| 'let_go' \| 'evolve'`), `has_successor` (`boolean`), `has_linked_course` (`boolean`), `has_linked_vision` (`boolean`) |

---

### C. Vision & Visualize (Phase 3C)

| Canonical Event | Alias / Companion Events | Firing Condition | Key Properties |
| :--- | :--- | :--- | :--- |
| `vision_opened` | — | Fired when [`V2VisionScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/vision/V2VisionScreen.tsx) opens | `anchor_id`, `state`, `tile_count` |
| `vision_generation_started` | `vision_image_generation_started` | Fired when AI Vision scene generation begins in [`useVisionGenerationAnalytics`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/vision/useVisionGenerationAnalytics.ts) | `anchor_id`, `job_id`, `mode`, `reference_count` |
| `vision_generation_completed` | `vision_image_generation_completed`, `vision_image_generation_partial` | Fired when AI Vision scene generation finishes (full or partial) | `anchor_id`, `job_id`, `candidate_count`, `duration_ms`, `provider` |
| `vision_generation_failed` | `vision_image_generation_failed` | Fired when AI Vision scene generation fails | `anchor_id`, `job_id`, `error_code`, `duration_ms` |
| `vision_image_selected` | — | Fired when user selects a generated or uploaded scene in [`VisionCeremony`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/vision/ceremony/VisionCeremony.tsx) or [`useV2Vision`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/vision/useV2Vision.ts) | `anchor_id`, `vision_id`, `asset_id`, `source_type` (`'AI_GENERATED' \| 'USER_UPLOAD'`) |
| `vision_photo_added` | — | Fired when user adds a personal photo to Vision in [`VisionCeremony`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/vision/ceremony/VisionCeremony.tsx) or [`useV2Vision.addScene`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/vision/useV2Vision.ts) | `anchor_id`, `vision_id`, `source_type` (`'USER_UPLOAD'`), `count` |
| `vision_board_saved` | `vision_created`, `vision_updated`, `vision_seal_completed` | Fired when a Vision board creation, scene addition, or seal completes | `anchor_id`, `vision_id`, `mode`, `path`, `first_image` (`boolean`), `scene_count`, `layout` |
| `visualize_started` | `practice_session_started` (`practice_mode: 'visualize'`) | Fired when [`V2CinematicSessionScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/visualize/V2CinematicSessionScreen.tsx) starts guided playback | `practice_mode: 'visualize'`, `session_id`, `anchor_id`, `duration_seconds` (`60 \| 180 \| 600`), `guidance_voice`, `background_audio`, `assets_prepared_in_setup` |
| `visualize_completed` | `practice_session_completed` (`practice_mode: 'visualize'`) | Fired when [`V2CinematicSessionScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/visualize/V2CinematicSessionScreen.tsx) completes full playback | `practice_mode: 'visualize'`, `session_id`, `anchor_id`, `duration_seconds`, `actual_duration_seconds`, `sync_outcome` |
| `visualize_abandoned` | — | Fired when user taps "End session" from the pause overlay in [`V2CinematicSessionScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/visualize/V2CinematicSessionScreen.tsx) | `practice_mode: 'visualize'`, `session_id`, `anchor_id`, `planned_duration_ms`, `actual_duration_ms`, `exit_reason: 'user_ended_early'` |

---

### D. Chart & Ask Chart (Phase 3D)

| Canonical Event | Alias / Companion Events | Firing Condition | Key Properties |
| :--- | :--- | :--- | :--- |
| `chart_opened` | — | Fired when [`V2ChartScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/chart/V2ChartScreen.tsx) mounts | `anchor_id`, `has_chart` (`boolean`), `status` |
| `chart_planning_started` | `chart_creation_started`, `chart_generation_started` | Fired when user begins Chart planning/generation in [`ChartCreationFlow`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/chart/ChartCreationFlow.tsx) | `hasVision` (`boolean`), `followUp` (`boolean`), `references` (`number`) |
| `chart_generated` | `chart_generation_succeeded` | Fired when AI Chart route proposal succeeds in [`ChartCreationFlow`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/chart/ChartCreationFlow.tsx) | `source`, `fallbackUsed` (`boolean`), `waypointCount` (`number`), `complexity`, `latencyMs` (`number`) |
| `chart_generation_failed` | — | Fired when Chart route generation fails | `kind` (`'offline' \| 'rate_limited' \| 'disabled' \| 'needs_context' \| 'unavailable'`) |
| `chart_approved` | `chart_created`, `chart_route_reviewed` | Fired when user approves and saves their Chart route in [`ChartCreationFlow`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/chart/ChartCreationFlow.tsx) | `courseId`, `waypointCount` (`number`), `source`, `hasVision` (`boolean`), `hasOneMove` (`boolean`) |
| `chart_adjustment_requested` | `chart_route_adjusted` | Fired when user requests a route adjustment in [`ChartCreationFlow`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/chart/ChartCreationFlow.tsx) or [`V2ChartAdjustScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/chart/V2ChartAdjustScreen.tsx) | `courseId`, `reason`, `stage` (`'review' \| 'active'`), `hasDetail` (`boolean`) |
| `one_move_opened` | — | Fired in [`ChartActiveView`](file:///e:/Projects/Anchor/anchor/mobile/src/components/v2/chart/ChartActiveView.tsx) when an active Chart presents a current One Move | `course_id`, `waypoint_id`, `has_one_move: true` |
| `one_move_completed` | `chart_move_completed` | Fired in [`useAnchorChart.completeMove()`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/chart/useAnchorChart.ts#L292-L309) when server confirms move completion (`!result.replayed`) | `courseId`, `hasNextMove` (`boolean`) |
| `ask_chart_opened` | — | Fired when [`V2ChartAskScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/chart/V2ChartAskScreen.tsx) opens | `source`, `seeded` (`boolean`) |
| `ask_chart_message_sent` | `ask_chart_turn` | Fired in [`useAskChart.send()`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/chart/useAskChart.ts#L146-L194) when user submits a message (never logs message text) | `skill` (`'FREE' \| 'BREAK_DOWN_MOVE' \| 'UNSTICK' \| 'ADJUST_ROUTE'`), `has_attachments` (`boolean`), `attachment_count` (`number`), `has_target_move` (`boolean`), `message_length` (`number`) |
| `waypoint_reached` | `chart_waypoint_completed`, `chart_destination_reached` | Fired in [`useAnchorChart.reachWaypoint()`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/chart/useAnchorChart.ts#L414-L440) when server confirms waypoint or destination completion | `courseId`, `replayed` (`boolean`) |

---

### E. Paywall & Subscriptions (Phase 3E)

| Canonical Event | Alias / Companion Events | Firing Condition | Key Properties |
| :--- | :--- | :--- | :--- |
| `premium_feature_attempted` | — | Fired when a free user attempts a Pro-gated action (additional Anchor creation, Vision, Deep Prime, Visualize, Chart) | `feature`, `trigger`, `entry_point`, `context`, `tier` |
| `paywall_viewed` | — | Fired once per paywall presentation after store pricing resolves in [`V2PaywallScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/paywall/V2PaywallScreen.tsx) | `source`, `context`, `defaultPlan`, `headline` (`'two_step' \| 'trial_ended'`), `trial_days_remaining`, `trial_status` |
| `paywall_page_viewed` | `paywall_step2_viewed` | Fired on Step 1 (`page: 'offer_step_1'`, `step: 1`) and when advancing to Step 2 (`step: 2`) of the two-step paywall | `source`, `context`, `page`, `step` (`1 \| 2`) |
| `paywall_plan_selected` | — | Fired when user switches between `annual`, `weekly`, `monthly`, or `lifetime` plans | `plan`, `source`, `context` |
| `paywall_cta_tapped` | — | Fired when user taps the primary purchase/trial CTA on the paywall | `source`, `context`, `plan`, `productId` |
| `paywall_dismissed` | — | Fired when user closes or backs out of the paywall without subscribing | `source`, `context`, `step` (`1 \| 2`) |
| `purchase_started` | — | Fired immediately before calling `revenueCatService.purchasePackageByIdentifier()` in [`useV2Paywall`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts) | `source`, `context`, `plan`, `productId`, `is_trial` (`boolean`) |
| `purchase_failed` | `subscription_purchase_failed` | Fired when store purchase throws or entitlement fails verification | `source`, `context`, `plan`, `productId`, `is_trial` (`boolean`), `error_code` |
| `purchase_cancelled` | `subscription_purchase_cancelled` | Fired when user dismisses the native App Store / Play Store payment sheet (`dismissed === true`) | `source`, `context`, `plan`, `productId`, `is_trial` (`boolean`) |
| `restore_attempted` | `paywall_restore_tapped`, `subscription_restore_completed`, `subscription_restore_failed` | Fired when user taps "Restore Purchases" on the paywall | `source`, `context` |
| `trial_started` | `paywall_converted` (`outcome: 'trial_started'`) | Fired when a 7-day free trial is activated in both [`useV2Paywall`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts) and [`PaywallScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/paywall/PaywallScreen.tsx). **Never emits `trial_converted` on trial start.** Includes authoritative transaction sandbox metadata from RevenueCat `CustomerInfo.entitlements.active[id]`. | `source`, `context`, `plan: 'annual'`, `productId`, `outcome: 'trial_started'`, `is_sandbox_purchase` (`boolean`), `store_environment` (`'sandbox' \| 'production'`), `store` (`'app_store' \| 'play_store' \| ...`) |
| `trial_converted` | — | Fired on client only when a user completes a direct paid purchase (`outcome === 'purchased'`); authoritative trial-to-paid billing renewals on Day 7 are recorded by RevenueCat server webhooks | `source`, `context`, `plan`, `productId`, `outcome: 'purchased'`, `is_sandbox_purchase` (`boolean`), `store_environment` (`'sandbox' \| 'production'`), `store` |

> **Historical 1.5 Data Contamination Note (`trial_converted`)**: Prior to the Anchor 2.0 P0 fix (October 27, 2026), both [`useV2Paywall.ts`](file:///e:/Projects/Anchor/anchor/mobile/src/hooks/v2/paywall/useV2Paywall.ts) and [`PaywallScreen.tsx`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/paywall/PaywallScreen.tsx) emitted `trial_converted` at the moment a user started a 7-day free trial (with `outcome: 'trial_started'` on V2 or unconditionally on 1.5 `PaywallScreen`). When querying historical data prior to `app_version = '2.0.0'` (or prior to October 27, 2026), filter out `properties.outcome = 'trial_started'` from `trial_converted` queries, and rely on RevenueCat's server-side renewal events for authoritative trial-to-paid conversion rates.

---

### F. Teaching, Notifications, Sharing & Progress (Phase 3F)

| Canonical Event | Alias / Companion Events | Firing Condition | Key Properties |
| :--- | :--- | :--- | :--- |
| `teaching_shown` | `teaching_beat_shown` | Fired when a guidance prompt dwells for `>= 1000ms` in [`guidanceCoordinator`](file:///e:/Projects/Anchor/anchor/mobile/src/stores/v2/guidanceCoordinator.ts) or [`teachingAnalytics`](file:///e:/Projects/Anchor/anchor/mobile/src/services/v2/teachingAnalytics.ts) | `teaching_id` / `beat_id`, `surface`, `host_key` / `screen` |
| `teaching_dismissed` | `teaching_beat_dismissed` | Fired when user dismisses or acknowledges a teaching prompt | `teaching_id` / `beat_id`, `host_key` / `screen`, `outcome`, `reason` |
| `teaching_action_taken` | `teaching_beat_cta_tapped`, `teaching_target_used` | Fired when user performs the guided action or taps the teaching CTA | `teaching_id` / `beat_id`, `host_key` / `screen`, `detail` / `action` |
| `notification_permission_result` | `notification_permission_granted`, `notification_permission_declined` | Fired when OS push notification permission prompt resolves | `granted` (`boolean`), `status`, `source` |
| `reminder_enabled` | `personal_reminder_enabled` | Fired when user enables daily practice or Anchor reminders | `source`, `reminder_time` |
| `notification_opened` | — | Fired in [`NotificationCoordinator`](file:///e:/Projects/Anchor/anchor/mobile/src/services/notifications/NotificationCoordinator.ts) when user taps a push/local notification to open Anchor | `category`, `notification_type`, `anchor_id`, `action_identifier` |
| `share_studio_opened` | — | Fired when [`ShareStudioSheet`](file:///e:/Projects/Anchor/anchor/mobile/src/components/share/ShareStudioSheet.tsx) opens | `anchor_id`, `source`, `initial_format` |
| `share_exported` | `anchor_export_succeeded`, `anchor_shared`, `anchor_saved_to_photos`, `anchor_wallpaper_Prepared` | Fired when user exports, shares, or saves an Anchor artifact from Share Studio | `anchor_id`, `format`, `variant`, `destination` |
| `weekly_insight_opened` | — | Fired when [`V2WeeklyRecapScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/weeklyInsight/V2WeeklyRecapScreen.tsx) or [`V2WeeklyInsightScreen`](file:///e:/Projects/Anchor/anchor/mobile/src/screens/v2/weeklyInsight/V2WeeklyInsightScreen.tsx) mounts | `surface` (`'v2_weekly_recap' \| 'v2_weekly_insight'`), `week_key` / `week_offset`, `has_focus_anchor` |
