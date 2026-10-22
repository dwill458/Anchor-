# Anchor 2.0 — Notifications Pass 2, Checkpoint One: UX & Motion

Date: 2026-10-09 · Branch: `feat/celebration-layer` (uncommitted, no commits made) · Spec: `docs/superpowers/specs/2026-10-09-notifications-pass2-checkpoint1-design.md` · Plan: `docs/superpowers/plans/2026-10-09-notifications-pass2-checkpoint1.md` · Device evidence: `docs/notifications-pass2/evidence/phone/` (original captures + `verify/` re-captures).

**Checkpoint Two (smart retention) has NOT been started. Awaiting product-owner review.**

## Final status
- PASS 2 CHECKPOINT: UX & Motion
- IMPLEMENTATION STATUS: **Partial** — all three screens built and device-checked on a Galaxy S24 except the items under "Not verified".
- VISUAL PARITY SCORE: **not scored.** Captures exist for Settings, time sheet, Invitation and Choose-time and match the mockup closely, but the last Invitation layout fix (hero/mist/benefit-row compaction) was NOT re-captured on device, and the iOS look is unseen. I will not state a number I cannot back.
- MOTION QUALITY SCORE: **not scored.** Stills only; no frame-by-frame review of the completion→invitation Anchor flight (could not be triggered — see below). Reduced Motion not exercised on device.
- TEST RESULTS: see "Tests".
- DEVICE VERIFICATION: **Partial** (Android phone only; iOS pending — no Mac).
- PASS 1 REGRESSIONS: **None found.** Protected functions (`schedulePersonalDailyReminder`, `hasMatchingPersonalDailyReminder`, coordinator reconcile/verify, consent rule) were not edited; notification/Pass-1 suites pass.
- DEPLOYMENT REQUIREMENTS: none for the backend (server stores `notificationState` as a free-form record; new fields round-trip). Mobile needs an OTA/native build containing these JS changes; no native config changes.
- PRODUCTION READY: **No** (see Known issues).

## Screens implemented
1. **Notification Invitation** (`V2NotificationInvitation`) — real Anchor via `anchorRenderProps`, locked copy, 3 benefit rows, "Choose my reminder time" / "Maybe later", "Not now". Entered from `handleSessionCompleted` only for a user's first saved practice that returns to Home; the Anchor flies from the completion departure rect, Home hand-off reuses `handOffPracticeToHome`.
2. **Choose your time** (`V2ReminderTime`) — exact-minute wheel (hour | 00–59 | AM/PM or 24h), locked note, "Next: Enable notifications", success "Your daily moment is set.", denied/blocked/failed states with Open Settings / retry.
3. **Notifications & reminders** (replaces legacy subscreen in `SettingsScreen`) — YOUR DAILY MOMENT (single toggle + expanding "Remind me at" row + bottom-anchored exact-minute sheet), OPTIONAL REMINDERS (Vision/Chart dev-only; Momentum live), YOUR PROGRESS (Weekly recap), DELIVERY (tone).

## Components added / modified
New: `components/v2/notifications/{notificationMotion,Reveal,TimeWheel,ReminderTimeSheet,timeWheelLayout}`, `hooks/v2/notifications/useReminderEnrollment`, `utils/reminderTime`, `screens/v2/notifications/{V2NotificationInvitationScreen,V2ReminderTimeScreen,NotificationSettingsScreen,settingsModel,invitationEligibility,invitationCopy,invitationTheme}`, `navigation/v2/invitationHandoff`, `stores/v2/reminderInvitationStore`.
Modified (additive): `services/NotificationState` (new fields, defaults, `momentumPatch`/`selectMomentumOn`), `hooks/useNotificationController` (new prefs in Pick list, `markFirstPracticeCompleted`, `recordInvitationOutcome`, storage writers), `services/AnalyticsService` (event constants), `navigation/v2/{routes,types,AnchorV2Navigator}`, `screens/v2/home/V2HomeScreen` (one line: `handoffOnTop`), `screens/settings/SettingsScreen` (renders new screen; row subtitle now "Daily reminder, optional reminders, and recap"). Legacy `NotificationsSubscreen` deletion was delegated in the last fix batch — confirm in `git status`.

## Motion choreography & timings (single source: `NOTIFICATION_MOTION`)
screen 560 ms · Anchor flight 650 ms (spring `settleSpring` 22/230/0.8) · text reveal 380 ms · stagger 75 ms · press 120 ms (scale 0.97) · success 420 ms · Reduced Motion 140 ms opacity-only (no flight, no wheel scale). Wheel: UI-thread opacity/scale from `scrollY`, haptic fired from the scroll worklet only on centred-row change, commit on momentum end (+250 ms no-momentum fallback, Done waits for settle, 600 ms safety). Sheet: spring rise with `overshootClamping`.

## Accessibility
Wheel columns `adjustable` with label/value/increment-decrement; sheet modal props + title focus; closed drawer hidden from screen readers; behind-sheet content hidden via `behindSheetA11yProps`; Reduced Motion honoured via `useCelebrationReduceMotion`. TalkBack/VoiceOver NOT tested on device.

