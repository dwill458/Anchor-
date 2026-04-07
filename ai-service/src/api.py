"""
Anchor AI Service - FastAPI Application
RESTful API for structure-preserving sigil enhancement.
"""

import io
import base64
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image

from .config import (
    settings,
    STYLE_PRESETS,
    controlnet_config,
    structure_match_config,
)
from .preprocessing import preprocess_control_image, image_to_base64
from .generation import (
    generate_styled_variations,
    generate_with_auto_retry,
)
from .structure_matching import compute_structure_match
from .compositing import composite_original_lines, hybrid_enhancement


# ============================================================================
# Request/Response Models
# ============================================================================

class EnhanceRequest(BaseModel):
    """Request for sigil enhancement."""

    sigil_svg: str = Field(..., description="SVG string or base64 PNG of sigil")
    style_choice: str = Field(..., description="Style preset name")
    user_id: str = Field(..., description="User ID for tracking")
    anchor_id: str = Field(..., description="Anchor ID")
    num_variations: int = Field(default=4, ge=1, le=8, description="Number of variations")
    auto_composite: bool = Field(
        default=False,
        description="Auto-composite if structure drift detected"
    )
    min_structure_score: float = Field(
        default=0.85,
        ge=0.5, le=1.0,
        description="Minimum structure score threshold"
    )


class VariationResult(BaseModel):
    """Result for a single variation."""

    image_base64: str = Field(..., description="Base64 encoded image")
    structure_match_score: float = Field(..., description="IoU-based structure score")
    edge_overlap_score: float = Field(..., description="Edge-based overlap score")
    combined_score: float = Field(..., description="Weighted combined score")
    structure_preserved: bool = Field(..., description="True if above threshold")
    classification: str = Field(..., description="Structure Preserved / More Artistic / Style Drift")
    was_composited: bool = Field(default=False, description="True if original lines composited")
    seed: int = Field(..., description="Generation seed")


class EnhanceResponse(BaseModel):
    """Response from enhancement endpoint."""

    success: bool
    variations: list[VariationResult]
    control_image_base64: Optional[str] = None
    style_applied: str
    prompt_used: str
    negative_prompt_used: str
    generation_time_ms: int
    passing_count: int
    best_variation_index: int
    structure_threshold: float


class PreprocessRequest(BaseModel):
    """Request for preprocessing only."""

    sigil_svg: str = Field(..., description="SVG string or base64 PNG")


class PreprocessResponse(BaseModel):
    """Response from preprocessing endpoint."""

    control_image_base64: str
    stroke_mask_base64: str
    dilated_mask_base64: str
    processing_info: dict


class StructureMatchRequest(BaseModel):
    """Request for structure matching."""

    original_mask_base64: str = Field(..., description="Base64 original mask")
    generated_image_base64: str = Field(..., description="Base64 generated image")


class StructureMatchResponse(BaseModel):
    """Response from structure matching endpoint."""

    iou_score: float
    edge_overlap_score: float
    combined_score: float
    structure_preserved: bool
    classification: str


class CompositeRequest(BaseModel):
    """Request for compositing."""

    original_sigil: str = Field(..., description="SVG or base64 of original")
    generated_image_base64: str = Field(..., description="Base64 generated image")
    style_name: str = Field(default="watercolor")
    blend_texture: bool = Field(default=True)
    texture_strength: float = Field(default=0.2, ge=0.0, le=1.0)


class CompositeResponse(BaseModel):
    """Response from compositing endpoint."""

    composite_image_base64: str
    background_only_base64: str
    structure_guaranteed: bool


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    replicate_configured: bool
    available_styles: list[str]


# ============================================================================
# Application Setup
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("Anchor AI Service starting...")
    print(f"Available styles: {list(STYLE_PRESETS.keys())}")
    print(f"Replicate configured: {bool(settings.REPLICATE_API_TOKEN)}")
    yield
    print("Anchor AI Service shutting down...")


app = FastAPI(
    title="Anchor AI Service",
    description="Structure-preserving sigil enhancement using ControlNet",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Utility Functions
# ============================================================================

def decode_base64_image(base64_str: str) -> Image.Image:
    """Decode base64 string to PIL Image."""
    if base64_str.startswith('data:'):
        base64_str = base64_str.split(',')[1]
    image_bytes = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(image_bytes))


def encode_image_base64(image: Image.Image, format: str = "PNG") -> str:
    """Encode PIL Image to base64 string."""
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        replicate_configured=bool(settings.REPLICATE_API_TOKEN),
        available_styles=list(STYLE_PRESETS.keys()),
    )


