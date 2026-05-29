# WP-05 — Settings dedupe + sign-out state clearing

**Severity:** 🟠 HIGH (dedupe) + 🟡 MEDIUM (sign-out) · **Repo:** `anchor/mobile/`

## Objective
Eliminate the duplicate dead `SettingsScreen` footgun and stop cross-user state leakage on sign-out.

## Files (touch only these)
- `src/screens/profile/SettingsScreen.tsx` (DELETE — confirmed dead)
- `src/screens/profile/index.ts` (verify barrel)
- `src/stores/authStore.ts`
- `src/services/NotificationSessionService.ts` (reference only)
- `src/stores/teachingStore.ts` (add a reset if none exists)

## Change 1 — Remove the dead duplicate SettingsScreen
- `src/screens/profile/SettingsScreen.tsx` is unreferenced: `ProfileStackNavigator.tsx:113` registers the screen imported via `profile/index.ts:2` which re-exports `export { SettingsScreen } from '../settings';`. The profile-folder file is shadowed and has NO notification UI.
- Verify no direct importer: `grep -rn "profile/SettingsScreen" src` returns nothing. Then delete `src/screens/profile/SettingsScreen.tsx`.
- This is the ONE allowed deletion (the file is dead and is a latent ship-stopper). Keep the barrel line and the `Settings` route name unchanged.
- Note: the banned-vocabulary string at its old `:586` ("…created, charged, and activated.") disappears with the file — no WP-03 action needed there.

## Change 2 — Clear all user state on sign-out (authStore.ts:912-935)
- `signOut` currently clears anchors/session/auth + removes `anchor-vault-storage`, `anchor-session-storage`, `anchor:cached_user`, `@anchor_recovery_dump_*`.
- Add: `clearNotificationSession()` (from `NotificationSessionService`, which removes `NOTIFICATION_STATE_STORAGE_KEY`) and remove `@anchor_last_milestone_shown`.
- Add `useTeachingStore.getState().reset()` (create a `reset()` action in `teachingStore.ts` if absent) so teaching-seen flags don't carry to the next account.
- Decide intent for `anchor-subscription-override-storage` (trial). If trial is device-level, leave it and add a code comment; if account-level, clear it too.

## Change 3 — authStore copy carve-out (from WP-03)
- `authStore.ts:711` "Your first anchor was created, but charging did not sync." → replace "charging" with "priming".

## Constraints
- Preserve `signOut`, `clearAnchors`, `reset`, AsyncStorage keys, and the `Settings` route name.
- Only delete `profile/SettingsScreen.tsx` — no other deletions.

## Acceptance criteria
- App builds with the live `settings/SettingsScreen.tsx` (notification UI intact); `grep -rn "profile/SettingsScreen" src` is empty.
- After sign-out, `@anchor_notification_state`, `@anchor_last_milestone_shown`, and teaching flags are gone (verify in a test or by inspection).
- `npx tsc --noEmit`; `npx jest authStore SettingsScreen` pass.
