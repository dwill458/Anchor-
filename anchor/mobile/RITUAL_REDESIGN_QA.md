# Ritual Redesign QA Checklist

## Phase 2.7: Zen Architect Ritual Experience

**Redesigned Flow:** ChargeSetup → Ritual → ChargeComplete

---

## 🎯 Core Functionality

### ChargeSetupScreen

- [ ] **Navigation**: Back button returns to AnchorDetail
- [ ] **Anchor Loading**: Graceful error handling if anchor not found
- [ ] **Symbol Display**: Anchor SVG renders correctly, subtle pulse animation
- [ ] **Intention Display**: Intention text displays properly (max 2 lines)
- [ ] **Quick Charge Button**: Navigates to Ritual screen with `ritualType: 'quick'`
- [ ] **Deep Charge Button**: Navigates to Ritual screen with `ritualType: 'deep'`
- [ ] **Info Button**: Opens bottom sheet modal
- [ ] **Info Sheet**: Displays educational content, "Got it" button closes modal
- [ ] **Haptics**: Medium haptic on Quick/Deep button press, light haptic on info button

### RitualScreen (Quick Charge - 30s)

- [ ] **Auto-start**: Ritual starts immediately on mount
- [ ] **Symbol Display**: Centered anchor SVG (200px)
- [ ] **Charging Ring**: Gold progress ring animates 0→360° over 30 seconds
- [ ] **Progress Accuracy**: Ring progress matches elapsed time
- [ ] **Phase Title**: "Focus" displays below symbol
- [ ] **Instructions**: 3 rotating instructions change every ~6 seconds
- [ ] **Instruction Transitions**: Smooth fade in/out between instructions
- [ ] **Timer Display**: Shows "0:XX remaining" format correctly
- [ ] **Haptics**: Light haptic pulse every 5 seconds during ritual
- [ ] **Seal Phase Entry**: Last 3 seconds show "Press and hold to seal" prompt
- [ ] **Seal Glow**: Gold pulsing animation on seal prompt
- [ ] **Long-Press Gesture**: Press and hold fills bronze ring around symbol
- [ ] **Seal Progress**: Bronze ring fills from 0→360° over 1.5 seconds
- [ ] **Seal Cancel**: Releasing before complete resets seal progress
- [ ] **Seal Success**: Completing seal triggers strong haptic + navigation
- [ ] **Back Button**: Shows exit confirmation alert
- [ ] **Exit Confirmation**: "Exit Ritual?" alert with Cancel/Exit options

### RitualScreen (Deep Charge - 5min)

- [ ] **Phase Indicator**: "Phase X of 5" displays at top
- [ ] **Phase 1 (30s)**: "Breathwork" title, breathwork instructions
- [ ] **Phase 2 (60s)**: "Mantra" title, mantra instructions
- [ ] **Phase 3 (90s)**: "Visualization" title, visualization instructions
- [ ] **Phase 4 (30s)**: "Transfer" title, transfer instructions
- [ ] **Phase 5 (90s)**: "Seal" title, seal instructions
- [ ] **Phase Transitions**: Medium haptic on each phase change
- [ ] **Instruction Rotation**: Instructions rotate within each phase
- [ ] **Progress Ring**: Accurately reflects progress through all 5 phases
- [ ] **Haptics**: Light haptic every 10 seconds throughout ritual
- [ ] **Seal Phase**: Last 3 seconds same behavior as Quick Charge
- [ ] **Total Duration**: Ritual completes in ~5 minutes (300s)

### ChargeCompleteScreen

