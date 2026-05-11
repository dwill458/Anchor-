# Mantra Creation Screen – UX Refinement

**Date**: January 23, 2026
**Screen**: `MantraCreationScreen.tsx`
**Designer**: Senior UX Designer
**Objective**: Refine copy and UX to feel intuitive, embodied, and emotionally resonant while maintaining clean, modern, non-occult aesthetic

---

## Executive Summary

The current Mantra Creation screen suffers from over-explanation and technical language that creates cognitive distance from the embodied experience. This refinement reduces copy by ~60%, replaces technical terminology with sensory language, and improves tab hierarchy—all while maintaining accessibility for first-time users.

---

## 1. Headlines & Core Messaging

### Current State
```
Title: "Visual & Vocal Alignment"
Subtitle: "Create a unique sound resonance for your intention."
```

### Refined Recommendation

**Option A (Recommended)**
```
Title: "Your Vocal Anchor"
Subtitle: "Choose the sound that holds your intention."
```

**Option B (Alternative)**
```
Title: "Sound Signature"
Subtitle: "Select the pattern that anchors you."
```

**Rationale**:
- "Your Vocal Anchor" → personal, direct, artifact-focused
- "Choose the sound that holds your intention" → embodied, active, clear value prop
- Removes technical jargon ("sound resonance")
- Reduces word count: 13 words → 9 words

---

## 2. Section Title (Replace "Vocal Mastery")

### Current State
```
Hero Title: "Vocal Mastery"
Info Icon: Present
```

### Refined Recommendation

**Primary Recommendation**
```
Title: "Sound Signature"
Info Icon: Remove (rely on embodied copy instead)
```

**Alternatives**
```
- "Sonic Form"
- "Your Pattern"
- "Voice Print"
```

**Rationale**:
- "Vocal Mastery" implies skill/performance → creates pressure
- "Sound Signature" → artifact-like, professional, personal
- Removing Info icon reduces teaching cues → cleaner, more confident
- Aligns with premium, inevitable aesthetic

---

## 3. Explanatory Copy (One-Sentence Maximum)

### Current State
```
"Vibrational anchors bridge the conscious and subconscious.
Select a resonance pattern that aligns with your intent."
```
*Word count: 15 words*
*Issues: Mystical ("vibrational anchors"), educational tone, verbose*

### Refined Recommendation

**Option A (Recommended)**
```
"Each pattern shapes how your body holds the sound."
```

**Option B (Alternative – even more minimal)**
```
"Choose the rhythm that anchors you."
```

**Option C (Most direct)**
```
"Three patterns engineered for breath and repetition."
```

**Rationale**:
- Option A focuses on **embodied experience** ("how your body holds")
- Removes mystical language ("vibrational," "subconscious")
- Reduces 15 words → 9 words (40% reduction)
- Shifts from teaching → invitation
- Calm, confident, inevitable tone

**Final Recommendation**: **Option A**

---

## 4. Tab Interaction & Hierarchy

### Current State
```tsx
<View style={styles.tabContainer}>
  <View style={[styles.tab, styles.tabActive]}>
    <Text style={styles.tabTextActive}>Sonic</Text>
  </View>
  <View style={styles.tab}>
    <Text style={styles.tabText}>Visual</Text>
  </View>
  <View style={styles.tab}>
    <Text style={styles.tabText}>Somatic</Text>
  </View>
</View>
```

**Issues**:
- No indication that Visual/Somatic are coming soon
- Inactive tabs look like they should be tappable
- Creates confusion for first-time users

### Refined Recommendations

**Option A: Add "Soon" Microcopy (Recommended)**
```tsx
<View style={styles.tab}>
  <Text style={styles.tabText}>Visual</Text>
  <Text style={styles.tabSoon}>Soon</Text>
</View>
```

**Option B: Reduce Opacity Without Text**
```tsx
<View style={[styles.tab, styles.tabInactive]}>
  <Text style={[styles.tabText, styles.tabTextDisabled]}>Visual</Text>
</View>
```
Add `opacity: 0.3` to inactive tabs

