# ANCHOR 2.0 — UI-E — CONTEXTUAL PAYWALL SYSTEM

Agent 1 / Batch 2 · Branch `anchor-2/ui-e-paywall` · Baseline `f339b9f8`
Worktree `E:\Projects\Anchor-V2-worktrees\ui-e-paywall` (Windows local).

The contextual subscription/paywall **presentation layer** for Anchor 2.0. It
consumes the existing server trial lifecycle (`/api/v2/billing/trial/activate`,
`TrialLifecycleService`, `MonetizationAccessService`) and the existing
`RevenueCatService`. No monetization business logic was added or redesigned; no
trial is started implicitly; no shared central navigation file was edited.

---

## A. HTML REFERENCES AUDITED

Both prototypes decompress to the same source bundle (`5240453a…` tokens +
`2c7e05b9…` sheet + `89b697d2…` expired/app shell); audited from the extracted
JSX, not screenshots.

| Reference | What was taken |
|---|---|
| `Anchor_2.0_Paywall_System_Personalized.html` | Primary. Bottom-sheet shell, `ArtifactBlock` (Anchor row vs Vision block vs collapse), `SHEET_COPY` for focus/deep/vision, `TrialTimeline` (TODAY → DAY 6 → DAY 7), `OfferCard` "7 DAYS FREE" hierarchy, `PlanPickerSheet`, `CTA` idle/loading/success/cancelled states, `Footer` (Restore + Terms/Privacy), `MODE` tone tokens (`focus #8B5CF6`, `deepPrime #E0A038`, `vision #2E77D0`), `T` neutral tokens (`#F4F1E9 / #FBF9F4 / #ECE8DF / #171717 / #6C6861 / #969088 / #D8D2C8`), `PRICING` shape (annual trial-eligible, monthly not). |
| `Anchor 2.0 Paywall System (Standalone) (2).html` | Secondary. Confirmed the sheet/plan-picker/CTA are identical to the personalized build; `ExpiredScreen` (`RecapStrip` "Kept as personal history, not points.", RECOMMENDED plan radios, `showSignIn` footer). |
| `Anchor_Design_System_Living_Spec_v0_4` §14 | Utility Surface Density = **near-zero brush**. Warm mineral canvas, Bricolage/Figtree, circular Anchor artwork, semantic accents. No SaaS pricing cards, no dark glass, no decorative brush fields, **no fake countdowns / artificial urgency**. Subtle brand mark OK; decorative backgrounds not. |
| Brand color token image | Cross-checked the neutral palette already encoded in `theme/v2/colors.ts` — consumed those tokens, added none. |

Prototype deviations (intentional, per §4 of the task brief):
- **Vision fallback.** The prototype falls back to Anchor artwork when no Vision
  exists ("YOUR VISION STARTS HERE"). The brief forbids Anchor art where a
  Vision preview is expected, so a missing Vision renders the **approved
  contextual placeholder** instead.
- **DAY 7 renewal price** is bound to the live RevenueCat annual `priceString`,
  never the prototype's literal `$59.99/year`.

---

## B. FILES CREATED

**Constants**
- `anchor/mobile/src/constants/v2/paywall.ts` — `V2PaywallContext` (7), `V2TrialState`, `V2_TRIAL_DURATION_MS` (mirrors backend), plan ids → package ids, per-context copy map, benefit list, tone map, pricing-fallback strings.
- `anchor/mobile/src/constants/v2/paywallRoutes.ts` — `V2_PAYWALL_ROUTE`, `V2PaywallRouteParams`, `V2PaywallResumeIntent`, `V2PaywallOutcome`, `V2PaywallContinuation`.

**Adapters** (`anchor/mobile/src/adapters/v2/paywall/`)
- `trialState.ts` — `resolveV2TrialState`, `v2TrialDaysRemaining`, `canStartV2Trial` (pure; classifies a server timestamp exactly like `TrialLifecycleService.getTrialState`).
- `trialActivation.ts` — `activateV2Trial()` → `POST /api/v2/billing/trial/activate`; maps `NOT_STARTED|ACTIVE|EXPIRED`, `409 TRIAL_ALREADY_USED` → `already_used`.
- `revenueCatPricing.ts` — normalises `RevenueCatService.getOfferingDisplayMetadata()` into `V2PaywallPricing`; localised price/currency/per-month only, `resolvePricingStatus`, safe package-id fallback.
- `anchorCreationGate.ts` — `resolveAnchorCreationPaywall()` pure resolver.
- `index.ts` — barrel.

