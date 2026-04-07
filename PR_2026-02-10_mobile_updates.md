# PR: Mobile UI Refinements & Ritual Flow Terminology Update

## 🎯 Overview
This PR introduces comprehensive mobile UI improvements and a major terminology refactor across the Anchor app, aligning all user-facing language with the new ritual flow vocabulary: **"Enter Focus"** (quick activation) and **"Deep Charge"** (extended reinforcement). It also includes significant UI/UX enhancements to vault, ritual, and settings screens.

## 📊 Impact Summary
- **39 files modified** across mobile app
- **+2,264 / -1,409 lines**
- Focus areas: Settings, Rituals, Vault, Components, Tests

---

## 🔑 Major Changes

### 1. **Ritual Flow Terminology Refactor** 🔄

**Problem:** The app used inconsistent terminology ("Activate", "Reinforce", "Charge") that didn't clearly communicate the distinction between quick daily practice and deeper meditative sessions.

**Solution:** Unified all user-facing language around two clear concepts:
- **Enter Focus**: Quick daily ritual (10-60s) to reconnect with your anchor
- **Deep Charge**: Extended meditative session (1-10+ min) to strengthen the anchor-intention bond

#### Settings Screens Overhaul
**Files:** `settingsStore.ts`, `DefaultActivationScreen.tsx`, `DefaultChargeScreen.tsx`, `DailyPracticeGoalScreen.tsx`, `SettingsScreen.tsx`

- **Enter Focus Mode Screen** (formerly DefaultActivationScreen):
  - Title: "Enter Focus Mode"
  - Unified duration presets: **10s, 30s, 60s** (all modes)
  - Method descriptions simplified:
    - Visual Focus: "Gaze at your anchor symbol"
    - Mantra Focus: "Recite your mantra"
    - Full Focus: "Symbol + mantra together"
  - Added info card: "Enter Focus is a quick ritual (10–60s) to reconnect and lock in"

- **Deep Charge Defaults Screen** (formerly DefaultChargeScreen):
  - Title: "Deep Charge Defaults"
  - Duration presets: **1 min, 5 min, 10 min, Custom**
  - Style options:
    - Quick Charge: "Brief, regular reinforcement"
    - Ritual Charge: "Meditative, ceremonial session"
  - Added "Mantra audio by default" toggle
  - Added info card: "Deep Charge strengthens the bond between symbol and intention over time"
  - Backward compatibility: Legacy 30s preset shown only if currently selected

- **Daily Focus Goal Screen** (formerly DailyPracticeGoalScreen):
  - Title: "Daily Focus Goal"
  - Labels updated to "Focus Burst / day"
  - Added clarifier: "Counts Enter Focus sessions (10–60s). Deep Charge is optional"
  - Added ⚡ Zap icons to goal rows
  - Tightened info card copy

- **Settings Store Updates**:
  - Added `mantraAudioByDefault: boolean` to state
  - Updated `ChargeDurationPreset` type to include `'1m'`
  - Added setter: `setMantraAudioByDefault(enabled: boolean)`
  - Included in persistence layer

- **Settings Hub Updates**:
  - Navigation labels reflect new screen names
  - Summary values use consistent formatting:
    - "Visual Focus • 30s"
    - "Quick Charge • 5 min"

#### Ritual Screens Updates
**Files:** `ActivationScreen.tsx`, `ChargeSetupScreen.tsx`, `ChargeCompleteScreen.tsx`, `RitualScreen.tsx`, `SealAnchorScreen.tsx`

- Updated all ritual flow copy to use "Enter Focus" and "Deep Charge" terminology
- Refined instructional text to match new vocabulary
- Ensured consistency across the full ritual experience

---

### 2. **Vault Screen Enhancements** 🏛️

**File:** `AnchorDetailScreen.tsx` (+961 / -XXX lines - major expansion)

**New Features:**
- **Enhanced anchor detail view** with improved layout and information hierarchy
- **State-aware UI** that adapts based on anchor charge level and activation status
- **Improved action buttons** with clearer CTAs aligned to ritual vocabulary
- **Better visual hierarchy** using Zen Architect design system

**Files:** `VaultScreen.tsx`, `SigilHeroCard.tsx`, `PracticePathCard.tsx`, `PhysicalAnchorCard.tsx`

- Refined card components for consistency
- Updated state helpers in `anchorStateHelpers.ts` for better anchor lifecycle management
- Improved visual feedback for charged vs. uncharged states

---

### 3. **Component & UI Improvements** 🎨

**New Components:**
- `CustomDurationSheet.tsx` - Bottom sheet for custom duration input (new file)
- `PremiumAnchorGlow.tsx` - Visual treatment for pro-tier anchors (new file)
- `FocusSession.tsx` - Extracted focus session logic (new file)

**Updated Components:**
- `AnchorCard.tsx` - Refined visual differentiation for different anchor states
- `AnchorLimitModal.tsx` - Complete rewrite for better UX (459 lines refactored)
- `AnchorFocalPoint.tsx` - Improved focal point rendering
- `ActiveAnchorsGrid.tsx` - Better grid layout and responsiveness

**Toast & Error Handling:**
- `Toast.tsx`, `ToastProvider.tsx` - Enhanced toast system
- Updated all toast-related tests

