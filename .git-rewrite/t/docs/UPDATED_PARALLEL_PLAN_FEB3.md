# Anchor - UPDATED Parallel Development Plan (Feb 3, 2026)
## Codebase Audit & Tonight's Session Plan

**Update Date**: February 3, 2026 (Monday Evening)
**Days to Launch**: 17 days (Feb 20, 2026)
**Overall Progress**: 65% Complete (Grade: C+)
**Status**: 🟡 **NOT READY** - Critical sprint needed on remaining 35%

---

## 🎯 Codebase Audit Summary (Feb 1-3)

### What's Changed Since Feb 1

**Recent Commits (Feb 1-3)**:
- ✅ **Settings Screens**: Audio & Haptics + Data & Privacy settings implemented
- ✅ **Visual Fixes**: Enhanced anchor image display on ChargeSetupScreen
- ✅ **SVG Fixes**: Converted HTML SVG elements to react-native-svg components
- ✅ **Stability**: Added param guards to BreathingAnimation and ChargeSetupScreen
- ✅ **Backend**: Null R2 client handling in audio upload path

**Progress Update**: 63% → **65%** (+2% in 2 days)

### 🚨 CRITICAL: P0 Bugs Status - ALL UNFIXED ❌

**BUG-001: Login hardcodes hasCompletedOnboarding** - ❌ **NOT FIXED**
- File: `apps/mobile/src/screens/auth/LoginScreen.tsx:73`
- Status: Still hardcoding `true` instead of loading from backend
- Impact: CRITICAL - New users skip onboarding, returning users forced through it
- Fix Time: 1 hour

**BUG-002: Account deletion not implemented** - ❌ **NOT FIXED**
- File: `apps/mobile/src/screens/profile/SettingsScreen.tsx:283-298`
- Status: Shows "Feature Coming Soon" alert
- Impact: CRITICAL LEGAL BLOCKER - GDPR/CCPA violation
- Fix Time: 2-3 hours

**BUG-003: Onboarding flag missing from schema** - ❌ **NOT FIXED**
- File: `backend/prisma/schema.prisma`
- Status: User model lacks `hasCompletedOnboarding` field
- Impact: CRITICAL - Enables BUG-001, multi-device inconsistency
- Fix Time: 1 hour

**Total P0 Fix Time**: 4-5 hours (MUST DO TONIGHT)

---

## 📊 Workstream Status Update

| Workstream | Feb 1 | Feb 3 | Change | Status |
|------------|-------|-------|--------|--------|
| 1. Backend Testing | 100% | 100% | - | ✅ COMPLETE (78.65% coverage) |
| 2. Frontend Testing | 48% | 48% | - | ⚠️ STALLED (33% coverage, 59 tests failing) |
| 3. Third-Party Integrations | 100%* | 100%* | - | ⚠️ CODE DONE (21 mobile TODOs remain) |
| 4. Performance Optimization | 0% | 0% | - | ❌ NOT STARTED (16-24 hours) |
| 5. E2E Testing & QA | 100% | 100% | - | ✅ COMPLETE (strategy documented) |
| 6. Security Audit | 0% | 0% | - | ❌ NOT STARTED (12-16 hours) |
| 7. UAT Planning | 0% | 0% | - | ❌ NOT STARTED (skip recommended) |
| 8. App Store Prep | 0% | 0% | - | ❌ NOT STARTED (11-16 hours) |

**Overall**: 63% → **65%** (+2%)

### Detailed Findings

**Workstream 2 (Frontend Testing)**:
- Status: STALLED - No progress in 2 days
- Issue: 59 failing tests not addressed
- Coverage: Still at 33% (target: 70%)
- Action: URGENT - Must allocate 18-24 hours this week

**Workstream 3 (Third-Party Integrations)**:
- Backend: ✅ 0 TODOs (COMPLETE)
- Mobile: ⚠️ 21 TODOs remaining in 4 files:
  - `ErrorTrackingService.ts` (7 TODOs)
  - `AnalyticsService.ts` (6 TODOs)
  - `PerformanceMonitoring.tsx` (6 TODOs)
  - `StorageService.ts` (2 TODOs)
- Action: Need 8-12 hours to implement real integrations

---

## 🔥 TONIGHT'S SESSION PLAN (Feb 3, 2026)

