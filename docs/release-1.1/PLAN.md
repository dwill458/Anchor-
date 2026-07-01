# Anchor 1.1 — Implementation Plan

Small, reviewable steps. Each step is one commit (or one tight PR). Order matters: correctness
first, then dead-code removal, then copy, then opt-in refactors.

## Step 1 — fix: Settings restore-purchase path *(implemented)*
- `SettingsScreen.tsx`: replace the raw-SDK `restorePurchases` helper with
  `revenueCatService.restorePurchases()`; branch success on `hasActiveEntitlement`;
  calm copy for found / not-found / failed; in-flight guard against double-tap.
- Risk: low. The service path is the same one PaywallScreen already uses in production.
- Verify: Settings → Restore Purchase with (a) active sub → tier flips to Pro immediately,
  (b) no sub → "No subscription found", (c) airplane mode → failure copy, no crash.

## Step 2 — fix: sanitize user-visible error strings *(implemented)*
- `PaywallScreen.tsx`: restore failure alert no longer prints raw `error.message`.
- `VaultScreen.tsx`: load-failure toast no longer interpolates the raw error.
- Risk: none (message-only).

## Step 3 — refactor: delete dead code *(implemented)*
- Delete `components/modals/ProPaywallModal.tsx`, `screens/onboarding/SaveProgressScreen.tsx`
  (+ barrel export), `services/MockAIService.ts`.
- Verify: `npx tsc --noEmit` + full Jest run.

## Step 4 — copy: calm, specific alert batch *(implemented)*
- Files: ManualForgeScreen, SealAnchorScreen, RitualScreen, AnchorDetailScreen,
  DataPrivacyScreen, EditProfileSheet, MantraCreationScreen (see AUDIT.md P1 list).
- Rules applied: title says what happened ("Save failed", not "Error"); body says what to do next;
  never mention SDKs, builds, IDs, or integrations.

## Step 5 — test: regression coverage for the restore fix *(implemented)*
- SettingsScreen test: Restore row routes through `RevenueCatService` and shows the
  correct alert per outcome.

## Step 6 (follow-up PR) — refactor: consolidate ThreadStrengthSheet
- Fold `components/ThreadStrengthSheet.tsx` and `components/practice/ThreadStrengthSheet.tsx`
  into one component; keep `resolveAnchorStrengthPct` exported from the survivor.
- Requires on-device visual check on both PracticeScreen and AnchorDetailScreen. Own PR.

## Step 7 (follow-up PR, only if a bug forces it) — RitualScreen extraction
- Extract `DeepPhaseTrack`, then seal-phase UI. No behavior change; snapshot the phase timings
  before/after. Skia/animation changes need a real device.

## Explicitly out of scope for 1.1
- 401 auto-sign-out design (watchlist)
- Per-route API timeouts
- Discovery tab, merch, any new features
