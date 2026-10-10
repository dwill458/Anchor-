# Notifications Pass 2 — Checkpoint One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the animated Notification Invitation, minute-precise Choose-Your-Time (full screen + true bottom sheet), and redesigned Notifications & reminders settings, on top of the untouched Pass 1 daily-reminder system.

**Architecture:** New V2 UI under `components/v2/notifications/` and `screens/v2/notifications/`. One `useReminderEnrollment` hook orchestrates existing controller/service calls (no new scheduler). The invitation is a V2 stack route entered from `handleSessionCompleted` instead of Home on the first completed practice; the real Anchor flies from the practice departure rect to the invitation hero, and leaves to Home through the existing `handOffPracticeToHome`. Shared motion constants live in one module.

**Tech Stack:** React Native / Expo SDK 52+, Reanimated (existing project version — check `package.json`; see Reanimated-4 `runOnJS` gotcha: call `runOnJS` only from worklets), `react-native-safe-area-context`, `expo-notifications` via `NotificationService`, Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-10-09-notifications-pass2-checkpoint1-design.md` (approved 2026-10-09 with D1=(c), D2=hide Vision/Chart toggles in production, D3=persisted `firstPracticeCompletedAt`). Visual reference: approved 3-phone mockup (cream/ink/gold). All paths below are under `E:\Projects\Anchor\anchor\mobile\src\` unless stated.

## Global Constraints

- Do not modify behavior of `NotificationService.schedulePersonalDailyReminder`, `hasMatchingPersonalDailyReminder`, `NotificationCoordinator.reconcile`/`verifyAndReconcileNativeSchedule`, `normalizeNotificationState`'s explicit-consent rule, `V2Practice` tap routing, token ownership, Android channels, `notification.wav`.
- Pass 1 baseline stays green: 17 mobile suites / 163 tests (`npx jest` in `anchor/mobile`).
- Copy is locked verbatim: headline "Make time for what matters."; "A little time each day can help you stay connected to your goals and keep your momentum going."; benefits "Return to your practice." / "Stay connected to your progress." / "Feel more focused and grounded."; CTA "Choose my reminder time"; secondary "Maybe later"; time screen "When would you like to reconnect with your Anchor?", "Choose a time that works for you. You can change this anytime.", note "Every day, even if you've already practiced earlier. Your reminder will still arrive at this time.", CTA "Next: Enable notifications"; success "Your daily moment is set."; settings strings per spec §3 / mockup.
- Minutes 00–59 all selectable; stored as zero-padded `HH:mm` (24h) in `dailyPrimeTime`.
- Motion targets: screen 450–650 ms, shared Anchor 550–750 ms, text reveal 300–450 ms, press 100–140 ms, success 350–500 ms; all in one `NOTIFICATION_MOTION` object. Reduced Motion: opacity-only ≤150 ms, no flight, no wheel scale.
- UI-thread transforms/opacity only; no React state updates per scroll frame; no infinite loops; no continuous blur.
- Use `safeHaptics` from `@/utils/haptics`; real Anchor via `anchorRenderProps` (`@/components/v2/anchors/anchorPresentation`), never placeholder art.
- No consent inference: viewing/dismissing never sets `personalDailyReminderOptedIn`. No analytics with intention/Vision text.
- Commit only when the user asks; tasks list commit steps as "stage-ready checkpoint" — run `git add` of listed files and commit only if the user has asked in-session.

## Review Focus

1. Double-tap CTA / Maybe later / hardware back during flight → one navigation, one permission request, one schedule (tests in Tasks 3, 6).
2. OS permission denied (and "denied, can't ask again") → never shows success, offers Open Settings (Task 3).
3. User toggles OS notifications off in system settings while Settings screen is open, then returns → toggle/time row reflect native truth on foreground (Task 5).
4. First practice completed as guest / mid-onboarding / with reminders already enabled → invitation never shown, Home hand-off unchanged (Task 6).
5. Time-zone/DST: selected `HH:mm` is local wall-clock; wheel never produces invalid times (12 AM/12 PM mapping: 12:00 AM→`00:00`, 12:30 PM→`12:30`) (Task 2).

---

### Task 1: Motion constants & Reduced-Motion primitives

**Files:**
- Create: `components/v2/notifications/notificationMotion.ts`
- Create: `components/v2/notifications/Reveal.tsx`
- Test: `components/v2/notifications/__tests__/notificationMotion.test.ts`

**Interfaces:**
- Produces: `NOTIFICATION_MOTION = { screenMs: 560, anchorFlightMs: 650, textRevealMs: 380, pressMs: 120, successMs: 420, staggerMs: 75, reducedMs: 140, settleSpring: {damping, stiffness, mass} }`; `useNotificationReduceMotion(): boolean` (wraps existing `useCelebrationReduceMotion` from `@/hooks/useCelebrationReduceMotion`); `<Reveal index={n} reduceMotion?: boolean once?: boolean>` fade+rise wrapper that plays once per mount (ignores later prop/rerender changes) and uses `reducedMs` opacity-only when reduced; `usePressScale(): {style, onPressIn, onPressOut}` scale 0.97 over `pressMs`.

- [ ] **Step 1: Failing tests** — `NOTIFICATION_MOTION` values sit inside the Global Constraints ranges; `Reveal` renders children and does not remount/replay when parent re-renders (assert via a mock `withTiming` call count == 1 after two renders).
- [ ] **Step 2: Run** `npx jest components/v2/notifications/__tests__/notificationMotion.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** the three exports above following `theme/v2/motion.ts` (`AnchorMotion`) easing conventions; reference `hooks/useCelebrationReduceMotion.ts`.
- [ ] **Step 4: Run** same command → PASS.
- [ ] **Step 5: Stage-ready checkpoint** `git add components/v2/notifications`.