### Priority 1: FIX P0 BUGS (4-5 hours) - BLOCKING EVERYTHING

**Session Goal**: Fix all 3 P0 bugs tonight to unblock launch

#### Task 1.1: Fix BUG-003 First (Schema Change) - 1 hour
```bash
cd backend
# Edit prisma/schema.prisma - Add to User model:
# hasCompletedOnboarding Boolean @default(false)

npx prisma migrate dev --name add-onboarding-flag
npx prisma generate

# Update src/api/routes/auth.ts to return flag in user response
# Test with Postman/curl
```

**Why First**: Fixes the root cause that enables BUG-001

#### Task 1.2: Fix BUG-002 (Account Deletion) - 2-3 hours
```bash
# Backend: Create DELETE /api/auth/me endpoint
cd backend/src/api/routes/auth.ts

# Implement cascade deletes:
# 1. Delete all anchors (with charges, activations)
# 2. Delete burned anchors
# 3. Delete user settings
# 4. Delete orders
# 5. Delete sync queue entries
# 6. Delete user record
# 7. Return success response

# Frontend: Implement deletion handler
cd apps/mobile/src/screens/profile/SettingsScreen.tsx

# Replace lines 283-298 with real implementation:
# 1. Add password re-authentication modal
# 2. Call DELETE /api/auth/me
# 3. Clear local storage (AsyncStorage)
# 4. Reset auth store
# 5. Navigate to Login

# Test thoroughly:
# - Create test user
# - Create anchors
# - Delete account
# - Verify database cleanup (no orphaned records)
# - Verify cannot login with deleted credentials
```

**Why Second**: LEGAL BLOCKER - Cannot launch without GDPR compliance

#### Task 1.3: Fix BUG-001 (Login Onboarding Flag) - 30 min
```bash
cd apps/mobile/src/screens/auth/LoginScreen.tsx

# Line 73 (and 83, 96) - Replace:
# hasCompletedOnboarding: true  // WRONG

# With:
# hasCompletedOnboarding: response.data.hasCompletedOnboarding || false

# Test:
# 1. New user signup → Should see onboarding
# 2. Complete onboarding → Flag persists in backend
# 3. Login again → Should NOT see onboarding
# 4. Multi-device sync → Flag syncs correctly
```

**Why Last**: Depends on BUG-003 fix

---

### Priority 2: START FRONTEND TEST FIXES (2-3 hours)

**Session Goal**: Fix 20-30 of the 59 failing tests tonight

#### Task 2.1: Debug React Navigation Mocks (1.5 hours)
```bash
cd apps/mobile

# Review failing tests and identify navigation mock issues
# Common problems:
# 1. Inconsistent mock setup across files
# 2. navigation.navigate not properly mocked
# 3. navigation.goBack missing
# 4. useNavigation hook not mocked in setup.ts

# Fix approach:
# 1. Standardize navigation mock in __tests__/setup.ts
# 2. Update all test files to use consistent mock
# 3. Re-run tests, verify 20+ more passing

npm test
```

#### Task 2.2: Fix Async Timing Issues (1 hour)
```bash
# Common async issues:
# 1. Missing waitFor() for state updates
# 2. Missing act() for React state changes
# 3. Using getBy* instead of findBy* for async elements
# 4. Assertions running before promises resolve

# Fix approach:
# 1. Add waitFor() around assertions that depend on state
# 2. Wrap state changes in act()
# 3. Use findBy* queries for elements that appear async
# 4. Add proper async/await

# Target: 20+ more tests passing
# Goal for tonight: 167 passing → 200+ passing (90% pass rate)
```

---

### Priority 3 (IF TIME): Draft Privacy Policy (1 hour)

**Session Goal**: Create initial privacy policy draft (required for BUG-002)

