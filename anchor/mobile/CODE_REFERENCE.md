# Code Reference — Your Anchor Screen Refactor

**Quick lookup for developers integrating or extending the refactored screen.**

---

## Component Exports

### 1. GlassIconButton
**Location:** `src/components/common/GlassIconButton.tsx`
**Export:** `src/components/common/index.ts`

```tsx
import { GlassIconButton } from '@/components/common';

<GlassIconButton
  onPress={() => navigation.goBack()}
  accessibilityLabel="Back"
  size="md"  // 'sm' | 'md' | 'lg'
  testID="back-button"
>
  <Text>←</Text>
</GlassIconButton>
```

**Props:**
```ts
interface GlassIconButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  size?: 'sm' | 'md' | 'lg';  // defaults to 'md' (44x44)
  testID?: string;
  style?: any;
}
```

**Sizes:**
- `sm`: 40x40 (compact)
- `md`: 44x44 (default, recommended minimum hit area)
- `lg`: 52x52 (prominent)

**Features:**
- ✅ iOS: BlurView glass effect
- ✅ Android: rgba fallback
- ✅ Haptic feedback (safeHaptics.impact Light)
- ✅ Full accessibility (role, label, keyboard support)
- ✅ Soft gold shadow for depth

---

### 2. Intention Pattern Detection
**Location:** `src/utils/intentionPatterns.ts`

```tsx
import {
  analyzeIntention,
  getGuidanceText,
  detectFutureTense,
  detectNegation,
} from '@/utils/intentionPatterns';

const result = analyzeIntention(intentionText);
// result: { hasFutureTense, hasNegation, shouldShowGuidance }

if (result.shouldShowGuidance) {
  const hint = getGuidanceText(
    result.hasFutureTense,
    result.hasNegation
  );
  // render hint
}
```

**Patterns Detected:**

| Pattern | Examples | Output |
|---------|----------|--------|
| Future Tense | "I will", "I'm going to", "someday" | `hasFutureTense: true` |
| Negation | "don't", "stop", "won't", "not" | `hasNegation: true` |
| Both | "I won't fail" | Both flags true |

**Guidance Strings:**
- Future tense only → "Try present tense: 'I choose…' 'I am…' or 'I return…'"
- Negation only → "Try affirmative: 'I choose…' instead of 'I don't…'"
- Both → "Try present tense & affirmative: 'I choose…' or 'I return…'"

---

### 3. UndertoneLine (Existing)
**Location:** `src/components/common/UndertoneLine.tsx`

```tsx
import { UndertoneLine } from '@/components/common';

// Seal line (default variant)
<UndertoneLine
  text="Return to this symbol to train recall."
  variant="default"
/>

// Guide hint (emphasis variant)
<UndertoneLine
  text="Try present tense: 'I choose…' or 'I return…'"
  variant="emphasis"
/>
```

**Props:**
```ts
interface UndertoneLinesProps {
  text: string;
  variant?: 'default' | 'emphasis';  // defaults to 'default'
}
```

