# Anchor — Pre-Launch Codebase Audit

**Date:** 2026-05-29
**Scope:** `anchor/mobile/` (445 TS/TSX files) + `supabase/functions/`. Excluded `anchor-v2/`, `frontend/`, `archive/`.
**Method:** Direct call-chain tracing of critical flows + specialist sweeps (notifications, focus-session/perf, platform/submission) + exhaustive grep inventories (vocabulary, data/types).

Severity: `BLOCKER` | `HIGH` | `MEDIUM` | `LOW` | `NOTE`

> Fix work is decomposed into parallelizable work packages in [`WORK_PACKAGES.md`](./WORK_PACKAGES.md).

---

## LAUNCH READINESS VERDICT

- **BLOCKERs: 2** — visible MM:SS timer in Focus Session; non-idempotent activation completion (double-counted prime + duplicate server POST).
- **HIGHs: 11** — RevenueCat unwrapped calls + empty entitlement-ID; local-timestamp trial reinstall bypass; iOS Privacy Manifest missing; `usesAppleSignIn` missing; pervasive banned vocabulary; IntentionInput↔ReturningIntention parity gap; notification priority not enforced; cron UTC/timezone; duplicate `SettingsScreen` fragility; legacy Weekly-Summary toggles; notification permission cold-start timing.
- **MEDIUMs: ~9** — `totalPrimes` dual source-of-truth; sign-out leaves notification/teaching state; notification sync split-brain; controller write-serialization; deep-prime MM:SS pills; tier-gating ambiguity; BILLING not explicit; RevenueCat fail-fast; `as any` navigation typing.

**Summary.** Anchor is close but not ship-ready; the critical path is short. The two true BLOCKERs are single-file, surgical fixes. Three submission/revenue HIGHs must clear before store submission: the local-timestamp trial (reinstall = infinite free Pro), RevenueCat error-handling + empty entitlement-ID (tied to the live Google Play "red status" API-permission issue), and iOS Privacy Manifest + `usesAppleSignIn`. Vocabulary violations and the IntentionInput parity gap are high-visibility quality issues but won't crash. Architecture is sound where it counts: streak day-guarding, threadStrength flooring, audio asset integrity, view-shot/list/memoization hygiene, cleartext-traffic posture, photo-permission ordering, and deferred-feature discipline all verified safe.

---

## SECTION 1 — CRITICAL BLOCKERS

### [BLOCKER] Visible MM:SS countdown violates "gold ring is sole indicator"
- **File:** `src/screens/rituals/components/FocusSession.tsx:1033` (helper `formatTime` 268-271; linear bar 1040-1044)
- **Issue:** During running/paused the top bar renders `<Text testID="focus-session-timer">{timerDisplay}</Text>` — an explicit M:SS / MM:SS countdown — alongside the gold `ProgressRing` and a third linear progress bar.
- **Impact:** Direct breach of the design contract; reintroduces clock-watching.
- **Fix:** Remove the `timerTop` Text node (1032-1036), keep the `topBarSpacer` branch (matches the seal phase). Optionally drop the linear `progressTrack`/`progressFill`. Delete now-unused `formatTime`/`timerDisplay`.

### [BLOCKER] Activation completion not idempotent → double-counted prime + duplicate POST
- **File:** `src/screens/rituals/ActivationScreen.tsx:264-285` (re-entry triggers: `beforeRemove` 393, `BackHandler` 409, `onDismiss` 499); `src/stores/anchorStore.ts:196-202` (`incrementTotalPrimes` = blind +1).
- **Issue:** `handleComplete` has no re-entry guard. After the seal fires it once, the post-session modal stays mounted; a back-press or swipe-back re-invokes `handleComplete` → `logActivationInBackground()` runs `incrementTotalPrimes()` again and re-POSTs `/api/anchors/{id}/activate`. (`recordPrimeSession()` IS day-guarded at anchorStore:208-210, so the streak day-count is protected — but `totalPrimes` and the server call are not.)
- **Impact:** Lifetime `totalPrimes` inflates (drives Rank/Practice-Depth display); duplicate activation POST. Core metric integrity defect.
- **Fix:** Add `hasLoggedActivationRef` and guard the body of `logActivationInBackground` (`if (hasLoggedActivationRef.current) return; hasLoggedActivationRef.current = true;`). Preserve function names.

