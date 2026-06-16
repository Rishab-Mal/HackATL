"""Lot endpoints -- turning vision color groups + factory records into real
inventory. Owned by Person 2 (backend, lots, and factory records).
"""

from datetime import datetime
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..constants import CARBON_PER_KG, WATER_PER_KG
from ..database import engine, get_db
from ..pricing import calculate_base_price, current_price, decay_pct, days_listed

router = APIRouter(prefix="/api/lots", tags=["lots"])


def _lot_key(fabric_type: str, composition: str, color_name: str) -> str:
    parts = [fabric_type, composition, color_name]
    cleaned = []
    for part in parts:
        value = re.sub(r"[^a-z0-9]+", "-", (part or "unspecified").strip().lower())
        cleaned.append(value.strip("-") or "unspecified")
    return "::".join(cleaned)


def _image_list(value) -> list[dict]:
    if isinstance(value, list):
        normalized = []
        for img in value:
            if isinstance(img, str) and img:
                normalized.append({"src": img})
            elif isinstance(img, dict):
                src = img.get("src") or img.get("url") or img.get("crop_data_url") or img.get("data_url")
                if src:
                    normalized.append({**img, "src": src})
        return normalized
    return []


def _enrich(lot: models.Lot) -> schemas.LotOut:
    """Convert a Lot ORM object to LotOut, injecting computed price/decay fields."""
    return schemas.LotOut(
        id=lot.id,
        name=lot.name,
        description=lot.description,
        fabric_type=lot.fabric_type,
        composition=lot.composition,
        color_name=lot.color_name,
        color_hex=lot.color_hex,
        lot_key=lot.lot_key or _lot_key(lot.fabric_type, lot.composition, lot.color_name),
        scan_run_id=lot.scan_run_id,
        piece_images=_image_list(lot.piece_images),
        piece_count=lot.piece_count,
        weight_kg=lot.weight_kg,
        price_usd=lot.price_usd,
        current_price_usd=current_price(lot.price_usd, lot.created_at),
        price_decay_pct=decay_pct(lot.price_usd, lot.created_at),
        days_listed=days_listed(lot.created_at),
        carbon_saved_kg=lot.carbon_saved_kg,
        water_saved_l=lot.water_saved_l,
        origin_lat=lot.origin_lat,
        origin_lng=lot.origin_lng,
        status=lot.status,
        claimed_by=lot.claimed_by,
        claimed_at=lot.claimed_at,
        created_at=lot.created_at,
    )


@router.post("", response_model=schemas.LotOut)
def create_lot(lot: schemas.LotCreate, db: Session = Depends(get_db)):
    lot_key = lot.lot_key or _lot_key(lot.fabric_type, lot.composition, lot.color_name)
    existing = None
    if not lot.scan_run_id:
        existing = (
            db.query(models.Lot)
            .filter(models.Lot.status == "available")
            .filter(
                or_(
                    models.Lot.lot_key == lot_key,
                    and_(
                        models.Lot.lot_key.is_(None),
                        models.Lot.fabric_type == lot.fabric_type,
                        models.Lot.composition == lot.composition,
                        models.Lot.color_name == lot.color_name,
                    ),
                )
            )
            .order_by(models.Lot.created_at.asc())
            .first()
        )

    if existing:
        existing.lot_key = lot_key
        if existing.origin_lat is None and lot.origin_lat is not None:
            existing.origin_lat = lot.origin_lat
            existing.origin_lng = lot.origin_lng
        existing.weight_kg = round((existing.weight_kg or 0) + lot.weight_kg, 3)
        existing.piece_count = (existing.piece_count or 0) + lot.piece_count
        existing.carbon_saved_kg = round(existing.weight_kg * CARBON_PER_KG, 2)
        existing.water_saved_l = round(existing.weight_kg * WATER_PER_KG, 2)
        existing.price_usd = (
            round((existing.price_usd or 0) + lot.price_usd, 2)
            if lot.price_usd > 0
            else calculate_base_price(
                fabric_type=existing.fabric_type,
                composition=existing.composition,
                color_name=existing.color_name,
                weight_kg=existing.weight_kg,
                piece_count=existing.piece_count,
            )
        )
        existing.piece_images = (_image_list(existing.piece_images) + _image_list(lot.piece_images))[:24]
        if lot.description and lot.description not in (existing.description or ""):
            existing.description = "; ".join(filter(None, [existing.description, lot.description]))[:1200]
        db.commit()
        db.refresh(existing)
        return _enrich(existing)

    base_price = lot.price_usd if lot.price_usd > 0 else calculate_base_price(
        fabric_type=lot.fabric_type,
        composition=lot.composition,
        color_name=lot.color_name,
        weight_kg=lot.weight_kg,
        piece_count=lot.piece_count,
    )

    data = lot.model_dump()
    data["lot_key"] = lot_key
    data["piece_images"] = _image_list(data.get("piece_images"))
    db_lot = models.Lot(
        **{**data, "price_usd": base_price},
        carbon_saved_kg=round(lot.weight_kg * CARBON_PER_KG, 2),
        water_saved_l=round(lot.weight_kg * WATER_PER_KG, 2),
    )
    db.add(db_lot)
    db.commit()
    db.refresh(db_lot)
    return _enrich(db_lot)


