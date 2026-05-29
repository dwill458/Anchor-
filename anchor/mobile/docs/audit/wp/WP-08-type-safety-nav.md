# WP-08 — Type safety: navigation param typing (Batch 2 — run last)

**Severity:** 🟡 MEDIUM · **Repo:** `anchor/mobile/` · **Run AFTER WP-01 & WP-03 merge**

## Objective
Remove the ~30 `(navigation as any)` casts by properly typing cross-navigator navigation, so route-name/param typos fail at compile time. This package shares files with WP-01 (ActivationScreen) and WP-03 (RitualScreen, ConfirmBurnScreen), so it runs in Batch 2.

## Files (navigation typing only)
- `src/types/index.ts` (param lists), and the navigators in `src/navigation/`
- `src/screens/auth/LoginScreen.tsx` (161,163,165,167)
- `src/screens/auth/SignUpScreen.tsx` (91,93,95,205)
- `src/screens/rituals/ActivationScreen.tsx` (215,298,352,363,369,371,384,438,444,451,454,456)
- `src/screens/rituals/RitualScreen.tsx` (1026,1076,1252)
- `src/screens/rituals/ConfirmBurnScreen.tsx` (193,212)
- `src/screens/rituals/ChargeCompleteScreen.tsx` (115)
- `src/screens/rituals/utils/useMissingAnchorRedirect.ts` (16)
- `src/screens/profile/SettingsScreen.tsx` (561,690) ← NOTE: deleted by WP-05; if gone, skip
- `src/screens/vault/VaultScreen.tsx` (280)
- `src/screens/practice/PracticeScreen.tsx` (116)
- `src/screens/auth/OnboardingScreen.tsx` (392 — `@ts-expect-error navigation types`)

## Change
- Define/complete the param lists (e.g. a `RootStackParamList` / per-stack `*ParamList`) covering every route reached via `navigate`/`replace` (FirstAnchorAccountGate, Vault, ManualReinforcement, AnchorDetail, SaveProgress, Ritual, Paywall, Login, etc.) including their params.
- Type each screen's `navigation` prop with `NativeStackScreenProps<...>` / `useNavigation<NativeStackNavigationProp<...>>` and remove the `as any` casts and the `@ts-expect-error` at OnboardingScreen:392.
- Where cross-stack navigation is genuinely needed, use `CompositeScreenProps`/`NavigatorScreenParams` rather than `as any`.

## Out of scope (leave as-is — benign)
- Style casts: ProgressionSheet (124,133,147), ProfileScreen (778), SealAnchorScreen (620), TodayAnchorCard (86).
- Ref/SDK casts: SettingsButton (99), ErrorTrackingService (153,232), PrimeAnchorCanvas:311 (`@ts-expect-error` Skia).
- Data-shape casts: AIVariationPicker, AIAnalysis, ManualForge, ChargeSetup — optional follow-up.

## Constraints
- Preserve all route names and param shapes (read actual `navigate(...)` call sites for the real params). Do not rename routes.
- Do not change runtime behavior — typing only.

## Acceptance criteria
- `grep -rn "navigation as any" src` returns 0 in the listed files; the OnboardingScreen `@ts-expect-error` is gone.
- `npx tsc --noEmit` passes with the new param types; `npx jest` passes.
