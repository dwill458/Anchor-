# Spike Phase: ControlNet & Reinforcement Validation

**Status:** 🚧 IN PROGRESS
**Started:** 2026-01-19
**Duration:** 3-5 days
**Owner:** Architecture Team

---

## Objective

Validate the two highest-risk technical assumptions before committing to full implementation:

1. **ControlNet can preserve sigil structure** while applying aesthetic styles (≥80% visual fidelity)
2. **Guided tracing UX is intuitive** and not frustrating to users

---

## Decisions Locked In

✅ **Decision 1:** Reinforcement is skippable with encouragement
✅ **Decision 2:** Fidelity threshold = 75%
✅ **Decision 3:** Launch with 6 AI styles
✅ **Decision 4:** Use both Canny (geometric) and Lineart (organic) preprocessing

---

## Task 1: SVG Rasterization Pipeline

### Goal
Build server-side utility to convert sigil SVG → high-contrast PNG for ControlNet input.

### Requirements
- Input: SVG string from `baseSigilSvg` or `reinforcedSigilSvg`
- Output: PNG image (1024x1024 recommended)
- Black background, white lines (high contrast)
- Clean edges suitable for Canny/Lineart preprocessing

### Implementation Plan
- [ ] Create `/backend/src/utils/svgRasterizer.ts`
- [ ] Use Node.js canvas or Sharp library for server-side rendering
- [ ] Test with sigils of varying complexity
- [ ] Optimize resolution and contrast settings

### Success Criteria
- ✅ Converts valid SVG to PNG without errors
- ✅ Output has clear, high-contrast edges
- ✅ Works with all traditional generator variants (Dense, Balanced, Minimal)
- ✅ Processing time < 2 seconds per sigil

### Status
🔄 **IN PROGRESS**

---

## Task 2: Generate Test Sigils

### Goal
Create diverse set of sigils to test ControlNet quality across different structures.

### Test Cases

| # | Intention | Distilled Letters | Complexity | Variant | Purpose |
|---|-----------|------------------|------------|---------|---------|
| 1 | "I attract wealth" | TRCTWLTH | Medium (8 letters) | Balanced | Baseline test |
| 2 | "I am confident" | MCNFDNT | Medium (7 letters) | Balanced | Standard complexity |
| 3 | "Protect my home" | PRTCTMYHM | High (9 letters) | Dense | Complex structure |
| 4 | "Find peace" | FNDPC | Low (5 letters) | Minimal | Simple structure |
| 5 | "Creative power" | CRTVPWR | Medium (7 letters) | Dense | Dense variant test |
| 6 | "Heal my body" | HLMYBDY | Medium (7 letters) | Balanced | Organic flow |
| 7 | "Success flows" | SCCSFLWS | High (8 letters) | Dense | Complex dense |
| 8 | "Love returns" | LVRTNS | Low (6 letters) | Minimal | Simple minimal |
| 9 | "Transform self" | TRNSFRMSLF | Very High (10 letters) | Dense | Edge case complexity |
| 10 | "Be free" | BFR | Very Low (3 letters) | Minimal | Edge case simplicity |

### Implementation
- [ ] Use existing `traditional-generator.ts` to generate all test sigils
- [ ] Save as SVG files in `/spike-phase/test-sigils/`
- [ ] Document metadata (letters, variant, complexity)

### Status
⏳ **PENDING**

---

## Task 3: ControlNet Quality Validation

### Goal
Test ControlNet + SDXL with 6 styles across 10 test sigils to measure structure preservation.

### AI Styles to Test

1. **Watercolor** (Organic)
   - Method: Lineart
   - Prompt: "flowing watercolor painting, soft edges, translucent washes, mystical sigil symbol"
   - Negative: "new shapes, additional symbols, text, faces, people, photography"

2. **Sacred Geometry** (Geometric)
   - Method: Canny
   - Prompt: "sacred geometry, precise golden lines, geometric perfection, mystical symbol etched in gold"
   - Negative: "new shapes, additional symbols, text, faces, organic, soft"

3. **Ink Brush** (Organic)
   - Method: Lineart
   - Prompt: "traditional ink brush calligraphy, flowing brushstrokes, zen aesthetic, black ink on paper"
   - Negative: "new shapes, additional symbols, text, digital, 3d"

4. **Gold Leaf** (Hybrid)
   - Method: Test both Canny and Lineart
   - Prompt: "illuminated manuscript, gold leaf gilding, ornate medieval style, precious metal"
   - Negative: "new shapes, additional symbols, text, modern, photography"

5. **Cosmic** (Organic)
   - Method: Lineart
   - Prompt: "cosmic energy, nebula, starlight, glowing ethereal sigil in deep space"
   - Negative: "new shapes, additional symbols, text, faces, planets, realistic"

