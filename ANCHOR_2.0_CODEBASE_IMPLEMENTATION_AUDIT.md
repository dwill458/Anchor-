# ANCHOR 2.0 CURRENT CODEBASE AUDIT
## Against Locked 2.0 Design Spec, Mockups, Frontend Implementation Plan, and Frozen Backend Architecture

**Audit Execution Date:** September 7, 2026  
**Repository:** `e:\Projects\Anchor`  
**Scope:** Read-only forensic audit of Mobile (`anchor/mobile`), Backend (`backend`), and AI Service (`ai-service`) against Living Design Spec v0.4 (`Anchor_Design_System_Living_Spec_v0_4_Recommended_Today_LOCKED.docx`), Locked Screen Export (`anchor (9).zip`), and current production code.

---

# 1. EXECUTIVE SUMMARY

### A. How Much of the Current Product is Reusable?
The Anchor codebase is **substantially advanced in backend domain infrastructure and core utility algorithms**, but **heavily encumbered by legacy Anchor 1.5 visual styling, dark mystical metaphors, client-authoritative state calculations, and destructive lifecycle paths**.

- **Backend / Domain Logic (~55% Reusable):**
  - *Keep & Adapt:* PostgreSQL/Prisma schema (`backend/prisma/schema.prisma`), Course/Waypoint engine (`backend/src/services/CourseService.ts`), course event streaming (`backend/src/services/CourseEventService.ts`), reflection logging, audio manifest/TTS pipelines (`backend/src/services/TTSService.ts`), and RevenueCat webhook scaffolding.
  - *Must Replace:* Destructive burn/release endpoint (`POST /api/anchors/:id/burn` deletes the anchor from the database), synchronous AI image generation (`POST /api/ai/enhance`), automatic trial activation on user signup (`trialStartedAt: now()`), and missing server-side Thread calculation.
- **Frontend Business Logic (~60% Reusable):**
  - *Keep & Adapt:* Course/Chart journey store (`stores/courseStore.ts`), practice audio session coordination (`useVisualizeSessionAudio.ts`, `useDeepPrimeSessionAudio.ts`), authentic Austin Osman Spare distillation algorithm (`utils/sigil/distillation.ts`), vector math (`utils/sigil/letterVectors.ts`), and Firebase authentication lifecycle (`AuthService.native.ts`, `authStore.ts`).
  - *Must Replace:* Client-authored Thread Strength calculations (`utils/threadStrength.ts`), client-authored entitlement rules (`utils/entitlements.ts`), and 13-screen creation state fragmentation.
- **Shared Components (~20% Reusable):**
  - *Keep & Adapt:* Base SVG wrapper (`components/common/SigilSvg.tsx`), Skia canvas drawing utilities, safe haptics (`utils/haptics.ts`), error boundary, and basic audio controls.
  - *Must Retire:* `GlassCard`, `AmbientGlow`, `BakedGlow`, `SacredRing`, `ZenBackground`, `DivineSigilAura`, `AtmosphericOrbs`, `MedallionCoin`, `SelectedChipGlowRing`.
- **Screen Presentation (~10% Reusable):**
  - Almost all 22 screens are visually bound to Anchor 1.5's dark navy (`#0F1419` / `#080C10`), gold chrome (`#D4AF37` / `#D9B36C`), and mystical cards. Only raw layout geometry and timer loops can be salvaged.
- **Navigation Architecture (~25% Reusable):**
  - *Must Retire:* Bottom tab bar (`MainTabNavigator.tsx`), independent nested `NavigationContainer` instances in `PracticeStackNavigator` and `ChartStackNavigator`.
  - *Keep & Adapt:* Deep linking helpers (`navigation/chartDeepLinks.ts`) and auth gate preservation (`firstAnchorGate.ts`).
- **Tests (~65% Reusable):**
  - 222 mobile test suites and 42 backend test suites provide robust coverage for Course/Waypoint transitions, distillation math, and session audio logic, but many tests assert legacy dark theme values or client-side Thread calculations.

### B. The Five Biggest Blockers to Anchor 2.0
1. **Destructive Release Architecture (P0 - Data Loss Risk):**
   `backend/src/api/routes/anchors.ts:1520` executes `tx.anchor.delete({ where: { id: anchor.id } })`, which cascades to delete all active records and sets `anchorId = null` on `PracticeSession` rows. This directly violates the 2.0 locked non-destructive lifecycle contract.
2. **Hidden / Automatic Trial Activation at Signup (P0 - Billing / Access Conflict):**
   `backend/prisma/schema.prisma:31` sets `trialStartedAt DateTime @default(now())`, and `backend/src/api/routes/auth.ts:129` calculates `isTrialExpired: Date.now() >= trialAnchor.getTime() + TRIAL_DURATION_MS`. The 7-day trial starts the second an account is created, violating the locked contract that the trial must *only* begin upon explicit activation from a Practice or Vision paywall.
3. **Client-Authoritative Thread Strength Engine (P0 - Drift & Fraud Risk):**
   The backend has zero Thread calculation logic (`backend/src/api/routes/practice.ts:126-129` blindly accepts `beforeStrength`, `afterStrength`, and `reinforcementGained` from the client). The entire progression system is calculated client-side in `anchor/mobile/src/utils/threadStrength.ts`.
4. **Missing Vision Domain & Persistent Asset Model (P1 - Domain Gap):**
   The current backend only stores a 2-sentence text prompt (`VisualizationScene`), with zero image storage, zero user photo uploads, zero AI visual scene generation, zero 'seen today' tracking, and zero Asset lifecycle management.
5. **Synchronous Un-Queued Generation & Missing Async Infrastructure (P1 - Stability Risk):**
   `backend/src/api/routes/ai.ts:498` runs synchronous HTTP generation awaiting external AI models within the Express request cycle. BullMQ is not installed, dedicated Queue Redis does not exist, and background job polling/webhooks are missing.

### C. What Existing Systems Are Most Valuable to Preserve?
- **Chart / Course / Waypoint Backend Engine (`backend/src/services/CourseService.ts`):** A fully audited, production-grade state machine with transactional consistency, event sourcing (`course_events`), reflection logging, and idempotency.
- **Authentic Distillation Algorithm (`anchor/mobile/src/utils/sigil/distillation.ts`):** 100% compliant with Austin Osman Spare reduction rules (vowels removed, duplicates removed, letter order preserved).
- **Session Audio & Guidance Engine (`anchor/mobile/src/screens/visualize/useVisualizeSessionAudio.ts`, `useDeepPrimeSessionAudio.ts`):** Sophisticated dual-track audio mixer (voice guidance + ambient audio) with phase management.
- **Firebase Auth & Guest Preservation Flow (`anchor/mobile/src/services/AuthService.native.ts`, `stores/firstAnchorFlowStore.ts`):** Reliable guest-to-authenticated account handoff preserving unauthenticated creation drafts.

### D. What Legacy Systems Are Most Dangerous to Carry Forward?
- **The 'Burn & Release' Delete Routine:** Deletes rows, breaks relations, and destroys historical continuity.
- **Client-Side Entitlement Math (`anchor/mobile/src/utils/entitlements.ts`):** Imposes hardcoded `FREE_WEEKLY_SESSION_LIMIT = 5` and `TRIAL_ANCHOR_LIMIT = 7`, conflicting with 2.0 backend capability authority and free daily Focus rules.
- **The 3-Tab Navigator with Independent Containers (`MainTabNavigator.tsx`):** Maintains three separate `NavigationContainer` instances simultaneously, introducing state desynchronization and memory bloat.
- **'The Weave' Canvas Engine (`screens/weave/`):** A gamified, mystical canvas that distracts from evidence-based Thread Strength history.

### E. Is the Codebase Ready to Start UI-A?
**Verdict:** **GO WITH PRECONDITIONS**

**Preconditions:**
1. **Freeze Legacy Tokens:** Quarantine `theme/colors.ts` and `theme/typography.ts` so new UI-A primitives (`#F4F1E9`, Bricolage Grotesque, Figtree, category palettes) can be established without breaking existing legacy screens before cutover.
2. **Quarantine Destructive Burn:** Place a feature gate or safety check around `POST /api/anchors/:id/burn` to prevent accidental deletion during developer testing.
3. **Database Migration Safety Baseline:** Ensure Prisma CLI runs cleanly against local PostgreSQL before adding additive 2.0 schemas.

# 2. OVERALL READINESS ASSESSMENT

