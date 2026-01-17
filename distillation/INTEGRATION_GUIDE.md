# Integration Guide: DistillationAnimationScreen

## Files Created
1. `DistillationAnimationScreen.tsx` - Main animation component
2. `navigation-types-update.ts` - Type definitions to add

## Integration Steps

### 1. Add to Navigator (VaultStackNavigator or CreateFlowNavigator)

```tsx
import DistillationAnimationScreen from '@/screens/create/DistillationAnimationScreen';

// In your Stack.Navigator:
<Stack.Screen 
  name="DistillationAnimation" 
  component={DistillationAnimationScreen}
  options={{ headerShown: false }} // Full-screen experience
/>
```

### 2. Update IntentionInputScreen Navigation

Replace the current navigation to SigilSelection with:

```tsx
// In IntentionInputScreen.tsx, when user taps "Continue"
navigation.navigate('DistillationAnimation', {
  intentionText: intention,
  category: selectedCategory,
  distilledLetters: result.finalLetters, // from distillation
});
```

### 3. User Flow After Integration

```
IntentionInput 
  ↓ (user taps Continue)
DistillationAnimation (NEW - 8 seconds, auto-plays)
  ↓ (auto-navigates)
SigilSelection
  ↓
Rest of flow...
```

## Features Implemented

✅ **4 Animation Phases** (2s each):
- Phase 0: Shows original intention
- Phase 1: Vowels fade out
- Phase 2: Duplicates vanish  
- Phase 3: Letters rotate/overlap
- Phase 4: Merge with gold glow

✅ **Haptic Feedback**:
- Light → Light → Medium → Heavy progression
- Uses expo-haptics (already in your dependencies)

✅ **Design System Compliant**:
- Navy background (#0F1419)
- Gold accents (#D4AF37)
- Cinzel for mystical text
- Progress dots like your onboarding

✅ **Performance**:
- Uses native driver for transforms
- Proper cleanup in useEffect
- 8-second total duration (quick, not skippable as requested)

## Customization Options

**Adjust timing**: Edit phase durations in the `phases` array (currently 2000ms each)
**Adjust haptics**: Change `ImpactFeedbackStyle` values (Light/Medium/Heavy)
**Skip animation**: Add a skip button in top-right if needed later

## Notes

- Screen auto-navigates to SigilSelection after completion
- No user interaction required (automated as requested)
- Phase labels follow Austin Osman Spare terminology
- "Technology of Forgetting" subtitle for mystical context