- [ ] **Entry Animation**: Fade in + scale up on mount
- [ ] **Success Haptic**: Success notification haptic on mount
- [ ] **Check Icon**: Gold check icon displays
- [ ] **Status Text**: "Anchor Charged" + subtitle display correctly
- [ ] **Symbol Display**: Anchor SVG renders with gold glow
- [ ] **Glow Animation**: Pulsing glow effect loops continuously
- [ ] **Intention Display**: Intention text shows correctly
- [ ] **Save to Vault Button**: Primary glassmorphic button with gold border
- [ ] **Save to Vault Action**: Navigates to Vault screen
- [ ] **Activate Now Button**: Secondary text button with underline
- [ ] **Activate Now Action**: Navigates to ActivationRitual screen
- [ ] **Haptics**: Medium haptic on "Save to Vault", light on "Activate Now"

---

## 🛡️ Null Safety & Error Handling

### Anchor Data Validation

- [ ] **ChargeSetupScreen**: Anchor not found shows error state with "Go Back" button
- [ ] **RitualScreen**: Anchor not found shows error message
- [ ] **ChargeCompleteScreen**: Anchor not found shows error message
- [ ] **Navigation Guard**: Cannot reach Ritual screen without valid anchorId
- [ ] **Store Sync**: Anchor updates persist to Zustand store correctly
- [ ] **Backend Sync**: `updateAnchor` API call succeeds after ritual completion

### Defensive Coding

- [ ] **All anchor properties**: Safe access with optional chaining where needed
- [ ] **SVG rendering**: Handles missing/invalid SVG gracefully
- [ ] **Timer intervals**: All intervals cleaned up on unmount
- [ ] **Animation refs**: No memory leaks from animation refs
- [ ] **Phase transitions**: No crashes on rapid navigation/back button presses

---

## 🎨 Visual Design (Zen Architect Theme)

### Colors & Typography

