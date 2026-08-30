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
    "literal nautical anchor, ship anchor, boat anchor, physical anchor, metal anchor, "
    "anchor object, anchor icon, anchor logo, anchor emoji, recognizable anchor silhouette, "
    "maritime imagery, harbor, ship, boat, "
    "distorted geometry, altered structure, altered shape, warped lines, broken geometry, melted lines, "
    "blurry, muddy, low quality, random artifacts, overcrowded ornament, altar, "
    "candle wax, fantasy clutter, religious iconography"
)


LITERAL_ANCHOR_EXCLUSION = (
    "LITERAL SUBJECT EXCLUSION — ABSOLUTE: Create abstract symbolic sigil artwork only. "
    "Anchor is the app/product name, not a physical subject. Never draw, add, clarify, "
    "embellish, or suggest a real-world nautical, ship, boat, or metal anchor; anchor icon; "
    "anchor logo; anchor emoji; or recognizable anchor silhouette. If the supplied linework "
    "happens to resemble an anchor, preserve it only as abstract non-object geometry and "
    "never turn it into a literal anchor."
)


def build_style_prompt(display_name: str, description: str, palette: str, material: str, composition: str) -> str:
    return (
        f"{LITERAL_ANCHOR_EXCLUSION} "
        "SIGIL GEOMETRY IS IMMUTABLE STRUCTURE. Preserve ALL input lines, circles, "
        "intersections, and shapes exactly as shown. Do NOT warp, melt, bend, rotate, "
        "skew, redraw, simplify, reinterpret, or add to the sigil geometry. Treat the "
        "geometry as a fixed engraved plate beneath all styling. "
        f"Style identity: {display_name} — {description}. "
        f"Composition family: {composition}. "
        f"Palette lane: {palette}. Material behavior: {material}. "
        "GOLD ACCENT CONSTRAINT: Gold or warm-metallic tones must not dominate more than "
        "~15% of the visual field. Gold functions strictly as a thin structural highlight, "
        "edge bevel, or seam — never a wash, fill, or dominant surface treatment. "
        "Styling may influence atmosphere, finish, texture, light, color, density, and "
        "peripheral composition only. Use abstract, secondary motifs only; no text, "
        "numbers, readable symbols, people, logos, currency imagery, literal scenes, or "
        "objects that explain the intention. Faint non-readable abstract marks are allowed "
        "only as secondary texture and must never form a recognizable icon or object. "
        "Bring back a restrained mystical undertone without making the image a full ritual "
        "or fantasy tableau: use ethereal glow, quiet aura, dreamlike depth, restrained "
        "celestial dust, soft luminous edges, and faint esoteric energy. Keep it refined, "
        "contemporary, and grounded; avoid tarot cards, spellbooks, ritual altars, zodiac "
        "diagrams, religious scenes, or fantasy tableaux. The finished image should feel specific "
        "without ever changing the preserved sigil geometry. "
        f"{LITERAL_ANCHOR_EXCLUSION}"
    )


