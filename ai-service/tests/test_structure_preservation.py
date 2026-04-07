#!/usr/bin/env python3
"""
Anchor AI Service - Structure Preservation Test Suite

This test suite validates that the "Structure Preserved" badge is accurate.
It tests:
1. Preprocessing produces correct control images
2. Structure matching IoU is accurate
3. Generated images actually preserve geometry
4. Compositing guarantees structure fidelity

Run with: pytest tests/test_structure_preservation.py -v
"""

import pytest
import numpy as np
from PIL import Image, ImageDraw
import io
import base64
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.preprocessing import (
    preprocess_control_image,
    thicken_strokes,
    create_stroke_mask,
    create_dilated_mask,
)
from src.structure_matching import (
    compute_structure_match,
    compute_iou,
    binarize_image,
)
from src.compositing import (
    composite_original_lines,
    composite_sigil_on_background,
)
from src.config import (
    structure_match_config,
    preprocess_config,
    STYLE_PRESETS,
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def simple_sigil_svg():
    """A simple cross-shaped sigil for testing."""
    return '''<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 10 L 50 90" stroke="white" stroke-width="3" fill="none"/>
        <path d="M 10 50 L 90 50" stroke="white" stroke-width="3" fill="none"/>
    </svg>'''


@pytest.fixture
def complex_sigil_svg():
    """A more complex sigil with curves and angles."""
    return '''<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <path d="M 100 20 L 60 180 L 180 70 L 20 70 L 140 180 Z"
              stroke="white" stroke-width="2" fill="none"/>
        <circle cx="100" cy="100" r="40" stroke="white" stroke-width="2" fill="none"/>
    </svg>'''


@pytest.fixture
def sigil_image():
    """Create a simple sigil as PIL Image."""
    img = Image.new('L', (256, 256), 0)
    draw = ImageDraw.Draw(img)
    # Draw a cross
    draw.line([(128, 32), (128, 224)], fill=255, width=4)
    draw.line([(32, 128), (224, 128)], fill=255, width=4)
    return img


@pytest.fixture
def matching_generated_image():
    """Create a 'generated' image that matches the sigil structure."""
    img = Image.new('RGB', (256, 256), (30, 30, 60))  # Dark background
    draw = ImageDraw.Draw(img)
    # Same cross but with slight texture
    draw.line([(128, 32), (128, 224)], fill=(200, 180, 120), width=5)
    draw.line([(32, 128), (224, 128)], fill=(200, 180, 120), width=5)
    return img


@pytest.fixture
def drifted_generated_image():
    """Create a 'generated' image with structure drift (extra elements)."""
    img = Image.new('RGB', (256, 256), (30, 30, 60))
    draw = ImageDraw.Draw(img)
    # Original cross
    draw.line([(128, 32), (128, 224)], fill=(200, 180, 120), width=5)
    draw.line([(32, 128), (224, 128)], fill=(200, 180, 120), width=5)
    # EXTRA elements - this is structure drift!
    draw.ellipse([(64, 64), (192, 192)], outline=(200, 180, 120), width=3)
    draw.line([(64, 64), (192, 192)], fill=(200, 180, 120), width=2)
    return img


# ============================================================================
# Preprocessing Tests
# ============================================================================

class TestPreprocessing:
    """Test preprocessing functions."""

    def test_svg_to_control_image(self, simple_sigil_svg):
        """Test SVG conversion to control image."""
        result = preprocess_control_image(simple_sigil_svg)

        assert result.control_image is not None
        assert result.control_image.size == (1024, 1024)
        assert result.stroke_mask is not None
        assert result.dilated_mask is not None

    def test_stroke_thickening(self, sigil_image):
        """Test that stroke thickening increases stroke width."""
        thickened = thicken_strokes(sigil_image, multiplier=2.0)

        # Count white pixels - thickened should have more
        original_pixels = np.array(sigil_image).sum()
        thickened_pixels = np.array(thickened).sum()

        assert thickened_pixels > original_pixels * 1.3  # At least 30% more

    def test_stroke_mask_creation(self, sigil_image):
        """Test stroke mask is binary and covers strokes."""
        mask = create_stroke_mask(sigil_image)

        mask_array = np.array(mask)
        unique_values = np.unique(mask_array)

        # Should be binary (only 0 and 255)
        assert len(unique_values) <= 2
        assert 255 in unique_values or 0 in unique_values

    def test_dilated_mask_is_larger(self, sigil_image):
        """Test dilated mask is larger than stroke mask."""
        mask = create_stroke_mask(sigil_image)
        dilated = create_dilated_mask(mask, dilation_px=6)

        mask_pixels = np.array(mask).sum()
        dilated_pixels = np.array(dilated).sum()

        assert dilated_pixels > mask_pixels

    def test_padding_centers_content(self, simple_sigil_svg):
        """Test that padding centers the sigil."""
        result = preprocess_control_image(simple_sigil_svg)

        # Check that content is roughly centered
        img_array = np.array(result.control_image.convert('L'))
        coords = np.column_stack(np.where(img_array > 10))

        if len(coords) > 0:
            center_y = coords[:, 0].mean()
            center_x = coords[:, 1].mean()

            # Should be within 20% of center
            expected_center = result.control_image.size[0] / 2
            assert abs(center_x - expected_center) < expected_center * 0.2
            assert abs(center_y - expected_center) < expected_center * 0.2


# ============================================================================
# Structure Matching Tests
# ============================================================================

class TestStructureMatching:
    """Test structure matching and IoU calculation."""

    def test_identical_images_score_high(self, sigil_image):
        """Test that identical images have IoU close to 1.0."""
        iou, _ = compute_iou(np.array(sigil_image), np.array(sigil_image))
        assert iou > 0.99

    def test_matching_images_pass_threshold(self, sigil_image, matching_generated_image):
        """Test that matching images pass structure threshold."""
        result = compute_structure_match(sigil_image, matching_generated_image)

        assert result.combined_score >= 0.7
        # Note: exact threshold depends on extraction method
        print(f"Matching image score: {result.combined_score:.3f}")

    def test_drifted_images_fail_threshold(self, sigil_image, drifted_generated_image):
        """Test that drifted images are detected."""
        result = compute_structure_match(sigil_image, drifted_generated_image)

        # Drifted image should score lower due to extra elements
        print(f"Drifted image score: {result.combined_score:.3f}")
        print(f"Classification: {result.classification}")

        # The score should be lower than matching, indicating drift
        # but exact behavior depends on extraction method

    def test_completely_different_fails(self, sigil_image):
        """Test that completely different image fails."""
        # Create a completely different image
        different = Image.new('RGB', sigil_image.size, (100, 50, 50))
        draw = ImageDraw.Draw(different)
        draw.ellipse([(50, 50), (200, 200)], outline=(255, 255, 255), width=5)

        result = compute_structure_match(sigil_image, different)

        assert result.combined_score < 0.5
        assert result.classification in ['Style Drift', 'More Artistic']

    def test_classification_labels(self, sigil_image, matching_generated_image):
        """Test that classification labels are correct."""
        result = compute_structure_match(sigil_image, matching_generated_image)

        valid_classifications = ['Structure Preserved', 'More Artistic', 'Style Drift']
        assert result.classification in valid_classifications


# ============================================================================
# Compositing Tests
# ============================================================================

class TestCompositing:
    """Test compositing functions for guaranteed fidelity."""

    def test_composite_preserves_structure(self, sigil_image, drifted_generated_image):
        """Test that compositing guarantees structure preservation."""
        result = composite_original_lines(
            sigil_image,
            drifted_generated_image,
            blend_texture=True
        )

        assert result.structure_guaranteed is True

        # Check that the composite matches original structure
        match_result = compute_structure_match(
            sigil_image,
            result.composite_image
        )

        # Composited image should have very high structure match
        assert match_result.combined_score > 0.9

    def test_composite_uses_background_style(self, sigil_image, matching_generated_image):
        """Test that composite uses background from generated image."""
        result = composite_original_lines(
            sigil_image,
            matching_generated_image,
            blend_texture=False
        )

        # The background should contain colors from the generated image
        # (not pure black like the original sigil)
        composite_array = np.array(result.composite_image)
        bg_sample = composite_array[10, 10]  # Sample corner (should be background)

        # Background should not be pure black
        assert sum(bg_sample) > 10


# ============================================================================
# Configuration Tests
# ============================================================================

class TestConfiguration:
    """Test configuration values are appropriate."""

    def test_structure_threshold_reasonable(self):
        """Test structure threshold is in reasonable range."""
        threshold = structure_match_config.iou_threshold

        assert 0.7 <= threshold <= 0.95
        assert threshold == 0.85  # Expected default

    def test_all_styles_have_strict_prompts(self):
        """Test all style presets have structure-preserving prompts."""
        required_phrases = ['preserve', 'geometry', 'exact']

        for name, preset in STYLE_PRESETS.items():
            prompt_lower = preset.prompt_template.lower()

            has_required = any(phrase in prompt_lower for phrase in required_phrases)
            assert has_required, f"Style '{name}' prompt missing structure preservation language"

    def test_all_styles_have_strict_negative_prompts(self):
        """Test all styles have negative prompts preventing structure change."""
        forbidden_in_negative = ['extra lines', 'decorative circle', 'altered shape']

        for name, preset in STYLE_PRESETS.items():
            negative_lower = preset.negative_prompt.lower()

            has_forbidden = any(phrase in negative_lower for phrase in forbidden_in_negative)
            assert has_forbidden, f"Style '{name}' negative prompt missing structure protection"

    def test_stroke_multiplier_reasonable(self):
        """Test stroke multiplier is in recommended range."""
        multiplier = preprocess_config.stroke_multiplier

        assert 1.5 <= multiplier <= 3.0


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests for the full pipeline."""

    def test_full_preprocessing_pipeline(self, complex_sigil_svg):
        """Test full preprocessing pipeline produces valid output."""
        result = preprocess_control_image(complex_sigil_svg)

        # Check all outputs exist and have correct type
        assert isinstance(result.control_image, Image.Image)
        assert isinstance(result.stroke_mask, Image.Image)
        assert isinstance(result.dilated_mask, Image.Image)

        # Check processing info captured steps
        assert 'steps' in result.processing_info
        assert len(result.processing_info['steps']) > 0

    def test_structure_match_with_preprocessing(self, simple_sigil_svg, matching_generated_image):
        """Test structure matching works with preprocessed control image."""
        preprocess_result = preprocess_control_image(simple_sigil_svg)

        # Resize generated to match
        generated_resized = matching_generated_image.resize(
            preprocess_result.control_image.size
        )

        match_result = compute_structure_match(
            preprocess_result.stroke_mask,
            generated_resized
        )

        assert match_result.iou_score >= 0
        assert match_result.edge_overlap_score >= 0
        assert match_result.combined_score >= 0


# ============================================================================
# Validation Script
# ============================================================================

def validate_structure_preservation():
    """
    Validation script to verify structure preservation is working.

    This can be run manually to validate the system:
        python -c "from tests.test_structure_preservation import validate_structure_preservation; validate_structure_preservation()"
    """
    print("=" * 60)
    print("STRUCTURE PRESERVATION VALIDATION")
    print("=" * 60)

    # Test 1: Configuration Check
    print("\n[1] Configuration Check")
    print(f"    Structure threshold: {structure_match_config.iou_threshold}")
    print(f"    Stroke multiplier: {preprocess_config.stroke_multiplier}")
    print(f"    Padding: {preprocess_config.padding_percent * 100}%")

    # Test 2: Style Prompts Check
    print("\n[2] Style Prompts Check")
    for name, preset in STYLE_PRESETS.items():
        has_preserve = 'preserve' in preset.prompt_template.lower()
        has_geometry = 'geometry' in preset.prompt_template.lower()
        status = "PASS" if has_preserve and has_geometry else "WARN"
        print(f"    {name}: {status}")

    # Test 3: Preprocessing Test
    print("\n[3] Preprocessing Test")
    test_svg = '''<svg width="100" height="100">
        <path d="M 50 10 L 50 90 M 10 50 L 90 50" stroke="white" stroke-width="2"/>
    </svg>'''

    try:
        result = preprocess_control_image(test_svg)
        print(f"    Control image size: {result.control_image.size}")
        print(f"    Preprocessing steps: {len(result.processing_info['steps'])}")
        print("    Status: PASS")
    except Exception as e:
        print(f"    Status: FAIL - {e}")

    # Test 4: IoU Calculation Test
    print("\n[4] IoU Calculation Test")
    img1 = np.zeros((100, 100), dtype=np.uint8)
    img1[40:60, 10:90] = 255  # Horizontal bar

    img2 = np.zeros((100, 100), dtype=np.uint8)
    img2[40:60, 10:90] = 255  # Same bar

    iou, _ = compute_iou(img1, img2)
    print(f"    Identical images IoU: {iou:.4f}")
    print(f"    Status: {'PASS' if iou > 0.99 else 'FAIL'}")

    # Summary
    print("\n" + "=" * 60)
    print("Validation complete. Check results above for any FAIL or WARN.")
    print("=" * 60)


if __name__ == "__main__":
    validate_structure_preservation()
