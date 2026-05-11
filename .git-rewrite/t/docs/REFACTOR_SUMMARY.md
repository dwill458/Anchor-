# Anchor Architecture Refactor - Executive Summary

**Status:** Planning Complete - Awaiting Approval
**Date:** 2026-01-19
**Full Plan:** See `ARCHITECTURE_REFACTOR_PLAN.md` for complete details

---

## What's Changing

### Strategic Pivot
**FROM:** AI-first sigil generation (AI creates structure and appearance)
**TO:** Deterministic structure + manual reinforcement + optional AI styling

### Why This Matters
- **Authenticity:** Preserves traditional chaos magick methodology
- **Differentiation:** Not another "AI magic generator" - hybrid approach
- **Merchandising:** SVG-based structure is infinitely scalable
- **Retention:** Higher emotional attachment through user embodiment

---

## Quick Reference: Current vs. Target

### Current Flow (3 Paths)
```
1. AI Path: Intent → Distillation → AI Analysis → AI Generation → Picker → Mantra
2. Traditional: Intent → Distillation → Pick Variant → Mantra
3. Manual: Intent → Distillation → Freehand Draw → Optional AI → Mantra
```

### Target Flow (1 Path, Optional Steps)
```
Intent → Distillation → Structure Forge → [Reinforcement] → Lock →
[AI Enhancement] → Mantra → Charge

Skippable: Reinforcement, AI Enhancement
Mandatory: Structure selection (deterministic)
```

---

## Major Technical Changes

### 1. Data Model
**Add 3 new fields to `Anchor` interface:**
- `reinforcedSigilSvg?: string` - User-traced version
- `structureVariant: SigilVariant` - Which variant chosen
- `reinforcementMetadata?: ReinforcementMetadata` - Tracking data
- `enhancementMetadata?: EnhancementMetadata` - AI style info

### 2. Screens to Create
- `LockStructureScreen.tsx` - Confirmation before AI choice
- `StyleSelectionScreen.tsx` - Choose AI aesthetic (watercolor, sacred geometry, etc.)

### 3. Screens to Refactor
- **Rename:** `SigilSelection` → `StructureForge`
- **Rename:** `ManualForge` → `ManualReinforcement` (guided tracing, not freehand)
- **Modify:** `EnhancementChoice` (remove old paths, add Keep Pure / Enhance)
- **Modify:** `AIGenerating` (ControlNet instead of text-to-image)

### 4. Screens to Delete
- `PostForgeChoiceScreen.tsx` - No longer needed
- `AIAnalysisScreen.tsx` - No symbol selection in new model

### 5. AI Pipeline Overhaul
**Current:** Text-to-image (Stable Diffusion XL)
**Target:** Structure-conditioned generation (ControlNet + SDXL)

```
Input: SVG structure (reinforced OR base)
   ↓
Rasterize → Canny/Lineart preprocessing
   ↓
ControlNet + SDXL (preserve structure, apply style)
   ↓
Output: 4 styled variations maintaining structure
```

---

## Timeline & Effort

### Phased Roadmap (8-10 Weeks)

**Phase 1: Data Model (Week 1-2)**
- Update types, database migration, API changes

**Phase 2: Reinforcement UI (Week 3-4)**
- Build guided tracing screen with overlap detection
- Create LockStructure screen

**Phase 3: AI Pipeline (Week 5-6)**
- ControlNet integration
- SVG rasterization
- Style selection screen

**Phase 4: Enhancement Refactor (Week 7)**
- Update EnhancementChoice
- Connect new flow end-to-end

**Phase 5: Cleanup (Week 8)**
- Delete old code
- Testing
- Documentation

**Phase 6: Polish (Week 9-10)**
- UX refinement
- Analytics
- Performance optimization

---

## Critical Decisions Needed (YOU)

### Decision 1: Reinforcement Strictness
**Question:** Should manual reinforcement be mandatory or skippable?

Options:
- **A)** Mandatory for all users
- **B)** Skippable with encouragement ⭐ **RECOMMENDED**
- **C)** Mandatory for Pro, skippable for Free

**Recommendation:** Skippable (B) - Track engagement, iterate based on data

---

### Decision 2: Fidelity Score Threshold
**Question:** What overlap % qualifies as "good" reinforcement?

Options:
- **A)** ≥90% (very strict)
- **B)** ≥75% (balanced) ⭐ **RECOMMENDED**
- **C)** ≥60% (lenient)

**Recommendation:** 75% (B) - Don't gate progression, use for celebration

---

### Decision 3: AI Style Count
**Question:** How many style options to launch with?

Options:
- **A)** 3 styles (minimal)
- **B)** 6 styles (balanced) ⭐ **RECOMMENDED**
- **C)** 10+ styles (maximum choice)

**Recommendation:** 6 styles (B) - watercolor, sacred geometry, ink brush, gold leaf, cosmic, minimal line

---

### Decision 4: ControlNet Method
**Question:** Which preprocessing method?

Options:
- **A)** Canny edge (geometric, sharp)
- **B)** Lineart (organic, soft)
- **C)** Both - style-dependent ⭐ **RECOMMENDED**

**Recommendation:** Both (C) - Geometric styles use Canny, organic use Lineart

---

## Risk Mitigation

### Top 3 Risks

**1. Reinforcement UX Complexity**
- **Risk:** Feels too restrictive or confusing
- **Mitigation:** Prototype with 10-15 users first, A/B test strictness levels

**2. ControlNet Structure Preservation**
- **Risk:** AI output loses structure, looks muddy
- **Mitigation:** Spike FIRST with sample sigils, implement SVG filter fallback

**3. Flow Length & Drop-off**
- **Risk:** 10+ steps causes abandonment
- **Mitigation:** Make reinforcement + AI skippable, track funnel metrics

---

## Success Metrics (Target)

| Metric | Target |
|--------|--------|
| First Anchor Completion Rate | ≥65% |
| Median Completion Time | ≤2 min |
| Reinforcement Participation | ≥40% |
| Average Fidelity Score | ≥75% |
| AI Enhancement Adoption | ≥50% |
| 7-Day Retention | ≥45% |

---

## Next Steps

### Immediate Actions Required

1. **YOU: Review & Approve**
   - Read full `ARCHITECTURE_REFACTOR_PLAN.md`
   - Answer 4 critical decisions above
   - Approve roadmap or request changes

2. **Spike Phase (Week 1)**
   - ControlNet quality test with sample sigils
   - Reinforcement UX paper prototype with users
   - Database migration dry-run
   - **Go/No-Go decision**

3. **If Go: Phase 1 Kickoff (Week 2)**
   - Begin data model updates
   - Set up feature flags
   - Create project board
   - Assign development tasks

---

## Key Files Reference

### Documentation
- `ARCHITECTURE_REFACTOR_PLAN.md` - Full 11-section detailed plan
- `REFACTOR_SUMMARY.md` - This executive summary

### Code Locations
- Types: `/apps/mobile/src/types/index.ts`
- Screens: `/apps/mobile/src/screens/create/`
- AI Service: `/backend/src/services/AIEnhancer.ts`
- Generators: `/apps/mobile/src/utils/sigil/`

---

## Questions or Concerns?

If you have questions about:
- **Product strategy** → Review Section 1 of full plan
- **Technical feasibility** → Review Sections 4-6 of full plan
- **Timeline** → Review Section 7 of full plan
- **Risks** → Review Section 9 of full plan

---

**Ready to proceed with implementation?**

Reply with:
1. Decisions on the 4 critical questions above
2. Go/No-Go on Spike Phase
3. Any modifications to the roadmap

---

*End of Summary*