### Task 2: Notification state fields, time utils, legacy-alert unification

**Files:**
- Modify: `services/NotificationState.ts` (add fields + defaults + normalize), `hooks/useNotificationController.ts` (extend `updateNotificationPreferences` Pick list with the new fields; add `markFirstPracticeCompleted()` and `recordInvitationOutcome(o)` to the returned API)
- Create: `utils/reminderTime.ts`
- Test: `utils/__tests__/reminderTime.test.ts`, extend `services/__tests__/NotificationState.test.ts`

**Interfaces:**
- Produces new `NotificationState` fields: `firstPracticeCompletedAt: string | null` (default null), `reminderInvitationShownAt: string | null`, `reminderInvitationOutcome: 'accepted' | 'dismissed' | null`, `visionRemindersEnabled: boolean`, `chartRemindersEnabled: boolean`, `momentumCheckinsEnabled: boolean` (all default false); default `threadStrengthAlertsEnabled` and `unfinishedAnchorRemindersEnabled` change to `false` for **new** state only (persisted values are preserved).
- `reminderTime.ts`: `type WheelTime = { hour12: number /*1-12*/; minute: number; meridiem: 'AM'|'PM' }`; `toHHmm(t: WheelTime): string`; `fromHHmm(s: string): WheelTime` (invalid → 9:00 PM); `formatDisplay(s: string, use24h: boolean): string` ("8:30 PM" / "20:30"); `deviceUses24Hour(): boolean`.
- `selectMomentumOn(state): boolean` = `momentumCheckinsEnabled || threadStrengthAlertsEnabled || unfinishedAnchorRemindersEnabled`; `momentumPatch(on): Partial<NotificationState>` sets all three to `on` (exported from `NotificationState.ts`).

- [ ] **Step 1: Failing tests** — `toHHmm({hour12:12,minute:0,meridiem:'AM'})==='00:00'`; `{12,30,'PM'}→'12:30'`; 8:30 PM→`'20:30'`; 5:45 AM→`'05:45'`; 7:17 AM→`'07:17'`; 10:52 PM→`'22:52'`; `fromHHmm` round-trips every minute of the day (1440 cases); `formatDisplay('20:30', false)==='8:30 PM'`; `normalizeNotificationState({})` yields new fields defaulted and `personalDailyReminderOptedIn:false`; persisted `threadStrengthAlertsEnabled:true` is preserved; prompt-shown never opts in (existing test stays green); `momentumPatch(false)` turns off all three and `selectMomentumOn` reflects any one true.
- [ ] **Step 2: Run** `npx jest utils/__tests__/reminderTime.test.ts services/__tests__/NotificationState.test.ts` → FAIL.
- [ ] **Step 3: Implement** per Interfaces; `deviceUses24Hour` via `Intl.DateTimeFormat(undefined,{hour:'numeric'}).resolvedOptions().hour12 === false` with try/catch fallback false. `markFirstPracticeCompleted` is idempotent (sets only if null) and is a pure state write — **no** scheduling calls, no reconcile.
- [ ] **Step 4: Run** the two suites plus `npx jest services/notifications` → PASS (Pass 1 coordinator tests unchanged).
- [ ] **Step 5: Stage-ready checkpoint.**

