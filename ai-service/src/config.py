"""
Anchor AI Service - Configuration
Centralized configuration for sigil geometry preservation pipeline.
"""

import os
from typing import Dict, Any
from pydantic import BaseModel


class ControlNetConfig(BaseModel):
    """ControlNet parameters optimized for structure preservation."""

    # CRITICAL: Higher values = better structure preservation
    # We use aggressive values since structure is non-negotiable
    conditioning_scale: float = 1.15  # Was 0.8 - now 1.15 for strict adherence
    guidance_start: float = 0.0       # Start control immediately
    guidance_end: float = 0.95        # Maintain control until near-end

    # Lower CFG = less prompt influence = more structure preservation
    guidance_scale: float = 5.0       # Was 7.5 - reduced to prioritize structure

    # More steps = finer detail preservation
    num_inference_steps: int = 35     # Was 30 - slightly more for quality

    # Denoising strength - CRITICAL for img2img mode
    # Lower = more of original preserved
    denoise_strength: float = 0.28    # Sweet spot: texture without structure change


class PreprocessConfig(BaseModel):
    """Preprocessing configuration for control image generation."""

    # Output dimensions (SDXL optimal)
    output_size: int = 1024

    # Stroke thickening to survive diffusion process
    stroke_multiplier: float = 2.0    # 1.5-2.5 recommended
    min_stroke_width: int = 4         # Minimum px after thickening
    max_stroke_width: int = 12        # Cap for very thick strokes

    # Padding/margins for edge protection
    padding_percent: float = 0.12     # 10-18% recommended

    # Edge enhancement for ControlNet detection
    edge_enhance_sigma: float = 1.2

    # Dilation for protective mask (for compositing)
    mask_dilation_px: int = 6         # 4-10px recommended


class StructureMatchConfig(BaseModel):
    """Configuration for structure preservation validation."""

    # IoU threshold for "structure preserved" badge
    iou_threshold: float = 0.85       # 85%+ pixel overlap required

    # Binarization threshold for mask comparison
    binarize_threshold: int = 128

    # Edge-based matching (secondary metric)
    edge_match_threshold: float = 0.80

    # Combined score weights
    iou_weight: float = 0.7
    edge_weight: float = 0.3


class StylePreset(BaseModel):
    """Style-specific configuration."""

    name: str
    controlnet_type: str  # 'lineart', 'canny', 'scribble'
    prompt_template: str
    negative_prompt: str

    # Style-specific parameter overrides
    denoise_strength: float | None = None
    conditioning_scale: float | None = None
    guidance_scale: float | None = None


