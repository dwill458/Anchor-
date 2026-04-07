"""
Anchor AI Service - Structure Matching Module
Computes structure preservation metrics between original sigil and generated output.

Key metrics:
- IoU (Intersection over Union) of binarized masks
- Edge overlap score using Canny edge detection
- Combined structure match score
"""

import numpy as np
from PIL import Image
import cv2
from typing import Tuple, Optional
from dataclasses import dataclass

from .config import structure_match_config, StructureMatchConfig


@dataclass
class StructureMatchResult:
    """Result from structure matching analysis."""

    iou_score: float                    # Intersection over Union (0-1)
    edge_overlap_score: float           # Edge-based overlap (0-1)
    combined_score: float               # Weighted combination (0-1)
    structure_preserved: bool           # True if above threshold
    classification: str                 # "Structure Preserved" or "Style Drift" or "More Artistic"
    analysis: dict                      # Detailed analysis info


def binarize_image(
    image: Image.Image,
    threshold: int = 128,
    invert: bool = False
) -> np.ndarray:
    """
    Convert image to binary mask.

    Args:
        image: Input image (grayscale or RGB)
        threshold: Binarization threshold (0-255)
        invert: If True, invert the result

    Returns:
        Binary numpy array (0 or 255)
    """
    # Convert to grayscale if needed
    if image.mode != 'L':
        gray = image.convert('L')
    else:
        gray = image

    # Convert to numpy
    img_array = np.array(gray)

    # Binarize
    _, binary = cv2.threshold(img_array, threshold, 255, cv2.THRESH_BINARY)

    if invert:
        binary = 255 - binary

    return binary


def extract_sigil_from_generated(
    generated_image: Image.Image,
    method: str = "adaptive"
) -> np.ndarray:
    """
    Extract sigil structure from AI-generated image.

    Generated images may have complex textures/colors. This function
    attempts to isolate the sigil structure.

    Args:
        generated_image: AI-generated image
        method: Extraction method ("adaptive", "otsu", "edges")

    Returns:
        Binary mask of detected sigil structure
    """
    # Convert to grayscale
    gray = np.array(generated_image.convert('L'))

    if method == "adaptive":
        # Adaptive thresholding works well for varied backgrounds
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 21, 5
        )
        # May need to invert depending on sigil color
        if np.mean(binary) > 127:
            binary = 255 - binary

    elif method == "otsu":
        # Otsu's method finds optimal threshold
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if np.mean(binary) > 127:
            binary = 255 - binary

    elif method == "edges":
        # Use edge detection
        edges = cv2.Canny(gray, 50, 150)
        # Dilate to connect edges
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        binary = cv2.dilate(edges, kernel, iterations=1)

    else:
        # Simple threshold
        _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)

    return binary


def compute_iou(
    mask1: np.ndarray,
    mask2: np.ndarray
) -> Tuple[float, dict]:
    """
    Compute Intersection over Union between two binary masks.

    IoU = (Intersection Area) / (Union Area)

    Args:
        mask1: First binary mask
        mask2: Second binary mask

    Returns:
        Tuple of (IoU score 0-1, analysis dict)
    """
    # Ensure binary
    mask1_binary = (mask1 > 127).astype(np.uint8)
    mask2_binary = (mask2 > 127).astype(np.uint8)

    # Compute intersection and union
    intersection = np.logical_and(mask1_binary, mask2_binary).sum()
    union = np.logical_or(mask1_binary, mask2_binary).sum()

    if union == 0:
        # Both masks are empty
        return 1.0, {"intersection": 0, "union": 0, "empty_masks": True}

    iou = intersection / union

    analysis = {
        "intersection_pixels": int(intersection),
        "union_pixels": int(union),
        "mask1_pixels": int(mask1_binary.sum()),
        "mask2_pixels": int(mask2_binary.sum()),
    }

    return float(iou), analysis


def compute_edge_overlap(
    image1: np.ndarray,
    image2: np.ndarray,
    canny_low: int = 50,
    canny_high: int = 150,
    tolerance_px: int = 3
) -> Tuple[float, dict]:
    """
    Compute edge-based overlap between two images.

    Uses Canny edge detection and allows for small positional tolerance.

    Args:
        image1: First image (grayscale)
        image2: Second image (grayscale)
        canny_low: Canny low threshold
        canny_high: Canny high threshold
        tolerance_px: Pixel tolerance for edge matching

    Returns:
        Tuple of (overlap score 0-1, analysis dict)
    """
    # Ensure grayscale
    if len(image1.shape) == 3:
        image1 = cv2.cvtColor(image1, cv2.COLOR_RGB2GRAY)
    if len(image2.shape) == 3:
        image2 = cv2.cvtColor(image2, cv2.COLOR_RGB2GRAY)

    # Detect edges
    edges1 = cv2.Canny(image1, canny_low, canny_high)
    edges2 = cv2.Canny(image2, canny_low, canny_high)

    # Dilate edges slightly for tolerance
    if tolerance_px > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (tolerance_px * 2 + 1, tolerance_px * 2 + 1)
        )
        edges1_dilated = cv2.dilate(edges1, kernel, iterations=1)
        edges2_dilated = cv2.dilate(edges2, kernel, iterations=1)
    else:
        edges1_dilated = edges1
        edges2_dilated = edges2

    # Compute overlap: edges from image1 that fall within dilated edges2
    edge1_pixels = (edges1 > 0).sum()
    edge2_pixels = (edges2 > 0).sum()

    if edge1_pixels == 0 or edge2_pixels == 0:
        return 0.0, {"edge1_pixels": int(edge1_pixels), "edge2_pixels": int(edge2_pixels), "no_edges": True}

    # How many edges from original are covered by generated
    forward_match = np.logical_and(edges1 > 0, edges2_dilated > 0).sum()
    forward_ratio = forward_match / edge1_pixels

    # How many edges from generated are covered by original
    backward_match = np.logical_and(edges2 > 0, edges1_dilated > 0).sum()
    backward_ratio = backward_match / edge2_pixels

    # Use harmonic mean (F1-style) for balanced metric
    if forward_ratio + backward_ratio > 0:
        edge_score = 2 * forward_ratio * backward_ratio / (forward_ratio + backward_ratio)
    else:
        edge_score = 0.0

    analysis = {
        "edge1_pixels": int(edge1_pixels),
        "edge2_pixels": int(edge2_pixels),
        "forward_match": int(forward_match),
        "forward_ratio": float(forward_ratio),
        "backward_match": int(backward_match),
        "backward_ratio": float(backward_ratio),
    }

    return float(edge_score), analysis


