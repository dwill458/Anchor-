"""
Anchor AI Service - Sigil Geometry Preservation Pipeline

This service provides structure-preserving AI enhancement for sigils.
Key features:
- Preprocessing with stroke thickening for edge survival
- ControlNet generation with optimized parameters
- Structure matching metrics (IoU, edge overlap)
- Optional compositing for guaranteed fidelity
"""

from .config import (
    settings,
    controlnet_config,
    preprocess_config,
    structure_match_config,
    STYLE_PRESETS,
)

from .preprocessing import (
    preprocess_control_image,
    ControlImageResult,
)

from .generation import (
    generate_styled_variations,
    generate_styled_variations_sync,
    generate_with_auto_retry,
    StyledVariationsResult,
    GenerationResult,
)

from .structure_matching import (
    compute_structure_match,
    compute_batch_structure_match,
    StructureMatchResult,
)

from .compositing import (
    composite_original_lines,
    hybrid_enhancement,
    CompositeResult,
)

__all__ = [
    # Config
    'settings',
    'controlnet_config',
    'preprocess_config',
    'structure_match_config',
    'STYLE_PRESETS',

    # Preprocessing
    'preprocess_control_image',
    'ControlImageResult',

    # Generation
    'generate_styled_variations',
    'generate_styled_variations_sync',
    'generate_with_auto_retry',
    'StyledVariationsResult',
    'GenerationResult',

    # Structure matching
    'compute_structure_match',
    'compute_batch_structure_match',
    'StructureMatchResult',

    # Compositing
    'composite_original_lines',
    'hybrid_enhancement',
    'CompositeResult',
]