| System Layer | Readiness | Core Blockers | Primary Path Forward |
| :--- | :--- | :--- | :--- |
| **Foundation (UI-A)** | **READY WITH REMEDIATION** | Legacy dark theme tokens, Cinzel/Inter font dependencies, missing circular Anchor renderer. | Create isolated 2.0 theme token directory; import Bricolage Grotesque & Figtree; build standalone circular renderer. |
| **Identity & First Run (UI-B)** | **BLOCKED** | Onboarding is a legacy 6-slide deck; backend automatically starts 7-day trial on account creation. | Rewrite onboarding to continuous draft build; patch backend auth to default `trialStartedAt: null`. |
| **Creation Mechanics (UI-C)** | **READY WITH REMEDIATION** | 13 fragmented screens; planetary Kamea naming; blocked by synchronous generation. | Unify into 5 locked steps; map Kameas to 4 canonical structures; use existing generation API as interim draft. |
| **Daily Shell & Library (UI-D)** | **READY WITH REMEDIATION** | Home is dark "Sanctuary"; bottom tab bar is structural; Your Anchors is only a modal. | Implement Home as root hub on `#F4F1E9`; promote Your Anchors to standalone screen; eliminate bottom tab bar. |
| **Entitlements & Paywall (UI-E)** | **BLOCKED** | Backend lacks capability evaluation; client hardcodes arbitrary caps (5 weekly sessions, 7 trial anchors). | Implement Backend Workstream D; rewrite PaywallScreen to support explicit trial activation and contextual variants. |
| **Practice v2 (UI-F)** | **BLOCKED** | Thread calculation is client-owned; Recommended Today lacks consumable waypoint/destination trigger signals. | Move Thread calculation to server (Workstream C & I); submit Contract Change Request for Recommended Today event signals. |
| **Vision / Chart / Progress (UI-G)** | **BLOCKED** | Vision domain does not exist in backend or mobile; Progress is tied to "The Weave". | Implement Backend Workstream H (Vision domain & assets); reskin Chart to light editorial; rebuild Progress as evidence ledger. |
| **Release Lifecycle (UI-H)** | **BLOCKED** | Backend executes `tx.anchor.delete`; frontend uses "type RELEASE" modal and particle WebView. | Implement Backend Workstream J (non-destructive state machine); implement locked ~1.8s hold-to-commit UI. |
| **Cutover & Hardening (UI-I)** | **NOT STARTED** | Requires completion of Waves 0–7. | Visual regression, performance tuning, and legacy dead code pruning. |

---

# 3. CURRENT ARCHITECTURE MAP

### Client -> API -> Domain / Data Dependencies

```
[ FRONTEND: React Native 0.81.5 / Expo 54 (anchor/mobile) ]
  ├── Navigation: RootNavigator (MainTabNavigator: Sanctuary, Practice, Chart)
  ├── State: Zustand (anchorStore, sessionStore, courseStore, authStore)
  ├── Local Engines: threadStrength.ts (CLIENT AUTHORITY), distillation.ts, entitlements.ts
  └── Presentation: Dark theme (#080C10), Cinzel/Inter, GlassCard, MedallionCoin, TheWeave
        │
        ▼ (Axios HTTP Requests via ApiClient.ts)
[ BACKEND API GATEWAY: Express 4.21 / Node 20 (backend) ]
  ├── Authentication: authMiddleware (Firebase Admin SDK token verification)
  ├── Rate Limiting: rate-limit-redis / RedisStore (IP and UID keys)
  └── Routing: /api/anchors, /api/practice, /api/courses, /api/ai, /api/billing
        │
        ▼ (Direct Controller -> Service Invocations)
[ BACKEND DOMAIN LAYER (backend/src/services) ]
  ├── CourseService & CourseEventService (Production-Grade State Machine & Events)
  ├── Practice Routes (Passive Session Sink - blindly records client Thread values)
  ├── Burn / Release Endpoint (DESTRUCTIVE: tx.anchor.delete cascades null to Practice)
  ├── AIEnhancer & GeminiImageService (SYNCHRONOUS HTTP GENERATION - No BullMQ)
  ├── VisualizationSceneService (Text prompts only - NO Vision image domain)
  └── MonetizationAccessService (RevenueCat check, auto-starts 7-day trial on signup)
        │
        ▼
[ DATA & INFRASTRUCTURE LAYER ]
  ├── PostgreSQL 15+ via Prisma 5.8 (Relational Storage)
  ├── Redis 4.6 (Rate Limiting ONLY - No Queue Redis)
  ├── External Providers: Google Firebase Auth, RevenueCat Billing, Google GenAI, Replicate, AWS S3
```

# 4. SOURCE-OF-TRUTH NOTES & PRECEDENCE

1. **Frozen Backend Contracts (Highest Authority):**
   - The frozen backend contracts mandate a **modular-monolith authority model where consequential product state is server-authoritative**.
   - Consequence: Existing client-side Thread calculations (`utils/threadStrength.ts`), client-side entitlement caps (`utils/entitlements.ts`), and client-driven deletion routines are invalid and must yield to server authority.
2. **Locked Screen Specifications (Next Authority):**
   - 22 screen specifications in Living Spec v0.4 define screen jobs, hierarchy, data ownership, accessibility, and motion.
   - Consequence: Screens like `VaultScreen` (Sanctuary) must be stripped of atmospheric glows, streak strips, and merchandise buttons to fulfill their single job: Home coordination.
3. **Supplied 2.0 HTML Mockups (Visual / Composition Reference):**
   - Mockups in `anchor (9).zip` establish the visual standard: `#F4F1E9` warm mineral background, Bricolage Grotesque display headers, Figtree UI text, and circular Anchor geometry.
4. **Special Precedence Rule (SPEC SUPERSEDES MOCKUP):**
   - **Screen 02 (Practice):** The supplied `Practice Screen (Daily Return + Vision Integration) - Refined.html` mockup predates the locked **Recommended Today** system. The written contract in Section 11 of the Living Spec supersedes the visual mockup. Status: `SPEC SUPERSEDES MOCKUP - VISUAL INTEGRATION REQUIRED`.

---

# 5. UI-A: SHARED SYSTEM FOUNDATION AUDIT

### Canvas / Global Shell
- **Locked Spec:** `#F4F1E9` warm mineral / paper canvas, `#FBF9F4` light container, `#ECE8DF` grouped container, `#171717` text primary, `#6C6861` text secondary, `#D8D2C8` structural borders.
- **Current Reality:** `anchor/mobile/src/theme/colors.ts:15-46` defines dark backgrounds: `ink: '#080B0F'`, `navy: '#0F1419'`, `midnight: '#0B1015'`. Most screens hardcode `contentStyle: { backgroundColor: '#080C10' }` or `backgroundColor: '#0F1419'`.
- **Verdict:** Must establish new 2.0 tokens in `theme/tokens.ts` without mutating legacy aliases until screens cut over.

### Typography
- **Locked Spec:** Bricolage Grotesque (Display), Figtree (UI / Body / Utility).
- **Current Reality:** `anchor/mobile/package.json:24-27` installs `@expo-google-fonts/cinzel`, `@expo-google-fonts/eb-garamond`, and `@expo-google-fonts/inter`. `theme/typography.ts` defines `Cinzel-Regular` and `Inter-Regular`.
- **Verdict:** Fonts must be installed via Expo (`@expo-google-fonts/bricolage-grotesque`, `@expo-google-fonts/figtree`) and loaded in `App.tsx`. Centralized typography allows clean substitution.

### Semantic Category Colors
- **Locked Spec:** 12 category tokens: Desire (`#D94F8A`), Health (`#2FA879`), Career (`#3157D8`), Relationships (`#E56F7A`), Creativity (`#F28A2E`), Spirituality (`#7657D9`), Abundance (`#B6A32A`), Family (`#C86B45`), Learning (`#198C9C`), Adventure (`#2D9FC8`), Focus (`#62666D`), Custom (`#E85D32`).
- **Current Reality:** `anchor/mobile/src/utils/categoryDetection.ts` maps categories to legacy colors (gold, cyan, purple). No centralized semantic color map matches the 2.0 hex values.

### Practice Colors
- **Locked Spec:** Focus Purple (`#8B5CF6`), Deep Prime Amber (`#E0A038`), Visualize Blue (`#3B82C4`), Release Orange (`#DD5F2C`).
- **Current Reality:** `anchor/mobile/src/theme/colors.ts:48-53` hardcodes conflicting legacy colors:
  ```ts
  practiceMode: {
    deepPrime: { primary: '#D4AF37', bright: '#F0CB6A' }, // GOLD conflict
    visualize: { primary: '#78B4D1' },                     // PALE BLUE conflict
    focus: { primary: '#AD99D2' },                         // LAVENDER conflict
    release: { primary: '#C8875A' },                       // BROWN conflict
  }
  ```