@router.post("/scan-runs", response_model=schemas.ScanRunOut)
def create_scan_run(scan: schemas.ScanRunCreate, db: Session = Depends(get_db)):
    db_scan = models.ScanRun(
        annotated_image_data_url=scan.annotated_image_data_url,
        image_width=scan.image_width,
        image_height=scan.image_height,
        piece_count=scan.piece_count,
        group_count=scan.group_count,
        total_weight_kg=round(scan.total_weight_kg or 0, 4),
        total_carbon_saved_kg=round(scan.total_carbon_saved_kg or 0, 4),
        total_water_saved_l=round(scan.total_water_saved_l or 0, 2),
        summary=scan.summary or {},
    )
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)
    return db_scan


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
    claimed_by: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None),
    max_price: Optional[float] = Query(default=None),
    q: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Lot)
    if status:
        query = query.filter(models.Lot.status == status)
    if fabric_type:
        query = query.filter(models.Lot.fabric_type == fabric_type)
    if color_name:
        query = query.filter(models.Lot.color_name == color_name)
    if claimed_by:
        query = query.filter(models.Lot.claimed_by == claimed_by)
    if min_price is not None:
        query = query.filter(models.Lot.price_usd >= min_price)
    if max_price is not None:
        query = query.filter(models.Lot.price_usd <= max_price)
    if q and q.strip():
        term = q.strip()
        if engine.dialect.name == "postgresql":
            search_vec = func.to_tsvector(
                "english",
                func.concat_ws(
                    " ",
                    func.coalesce(models.Lot.name, ""),
                    func.coalesce(models.Lot.fabric_type, ""),
                    func.coalesce(models.Lot.color_name, ""),
                    func.coalesce(models.Lot.composition, ""),
                    func.coalesce(models.Lot.description, ""),
                ),
            )
            tsquery = func.websearch_to_tsquery("english", term)
            query = query.filter(search_vec.op("@@")(tsquery))
        else:
            pattern = f"%{term}%"
            query = query.filter(
                or_(
                    models.Lot.name.ilike(pattern),
                    models.Lot.fabric_type.ilike(pattern),
                    models.Lot.color_name.ilike(pattern),
                    models.Lot.composition.ilike(pattern),
                    models.Lot.description.ilike(pattern),
                )
            )
    return [_enrich(lot) for lot in query.order_by(models.Lot.created_at.desc()).all()]


@router.get("/{lot_id}", response_model=schemas.LotOut)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(models.Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return _enrich(lot)


@router.post("/{lot_id}/claim", response_model=schemas.LotOut)
def claim_lot(lot_id: int, claim: schemas.LotClaim, db: Session = Depends(get_db)):
    lot = db.get(models.Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    if lot.status == "claimed":
        raise HTTPException(status_code=400, detail="Lot already claimed")
    if lot.status != "available":
        raise HTTPException(status_code=400, detail="Lot is not available")

    quantity_kg = claim.quantity_kg
    if quantity_kg is not None:
        quantity_kg = round(float(quantity_kg), 3)
        if quantity_kg <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    if quantity_kg is None or quantity_kg >= (lot.weight_kg or 0) - 0.001:
        lot.status = "claimed"
        lot.claimed_by = claim.buyer_name
        lot.claimed_at = datetime.utcnow()
        claimed = lot
    else:
        if quantity_kg > (lot.weight_kg or 0):
            raise HTTPException(status_code=400, detail="Quantity exceeds available weight")
        ratio = quantity_kg / lot.weight_kg if lot.weight_kg else 0
        claimed_pieces = max(1, round((lot.piece_count or 0) * ratio))
        claimed_images = _image_list(lot.piece_images)[:claimed_pieces]
        claimed = models.Lot(
            name=lot.name,
            description=lot.description,
            fabric_type=lot.fabric_type,
            composition=lot.composition,
            color_name=lot.color_name,
            color_hex=lot.color_hex,
            lot_key=lot.lot_key,
            piece_images=claimed_images,
            piece_count=claimed_pieces,
            weight_kg=quantity_kg,
            price_usd=round((lot.price_usd or 0) * ratio, 2),
            carbon_saved_kg=round((lot.carbon_saved_kg or 0) * ratio, 2),
            water_saved_l=round((lot.water_saved_l or 0) * ratio, 2),
            status="claimed",
            claimed_by=claim.buyer_name,
            claimed_at=datetime.utcnow(),
            created_at=lot.created_at,
        )
        lot.weight_kg = round(lot.weight_kg - quantity_kg, 3)
        lot.piece_count = max(0, (lot.piece_count or 0) - claimed_pieces)
        lot.price_usd = round((lot.price_usd or 0) - claimed.price_usd, 2)
        lot.carbon_saved_kg = round((lot.carbon_saved_kg or 0) - claimed.carbon_saved_kg, 2)
        lot.water_saved_l = round((lot.water_saved_l or 0) - claimed.water_saved_l, 2)
        remaining_images = _image_list(lot.piece_images)[claimed_pieces:]
        lot.piece_images = remaining_images or _image_list(lot.piece_images)
        db.add(claimed)
    db.commit()
    db.refresh(claimed)
    return _enrich(claimed)


@router.patch("/{lot_id}/delist", response_model=schemas.LotOut)
def delist_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(models.Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    if lot.status == "claimed":
        raise HTTPException(status_code=400, detail="Cannot delist a claimed lot")
    lot.status = "unlisted"
    db.commit()
    db.refresh(lot)
    return _enrich(lot)


@router.patch("/{lot_id}/relist", response_model=schemas.LotOut)
def relist_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(models.Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    if lot.status != "unlisted":
        raise HTTPException(status_code=400, detail="Lot is not unlisted")
    lot.status = "available"
    db.commit()
    db.refresh(lot)
    return _enrich(lot)


@router.delete("/{lot_id}")
def delete_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(models.Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    db.delete(lot)
    db.commit()
    return {"status": "ok", "deleted_lot_id": lot_id}
