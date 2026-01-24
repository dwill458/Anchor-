# Luxury Docked Bottom Bar - Implementation Summary

## Overview
Successfully redesigned the Choose Structure screen with a **luxury docked bottom bar** using an **outline CTA button** instead of a solid gold block. The new design is restrained, elegant, and follows the "Apple Pay meets ritual UI" aesthetic.

---

## 🎨 Key Visual Changes

### Before vs After

**Before:**
- Large solid gold button dominating the bottom
- "Continue with {Structure}" - verbose
- Button felt like a billboard, not a seal

**After:**
- Transparent outline button with 1.5px gold border
- Simple "Continue" label - premium brevity
- Docked glassmorphic bar - feels anchored and elegant
- "Selected · {name}" micro-text above button

---

## 📐 Component Architecture

### BottomDock.tsx (`components/common/BottomDock.tsx`)

**Design Specs:**
```tsx
Dock Position:
  - Absolute: left: 16, right: 16
  - Bottom: insets.bottom + 12
  - Border radius: 26px
  - Z-index: 10

Glass Effect:
  - BlurView intensity: 24
  - Border: rgba(212, 175, 55, 0.22) // Subtle gold edge
  - Shadow: soft 16px radius, 0.3 opacity

Contents (Vertical Stack):
  1. Selected Line (14px): "Selected · Focused"
     - "Selected" in silver (#C0C0C0)
     - Dot separator
     - Value in bone (#F5F5DC)
  
  2. Outline CTA Button (54px height):
     - Border: 1.5px, rgba(212, 175, 55, 0.70)
     - Background: transparent
     - Text: Bone (#F5F5DC), 600 weight
     - Internal highlight: subtle 1px line at top
     - Press state: scale down to 0.98

Disabled State:
  - Border opacity: 0.25
  - Overall opacity: 0.35
```

**Exported Constant:**
```tsx
export const DOCK_HEIGHT = 108;
// Breakdown: 14px text + 8px gap + 54px button + 16px top + 16px bottom
```

**Animation Timing:**
- Slide in/out: 240ms
- Scale press feedback: Spring animation (0.98)
- Matches spec: 220-280ms range

---

## 🔄 Screen Updates (StructureForgeScreen.tsx)

### Layout Changes

**Padding Calculation:**
```tsx
contentContainerStyle={[
  styles.scrollContent,
  { paddingBottom: DOCK_HEIGHT + spacing.xl }, // 108px + 32px = 140px
]}
```

**Why this prevents overlap:**
- `DOCK_HEIGHT` (108px) = exact height of dock
- `spacing.xl` (32px) = breathing room below last card
- Total 140px ensures last structure card is fully visible
- User can scroll to see entire selection list without obstruction

### Selection UX Flow

**Initial State:**
- First-time users: 'balanced' pre-selected
- Returning users: no selection (dock shows "Choose a structure", button disabled)

**On Selection:**
1. Haptic: `Haptics.selectionAsync()`
2. Card visual: Gold ring + scale 1.02 (subtle)
3. Dock updates: Shows "Selected · {name}"
4. Button: Enabled, ready for "Continue"

**Card Animations:**
```tsx
// Scale pulse: 1 → 1.02 → 1 (180ms + 200ms = 380ms total)
// More restrained than previous 1.03
```

**Card Selected Style:**
```tsx
variantCardSelected: {
  borderColor: 'rgba(212, 175, 55, 0.85)', // Strong gold ring
  backgroundColor: 'rgba(212, 175, 55, 0.04)', // Barely visible tint
  shadowColor: colors.gold,
  shadowOpacity: 0.15,
  shadowRadius: 6, // Subtle glow
}
```

### CTA Text Strategy

**Before:** `"Continue with Focused"` (verbose, cluttered)

**After:** `"Continue"` (simple, premium)

Rationale:
- Selected structure is already shown in "Selected · Focused" line
- No need to repeat in button
- Single-word CTA feels more confident and high-end
- Follows Apple Pay pattern (just "Pay", not "Pay with Card")

---

## 🎯 Design System Adherence

| Element | Spec | Implementation |
|---------|------|----------------|
| Background | Navy/charcoal gradient | ✅ ZenBackground |
| Accent | Gold #D4AF37 as edges/glow | ✅ Border, not fill |
| Primary text | Bone #F5F5DC | ✅ Button text |
| Secondary text | Silver #C0C0C0 | ✅ "Selected" label |
| Glass bar | Dark blur + thin gold border | ✅ BlurView + border |
| Spacing | 16px standard, 24px major | ✅ spacing.md, spacing.lg |
| Animation | 220-280ms ease-out | ✅ 240ms for dock, 180-200ms pulse |
| Button | Outline, not filled | ✅ Transparent + gold border |

