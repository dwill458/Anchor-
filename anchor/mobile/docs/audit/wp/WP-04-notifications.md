# WP-04 — Notification correctness + notification copy

**Severity:** 🟠 HIGH · **Repo:** `anchor/mobile/` (+ `supabase/functions/`)

## Objective
Make the four-type notification system behave per spec: enforce priority suppression, respect per-user timezone in the cron, harden sync, remove the legacy Weekly-Summary surface, and fix banned copy in notification titles/channels.

## Files (touch only these)
- `src/services/NotificationPriority.ts`
- `src/services/NotificationService.ts`
- `src/hooks/useNotificationController.ts`
- `src/services/NotificationSyncService.ts`
- `src/stores/settingsStore.ts`
- `src/screens/settings/SettingsScreen.tsx`
- `supabase/functions/notifications/trigger-all.ts`, `sync-state.ts`

## Change 1 — Cross-type priority suppression
- Spec order: Alchemist → Weaver → Mirror → Micro-Prime. Today `resolvePriority` (NotificationPriority.ts:10) is dead; server arbitrates only Weaver vs Alchemist; Micro-Prime + Mirror fire independently.
- Make `scheduleMicroPrime` and the weekly-summary (Mirror) schedule consult the synced `last_sent_utc_date`/`last_sent_type` and skip when a higher-priority cloud push already fired that day; OR extend server `resolvePriority`/eval to include Mirror. Keep `resolvePriority`'s order/signature.

## Change 2 — Cron timezone + 2am buffer
- `trigger-all.ts` runs at `'0 0 * * *'` UTC and dedups via `state.last_sent_utc_date === toISOString().slice(0,10)`; `state.timezone` is carried but never read.
- Compute "today" in `state.timezone` (e.g. `Intl.DateTimeFormat('en-CA',{timeZone})`, minus 2h to mirror `getAdjustedDateString`) for the `last_sent_*` comparison; gate send-time by allowed local hour (consider an hourly cron). Keep `last_sent_*` field names.

## Change 3 — Sync hardening
- `NotificationSyncService.syncNotificationStateToServer` (11-21) is silent-skip. On failure, enqueue a retry (reuse the `anchor-sync-retry-queue` pattern) or set a persisted `pendingSync` flag flushed on next `initOnAppOpen`.
- In `sync-state.ts`/`trigger-all.ts`, guard the JSONB update with an `updated_at`/`last_sent_*` precondition (avoid last-write-wins clobber). Never include `last_sent_*` in the client payload (currently true — keep it).

## Change 4 — Remove legacy Weekly-Summary controls
- `settings/SettingsScreen.tsx:402-438` renders Weekly Summary toggle + Day + Time independently of the master toggle. Fold Mirror under the master Notifications toggle (drive `weeklySummaryEnabled` from `notification_enabled`) and remove rows 402-438, OR confirm product wants them.
- Drop the orphaned `streakProtectionAlerts` writes in `settingsStore.ts:851,883`.

## Change 5 — Notification copy (carve-out from WP-03)
- `NotificationService.ts`: `:316` title 'Ritual Reminder' → 'Prime Reminder'; `:593` channel 'Ritual Reminders' → 'Prime Reminders'; `:355` title 'Streak Protection' → 'Prime Streak'; `:601` channel 'Streak Protection' → e.g. 'Prime Streak'. (Dev/test strings at 736/737/753/754 are `__DEV__`-only — optional.)

## Constraints
- Preserve `NOTIFICATION_STATE_STORAGE_KEY`, the `NotificationState` interface, `weaver_enabled`, and the hook's public API.
- Changing a channel name creates a new Android channel; note this in the PR (existing installs keep the old channel until reinstall).

## Acceptance criteria
- On a day a cloud push fires, Micro-Prime/Mirror do not also fire.
- Cron dedup respects user timezone (add/adjust a unit test in `supabase/functions/notifications/`).
- Sync failure retries; no banned words in notification titles/channels.
- `npx tsc --noEmit`; `npx jest NotificationPriority NotificationSyncService useNotificationController` pass.
