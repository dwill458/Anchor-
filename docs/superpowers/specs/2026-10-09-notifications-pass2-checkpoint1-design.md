# Notifications Pass 2 — Checkpoint One: UX & Motion (design)

Branch: `feat/celebration-layer` (in place). Source brief: Pass 2 assignment (user message 2026-10-09). Visual source: approved 3-phone mockup (cream/ink/gold; Invitation → Choose your time → Settings).
Scope: Checkpoint One only. Checkpoint Two (smart campaigns) is not started until the product owner approves this checkpoint.

## 1. Protected infrastructure (do not modify behavior)
`NotificationService.schedulePersonalDailyReminder / hasMatchingPersonalDailyReminder`, `NotificationCoordinator.reconcile / verifyAndReconcileNativeSchedule`, `normalizeNotificationState` (explicit-consent-only), `V2Practice` tap routing, token ownership, Android channels, `notification.wav`. Native already accepts `HH:mm` with arbitrary minutes (`parseTime`); only the Settings picker is hour-only. Pass 1 baseline: 17 mobile suites / 163 tests must stay green.

## 2. Found in code (read-only)
- V2 Settings renders legacy `screens/settings/NotificationsSubscreen.tsx` (via `SettingsScreen`); `screens/v2/settings` is empty. It has the duplicated "Practice reminders" + "Daily practice reminder" rows and an hour-only `CompactPickerSheet`.
- `DailyReminderPrompt` is the legacy modal, used by legacy create/prime screens only — not V2 practice.
- V2 practice completion: `V2FocusCompleteScreen` → `onDone` → `AnchorV2Navigator.handleSessionCompleted` → Home (Anchor carried via `homeArrivalStore` / `practiceHandoff`).
- Shared Anchor geometry/flight helpers: `navigation/v2/anchorHeroGeometry.ts`, `practiceHandoff.ts`, `creationHandoff.ts`.

## 3. Architecture
New folder `components/v2/notifications/` + `screens/v2/notifications/`; no new scheduling code.

| Unit | Purpose | Depends on |
|---|---|---|
| `useReminderEnrollment` hook | Orchestrates: persist pending time → `requestPermissions` (skipped if granted) → `updateNotificationPreferences({dailyPrimeEnabled, personalDailyReminderOptedIn, dailyPrimeTime})` + `toggleNotifications(true)` → `NotificationCoordinator.verifyAndReconcileNativeSchedule` → `hasMatchingPersonalDailyReminder` confirm. Returns `idle/requesting/success/denied/failed`; single-flight guard. Never depends on animation completion. | existing controller/service |
| `invitationState` (persisted via existing settings/notification store) | `invitationShownAt`, `invitationOutcome: accepted|dismissed`; eligibility = first completed practice ∧ not opted in ∧ no prior outcome ∧ authed/onboarded ∧ not in another session | store |
| `V2NotificationInvitationScreen` (route `V2NotificationInvitation`) | Screen 1 | `ReminderAnchorHero`, motion primitives |
| `V2ReminderTimeScreen` (route, same stack) | Screen 2 + success state | `TimeWheel`, enrollment hook |
| `TimeWheel` (+ `ReminderTimeSheet` for Settings) | 3 wheels (hour, minute 00–59, AM/PM; 24h variant), reused by both | Reanimated |
| `NotificationSettingsScreen` (V2) | Screen 3, replaces legacy subscreen in `SettingsScreen` | controller |
| `notificationMotion.ts` | Shared durations/easings/spring/stagger constants + `useMotionPreference` (Reduced Motion) + `Reveal` helper. Reuses paywall/creation constants style | Reanimated 3 |

### Entry & continuity
`handleSessionCompleted` asks `shouldShowInvitation()`; if eligible and it was the first completed practice, navigate to the invitation (instead of Home) after Continue — the celebration is never interrupted. The real Anchor (existing `anchorHeroGeometry` source rect, same SVG/image pipeline as Home hero — no substitute art) flies from the completion departure rect to the invitation hero rect (550–750 ms spring); background depth settles, headline rises, benefits stagger, CTA settles last. "Maybe later"/"Not now" persists `dismissed` and continues to Home via the existing arrival handoff, so Home still receives its Anchor. Rapid taps are blocked by a navigation single-flight ref. Viewing schedules nothing and shows no OS dialog.

