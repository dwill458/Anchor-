# Parallel AI Workflow - Anchor Project
## Claude, Gemini & Codex Working Together

**Created**: February 4, 2026
**Project**: Anchor - Ritual Anchor Mobile App
**Launch Target**: February 20, 2026 (16 days remaining)
**Current Status**: 78-80% launch ready

---

## Overview

This document defines a parallel workflow leveraging the unique strengths of Claude, Gemini, and Codex to accelerate development toward the February 20 launch.

### AI Strengths Matrix

| AI | Core Strengths | Best For | Avoid |
|----|---------------|----------|-------|
| **Claude Sonnet 4.5** | Complex reasoning, architecture, testing strategy, documentation, debugging | Test infrastructure, architectural decisions, complex refactoring, code review | Simple boilerplate, repetitive tasks |
| **Gemini 2.0** | Large context (2M tokens), multimodal, data analysis, creative solutions, search | Full codebase analysis, visual design review, security audits, pattern detection | Low-level algorithm optimization |
| **Codex (GPT-4)** | Fast code generation, API integrations, algorithms, boilerplate, pattern following | Service implementations, API endpoints, component generation, utility functions | Strategic planning, architectural decisions |

---

## Parallel Workflow Strategy

### Phase Division (Work in Parallel)

**CLAUDE** → Test Infrastructure & Quality Assurance (Track 1)
**GEMINI** → Security, Analytics & Full-Stack Integration (Track 2)
**CODEX** → Service Implementations & Component Completion (Track 3)

### Conflict Prevention Rules

1. **File Ownership**: Each AI works in different directories/files
2. **Branch Strategy**: Each AI gets dedicated branch
3. **Merge Order**: CODEX → GEMINI → CLAUDE (code → integration → tests)
4. **Communication**: Update shared status document after each commit

---

## TRACK 1: CLAUDE - Test Infrastructure & Quality
**Branch**: `claude/test-infrastructure-track1`
**Priority**: HIGH (blocks launch confidence)
**Estimated Time**: 8-12 hours

### Current State
- Test Pass Rate: 79.9% (226/283 passing, 57 failing)
- Code Coverage: 33% (target: 70%)
- Test Execution: 27.7 seconds

### Objectives
1. Fix remaining 57 failing tests → 95%+ pass rate
2. Expand coverage from 33% → 70%
3. Create E2E test framework
4. Document testing best practices

### Work Areas
- `apps/mobile/src/__tests__/` (all test files)
- `apps/mobile/src/**/*.test.tsx` (component tests)
- `apps/mobile/jest.config.js` (config)
- `docs/TESTING_*.md` (documentation)

---

### CLAUDE PROMPT 1: Fix Remaining Test Failures
```
I'm working on the Anchor mobile app test suite. We currently have 57 failing tests out of 283 (79.9% pass rate). I need to fix the remaining failures to reach 95%+ pass rate.

CONTEXT:
- Branch: claude/test-infrastructure-track1
- Recent fixes: DurationSelectionStep event handlers, BurningRitualScreen timeouts
- Phase 1-4 test fixes already completed (see docs/PHASE4_TEST_FIXES_FEB3.md)

CURRENT FAILING TESTS (Priority Order):
1. LoadingSpinner tests (3 failures) - accessibility role not found
2. BreathingAnimation tests (module not found) - file moved/renamed
3. DurationSelectionStep (1 failure) - disabled button state check
4. ApiClient tests (2 failures) - hardcoded config values
5. Sigil generator tests (2 failures) - SVG structure mismatch
6. Remaining component tests (~47 failures) - need investigation

REQUIREMENTS:
1. Run tests to identify exact failure reasons: npm test
2. Fix failures one category at a time (highest priority first)
3. Use modern async patterns (act() with fake timers, waitFor for real async)
4. Ensure type safety in all mocks
5. Update test documentation after each phase
6. Commit after fixing each category

CONSTRAINTS:
- DO NOT modify production code unless absolutely necessary
- Prefer fixing test expectations over changing implementation
- Use existing mock patterns from src/__tests__/setup.ts
- All fixes must maintain or improve test execution speed

OUTPUT:
- Commit message for each fix phase
- Updated pass rate after each phase
- Document any production code changes required
- Final summary with 95%+ pass rate achieved

Start by running the tests and categorizing the 57 failures by root cause.
```