### Cold-start trial persistence — RESOLVED (not a blocker)
`trialStartDate` is persisted via Zustand `persist` (`subscriptionStore.ts:123-128`); `App.tsx:568` holds a splash until `launchStateResolved` (set at :323 after auth sync/hydration). `useTrialInit` (`RootNavigator.tsx:48-64`) runs after hydration in practice — it does NOT re-stamp on every cold start; the timestamp survives termination. Residual MEDIUM: no *explicit* barrier guarantees `subscriptionStore` hydration before the trial guard reads it.

### [HIGH] RevenueCat entitlement/restore calls unwrapped; empty entitlement-ID silently denies Pro
- **File:** `src/services/RevenueCatService.ts` (`logIn` 188-198, `refreshTrialStatus` 200-209, `restorePurchases` 292-301 — no try/catch); `src/config/index.ts:26` (`REVENUECAT_ENTITLEMENT_ID` defaults to `''`).
- **Issue:** Purchase paths are wrapped; `logIn`/`refreshTrialStatus`/`restorePurchases` are not. A RevenueCat 500/timeout (the live "red status" issue) throws; on the app-open refresh path the store silently retains its prior value. Separately, `getEntitlementInfo` reads `entitlements.active['']` if the env var is unset → every paying user resolves to `free`.
- **Mitigation:** all `eas.json` store profiles inject `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro` today.
- **Fix:** Wrap the three methods in try/catch returning `getCurrentStatus()`; surface restore failures; add a startup fail-fast on empty keys; resolve the Play Console API permission.

### [HIGH] 7-day trial is a purely LOCAL timer → reinstall resets it (entitlement bypass)
- **File:** `src/stores/subscriptionStore.ts:6-14,103`; `src/navigation/RootNavigator.tsx:50-52`; `src/hooks/useTrialStatus.ts:105-107`.
- **Issue:** `useTrialInit` stamps `trialStartDate=new Date()` on first open; `getEffectiveTier`/`useTrialStatus` grant full `pro` while `computeDaysRemaining > 0` — no purchase, no server check. AsyncStorage is wiped on reinstall (and excluded from cloud backup).
- **Impact:** Uninstall+reinstall = fresh 7-day Pro indefinitely. Revenue bypass on both platforms.
- **Fix:** Treat local `trialStartDate` as offline UX cache only; gate Pro on the RevenueCat entitlement / `remoteCompedAccess`, or model the trial as a RevenueCat offering keyed to `appUserID`.

### Verified-safe blockers checked
- **NOTE Audio assets:** all 44 `require()`d sounds in `useAudio.ts` exist; `android/.../res/raw/notification.wav` present. No missing-asset crash.
- **NOTE threadStrength floor:** decay floored at 5–10 (`sessionStore.ts:411-412`), bump clamped `[0,100]` (:424). Cannot go negative; never zeros via decay.
- **NOTE Burn gate placement:** `ConfirmBurnScreen.tsx:87` checks entitlement in a mount `useEffect`, BEFORE the `BurningRitualScreen` animation. No "burn-then-paywall" trap.

---

## SECTION 2 — DATA INTEGRITY & STATE MANAGEMENT

### [MEDIUM] `totalPrimes` has two competing sources of truth
- **File:** `src/stores/anchorStore.ts` (`incrementTotalPrimes` 196-202 = blind +1; `calculateTotalPrimes` 56-57 = sum of `activationCount`, used by setAnchors/addAnchor/removeAnchor/applySyncedAnchor).
- **Issue:** A prime does +1, but any later sync/setAnchors recomputes from per-anchor `activationCount`, overwriting the increment; `removeAnchor` recomputes downward.
- **Fix:** Pick one source — bump `anchor.activationCount` on prime (keep `calculateTotalPrimes` authoritative) and drop the standalone increment, or stop recomputing. Preserve field name.

### [MEDIUM] Sign-out leaves notification + teaching + milestone state (cross-user leak)
- **File:** `src/stores/authStore.ts:912-935`.
- **Issue:** `signOut` clears anchors/session/auth and removes `anchor-vault-storage`, `anchor-session-storage`, `anchor:cached_user`, `@anchor_recovery_dump_*`; but NOT `@anchor_notification_state`, `@anchor_last_milestone_shown`, `anchor-teaching-storage`, or `anchor-subscription-override-storage` (trial).
- **Impact:** A second account on the same device inherits notification counters, milestone-shown, teaching-seen flags.
- **Fix:** Also call `clearNotificationSession()` (NotificationSessionService) and reset `teachingStore` on sign-out. Decide intent for the device-level trial store.

