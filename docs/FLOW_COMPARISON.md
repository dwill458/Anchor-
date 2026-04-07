# Anchor Creation Flow - Visual Comparison

**Current (3-Path) vs. Target (Linear) Architecture**

---

## Current Flow Architecture

### Path 1: AI Enhancement (Recommended Path)
```
┌─────────────────────────┐
│ IntentionInputScreen    │  User enters intention + category
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ DistillationAnimation   │  Shows letter reduction (vowels, duplicates)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ EnhancementChoiceScreen │  Choose: AI / Traditional / Manual
└──────────┬──────────────┘
           │ (select "AI Enhancement")
           ▼
┌─────────────────────────┐
│ AIAnalysisScreen        │  NLP analyzes intent → selects 2-4 symbols
└──────────┬──────────────┘  (e.g., pentagram, moon, sacred geometry)
           │
           ▼
┌─────────────────────────┐
│ AIGeneratingScreen      │  Stable Diffusion XL generates 4 variations
└──────────┬──────────────┘  40-80 seconds (text-to-image)
           │
           ▼
┌─────────────────────────┐
│ AIVariationPickerScreen │  User picks 1 of 4 AI-generated images
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ MantraCreationScreen    │  Generate & select mantra
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ ChargeChoiceScreen      │  Initial charge or skip
└──────────┬──────────────┘
           │
           ▼
        COMPLETE

Data Saved:
• baseSigilSvg: (empty or placeholder)
• enhancedImageUrl: [AI-generated PNG/JPG]
• mantraText: "..."
```

### Path 2: Traditional (Fast Path)
```
┌─────────────────────────┐
│ IntentionInputScreen    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ DistillationAnimation   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ EnhancementChoiceScreen │  Choose: AI / Traditional / Manual
└──────────┬──────────────┘
           │ (select "Keep Traditional")
           ▼
┌─────────────────────────┐
│ SigilSelectionScreen    │  Pick 1 of 3 variants (Dense/Balanced/Minimal)
└──────────┬──────────────┘  Planetary Grid method (deterministic)
           │
           ▼
┌─────────────────────────┐
│ MantraCreationScreen    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ ChargeChoiceScreen      │
└──────────┬──────────────┘
           │
           ▼
        COMPLETE

Data Saved:
• baseSigilSvg: [SVG string from traditional generator]
• enhancedImageUrl: (none)
• mantraText: "..."
```

### Path 3: Manual Forge (Pro Only)
```
┌─────────────────────────┐
│ IntentionInputScreen    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ DistillationAnimation   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ EnhancementChoiceScreen │  Choose: AI / Traditional / Manual
└──────────┬──────────────┘
           │ (select "Manual Forge" - Pro only)
           ▼
┌─────────────────────────┐
│ ManualForgeScreen       │  Freehand drawing canvas
└──────────┬──────────────┘  • Blank canvas
           │                  • 6 brush types
           ▼                  • Symmetry modes
┌─────────────────────────┐  • Full creative freedom
│ PostForgeChoiceScreen   │  Enhance with AI or keep as-is?
└──────────┬──────────────┘
           │
           ├───────────────────┐
           │ (skip AI)         │ (choose AI)
           ▼                   ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ MantraCreationScreen    │  │ AIAnalysisScreen        │
└─────────────────────────┘  └──────────┬──────────────┘
                                        │
                                        ▼
                             ┌─────────────────────────┐
                             │ AIGeneratingScreen      │
                             └──────────┬──────────────┘
                                        │
                                        ▼
                             ┌─────────────────────────┐
                             │ AIVariationPickerScreen │
                             └──────────┬──────────────┘
                                        │
                                        ▼
                             ┌─────────────────────────┐
                             │ MantraCreationScreen    │
                             └──────────┬──────────────┘
                                        │
                                        ▼
                                  ChargeChoice
                                        │
                                        ▼
                                    COMPLETE

Data Saved:
• baseSigilSvg: [Hand-drawn SVG from canvas]
• enhancedImageUrl: [AI image if chosen, else none]
• mantraText: "..."
```

---

## Target Flow Architecture (Single Linear Path)