**Hooks** (`anchor/mobile/src/hooks/v2/paywall/`)
- `useV2Paywall.ts` — orchestrator: pricing + trial + artifact, plan selection, `startTrial`, `purchaseSelectedPlan`, `submitPrimary`, `restore`, in-flight lock, `onEntitled` continuation.
- `useV2TrialState.ts` — server-owned `trialStartDate` → `V2TrialState` + `isActiveSubscriber` + `canStartTrial` (read-only).
- `useV2PaywallPricing.ts` — one-shot load with manual `retry`; `loading|ready|unavailable`.
- `useV2PaywallArtifact.ts` — Anchor vs Vision vs placeholder vs none, never fabricated.
- `useV2AnchorCreationGate.ts` — hook over the pure resolver.
- `useV2PaywallRecap.ts` — real counts for the trial-ended recap strip.
- `index.ts` — barrel.

**Components** (`anchor/mobile/src/components/v2/paywall/`)
- `paywallTone.ts`, `V2CompactBenefit.tsx`, `V2PaywallArtifact.tsx`, `V2TrialTimeline.tsx`, `V2PlanOfferCard.tsx`, `V2PlanPickerSheet.tsx`, `V2PaywallCTA.tsx`, `V2PaywallFooter.tsx`, `V2PaywallRecapStrip.tsx`, `V2PaywallSheet.tsx`, `V2TrialEndedPanel.tsx`, `index.ts`.

**Screen** (`anchor/mobile/src/screens/v2/paywall/`)
- `V2PaywallScreen.tsx` — props-driven (`context`, `onDismiss`, `onEntitled`, `onSignIn`); renders `V2PaywallSheet` (+ plan picker) or `V2TrialEndedPanel`.

**Tests**
- `adapters/v2/paywall/__tests__/`: `trialState.test.ts`, `trialActivation.test.ts`, `revenueCatPricing.test.ts`, `anchorCreationGate.test.ts`.
- `hooks/v2/paywall/__tests__/`: `useV2Paywall.test.tsx`, `useV2AnchorCreationGate.test.ts`.
- `screens/v2/paywall/__tests__/V2PaywallScreen.test.tsx`.

## C. FILES MODIFIED

- `anchor/mobile/src/screens/v2/paywall/index.ts` — the pre-existing UI-E stub (`export {}`), now the public surface: `V2PaywallScreen`, context/pricing types, route manifest, continuation contracts, and the "when to raise it" hooks/resolvers.

## D. SHARED FILES TOUCHED

**NONE.** `npm run test:v2-boundary` → `V2 import boundary OK`.
No change to `navigation/v2/*`, `theme/v2/*`, `components/v2/primitives/*`,
`screens/v2/{practice,vision,chart,home}/*`, `backend/*`, or RevenueCat service
internals. `git diff --check` clean.

---

## E. PAYWALL CONTEXTS

Typed `V2PaywallContext`, one honest reason each, one shared sheet shell:

| Context | Headline | Artifact | Tone | Trial CTA? |
|---|---|---|---|---|
| `SECOND_ANCHOR` | "Create another Anchor" | active Anchor | neutral | yes |
| `PRACTICE` | "Start practicing with Anchor" | active Anchor | focus | yes |
| `DEEP_PRIME` | "Go deeper with Deep Prime" | active Anchor | deepPrime | yes |
| `VISUALIZE` | "Bring your direction into view" | Vision / placeholder | visualize | yes |
| `VISION_PREMIUM_ACTION` | "Keep shaping your Vision" | Vision / placeholder | visualize | yes |
| `TRIAL_ENDED` | "Keep building what you started." | none (recap strip) | neutral | **no** — paid only |
| `GENERAL_UPGRADE` | "Unlock the complete Anchor" | none | neutral | yes |