### Circular Anchor Renderer
- **Locked Spec:** Flat circular Anchor on soft category field. No outer aura rings, no medallion coin bevels, no square cards.
- **Current Reality:** `screens/vault/components/HeroAnchorCard.tsx` and `MedallionCoin.tsx:1-10` render an aged-gold medallion coin with radial glow and a 320° sweeping `ThreadRing`. Square framing is baked into `cards/AnchorCard.tsx`.
- **Verdict:** `SigilSvg.tsx` can be reused to render the core SVG, but a new `CircularAnchorRenderer` component is required.

### Shared Thread Strength Component
- **Locked Spec:** One canonical presentation component showing current value (category-colored), recent movement context, animated count-up, and progress routing.
- **Current Reality:** Four conflicting implementations exist: `vault/components/ThreadRing.tsx`, `practice/components/ThreadStrengthBlock.tsx`, `components/ThreadStrengthSheet.tsx`, and `screens/settings/ThreadStrengthScreen.tsx`. None support backend completion delta animation.

### Accessibility & Motion
- **Current Reality:** `useReduceMotionEnabled` hook exists (`hooks/useReduceMotionEnabled.ts:1-25`), but touch targets on icons are frequently 24x24 without padding. Dynamic type is unsupported (fixed pixel sizes in `theme/typography.ts`).

**UI-A OVERALL STATUS:** **READY WITH REMEDIATION**  
*Explanation:* The core libraries (Reanimated, Skia, SVG, safe-area, haptics) are in place. Creating the warm shell, loading fonts, mapping semantic tokens, and building the circular renderer can begin immediately without backend changes.

# 6. NAVIGATION ARCHITECTURE AUDIT

### Current Navigator Structure
```
RootNavigator (Stack)
├── Onboarding (OnboardingNavigator: LogoBreath → NarrativeOnboardingScreen → Auth)
├── Main (MainTabNavigator: SwipeableTabContainer with 3 tabs)
│   ├── Tab 0: Sanctuary (VaultStackNavigator [INDEPENDENT CONTAINER])
│   ├── Tab 1: Practice (PracticeStackNavigator [INDEPENDENT CONTAINER])
│   └── Tab 2: Chart (ChartStackNavigator [INDEPENDENT CONTAINER])
├── Settings (ProfileStackNavigator - modal)
└── Paywall (PaywallScreen - fullScreenModal)
```

### Critical Architectural Defects
1. **Permanent Tab Bar:** `MainTabNavigator.tsx:67-107` defines a permanent floating pill tab bar (`SANCTUARY`, `PRACTICE`, `CHART`), directly violating 2.0 where Home is the root hub and navigation is contextual.
2. **Three Independent Navigation Containers:** `PracticeStackNavigator.tsx:46` and `ChartStackNavigator.tsx:35` both instantiate `<NavigationContainer independent={true}>`. This causes split navigation history, prevents global deep linking from bubbling cleanly, and leaks memory.
3. **Route Duplication:** `TheWeaveScreen`, `ActivationScreen`, `RitualScreen`, `ConfirmBurnScreen`, and `VisualizeSessionScreen` are duplicated in both `VaultStackNavigator.tsx:10-52` and `PracticeStackNavigator.tsx:13-33`.
4. **Quick-Switch Semantics:** In `VaultScreen.tsx`, tapping an anchor in the stack triggers a full layout re-render rather than an in-place hero cross-fade.

### 2.0 Navigation Cutover Plan
- Retire `MainTabNavigator.tsx` and its floating tab bar.
- Elevate `HomeScreen` to the root of `MainStackNavigator`.
- Register secondary screens (`Practice`, `Chart`, `Vision`, `Progress`, `AllAnchors`, `AnchorDetails`) as stack screens with contextual back chevrons returning to Home.
- Flatten all three independent containers into one root navigation tree.

# 7. 22 LOCKED SURFACES REGISTER MATRIX

| # | Screen Name | Current Code Path | Spec Parity | Mockup Parity | Data Readiness | Reuse Potential | Main Blockers / Conflicts | Status | Conf. |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Home** | `screens/vault/VaultScreen.tsx` | LOW | LOW | PARTIAL | REUSABLE logic | Dark Sanctuary theme; medallion coin; atmospheric orbs; tab bar dependency; missing SEE/REINFORCE/MOVE loop. | **LEGACY CONFLICT** | HIGH |
| **02** | **Practice** | `screens/practice/PracticeScreen.tsx` | LOW | SPEC SUPERSEDES | BLOCKED | REUSABLE logic | Duration selection on screen; missing Recommended Today; lacks consumable waypoint-reached signal. | **BACKEND BLOCKED** | HIGH |
| **03** | **Progress** | `screens/weave/TheWeaveScreen.tsx` | LOW | LOW | PARTIAL | REUSABLE data | Built as "The Weave" mystical canvas; lacks SEE/REINFORCE/MOVE evidence ledger; missing server Thread ledger. | **LEGACY CONFLICT** | HIGH |
| **04** | **Your Anchors** | `screens/vault/components/VaultGridModal.tsx` | PARTIAL | LOW (Modal only) | HIGH | HIGH | Currently only exists as a modal; square dark tiles with gold borders; needs standalone 3-col light gallery. | **REUSABLE** | HIGH |
| **05** | **Intention Entry** | `screens/create/IntentionInputScreen.tsx` | MEDIUM | MEDIUM | HIGH | HIGH | Routes to `AIAnalysisScreen` coaching barrier; dark theme; needs clean editorial input and direct distillation handoff. | **REUSABLE** | HIGH |
| **06** | **Anchor Details** | `screens/vault/AnchorDetailScreen.tsx` | LOW | LOW | HIGH | HIGH | Heavy 62KB file mixing analytics, audio, talisman merch; destructive burn action; needs clean light profile. | **REUSABLE** | HIGH |
| **07** | **Chart** | `screens/chart/ChartHomeScreen.tsx` | MEDIUM | MEDIUM | HIGH | VERY HIGH | Robust backend `CourseService` exists; needs light editorial reskin; remove tab container dependency. | **REUSABLE** | HIGH |
| **08** | **Focus Practice** | `screens/rituals/ActivationScreen.tsx` | MEDIUM | MEDIUM | HIGH | HIGH | Prepare state lacks duration picker (10/30/60s); client computes Thread delta; dark theme. | **REUSABLE** | HIGH |
| **09** | **Deep Prime Practice** | `screens/rituals/RitualScreen.tsx` | MEDIUM | MEDIUM | HIGH | HIGH | Contains legacy "Final Seal" hold phase; gold particles; Prepare state needs 2/5/10m selector; audio mixer is solid. | **REUSABLE** | HIGH |
| **10** | **Vision** | `screens/visualize/VisualizeAnchorField.tsx` | MISSING | MISSING | BLOCKED | LOW | No standalone Vision screen exists; backend only stores 2-sentence text prompt (`VisualizationScene`); no image assets. | **BACKEND BLOCKED** | HIGH |
| **11** | **Visualize** | `screens/visualize/VisualizeSessionScreen.tsx` | MEDIUM | MEDIUM | PARTIAL | VERY HIGH | Audio engine and timer loop are production-ready; lacks real Vision image integration; needs No-Vision Bridge. | **REUSABLE** | HIGH |
| **12** | **Letter Distillation** | `screens/create/LetterDistillationScreen.tsx` | HIGH (Algo) | MEDIUM | HIGH | VERY HIGH | Authentic Spare algorithm is perfect in `distillation.ts`; split across two screens (`DistillationAnimationScreen`); dark theme. | **REUSABLE** | HIGH |
| **13** | **Choose Structure** | `screens/create/StructureForgeScreen.tsx` | LOW | LOW | PARTIAL | HIGH | Bound to planetary Kameas instead of 4 canonical structures (Focused, Contained, Raw, Drawn); gold glow. | **REUSABLE** | HIGH |
| **14** | **Draw Your Structure** | `screens/create/ManualForgeScreen.tsx` | MEDIUM | MEDIUM | HIGH | HIGH | Skia drawing canvas works; has distracting neon palette; needs monochrome ink on warm paper canvas. | **REUSABLE** | HIGH |
| **15** | **Refine Expression** | `screens/create/RefineExpressionScreen.tsx` | MEDIUM | MEDIUM | HIGH | VERY HIGH | Partially aligned in `RefineExpressionScreen.tsx`; routes to legacy variation picker; dark styling. | **REUSABLE** | HIGH |
| **16** | **Anchor Generation** | `screens/create/AIGeneratingScreen.tsx` | MEDIUM | MEDIUM | BLOCKED | HIGH | Split into Generating and VariationPicker; backend generation is synchronous HTTP; lacks durable BullMQ job. | **BACKEND BLOCKED** | HIGH |
| **17** | **Creation Flow** | `screens/create/` (13 screen files) | LOW | LOW | MEDIUM | REUSABLE logic | Pipeline fragmented into 13 separate screens passing route params; must unify into 1 canonical draft flow. | **LEGACY CONFLICT** | HIGH |
| **18** | **Onboarding** | `screens/onboarding/NarrativeOnboarding.tsx` | LOW | LOW | MEDIUM | LOW | 6-slide narrative carousel; violates continuous first-system build; backend auto-starts trial on signup. | **P0 LEGACY CONFLICT**| HIGH |
| **19** | **Sign In & Sign Up** | `screens/auth/LoginScreen.tsx` | MEDIUM | MEDIUM | HIGH | VERY HIGH | Firebase/Apple/Google auth and draft handoff are solid; dark theme; coupled to automatic trial start. | **REUSABLE** | HIGH |
| **20** | **Paywall System** | `screens/paywall/PaywallScreen.tsx` | LOW | LOW | PARTIAL | MEDIUM | Post-trial expired paywall only; hardcodes weekly limits; lacks explicit trial activation; Release is blocked. | **LEGACY CONFLICT** | HIGH |
| **21** | **Profile & Settings** | `screens/settings/SettingsScreen.tsx` | MEDIUM | MEDIUM | HIGH | HIGH | Split across Profile and Settings; uses legacy duration lists (up to 15m); needs consolidation and locked durations. | **REUSABLE** | HIGH |
| **22** | **Release** | `screens/rituals/BurningRitualScreen.tsx` | LOW | LOW | BLOCKED | LOW | Destructive delete in backend (`tx.anchor.delete`); typing "RELEASE" modal; particle WebView animation. | **P0 LEGACY CONFLICT**| HIGH |

