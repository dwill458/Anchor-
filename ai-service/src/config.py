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


# Style presets optimized for geometry preservation.
GLOBAL_NEGATIVE_PROMPT = (
    "text, words, letters, phrases, captions, numbers, numerals, readable characters, "
    "runes, fake writing, inscriptions, labels, currency symbols, dollar sign, coins, "
    "cash, banknotes, bank logos, charts, graphs, stock ticker, brand logos, watermark, "
    "copyright mark, clipart, sticker, icon pack, emoji, flat app icon, photorealistic "
    "human face, human figure, portrait, hands, literal scene, literal object illustration, "
    "distorted geometry, altered structure, altered shape, warped lines, broken sigil, melted sigil, "
    "blurry, muddy, low quality, random artifacts, overcrowded ornament"
)


def build_style_prompt(display_name: str, description: str, palette: str, material: str, composition: str) -> str:
    return (
        "SIGIL GEOMETRY IS SACRED STRUCTURE. Preserve ALL input lines, circles, "
        "intersections, and shapes exactly as shown. Do NOT warp, melt, bend, rotate, "
        "skew, redraw, simplify, reinterpret, or add to the sigil geometry. Treat the "
        "sigil as a fixed engraved plate beneath all styling. "
        f"Style identity: {display_name} — {description}. "
        f"Composition family: {composition}. "
        f"Palette lane: {palette}. Material behavior: {material}. "
        "Styling may influence atmosphere, finish, texture, light, color, density, and "
        "peripheral composition only. Use abstract, secondary motifs only; no text, "
        "numbers, readable symbols, people, logos, currency imagery, literal scenes, or "
        "objects that explain the intention. The finished image should feel specific "
        "without ever changing the preserved sigil structure."
    )