```bash
cd docs
# Create PRIVACY_POLICY.md

# Sections to include:
# 1. Introduction
# 2. Data We Collect
#    - Email, displayName (required for account)
#    - Intentions, anchors, activation history (app features)
#    - Analytics events (opt-in, see AnalyticsService.ts)
#    - Error reports (opt-in, see ErrorTrackingService.ts)
# 3. How We Use Data
#    - Personalization (show your anchors)
#    - AI enhancement (send intentions to Gemini API)
#    - Analytics (understand usage patterns)
# 4. Third-Party Services
#    - Firebase (authentication)
#    - Google Cloud (TTS, Gemini AI, Imagen)
#    - Mixpanel (analytics, opt-in)
#    - Sentry (error tracking, opt-in)
#    - Cloudflare R2 (image storage)
#    - RevenueCat (subscriptions, future)
# 5. Your Rights
#    - Access your data (export anchors)
#    - Delete your account (implemented in BUG-002 fix)
#    - Opt-out of analytics
#    - Data portability
# 6. Data Retention
#    - Active accounts: Retained indefinitely
#    - Deleted accounts: Purged within 30 days
# 7. GDPR & CCPA Compliance
#    - We comply with GDPR (EU)
#    - We comply with CCPA (California)
# 8. Contact Information
#    - Support email: support@anchorapp.com (update)
#    - Privacy questions: privacy@anchorapp.com (update)
# 9. Updates to Policy
#    - Last updated: Feb 3, 2026
#    - Will notify of material changes

# Hosting:
# - Option 1: GitHub Pages (free, easy)
# - Option 2: Dedicated privacy.anchorapp.com
# - For tonight: Save as docs/PRIVACY_POLICY.md, host later
```

---

## 📅 UPDATED 17-DAY SPRINT TIMELINE

### This Week (Feb 3-7): P0 Bugs & Testing

**Monday Feb 3 (TODAY)** - 6-8 hours:
- ✅ Fix all 3 P0 bugs (4-5 hours) - TONIGHT
- ✅ Fix 20-30 failing frontend tests (2-3 hours) - TONIGHT
- ✅ Draft privacy policy (1 hour) - IF TIME

**Tuesday Feb 4** - 6-8 hours:
- Fix remaining 30+ failing frontend tests (4-5 hours)
- Get all 226 tests passing (100% pass rate)
- Start adding critical missing tests (2-3 hours)

**Wednesday Feb 5** - 6-8 hours:
- Add critical missing tests:
  - RitualScreen.test.tsx (10+ tests)
  - ActivationScreen.test.tsx (8+ tests)
  - ChargeSetupScreen.test.tsx (6+ tests)
- Target: 50% → 60% coverage

**Thursday Feb 6** - 6-8 hours:
- Continue adding missing tests:
  - AnchorDetailScreen.test.tsx (6+ tests)
  - AuthService.test.ts (20+ tests)
  - AnalyticsService.test.ts (10+ tests)
- Target: 60% → 70% coverage ✅

**Friday Feb 7** - 4-6 hours:
- Complete remaining tests
- Verify 70% coverage achieved
- Implement mobile third-party integrations (21 TODOs)

**Week 1 End Target**:
- ✅ All P0 bugs fixed
- ✅ All 226 tests passing
- ✅ 70% frontend coverage
- ✅ Privacy policy drafted

---

### Week 2 (Feb 8-14): Security, Performance, Assets

**Saturday-Sunday Feb 8-9** - 12-16 hours:
- **Security Audit** (Full focus, 12-16 hours):
  - Finalize privacy policy (2 hours)
  - Implement rate limiting (2 hours)
  - Input validation audit (3 hours)
  - Dependency security (npm audit fixes) (2 hours)
  - Security review (auth, tokens, CORS, logs) (3 hours)
  - Documentation (2 hours)

**Monday-Tuesday Feb 10-11** - 12-16 hours:
- **Performance Optimization Phase 1** (12-16 hours):
  - Profile baselines (4-6 hours)
  - Image loading optimization (3-4 hours)
  - SVG rendering optimization (2-3 hours)
  - Animation optimization (2-3 hours)

**Wednesday-Thursday Feb 12-13** - 12-16 hours:
- **Performance Optimization Phase 2** (6-8 hours):
  - Memory profiling and optimization (3-4 hours)
  - Bundle size reduction (2-3 hours)
  - Test on low-end devices (2-3 hours)
- **App Store Assets Phase 1** (6-8 hours):
  - Create iOS screenshots (4-5 hours)
  - Create Android screenshots (2-3 hours)

**Friday Feb 14** - 6-8 hours:
- **App Store Assets Phase 2** (6-8 hours):
  - Design app icons (2-3 hours)
  - Write app store copy (3-4 hours)
  - Create feature graphic (1 hour)