---

### CLAUDE PROMPT 2: Coverage Expansion to 70%
```
I need to expand test coverage for the Anchor mobile app from 33% to 70% to meet our launch quality bar.

CONTEXT:
- Branch: claude/test-infrastructure-track1
- Test failures resolved (95%+ pass rate)
- Current coverage: 33%
- Target coverage: 70% (statements, branches, functions, lines)
- Coverage thresholds in jest.config.js: statements: 70, branches: 60, functions: 70, lines: 70

AREAS NEEDING COVERAGE (Priority Order):
1. Services (currently low coverage)
   - src/services/ErrorTrackingService.ts
   - src/services/AnalyticsService.ts
   - src/services/PerformanceMonitoring.ts
   - src/services/NotificationService.ts
   - src/services/BiometricService.ts

2. Stores (partial coverage)
   - src/stores/anchorStore.ts (complex state mutations)
   - src/stores/authStore.ts (async flows)

3. Complex Components (low coverage)
   - src/screens/creation/* (ritual creation flow)
   - src/screens/rituals/* (ritual execution)
   - src/components/common/* (reusable components)

4. Utility Functions (spotty coverage)
   - src/utils/sigil/* (sigil generation)
   - src/utils/validation.ts
   - src/utils/formatting.ts

REQUIREMENTS:
1. Run coverage report: npm test -- --coverage
2. Identify files below 70% coverage
3. Write tests for uncovered code paths (happy path + edge cases + error handling)
4. Focus on business-critical paths first (anchor creation, ritual execution, auth)
5. Use existing test patterns from Phase 1-4 fixes
6. Aim for meaningful tests, not just coverage numbers

TESTING PATTERNS TO FOLLOW:
- Component tests: render + user interactions + state changes
- Service tests: mock dependencies, test success/error paths
- Store tests: test state mutations, async actions, side effects
- Utility tests: pure functions, edge cases, error handling

OUTPUT:
- Coverage report before/after
- List of files brought to 70%+ coverage
- Any gaps remaining (with justification)
- Commit message with coverage improvement metrics

Start by generating a coverage report and identifying the 20 files with lowest coverage.
```

---

### CLAUDE PROMPT 3: E2E Test Framework Setup
```
I need to set up an End-to-End (E2E) testing framework for the Anchor mobile app to test critical user flows before launch.

CONTEXT:
- Branch: claude/test-infrastructure-track1
- Platform: React Native (Expo)
- Current tests: Unit and integration tests only
- Launch: 16 days away
- Need fast, reliable E2E tests for CI/CD

CRITICAL USER FLOWS TO TEST:
1. Authentication Flow
   - Sign up → Onboarding → Create first anchor
   - Sign in → Navigate to existing anchor
   - Sign out → Clear session

2. Anchor Creation Flow
   - Navigate to creation → Enter intention → Select structure → Generate sigil → Save anchor

3. Ritual Activation Flow
   - Select anchor → Choose mode (focus/ritual) → Select duration → Execute breathing → Complete

4. Burning Ritual Flow
   - Select anchor → Confirm burn → Watch animation → Archive anchor → Navigate to vault

5. Profile Management
   - View profile → Change settings → Delete account (GDPR test)

FRAMEWORK OPTIONS:
1. Detox (recommended for React Native)
2. Appium (cross-platform)
3. Maestro (newer, simpler)

REQUIREMENTS:
1. Choose framework (recommend Detox for React Native + Expo)
2. Set up configuration files
3. Write E2E tests for 5 critical flows above
4. Ensure tests run in CI/CD (GitHub Actions)
5. Tests should be fast (<5 min total) and reliable
6. Document setup process for team

DELIVERABLES:
- E2E framework configured (detox.config.js or equivalent)
- 5 E2E test files (one per critical flow)
- CI/CD integration (.github/workflows/e2e-tests.yml)
- Documentation (docs/E2E_TESTING.md)
- All E2E tests passing

OUTPUT:
- Setup instructions
- Test execution results
- CI/CD integration proof
- Commit message

Start by researching the best E2E framework for Expo React Native in 2026 and recommend one with justification.
```

