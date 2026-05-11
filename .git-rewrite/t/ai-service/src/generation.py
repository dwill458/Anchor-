"""
Anchor AI Service - Generation Module
Generates styled sigil variations using ControlNet with strict structure preservation.

Key features:
- Uses SDXL + ControlNet (lineart/canny/scribble)
- Optimized parameters for geometry preservation
- Parallel generation for performance
- Automatic structure validation
"""

import asyncio
import base64
import io
import os
from typing import Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

from PIL import Image
import httpx

from .config import (
    settings,
    controlnet_config,
    STYLE_PRESETS,
    StylePreset,
    ControlNetConfig,
)
from .preprocessing import preprocess_control_image, image_to_base64, ControlImageResult
from .structure_matching import compute_structure_match, StructureMatchResult


@dataclass
class GenerationResult:
    """Result from single variation generation."""

    image: Image.Image                  # Generated image
    structure_match: StructureMatchResult  # Structure preservation score
    seed: int                           # Seed used
    generation_time_ms: int             # Time to generate


@dataclass
class StyledVariationsResult:
    """Result from generating all styled variations."""

    variations: list[GenerationResult]  # All generated variations
    control_image: Image.Image          # Control image used
    stroke_mask: Image.Image            # Original stroke mask
    style_applied: str                  # Style name
    prompt_used: str                    # Full prompt
    negative_prompt_used: str           # Negative prompt
    total_time_ms: int                  # Total generation time
    passing_count: int                  # Variations that pass structure check
    best_variation_index: int           # Index of highest scoring variation


# Thread pool for parallel generation
_executor = ThreadPoolExecutor(max_workers=4)


def _get_replicate_client():
    """Get Replicate client with API token."""
    try:
        import replicate
        return replicate.Client(api_token=settings.REPLICATE_API_TOKEN)
    except ImportError:
        raise ImportError("replicate package required. Install with: pip install replicate")


def _select_controlnet_model(controlnet_type: str) -> str:
    """Select appropriate ControlNet model based on type."""
    if controlnet_type == "canny":
        return settings.CONTROLNET_CANNY_MODEL
    elif controlnet_type in ("lineart", "scribble"):
        # Using scribble model which works better for hand-drawn sigils
        return settings.CONTROLNET_LINEART_MODEL
    else:
        # Default to lineart for best sigil preservation
        return settings.CONTROLNET_LINEART_MODEL


def _build_generation_params(
    control_image_b64: str,
    style_preset: StylePreset,
    seed: int,
    config: ControlNetConfig
) -> dict:
    """
    Build generation parameters for Replicate API.

    Uses strict settings optimized for structure preservation.
    """
    # Get style-specific overrides or use defaults
    denoise = style_preset.denoise_strength or config.denoise_strength
    cond_scale = style_preset.conditioning_scale or config.conditioning_scale
    guidance = style_preset.guidance_scale or config.guidance_scale

    return {
        "image": control_image_b64,
        "prompt": style_preset.prompt_template,
        "negative_prompt": style_preset.negative_prompt,
        "num_outputs": 1,
        "width": 1024,
        "height": 1024,

        # CRITICAL: Structure preservation parameters
        "conditioning_scale": cond_scale,      # High = strict structure adherence
        "guidance_scale": guidance,             # Lower = less prompt drift
        "num_inference_steps": config.num_inference_steps,
        "strength": denoise,                    # Lower = more original preserved

        # ControlNet-specific
        "controlnet_conditioning_scale": cond_scale,
        "control_guidance_start": config.guidance_start,
        "control_guidance_end": config.guidance_end,

        # Reproducibility
        "seed": seed,
    }


async def generate_single_variation(
    control_image_b64: str,
    stroke_mask: Image.Image,
    style_preset: StylePreset,
    seed: int,
    config: ControlNetConfig
) -> GenerationResult:
    """
    Generate a single styled variation.

    Args:
        control_image_b64: Base64 encoded control image
        stroke_mask: Original stroke mask for structure validation
        style_preset: Style configuration
        seed: Random seed for this variation
        config: ControlNet configuration

    Returns:
        GenerationResult with image, structure score, and timing
    """
    import time
    start_time = time.time()

    # Select model
    model = _select_controlnet_model(style_preset.controlnet_type)

    # Build parameters
    params = _build_generation_params(control_image_b64, style_preset, seed, config)

    # Run generation
    replicate = _get_replicate_client()

    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    output = await loop.run_in_executor(
        _executor,
        lambda: replicate.run(model, input=params)
    )

    # Extract image URL from output
    if isinstance(output, list) and len(output) > 0:
        image_url = output[0]
    elif isinstance(output, str):
        image_url = output
    else:
        raise ValueError(f"Unexpected output format: {type(output)}")

    # Download generated image
    async with httpx.AsyncClient() as client:
        response = await client.get(image_url)
        response.raise_for_status()
        image_bytes = response.content

    # Load as PIL Image
    generated_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

    # Compute structure match
    structure_match = compute_structure_match(stroke_mask, generated_image)

    generation_time_ms = int((time.time() - start_time) * 1000)

    return GenerationResult(
        image=generated_image,
        structure_match=structure_match,
        seed=seed,
        generation_time_ms=generation_time_ms
    )