# Style presets optimized for geometry preservation
STYLE_PRESETS: Dict[str, StylePreset] = {
    "watercolor": StylePreset(
        name="watercolor",
        controlnet_type="lineart",
        prompt_template=(
            "Restore and beautify the existing sigil. Preserve exact geometry and stroke paths. "
            "Apply soft watercolor texture as surface treatment only. Translucent washes, "
            "subtle color bleeding at edges. Paper texture visible. The sigil linework remains unchanged. "
            "High-quality artistic enhancement, mystical symbol preserved exactly."
        ),
        negative_prompt=(
            "extra lines, decorative circle, mandala, compass, runes, glyphs, occult seal, "
            "emblem, logo redesign, reinterpretation, frame, border, symmetry embellishment, "
            "altered shape, new symbols, added elements, changed geometry, distorted lines, "
            "thick outlines, cartoon, 3d render, photograph"
        ),
        denoise_strength=0.30,  # Slightly higher for organic styles
    ),

    "ink_brush": StylePreset(
        name="ink_brush",
        controlnet_type="lineart",
        prompt_template=(
            "Restore and beautify the existing sigil. Preserve exact geometry and stroke paths. "
            "Apply traditional ink brush texture as surface treatment only. Sumi-e aesthetic, "
            "ink wash gradients, rice paper texture. Zen calligraphy feel. "
            "The sigil structure remains precisely as drawn."
        ),
        negative_prompt=(
            "extra lines, decorative circle, mandala, compass, runes, glyphs, occult seal, "
            "emblem, logo redesign, reinterpretation, frame, border, symmetry embellishment, "
            "altered shape, new symbols, added elements, changed geometry, digital, modern, color"
        ),
        denoise_strength=0.25,
    ),

    "sacred_geometry": StylePreset(
        name="sacred_geometry",
        controlnet_type="canny",  # Canny for geometric precision
        prompt_template=(
            "Restore and beautify the existing sigil. Preserve exact geometry and stroke paths. "
            "Apply golden metallic sheen as surface treatment only. Sacred geometry aesthetic, "
            "precise lines with subtle glow. Mathematical perfection in texture, not form. "
            "The original sigil geometry is untouched."
        ),
        negative_prompt=(
            "extra lines, decorative circle, mandala, compass, runes, glyphs, occult seal, "
            "emblem, logo redesign, reinterpretation, frame, border, symmetry embellishment, "
            "altered shape, new symbols, added elements, changed geometry, organic, messy"
        ),
        conditioning_scale=1.25,  # Higher for geometric styles
        denoise_strength=0.22,
    ),

    "gold_leaf": StylePreset(
        name="gold_leaf",
        controlnet_type="canny",
        prompt_template=(
            "Restore and beautify the existing sigil. Preserve exact geometry and stroke paths. "
            "Apply gold leaf gilding texture as surface treatment only. Illuminated manuscript style, "
            "precious metal sheen, ornate texture on the existing lines. Medieval luxury aesthetic. "
            "The sigil shape remains exactly as designed."
        ),
        negative_prompt=(
            "extra lines, decorative circle, mandala, compass, runes, glyphs, occult seal, "
            "emblem, logo redesign, reinterpretation, frame, border, symmetry embellishment, "
            "altered shape, new symbols, added elements, changed geometry, modern, photography"
        ),
        conditioning_scale=1.20,
        denoise_strength=0.25,
    ),

    "cosmic": StylePreset(
        name="cosmic",
        controlnet_type="lineart",
        prompt_template=(
            "Restore and beautify the existing sigil. Preserve exact geometry and stroke paths. "
            "Apply ethereal cosmic glow as surface treatment only. Nebula colors, starlight, "
            "celestial energy emanating from the unchanged sigil lines. Deep space background. "
            "The sigil structure is preserved exactly."
        ),
        negative_prompt=(
            "extra lines, decorative circle, mandala, compass, runes, glyphs, occult seal, "
            "emblem, logo redesign, reinterpretation, frame, border, symmetry embellishment, "
            "altered shape, new symbols, added elements, changed geometry, planets, faces, realistic photo"
        ),
        denoise_strength=0.32,  # Slightly higher for glow effects
    ),

    "minimal_line": StylePreset(
        name="minimal_line",
        controlnet_type="canny",
        prompt_template=(
            "Restore and beautify the existing sigil. Preserve exact geometry and stroke paths. "
            "Apply clean minimalist treatment as surface polish only. Crisp precise lines, "
            "subtle paper texture, modern graphic design aesthetic. "
            "The sigil geometry is preserved with absolute precision."
        ),
        negative_prompt=(
            "extra lines, decorative circle, mandala, compass, runes, glyphs, occult seal, "
            "emblem, logo redesign, reinterpretation, frame, border, symmetry embellishment, "
            "altered shape, new symbols, added elements, changed geometry, texture, shading, embellishment, ornate"
        ),
        conditioning_scale=1.30,  # Highest for minimal - structure is everything
        denoise_strength=0.18,    # Lowest - minimal change needed
    ),
}


# Environment configuration
class Settings:
    """Application settings from environment."""

    REPLICATE_API_TOKEN: str = os.getenv("REPLICATE_API_TOKEN", "")
    HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("AI_SERVICE_PORT", "8001"))
    DEBUG: bool = os.getenv("AI_SERVICE_DEBUG", "false").lower() == "true"

    # ControlNet model selection
    # Options: 'replicate' (cloud), 'local' (requires GPU)
    INFERENCE_MODE: str = os.getenv("INFERENCE_MODE", "replicate")

    # Replicate model IDs
    CONTROLNET_LINEART_MODEL: str = "jagilley/controlnet-scribble:435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117"
    CONTROLNET_CANNY_MODEL: str = "jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613"

    # For lineart specifically (better for sigils)
    SDXL_CONTROLNET_MODEL: str = "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd9751047043a5bbb4c184b"


settings = Settings()
controlnet_config = ControlNetConfig()
preprocess_config = PreprocessConfig()
structure_match_config = StructureMatchConfig()
