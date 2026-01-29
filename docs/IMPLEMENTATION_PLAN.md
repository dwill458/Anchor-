# Anchor v2.0 Implementation Plan

Generated: 2026-01-29
Target Launch: February 20, 2026
Estimated Timeline: 4-5 weeks

## Executive Summary

This plan addresses the following task groups from your issue list:
- **Foundation**: Supabase setup, backend route fixes, domain configuration
- **UI/UX**: Capitalization fixes, category UI, map URLs, layout fixes
- **New Features**: "Nudge" notification system, supporting experiences
- **Code Quality**: Cleanup, testing, integrations
- **Pre-Launch**: QA, documentation

**Total Estimated Effort**: 28-35 developer days

---

## Phase 1: Foundation & Infrastructure (Week 1) - CRITICAL PATH
**Priority: P0 - Blockers for other work**
**Estimated Effort: 3-5 days**

### 1.1 Supabase Configuration & Setup
**Complexity: Medium** | **Dependencies: None** | **Impact: High**

**Tasks:**
- Verify Supabase project configuration and connection strings
- Audit database migrations for completeness
- Set up row-level security (RLS) policies for all tables
- Configure Supabase storage buckets for image/audio assets
- Set up Supabase auth integration with Firebase (if dual auth needed)
- Create backup and restore procedures
- Document connection pooling and performance settings

**Files to Modify:**
- `/backend/.env` - Update DATABASE_URL
- `/backend/prisma/schema.prisma` - Verify datasource config
- `/backend/src/config/database.ts` - Add connection pooling
- New: `/backend/docs/SUPABASE_SETUP.md` - Documentation

**Acceptance Criteria:**
- Database migrations run successfully
- All CRUD operations work with Supabase
- RLS policies enforced for user data isolation
- Storage buckets accessible from backend

### 1.2 Backend Route Fixes & Standardization
**Complexity: Medium** | **Dependencies: 1.1** | **Impact: High**

**Tasks:**
- Audit all backend routes for consistency (naming, response format, error handling)
- Fix `/api/anchors` endpoint inconsistencies
- Fix `/api/ai/enhance-controlnet` parameter validation
- Standardize error response format across all routes
- Add request validation middleware using Zod or Joi
- Add rate limiting to prevent abuse
- Add API versioning (v1 prefix)

**Routes to Fix:**
- `POST /api/anchors` - Add category validation
- `PUT /api/anchors/:id` - Fix partial update logic
- `POST /api/anchors/:id/charge` - Add validation for charge types
- `POST /api/ai/enhance-controlnet` - Fix provider selection logic
- `POST /api/ai/mantra/audio` - Add voice preset validation

**Files to Modify:**
- `/backend/src/api/routes/anchors.ts`
- `/backend/src/api/routes/ai.ts`
- `/backend/src/api/routes/auth.ts`
- New: `/backend/src/api/middleware/validation.ts`
- New: `/backend/src/api/middleware/rateLimiter.ts`

### 1.3 Domain Name & Deployment Setup
**Complexity: Low** | **Dependencies: 1.1** | **Impact: Medium**