async def generate_styled_variations(
    input_data: str | bytes | Image.Image,
    style_name: str,
    num_variations: int = 4,
    config: Optional[ControlNetConfig] = None,
    base_seed: int = 2000
) -> StyledVariationsResult:
    """
    Main function to generate styled sigil variations.

    Takes sigil SVG/PNG and generates multiple styled variations using
    ControlNet with strict structure preservation.

    Args:
        input_data: SVG string, PNG bytes, or PIL Image
        style_name: Style preset name (watercolor, ink_brush, etc.)
        num_variations: Number of variations to generate (default 4)
        config: ControlNet configuration (uses optimized defaults if None)
        base_seed: Base seed for variation generation

    Returns:
        StyledVariationsResult with all variations and metadata
    """
    import time
    start_time = time.time()

    if config is None:
        config = controlnet_config

    # Validate style
    if style_name not in STYLE_PRESETS:
        raise ValueError(f"Unknown style: {style_name}. Available: {list(STYLE_PRESETS.keys())}")

    style_preset = STYLE_PRESETS[style_name]

    # Preprocess input to control image
    preprocess_result: ControlImageResult = preprocess_control_image(input_data)

    # Convert control image to base64
    control_image_b64 = image_to_base64(preprocess_result.control_image)

    # Generate variations in parallel
    seeds = [base_seed + i * 456 for i in range(num_variations)]

    tasks = [
        generate_single_variation(
            control_image_b64,
            preprocess_result.stroke_mask,
            style_preset,
            seed,
            config
        )
        for seed in seeds
    ]

    variations = await asyncio.gather(*tasks)

    # Find best variation (highest structure score)
    best_index = max(
        range(len(variations)),
        key=lambda i: variations[i].structure_match.combined_score
    )

    # Count passing variations
    passing_count = sum(
        1 for v in variations
        if v.structure_match.structure_preserved
    )

    total_time_ms = int((time.time() - start_time) * 1000)

    return StyledVariationsResult(
        variations=list(variations),
        control_image=preprocess_result.control_image,
        stroke_mask=preprocess_result.stroke_mask,
        style_applied=style_name,
        prompt_used=style_preset.prompt_template,
        negative_prompt_used=style_preset.negative_prompt,
        total_time_ms=total_time_ms,
        passing_count=passing_count,
        best_variation_index=best_index
    )


async def generate_with_auto_retry(
    input_data: str | bytes | Image.Image,
    style_name: str,
    num_variations: int = 4,
    min_passing: int = 2,
    max_attempts: int = 2,
    config: Optional[ControlNetConfig] = None
) -> StyledVariationsResult:
    """
    Generate variations with automatic retry if structure preservation fails.

    If fewer than min_passing variations preserve structure, regenerates
    the failing ones with adjusted parameters.

    Args:
        input_data: SVG string, PNG bytes, or PIL Image
        style_name: Style preset name
        num_variations: Number of variations to generate
        min_passing: Minimum variations that must pass structure check
        max_attempts: Maximum generation attempts per variation
        config: ControlNet configuration

    Returns:
        StyledVariationsResult with best variations
    """
    if config is None:
        config = controlnet_config

    result = await generate_styled_variations(
        input_data, style_name, num_variations, config
    )

    if result.passing_count >= min_passing:
        return result

    # Need to retry some variations with stricter parameters
    stricter_config = ControlNetConfig(
        conditioning_scale=min(config.conditioning_scale + 0.15, 1.5),
        guidance_scale=max(config.guidance_scale - 1.0, 3.0),
        denoise_strength=max(config.denoise_strength - 0.05, 0.15),
        guidance_start=config.guidance_start,
        guidance_end=min(config.guidance_end + 0.05, 1.0),
        num_inference_steps=config.num_inference_steps + 5,
    )

    # Identify failing indices
    failing_indices = [
        i for i, v in enumerate(result.variations)
        if not v.structure_match.structure_preserved
    ]

    # Preprocess again (reuse from first result)
    preprocess_result = preprocess_control_image(input_data)
    control_image_b64 = image_to_base64(preprocess_result.control_image)

    style_preset = STYLE_PRESETS[style_name]

    # Regenerate failing variations with stricter params
    new_seeds = [5000 + i * 789 for i in range(len(failing_indices))]

    retry_tasks = [
        generate_single_variation(
            control_image_b64,
            preprocess_result.stroke_mask,
            style_preset,
            seed,
            stricter_config
        )
        for seed in new_seeds
    ]

    retry_results = await asyncio.gather(*retry_tasks)

    # Replace failing variations with retries if they're better
    for i, fail_idx in enumerate(failing_indices):
        if i < len(retry_results):
            retry = retry_results[i]
            original = result.variations[fail_idx]

            # Use retry if it scores better
            if retry.structure_match.combined_score > original.structure_match.combined_score:
                result.variations[fail_idx] = retry

    # Recalculate passing count and best index
    result.passing_count = sum(
        1 for v in result.variations
        if v.structure_match.structure_preserved
    )

    result.best_variation_index = max(
        range(len(result.variations)),
        key=lambda i: result.variations[i].structure_match.combined_score
    )

    return result


# Synchronous wrapper for non-async contexts
def generate_styled_variations_sync(
    input_data: str | bytes | Image.Image,
    style_name: str,
    num_variations: int = 4,
    config: Optional[ControlNetConfig] = None
) -> StyledVariationsResult:
    """Synchronous wrapper for generate_styled_variations."""
    return asyncio.run(generate_styled_variations(
        input_data, style_name, num_variations, config
    ))
