# Imagen 3 Prompting Guide for Sigil Enhancement

## Overview

This guide explains how to get the best results from Google Vertex AI Imagen 3 for sigil enhancement with thematic symbol generation.

## The Problem We Solved

**Before:** Imagen 3 would only apply artistic styles without adding meaningful symbols.

**After:** Imagen 3 now intelligently adds thematic symbols based on the user's intention while preserving the base sigil structure.

## How It Works

### 1. Prompt Construction Pipeline

```
User Intent → Thematic Symbol Mapping → Enhanced Prompt → Imagen 3 → Enhanced Sigil
```

### 2. Prompt Structure

Each Imagen 3 prompt has 5 layers:

```
[Style Foundation] +
[Symbol Addition Instructions] +
[Structure Preservation] +
[Visual Balance] +
[Quality Requirements]
```

### 3. Example Transformations

#### Example 1: Strength in Gym

**Input Intent:** `"strength in gym"`

**Generated Prompt:**
```
Mystical watercolor sigil artwork, soft translucent washes, flowing colors,
ethereal paper texture, gentle color bleeding. Enhance the sigil by adding
corresponding symbolic elements that represent: "strength in gym". Include
symbolic elements such as: flexed muscles, flames of power, dumbbells,
fitness equipment, strong arms. The original sigil line structure must remain
clearly visible and intact as the central focus. Arrange the symbolic elements
harmoniously around and within the sigil design. High quality mystical artwork,
balanced composition, professional finish.
```

**Result:** Watercolor sigil with muscles, dumbbells, fire, and power symbols while maintaining the original geometry.

#### Example 2: Boundaries

**Input Intent:** `"boundaries and protection"`

**Generated Prompt:**
```
Sacred geometry sigil with golden metallic sheen, precise mathematical lines,
geometric perfection, subtle luminous glow. Enhance the sigil by adding
corresponding symbolic elements that represent: "boundaries and protection".
Include symbolic elements such as: chains, locks, shields, protective barriers,
celtic knots. The original sigil line structure must remain clearly visible and
intact as the central focus. Arrange the symbolic elements harmoniously around
and within the sigil design. High quality mystical artwork, balanced composition,
professional finish.
```

**Result:** Sacred geometry sigil with chains, locks, shields, and protective symbols.

#### Example 3: Prosperity

**Input Intent:** `"prosperity and abundance"`

**Generated Prompt:**
```
Illuminated manuscript sigil with gold leaf gilding, medieval luxury, precious
metal sheen, ornate texture on lines. Enhance the sigil by adding corresponding
symbolic elements that represent: "prosperity and abundance". Include symbolic
elements such as: gold coins, cornucopia, flowing water, full baskets, fruit.
The original sigil line structure must remain clearly visible and intact as the
central focus. Arrange the symbolic elements harmoniously around and within the
sigil design. High quality mystical artwork, balanced composition, professional finish.
```

**Result:** Gold leaf sigil with coins, cornucopia, and abundance symbols.

## Thematic Symbol Mapping

The system automatically maps intentions to symbolic elements:

### Physical & Strength
- **Keywords:** strength, gym, power, fitness
- **Symbols:** flexed muscles, flames of power, dumbbells, lions, oak trees, strong arms, energy bursts

### Protection & Boundaries
- **Keywords:** boundary, boundaries, protection, defense
- **Symbols:** chains, locks, shields, protective barriers, celtic knots, fortress walls, armor, guardian animals

### Abundance & Prosperity
- **Keywords:** prosperity, wealth, abundance
- **Symbols:** gold coins, cornucopia, flowing water, treasure, gems, golden rays, full baskets, fruit

### Love & Relationships
- **Keywords:** love, relationship, romance
- **Symbols:** hearts, roses, intertwined vines, doves, linked circles, infinity symbols

### Wisdom & Knowledge
- **Keywords:** wisdom, knowledge, learning
- **Symbols:** owls, books, ancient scrolls, eye symbols, light rays, lanterns, keys

### Health & Healing
- **Keywords:** health, healing
- **Symbols:** medical symbols, healing herbs, vitality spirals, green energy, water, gentle light

### Success & Achievement
- **Keywords:** success, achievement, victory
- **Symbols:** laurel wreaths, trophies, ascending arrows, stars, medals, crowns, eagles

### Peace & Calm
- **Keywords:** peace, calm, serenity
- **Symbols:** doves, olive branches, calm waters, zen circles, lotus flowers, balanced stones

### Creativity & Inspiration
- **Keywords:** creativity, inspiration, art
- **Symbols:** paintbrushes, musical notes, flowing ribbons, bursts of color, shooting stars

## API Usage

### Request Format