STYLE_LIBRARY = {
    "architectural_trace": ("Architectural Trace", "Precision drafting, measured geometry, blueprint discipline.", "smoked parchment, silver-white, faint cyan, graphite", "etched drafting ink, blueprint grid logic, silver calibration marks", "CENTRED STILLPOINT", "canny", 0.20, 1.25, 6.5),
    "lunar_etch": ("Lunar Etch", "Moonlit silver engraving, quiet radiance, nocturnal contrast.", "moon-silver, indigo-black, cold pearl, soft blue-white", "silver etching, lunar dust, restrained metallic bloom", "OFFSET FIELD", "lineart", 0.24, None, None),
    "resonance_rings": ("Resonance Rings", "Concentric pulse circles, waveform halos, radiating energy.", "amber-white on charcoal, optional teal-white on graphite", "echo rings, pulse halos, acoustic field lines", "DIRECTIONAL FLOW", "lineart", 0.26, None, None),
    "watercolor": ("Watercolor", "Flowing pigment washes, soft bloom, textured paper.", "mineral blue, oxblood, moss, plum, muted saffron", "pigment bleed, deckled paper, wet edge blooms", "OFFSET FIELD", "lineart", 0.28, None, None),
    "ink_brush": ("Ink Brush", "Sumi-e ink restraint, strong gesture, meaningful negative space.", "black ink, bone paper, faint iron-red seal haze", "dry brush pressure, diluted ink mist, paper grain", "OPEN VOID", "lineart", 0.25, None, None),
    "gold_leaf": ("Gold Leaf", "Gilded finish, antique glow, precious surface depth.", "antique gold, umber, soot-black, soft bronze", "torn gold leaf, gilded cracks, subtle metallic dust", "CENTRED STILLPOINT", "canny", 0.26, 1.20, None),
    "cosmic": ("Cosmic", "Deep-space atmosphere, luminous dust, celestial depth.", "midnight teal, violet gas, pale gold flare, star-white", "nebular haze, star dust, layered dark gradients", "DIAGONAL TENSION", "lineart", 0.30, None, None),
    "minimal_line": ("Minimal Line", "Ultra-clean linework, spacious restraint, quiet precision.", "platinum on black navy, bone on charcoal, faint silver", "clean vector-like line clarity, almost no ornament", "OPEN VOID", "canny", 0.18, 1.30, None),
    "obsidian_mono": ("Obsidian Mono", "Black glass, graphite polish, reflective shadow.", "black glass, graphite, silver edge, smoke gray", "polished obsidian, glossy edge highlights, dark reflection", "LOWER-ANCHORED", "lineart", 0.20, None, None),
    "aurora_glow": ("Aurora Glow", "Blue-green aurora light, soft spectral bloom, moving atmosphere.", "blue-green, cobalt, violet, rare gold accents", "light ribbons, soft atmospheric bloom, spectral haze", "DIRECTIONAL FLOW", "lineart", 0.32, None, None),
    "ember_trace": ("Ember Trace", "Coal-dark surface, copper heat, controlled ember glow.", "coal black, ember orange, copper red, ash gray", "scorched linework, heated edges, ember dust", "DIAGONAL TENSION", "lineart", 0.26, None, None),
    "monolith_ink": ("Monolith Ink", "Heavy stone ink, monumental stillness, carved presence.", "ash black, stone gray, dusted bronze, muted bone", "stone grain, heavy ink, carved shadow", "LOWER-ANCHORED", "lineart", 0.22, 1.20, None),
    "celestial_grid": ("Celestial Grid", "Observatory geometry, star-map lines, measured cosmic order.", "midnight navy, pale cyan, soft violet, pinprick gold", "star-map plotting, observatory marks, delicate grid constellations", "OFFSET FIELD", "canny", 0.20, 1.25, None),
    "echo_chamber": ("Echo Chamber", "Repeating echoes, inner-room acoustics, layered signal.", "smoked violet, blue-gray, muted gold, shadow black", "nested acoustic fields, soft echo bands, chamber depth", "CENTRED STILLPOINT", "lineart", 0.28, None, None),
    "prism_veil": ("Prism Veil", "Iridescent refraction, glasslike hush, spectral layering.", "pearl, opal, pale cyan, lavender, faint gold", "translucent veils, refracted edges, prism bloom", "OFFSET FIELD", "lineart", 0.28, None, None),
    "verdigris_relic": ("Verdigris Relic", "Oxidized copper, mineral patina, archaeological elegance.", "oxidized teal, bronze, ash, dark stone", "aged copper, patina blooms, worn engraved surface", "LOWER-ANCHORED", "canny", 0.24, 1.20, None),
    "solar_halo": ("Solar Halo", "Sun-warmed radiance, disciplined brightness, haloed clarity.", "ivory, saffron, brass, pale amber, smoke", "soft solar rings, warm haze, brass light", "CENTRED STILLPOINT", "canny", 0.24, None, None),
    "tideglass": ("Tideglass", "Sea-glass translucency, mineral wash, tidal softness.", "seafoam, slate blue, soft aqua, mineral gray", "translucent washed glass, salt haze, tide-soft edges", "DIRECTIONAL FLOW", "lineart", 0.28, None, None),
    "sacred_geometry": ("Sacred Geometry", "Layered mathematical symbolism, luminous geometric depth.", "indigo, teal, dusty rose, muted brass, celestial blue", "layered geometric systems, transparent overlaps, precise geometry", "CENTRED STILLPOINT", "canny", 0.24, 1.20, None),
    "velvet_ember": ("Velvet Ember", "Velvet darkness, warm ember glow, soft luxury depth.", "burgundy-black, copper, warm amber, soot violet", "velvet texture, ember glints, soft smoky depth", "DIAGONAL TENSION", "lineart", 0.26, None, None),
}


STYLE_PRESETS: Dict[str, StylePreset] = {
    style_id: StylePreset(
        name=style_id,
        controlnet_type=controlnet_type,
        prompt_template=build_style_prompt(display_name, description, palette, material, composition),
        negative_prompt=GLOBAL_NEGATIVE_PROMPT,
        denoise_strength=denoise_strength,
        conditioning_scale=conditioning_scale,
        guidance_scale=guidance_scale,
    )
    for style_id, (
        display_name,
        description,
        palette,
        material,
        composition,
        controlnet_type,
        denoise_strength,
        conditioning_scale,
        guidance_scale,
    ) in STYLE_LIBRARY.items()
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