**Tasks:**
- Register or configure production domain
- Set up DNS records (A, CNAME, TXT for verification)
- Configure SSL certificates (Let's Encrypt or Cloudflare)
- Set up backend API subdomain (api.yourdomain.com)
- Configure CORS for production domain
- Set up environment-specific configs (dev, staging, prod)
- Update mobile app API endpoints for production

**Files to Modify:**
- `/backend/src/config/cors.ts` - Add production domain
- `/apps/mobile/.env.production` - Production API URL
- `/apps/mobile/src/config/api.ts` - Environment-based URLs
- New: `/docs/DEPLOYMENT_GUIDE.md`

---

## Phase 2: UI/UX Enhancements (Week 1-2) - HIGH PRIORITY
**Priority: P1 - User-facing issues**
**Estimated Effort: 5-7 days**

### 2.1 Capitalization & Text Fixes
**Complexity: Low** | **Dependencies: None** | **Impact: Medium**

**Tasks:**
- Audit all screen titles, button labels, and copy for capitalization consistency
- Fix "Anchor" vs "anchor" inconsistencies
- Fix category names capitalization ("career" → "Career", etc.)
- Ensure consistent sentence case for body text
- Fix placeholder text capitalization
- Update toast notifications for proper capitalization

**Screens to Update:**
- `/apps/mobile/src/screens/create/IntentionInputScreen.tsx`
- `/apps/mobile/src/screens/create/StructureForgeScreen.tsx`
- `/apps/mobile/src/screens/vault/VaultScreen.tsx`
- `/apps/mobile/src/screens/vault/AnchorDetailScreen.tsx`
- `/apps/mobile/src/components/cards/AnchorCard.tsx`
- `/apps/mobile/src/components/common/BottomDock.tsx`

**Pattern to Follow:**
- Screen titles: Title Case ("Create Anchor")
- Button labels: Title Case ("Continue", "Save Anchor")
- Body text: Sentence case ("You can refine or release this later.")
- Category labels: Title Case ("Personal Growth", "Career")

### 2.2 Category UI Improvements
**Complexity: Medium** | **Dependencies: None** | **Impact: High**

**Tasks:**
- Create dedicated category selection screen (currently hardcoded to 'personal_growth')
- Design category selector UI with icons and descriptions
- Add category filtering to Vault screen
- Update category badges/pills in AnchorCard component
- Add category statistics to profile screen
- Implement category-based color coding (optional)

**New Components:**
- `/apps/mobile/src/components/CategorySelector.tsx` - Grid or list selector
- `/apps/mobile/src/components/CategoryBadge.tsx` - Reusable badge

**Files to Modify:**
- `/apps/mobile/src/screens/create/IntentionInputScreen.tsx` - Add category selection
- `/apps/mobile/src/screens/vault/VaultScreen.tsx` - Add category filter
- `/apps/mobile/src/components/cards/AnchorCard.tsx` - Show category badge
- `/apps/mobile/src/types/index.ts` - Add category metadata type

**Categories to Display:**
- Career (briefcase icon)
- Health (heart icon)
- Wealth (dollar sign icon)
- Relationships (people icon)
- Personal Growth (plant icon)
- Custom (star icon)

### 2.3 Map URL & External Link Implementation
**Complexity: Low** | **Dependencies: None** | **Impact: Low**

**Tasks:**
- Add deep linking support for map URLs
- Implement external link handler (opens in browser or in-app)
- Add "Share Anchor" functionality with deep links
- Create QR code generation for anchor sharing (optional)
- Add proper URL validation

**Files to Modify:**
- `/apps/mobile/app.json` - Add deep link scheme
- New: `/apps/mobile/src/utils/deepLinking.ts`
- `/apps/mobile/src/screens/vault/AnchorDetailScreen.tsx` - Add share button
- New: `/apps/mobile/src/components/ShareAnchorModal.tsx`

### 2.4 Positioning & Layout Fixes
**Complexity: Low** | **Dependencies: None** | **Impact: Medium**

**Tasks:**
- Fix "important place/bullet positioning issues" (need specific details)
- Audit all screens for layout consistency
- Fix spacing issues in lists and grids
- Ensure proper SafeAreaView usage on all screens
- Fix keyboard avoiding behavior
- Test on different screen sizes (iPhone SE, iPhone 14 Pro Max, iPad)

**Common Issues to Fix:**
- Bullet points alignment in lists
- Bottom dock positioning over content
- FAB (Floating Action Button) positioning
- Toast notification positioning
- Modal centering and keyboard behavior

---

## Phase 3: New Features (Week 2-3) - MEDIUM PRIORITY
**Priority: P2 - Enhances user experience**
**Estimated Effort: 7-10 days**

### 3.1 "Nudge" Feature Implementation
**Complexity: High** | **Dependencies: 1.1, 1.2** | **Impact: High**

**Context:** A "nudge" feature for sigil/habit tracking apps typically includes:
- Daily reminders to activate anchors
- Push notifications for inactive anchors
- Streak tracking and encouragement
- "Don't break the chain" motivation

**Tasks:**
- Define nudge business logic (frequency, conditions, personalization)
- Set up push notification infrastructure (Expo Notifications)
- Create notification permission flow
- Implement notification scheduling service
- Add notification preferences to user settings
- Create backend endpoint for notification management
- Design nudge notification UI/copy
- Add notification badges to app icon
- Track notification engagement analytics

**Database Changes:**
- Add `Notification` model to Prisma schema
- Add `notificationPreferences` to User model
- Add `lastNudgedAt` to Anchor model

**New Files:**
- `/backend/src/services/NotificationService.ts` - Notification logic
- `/backend/src/api/routes/notifications.ts` - Notification endpoints
- `/apps/mobile/src/services/PushNotificationService.ts` - Client service
- `/apps/mobile/src/screens/profile/NotificationSettingsScreen.tsx`
- `/apps/mobile/src/utils/notificationScheduler.ts`

**Files to Modify:**
- `/backend/prisma/schema.prisma` - Add Notification model
- `/apps/mobile/src/navigation/MainTabNavigator.tsx` - Badge count
- `/apps/mobile/src/screens/profile/ProfileScreen.tsx` - Settings link

**Nudge Types:**
1. **Daily Reminder**: "Good morning! Ready to activate your anchors?"
2. **Inactive Anchor**: "Your 'Stay Focused' anchor hasn't been activated in 3 days"
3. **Streak Protection**: "You're on a 7-day streak! Don't break the chain"
4. **Milestone**: "You've activated 50 times! Keep going"
5. **Custom Time**: User sets specific reminder times

### 3.2 Supporting Experiences
**Complexity: Medium** | **Dependencies: None** | **Impact: Medium**

**Context:** Assuming "supporting experiences" means:
- Onboarding tooltips/coach marks
- Empty states with helpful guidance
- Error state illustrations
- Loading state improvements
- Celebration/success animations

**Tasks:**
- Create empty state components for all list screens
- Add first-time user tooltips (react-native-walkthrough)
- Design and implement error state illustrations
- Add success animations for key actions (Lottie)
- Create loading skeletons for all async operations
- Add haptic feedback for important actions
- Implement pull-to-refresh everywhere

**New Components:**
- `/apps/mobile/src/components/EmptyState.tsx`
- `/apps/mobile/src/components/ErrorState.tsx`
- `/apps/mobile/src/components/Tooltip.tsx`
- `/apps/mobile/src/components/SuccessAnimation.tsx`

**Screens to Enhance:**
- Vault screen - Empty state for no anchors
- Discover screen - Empty state for no content
- Profile screen - Tooltips for first-time users
- All creation screens - Better error handling

---

## Phase 4: Code Quality & Testing (Week 3-4) - HIGH PRIORITY
**Priority: P1 - Pre-launch requirement**
**Estimated Effort: 7-10 days**

### 4.1 Code Cleanup & Refactoring
**Complexity: Medium** | **Dependencies: None** | **Impact: High**

**Tasks:**
- Remove TODO comments (implement or document)
- Remove deprecated code and legacy routes
- Consolidate duplicate logic into utilities
- Extract magic numbers to constants
- Add JSDoc comments to all public functions
- Run ESLint and fix all warnings
- Run Prettier and standardize formatting
- Remove unused imports and dead code
- Optimize bundle size (analyze with expo-bundle-visualizer)

**Files to Focus On:**
- `/apps/mobile/src/services/StorageService.ts` - Implement TODOs
- `/apps/mobile/src/services/AnalyticsService.ts` - Remove TODO placeholders
- `/apps/mobile/src/services/ErrorTrackingService.ts` - Implement Sentry
- `/backend/src/services/AIEnhancer.ts` - Remove legacy code comments
- All screens - Remove console.log statements

### 4.2 Backend Unit Tests
**Complexity: High** | **Dependencies: 1.2** | **Impact: High**

**Tasks:**
- Set up Jest for backend testing
- Write unit tests for all services
- Write integration tests for API routes
- Write database seed scripts for testing
- Add test coverage reporting
- Set up CI/CD test automation
- Target: 70% coverage on backend

**Test Files to Create:**
- `/backend/src/services/__tests__/AIEnhancer.test.ts`
- `/backend/src/services/__tests__/MantraGenerator.test.ts`
- `/backend/src/services/__tests__/GeminiImageService.test.ts`
- `/backend/src/api/routes/__tests__/anchors.test.ts`
- `/backend/src/api/routes/__tests__/ai.test.ts`
- `/backend/src/utils/__tests__/structureMatching.test.ts`

### 4.3 End-to-End Flow Testing
**Complexity: High** | **Dependencies: 4.1, 4.2** | **Impact: High**

**Tasks:**
- Set up Detox for E2E testing (or Maestro)
- Write E2E tests for complete anchor creation flow
- Write E2E tests for charging and activation flow
- Test all navigation paths
- Test error scenarios (network failure, API errors)
- Test edge cases (empty states, max values)
- Test on iOS and Android
- Performance testing (FPS, memory, bundle size)

**E2E Test Scenarios:**
1. Complete first-time user flow (onboarding → create → charge → activate)
2. Returning user creates second anchor
3. User chooses different structure variants
4. User skips AI enhancement
5. User applies AI enhancement with different styles
6. User activates anchor multiple times
7. Network failure during image generation
8. User archives an anchor

### 4.4 Third-Party Integration Setup
**Complexity: Medium** | **Dependencies: 1.3** | **Impact: High**

**Tasks:**
- Set up Mixpanel or Amplitude for analytics
- Integrate Sentry for error tracking
- Configure Firebase Performance monitoring
- Set up Google Cloud TTS API
- Verify Cloudflare R2 storage
- Test all integrations in staging environment
- Create monitoring dashboards

**Files to Update:**
- `/backend/.env` - Add all API keys
- `/apps/mobile/.env` - Add client-side keys
- `/apps/mobile/src/services/AnalyticsService.ts` - Remove TODOs, add Mixpanel
- `/apps/mobile/src/services/ErrorTrackingService.ts` - Add Sentry SDK
- `/apps/mobile/src/services/PerformanceMonitoring.tsx` - Add Firebase Performance

---

## Phase 5: Pre-Launch Polish (Week 4) - CRITICAL PATH
**Priority: P0 - Launch blocker**
**Estimated Effort: 5-7 days**

### 5.1 QA & Bug Bash
**Complexity: Medium** | **Dependencies: All previous phases** | **Impact: Critical**

**Tasks:**
- Create comprehensive QA checklist
- Manual testing on all supported devices
- Test all user flows end-to-end
- Test all edge cases and error scenarios
- Performance testing (load time, FPS, memory)
- Accessibility testing (VoiceOver, TalkBack)
- Security audit (API endpoints, authentication)
- Fix all P0 and P1 bugs

### 5.2 Documentation & Handoff
**Complexity: Low** | **Dependencies: All previous phases** | **Impact: Medium**

**Tasks:**
- Update README with latest features
- Document all API endpoints
- Create deployment runbook
- Write user guide / help center content
- Create troubleshooting guide
- Document monitoring and alerting
- Create incident response playbook

---

## Task Dependencies Graph

```
Phase 1: Foundation (P0)
├─ 1.1 Supabase Setup (No deps)
├─ 1.2 Backend Routes (Depends: 1.1)
└─ 1.3 Domain Setup (Depends: 1.1)

Phase 2: UI/UX (P1)
├─ 2.1 Capitalization (No deps) ║ Can run parallel
├─ 2.2 Category UI (No deps)    ║ Can run parallel
├─ 2.3 Map URLs (No deps)       ║ Can run parallel
└─ 2.4 Layout Fixes (No deps)   ║ Can run parallel

Phase 3: Features (P2)
├─ 3.1 Nudge Feature (Depends: 1.1, 1.2)
└─ 3.2 Supporting Experiences (No deps, can run parallel)

Phase 4: Quality (P1)
├─ 4.1 Code Cleanup (No deps)
├─ 4.2 Backend Tests (Depends: 1.2)
├─ 4.3 E2E Tests (Depends: 4.1, 4.2)
└─ 4.4 Integrations (Depends: 1.3)

Phase 5: Launch (P0)
├─ 5.1 QA (Depends: All phases)
└─ 5.2 Documentation (Depends: All phases)
```

---

## Recommended Implementation Order

### Sprint 1 (Week 1): Foundation
1. **Day 1-2**: Supabase setup and verification (1.1)
2. **Day 3-4**: Backend route fixes (1.2)
3. **Day 5**: Domain setup (1.3)
4. **Parallel**: Start capitalization fixes (2.1)

### Sprint 2 (Week 2): UI/UX + Features
1. **Day 1-2**: Category UI implementation (2.2)
2. **Day 2-3**: Map URLs and linking (2.3)
3. **Day 3-4**: Layout fixes (2.4)
4. **Day 4-5**: Begin Nudge feature (3.1)

### Sprint 3 (Week 3): Features + Quality
1. **Day 1-3**: Complete Nudge feature (3.1)
2. **Day 3-4**: Supporting experiences (3.2)
3. **Day 4-5**: Code cleanup (4.1)
4. **Parallel**: Start backend tests (4.2)

### Sprint 4 (Week 4): Testing + Polish
1. **Day 1-2**: Complete backend tests (4.2)
2. **Day 2-3**: Third-party integrations (4.4)
3. **Day 3-4**: E2E tests (4.3)
4. **Day 4-5**: QA and bug fixes (5.1)
5. **Day 5**: Documentation (5.2)

---

## Complexity Estimates

| Task Group | Complexity | Effort (days) | Risk Level |
|-----------|-----------|--------------|------------|
| Supabase Setup | Medium | 2-3 | Medium - DB migrations can be tricky |
| Backend Routes | Medium | 2-3 | Low - Well-understood patterns |
| Domain Setup | Low | 1 | Low - Standard process |
| Capitalization | Low | 1-2 | Low - Simple text changes |
| Category UI | Medium | 2-3 | Low - Standard UI work |
| Map URLs | Low | 1-2 | Low - Standard linking |
| Layout Fixes | Low | 1-2 | Low - CSS/styling |
| **Nudge Feature** | **High** | **4-5** | **High** - New feature, push notifications, backend |
| Supporting Experiences | Medium | 2-3 | Low - UI components |
| Code Cleanup | Medium | 2-3 | Medium - Can uncover issues |
| Backend Tests | High | 3-4 | Medium - Mocking, fixtures |
| E2E Tests | High | 3-4 | High - Infrastructure setup |
| Integrations | Medium | 2-3 | Medium - Third-party dependencies |
| QA | Medium | 3-4 | High - Will find issues |
| Documentation | Low | 1-2 | Low - Straightforward |

**Total Estimated Effort**: 28-35 days (4-5 weeks with 1 developer)

---

## Risk Assessment

### High-Risk Items
1. **Nudge Feature** - New backend infrastructure, push notifications, complex logic
2. **E2E Testing** - New framework, time-consuming, may uncover major issues
3. **Third-Party Integrations** - External dependencies, API key availability
4. **Supabase Migration** - Database changes can be risky

### Mitigation Strategies
1. **Nudge**: Break into smaller tasks, implement basic version first, iterate
2. **E2E**: Start with smoke tests, expand coverage gradually
3. **Integrations**: Use mock services during development, integrate late
4. **Supabase**: Test migrations in dev environment first, create rollback scripts

---

## Architectural Trade-offs

### Decision 1: Nudge Implementation Approach
- **Option A**: Server-side scheduling (cron jobs, queue system)
  - Pros: Centralized, reliable, can send to multiple users
  - Cons: More backend complexity, requires job queue
- **Option B**: Client-side scheduling (local notifications)
  - Pros: Simpler, works offline, no backend changes
  - Cons: Unreliable if app closed, limited personalization
- **Recommendation**: **Hybrid approach** - Server triggers events, client schedules local notifications

### Decision 2: Category Selection UX
- **Option A**: Modal/overlay selector
  - Pros: Quick, doesn't interrupt flow
  - Cons: Limited space for descriptions
- **Option B**: Dedicated screen
  - Pros: More space, better education, guided experience
  - Cons: Adds extra step
- **Recommendation**: **Dedicated screen** - Aligns with app's zen, thoughtful UX philosophy

### Decision 3: Testing Strategy
- **Option A**: Full E2E coverage before launch
  - Pros: High confidence, catches integration issues
  - Cons: Time-consuming, may delay launch
- **Option B**: Critical path E2E, expand post-launch
  - Pros: Faster to launch, iterate based on usage
  - Cons: May miss edge cases
- **Recommendation**: **Critical path E2E** - Focus on onboarding → create → charge → activate flow

---

## Critical Files for Implementation

### Backend Critical Files
1. **`/backend/src/api/routes/anchors.ts`** - Core CRUD logic, needs route fixes and validation
2. **`/backend/src/api/routes/ai.ts`** - AI enhancement endpoints, needs parameter validation fixes
3. **`/backend/prisma/schema.prisma`** - Database schema, needs Notification model for nudge feature

### Frontend Critical Files
4. **`/apps/mobile/src/screens/create/IntentionInputScreen.tsx`** - Entry point for creation flow, needs category selection
5. **`/apps/mobile/src/screens/vault/VaultScreen.tsx`** - Main screen, needs category filtering and empty states

### Additional Key Files
- `/backend/src/services/NotificationService.ts` - New file for nudge feature (high complexity)
- `/apps/mobile/src/components/CategorySelector.tsx` - New component for category selection
- `/apps/mobile/src/navigation/VaultStackNavigator.tsx` - Add new screens to navigation
- `/backend/src/api/middleware/validation.ts` - New middleware for request validation
- `/apps/mobile/src/services/PushNotificationService.ts` - New service for nudge notifications

---

## Success Metrics

### Launch Readiness Checklist
- [ ] All P0 tasks complete (Foundation, QA, Integrations)
- [ ] All P1 tasks complete (UI/UX, Testing, Code Quality)
- [ ] Test coverage ≥ 70%
- [ ] All critical user flows E2E tested
- [ ] No P0 or P1 bugs in backlog
- [ ] Third-party services integrated and tested
- [ ] Documentation complete
- [ ] Performance benchmarks met (< 3s load time, 60fps)
- [ ] Accessibility compliance verified
- [ ] Security audit passed

---

## Next Steps

1. **Review this plan** with stakeholders and adjust priorities
2. **Set up project tracking** (GitHub Projects, Linear, or Jira)
3. **Begin Sprint 1** with Supabase setup
4. **Schedule daily standups** to track progress
5. **Plan weekly retrospectives** to adjust course as needed

This implementation plan provides a structured, dependency-aware approach to completing all tasks. The plan prioritizes infrastructure and critical path items first, then builds features and quality improvements systematically. With focused execution, this roadmap aligns with your February 20, 2026 launch target.
