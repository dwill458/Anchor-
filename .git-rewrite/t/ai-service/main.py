#!/usr/bin/env python3
"""
Anchor AI Service - Main Entry Point
Structure-preserving sigil enhancement using ControlNet.
"""

import uvicorn
from src.config import settings


def main():
    """Run the FastAPI application."""
    print("=" * 60)
    print("ANCHOR AI SERVICE - Sigil Geometry Preservation Pipeline")
    print("=" * 60)
    print(f"Host: {settings.HOST}")
    print(f"Port: {settings.PORT}")
    print(f"Debug: {settings.DEBUG}")
    print(f"Replicate API: {'Configured' if settings.REPLICATE_API_TOKEN else 'NOT CONFIGURED'}")
    print("=" * 60)

    uvicorn.run(
        "src.api:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning",
    )


if __name__ == "__main__":
    main()
