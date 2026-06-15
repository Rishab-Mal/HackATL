"""AI Material Destination Engine endpoint -- recommends reuse pathways,
buyers, and environmental impact for a detected fabric group.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..config import get_settings
from ..database import get_db
from ..destinations import analyze_destinations

router = APIRouter(prefix="/api/destinations", tags=["destinations"])


@router.post("/analyze", response_model=schemas.DestinationAnalysis)
def analyze(req: schemas.DestinationAnalysisRequest, db: Session = Depends(get_db)):
    return analyze_destinations(
        fabric_type=req.fabric_type,
        composition=req.composition,
        color_name=req.color_name,
        weight_kg=req.weight_kg,
        material_family=req.material_family,
        db=db,
        settings=get_settings(),
    )