# 8. SCREEN-BY-SCREEN DETAILED FINDINGS

### Screen 01: Home
- **Locked Spec:** Orient around one selected Anchor; connect seeing (Vision), reinforcement (Practice), and forward movement (Chart); circular Anchor hero on flat category field; no outer glow rings; open-canvas quick-switch rail (~0.75 opacity for inactive items); contextual navigation.
- **Current Reality (`screens/vault/VaultScreen.tsx`):**
  - Uses dark background `#080C10` with skeuomorphic gold `MedallionCoin.tsx` and looping `AtmosphericOrbs.tsx`.
  - Embedded in `MainTabNavigator.tsx` tab bar.
  - Displays streak cards (`DailyStreakStrip.tsx`) and merchandise order buttons (`PhysicalAnchorCard.tsx`).
  - Lacks inline Vision preview, Chart next move, and the SEE / REINFORCE / MOVE daily loop.
- **Verdict:** `LEGACY CONFLICT` (High Confidence). Underlying active anchor selection in `anchorStore` is reusable; presentation must be replaced.

### Screen 02: Practice
- **Locked Spec:** Mode selector only (duration picker moved to Prepare screens); compact current Anchor context; compact Thread Strength; Recommended Today card; full-width mode rows (Focus, Deep Prime, Visualize, Release).
- **Current Reality (`screens/practice/PracticeScreen.tsx`):**
  - Contains embedded duration picker and 2x2 mode grid.
  - Recommended Today is missing.
  - Gated behind dark card layout with glowing borders and streak counters.
- **Verdict:** `BACKEND BLOCKED` (High Confidence). Blocked by lack of consumable waypoint-reached signal and intention-complete state.

### Screen 03: Progress
- **Locked Spec:** Explains *why* Thread Strength is its current value; provides evidence across SEE, REINFORCE, and MOVE; preserves released anchor history and evolved lineage.
- **Current Reality (`screens/weave/TheWeaveScreen.tsx`):**
  - Implements "The Weave", a canvas-based graph of sigils with animated connecting threads.
  - Does not ingest Chart or Vision events.
- **Verdict:** `LEGACY CONFLICT` (High Confidence). Replace canvas with evidence-based activity ledger.

### Screen 04: Your Anchors
- **Locked Spec:** Full-screen 3-column circular gallery on warm canvas; subtle collapsed section for Released Anchors; tap opens Anchor Details.
- **Current Reality (`screens/vault/components/VaultGridModal.tsx`):**
  - Only exists as a popup modal, not a standalone screen.
  - Renders square dark cards with gold borders.
- **Verdict:** `REUSABLE` (High Confidence). Backend `GET /api/anchors` and `anchorStore` provide complete data. Promote modal to standalone screen with circular renderer.

### Screen 05: Intention Entry
- **Locked Spec:** Editorial input ("Every Anchor starts here." / "Short · Present · Felt"); subtle category indicator; direct handoff to Letter Distillation.
- **Current Reality (`screens/create/IntentionInputScreen.tsx`):**
  - Dark UI with `IntentFormatFeedback.tsx` coaching interrupts.
  - Routes to `AIAnalysisScreen.tsx` before distillation.
- **Verdict:** `REUSABLE` (High Confidence). Remove coaching modals; connect directly to Letter Distillation.

### Screen 06: Anchor Details
- **Locked Spec:** Permanent profile for one Anchor; Anchor artwork hero; Thread Strength; "Practice Anchor" primary CTA; Formation Provenance; links to Vision and Chart; unpaywalled Release action.
- **Current Reality (`screens/vault/AnchorDetailScreen.tsx`):**
  - 62KB file mixing analytics, audio preferences, and merchandise sales.
  - Release action is a destructive delete modal.
- **Verdict:** `REUSABLE` (High Confidence). Split analytics to Progress; restyle to light editorial profile.

### Screen 07: Chart
- **Locked Spec:** Execution surface (MOVE endpoint); Destination card; Current Waypoint ("Next Move"); interactive timeline; explicit server-authoritative completion.
- **Current Reality (`screens/chart/ChartHomeScreen.tsx`):**
  - Production-grade backend state machine (`CourseService.ts`) already strictly enforces manual completion.
  - Frontend is styled with dark navy and legacy typography.
- **Verdict:** `REUSABLE` (High Confidence). Reskin to `#F4F1E9`; integrate as MOVE destination from Home.

### Screen 08: Focus Practice
- **Locked Spec:** 10/30/60 second daily return; Prepare state owns duration; distraction-free active session; server-authoritative Thread delta.
- **Current Reality (`screens/rituals/ActivationScreen.tsx`):**
  - Prepare state lacks 10/30/60s duration picker.
  - Client calculates Thread delta and uploads it to backend.
- **Verdict:** `REUSABLE` (High Confidence). Session timer loop is solid; update Prepare layout and await server Thread authority.

### Screen 09: Deep Prime Practice
- **Locked Spec:** 2/5/10 minute cognitive conditioning; SETTLE -> OBSERVE -> DEEPEN -> HOLD -> RETURN; synchronized voice and ambient audio; gated by Pro/Trial.
- **Current Reality (`screens/rituals/RitualScreen.tsx`):**
  - Multi-phase guidance works well, but includes legacy "Final Seal" hold phase.
  - Prepare state lacks 2/5/10m selector.
- **Verdict:** `REUSABLE` (High Confidence). Audio engine is production-ready; remove "Final Seal" step and reskin.

### Screen 10: Vision
- **Locked Spec:** Anchor-scoped future-state visual system (SEE); future description; uploaded and generated visual scenes; Glance mode; Visualize and Chart continuations.
- **Current Reality (`screens/visualize/VisualizeAnchorField.tsx`):**
  - Backend only stores text prompts (`VisualizationScene`). No image assets or uploads exist.
- **Verdict:** `BACKEND BLOCKED / MISSING` (High Confidence). Requires Backend Workstream H.

### Screen 11: Visualize
- **Locked Spec:** Vision-powered rehearsal (1/3/5 min); Prepare state with No-Vision Bridge; active rehearsal; featured return to Anchor mark.
- **Current Reality (`screens/visualize/VisualizeSessionScreen.tsx`):**
  - Full Visualize session stack and dual-track audio mixer exist and work.
  - Lacks real Vision image integration.
- **Verdict:** `REUSABLE` (High Confidence). Session engine is fully tested; needs light styling and Vision asset connection.

### Screen 12: Letter Distillation
- **Locked Spec:** Authentic Austin Osman Spare reduction: vowels removed, duplicates removed, remaining order preserved; staged reduction animation; handoff to Choose Structure.
- **Current Reality (`screens/create/LetterDistillationScreen.tsx`):**
  - `distillation.ts` algorithm is 100% compliant.
  - Split across two screens (`DistillationAnimationScreen.tsx`).