```
┌─────────────────────────┐
│ IntentionInputScreen    │  User enters intention + category
└──────────┬──────────────┘  (unchanged)
           │
           ▼
┌─────────────────────────┐
│ DistillationAnimation   │  Shows letter reduction
└──────────┬──────────────┘  (unchanged)
           │
           ▼
┌─────────────────────────┐
│ StructureForgeScreen    │  ⭐ NEW NAME (was SigilSelectionScreen)
└──────────┬──────────────┘  Pick 1 of 3 deterministic variants
           │                  • Dense (complex path)
           ▼                  • Balanced (medium)
┌─────────────────────────┐  • Minimal (simple)
│ ManualReinforcementScr. │  ⭐ NEW (was ManualForgeScreen but different!)
└──────────┬──────────────┘
           │                  GUIDED TRACING (not freehand):
           ▼                  • Faint base sigil shown as underlay
        ┌──────┐              • User traces over it with brush
        │ SKIP │ ─────────┐   • Stroke overlap detection
        └──────┘          │   • Visual feedback (glow on proximity)
           │              │   • Track fidelity score (0-100%)
           ▼              │   • Output: reinforcedSigilSvg
┌─────────────────────────┐  │   • Skippable (but encouraged)
│ Trace & Reinforce       │  │
│ (overlap feedback)      │  │
└──────────┬──────────────┘  │
           │                 │
           ▼                 │
┌─────────────────────────┐  │
│ LockStructureScreen     │  │  ⭐ NEW
└──────────┬──────────────┘  │  Confirmation + celebration
           │◄────────────────┘  • Show final structure (reinforced OR base)
           │                    • Display fidelity score if traced
           ▼                    • "Structure Locked" messaging
┌─────────────────────────┐
│ EnhancementChoiceScreen │  ⭐ MODIFIED (different options)
└──────────┬──────────────┘  Choose:
           │                  • Keep Pure (skip AI)
           │                  • Enhance Appearance (AI style transfer)
           │                  • Skip (same as Keep Pure)
           │
           ├──────────────────────────┐
           │ (Keep Pure / Skip)       │ (Enhance)
           ▼                          ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ MantraCreationScreen    │  │ StyleSelectionScreen    │  ⭐ NEW
└─────────────────────────┘  └──────────┬──────────────┘  Choose AI style:
                                        │                  • Watercolor
                                        ▼                  • Sacred Geometry
                             ┌─────────────────────────┐  • Ink Brush
                             │ AIGeneratingScreen      │  • Gold Leaf
                             └──────────┬──────────────┘  • Cosmic
                                        │                  • Minimal Line
                                        ▼
                             ┌─────────────────────────┐  ⭐ MODIFIED
                             │ EnhancedVersionPicker   │  (was AIVariationPicker)
                             └──────────┬──────────────┘  • 4 styled variations
                                        │                  • Uses ControlNet
                                        ▼                  • Preserves structure
                             ┌─────────────────────────┐
                             │ MantraCreationScreen    │
                             └──────────┬──────────────┘
                                        │
           ┌────────────────────────────┘
           ▼
┌─────────────────────────┐
│ ChargeChoiceScreen      │  (unchanged)
└──────────┬──────────────┘
           │
           ▼
        COMPLETE

Data Saved:
• baseSigilSvg: [Deterministic SVG - ALWAYS present]
• reinforcedSigilSvg: [User-traced SVG - if reinforcement done]
• structureVariant: 'dense' | 'balanced' | 'minimal'
• reinforcementMetadata: { fidelityScore, strokeCount, timeSpent, ... }
• enhancedImageUrl: [AI-styled image - if AI chosen]
• enhancementMetadata: { styleApplied, modelUsed, ... }
• mantraText: "..."
```

---

## Key Differences Highlighted

### Branching vs. Linear

**Current:**
- 3 completely separate paths from EnhancementChoice
- Paths rejoin at MantraCreation or ChargeChoice
- Different data saved depending on path

**Target:**
- Single linear flow
- Optional steps (skip reinforcement, skip AI) but same sequence
- Consistent data structure regardless of choices

---

### AI Role

**Current:**
- **AI-first path:** AI generates sigil from text (no structural input)
- **Traditional path:** No AI involvement
- **Manual path:** AI can be applied post-drawing (optional)

**Target:**
- AI is NEVER the structure creator
- AI is ALWAYS optional aesthetic enhancement
- AI uses structure as input (ControlNet) when applied

---

### Manual Drawing

**Current:**
- **Freehand blank canvas** (Pro feature)
- Complete creative freedom
- 6 brush types, symmetry modes, grid
- Outputs user's original SVG

**Target:**
- **Guided tracing over base structure** (universal)
- Constrained to follow base structure
- Overlap-based acceptance (soft constraints)
- Outputs reinforced version of deterministic structure

---

### Data Lineage

**Current:**
```
Path 1 (AI):
  baseSigilSvg: (empty or placeholder)
  enhancedImageUrl: [AI image]

Path 2 (Traditional):
  baseSigilSvg: [Traditional SVG]
  enhancedImageUrl: (none)

Path 3 (Manual):
  baseSigilSvg: [Hand-drawn SVG]
  enhancedImageUrl: [AI image or none]
```

**Target:**
```
Everyone:
  baseSigilSvg: [Deterministic SVG] ← SOURCE OF TRUTH
  reinforcedSigilSvg: [Traced SVG or none]
  enhancedImageUrl: [Styled image or none]

Clear lineage: base → reinforced → enhanced
```

---

## Screen Count Comparison