### Task 3: `useReminderEnrollment` (permission → enable → verified schedule)

**Files:**
- Create: `hooks/v2/notifications/useReminderEnrollment.ts`
- Test: `hooks/v2/notifications/__tests__/useReminderEnrollment.test.ts`

**Interfaces:**
- Consumes: `useNotificationController()` (`updateNotificationPreferences`, `toggleNotifications`), `NotificationService.requestPermissions/getPermissionStatus` (use the existing permission-read helper — grep `NotificationService` for it; do not add a new one if present), `NotificationCoordinator.verifyAndReconcileNativeSchedule`, `NotificationService.hasMatchingPersonalDailyReminder(time, options)`, `reminderTime.toHHmm`.
- Produces: `useReminderEnrollment(): { status: 'idle'|'requesting'|'success'|'denied'|'blocked'|'failed'; enroll(time: string /*HH:mm*/): Promise<void>; openSystemSettings(): void; reset(): void }`. `enroll` is single-flight (second call while `requesting` returns the same promise, no second permission request); order: persist pending time via `updateNotificationPreferences({dailyPrimeTime})` → permission (skip prompt when already granted) → on grant `toggleNotifications(true)` then `updateNotificationPreferences({dailyPrimeEnabled:true, personalDailyReminderOptedIn:true, dailyPrimeTime})` → `verifyAndReconcileNativeSchedule` → `hasMatchingPersonalDailyReminder(time)`; `success` only if that returns true else `failed` (retry allowed). Denied-without-prompt (`canAskAgain=false`) → `blocked`. Emits analytics: permission granted/denied (reuse existing `AnalyticsEvents`), `reminder_time_selected` (new event constant; payload `{ hour, minute }` only), `personal_reminder_enabled`.

- [ ] **Step 1: Failing tests** (mock service/controller): granted-already → no `requestPermissions` call, success; prompt granted → success after native confirm; denied → `denied`, `dailyPrimeEnabled` never set true, no success; blocked; native confirm false → `failed` and a second `enroll` retries; two concurrent `enroll` calls → `requestPermissions` called once; `enroll` does not depend on any animation (no timers).
- [ ] **Step 2: Run** `npx jest hooks/v2/notifications` → FAIL.
- [ ] **Step 3: Implement** with a `useRef` in-flight promise; analytics via `AnalyticsService.track` + add constants to `AnalyticsEvents` (`services/AnalyticsService.ts:365`): `NOTIFICATION_INVITATION_SHOWN/ACCEPTED/DISMISSED`, `REMINDER_TIME_SELECTED`, `NOTIFICATION_CATEGORY_TOGGLED`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage-ready checkpoint.**

### Task 4: `TimeWheel` and `ReminderTimeSheet`

**Files:**
- Create: `components/v2/notifications/TimeWheel.tsx`, `components/v2/notifications/ReminderTimeSheet.tsx`, `components/v2/notifications/timeWheelLayout.ts`
- Test: `components/v2/notifications/__tests__/TimeWheel.test.tsx`, `ReminderTimeSheet.test.tsx`

