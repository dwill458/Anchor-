# Anchor App - Regression Test Checklist

**Purpose:** Pre-release validation to ensure core functionality works across all critical flows
**When to Run:** Before every release (production, beta, staging deployment)
**Estimated Time:** 45-60 minutes for full checklist

---

## Instructions

1. **Environment:** Use both iOS and Android devices/simulators
2. **Test Data:** Create fresh test account for each run
3. **Mark Results:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⏭️ Skipped
4. **Document Failures:** Note bug ID or create new bug report for any failures
5. **Sign-off:** QA lead must approve before release

---

## Pre-Test Setup

### Environment Preparation
- [ ] Backend server running and accessible
- [ ] Database seeded with test data (optional)
- [ ] Mobile app built (latest version)
- [ ] iOS simulator/device ready
- [ ] Android simulator/device ready
- [ ] Network connectivity confirmed

### Test Accounts
Create these accounts before starting:
- [ ] New user account (email: `test-new@anchor.app`, password: `TestPass123`)
- [ ] Existing user with 5 anchors (email: `test-active@anchor.app`)
- [ ] User ready for deletion (email: `test-delete@anchor.app`)

---

## Test Execution

## 1. Authentication Flow ⚠️ CRITICAL

### 1.1 Sign Up - New User
**Test ID:** AUTH-001
**Priority:** P0

**Steps:**
1. Launch app (fresh install)
2. Navigate to Sign Up screen
3. Enter:
   - Name: "Test User"
   - Email: "test-new@anchor.app"
   - Password: "TestPass123"
   - Confirm Password: "TestPass123"
4. Tap "Create Account"

**Expected Results:**
- [ ] Account created successfully
- [ ] JWT token received and stored
- [ ] User redirected to Onboarding (not Vault)
- [ ] No errors displayed

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Notes:** _____________

---

### 1.2 Sign Up - Password Validation
**Test ID:** AUTH-002
**Priority:** P1

**Steps:**
1. Navigate to Sign Up
2. Enter short password (< 8 chars): "Test123"
3. Tap "Create Account"

**Expected Results:**
- [ ] Client-side validation error shown
- [ ] Message: "Password must be at least 8 characters"
- [ ] No API call made
- [ ] Form submission blocked

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Bug ID (if fail):** _____________

---

### 1.3 Sign Up - Duplicate Email
**Test ID:** AUTH-003
**Priority:** P0

**Steps:**
1. Attempt sign up with existing email
2. Tap "Create Account"

**Expected Results:**
- [ ] API returns error
- [ ] Message: "Email already exists" or similar
- [ ] User remains on sign-up screen
- [ ] No duplicate user created in database

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 1.4 Login - Correct Credentials
**Test ID:** AUTH-004
**Priority:** P0

**Steps:**
1. Navigate to Login
2. Enter registered email and password
3. Tap "Sign In"

**Expected Results:**
- [ ] Login successful
- [ ] JWT token stored
- [ ] User profile loaded
- [ ] Redirect to Vault (if onboarded) or Onboarding (if not)
- [ ] hasCompletedOnboarding flag respected (NOT hardcoded)

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Notes:** _____________

---

### 1.5 Login - Incorrect Credentials
**Test ID:** AUTH-005
**Priority:** P0

**Steps:**
1. Enter correct email, wrong password
2. Tap "Sign In"

**Expected Results:**
- [ ] Login fails
- [ ] Error message: "Invalid email or password"
- [ ] User remains on login screen
- [ ] No token stored

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 1.6 Logout
**Test ID:** AUTH-006
**Priority:** P0

**Steps:**
1. Navigate to Settings
2. Tap "Sign Out"
3. Confirm logout

**Expected Results:**
- [ ] authStore cleared
- [ ] AsyncStorage token removed
- [ ] Redirect to Login screen
- [ ] Cannot access protected screens

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 2. Onboarding Flow

### 2.1 Complete Onboarding
**Test ID:** ONBOARD-001
**Priority:** P1

**Steps:**
1. Sign up as new user
2. Navigate through all onboarding screens
3. Complete final screen

