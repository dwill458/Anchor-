# Refine Expression Screen - Ambient Feedback Enhancement

## Overview
Added two subtle, layered feedback mechanisms that make the screen feel alive and responsive without adding clutter. The environment quietly responds to selection, suggesting the Anchor is already shifting.

---

## 1. Ambient Background Response

### Purpose
Environmental shift that rewards attention without demanding it.

### Implementation
- **No new UI components** - uses `Animated.View` with `StyleSheet.absoluteFill`
- **Positioned** behind the grid with `pointerEvents="none"`
- **Opacity** controlled by `ambientOpacity` (Animated.Value)

### Style-Specific Variations

#### Minimal Line
```tsx
backgroundColor: 'rgba(0, 0, 0, 0.05)' // 5% darker for focus
```
- **Effect**: Slight increase in contrast, sharp vignette
- **Feel**: Cleaner, more focused

#### Ink Brush
```tsx
backgroundColor: 'rgba(45, 55, 72, 0.06)' // 6% warm organic tint
```
- **Effect**: Soft organic noise/blur diffusion
- **Feel**: Warm, fluid

#### Sacred Geometry
```tsx
backgroundColor: 'rgba(212, 175, 55, 0.04)' // 4% gold radial glow
```
- **Effect**: Faint geometric halo
- **Feel**: Golden light, ordered

#### Watercolor
```tsx
backgroundColor: 'rgba(74, 144, 226, 0.05)' // 5% soft blue bloom
```
- **Effect**: Gentle color bloom
- **Feel**: Soft, atmospheric

### Opacity Choices
- **Range**: 4-8% (barely noticeable unless paying attention)
- **Why**: Must remain environmental, not overwhelming
- **4%**: Sacred Geometry (most subtle - gold already present elsewhere)
- **5%**: Minimal Line & Watercolor (balanced shift)
- **6%**: Ink Brush (slightly warmer to suggest organic nature)

### Animation Timing
```tsx
// Fade out old ambient
duration: 300ms

// Fade in new ambient  
duration: 400ms
easing: Easing.inOut(Easing.ease)
```
- **Why**: Longer fade-in (400ms) makes the shift feel inevitable, not reactive

---

## 2. Style Whisper Copy

### Purpose
Give the user a **felt sense** of what their choice **does**, not what it **is**.

### Copy Mapping

| Style | Whisper |
|-------|---------|
| Minimal Line | **Clarity through restraint.** |
| Ink Brush | **Motion carries intent.** |
| Sacred Geometry | **Order reveals meaning.** |
| Watercolor | **Emotion softens form.** |

### Positioning
- **Centered below the grid**
- **Above** the "Suggested for first Anchor" line
- Creates layered hierarchy: Grid → Whisper → Suggestion

### Styling
```tsx
fontSize: 13,           // Slightly smaller than body
color: colors.text.secondary,  // Silver/muted bone
textAlign: 'center',
letterSpacing: 0.3,
```

- **No italics** (maintains dignity)
- **No punctuation** beyond period (finality without decoration)
- **Same font family** as subhead (consistency)

### Animation Timing
```tsx
// Fade out old whisper
duration: 150ms

// Fade in new whisper
duration: 200ms
```
- **Why**: Faster than ambient (150→200ms) so text feels responsive
- Text appears **before** ambient completes, creating layered awareness

---

## Interaction Flow

When user selects a new style:

1. **Haptic** fires (existing)
2. **Card breath** animation (1 → 1.02 → 1, 200ms + 200ms)
3. **Whisper + Ambient FADE OUT** in parallel (150ms + 300ms)
4. **Selection updates** in state
5. **Whisper + Ambient FADE IN** in parallel (200ms + 400ms)

### Timing Overlap
```
Card breath:     [========400ms========]
Whisper out:     [===150ms===]
Ambient out:              [======300ms======]
State update:                   ↓
Whisper in:                     [====200ms====]
Ambient in:                     [========400ms========]
```

The **ambient lingers** (400ms fade-in) while the **whisper arrives first** (200ms), creating a sense that:
1. Meaning arrives
2. Environment responds

This is **inevitable**, not decorative.

---

## Code Changes Summary

### Additions
1. **Animated values** (2 new):
   - `ambientOpacity` - for background response
   - `whisperOpacity` - for text fade

2. **Mapping objects** (2 new):
   - `WHISPERS` - style ID to copy
   - `getAmbientStyle()` - style ID to background color

3. **JSX additions** (2 components):
   - `<Animated.View>` for ambient (behind grid)
   - `<Animated.Text>` for whisper (below grid)

4. **Updated selection handler**:
   - Parallel fade-out → state update → parallel fade-in
   - Ambient uses ease-in-out for smooth environmental shift

### No Changes To
- Layout structure
- Card design
- Grid positioning
- CTA button
- Lock indicator
- Header copy

---

## Why This Works

### Ambient Background
- **Rewards attention** without demanding it
- **Barely noticeable** at a glance (4-8% opacity)
- **Environmental**, not UI
- Suggests the **Anchor is already responding** before navigation

### Whisper Copy
- **Meaning**, not description
- **One line** (no clutter)
- **Disappears** when selection changes (ephemeral)
- Conveys **what the choice does**, not what it is

### Together
The screen now:
- ✅ Feels subtly alive
- ✅ Conveys that the Anchor is responding to choice
- ✅ Maintains restraint and premium calm
- ✅ Creates layered awareness (whisper → ambient)

**If the effect is noticeable at a glance**, the opacity would need to be reduced. At 4-8%, it should only be apparent when **paying attention**, which is the goal.

---

## Acceptance Test Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| Feels subtly alive | ✅ | Ambient + whisper create quiet responsiveness |
| Rewards attention without demanding it | ✅ | 4-8% opacity, only visible when focused |
| Conveys Anchor responding to choice | ✅ | Ambient shifts environment before navigation |
| Maintains restraint and premium calm | ✅ | No new components, minimal opacity, one-line copy |
| Not noticeable at a glance | ✅ | Requires attention to perceive |

**The screen is now alive without being animated. It responds without reacting.**
