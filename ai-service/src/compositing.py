"""
Anchor AI Service - Compositing Module
Composite original sigil lines onto AI-generated backgrounds for guaranteed fidelity.

This module provides the nuclear option for structure preservation:
1. Use AI to generate only the background/texture
2. Composite the original sigil lines on top
3. Blend edges for natural appearance

This guarantees 100% structure preservation at the cost of some artistic freedom.
"""

import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import cv2
from typing import Tuple, Optional
from dataclasses import dataclass

from .preprocessing import preprocess_control_image, create_dilated_mask


@dataclass
class CompositeResult:
    """Result from compositing operation."""

    composite_image: Image.Image       # Final composited image
    background_only: Image.Image       # AI background with masked sigil area
    sigil_layer: Image.Image           # Processed sigil layer
    blend_mask: Image.Image            # Mask used for blending
    structure_guaranteed: bool         # Always True for composited images


def extract_sigil_with_alpha(
    control_image: Image.Image,
    stroke_mask: Image.Image,
    edge_feather_px: int = 2
) -> Image.Image:
    """
    Create sigil layer with alpha channel for blending.

    Args:
        control_image: High-contrast control image (white strokes on black)
        stroke_mask: Binary mask of stroke regions
        edge_feather_px: Pixels to feather at edges for smooth blending

    Returns:
        RGBA image with sigil and transparency
    """
    # Convert mask to grayscale if needed
    if stroke_mask.mode != 'L':
        mask = stroke_mask.convert('L')
    else:
        mask = stroke_mask

    # Feather edges for smooth blending
    if edge_feather_px > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=edge_feather_px))

    # Create RGBA with white sigil and mask as alpha
    if control_image.mode == 'RGB':
        r, g, b = control_image.split()
    else:
        gray = control_image.convert('L')
        r = g = b = gray

    # Use control image luminance as the sigil
    return Image.merge('RGBA', (r, g, b, mask))


def inpaint_background(
    generated_image: Image.Image,
    dilated_mask: Image.Image,
    inpaint_radius: int = 5
) -> Image.Image:
    """
    Inpaint the sigil area in generated image to create clean background.

    This removes any AI-generated sigil interpretation from the background,
    preparing it for compositing with the original sigil.

    Args:
        generated_image: AI-generated image
        dilated_mask: Mask of sigil area to inpaint
        inpaint_radius: Radius for inpainting algorithm

    Returns:
        Image with sigil area inpainted
    """
    # Convert to numpy
    img_array = np.array(generated_image.convert('RGB'))

    # Ensure mask is correct format
    if isinstance(dilated_mask, Image.Image):
        mask_array = np.array(dilated_mask.convert('L'))
    else:
        mask_array = dilated_mask

    # Inpaint using OpenCV's Telea algorithm
    inpainted = cv2.inpaint(
        img_array,
        mask_array,
        inpaint_radius,
        cv2.INPAINT_TELEA
    )

    return Image.fromarray(inpainted)


def apply_sigil_texture(
    sigil_image: Image.Image,
    texture_source: Image.Image,
    blend_mode: str = "multiply",
    texture_strength: float = 0.3
) -> Image.Image:
    """
    Apply texture from generated image to the sigil strokes.

    Gives the sigil a "textured" appearance while maintaining exact geometry.

    Args:
        sigil_image: Original sigil (white strokes on black)
        texture_source: Generated image to sample texture from
        blend_mode: Blending mode ("multiply", "overlay", "soft_light")
        texture_strength: How much texture to apply (0-1)

    Returns:
        Sigil with applied texture
    """
    # Resize texture source to match sigil
    texture = texture_source.resize(sigil_image.size, Image.Resampling.LANCZOS)

    # Convert to numpy for blending
    sigil_array = np.array(sigil_image.convert('RGB')).astype(float) / 255.0
    texture_array = np.array(texture.convert('RGB')).astype(float) / 255.0

    if blend_mode == "multiply":
        # Multiply blend: darken where texture is dark
        blended = sigil_array * (1 - texture_strength) + sigil_array * texture_array * texture_strength

    elif blend_mode == "overlay":
        # Overlay: increase contrast
        mask = sigil_array < 0.5
        blended = np.where(
            mask,
            2 * sigil_array * texture_array,
            1 - 2 * (1 - sigil_array) * (1 - texture_array)
        )
        blended = sigil_array * (1 - texture_strength) + blended * texture_strength

    elif blend_mode == "soft_light":
        # Soft light: gentler overlay
        blended = (1 - 2 * texture_array) * sigil_array ** 2 + 2 * texture_array * sigil_array
        blended = sigil_array * (1 - texture_strength) + blended * texture_strength

    else:
        # Default: simple blend
        blended = sigil_array * (1 - texture_strength) + texture_array * texture_strength

    # Clip and convert back
    blended = np.clip(blended * 255, 0, 255).astype(np.uint8)

    return Image.fromarray(blended)