**Option C: Hide Inactive Tabs (Most Minimal)**
```tsx
{/* Only show Sonic tab until other modes ship */}
<View style={[styles.tab, styles.tabActive]}>
  <Text style={styles.tabTextActive}>Sonic</Text>
</View>
```

**Final Recommendation**: **Option A (Add "Soon")**
- Maintains forward-looking roadmap
- Sets expectation without over-teaching
- Keeps elegant tab structure

**Styling for "Soon" label**:
```tsx
tabSoon: {
  fontSize: 9,
  color: colors.text.tertiary,
  fontFamily: typography.fonts.body,
  marginLeft: 4,
  opacity: 0.6,
}
```

---

## 5. Mantra Style Cards – Reduce Technical Language

### Current State

| Style | Title | Description | Word Count |
|-------|-------|-------------|------------|
| Rhythmic | Rhythmic "V-C-V" | Focuses on flow. Follows a Vowel-Consonant-Vowel pattern ensuring words loop without "tripping" your tongue. | 16 words |
| Resonant | Resonant | Heavy and grounded. Uses deep vowels like U, O, and A to create a vibrating sound in the chest. | 20 words |
| Flowing | Flowing | Speed and clarity. Uses high vowels like I and E to resonate in the throat and head. | 18 words |

**Issues**:
- "V-C-V pattern" → too technical
- Explanations focus on phonetic mechanics over felt experience
- Creates cognitive load

### Refined Recommendations

| Style | Title | Description | Word Count | Change |
|-------|-------|-------------|------------|--------|
| Rhythmic | **Rhythmic** | Smooth and cyclical. Flows without catching. | 6 words | -63% |
| Resonant | **Resonant** | Deep and grounding. Vibrates in your chest. | 7 words | -65% |
| Flowing | **Flowing** | Light and crisp. Resonates in throat and head. | 8 words | -56% |

**Alternative (Even More Embodied)**

| Style | Description |
|-------|-------------|
| Rhythmic | Easy to loop. Won't trip your tongue. |
| Resonant | Heavy. Settles in your chest. |
| Flowing | Quick and bright. Rises to your head. |

**Final Recommendation**: Use **first refined option** (Smooth/Deep/Light)
- Balances clarity with brevity
- Focuses on **felt qualities** not mechanics
- Removes phonetic jargon (V-C-V, vowel types)
- Maintains professional tone

---

## 6. Core Resonance Label

### Current State
```tsx
<Text style={styles.sourceLabel}>CORE RESONANCE: </Text>
<Text style={styles.sourceValue}>{distilledLetters.join(' ')}</Text>
```

### Refined Recommendations

**Option A: Keep as-is**
```
CORE RESONANCE: S G L
```

**Option B: Simplify**
```
SOURCE: S G L
```

**Option C: Most Direct**
```
FROM: S G L
```

**Final Recommendation**: **Keep "CORE RESONANCE"**
- Already concise
- "Resonance" ties to sonic theme
- "SOURCE" feels less intentional
- No change needed here

---

## 7. Mantra Output – Optional Microcopy

### Current State
```tsx
<View style={styles.premiumMantraBox}>
  <Text style={styles.premiumMantraText}>{mantraText}</Text>
  <TouchableOpacity style={styles.premiumSpeaker}>
    <Volume2 />
  </TouchableOpacity>
</View>
```

No label or microcopy above the mantra itself.

### Refined Recommendations

**Option A: Add Subtle Label (Recommended)**
```tsx
<Text style={styles.mantraLabel}>Your phrase</Text>
<View style={styles.premiumMantraBox}>
  <Text style={styles.premiumMantraText}>{mantraText}</Text>
  ...
</View>
```

**Option B: Keep Clean (Alternative)**
```tsx
{/* No label - let the mantra speak for itself */}
```

**Final Recommendation**: **Option B (No label)**
- The mantra is already visually distinct in the dark box
- Adding "Your phrase" creates redundancy
- Let the artifact speak for itself
- Honors the "meaningful artifact" goal

---

## 8. Loading State Copy

### Current State
```tsx
<Text style={styles.loadingText}>Synthesizing resonance...</Text>
```