---

## TRACK 2: GEMINI - Security, Analytics & Full-Stack Integration
**Branch**: `gemini/security-analytics-track2`
**Priority**: CRITICAL (security blocks launch)
**Estimated Time**: 10-14 hours

### Current State
- 21 mobile integration TODOs pending
- Security audit not completed
- Analytics/monitoring services stubbed
- GDPR compliance needs verification

### Objectives
1. Complete security audit (frontend + backend)
2. Implement ErrorTrackingService, AnalyticsService, PerformanceMonitoring
3. Verify GDPR/CCPA compliance
4. Full codebase architecture review

### Work Areas
- `apps/mobile/src/services/` (service implementations)
- `backend/src/` (all backend code - security review)
- `docs/SECURITY_AUDIT.md` (new)
- `docs/ARCHITECTURE_REVIEW.md` (new)

---

### GEMINI PROMPT 1: Comprehensive Security Audit
```
I need you to perform a comprehensive security audit of the Anchor mobile app (React Native frontend + Node.js/Express backend). This is a production app launching in 16 days.

CONTEXT:
- Branch: gemini/security-analytics-track2
- App: Ritual anchor mobile app with meditation/focus rituals
- Stack: React Native (Expo), Node.js, Express, Prisma, PostgreSQL
- User data: Email, password, intentions (sensitive), ritual history, subscription status
- Launch: February 20, 2026 (16 days)

CODEBASE STRUCTURE:
Frontend:
- apps/mobile/src/ (React Native app)
- apps/mobile/src/services/ApiClient.ts (API communication)
- apps/mobile/src/services/AuthService.ts (authentication)
- apps/mobile/src/screens/auth/ (login/signup)

Backend:
- backend/src/api/routes/ (API endpoints)
- backend/src/middleware/ (auth, validation, error handling)
- backend/src/api/routes/auth.ts (authentication endpoints)
- backend/prisma/schema.prisma (database schema)

AUDIT SCOPE:
1. Authentication & Authorization
   - JWT token security (rotation, expiration, secure storage)
   - Password hashing (bcrypt strength, salt rounds)
   - Session management
   - OAuth implementation (Google, Apple)

2. Data Protection
   - Sensitive data handling (user intentions, ritual data)
   - Encryption at rest and in transit
   - AsyncStorage security (mobile)
   - Database security (Prisma, PostgreSQL)

3. API Security
   - Input validation and sanitization
   - SQL injection prevention
   - XSS prevention
   - CSRF protection
   - Rate limiting
   - CORS configuration

4. OWASP Top 10 (2025)
   - Check for all vulnerabilities
   - Broken Access Control
   - Cryptographic Failures
   - Injection
   - Insecure Design
   - Security Misconfiguration

5. Mobile-Specific Security
   - Secure storage (iOS Keychain, Android Keystore)
   - Certificate pinning
   - Code obfuscation
   - Deep linking security
   - Biometric authentication security

6. GDPR/CCPA Compliance
   - Account deletion (implemented in backend/src/api/routes/auth.ts DELETE /api/auth/me)
   - Data export capability
   - Consent management
   - Right to be forgotten
   - Privacy policy enforcement

REQUIREMENTS:
1. Use your 2M token context window to analyze the ENTIRE codebase
2. Identify vulnerabilities by severity (CRITICAL, HIGH, MEDIUM, LOW)
3. Provide specific file:line references for each issue
4. Suggest concrete fixes with code examples
5. Check for credential leaks, hardcoded secrets, API keys
6. Verify environment variable usage

OUTPUT FORMAT:
Create docs/SECURITY_AUDIT_FEB4.md with:
- Executive Summary (Critical issues count)
- Vulnerability List (severity, location, description, fix)
- GDPR/CCPA Compliance Checklist
- Recommendations for immediate fixes before launch
- Long-term security improvements

Start by reading the entire codebase and creating a security vulnerability map.
```

---

