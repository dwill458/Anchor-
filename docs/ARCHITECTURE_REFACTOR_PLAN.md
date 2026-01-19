# Anchor - Architecture Refactor Plan
## Sigil Creation Architecture & Flow Transformation

**Document Version:** 1.0
**Date:** 2026-01-19
**Status:** Planning Phase
**Author:** Architecture Analysis

---

## Executive Summary

This document provides a comprehensive refactoring plan to transform Anchor's sigil creation architecture from an **AI-first generative approach** to a **deterministic structure + optional AI enhancement** model. This is a strategic pivot that prioritizes authenticity, user embodiment, and product differentiation.

### Core Strategic Change
- **FROM:** AI generates sigil structure and appearance (generative)
- **TO:** Code generates structure deterministically → User reinforces manually → AI enhances aesthetically (optional)

### Key Principles (Non-Negotiable)
1. **Deterministic structure generation** - Traditional chaos magick methods (letter distillation + geometric mapping)
2. **Manual reinforcement** - Guided tracing, not freehand blank canvas
3. **AI as aesthetic enhancement** - Style transfer preserving structure, not creative generation
4. **Merch-first architecture** - SVG source of truth for infinite scalability

---

## 1. Current vs. Target Architecture

### 1.1 Current Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ CURRENT FLOW (3 Separate Paths)                            │
└─────────────────────────────────────────────────────────────┘

Path 1: AI Enhancement (Recommended)
─────────────────────────────────────
IntentionInput
    ↓
DistillationAnimation
    ↓
EnhancementChoice → AIAnalysis
    ↓                    ↓
                    AIGenerating (40-80s)
                         ↓
                    AIVariationPicker (choose from 4)
                         ↓
                    MantraCreation
                         ↓
                    ChargeChoice → Complete

Path 2: Traditional
────────────────────
IntentionInput
    ↓
DistillationAnimation
    ↓
EnhancementChoice → SigilSelection (3 variants)
                         ↓
                    MantraCreation
                         ↓
                    ChargeChoice → Complete

Path 3: Manual Forge (Pro Only)
────────────────────────────────
IntentionInput
    ↓
DistillationAnimation
    ↓
EnhancementChoice → ManualForge (freehand canvas)
    ↓                    ↓
                    PostForgeChoice
                         ↓ (optional)
                    AIAnalysis → AIGenerating → AIVariationPicker
                         ↓
                    MantraCreation
                         ↓
                    ChargeChoice → Complete
```

### 1.2 Target Canonical Flow

```
┌─────────────────────────────────────────────────────────────┐
│ TARGET FLOW (Single Linear Path with Optional Steps)       │
└─────────────────────────────────────────────────────────────┘

IntentionInput
    ↓
DistillationAnimation (same)
    ↓
StructureForge (choose 1 of 3 deterministic variations)
    │   ├─ Dense
    │   ├─ Balanced
    │   └─ Minimal
    ↓
ManualReinforcement (guided tracing over base structure)
    │   [SKIPPABLE - but encouraged]
    │   ├─ Shows faint base sigil
    │   ├─ User traces with soft constraints
    │   ├─ Overlap-based acceptance (not rejection)
    │   └─ Outputs: reinforcedSigilSvg
    ↓
LockStructure (confirmation screen - "Structure Locked")
    ↓
EnhancementChoice
    │   ├─ Keep Pure (skip AI)
    │   ├─ Enhance Appearance (AI style transfer)
    │   └─ Skip (same as Keep Pure)
    ↓ (if Enhance chosen)
StyleSelection (pick aesthetic: watercolor, sacred geometry, etc.)
    ↓
AIGenerating (ControlNet + SDXL structure-conditioned generation)
    │   [Uses reinforcedSigilSvg OR baseSigilSvg as control image]
    ↓
EnhancedVersionPicker (choose from 4 styled variations)
    ↓
MantraCreation (same)
    ↓