```typescript
POST /api/ai/enhance-controlnet

{
  "sigilSvg": "<svg>...</svg>",
  "styleChoice": "watercolor",
  "userId": "user123",
  "anchorId": "anchor456",
  "intentionText": "strength in the gym",  // ← NEW FIELD
  "provider": "google"  // Optional: force Google Vertex AI
}
```

### Response

```json
{
  "success": true,
  "variations": [
    {
      "imageUrl": "https://...",
      "structureMatchScore": 0.91,
      "iouScore": 0.92,
      "edgeOverlapScore": 0.89,
      "structurePreserved": true,
      "classification": "Structure Preserved",
      "wasComposited": false,
      "seed": 123456
    }
  ],
  "prompt": "Full generated prompt...",
  "provider": "google",
  "model": "imagen-3.0-capability-001"
}
```

## Best Practices

### ✅ DO

1. **Be specific with intentions:**
   - Good: `"strength in the gym and physical power"`
   - Bad: `"good things"`

2. **Use descriptive language:**
   - Good: `"boundaries and protection from negative energy"`
   - Bad: `"boundaries"`

3. **Combine multiple themes if relevant:**
   - Good: `"wisdom, knowledge, and learning from books"`
   - Bad: `"stuff"`

4. **Match style to intention:**
   - Strength/Power → `gold_leaf` or `cosmic`
   - Peace/Calm → `watercolor` or `minimal_line`
   - Protection → `sacred_geometry` or `ink_brush`

### ❌ DON'T

1. **Don't be too vague:**
   - Bad: `"make it nice"`
   - Bad: `"good vibes"`

2. **Don't request too many concepts:**
   - Bad: `"strength, peace, love, wisdom, prosperity, health, success, and creativity"`
   - The system limits to 5 symbols max to avoid clutter

3. **Don't worry about artistic style in intentionText:**
   - Bad: `"strength with watercolor and gold accents"`
   - Good: `"strength in the gym"` (style is controlled by `styleChoice`)

## Troubleshooting

### Problem: Generated images don't match intention

**Solution:** Be more specific with your intentionText.

```diff
- intentionText: "success"
+ intentionText: "career success and professional achievement"
```

### Problem: Too many symbols, cluttered design

**Solution:** Simplify your intention to 1-2 core themes.

```diff
- intentionText: "strength, power, victory, achievement, success, and glory"
+ intentionText: "strength and victory"
```

### Problem: Symbols don't appear at all

**Solution:** Check that your intention uses recognized keywords from the thematic mapping. If you're using a unique intention, the system falls back to generic mystical symbols.

```diff
- intentionText: "facilitating synergistic outcomes"
+ intentionText: "success and achievement"
```

### Problem: Structure is lost or heavily modified

**Solution:** This is a balance issue. The enhanced prompting explicitly preserves structure, but if you're seeing drift:

1. Use styles with higher `conditioning_scale`: `sacred_geometry` (1.25) or `minimal_line` (1.30)
2. Simplify your intention to reduce symbol complexity
3. Check the `structureMatchScore` in the response - scores above 0.85 are considered "Structure Preserved"

## Code Architecture

### Key Files

- **`backend/src/services/GoogleVertexAI.ts`** - Prompt construction and Imagen 3 API calls
- **`backend/src/services/AIEnhancer.ts`** - Provider selection (Google vs Replicate)
- **`backend/src/api/routes/ai.ts`** - API endpoint

### Key Methods

```typescript
// GoogleVertexAI.ts
buildEnhancedPrompt(styleBase, intentionText, style): string
getSymbolInstructions(intentionText): string

// Main entry point
enhanceSigil(params): Promise<EnhancedSigilResult>
```

## Performance

- **Generation Time:** 25-45 seconds for 4 variations (parallel)
- **Cost:** $0.02 per image × 4 = $0.08 per request
- **Structure Preservation:** 85%+ IoU score typical with enhanced prompting

## Future Improvements

1. **User-defined symbol mappings** - Allow users to specify custom symbols
2. **Multi-language support** - Detect and handle non-English intentions
3. **Negative symbol filtering** - Prevent unwanted symbols explicitly
4. **Dynamic symbol count** - Adjust number of symbols based on style complexity

## Example Integration

```typescript
// Mobile app / frontend
const response = await fetch('/api/ai/enhance-controlnet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sigilSvg: userSigil,
    styleChoice: 'watercolor',
    userId: currentUser.id,
    anchorId: newAnchor.id,
    intentionText: userInput, // ← User's intention from creation flow
    provider: 'google'
  })
});

const { variations } = await response.json();
// variations[0].imageUrl contains enhanced sigil with thematic symbols
```

## Support

For issues with prompt generation or unexpected results:

1. Check the `prompt` field in the API response to see what was sent to Imagen 3
2. Review server logs for `[GoogleVertexAI] Built enhanced prompt` messages
3. Verify your intention uses keywords from the thematic mapping table above
4. Test with simple, single-theme intentions first before combining multiple themes