### Verified-safe (NOTE)
- **primeStreak reset:** `recordPrimeSession` is day-guarded; non-consecutive prime resets to `1` (number), never `undefined`; init `0`.
- **threadStrength serialization:** number (`default 50`), clamped `[0,100]`, decay floored 5–10.
- **avatarUtils empty string:** `getDefaultAvatar` guards `Number.isNaN(...) ? 0 : ...`; `getAvatarByIndex` normalizes negatives. Safe.
- **Practice Depth / Rank:** derived in `progression.ts` from append-only priming history (lifetime), not the mutable `anchorStore.totalPrimes`. Monotonic.
- **AsyncStorage key consistency:** see Appendix B. No divergent spellings; three naming conventions (`@anchor_X`, `anchor:X`, `anchor-X-storage`) each used consistently per domain.

---

## SECTION 3 — PRO / FREE GATING

Freemium is removed: `entitlements.ts:20-44` returns **identical** flags for `free` and `pro`. Access is gated by a **single trial-expiry boundary** at the navigation root (`RootNavigator.tsx:82` → `TrialEndScreen`/`Paywall`).

| Feature | Tier | UI gate | Logic gate | Notes |
|---|---|---|---|---|
| App access after trial | active | ✅ | ✅ root | Correct |
| Burn → Vault archive | trial/active | ✅ | ✅ | `ConfirmBurnScreen.tsx:87` before animation ✓ |
| Mirror (weekly summary) | "Pro" | ⚠️ | ⚠️ | Gated by `notification_enabled && weeklySummaryEnabled`, not tier |
| Alchemist (milestone) | "Pro" | n/a | server | Server eval only |
| Forge Moment overlay | "Pro" | ❌ | ❌ | Renders for all (`App.tsx:623`) |
| Multiple anchors | unlimited | n/a | n/a | `maxAnchors: Infinity` for everyone |

**[MEDIUM]** Mirror/Alchemist/Forge-Moment are no longer tier-gated in logic (only trial-gated). No UI-only bypass exists because there is no free tier *inside* the app. Confirm this matches intent or update the spec.

---

## SECTION 4 — VOCABULARY & COPY COMPLIANCE

**[HIGH] Banned vocabulary is pervasive in user-facing copy.** Full verified inventory in **Appendix A**. Banned tokens found in shipped UI: `ritual`, `sigil`, `streak`, `charge/charged/charging`, `activation`, `PRO` (badge). `spell`/`occult`/`manifesting`/`subconscious` — no production violations (only "spelling it out", non-magical). DEFERRED-commented and `__DEV__`-only matches excluded.

Highest-visibility (onboarding/paywall/notifications):
- `HowItWorksScreen.tsx:36` "Forge Your **Sigil**"; `:42` "**Charge** with **Ritual**"
- `TrialSignUpScreen.tsx:41` "AI **sigil** enhancement"; `:42` "Full practice tracking & **streaks**"
- `ReframeScreen.tsx:32,38,44` onboarding slides: "daily **ritual**" / "a **ritual**" / "personal **ritual**"
- `DailyLoopScreen.tsx:31` "Daily **activation**…"; `:40` "Track Your **Streak**"
- `ProPaywallModal.tsx:55` "Build a **sigil** that feels truly yours"
- `NotificationService.ts:316` title "**Ritual** Reminder"; `:355` title "**Streak** Protection"; `:593`/`:601` Android channel names "**Ritual** Reminders"/"**Streak** Protection"
- `teaching.ts:110` "Look at the **sigil**…"; `:154` "…part of the **ritual**…"

**Fix:** Dedicated copy pass mapping sigil→anchor, ritual→practice/Burn & Release, charge→prime, "Activation"→"Focus Session"/"Prime", "Streak"→"Prime Streak"/"Constancy".

---

## SECTION 5 — PARITY: IntentionInputScreen vs ReturningIntentionScreen

**[HIGH] IntentionInputScreen performs NO gibberish/quality detection.**
- `IntentionInputScreen.tsx` validates ONLY length (`isValid` line 163; imports only `detectCategoryFromText`).
- `ReturningIntentionScreen.tsx:33` imports `analyzeIntention, detectGibberish, getGuidanceText` and runs them at 223-236 (length ≥ 6 → `detectGibberish` → `analyzeIntention` for negation/future/vague).
- **Discrepancy:** the entire detection chain (gibberish → negative → future → vague) is absent from the first-run screen.
- **Parity OK:** char limits identical (`minChars=3`, `maxChars=100`); both use `detectCategoryFromText`; both gate continue on `canSubmit`.
- **Fix:** Extract shared validation into a hook; apply identically in both. Preserve `detectGibberish`/`analyzeIntention` names.