**Interfaces:**
- Consumes: `reminderTime` (Task 2), `NOTIFICATION_MOTION`/`useNotificationReduceMotion` (Task 1), `safeHaptics`.
- Produces: `<TimeWheel value: string /*HH:mm*/ onChange(next: string): void use24h?: boolean />` — hour column (1–12 or 0–23), minute column 00–59 (every minute), AM/PM column (hidden in 24h); row height 44, 5 visible rows, `snapToInterval`, `decelerationRate="fast"`; per-row opacity/scale via `useAnimatedScrollHandler` (UI thread); selection light haptic fired from the worklet only when the centered index changes; `onChange` called on momentum end / drag end with `toHHmm` string; each column has `accessibilityRole="adjustable"`, label ("Hour"/"Minute"/"AM or PM"), `accessibilityValue`, and `accessibilityActions` increment/decrement; `testID`s `time-wheel-hour|minute|meridiem`. `timeWheelLayout.ts`: `sheetBottomPadding(insetBottom: number, androidNavBar: number): number`, `clampSheetHeight(windowHeight, desired)`.
- `<ReminderTimeSheet open value onConfirm(time) onClose />` — absolutely bottom-anchored (`bottom:0`), `paddingBottom = sheetBottomPadding(...)` from `useSafeAreaInsets`, height clamped for compact devices (≥ content, ≤ 85% window), backdrop tap + hardware back (`BackHandler`) close, rises with `NOTIFICATION_MOTION.screenMs` spring (opacity-only when reduced), Done button commits.

