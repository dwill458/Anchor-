"""
Anchor AI Service - Preprocessing Module
Converts sigil SVG/PNG to high-contrast control images for ControlNet.

Key features:
- Stroke thickening for edge survival during diffusion
- Padding/centering for edge protection
- High-contrast output (white strokes on black)
- Generates protective stroke mask for compositing
"""

import io
import re
import base64
from typing import Tuple, Optional
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter, ImageOps
import cv2

try:
    import cairosvg
    HAS_CAIROSVG = True
except ImportError:
    HAS_CAIROSVG = False

from .config import preprocess_config, PreprocessConfig


@dataclass
class ControlImageResult:
    """Result from control image preprocessing."""

    control_image: Image.Image       # High-contrast control image for ControlNet
    stroke_mask: Image.Image         # Binary mask of stroke regions
    dilated_mask: Image.Image        # Dilated mask for compositing protection
    original_bounds: Tuple[int, int, int, int]  # Bounding box of content
    processing_info: dict            # Debug/logging information


def svg_to_png(svg_string: str, size: int = 1024) -> Image.Image:
    """
    Convert SVG string to PNG image.

    Args:
        svg_string: SVG markup
        size: Output size (square)

    Returns:
        PIL Image (RGBA)
    """
    if not HAS_CAIROSVG:
        raise ImportError("cairosvg required for SVG conversion. Install with: pip install cairosvg")

    # Preprocess SVG to ensure white strokes on transparent background
    processed_svg = _preprocess_svg(svg_string)

    # Convert to PNG bytes
    png_bytes = cairosvg.svg2png(
        bytestring=processed_svg.encode('utf-8'),
        output_width=size,
        output_height=size,
    )

    # Load as PIL Image
    return Image.open(io.BytesIO(png_bytes)).convert('RGBA')


def _preprocess_svg(svg_string: str) -> str:
    """
    Preprocess SVG to ensure high contrast output.

    - Forces strokes to white
    - Removes fills (sigils are line art)
    - Adds viewBox if missing
    """
    processed = svg_string

    # Ensure viewBox exists
    if 'viewBox' not in processed:
        width_match = re.search(r'width="(\d+)"', processed)
        height_match = re.search(r'height="(\d+)"', processed)

        if width_match and height_match:
            w, h = width_match.group(1), height_match.group(1)
            processed = processed.replace('<svg', f'<svg viewBox="0 0 {w} {h}"', 1)
        else:
            processed = processed.replace('<svg', '<svg viewBox="0 0 100 100"', 1)

    # Force white strokes
    processed = re.sub(r'stroke="[^"]*"', 'stroke="#FFFFFF"', processed)

    # Remove fills
    processed = re.sub(r'fill="[^"]*"', 'fill="none"', processed)

    # Ensure stroke-width exists
    if 'stroke-width' not in processed:
        processed = re.sub(r'<path ', '<path stroke-width="2" ', processed)

    return processed


def thicken_strokes(
    image: Image.Image,
    multiplier: float = 2.0,
    min_width: int = 4,
    max_width: int = 12
) -> Image.Image:
    """
    Thicken strokes in the image to survive diffusion process.

    Uses morphological dilation to expand stroke regions.

    Args:
        image: Input image with strokes
        multiplier: Stroke thickness multiplier (1.5-2.5 recommended)
        min_width: Minimum stroke width in pixels
        max_width: Maximum stroke width in pixels

    Returns:
        Image with thickened strokes
    """
    # Convert to numpy array
    img_array = np.array(image.convert('L'))

    # Calculate kernel size based on multiplier
    kernel_size = max(min_width, min(max_width, int(3 * multiplier)))
    if kernel_size % 2 == 0:
        kernel_size += 1  # Ensure odd kernel size

    # Create circular kernel for smooth dilation
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (kernel_size, kernel_size)
    )

    # Dilate (thicken) the strokes
    dilated = cv2.dilate(img_array, kernel, iterations=1)

    return Image.fromarray(dilated)