**Expected Results:**
- [ ] All screens display correctly
- [ ] Animations play smoothly
- [ ] "Next" button works
- [ ] hasCompletedOnboarding = true after completion
- [ ] Flag persisted in backend (check database)
- [ ] Redirect to Vault

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 2.2 Onboarding Persistence
**Test ID:** ONBOARD-002
**Priority:** P0

**Steps:**
1. Complete onboarding
2. Log out
3. Log in again
4. Check if onboarding is shown

**Expected Results:**
- [ ] Onboarding NOT shown again
- [ ] User goes directly to Vault
- [ ] hasCompletedOnboarding flag loaded from backend

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Bug ID (if fail):** BUG-001, BUG-003

---

## 3. Anchor Creation ⚠️ CRITICAL

### 3.1 Create Anchor - Minimal Path
**Test ID:** ANCHOR-001
**Priority:** P0

**Steps:**
1. Navigate to Vault
2. Tap "+" (Create button)
3. Enter intention: "I am focused and productive"
4. Complete distillation
5. Select structure variant (any)
6. Skip optional steps
7. Complete creation

**Expected Results:**
- [ ] Intention validated (3-100 chars)
- [ ] Distillation runs correctly
- [ ] baseSigilSvg generated (valid SVG)
- [ ] Anchor created in database
- [ ] Anchor appears in Vault
- [ ] User totalAnchorsCreated += 1
- [ ] isCharged = false
- [ ] activationCount = 0

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 3.2 Create Anchor - Full Path (with AI)
**Test ID:** ANCHOR-002
**Priority:** P1

**Steps:**
1. Create anchor
2. Enable manual reinforcement
3. Enable AI enhancement
4. Generate mantra
5. Complete creation

**Expected Results:**
- [ ] All optional steps work
- [ ] reinforcedSigilSvg created
- [ ] enhancedImageUrl saved
- [ ] mantraText generated
- [ ] All metadata persisted

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 3.3 Intention Validation - Too Short
**Test ID:** ANCHOR-003
**Priority:** P1

**Steps:**
1. Create anchor
2. Enter intention: "Hi" (2 chars)
3. Try to continue

**Expected Results:**
- [ ] Validation error shown
- [ ] Message: "Intention must be at least 3 characters"
- [ ] Cannot proceed

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 3.4 Intention Validation - Too Long
**Test ID:** ANCHOR-004
**Priority:** P1

**Steps:**
1. Enter intention > 100 characters
2. Try to continue

**Expected Results:**
- [ ] Input truncated or validation error
- [ ] Cannot submit > 100 chars

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 3.5 Distillation Algorithm
**Test ID:** ANCHOR-005
**Priority:** P1

**Test Intentions:**
- "BELIEVE" → "BLV"
- "SUCCESS" → "SCCS"

**Steps:**
1. Create anchor with test intention
2. Check distillationSteps in database

**Expected Results:**
- [ ] Vowels removed correctly
- [ ] Duplicates removed correctly
- [ ] finalLetters accurate

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 4. Anchor Charging ⚠️ CRITICAL

### 4.1 Quick Charge (30 seconds)
**Test ID:** CHARGE-001
**Priority:** P0

**Steps:**
1. Navigate to uncharged anchor
2. Tap "Charge Anchor"
3. Select "Quick Charge"
4. Wait for 30-second ritual
5. Perform seal gesture (press & hold)
6. Complete charge

**Expected Results:**
- [ ] Timer counts down 30s accurately (±1s)
- [ ] Progress ring animates smoothly
- [ ] Haptic feedback every 2 seconds
- [ ] Seal gesture recognized
- [ ] Haptic on seal completion
- [ ] Backend charge record created
- [ ] Anchor.isCharged = true
- [ ] Anchor.chargedAt timestamp set
- [ ] Navigate to ChargeComplete
- [ ] "Charged" badge shows in Vault

**Actual Result:** _____________
**Timer Accuracy:** _____ seconds
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 4.2 Deep Charge (5 phases)
**Test ID:** CHARGE-002
**Priority:** P0

