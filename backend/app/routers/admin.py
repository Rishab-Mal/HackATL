"""Admin operations dashboard and demo reset endpoints."""

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..pricing import current_price, days_listed, decay_pct
from .auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

ESTIMATED_COST_FACTOR = 0.28
DIVERSION_TARGET_KG = 5.0


def _round_small(value: float, small_digits: int = 3, normal_digits: int = 1) -> float:
    value = float(value or 0)
    if abs(value) < 1:
        return round(value, small_digits)
    return round(value, normal_digits)


def _short_fabric(value: str) -> str:
    return (value or "Unspecified").split("/")[0].replace(" Blend", "").strip() or "Unspecified"


def _lot_row(lot: models.Lot) -> dict:
    return {
        "id": lot.id,
        "name": lot.name,
        "fabric_type": lot.fabric_type,
        "composition": lot.composition,
        "color_name": lot.color_name,
        "color_hex": lot.color_hex,
        "piece_count": lot.piece_count or 0,
        "weight_kg": _round_small(lot.weight_kg, normal_digits=2),
        "price_usd": round(lot.price_usd or 0, 2),
        "current_price_usd": round(current_price(lot.price_usd or 0, lot.created_at), 2),
        "carbon_saved_kg": _round_small(lot.carbon_saved_kg, normal_digits=2),
        "water_saved_l": round(lot.water_saved_l or 0, 1),
        "status": lot.status,
        "claimed_by": lot.claimed_by,
        "days_listed": days_listed(lot.created_at),
        "price_decay_pct": decay_pct(lot.price_usd or 0, lot.created_at),
        "scan_run_id": lot.scan_run_id,
        "thumbnail": _thumbnail(lot.piece_images),
        "created_at": lot.created_at.isoformat(),
    }


def _thumbnail(piece_images) -> str | None:
    if not isinstance(piece_images, list) or not piece_images:
        return None
    first = piece_images[0]
    if isinstance(first, str):
        return first
    if isinstance(first, dict):
        return first.get("src") or first.get("url") or first.get("crop_data_url") or first.get("data_url")
    return None


def _status_counts(lots: list[models.Lot]) -> dict:
    return {
        "available": sum(1 for lot in lots if lot.status == "available"),
        "claimed": sum(1 for lot in lots if lot.status == "claimed"),
        "unlisted": sum(1 for lot in lots if lot.status == "unlisted"),
    }