- **Verdict:** `REUSABLE` (High Confidence). Consolidate into single screen; reskin to light theme.

### Screen 13: Choose Structure
- **Locked Spec:** 4 canonical geometric structures: Focused, Contained, Raw, Drawn; live preview using user's distilled letters.
- **Current Reality (`screens/create/StructureForgeScreen.tsx`):**
  - Bound to planetary Kameas (Saturn, Jupiter, Mars).
- **Verdict:** `REUSABLE` (High Confidence). Re-map underlying vector generator to the 4 canonical structures.

### Screen 14: Draw Your Structure
- **Locked Spec:** Vector stroke capture on clean canvas; distilled letters reference pill; export vector paths for downstream generation.
- **Current Reality (`screens/create/ManualForgeScreen.tsx`):**
  - Skia drawing canvas works, but uses distracting neon palette.
- **Verdict:** `REUSABLE` (High Confidence). Monochromatic ink palette on warm paper canvas.

### Screen 15: Refine Expression
- **Locked Spec:** Material treatment selection (Foil, Minimal, Obsidian, Bone, Monolith); changes appearance ONLY; preserves structure and letters.
- **Current Reality (`screens/create/RefineExpressionScreen.tsx`):**
  - Partially aligned; contains structure definitions; routes to legacy variation picker.
- **Verdict:** `REUSABLE` (High Confidence). Connect to canonical Anchor Generation System.

### Screen 16: Anchor Generation System
- **Locked Spec:** Durable job progress; 2 selectable candidate variations; candidate cleanup after 48h; persistence.
- **Current Reality (`screens/create/AIGeneratingScreen.tsx`):**
  - Split into Generating and VariationPicker.
  - Backend generation is synchronous HTTP without BullMQ queue.
- **Verdict:** `BACKEND BLOCKED / REUSABLE` (High Confidence). Interim synchronous generation works; durable queue needed for production.

### Screen 17: Creation Flow
- **Locked Spec:** One canonical draft: Intention -> Distillation -> Structure -> Expression -> Generation -> Save.
- **Current Reality (`screens/create/`):**
  - 13 separate screens passing route params.
- **Verdict:** `LEGACY CONFLICT` (High Confidence). Consolidate into 5 locked steps backed by single draft store.

### Screen 18: Onboarding
- **Locked Spec:** Continuous first-system build; Direction -> Intention -> Formation -> First Anchor -> Expression -> Vision -> Focus -> Auth -> Home. Trial does NOT begin here.
- **Current Reality (`screens/onboarding/NarrativeOnboardingScreen.tsx`):**
  - 6-slide narrative carousel.
  - Backend auto-starts 7-day trial upon account creation.
- **Verdict:** `P0 LEGACY CONFLICT` (High Confidence). Complete rewrite to continuous build.

### Screen 19: Sign In & Sign Up
- **Locked Spec:** Clean authentication; Apple, Google, Email; draft preservation; no automatic trial start.
- **Current Reality (`screens/auth/LoginScreen.tsx`):**
  - Firebase auth and draft handoff are solid.
  - Backend couples signup to trial start.
- **Verdict:** `REUSABLE` (High Confidence). Decouple trial start; reskin to light editorial.

### Screen 20: Paywall System
- **Locked Spec:** Contextual presentation (Deep Prime, Visualize, AI Vision); explicit 7-day trial activation; Release never paywalled; RevenueCat pricing.
- **Current Reality (`screens/paywall/PaywallScreen.tsx`):**
  - Built strictly as post-trial loss paywall; hardcodes arbitrary weekly limits.
- **Verdict:** `LEGACY CONFLICT` (High Confidence). Rebuild paywall for explicit trial activation.

### Screen 21: Profile & Settings
- **Locked Spec:** Account status, subscription tier, canonical practice duration defaults (10/30/60s, 2/5/10m, 1/3/5m), audio preferences, data privacy.
- **Current Reality (`screens/settings/SettingsScreen.tsx`):**
  - Split across Profile and Settings; contains legacy duration lists (up to 15m).
- **Verdict:** `REUSABLE` (High Confidence). Consolidate into single screen; enforce locked durations.

### Screen 22: Release
- **Locked Spec:** Non-destructive lifecycle closure; preflight consequence review; ~1.8s hold-to-commit (with accessible tap alternative); real Anchor consumed in deterministic burn; historical retention.
- **Current Reality (`screens/rituals/BurningRitualScreen.tsx`):**
  - User types "RELEASE"; plays particle WebView; backend executes `tx.anchor.delete`.
- **Verdict:** `P0 LEGACY CONFLICT` (High Confidence). Replace with non-destructive state machine.

# 9. RECOMMENDED TODAY & FIRST-MATCH-WINS AUDIT

### Evaluation Order & Data Gaps
1. **Completion Context $ightarrow$ RELEASE:**
   - Requires: (a) Explicit intention completed flag, OR (b) Waypoint just reached, OR (c) Destination just reached.
   - Codebase Reality: Intention completed flag is **MISSING** (`schema.prisma:73`). Waypoint and Destination reached events exist in `course_events`, but there is **no consumable/acknowledged signal** (`backend/src/services/CourseService.ts:1188`). Static checks would recommend Release forever.
   - Status: **CONTRACT GAP (Requires CCR-1 & CCR-2)**.
2. **Vision Context $ightarrow$ VISUALIZE:**
   - Requires: (a) Vision exists for selected Anchor, AND (b) Vision has not been seen today.
   - Codebase Reality: Vision domain is missing (only text `VisualizationScene` exists). Zero tracking of "seen today" state exists.
   - Status: **BACKEND BLOCKED (Requires Workstream H)**.
3. **Thread Trend $ightarrow$ DEEP PRIME:**
   - Requires: Real 7-day Thread Strength movement (`delta7d < 0`).
   - Codebase Reality: Backend has no Thread calculation engine; client calculates single-session gains without missed-day decay modeling.
   - Status: **BACKEND BLOCKED (Requires Workstream C)**.
4. **Otherwise $ightarrow$ FOCUS:**
   - Default fallback. Fully feasible today.

---

# 10. THREAD STRENGTH CONTRACT AUDIT

### Trace: Practice Completion $ightarrow$ Display
- **Computation Location:** Exclusively client-side in `anchor/mobile/src/utils/threadStrength.ts:171` (`calculatePracticeGain()`).
- **Server Authority:** Zero. `backend/src/api/routes/practice.ts:518-521` writes client-provided numbers (`beforeStrength`, `afterStrength`, `reinforcementGained`) straight into PostgreSQL columns.
- **Duplicate Gain / Decay:** Yes. If an offline client executes multiple sessions, it applies local gains without server reconciliation.
- **Animated Delta:** `vault/components/HeroAnchorCard.tsx:76` runs a fake JS count-up from 0 on every screen mount. True previous $ightarrow$ new animated delta is unsupported.
- **Status:** **P0 ARCHITECTURAL FLAW**. Workstream C must migrate Thread computation to the server.

---

# 11. CREATION SYSTEM AUDIT

- **Draft Continuity:** Currently split across 13 screens. Route parameters (`params.intention`, `params.sigilSvg`) are passed sequentially, leading to lost state if the user navigates back.
- **Letter Distillation:** `anchor/mobile/src/utils/sigil/distillation.ts:114` is 100% compliant with the Austin Osman Spare method (removes vowels, removes duplicates, preserves order).
- **Structure vs. Expression Separation:** `RefineExpressionScreen.tsx:72` defines the 4 structures, but backend `schema.prisma:106` only accepts `structureVariant: 'dense' | 'balanced' | 'minimal'`.
- **Generation:** Synchronous HTTP in `backend/src/api/routes/ai.ts:498`. No background BullMQ queue.

---

# 12. ONBOARDING & AUTH AUDIT

- **Continuous Build vs. Slides:** Current onboarding (`screens/onboarding/NarrativeOnboardingScreen.tsx:71`) is a 6-slide narrative deck. It does not construct an Anchor or execute a 10-second Focus session.
- **Automatic Trial Initiation (P0 Bug):**
  - `backend/prisma/schema.prisma:31`: `trialStartedAt DateTime @default(now())`.
  - `backend/src/api/routes/auth.ts:129`: Calculates expiration from `trialStartedAt`.
  - Result: 7-day trial begins immediately upon user creation, burning days before the user encounters a paywall.

---

# 13. ENTITLEMENTS & PAYWALL AUDIT