def composite_sigil_on_background(
    original_sigil: Image.Image,
    stroke_mask: Image.Image,
    generated_background: Image.Image,
    sigil_color: Tuple[int, int, int] | None = None,
    edge_feather: int = 2,
    opacity: float = 1.0
) -> Image.Image:
    """
    Composite original sigil strokes onto AI-generated background.

    Args:
        original_sigil: High-contrast sigil image (white strokes on black)
        stroke_mask: Binary mask of stroke regions
        generated_background: AI-generated image to use as background
        sigil_color: Optional color for sigil (None = sample from generated)
        edge_feather: Pixels to feather edges
        opacity: Overall opacity of sigil layer (0-1)

    Returns:
        Composited image with original sigil geometry on styled background
    """
    # Ensure same size
    size = generated_background.size
    original_sigil = original_sigil.resize(size, Image.Resampling.LANCZOS)
    stroke_mask = stroke_mask.resize(size, Image.Resampling.LANCZOS)

    # Convert mask to L mode
    if stroke_mask.mode != 'L':
        stroke_mask = stroke_mask.convert('L')

    # Determine sigil color
    if sigil_color is None:
        # Sample dominant color from generated image sigil region
        sigil_color = _sample_sigil_color(generated_background, stroke_mask)

    # Create colored sigil layer
    sigil_colored = Image.new('RGB', size, sigil_color)

    # Feather the mask for smooth edges
    if edge_feather > 0:
        alpha_mask = stroke_mask.filter(ImageFilter.GaussianBlur(radius=edge_feather))
    else:
        alpha_mask = stroke_mask

    # Apply opacity
    if opacity < 1.0:
        alpha_array = np.array(alpha_mask).astype(float) * opacity
        alpha_mask = Image.fromarray(alpha_array.astype(np.uint8))

    # Composite using alpha mask
    result = Image.composite(sigil_colored, generated_background, alpha_mask)

    return result


def _sample_sigil_color(
    image: Image.Image,
    mask: Image.Image,
    method: str = "dominant"
) -> Tuple[int, int, int]:
    """
    Sample color from image within masked region.

    Args:
        image: Source image
        mask: Region to sample from
        method: "dominant" for most common, "mean" for average

    Returns:
        RGB color tuple
    """
    img_array = np.array(image.convert('RGB'))
    mask_array = np.array(mask.convert('L'))

    # Get pixels within mask
    masked_pixels = img_array[mask_array > 127]

    if len(masked_pixels) == 0:
        return (255, 255, 255)  # Default to white

    if method == "mean":
        color = masked_pixels.mean(axis=0).astype(int)
    else:
        # Find dominant color using histogram
        from collections import Counter
        # Quantize to reduce unique colors
        quantized = (masked_pixels // 32) * 32
        pixel_tuples = [tuple(p) for p in quantized]
        color = Counter(pixel_tuples).most_common(1)[0][0]

    return tuple(color)


def composite_original_lines(
    original_svg_or_image: str | Image.Image,
    generated_image: Image.Image,
    style_name: str = "watercolor",
    blend_texture: bool = True,
    texture_strength: float = 0.2
) -> CompositeResult:
    """
    Main compositing function - guarantees 100% structure preservation.

    This is the "nuclear option" when structure preservation is paramount.
    The original sigil geometry is composited onto the AI-generated background,
    optionally sampling texture from the generated image.

    Args:
        original_svg_or_image: Original sigil (SVG string or PIL Image)
        generated_image: AI-generated styled image
        style_name: Style being applied (affects color sampling)
        blend_texture: Whether to apply texture to sigil strokes
        texture_strength: How much texture to apply (0-1)

    Returns:
        CompositeResult with composited image and component layers
    """
    # Preprocess original to get control image and masks
    preprocess_result = preprocess_control_image(original_svg_or_image)

    control_image = preprocess_result.control_image
    stroke_mask = preprocess_result.stroke_mask
    dilated_mask = preprocess_result.dilated_mask

    # Resize generated image to match
    generated = generated_image.resize(
        control_image.size,
        Image.Resampling.LANCZOS
    )

    # Create background with sigil area inpainted
    background = inpaint_background(generated, dilated_mask)

    # Optionally apply texture to sigil
    if blend_texture:
        sigil_layer = apply_sigil_texture(
            control_image,
            generated,
            blend_mode="soft_light",
            texture_strength=texture_strength
        )
    else:
        sigil_layer = control_image.convert('RGB')

    # Composite sigil onto background
    composite = composite_sigil_on_background(
        sigil_layer,
        stroke_mask,
        background,
        sigil_color=None,  # Sample from generated
        edge_feather=2,
        opacity=1.0
    )

    return CompositeResult(
        composite_image=composite,
        background_only=background,
        sigil_layer=sigil_layer,
        blend_mask=stroke_mask,
        structure_guaranteed=True
    )


def hybrid_enhancement(
    original_svg_or_image: str | Image.Image,
    generated_image: Image.Image,
    structure_score: float,
    score_threshold: float = 0.85
) -> Tuple[Image.Image, bool]:
    """
    Hybrid approach: use generated image if structure preserved, else composite.

    Automatically chooses between:
    - Generated image (if structure score >= threshold)
    - Composited image (if structure score < threshold)

    Args:
        original_svg_or_image: Original sigil
        generated_image: AI-generated image
        structure_score: Structure match score (0-1)
        score_threshold: Threshold for accepting generated image

    Returns:
        Tuple of (final image, was_composited)
    """
    if structure_score >= score_threshold:
        # Structure preserved - use generated image as-is
        return generated_image, False
    else:
        # Structure drift - composite original lines
        result = composite_original_lines(
            original_svg_or_image,
            generated_image,
            blend_texture=True
        )
        return result.composite_image, True