6. **Minimal Line** (Geometric)
   - Method: Canny
   - Prompt: "minimal line art, clean precise lines, modern minimalist, single color on white"
   - Negative: "new shapes, additional symbols, texture, shading, embellishment"

### Testing Matrix

Total tests: **10 sigils × 6 styles = 60 ControlNet generations**

### Evaluation Criteria

For each generated image, rate:
- **Structure Preservation** (1-10): Does the core sigil geometry remain intact?
- **Edge Fidelity** (1-10): Are the original strokes clearly visible?
- **Style Quality** (1-10): Does it look aesthetically pleasing?
- **Geometric Drift** (1-10): Any new shapes or symbols added? (10 = none, 1 = significant drift)

**Overall Score:** Average of 4 metrics
**Success Threshold:** Average score ≥ 8.0 across all 10 test sigils for at least 4/6 styles

### ControlNet Settings to Test

```typescript
// Configuration options to experiment with
{
  controlnet_conditioning_scale: [0.7, 0.8, 0.9], // Test different strengths
  guidance_scale: [7.5, 10, 15], // CFG scale
  num_inference_steps: [30, 50], // Generation steps
  control_type: ['canny', 'lineart'], // Preprocessing method
}
```

### Status
⏳ **PENDING** (Waiting for rasterization pipeline)

---

## Task 4: Reinforcement UX Prototype

### Goal
Design and validate the guided tracing interaction without building the full feature.

### Prototype Method: Paper + Digital Mockup

**Approach:**
1. Print 3-5 test sigils on paper (faint gray lines)
2. Ask 5-10 users to trace over them with pen
3. Observe: Do they understand the task? Do they stay on the lines? Is it satisfying?
4. Create Figma/mockup of digital version with feedback states

### Interaction Design Questions to Answer

1. **Visual feedback:** What happens when user is tracing correctly vs. off-path?
   - Option A: Glow effect (green = close, fade = far)
   - Option B: Stroke thickness changes (thicker when close)
   - Option C: Color changes (gold = close, gray = far)
   - Option D: Combination

2. **Constraint enforcement:** How strict should overlap detection be?
   - Option A: 90% of stroke must overlap (very strict)
   - Option B: 75% of stroke must overlap (balanced)
   - Option C: 60% of stroke must overlap (lenient)

3. **Error handling:** What happens if user draws way off-path?
   - Option A: Stroke rejected (disappears)
   - Option B: Stroke fades and prompts "Try to stay closer"
   - Option C: Stroke stays but marked as low-fidelity
   - Option D: Stroke auto-snaps to nearest path

4. **Skip option:** Where should the skip button be?
   - Option A: Top-right corner (always visible)
   - Option B: Bottom with "Continue" (parallel options)
   - Option C: After 30 seconds of inactivity (prompted)

5. **Tutorial:** How do we onboard users to this interaction?
   - Option A: Full-screen tutorial before first attempt
   - Option B: Inline tooltips during first stroke
   - Option C: Example animation showing expected behavior
   - Option D: Practice mode with simple shape first

### User Testing Protocol

**Participants:** 5-10 people (mix of Anchor users and new users)

**Test Script:**
1. Show user a faint sigil on screen/paper
2. Instruction: "Trace over this symbol to reinforce your connection to it"
3. Observe: Do they understand? Do they complete it? Any frustration?
4. Ask: "How did that feel? Was it clear what you were supposed to do?"
5. Show mockup of digital version: "If the screen gave you feedback like THIS, would that help?"

### Deliverables
- [ ] 5 paper prototypes printed
- [ ] User testing notes (5-10 participants)
- [ ] Figma mockup of reinforcement screen with feedback states
- [ ] Interaction design recommendations

### Status
⏳ **PENDING**

---

## Task 5: Database Migration Dry-Run

### Goal
Ensure data migration is safe and reversible before production deployment.

### Migration Scripts Required

**Script 1: Add new columns to Anchor table**
```sql
-- Add new fields (all nullable for backward compatibility)
ALTER TABLE anchors ADD COLUMN reinforced_sigil_svg TEXT NULL;
ALTER TABLE anchors ADD COLUMN structure_variant VARCHAR(50) DEFAULT 'balanced';
ALTER TABLE anchors ADD COLUMN reinforcement_metadata JSON NULL;
ALTER TABLE anchors ADD COLUMN enhancement_metadata JSON NULL;
```