**Styling:**
- **default**: Tertiary text (#AAAAAA), italic, subtle gold pin
- **emphasis**: Secondary text (#C0C0C0), italic, softer border pin

---

## Screen Integration

### AnchorRevealScreen Updates
**Location:** `src/screens/create/AnchorRevealScreen.tsx`

**New Hooks:**
```tsx
const insets = useSafeAreaInsets();
const guideMode = useSettingsStore((state) => state.guideMode);
const intentionAnalysis = analyzeIntention(intentionText);
const guidanceText = getGuidanceText(
  intentionAnalysis.hasFutureTense,
  intentionAnalysis.hasNegation
);
```

**New Header:**
```tsx
<View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
  <GlassIconButton
    onPress={handleBack}
    accessibilityLabel="Back"
    size="md"
    testID="back-button"
  >
    <Text style={styles.backIcon}>←</Text>
  </GlassIconButton>
  <Text style={styles.headerTitle}>Your Anchor</Text>
  <View style={styles.headerSpacer} />
</View>
```

**Intention Card (No Quotes):**
```tsx
<Text
  style={styles.intentionText}
  numberOfLines={2}
  ellipsizeMode="tail"
>
  {intentionText}
</Text>
```

**Guide Hint (Conditional):**
```tsx
{guideMode && intentionAnalysis.shouldShowGuidance && guidanceText && (
  <View style={styles.guideHintContainer}>
    <UndertoneLine text={guidanceText} variant="emphasis" />
  </View>
)}
```

**Seal Line (Always):**
```tsx
<View style={styles.sealLineContainer}>
  <UndertoneLine
    text="Return to this symbol to train recall."
    variant="default"
  />
</View>
```

**CTA Helper (Guide Mode):**
```tsx
{guideMode && (
  <Text style={styles.ctaHelperText}>
    60 seconds. Look at the symbol. Repeat your phrase.
  </Text>
)}
```

---

## Theme Tokens

### Colors Used
```ts
colors.navy             // '#0F1419' — background
colors.gold             // '#D4AF37' — accents, icons
colors.bone             // '#F5F5DC' — primary text
colors.charcoal         // '#1A1A1D' — card bg
colors.silver           // '#C0C0C0' — labels
colors.text.secondary   // '#C0C0C0' — helper text
colors.text.undertone   // '#AAAAAA' — subtle guidance
colors.ritual.glassStrong    // rgba(12, 17, 24, 0.82) — Android glass fallback
colors.ritual.border         // rgba(212, 175, 55, 0.24) — subtle borders
colors.ritual.pin            // rgba(212, 175, 55, 0.55) — undertone pin
```

### Spacing Used
```ts
spacing.sm   // 8px
spacing.md   // 16px
spacing.lg   // 24px
spacing.xl   // 32px
```

### Typography Used
```ts
typography.h3       // Cinzel, 20px, 28px line height
typography.body     // Inter, 16px, 24px line height
typography.caption  // Inter, 12px, 16px line height
```

---

## Common Tasks

### Adjust Guide Hint Text
**File:** `src/utils/intentionPatterns.ts`

```ts
export function getGuidanceText(
  hasFutureTense: boolean,
  hasNegation: boolean
): string {
  if (hasFutureTense && hasNegation) {
    return 'Your custom text here...';  // ← Edit this
  }
  // ... other cases
}
```

### Change Seal Line Text
**File:** `src/screens/create/AnchorRevealScreen.tsx`

```tsx
<UndertoneLine
  text="Your custom seal line here..."  // ← Edit this
  variant="default"
/>
```

### Adjust CTA Helper Copy
**File:** `src/screens/create/AnchorRevealScreen.tsx`

```tsx
{guideMode && (
  <Text style={styles.ctaHelperText}>
    Your custom CTA text here...  {/* ← Edit this */}
  </Text>
)}
```

### Change Back Button Size
**File:** `src/screens/create/AnchorRevealScreen.tsx`

```tsx
<GlassIconButton
  size="lg"  // ← Change from 'md' to 'lg' or 'sm'
  // ...
/>
```

### Customize Guide Conditions
Currently: Shows hints if `guideMode === true` AND pattern detected

To change (e.g., only first-time users):
```tsx
const showHints = guideMode &&
  teachingStore.userFlags.hasCreatedFirstAnchor === false &&
  intentionAnalysis.shouldShowGuidance;

{showHints && <UndertoneLine text={guidanceText} variant="emphasis" />}
```

---

## Testing Hooks

### Simulate Guide Mode OFF
```tsx
// In test or via Settings screen
useSettingsStore.setState({ guideMode: false });
// Hints and CTA helper text will disappear
```

### Test Pattern Detection
```tsx
// Future tense
analyzeIntention('I will be calm')
// → { hasFutureTense: true, hasNegation: false, shouldShowGuidance: true }

// Negation
analyzeIntention('I stop worrying')
// → { hasFutureTense: false, hasNegation: true, shouldShowGuidance: true }

// Both
analyzeIntention("I won't fail")
// → { hasFutureTense: false, hasNegation: true, shouldShowGuidance: true }

// Neither
analyzeIntention('I am strong')
// → { hasFutureTense: false, hasNegation: false, shouldShowGuidance: false }
```

---

## Breaking Changes

**None.** This refactor is fully backward-compatible:
- ✅ Route params unchanged
- ✅ Navigation flow unchanged
- ✅ Screen export unchanged (`AnchorRevealScreen`)
- ✅ All new exports are additive

---

## Performance Notes

- **Intention analysis:** Runs once on component mount (inside component)
- **Pattern detection:** Simple regex (4 patterns), negligible overhead
- **Glass button:** BlurView only on iOS (native), Android fallback is plain View
- **Animations:** Already optimized with `useNativeDriver: true`

---

## Accessibility Checklist

- [x] Back button: ARIA role, label, keyboard support
- [x] High contrast: Gold on navy, bone on charcoal
- [x] Touch target: 44x44 minimum
- [x] Reduced motion: Animations use native driver (can be disabled globally)
- [x] Screen reader support: All text elements accessible
- [x] SafeAreaInsets: Header respects notch and system UI

---

**Last Updated:** 2026-02-18
**Version:** 1.0