---

## SECTION 6 — NOTIFICATION SYSTEM

- **[HIGH] Four-tier priority does NOT suppress lower types.** `resolvePriority` (NotificationPriority.ts:10) has no runtime caller; server arbitrates only WEAVER vs ALCHEMIST (`trigger-all.ts:62-69`). Micro-Prime (local) and Mirror (local weekly) fire independently → 2-3 notifications can fire same day.
- **[HIGH] Cron uses UTC calendar date; ignores per-user timezone + 2am buffer.** `trigger-all.ts:39-42,288`, cron `'0 0 * * *'`; `state.timezone` carried but never read; `getAdjustedDateString` is mobile-only. Nudges can arrive at antisocial local hours.
- **[MEDIUM] Sync is silent-skip; full-JSONB read-modify-write non-atomic.** `NotificationSyncService.ts:11-21`; `sync-state.ts`/`trigger-all.ts` lack optimistic locking → last-write-wins; `alchemist_milestones_count` is imperative and can be lost.
- **NOTE verified:** first-launch defaults safe; Micro-Prime reschedules on Wake/Reminder change; `weaver_enabled` truly disables Weaver; `@anchor_notification_state` key consistent everywhere.

---

## SECTION 7 — FOCUS SESSION INTEGRITY

- **BLOCKERs** (visible timer; non-idempotent completion) — see Section 1.
- **[MEDIUM]** Deep-Prime `RitualScreen.tsx:2261,2277` shows two MM:SS pills ("THIS PHASE", "TOTAL LEFT") — product decision whether ring-only extends to deep prime.
- **[LOW]** `FocusSession.tsx:774-779` seal `setTimeout(onComplete,400)` not cleared on unmount.
- **NOTE verified:** Arrive phase is a manual gate (running phase always gets full `totalMs`; skipped cleanly when disabled); `prime-begin` only after Begin; `prime-complete` only on countdown→0 (never on abandon); component-level completion gate idempotent (`completionTriggeredRef`/`continuePressedRef`).

---

## SECTION 8 — SETTINGS SCREEN

- **[HIGH] Two `SettingsScreen` files; live one selected only by a barrel re-export.** `src/screens/profile/SettingsScreen.tsx` (DEAD, no notification UI) vs `src/screens/settings/SettingsScreen.tsx` (LIVE via `profile/index.ts:2`). A one-line, type-safe edit could ship a build with no notification controls.
- **[HIGH] Legacy Weekly-Summary controls remain in the live screen; orphaned `streakProtectionAlerts`.** `settings/SettingsScreen.tsx:402-438`; `settingsStore.ts:851,883` (written, never read, not in partialize).
- **[MEDIUM] No write-serialization:** ~9 `useNotificationController` mounts do unguarded read-modify-write on the state key → last-write-wins + redundant syncs.
- **NOTE verified:** master toggle controls all four types; Wake/Reminder pickers persist + reschedule.

---

## SECTION 9 — PERFORMANCE & MEMORY

All verified safe (NOTE): useEffect cleanups paired (only LOW = §7 seal timeout); `expo-audio` players tracked + `.remove()`d on unmount/disable/finish (no `expo-av`); `captureRef` only in user-action handlers; all FlatLists use stable `keyExtractor` (no index keys); heavy canvases memoized/tier-gated. Optional: memoize `ForgeMomentOverlay` SVG geometry.

---

## SECTION 10 — ANDROID

- **NOTE verified:** `res/raw/notification.wav` present; `network_security_config.xml` blocks cleartext (only localhost/10.0.2.2; `usesCleartextTraffic` debug-only); WebView fonts are system fonts (no external `@import`); notification/audio permissions + plugins present; `safeHaptics` wraps haptics in try/catch.
- **[MEDIUM]** `com.android.vending.BILLING` not explicit in committed manifest (RevenueCat merges it via autolinking; verify in built AAB).
- **[LOW]** `expo-media-library` used but not declared as a config plugin.
- **[LOW]** Release buildType references the debug keystore (EAS overrides for store builds).