**Week 2 End Target**:
- ✅ Security audit complete, privacy policy published
- ✅ Performance targets met (<2s images, 60fps, <200MB, <30MB)
- ✅ All app store assets ready
- ✅ Ready for submission

---

### Week 3 (Feb 15-20): Submit & Launch

**Saturday Feb 15** - 2-3 hours:
- **iOS Submission**:
  - Upload to App Store Connect
  - Fill out all forms
  - Submit for review

**Sunday Feb 16** - 2-3 hours:
- **Android Submission**:
  - Upload to Google Play Console
  - Fill out all forms
  - Submit for review

**Monday-Wednesday Feb 17-19**:
- **Monitor Review Status**:
  - Check status every 4 hours
  - Respond to feedback within 24 hours
  - Fix rejections immediately
  - Resubmit if needed

**Thursday Feb 20** - 🚀 **LAUNCH DAY**:
- Apps go live (if approved)
- Monitor crash rates (target: <1%)
- Monitor analytics
- Respond to user feedback
- Celebrate! 🎉

---

## ✅ SUCCESS CRITERIA

### Tonight's Session (Feb 3)
- ✅ BUG-001 fixed and tested
- ✅ BUG-002 fixed and tested (account deletion working)
- ✅ BUG-003 fixed and tested (schema migration applied)
- ✅ 20-30 failing tests fixed (200+ tests passing)
- ✅ Privacy policy drafted (initial version)

### This Week (Feb 3-7)
- ✅ All 226 tests passing (100% pass rate)
- ✅ Frontend coverage ≥70%
- ✅ All mobile TODOs implemented (21 TODOs → 0)
- ✅ Privacy policy finalized

### Week 2 (Feb 8-14)
- ✅ Security audit passed
- ✅ npm audit clean (0 high/critical)
- ✅ Performance targets met
- ✅ All app store assets created

### Week 3 (Feb 15-20)
- ✅ iOS submitted by Feb 15
- ✅ Android submitted by Feb 16
- ✅ Apps approved and live by Feb 20

---

## 💰 REMAINING EFFORT BREAKDOWN

| Priority | Task | Hours | Deadline |
|----------|------|-------|----------|
| P0 | Fix 3 P0 bugs | 4-5 | Feb 3 (TONIGHT) |
| P0 | Fix 59 failing tests | 6-8 | Feb 4 |
| P0 | Add critical missing tests | 12-16 | Feb 6 |
| P0 | Implement mobile integrations | 8-12 | Feb 7 |
| P0 | Security audit + GDPR | 12-16 | Feb 9 |
| P0 | Performance optimization | 16-24 | Feb 11 |
| P0 | App store assets | 11-16 | Feb 14 |
| P0 | Submission | 4-6 | Feb 16 |
| **TOTAL** | **74-103 hours** | **17 days** | **Feb 20** |

**Daily Hours Needed**: 4.4-6.1 hours/day
**Feasibility**: ✅ **ACHIEVABLE** with consistent daily effort

---

## 🚨 RISKS & MITIGATION

### Critical Risks

**1. P0 Bugs Not Fixed Tonight**
- Risk: Delays entire pipeline (bugs block testing, security, launch)
- Mitigation: MUST allocate 4-5 hours tonight, no excuses
- Contingency: If can't finish tonight, Friday is absolute deadline

**2. Test Failures Indicate Deeper Issues**
- Risk: 59 failures may reveal architectural problems
- Mitigation: Debug thoroughly, identify patterns
- Contingency: Accept 60% coverage if 70% unachievable

**3. Account Deletion Implementation Complex**
- Risk: Cascade deletes may have edge cases, data integrity issues
- Mitigation: Test exhaustively with multiple scenarios
- Contingency: Add soft delete flag as backup, hard delete in background job

### Medium Risks

**4. Time Constraint (17 Days)**
- Risk: 74-103 hours in 17 days requires 4-6 hours/day
- Mitigation: Work consistently, prioritize ruthlessly
- Contingency: Push launch to Feb 27 (+1 week)

**5. App Store Rejection**
- Risk: First-time submission, complex app
- Mitigation: Submit by Feb 15-16 (5-day buffer)
- Contingency: Rapid fixes (<24 hours), resubmit