### GEMINI PROMPT 2: Implement ErrorTracking & Analytics Services
```
I need you to implement production-ready ErrorTracking, Analytics, and PerformanceMonitoring services for the Anchor mobile app. These are currently stubbed and marked as TODOs.

CONTEXT:
- Branch: gemini/security-analytics-track2
- Files to implement:
  - apps/mobile/src/services/ErrorTrackingService.ts (currently stubbed)
  - apps/mobile/src/services/AnalyticsService.ts (currently stubbed)
  - apps/mobile/src/services/PerformanceMonitoring.ts (may not exist)
- Current status: 21 mobile integration TODOs pending
- Launch: 16 days away

SERVICE REQUIREMENTS:

1. ErrorTrackingService (Priority: CRITICAL)
   - Integration: Sentry or similar
   - Capture exceptions with context
   - Capture breadcrumbs for debugging
   - User context (non-PII only)
   - Environment detection (dev/staging/prod)
   - Release tracking
   - Sourcemap support
   - Methods needed:
     - initialize()
     - captureException(error, context)
     - captureMessage(message, level)
     - addBreadcrumb(message, category, data)
     - setUser(user)
     - clearUser()

2. AnalyticsService (Priority: HIGH)
   - Integration: Firebase Analytics or Mixpanel
   - Track user events (non-PII)
   - Screen view tracking
   - Custom event properties
   - User properties (subscription tier, etc.)
   - GDPR-compliant (opt-out capability)
   - Methods needed:
     - initialize()
     - track(eventName, properties)
     - screen(screenName, properties)
     - identify(userId, traits)
     - reset()
   - Events to track (see AnalyticsEvents enum):
     - ANCHOR_CREATED
     - RITUAL_STARTED
     - RITUAL_COMPLETED
     - BURN_COMPLETED
     - etc.

3. PerformanceMonitoring (Priority: MEDIUM)
   - Integration: Firebase Performance or custom
   - Track app startup time
   - Track screen render times
   - Track API call latency
   - Track slow network requests
   - Memory usage tracking
   - Methods needed:
     - initialize()
     - startTrace(traceName)
     - stopTrace(traceName)
     - recordMetric(name, value)
     - trackNetworkRequest(url, method, duration, statusCode)

TECHNICAL REQUIREMENTS:
1. Use environment variables for API keys (never hardcode)
2. Graceful degradation if services unavailable
3. TypeScript strict mode compliance
4. Comprehensive error handling
5. Unit tests for each service (mock external SDKs)
6. Documentation for setup and usage

INTEGRATION POINTS:
- Initialize in apps/mobile/App.tsx
- Error boundaries should use ErrorTrackingService
- All screens should track views
- All user actions should track events
- API client should track performance

DELIVERABLES:
1. Fully implemented services with proper SDK integration
2. Unit tests for all services (mock external SDKs)
3. Environment variable configuration guide
4. Documentation (docs/SERVICES_SETUP.md)
5. Integration example in App.tsx
6. Remove all TODO comments related to these services

OUTPUT:
- Implementation plan (which SDKs to use)
- Code for all three services
- Test files
- Documentation
- Commit message

Start by researching the best SDKs for React Native in 2026 for each service and propose a stack.
```

---