**Script 2: Backfill existing anchors**
```sql
-- Set default values for existing records
UPDATE anchors
SET structure_variant = 'balanced',
    reinforcement_metadata = JSON_OBJECT(
        'skipped', TRUE,
        'completed', FALSE,
        'strokeCount', 0,
        'fidelityScore', 0,
        'timeSpentMs', 0
    )
WHERE reinforcement_metadata IS NULL;

-- Backfill enhancement metadata for existing AI-enhanced anchors
UPDATE anchors
SET enhancement_metadata = JSON_OBJECT(
    'styleApplied', 'legacy',
    'modelUsed', 'sdxl-text-to-image',
    'appliedAt', created_at
)
WHERE enhanced_image_url IS NOT NULL
AND enhancement_metadata IS NULL;
```

**Script 3: Rollback script**
```sql
-- Rollback in case of issues
ALTER TABLE anchors DROP COLUMN reinforced_sigil_svg;
ALTER TABLE anchors DROP COLUMN structure_variant;
ALTER TABLE anchors DROP COLUMN reinforcement_metadata;
ALTER TABLE anchors DROP COLUMN enhancement_metadata;
```

### Testing Checklist
- [ ] Run migration on staging database (copy of production)
- [ ] Verify all existing anchors still load correctly
- [ ] Verify no data loss (count before = count after)
- [ ] Test rollback script
- [ ] Measure migration time (estimate for production)
- [ ] Check foreign key constraints still valid
- [ ] Test API with new schema

### Success Criteria
- ✅ Migration completes without errors
- ✅ All existing anchors load in app correctly
- ✅ Zero data loss (checksum validation)
- ✅ Rollback script works cleanly
- ✅ Migration time < 5 minutes (for production scale)

### Status
⏳ **PENDING**

---

## Spike Phase Results Template

### ControlNet Results

| Style | Avg Structure Score | Avg Edge Fidelity | Avg Style Quality | Pass? |
|-------|---------------------|-------------------|-------------------|-------|
| Watercolor | ___ / 10 | ___ / 10 | ___ / 10 | ✅ / ❌ |
| Sacred Geometry | ___ / 10 | ___ / 10 | ___ / 10 | ✅ / ❌ |
| Ink Brush | ___ / 10 | ___ / 10 | ___ / 10 | ✅ / ❌ |
| Gold Leaf | ___ / 10 | ___ / 10 | ___ / 10 | ✅ / ❌ |
| Cosmic | ___ / 10 | ___ / 10 | ___ / 10 | ✅ / ❌ |
| Minimal Line | ___ / 10 | ___ / 10 | ___ / 10 | ✅ / ❌ |

**Overall ControlNet Pass:** ✅ / ❌ (≥4 styles with avg score ≥8.0)

### Reinforcement UX Results

- **User Comprehension:** ___ / 10 participants understood the task immediately
- **Completion Rate:** ___ / 10 participants completed the tracing
- **Satisfaction:** Average rating ___ / 10 ("How satisfying was this?")
- **Frustration:** Average rating ___ / 10 ("How frustrating was this?")
- **Recommended Feedback Type:** ___
- **Recommended Strictness Level:** ___

**Overall Reinforcement UX Pass:** ✅ / ❌ (≥7/10 comprehension, ≥6/10 satisfaction)

### Database Migration Results

- **Migration Success:** ✅ / ❌
- **Data Integrity:** ✅ / ❌
- **Rollback Test:** ✅ / ❌
- **Migration Time:** ___ seconds
- **Issues Found:** ___

**Overall Migration Pass:** ✅ / ❌

---

## Go / No-Go Decision Criteria

### ✅ GO (Proceed to Phase 1 Implementation)
**All of the following must be true:**
- ControlNet preserves structure in ≥4 styles (avg score ≥8.0)
- Reinforcement UX is comprehensible to ≥7/10 users
- Reinforcement UX satisfaction ≥6/10
- Database migration succeeds without data loss
- No critical technical blockers identified

### ⚠️ GO WITH MODIFICATIONS
**If any of these are true:**
- ControlNet works for 2-3 styles only → Launch with fewer styles
- Reinforcement UX needs iteration → Adjust interaction design before build
- Specific technical challenges → Adjust implementation approach

### ❌ NO-GO (Pause and Re-evaluate)
**If any of these are true:**
- ControlNet fails to preserve structure (<2 styles pass)
- Reinforcement UX is confusing or frustrating to majority
- Database migration causes data corruption
- Critical technical impossibility discovered

---

## Timeline

### Target Schedule
- **Day 1:** SVG rasterization + test sigil generation
- **Day 2:** ControlNet testing (30 tests)
- **Day 3:** ControlNet testing (30 tests) + reinforcement prototype
- **Day 4:** User testing + database migration dry-run
- **Day 5:** Results compilation + Go/No-Go decision

### Actual Progress
- **Day 1:** 🚧 IN PROGRESS

---

## Notes & Findings

### 2026-01-19 - Spike Phase Started
- Decisions locked in (B/B/B/C)
- Documentation created
- Beginning with SVG rasterization pipeline

---

*This document will be updated daily as spike phase progresses.*
