# WP-03 — Vocabulary copy compliance pass

**Severity:** 🟠 HIGH · **Repo:** `anchor/mobile/` · **Scope:** user-visible strings ONLY

## Objective
Replace banned vocabulary in user-facing copy with approved terms. Edit ONLY rendered strings (JSX text, `title`/`label`/`subtitle`/`placeholder`/`description`/`copy`/`name` props, accessibility labels, alert/toast text). Do NOT rename variables, functions, types, files, routes, analytics events, or imports.

## Vocabulary map
| Banned | Approved replacement |
|---|---|
| sigil | anchor |
| ritual | practice / Burn & Release (for burn) / session |
| streak | Prime Streak / Constancy |
| charge, charged, charging | prime / primed / priming |
| activation, activate (focus-mode label) | Focus Session / Prime |
| PRO (badge label) | (use approved badge wording, e.g. "Member" or remove) |

## Files & exact strings (touch only these; copy edits only)
Use the inventory in `../ANCHOR_LAUNCH_AUDIT.md` Appendix A. Files:
- `src/constants/teaching.ts` (110, 154, 199)
- `src/config/ritualConfigs.ts` (51,76,103,135,221,354,458 — the `name:` fields)
- `src/components/modals/ConfirmDeleteAnchorSheet.tsx` (61)
- `src/components/modals/ProPaywallModal.tsx` (55)
- `src/components/ThreadStrengthSheet.tsx` (434, 438)
- `src/components/EditProfileSheet.tsx` (324)
- `src/components/cards/AnchorCard.tsx` (184)
- `src/screens/vault/VaultScreen.tsx` (521)
- `src/screens/vault/AnchorDetailScreen.tsx` (507, 980, 1019, 1030, 1088)  ← copy only; leave nav/`as any` for WP-08
- `src/screens/vault/components/HeroAnchorCard.tsx` (140)
- `src/screens/vault/components/DailyStreakStrip.tsx` (61, 90)
- `src/screens/vault/components/PracticePathCard.tsx` (167, 182, 186, 191)
- `src/screens/rituals/components/DepthCard.tsx` (50, 60)
- `src/screens/rituals/components/ModeSelectionStep.tsx` (56, 134, 158)
- `src/screens/rituals/components/BurnAnimationOverlay.tsx` (391, 630)
- `src/screens/rituals/components/CommitmentGate.tsx` (83, 94)
- `src/screens/rituals/components/RitualTopBar.tsx` (33)
- `src/screens/rituals/BreathingAnimation.tsx` (199)
- `src/screens/rituals/SealAnchorScreen.tsx` (298)  ← copy only; leave `as any` for WP-08
- `src/screens/rituals/ConfirmBurnScreen.tsx` (104)  ← copy only; leave nav for WP-08
- `src/screens/rituals/RitualScreen.tsx` (1595, 1840 — "Exit ritual" a11y)  ← copy only; leave nav for WP-08
- `src/screens/onboarding/HowItWorksScreen.tsx` (36, 42)
- `src/screens/onboarding/ReframeScreen.tsx` (32, 38, 44)
- `src/screens/onboarding/TrialSignUpScreen.tsx` (41, 42)
- `src/screens/onboarding/DailyLoopScreen.tsx` (31, 40)
- `src/screens/practice/EvolveScreen.tsx` (132, 138, 144)  ← copy only; PRO pill at 197 is already DEFERRED, leave it
- `src/screens/practice/components/DailyThreadDetailsSheet.tsx` (58)
- `src/screens/practice/components/StreakChip.tsx` (57)
- `src/screens/practice/components/AnchorSelectorPill.tsx` (57)
- `src/screens/practice/components/AnchorSelectorSheet.tsx` (74)
- `src/screens/profile/DefaultChargeSettings.tsx` (160, 230)
- `src/screens/profile/DefaultActivationSettings.tsx` (159, 181, 269)
- `src/screens/profile/VoiceStyleScreen.tsx` (45)
- `src/screens/create/AIGeneratingScreen.tsx` (766)
- `src/screens/create/components/RefineStyleCard.tsx` (179 — "PRO")
- `src/navigation/VaultStackNavigator.tsx` (191 — header title; verify it ever shows)
- `src/utils/sigil/traditional-generator.ts` (241 — `title: 'Ritual'`; only if rendered in UI, else skip)

## Carve-outs (DO NOT TOUCH — owned by other packages)
- `src/services/NotificationService.ts` titles/channel names → WP-04.
- `src/stores/authStore.ts:711` "charging did not sync" → WP-05.
- `src/screens/profile/SettingsScreen.tsx` → being deleted by WP-05.
- `MantraCreationScreen.tsx` (deferred/unreachable) → skip.

## Acceptance criteria
- Re-run the audit grep finds no banned word in rendered text for the files above:
  `grep -rniE "(>[^<>{}]*\b(ritual|sigil|streak|charged|charging)\b|(title|label|subtitle|description|copy|name|placeholder):\s*['\"][^'\"]*\b(ritual|sigil|streak|charged|charging)\b)" src/screens src/components src/constants src/config`
- No identifier/route/test renamed. `npx tsc --noEmit` passes; `npx jest` passes (update any snapshot/text assertions that intentionally change).
