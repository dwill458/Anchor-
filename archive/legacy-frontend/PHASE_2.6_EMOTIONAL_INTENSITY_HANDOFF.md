# ANCHOR APP - Phase 2.6: Emotional Intensity & Burning Ritual

## 📋 Overview

**Phase**: 2.6 - Emotional Enhancement
**Status**: Ready for Implementation
**Priority**: High (Core to sigil effectiveness per Phil Cooper's methodology)
**Duration**: ~2-3 weeks

**What's Being Added**:
1. **Intent Formatting Helper** - Real-time guidance for optimal intention phrasing
2. **Emotional Priming Screen** - 15-second pre-charge preparation
3. **Intensity Prompts** - Dynamic emotional cues during charging
4. **Enhanced Deep Charge** - Emotional cues for each phase
5. **Burning Ritual** - Complete anchor release ceremony

**Reference**: Phil Cooper's "Basic Sigil Magic" - Pages 3-10
- Page 3-4: Present tense, declarative statements
- Page 6-7: Emotional intensity during charging
- Page 8-9: Destruction/release of sigil

---

## 🎯 Goals

### User Experience Goals
- Help users write **more effective** intentions (present tense, declarative)
- Build **emotional intensity** before and during charging
- Provide **guided destruction** ritual for anchors that have served their purpose
- Increase anchor effectiveness through proper methodology

### Technical Goals
- Maintain Zen Architect design consistency
- Add zero breaking changes to existing flows
- Ensure graceful degradation (features optional)
- Keep animations smooth (60fps)

---

## 🎨 Design System Adherence

All new screens must follow the **Zen Architect** theme visible in screenshots:

### Colors (from `frontend/src/theme/colors.ts`)
```typescript
Navy Background:     #0F1419  // Primary background
Charcoal Cards:      #1A1A1D  // Card backgrounds
Gold Primary:        #D4AF37  // CTAs, highlights, borders
Bone Text:           #F5F5DC  // Primary text
Silver Secondary:    #C0C0C0  // Secondary text
Deep Purple:         #3E2C5B  // Letter boxes, accents
Success Green:       #4CAF50  // Positive feedback
Warning Orange:      #FF8C00  // Warnings, intensity
Error Red:           #F44336  // Errors, destructive actions
```

### Typography
```typescript
Headings:   Cinzel-Regular    (elegant serif)
Body:       Inter-Regular     (clean sans-serif)
Mono:       RobotoMono-Regular (code/technical)

Sizes:
h1: 32pt    h2: 24pt    h3: 20pt    h4: 18pt
body1: 16pt body2: 14pt caption: 12pt button: 16pt
```

### Spacing Scale
```typescript
xs: 4    sm: 8    md: 16    lg: 24
xl: 32   xxl: 48  xxxl: 64
```

**NO ARBITRARY VALUES** - Always use the spacing scale!

### Card Pattern (from screenshots)
```typescript
// Standard card with gold border
{
  backgroundColor: colors.charcoal,
  borderWidth: 2,
  borderColor: colors.gold,
  borderRadius: spacing.md,
  padding: spacing.lg
}

// Selected card
{
  borderColor: colors.gold,
  borderWidth: 3,
  // + checkmark icon in top-right
}
```

---

## 📱 Feature 1: Intent Formatting Helper

### Location
**Screen**: `IntentionInputScreen.tsx` (existing)
**Modification**: Add formatting helper below text input

### User Problem
Users write intentions in ways that reduce effectiveness:
- ❌ "I want to be successful" (wanting = lack)
- ❌ "I will close the deal" (future = not now)
- ❌ "I hope to find peace" (doubt)

### Solution
Real-time feedback showing optimal phrasing:
- ✅ "I am successful" (present, confident)
- ✅ "I close this deal" (declarative)
- ✅ "I have inner peace" (affirmative)

### UI Layout

```
┌─────────────────────────────────────┐
│ Create Anchor                       │ ← Header
├─────────────────────────────────────┤
│                                     │
│ [Text Input: 100 chars max]        │ ← Existing
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💡 Intent Formatting Tips      │ │ ← NEW
│ │ [Expandable accordion]          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✨ Your intention is powerful!  │ │ ← NEW
│ │    and clear.                   │ │ ← Feedback
│ └─────────────────────────────────┘ │
│                                     │
│ Distillation Preview...             │ ← Existing
└─────────────────────────────────────┘
```

### Component Structure

```typescript
// IntentionInputScreen.tsx - ADD THIS SECTION

// After text input, before distillation preview:
<View style={styles.formattingSection}>
  {/* Collapsible tips */}
  <TouchableOpacity 
    onPress={() => setShowTips(!showTips)}
    style={styles.tipsHeader}
  >
    <Text style={styles.tipsTitle}>💡 Intent Formatting Tips</Text>
    <Text style={styles.expandIcon}>{showTips ? '▼' : '▶'}</Text>
  </TouchableOpacity>

  {showTips && (
    <View style={styles.tipsContent}>
      <Text style={styles.tipsLabel}>✅ Use Present Tense:</Text>
      <Text style={styles.tipsExample}>
        "I am closing the deal" (not "I will close")
      </Text>
      
      <Text style={styles.tipsLabel}>✅ Be Declarative:</Text>
      <Text style={styles.tipsExample}>
        "I have perfect health" (not "I want health")
      </Text>
      
      <Text style={styles.tipsLabel}>✅ Remove Doubt:</Text>
      <Text style={styles.tipsExample}>
        "Success flows to me" (not "I hope to succeed")
      </Text>
    </View>
  )}

  {/* Real-time feedback */}
  <IntentFormatFeedback intentionText={intentionText} />
</View>
```

### IntentFormatFeedback Component

```typescript
// NEW COMPONENT: IntentFormatFeedback.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';

interface IntentFormatFeedbackProps {
  intentionText: string;
}

interface IntentAnalysis {
  isOptimal: boolean;
  hasWantingWords: boolean;
  hasFutureTense: boolean;
  hasDoubtWords: boolean;
  hasPresentTense: boolean;
  suggestions: string[];
}

const analyzeIntent = (text: string): IntentAnalysis => {
  const lowercaseText = text.toLowerCase();
  
  const hasWantingWords = /\b(want|need|wish|desire|hope|pray)\b/.test(lowercaseText);
  const hasFutureTense = /\b(will|shall|going to|gonna|someday|eventually)\b/.test(lowercaseText);
  const hasDoubtWords = /\b(maybe|might|could|perhaps|hopefully|try)\b/.test(lowercaseText);
  const hasPresentTense = /\b(am|is|are|have|has|being|exists?)\b/.test(lowercaseText);
  
  const suggestions: string[] = [];
  
  if (hasWantingWords) {
    suggestions.push("Replace 'want/need/wish' with 'am/have/is'");
  }
  if (hasFutureTense) {
    suggestions.push("Use present tense ('I am' not 'I will')");
  }
  if (hasDoubtWords) {
    suggestions.push("Remove doubt words like 'maybe/might/try'");
  }
  
  const isOptimal = hasPresentTense && !hasWantingWords && !hasFutureTense && !hasDoubtWords;
  
  return {
    isOptimal,
    hasWantingWords,
    hasFutureTense,
    hasDoubtWords,
    hasPresentTense,
    suggestions,
  };
};

export const IntentFormatFeedback: React.FC<IntentFormatFeedbackProps> = ({ 
  intentionText 
}) => {
  // Don't show feedback until user has typed something meaningful
  if (!intentionText || intentionText.length < 3) {
    return null;
  }
  
  const analysis = analyzeIntent(intentionText);
  
  if (analysis.isOptimal) {
    return (
      <View style={[styles.feedbackContainer, styles.successFeedback]}>
        <Text style={styles.successIcon}>✨</Text>
        <Text style={styles.successText}>
          Your intention is powerful and clear!
        </Text>
      </View>
    );
  }
  
  if (analysis.suggestions.length === 0) {
    return null;
  }
  
  return (
    <View style={[styles.feedbackContainer, styles.suggestionFeedback]}>
      <Text style={styles.suggestionIcon}>💡</Text>
      <View style={styles.suggestionTextContainer}>
        {analysis.suggestions.map((suggestion, index) => (
          <Text key={index} style={styles.suggestionText}>
            • {suggestion}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  successFeedback: {
    backgroundColor: `${colors.success}15`, // 15% opacity
    borderColor: colors.success,
  },
  suggestionFeedback: {
    backgroundColor: `${colors.warning}15`,
    borderColor: colors.warning,
  },
  successIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  successText: {
    flex: 1,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.success,
    fontWeight: '600',
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.warning,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
});
```

### Validation Rules

```typescript
// Validation before allowing navigation to next screen

const validateIntentFormatting = (text: string): { 
  isValid: boolean; 
  warning?: string 
} => {
  const analysis = analyzeIntent(text);
  
  // Don't block, but warn user
  if (!analysis.isOptimal) {
    return {
      isValid: true, // Allow proceeding
      warning: 'Your intention could be more powerful. Consider rephrasing in present tense.'
    };
  }
  
  return { isValid: true };
};
```

### Acceptance Criteria
- [ ] Expandable "Intent Formatting Tips" section
- [ ] Real-time feedback appears as user types
- [ ] Green success feedback for optimal phrasing
- [ ] Orange suggestion feedback for non-optimal
- [ ] Detects wanting words (want, need, wish, hope)
- [ ] Detects future tense (will, shall, going to)
- [ ] Detects doubt words (maybe, might, try)
- [ ] Detects present tense (am, is, are, have, has)
- [ ] User can proceed regardless (non-blocking)
- [ ] Follows design system colors and spacing

---

## 📱 Feature 2: Emotional Priming Screen

### Purpose
Prepare user emotionally before charging ritual begins. Get them into optimal state.

### User Flow Position
```
ChargeChoiceScreen
  ↓ User selects Quick or Deep
EmotionalPrimingScreen  ← NEW (15 seconds)
  ↓ Auto-advance
QuickChargeScreen / DeepChargeScreen
```

### Screen Layout

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│         Before we begin...          │ ← h2, Gold
│                                     │
│  Charging requires emotional        │
│  intensity.                         │ ← body1, Bone
│                                     │
│  Take a moment to FEEL your desire. │
│  Not just think it — FEEL it.       │
│                                     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │   [Pulsing intention quote]   │  │ ← Animated
│  │   "Close the deal"            │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│                                     │
│         ╭─────────╮                 │
│         │   15    │                 │ ← Large countdown
│         ╰─────────╯                 │
│                                     │
│                                     │
│   Feel the desire in your body      │ ← Rotating prompt
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Implementation

```typescript
// NEW FILE: frontend/src/screens/rituals/EmotionalPrimingScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  SafeAreaView,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';

type EmotionalPrimingRouteProp = RouteProp<RootStackParamList, 'EmotionalPriming'>;
type EmotionalPrimingNavigationProp = StackNavigationProp<RootStackParamList, 'EmotionalPriming'>;

const DURATION_SECONDS = 15;
const PROMPT_ROTATION_INTERVAL = 4000; // ms

const EMOTIONAL_PROMPTS = [
  'Feel the desire in your body',
  'Make it real in your mind',
  'This is YOUR moment',
  'Pure intention. Pure focus.',
  'Feel it with every fiber',
  'Believe it is already true',
];

export const EmotionalPrimingScreen: React.FC = () => {
  const route = useRoute<EmotionalPrimingRouteProp>();
  const navigation = useNavigation<EmotionalPrimingNavigationProp>();
  
  const { anchorId, intention, chargeType } = route.params;
  
  const [countdown, setCountdown] = useState(DURATION_SECONDS);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Countdown timer
  useEffect(() => {
    // Start with medium haptic
    ReactNativeHapticFeedback.trigger('impactMedium');
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleComplete();
          return 0;
        }
        
        // Haptic every 3 seconds
        if (prev % 3 === 0) {
          ReactNativeHapticFeedback.trigger('impactLight');
        }
        
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Rotate prompts
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromptIndex((prev) => (prev + 1) % EMOTIONAL_PROMPTS.length);
      
      // Fade animation on prompt change
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, PROMPT_ROTATION_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);
  
  // Intention pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  const handleComplete = () => {
    // Success haptic
    ReactNativeHapticFeedback.trigger('notificationSuccess');
    
    // Navigate to appropriate charging screen
    if (chargeType === 'quick') {
      navigation.replace('QuickCharge', { anchorId, chargeType: 'initial_quick' });
    } else {
      navigation.replace('DeepCharge', { anchorId, chargeType: 'initial_deep' });
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Before we begin...</Text>
        
        <Text style={styles.instruction}>
          Charging requires emotional intensity.
          {'\n\n'}
          Take a moment to FEEL your desire.
          {'\n'}
          Not just think it — <Text style={styles.emphasis}>FEEL</Text> it.
        </Text>
        
        {/* Pulsing intention */}
        <Animated.View 
          style={[
            styles.intentionContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
          <Text style={styles.intentionText}>"{intention}"</Text>
        </Animated.View>
        
        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>
        
        {/* Rotating emotional prompt */}
        <Animated.View 
          style={[
            styles.promptContainer,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.promptText}>
            {EMOTIONAL_PROMPTS[currentPromptIndex]}
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.gold,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  instruction: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
  },
  emphasis: {
    fontWeight: '700',
    color: colors.gold,
  },
  intentionContainer: {
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    minWidth: '80%',
  },
  intentionLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  intentionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.gold,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  countdownContainer: {
    marginBottom: spacing.xxl,
  },
  countdown: {
    fontFamily: typography.fonts.heading,
    fontSize: 72,
    color: colors.gold,
    textAlign: 'center',
  },
  promptContainer: {
    paddingHorizontal: spacing.lg,
  },
  promptText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
```

### Navigation Integration

```typescript
// types/index.ts - ADD NEW ROUTE

export type RootStackParamList = {
  // ... existing routes
  
  EmotionalPriming: {
    anchorId: string;
    intention: string;
    chargeType: 'quick' | 'deep';
  };
  
  // ... rest
};
```

```typescript
// ChargeChoiceScreen.tsx - MODIFY navigation calls

// OLD:
navigation.navigate('QuickCharge', { anchorId, chargeType: 'initial_quick' });

// NEW:
navigation.navigate('EmotionalPriming', {
  anchorId,
  intention: anchor.intentionText,
  chargeType: 'quick'
});
```

### Acceptance Criteria
- [ ] 15-second countdown timer
- [ ] Pulsing intention quote animation
- [ ] 6 rotating emotional prompts (every 4 seconds)
- [ ] Fade transition between prompts
- [ ] Haptic feedback: start (medium), every 3s (light), complete (success)
- [ ] Auto-navigate to QuickCharge or DeepCharge
- [ ] Full-screen immersive experience
- [ ] Follows design system

---

## 📱 Feature 3: Intensity Prompts for Quick Charge

### Current State
QuickChargeScreen has 30-second countdown with haptics every 5 seconds. Works well but lacks emotional intensity cues.

### Enhancement
Add dynamic text prompts that build intensity as countdown progresses.

### Prompt Timing Strategy

```typescript
// Intensity crescendo approach
const INTENSITY_PROMPTS = [
  { time: 30, text: 'Focus begins', intensity: 'low', haptic: 'impactMedium' },
  { time: 25, text: 'Feel it with every fiber', intensity: 'medium', haptic: 'impactMedium' },
  { time: 20, text: 'This is REAL', intensity: 'high', haptic: 'impactMedium' },
  { time: 15, text: 'Channel pure desire', intensity: 'high', haptic: 'impactHeavy' },
  { time: 10, text: 'Make it undeniable', intensity: 'high', haptic: 'impactHeavy' },
  { time: 5, text: 'BELIEVE IT NOW', intensity: 'peak', haptic: 'impactHeavy' },
];
```

### Visual Design

```
┌─────────────────────────────────────┐
│                                     │
│  [Sigil - 70% screen width]        │
│                                     │
│                                     │
│         ╭─────────╮                 │
│         │   23    │                 │ ← Gold countdown
│         ╰─────────╯                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  CHANNEL PURE DESIRE        │   │ ← NEW: Intensity prompt
│  └─────────────────────────────┘   │  (Gold glow effect)
│                                     │
│  Hold your focus on the symbol      │ ← Existing instruction
│  and your intention                 │
│                                     │
│  "Close the deal"                   │ ← Intention quote
│                                     │
└─────────────────────────────────────┘
```

### Implementation

```typescript
// QuickChargeScreen.tsx - MODIFY EXISTING FILE

// Add state for current prompt
const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);

// Add animation value for prompt
const promptOpacity = useRef(new Animated.Value(0)).current;
const promptScale = useRef(new Animated.Value(0.8)).current;

// Modify countdown effect to check for prompts
useEffect(() => {
  const interval = setInterval(() => {
    setSecondsRemaining((prev) => {
      const newValue = prev - 1;

      // Check for intensity prompt at this second
      const prompt = INTENSITY_PROMPTS.find(p => p.time === newValue);
      
      if (prompt) {
        // Trigger prompt
        setCurrentPrompt(prompt.text);
        ReactNativeHapticFeedback.trigger(prompt.haptic);
        
        // Animate in
        Animated.parallel([
          Animated.timing(promptOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(promptScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
        
        // Fade out after 2 seconds
        setTimeout(() => {
          Animated.timing(promptOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            setCurrentPrompt(null);
            promptScale.setValue(0.8);
          });
        }, 2000);
      } else {
        // Regular haptic pulse every 5 seconds
        if (newValue > 0 && newValue % 5 === 0) {
          ReactNativeHapticFeedback.trigger('impactLight');
        }
      }

      if (newValue <= 0) {
        handleComplete();
        return 0;
      }

      return newValue;
    });
  }, 1000);

  return () => clearInterval(interval);
}, []);

// Add to render (between timer and instruction)
{currentPrompt && (
  <Animated.View
    style={[
      styles.intensityPrompt,
      {
        opacity: promptOpacity,
        transform: [{ scale: promptScale }],
      },
    ]}
  >
    <Text style={styles.intensityText}>{currentPrompt}</Text>
  </Animated.View>
)}
```

### Styles

```typescript
// Add to QuickChargeScreen styles

intensityPrompt: {
  marginTop: spacing.xl,
  marginBottom: spacing.md,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  backgroundColor: `${colors.gold}20`, // 20% opacity
  borderWidth: 2,
  borderColor: colors.gold,
  borderRadius: spacing.md,
  // Glow effect
  shadowColor: colors.gold,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 10,
  elevation: 10,
},
intensityText: {
  fontFamily: typography.fonts.heading,
  fontSize: typography.sizes.h3,
  color: colors.gold,
  textAlign: 'center',
  fontWeight: '700',
  letterSpacing: 1,
},
```

### Acceptance Criteria
- [ ] Prompts appear at: 25s, 20s, 15s, 10s, 5s
- [ ] Each prompt fades in over 300ms
- [ ] Prompts stay visible for 2 seconds
- [ ] Prompts fade out over 400ms
- [ ] Stronger haptic for later prompts (impactHeavy at 15s, 10s, 5s)
- [ ] Gold glow effect around prompt box
- [ ] Prompts use Cinzel heading font
- [ ] Text is bold and impactful
- [ ] No performance issues (maintain 60fps)

---

## 📱 Feature 4: Enhanced Deep Charge Emotional Cues

### Current State
DeepChargeScreen has 5 phases with basic instructions. Works but could be more emotionally engaging.

### Enhancement
Add secondary "emotional cue" text to each phase that guides feeling/intensity.

### Phase Updates

```typescript
// DeepChargeScreen.tsx - UPDATE PHASES array

interface Phase {
  number: number;
  title: string;
  instruction: string;
  emotionalCue: string; // NEW
  durationSeconds: number;
}

const PHASES: Phase[] = [
  {
    number: 1,
    title: 'Breathe and Center',
    instruction: 'Take slow, deep breaths. Clear your mind and prepare to focus.',
    emotionalCue: 'Feel yourself becoming calm and ready. Release all distractions.',
    durationSeconds: 30,
  },
  {
    number: 2,
    title: 'Repeat Your Intention',
    instruction: 'Silently or aloud, repeat your intention with conviction.',
    emotionalCue: 'Say it like you MEAN it. Feel the truth of these words.',
    durationSeconds: 60,
  },
  {
    number: 3,
    title: 'Visualize Success',
    instruction: 'See yourself achieving this goal. Make it vivid and real.',
    emotionalCue: 'Feel the joy of success NOW. Let it overwhelm you.',
    durationSeconds: 90,
  },
  {
    number: 4,
    title: 'Connect to Symbol',
    instruction: 'Touch the screen. Feel your intention flowing into the symbol.',
    emotionalCue: 'Your energy is pouring into this anchor. Feel the connection.',
    durationSeconds: 30,
  },
  {
    number: 5,
    title: 'Hold Focus',
    instruction: 'Maintain your focus on the symbol. Feel the connection.',
    emotionalCue: 'This moment is everything. Pure. Total. Complete focus.',
    durationSeconds: 90,
  },
];
```

### Visual Layout Update

```
┌─────────────────────────────────────┐
│ [Progress Bar: 40%]                 │
│ Phase 2 of 5                        │
│                                     │
│  Repeat Your Intention              │ ← Phase title (h2, Gold)
│                                     │
│  [Sigil]                            │
│                                     │
│  Silently or aloud, repeat your     │ ← Instruction (body1, Bone)
│  intention with conviction.         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Say it like you MEAN it.    │   │ ← NEW: Emotional cue
│  │ Feel the truth of these     │   │ (body2, Warning Orange)
│  │ words.                      │   │ (Slightly transparent bg)
│  └─────────────────────────────┘   │
│                                     │
│         ╭─────────╮                 │
│         │   52    │                 │ ← Timer
│         ╰─────────╯                 │
│                                     │
│  "Close the deal"                   │ ← Intention quote
└─────────────────────────────────────┘
```

### Implementation

```typescript
// DeepChargeScreen.tsx - UPDATE render section

// After instruction text, add:
{currentPhase.emotionalCue && (
  <View style={styles.emotionalCueContainer}>
    <Text style={styles.emotionalCueText}>
      {currentPhase.emotionalCue}
    </Text>
  </View>
)}
```

### Styles

```typescript
// Add to DeepChargeScreen styles

emotionalCueContainer: {
  marginTop: spacing.md,
  marginHorizontal: spacing.lg,
  padding: spacing.md,
  backgroundColor: `${colors.warning}15`, // 15% opacity
  borderLeftWidth: 3,
  borderLeftColor: colors.warning,
  borderRadius: spacing.sm,
},
emotionalCueText: {
  fontFamily: typography.fonts.body,
  fontSize: typography.sizes.body2,
  color: colors.warning,
  lineHeight: 20,
  fontStyle: 'italic',
},
```

### Acceptance Criteria
- [ ] All 5 phases have emotional cues
- [ ] Cues display below main instruction
- [ ] Orange/warning color for emphasis
- [ ] Left border accent (3px)
- [ ] Slightly transparent background
- [ ] Italic text style for feeling/emotion
- [ ] Cues emphasize FEELING not just doing
- [ ] No layout shift (cue container always renders)

---

## 📱 Feature 5: Burning Ritual

### Purpose
Allow users to **permanently archive** anchors that have served their purpose. Based on Phil Cooper's instruction to "destroy or forget" sigils after successful manifestation.

### When to Use
- Goal has been achieved/manifested
- User wants to "let go" and trust the unconscious
- Anchor no longer feels relevant
- Decluttering vault

### User Flow

```
AnchorDetailScreen
  ↓ User taps three-dot menu → "Burn & Release"
ConfirmBurnScreen
  ↓ User confirms destruction
BurningRitualScreen (5-10 seconds)
  ↓ Animation completes
VaultScreen (anchor removed from grid)
```

### Database Changes

```sql
-- Anchors table already has these fields:
isArchived: boolean (default false)
archivedAt: timestamp | null

-- When burning:
UPDATE anchors 
SET isArchived = true, archivedAt = NOW() 
WHERE id = :anchorId;

-- Vault query excludes archived:
SELECT * FROM anchors 
WHERE userId = :userId AND isArchived = false;
```

### Screen 1: Confirm Burn

```
┌─────────────────────────────────────┐
│ 🔥 Burn & Release                   │ ← Header
├─────────────────────────────────────┤
│                                     │
│  [Sigil preview - 50% size]        │
│                                     │
│  "Close the deal"                   │ ← Intention
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ⚠️ Warning                  │   │
│  │                             │   │
│  │ This will permanently       │   │
│  │ archive this anchor.        │   │
│  │                             │   │
│  │ According to chaos magick,  │   │
│  │ destroying a sigil after    │   │
│  │ success helps the           │   │
│  │ unconscious work freely.    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Has this intention been     │   │
│  │ fulfilled or served its     │   │
│  │ purpose?                    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ BURN & RELEASE               │ │ ← Destructive button
│  └───────────────────────────────┘ │  (Red/error color)
│                                     │
│  [Cancel]                           │ ← Secondary button
│                                     │
└─────────────────────────────────────┘
```

### Screen 2: Burning Ritual

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│                                     │
│                                     │
│    [Sigil with fire animation]     │ ← Fading + particles
│         (dissolving)                │
│                                     │
│                                     │
│  Let go.                            │ ← Prompt fades in
│  Trust the process.                 │
│                                     │
│  Your intention has been released.  │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Implementation

```typescript
// NEW FILE: frontend/src/screens/rituals/ConfirmBurnScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';

type ConfirmBurnRouteProp = RouteProp<RootStackParamList, 'ConfirmBurn'>;
type ConfirmBurnNavigationProp = StackNavigationProp<RootStackParamList, 'ConfirmBurn'>;

export const ConfirmBurnScreen: React.FC = () => {
  const route = useRoute<ConfirmBurnRouteProp>();
  const navigation = useNavigation<ConfirmBurnNavigationProp>();
  
  const { anchorId, intention, sigilSvg } = route.params;
  
  const handleConfirm = () => {
    navigation.navigate('BurningRitual', {
      anchorId,
      intention,
      sigilSvg,
    });
  };
  
  const handleCancel = () => {
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Sigil preview */}
        <View style={styles.sigilContainer}>
          <SvgXml xml={sigilSvg} width={120} height={120} />
        </View>
        
        <Text style={styles.intention}>"{intention}"</Text>
        
        {/* Warning box */}
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>Warning</Text>
            <Text style={styles.warningText}>
              This will permanently archive this anchor.
              {'\n\n'}
              According to chaos magick, destroying a sigil after success helps the unconscious work freely.
            </Text>
          </View>
        </View>
        
        {/* Question box */}
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>
            Has this intention been fulfilled or served its purpose?
          </Text>
        </View>
        
        {/* Buttons */}
        <TouchableOpacity
          style={styles.burnButton}
          onPress={handleConfirm}
          activeOpacity={0.7}
        >
          <Text style={styles.burnButtonText}>🔥 BURN & RELEASE</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sigilContainer: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  intention: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.gold,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xl,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.error,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  warningText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.primary,
    lineHeight: 20,
  },
  questionBox: {
    backgroundColor: `${colors.gold}15`,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.xxl,
  },
  questionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    lineHeight: 22,
  },
  burnButton: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    marginBottom: spacing.md,
  },
  burnButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.button,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
```

```typescript
// NEW FILE: frontend/src/screens/rituals/BurningRitualScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { apiClient } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BURN_DURATION = 6000; // 6 seconds
const PROMPTS = [
  { text: 'Let go.', delay: 2000 },
  { text: 'Trust the process.', delay: 3500 },
  { text: 'Your intention has been released.', delay: 5000 },
];

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
  
  const { anchorId, intention, sigilSvg } = route.params;
  const { removeAnchor } = useAnchorStore();
  
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const promptOpacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    startBurningSequence();
  }, []);
  
  const startBurningSequence = async () => {
    // Initial deep haptic
    ReactNativeHapticFeedback.trigger('impactHeavy');
    
    // Sigil fade/scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: BURN_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: BURN_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Show prompts at timed intervals
    PROMPTS.forEach((prompt) => {
      setTimeout(() => {
        setCurrentPrompt(prompt.text);
        
        // Fade in prompt
        Animated.sequence([
          Animated.timing(promptOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
        
        // Light haptic with each prompt
        ReactNativeHapticFeedback.trigger('impactLight');
      }, prompt.delay);
    });
    
    // Complete after burn duration
    setTimeout(() => {
      handleComplete();
    }, BURN_DURATION + 1000);
  };
  
  const handleComplete = async () => {
    try {
      // Archive anchor in backend
      await apiClient.delete(`/api/anchors/${anchorId}`);
      
      // Remove from local store
      removeAnchor(anchorId);
      
      // Success haptic
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      
      // Navigate back to vault
      navigation.navigate('Vault');
    } catch (error) {
      console.error('Error burning anchor:', error);
      // Still navigate back even if API fails
      navigation.navigate('Vault');
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Burning sigil */}
        <Animated.View
          style={[
            styles.sigilContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <SvgXml xml={sigilSvg} width={SCREEN_WIDTH * 0.6} height={SCREEN_WIDTH * 0.6} />
        </Animated.View>
        
        {/* Prompts */}
        <Animated.View
          style={[
            styles.promptContainer,
            { opacity: promptOpacity },
          ]}
        >
          <Text style={styles.promptText}>{currentPrompt}</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  sigilContainer: {
    marginBottom: spacing.xxxl,
  },
  promptContainer: {
    paddingHorizontal: spacing.xl,
  },
  promptText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h3,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 32,
  },
});
```

### Add Menu Option to AnchorDetailScreen

```typescript
// AnchorDetailScreen.tsx - ADD three-dot menu

import { Menu, MenuItem } from 'react-native-material-menu';

// Add state
const [menuVisible, setMenuVisible] = useState(false);

// Add to header
<TouchableOpacity onPress={() => setMenuVisible(true)}>
  <Text style={styles.menuIcon}>⋮</Text>
</TouchableOpacity>

<Menu
  visible={menuVisible}
  anchor={<View />}
  onRequestClose={() => setMenuVisible(false)}
>
  <MenuItem
    onPress={() => {
      setMenuVisible(false);
      navigation.navigate('ConfirmBurn', {
        anchorId: anchor.id,
        intention: anchor.intentionText,
        sigilSvg: anchor.baseSigilSvg,
      });
    }}
  >
    🔥 Burn & Release
  </MenuItem>
</Menu>
```

### Navigation Types

```typescript
// types/index.ts - ADD NEW ROUTES

export type RootStackParamList = {
  // ... existing
  
  ConfirmBurn: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
  };
  
  BurningRitual: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
  };
  
  // ... rest
};
```

### Acceptance Criteria
- [ ] Three-dot menu on AnchorDetailScreen
- [ ] "Burn & Release" menu option
- [ ] Confirmation screen with warning
- [ ] Explanation of chaos magick principle
- [ ] Question about fulfillment
- [ ] Red destructive button
- [ ] 6-second burning animation
- [ ] Sigil fades and shrinks
- [ ] 3 prompts appear at intervals
- [ ] Deep haptic on start, light on prompts
- [ ] API call to archive anchor (DELETE /api/anchors/:id)
- [ ] Remove from local store
- [ ] Navigate back to vault
- [ ] Anchor no longer visible in grid
- [ ] Database: isArchived=true, archivedAt=now()

---

## 🗂 File Structure

```
frontend/src/
├── screens/
│   ├── create/
│   │   └── IntentionInputScreen.tsx (MODIFY - add formatting helper)
│   │
│   ├── rituals/
│   │   ├── EmotionalPrimingScreen.tsx (NEW)
│   │   ├── QuickChargeScreen.tsx (MODIFY - add intensity prompts)
│   │   ├── DeepChargeScreen.tsx (MODIFY - add emotional cues)
│   │   ├── ConfirmBurnScreen.tsx (NEW)
│   │   ├── BurningRitualScreen.tsx (NEW)
│   │   └── index.ts (UPDATE exports)
│   │
│   └── vault/
│       └── AnchorDetailScreen.tsx (MODIFY - add burn menu)
│
├── components/
│   └── IntentFormatFeedback.tsx (NEW)
│
└── types/
    └── index.ts (UPDATE navigation types)

backend/src/
└── api/routes/
    └── anchors.ts (NO CHANGES - DELETE route already exists)
```

---

## 📊 Implementation Phases

### Week 1: Intent Formatting & Emotional Priming
- [ ] Create `IntentFormatFeedback` component
- [ ] Modify `IntentionInputScreen` with formatting helper
- [ ] Create `EmotionalPrimingScreen`
- [ ] Update navigation flow
- [ ] Test formatting validation
- [ ] Test priming screen animations

### Week 2: Charging Intensity
- [ ] Add intensity prompts to `QuickChargeScreen`
- [ ] Add emotional cues to `DeepChargeScreen`
- [ ] Test haptic feedback patterns
- [ ] Test animation performance
- [ ] Ensure 60fps throughout

### Week 3: Burning Ritual
- [ ] Create `ConfirmBurnScreen`
- [ ] Create `BurningRitualScreen`
- [ ] Add menu to `AnchorDetailScreen`
- [ ] Update navigation types
- [ ] Test database archiving
- [ ] Test store state updates
- [ ] End-to-end burning flow test

---

## ✅ Testing Checklist

### Intent Formatting
- [ ] Suggestions appear for "want/need/wish"
- [ ] Suggestions appear for "will/shall/gonna"
- [ ] Suggestions appear for "maybe/might/try"
- [ ] Success feedback for optimal formatting
- [ ] Tips section expands/collapses
- [ ] User can proceed regardless of formatting
- [ ] No performance issues while typing

### Emotional Priming
- [ ] 15-second countdown works
- [ ] Intention pulses smoothly
- [ ] 6 prompts rotate every 4 seconds
- [ ] Prompts fade in/out smoothly
- [ ] Haptic feedback every 3 seconds
- [ ] Auto-navigates to correct charge screen
- [ ] Works for both quick and deep paths

### Quick Charge Intensity
- [ ] Prompts appear at 25s, 20s, 15s, 10s, 5s
- [ ] Each prompt animates in/out
- [ ] Stronger haptics for later prompts
- [ ] Gold glow effect visible
- [ ] No layout jumps
- [ ] 60fps maintained

### Deep Charge Emotional Cues
- [ ] All 5 phases show emotional cues
- [ ] Cues display in orange color
- [ ] Left border accent visible
- [ ] Italic font style applied
- [ ] No layout shift between phases

### Burning Ritual
- [ ] Menu appears on AnchorDetailScreen
- [ ] Confirmation screen shows warning
- [ ] Can cancel without burning
- [ ] Burning animation is smooth
- [ ] Sigil fades over 6 seconds
- [ ] Prompts appear at correct times
- [ ] Haptic feedback works
- [ ] API call succeeds
- [ ] Anchor removed from vault
- [ ] Database updated correctly
- [ ] Can burn multiple anchors
- [ ] Error handling if API fails

---

## 🎨 Design System Compliance Checklist

All new features must pass this checklist:

### Colors
- [ ] Only use colors from `@/theme/colors`
- [ ] Navy background (#0F1419) for screens
- [ ] Charcoal (#1A1A1D) for cards
- [ ] Gold (#D4AF37) for primary actions
- [ ] Warning orange (#FF8C00) for intensity
- [ ] Error red (#F44336) for destructive
- [ ] Success green (#4CAF50) for positive

### Typography
- [ ] Cinzel for all headings
- [ ] Inter for all body text
- [ ] RobotoMono only for code/technical
- [ ] Correct font sizes (h1-h4, body1-2, caption)
- [ ] No arbitrary font sizes

### Spacing
- [ ] All margins/padding use spacing scale
- [ ] xs:4, sm:8, md:16, lg:24, xl:32, xxl:48, xxxl:64
- [ ] No arbitrary spacing values
- [ ] Consistent spacing between elements

### Components
- [ ] Cards use standard gold border pattern
- [ ] Buttons match existing button styles
- [ ] Inputs use consistent styling
- [ ] Animations are smooth (60fps)
- [ ] Haptic feedback is appropriate

---

## 📈 Success Metrics

### User Engagement
- Measure % of users who:
  - Open "Intent Formatting Tips"
  - Edit intentions after seeing suggestions
  - Complete emotional priming screen
  - Use burning ritual feature

### Effectiveness Indicators
- Track:
  - Average intent optimality score (present tense, declarative)
  - Charging completion rates (with vs without priming)
  - Activation frequency (anchors with optimal intents)
  - Burning ritual usage (goal achievement signal)

### Technical Performance
- Monitor:
  - Animation frame rates (maintain 60fps)
  - Screen load times (<200ms)
  - Haptic feedback timing accuracy
  - Memory usage during animations

---

## 🚀 Launch Readiness

### Before Release
- [ ] All acceptance criteria met
- [ ] Design system compliance verified
- [ ] Unit tests written for new components
- [ ] Integration tests for new flows
- [ ] Performance profiling completed
- [ ] Haptic feedback tested on devices
- [ ] Animation smoothness verified
- [ ] Database migrations tested
- [ ] Error handling tested
- [ ] Offline behavior tested

### Documentation
- [ ] Update user-facing help docs
- [ ] Add tooltips where needed
- [ ] Update onboarding (if needed)
- [ ] Document new API calls
- [ ] Update CHANGELOG

---

## 📚 References

### Phil Cooper's Book
- Page 3-4: Statement of intent formatting
- Page 6-7: Emotional intensity during charging
- Page 8-9: Destruction/forgetting after firing
- Page 10: Energy and emotion importance

### Existing Code
- `IntentionInputScreen.tsx`: Pattern for input validation
- `QuickChargeScreen.tsx`: Timer and haptic patterns
- `DeepChargeScreen.tsx`: Phase-based structure
- `AnchorDetailScreen.tsx`: Menu and navigation
- Theme files: All design tokens

---

## 🎯 Summary

This phase implements the **psychological foundations** that make sigil magick effective:

1. **Intent Formatting** → Ensures optimal phrasing for unconscious
2. **Emotional Priming** → Prepares user for intensity
3. **Intensity Prompts** → Builds emotional crescendo
4. **Emotional Cues** → Guides feeling during deep work
5. **Burning Ritual** → Completes the cycle of manifestation

All features:
- ✅ Follow Phil Cooper's methodology
- ✅ Maintain Zen Architect design consistency
- ✅ Non-blocking (users can proceed anyway)
- ✅ Enhance without disrupting existing flows
- ✅ Add zero breaking changes

**Estimated Timeline**: 2-3 weeks
**Priority**: High (Core effectiveness features)
**Risk**: Low (All additive, no breaking changes)

---

**Ready for implementation!** 🚀