- [ ] **Backgrounds**: Navy (#0F1419) primary, charcoal (#1A1A1D) secondary
- [ ] **Gold Accents**: Gold (#D4AF37) used for borders, text, buttons
- [ ] **Glassmorphism**: BlurView components render correctly on iOS/Android
- [ ] **Text Hierarchy**: Cinzel for headings, Inter for body
- [ ] **Contrast**: All text meets WCAG AA standards for readability

### Layout & Spacing

- [ ] **Symbol Centering**: Anchor symbol perfectly centered in Ritual screen
- [ ] **Charging Ring**: Ring positioned correctly around symbol
- [ ] **Vertical Rhythm**: Consistent spacing (use theme spacing values)
- [ ] **Responsive**: Layout adapts to different screen sizes
- [ ] **Safe Areas**: Content respects safe area insets on notched devices

### Animations

- [ ] **Smooth Transitions**: All animations use `useNativeDriver: true`
- [ ] **No Jank**: 60fps animation performance (check with Perf Monitor)
- [ ] **Fade Transitions**: Instruction text fades smoothly
- [ ] **Progress Ring**: Ring animation is smooth and linear
- [ ] **Glow Effects**: Pulsing glow doesn't cause performance issues
- [ ] **Entry Animations**: ChargeCompleteScreen fade-in feels premium

---

## ♿ Accessibility

- [ ] **Tap Targets**: All buttons ≥44x44pt touch target
- [ ] **Readable Text**: Body text ≥14pt, sufficient contrast
- [ ] **Screen Reader**: Meaningful labels for interactive elements (if implemented)
- [ ] **Reduce Motion**: Consider respecting system reduce motion setting (optional)

---

## 📱 Platform Testing

### iOS

- [ ] **BlurView**: Glassmorphic effects render correctly
- [ ] **Haptics**: All haptic feedback works as expected
- [ ] **Safe Area**: Notch/Dynamic Island handled correctly
- [ ] **Animations**: Smooth 60fps performance
- [ ] **Modal**: Bottom sheet modal works correctly

### Android

- [ ] **BlurView**: Glassmorphic effects render (may differ from iOS)
- [ ] **Haptics**: Vibration works as expected
- [ ] **System UI**: Status bar/navigation bar handled correctly
- [ ] **Animations**: Smooth performance on mid-range devices
- [ ] **Modal**: Bottom sheet modal works correctly
- [ ] **Back Button**: Hardware back button triggers exit confirmation

---

## 🔄 Integration Testing

### Navigation Flow

- [ ] **Entry Point**: AnchorDetail → ChargeSetup works correctly
- [ ] **Quick Path**: ChargeSetup → Ritual (quick) → ChargeComplete → Vault
- [ ] **Deep Path**: ChargeSetup → Ritual (deep) → ChargeComplete → Vault
- [ ] **Activation Path**: ChargeComplete → Activate Now → ActivationRitual
- [ ] **Back Navigation**: All back button behaviors work as expected
- [ ] **State Persistence**: No state leaks between ritual sessions

### Data Flow

- [ ] **Anchor Loading**: Anchor fetched from store correctly
- [ ] **Charge Status**: `isCharged` updated to `true` after completion
- [ ] **Charge Timestamp**: `chargedAt` set to current Date
- [ ] **Store Update**: Changes reflected in Vault immediately
- [ ] **Backend Sync**: Anchor charge status synced to API

---

## 🐛 Bug Fixes Verified

### Original Issues Addressed

- [x] **"This is REAL" CTA**: Removed from Quick Charge intensity prompts
- [x] **Text-heavy UI**: Reduced explanatory text, moved to info sheet
- [x] **Symbol Centering**: Anchor symbol now centered in Ritual screen
- [x] **Defensive Framing**: CTAs changed to action-oriented ("Begin", "Lock in")
- [x] **Null Conversion Error**: Defensive checks prevent null access
- [ ] **Toast Error**: Verify "Cannot convert null value to object" no longer appears

### Edge Cases

- [ ] **Rapid Tapping**: Multiple rapid taps don't cause duplicate navigation
- [ ] **Timer Completion**: Seal phase always shows even if timer reaches 0
- [ ] **Background/Foreground**: App returning from background doesn't break ritual
- [ ] **Network Failure**: Graceful handling if API call fails
- [ ] **Low Memory**: No crashes on low-end devices

---

## 🚀 Performance

- [ ] **Mount Time**: ChargeSetupScreen mounts in <500ms
- [ ] **Animation FPS**: All animations maintain 60fps
- [ ] **Memory Usage**: No memory leaks during ritual
- [ ] **Bundle Size**: No significant increase in app bundle size

---

## 📝 Copy Validation

### Quick Charge Instructions

- [x] "Feel it in your body"
- [x] "This moment is yours"
- [x] "See it as already done"

### Deep Charge Phase Copy

**Phase 1 - Breathwork:**
- [x] "Slow inhale. Longer exhale."
- [x] "Feel your center."
- [x] "Steady breath, steady mind."

**Phase 2 - Mantra:**
- [x] "Speak it softly. Let it sink in."
- [x] "Repeat until you believe it."
- [x] "Your words shape reality."

**Phase 3 - Visualization:**
- [x] "See the result. Feel it now."
- [x] "Make it vivid. Make it real."
- [x] "Every detail matters."

**Phase 4 - Transfer:**
- [x] "Push the intention into the symbol."
- [x] "Channel your focus here."
- [x] "Anchor it in place."

**Phase 5 - Seal:**
- [x] "Hold steady. Seal the link."
- [x] "Feel the connection lock in."
- [x] "This is your anchor now."

### UI Copy

- [x] ChargeSetupScreen: "Charge Your Anchor"
- [x] Quick Charge: "30 seconds • Instant focus boost"
- [x] Deep Charge: "~5 minutes • 5 phases for lasting impact"
- [x] Seal Prompt: "Press and hold to seal"
- [x] Completion: "Anchor Charged • Your intention is locked in"

---

## ✅ Sign-Off

**Tested By:** _______________
**Date:** _______________
**Build Version:** _______________
**Device:** _______________
**OS Version:** _______________

**Issues Found:** _______________
**Blocker Issues:** _______________
**Ready for Production:** ☐ Yes  ☐ No