- **Capability Authority:** Client hardcodes arbitrary limits in `utils/entitlements.ts:11-13` (`FREE_WEEKLY_SESSION_LIMIT = 5`, `TRIAL_ANCHOR_LIMIT = 7`).
- **Backend Rules:** Backend `anchors.ts:605` blocks creation after 1 anchor for free users.
- **Paywall Triggers:** Current paywall only displays post-trial expiration; lacks explicit trial start mechanics.
- **Pricing:** RevenueCat offerings are properly loaded from the SDK.

---

# 14. PRACTICE V2 AUDIT

- **Focus:** 10/30/60s durations needed on Prepare state.
- **Deep Prime:** Multi-phase engine in `screens/rituals/RitualScreen.tsx` is reusable; "Final Seal" hold phase must be removed.
- **Visualize:** Full session engine and dual-track audio mixer in `screens/visualize/` are production-ready.
- **Completion Recording:** `POST /api/practice/sessions` validates timezones and enforces idempotency cleanly. Must return server-computed Thread deltas.

---

# 15. VISION AUDIT

- **Domain Status:** **NON-EXISTENT**.
- Current backend only stores a 2-sentence text prompt (`VisualizationScene`) used by Visualize mode.
- Zero image upload endpoints, zero visual scene generation, zero glance mode, zero seen-today tracking.
- Blocked by Backend Workstream H.

---

# 16. CHART (COURSE / WAYPOINT) AUDIT

- **Engine Status:** **PRODUCTION READY**.
- `backend/src/services/CourseService.ts:1170-1187` enforces that waypoints advance *only* via explicit server completion.
- Practice linked to a waypoint records a `PRACTICE_COMPLETED` event, but **never** completes the waypoint automatically.
- Release never advances Chart progress.
- Gap: Missing consumable trigger signal for Recommended Today.

---

# 17. PROGRESS AUDIT

- **Current State:** Implemented as "The Weave" (`screens/weave/TheWeaveScreen.tsx`), an animated mystical canvas.
- **2.0 Direction:** Evidence-based ledger explaining Thread Strength across SEE, REINFORCE, and MOVE over time.
- **Action:** Retire Weave canvas; rebuild as clean activity history using `PracticeSession` and `CourseEvent` data.

---

# 18. RELEASE AUDIT

- **Current State (P0 Bug):** `backend/src/api/routes/anchors.ts:1520` executes `tx.anchor.delete`, permanently deleting the anchor and nullifying relations on `PracticeSession` rows.
- **2.0 Direction:** Idempotent, non-destructive lifecycle transition. The anchor record remains in `anchors` with `status: 'released'`, preserving all historical practice, vision, and chart evidence.
- **Frontend Flow:** Replace typing "RELEASE" modal with ~1.8s hold-to-commit and accessible tap alternative.

---

# 19. PROFILE & SETTINGS AUDIT

- **Current State:** Split across `ProfileScreen.tsx` and `SettingsScreen.tsx`.
- **Durations:** Allows arbitrary custom durations (e.g. 15m focus), violating locked canonical values (10/30/60s, 2/5/10m, 1/3/5m).
- **Action:** Consolidate into single Profile & Settings surface; enforce locked duration constants.

# 20. BACKEND WORKSTREAM AUDIT (A through L)

| Workstream | Responsibility | Codebase Reality | Status |
| :--- | :--- | :--- | :--- |
| **A — Core foundation** | `/api/v2`, idempotency, transactional outbox. | Ad-hoc idempotency keys; no outbox table or `/api/v2`. | **PARTIAL** |
| **B — Formation authority** | Versioned shared formation package; server-reproducible geometry. | Distillation is 100% client-authored. Server accepts strings. | **PARTIAL** |
| **C — Thread authority** | Server-owned Thread computation, movement ledger, shadow comparison. | Zero server Thread logic. Passive sink for client integers. | **MISSING** |
| **D — Entitlements & billing** | Capability evaluation, explicit trial activation, free Focus, unpaywalled Release. | Auto-trial on signup; client computes limits; RevenueCat webhook exists. | **PARTIAL** |
| **E — Async infrastructure** | Dedicated Queue Redis, BullMQ workers, durable generation lifecycle. | Rate-limit Redis only. AI generation is blocking synchronous HTTP. | **MISSING** |
| **F — Asset lifecycle** | Authoritative Asset ownership, signed URLs, 48h candidate cleanup. | Images stored directly on Anchor. No `Asset` table or purge cron. | **PARTIAL** |
| **G — Expression** | Durable AI jobs, deterministic structure-preserving compositing. | Python `ai-service` has compositing; invoked synchronously. | **PARTIAL** |
| **H — Vision** | First-class Vision domain, scenarios, image assets, seen-today tracking. | Only text `VisualizationScene`. No images or glance tracking. | **MISSING** |
| **I — Practice v2** | Server completion authority, server Thread movement, offline retry. | Idempotent session ingestion exists; server Thread delta missing. | **PARTIAL** |
| **J — Release** | Idempotent non-destructive Release state machine, historical queries. | Destructive burn endpoint deletes Anchor row from database. | **P0 CONFLICT** |
| **K — Chart integration** | Course/Waypoint rules, manual completion, Practice/Release context. | Production-grade `CourseService.ts` strictly enforces manual completion. | **ALIGNED** |
| **L — Rollout / cutover** | Compatibility wrappers, dual-write/shadow, feature flags, backfills. | Basic feature flags exist (`config/chartFlags.ts`). | **NOT STARTED** |

---

# 21. FRONTEND WORKSTREAM AUDIT (UI-A through UI-I)

| Workstream | Readiness | Reusable Code | Blockers | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **UI-A: System foundation** | **READY WITH REMEDIATION** | `SigilSvg.tsx`, Skia, haptics. | Dark theme tokens; font installation. | LOW |
| **UI-B: Identity & first run** | **BLOCKED** | Auth providers, guest draft store. | Backend auto-trial on signup; slide deck onboarding. | HIGH |
| **UI-C: Creation mechanics** | **READY WITH REMEDIATION** | `distillation.ts`, Skia drawing canvas. | 13 fragmented screens; planetary Kamea names. | MEDIUM |
| **UI-D: Daily shell & library** | **READY WITH REMEDIATION** | `useAnchorStore`, `VaultGridModal`. | Bottom tab bar; dark Sanctuary theme. | MEDIUM |
| **UI-E: Entitlements & paywall**| **BLOCKED** | RevenueCat SDK integration. | Blocked by Backend Workstream D; client limit math. | HIGH |
| **UI-F: Practice** | **BLOCKED** | Audio engine, timer loop. | Blocked by Workstreams C & I; Recommended Today signal gaps. | HIGH |
| **UI-G: Vision / Chart / Progress**| **BLOCKED** | Course map data & state. | Blocked by Workstream H (no Vision domain); Weave canvas. | HIGH |
| **UI-H: Release** | **BLOCKED** | None (current burn is destructive). | Blocked by Workstream J (non-destructive state machine). | CRITICAL |
| **UI-I: Cutover & hardening** | **NOT STARTED** | Existing Jest test suites. | Depends on completion of UI-A through UI-H. | MEDIUM |

---

# 22. DATA CONTRACT GAPS

| Requirement | Needed By | Current Code Source | Missing? | Can Derive Safely? | Authority | Contract Change? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Intention-Complete Flag** | Recommended Today | None. `Anchor` model has no completion status. | **YES** | **NO** | Server DB | **YES (CCR-1)** |
| **Waypoint "Just Reached"** | Recommended Today | `CourseEvent` (`WAYPOINT_REACHED`) exists, but no consumable cursor exists. | **YES** | **NO** | Server DB / Event | **YES (CCR-2)** |
| **Destination "Just Reached"** | Recommended Today | `CourseEvent` (`COURSE_COMPLETED`) exists, but no consumable cursor exists. | **YES** | **NO** | Server DB / Event | **YES (CCR-2)** |
| **Vision Exists** | Recommended Today, SEE | `VisualizationScene` (text prompt only). | **YES** | **NO** | Server DB | **YES (Workstream H)** |
| **Vision Seen Today** | Recommended Today | None. | **YES** | **NO** | Client / Server | **YES (Workstream H)** |
| **delta7d (Weekly Trend)** | Recommended Today, Progress | Client calculates single-session gains; server has no trend model. | **YES** | **NO** | Server DB / Engine | **YES (Workstream C)** |
| **Non-Destructive Release State**| Release Lifecycle | `POST /:id/burn` deletes row; archives to `burned_anchors`. | **YES** | **NO** | Server DB | **YES (Workstream J)** |
| **Canonical 4 Structures** | Choose Structure | `structureVariant: 'dense' \| 'balanced' \| 'minimal'`. | **YES** | Adaptable | Server DB | **NO (Adapt in V2)** |
| **Capability Projection** | Paywalls & Gating | Hardcoded client constants in `entitlements.ts`. | **YES** | **NO** | Server API | **YES (Workstream D)** |

