"""Lot endpoints -- turning vision color groups + factory records into real
inventory. Owned by Person 2 (backend, lots, and factory records).
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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


@router.get("", response_model=list[schemas.LotOut])
def list_lots(status: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(models.Lot)
    if status:
        query = query.filter(models.Lot.status == status)
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
    db.commit()
    db.refresh(lot)
    return lot