**Steps:**
1. Select anchor
2. Choose "Deep Charge"
3. Complete all 5 phases
4. Perform seal gesture

**Expected Results:**
- [ ] All 5 phases transition correctly
- [ ] Phase durations accurate:
  - Phase 1 (Focus): 60s
  - Phase 2 (Ground): 60s
  - Phase 3 (Visualize): 90s
  - Phase 4 (Mantra): 60s
  - Phase 5 (Seal): 15s
- [ ] Instruction text updates per phase
- [ ] Haptic feedback on transitions
- [ ] Progress ring smooth
- [ ] Seal phase shows prompt
- [ ] Glow effect on seal
- [ ] Charge recorded

**Actual Result:** _____________
**Phase Timing:** P1: ___s, P2: ___s, P3: ___s, P4: ___s, P5: ___s
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 4.3 Cancel Ritual
**Test ID:** CHARGE-003
**Priority:** P1

**Steps:**
1. Start ritual
2. Tap back/cancel mid-ritual
3. Confirm exit

**Expected Results:**
- [ ] Confirmation dialog shown
- [ ] On confirm: Ritual cancelled
- [ ] No charge record created
- [ ] Anchor remains uncharged
- [ ] Return to previous screen

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 5. Anchor Activation ⚠️ CRITICAL

### 5.1 Quick Activation (10 seconds)
**Test ID:** ACTIVATE-001
**Priority:** P0

**Steps:**
1. Navigate to charged anchor
2. Tap "Activate"
3. Complete 10-second countdown

**Expected Results:**
- [ ] Timer counts down from 10s accurately
- [ ] Intention text displayed
- [ ] Anchor symbol shown
- [ ] Haptic pulse every 2 seconds
- [ ] Auto-complete at 0
- [ ] Backend activation created
- [ ] Anchor.activationCount += 1
- [ ] Anchor.lastActivatedAt updated
- [ ] User.totalActivations += 1
- [ ] Toast notification shown
- [ ] Auto-navigate after 1.5s

**Actual Result:** _____________
**Timer Accuracy:** _____ seconds
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 5.2 Multiple Activations
**Test ID:** ACTIVATE-002
**Priority:** P1

**Steps:**
1. Activate anchor 3 times in a row

**Expected Results:**
- [ ] Each activation records separately
- [ ] activationCount increments 3 times
- [ ] totalActivations increments 3 times
- [ ] 3 Activation records in database

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 5.3 Activate Uncharged Anchor
**Test ID:** ACTIVATE-003
**Priority:** P1

**Steps:**
1. Try to activate uncharged anchor

**Expected Results:**
- [ ] Blocked with message OR
- [ ] Warning shown to charge first

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 6. Anchor Burning (Delete)

### 6.1 Burn Anchor - Full Ritual
**Test ID:** BURN-001
**Priority:** P1

**Steps:**
1. Navigate to anchor detail
2. Tap "Burn" or "Release"
3. Confirm in dialog
4. Watch 6-second ritual

**Expected Results:**
- [ ] Confirmation dialog shown
- [ ] Can cancel
- [ ] Burning animation plays (6s)
- [ ] Prompts appear at intervals
- [ ] Backend archives to BurnedAnchor
- [ ] Original Anchor deleted
- [ ] Removed from Vault
- [ ] Navigate back

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 6.2 Verify Archive
**Test ID:** BURN-002
**Priority:** P1

**Steps:**
1. Burn anchor (from 6.1)
2. Check database BurnedAnchor table

**Expected Results:**
- [ ] BurnedAnchor record exists
- [ ] Contains original data
- [ ] burnedAt timestamp set
- [ ] Original Anchor record gone

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 7. Settings & Preferences

### 7.1 Update Practice Settings
**Test ID:** SETTINGS-001
**Priority:** P1

**Steps:**
1. Navigate to Settings
2. Change:
   - Default Charge Type: Quick → Deep
   - Default Activation: Visual → Mantra
   - Daily practice goal: 3 → 5
3. Navigate away and return

