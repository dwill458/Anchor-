# Project Anchor — Technical Audit Report
**Date:** 2026-02-26
**Auditor:** Senior Full-Stack Technical Auditor
**Branch:** `claude/project-anchor-audit-CRJ4P`
**Stated Targets:** Beta → March 1, 2026 | Production → March 20, 2026

---

## EXECUTIVE SUMMARY

Project Anchor is a React Native (Expo) mobile application with a Node.js/Express/PostgreSQL backend that transforms user intentions into AI-generated sigils. The codebase has strong bones—clean architecture, strict TypeScript, proper Zustand state management, and a thoughtful security model in places. However, it contains several **BLOCKING** issues that make the March 1 Beta target aspirational at best and the March 20 Production target a serious risk.

**Bottom Line:**
- The core user flow (intention → sigil → charge → activate) appears feature-complete in mock/dev mode
- Real authentication is NOT implemented — the entire `AuthService` is a mock
- A critical mass-assignment security vulnerability exists in the anchor update endpoint
- 19 unit tests are actively failing
- No CI/CD pipeline exists
- The RevenueCat subscription integration is referenced in code but not installed
- The API base URL is hardcoded to a developer's home LAN IP

---

## PHASE 1: FRONTEND & UI/UX PERFORMANCE

### 1.1 Architecture & State Management

**Status:** In-Progress (85% complete)

**What's Good:**
- Zustand is the right call for this scale — lightweight, performant, composable
- 6 domain-specific stores with clear separation: `anchorStore`, `authStore`, `subscriptionStore`, `sessionStore`, `settingsStore`, `teachingStore`
- `authStore` uses an intelligent **hybrid storage engine**: JWT tokens go to `expo-secure-store` (OS-level encryption), non-sensitive user data goes to `AsyncStorage`. This is correct and production-ready
- Stores are properly typed with TypeScript interfaces — no `any` in store definitions
- `partialize` on persistence means only the necessary slice of state is written to disk

