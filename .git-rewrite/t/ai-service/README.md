# Anchor AI Service - Sigil Geometry Preservation

This Python service provides **structure-preserving** AI enhancement for sigils. It solves the "Structure Preserved" badge lying problem by implementing strict geometry preservation.

## Problem Solved

Previously, the AI would drift from the original sigil structure:
- Adding extra rings, runes, or decorative elements
- Redrawing line paths in a "more balanced" way
- Changing composition and adding frames

**Now**: The sigil's exact geometry is preserved, with only "surface treatment" (texture, color, glow) applied.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Request                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Node/Express Backend                            │
│    POST /api/ai/enhance-controlnet                          │
│    - Validates request                                       │
│    - Calls Python AI service (or Replicate directly)        │
│    - Returns variations + structure scores                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Python AI Service (this)                        │
│                                                              │
│  1. PREPROCESS                                              │
│     - SVG → High-contrast PNG (1024x1024)                   │
│     - Stroke thickening (2x) for edge survival              │
│     - 12% padding for edge protection                       │
│     - Edge enhancement for ControlNet detection             │
│                                                              │
│  2. GENERATE                                                │
│     - ControlNet with STRICT params:                        │
│       • conditioning_scale: 1.15 (was 0.8)                  │
│       • guidance_scale: 5.0 (was 7.5)                       │
│       • strength: 0.25 (new)                                │
│     - Strict prompts: "preserve exact geometry"             │
│     - Strict negative: "no extra lines, no redesign"        │
│                                                              │
│  3. VALIDATE                                                │
│     - Compute IoU between original and generated            │
│     - Edge overlap score                                     │
│     - Combined score (85% threshold)                         │
│     - Classification: "Structure Preserved" vs "Style Drift" │
│                                                              │
│  4. COMPOSITE (optional, guaranteed fidelity)               │
│     - Inpaint background only                               │
│     - Overlay original sigil lines                          │
│     - Result: 100% structure preservation                   │
└─────────────────────────────────────────────────────────────┘
```

## Key Parameters

### ControlNet Configuration (Strict)

| Parameter | Old Value | New Value | Effect |
|-----------|-----------|-----------|--------|
| `conditioning_scale` | 0.8 | 1.15 | Higher = stricter structure adherence |
| `guidance_scale` | 7.5 | 5.0 | Lower = less prompt drift |
| `strength` | (none) | 0.25 | Lower = more original preserved |
| `control_guidance_end` | (none) | 0.95 | Maintain control longer |

### Preprocessing

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `stroke_multiplier` | 2.0 | Thicken strokes to survive diffusion |
| `padding` | 12% | Protect edges from cutoff |
| `edge_enhance_sigma` | 1.2 | Sharpen for ControlNet detection |

### Structure Validation

| Threshold | Value | Classification |
|-----------|-------|----------------|
| ≥ 0.85 | 85%+ | "Structure Preserved" |
| 0.70-0.85 | 70-85% | "More Artistic" |
| < 0.70 | Below 70% | "Style Drift" |

## API Endpoints

### POST /enhance

Generate styled variations with structure validation.

**Request:**
```json
{
  "sigil_svg": "<svg>...</svg>",
  "style_choice": "watercolor",
  "user_id": "user-123",
  "anchor_id": "anchor-456",
  "num_variations": 4,
  "auto_composite": false,
  "min_structure_score": 0.85
}
```

**Response:**
```json
{
  "success": true,
  "variations": [
    {
      "image_base64": "...",
      "structure_match_score": 0.91,
      "structure_preserved": true,
      "classification": "Structure Preserved",
      "was_composited": false
    }
  ],
  "passing_count": 4,
  "best_variation_index": 0
}
```

### POST /preprocess

Preprocess sigil to control image.

### POST /structure-match

Compute structure match between original and generated.

### POST /composite

Composite original lines onto generated background (guaranteed 100% preservation).

### GET /health

Health check.

### GET /styles

Get available style presets.

## Installation

```bash
cd ai-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export REPLICATE_API_TOKEN="your-token"
export AI_SERVICE_PORT=8001

# Run service
python main.py
```

## Docker

```bash
# Build
docker build -t anchor-ai-service .

# Run
docker run -p 8001:8001 -e REPLICATE_API_TOKEN="your-token" anchor-ai-service
```

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run validation script
python -c "from tests.test_structure_preservation import validate_structure_preservation; validate_structure_preservation()"
```

## Style Presets

All style presets now use strict prompts that explicitly preserve geometry:

- **watercolor**: Soft watercolor texture, preserved linework
- **ink_brush**: Traditional sumi-e aesthetic, exact strokes
- **sacred_geometry**: Golden metallic sheen, precise geometry
- **gold_leaf**: Medieval illumination, exact shape
- **cosmic**: Ethereal glow, unchanged structure
- **minimal_line**: Clean minimalist, absolute precision

## ControlNet Model Selection

| Style Category | ControlNet Type | Why |
|----------------|-----------------|-----|
| Organic (watercolor, ink, cosmic) | lineart/scribble | Preserves flowing lines |
| Geometric (sacred, gold, minimal) | canny | Preserves sharp edges |

## Troubleshooting

### Structure score too low

1. Increase `conditioning_scale` (try 1.3-1.5)
2. Decrease `strength` (try 0.18-0.22)
3. Enable `auto_composite` for guaranteed fidelity

### Strokes disappearing

1. Increase `stroke_multiplier` (try 2.5-3.0)
2. Increase `min_stroke_width`

### Edge cutoff

1. Increase `padding` (try 0.15-0.18)

## Mobile UI Guidance

### Compare Toggle
Add an overlay showing original wireframe on generated output:
```tsx
<TouchableOpacity onPress={() => setShowOverlay(!showOverlay)}>
  <Text>Compare</Text>
</TouchableOpacity>
{showOverlay && (
  <Image source={{uri: originalSigilUrl}} style={styles.overlay} />
)}
```

### Dynamic Badge
```tsx
{variation.structurePreserved ? (
  <Badge text="Structure Preserved" color="green" />
) : (
  <Badge text="More Artistic" color="amber" />
)}
```

### Score Display
```tsx
<Text style={styles.score}>
  {Math.round(variation.structureMatchScore * 100)}% Match
</Text>
```
