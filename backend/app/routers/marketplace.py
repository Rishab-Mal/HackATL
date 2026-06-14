"""Marketplace, buyer profiles, and impact dashboard endpoints. Owned by
Person 4 (marketplace, impact logic, and demo data).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import constants, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])
impact_router = APIRouter(prefix="/api", tags=["impact"])


@router.get("/buyers", response_model=list[schemas.BuyerOut])
def list_buyers(db: Session = Depends(get_db)):
    return [schemas.BuyerOut.from_orm_obj(b) for b in db.query(models.Buyer).all()]


@router.post("/buyers", response_model=schemas.BuyerOut)
def create_buyer(buyer: schemas.BuyerCreate, db: Session = Depends(get_db)):
    db_buyer = models.Buyer(
        name=buyer.name,
        type=buyer.type,
        location=buyer.location,
        description=buyer.description,
        interested_materials=",".join(buyer.interested_materials),
    )
    db.add(db_buyer)
    db.commit()
    db.refresh(db_buyer)
    return schemas.BuyerOut.from_orm_obj(db_buyer)


@impact_router.get("/impact", response_model=schemas.ImpactSummary)
def get_impact(db: Session = Depends(get_db)):
    lots = db.query(models.Lot).all()

    fabric_breakdown: dict[str, float] = {}
    for lot in lots:
        fabric_breakdown[lot.fabric_type] = round(fabric_breakdown.get(lot.fabric_type, 0) + lot.weight_kg, 2)

    total_carbon_saved_kg = round(sum(l.carbon_saved_kg for l in lots), 2)
    total_water_saved_l = round(sum(l.water_saved_l for l in lots), 2)

    equivalents = schemas.ImpactEquivalents(
        car_miles=round(total_carbon_saved_kg / constants.CO2_KG_PER_CAR_MILE, 1),
        phone_charges=round(total_carbon_saved_kg / constants.CO2_KG_PER_PHONE_CHARGE),
        plastic_bottles=round(total_water_saved_l / constants.WATER_L_PER_PLASTIC_BOTTLE),
        showers=round(total_water_saved_l / constants.WATER_L_PER_SHOWER, 1),
    )

    return schemas.ImpactSummary(
        total_lots=len(lots),
        claimed_lots=len([l for l in lots if l.status == "claimed"]),
        total_weight_kg=round(sum(l.weight_kg for l in lots), 2),
        total_carbon_saved_kg=total_carbon_saved_kg,
        total_water_saved_l=total_water_saved_l,
        equivalents=equivalents,
        fabric_breakdown=fabric_breakdown,
    )