**Expected Results:**
- [ ] Changes reflected immediately
- [ ] settingsStore updated
- [ ] Backend API called (PUT /api/auth/settings)
- [ ] Settings persist after app restart
- [ ] Settings loaded on login

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Bug ID (if fail):** BUG-009

---

### 7.2 Toggle Notifications
**Test ID:** SETTINGS-002
**Priority:** P1

**Steps:**
1. Toggle notification settings
2. Check backend sync

**Expected Results:**
- [ ] Toggle works
- [ ] Settings saved
- [ ] Backend updated

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 7.3 Change Theme
**Test ID:** SETTINGS-003
**Priority:** P1

**Steps:**
1. Change theme: Zen → Dark → Light
2. Navigate through app

**Expected Results:**
- [ ] Theme changes immediately
- [ ] All screens reflect theme
- [ ] Persists after restart

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 7.4 Change Vault Layout
**Test ID:** SETTINGS-004
**Priority:** P1

**Steps:**
1. Set to List view
2. Navigate to Vault
3. Set to Grid view
4. Navigate to Vault

**Expected Results:**
- [ ] Layout changes work
- [ ] Both views display correctly
- [ ] Preference saved

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 8. Account Deletion ⚠️ CRITICAL

### 8.1 Delete Account
**Test ID:** ACCOUNT-001
**Priority:** P0 (Legal Requirement)

**Steps:**
1. Log in as test-delete@anchor.app
2. Navigate to Settings → Account
3. Tap "Delete Account"
4. Confirm deletion
5. Check database

**Expected Results:**
- [ ] Confirmation dialog with warning
- [ ] Can cancel
- [ ] On confirm: Backend DELETE called
- [ ] Database cascade delete:
  - User deleted
  - All Anchors deleted
  - All Activations deleted
  - All Charges deleted
  - UserSettings deleted
- [ ] Local stores cleared
- [ ] User logged out
- [ ] Redirect to Login
- [ ] Cannot log in with deleted account

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Bug ID (if fail):** BUG-002

---

### 8.2 Cancel Account Deletion
**Test ID:** ACCOUNT-002
**Priority:** P1

**Steps:**
1. Initiate deletion
2. Tap "Cancel"

**Expected Results:**
- [ ] Deletion cancelled
- [ ] User remains logged in
- [ ] No data deleted

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 9. Vault View & Navigation

### 9.1 Display Anchors
**Test ID:** VAULT-001
**Priority:** P0

**Steps:**
1. Create 5 anchors
2. Navigate to Vault

**Expected Results:**
- [ ] All anchors displayed
- [ ] Grid layout (2 columns)
- [ ] Each card shows:
  - Symbol preview
  - Intention title
  - Charged badge (if charged)
  - Activation count
- [ ] Smooth scrolling

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 9.2 Empty Vault
**Test ID:** VAULT-002
**Priority:** P1

**Steps:**
1. New account, no anchors
2. Navigate to Vault

**Expected Results:**
- [ ] Empty state message
- [ ] "Create first anchor" prompt
- [ ] FAB visible

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 9.3 Pull to Refresh
**Test ID:** VAULT-003
**Priority:** P1

**Steps:**
1. Pull down on Vault
2. Wait for sync

**Expected Results:**
- [ ] Refresh animation
- [ ] API call to fetch anchors
- [ ] List updated

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 10. Error Handling

### 10.1 Network Error - Anchor Creation
**Test ID:** ERROR-001
**Priority:** P0

**Steps:**
1. Disable network
2. Create anchor
3. Try to save

**Expected Results:**
- [ ] Error detected
- [ ] Message: "Network error. Please check your connection."
- [ ] Toast shown (not Alert)
- [ ] Anchor queued for sync (if offline mode implemented) OR
- [ ] Retry option provided

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Bug ID (if fail):** BUG-010

---

### 10.2 Network Error - Activation
**Test ID:** ERROR-002
**Priority:** P1

**Steps:**
1. Disable network
2. Activate anchor
3. Complete ritual

**Expected Results:**
- [ ] Activation completes locally
- [ ] Error shown on sync failure
- [ ] Queued for later sync OR
- [ ] Retry option

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️
**Bug ID (if fail):** BUG-008, BUG-010