**What's Broken / Hacky:**
- `subscriptionStore.ts` references RevenueCat conceptually but the package `react-native-purchases` (RevenueCat's SDK) is **not in `package.json`**. The `ProPaywallModal.tsx` contains the comment: *"This functionality will be implemented with RevenueCat integration."* The entire monetization layer is a stub
- `anchorCount` in `authStore` is a manually-incremented integer that can diverge from `anchors.length` in `anchorStore`. This is a data consistency bug waiting to surface in production
- Cross-store dependencies (e.g., `authStore` calls `useAnchorStore.getState()` directly) create implicit coupling that makes testing harder and can cause subtle race conditions on rehydration

**Roadmap to Beta:**
- Install and configure RevenueCat SDK (`react-native-purchases`)
- Wire `useSubscription` hook to real entitlement checks
- Remove or reconcile `anchorCount` redundancy

**Roadmap to Production:**
- Audit all cross-store dependencies and document them
- Consider a store coordinator or event bus for complex inter-store operations
- Add Zustand `devtools` middleware with production guard

---

### 1.2 TypeScript Integrity

**Status:** In-Progress (Good but not clean)

**Metrics:**
- TypeScript `strict: true` enabled on both mobile and backend ✓
- `noImplicitAny: true`, `strictNullChecks: true` on backend ✓
- Mobile extends Expo's strict base config ✓
- `: any` usages in mobile source (non-test): **31 instances**
- `as any` casts in mobile source: **22 instances**
- `: any` in backend source: **12 instances**
- Combined debt: **65 `any`-flavored type escapes**

**What's Good:**
- Core domain types (`Anchor`, `User`, `Activation`) are well-defined with clear inline documentation
- Discriminated union patterns used for API responses
- Prisma-generated types are consumed properly in backend routes
- Generic types used for `ApiResponse<T>` wrapper

**What's Broken / Hacky:**
- `backend/tsconfig.json` sets `noUnusedLocals: false` and `noUnusedParameters: false` — these flags exist specifically to catch dead code. Disabling them is a code quality compromise
- The PUT anchors route destructures `updates = req.body` and then does `data: { ...updates }` — this isn't a TypeScript issue, it's a runtime mass-assignment issue, but TypeScript should be used to enforce an allowlist of patchable fields
- Several `as any` casts in the AI service integration suggest the Gemini SDK types are not fully imported or trusted

**Roadmap to Beta:**
- Eliminate `as any` in the main user flows (creation, charging, activation)
- Enable `noUnusedLocals` and fix the ~15 dead variables it will surface

**Roadmap to Production:**
- Target zero `any` outside of third-party SDK boundary files
- Enable `noUnusedParameters`
- Add `ts-prune` or a similar tool to CI to enforce ongoing hygiene

---

### 1.3 UI/UX Implementation & Polish

**Status:** In-Progress (Core flows good, edges rough)

**What's Good:**
- `ErrorBoundary.tsx` is a proper implementation — catches unhandled component errors, renders a styled fallback UI, integrates with `ErrorTrackingService`, supports reset
- `Toast.tsx` is solid — types, haptics, auto-dismiss, accessibility labels, stacking support
- `LoadingSpinner.tsx` — 3 sizes, animated, accessible
- `AnchorCardSkeleton.tsx` exists for perceived performance during loads
- Design system (`theme/colors.ts`, `typography.ts`, `spacing.ts`) is consistent throughout
- `IntentFormatFeedback.tsx` provides real-time writing quality feedback — a genuinely polished touch
- Haptic feedback is thoughtfully used (configurable intensity via settings)

**What's Missing / Broken:**
- `ShopScreen.tsx` is a placeholder with "Coming in Phase 4" text and a literal 🖼️ emoji hardcoded in source — this is a **visible dead-end tab** for beta users
- `discover/DiscoverScreen` similarly appears to be a placeholder
- `HeaderAvatarButton.tsx` has `// TODO: Add Image component when imageUrl is provided` — avatar always shows initials
- `ProfileScreen.tsx` line 183: `// TODO: Navigate to subscription screen` — the "Upgrade to Pro" button does nothing
- `ProPaywallModal.tsx` shows a RevenueCat placeholder message when triggered — if a free user taps a Pro feature, they see an error message about RevenueCat not being implemented
- No empty-state design for zero anchors in the Vault that has been confirmed working end-to-end on device

**Roadmap to Beta:**
- Hide or remove the Shop tab entirely (or show a "Coming Soon" with better UX)
- Wire the "Upgrade to Pro" button to at least a RevenueCat purchase sheet
- Fix the avatar display or remove the component until images are stored

**Roadmap to Production:**
- Complete all empty states with on-brand illustrations
- Audit every bottom tab for placeholder content and either implement or hide
- Conduct a full UX walkthrough session with target users (athlete, entrepreneur, wellness segments)

---

### 1.4 Performance

**Status:** In-Progress (Infrastructure good, validation missing)

**What's Good:**
- `react-native-reanimated` (v3.x) used for animations — runs on the UI thread, correct approach
- `@shopify/react-native-skia` for canvas-based sigil rendering — optimal for complex vector operations
- `OptimizedImage.tsx` component exists wrapping `react-native-fast-image` — proper image caching
- `PerformanceMonitoring.ts` service with trace wrapping is set up
- `PERFORMANCE_BASELINE.md` exists suggesting some profiling has been done
- API calls have a 30-second timeout configured

**What's Concerning:**
- `console.log` appears **34 times** in mobile source (outside tests) and **235 times** in backend source — these are raw unredacted logs, not the structured logger. In production, this leaks user data including intention text and email addresses to console
- The API base URL is hardcoded as `http://192.168.0.17:8000` for non-production — this is a developer's home router IP and will fail for literally every other device
- No evidence of `React.memo`, `useCallback`, or `useMemo` being applied systematically — potential for unnecessary re-renders in complex screens like VaultScreen (which renders an anchor grid)
- `useTeachingStore.getState()` called inside `anchorStore`'s `addAnchor` action — this side effect during a state update is fragile and could block the Zustand update in edge cases

**Roadmap to Beta:**
- Replace `API_URL` hardcode with `EXPO_PUBLIC_API_URL` environment variable
- Strip all `console.log` from production builds (babel plugin or linter rule)
- Run the app on a low-end Android device (e.g., Moto G) and profile the VaultScreen

**Roadmap to Production:**
- Implement list virtualization in VaultScreen (FlashList from Shopify, or FlatList with `getItemLayout`)
- Memoize the AnchorCard component to prevent list re-renders on store updates
- Set up Sentry Performance Monitoring with real session data from beta

---

## PHASE 2: BACKEND, API, & TESTING

### 2.1 Logic & Security

**Status:** In-Progress — contains **CRITICAL** security vulnerabilities

#### CRITICAL: Mass Assignment in Anchor Update
**File:** `backend/src/api/routes/anchors.ts`, line 289–319
**Severity:** CRITICAL
```typescript
const updates = req.body; // No allowlist — any field can be overwritten
await prisma.anchor.update({
  where: { id },
  data: {
    ...updates,           // VULNERABILITY: Attacker can set userId, isArchived, enhancedImageUrl, etc.
    updatedAt: new Date(),
  },
});
```
A logged-in user can send any valid Prisma field and overwrite it, including `userId` (to steal another user's anchor), `isCharged`, `baseSigilSvg`, `enhancedImageUrl`, and more. This needs an explicit allowlist immediately.

#### CRITICAL: AuthService is Fully Mocked — No Real Authentication
**File:** `anchor/mobile/src/services/AuthService.ts`
**Severity:** CRITICAL
The file header reads: *"Mocked version to bypass native Firebase dependencies in Expo Go."* Every method (`signInWithEmail`, `signUpWithGoogle`, `getIdToken`) returns hardcoded mock data. `getIdToken()` returns the string `'mock-jwt-token'`. The backend's `authMiddleware` has an explicit bypass for this token. **There is currently no real user authentication in this application.**

#### HIGH: AI Enhancement Endpoint Has No Authentication
**File:** `backend/src/api/routes/ai.ts`
**Severity:** HIGH
The `anchors.ts` router applies `router.use(authMiddleware)` at the top level. The `ai.ts` router does not. Any anonymous caller can hit `/api/ai/enhance-controlnet` and trigger paid AI generation jobs (Gemini API or Replicate credits).

#### HIGH: Dev Auth Bypass Left in Middleware
**File:** `backend/src/api/middleware/auth.ts`, line 61–65
**Severity:** HIGH
```typescript
if (process.env.NODE_ENV !== 'production' && token === 'mock-jwt-token') {
  req.user = { uid: 'mock-uid-123', email: 'guest@example.com' };
  next();
  return;
}
```
The `NODE_ENV` check is the only guard. If `NODE_ENV` is misconfigured on a staging or production server, any request with `Authorization: Bearer mock-jwt-token` is accepted as authenticated. This is a credential that is now in source control.

#### HIGH: JWT Secret Hardcoded Fallback Pattern
**File:** `backend/src/api/middleware/auth.ts`, line 70
```typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
```
The non-null assertion (`!`) means if `JWT_SECRET` is undefined, `jwt.verify` receives `undefined` as the secret, which throws a `JsonWebTokenError`. The `optionalAuthMiddleware` on line 130 falls back to `'secret'` as the literal default JWT secret — which is effectively no security.

#### MEDIUM: No Input Sanitization Library
Fields like `intentionText`, `category`, `displayName`, and query params (`orderBy`, `order`) are used directly without a validation library (Zod, Joi, express-validator). The `orderBy` parameter in the GET anchors route is passed directly into a Prisma `orderBy` clause — this could potentially be used to enumerate valid schema field names via timing attacks.

#### MEDIUM: CORS Origin Defaults to Wildcard
**File:** `backend/src/config/env.ts`, line 143
`ALLOWED_ORIGINS: validateString(...) || '*'` — if `ALLOWED_ORIGINS` is not set, the API accepts requests from any origin.

**Roadmap to Beta:**
1. Implement real Firebase Auth (or any production auth provider)
2. Fix the mass assignment vulnerability in PUT `/api/anchors/:id`
3. Add `authMiddleware` to all AI routes
4. Remove or hard-disable the `mock-jwt-token` bypass
5. Add Zod schema validation on all request bodies

**Roadmap to Production:**
1. Full OWASP Top 10 security audit by a dedicated security engineer
2. Implement API key rotation and secret management (AWS Secrets Manager or similar)
3. Set strict CORS origin allowlist
4. Add request body size limits to prevent payload flooding
5. Consider WAF in front of the API

---

### 2.2 Database & Schema

**Status:** In-Progress (Good design, some concerns)

**What's Good:**
- Prisma schema is well-structured with clear commentary
- UUID primary keys throughout — correct for distributed systems
- Proper `onDelete: Cascade` on user-owned data
- Meaningful indices on `userId`, `category`, `isShared`, `activatedAt`
- `BurnedAnchor` model preserves historical data without hard deletes
- Atomic `$transaction` used in the burn endpoint — good practice
- 2 migrations with a rollback script — responsible migration management

**What's Broken / Hacky:**
- The burn endpoint creates a `BurnedAnchor` with `distilledLetters: []` (hardcoded empty array) — the original anchor's `distilledLetters` array is **silently discarded**. This is a data loss bug
```typescript
// backend/src/api/routes/anchors.ts line 585
distilledLetters: [],  // BUG: should be anchor.distilledLetters
```
- The `Anchor` model contains a mix of "new architecture" fields and explicitly labeled "LEGACY FIELDS (Deprecated - kept for backward compatibility)" including `enhancementStatus`, `selectedSymbols`, `aiStyle`, `variationUrls`. These add schema complexity and DB storage overhead with no benefit once migration is complete
- `charge` and `activate` endpoints each make **two separate Prisma calls** (create record + update anchor stats) without a transaction — these can desync if the second call fails
- The `User` model tracks `totalAnchorsCreated` as a counter that is incremented on anchor creation but never decremented on deletion/archiving. It will diverge from the actual count over time
- No cursor-based pagination on anchor list endpoint — `limit` parameter exists but the query always starts from the beginning. For users with 50+ anchors this will be slow and wasteful

**Roadmap to Beta:**
- Fix `distilledLetters: []` data loss bug in burn endpoint
- Wrap charge and activation creation in `$transaction`

**Roadmap to Production:**
- Remove all deprecated legacy fields from the schema with a proper migration
- Implement cursor-based pagination for anchor lists
- Replace counter fields (`totalAnchorsCreated`, `totalActivations`) with derived `COUNT()` queries or use a background job to keep them reconciled
- Add database query performance monitoring (Prisma's `queryRaw` logging or Prisma Pulse)

---

### 2.3 Testing Coverage

**Status:** In-Progress — **19 tests currently FAILING**

**By the Numbers:**
- Total tests: **303**
- Passing: **284**
- Failing: **19**
- Test suites: **21**
- Backend test files: **2** (out of dozens of testable modules)
- "Stub" tests (contain only `expect(true).toBe(true)` + TODO): estimated **~80+ tests** across 8 files

**The Stub Problem:**
Across the `create/` screen tests, virtually every test is:
```typescript
it('stub: renders correctly', () => {
    // TODO: implement assertion
    expect(true).toBe(true);
});
```
These tests pass but assert nothing. The test suite shows 303 tests but a large fraction of them are meaningless. Real test coverage is far lower than the 303 number implies.

**What's Actually Tested:**
- `ErrorBoundary` — 9 real tests ✓
- `LoadingSpinner` — 11 real tests ✓
- `Toast` / `ToastProvider` — 13 real tests ✓
- `anchorStore` — partial coverage ✓
- `authStore` — partial coverage ✓
- `AIEnhancer` (backend) — well tested ✓
- `MantraGenerator` (backend) — partially tested ✓
- `streakHelpers`, `stabilizeStats`, `hash`, `logger` utilities — tested ✓
- Sigil generation algorithms — tested ✓

**What's Not Tested:**
- All API routes (`auth`, `anchors`, `ai`, `practice`) — **zero coverage**
- Auth middleware — **zero coverage**
- Error handler middleware — **zero coverage**
- All screen components (IntentionInput, StructureForge, MantraCreation, etc.) — **stubs only**
- VaultScreen, AnchorDetailScreen, PracticeScreen — **stubs only**
- Ritual flows (charging, activation, burning) — **stubs only**
- StorageService — **zero backend coverage**
- TTSService — **zero coverage**
- Any integration tests across the full stack

**E2E Tests:**
- 3 Detox E2E test files exist (`chargeFlow.*.e2e.ts`)
- **No Detox runner is configured** in `package.json` scripts
- E2E tests cannot be run in their current state

**Roadmap to Beta:**
1. Fix the 19 failing tests immediately — cannot ship a beta with a red test suite
2. Convert stub tests into real assertions for the critical user flow screens
3. Add at minimum one integration test per API route (happy path)
4. Configure Detox runner so E2E tests can actually execute

**Roadmap to Production:**
1. Achieve 70% line coverage (currently estimated ~30% real coverage)
2. 100% coverage on security-critical paths (auth middleware, anchor ownership checks)
3. Full E2E test suite covering the three primary user journeys

---

### 2.4 DevOps / CI/CD

**Status:** Missing — **No CI/CD pipeline exists**

**What's Present:**
- `backend/.env.example` — good documentation of required variables
- `ai-service/Dockerfile` — the Python AI service is containerized
- TypeScript build scripts (`tsc`, `ts-node`)
- ESLint + Prettier configured for backend
- `QUICK_START.sh` script for local setup

**What's Missing:**
- **No `.github/workflows/` directory** — no automated CI on PRs or pushes
- **No Dockerfile for the Node.js backend** — cannot be containerized for deployment
- **No `docker-compose.yml`** — local development requires manually starting PostgreSQL, Redis, and Node separately
- **No deployment scripts** — no automated path from code to running server
- **No staging environment** evident from configuration
- **No secret rotation plan**
- **No database backup strategy**

**Additional Concerns:**
- The root `package.json` `test` script is `echo "Error: no test specified" && exit 1` — a CI system running `npm test` from root would fail immediately
- Backend has 235 `console.log` statements that would flood production logs and expose sensitive data

**Roadmap to Beta:**
1. Create a basic GitHub Actions workflow: lint → type-check → test → build on every PR
2. Create a `Dockerfile` for the backend
3. Create a `docker-compose.yml` for local development
4. Set `ALLOWED_ORIGINS` to the actual beta server domain

**Roadmap to Production:**
1. Multi-stage Docker builds for optimized images
2. Deployment pipeline with staging → canary → production gates
3. Automated database migrations as part of deployment
4. Secret management integration (not `.env` files on the server)
5. Monitoring alerts (Sentry, uptime monitoring, error rate thresholds)
6. Database backup automated (daily at minimum, tested monthly)

---

## FINAL SUMMARY

### Beta Readiness Score: **32 / 100**

| Category | Score | Blocking? |
|---|---|---|
| Core user flow (mock mode) | 80% | — |
| Real Authentication | 0% | **YES** |
| Subscription / Monetization | 5% | **YES** |
| Security (backend) | 30% | **YES** |
| Failing tests | 0% | **YES** |
| CI/CD Pipeline | 0% | YES |
| API URL configuration | 0% | **YES** |
| TypeScript integrity | 70% | No |
| UI completeness (placeholders) | 60% | No |
| State management | 75% | No |

---

### Production Readiness Score: **18 / 100**

Everything blocking beta also blocks production, plus:

| Additional Gap | Impact |
|---|---|
| No route-level tests | High |
| No E2E tests running | High |
| No Docker / deployment infra | High |
| No database backup strategy | High |
| No secret management | High |
| Mass assignment vulnerability | Critical |
| No performance validation at scale | Medium |
| Legacy schema fields not cleaned up | Medium |

---

## TOP 5 TASKS — TACKLE IMMEDIATELY

### 1. IMPLEMENT REAL AUTHENTICATION
**Effort:** 5–10 days
Replace `AuthService.ts` (currently mocked) with the real Firebase Auth SDK. The mock has been a useful development crutch, but zero real users can sign in today. Wire `firebase/auth` for email, Google, and Apple sign-in. Replace `mock-jwt-token` verification on the backend with `firebase-admin` ID token verification. This is the single biggest blocker.

### 2. FIX THE MASS ASSIGNMENT VULNERABILITY IN ANCHOR UPDATE
**Effort:** 2 hours
In `backend/src/api/routes/anchors.ts` line 289, define a strict allowlist of what fields a user can update on their anchor via the API. Never spread `req.body` directly into a Prisma `data` clause. Add a Zod schema that validates and strips the request body.

### 3. INSTALL REVENUECAT AND WIRE SUBSCRIPTION GATING
**Effort:** 3–5 days
Install `react-native-purchases`, configure it with the RevenueCat API key, and wire the `subscriptionStore.setRcTier()` action to real entitlement responses. The Pro paywall modal currently shows an error message when triggered. The "Upgrade to Pro" button on ProfileScreen does nothing.

### 4. FIX 19 FAILING TESTS AND REPLACE STUBS WITH REAL ASSERTIONS
**Effort:** 3–5 days
Zero tolerance for a red test suite at beta. First, fix the 19 failing tests. Second, convert the highest-risk stub tests (IntentionInputScreen, StructureForgeScreen, VaultScreen) into real assertions that test actual behavior. Add a GitHub Actions workflow so that future regressions are caught automatically.

### 5. REPLACE HARDCODED LAN IP WITH ENVIRONMENT VARIABLE
**Effort:** 2 hours
Change `anchor/mobile/src/config/index.ts` from `'http://192.168.0.17:8000'` to `process.env.EXPO_PUBLIC_API_URL`. Add this variable to the Expo build configuration. Confirm the production URL `https://api.anchor.app` resolves. Every external device that tries to use the beta build today cannot reach the API.

---

*Audit completed: 2026-02-26. All findings are based on static analysis of the repository at HEAD of branch `claude/project-anchor-audit-CRJ4P`.*