### Screen 2
Full-screen wheel in onboarding; same `TimeWheel` in a true bottom sheet from Settings (absolute-bottom, `useSafeAreaInsets().bottom` + Android nav bar via inset, max-height clamp for compact devices, back/hardware-back dismisses). Wheel: `Animated.FlatList`/`ScrollView` with `snapToInterval`, `useAnimatedScrollHandler` driving per-row opacity/scale on the UI thread, selection haptic fired from the UI-thread handler via `runOnJS` called only from worklets (Reanimated 4 gotcha), selected value held in a shared value and committed to React state only on momentum end. 12h/24h follows device locale preference (setting-free: `Intl`/`hour12` detection). Minute wheel infinite-looped 00–59 not required; plain list with padding. CTA: "Next: Enable notifications". Denied → explanation + "Open settings" (`Linking.openSettings`), no success shown. Success: "Your daily moment is set." with subtle check/ring animation + success haptic, then auto-continues (user can tap Continue).

### Screen 3 (Settings)
Sections per mockup: YOUR DAILY MOMENT (single toggle, Remind-me-at row expands/collapses, exact-minute sheet, "every day even if you've practiced" note), OPTIONAL REMINDERS (Vision / Chart / Momentum, default OFF, persisted as `visionRemindersEnabled`, `chartRemindersEnabled`, `momentumCheckinsEnabled`), YOUR PROGRESS (weekly recap, existing `weeklyRecapEnabled`), DELIVERY (tone, only if verified to affect delivered content; otherwise hidden). Toggle state = persisted pref ∧ OS permission ∧ native schedule (reconciled on mount/foreground via existing coordinator). Entrance animation plays once per mount (not on toggle changes). OS-denied banner kept from Pass 1.

### Checkpoint One honesty rule
The three optional-reminder toggles and any new delivery policy are **preference storage only** in Checkpoint One; nothing is sent for them until Checkpoint Two. The report will say so and the toggles' state is persisted/analytics-instrumented only. (Open decision D2.)

## 4. Motion constants (tuning targets, from brief)
screen transition 450–650 ms · shared Anchor 550–750 ms (spring, damping tuned on device; memory note: budget ~1.5–2× prototype timings on device) · text reveal 300–450 ms · button press 100–140 ms · success 350–500 ms · stagger 60–90 ms. Reduced Motion: opacity-only ≤150 ms, no flight, no wheel scale. All constants in one object.

## 5. Analytics (CP1 subset)
invitation_shown/accepted/dismissed, reminder_time_selected (no content), permission_granted/denied, personal_reminder_enabled/disabled, smart_category_toggled — deduped per session via existing analytics choke point; no intention/Vision text.

## 6. Tests
Eligibility (first practice only, dismissal persistence, existing opt-in bypass, guest/onboarding gates); arbitrary-minute selection (8:30 PM, 5:45 AM, 7:17 AM, 10:52 PM → `HH:mm` → native trigger); single-flight CTA; permission granted/denied/already-granted; schedule-failure recovery (no false success); practice completion doesn't cancel/reschedule; category toggles idempotent & independent of daily reminder; Reduced Motion; sheet inset positioning; Pass 1 suites unchanged. Device/emulator capture on the Android emulator (iOS pending — no Mac) with honest limits.

## 7. Open decisions (need your call)
- **D1 — legacy Consistency alerts & Unfinished-anchor reminders.** The mockup omits them, but `threadStrengthAlertsEnabled` defaults **true** and they can still send. Options: (a) keep behavior, hide controls (users can't turn them off — bad); (b) keep a small "More alerts" group under Delivery (deviates from mockup, honest); (c) fold into Momentum check-ins and default them OFF for new users, leave existing users' values (recommended: nothing hidden that still sends; mockup intact). *Recommend (c)… but it changes who receives them; (b) is the zero-behavior-change option.* 
- **D2 — placeholder toggles in CP1.** Recommend: persist preferences now, ship nothing for them until CP2, and gate them off in production builds until CP2 lands (so users can't opt into nothing). Alternative: show them live in dev only.
- **D3 — first-practice detection.** Use a persisted `firstPracticeCompletedAt` set once in the completion path (not derived from session count), recommended.

## 8. Process
Implement via parallel agents: (A) motion primitives + wheel/sheet, (B) invitation/time screens + navigator wiring + enrollment hook, (C) settings screen + preference fields, then independent adversarial UI/motion review, emulator captures, report `ANCHOR_NOTIFICATIONS_PASS2_UX_MOTION_REPORT.md`, stop for approval.