Contextual atmosphere is deliberately shallow (`paywallTone`): the practice/vision
accent only tints the top wash, the benefit check chips, the trial-timeline dots
and the selected-offer edge. Layout, CTA colour and every price string are
identical across contexts. No decorative background, no brush field.

---

## F. TRIAL FLOW & SERVER ACTIVATION

- The trial does **not** start at signup, auth, onboarding, first Anchor, first
  Focus, or Home arrival. There is no code path that starts it implicitly.
- It starts **only** when the user taps the primary CTA while it reads
  "Start 7-Day Free Trial" — i.e. `context ≠ TRIAL_ENDED`, `canStartV2Trial` is
  true, and the live annual package is `trialEligible`.
- `startTrial()`:
  1. `revenueCatService.purchasePackageByIdentifier($rc_annual, { syncStatus:false })` — the store subscription that carries the 7-day introductory free trial. A dismissed store sheet → `purchaseState = 'cancelled'` ("Purchase not completed. Nothing was charged."), no server call, no continuation.
  2. `activateV2Trial()` → `POST /api/v2/billing/trial/activate`. **The server stamps `trialStartedAt`** (idempotent `updateMany where trialStartedAt: null`) and returns the authoritative `trialState` + entitlement. The client never writes or fabricates the timestamp.
  3. `applyServerEntitlement(true)` unlocks the UI immediately; `refreshServerEntitlement()` reconciles the backend best-effort.
  4. `onEntitled({ context, outcome:'trial_started', plan:'annual' })` resumes the original intent.
- `resolveV2TrialState(trialStartedAt)` mirrors `TrialLifecycleService.getTrialState`
  1:1 — `null → TRIAL_NOT_STARTED`, in-window `→ TRIAL_ACTIVE`, past `→ TRIAL_ENDED`.
- Expired = terminal. `canStartV2Trial('TRIAL_ENDED', …) === false`; the CTA
  becomes a paid purchase; if `activateV2Trial()` is ever reached it returns
  `already_used` (409 `TRIAL_ALREADY_USED`) and is never retried into a fresh trial.
- Active subscribers: `isActiveSubscriber` short-circuits `startTrial()` and
  `purchaseSelectedPlan()` and `offersTrial` is false.

---

## G. REVENUECAT INTEGRATION

- All package/price data is read from RevenueCat via
  `RevenueCatService.getOfferingDisplayMetadata()` and normalised in
  `revenueCatPricing.ts`. Displayed strings are the store's localised
  `priceString` / `pricePerMonthString` / `currencyCode`. A per-month label is
  only ever *derived* from a real amount + currency via `Intl.NumberFormat`.
  **No `$9.99`, no mock currency, anywhere.**
- Purchases go through `purchasePackageByIdentifier(packageId, { syncStatus:false })`;
  the package id comes from live metadata with a fall back to the configured
  `$rc_annual` / `$rc_monthly` so a retry still works.
