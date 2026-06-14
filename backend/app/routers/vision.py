"""Vision endpoints. Owned by Person 1 (computer vision and sorting)."""

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..schemas import DetectResponse
from ..vision.segmentation import detect_pieces

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("/detect", response_model=DetectResponse)
async def detect(image: UploadFile = File(...)):
    """Accept a photo of mixed scraps and return detected pieces plus
    color-based groups (the "before -> after" sorting result)."""

    contents = await image.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        return detect_pieces(contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
