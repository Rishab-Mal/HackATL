"""Backend configuration loaded from environment variables.

Secrets live in backend/.env locally and must never be committed.
"""

from functools import lru_cache
import os
from pathlib import Path


def _load_dotenv():
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")


@lru_cache
def get_settings():
    _load_dotenv()
    return Settings()


class Settings:
    def __init__(self):
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        self.replicate_api_token = os.getenv("REPLICATE_API_TOKEN", "").strip()
        self.replicate_sam_model = os.getenv(
            "REPLICATE_SAM_MODEL", "lucataco/segment-anything-2"
        ).strip()
        models = os.getenv(
            "OPENROUTER_VISION_MODELS",
            # Fast model first; the others stay as quality fallbacks if it fails.
            "google/gemini-2.5-flash,anthropic/claude-sonnet-4.6,openai/gpt-4o",
        )
        self.openrouter_vision_models = [m.strip() for m in models.split(",") if m.strip()]
        self.aruco_marker_size_cm = float(os.getenv("ARUCO_MARKER_SIZE_CM", "5.0"))
        self.aruco_marker_id = int(os.getenv("ARUCO_MARKER_ID", "23"))
        self.max_image_dimension = int(os.getenv("VISION_MAX_IMAGE_DIMENSION", "1200"))
        self.max_pieces = int(os.getenv("VISION_MAX_PIECES", "35"))
        self.openrouter_timeout_s = int(os.getenv("OPENROUTER_TIMEOUT_S", "60"))