---

### 4. **Intention Input & Category Detection** 🎯

**New Utility:** `categoryDetection.ts` (120 lines)

Implemented smart category detection for anchor intentions using keyword analysis:
- **Career**: ~80 keywords (work, productivity, leadership, entrepreneurship)
- **Health**: ~60 keywords (fitness, meditation, nutrition, wellness)
- **Wealth**: ~50 keywords (money, investment, abundance, financial freedom)
- **Relationships**: ~50 keywords (love, family, connection, communication)
- **Personal Growth**: ~70 keywords (mindfulness, transformation, purpose, wisdom)
- **Custom**: Fallback for uncategorized intentions

**Files:** `IntentionInputScreen.tsx`, `ReturningIntentionScreen.tsx`
- Integrated category detection into intention creation flow
- Improved UX with category-based suggestions

---

### 5. **Test Updates & Quality** ✅

**Updated Test Files:**
- `ActivationScreen.test.tsx` - Major refactor (309 lines)
- `BurningRitualScreen.test.tsx` - Updated for new terminology
- `ConfirmBurnScreen.test.tsx` - Updated assertions
- `ErrorBoundary.test.tsx`, `Toast.test.tsx`, `ToastProvider.test.tsx` - Component tests
- `BreathingAnimation.test.tsx`, `DurationSelectionStep.test.tsx` - Ritual component tests
- `ApiClient.test.ts` - Service layer tests

**Test Infrastructure:**
- Updated `setup.ts` with better mock providers
- Added jest configuration files

---

### 6. **Type System Updates** 📐

**File:** `types/index.ts`

- Added `AnchorCategory` type for intention categorization
- Updated anchor state types for better type safety
- Enhanced ritual flow types to match new terminology

---

### 7. **Developer Tools** 🛠️

**New Files:**
- `reset-dev-override.js` - Utility to reset developer subscription overrides
- `useReduceMotionEnabled.ts` - Hook for accessibility preferences

---

## 🎨 Design System Compliance

All changes maintain strict adherence to the **Zen Architect** design system:
- Navy backgrounds (#0F1419)
- Gold accents (#D4AF37)
- Glassmorphic cards with subtle blur
- 16px border radius for premium feel
- Subtle animations (150-250ms)
- High contrast for accessibility (WCAG AA)
- Touch targets ≥ 44px

---

## 🔄 Migration & Backward Compatibility

### Settings Migration
- Existing settings automatically migrate to new structure
- Legacy `'30s'` Deep Charge preset preserved for users with that setting
- All new defaults align with "Enter Focus" / "Deep Charge" vocabulary

### Data Integrity
- No breaking changes to backend APIs
- AsyncStorage keys remain stable
- Zustand store version bumped with migration logic

---

## ✅ Testing Checklist

### Manual Testing (Android & iOS)
- [ ] Settings persistence across app restarts
- [ ] Correct summaries in Settings hub
- [ ] Navigation titles match new terminology
- [ ] Duration chip selection (10s, 30s, 60s for Enter Focus)
- [ ] Duration chip selection (1m, 5m, 10m for Deep Charge)
- [ ] Custom duration input validation
- [ ] Mantra audio toggle persists
- [ ] Category detection works for various intention texts
- [ ] Ritual flow uses new "Enter Focus" language
- [ ] Vault screens show correct state indicators
- [ ] Toast notifications display correctly

### Accessibility
- [ ] VoiceOver/TalkBack reads new labels correctly
- [ ] Touch targets meet minimum size
- [ ] Color contrast passes WCAG AA
- [ ] Reduce motion preference respected

---

## 📝 Breaking Changes

**None** - This is a UI/terminology update only. All internal data structures remain compatible.

---

## 🚀 Deployment Notes

1. **Database**: No migrations required
2. **Cache**: Users may need to restart app to see new Settings labels
3. **Analytics**: Update event names to track "Enter Focus" and "Deep Charge" separately

---

## 📸 Screenshots

_[Add before/after screenshots of key screens:]_
- Settings hub (old vs new labels)
- Enter Focus Mode screen
- Deep Charge Defaults screen
- Daily Focus Goal screen
- Vault anchor detail view

---

## 🔗 Related Work

- Builds on previous ritual flow improvements
- Complements the Zen Architect design system
- Prepares for March 1 beta launch

---

## 👥 Reviewers

**Focus Areas:**
- @UX-Lead: Terminology consistency, information hierarchy
- @Mobile-Lead: Component architecture, performance
- @QA: Test coverage, edge cases in settings migration

---

## 📅 Timeline

- **Created:** 2026-02-10
- **Target Merge:** 2026-02-11
- **Release:** Included in March 1 beta

---

## ✨ Key Wins

1. **Clear Mental Models**: Users now have distinct concepts for quick vs. deep practice
2. **Unified Terminology**: Consistent language across Settings, Rituals, and Vault
3. **Enhanced Discoverability**: Category detection helps users understand anchor themes
4. **Improved Vault**: Better visual feedback for anchor states
5. **Robust Testing**: Comprehensive test coverage for critical flows

---

## 🙏 Acknowledgments

Special thanks to the design team for the refined ritual vocabulary and to early beta testers for feedback on the terminology clarity.