---

### 10.3 API Error (500)
**Test ID:** ERROR-003
**Priority:** P1

**Steps:**
1. Trigger server error
2. Observe error handling

**Expected Results:**
- [ ] Error caught
- [ ] User-friendly message shown
- [ ] App doesn't crash
- [ ] Error logged to ErrorTrackingService

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 10.4 Auth Error (401)
**Test ID:** ERROR-004
**Priority:** P1

**Steps:**
1. Expire or delete JWT token
2. Make API call

**Expected Results:**
- [ ] 401 caught
- [ ] Error message: "Session expired"
- [ ] User logged out (optional)
- [ ] Redirect to Login

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## 11. Performance & Data Integrity

### 11.1 Large Anchor Count
**Test ID:** PERF-001
**Priority:** P2

**Steps:**
1. Create account with 20+ anchors
2. Navigate to Vault

**Expected Results:**
- [ ] Vault loads in < 3 seconds
- [ ] Smooth scrolling
- [ ] No lag

**Actual Result:** _____________
**Load Time:** _____ seconds
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 11.2 Rapid Anchor Creation
**Test ID:** DATA-001
**Priority:** P2

**Steps:**
1. Create 5 anchors quickly (< 2 min)

**Expected Results:**
- [ ] All created successfully
- [ ] No duplicate IDs
- [ ] totalAnchorsCreated = 5
- [ ] No race conditions

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### 11.3 Data Persistence
**Test ID:** DATA-002
**Priority:** P0

**Steps:**
1. Create 3 anchors
2. Activate one 3 times
3. Force quit app
4. Restart app

**Expected Results:**
- [ ] All 3 anchors present
- [ ] Activation count = 3
- [ ] No data loss

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## Edge Cases (Optional)

### Edge-001: Very Long Intention (100 chars)
**Priority:** P2

**Steps:**
1. Create anchor with 100-char intention

**Expected Results:**
- [ ] Accepted
- [ ] Displays correctly in all views
- [ ] No truncation in database

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### Edge-002: Special Characters in Intention
**Priority:** P2

**Test:** "I am 💪 powerful & ready! 🎯"

**Expected Results:**
- [ ] Unicode handled correctly
- [ ] Distillation works
- [ ] Database encoding OK

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

### Edge-003: Concurrent Activations (Multi-Device)
**Priority:** P2

**Steps:**
1. Login on 2 devices
2. Activate same anchor simultaneously

**Expected Results:**
- [ ] Both activations recorded
- [ ] activationCount += 2
- [ ] No data corruption

**Actual Result:** _____________
**Status:** [ ] ✅ [ ] ❌ [ ] ⚠️ [ ] ⏭️

---

## Test Summary

**Test Date:** _____________
**Tester Name:** _____________
**Environment:**
- iOS Version: _____________
- Android Version: _____________
- Backend Version: _____________
- Database: _____________

**Results:**
- Total Tests: 50
- Passed: _____
- Failed: _____
- Partial: _____
- Skipped: _____

**Pass Rate:** _____% (Target: 95%+)

**Critical Bugs Found:**
1. _____________
2. _____________
3. _____________

**P0 Bugs Status:**
- BUG-001 (hasCompletedOnboarding): [ ] Fixed [ ] Still Fails
- BUG-002 (Account Deletion): [ ] Fixed [ ] Still Fails
- BUG-003 (Onboarding Backend): [ ] Fixed [ ] Still Fails

**Release Decision:**
- [ ] ✅ APPROVED - Ready for release
- [ ] ⚠️ CONDITIONAL - Fix critical bugs first
- [ ] ❌ BLOCKED - Too many failures, needs rework

**Sign-off:**
- QA Lead: _____________ Date: _____________
- Engineering Lead: _____________ Date: _____________
- Product Manager: _____________ Date: _____________

---

## Notes & Observations

**General Comments:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

**Issues for Next Sprint:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

**Recommendations:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

**Document Version:** 1.0
**Last Updated:** 2026-01-31
**Next Review:** Before each release
