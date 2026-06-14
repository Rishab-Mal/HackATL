"""Lot endpoints -- turning vision color groups + factory records into real
inventory. Owned by Person 2 (backend, lots, and factory records).
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..constants import CARBON_PER_KG, WATER_PER_KG
from ..database import get_db

router = APIRouter(prefix="/api/lots", tags=["lots"])


@router.post("", response_model=schemas.LotOut)
def create_lot(lot: schemas.LotCreate, db: Session = Depends(get_db)):
    if lot.factory_record_id is not None and not db.get(models.FactoryRecord, lot.factory_record_id):
        raise HTTPException(status_code=404, detail="Factory record not found")

    db_lot = models.Lot(
        **lot.model_dump(),
        carbon_saved_kg=round(lot.weight_kg * CARBON_PER_KG, 2),
        water_saved_l=round(lot.weight_kg * WATER_PER_KG, 2),
    )
    db.add(db_lot)
    db.commit()
    db.refresh(db_lot)
    return db_lot


@router.get("/filters", response_model=schemas.LotFilterOptions)
def get_lot_filters(db: Session = Depends(get_db)):
    """Distinct fabric types, colors, and the price range across all lots --
    used by the frontend to populate the Marketplace / Sorted Lots filter
    controls without hardcoding option lists."""

    fabric_types = [
        row[0] for row in db.query(models.Lot.fabric_type).distinct().order_by(models.Lot.fabric_type).all()
    ]
    colors = (
        db.query(models.Lot.color_name, models.Lot.color_hex)
        .distinct()
        .order_by(models.Lot.color_name)
        .all()
    )
    min_price, max_price = db.query(func.min(models.Lot.price_usd), func.max(models.Lot.price_usd)).one()

    return schemas.LotFilterOptions(
        fabric_types=fabric_types,
        colors=[schemas.ColorOption(color_name=name, color_hex=hex_) for name, hex_ in colors],
        min_price=min_price or 0.0,
        max_price=max_price or 0.0,
    )


@router.get("", response_model=list[schemas.LotOut])
def list_lots(
    status: Optional[str] = Query(default=None),
    fabric_type: Optional[str] = Query(default=None),
    color_name: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None),
    max_price: Optional[float] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Lot)
    if status:
        query = query.filter(models.Lot.status == status)
    if fabric_type:
        query = query.filter(models.Lot.fabric_type == fabric_type)
    if color_name:
        query = query.filter(models.Lot.color_name == color_name)
    if min_price is not None:
        query = query.filter(models.Lot.price_usd >= min_price)
    if max_price is not None:
        query = query.filter(models.Lot.price_usd <= max_price)
    return query.order_by(models.Lot.created_at.desc()).all()


@router.get("/{lot_id}", response_model=schemas.LotOut)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(models.Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot


@router.post("/{lot_id}/claim", response_model=schemas.LotOut)
def claim_lot(lot_id: int, claim: schemas.LotClaim, db: Session = Depends(get_db)):
    lot = db.get(models.Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    if lot.status == "claimed":
        raise HTTPException(status_code=400, detail="Lot already claimed")

    lot.status = "claimed"
    lot.claimed_by = claim.buyer_name
    lot.claimed_at = datetime.utcnow()
    db.commit()
    db.refresh(lot)
    return lot