## Evidence (Galaxy S24 Ultra, Android, dev client, wireless adb)
- Settings screen matches the mockup (cream cards, icon discs, small-caps captions, ink toggles).
- **Device bug found and fixed:** "Remind me at" drawer never expanded (onLayout-measured height stayed 0; Jest passed). Rewritten measurement-free; re-verified on device (row + note appear).
- Time sheet bottom-anchored; every minute listed; picked 9:18 PM → row shows 9:18 PM; `dumpsys alarm` showed `RTC_WAKEUP … 2026-10-10 21:18:00` (native schedule at the chosen minute). Daily OFF → alarm gone.
- Invitation + Choose-time rendered with the user's real Anchor (entry via a throwaway dev-menu row, since removed; synthetic entry). Enroll → "Your daily moment is set." frame captured; Settings then showed Daily ON 9:00 PM and `dumpsys alarm` showed an alarm at 21:00. Everything restored to the original state afterwards (Daily off, Momentum on, Recap off); one side effect remains: this account's invitation outcome is now `accepted`.
- Mismatches seen vs mockup before the final fix: hard-edged hill "slab" behind the hero; third benefit row clipped by footer. Both were fixed in code (full-bleed gradient hills, compact hero) but **not re-captured** (the phone had switched to another app when I tried). Re-verify first thing next session.
- Mishap: during that last attempt my taps landed in the ChatGPT app (it was foreground, already on a "Failed to connect" screen). Nothing else was touched.

## Not verified
Real first-practice trigger and the completion→invitation Anchor flight/spring; OS permission dialog (permission was already granted); Reduced Motion on device; small-screen layout; TalkBack; haptics feel; iOS entirely; the compacted Invitation layout.

## Tests
Targeted suites (notifications, settings, navigation/v2, practice, home): all passing at last run (e.g. 55 suites/644 tests in the touched areas after Task 6; 91 tests in `screens/v2/notifications` + `screens/settings` after the drawer fix). `tsc --noEmit`: clean at last check. **Full `npx jest` (before the last fix batch): 8 failed / 494 passed suites, 20 failed / 4803 passed tests**; failing suites — PracticeScreen, AnchorDetailScreen, ChartPreview, AuthHydrationService, chartMapSequences, adapters/v2/home isolation, ChartSummitAndRouteScenes, ChartOneMoveRow — none touch checkpoint files (isolation.test flags `dailyShell.tsx`, which was already modified before this work; AuthHydrationService test hard-codes a timestamp id). Not proven failing on a clean checkout. **Final fix batch (completed after the full run above):** enrollment now bails after every await once `reset()` is called (late OS grant can't enable the reminder) and `reset()` clears the queue; sheet draft no longer resets on window/inset changes; `clearNotificationSession` now also clears the pending-sync key and resets the invitation session flag; `usePressScale` tested; legacy `NotificationsSubscreen.tsx` deleted. Targeted run (hooks/v2/notifications, components/v2/notifications, screens/settings, services/__tests__, services/notifications): 440 passed, 2 failed (both `AuthHydrationService.test.ts`, unrelated anchorStore assertions; not proven pre-existing on a clean checkout). `tsc --noEmit -p .` exits 0. **Full `npx jest` re-run after this batch (2026-10-10): 8 failed / 504 passed suites (512), 20 failed / 4,867 passed tests (4,888); `tsc --noEmit` exit 0.** Failing suites: adapters/v2/home isolation, ChartPreview, ChartMapWeather, chartMapSequences, PracticeScreen, V2ChartScreen, AnchorDetailScreen, AuthHydrationService — none touch checkpoint files; the Chart set varies run to run (timing-heavy). Not proven failing on a clean checkout.

**Invitation fix verified on the Android emulator (2026-10-10, `docs/notifications-pass2/evidence/emulator/e3_invitation.png`, demo Anchor via a throwaway dev row, since removed):** the hill depth is now full-bleed soft mist with no hard edge and all three benefit rows sit fully above the CTA. (A dev-only RevenueCat toast overlaps the bottom of that capture.) Still unverified: the practice-completion→invitation flight, Reduced Motion, TalkBack, iOS.

## Known issues / decisions for the product owner
1. **Enrollment side effects — RESOLVED (2026-10-10).** `useReminderEnrollment` now uses a new `enableDailyReminderOnly(time)` controller method: it requires OS permission already granted, sets only `notification_enabled`/permission status/`personalDailyReminderOptedIn`/`dailyPrimeEnabled`/`dailyPrimeTime`, and schedules only the personal reminder. It no longer touches `weeklySummaryEnabled`, push tokens, or force-scheduling of smart categories, and `enroll` never calls `toggleNotifications` or `updateNotificationPreferences` (tests assert this). Picked time is now persisted only on grant. Verified by unit tests (29 suites / 320 tests in the notification/settings/navigation set; tsc exit 0); **not re-verified on device** — re-run the enable flow on the emulator/phone before sign-off. Note `notification_enabled=true` is still set (the personal-reminder reconcile requires it).
2. **Viewing Choose-time mounts the notification controller** (`initOnAppOpen` reconcile/scheduling). No personal reminder or OS prompt, but not strictly "viewing schedules nothing".
3. **Server sync is last-writer-wins** on `firstPracticeCompletedAt`/`reminderInvitationOutcome`/opt-in; a fresh install or second device can reset them (re-prompt). Eligibility is device-local; there is no server hydration yet. Logout clears local state, so account B on a device can see (or, in-session, be suppressed from) the invitation — session flag reset on logout was part of the last fix batch.
4. **D1 consequence:** defaults flip to alerts-off for any *new local state* (reinstall/new device/logout→login), not only new accounts.
5. **First practice from hub/Chart/Vision** does not consume eligibility (fixed in Task 6 round), but a first practice from those paths never shows the invitation until a Home-returning practice.
6. Vision/Chart toggles are dev-only (`__DEV__` or `EXPO_PUBLIC_ENABLE_SMART_REMINDER_TOGGLES`); Momentum is live because it controls the legacy Consistency/Unfinished alerts.
7. Android denial before prompt is treated as "blocked" (no `canAskAgain` available).

## Process notes
No commits were made. Subagents were used per task with reviews; three re-reviews were folded into one final whole-change review (Haiku). Rulings are in the SDD ledger (`scratchpad/sdd/progress.md`).