### Refined Recommendation

**Option A (Recommended)**
```
Generating your patterns...
```

**Option B (More Embodied)**
```
Shaping your sound...
```

**Option C (Most Direct)**
```
Creating patterns...
```

**Final Recommendation**: **Option A**
- "Generating" is clear and professional
- "your patterns" is personal and accurate
- Removes mystical "resonance" language

---

## 9. Locked State Copy

### Current State
```
Title: "Unlock Your Vocal Anchor"
Body: "Focus Phrases are powerful sonic anchors that amplify your intention
       during rituals. Generate custom phrases based on your specific anchor."
Button: "Generate Phrases (Pro)"
```

### Refined Recommendations

**Title**: Keep "Unlock Your Vocal Anchor" (already strong)

**Body** (Reduce by ~40%):
```
"Create sound patterns that amplify your intention during rituals.
Pro members unlock custom vocal anchors."
```
*Word count: 24 → 14 words*

**Button**:
```
"Unlock Vocal Anchors"
```

**Rationale**:
- Removes redundancy ("Focus Phrases" vs "sonic anchors")
- Clearer value prop
- More confident, less explanatory

---

## 10. Continue Button

### Current State
```
"Continue to Ritual"
```

### Refined Recommendation

**Keep as-is** – already excellent
- Direct, clear, forward-moving
- No change needed

---

## Summary of Changes

| Element | Before | After | Impact |
|---------|--------|-------|--------|
| **Title** | Visual & Vocal Alignment | Your Vocal Anchor | More personal |
| **Subtitle** | Create a unique sound resonance... | Choose the sound that holds your intention. | -31% words, embodied |
| **Hero Section** | Vocal Mastery | Sound Signature | Less skill-focused |
| **Explainer** | Vibrational anchors bridge... (15 words) | Each pattern shapes how your body holds the sound. (9 words) | -40% words, embodied |
| **Style Descriptions** | 16-20 words each | 6-8 words each | -60% words average |
| **Tabs** | No "Soon" indicator | Add "Soon" to Visual/Somatic | Clearer expectation |
| **Loading** | Synthesizing resonance... | Generating your patterns... | Less mystical |

---

## Implementation Priority

### Phase 1: Copy Changes (High Impact, Low Effort)
1. ✅ Update headline/subtitle
2. ✅ Replace "Vocal Mastery" → "Sound Signature"
3. ✅ Replace explanatory paragraph
4. ✅ Simplify mantra style descriptions
5. ✅ Update loading text

### Phase 2: Tab UX (Medium Impact, Low Effort)
1. ✅ Add "Soon" indicator to inactive tabs
2. ✅ Adjust tab opacity/styling

### Phase 3: Polish (Nice-to-Have)
1. ⏸️ Remove Info icon from hero section (test first)
2. ⏸️ Refine locked state copy

---

## Design Principles Applied

✅ **Reduce explanatory copy** – 40-60% reduction across the board
✅ **Make mantra feel like artifact** – Clean presentation, no over-labeling
✅ **Improve tab clarity** – "Soon" indicator without over-teaching
✅ **Accessible for first-timers** – Clear value prop in subtitle
✅ **Elegant for repeat users** – Minimal, confident copy
✅ **No mystical terminology** – Removed "vibrational anchors"
✅ **No long explanations** – Max 9 words for key copy
✅ **Embodied language** – "holds the sound," "vibrates in your chest"
✅ **Calm, confident, inevitable** – Removed teaching tone

---

## Final Recommendation

**Implement Phase 1 immediately** – all copy changes can be done in ~15 minutes and will have the highest impact on user experience. The refined language transforms the screen from educational to experiential, honoring the premium, ritual-focused nature of Anchor.

---

**Next Steps**:
1. Review with product team
2. Implement copy changes in `MantraCreationScreen.tsx`
3. Test with 3-5 users (first-time vs. repeat)
4. Measure scroll depth and time-on-screen before/after
5. Consider A/B testing "Your Vocal Anchor" vs. "Visual & Vocal Alignment"
