# Quick Integration Guide: Abstract Sigil System
## For AI Assistants

**TL;DR**: 3 files to create, 5 files to modify in `anchor-v2/` directory.

---

## 📁 Where to Put Files

### 1. Abstract Symbol Generator
**File**: `abstract-symbol-generator.ts`  
**Location**: `anchor-v2/src/utils/sigil/abstract-symbol-generator.ts`  
**Action**: CREATE NEW

### 2. Distillation Animation Screen
**File**: `DistillationAnimationScreen.tsx`  
**Location**: `anchor-v2/src/screens/create/DistillationAnimationScreen.tsx`  
**Action**: CREATE NEW

### 3. Sigil Selection Screen
**File**: `SigilSelectionScreen-ZenTheme.tsx`  
**Location**: `anchor-v2/src/screens/create/SigilSelectionScreen.tsx`  
**Action**: REPLACE EXISTING (backup first!)

---

## 🔧 What to Modify

### Modification 1: Add Route Type
**File**: `anchor-v2/src/types/index.ts`  
**Add**:
```typescript
DistillationAnimation: {
  intentionText: string;
  category: AnchorCategory;
  distilledLetters: string[];
};
```
**Where**: Between `IntentionInput` and `SigilSelection` in `RootStackParamList`

---

### Modification 2: Register Screen
**File**: `anchor-v2/src/navigation/VaultStackNavigator.tsx`  
**Add**:
```typescript
import DistillationAnimationScreen from '@/screens/create/DistillationAnimationScreen';

<Stack.Screen 
  name="DistillationAnimation" 
  component={DistillationAnimationScreen}
  options={{ headerShown: false }}
/>
```
**Where**: Between IntentionInput and SigilSelection screens

---

### Modification 3: Update Navigation
**File**: `anchor-v2/src/screens/create/IntentionInputScreen.tsx`  

**Change**:
```typescript
// OLD
navigation.navigate('SigilSelection', { ... });

// NEW
navigation.navigate('DistillationAnimation', { ... });
```
**Where**: In the "Continue" button handler

---

### Modification 4: Update Exports
**File**: `anchor-v2/src/screens/create/index.ts`  
**Add**: `export { default as DistillationAnimationScreen } from './DistillationAnimationScreen';`

**File**: `anchor-v2/src/utils/sigil/index.ts`  
**Add**: `export { generateAbstractSigil, generateAllVariants, VARIANT_METADATA } from './abstract-symbol-generator';`

---

## 🔄 User Flow After Integration

```
IntentionInput 
  ↓ (tap Continue)
DistillationAnimation (8 seconds, auto-advances)
  ↓
SigilSelection (choose from 3 abstract symbols)
  ↓
Next screen
```

---

## ✅ Verification Checklist

- [ ] 3 files created in correct locations
- [ ] Route type added to `types/index.ts`
- [ ] Screen registered in navigator
- [ ] IntentionInput navigates to DistillationAnimation
- [ ] Export files updated
- [ ] Animation plays (8 seconds)
- [ ] Symbols look abstract/geometric (NOT letters)
- [ ] No TypeScript errors

---

## 🐛 Quick Troubleshooting

**Module not found**: Check file paths match exactly  
**Type errors**: Add route to `RootStackParamList`  
**No navigation**: Register screen in Stack.Navigator  
**Still see letters**: Update import to `abstract-symbol-generator`

---

## 📦 Dependencies (should be installed)
- `react-native-svg`
- `expo-haptics`
- `expo-blur`
- `expo-linear-gradient`

---

**Total Integration Time**: ~20 minutes  
**Important**: Always use `anchor-v2/` directory, not `frontend/`