---

## SECTION 11 — IOS

- **[HIGH] `ios.usesAppleSignIn` not set, but Sign in with Apple ships** (`AuthService.native.ts:313-354`, `LoginScreen.tsx:420-428`). `expo-apple-authentication` plugin likely injects the entitlement — verify before submit. Apple requires it when Google SSO is offered (it is).
- **[HIGH] No app-level iOS Privacy Manifest** (`PrivacyInfo.xcprivacy` absent). Required-reason APIs (AsyncStorage/SecureStore → UserDefaults `CA92.1`; view-shot/media-library → file-timestamp `C617.1`) and collected data (Sentry/Firebase/RevenueCat) undeclared → ITMS-91053 / rejection risk.
- **[MEDIUM] Notification permission requested right after auth, not on a user action** (`App.tsx:483-520`). Gate behind `getPermissionsAsync()` / explicit opt-in.
- **NOTE verified:** `NSPhotoLibrary*UsageDescription` present + needed; every `saveToLibraryAsync` preceded by a granted-guard; `ITSAppUsesNonExemptEncryption:false` set.

---

## SECTION 12 — DEFERRED FEATURES DISCIPLINE

Discipline is **good** — ~50 `// DEFERRED:` markers, all inert; deferred routes (Mantra, Stabilize) are not registered as active `<Stack.Screen>`; `MantraCreationScreen` typed against `DeferredMantraCreationStackParamList`. Verified not navigable.

**[LOW]** `src/screens/create/SigilSelectionScreen.backup.tsx:58` (a `.backup.tsx` left in `src/`) calls `navigation.navigate('MantraCreation', …)`. Appears unimported; relocate to `/archive` or `// DEFERRED:`-comment the call.

---

## SECTION 13 — TYPE SAFETY & EDGE CASES

- **[MEDIUM] 47 `as any`; navigation typing gap** (full list in Appendix C). ~30 are `(navigation as any).navigate/replace(...)` for cross-navigator routes not in the local param list — a typo in route name/params compiles silently. Concentrated in `ActivationScreen.tsx` (12 — the BLOCKER screen). Remainder are benign style/ref casts and a few untyped data-shape casts (AIVariationPicker, AIAnalysis).
- **2 `@ts-expect-error`:** `PrimeAnchorCanvas.tsx:311` (Skia type gap, benign); `OnboardingScreen.tsx:392` (navigation types — same gap).
- **NOTE:** RevenueCat entitlement key is a constant (`config/index.ts`) but defaults to `''` (see §1). `AIGeneratingScreen.tsx:706 tier:'premium'` is analytics metadata, not a gating key. `avatarUtils` empty-string safe.
- **Fix:** Type navigation per screen (`NativeStackScreenProps<…>`) and remove casts; prioritize ActivationScreen.

---

## SECTION 14 — APP STORE / GOOGLE PLAY SUBMISSION

- **NOTE verified:** no non-HTTPS production calls; no private APIs; `ITSAppUsesNonExemptEncryption:false`.
- **[HIGH]** iOS Privacy Manifest missing (§11).
- **[HIGH]** `usesAppleSignIn` missing (§11).
- **[MEDIUM]** BILLING not explicit (§10); RevenueCat keys default to `''` with no fail-fast (eas.json injects them today).

---

## Appendix A — Vocabulary Violation Inventory (user-facing, verified)

> Excludes code comments, identifiers, `__tests__`/`.test.`, `__DEV__`-only developer tools, DEFERRED-commented lines, and internal logger/analytics strings.