---

# 23. LEGACY 1.5 COLLISION MAP

| Component / Subsystem | Code Path | Collision Reason | Classification |
| :--- | :--- | :--- | :--- |
| **Floating Capsule Tab Bar** | `navigation/MainTabNavigator.tsx` | Permanent bottom tabs violate contextual Home hub architecture. | **REMOVE** |
| **Independent Nav Containers** | `PracticeStackNavigator.tsx`, `ChartStackNavigator.tsx` | Independent `<NavigationContainer>` instances cause desynchronization. | **REMOVE** |
| **Destructive Burn Endpoint** | `backend/src/api/routes/anchors.ts:1434` | Deletes anchor and cascades null to practice sessions. | **REPLACE** |
| **Auto-Trial on Signup** | `backend/prisma/schema.prisma:31`, `auth.ts:129` | Activates trial on account creation, violating explicit paywall start. | **REPLACE** |
| **MedallionCoin & Auras** | `screens/vault/components/MedallionCoin.tsx` | Skeuomorphic gold coin and glow rings violate flat circular renderer. | **REMOVE** |
| **The Weave Canvas** | `screens/weave/TheWeaveScreen.tsx`, `WeaveCanvas.tsx` | Mystical web visualization conflicts with evidence-based Progress. | **REPLACE** |
| **Type "RELEASE" Modal** | `screens/rituals/components/ReleaseInput.tsx` | Obsolete friction pattern; 2.0 uses ~1.8s hold-to-commit. | **REMOVE** |
| **Narrative Slide Onboarding** | `screens/onboarding/NarrativeOnboardingScreen.tsx` | 6-slide carousel violates continuous first-system build. | **REPLACE** |
| **Client Entitlements Engine** | `anchor/mobile/src/utils/entitlements.ts` | Enforces arbitrary 5 weekly sessions and 7 trial anchor limits. | **REMOVE** |
| **Client Thread Strength Engine** | `anchor/mobile/src/utils/threadStrength.ts` | Computes Thread gains and decay on client; server is passive sink. | **REPLACE** |
| **AI Analysis Screen** | `screens/create/AIAnalysisScreen.tsx` | Unapproved coaching/critique step between intention and distillation. | **REMOVE** |
| **Synchronous AI Enhancement** | `backend/src/api/routes/ai.ts:498` | Blocking HTTP generation risks 504 gateway timeouts. | **REPLACE** |
| **Planetary Kamea Naming** | `screens/create/StructureForgeScreen.tsx` | Uses Saturn/Jupiter/Mars instead of Focused/Contained/Raw/Drawn. | **ADAPT** |
| **Course / Waypoint Engine** | `backend/src/services/CourseService.ts` | Fully aligned state machine enforcing explicit manual completion. | **KEEP** |
| **Austin Osman Spare Distillation**| `anchor/mobile/src/utils/sigil/distillation.ts` | Perfectly implements locked vowel/duplicate reduction. | **KEEP** |
| **Session Audio Mixer** | `screens/visualize/useVisualizeSessionAudio.ts` | Dual-track voice and ambient audio playback with phase controls. | **KEEP** |
| **Firebase Auth & Guest Draft** | `services/AuthService.native.ts`, `firstAnchorFlowStore.ts`| Production-ready auth and draft preservation logic. | **KEEP** |

---

# 24. DUPLICATION MAP

| Concept | Authoritative Implementation | Duplicate / Conflicting Implementations | Resolution |
| :--- | :--- | :--- | :--- |
| **Thread Strength Math** | `anchor/mobile/src/utils/threadStrength.ts` | `practice/components/ThreadStrengthBlock.tsx`, `vault/components/ThreadRing.tsx`, `screens/settings/ThreadStrengthScreen.tsx` | Eliminate client math; migrate authority to Backend Workstream C. |
| **Practice Session Routes** | `VaultStackNavigator.tsx` | Duplicated identically in `PracticeStackNavigator.tsx` | Flatten into single root stack; eliminate independent containers. |
| **Practice Durations** | None (duplicated across screens) | `SessionDefaultsScreen.tsx`, `SessionConfiguration.tsx`, `schema.prisma:623` | Create single canonical constant `constants/practiceDurations.ts`. |
| **Letter Distillation** | `anchor/mobile/src/utils/sigil/distillation.ts` | Repeated regexes in `DistillationAnimationScreen.tsx` | Centralize in shared formation package (Workstream B). |
| **Entitlement Checks** | `utils/entitlements.ts` | `MonetizationAccessService.ts`, `backend/src/api/routes/anchors.ts:605` | Eliminate client rules; query backend capability API (Workstream D). |

# 25. TEST AUDIT

- **Mobile Test Suite (222 test files in `anchor/mobile/src`):**
  - *High Value (Preserve & Protect):*
    - `utils/__tests__/distillation.test.ts` (Validates Spare letter reduction)
    - `screens/visualize/__tests__/useVisualizeSessionAudio.test.ts` (Validates audio ducking and phase timing)
    - `services/__tests__/AuthHydrationService.test.ts` (Validates guest-to-auth draft handoff)
    - `stores/__tests__/courseStore.test.ts` (Validates Course/Waypoint transitions)
  - *Legacy / At Risk (Requires Rewrite):*
    - `screens/vault/components/__tests__/HeroAnchorCard.test.tsx` (Asserts medallion coin and glow ring)
    - `screens/weave/__tests__/TheWeaveScreen.test.tsx` (Asserts legacy Weave canvas)
    - `utils/__tests__/entitlements.test.ts` (Asserts obsolete 5-session weekly cap)
    - `screens/rituals/__tests__/BurningRitualScreen.test.tsx` (Asserts destructive burn)
- **Backend Test Suite (42 test files in `backend/src`):**
  - *High Value (Preserve & Protect):*
    - `services/__tests__/CourseService.test.ts` & `CourseServiceContract.test.ts` (Exhaustive waypoint/event verification)
    - `services/__tests__/RevenueCatEntitlementService.test.ts` (Webhook and receipt verification)
    - `api/routes/__tests__/practice.test.ts` (Validates session schema, timezone offsets, idempotency)
  - *Missing Coverage (High Risk):*
    - Zero tests for server-side Thread calculation (feature does not exist).
    - Zero tests for Vision image assets or upload lifecycle.
    - Zero tests for BullMQ background workers.

---

# 26. ACCESSIBILITY & PERFORMANCE AUDIT

### Accessibility Audit
- **Touch Targets:** Navigation header back chevrons and utility icons frequently render at 24x24 or 28x28 bounding boxes without `hitSlop`, failing the locked 44x44 minimum touch requirement.
- **Color-Only State:** `ThreadRing.tsx` and category pills rely entirely on color tinting without accessible text descriptions or contrast enforcement.
- **Reduce Motion:** `useReduceMotionEnabled` is respected in `CourseMap` and `MedallionCoin`, but `TheWeaveScreen` continuously animates floating particles regardless of OS setting.
- **Screen Reader:** Screen reader labels (`accessibilityLabel`, `accessibilityRole`) are absent across custom canvas nodes in Chart and Weave.

### Performance Risks
- **Image Memory & Leaks:** Heavy uncompressed PNG assets (`anchor-gold.png`, `success_anchor_onboarding.png`) sit in the bundle. High-resolution generated variations in `AIVariationPickerScreen` load concurrently without memory caching controls.
- **Multiple Navigation Containers:** Instantiating 3 independent `NavigationContainer`s inside `MainTabNavigator` retains inactive screen trees in memory, resulting in unnecessary background layout passes.
- **Canvas Overdraw:** `AtmosphericOrbs.tsx` and `DivineSigilAura.tsx` run continuous looping Reanimated worklets with multi-stop radial gradients, causing 60fps GPU overdraw on older devices.

---

# 27. REUSE MAP

### What We Should NOT Rebuild (Preserve & Adapt)
1. **Course / Waypoint Backend Service (`backend/src/services/CourseService.ts`):** Production-grade state machine with event streaming (`CourseEventService`), reflection logging, and idempotency.
2. **Austin Osman Spare Distillation Engine (`anchor/mobile/src/utils/sigil/distillation.ts`):** Complete, verified implementation of letter reduction.
3. **Session Audio Mixer & Manifest Engine (`anchor/mobile/src/screens/visualize/useVisualizeSessionAudio.ts`):** Handles dual-track audio ducking, guidance cues, and ambient playback seamlessly.
4. **Firebase Identity & Guest Draft Handoff (`anchor/mobile/src/services/AuthService.native.ts`, `stores/firstAnchorFlowStore.ts`):** Rock-solid authentication and guest-to-registered data preservation.
5. **Prisma PostgreSQL Foundation (`backend/prisma/schema.prisma`):** Solid relational schema; can be extended additively without destructive migrations.