### GEMINI PROMPT 3: Full Codebase Architecture Review
```
I need you to perform a comprehensive architecture review of the Anchor app codebase (frontend + backend) to identify technical debt, architectural issues, and opportunities for improvement before launch.

CONTEXT:
- Branch: gemini/security-analytics-track2
- Codebase: React Native frontend + Node.js backend
- Launch: 16 days away
- Current state: 78-80% launch ready
- Your advantage: 2M token context window (can see entire codebase)

REVIEW SCOPE:

1. Frontend Architecture (apps/mobile/src/)
   - Component structure and organization
   - State management (Zustand stores)
   - Navigation architecture
   - API client design
   - Service layer organization
   - Utility function organization
   - Type definitions consistency

2. Backend Architecture (backend/src/)
   - API route organization
   - Middleware architecture
   - Error handling patterns
   - Database schema design (Prisma)
   - Authentication/authorization flow
   - Service layer (if any)
   - Validation patterns

3. Cross-Cutting Concerns
   - Error handling consistency
   - Logging strategy
   - Validation approach
   - Testing patterns
   - Documentation quality
   - Code duplication
   - Type safety

4. Data Flow Analysis
   - User authentication flow
   - Anchor creation flow
   - Ritual execution flow
   - Data synchronization (online/offline)
   - State management patterns

5. Performance Considerations
   - Bundle size analysis
   - Unnecessary re-renders
   - Memory leaks
   - Database query optimization
   - API response times
   - Image/asset optimization

6. Scalability Assessment
   - Can handle 10K users?
   - Database schema scales?
   - API rate limiting needed?
   - Caching strategy?
   - CDN usage?

7. Code Quality Metrics
   - Cyclomatic complexity
   - Code duplication percentage
   - Average function length
   - Type coverage
   - Test coverage gaps

ANALYSIS APPROACH:
1. Read entire codebase into your 2M context window
2. Map all architectural patterns used
3. Identify inconsistencies and anti-patterns
4. Detect code smells and technical debt
5. Find circular dependencies
6. Analyze coupling and cohesion
7. Check for separation of concerns

OUTPUT FORMAT:
Create docs/ARCHITECTURE_REVIEW_FEB4.md with:

1. Executive Summary
   - Overall architecture grade (A-F)
   - Top 5 concerns for launch
   - Top 5 strengths

2. Detailed Analysis by Area
   - Frontend architecture
   - Backend architecture
   - Data flow
   - Performance
   - Scalability

3. Issues Found (categorized by severity)
   - CRITICAL (blocks launch)
   - HIGH (should fix before launch)
   - MEDIUM (fix in v1.1)
   - LOW (tech debt backlog)

4. Recommendations
   - Immediate actions (pre-launch)
   - Short-term improvements (post-launch)
   - Long-term refactoring (future)

5. Architecture Diagrams
   - Current state (as-is)
   - Proposed improvements (to-be)

6. Metrics Dashboard
   - Code quality scores
   - Complexity metrics
   - Duplication analysis

Start by ingesting the entire codebase and creating an architectural dependency graph.
```

---

## TRACK 3: CODEX - Service Implementations & Components
**Branch**: `codex/services-components-track3`
**Priority**: HIGH (feature completion)
**Estimated Time**: 8-10 hours

### Current State
- Some services stubbed or incomplete
- Component library needs expansion
- API endpoints need completion
- Utility functions need implementation

### Objectives
1. Implement remaining service methods
2. Complete component library
3. Add missing API endpoints
4. Implement utility functions

### Work Areas
- `apps/mobile/src/services/` (service completions)
- `apps/mobile/src/components/common/` (components)
- `backend/src/api/routes/` (API endpoints)
- `apps/mobile/src/utils/` (utilities)

---

### CODEX PROMPT 1: Complete Service Implementations
```
I need you to implement all remaining service methods in the Anchor mobile app services layer. Many services have TODO comments or stubbed methods.

CONTEXT:
- Branch: codex/services-components-track3
- Language: TypeScript (strict mode)
- Platform: React Native (Expo)
- Services location: apps/mobile/src/services/

SERVICES TO COMPLETE:

1. NotificationService.ts
   Status: Partially implemented
   Missing:
   - scheduleRitualReminder(anchorId, time)
   - cancelReminder(reminderId)
   - handleNotificationClick(notification)
   - requestPermissions()

2. BiometricService.ts
   Status: Partially implemented
   Missing:
   - authenticate(reason: string): Promise<boolean>
   - hasHardware(): Promise<boolean>
   - isEnrolled(): Promise<boolean>
   - getSupportedTypes(): Promise<string[]>

3. StorageService.ts (may not exist - need to create)
   Purpose: Abstraction over AsyncStorage
   Methods needed:
   - setItem(key, value)
   - getItem(key)
   - removeItem(key)
   - clear()
   - getAllKeys()
   - multiGet(keys)
   - multiSet(keyValuePairs)

4. SyncService.ts (may not exist - need to create)
   Purpose: Sync local state with backend
   Methods needed:
   - syncAnchors(): Promise<void>
   - syncUserProfile(): Promise<void>
   - handleConflict(localData, remoteData)
   - getLastSyncTime(): Promise<Date>

REQUIREMENTS:
1. Follow existing service patterns (see AuthService.ts, ApiClient.ts)
2. Use TypeScript strict mode (no any types)
3. Comprehensive error handling with try/catch
4. JSDoc comments for all public methods
5. Use Expo APIs where appropriate (expo-notifications, expo-local-authentication)
6. Mock implementations for easier testing
7. Environment-aware (dev/staging/prod)

CODE STYLE:
- Export as singleton or class with static methods
- Use async/await (not .then())
- Descriptive error messages
- Return Result<T, Error> pattern or throw typed errors

DELIVERABLES:
1. Fully implemented service files
2. Type definitions for all methods
3. JSDoc documentation
4. Basic unit tests (mock external dependencies)
5. Usage examples in comments

OUTPUT:
- Complete implementation for each service
- Any new files created
- Commit message

Start with NotificationService.ts and BiometricService.ts since they're partially complete.
```