def add_padding(
    image: Image.Image,
    padding_percent: float = 0.12,
    background_color: int = 0
) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    """
    Add padding around the image and center the content.

    Args:
        image: Input image
        padding_percent: Padding as percentage of image size (10-18% recommended)
        background_color: Color for padding (0=black for ControlNet)

    Returns:
        Tuple of (padded image, original content bounding box)
    """
    width, height = image.size
    padding_px = int(max(width, height) * padding_percent)

    # Find content bounding box
    img_array = np.array(image.convert('L'))
    coords = np.column_stack(np.where(img_array > 10))

    if len(coords) == 0:
        # Empty image - return as-is
        return image, (0, 0, width, height)

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)

    # Create new image with padding
    new_size = max(width, height) + 2 * padding_px
    new_image = Image.new('L', (new_size, new_size), background_color)

    # Calculate centered position
    content_width = x_max - x_min
    content_height = y_max - y_min
    paste_x = (new_size - content_width) // 2
    paste_y = (new_size - content_height) // 2

    # Crop content and paste centered
    content = image.crop((x_min, y_min, x_max + 1, y_max + 1))
    if content.mode != 'L':
        content = content.convert('L')

    new_image.paste(content, (paste_x, paste_y))

    # Return bounds relative to new image
    bounds = (paste_x, paste_y, paste_x + content_width, paste_y + content_height)

    return new_image, bounds


def create_stroke_mask(
    image: Image.Image,
    threshold: int = 128
) -> Image.Image:
    """
    Create binary mask of stroke regions.

    Args:
        image: Grayscale image with white strokes
        threshold: Binarization threshold

    Returns:
        Binary mask (white=stroke, black=background)
    """
    img_array = np.array(image.convert('L'))
    _, binary = cv2.threshold(img_array, threshold, 255, cv2.THRESH_BINARY)
    return Image.fromarray(binary)


def create_dilated_mask(
    mask: Image.Image,
    dilation_px: int = 6
) -> Image.Image:
    """
    Create dilated mask for compositing protection.

    The dilated mask protects stroke regions + a buffer zone
    during background inpainting.

    Args:
        mask: Binary stroke mask
        dilation_px: Dilation amount (4-10px recommended)

    Returns:
        Dilated binary mask
    """
    mask_array = np.array(mask)

    # Create circular kernel
    kernel_size = dilation_px * 2 + 1
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (kernel_size, kernel_size)
    )

    # Dilate mask
    dilated = cv2.dilate(mask_array, kernel, iterations=1)

    return Image.fromarray(dilated)


def enhance_edges(
    image: Image.Image,
    sigma: float = 1.2
) -> Image.Image:
    """
    Enhance edges for better ControlNet detection.

    Args:
        image: Input image
        sigma: Sharpening strength

    Returns:
        Edge-enhanced image
    """
    # Apply unsharp mask for edge enhancement
    blurred = image.filter(ImageFilter.GaussianBlur(radius=sigma))

    # Create sharpened version
    img_array = np.array(image).astype(float)
    blur_array = np.array(blurred).astype(float)

    # Unsharp mask: original + (original - blurred) * amount
    amount = 1.5
    sharpened = img_array + (img_array - blur_array) * amount

    # Clip to valid range
    sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)

    return Image.fromarray(sharpened)