### What Should NOT Survive into 2.0 (Retire & Remove)
1. **Destructive Burn Endpoint (`backend/src/api/routes/anchors.ts:1434-1527`):** Must never execute `tx.anchor.delete`.
2. **Automatic Trial Start at Signup (`backend/prisma/schema.prisma:31`, `auth.ts:129`):** Must not default `trialStartedAt` to `now()`.
3. **Client-Authoritative Thread Strength Engine (`anchor/mobile/src/utils/threadStrength.ts`):** Client must become a passive consumer of server calculations.
4. **Permanent Capsule Bottom Tab Bar (`navigation/MainTabNavigator.tsx`):** Replace with contextual navigation from Home root hub.
5. **Three Independent Navigation Containers:** Flatten into single standard stack.
6. **"The Weave" Canvas Engine (`screens/weave/`):** Replace with clean evidence-based Progress ledger.
7. **Skeuomorphic Gold & Aura Components:** `MedallionCoin`, `DivineSigilAura`, `AtmosphericOrbs`, `BakedGlow`, `GlassCard`.
8. **6-Slide Narrative Onboarding Carousel (`screens/onboarding/NarrativeOnboardingScreen.tsx`):** Replace with continuous first-system build.
9. **Arbitrary Client Entitlement Caps (`FREE_WEEKLY_SESSION_LIMIT = 5`, `TRIAL_ANCHOR_LIMIT = 7`):** Replace with backend capability evaluation.

---

# 28. RISK REGISTER

### P0 — Must Resolve Before 2.0 Implementation
1. **Destructive Release Bug:** `POST /api/anchors/:id/burn` deletes the anchor and nullifies foreign keys on historical practice sessions (`backend/src/api/routes/anchors.ts:1520`).
   - *Consequence:* Irreversible data loss upon anchor release.
   - *Resolution:* Quarantine endpoint; rewrite as non-destructive lifecycle state update (`anchor.status = 'released'`).
2. **Hidden Trial Start on Account Creation:** `schema.prisma:31` sets `trialStartedAt DateTime @default(now())`, burning the user's 7-day trial before they reach a paywall.
   - *Consequence:* Violates billing/conversion contract; users enter app with expired trials.
   - *Resolution:* Modify schema/auth to set `trialStartedAt: null` until explicit paywall activation.
3. **Client-Authoritative Progression:** Thread Strength deltas and decay are calculated entirely by the client and blindly written to the database.
   - *Consequence:* Vulnerable to client manipulation, clock skew desynchronization, and offline double-counting.
   - *Resolution:* Implement Backend Workstream C (Server Thread Authority).

### P1 — Must Resolve Before Relevant Workstream
4. **Missing Vision Domain:** Backend lacks any image asset storage, glance tracking, or scene versioning for Vision.
   - *Consequence:* Blocks UI-G (Vision Screen) and UI-F (Visualize mode with real imagery).
   - *Resolution:* Implement Backend Workstream H.
5. **Synchronous Un-Queued Generation:** `/api/ai/enhance` executes blocking generation inside the Express request handler without BullMQ or background jobs.
   - *Consequence:* 504 Gateway Timeouts under load or provider latency.
   - *Resolution:* Implement Backend Workstream E (Dedicated Queue Redis & BullMQ).
6. **Recommended Today Signal Gaps:** Missing consumable one-shot event or flag for waypoint completion, destination reach, and intention completion.
   - *Consequence:* Practice screen cannot evaluate Recommended Today rules without false loops.
   - *Resolution:* Submit Contract Change Requests CCR-1 and CCR-2.

### P2 — Implementation Quality
7. **Independent Navigation Containers:** 3 nested containers cause memory overhead and split history.
   - *Resolution:* Flatten navigation in Wave 0 / UI-A.
8. **Touch Targets Under 44x44:** Back chevrons and utility icons fail accessibility standards.
   - *Resolution:* Enforce 44x44 minimum bounding box in UI-A button primitives.

### P3 — Cleanup
9. **Legacy Terminology:** Over 1,200 occurrences of "Sanctuary", "Weave", "ritual", "sigil", "mantra", "charge" in source files.
   - *Resolution:* Systematic copy sweep as screens are migrated.

---

# 29. DEPENDENCY & IMPLEMENTATION SEQUENCE OBSERVATIONS

### Sequencing Observations
The frozen frontend rollout sequence is:
`Wave 0 (UI-A)` $ightarrow$ `Wave 1 (UI-B)` $ightarrow$ `Wave 2 (UI-C)` $ightarrow$ `Wave 3 (UI-D)` $ightarrow$ `Wave 4 (UI-E)` $ightarrow$ `Wave 5 (UI-F)` $ightarrow$ `Wave 6 (UI-G)` $ightarrow$ `Wave 7 (UI-H)` $ightarrow$ `Wave 8 (UI-I)`.

**Codebase Evidence & Practical Adjustment:**
- **UI-A (Wave 0) can start immediately.** It requires zero backend changes. Theme tokens, Bricolage/Figtree font loading, circular Anchor renderer, and shared button components can be built in isolation.
- **UI-C (Creation Mechanics) has existing assets and logic ready to go:** Because `distillation.ts`, Skia drawing canvas, and `RefineExpressionScreen.tsx` are already largely written, UI-C has a very low barrier to entry. However, final candidate selection depends on Backend Workstream G.
- **UI-B (Identity & First Run) is strictly blocked by Backend Workstream D:** Onboarding cannot be shipped until the backend stops automatically activating the 7-day trial on user insertion.
- **UI-F (Practice) and UI-G (Vision/Chart/Progress) are blocked by Backend Workstreams C, H, and I:** Do not build the new Practice or Vision screens until the server Thread engine and Vision domain models exist.

---

# 30. CONTRACT CHANGE REQUESTS (CCR) REQUIRED

Before implementation begins on Practice v2 (UI-F) and Release (UI-H), the following two formal Contract Change Requests must be raised:

### CCR-1: Explicit Intention Completion State
- **Problem:** Recommended Today Rule 1 mandates that an intention explicitly marked complete triggers the Release recommendation. Currently, `schema.prisma` has no field on `Anchor` indicating intention completion.
- **Proposed Contract:** Add `intentionCompletedAt DateTime? @map("intention_completed_at")` and `status String @default("active")` ('active' | 'completed' | 'released') to the `Anchor` model, exposed via `PATCH /api/v2/anchors/:id/complete`.

### CCR-2: Consumable Waypoint / Destination Reached Signal
- **Problem:** Recommended Today Rule 1 mandates that a waypoint or destination *just reached* recommends Release. Currently, `CourseEvent` records `WAYPOINT_REACHED`, but there is no consumption state. Static inspection would recommend Release perpetually.
- **Proposed Contract:** Add a consumable cursor or transient acknowledgment state to Course state (e.g. `lastCompletedWaypointId`, `lastCompletedWaypointAcknowledgedAt`), or return a consumable trigger in the practice summary API: `pendingReleaseRecommendation: { reason: 'waypoint_reached' | 'destination_reached', waypointTitle: string }`.

---

# 31. FINAL GO / NO-GO RECOMMENDATION

### Verdict: **GO WITH PRECONDITIONS**

The codebase is technically ready to begin **Wave 0 (UI-A: System Foundation)** immediately, subject to the following strict guardrails:

### Preconditions for Wave 0 Kickoff
1. **Quarantine Destructive Endpoint:** Explicitly disable or gate `POST /api/anchors/:id/burn` in development so no testing triggers cascading deletes.
2. **Zero Modification of Legacy Production Screens:** UI-A primitives (`#F4F1E9` shell, Bricolage Grotesque & Figtree typography, semantic color map, Circular Anchor Renderer) must be built in dedicated 2.0 directories (`src/theme/v2/`, `src/components/v2/`) without altering existing 1.5 screen imports.
3. **Resolve Auto-Trial Backend Bug Before Wave 1:** Workstream D must update `schema.prisma` (`trialStartedAt DateTime?`) and `auth.ts` before Wave 1 (UI-B: Onboarding & Auth) begins.

---
*End of Implementation Audit Report.*  
*Authored for Anchor Engineering — September 7, 2026.*