### `ritual`
| File:line | String |
|---|---|
| components/modals/ConfirmDeleteAnchorSheet.tsx:61 | "Burn & Release is the proper ritual." |
| config/ritualConfigs.ts:135,221,458 | name: 'Ritual Charge' (rendered as card title) |
| services/NotificationService.ts:316 | title: 'Ritual Reminder' (notification) |
| services/NotificationService.ts:593 | name: 'Ritual Reminders' (Android channel) |
| constants/teaching.ts:154 | "…part of the ritual. It asks for your full attention." |
| utils/sigil/traditional-generator.ts:241 | title: 'Ritual' (verify if surfaced in UI) |
| screens/vault/VaultScreen.tsx:521 | "YOUR RITUAL SPACE AWAITS" (empty state) |
| screens/rituals/components/DepthCard.tsx:50 | label: 'Deep Ritual' |
| screens/rituals/components/ModeSelectionStep.tsx:134,158 | "Ritual Charge" |
| screens/rituals/BreathingAnimation.tsx:199 | "Prepare yourself for the ritual" |
| screens/rituals/components/BurnAnimationOverlay.tsx:391 | "Continue Ritual" (alert button) |
| screens/rituals/components/BurnAnimationOverlay.tsx:630 | "Finalizing ritual" |
| screens/onboarding/HowItWorksScreen.tsx:42 | title: 'Charge with Ritual' |
| screens/onboarding/ReframeScreen.tsx:32,38,44 | "…daily ritual…" / "…a ritual…" / "…personal ritual…" |
| screens/practice/EvolveScreen.tsx:132,144 | "…settling rituals." / "Burn ritual, closure ceremonies." |
| screens/rituals/ConfirmBurnScreen.tsx:104 | "…begin this release ritual again if you leave now." |
| screens/rituals/RitualScreen.tsx:1595,1840 | "Exit ritual" (a11y label) |
| screens/rituals/components/RitualTopBar.tsx:33 | "Exit ritual" (a11y label) |
| screens/rituals/SealAnchorScreen.tsx:298 | "…saved without the sealing ritual." |
| screens/rituals/components/CommitmentGate.tsx:94 | "Starts your … charging ritual" |
| screens/auth/FirstAnchorAccountGateScreen.tsx:131 | "…replaying your ritual progress." |

### `sigil`
| File:line | String |
|---|---|
| constants/teaching.ts:110 | "Look at the sigil. Let the intention settle." |
| navigation/VaultStackNavigator.tsx:191 | title: 'Forge Your Sigil' (header; headerShown:false — verify) |
| screens/onboarding/HowItWorksScreen.tsx:36 | title: 'Forge Your Sigil' |
| screens/onboarding/TrialSignUpScreen.tsx:41 | label: 'AI sigil enhancement' |
| components/modals/ProPaywallModal.tsx:55 | "Build a sigil that feels truly yours" |
| screens/create/AIGeneratingScreen.tsx:766 | "Failed to enhance sigil. Please try again." (error) |
| screens/vault/AnchorDetailScreen.tsx:980,1019,1030 | "Allow photo library access to save/share your sigil" |
| screens/vault/AnchorDetailScreen.tsx:1088 | "Why are you reporting this sigil?" |

### `streak`
| File:line | String |
|---|---|
| components/ThreadStrengthSheet.tsx:434,438 | "Current Streak" / "Longest Streak" |
| components/EditProfileSheet.tsx:324 | "Auto-detected · used for streak accuracy" |
| services/NotificationService.ts:355 | title: 'Streak Protection' |
| services/NotificationService.ts:601 | name: 'Streak Protection' (channel) |
| screens/vault/components/DailyStreakStrip.tsx:90 | "Daily Streak"; :61 a11y "Daily streak: N days" |
| screens/vault/components/PracticePathCard.tsx:191 | "Streak:" |
| screens/onboarding/TrialSignUpScreen.tsx:42 | "Full practice tracking & streaks" |
| screens/onboarding/DailyLoopScreen.tsx:40 | title: 'Track Your Streak' |
| screens/practice/components/DailyThreadDetailsSheet.tsx:58 | "Streak" |
| screens/practice/components/StreakChip.tsx:57 | "Streak" |

### `charge` / `charged` / `charging`
| File:line | String |
|---|---|
| components/cards/AnchorCard.tsx:184 | "CHARGED" (pill) |
| screens/vault/components/HeroAnchorCard.tsx:140 | "CHARGED" (badge) |
| screens/profile/DefaultChargeSettings.tsx:160,230 | "Charging Mode" / "About Charging" |
| screens/rituals/components/ModeSelectionStep.tsx:56 | "Charging Mode" |
| screens/practice/components/AnchorSelectorPill.tsx:57 | "Charged" |
| screens/practice/components/AnchorSelectorSheet.tsx:74 | "Charged" |
| config/ritualConfigs.ts:51,76,103,354 | name: 'Focus Charge' |
| config/ritualConfigs.ts:135,221,458 | name: 'Ritual Charge' |
| screens/rituals/components/DepthCard.tsx:60 | label: 'Light Charge' |
| screens/onboarding/HowItWorksScreen.tsx:42 | "Charge with Ritual" |
| constants/teaching.ts:199 | "…Begin the first charge when you're ready." |
| screens/rituals/components/CommitmentGate.tsx:83,94 | "Select a charging mode…" / "…charging ritual" |
| screens/profile/SettingsScreen.tsx:586 | "Control how your anchors are created, charged, and activated." |
| stores/authStore.ts:711 | "Your first anchor was created, but charging did not sync." |