def preprocess_control_image(
    input_data: str | bytes | Image.Image,
    config: Optional[PreprocessConfig] = None
) -> ControlImageResult:
    """
    Main preprocessing function for creating ControlNet control image.

    Takes SVG string, PNG bytes, or PIL Image and produces:
    - High-contrast control image (white strokes on black)
    - Binary stroke mask
    - Dilated mask for compositing

    Args:
        input_data: SVG string, PNG bytes, base64 data URL, or PIL Image
        config: Preprocessing configuration (uses defaults if None)

    Returns:
        ControlImageResult with all processed images and metadata
    """
    if config is None:
        config = preprocess_config

    processing_info = {"steps": []}

    # Step 1: Load/convert to PIL Image
    if isinstance(input_data, Image.Image):
        image = input_data.convert('L')
        processing_info["steps"].append("Used provided PIL Image")

    elif isinstance(input_data, bytes):
        image = Image.open(io.BytesIO(input_data)).convert('L')
        processing_info["steps"].append("Loaded from bytes")

    elif isinstance(input_data, str):
        if input_data.startswith('data:image'):
            # Base64 data URL
            base64_data = input_data.split(',')[1]
            image_bytes = base64.b64decode(base64_data)
            image = Image.open(io.BytesIO(image_bytes)).convert('L')
            processing_info["steps"].append("Decoded base64 data URL")

        elif input_data.strip().startswith('<svg'):
            # SVG string
            image = svg_to_png(input_data, config.output_size).convert('L')
            processing_info["steps"].append("Converted SVG to PNG")

        else:
            # Assume base64 without data URL prefix
            try:
                image_bytes = base64.b64decode(input_data)
                image = Image.open(io.BytesIO(image_bytes)).convert('L')
                processing_info["steps"].append("Decoded raw base64")
            except Exception:
                raise ValueError("Invalid input: must be SVG string, PNG bytes, base64, or PIL Image")
    else:
        raise ValueError(f"Unsupported input type: {type(input_data)}")

    # Store original dimensions
    original_size = image.size
    processing_info["original_size"] = original_size

    # Step 2: Resize to target size (maintain aspect ratio)
    image = image.resize((config.output_size, config.output_size), Image.Resampling.LANCZOS)
    processing_info["steps"].append(f"Resized to {config.output_size}x{config.output_size}")

    # Step 3: Invert if needed (ensure white strokes on black)
    img_array = np.array(image)
    if np.mean(img_array) > 127:
        # Image is mostly white, invert it
        image = ImageOps.invert(image)
        processing_info["steps"].append("Inverted colors (was white background)")

    # Step 4: Thicken strokes
    thickened = thicken_strokes(
        image,
        multiplier=config.stroke_multiplier,
        min_width=config.min_stroke_width,
        max_width=config.max_stroke_width
    )
    processing_info["steps"].append(f"Thickened strokes (multiplier: {config.stroke_multiplier})")

    # Step 5: Add padding and center
    padded, bounds = add_padding(
        thickened,
        padding_percent=config.padding_percent
    )
    processing_info["steps"].append(f"Added {config.padding_percent*100:.0f}% padding")
    processing_info["content_bounds"] = bounds

    # Step 6: Resize back to output size (padding may have changed dimensions)
    control_image = padded.resize(
        (config.output_size, config.output_size),
        Image.Resampling.LANCZOS
    )

    # Step 7: Enhance edges
    control_image = enhance_edges(control_image, config.edge_enhance_sigma)
    processing_info["steps"].append("Enhanced edges")

    # Step 8: Create stroke mask from thickened image
    stroke_mask = create_stroke_mask(control_image)
    processing_info["steps"].append("Created stroke mask")

    # Step 9: Create dilated mask for compositing
    dilated_mask = create_dilated_mask(stroke_mask, config.mask_dilation_px)
    processing_info["steps"].append(f"Created dilated mask ({config.mask_dilation_px}px)")

    # Convert control image to RGB (black bg, white strokes)
    control_image_rgb = Image.merge('RGB', (control_image, control_image, control_image))

    return ControlImageResult(
        control_image=control_image_rgb,
        stroke_mask=stroke_mask,
        dilated_mask=dilated_mask,
        original_bounds=bounds,
        processing_info=processing_info
    )


def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert PIL Image to base64 data URL."""
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/{format.lower()};base64,{base64_data}"