---

## 🎯 IMMEDIATE NEXT STEPS

### Start NOW (Tonight, Feb 3)

1. **Create feature branch** (if not exists):
```bash
git checkout -b claude/p0-bug-fixes-feb3
```

2. **Fix BUG-003** (1 hour):
```bash
cd backend
# Edit prisma/schema.prisma
# Add hasCompletedOnboarding field to User model
npx prisma migrate dev --name add-onboarding-flag
npx prisma generate
# Update auth routes to return flag
# Test with curl/Postman
```

3. **Fix BUG-002** (2-3 hours):
```bash
# Backend: Implement DELETE /api/auth/me
cd backend/src/api/routes/auth.ts
# Add endpoint with cascade deletes

# Frontend: Implement deletion handler
cd apps/mobile/src/screens/profile/SettingsScreen.tsx
# Replace stub with real implementation
# Test thoroughly
```

4. **Fix BUG-001** (30 min):
```bash
cd apps/mobile/src/screens/auth/LoginScreen.tsx
# Update lines 73, 83, 96 to use backend flag
# Test new user flow and returning user flow
```

5. **Start test fixes** (2-3 hours):
```bash
cd apps/mobile
# Fix navigation mocks
# Fix async timing issues
# Target: 20-30 more tests passing
npm test
```

6. **Commit and push**:
```bash
git add .
git commit -m "fix: resolve P0 bugs (BUG-001, BUG-002, BUG-003) and fix 20+ failing tests

- feat(backend): add hasCompletedOnboarding field to User schema
- feat(backend): implement DELETE /api/auth/me endpoint with cascade deletes
- feat(mobile): implement account deletion in SettingsScreen
- fix(mobile): load hasCompletedOnboarding from backend instead of hardcoding
- fix(mobile): resolve navigation mock issues in tests
- fix(mobile): resolve async timing issues in tests

Tests: 167 passing → 200+ passing
P0 Bugs Fixed: 3/3
GDPR Compliance: ✅ Account deletion implemented

https://claude.ai/code/session_<SESSION_ID>"

git push -u origin claude/p0-bug-fixes-feb3
```

---

## 📞 SUPPORT & COORDINATION

### Documentation References
- **P0 Bugs**: `/docs/testing/BUG_REPORT.md`
- **E2E Strategy**: `/docs/testing/E2E_TESTING_STRATEGY.md`
- **Testing Guide**: `/apps/mobile/TESTING.md`
- **Progress Report**: `/docs/FEB1_PROGRESS_REPORT.md`
- **Original Plan**: `/docs/PARALLEL_DEVELOPMENT_PLAN.md`

### Escalation
- Create GitHub Issue with label `blocker` for any P0 blockers
- Tag: @dwill458 for product owner decisions
- Response time: <24 hours

---

## 🚀 LAUNCH COUNTDOWN

**Days Remaining**: 17
**Hours Remaining**: 74-103 hours
**Progress**: 65% → Target: 100%
**Remaining**: 35%

**Today is Day 1 of the final sprint. Let's fix those P0 bugs and ship Anchor! 💪**

---

**Report Compiled By**: Claude Sonnet 4.5
**Date**: February 3, 2026, 11:45 PM UTC
**Branch**: claude/audit-codebase-plan-2nlEx
**Session ID**: 2nlEx

---

## 🎯 FINAL RECOMMENDATION

**Can We Launch Feb 20?**

**Answer**: ✅ **YES - If we fix P0 bugs TONIGHT**

**Requirements**:
1. ✅ Fix all 3 P0 bugs tonight (4-5 hours) - NON-NEGOTIABLE
2. ✅ Fix failing tests by Thursday (6-8 hours)
3. ✅ Work 4-6 hours/day consistently for 17 days
4. ✅ Submit to stores by Feb 15-16 (firm deadline)
5. ✅ Accept some rough edges (defer P1/P2 bugs to post-launch)

**Critical Path**: P0 Bugs (Feb 3) → Testing (Feb 4-7) → Security (Feb 8-9) → Performance (Feb 10-11) → Assets (Feb 12-14) → Submit (Feb 15-16) → Launch (Feb 20)

**The next 4-5 hours are the most critical of the entire sprint. Fix those P0 bugs tonight! 🔥**
