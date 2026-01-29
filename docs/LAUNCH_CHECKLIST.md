# Launch Checklist - Quick Reference
## Feb 20, 2026 Launch Target

Use this checklist to track daily progress toward launch. See `LAUNCH_SPRINT_PLAN.md` for detailed tasks.

---

## Week 1: Testing Blitz (Jan 29 - Feb 4) 🧪

### Backend Testing (60+ tests)
- [ ] AIEnhancer.ts tests (15 tests)
- [ ] MantraGenerator.ts tests (12 tests)
- [ ] AuthService.ts tests (10 tests)
- [ ] StorageService.ts tests (8 tests)
- [ ] Anchor API routes tests (8 tests)
- [ ] AI API routes tests (7 tests)
- [ ] Auth API routes tests (5 tests)
- [ ] SVG rasterizer tests (5 tests)
- [ ] All backend tests passing
- [ ] Backend test coverage ≥70%

### Frontend Testing (52 new tests)
- [ ] IntentionInputScreen tests (5 tests)
- [ ] StructureForgeScreen tests (6 tests)
- [ ] ManualReinforcementScreen tests (8 tests)
- [ ] EnhancementChoiceScreen tests (5 tests)
- [ ] StyleSelectionScreen tests (4 tests)
- [ ] MantraCreationScreen tests (6 tests)
- [ ] ChargeSetupScreen tests (5 tests)
- [ ] RitualScreen tests (10 tests)
- [ ] VaultScreen tests (6 tests)
- [ ] AnchorDetailScreen tests (6 tests)
- [ ] Navigation helpers tests (3 tests)
- [ ] SVG utils tests (5 tests)
- [ ] All frontend tests passing
- [ ] Frontend test coverage ≥70%

### End-to-End Testing
- [ ] Complete creation flow (no AI) tested
- [ ] Complete creation flow (with AI) tested
- [ ] Charge existing anchor flow tested
- [ ] Activation flow tested
- [ ] Network failure during AI tested
- [ ] Backend timeout during charge tested
- [ ] Navigation interruption tested
- [ ] Invalid SVG data handling tested
- [ ] Offline mode tested
- [ ] Bug list created from E2E testing

### CI/CD
- [ ] Test pipeline configured
- [ ] Tests run on every commit
- [ ] Coverage reports generated

---

## Week 2: Integration & Performance (Feb 5-11) 🔌

### Third-Party Integrations
- [ ] Mixpanel/Amplitude account created
- [ ] Analytics API key in .env
- [ ] AnalyticsService.ts TODOs replaced (6 TODOs)
- [ ] Analytics tested in dashboard
- [ ] Sentry account created
- [ ] Sentry DSN in .env
- [ ] ErrorTrackingService.ts TODOs replaced (7 TODOs)
- [ ] Error tracking tested in dashboard
- [ ] Firebase Performance account created
- [ ] Firebase config in .env
- [ ] PerformanceMonitoring.tsx TODOs replaced (6 TODOs)
- [ ] Performance tracking tested in dashboard
- [ ] StorageService.ts TODOs replaced (2 TODOs)
- [ ] R2 storage tested

### Documentation
- [ ] apps/mobile/.env.example updated
- [ ] backend/.env.example updated
- [ ] docs/ENVIRONMENT_SETUP.md created
- [ ] Environment setup guide complete
- [ ] Main README updated with setup link

### Performance Optimization
- [ ] Image loading profiled
- [ ] Progressive loading implemented
- [ ] Image caching implemented
- [ ] Image load time <2s on 3G
- [ ] SVG rendering profiled
- [ ] SVG paths optimized
- [ ] 60fps render on mid-range devices
- [ ] Animation frame rates profiled
- [ ] Animations optimized
- [ ] 60fps animations achieved
- [ ] Memory usage profiled
- [ ] Memory leaks fixed
- [ ] Peak memory <200MB
- [ ] Bundle size analyzed
- [ ] Unused dependencies removed
- [ ] Bundle size <30MB

---

## Week 3: Pre-Launch Polish (Feb 12-19) ✨

### User Acceptance Testing
- [ ] 5-10 UAT participants recruited
- [ ] First-time user flow tested
- [ ] Power user flow tested
- [ ] Edge cases tested
- [ ] Screen recordings collected
- [ ] Post-test surveys completed
- [ ] Bug reports collected
- [ ] Bugs triaged (P0/P1/P2)

### Bug Fixes
- [ ] All P0 blocker bugs fixed
- [ ] 80%+ P1 high bugs fixed
- [ ] Regression tests updated
- [ ] All bug fixes tested