### `activation`
| File:line | String |
|---|---|
| screens/profile/DefaultActivationSettings.tsx:159,181,269 | 'Full Activation' / "Activation Type" / "About Activation" |
| screens/profile/VoiceStyleScreen.tsx:45 | "…everyday activation." |
| screens/vault/components/PracticePathCard.tsx:167,182,186 | "Recent Activations" / "View all activations (soon)" / "No activations yet" |
| screens/vault/AnchorDetailScreen.tsx:507 | "Primer Activation" |
| screens/onboarding/DailyLoopScreen.tsx:31 | "Daily activation takes less than a minute…" |
| screens/practice/EvolveScreen.tsx:138 | "Activation sessions, timers, mantras." |
| screens/profile/SettingsScreen.tsx:586 | "…created, charged, and activated." |

### `PRO` (badge label)
| File:line | String | Notes |
|---|---|---|
| screens/create/components/RefineStyleCard.tsx:179 | "PRO" (lockText) | Active |
| screens/create/MantraCreationScreen.tsx:642 | "PRO" (badge) | LOW — DEFERRED/unreachable screen |
| screens/practice/EvolveScreen.tsx:197 | "PRO" | EXCLUDED — inside `{/* DEFERRED */}` |

---

## Appendix B — AsyncStorage Key Catalog

**Persisted Zustand stores:**
| Store name | Storage | Cleared on sign-out? |
|---|---|---|
| anchor-auth-storage | encryptedAuthStorage | yes (in-memory + key) |
| anchor-vault-storage | encryptedPersistStorage | yes |
| anchor-session-storage | encryptedPersistStorage | yes |
| anchor-subscription-override-storage | AsyncStorage (NOT encrypted) | **no** (trial state) |
| anchor-settings-storage | AsyncStorage | no (device pref) |
| anchor-teaching-storage | AsyncStorage | **no** (cross-user flags) |
| profileStore | AsyncStorage | partially |

**Standalone keys:** `@anchor_notification_state`, `@anchor_last_milestone_shown`, `@anchor_prime_on_launch`, `@anchor_recovery_dump_complete`, `@anchor_recovery_dump_vault`, `anchor:cached_user`, `anchor:post_prime_trace:last_attempt_started_at`, `anchor:settings` + `anchor:settings:*` (focusBurstGoal, focusDefaultMode, focusDuration, hapticFeedback, openDailyAnchorAuto, practiceGuidance, primingDuration, primingMode, reduceIntentionVisibility, soundEffects, weeklySummaryDay, weeklySummaryEnabled, weeklySummaryTime).

`anchor:a/b/c/test/delete` are **test-only** (StorageService.test.ts). `anchor_*` (activated/burned/created/…) are **analytics event names**, not storage keys. No divergent spellings detected.

---

## Appendix C — `as any` Inventory (47, non-test)

**Navigation casts (~30) — typing gap (MEDIUM):** ActivationScreen.tsx (215,298,352,363,369,371,384,438,444,451,454,456 — 12), LoginScreen.tsx (161,163,165,167), SignUpScreen.tsx (91,93,95,205), RitualScreen.tsx (1026,1076,1252), ConfirmBurnScreen.tsx (193,212), profile/SettingsScreen.tsx (561,690), VaultScreen.tsx (280), PracticeScreen.tsx (116), ChargeCompleteScreen.tsx (115), useMissingAnchorRedirect.ts (16).

**Style casts (benign):** ProgressionSheet.tsx (124,133,147), ProfileScreen.tsx (778), SealAnchorScreen.tsx (620), TodayAnchorCard.tsx (86).

**Ref/SDK casts (benign):** SettingsButton.tsx (99), ErrorTrackingService.ts (153,232).

**Data-shape casts (LOW-MED):** AIVariationPickerScreen.tsx (145,162,166), AIAnalysisScreen.tsx (112,113), ManualForgeScreen.tsx (102), ChargeSetupScreen.tsx (185).

**`@ts-expect-error`:** PrimeAnchorCanvas.tsx:311 (Skia), OnboardingScreen.tsx:392 (nav types).