@app.get("/styles")
async def get_available_styles():
    """Get available style presets with their configurations."""
    styles = {}
    for name, preset in STYLE_PRESETS.items():
        styles[name] = {
            "name": preset.name,
            "controlnet_type": preset.controlnet_type,
            "denoise_strength": preset.denoise_strength or controlnet_config.denoise_strength,
            "conditioning_scale": preset.conditioning_scale or controlnet_config.conditioning_scale,
        }
    return {"styles": styles}


@app.post("/preprocess", response_model=PreprocessResponse)
async def preprocess_sigil(request: PreprocessRequest):
    """
    Preprocess sigil to control image.

    Converts SVG/PNG to high-contrast control image with:
    - Stroke thickening
    - Padding/centering
    - Edge enhancement
    """
    try:
        result = preprocess_control_image(request.sigil_svg)

        return PreprocessResponse(
            control_image_base64=encode_image_base64(result.control_image),
            stroke_mask_base64=encode_image_base64(result.stroke_mask),
            dilated_mask_base64=encode_image_base64(result.dilated_mask),
            processing_info=result.processing_info,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/structure-match", response_model=StructureMatchResponse)
async def check_structure_match(request: StructureMatchRequest):
    """
    Compute structure match between original and generated image.

    Returns IoU score, edge overlap, and classification.
    """
    try:
        original = decode_base64_image(request.original_mask_base64)
        generated = decode_base64_image(request.generated_image_base64)

        result = compute_structure_match(original, generated)

        return StructureMatchResponse(
            iou_score=result.iou_score,
            edge_overlap_score=result.edge_overlap_score,
            combined_score=result.combined_score,
            structure_preserved=result.structure_preserved,
            classification=result.classification,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/composite", response_model=CompositeResponse)
async def composite_sigil(request: CompositeRequest):
    """
    Composite original sigil lines onto AI-generated background.

    Guarantees 100% structure preservation.
    """
    try:
        generated = decode_base64_image(request.generated_image_base64)

        result = composite_original_lines(
            request.original_sigil,
            generated,
            style_name=request.style_name,
            blend_texture=request.blend_texture,
            texture_strength=request.texture_strength,
        )

        return CompositeResponse(
            composite_image_base64=encode_image_base64(result.composite_image),
            background_only_base64=encode_image_base64(result.background_only),
            structure_guaranteed=result.structure_guaranteed,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/enhance", response_model=EnhanceResponse)
async def enhance_sigil(request: EnhanceRequest):
    """
    Main enhancement endpoint.

    Generates styled variations with structure preservation validation.
    Optionally auto-composites if structure drift detected.
    """
    # Validate style
    if request.style_choice not in STYLE_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid style. Available: {list(STYLE_PRESETS.keys())}"
        )

    try:
        # Generate variations
        result = await generate_with_auto_retry(
            request.sigil_svg,
            request.style_choice,
            num_variations=request.num_variations,
            min_passing=2,
        )

        # Process variations
        variations = []
        for i, var in enumerate(result.variations):
            was_composited = False

            # Auto-composite if enabled and structure drifted
            if request.auto_composite and not var.structure_match.structure_preserved:
                composite_result = composite_original_lines(
                    request.sigil_svg,
                    var.image,
                    style_name=request.style_choice,
                )
                final_image = composite_result.composite_image
                was_composited = True

                # Recompute structure match for composited image (should be ~1.0)
                new_match = compute_structure_match(result.stroke_mask, final_image)
                structure_score = new_match.combined_score
                structure_preserved = True
                classification = "Structure Preserved (Composited)"
            else:
                final_image = var.image
                structure_score = var.structure_match.combined_score
                structure_preserved = var.structure_match.structure_preserved
                classification = var.structure_match.classification

            variations.append(VariationResult(
                image_base64=encode_image_base64(final_image),
                structure_match_score=var.structure_match.iou_score,
                edge_overlap_score=var.structure_match.edge_overlap_score,
                combined_score=structure_score,
                structure_preserved=structure_preserved,
                classification=classification,
                was_composited=was_composited,
                seed=var.seed,
            ))

        return EnhanceResponse(
            success=True,
            variations=variations,
            control_image_base64=encode_image_base64(result.control_image),
            style_applied=result.style_applied,
            prompt_used=result.prompt_used,
            negative_prompt_used=result.negative_prompt_used,
            generation_time_ms=result.total_time_ms,
            passing_count=result.passing_count,
            best_variation_index=result.best_variation_index,
            structure_threshold=request.min_structure_score,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    """Run the service."""
    import uvicorn
    uvicorn.run(
        "src.api:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )


if __name__ == "__main__":
    main()