- Loading / error states: `useV2PaywallPricing` exposes `loading | ready |
  unavailable` with a `retry()`; the sheet shows accessible copy
  ("Loading current store pricing…" / "Pricing is temporarily unavailable.
  Restore is still available. Tap to retry.") and disables the CTA — Restore
  stays available.
- Double-submission is blocked three ways: `useV2Paywall` holds a synchronous
  `inFlight` ref lock, the CTA/restore controls are disabled whenever `busy`,
  and `V2PaywallCTA` / `V2PaywallFooter` each drop repeat taps inside 600 ms.
- `entitlementReady` from the shared subscription store gates "expired" so the
  paywall never flashes before RevenueCat has answered.

---

## H. PERSONALIZATION (ANCHOR VS VISION)

`useV2PaywallArtifact(context)` → `V2PaywallArtifact` union rendered by
`V2PaywallArtifact.tsx`:

- **PRACTICE / DEEP_PRIME / SECOND_ANCHOR** → `{ kind:'anchor' }`: the user's
  active Anchor via `CircularAnchorRenderer` (stable `SigilSvg` geometry, flat
  category field, no rim/halo/animation), intention line, category label. No
  active Anchor → region collapses (`kind:'none'`).
- **VISUALIZE / VISION_PREMIUM_ACTION** → `{ kind:'vision' }` when a real
  `VisualizationScene` exists for the selected Anchor (its `currentText` /
  `originalSuggestion`, or `previewUri` if the Vision-asset contract ever lands
  — never synthesised). No scene → `{ kind:'vision-placeholder' }`, the approved
  contextual placeholder ("Your Vision will appear here"). **Anchor artwork is
  never shown where a Vision preview is expected.**
- **TRIAL_ENDED / GENERAL_UPGRADE** → no artifact; TRIAL_ENDED shows the recap
  strip instead.

---

## I. SECOND-ANCHOR BEHAVIOR

`resolveAnchorCreationPaywall({ activeAnchorCount, isOnboarding, hasEntitlement })`
— pure, no navigation, no enforcement:

- `hasEntitlement` → allowed, no paywall (any Anchor count).
- `isOnboarding` → allowed, no paywall.
- `activeAnchorCount < 1` → **first Anchor allowed**.
- `activeAnchorCount ≥ 1` (free, not onboarding) → **`SECOND_ANCHOR`**.

Released/archived Anchors are excluded from the count. This is **not** the
production 1.5 hard-lock: a free user with one Anchor keeps full access to the
app; only the *act* of creating an additional Anchor is gated, always with the
recoverable contextual paywall. `useV2AnchorCreationGate()` wraps the resolver
with the live Anchor store + entitlement; wiring it into a creation flow is the
host's job via the exported contracts.

---

## J. RESTORE PURCHASE HANDLING

`useV2Paywall.restore()` → `revenueCatService.restorePurchases({ syncStatus:false })`,
`restoreState ∈ { idle, restoring, success, no_purchases_found, error }`:

| Outcome | Condition | Feedback (`V2PaywallFooter`) |
|---|---|---|
| `restoring` | in flight | "Restoring…", controls disabled |
| `success` | `hasActiveEntitlement` | "Purchases restored." + `applyServerEntitlement(true)` + `onEntitled({outcome:'restored'})` |
| `no_purchases_found` | restore succeeded, no entitlement | "No purchases found to restore." — no grant |
| `error` | `restorePurchases` threw | "Restore failed. Check your connection and try again." |

Available in every context including `TRIAL_ENDED`, and while pricing is
`unavailable`.

---

## K. TRIAL-ENDED STATE TREATMENT

`V2TrialEndedPanel` — calm, non-fear, on the warm canvas:

- Eyebrow "YOUR TRIAL HAS ENDED", headline "Keep building what you started.",
  body "Your Anchors, Vision, and progress are still here."
- `V2PaywallRecapStrip` with **real** counts (Anchors / Practices / Visions) and
  "Kept as personal history, not points."
- Annual (RECOMMENDED) + Monthly plan radios with live localised prices; CTA
  "Continue with Annual/Monthly" — **no free-trial language, the trial cannot be
  restarted.**
- Footer: Restore Purchase + "Already subscribed? Sign in" (host-provided
  `onSignIn`) + Terms / Privacy.
- No countdown, no "act now", no scarcity.

---

## L. REQUIRED_INTEGRATION_CHANGES

UI-E owns no central navigation. A later integration pass (outside this branch)
must:

1. **Register the route.** Add `V2Paywall` to `navigation/v2/routes.ts`,
   `navigation/v2/types.ts` (`V2Paywall: V2PaywallRouteParams` — imported from
   `@/constants/v2/paywallRoutes`), and a `Stack.Screen` (recommended:
   `presentation: 'transparentModal'` / `containedModal`) in
   `navigation/v2/AnchorV2Navigator.tsx` rendering `V2PaywallScreen` with
   `context`/`onDismiss`/`onEntitled`/`onSignIn` bridged from route params +
   `navigation.goBack()`.
2. **Honour the continuation contract.** On `onEntitled`, read
   `route.params.resumeIntent` and resume it (open the tapped practice/visualize,
   run the second-Anchor creation, etc.), then dismiss. On `onDismiss`, just pop.
3. **Raise `SECOND_ANCHOR`.** In the V2 creation entry (UI-C), call
   `useV2AnchorCreationGate().evaluate({ isOnboarding })` before starting a new
   Anchor; if `!allowed`, navigate to `V2Paywall` with
   `{ context:'SECOND_ANCHOR', resumeIntent:{ type:'create_anchor' } }`.
   Onboarding / first-run must pass `isOnboarding: true` (or never call the gate).
4. **Raise practice/vision contexts.** UI-F / UI-G gate their premium entries
   with `useV2TrialState()` + `MonetizationAccessService` and navigate to
   `V2Paywall` with the matching context + `resumeIntent`.
5. **`TRIAL_ENDED` interception.** Where the app boots into an expired state,
   route to `V2Paywall` with `context:'TRIAL_ENDED'` and wire `onSignIn` to the
   existing auth entry.
6. **RevenueCat offering.** Ensure the dashboard current offering exposes
   `$rc_annual` (with the 7-day intro trial) and `$rc_monthly`; no code change.

No backend change is required — `/api/v2/billing/trial/activate`,
`TrialLifecycleService`, `MonetizationAccessService` and `RevenueCatService` are
consumed as-is.

---

## M. TEST RESULTS

Run in `anchor/mobile`:

| Command | Result |
|---|---|
| `npm test -- --testPathPattern=paywall` | **PASS** — includes all 7 new suites (39 tests) + every pre-existing `*paywall*` suite. |
| `npx jest --testPathPattern="v2.paywall"` | **PASS** — 7 suites, 39 tests. |
| `npm test` (full suite) | **PASS** — 176 suites, 1396 passed, 1 skipped (pre-existing). |
| `npx tsc --noEmit` | **PASS** — clean. |
| `npm run test:v2-boundary` | **PASS** — `V2 import boundary OK`. |
| `git diff --check` | **PASS** — clean. |

Coverage of the 13 required validations:

| # | Validation | Test |
|---|---|---|
| 1 | First Anchor → no paywall | `anchorCreationGate.test.ts`, `useV2AnchorCreationGate.test.ts` |
| 2 | Second Anchor → `SECOND_ANCHOR` | same |
| 3 | Onboarding → no paywall | `anchorCreationGate.test.ts`, `useV2AnchorCreationGate.test.ts` |
| 4 | `trialStartedAt === null` → `TRIAL_NOT_STARTED` | `trialState.test.ts` |
| 5 | Trial starts only on explicit CTA | `useV2Paywall.test.tsx` ("starts NOTHING on mount"), `V2PaywallScreen.test.tsx` |
| 6 | Expired trial cannot restart | `trialState.test.ts` (`canStartV2Trial`), `useV2Paywall.test.tsx`, `trialActivation.test.ts` (`already_used`) |
| 7 | Active subscriber bypasses trial-start CTA | `useV2Paywall.test.tsx` |
| 8 | Localised RevenueCat price formatted & displayed | `revenueCatPricing.test.ts` |
| 9 | Double-tap protection | `useV2Paywall.test.tsx` ("prevents a double submission") |
| 10 | Restore handles all four outcomes | `useV2Paywall.test.tsx` (restoring/success/no_purchases_found/error), `V2PaywallScreen.test.tsx` (feedback copy) |
| 11 | Successful entitlement resumes original intent | `useV2Paywall.test.tsx` (`onEntitled` payload) |
| 12 | Practice → active Anchor; Vision → Vision asset | `V2PaywallScreen.test.tsx` |
| 13 | V2 boundary passes | `npm run test:v2-boundary` |

---

## N. BRANCH & COMMIT HASH

- Branch: `anchor-2/ui-e-paywall`
- Baseline: `f339b9f8`
- Commit: _(see `git log -1` on the branch after push — recorded on commit)_

---

## O. MERGE NOTES

- **Do NOT merge into integration** (per brief). Branch pushed to
  `origin/anchor-2/ui-e-paywall` for review.
- Net new surface only; the one modified file
  (`screens/v2/paywall/index.ts`) was a UI-E-owned stub. No shared files.
- Depends on nothing from the other Batch-2 branches. Consumes Batch-1 V2
  billing (`/api/v2/billing/trial/activate`) which is already on the baseline.
- Integration work is confined to `REQUIRED_INTEGRATION_CHANGES` (§L) — all in
  `navigation/v2/*` + the UI-C/F/G entry points, none of it in this branch.
- The paywall is presented by the host (route or modal); `V2PaywallScreen`
  fills its container and is theme-tokenised via `@/theme/v2`.