def _run_label(created_at: datetime) -> str:
    return created_at.strftime("%b %-d, %-I:%M %p")


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    lots = db.query(models.Lot).order_by(models.Lot.created_at.desc()).all()
    scan_runs = db.query(models.ScanRun).order_by(models.ScanRun.created_at.desc()).all()

    claimed = [lot for lot in lots if lot.status == "claimed"]
    available = [lot for lot in lots if lot.status == "available"]
    unlisted = [lot for lot in lots if lot.status == "unlisted"]
    active_inventory = available + unlisted

    revenue = sum(lot.price_usd or 0 for lot in claimed)
    estimated_cost = revenue * ESTIMATED_COST_FACTOR
    gross_profit = revenue - estimated_cost
    inventory_value = sum(current_price(lot.price_usd or 0, lot.created_at) for lot in available)
    unlisted_value = sum(current_price(lot.price_usd or 0, lot.created_at) for lot in unlisted)
    total_weight = sum(lot.weight_kg or 0 for lot in lots)
    total_pieces = sum(lot.piece_count or 0 for lot in lots)
    total_carbon = sum(lot.carbon_saved_kg or 0 for lot in lots)
    total_water = sum(lot.water_saved_l or 0 for lot in lots)
    avg_price_per_kg = inventory_value / sum(lot.weight_kg or 0 for lot in available) if available else 0

    lots_by_run: dict[int, list[models.Lot]] = defaultdict(list)
    for lot in lots:
        if lot.scan_run_id:
            lots_by_run[lot.scan_run_id].append(lot)

    recent_runs = []
    for scan in scan_runs[:8]:
        run_lots = sorted(lots_by_run.get(scan.id, []), key=lambda lot: lot.created_at, reverse=True)
        run_weight = sum(lot.weight_kg or 0 for lot in run_lots) or (scan.total_weight_kg or 0)
        run_value = sum(current_price(lot.price_usd or 0, lot.created_at) for lot in run_lots)
        run_carbon = sum(lot.carbon_saved_kg or 0 for lot in run_lots) or (scan.total_carbon_saved_kg or 0)
        run_water = sum(lot.water_saved_l or 0 for lot in run_lots) or (scan.total_water_saved_l or 0)
        summary = scan.summary if isinstance(scan.summary, dict) else {}
        recent_runs.append({
            "id": scan.id,
            "created_at": scan.created_at.isoformat(),
            "label": _run_label(scan.created_at),
            "annotated_image_data_url": scan.annotated_image_data_url,
            "piece_count": sum(lot.piece_count or 0 for lot in run_lots) or scan.piece_count or 0,
            "group_count": len(run_lots) or scan.group_count or 0,
            "total_weight_kg": _round_small(run_weight, normal_digits=2),
            "inventory_value": round(run_value, 2),
            "carbon_saved_kg": _round_small(run_carbon, normal_digits=2),
            "water_saved_l": round(run_water, 1),
            "status_counts": _status_counts(run_lots),
            "scale_method": summary.get("scale_method") or "vision estimate",
            "scale_confidence": summary.get("scale_confidence") or "reviewed",
            "warnings": summary.get("warnings") or [],
            "lots": [_lot_row(lot) for lot in run_lots[:10]],
            "summary_groups": summary.get("groups") or [],
        })

    if not recent_runs and lots:
        created_at = max(lot.created_at for lot in lots)
        recent_runs.append({
            "id": None,
            "created_at": created_at.isoformat(),
            "label": "Current inventory",
            "annotated_image_data_url": None,
            "piece_count": total_pieces,
            "group_count": len(lots),
            "total_weight_kg": _round_small(total_weight, normal_digits=2),
            "inventory_value": round(inventory_value, 2),
            "carbon_saved_kg": _round_small(total_carbon, normal_digits=2),
            "water_saved_l": round(total_water, 1),
            "status_counts": _status_counts(lots),
            "scale_method": "legacy lots",
            "scale_confidence": "stored inventory",
            "warnings": [],
            "lots": [_lot_row(lot) for lot in lots[:10]],
            "summary_groups": [],
        })

    fabric_stats: dict[str, dict] = {}
    for lot in lots:
        key = _short_fabric(lot.fabric_type)
        entry = fabric_stats.setdefault(key, {
            "fabric_type": key,
            "lots": 0,
            "pieces": 0,
            "weight_kg": 0.0,
            "inventory_value": 0.0,
            "revenue": 0.0,
            "carbon_kg": 0.0,
            "water_l": 0.0,
            "color_hex": lot.color_hex,
        })
        entry["lots"] += 1
        entry["pieces"] += lot.piece_count or 0
        entry["weight_kg"] += lot.weight_kg or 0
        entry["carbon_kg"] += lot.carbon_saved_kg or 0
        entry["water_l"] += lot.water_saved_l or 0
        if lot.status == "claimed":
            entry["revenue"] += lot.price_usd or 0
        elif lot.status == "available":
            entry["inventory_value"] += current_price(lot.price_usd or 0, lot.created_at)

    fabric_rows = sorted(fabric_stats.values(), key=lambda row: (-row["weight_kg"], row["fabric_type"]))
    for row in fabric_rows:
        row["weight_kg"] = _round_small(row["weight_kg"], normal_digits=2)
        row["inventory_value"] = round(row["inventory_value"], 2)
        row["revenue"] = round(row["revenue"], 2)
        row["carbon_kg"] = _round_small(row["carbon_kg"], normal_digits=2)
        row["water_l"] = round(row["water_l"], 1)

    run_history = []
    for index, scan in enumerate(reversed(scan_runs[-8:]), start=1):
        run_lots = lots_by_run.get(scan.id, [])
        weight = sum(lot.weight_kg or 0 for lot in run_lots) or scan.total_weight_kg or 0
        value = sum(current_price(lot.price_usd or 0, lot.created_at) for lot in run_lots)
        run_history.append({
            "name": f"Run {index}",
            "weight_g": round(weight * 1000, 1),
            "value_usd": round(value, 2),
            "pieces": sum(lot.piece_count or 0 for lot in run_lots) or scan.piece_count or 0,
        })
    if not run_history and lots:
        run_history.append({
            "name": "Current",
            "weight_g": round(total_weight * 1000, 1),
            "value_usd": round(inventory_value, 2),
            "pieces": total_pieces,
        })

    status_mix = [
        {"name": "Available", "value": len(available)},
        {"name": "Claimed", "value": len(claimed)},
        {"name": "Unlisted", "value": len(unlisted)},
    ]

    quick_action_lots = sorted(
        active_inventory,
        key=lambda lot: (
            -current_price(lot.price_usd or 0, lot.created_at),
            0 if lot.status == "available" else 1,
            lot.created_at,
        ),
    )

    recommended_actions = []
    if not lots:
        recommended_actions.append({
            "title": "Run first table scan",
            "detail": "The dashboard will populate immediately after the factory photo creates lots.",
            "tone": "neutral",
        })
    if available:
        recommended_actions.append({
            "title": f"{len(available)} lots live on the marketplace",
            "detail": "Monitor price, impact, and buyer claim activity from this panel.",
            "tone": "positive",
        })
    if unlisted:
        recommended_actions.append({
            "title": f"{len(unlisted)} lots hidden from buyers",
            "detail": "Re-publish high-quality lots when they are ready for sale.",
            "tone": "warning",
        })
    if claimed:
        recommended_actions.append({
            "title": f"{len(claimed)} lots claimed",
            "detail": "Revenue and diversion are already locked into the impact totals.",
            "tone": "positive",
        })

    return {
        "has_data": bool(lots),
        "generated_at": datetime.utcnow().isoformat(),
        "revenue": round(revenue, 2),
        "estimated_cost": round(estimated_cost, 2),
        "gross_profit": round(gross_profit, 2),
        "profit_margin_pct": round(gross_profit / revenue * 100, 1) if revenue else 0,
        "inventory_value": round(inventory_value, 2),
        "unlisted_value": round(unlisted_value, 2),
        "avg_price_per_kg": round(avg_price_per_kg, 2),
        "total_lots": len(lots),
        "available_lots": len(available),
        "claimed_lots": len(claimed),
        "unlisted_lots": len(unlisted),
        "claim_rate_pct": round(len(claimed) / len(lots) * 100, 1) if lots else 0,
        "avg_days_to_claim": (
            round(sum(days_listed(lot.created_at) for lot in claimed) / len(claimed), 1)
            if claimed else 0
        ),
        "total_pieces": total_pieces,
        "total_weight_kg": _round_small(total_weight, normal_digits=2),
        "total_carbon_saved_kg": _round_small(total_carbon, normal_digits=2),
        "total_water_saved_l": round(total_water, 1),
        "carbon_equiv_car_miles": round(total_carbon * 2.48, 1),
        "carbon_equiv_phones": int(total_carbon * 122),
        "water_equiv_showers": round(total_water / 65, 1),
        "water_equiv_bottles": int(total_water / 0.5),
        "energy_saved_kwh": round(total_weight * 15, 2),
        "diversion_target_kg": DIVERSION_TARGET_KG,
        "diversion_pct": min(100, round(total_weight / DIVERSION_TARGET_KG * 100, 1)) if DIVERSION_TARGET_KG else 0,
        "recent_runs": recent_runs,
        "fabric_stats": fabric_rows,
        "fabric_impact": [
            {
                "fabric": row["fabric_type"],
                "carbon_kg": row["carbon_kg"],
                "water_l": row["water_l"],
                "weight_kg": row["weight_kg"],
            }
            for row in fabric_rows
        ],
        "run_history": run_history,
        "status_mix": status_mix,
        "quick_action_lots": [_lot_row(lot) for lot in quick_action_lots],
        "recommended_actions": recommended_actions[:4],
    }


@router.post("/reset-demo")
def reset_demo(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Wipe scanned inventory and scan summaries for a clean pitch restart."""
    if current_user.role not in ("factory", "admin"):
        raise HTTPException(status_code=403, detail="Not allowed")

    deleted_lots = db.query(models.Lot).delete()
    deleted_runs = db.query(models.ScanRun).delete()
    db.commit()

    try:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("ALTER TABLE public.lots ALTER COLUMN id RESTART WITH 1"))
            db.execute(text("ALTER TABLE public.scan_runs ALTER COLUMN id RESTART WITH 1"))
            db.commit()
    except Exception:
        db.rollback()

    return {"status": "ok", "deleted_lots": deleted_lots, "deleted_scan_runs": deleted_runs}
