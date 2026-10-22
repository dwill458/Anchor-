# Notifications pass 2 — Evidence report

## Emulator attempt (partial) — 2026-10-09

**Status: stopped early on coordinator instruction (switch to the physical phone). I captured no visual evidence of the notification UI on the emulator.** I make no claims about visual parity with the mockup.

### What was captured
- `00_launch.png` — dev-client error screen ("There was a problem loading the project", okhttp `unexpected end of stream`). It came from launching before Metro had finished starting. It is not app UI. A second screenshot after tapping Reload failed: a second adb device (the phone, `192.168.0.251:41433`) had connected, so the unqualified `adb` call errored with "more than one device/emulator".
- Nothing for items 1–5 (Settings → Notifications, Invitation / Choose-your-time, OS permission dialog, Reduced Motion, small screen).

### Setup findings (reusable)
- AVD `Vision_QA` (API 36) cold-boots fine with `emulator -avd Vision_QA -no-snapshot-load`.
- **A dev-client APK is installed on Vision_QA**: `com.anchorintentions.app`, versionName 1.5.0, installed 2026-09-21 03:08 (it has `expo.modules.devlauncher`). Its native modules may be older than the current branch. That was not confirmed, because the JS bundle never got to render.
- There is also a local APK at `E:\Projects\Anchor\artifacts\anchor-2.0-preview.apk` (not inspected or installed).
- The AVD's baseline state was left as found: `wm size` override 786x1704 (physical 1080x2400), density override 320 (physical 420), gesture navigation (`navigation_mode=2`), all three animation scales at 1. **The AVD already ships with a smaller-screen override**, so a "small screen" check there means changing the override and then restoring it to 786x1704, not running `wm size reset`.
- Repo is on branch `feat/celebration-layer` with many uncommitted changes (including `useNotificationController.ts`).
- Metro command that worked: `cd E:\Projects\Anchor\anchor\mobile && npx expo start --dev-client --port 8081`. It loads `.env.local`. Wait for `curl http://localhost:8081/status` to return `packager-status:running` before launching. Metro logged `[PERF] persist-setItem-settled` for `anchor-vault-storage`: about 15 s per write, payload about 676 KB.
- Launch steps (emulator):
  1. `adb -s emulator-5554 reverse tcp:8081 tcp:8081`
  2. `adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d "anchor://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.anchorintentions.app`
  - The scheme is `anchor`. `anchor-dev://` does not resolve.
  - **Always pass `-s <serial>`** when the phone is connected too.

### Dev-only entry options for the invitation / time routes (none exist yet)
- No deep link opens `V2NotificationInvitation` or `V2ReminderTime`. Existing `__DEV__` lab patterns to copy for a throwaway host:
  - `screens/v2/system/ChartLabDevHost.tsx` (`anchor://chart-lab` plus `DevSettings.addMenuItem`)
  - `screens/v2/system/VisionVisualQADevHost.tsx` (`anchor://vision-visual-qa?surface=...`)
  - `screens/create/flow/dev/CreationFlowQADevHost.tsx`
- `V2DevelopmentHome.tsx` has a dev-menu item called "Seed demo Anchor + Vision + Chart" that may supply an `anchorId`.
- Route params: `V2NotificationInvitation: { anchorId, anchorTransition?, reducedMotion? }` and `V2ReminderTime: { anchorId }`. Both are registered in `navigation/v2/AnchorV2Navigator.tsx:586-587`.
- Real entry: the gate is `shouldShowReminderInvitation` in `screens/v2/notifications/invitationEligibility.ts`. It reads AsyncStorage `NOTIFICATION_STATE_STORAGE_KEY` and needs all of:
  - `firstPracticeCompletedAt` null
  - `reminderInvitationOutcome` null
  - not opted in
  - authenticated
  - onboarded
  - session saved

  A fresh, signed-in account (or cleared notification state) plus one completed practice should trigger it.
- I did not add or edit any source files.

### Cleanup done
- Emulator killed (`adb emu kill`). I removed its 8081 reverse first.
- The Metro process I started (node PID 11632) has been stopped, and port 8081 is free.
- I did not change animation scales, `wm size` or density, so nothing needed restoring.
- No git operations.

### Not done (moved to the physical-phone pass)
- All captures for items 1–5, the mockup mismatch list, the logcat scan, and schedule verification (`dumpsys alarm` / `dumpsys notification`).