STYLE_LIBRARY = {
    "architectural_trace": ("Architectural Trace", "Precision drafting, measured geometry, schematic blueprint discipline.", "smoked slate, silver-white, faint cyan, graphite", "precision drafting ink, schematic grid logic, silver calibration ticks", "CENTRED AXIS", "canny", 0.20, 1.25, 6.5),
    "lunar_etch": ("Lunar Etch", "Precision silver engraving, quiet radiance, nocturnal contrast.", "monochrome silver, indigo-black, cold titanium, soft blue-gray", "milled silver etching, micro-particle dust, restrained cold metallic reflection", "OFFSET FIELD", "lineart", 0.24, None, None),
    "resonance_rings": ("Resonance Rings", "Concentric pulse circles, waveform halos, radiating energy.", "amber-white on charcoal, optional teal-white on graphite", "waveform rings, pulse field lines, harmonic interval spacing", "DIRECTIONAL FLOW", "lineart", 0.26, None, None),
    "watercolor": ("Watercolor", "Flowing fluid pigment washes, soft dispersion bloom, textured cotton substrate.", "mineral blue, oxblood, moss, plum, muted saffron", "pigment saturation, heavy cold-press cotton grain, wet-edge separation", "OFFSET FIELD", "lineart", 0.28, None, None),
    "ink_brush": ("Ink Brush", "Carbon ink restraint, strong gesture, meaningful negative space.", "carbon black ink, bone substrate, faint iron-red structural haze", "dry carbon pressure, diluted ink wash, textured substrate grain", "OPEN VOID", "lineart", 0.25, None, None),
    "gold_leaf": ("Gold Leaf", "Struck alloy seams, brushed gold highlights, structural depth.", "antique gold accent, umber, soot-black, soft bronze", "brushed-gold fracture, struck alloy seams, micro-particle metallic dust", "CENTRED AXIS", "canny", 0.26, 1.20, None),
    "cosmic": ("Cosmic", "Dimensional vector field, particle dust, deep atmospheric gradients.", "midnight teal, deep violet, pale gold flare accent, particle white", "vector field haze, particulate dust, layered dark gradients", "DIAGONAL TENSION", "lineart", 0.30, None, None),
    "minimal_line": ("Minimal Line", "Ultra-clean linework, spacious restraint, engineered precision.", "platinum on dark graphite, bone on charcoal, faint silver", "machined vector line clarity, zero ornamental clutter", "OPEN VOID", "canny", 0.18, 1.30, None),
    "obsidian_mono": ("Obsidian Mono", "Black obsidian composite, graphite polish, reflective bevel highlights.", "polished obsidian composite, graphite, silver edge, smoke gray", "machined obsidian composite, reflective bevel highlights, dark shadow weight", "LOWER-ANCHORED", "lineart", 0.20, None, None),
    "aurora_glow": ("Aurora Glow", "Blue-green spectral light, soft dispersion bloom, moving atmospheric field.", "blue-green, cobalt, violet, rare gold hairline accents", "spectral light ribbons, atmospheric gradient bloom, refracted field haze", "DIRECTIONAL FLOW", "lineart", 0.32, None, None),
    "ember_trace": ("Ember Trace", "Coal-dark surface, copper heat, controlled thermal glow.", "coal black, ember orange, copper red, ash gray", "tempered linework, heated bevel edges, particulate ember dust", "DIAGONAL TENSION", "lineart", 0.26, None, None),
    "monolith_ink": ("Monolith Ink", "Heavy carbon ink, monumental weight, structural relief presence.", "matte carbon, basalt gray, dusted bronze accent, muted bone", "basalt composite grain, dense carbon ink, machined relief shadow", "LOWER-ANCHORED", "lineart", 0.22, 1.20, None),
    "celestial_grid": ("Celestial Grid", "Measured astrometric geometry, coordinate vector lines, technical telemetry order.", "midnight navy, pale cyan, soft violet, pinprick gold", "coordinate plotting, telemetry markers, delicate vector arrays", "OFFSET FIELD", "canny", 0.20, 1.25, None),
    "echo_chamber": ("Echo Chamber", "Repeating acoustic harmonics, chamber depth, layered signal dampening.", "smoked violet, blue-gray, muted gold accent, shadow black", "nested acoustic fields, soft echo bands, chamber depth", "CENTRED AXIS", "lineart", 0.28, None, None),
    "prism_veil": ("Prism Veil", "Optic refraction, chromatic dispersion, frosted acrylic translucency.", "frosted acrylic, opal, pale cyan, lavender, faint gold accent", "translucent optic veils, refracted bevels, chromatic dispersion", "OFFSET FIELD", "lineart", 0.28, None, None),
    "verdigris_relic": ("Verdigris Relic", "Oxidized copper alloy, mineral patina, precision-etched relief surface.", "oxidized teal, aged bronze, carbon ash, dark slate", "oxidized copper alloy, patina blooms, precision-etched relief surface", "LOWER-ANCHORED", "canny", 0.24, 1.20, None),
    "solar_halo": ("Solar Halo", "Thermal radiance, disciplined brightness, haloed clarity.", "ivory, saffron, pale brass accent, pale amber, smoke gray", "thermal radiant halos, warm dispersion haze, brushed brass highlights", "CENTRED AXIS", "canny", 0.24, None, None),
    "tideglass": ("Tideglass", "Frosted silicate translucency, fluid mineral wash, soft edge boundaries.", "seafoam, slate blue, soft aqua, mineral gray", "frosted silicate translucency, saline haze, eroded-edge softness", "DIRECTIONAL FLOW", "lineart", 0.28, None, None),
    "sacred_geometry": ("Sacred Geometry", "Layered harmonic mathematical systems, transparent vector overlays, structural depth.", "indigo, teal, dusty rose, muted brass accent, slate blue", "layered harmonic geometry, transparent vector overlays, mathematical precision", "CENTRED AXIS", "canny", 0.24, 1.20, None),
    "velvet_ember": ("Velvet Ember", "Matte dark depth, brushed copper thermal glints, controlled contrast.", "matte burgundy-black, brushed copper, warm amber accent, soot violet", "matte tactile darkness, copper thermal glints, soft smoke depth", "DIAGONAL TENSION", "lineart", 0.26, None, None),
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