- [ ] **Step 1: Failing tests** — `TimeWheel` renders 60 minute rows and (via a test helper that sets the wheel's selected index) emits `'05:45'`, `'07:17'`, `'20:30'`, `'22:52'`; 24h mode hides meridiem and emits `'20:30'`; accessibility increment on minute column from 59 wraps to no change/next valid and never emits invalid; `sheetBottomPadding(34,0)>=34` and with `androidNavBar=48` returns ≥48; `clampSheetHeight(600, 900)===510`; sheet `open=false` renders nothing; hardware back calls `onClose`; Reduced Motion renders without throwing and without transform animation (assert no scale style).
- [ ] **Step 2: Run** `npx jest components/v2/notifications/__tests__/TimeWheel.test.tsx components/v2/notifications/__tests__/ReminderTimeSheet.test.tsx` → FAIL.
- [ ] **Step 3: Implement** per Interfaces (Animated.ScrollView rows rendered once; no `useState` inside the scroll handler). Initial scroll via `scrollTo({animated:false})` in layout effect.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage-ready checkpoint.**

### Task 5: Settings screen redesign

**Files:**
- Create: `screens/v2/notifications/NotificationSettingsScreen.tsx`, `screens/v2/notifications/settingsModel.ts`
- Modify: `screens/settings/SettingsScreen.tsx:280` (render the new screen for the notifications subscreen); delete nothing else (legacy `NotificationsSubscreen.tsx` stays until its test is migrated — migrate `screens/settings/__tests__/SettingsSubscreens.test.tsx` notification cases to the new screen in this task)
- Test: `screens/v2/notifications/__tests__/NotificationSettingsScreen.test.tsx`, `settingsModel.test.ts`

**Interfaces:**
- Consumes: `useNotificationController`, `useReminderEnrollment`, `ReminderTimeSheet`, `selectMomentumOn`/`momentumPatch`, `Reveal`, existing settings primitives/theme (`components/settings/settingsTheme`), `NotificationService` permission status, `AppState` foreground reconcile via `NotificationCoordinator.verifyAndReconcileNativeSchedule`.
- Produces: `deriveSettingsModel(state, nativeScheduled: boolean): { dailyOn: boolean; timeLabel: string; osDenied: boolean; momentumOn: boolean; showVisionChart: boolean }` — `dailyOn = notification_enabled ∧ permission granted ∧ dailyPrimeEnabled ∧ personalDailyReminderOptedIn ∧ nativeScheduled`; `showVisionChart = __DEV__ || Boolean(process.env.EXPO_PUBLIC_ENABLE_SMART_REMINDER_TOGGLES)` (D2). Sections per spec §3: single Daily reminder toggle (turning ON uses `enroll(dailyPrimeTime)`; OFF uses `updateNotificationPreferences({dailyPrimeEnabled:false, personalDailyReminderOptedIn:false})` + `toggleNotifications` semantics identical to Pass 1 disable path — do not alter other categories); "Remind me at" row animates open/closed and opens `ReminderTimeSheet` (confirm → `updateNotificationPreferences({dailyPrimeTime})`, which reschedules through the existing coordinator); Optional reminders (Vision/Chart under `showVisionChart` → `updateNotificationPreferences({visionRemindersEnabled|chartRemindersEnabled})`; Momentum always shown, `momentumPatch`); Weekly recap (existing `weeklyRecapEnabled` + `setWeeklySummaryEnabled` bridge as in legacy screen); Delivery "Notification tone" row **only if** tone is consumed by delivered content — verify at `NotificationCoordinator.ts:490-519` and `notificationTemplates.ts`; if it affects only smart templates, label row accordingly and keep the picker; OS-denied banner copy from Pass 1 and "Open Settings". Entrance: each section wrapped in `<Reveal index>` mounted once; toggle changes must not replay (test).

- [ ] **Step 1: Failing tests** — model: daily toggle false when native schedule missing even if prefs true; time label "8:30 PM"/"Off"; Vision/Chart hidden when flag off, Momentum visible; screen: toggling Daily ON calls `enroll` with current time, no direct `toggleNotifications`; OFF doesn't change `visionRemindersEnabled`/`momentumCheckinsEnabled`; toggling Vision (dev) doesn't change `dailyPrimeEnabled`; Momentum OFF zeroes the three flags; category update idempotent (calling twice → one persisted value); sheet confirm with `'07:17'` persists `dailyPrimeTime:'07:17'`; OS denied shows banner and disables toggles; changing a toggle does not re-run Reveal animations (mock count).
- [ ] **Step 2: Run** `npx jest screens/v2/notifications` → FAIL.
- [ ] **Step 3: Implement** per Interfaces; styling from mockup (cream bg, ink text, restrained gold, rounded elevated cards, icon discs); toggle thumb spring via `withSpring`; foreground reconcile on `AppState` 'active' (read-only verify, then re-read native schedule).
- [ ] **Step 4: Run** `npx jest screens/v2/notifications screens/settings` → PASS.
- [ ] **Step 5: Stage-ready checkpoint.**

### Task 6: Invitation + Choose-Time screens, entry wiring, Anchor flight

**Files:**
- Create: `screens/v2/notifications/V2NotificationInvitationScreen.tsx`, `screens/v2/notifications/V2ReminderTimeScreen.tsx`, `navigation/v2/invitationHandoff.ts`, `stores/v2/reminderInvitationStore.ts` (session-only: staged `{anchorId, fromRect, sessionId}`), `screens/v2/notifications/invitationEligibility.ts`
- Modify: `navigation/v2/routes.ts` (add `notificationInvitation: 'V2NotificationInvitation'`, `reminderTime: 'V2ReminderTime'`), `navigation/v2/AnchorV2Navigator.tsx` (register both screens, `animation:'none'`/`fade` option like other flight routes; branch in `handleSessionCompleted` ~line 161–195), `navigation/v2/types.ts` (route params)
- Test: `screens/v2/notifications/__tests__/invitationEligibility.test.ts`, `V2NotificationInvitationScreen.test.tsx`, `V2ReminderTimeScreen.test.tsx`, `navigation/v2/__tests__/invitationHandoff.test.ts`

**Interfaces:**
- Consumes: `takePracticeDeparture`/`PracticeDeparture` (`stores/v2/practiceDeparture.ts`), `handOffPracticeToHome` (`navigation/v2/practiceHandoff.ts`, unchanged), `anchorRenderProps`, `useReminderEnrollment`, `TimeWheel`, controller `markFirstPracticeCompleted`/`recordInvitationOutcome`, Tasks 1–4.
- Produces: `shouldShowReminderInvitation(input: { state: NotificationState|null; isAuthenticated: boolean; hasCompletedOnboarding: boolean; sessionSaved: boolean }): boolean` — true only if `firstPracticeCompletedAt` was null before this completion ∧ `reminderInvitationOutcome===null` ∧ `!personalDailyReminderOptedIn` ∧ authenticated ∧ onboarded ∧ saved. `handOffPracticeToInvitation(navigation, {anchor, departure}, {reduceMotion}): Promise<'started'|'ignored'>` (single-flight, mirrors `handOffPracticeToHome`: measure departure → stage → navigate). In `handleSessionCompleted`: call `markFirstPracticeCompleted()` on every saved completion (state write only), and if eligible (computed from state **before** that write) route via `handOffPracticeToInvitation`, else fall through to the existing Home path **unchanged**. Invitation hero: real Anchor flies `fromRect` → measured hero rect over `anchorFlightMs` (spring); then depth layer fades, headline rises, three benefit rows stagger (`staggerMs`), CTA settles last; Reduced Motion = crossfade. CTA → navigate `V2ReminderTime` (single-flight ref) ; "Maybe later"/"Not now" → `recordInvitationOutcome('dismissed')` + leave to Home via `handOffPracticeToHome` with a synthetic departure `{sessionId, at: Date.now(), measure: () => invitation mark rect}`. Time screen: back chevron returns to invitation; progress segments (2 of 3 per mockup); CTA calls `enroll`; `success` shows "Your daily moment is set." (check ring, `successMs`, success haptic via `safeHaptics.notification(Success)`), `recordInvitationOutcome('accepted')`, auto-continues to Home (hand-off) after ~1.4 s or on tap; `denied` shows explanation + "Open Settings" + "Not now"; `failed` shows retry. No OS permission request on entering either screen; no schedule is created by viewing.

- [ ] **Step 1: Failing tests** — eligibility matrix (first practice true; second practice false; guest false; mid-onboarding false; already opted in false; prior dismissed false; unsaved session false); invitation: renders exact copy strings and the supplied Anchor's SVG (assert `anchorRenderProps` output rendered, no placeholder), CTA twice quickly → one `navigate`; "Maybe later" persists `dismissed`, never calls `enroll`/`requestPermissions`; time screen: back works; `enroll` rejected → no success text; success text appears only when status `success`; denied shows Open Settings; hardware back during enroll doesn't double-navigate; `handleSessionCompleted` non-eligible path still calls `handOffPracticeToHome` exactly as before (extend existing navigator test or add one).
- [ ] **Step 2: Run** `npx jest screens/v2/notifications navigation/v2/__tests__/invitationHandoff.test.ts` → FAIL.
- [ ] **Step 3: Implement** per Interfaces; wire routes in navigator. Practice completion celebration code is **not** edited.
- [ ] **Step 4: Run** the above plus `npx jest screens/v2/practice navigation/v2` → PASS (no regression to completion screen / Home hand-off).
- [ ] **Step 5: Stage-ready checkpoint.**

### Task 7: Regression, type-check, device/emulator evidence, independent review, report

**Files:**
- Create: `ANCHOR_NOTIFICATIONS_PASS2_UX_MOTION_REPORT.md` (repo root)

- [ ] **Step 1:** `npx tsc --noEmit` (mobile) → 0 new errors; `npx jest` full mobile → record exact pass/fail counts; Pass 1 suites (17 / 163) still pass.
- [ ] **Step 2:** Run on the Android emulator (Metro :8081 from `E:\Projects\Anchor`, see memory `project_android_dev_setup`): complete a first practice with a fresh account → capture screenshots/screen recording of completion→invitation→time→permission→success; Settings screen, sheet from Settings on compact and tall devices, Reduced Motion on; state iOS is unverified (no Mac) rather than claiming parity.
- [ ] **Step 3:** Dispatch two independent reviewers (fresh context): UI/motion vs mockup (score with evidence), and adversarial code review of Pass 1 non-regression + Review Focus items; fix confirmed findings.
- [ ] **Step 4:** Write the report with required sections (screens, components, parity, choreography, timings, accessibility, evidence, iOS/Android findings, remaining issues, scores) and the required final-status block; scores only where evidence exists. **Stop and request product-owner review; do not start Checkpoint Two.**

---

## Self-review notes
- Spec coverage: §3 invitation/time/settings → Tasks 5–6; wheel/sheet → 4; enrollment/permission → 3; state/D1/D3 → 2; motion → 1; analytics subset → 3 (+6 for shown/accepted/dismissed events, emitted in the screens via the new constants); tests/evidence/report → 7. D2 handled in Task 5 `showVisionChart`. Analytics for category toggles emitted in Task 5 handlers.
- Known tension (flag in report): Momentum is live-backed by legacy alerts, so it is shown in production while Vision/Chart are hidden until Checkpoint Two.
