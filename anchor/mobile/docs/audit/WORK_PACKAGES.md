# Anchor Launch — Parallelizable Work Packages

Derived from [`ANCHOR_LAUNCH_AUDIT.md`](./ANCHOR_LAUNCH_AUDIT.md). Each `wp/WP-NN-*.md` is a **self-contained brief** you can hand to one agent. They are scoped to **non-overlapping file sets** so they can run concurrently.

## How to dispatch
Give each agent: its `wp/WP-NN-*.md` file + the repo path `anchor/mobile/`. One agent = one work package. Tell each agent to work only on the files listed in its brief.

## Global constraints (every package)
- Preserve all route names, TypeScript interfaces, AsyncStorage keys, analytics event names, and function names.
- Never delete deferred elements; comment with `// DEFERRED:` prefix (exception: WP-05 deletes one confirmed-dead file).
- Run `npx tsc --noEmit` and the package's named tests before finishing.
- Touch **only** the files in your brief's "Files" list. If you need a file owned by another package, stop and note it.

## Parallel batching

**Batch 1 — run all 7 concurrently (disjoint files):**
| WP | Title | Priority |
|----|-------|----------|
| WP-01 | Focus Session BLOCKERs (timer + idempotency) | 🔴 BLOCKER |
| WP-02 | RevenueCat hardening + trial entitlement source | 🟠 HIGH |
| WP-03 | Vocabulary copy compliance pass | 🟠 HIGH |
| WP-04 | Notification correctness + notification copy | 🟠 HIGH |
| WP-05 | Settings dedupe + sign-out state clearing | 🟠 HIGH |
| WP-06 | iOS/Android submission config | 🟠 HIGH |
| WP-07 | Intention screen parity | 🟠 HIGH |

**Batch 2 — run after Batch 1 merges (shares files with WP-01/03):**
| WP | Title | Priority |
|----|-------|----------|
| WP-08 | Type safety: navigation param typing | 🟡 MEDIUM |

## Conflict matrix (carve-outs that keep Batch 1 disjoint)
- `NotificationService.ts` copy strings ("Ritual Reminder", "Streak Protection", channel names) are owned by **WP-04**, not WP-03.
- `authStore.ts:711` copy string ("charging did not sync") is owned by **WP-05**, not WP-03.
- `profile/SettingsScreen.tsx` is **deleted by WP-05**; WP-03 must NOT edit it (its `:586` string dies with the file).
- `RitualScreen.tsx`, `ConfirmBurnScreen.tsx`, `ActivationScreen.tsx` appear in both a Batch-1 package and WP-08, but on **different lines/regions**; WP-08 runs in Batch 2 to avoid races.

## File ownership (quick reference)
- **WP-01:** `FocusSession.tsx`, `ActivationScreen.tsx`, `anchorStore.ts`
- **WP-02:** `RevenueCatService.ts`, `config/index.ts`, `subscriptionStore.ts`, `useTrialStatus.ts`, `RootNavigator.tsx`
- **WP-03:** copy-only edits across ~28 screen/component/constant files (see brief; excludes the carve-outs above)
- **WP-04:** `NotificationPriority.ts`, `useNotificationController.ts`, `NotificationSyncService.ts`, `NotificationService.ts`, `settingsStore.ts`, `settings/SettingsScreen.tsx`, `supabase/functions/notifications/*`
- **WP-05:** `profile/SettingsScreen.tsx` (delete), `authStore.ts`, `NotificationSessionService.ts`, `teachingStore.ts`
- **WP-06:** `app.json`, `eas.json`, `android/app/src/main/AndroidManifest.xml`, `App.tsx`
- **WP-07:** `IntentionInputScreen.tsx`, `intentionPatterns.ts`, new `hooks/useIntentionValidation.ts`
- **WP-08:** navigation typing across auth/ritual/practice/vault screens + `types/index.ts`

## Suggested merge order
WP-01 → WP-02 → WP-06 → (WP-04, WP-05, WP-07, WP-03) → WP-08.
Re-run the full audit grep checks after WP-03 and WP-08.