### App Store Preparation - iOS
- [ ] Apple Developer account configured
- [ ] App signing certificates configured
- [ ] App Store listing created
- [ ] App name: "Anchor - Intention Sigils"
- [ ] Description written (500 words)
- [ ] Keywords added (100 chars)
- [ ] Screenshots taken (6.5" + 12.9")
- [ ] App icon uploaded (1024x1024)
- [ ] Privacy policy URL added
- [ ] Support URL added
- [ ] Production IPA built
- [ ] IPA uploaded to App Store Connect
- [ ] Submitted for review (by Feb 15)

### App Store Preparation - Android
- [ ] Google Play Developer account configured
- [ ] Google Play listing created
- [ ] Short description written (80 chars)
- [ ] Full description written (4000 chars)
- [ ] Screenshots taken (Phone + Tablet)
- [ ] Feature graphic created (1024x500)
- [ ] App icon uploaded (512x512)
- [ ] Privacy policy URL added
- [ ] Production APK/AAB built
- [ ] APK uploaded to Google Play Console
- [ ] Submitted for review (by Feb 16)

### Security Audit
- [ ] Firebase auth flow audited
- [ ] Token validation verified
- [ ] Rate limiting tested
- [ ] User input validation verified
- [ ] File upload validation checked
- [ ] No API keys in code
- [ ] All secrets in .env
- [ ] HTTPS on all API calls
- [ ] Privacy policy updated
- [ ] GDPR compliance verified
- [ ] npm audit run, vulnerabilities fixed
- [ ] Security audit report created

### Final Production Testing - iOS
- [ ] Release IPA built
- [ ] Tested on real device
- [ ] All features verified
- [ ] Bundle size checked
- [ ] Tested on iOS 15, 16, 17, 18
- [ ] Tested on iPhone 8, 12, 15
- [ ] Analytics events verified
- [ ] Error tracking verified
- [ ] No console warnings/errors

### Final Production Testing - Android
- [ ] Release APK/AAB built
- [ ] Tested on real device
- [ ] All features verified
- [ ] Bundle size checked
- [ ] Tested on Android 11, 12, 13, 14
- [ ] Tested on Galaxy A52
- [ ] Analytics events verified
- [ ] Error tracking verified
- [ ] No console warnings/errors

### Cross-Platform Testing
- [ ] SVG rendering matches across platforms
- [ ] Colors match design system
- [ ] Haptic feedback works
- [ ] Audio playback works
- [ ] Deep linking works (if applicable)

---

## Launch Day: Feb 20, 2026 🚀

### Pre-Launch (Feb 19)
- [ ] All tests passing (frontend + backend)
- [ ] Production builds deployed to staging
- [ ] Analytics dashboards configured
- [ ] Error tracking dashboards configured
- [ ] Monitoring alerts set up
- [ ] Support email configured
- [ ] Social media posts scheduled
- [ ] Press kit ready (if applicable)
- [ ] Team briefed on launch plan

### Launch Morning (9am-12pm)
- [ ] Final smoke test on staging
- [ ] iOS app released from "Pending Release"
- [ ] Android app released from "Pending Release"
- [ ] App store availability verified
- [ ] Launch announcement posted

### Launch Afternoon (12pm-5pm)
- [ ] Analytics monitored (downloads, signups)
- [ ] Error rates monitored in Sentry
- [ ] User feedback collected
- [ ] Critical bugs addressed (hotfix if needed)

### Launch Evening (5pm-9pm)
- [ ] Launch metrics reviewed
- [ ] Celebration! 🎉
- [ ] Post-launch improvements planned

---

## Success Metrics

### Week 1 Targets
- ✅ 60+ backend tests
- ✅ 100+ frontend tests
- ✅ 70% test coverage
- ✅ 10 E2E flows tested

### Week 2 Targets
- ✅ 27 TODOs resolved
- ✅ All integrations live
- ✅ Performance targets met
- ✅ Setup guide complete

### Week 3 Targets
- ✅ UAT with 5-10 users
- ✅ All P0 bugs fixed
- ✅ App Store submissions approved
- ✅ Security audit passed

### Launch Day Targets
- ✅ 100+ downloads (Day 1)
- ✅ 50+ active users (Day 1)
- ✅ ≥60% completion rate
- ✅ <1% crash rate
- ✅ ≥4.0 star rating

---

**Progress Tracking:**
- Update this checklist daily
- Mark items complete with ✅
- Escalate blockers immediately
- Adjust timeline if needed

**Days Remaining:** 22 days (as of Jan 29)

**Let's ship this! 🚀**