ChargeChoice → Complete
```

### 1.3 Key Architectural Differences

| Aspect | Current | Target | Impact |
|--------|---------|--------|--------|
| **Branching** | 3 separate paths from EnhancementChoice | Single linear flow with optional steps | Simplified UX, easier to maintain |
| **AI Role** | Generative (creates structure & appearance) | Enhancement (styles existing structure) | Authenticity ↑, AI becomes tool not authority |
| **Manual Drawing** | Freehand blank canvas (Pro feature) | Guided reinforcement (universal) | User embodiment without overwhelming freedom |
| **Structure Source** | AI-generated OR traditional OR manual | Always deterministic traditional | Consistency, merch-ready, repeatable |
| **Data Model** | `baseSigilSvg` + `enhancedImageUrl` | `baseSigilSvg` + `reinforcedSigilSvg` + `enhancedImageUrl` | Clear lineage, preserves all transformation stages |

---

## 2. Data Model Changes

### 2.1 Current Data Model

```typescript
// /apps/mobile/src/types/index.ts (Current)
export interface Anchor {
  id: string;
  userId: string;
  intentionText: string;
  category: AnchorCategory;
  distilledLetters: string[];
  baseSigilSvg: string;              // SVG (traditional OR manual-drawn)
  enhancedImageUrl?: string;          // AI-generated image URL
  mantraText?: string;
  mantraPronunciation?: string;
  mantraAudioUrl?: string;
  isCharged: boolean;
  chargedAt?: Date;
  activationCount: number;
  lastActivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Target Data Model

```typescript
// /apps/mobile/src/types/index.ts (Target)
export interface Anchor {
  // Existing fields (unchanged)
  id: string;
  userId: string;
  intentionText: string;
  category: AnchorCategory;
  distilledLetters: string[];

  // ───────────────────────────────────────────────────
  // STRUCTURE LINEAGE (Clear Provenance)
  // ───────────────────────────────────────────────────
  baseSigilSvg: string;                    // Deterministic structure (source of truth)
  reinforcedSigilSvg?: string;             // User-traced reinforcement (if done)
  enhancedImageUrl?: string;               // AI-styled appearance (if AI applied)

  // ───────────────────────────────────────────────────
  // CREATION PATH METADATA
  // ───────────────────────────────────────────────────
  structureVariant: SigilVariant;          // Which variant chosen: 'dense' | 'balanced' | 'minimal'

  reinforcementMetadata?: {
    completed: boolean;                    // Did user complete reinforcement?
    skipped: boolean;                      // Did user skip this step?
    strokeCount: number;                   // Number of strokes traced
    fidelityScore: number;                 // Overlap percentage (0-100)
    timeSpentMs: number;                   // Time spent on reinforcement
    completedAt?: Date;
  };

  enhancementMetadata?: {
    styleApplied: string;                  // e.g., "watercolor", "sacred_geometry"
    modelUsed: string;                     // e.g., "sdxl-controlnet-canny-v1"
    controlMethod: string;                 // e.g., "canny", "lineart"
    generationTimeMs: number;
    promptUsed: string;
    negativePrompt: string;
    appliedAt: Date;
  };

  // Existing fields (unchanged)
  mantraText?: string;
  mantraPronunciation?: string;
  mantraAudioUrl?: string;
  isCharged: boolean;
  chargedAt?: Date;
  activationCount: number;
  lastActivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 New Type Definitions

```typescript
// Add to /apps/mobile/src/types/index.ts

/**
 * Reinforcement quality metrics
 */
export interface ReinforcementMetadata {
  completed: boolean;
  skipped: boolean;
  strokeCount: number;
  fidelityScore: number;        // 0-100 (overlap %)
  timeSpentMs: number;
  completedAt?: Date;
}

/**
 * AI enhancement tracking
 */
export interface EnhancementMetadata {
  styleApplied: string;         // Style name
  modelUsed: string;            // AI model identifier
  controlMethod: string;        // ControlNet method
  generationTimeMs: number;
  promptUsed: string;
  negativePrompt: string;
  appliedAt: Date;
}

/**
 * AI style options (expanded)
 */
export type AIStyle =
  | 'watercolor'
  | 'sacred_geometry'
  | 'ink_brush'
  | 'gold_leaf'
  | 'cosmic'
  | 'minimal_line'
  | 'textured_stone';

/**
 * Enhancement path choice
 */
export type EnhancementPath = 'keep_pure' | 'enhance_ai' | 'skip';
```

### 2.4 Database Migration Requirements

**Migration Steps:**
1. Add `reinforcedSigilSvg` column (nullable string/text)
2. Add `structureVariant` column (string, default 'balanced')
3. Add `reinforcementMetadata` column (JSON, nullable)
4. Add `enhancementMetadata` column (JSON, nullable)
5. Update existing records:
   - Set `structureVariant` to 'balanced' for all existing anchors
   - Set `reinforcementMetadata.skipped = true` for existing anchors
   - Migrate existing AI metadata to new `enhancementMetadata` structure

---

## 3. Screen Changes (Refactor/Remove/Create)

### 3.1 Screens to KEEP (No Changes)

| Screen | Path | Notes |
|--------|------|-------|
| `IntentionInputScreen.tsx` | `/screens/create/` | Perfect as-is, no changes needed |
| `DistillationAnimationScreen.tsx` | `/screens/create/` | Perfect as-is, no changes needed |
| `MantraCreationScreen.tsx` | `/screens/create/` | Minor update: read from `reinforcedSigilSvg ?? baseSigilSvg` |

### 3.2 Screens to REFACTOR (Significant Changes)

| Screen | Current Purpose | Target Purpose | Changes Required |
|--------|----------------|----------------|------------------|
| `SigilSelectionScreen.tsx` | Choose 1 of 3 traditional variants | **Rename to `StructureForgeScreen.tsx`**<br>Choose 1 of 3 deterministic variants | ✅ Keep generation logic<br>✅ Update copy: "Choose Your Structure" instead of "Choose Your Anchor"<br>✅ Emphasize "bones" metaphor<br>✅ Next: ManualReinforcementScreen |
| `EnhancementChoiceScreen.tsx` | Choose AI / Traditional / Manual paths | Choose Keep Pure / Enhance / Skip | ❌ Remove "Traditional" option<br>❌ Remove "Manual Forge" option<br>✅ Add "Keep Pure" (skip AI)<br>✅ Add "Enhance Appearance" (AI style transfer)<br>✅ Previous: LockStructureScreen<br>✅ Next: StyleSelectionScreen OR MantraCreation |
| `ManualForgeScreen.tsx` | Freehand drawing canvas (Pro only) | **Rename to `ManualReinforcementScreen.tsx`**<br>Guided tracing with constraints | ✅ Display faint `baseSigilSvg` as underlay<br>✅ Implement stroke overlap detection<br>✅ Real-time visual feedback (glow on proximity)<br>✅ Track fidelity score<br>✅ Output `reinforcedSigilSvg`<br>✅ Allow skip option<br>❌ Remove full creative freedom features |
| `AIGeneratingScreen.tsx` | Generate AI sigils from scratch | Generate style-transferred variations | ✅ Update to use ControlNet pipeline<br>✅ Pass `reinforcedSigilSvg ?? baseSigilSvg` as control image<br>✅ Update prompts for style transfer, not generation<br>✅ Update loading copy |
| `AIVariationPickerScreen.tsx` | Pick from 4 AI variations | **Rename to `EnhancedVersionPickerScreen.tsx`**<br>Same functionality, updated copy | ✅ Update title: "Choose Your Enhanced Version"<br>✅ Show base structure as comparison option |

### 3.3 Screens to REMOVE (Delete)

| Screen | Reason |
|--------|--------|
| `PostForgeChoiceScreen.tsx` | No longer needed - manual reinforcement is always followed by same flow |
| `AIAnalysisScreen.tsx` | No longer needed - AI doesn't analyze intention for symbol selection in new model |

### 3.4 Screens to CREATE (New)

| Screen | Purpose | Location | Details |
|--------|---------|----------|---------|
| `LockStructureScreen.tsx` | Confirmation that structure is finalized | `/screens/create/` | • Show the final structure (reinforced OR base)<br>• Display fidelity score if reinforcement done<br>• Celebrate user effort<br>• "Structure Locked" confirmation<br>• Next: EnhancementChoice |
| `StyleSelectionScreen.tsx` | Choose AI aesthetic style | `/screens/create/` | • Grid of style options with previews<br>• 6-8 style cards: watercolor, sacred geometry, ink brush, gold leaf, cosmic, minimal line, textured stone<br>• Style preview thumbnails<br>• Next: AIGenerating |

---

## 4. AI Pipeline Changes

### 4.1 Current AI Pipeline

```
┌───────────────────────────────────────────────────────┐
│ CURRENT: Generative AI (Stable Diffusion XL)         │
└───────────────────────────────────────────────────────┘

Input: Intention text
   ↓
NLP Analysis (IntentionAnalyzer.ts)
   ├─ Extract keywords
   ├─ Identify themes
   └─ Select 2-4 mystical symbols from database
   ↓
Build Text Prompt
   ├─ Aesthetic style (grimoire, cosmic, minimal, etc.)
   ├─ Symbol names (pentagram, moon phases, etc.)
   ├─ Theme modifiers (wealth → gold accents, etc.)
   └─ Quality keywords (mystical, powerful, 4k, etc.)
   ↓
Stable Diffusion XL (via Replicate)
   ├─ Model: stability-ai/sdxl
   ├─ Text-to-image generation
   ├─ Generate 4 variations
   └─ 40-80 seconds generation time
   ↓
Output: 4 image URLs (PNG/JPG)
```

**Key Problem:** AI creates the sigil from scratch based on text interpretation. No structural control. Results are novel but unpredictable and not merch-safe.

### 4.2 Target AI Pipeline

```
┌───────────────────────────────────────────────────────┐
│ TARGET: Structure-Conditioned Style Transfer          │
└───────────────────────────────────────────────────────┘

Input: reinforcedSigilSvg OR baseSigilSvg (SVG)
   ↓
Rasterize SVG → High-contrast PNG (1024x1024)
   ├─ Black background
   ├─ White lines (sigil structure)
   └─ High resolution for quality
   ↓
ControlNet Preprocessing
   ├─ Method: Canny edge detection OR Lineart
   ├─ Preserve edge map of structure
   └─ Generate control image
   ↓
Build Style Prompt (structure-focused)
   ├─ Style aesthetic: "watercolor painting", "gold leaf illumination", etc.
   ├─ Material/texture keywords: "flowing ink", "etched stone", "gilded edges"
   ├─ Preservation keywords: "preserve line structure", "maintain geometry"
   └─ NEGATIVE prompt: "new shapes", "additional symbols", "text", "faces"
   ↓
ControlNet + SDXL (via Replicate)
   ├─ Model: stability-ai/sdxl + ControlNet
   ├─ Control method: canny OR lineart
   ├─ Control strength: 0.7-0.9 (high - preserve structure)
   ├─ Generate 4 variations (different style seeds)
   └─ 50-90 seconds generation time
   ↓
Output: 4 styled image URLs (PNG/JPG)
   └─ Structure preserved, aesthetic enhanced
```

### 4.3 Implementation Changes

**File: `/backend/src/services/AIEnhancer.ts`**

Current approach:
```typescript
// Current: Text-to-image generation
const output = await replicate.run(
  "stability-ai/sdxl:...",
  {
    input: {
      prompt: buildPrompt(analysis),
      negative_prompt: buildNegativePrompt(),
      num_outputs: 4,
    }
  }
);
```

Target approach:
```typescript
// Target: ControlNet structure-conditioned generation
const output = await replicate.run(
  "stability-ai/controlnet:...",  // ControlNet-enabled SDXL
  {
    input: {
      prompt: buildStylePrompt(styleChoice),
      negative_prompt: buildStructurePreservationNegativePrompt(),
      image: rasterizedSigilImage,           // Control image
      control_type: "canny",                 // or "lineart"
      controlnet_conditioning_scale: 0.8,    // High - preserve structure
      num_outputs: 4,
    }
  }
);
```

**New Functions Required:**
1. `rasterizeSVG(svg: string): Promise<Buffer>` - Convert SVG → high-contrast PNG
2. `buildStylePrompt(style: AIStyle): string` - Style-focused prompts
3. `buildStructurePreservationNegativePrompt(): string` - Prevent geometric drift

**Replicate Model Change:**
- FROM: `stability-ai/sdxl:VERSION`
- TO: `thibaud/controlnet-sd21:VERSION` OR similar ControlNet-enabled model

### 4.4 Fallback Strategy

If ControlNet results are poor quality for certain styles:
1. **Fallback to SVG Filters** - Apply CSS/SVG filters for "enhanced lighting", "glow effects", "color overlays"
2. **Hybrid Approach** - Use ControlNet for texture-heavy styles (watercolor, stone), SVG filters for geometric styles
3. **Disable Problematic Styles** - Remove from StyleSelection if results consistently fail

---

## 5. Navigation Flow Updates

### 5.1 Current Navigation Param Types

```typescript
// /apps/mobile/src/types/index.ts - Current RootStackParamList
export type RootStackParamList = {
  // ... other screens ...

  EnhancementChoice: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };

  ManualForge: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    sigilSvg?: string;
  };

  AIAnalysis: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    sigilSvg?: string;
    sigilVariant?: string;
  };

  // ... more screens ...
};
```

### 5.2 Target Navigation Param Types

```typescript
// /apps/mobile/src/types/index.ts - Target RootStackParamList
export type RootStackParamList = {
  // ... existing screens (Vault, AnchorDetail, etc.) ...

  // ═══════════════════════════════════════════════════
  // CREATION FLOW (New Canonical Order)
  // ═══════════════════════════════════════════════════

  IntentionInput: undefined;

  DistillationAnimation: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };

  StructureForge: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };

  ManualReinforcement: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;              // Base structure to trace over
    structureVariant: SigilVariant;    // Which variant was chosen
  };

  LockStructure: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;       // If reinforcement was done
    structureVariant: SigilVariant;
    reinforcementMetadata?: ReinforcementMetadata;
  };

  EnhancementChoice: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    reinforcementMetadata?: ReinforcementMetadata;
  };

  StyleSelection: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    reinforcementMetadata?: ReinforcementMetadata;
  };

  AIGenerating: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    styleChoice: AIStyle;              // Selected style
    reinforcementMetadata?: ReinforcementMetadata;
  };

  EnhancedVersionPicker: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    styleChoice: AIStyle;
    variations: string[];              // Array of 4 image URLs
    reinforcementMetadata?: ReinforcementMetadata;
  };

  MantraCreation: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    finalImageUrl?: string;            // AI-enhanced image (if chosen)
    reinforcementMetadata?: ReinforcementMetadata;
    enhancementMetadata?: EnhancementMetadata;
  };

  // ... charging and activation screens (unchanged) ...
};
```

---

## 6. Refactoring Scope & Preservation Strategy

### 6.1 What Can Be PRESERVED (Reused As-Is)

✅ **Utility Functions**
- `/utils/sigil/distillation.ts` - Letter distillation logic (perfect)
- `/utils/sigil/traditional-generator.ts` - Planetary grid method (keep as-is)
- `/utils/sigil/letterVectors.ts` - Letter shapes (not used in new flow, but keep)

✅ **Services**
- `/services/ApiClient.ts` - HTTP client (reuse)
- `/services/TTSService.ts` - Mantra audio generation (reuse)
- `/backend/src/services/MantraGenerator.ts` - Mantra generation logic (reuse)
- `/backend/src/services/StorageService.ts` - Cloudflare R2 storage (reuse)

✅ **Components**
- `/components/common/ZenBackground.tsx` - Background component (reuse)
- `/components/common/ScreenHeader.tsx` - Header component (reuse)
- All vault, profile, activation screens (unchanged)

✅ **Backend Infrastructure**
- Database connection logic
- Authentication/authorization
- API routing framework
- Error handling

### 6.2 What Must Be REFACTORED (Modified)

🔨 **Screens (see Section 3)**
- Rename: `SigilSelectionScreen` → `StructureForgeScreen`
- Rename: `ManualForgeScreen` → `ManualReinforcementScreen`
- Rename: `AIVariationPickerScreen` → `EnhancedVersionPickerScreen`
- Modify: `EnhancementChoiceScreen` (remove paths, add new options)
- Modify: `AIGeneratingScreen` (ControlNet pipeline)
- Modify: `MantraCreationScreen` (read from reinforcedSigilSvg)

🔨 **Services**
- `/backend/src/services/AIEnhancer.ts` - Complete rewrite for ControlNet
- ~~`/backend/src/services/IntentionAnalyzer.ts`~~ - DELETE (no longer needed)

🔨 **Types**
- `/apps/mobile/src/types/index.ts` - Add new fields, metadata types
- `/backend/src/types/index.ts` - Mirror frontend changes

🔨 **Stores**
- `/apps/mobile/src/stores/anchorStore.ts` - Update to handle new fields

### 6.3 What Must Be DELETED (Removed)

❌ **Screens**
- `PostForgeChoiceScreen.tsx` - No longer needed
- `AIAnalysisScreen.tsx` - No longer needed

❌ **Services**
- `/backend/src/services/IntentionAnalyzer.ts` - Symbol selection no longer used
- `/backend/src/data/symbols.ts` - Symbol database no longer used

❌ **Types/Enums**
- `EnhancementMethod` type - Replace with `EnhancementPath`
- Old `AIStyle` values that don't fit new model

---

## 7. Phased Implementation Roadmap

### Phase 1: Foundation & Data Model (Week 1-2)
**Goal:** Update data structures and prepare infrastructure

**Tasks:**
1. ✅ Create new type definitions in `/types/index.ts`
   - `ReinforcementMetadata`
   - `EnhancementMetadata`
   - New `AIStyle` values
   - `EnhancementPath` type
2. ✅ Update `Anchor` interface with new fields
3. ✅ Database migration scripts
   - Add new columns
   - Migrate existing data
4. ✅ Update `anchorStore.ts` to handle new fields
5. ✅ Backend API updates to accept/return new data

**Success Criteria:**
- All existing anchors still load correctly
- New fields are nullable and backward-compatible
- Database migration runs without errors
- API tests pass

### Phase 2: Structure Forge & Reinforcement UI (Week 3-4)
**Goal:** Build core reinforcement experience

**Tasks:**
1. ✅ Rename `SigilSelectionScreen` → `StructureForgeScreen`
   - Update copy and navigation
   - Ensure deterministic generation works
2. ✅ Build `ManualReinforcementScreen.tsx`
   - Display faint base sigil underlay
   - Implement stroke overlap detection algorithm
   - Real-time visual feedback (glow on proximity)
   - Track fidelity score calculation
   - Export `reinforcedSigilSvg`
   - Skip button functionality
3. ✅ Build `LockStructureScreen.tsx`
   - Show final structure
   - Display reinforcement stats
   - Celebration micro-interaction
4. ✅ Update navigation flow for new screens

**Success Criteria:**
- Users can trace over base structure
- Fidelity score accurately reflects overlap
- Reinforcement feels guided, not punitive
- Skip option works correctly
- `reinforcedSigilSvg` generates valid SVG output

### Phase 3: AI Pipeline Transformation (Week 5-6)
**Goal:** Implement ControlNet style transfer

**Tasks:**
1. ✅ Research & select ControlNet model on Replicate
   - Test Canny vs. Lineart preprocessing
   - Validate structure preservation quality
2. ✅ Implement SVG rasterization function
   - Convert SVG → high-contrast PNG
   - Optimize resolution and contrast
3. ✅ Rewrite `/backend/src/services/AIEnhancer.ts`
   - `enhanceSigilWithStyle()` function
   - ControlNet API integration
   - Style-focused prompt building
4. ✅ Build `StyleSelectionScreen.tsx`
   - 6-8 style cards with previews
   - Style descriptions
5. ✅ Update `AIGeneratingScreen.tsx`
   - New loading copy
   - Pass control image
6. ✅ Rename `AIVariationPickerScreen` → `EnhancedVersionPickerScreen`
   - Update copy
   - Show base structure comparison

**Success Criteria:**
- ControlNet preserves sigil structure (≥80% visual fidelity)
- 4 variations generate successfully
- Generation time ≤90 seconds
- Styles look aesthetically distinct
- Fallback SVG filters work if AI fails

### Phase 4: Enhancement Choice Refactor (Week 7)
**Goal:** Update enhancement choice screen to new options

**Tasks:**
1. ✅ Refactor `EnhancementChoiceScreen.tsx`
   - Remove "Traditional" and "Manual Forge" cards
   - Add "Keep Pure" option
   - Add "Enhance Appearance" option
   - Update navigation logic
2. ✅ Update `MantraCreationScreen.tsx`
   - Read from `reinforcedSigilSvg ?? baseSigilSvg`
   - Persist `enhancementMetadata` if AI was used
3. ✅ Test all paths:
   - Structure → Skip Reinforcement → Keep Pure
   - Structure → Reinforce → Keep Pure
   - Structure → Skip Reinforcement → Enhance AI
   - Structure → Reinforce → Enhance AI

**Success Criteria:**
- All navigation paths work correctly
- Data persists correctly for each path
- No regression in mantra creation
- Charging flow works as before

### Phase 5: Cleanup & Testing (Week 8)
**Goal:** Remove old code and ensure stability

**Tasks:**
1. ✅ Delete deprecated screens
   - `PostForgeChoiceScreen.tsx`
   - `AIAnalysisScreen.tsx`
2. ✅ Delete deprecated services
   - `IntentionAnalyzer.ts`
   - `symbols.ts`
3. ✅ Remove unused imports and dead code
4. ✅ Update navigation types (remove old routes)
5. ✅ Comprehensive testing
   - End-to-end flow testing
   - Edge case handling
   - Performance testing
6. ✅ Update documentation
   - README
   - API docs
   - Architecture diagrams

**Success Criteria:**
- No broken imports
- No unused dependencies
- All tests pass
- App builds successfully on iOS and Android
- No console errors or warnings

### Phase 6: Polish & Optimization (Week 9-10)
**Goal:** UX refinement and performance optimization

**Tasks:**
1. ✅ Reinforcement UX improvements
   - Animation polish
   - Haptic feedback on successful strokes
   - Audio feedback (optional)
2. ✅ AI generation optimization
   - Caching for style previews
   - Loading state improvements
   - Error recovery
3. ✅ Copy & messaging refinement
   - A/B test screen copy
   - Tooltip improvements
   - Onboarding flow updates
4. ✅ Analytics integration
   - Track reinforcement completion rate
   - Track skip rate
   - Track fidelity score distribution
   - Track style preference
5. ✅ Performance profiling
   - SVG rendering optimization
   - Image loading optimization
   - Memory leak detection

**Success Criteria:**
- Reinforcement feels smooth and satisfying
- AI generation feels fast and reliable
- Copy is clear and motivating
- Analytics dashboards are live
- Performance metrics meet targets (see Section 8)

---

## 8. Success Metrics & Acceptance Criteria

### 8.1 Product Metrics (Post-Launch)

| Metric | Baseline (Current) | Target | Measurement |
|--------|-------------------|--------|-------------|
| **First Anchor Completion Rate** | ~55% (estimated) | ≥65% | % of users who complete first anchor creation |
| **Median Completion Time** | ~3-5 min | ≤2 min | Time from IntentionInput to ChargeChoice |
| **Reinforcement Participation Rate** | N/A (new feature) | ≥40% | % who complete (not skip) reinforcement |
| **Reinforcement Fidelity Score** | N/A | Avg ≥75% | Mean overlap percentage |
| **AI Enhancement Adoption** | ~60% (current AI path) | ≥50% | % who choose "Enhance" vs "Keep Pure" |
| **Daily Activation Frequency** | 1.2x/day (estimated) | ≥1.5x/day | Avg activations per anchor per day |
| **7-Day Retention** | Unknown | ≥45% | % return within 7 days |
| **Anchor Attachment Score** | N/A | TBD | Survey: emotional connection 1-10 |

### 8.2 Technical Acceptance Criteria

**Data Integrity:**
- ✅ All anchors have `baseSigilSvg`
- ✅ `reinforcedSigilSvg` is valid SVG or null
- ✅ `enhancedImageUrl` is valid URL or null
- ✅ Metadata fields are correctly populated
- ✅ No data loss during migration

**Performance:**
- ✅ Reinforcement screen renders at ≥60fps on mid-range devices
- ✅ SVG rasterization completes in ≤2 seconds
- ✅ ControlNet generation completes in ≤90 seconds
- ✅ App bundle size increase ≤5MB
- ✅ Memory usage during reinforcement ≤150MB

**UX Quality:**
- ✅ Reinforcement guidance feels helpful, not restrictive
- ✅ Skip option is clearly visible
- ✅ AI-enhanced images preserve structure visually
- ✅ No crashes during creation flow
- ✅ Offline mode gracefully handles missing AI

**Code Quality:**
- ✅ TypeScript strict mode passes
- ✅ No ESLint errors
- ✅ Test coverage ≥70% for new code
- ✅ Accessibility score ≥90 (Lighthouse)

---

## 9. Risk Assessment & Mitigation

### 9.1 High-Risk Areas

**Risk 1: Reinforcement UX Complexity**
- **Risk:** Guided tracing feels too restrictive or confusing
- **Impact:** High - Users skip reinforcement, defeating the purpose
- **Mitigation:**
  - Prototype with 10-15 users before full implementation
  - A/B test "strictness" levels (overlap threshold)
  - Provide clear onboarding tutorial
  - Make skip button prominent to avoid frustration

**Risk 2: ControlNet Structure Preservation**
- **Risk:** AI-enhanced images lose structure, look muddy
- **Impact:** High - AI enhancement becomes unusable
- **Mitigation:**
  - Spike/prototype ControlNet with sample sigils FIRST
  - Test multiple control methods (Canny, Lineart, Depth)
  - Implement fallback to SVG filters if AI fails
  - Disable problematic styles from selection

**Risk 3: Flow Length & Drop-off**
- **Risk:** 10+ step flow causes high abandonment
- **Impact:** Medium - Lower completion rates
- **Mitigation:**
  - Make reinforcement skippable
  - Make AI enhancement skippable
  - Track funnel metrics per-step
  - Optimize micro-interactions for speed

**Risk 4: Backend Migration Complexity**
- **Risk:** Database migration fails, data corruption
- **Impact:** High - Production data loss
- **Mitigation:**
  - Test migration on staging with production snapshot
  - Make all new fields nullable for backward compatibility
  - Implement rollback plan
  - Phased rollout with feature flags

### 9.2 Medium-Risk Areas

**Risk 5: AI Generation Costs**
- **Risk:** ControlNet is more expensive than text-to-image
- **Impact:** Medium - Increased operational costs
- **Mitigation:**
  - Benchmark costs per generation during spike
  - Implement caching for repeat styles
  - Consider rate limiting for free users
  - Monitor costs with alerts

**Risk 6: Mobile Performance**
- **Risk:** SVG rendering and image loading lag on older devices
- **Impact:** Medium - Poor UX on lower-end phones
- **Mitigation:**
  - Test on iPhone 8, Samsung Galaxy A52 (mid-range)
  - Implement progressive image loading
  - Optimize SVG complexity (simplify paths if needed)
  - Use lower-res images for previews

---

## 10. Open Questions & Decisions Needed

### 10.1 Product Decisions

**Q1:** Should manual reinforcement be mandatory or skippable?
- **Options:**
  - A) Mandatory for all users (forces embodiment)
  - B) Skippable with encouragement (soft guidance)
  - C) Mandatory for Pro users, skippable for Free (incentive)
- **Recommendation:** **B** - Skippable with encouragement. Track skip rate and iterate.

**Q2:** Should we allow users to redo reinforcement if unsatisfied?
- **Options:**
  - A) One attempt only (commitment)
  - B) Unlimited retries (perfectionism support)
  - C) 3 attempts max (balanced)
- **Recommendation:** **B** - Unlimited retries with "Restart" button. Low implementation cost, high UX value.

**Q3:** What fidelity score threshold qualifies as "good" reinforcement?
- **Options:**
  - A) ≥90% (very strict)
  - B) ≥75% (balanced)
  - C) ≥60% (lenient)
- **Recommendation:** **B** - 75%. Display score but don't gate progression. Use for celebration messaging.

**Q4:** Should "Keep Pure" path show the base or reinforced sigil?
- **Answer:** Show `reinforcedSigilSvg` if it exists, otherwise `baseSigilSvg`. User's effort should be visible.

**Q5:** How many AI style options should we launch with?
- **Options:**
  - A) 3 styles (MVP, simple)
  - B) 6 styles (balanced variety)
  - C) 10+ styles (maximum choice)
- **Recommendation:** **B** - 6 styles. Enough variety without overwhelming users.

### 10.2 Technical Decisions

**Q6:** Which ControlNet preprocessing method should we use?
- **Options:**
  - A) Canny edge detection (sharper edges, geometric)
  - B) Lineart (softer, artistic)
  - C) Both - let style determine method
- **Recommendation:** **C** - Different styles benefit from different methods. Geometric styles → Canny, Organic styles → Lineart.

**Q7:** Should we implement SVG-to-PNG rasterization client-side or server-side?
- **Options:**
  - A) Client-side (React Native SVG library)
  - B) Server-side (Node.js + Sharp/Canvas)
- **Recommendation:** **B** - Server-side. More control over output quality, doesn't impact mobile performance.

**Q8:** How should we handle offline mode for AI enhancement?
- **Options:**
  - A) Block AI enhancement entirely (require network)
  - B) Queue request, generate when back online
  - C) Show placeholder, allow "Keep Pure" path
- **Recommendation:** **C** - Gracefully degrade to "Keep Pure" if offline. Queue not worth complexity.

**Q9:** Should `reinforcedSigilSvg` be stored as SVG string or separate file?
- **Options:**
  - A) SVG string in database (simpler)
  - B) File in R2 storage + URL reference (cleaner)
- **Recommendation:** **A** - SVG string. Small file size, no network latency, easier to manipulate.

---

## 11. Summary & Next Steps

### 11.1 Key Takeaways

✅ **This is a strategic pivot, not a feature addition**
- Fundamental change to product philosophy
- Shifts positioning from "AI magic generator" to "authentic chaos magick with modern polish"

✅ **Implementation is feasible but non-trivial**
- ~8-10 weeks of focused development
- Requires AI pipeline rewrite (ControlNet)
- Significant UX design work for reinforcement screen

✅ **Risk is manageable with proper phasing**
- Prototype reinforcement UX early
- Validate ControlNet quality before full build
- Phased rollout with feature flags

✅ **Data architecture is sound**
- New fields are additive and backward-compatible
- Clear lineage: base → reinforced → enhanced
- Metadata enables analytics and debugging

### 11.2 Immediate Next Steps

**Step 1: Decision Approval (You)**
- Review this document
- Answer open questions (Section 10)
- Approve roadmap or request changes

**Step 2: Spike Phase (Week 1)**
- [ ] ControlNet quality test with 10 sample sigils
- [ ] Reinforcement UX paper prototype with 5 users
- [ ] Database migration dry-run on staging
- [ ] Go/No-Go decision

**Step 3: Phase 1 Kickoff (Week 2)**
- [ ] Begin data model updates
- [ ] Set up feature flags
- [ ] Create GitHub project board
- [ ] Assign tasks to team

---

## Appendix A: File Change Checklist

### Files to CREATE
- [ ] `/apps/mobile/src/screens/create/LockStructureScreen.tsx`
- [ ] `/apps/mobile/src/screens/create/StyleSelectionScreen.tsx`
- [ ] `/backend/src/utils/svgRasterizer.ts`
- [ ] `/docs/ARCHITECTURE_REFACTOR_PLAN.md` (this document)

### Files to RENAME
- [ ] `SigilSelectionScreen.tsx` → `StructureForgeScreen.tsx`
- [ ] `ManualForgeScreen.tsx` → `ManualReinforcementScreen.tsx`
- [ ] `AIVariationPickerScreen.tsx` → `EnhancedVersionPickerScreen.tsx`

### Files to MODIFY
- [ ] `/apps/mobile/src/types/index.ts` - Add new types
- [ ] `/apps/mobile/src/screens/create/EnhancementChoiceScreen.tsx` - Refactor options
- [ ] `/apps/mobile/src/screens/create/MantraCreationScreen.tsx` - Read from reinforcedSigilSvg
- [ ] `/apps/mobile/src/screens/create/AIGeneratingScreen.tsx` - ControlNet pipeline
- [ ] `/apps/mobile/src/stores/anchorStore.ts` - Handle new fields
- [ ] `/backend/src/services/AIEnhancer.ts` - Complete rewrite
- [ ] `/backend/src/types/index.ts` - Mirror frontend changes
- [ ] `/backend/prisma/schema.prisma` - Add new columns

### Files to DELETE
- [ ] `/apps/mobile/src/screens/create/PostForgeChoiceScreen.tsx`
- [ ] `/apps/mobile/src/screens/create/AIAnalysisScreen.tsx`
- [ ] `/backend/src/services/IntentionAnalyzer.ts`
- [ ] `/backend/src/data/symbols.ts`

---

## Appendix B: Glossary

**Terms Used in This Document:**

- **Base Sigil** - The deterministically generated structure from `traditional-generator.ts`
- **Reinforced Sigil** - User-traced version of the base sigil (if reinforcement completed)
- **Enhanced Sigil** - AI-styled version preserving structure (if AI enhancement chosen)
- **Structure Fidelity** - Overlap percentage between user's tracing and base structure (0-100%)
- **ControlNet** - AI technique to condition image generation on structural inputs (edges, depth, etc.)
- **Style Transfer** - Applying aesthetic changes while preserving underlying structure
- **Deterministic Generation** - Same input always produces same output (reproducible)
- **Source of Truth** - The canonical data field to read from for a given purpose
- **Embodiment** - User's physical/temporal investment in the creation process (tracing, attention)

---

**End of Document**

*For questions or feedback on this plan, contact the architecture team.*