| Stage | Current | Target | Change |
|-------|---------|--------|--------|
| **Intention & Distillation** | 2 screens | 2 screens | ✅ Same |
| **Enhancement Choice** | 1 screen | 1 screen | 🔨 Modified options |
| **Structure Selection** | 1 screen (Traditional path only) | 1 screen (everyone) | 🔨 Now universal |
| **Manual Creation** | 1 screen (Pro path only) | 1 screen (everyone, but different) | 🔨 Guided vs. freehand |
| **Lock/Confirmation** | 0 screens | 1 screen | ⭐ NEW |
| **AI Analysis** | 1 screen (AI path only) | 0 screens | ❌ REMOVED |
| **AI Style Selection** | 0 screens | 1 screen | ⭐ NEW |
| **AI Generation** | 1 screen (AI path) | 1 screen (if chosen) | 🔨 ControlNet |
| **AI Variation Picker** | 1 screen (AI path) | 1 screen (if chosen) | 🔨 Renamed |
| **Post-Forge Choice** | 1 screen (Manual path) | 0 screens | ❌ REMOVED |
| **Mantra** | 1 screen | 1 screen | ✅ Same |
| **Charge** | 1 screen | 1 screen | ✅ Same |
| **TOTAL** | 8-10 screens (path-dependent) | 10 screens (with skips: 6-10) | Similar |

---

## User Journey Comparison

### Current: "Choose Your Own Adventure"
```
User Decision Points:
1. EnhancementChoice: AI / Traditional / Manual
2. (if AI) AIAnalysis: auto-proceeds
3. (if AI) AIVariationPicker: pick 1 of 4
4. (if Traditional) SigilSelection: pick variant
5. (if Manual) Draw sigil
6. (if Manual) PostForgeChoice: Enhance or keep?
7. MantraCreation: pick style
8. ChargeChoice: charge or skip
```

**Pros:**
- Users feel in control
- Multiple paths cater to different preferences

**Cons:**
- Confusing for new users
- Path choice made early (before understanding options)
- Inconsistent data outputs
- AI path feels like "magic button" not tool

---

### Target: "Guided Journey with Optional Enhancements"
```
User Decision Points:
1. StructureForge: pick variant (Dense/Balanced/Minimal)
2. ManualReinforcement: trace or skip
3. EnhancementChoice: Keep Pure or Enhance
4. (if Enhance) StyleSelection: pick aesthetic
5. (if Enhance) EnhancedVersionPicker: pick 1 of 4
6. MantraCreation: pick style
7. ChargeChoice: charge or skip
```

**Pros:**
- Clear progression (structure → reinforce → enhance)
- Everyone sees deterministic structure first
- AI positioned as optional polish, not creator
- Consistent data model
- Embodiment opportunity for all users (reinforcement)

**Cons:**
- Longer flow (more steps)
- Less "magic" - more methodical

---

## Philosophical Shift

### Current Model
> "Choose how you want your Anchor created: let AI do it, use traditional methods, or draw it yourself."

**Implication:** AI is a creation method (parallel to traditional/manual)

---

### Target Model
> "We'll create your Anchor's structure using sacred geometry. You can reinforce it through tracing to deepen your connection. Then, optionally, enhance its appearance with AI styling."

**Implication:** AI is a tool for enhancement, not a creator

---

## Time Comparison

### Current (Estimated)
- **AI Path:** ~2-3 minutes (40-80s AI generation)
- **Traditional Path:** ~45 seconds (fastest)
- **Manual Path:** ~5-15 minutes (depends on drawing time)

### Target (Estimated)
- **Fast Path (skip reinforcement & AI):** ~60 seconds
- **Reinforce Only:** ~3-4 minutes
- **Full Journey (reinforce + AI):** ~5-6 minutes

**Note:** Target is longer if user engages with all steps, but faster minimum path exists.

---

## Migration Path

### Data Migration Strategy

Existing anchors need to be migrated to new schema:

```typescript
// Existing Anchor
{
  baseSigilSvg: "..." | "",
  enhancedImageUrl: "..." | null
}

// Migrate to new schema
{
  baseSigilSvg: existingAnchor.baseSigilSvg || generatePlaceholder(),
  reinforcedSigilSvg: null,  // Old anchors didn't have this
  structureVariant: 'balanced',  // Default
  reinforcementMetadata: {
    skipped: true,  // Mark as skipped for existing
    completed: false
  },
  enhancedImageUrl: existingAnchor.enhancedImageUrl,
  enhancementMetadata: existingAnchor.enhancedImageUrl ? {
    styleApplied: 'legacy',
    modelUsed: 'sdxl-legacy',
    appliedAt: existingAnchor.createdAt
  } : null
}
```

### User Experience During Migration
- Existing anchors continue to work
- Vault displays them correctly (fallback to baseSigilSvg if reinforcedSigilSvg is null)
- No disruption to existing users
- New creation flow only applies to new anchors

---

## Recommendation

**Proceed with target architecture** for the following reasons:

1. **Strategic Alignment:** Positions Anchor as authentic chaos magick tool, not AI gimmick
2. **Product Differentiation:** Hybrid approach is unique in market
3. **Merchandising:** SVG-first architecture enables print-on-demand
4. **Technical Feasibility:** ControlNet is proven technology, migration is straightforward
5. **UX Flexibility:** Skippable steps allow fast path for impatient users
6. **Data Quality:** Clear lineage and consistent structure

**Risk Mitigation:** Prototype reinforcement UX early, validate ControlNet quality with spike.

---

*End of Comparison*