def resize_to_match(
    image1: np.ndarray,
    image2: np.ndarray
) -> Tuple[np.ndarray, np.ndarray]:
    """Resize images to match dimensions."""
    h1, w1 = image1.shape[:2]
    h2, w2 = image2.shape[:2]

    if h1 != h2 or w1 != w2:
        # Resize to the smaller dimensions
        target_h = min(h1, h2)
        target_w = min(w1, w2)
        image1 = cv2.resize(image1, (target_w, target_h))
        image2 = cv2.resize(image2, (target_w, target_h))

    return image1, image2


def compute_structure_match(
    original_mask: Image.Image | np.ndarray,
    generated_image: Image.Image | np.ndarray,
    config: Optional[StructureMatchConfig] = None,
    extraction_method: str = "adaptive"
) -> StructureMatchResult:
    """
    Main function to compute structure preservation score.

    Compares original sigil mask with AI-generated output to determine
    if the structure was preserved.

    Args:
        original_mask: Binary mask of original sigil (white strokes on black)
        generated_image: AI-generated output image
        config: Structure matching configuration
        extraction_method: Method to extract sigil from generated image

    Returns:
        StructureMatchResult with all scores and analysis
    """
    if config is None:
        config = structure_match_config

    # Convert to numpy arrays
    if isinstance(original_mask, Image.Image):
        original_array = np.array(original_mask.convert('L'))
    else:
        original_array = original_mask
        if len(original_array.shape) == 3:
            original_array = cv2.cvtColor(original_array, cv2.COLOR_RGB2GRAY)

    if isinstance(generated_image, Image.Image):
        generated_array = np.array(generated_image.convert('L'))
        generated_rgb = np.array(generated_image.convert('RGB'))
    else:
        if len(generated_image.shape) == 3:
            generated_rgb = generated_image
            generated_array = cv2.cvtColor(generated_image, cv2.COLOR_RGB2GRAY)
        else:
            generated_array = generated_image
            generated_rgb = cv2.cvtColor(generated_image, cv2.COLOR_GRAY2RGB)

    # Resize to match if needed
    original_array, generated_array = resize_to_match(original_array, generated_array)
    _, generated_rgb = resize_to_match(original_array, generated_rgb)

    # Binarize original mask
    original_binary = binarize_image(
        Image.fromarray(original_array),
        threshold=config.binarize_threshold
    )

    # Extract sigil structure from generated
    generated_binary = extract_sigil_from_generated(
        Image.fromarray(generated_rgb),
        method=extraction_method
    )

    # Compute IoU
    iou_score, iou_analysis = compute_iou(original_binary, generated_binary)

    # Compute edge overlap
    edge_score, edge_analysis = compute_edge_overlap(
        original_array,
        generated_array,
        tolerance_px=3
    )

    # Compute combined score
    combined_score = (
        config.iou_weight * iou_score +
        config.edge_weight * edge_score
    )

    # Determine classification
    structure_preserved = combined_score >= config.iou_threshold

    if combined_score >= 0.90:
        classification = "Structure Preserved"
    elif combined_score >= config.iou_threshold:
        classification = "Structure Preserved"
    elif combined_score >= 0.70:
        classification = "More Artistic"
    else:
        classification = "Style Drift"

    # Compile analysis
    analysis = {
        "iou_analysis": iou_analysis,
        "edge_analysis": edge_analysis,
        "thresholds": {
            "iou_threshold": config.iou_threshold,
            "edge_threshold": config.edge_match_threshold,
        },
        "extraction_method": extraction_method,
    }

    return StructureMatchResult(
        iou_score=iou_score,
        edge_overlap_score=edge_score,
        combined_score=combined_score,
        structure_preserved=structure_preserved,
        classification=classification,
        analysis=analysis
    )


def compute_batch_structure_match(
    original_mask: Image.Image | np.ndarray,
    generated_images: list[Image.Image | np.ndarray],
    config: Optional[StructureMatchConfig] = None
) -> list[StructureMatchResult]:
    """
    Compute structure match for multiple generated variations.

    Args:
        original_mask: Binary mask of original sigil
        generated_images: List of AI-generated images
        config: Structure matching configuration

    Returns:
        List of StructureMatchResult for each image
    """
    return [
        compute_structure_match(original_mask, img, config)
        for img in generated_images
    ]


def should_regenerate(
    results: list[StructureMatchResult],
    min_passing: int = 2
) -> Tuple[bool, list[int]]:
    """
    Determine if regeneration is needed based on structure match results.

    Args:
        results: Structure match results for all variations
        min_passing: Minimum number of variations that should pass

    Returns:
        Tuple of (should_regenerate, list of passing indices)
    """
    passing_indices = [
        i for i, result in enumerate(results)
        if result.structure_preserved
    ]

    should_regen = len(passing_indices) < min_passing

    return should_regen, passing_indices