---

### CODEX PROMPT 2: Complete Component Library
```
I need you to implement missing common components for the Anchor mobile app component library.

CONTEXT:
- Branch: codex/services-components-track3
- Location: apps/mobile/src/components/common/
- Framework: React Native
- Language: TypeScript
- Existing components: Button, Input, Toast, LoadingSpinner, Card

COMPONENTS TO CREATE:

1. Modal Component (Modal.tsx)
   Props:
   - visible: boolean
   - onClose: () => void
   - title?: string
   - children: React.ReactNode
   - animationType?: 'slide' | 'fade' | 'none'
   Features:
   - Backdrop with onPress close
   - Animated entrance/exit
   - SafeArea handling
   - Accessibility support

2. DateTimePicker Component (DateTimePicker.tsx)
   Props:
   - value: Date
   - onChange: (date: Date) => void
   - mode: 'date' | 'time' | 'datetime'
   - minimumDate?: Date
   - maximumDate?: Date
   Features:
   - Platform-specific native pickers
   - Modal on Android, inline on iOS
   - Formatted display

3. BottomSheet Component (BottomSheet.tsx)
   Props:
   - visible: boolean
   - onClose: () => void
   - children: React.ReactNode
   - snapPoints?: string[]
   Features:
   - Gesture-driven (react-native-gesture-handler)
   - Snap to positions
   - Backdrop dismiss
   - Smooth animations

4. Avatar Component (Avatar.tsx)
   Props:
   - source?: ImageSourcePropType
   - name?: string (for initials fallback)
   - size?: 'small' | 'medium' | 'large'
   - onPress?: () => void
   Features:
   - Image with fallback to initials
   - Loading state
   - Error state
   - Customizable sizes

5. Skeleton Component (Skeleton.tsx)
   Props:
   - width?: number | string
   - height?: number | string
   - borderRadius?: number
   - variant?: 'text' | 'rectangular' | 'circular'
   Features:
   - Shimmer animation
   - Multiple variants
   - Responsive sizing

6. Badge Component (Badge.tsx)
   Props:
   - count?: number
   - showZero?: boolean
   - max?: number (e.g., 99+)
   - color?: string
   - children?: React.ReactNode
   Features:
   - Position over children
   - Dot or number display
   - Animated updates

REQUIREMENTS:
1. Match existing component patterns (see Button.tsx, Card.tsx)
2. TypeScript with proper prop types
3. Use theme system (colors, spacing, typography from @/theme)
4. Accessibility labels and roles
5. Haptic feedback where appropriate
6. JSDoc comments
7. Responsive to screen sizes
8. Dark mode support (if theme supports)

COMPONENT STRUCTURE:
```typescript
/**
 * ComponentName
 *
 * Description of component purpose
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

export interface ComponentNameProps {
  // Props here
}

export const ComponentName: React.FC<ComponentNameProps> = ({
  // Props destructuring
}) => {
  // Component logic

  return (
    // JSX
  );
};

const styles = StyleSheet.create({
  // Styles
});
```

DELIVERABLES:
1. Six fully implemented components
2. TypeScript prop interfaces
3. JSDoc documentation
4. Usage examples in comments
5. Export from index.ts

OUTPUT:
- Complete component files
- Updated index.ts
- Commit message

Start with Modal and Avatar as they're commonly needed.
```

---

### CODEX PROMPT 3: Complete Backend API Endpoints
```
I need you to implement missing or incomplete backend API endpoints for the Anchor app.

CONTEXT:
- Branch: codex/services-components-track3
- Location: backend/src/api/routes/
- Framework: Express.js
- Database: Prisma + PostgreSQL
- Auth: JWT middleware (authMiddleware)

ENDPOINTS TO IMPLEMENT/COMPLETE:

1. User Profile Endpoints (backend/src/api/routes/user.ts)
   GET /api/user/profile - Get current user profile ✅ (exists)
   PUT /api/user/profile - Update user profile (IMPLEMENT)
   GET /api/user/stats - Get user statistics (IMPLEMENT)
   POST /api/user/avatar - Upload user avatar (IMPLEMENT)

2. Anchor Endpoints (backend/src/api/routes/anchors.ts)
   GET /api/anchors - List user's anchors ✅ (exists)
   POST /api/anchors - Create anchor ✅ (exists)
   GET /api/anchors/:id - Get single anchor ✅ (exists)
   PUT /api/anchors/:id - Update anchor (IMPLEMENT)
   DELETE /api/anchors/:id - Delete anchor ✅ (exists)
   POST /api/anchors/:id/activate - Activate anchor ✅ (exists)

3. Ritual Endpoints (backend/src/api/routes/rituals.ts - may not exist)
   POST /api/rituals - Start new ritual (IMPLEMENT)
   PUT /api/rituals/:id - Complete ritual (IMPLEMENT)
   GET /api/rituals/history - Get ritual history (IMPLEMENT)
   GET /api/rituals/stats - Get ritual statistics (IMPLEMENT)

4. Subscription Endpoints (backend/src/api/routes/subscription.ts - may not exist)
   GET /api/subscription/status - Get subscription status (IMPLEMENT)
   POST /api/subscription/checkout - Create checkout session (IMPLEMENT)
   POST /api/subscription/webhook - Handle Stripe webhooks (IMPLEMENT)
   POST /api/subscription/cancel - Cancel subscription (IMPLEMENT)

5. Vault Endpoints (backend/src/api/routes/vault.ts - may not exist)
   GET /api/vault - Get archived anchors (IMPLEMENT)
   GET /api/vault/:id - Get single archived anchor (IMPLEMENT)
   DELETE /api/vault/:id - Permanently delete archived anchor (IMPLEMENT)

IMPLEMENTATION REQUIREMENTS:

1. Route Structure:
```typescript
import { Router } from 'express';
import { authMiddleware } from '@/middleware/authMiddleware';
import { validateRequest } from '@/middleware/validation';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';

const router = Router();

router.get('/endpoint',
  authMiddleware,
  validateRequest(schema),
  async (req: AuthRequest, res: Response) => {
    try {
      // Implementation
      res.json({ success: true, data: result });
    } catch (error) {
      // Error handling
    }
  }
);

export default router;
```

2. Validation:
- Use express-validator for request validation
- Validate all inputs (body, params, query)
- Return 400 for validation errors

3. Error Handling:
- Use AppError class for known errors
- Log errors with context
- Return appropriate status codes (400, 401, 403, 404, 500)
- Don't leak internal errors to client

4. Security:
- All routes require authMiddleware (except webhooks)
- Check resource ownership before operations
- Sanitize inputs to prevent SQL injection
- Rate limit sensitive endpoints

5. Response Format:
```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: { message: '...', code: '...' } }

// List with pagination
{ success: true, data: [...], pagination: { page, limit, total } }
```

DELIVERABLES:
1. All endpoint implementations
2. Request validation schemas
3. Error handling
4. JSDoc comments
5. Integration with existing routes in backend/src/api/routes/index.ts

OUTPUT:
- Complete route files
- Validation schemas
- Updated route registration
- Commit message

Start with the ritual endpoints as they're core functionality.
```

---

## Merge Strategy

### Order of Integration
1. **CODEX merges first** (services-components-track3 → main)
   - Reason: Base implementations, no conflicts expected
   - Review: Claude reviews code quality

2. **GEMINI merges second** (security-analytics-track2 → main)
   - Reason: Builds on Codex's services
   - Review: Claude reviews security fixes

3. **CLAUDE merges last** (test-infrastructure-track1 → main)
   - Reason: Tests validate all changes
   - Review: Gemini reviews test coverage

### Conflict Resolution
- If conflicts occur, Claude handles resolution (best reasoning)
- Each AI documents their changes in merge commit message
- Run full test suite after each merge

---

## Status Tracking

### Shared Status Document
Create: `docs/PARALLEL_WORKFLOW_STATUS.md`

Each AI updates after completing work:
```markdown
## Latest Update
**AI**: [Claude/Gemini/Codex]
**Date**: [timestamp]
**Branch**: [branch-name]
**Status**: [In Progress / Complete / Blocked]
**Commits**: [list of commit SHAs]
**Next Steps**: [what's next]
**Blockers**: [any blockers]
```

---

## Success Criteria

### CLAUDE Track 1 Success:
- ✅ 95%+ test pass rate (270+/283 tests passing)
- ✅ 70%+ code coverage
- ✅ E2E tests running in CI/CD
- ✅ Testing documentation complete

### GEMINI Track 2 Success:
- ✅ Security audit complete (no critical issues)
- ✅ GDPR/CCPA compliance verified
- ✅ ErrorTracking + Analytics + Performance services implemented
- ✅ Architecture review complete with recommendations

### CODEX Track 3 Success:
- ✅ All services fully implemented
- ✅ Component library complete (6 new components)
- ✅ All API endpoints implemented and tested
- ✅ No TODO comments remaining

### Overall Success:
- ✅ All three tracks merged without conflicts
- ✅ All tests passing (95%+)
- ✅ Launch readiness: 95%+ (up from 78-80%)
- ✅ No critical security issues
- ✅ Documentation complete

---

## Timeline Estimate

### Parallel Execution (Ideal):
- **Day 1-2**: All AIs work in parallel (16-24 hours total)
- **Day 3**: Merge and integration (4-6 hours)
- **Day 4**: Final testing and fixes (2-4 hours)
- **Total**: 22-34 hours of work across 4 days

### Sequential Execution (Fallback):
- CODEX: 8-10 hours
- GEMINI: 10-14 hours
- CLAUDE: 8-12 hours
- Integration: 4-6 hours
- **Total**: 30-42 hours across 1 week

**Parallel is 30-40% faster!**

---

## Communication Protocol

### Daily Standups (Async)
Each AI updates status document:
- What was completed yesterday?
- What's being worked on today?
- Any blockers?

### Handoff Protocol
When work is complete:
1. Push all commits
2. Update status document
3. Tag next AI: "@[AI-name] ready for your track"
4. Document any dependencies or notes

### Blocker Escalation
If blocked:
1. Document blocker in status document
2. Tag human developer for help
3. Move to non-blocked work while waiting

---

## Emergency Protocols

### If AI Gets Stuck:
- Document what was attempted
- Commit work-in-progress to branch
- Request human review

### If Conflicts Arise:
- Claude handles merge conflicts (best reasoning)
- Gemini provides architectural guidance (full context)
- Codex regenerates conflicting code if needed

### If Timeline Slips:
- Prioritize critical path: CODEX → GEMINI security → CLAUDE critical tests
- Defer: Additional components, non-critical endpoints, coverage expansion

---

## Post-Completion Checklist

After all three tracks complete:

### Integration Testing:
- [ ] All tests passing (95%+ pass rate)
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] App builds successfully (iOS + Android)
- [ ] E2E tests passing

### Security Verification:
- [ ] No critical security issues
- [ ] GDPR compliance verified
- [ ] No hardcoded secrets
- [ ] All environment variables configured

### Documentation:
- [ ] All code documented (JSDoc)
- [ ] README updated
- [ ] API documentation complete
- [ ] Deployment guide updated

### Launch Readiness:
- [ ] Feature complete (100%)
- [ ] Test coverage 70%+
- [ ] Security audit passed
- [ ] Performance metrics acceptable
- [ ] Analytics/monitoring operational

---

**Created by**: Claude Sonnet 4.5
**Date**: February 4, 2026
**Project**: Anchor - Ritual Anchor Mobile App
**Launch**: February 20, 2026 (16 days)

**Let's ship this! 🚀**
