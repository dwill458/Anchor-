# Anchor App - End-to-End Testing Strategy

**Date:** 2026-01-31
**Version:** 1.0
**Purpose:** Comprehensive manual E2E testing of all critical user flows with bug tracking and regression checklist

---

## Table of Contents
1. [Testing Approach](#testing-approach)
2. [Environment Setup](#environment-setup)
3. [Critical User Flows (10+)](#critical-user-flows)
4. [Edge Cases & Boundary Conditions](#edge-cases--boundary-conditions)
5. [Bug Tracking Template](#bug-tracking-template)
6. [Regression Test Checklist](#regression-test-checklist)

---

## Testing Approach

### Methodology
- **Manual E2E Testing**: Simulate real user behavior across all critical paths
- **Exploratory Testing**: Identify edge cases and unexpected behaviors
- **Regression Testing**: Validate existing functionality isn't broken by changes
- **Priority-Based Bug Tracking**: P0 (blocking) → P1 (high) → P2 (medium)

### Test Environment
- **Mobile App**: Expo development build on iOS/Android simulators/devices
- **Backend**: Local development server or staging environment
- **Database**: PostgreSQL with test data
- **Network**: Test both online and offline scenarios

### Success Criteria
- All P0 bugs fixed before release
- All P1 bugs documented for next sprint
- 100% critical path coverage
- Edge cases identified and prioritized

---

## Environment Setup

### Prerequisites
```bash
# Backend setup
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Mobile setup
cd apps/mobile
npm install
npx expo start
```

### Test User Accounts
Create test accounts with various states:
- **New User**: No anchors, onboarding incomplete
- **Active User**: 3-5 anchors, some charged/uncharged
- **Power User**: 10+ anchors, high activation count
- **Edge Case User**: Account ready for deletion

### Test Data Reset
```bash
# Reset database between test runs if needed
npx prisma migrate reset
```

---

## Critical User Flows

### Flow 1: User Authentication
**Priority:** P0 (Core functionality)

#### Test Cases

##### 1.1 Sign Up - Happy Path
**Steps:**
1. Launch app (fresh install)
2. Navigate to Sign Up screen
3. Enter valid email (e.g., `test@example.com`)
4. Enter valid password (8+ characters)
5. Tap "Sign Up"

**Expected Results:**
- [ ] Email validation passes
- [ ] Password validation passes (min 8 chars)
- [ ] User created in database
- [ ] JWT token generated and stored in AsyncStorage
- [ ] User redirected to Onboarding flow
- [ ] authStore populated with user data

**Actual Results:**
_[To be filled during testing]_

**Status:** [ ] Pass [ ] Fail

**Bugs Found:**
_[List any bugs with IDs]_

---

##### 1.2 Sign Up - Email Already Exists
**Steps:**
1. Attempt to sign up with existing email
2. Tap "Sign Up"

**Expected Results:**
- [ ] API returns 409/400 error
- [ ] Error message shown: "Email already exists"
- [ ] User remains on sign-up screen
- [ ] No duplicate user created

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 1.3 Sign Up - Password Validation
**Steps:**
1. Enter valid email
2. Enter password < 8 characters
3. Tap "Sign Up"

**Expected Results:**
- [ ] Password validation error shown
- [ ] Form submission blocked
- [ ] Clear error message displayed

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 1.4 Login - Happy Path
**Steps:**
1. Navigate to Login screen
2. Enter registered email
3. Enter correct password
4. Tap "Sign In"

**Expected Results:**
- [ ] Credentials verified with bcrypt
- [ ] JWT token generated
- [ ] Token stored in AsyncStorage
- [ ] User profile loaded into authStore
- [ ] Redirect to Vault (if onboarded) or Onboarding

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 1.5 Login - Invalid Credentials
**Steps:**
1. Enter registered email
2. Enter incorrect password
3. Tap "Sign In"

**Expected Results:**
- [ ] Login fails with 401 error
- [ ] Error message: "Invalid email or password"
- [ ] User remains on login screen
- [ ] No token stored

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 1.6 Logout
**Steps:**
1. Navigate to Settings/Profile
2. Tap "Sign Out"
3. Confirm logout

**Expected Results:**
- [ ] authStore cleared
- [ ] AsyncStorage token removed
- [ ] Redirect to Login screen
- [ ] No user data persisted

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 2: Onboarding
**Priority:** P1 (User experience)

##### 2.1 Complete Onboarding Flow
**Steps:**
1. Sign up as new user
2. Navigate through onboarding screens:
   - LogoBreathScreen
   - HowItWorksScreen
   - DailyLoopScreen
   - NarrativeOnboardingScreen
   - SaveProgressScreen
3. Complete onboarding

**Expected Results:**
- [ ] All screens display correctly
- [ ] Animations play smoothly
- [ ] "Next" button advances screens
- [ ] Final screen sets `hasCompletedOnboarding = true`
- [ ] User redirected to Vault
- [ ] Flag persisted in database/authStore

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 2.2 Skip Onboarding (if implemented)
**Steps:**
1. Look for "Skip" option during onboarding
2. Tap skip

**Expected Results:**
- [ ] User can skip onboarding
- [ ] Redirected to Vault immediately
- [ ] onboarding flag still set

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 3: Anchor Creation - Full Flow
**Priority:** P0 (Core functionality)

##### 3.1 Create Anchor - Minimal Path (No Optional Steps)
**Steps:**
1. Navigate to Vault
2. Tap "+" (Create Anchor FAB)
3. Enter intention: "I am focused and productive" (25 chars)
4. Tap "Continue"
5. Watch distillation animation
6. Select "dense" structure variant
7. Skip manual reinforcement (if option exists)
8. Skip AI enhancement (if option exists)
9. Skip mantra generation (if option exists)
10. Complete creation

**Expected Results:**
- [ ] Intention validated (3-100 chars)
- [ ] Distillation algorithm runs (vowels removed, duplicates removed)
- [ ] baseSigilSvg generated (valid SVG)
- [ ] Anchor created in database with:
  - intention
  - distillationSteps (finalLetters)
  - baseSigilSvg
  - variant (dense/balanced/minimal)
  - isCharged = false
  - activationCount = 0
- [ ] User.totalAnchorsCreated incremented
- [ ] Anchor appears in Vault
- [ ] Redirect to Vault or Charge Setup

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.2 Create Anchor - Full Path (All Optional Steps)
**Steps:**
1. Create new anchor
2. Enter intention: "I attract abundance effortlessly"
3. Complete distillation
4. Select structure variant
5. **Enable Manual Reinforcement**
   - Trace the sigil on screen
   - Complete stroke count
6. **Enable AI Enhancement**
   - Select style (e.g., "watercolor")
   - Wait for AI generation
   - Select favorite variation
7. **Generate Mantra**
   - AI creates mantra from intention
   - Listen to pronunciation
8. Review final anchor
9. Complete creation

**Expected Results:**
- [ ] All steps complete without errors
- [ ] reinforcedSigilSvg created with reinforcementMetadata
- [ ] enhancedImageUrl + enhancementMetadata saved
- [ ] mantraText + mantraPronunciation + mantraAudioUrl saved
- [ ] All data persisted in Anchor record
- [ ] Anchor displays with enhanced image in Vault

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.3 Intention Validation - Too Short
**Steps:**
1. Create anchor
2. Enter intention: "Hi" (2 chars)
3. Tap "Continue"

**Expected Results:**
- [ ] Validation error shown
- [ ] Message: "Intention must be at least 3 characters"
- [ ] Form submission blocked

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.4 Intention Validation - Too Long
**Steps:**
1. Enter intention > 100 characters
2. Tap "Continue"

**Expected Results:**
- [ ] Input field truncates or validation error shown
- [ ] Message: "Intention must be 100 characters or less"

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.5 Distillation Algorithm Accuracy
**Test Intentions:**
- "BELIEVE" → Distills to "BLV"
- "SUCCESS" → Distills to "SCCS"
- "I am powerful" → Distills to specific finalLetters

**Steps:**
1. For each test intention, create anchor
2. Check distillationSteps in database

**Expected Results:**
- [ ] Vowels removed correctly
- [ ] Duplicates removed correctly
- [ ] finalLetters match expected output

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.6 Structure Variant Selection
**Steps:**
1. Create anchor
2. On StructureForgeScreen, view 3 variants:
   - Dense
   - Balanced
   - Minimal
3. Select each variant

**Expected Results:**
- [ ] All 3 variants display different structures
- [ ] Selected variant highlighted
- [ ] baseSigilSvg updates based on selection
- [ ] SVG is valid and renders

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.7 Manual Reinforcement - Stroke Tracing
**Steps:**
1. Enable manual reinforcement
2. Trace the sigil with finger/stylus
3. Complete all strokes

**Expected Results:**
- [ ] Touch gestures tracked
- [ ] Stroke count displayed
- [ ] Fidelity score calculated
- [ ] reinforcedSigilSvg created from user strokes
- [ ] reinforcementMetadata saved:
  - strokeCount
  - fidelityScore
  - totalTimeMs

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.8 AI Enhancement - Image Generation
**Steps:**
1. Enable AI enhancement
2. Select style: "watercolor"
3. Wait for generation
4. View variations
5. Select one

**Expected Results:**
- [ ] AI request sent to backend (`POST /api/ai/enhance`)
- [ ] Loading state shown
- [ ] Multiple variations returned
- [ ] Images display correctly
- [ ] Selected image saved as enhancedImageUrl
- [ ] enhancementMetadata saved (style, selectedVariationIndex)

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 3.9 Mantra Generation
**Steps:**
1. Generate mantra for intention
2. View mantra text
3. Listen to pronunciation

**Expected Results:**
- [ ] AI generates mantra via `POST /api/ai/mantra`
- [ ] mantraText displayed
- [ ] mantraPronunciation shown
- [ ] mantraAudioUrl generated (if TTS enabled)
- [ ] Audio plays correctly
- [ ] Data saved to Anchor

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 4: Anchor Charging
**Priority:** P0 (Core ritual)

##### 4.1 Quick Charge (30 seconds)
**Steps:**
1. Navigate to Vault
2. Tap on uncharged anchor
3. Tap "Charge Anchor"
4. Select "Quick Charge"
5. Ritual screen displays:
   - Progress ring
   - 30-second timer
   - Anchor symbol
6. Wait for timer completion
7. Perform seal gesture (press & hold)
8. Complete charge

**Expected Results:**
- [ ] Timer counts down from 30s accurately
- [ ] Progress ring animates 0→1
- [ ] Haptic feedback every 2 seconds
- [ ] Seal gesture recognized
- [ ] Haptic on seal completion
- [ ] Backend API call: `POST /api/anchors/{id}/charge`
- [ ] Charge record created in database
- [ ] Anchor.isCharged = true
- [ ] Anchor.chargedAt = now
- [ ] Navigate to ChargeCompleteScreen
- [ ] Anchor shows "charged" badge in Vault

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 4.2 Deep Charge (5 phases, ~5 minutes)
**Steps:**
1. Select anchor
2. Choose "Deep Charge"
3. Complete each phase:
   - **Phase 1: Focus** (1 min) - Breathwork prep
   - **Phase 2: Ground** (1 min) - Breath focus
   - **Phase 3: Visualize** (1.5 min) - Intention imagery
   - **Phase 4: Mantra** (1 min) - Mantra recitation
   - **Phase 5: Seal** (15 sec) - Seal gesture
4. Perform seal gesture
5. Complete ritual

**Expected Results:**
- [ ] All 5 phases transition correctly
- [ ] Phase durations accurate:
  - Focus: 60s
  - Ground: 60s
  - Visualize: 90s
  - Mantra: 60s
  - Seal: 15s
- [ ] Instruction text updates per phase
- [ ] Haptic feedback on phase transitions
- [ ] Progress ring smooth animation
- [ ] Seal phase shows "Press & Hold" instruction
- [ ] Glow effect on seal phase
- [ ] Backend charge created
- [ ] Anchor.isCharged = true

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 4.3 Ritual Controller - Phase Transitions
**Steps:**
1. Start deep charge
2. Observe phase transitions
3. Check haptic feedback
4. Verify instruction text changes

**Expected Results:**
- [ ] useRitualController hook manages phases correctly
- [ ] Phase transitions trigger haptics
- [ ] Instruction text matches current phase
- [ ] Timer doesn't drift or skip
- [ ] Progress calculation accurate

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 4.4 Seal Gesture Recognition
**Steps:**
1. Reach seal phase
2. Press and hold seal button
3. Release early
4. Press and hold again until completion

**Expected Results:**
- [ ] Seal requires press & hold
- [ ] Early release doesn't complete seal
- [ ] Full duration triggers completion
- [ ] Haptic feedback on success
- [ ] Completion callback fires

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 4.5 Charge Already Charged Anchor
**Steps:**
1. Select already charged anchor
2. Attempt to charge again

**Expected Results:**
- [ ] Option to "Re-charge" or message that anchor is charged
- [ ] Re-charging updates chargedAt timestamp
- [ ] New Charge record created (or previous one updated)

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 5: Anchor Activation
**Priority:** P0 (Core ritual)

##### 5.1 Quick Activation (10 seconds)
**Steps:**
1. Navigate to charged anchor
2. Tap "Activate"
3. Choose activation type (visual/mantra/deep)
4. Watch 10-second countdown
5. Complete activation

**Expected Results:**
- [ ] Timer counts down from 10s
- [ ] Intention text displayed
- [ ] Anchor symbol shown
- [ ] Haptic pulse every 2 seconds
- [ ] Auto-complete after 10s
- [ ] Backend API: `POST /api/anchors/{id}/activate`
- [ ] Activation record created with type + duration
- [ ] Anchor.activationCount += 1
- [ ] Anchor.lastActivatedAt = now
- [ ] User.totalActivations += 1
- [ ] Toast notification shown
- [ ] Auto-navigate back after 1.5s

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 5.2 Multiple Activations Same Day
**Steps:**
1. Activate anchor
2. Immediately activate again
3. Activate 3rd time

**Expected Results:**
- [ ] Each activation creates new Activation record
- [ ] activationCount increments each time
- [ ] totalActivations increments each time
- [ ] lastActivatedAt updates each time
- [ ] No rate limiting or blocks (or appropriate limit if implemented)

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 5.3 Activate Uncharged Anchor
**Steps:**
1. Navigate to uncharged anchor
2. Attempt to activate

**Expected Results:**
- [ ] Activation blocked or warning shown
- [ ] User prompted to charge first
- [ ] OR activation allowed but with warning

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 6: Anchor Burning (Release/Delete)
**Priority:** P1 (Important feature)

##### 6.1 Burn Anchor - Full Ritual
**Steps:**
1. Navigate to anchor detail
2. Tap "Burn" or "Release Anchor"
3. Confirmation dialog appears
4. Confirm burn
5. Watch 6-second burning ritual:
   - 2s: "Let go."
   - 3.5s: "Trust the process."
   - 5s: "Your intention has been released."
6. Anchor deleted

**Expected Results:**
- [ ] Confirmation dialog shown (destructive action)
- [ ] User can cancel
- [ ] Burning animation plays
- [ ] Prompts appear at correct intervals
- [ ] Backend API: `DELETE /api/anchors/{id}`
- [ ] Anchor archived to BurnedAnchor table (not hard deleted)
- [ ] Anchor removed from local anchorStore
- [ ] Navigate back to Vault
- [ ] Anchor no longer visible in Vault

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 6.2 Cancel Burn
**Steps:**
1. Initiate burn
2. Tap "Cancel" on confirmation

**Expected Results:**
- [ ] Burn cancelled
- [ ] Anchor remains unchanged
- [ ] No API call made
- [ ] User returns to anchor detail

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 6.3 Verify Archive (Backend)
**Steps:**
1. Burn an anchor
2. Check database BurnedAnchor table

**Expected Results:**
- [ ] BurnedAnchor record created with:
  - Original anchor data
  - burnedAt timestamp
  - userId
- [ ] Original Anchor record deleted

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 7: Settings & Preferences
**Priority:** P1 (User experience)

##### 7.1 Update Practice Settings
**Steps:**
1. Navigate to Settings
2. Change "Default Charge Type" from Quick → Deep
3. Change "Default Activation Type" from Visual → Mantra
4. Toggle "Auto-open daily anchor" ON
5. Set "Daily practice goal" to 5 activations
6. Toggle "Reduce intention visibility" ON
7. Navigate away and return

**Expected Results:**
- [ ] Each setting updates immediately in UI
- [ ] settingsStore updates
- [ ] Backend API: `PUT /api/auth/settings`
- [ ] UserSettings record updated in database
- [ ] Settings persist after app restart
- [ ] Settings loaded correctly on next session

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 7.2 Update Notification Settings
**Steps:**
1. Toggle "Daily reminder" ON
2. Set reminder time to 9:00 AM
3. Toggle "Streak protection alerts" ON
4. Toggle "Weekly summary" ON

**Expected Results:**
- [ ] Notification settings saved
- [ ] Time picker shows HH:MM format
- [ ] Backend persists settings
- [ ] (If notifications implemented) System notifications scheduled

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 7.3 Change Theme
**Steps:**
1. Navigate to Appearance settings
2. Change theme: Zen Architect → Dark → Light → Zen Architect

**Expected Results:**
- [ ] Theme changes immediately
- [ ] All screens reflect new theme
- [ ] Theme persisted in settingsStore
- [ ] Theme loads on app restart

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 7.4 Change Vault Layout
**Steps:**
1. Set Vault layout to "List"
2. Navigate to Vault
3. Verify list view
4. Return to settings
5. Set to "Grid"
6. Verify grid view

**Expected Results:**
- [ ] Layout changes immediately
- [ ] Vault displays correctly in both modes
- [ ] Preference persisted

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 7.5 Audio & Haptics
**Steps:**
1. Set "Haptic feedback intensity" to 50
2. Set "Mantra voice" to "Generated"
3. Set "Voice style" to "Calm"
4. Toggle "Sound effects" OFF
5. Test ritual with new settings

**Expected Results:**
- [ ] Haptic intensity affects vibration strength
- [ ] Mantra voice preference saved
- [ ] Sound effects toggle works
- [ ] Settings persist

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 7.6 Data Export
**Steps:**
1. Navigate to Data & Privacy
2. Tap "Export data"
3. Wait for export

**Expected Results:**
- [ ] Export initiated
- [ ] Loading state shown
- [ ] Data exported as JSON/CSV
- [ ] File download or share dialog appears
- [ ] Exported data includes:
  - User profile
  - All anchors
  - Activations
  - Charges
  - Settings

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 7.7 Clear Cache
**Steps:**
1. Tap "Clear cache"
2. Confirm action

**Expected Results:**
- [ ] Cache cleared
- [ ] Confirmation message shown
- [ ] User data NOT affected
- [ ] Images may need to reload

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 8: Account Deletion
**Priority:** P0 (Critical legal/privacy requirement)

##### 8.1 Delete Account - Complete Flow
**Steps:**
1. Navigate to Settings → Account
2. Tap "Delete Account"
3. Read destructive action warning
4. Confirm deletion (may require password re-entry)
5. Backend processes deletion

**Expected Results:**
- [ ] Confirmation dialog with warning
- [ ] User can cancel
- [ ] On confirm: Backend API `DELETE /api/auth/me` (or similar)
- [ ] Database cascade delete:
  - User record deleted
  - All Anchor records deleted
  - All Activation records deleted
  - All Charge records deleted
  - All Order records deleted
  - UserSettings deleted
  - SyncQueue cleared
- [ ] Local stores cleared (authStore, anchorStore, settingsStore)
- [ ] AsyncStorage cleared
- [ ] User logged out
- [ ] Redirect to Login/Welcome screen
- [ ] Cannot log in with deleted account

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 8.2 Cancel Account Deletion
**Steps:**
1. Initiate account deletion
2. Tap "Cancel"

**Expected Results:**
- [ ] Deletion cancelled
- [ ] User remains logged in
- [ ] No data deleted
- [ ] Settings screen remains

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 9: Error Handling & Recovery
**Priority:** P0 (App stability)

##### 9.1 Network Error - Anchor Creation
**Steps:**
1. Disable network/WiFi
2. Attempt to create anchor
3. Complete all steps
4. Try to save anchor

**Expected Results:**
- [ ] Network error detected
- [ ] Error message: "Network error. Please check your connection."
- [ ] Toast notification shown
- [ ] (If SyncQueue implemented) Anchor saved to SyncQueue
- [ ] On network restore: SyncQueue processes and syncs anchor
- [ ] OR User prompted to retry

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 9.2 Network Error - Activation
**Steps:**
1. Disable network
2. Activate anchor
3. Complete 10-second ritual

**Expected Results:**
- [ ] Activation completes locally
- [ ] Error shown on sync failure
- [ ] (If SyncQueue) Activation queued for sync
- [ ] On reconnect: Activation synced to backend

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 9.3 API Error (500 Server Error)
**Steps:**
1. Trigger server error (stop backend or corrupt database)
2. Attempt anchor creation or other API call

**Expected Results:**
- [ ] 500 error caught by ApiClient
- [ ] Error message shown to user
- [ ] Error logged to ErrorTrackingService with breadcrumbs
- [ ] App doesn't crash
- [ ] User can retry

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 9.4 Authentication Error (401 Unauthorized)
**Steps:**
1. Manually expire or delete JWT token
2. Attempt API call requiring auth

**Expected Results:**
- [ ] 401 error caught
- [ ] User auto-logged out (if configured)
- [ ] Error message: "Session expired. Please sign in again."
- [ ] Redirect to Login screen
- [ ] authStore cleared

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 9.5 App Crash Recovery
**Steps:**
1. Force quit app during anchor creation
2. Restart app
3. Check for data consistency

**Expected Results:**
- [ ] App restarts without errors
- [ ] Partial anchor NOT saved (or draft saved)
- [ ] User can retry creation
- [ ] No orphaned data in database

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 10: Offline Mode & Sync
**Priority:** P1 (Reliability feature)

##### 10.1 Create Anchor Offline
**Steps:**
1. Disable network
2. Create new anchor (all steps)
3. Complete creation
4. Re-enable network

**Expected Results:**
- [ ] Anchor created locally
- [ ] Added to SyncQueue (if implemented)
- [ ] Anchor visible in Vault with "syncing" indicator
- [ ] On reconnect: SyncQueue processes
- [ ] Anchor synced to backend
- [ ] Sync indicator removed
- [ ] Anchor ID updated with server ID

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 10.2 Activate Anchor Offline
**Steps:**
1. Go offline
2. Activate charged anchor
3. Complete activation
4. Reconnect

**Expected Results:**
- [ ] Activation completes locally
- [ ] Added to SyncQueue
- [ ] On reconnect: Activation synced
- [ ] activationCount updated on server

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 10.3 Offline Indicator
**Steps:**
1. Disable network
2. Navigate through app

**Expected Results:**
- [ ] Offline indicator shown (banner, toast, or status)
- [ ] User informed of offline mode
- [ ] Features that require network disabled or queued

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 11: Vault View & Navigation
**Priority:** P1 (User experience)

##### 11.1 Display Anchors in Grid
**Steps:**
1. Create 5+ anchors
2. Navigate to Vault
3. View grid layout

**Expected Results:**
- [ ] All anchors displayed
- [ ] 2-column grid layout
- [ ] Each card shows:
  - Anchor symbol (baseSigilSvg or enhanced image)
  - Intention title (truncated if long)
  - Charged status badge
  - Activation count
- [ ] Pull-to-refresh works
- [ ] Smooth scrolling

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 11.2 Empty Vault State
**Steps:**
1. New account with no anchors
2. Navigate to Vault

**Expected Results:**
- [ ] Empty state message shown
- [ ] "Create your first anchor" prompt
- [ ] FAB visible and functional

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 11.3 Pull to Refresh
**Steps:**
1. Navigate to Vault
2. Pull down to refresh
3. Wait for sync

**Expected Results:**
- [ ] Refresh animation shown
- [ ] API call to fetch latest anchors
- [ ] Anchor list updated
- [ ] Refresh complete indicator

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 11.4 Sort Anchors (if implemented)
**Steps:**
1. Open sort menu
2. Select "Most Activated"
3. Select "Recent"
4. Select "Oldest"

**Expected Results:**
- [ ] Anchors re-sorted based on selection
- [ ] Sort preference persisted
- [ ] UI updates immediately

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 11.5 Filter Anchors (if implemented)
**Steps:**
1. Open filter menu
2. Select "Charged only"
3. Select "Uncharged only"
4. Select "All"

**Expected Results:**
- [ ] Anchors filtered correctly
- [ ] Count updated
- [ ] Filter state persisted

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 12: Ritual Controller Deep Testing
**Priority:** P1 (Core ritual quality)

##### 12.1 Phase Duration Accuracy
**Steps:**
1. Start deep charge ritual
2. Time each phase with stopwatch:
   - Focus: Should be 60s
   - Ground: Should be 60s
   - Visualize: Should be 90s
   - Mantra: Should be 60s
   - Seal: Should be 15s

**Expected Results:**
- [ ] Each phase duration accurate within ±1 second
- [ ] Total ritual time: ~285 seconds (4:45)
- [ ] No timer drift

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 12.2 Pause/Resume Ritual (if implemented)
**Steps:**
1. Start ritual
2. Pause mid-phase
3. Wait 10 seconds
4. Resume
5. Complete ritual

**Expected Results:**
- [ ] Timer pauses correctly
- [ ] Resume continues from paused time
- [ ] Progress ring updates correctly
- [ ] Total time includes pause duration

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 12.3 Cancel Ritual
**Steps:**
1. Start ritual
2. Cancel mid-way
3. Return to anchor detail

**Expected Results:**
- [ ] Ritual cancelled
- [ ] No charge record created
- [ ] Anchor remains uncharged
- [ ] User returned to previous screen

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Flow 13: Notifications (if implemented)
**Priority:** P2 (Nice-to-have)

##### 13.1 Daily Reminder Notification
**Steps:**
1. Enable daily reminder
2. Set time to 1 minute from now
3. Wait for notification

**Expected Results:**
- [ ] System notification appears at set time
- [ ] Notification title/body relevant
- [ ] Tapping notification opens app to Vault
- [ ] Notification repeats daily

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

##### 13.2 Streak Protection Alert
**Steps:**
1. Build a 3-day activation streak
2. Skip a day
3. Check for alert

**Expected Results:**
- [ ] Notification sent warning about streak
- [ ] User prompted to activate
- [ ] Streak count accurate

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

---

## Edge Cases & Boundary Conditions

### Edge Case 1: Maximum Anchors
**Scenario:** User creates 50+ anchors

**Expected Behavior:**
- [ ] No performance degradation
- [ ] Vault scrolls smoothly
- [ ] All anchors load correctly
- [ ] Database handles large queries

**Test Steps:**
1. Create 50 anchors
2. Navigate to Vault
3. Scroll through all anchors
4. Check load times

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 2: Extremely Long Intention
**Scenario:** User enters 100-character intention (max limit)

**Expected Behavior:**
- [ ] Full text accepted
- [ ] Displays correctly in all views
- [ ] No truncation in database
- [ ] Text wraps properly in UI

**Test Steps:**
1. Create anchor with 100-char intention
2. View in Vault card
3. View in detail screen
4. Check database record

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 3: Special Characters in Intention
**Scenario:** Intention includes emojis, symbols, Unicode

**Test Intention:** "I am 💪 powerful & ready to succeed! 🎯"

**Expected Behavior:**
- [ ] Special characters accepted
- [ ] Distillation handles Unicode correctly
- [ ] Displays correctly throughout app
- [ ] Saved correctly in UTF-8 database

**Test Steps:**
1. Create anchor with special characters
2. Check distillation output
3. View in multiple screens
4. Verify database encoding

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 4: Rapid Anchor Creation
**Scenario:** User creates 5 anchors in quick succession

**Expected Behavior:**
- [ ] All anchors created successfully
- [ ] No duplicate IDs
- [ ] Correct totalAnchorsCreated count
- [ ] No race conditions

**Test Steps:**
1. Create 5 anchors back-to-back (< 1 min total)
2. Check Vault for all 5
3. Verify database has 5 distinct records
4. Check user stats

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 5: Charge Interrupted (App Backgrounded)
**Scenario:** User starts charge ritual, then backgrounds app

**Expected Behavior:**
- [ ] Ritual pauses or continues in background
- [ ] On foreground: Resume or restart
- [ ] No charge created if incomplete
- [ ] Timer state preserved or reset

**Test Steps:**
1. Start deep charge ritual
2. Background app at phase 3
3. Wait 30 seconds
4. Return to app

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 6: Activation Interrupted
**Scenario:** User starts activation, then app crashes

**Expected Behavior:**
- [ ] No partial activation created
- [ ] activationCount not incremented
- [ ] User can retry

**Test Steps:**
1. Start activation
2. Force quit app at 5 seconds
3. Restart app
4. Check anchor activation count

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 7: Simultaneous Activations (Multiple Devices)
**Scenario:** User activates same anchor on two devices at once

**Expected Behavior:**
- [ ] Both activations recorded
- [ ] activationCount += 2
- [ ] No data corruption
- [ ] Sync handles concurrent writes

**Test Steps:**
1. Login on two devices
2. Activate same anchor simultaneously
3. Check activationCount
4. Verify database has 2 Activation records

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 8: Delete Account with Active Anchors
**Scenario:** User with 10 charged anchors deletes account

**Expected Behavior:**
- [ ] All anchors cascade deleted
- [ ] All activations deleted
- [ ] All charges deleted
- [ ] BurnedAnchor records also deleted (or retained for analytics)
- [ ] Complete data purge

**Test Steps:**
1. Create account with 10 anchors
2. Charge and activate several
3. Delete account
4. Check database for orphaned records

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 9: Invalid JWT Token
**Scenario:** Manually corrupt token in AsyncStorage

**Expected Behavior:**
- [ ] Auth fails gracefully
- [ ] User logged out
- [ ] Redirect to login
- [ ] No app crash

**Test Steps:**
1. Login successfully
2. Corrupt token in AsyncStorage
3. Make API call
4. Observe behavior

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 10: AI Enhancement Timeout
**Scenario:** AI enhancement takes > 30 seconds

**Expected Behavior:**
- [ ] Loading state shown
- [ ] Timeout after X seconds (e.g., 60s)
- [ ] Error message shown
- [ ] User can retry or skip
- [ ] Partial anchor saved

**Test Steps:**
1. Request AI enhancement
2. Simulate slow API or timeout
3. Observe behavior

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 11: Mantra Audio Generation Failure
**Scenario:** TTS service fails to generate audio

**Expected Behavior:**
- [ ] Error caught
- [ ] mantraText still saved
- [ ] User can read mantra without audio
- [ ] Retry option available

**Test Steps:**
1. Generate mantra
2. Simulate TTS failure
3. Check anchor record
4. Verify UI handles missing audio

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 12: Offline Login Attempt
**Scenario:** User tries to login while offline

**Expected Behavior:**
- [ ] Network error detected
- [ ] Error message: "Cannot login while offline"
- [ ] No infinite loading
- [ ] User prompted to check connection

**Test Steps:**
1. Logout
2. Disable network
3. Attempt login

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 13: Session Expiry During Ritual
**Scenario:** JWT expires mid-ritual

**Expected Behavior:**
- [ ] Ritual completes locally
- [ ] On sync: Auth error caught
- [ ] User prompted to re-login
- [ ] Ritual data preserved in SyncQueue

**Test Steps:**
1. Start ritual
2. Manually expire token
3. Complete ritual
4. Observe sync behavior

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 14: Database Migration During Active Session
**Scenario:** Backend deploys schema change while user is active

**Expected Behavior:**
- [ ] API version handling (if implemented)
- [ ] Graceful degradation or error
- [ ] User data not corrupted

**Test Steps:**
1. Use app actively
2. Deploy backend with schema change
3. Continue using app
4. Verify behavior

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

### Edge Case 15: Rapid Settings Changes
**Scenario:** User rapidly toggles settings 10+ times

**Expected Behavior:**
- [ ] All changes persisted
- [ ] No race conditions
- [ ] Final state matches last toggle
- [ ] No API call flooding (debounced or queued)

**Test Steps:**
1. Toggle same setting 10 times rapidly
2. Check settingsStore
3. Check database
4. Verify final state

**Actual Results:**

**Status:** [ ] Pass [ ] Fail

---

## Bug Tracking Template

### Bug Report Format

**Bug ID:** BUG-001
**Priority:** P0 / P1 / P2
**Status:** Open / In Progress / Fixed / Closed
**Severity:** Critical / High / Medium / Low

**Title:** [Short description]

**Description:**
[Detailed description of the bug]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Device: [iPhone 14 / Android Pixel 7]
- OS Version: [iOS 17.2 / Android 14]
- App Version: [1.0.0]
- Backend Version: [1.0.0]

**Screenshots/Videos:**
[Attach if applicable]

**Logs:**
```
[Error logs from ErrorTrackingService or console]
```

**Assignee:** [Developer name]
**Related Test Case:** [Flow X.Y]

---

### Priority Definitions

**P0 - Blocking / Critical**
- App crashes or is unusable
- Data loss or corruption
- Security vulnerabilities
- Core flows completely broken (login, anchor creation, activation)
- Must fix before release

**P1 - High Priority**
- Major feature broken but workaround exists
- Significant UX degradation
- Important flows partially broken
- Performance issues
- Should fix before release

**P2 - Medium Priority**
- Minor bugs with minimal impact
- Edge cases
- UI polish issues
- Nice-to-have features
- Can be deferred to next release

---

## Bugs Discovered During Testing

### BUG-001
**Priority:** [TBD]
**Status:** Open
**Title:** [To be filled during testing]

**Description:**

**Steps to Reproduce:**
1.
2.
3.

**Expected:**

**Actual:**

**Environment:**

---

### BUG-002
[Template ready for next bug]

---

## Regression Test Checklist

### Pre-Release Validation
Run this checklist before every release to ensure core functionality works.

---

#### Authentication
- [ ] New user can sign up
- [ ] User can login with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] User can logout
- [ ] Session persists across app restarts
- [ ] Account deletion works completely

---

#### Onboarding
- [ ] New user sees onboarding flow
- [ ] Onboarding can be completed
- [ ] Returning user skips onboarding
- [ ] hasCompletedOnboarding flag set correctly

---

#### Anchor Creation
- [ ] Can create anchor with minimal path (no optional steps)
- [ ] Can create anchor with all optional steps (reinforcement, AI, mantra)
- [ ] Intention validation works (3-100 chars)
- [ ] Distillation algorithm accurate
- [ ] baseSigilSvg generated and valid
- [ ] Anchor appears in Vault after creation
- [ ] totalAnchorsCreated incremented

---

#### Anchor Charging
- [ ] Quick charge (30s) completes successfully
- [ ] Deep charge (5 phases) completes successfully
- [ ] Timer accuracy verified
- [ ] Haptic feedback works
- [ ] Seal gesture recognized
- [ ] Charge record created in database
- [ ] Anchor.isCharged set to true
- [ ] Charged badge appears in Vault

---

#### Anchor Activation
- [ ] 10-second activation completes
- [ ] Activation record created
- [ ] activationCount incremented
- [ ] totalActivations incremented
- [ ] lastActivatedAt updated
- [ ] Toast notification shown
- [ ] Can activate multiple times

---

#### Anchor Burning
- [ ] Burn confirmation dialog shows
- [ ] Can cancel burn
- [ ] Burning ritual animation plays
- [ ] Anchor archived to BurnedAnchor table
- [ ] Anchor removed from Vault
- [ ] Backend deletion successful

---

#### Settings & Preferences
- [ ] All practice settings update and persist
- [ ] Notification settings save correctly
- [ ] Theme changes apply immediately
- [ ] Vault layout toggle works
- [ ] Audio/haptic settings apply during rituals
- [ ] Settings sync to backend
- [ ] Settings load on app restart

---

#### Vault & Navigation
- [ ] All anchors display in grid
- [ ] Pull-to-refresh syncs anchors
- [ ] Empty state shows for new users
- [ ] Anchor cards show correct data (symbol, intention, badge, count)
- [ ] Navigation to detail screen works
- [ ] FAB opens create anchor flow

---

#### Error Handling
- [ ] Network errors show appropriate messages
- [ ] API errors caught and logged
- [ ] 401 errors trigger logout
- [ ] App doesn't crash on errors
- [ ] Error toasts display correctly

---

#### Offline Mode
- [ ] Offline indicator shown when disconnected
- [ ] Actions queue in SyncQueue (if implemented)
- [ ] Sync processes on reconnect
- [ ] Offline login blocked with error message

---

#### Performance
- [ ] Vault loads quickly with 20+ anchors
- [ ] Scrolling is smooth
- [ ] Ritual animations don't lag
- [ ] No memory leaks during extended use
- [ ] API calls complete in reasonable time (< 5s)

---

#### Data Integrity
- [ ] No data loss on app restart
- [ ] Counts (activations, charges) accurate
- [ ] Timestamps correct (chargedAt, lastActivatedAt)
- [ ] No duplicate records created
- [ ] Cascade deletes work properly

---

#### Security
- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens secure and validated
- [ ] Auth required for protected endpoints
- [ ] No sensitive data in logs
- [ ] Account deletion purges all data

---

### Test Execution Summary

**Date:** [TBD]
**Tester:** [Name]
**Environment:** [iOS/Android, Versions]

**Total Tests:** 100+
**Passed:** [Count]
**Failed:** [Count]
**Blocked:** [Count]
**Bugs Found:** [Count]

**P0 Bugs:** [Count]
**P1 Bugs:** [Count]
**P2 Bugs:** [Count]

**Release Recommendation:** ✅ READY / ❌ NOT READY

**Notes:**
[Overall findings and recommendations]

---

## Next Steps

1. Execute all test cases in this document
2. Document bugs as they're found
3. Prioritize bugs (P0 → P1 → P2)
4. Fix P0 bugs immediately
5. Re-test after fixes
6. Run regression checklist
7. Sign off for release

---

**Document Version:** 1.0
**Last Updated:** 2026-01-31
**Owner:** [Your Name]