---

## 🏗️ Where to Adjust Dock Height

**File:** `BottomDock.tsx`

**Constant to change:**
```tsx
export const DOCK_HEIGHT = 108;
```

**Impact:**
- Changes dock component height
- Automatically updates `paddingBottom` in StructureForgeScreen
- Recommended range: 92-120px
  - Below 92px: Feels cramped
  - Above 120px: Takes too much screen space

**Height Components:**
```
Current 108px = 14px (selected text)
              + 8px  (gap)
              + 54px (button)
              + 16px (top padding)
              + 16px (bottom padding)
```

To adjust:
- Change button height: Modify `ctaButton.height` in styles
- Change padding: Modify `content.paddingTop/paddingBottom`
- Update `DOCK_HEIGHT` to match new total

---

## ✅ Acceptance Test Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| Nothing hidden behind dock | ✅ | 140px padding reserves space |
| Dock feels anchored, glassy | ✅ | BlurView + rounded corners |
| No big gold rectangles | ✅ | Outline button only |
| Selection confirmed before action | ✅ | "Selected · {name}" line |
| Overall vibe: premium, calm | ✅ | Restrained design, no billboard effect |
| Hero hierarchy maintained | ✅ | Preview is largest element |
| CTA feels like seal, not billboard | ✅ | Small outline button at bottom |

---

## 🎬 Animation Flow

### Dock Slide-In (240ms)
```tsx
Animated.parallel([
  translateY: visible ? 0 : 120,
  opacity: visible ? 1 : 0,
])
```

### Selection Card Pulse (380ms total)
```tsx
Animated.sequence([
  scale: 1 → 1.02 (180ms),
  scale: 1.02 → 1 (200ms),
])
```

### Button Press Feedback
```tsx
Animated.spring([
  scale: 1 → 0.98 (press),
  scale: 0.98 → 1 (release),
])
```

---

## 📱 Responsive Behavior

**Safe Area Handling:**
```tsx
const insets = useSafeAreaInsets();
const bottomPosition = insets.bottom + 12;
```

- iPhone with notch: Dock sits above home indicator
- iPhone without notch: Dock has 12px bottom margin
- Android: Respects navigation bar

**Scroll Behavior:**
- Last card always accessible
- No content jump when scrolling
- Dock stays fixed during scroll

---

## 🔍 Comparison: Old vs New

### Old BottomCtaBar
- Solid gold background
- High visual weight
- "Continue with {name}" - verbose
- Helper text above button
- Felt dominant, not supportive

### New BottomDock
- Transparent outline button
- Minimal visual weight
- "Continue" - simple
- "Selected · {name}" - elegant
- Feels like a confirmation seal

---

## 🎨 Visual Hierarchy (Top to Bottom)

1. **Hero Preview** (Largest, most important)
   - Big structure visualization
   - Structure name below
   - Gold color, center focus

2. **"Available Structures" List** (Secondary)
   - Card grid with thumbnails
   - Selected card gets gold ring
   - Subtle scale animation

3. **Docked Bottom Bar** (Tertiary, supportive)
   - Small, restrained
   - Outline button (not filled)
   - Confirmation role, not advertisement

This hierarchy ensures the **structure preview is always the hero**, not the CTA.

---

## 🚀 Next Steps (Optional Enhancements)

1. **Conditional Dock Visibility:**
   - Hide dock completely when no selection
   - Animate in when user selects (currently always visible)

2. **Button Glow on Press:**
   - Add subtle gold glow shadow when pressed
   - Use `shadowOpacity` animation

3. **Selected Line Animation:**
   - Fade in "Selected · {name}" text when selection changes
   - Make transition feel more deliberate

4. **Accessibility Improvements:**
   - Announce "Selected {name}" to VoiceOver when card tapped
   - Add haptic feedback variation for different states

---

## 📝 Files Modified

1. **Created:**
   - `src/components/common/BottomDock.tsx` - New luxury outline dock

2. **Updated:**
   - `src/components/common/index.ts` - Export BottomDock
   - `src/screens/create/StructureForgeScreen.tsx` - Use BottomDock, update animations

3. **Unchanged (can be deprecated later):**
   - `src/components/common/BottomCtaBar.tsx` - Old solid gold bar (still exists)

---

## 🎯 Result

The Choose Structure screen now has a **luxury, restrained aesthetic**:
- **No visual clutter** from large gold blocks
- **Clear hierarchy** with preview as hero
- **Premium confirmation** pattern (outline button)
- **Calm ritual UX** that feels intentional, not pushy
- **Apple Pay vibe** - elegant seal, not billboard

The outline CTA button makes gold feel like an **accent and intention**, not a flood fill.

Perfect for a premium ritual experience. ✨
